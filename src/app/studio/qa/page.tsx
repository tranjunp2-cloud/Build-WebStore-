import React from "react";
import { getPayload } from "payload";
import config from "@payload-config";
import { getAllActiveTargets } from "@/lib/admin/qa/target-registry";
import {
  calculateProjectHealthSummary,
  calculateTargetHealth,
  type ChangeImpactInput,
  type QaRunInput,
} from "@/lib/admin/qa/health-calculator";
import { ProjectHealthClient } from "./ProjectHealthClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Health | QA Control Center",
};

export default async function QaProjectHealthPage() {
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
    limit: 100,
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

  const activeTargets = getAllActiveTargets();
  const targetHealthResults = activeTargets.map((target) =>
    calculateTargetHealth(target, {
      runs,
      changeImpacts,
    }),
  );

  const summary = calculateProjectHealthSummary(targetHealthResults);

  return (
    <ProjectHealthClient
      initialTargets={targetHealthResults}
      initialSummary={summary}
    />
  );
}
