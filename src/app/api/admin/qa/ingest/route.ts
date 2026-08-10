import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Where } from "payload";
import config from "@payload-config";
import {
  QaRunSummarySchema,
  deriveQaRunStatusForSuite,
  hasApprovedArtifactUrl,
  verifyQaIngestSignature,
  type QaRunSummary,
} from "@/lib/admin/qa/contracts";
import { withQaIngestTransaction } from "@/lib/payload/qa-ingest-transaction";
import { TARGETED_SMOKE_PACKS } from "@/lib/admin/qa/targeted-smoke-registry";
import { createQaEvidenceUrl } from "@/lib/admin/qa/safe-evidence";
import { lockQaTargetedFixture } from "@/lib/payload/qa-targeted-dispatch-transaction";

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
            status: deriveQaRunStatusForSuite(summary.suite, summary.results),
            pullRequest: summary.pullRequest,
            commitSha: summary.commitSha,
            startedAt: summary.startedAt,
            finishedAt: summary.finishedAt,
            summary: summary.summary,
          },
          ...options,
        });
        const evidenceBaseUrl = process.env.QA_EVIDENCE_BASE_URL;
        const evidenceSecret = process.env.QA_INGEST_SECRET;
        const generatedEvidence =
          evidenceBaseUrl && evidenceSecret
            ? createQaEvidenceUrl(createdRun.id, evidenceBaseUrl, evidenceSecret)
            : undefined;
        if (summary.targetedDispatch) {
          let dispatch = await payload.findByID({
            collection: "qa_smoke_dispatches",
            id: summary.targetedDispatch.dispatchId,
            ...options,
          }) as {
            id: string | number;
            status?: string;
            targetId?: string;
            packId?: string;
            packVersion?: number;
            pullRequest?: number;
            workflowRunId?: string;
            workflowAttempt?: number;
            commitSha?: string;
            environment?: string;
            fixtureKey?: string;
          };
          if (!dispatch.fixtureKey)
            throw new IngestConflictError("Targeted Smoke dispatch has no fixture lease");
          // Reconciliation and terminal binding share this advisory lock. The
          // second read below prevents the cron from overwriting a terminal run.
          await lockQaTargetedFixture(payload, "staging", dispatch.fixtureKey, transactionReq);
          dispatch = await payload.findByID({
            collection: "qa_smoke_dispatches",
            id: summary.targetedDispatch.dispatchId,
            ...options,
          }) as typeof dispatch;
          if (
            dispatch.status !== "dispatched" ||
            dispatch.targetId !== summary.targetId ||
            dispatch.packId !== summary.targetedDispatch.packId ||
            dispatch.packVersion !== summary.targetedDispatch.packVersion ||
            dispatch.commitSha !== summary.commitSha ||
            dispatch.environment !== summary.environment
          )
            throw new IngestConflictError(
              "Targeted Smoke terminal result does not match its dispatch",
            );
          if (
            dispatch.workflowRunId !== summary.workflowRunId ||
            dispatch.workflowAttempt !== summary.attempt
          )
            throw new IngestConflictError(
              "Targeted Smoke terminal result was not claimed by this workflow",
            );
          if (
            summary.pullRequest !== undefined &&
            summary.pullRequest !== dispatch.pullRequest
          )
            throw new IngestConflictError(
              "Targeted Smoke terminal result has a different pull request",
            );
          const expectedPack = TARGETED_SMOKE_PACKS.find(
            (pack) =>
              pack.packId === summary.targetedDispatch?.packId &&
              pack.packVersion === summary.targetedDispatch?.packVersion &&
              pack.targetId === summary.targetId,
          );
          const expectedTestCaseIds = expectedPack?.testCases.map((testCase) => testCase.id).sort();
          const receivedTestCaseIds = summary.results.map((result) => result.testCaseId).sort();
          if (
            !expectedTestCaseIds ||
            expectedTestCaseIds.length !== receivedTestCaseIds.length ||
            expectedTestCaseIds.some((id, index) => id !== receivedTestCaseIds[index])
          )
            throw new IngestConflictError(
              "Targeted Smoke terminal result must include exactly its declared test cases",
            );
          await payload.update({
            collection: "qa_smoke_dispatches",
            id: dispatch.id,
            data: {
              status: "terminal",
              workflowRunId: summary.workflowRunId,
              workflowAttempt: summary.attempt,
              terminalRun: createdRun.id,
            },
            ...options,
          });
          // The server-owned dispatch is the PR authority. GitHub Actions does
          // not receive a mutable PR input, so evidence cannot be relabelled.
          if (dispatch.pullRequest !== undefined)
            await payload.update({
              collection: "qa_test_runs",
              id: createdRun.id,
              data: { pullRequest: dispatch.pullRequest },
              ...options,
            });
          const activeLeases = await payload.find({
            collection: "qa_fixture_leases",
            where: {
              and: [
                { dispatch: { equals: dispatch.id } },
                { status: { equals: "active" } },
              ],
            },
            limit: 10,
            ...options,
          });
          for (const lease of activeLeases.docs) {
            await payload.update({
              collection: "qa_fixture_leases",
              id: lease.id,
              data: { status: "released", releasedAt: summary.finishedAt },
              ...options,
            });
          }
        }
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
              artifactUrl: generatedEvidence?.url ?? result.artifactUrl,
              artifactExpiresAt: generatedEvidence?.expiresAt ?? result.artifactExpiresAt,
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
