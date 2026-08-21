import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getTargetById } from "@/lib/admin/qa/target-registry";
import { resolveTargetedSmokePacks } from "@/lib/admin/qa/targeted-smoke-registry";
import {
  blockTargetedSmokeDispatch,
  claimTargetedSmokeDispatch,
} from "@/lib/admin/qa/targeted-smoke-dispatch";
import {
  dispatchTargetedSmokeWorkflow,
  GitHubWorkflowDispatchRejectedError,
  githubAppConfigFromEnv,
} from "@/lib/admin/qa/github-targeted-smoke";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Starts one allow-listed pack for the currently deployed staging revision. */
export const POST = withSuperAdmin(async (_req: NextRequest, { params }) => {
  const targetId = params?.targetId;
  if (!targetId || !getTargetById(targetId))
    return NextResponse.json({ error: "Unknown QA target" }, { status: 404 });
  const [pack] = resolveTargetedSmokePacks([targetId]);
  if (!pack)
    return NextResponse.json(
      { error: "No active targeted Smoke pack is registered" },
      { status: 409 },
    );
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const github = githubAppConfigFromEnv();
  if (!commitSha || !github)
    return NextResponse.json(
      { error: "Targeted Smoke is not configured for this staging revision" },
      { status: 503 },
    );

  const payload = await getPayload({ config });
  const latest = await payload.find({
    collection: "qa_test_runs",
    where: {
      and: [
        { targetId: { equals: targetId } },
        { commitSha: { equals: commitSha } },
        { environment: { equals: "staging" } },
      ],
    },
    sort: "-finishedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const sourceRun = latest.docs[0];
  if (!sourceRun?.pullRequest)
    return NextResponse.json(
      { error: "Retest requires a recorded staging PR/SHA for this target" },
      { status: 409 },
    );

  const requestDigest = crypto
    .createHash("sha256")
    .update(`${targetId}:${commitSha}:${sourceRun.pullRequest}:${Date.now()}`)
    .digest("hex");
  const outcome = await claimTargetedSmokeDispatch(payload, {
    pullRequest: sourceRun.pullRequest,
    commitSha,
    environment: "staging",
    profile: "manual-retest",
    requestDigest,
    retestNonce: crypto.randomUUID(),
    pack,
  });
  if (outcome.blocked)
    return NextResponse.json(
      { data: { id: outcome.dispatch.id, status: "blocked" } },
      { status: 409 },
    );
  let markedDispatched = false;
  try {
    await payload.update({
      collection: "qa_smoke_dispatches",
      id: outcome.dispatch.id,
      data: { status: "dispatched" },
      overrideAccess: true,
    });
    markedDispatched = true;
    await dispatchTargetedSmokeWorkflow(github, {
      dispatchId: String(outcome.dispatch.id),
      commitSha,
      packId: pack.packId,
      workflowNonce: outcome.dispatch.workflowNonce ?? "",
      runProfile: "manual-retest",
    });
  } catch (error) {
    // Before the external call has started, a local failure is definite and
    // its queued lease must be released. After it starts, only an explicit
    // GitHub rejection is safe to compensate: a network error can mean the
    // workflow was accepted, so reconciliation owns that ambiguous lease.
    if (
      !markedDispatched ||
      error instanceof GitHubWorkflowDispatchRejectedError
    )
      await blockTargetedSmokeDispatch(
        payload,
        { id: outcome.dispatch.id, fixtureKey: pack.fixtureKey },
        "GITHUB_DISPATCH_FAILED",
        "Retry after GitHub Actions is available.",
      );
    return NextResponse.json(
      { error: "Targeted Smoke could not be dispatched" },
      { status: 503 },
    );
  }
  return NextResponse.json(
    {
      data: {
        id: outcome.dispatch.id,
        status: "dispatched",
        packId: pack.packId,
      },
    },
    { status: 202 },
  );
});
