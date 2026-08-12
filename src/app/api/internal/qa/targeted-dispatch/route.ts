import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import {
  verifyQaIngestSignature,
} from "@/lib/admin/qa/contracts";
import { parseCoverageMap, resolveChangeImpact } from "@/lib/admin/qa/change-impact";
import {
  TARGETED_SMOKE_PACKS,
  resolveTargetedSmokePacks,
  validateTargetedSmokePacks,
} from "@/lib/admin/qa/targeted-smoke-registry";
import {
  blockTargetedSmokeDispatch,
  claimTargetedSmokeDispatch,
  recordTargetedSmokeCoverageGap,
} from "@/lib/admin/qa/targeted-smoke-dispatch";
import {
  dispatchTargetedSmokeWorkflow,
  GitHubWorkflowDispatchRejectedError,
  githubAppConfigFromEnv,
} from "@/lib/admin/qa/github-targeted-smoke";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 100_000;
const SafePath = z.string().trim().min(1).max(500).regex(/^[A-Za-z0-9 _./@()[\]-]+$/);
const DeployEventSchema = z.object({
  pullRequest: z.number().int().positive(),
  commitSha: z.string().trim().regex(/^[a-f0-9]{7,64}$/i),
  environment: z.literal("staging"),
  changedPaths: z.array(SafePath).min(1).max(500),
}).strict();

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
        throw new Error("Payload too large");
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

function readCoverageMap() {
  const mapPath = path.join(process.cwd(), "qa", "coverage-map.yml");
  return parseCoverageMap(fs.readFileSync(mapPath, "utf8"));
}

async function persistChangeSnapshot(
  payload: Awaited<ReturnType<typeof getPayload>>,
  event: z.infer<typeof DeployEventSchema>,
  impact: ReturnType<typeof resolveChangeImpact>,
): Promise<boolean> {
  const snapshot = {
    pullRequest: event.pullRequest,
    commitSha: event.commitSha,
    environment: event.environment,
    changedPaths: [...event.changedPaths].sort(),
    mappedTargetIds: [...impact.mappedTargetIds].sort(),
    unmappedPaths: [...impact.unmappedPaths].sort(),
    coverageMapVersion: impact.coverageMapVersion,
  };
  const snapshotDigest = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const existing = await payload.find({
    collection: "qa_change_snapshots",
    where: {
      and: [
        { pullRequest: { equals: snapshot.pullRequest } },
        { commitSha: { equals: snapshot.commitSha } },
        { environment: { equals: snapshot.environment } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const stored = existing.docs[0];
  if (stored) return stored.snapshotDigest === snapshotDigest;
  await payload.create({
    collection: "qa_change_snapshots",
    data: { ...snapshot, snapshotDigest },
    overrideAccess: true,
  });
  return true;
}

/** GitHub Actions-only deployment event handler. No browser auth path exists. */
export async function POST(req: NextRequest) {
  if (process.env.F40_TARGETED_SMOKE_ENABLED !== "true")
    return NextResponse.json({ error: "Targeted Smoke dispatch is disabled" }, { status: 503 });
  const secret = process.env.QA_TARGETED_DISPATCH_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Targeted Smoke dispatch is not configured" }, { status: 503 });

  let rawBody: string;
  try {
    rawBody = await readBoundedBody(req);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!verifyQaIngestSignature(rawBody, req.headers.get("x-qa-signature"), req.headers.get("x-qa-timestamp"), secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }
  const event = DeployEventSchema.safeParse(raw);
  if (!event.success)
    return NextResponse.json({ error: "Validation error", details: event.error.flatten() }, { status: 422 });
  if (!process.env.VERCEL_GIT_COMMIT_SHA)
    return NextResponse.json({ error: "Deployed staging revision is unavailable" }, { status: 503 });
  if (process.env.VERCEL_GIT_COMMIT_SHA !== event.data.commitSha)
    return NextResponse.json({ error: "Commit is not the deployed staging revision" }, { status: 409 });

  let coverageMap;
  try {
    coverageMap = readCoverageMap();
    validateTargetedSmokePacks(
      TARGETED_SMOKE_PACKS,
      new Set(coverageMap.rules.flatMap((rule) => rule.targets)),
    );
  } catch {
    return NextResponse.json({ error: "Targeted Smoke registry is invalid" }, { status: 503 });
  }
  const impact = resolveChangeImpact(event.data.changedPaths, coverageMap);
  const payload = await getPayload({ config });
  if (!(await persistChangeSnapshot(payload, event.data, impact)))
    return NextResponse.json({ error: "Deploy impact snapshot already exists with different mapping data" }, { status: 409 });
  const github = githubAppConfigFromEnv();
  const requestDigest = crypto.createHash("sha256").update(rawBody).digest("hex");
  const outcomes = [] as Array<{ id: string | number; targetId: string; status: string }>;
  const packs = resolveTargetedSmokePacks(impact.mappedTargetIds);
  const activeTargetIds = new Set(packs.map((pack) => pack.targetId));
  for (const targetId of impact.mappedTargetIds.filter((targetId) => !activeTargetIds.has(targetId))) {
    const outcome = await recordTargetedSmokeCoverageGap(payload, {
      pullRequest: event.data.pullRequest,
      commitSha: event.data.commitSha,
      environment: event.data.environment,
      profile: "targeted-smoke",
      requestDigest,
      targetId,
    });
    outcomes.push({ id: outcome.dispatch.id, targetId, status: "blocked" });
  }
  if (!packs.length)
    return NextResponse.json({ data: outcomes, coverageGap: true }, { status: 202 });
  if (!github)
    return NextResponse.json({ error: "GitHub App dispatch is not configured" }, { status: 503 });

  for (const pack of packs) {
    const outcome = await claimTargetedSmokeDispatch(payload, {
      pullRequest: event.data.pullRequest,
      commitSha: event.data.commitSha,
      environment: event.data.environment,
      profile: "targeted-smoke",
      requestDigest,
      pack,
    });
    if (outcome.created && !outcome.blocked) {
      try {
        // The workflow can post terminal evidence immediately after GitHub's
        // 204. Mark it dispatchable before the external call to avoid a fast
        // terminal delivery being rejected while the ledger still says queued.
        await payload.update({
          collection: "qa_smoke_dispatches",
          id: outcome.dispatch.id,
          data: { status: "dispatched" },
          overrideAccess: true,
        });
        await dispatchTargetedSmokeWorkflow(github, {
          dispatchId: String(outcome.dispatch.id),
          commitSha: event.data.commitSha,
          packId: pack.packId,
          workflowNonce: outcome.dispatch.workflowNonce ?? "",
          runProfile: "targeted-smoke",
        });
      } catch (error) {
        if (error instanceof GitHubWorkflowDispatchRejectedError) {
          await blockTargetedSmokeDispatch(
            payload,
            { id: outcome.dispatch.id, fixtureKey: pack.fixtureKey },
            "GITHUB_DISPATCH_FAILED",
            "Retry the deploy event after GitHub Actions is available.",
          );
          outcomes.push({ id: outcome.dispatch.id, targetId: pack.targetId, status: "blocked" });
          continue;
        }
        // A network error after request transmission is ambiguous: GitHub may
        // have accepted the run. Retain the lease until expiry/reconciliation
        // instead of risking a second destructive browser run.
        await payload.update({
          collection: "qa_smoke_dispatches",
          id: outcome.dispatch.id,
          data: {
            status: "dispatched",
            blockCode: "GITHUB_DISPATCH_OUTCOME_UNKNOWN",
            recoveryHint: "Reconcile the GitHub Actions run before the fixture lease expires.",
          },
          overrideAccess: true,
        });
        outcomes.push({ id: outcome.dispatch.id, targetId: pack.targetId, status: "dispatched" });
        continue;
      }
    }
    outcomes.push({
      id: outcome.dispatch.id,
      targetId: pack.targetId,
      status: outcome.blocked ? "blocked" : outcome.created ? "dispatched" : "existing",
    });
  }
  return NextResponse.json({ data: outcomes, coverageGap: false }, { status: 202 });
}
