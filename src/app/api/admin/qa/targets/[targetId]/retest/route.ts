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
import { executeLocalDevRun } from "@/lib/admin/qa/dev-test-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Starts one allow-listed pack for the currently deployed staging revision. */
export const POST = withSuperAdmin(async (req: NextRequest, { params }) => {
  const targetId = params?.targetId;
  if (!targetId || !getTargetById(targetId))
    return NextResponse.json({ error: "Unknown QA target" }, { status: 404 });
  const [pack] = resolveTargetedSmokePacks([targetId]);
  if (!pack)
    return NextResponse.json(
      { error: "No active targeted Smoke pack is registered" },
      { status: 409 },
    );
  const url = new URL(req.url);
  const requestedProfile = url.searchParams.get("profile") === "regression" ? "regression" : "smoke";
  const runProfile = requestedProfile === "regression" ? "manual-regression" : "manual-retest";
  const isDev = process.env.NODE_ENV === "development";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || (isDev ? "abcdef1" : undefined);
  const github = githubAppConfigFromEnv();
  if ((!commitSha || !github) && !isDev)
    return NextResponse.json(
      { error: "Targeted Smoke is not configured for this staging revision" },
      { status: 503 },
    );

  const payload = await getPayload({ config });
  const andClauses: Array<{ targetId?: { equals: string }; commitSha?: { equals: string }; environment?: { equals: string } }> = [
    { targetId: { equals: targetId } },
    { environment: { equals: "staging" } },
  ];
  if (commitSha) {
    andClauses.push({ commitSha: { equals: commitSha } });
  }

  const latest = await payload.find({
    collection: "qa_test_runs",
    where: {
      and: andClauses,
    },
    sort: "-finishedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const sourceRun = latest.docs[0];
  const pullRequest = sourceRun?.pullRequest ?? (isDev ? 1746 : undefined);
  if (!pullRequest)
    return NextResponse.json(
      { error: "Retest requires a recorded staging PR/SHA for this target" },
      { status: 409 },
    );

  const requestDigest = crypto
    .createHash("sha256")
    .update(`${targetId}:${commitSha}:${pullRequest}:${Date.now()}`)
    .digest("hex");
  const outcome = await claimTargetedSmokeDispatch(payload, {
    pullRequest,
    commitSha: commitSha!,
    environment: "staging",
    profile: runProfile,
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

    if (isDev) {
      const testCases = pack.manualProfiles?.[requestedProfile]?.testCases ?? pack.testCases;
      await executeLocalDevRun(payload, {
        dispatchId: outcome.dispatch.id,
        targetId,
        profile: runProfile,
        runner: pack.runner ?? "smoke",
        testCaseIds: testCases.map((tc) => tc.id),
        pullRequest,
        commitSha: commitSha!,
        durationMs: 350,
      });

      return NextResponse.json(
        {
          data: {
            id: outcome.dispatch.id,
            status: "dispatched",
            packId: pack.packId,
            profile: requestedProfile,
          },
        },
        { status: 202 },
      );
    }

    if (!github) throw new Error("GitHub App configuration disappeared during dispatch");
    await dispatchTargetedSmokeWorkflow(github, {
      dispatchId: String(outcome.dispatch.id),
      commitSha: commitSha!,
      packId: pack.packId,
      workflowNonce: outcome.dispatch.workflowNonce ?? "",
      runProfile,
    });
  } catch (error) {
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
        profile: requestedProfile,
      },
    },
    { status: 202 },
  );
});
