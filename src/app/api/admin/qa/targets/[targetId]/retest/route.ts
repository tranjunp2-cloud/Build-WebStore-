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
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || (process.env.NODE_ENV === "development" ? "abcdef1" : undefined);
  const github = githubAppConfigFromEnv();
  if ((!commitSha || !github) && process.env.NODE_ENV !== "development")
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
        { commitSha: { equals: commitSha ?? "abcdef1" } },
        { environment: { equals: "staging" } },
      ],
    },
    sort: "-finishedAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const sourceRun = latest.docs[0];
  const pullRequest = sourceRun?.pullRequest ?? (process.env.NODE_ENV === "development" ? 1746 : undefined);
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
    commitSha: commitSha ?? "abcdef1",
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

    if (process.env.NODE_ENV === "development") {
      setTimeout(async () => {
        try {
          const runId = `local-retest-${outcome.dispatch.id}-${Date.now()}`;
          const digest = crypto.createHash("sha256").update(runId).digest("hex");
          const testCases = pack.manualProfiles?.[requestedProfile]?.testCases ?? pack.testCases;

          const run = await payload.create({
            collection: "qa_test_runs",
            data: {
              workflowRunId: runId,
              attempt: 1,
              ingestDigest: digest,
              targetId,
              suite: "targeted-smoke",
              profile: runProfile,
              runner: pack.runner ?? "smoke",
              environment: "staging",
              status: "passed",
              pullRequest,
              commitSha: commitSha ?? "abcdef1",
              startedAt: new Date(Date.now() - 1500).toISOString(),
              finishedAt: new Date().toISOString(),
              summary: {
                passed: testCases.length,
                failed: 0,
                skipped: 0,
                blocked: 0,
              },
            },
            overrideAccess: true,
          });

          for (const tc of testCases) {
            await payload.create({
              collection: "qa_test_results",
              data: {
                run: run.id,
                suite: "targeted-smoke",
                testCaseId: tc.id,
                status: "passed",
                durationMs: 350,
                assertionCode: `ASSERTION_${tc.id.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_OK`,
                actualSummary: "Retest completed cleanly in local environment.",
                expectedSummary: tc.assertion || "Target verified against contract.",
              },
              overrideAccess: true,
            });
          }

          await payload.update({
            collection: "qa_smoke_dispatches",
            id: outcome.dispatch.id,
            data: { status: "terminal", workflowRunId: runId },
            overrideAccess: true,
          });

          const leases = await payload.find({
            collection: "qa_fixture_leases",
            where: { and: [{ dispatch: { equals: outcome.dispatch.id } }, { status: { equals: "active" } }] },
            limit: 10,
            overrideAccess: true,
          });
          await Promise.all(
            leases.docs.map((lease) =>
              payload.update({
                collection: "qa_fixture_leases",
                id: lease.id,
                data: { status: "released", releasedAt: new Date().toISOString() },
                overrideAccess: true,
              }),
            ),
          );
        } catch (e) {
          console.error("Local simulated retest execution error:", e);
        }
      }, 1500);

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
      commitSha: commitSha ?? "abcdef1",
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
