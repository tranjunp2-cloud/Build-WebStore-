import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { createQaFindingFingerprint } from "@/lib/admin/qa/findings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TARGET_ID = "editor-productgrid-variants";
const SUITE = "editor-product-grid-variants-smoke";
const TEST_CASE_ID = "TC-F40-04-02";
const IMPACT_TARGET_ID = "editor-publish-lifecycle";
const MANUAL_CONTEXT_TARGET_ID = "editor-block-content";
const MANUAL_CONTEXT_RUN = "local-f40-07-manual-context";
// Impossible production-shaped context reserved exclusively for the local
// E2E fixture. It makes cleanup safe even if a developer points localhost at
// a shared database: real staging runs must never use this pair.
const E2E_MANUAL_PULL_REQUEST = 999_999;
const E2E_MANUAL_COMMIT_SHA = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/**
 * Deterministic local-only test data for the browser contract of F40-04.
 * It is deliberately unavailable in deployed environments and accepts no
 * caller-controlled target, URLs, fixture names, or test result fields.
 */
export const POST = withSuperAdmin(async (_req: NextRequest, { user }) => {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Local fixture only" }, { status: 403 });
  if (user.email?.toLowerCase() !== process.env.TEST_EMAIL?.toLowerCase())
    return NextResponse.json(
      { error: "Dedicated test account required" },
      { status: 403 },
    );

  const payload = await getPayload({ config });
  // Browser runs may be re-executed locally. Release only the dedicated
  // Product Grid test dispatches before seeding so a previous E2E attempt
  // cannot exhaust the real preflight capacity checks.
  const staleDispatches = await payload.find({
    collection: "qa_smoke_dispatches",
    where: {
      and: [
        { targetId: { equals: TARGET_ID } },
        { environment: { equals: "staging" } },
        { requestedBy: { equals: user.id } },
        { pullRequest: { equals: E2E_MANUAL_PULL_REQUEST } },
        { commitSha: { equals: E2E_MANUAL_COMMIT_SHA } },
        { status: { in: ["queued", "dispatched", "cancel_requested"] } },
      ],
    },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const staleIds = staleDispatches.docs.map((dispatch) => String(dispatch.id));
  await Promise.all(
    staleIds.map((id) =>
      payload.update({
        collection: "qa_smoke_dispatches",
        id,
        data: { status: "cancelled", cancelledAt: new Date().toISOString() },
        overrideAccess: true,
      }),
    ),
  );
  if (staleIds.length) {
    const leases = await payload.find({
      collection: "qa_fixture_leases",
      where: { dispatch: { in: staleIds } },
      pagination: false,
      depth: 0,
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
  }
  const workflowRunId = "local-f40-04-product-grid-failure";
  const existing = await payload.find({
    collection: "qa_test_runs",
    where: { workflowRunId: { equals: workflowRunId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const now = new Date().toISOString();
  const visualExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const runData = {
    workflowRunId,
    attempt: 1,
    ingestDigest: "local-f40-04-fixture-v1",
    targetId: TARGET_ID,
    suite: SUITE,
    profile: "local-e2e",
    environment: "local" as const,
    status: "failed" as const,
    pullRequest: 1743,
    commitSha: "local-f40-04-fixture",
    startedAt: now,
    finishedAt: now,
    summary: { passed: 0, failed: 1, skipped: 0, blocked: 0 },
  };
  const run = existing.docs[0]
    ? await payload.update({
        collection: "qa_test_runs",
        id: existing.docs[0].id,
        data: runData,
        overrideAccess: true,
      })
    : await payload.create({
        collection: "qa_test_runs",
        data: runData,
        overrideAccess: true,
      });

  // A verified immutable staging context lets the manual-run browser flow
  // preflight without using a real GitHub deployment.
  const existingManualContext = await payload.find({
    collection: "qa_test_runs",
    where: { workflowRunId: { equals: MANUAL_CONTEXT_RUN } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const manualContextData = {
    workflowRunId: MANUAL_CONTEXT_RUN,
    attempt: 1,
    ingestDigest: "local-f40-07-manual-context-v1",
    // Keep the Staging-context record separate from both Inbox fixtures: a
    // passing context must not hide the failed Product Grid or the untested
    // Page Publish deploy impact that this fixture intentionally verifies.
    targetId: MANUAL_CONTEXT_TARGET_ID,
    suite: SUITE,
    profile: "manual-smoke",
    environment: "staging" as const,
    status: "passed" as const,
    pullRequest: E2E_MANUAL_PULL_REQUEST,
    // The dedicated fixture pair is intentionally not a deploy identifier.
    // The local preflight resolver accepts its seeded staging record; deployed
    // environments cannot call this development-only route.
    commitSha: E2E_MANUAL_COMMIT_SHA,
    startedAt: now,
    finishedAt: now,
    summary: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
  };
  if (existingManualContext.docs[0]) {
    await payload.update({ collection: "qa_test_runs", id: existingManualContext.docs[0].id, data: manualContextData, overrideAccess: true });
  } else {
    await payload.create({ collection: "qa_test_runs", data: manualContextData, overrideAccess: true });
  }

  const prior = await payload.find({
    collection: "qa_test_results",
    where: {
      and: [
        { run: { equals: run.id } },
        { testCaseId: { equals: TEST_CASE_ID } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const resultData = {
    run: run.id,
    suite: SUITE,
    testCaseId: TEST_CASE_ID,
    status: "failed" as const,
    durationMs: 120,
    assertionCode: "VISUAL_THRESHOLD_EXCEEDED",
    fixtureReference: "QA-Tshirt-SML",
    expectedCount: 3,
    actualCount: 2,
    owner: "qa-editor-team",
    expectedSummary: "S, M và L xuất hiện đúng một lần",
    actualSummary: "Chỉ thấy S và M",
    classification: "product" as const,
    visualBaselineUrl: `https://qa-e2e.local/sanitized/baseline?expiresAt=${encodeURIComponent(visualExpiresAt)}`,
    visualBaselineExpiresAt: visualExpiresAt,
    visualCurrentUrl: `https://qa-e2e.local/sanitized/current?expiresAt=${encodeURIComponent(visualExpiresAt)}`,
    visualCurrentExpiresAt: visualExpiresAt,
    visualDiffUrl: `https://qa-e2e.local/sanitized/diff?expiresAt=${encodeURIComponent(visualExpiresAt)}`,
    visualDiffExpiresAt: visualExpiresAt,
    visualThresholdPercent: 1,
    visualDifferencePercent: 2,
    visualReviewStatus: "pending_review" as const,
    artifactUrl: `https://qa-e2e.local/sanitized/report?expiresAt=${encodeURIComponent(visualExpiresAt)}`,
    artifactExpiresAt: visualExpiresAt,
  };
  const result = prior.docs[0]
    ? await payload.update({
        collection: "qa_test_results",
        id: prior.docs[0].id,
        data: resultData,
        overrideAccess: true,
      })
    : await payload.create({
        collection: "qa_test_results",
        data: resultData,
        overrideAccess: true,
      });

  const fingerprint = createQaFindingFingerprint({
    targetId: TARGET_ID,
    suite: SUITE,
    testCaseId: TEST_CASE_ID,
    assertionCode: "VISUAL_THRESHOLD_EXCEEDED",
  });
  const existingFinding = await payload.find({
    collection: "qa_findings",
    where: { fingerprint: { equals: fingerprint } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const findingData = {
    fingerprint,
    targetId: TARGET_ID,
    suite: SUITE,
    testCaseId: TEST_CASE_ID,
    assertionCode: "VISUAL_THRESHOLD_EXCEEDED",
    expectedCount: 3,
    actualCount: 2,
    severity: "P1" as const,
    lifecycle: "needs_review" as const,
    latestRun: run.id,
    latestResult: result.id,
    latestEvidenceExpiresAt: visualExpiresAt,
    promotionState: "not_requested" as const,
    promotionLeaseExpiresAt: undefined,
    githubIssue: undefined,
    githubMarker: undefined,
    lifecycleAudit: [
      { at: now, from: null, to: "needs_review", reason: "local_e2e_seed" },
    ],
  };
  let finding;
  try {
    finding = existingFinding.docs[0]
      ? await payload.update({
          collection: "qa_findings",
          id: existingFinding.docs[0].id,
          data: findingData,
          overrideAccess: true,
        })
      : await payload.create({
          collection: "qa_findings",
          data: findingData,
          overrideAccess: true,
        });
  } catch (error) {
    // This local-only fixture must make setup errors diagnosable without
    // exposing them to the browser or any deployed environment.
    console.error("[F40-06 E2E fixture] finding seed failed", error);
    return NextResponse.json({ error: "Local fixture seed failed" }, { status: 500 });
  }

  // Seed a second, lower-priority action so the browser contract proves that
  // a concrete failed scenario is listed before an untested deploy impact.
  const snapshotDigest = "local-f40-04-watch-impact-v1";
  const existingSnapshot = await payload.find({
    collection: "qa_change_snapshots",
    where: { snapshotDigest: { equals: snapshotDigest } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const snapshotData = {
    pullRequest: 1743,
    commitSha: "local-f40-04-fixture",
    environment: "staging" as const,
    changedPaths: ["src/app/studio/qa/page.tsx"],
    mappedTargetIds: [IMPACT_TARGET_ID],
    unmappedPaths: [],
    coverageMapVersion: "local-f40-04",
    snapshotDigest,
  };
  const snapshot = existingSnapshot.docs[0]
    ? await payload.update({
        collection: "qa_change_snapshots",
        id: existingSnapshot.docs[0].id,
        data: snapshotData,
        overrideAccess: true,
      })
    : await payload.create({
        collection: "qa_change_snapshots",
        data: snapshotData,
        overrideAccess: true,
      });

  return NextResponse.json({
    data: {
      runId: run.id,
      resultId: result.id,
      snapshotId: snapshot.id,
      findingId: finding.id,
      manualContext: {
        pullRequest: manualContextData.pullRequest,
        commitSha: manualContextData.commitSha,
      },
    },
  });
});
