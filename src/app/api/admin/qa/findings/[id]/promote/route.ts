import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import {
  createGithubFindingIssue,
  findGithubFindingIssue,
  synchronizeGithubIssueMirror,
  type GithubIssueMirror,
} from "@/lib/admin/qa/github-issues";
import {
  isSafeQaFindingEvidence,
  qaFindingMarker,
} from "@/lib/admin/qa/findings";
import { withQaFindingRowLock } from "@/lib/payload/qa-finding-row-lock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Finding = Record<string, unknown> & { id: string | number };

function audit(finding: Finding, reason: string) {
  return [
    ...(Array.isArray(finding.lifecycleAudit) ? finding.lifecycleAudit : []),
    {
      at: new Date().toISOString(),
      from: finding.lifecycle,
      to: finding.lifecycle,
      reason,
    },
  ];
}

/** Bind a known GitHub issue under the same row lock used to reserve promotion. */
async function bindIssue(
  payload: Awaited<ReturnType<typeof getPayload>>,
  id: string,
  issue: GithubIssueMirror,
) {
  await synchronizeGithubIssueMirror(payload, issue);
  const mirror = await payload.find({
    collection: "qa_github_issues",
    where: { issueNumber: { equals: issue.issueNumber } },
    limit: 1,
    overrideAccess: true,
  });
  const mirrorId = mirror.docs[0]?.id;
  if (!mirrorId) throw new Error("GitHub issue mirror reconciliation failed");
  return withQaFindingRowLock(payload, id, async (req) => {
    const finding = (await payload.findByID({
      collection: "qa_findings",
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as Finding;
    if (finding.githubIssue) return finding;
    // GitHub I/O happens outside the short row-lock transaction. A qualifying
    // targeted retest may therefore verify the fix while the remote create is
    // in flight. Binding the resulting issue must not resurrect that finding.
    const verified = finding.lifecycle === "verify_fix";
    return payload.update({
      collection: "qa_findings",
      id,
      data: {
        lifecycle: verified ? "verify_fix" : "github_created",
        promotionState: "created",
        promotionLeaseExpiresAt: undefined,
        githubIssue: mirrorId,
        lifecycleAudit: [
          ...(Array.isArray(finding.lifecycleAudit)
            ? finding.lifecycleAudit
            : []),
          {
            at: new Date().toISOString(),
            from: finding.lifecycle,
            to: verified ? "verify_fix" : "github_created",
            reason: verified
              ? "github_marker_bound_after_verify"
              : "github_marker_bound",
          },
        ],
      },
      overrideAccess: true,
      req,
    });
  });
}

async function markReconciliationRequired(
  payload: Awaited<ReturnType<typeof getPayload>>,
  id: string,
) {
  await withQaFindingRowLock(payload, id, async (req) => {
    const finding = (await payload.findByID({
      collection: "qa_findings",
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as Finding;
    if (finding.githubIssue) return;
    await payload.update({
      collection: "qa_findings",
      id,
      // Keep `promoting` and the deterministic marker durable: a subsequent
      // request may reconcile but is never allowed to submit another POST.
      data: {
        promotionState: "failed",
        promotionLeaseExpiresAt: undefined,
        lifecycleAudit: audit(finding, "github_reconciliation_required"),
      },
      overrideAccess: true,
      req,
    });
  });
}

export const POST = withSuperAdmin(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id || !/^\d+$/.test(id))
    return NextResponse.json({ error: "Invalid finding ID" }, { status: 422 });
  const payload = await getPayload({ config });

  try {
    const reservation = await withQaFindingRowLock(payload, id, async (req) => {
      const finding = (await payload.findByID({
        collection: "qa_findings",
        id,
        depth: 1,
        overrideAccess: true,
        req,
      })) as unknown as Finding;
      if (finding.githubIssue) return { kind: "bound" as const, finding };
      if (typeof finding.githubMarker === "string" && finding.githubMarker)
        return {
          kind: "reconcile" as const,
          finding,
          marker: finding.githubMarker,
        };
      if (finding.lifecycle !== "needs_review")
        return { kind: "conflict" as const };
      const marker = qaFindingMarker(id, String(finding.fingerprint));
      const updated = await payload.update({
        collection: "qa_findings",
        id,
        data: {
          lifecycle: "promoting",
          promotionState: "leased",
          githubMarker: marker,
          promotionLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          lifecycleAudit: [
            ...(Array.isArray(finding.lifecycleAudit)
              ? finding.lifecycleAudit
              : []),
            {
              at: new Date().toISOString(),
              from: "needs_review",
              to: "promoting",
              reason: "github_promotion_reserved",
            },
          ],
        },
        overrideAccess: true,
        req,
      });
      return {
        kind: "reserved" as const,
        finding: updated as unknown as Finding,
        marker,
      };
    });

    if (reservation.kind === "bound")
      return NextResponse.json({ data: reservation.finding });
    if (reservation.kind === "conflict")
      return NextResponse.json(
        { error: "Finding cannot be promoted" },
        { status: 409 },
      );

    // All paths reconcile before POST. A pre-existing marker means a previous
    // process may have reached GitHub, so this request must never create again.
    const existingIssue = await findGithubFindingIssue(reservation.marker);
    if (existingIssue)
      return NextResponse.json({
        data: await bindIssue(payload, id, existingIssue),
      });
    if (reservation.kind === "reconcile")
      return NextResponse.json(
        { error: "GitHub promotion is awaiting marker reconciliation" },
        { status: 409 },
      );

    let issue: GithubIssueMirror;
    try {
      issue = await createGithubFindingIssue({
        title: `[QA] ${reservation.finding.targetId}: ${reservation.finding.assertionCode}`,
        body: `Target: ${reservation.finding.targetId}\nSeverity: ${reservation.finding.severity}\nReproduction: run ${reservation.finding.suite} testcase ${reservation.finding.testCaseId}${(() => {
          const result = reservation.finding.latestResult as
            | Record<string, unknown>
            | undefined;
          const expected =
            typeof result?.expectedSummary === "string"
              ? result.expectedSummary
              : (reservation.finding.expectedCount ?? "n/a");
          const actual =
            typeof result?.actualSummary === "string"
              ? result.actualSummary
              : (reservation.finding.actualCount ?? "n/a");
          const evidence = isSafeQaFindingEvidence(
            result?.artifactUrl,
            result?.artifactExpiresAt,
          )
            ? `\nSafe evidence: ${result.artifactUrl}`
            : "";
          return `\nExpected: ${expected}\nActual: ${actual}${evidence}`;
        })()}`,
        marker: reservation.marker,
      });
    } catch {
      // A timeout can still mean GitHub accepted the request. Search once; if
      // not visible, retain the reservation for human/reconciliation handling.
      try {
        const reconciled = await findGithubFindingIssue(reservation.marker);
        if (reconciled)
          return NextResponse.json({
            data: await bindIssue(payload, id, reconciled),
          });
      } catch {
        // The durable state below preserves the marker even when GitHub is down.
      }
      await markReconciliationRequired(payload, id);
      return NextResponse.json(
        {
          error:
            "GitHub ticket creation is awaiting reconciliation; no retry was sent.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ data: await bindIssue(payload, id, issue) });
  } catch {
    return NextResponse.json(
      {
        error:
          "GitHub ticket creation is unavailable; the finding was retained.",
      },
      { status: 503 },
    );
  }
});
