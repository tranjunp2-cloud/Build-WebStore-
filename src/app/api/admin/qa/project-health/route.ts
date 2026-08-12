import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getAllActiveTargets } from "@/lib/admin/qa/target-registry";
import {
  calculateProjectHealthSummary,
  calculateTargetHealth,
  type ChangeImpactInput,
  type ConfirmedGithubIssueInput,
  type QaRunInput,
} from "@/lib/admin/qa/health-calculator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/qa/project-health
 * Super-admin protected route that calculates explainable health for all 67 CMS active targets.
 */
export const GET = withSuperAdmin(async (_req: NextRequest) => {
  const payload = await getPayload({ config });

  // Fetch recent test runs
  const runsResult = await payload.find({
    collection: "qa_test_runs",
    limit: 500,
    sort: "-finishedAt",
    depth: 0,
  });

  const runs: QaRunInput[] = (
    runsResult.docs as Array<Record<string, unknown>>
  ).map((doc) => ({
    id: String(doc.id),
    targetId: String(doc.targetId ?? ""),
    status: String(doc.status ?? "") as QaRunInput["status"],
    finishedAt: String(doc.finishedAt ?? ""),
    pullRequest:
      typeof doc.pullRequest === "number"
        ? doc.pullRequest
        : doc.pullRequest
          ? Number(doc.pullRequest)
          : undefined,
    commitSha: doc.commitSha ? String(doc.commitSha) : undefined,
    summary: doc.summary as QaRunInput["summary"],
  }));

  // Fetch recent change impact snapshots
  const snapshotsResult = await payload.find({
    collection: "qa_change_snapshots",
    pagination: false,
    sort: "-createdAt",
    depth: 0,
  });

  const changeImpacts: ChangeImpactInput[] = [];
  for (const doc of snapshotsResult.docs as Array<Record<string, unknown>>) {
    const mappedIds = (doc.mappedTargetIds as string[]) ?? [];
    for (const targetId of mappedIds) {
      changeImpacts.push({
        id: doc.id ? String(doc.id) : undefined,
        targetId,
        pullRequest: Number(doc.pullRequest) || 0,
        commitSha: String(doc.commitSha ?? ""),
        createdAt: String(doc.createdAt ?? ""),
      });
    }
  }

  const githubIssuesResult = await payload.find({
    collection: "qa_github_issues",
    where: { and: [{ state: { equals: "open" } }, { severity: { equals: "P1" } }, { mappingStatus: { equals: "confirmed" } }] },
    pagination: false,
    depth: 0,
  });
  const githubIssues: ConfirmedGithubIssueInput[] = (githubIssuesResult.docs as Array<Record<string, unknown>>)
    .filter((doc) => typeof doc.targetId === "string" && typeof doc.issueNumber === "number" && typeof doc.url === "string" && typeof doc.title === "string")
    .map((doc) => ({ id: String(doc.id), issueNumber: doc.issueNumber as number, url: doc.url as string, title: doc.title as string, targetId: doc.targetId as string, state: "open", severity: "P1", mappingStatus: "confirmed" }));

  const activeTargets = getAllActiveTargets();
  const targetHealthResults = activeTargets.map((target) =>
    calculateTargetHealth(target, {
      runs,
      changeImpacts,
      githubIssues,
    }),
  );

  const summary = calculateProjectHealthSummary(targetHealthResults);

  return NextResponse.json({
    data: {
      targets: targetHealthResults,
      summary,
    },
  });
});
