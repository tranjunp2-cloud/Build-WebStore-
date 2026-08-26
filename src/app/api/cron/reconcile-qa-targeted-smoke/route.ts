import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { blockTargetedSmokeDispatch } from "@/lib/admin/qa/targeted-smoke-dispatch";
import { cancelTargetedSmokeWorkflow, getTargetedSmokeWorkflowState, githubAppConfigFromEnv } from "@/lib/admin/qa/github-targeted-smoke";
import { withQaTargetedDispatchTransaction } from "@/lib/payload/qa-targeted-dispatch-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resolves ambiguous GitHub dispatches conservatively. A run that never makes
 * either never makes its one-time start claim or never reaches terminal ingest
 * before its lease expires is blocked and released; it is never silently
 * re-dispatched against a potentially mutated fixture.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await getPayload({ config });
  const now = new Date();
  const candidates = await payload.find({
    collection: "qa_smoke_dispatches",
    where: {
      status: { in: ["queued", "dispatched", "cancel_requested"] },
    },
    limit: 100,
    overrideAccess: true,
  });
  let reconciled = 0;
  for (const dispatch of candidates.docs as Array<{
    id: string | number;
    fixtureKey?: string;
    status?: string;
    profile?: string;
    workflowRunId?: string;
  }>) {
    if (!dispatch.fixtureKey) continue;
    if (dispatch.status === "cancel_requested" && dispatch.workflowRunId) {
      const github = githubAppConfigFromEnv();
      // Fail closed: an unknown bound workflow can still mutate its fixture.
      if (!github) continue;
      const workflowState = await getTargetedSmokeWorkflowState(github, dispatch.workflowRunId).catch(() => null);
      if (workflowState === null) continue;
      if (workflowState !== "completed") {
        await cancelTargetedSmokeWorkflow(github, dispatch.workflowRunId).catch(() => undefined);
        continue;
      }
    }
    if (dispatch.status === "cancel_requested" || dispatch.status === "queued") {
      const changed = await withQaTargetedDispatchTransaction(payload, "staging", dispatch.fixtureKey, async (transactionReq) => {
        const options = { overrideAccess: true, req: transactionReq };
        const current = await payload.findByID({ collection: "qa_smoke_dispatches", id: dispatch.id, ...options }) as { status?: string };
        if (current.status !== dispatch.status) return false;
        const leases = await payload.find({ collection: "qa_fixture_leases", where: { and: [{ dispatch: { equals: dispatch.id } }, { status: { equals: "active" } }] }, limit: 10, ...options });
        const unexpired = leases.docs.some((lease) => typeof lease.expiresAt === "string" && Date.parse(lease.expiresAt) > now.getTime());
        if (unexpired) return false;
        await payload.update({ collection: "qa_smoke_dispatches", id: dispatch.id, data: dispatch.status === "queued" ? { status: "blocked", blockCode: "GITHUB_DISPATCH_UNCONFIRMED", recoveryHint: "Retry after confirming GitHub Actions availability." } : { status: "cancelled", cancelledAt: now.toISOString() }, ...options });
        await Promise.all(leases.docs.map((lease) => payload.update({ collection: "qa_fixture_leases", id: lease.id, data: { status: "released", releasedAt: now.toISOString() }, ...options })));
        return true;
      }, dispatch.profile === "manual-regression" ? "regression" : "smoke");
      if (!changed) continue;
    } else {
      // A bound workflow that completed without signed ingest cannot safely be
      // treated as still running. Reconcile it immediately; a live/unknown
      // workflow retains the lease until its bounded expiry.
      const github = dispatch.workflowRunId ? githubAppConfigFromEnv() : null;
      const workflowState = github && dispatch.workflowRunId
        ? await getTargetedSmokeWorkflowState(github, dispatch.workflowRunId).catch(() => null)
        : null;
      const activeLease = await payload.find({ collection: "qa_fixture_leases", where: { and: [{ dispatch: { equals: dispatch.id } }, { status: { equals: "active" } }] }, limit: 1, overrideAccess: true });
      const expiresAt = activeLease.docs[0]?.expiresAt;
      if (workflowState !== "completed" && expiresAt && Date.parse(expiresAt) > now.getTime()) continue;
      await blockTargetedSmokeDispatch(
        payload,
        { id: dispatch.id, fixtureKey: dispatch.fixtureKey },
        "GITHUB_DISPATCH_UNCONFIRMED",
        "GitHub workflow did not reach signed terminal ingestion before lease expiry; trigger a new staging deploy revision after investigating Actions.",
        now,
      );
    }
    reconciled += 1;
  }
  return NextResponse.json({ reconciled });
}
