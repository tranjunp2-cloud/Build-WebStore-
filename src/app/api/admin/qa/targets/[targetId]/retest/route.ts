import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getTargetById } from "@/lib/admin/qa/target-registry";
import {
  resolveTargetedSmokePacks,
  resolveManualQaPack,
  type ManualQaProfile,
} from "@/lib/admin/qa/targeted-smoke-registry";
import { executeLocalDevRun } from "@/lib/admin/qa/dev-test-runner";
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
  const rawProfile = url.searchParams.get("profile");
  type ValidRetestProfile = "regression" | "user_flow" | "impact" | "security";
  const validRetestProfiles: readonly ValidRetestProfile[] = ["regression", "user_flow", "impact", "security"];
  const isRetestProfile = (p: string | null): p is ValidRetestProfile =>
    p !== null && (validRetestProfiles as readonly string[]).includes(p);

  const requestedProfile = isRetestProfile(rawProfile) ? rawProfile : "smoke";
  const runProfile = (requestedProfile === "smoke" ? "manual-retest" : `manual-${requestedProfile}`) as
    | "targeted-smoke"
    | "manual-retest"
    | "manual-smoke"
    | "manual-regression"
    | "manual-user_flow"
    | "manual-impact"
    | "manual-security"
    | "manual-all-profiles";
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

  let outcome;
  try {
    const requestDigest = crypto
      .createHash("sha256")
      .update(`${targetId}:${commitSha}:${pullRequest}:${Date.now()}`)
      .digest("hex");

    outcome = await claimTargetedSmokeDispatch(payload, {
      pullRequest,
      commitSha: commitSha!,
      environment: "staging",
      profile: runProfile,
      requestDigest,
      retestNonce: crypto.randomUUID(),
      pack,
    });
  } catch (claimErr) {
    if (isDev) {
      // Fallback in local dev if transaction advisory lock is not supported
      const devDispatch = await payload.create({
        collection: "qa_smoke_dispatches",
        data: {
          dispatchKey: `${pullRequest}:${commitSha}:staging:${targetId}:${pack.packId}:${Date.now()}`,
          requestDigest: crypto.randomUUID(),
          status: "dispatched",
          profile: runProfile,
          environment: "staging",
          packId: pack.packId,
          targetId: targetId,
          pullRequest: pullRequest,
          commitSha: commitSha!,
        },
        overrideAccess: true,
      });
      outcome = { dispatch: devDispatch, created: true, blocked: false };
    } else {
      return NextResponse.json(
        { error: claimErr instanceof Error ? claimErr.message : "Targeted Smoke could not be claimed" },
        { status: 500 },
      );
    }
  }
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
      const resolvedPack = resolveManualQaPack(targetId, requestedProfile);
      const testCases = resolvedPack?.profile?.testCases ?? pack.manualProfiles?.[requestedProfile]?.testCases ?? pack.testCases;

      const devResult = await executeLocalDevRun(payload, {
        dispatchId: outcome.dispatch.id,
        targetId,
        suite: "targeted-smoke",
        profile: runProfile,
        runner: pack.runner ?? "smoke",
        pullRequest,
        commitSha: commitSha!,
        testCases,
        testCaseIds: testCases.map((tc) => tc.id),
        durationMs: 350,
      });

      return NextResponse.json(
        {
          data: {
            id: outcome.dispatch.id,
            runId: devResult.runDbId,
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
