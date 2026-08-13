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
    },
  });
});
