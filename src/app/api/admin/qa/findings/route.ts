import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { isSafeQaFindingEvidence } from "@/lib/admin/qa/findings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withSuperAdmin(async (_req: NextRequest) => {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "qa_findings",
    where: {
      lifecycle: { in: ["needs_review", "promoting", "github_created"] },
    },
    limit: 100,
    sort: "-updatedAt",
    depth: 1,
    overrideAccess: true,
  });
  return NextResponse.json({
    data: {
      items: result.docs.map((item) => {
        const finding = item as unknown as Record<string, unknown>;
        const run = finding.latestRun as Record<string, unknown> | undefined;
        const result = finding.latestResult as
          | Record<string, unknown>
          | undefined;
        const issue = finding.githubIssue as
          | Record<string, unknown>
          | undefined;
        return {
          id: String(finding.id),
          fingerprint: finding.fingerprint,
          targetId: finding.targetId,
          suite: finding.suite,
          testCaseId: finding.testCaseId,
          assertionCode: finding.assertionCode,
          expectedSummary:
            typeof result?.expectedSummary === "string"
              ? result.expectedSummary
              : finding.expectedCount === undefined
                ? undefined
                : String(finding.expectedCount),
          actualSummary:
            typeof result?.actualSummary === "string"
              ? result.actualSummary
              : finding.actualCount === undefined
                ? undefined
                : String(finding.actualCount),
          severity: finding.severity,
          owner: finding.owner,
          lifecycle: finding.lifecycle,
          run: run?.id
            ? {
                id: String(run.id),
                pullRequest: run.pullRequest,
                commitSha: run.commitSha,
                finishedAt: run.finishedAt,
              }
            : undefined,
          evidence: isSafeQaFindingEvidence(
            result?.artifactUrl,
            result?.artifactExpiresAt,
          )
            ? {
                kind: "report",
                availability: "available",
                url: result?.artifactUrl,
                expiresAt: result?.artifactExpiresAt,
              }
            : undefined,
          githubIssue: issue?.url
            ? {
                issueNumber: issue.issueNumber,
                url: issue.url,
                title: issue.title,
              }
            : undefined,
        };
      }),
    },
  });
});
