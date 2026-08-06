import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import {
  QaRunSummarySchema,
  deriveQaRunStatus,
  hasApprovedArtifactUrl,
  verifyQaIngestSignature,
  type QaRunSummary,
} from "@/lib/admin/qa/contracts";
import { withQaIngestTransaction } from "@/lib/payload/qa-ingest-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 1_000_000;

class IngestConflictError extends Error {}
class BodyTooLargeError extends Error {}

async function readBoundedBody(req: NextRequest): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError("Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth += 1
  ) {
    const record = current as Record<string, unknown>;
    if (record.code === "23505") return true;
    current = record.cause;
  }
  return false;
}

function normalizeSnapshot(
  snapshot: NonNullable<QaRunSummary["changeSnapshot"]>,
) {
  return {
    ...snapshot,
    changedPaths: [...snapshot.changedPaths].sort(),
    mappedTargetIds: [...snapshot.mappedTargetIds].sort(),
    unmappedPaths: [...snapshot.unmappedPaths].sort(),
  };
}

/** GitHub Actions-only endpoint. A terminal delivery is committed atomically or not at all. */
export async function POST(req: NextRequest) {
  const secret = process.env.QA_INGEST_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "QA ingestion is not configured" },
      { status: 503 },
    );
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  let rawBody: string;
  try {
    rawBody = await readBoundedBody(req);
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    throw error;
  }
  if (
    !verifyQaIngestSignature(
      rawBody,
      req.headers.get("x-qa-signature"),
      req.headers.get("x-qa-timestamp"),
      secret,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }
  const parsed = QaRunSummarySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 422 },
    );
  const summary = parsed.data;
  const allowedArtifactHosts = (process.env.QA_ARTIFACT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    summary.results.some(
      (result) =>
        result.artifactUrl &&
        (!result.artifactExpiresAt ||
          !hasApprovedArtifactUrl(
            result.artifactUrl,
            allowedArtifactHosts,
            result.artifactExpiresAt,
          )),
    )
  ) {
    return NextResponse.json(
      { error: "Artifact URL must be an approved, expiring sanitized URL" },
      { status: 422 },
    );
  }

  const digest = crypto.createHash("sha256").update(rawBody).digest("hex");
  const runWhere: Where = {
    and: [
      { workflowRunId: { equals: summary.workflowRunId } },
      { attempt: { equals: summary.attempt } },
      { targetId: { equals: summary.targetId } },
      { suite: { equals: summary.suite } },
    ],
  };
  const payload = await getPayload({ config });

  try {
    const outcome = await withQaIngestTransaction(
      payload,
      async (transactionReq) => {
        const options = { overrideAccess: true, req: transactionReq };
        const existingRun = await payload.find({
          collection: "qa_test_runs",
          where: runWhere,
          limit: 1,
          ...options,
        });
        const run = existingRun.docs[0];
        if (run) {
          if (run.ingestDigest !== digest)
            throw new IngestConflictError(
              "Terminal run already exists with a different payload",
            );
          return { run, created: false };
        }

        const createdRun = await payload.create({
          collection: "qa_test_runs",
          data: {
            workflowRunId: summary.workflowRunId,
            attempt: summary.attempt,
            ingestDigest: digest,
            targetId: summary.targetId,
            suite: summary.suite,
            profile: summary.profile,
            environment: summary.environment,
            status: deriveQaRunStatus(summary.results),
            pullRequest: summary.pullRequest,
            commitSha: summary.commitSha,
            startedAt: summary.startedAt,
            finishedAt: summary.finishedAt,
            summary: summary.summary,
          },
          ...options,
        });
        for (const result of summary.results) {
          await payload.create({
            collection: "qa_test_results",
            data: {
              run: createdRun.id,
              suite: summary.suite,
              testCaseId: result.testCaseId,
              status: result.status,
              durationMs: result.durationMs,
              assertionCode: result.assertionCode,
              expectedCount: result.expectedCount,
              actualCount: result.actualCount,
              artifactUrl: result.artifactUrl,
              artifactExpiresAt: result.artifactExpiresAt,
            },
            ...options,
          });
        }
        if (summary.changeSnapshot) {
          const snapshot = normalizeSnapshot(summary.changeSnapshot);
          const snapshotDigest = crypto
            .createHash("sha256")
            .update(JSON.stringify(snapshot))
            .digest("hex");
          const existingSnapshot = await payload.find({
            collection: "qa_change_snapshots",
            where: {
              and: [
                { pullRequest: { equals: snapshot.pullRequest } },
                { commitSha: { equals: snapshot.commitSha } },
                { environment: { equals: snapshot.environment } },
              ],
            },
            limit: 1,
            ...options,
          });
          const existing = existingSnapshot.docs[0];
          if (existing && existing.snapshotDigest !== snapshotDigest)
            throw new IngestConflictError(
              "Deploy impact snapshot already exists with different mapping data",
            );
          if (!existing)
            await payload.create({
              collection: "qa_change_snapshots",
              data: { ...snapshot, snapshotDigest },
              ...options,
            });
        }
        return { run: createdRun, created: true };
      },
    );
    return NextResponse.json(
      {
        data: {
          id: outcome.run.id,
          workflowRunId: summary.workflowRunId,
          attempt: summary.attempt,
        },
        created: outcome.created,
      },
      { status: outcome.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof IngestConflictError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    if (!isUniqueViolation(error)) throw error;
    const existing = await payload.find({
      collection: "qa_test_runs",
      where: runWhere,
      limit: 1,
      overrideAccess: true,
    });
    const run = existing.docs[0];
    if (!run) throw error;
    if (run.ingestDigest !== digest)
      return NextResponse.json(
        { error: "Terminal run already exists with a different payload" },
        { status: 409 },
      );
    return NextResponse.json({
      data: {
        id: run.id,
        workflowRunId: summary.workflowRunId,
        attempt: summary.attempt,
      },
      created: false,
    });
  }
}
