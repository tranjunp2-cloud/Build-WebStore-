import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { cancelTargetedSmokeWorkflow, githubAppConfigFromEnv } from "@/lib/admin/qa/github-targeted-smoke";
import { withQaTargetedDispatchTransaction } from "@/lib/payload/qa-targeted-dispatch-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

async function readBoundedBody(req: NextRequest, maxBytes = 2_000): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("Payload too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

export const POST = withSuperAdmin(async (req: NextRequest, { params }) => {
  const id = Number(params?.id);
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 2_000)
    return NextResponse.json({ error: "Cancellation request too large" }, { status: 413 });
  let raw: unknown;
  try { raw = JSON.parse(await readBoundedBody(req)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "Payload too large" ? "Cancellation request too large" : "Invalid cancellation request" }, { status: error instanceof Error && error.message === "Payload too large" ? 413 : 422 }); }
  const body = BodySchema.safeParse(raw);
  if (!Number.isSafeInteger(id) || id < 1 || !body.success)
    return NextResponse.json({ error: "Invalid cancellation request" }, { status: 422 });
  const payload = await getPayload({ config });
  const initial = await payload.findByID({ collection: "qa_smoke_dispatches", id, depth: 0, overrideAccess: true }) as { fixtureKey?: string; profile?: string };
  if (!initial.fixtureKey)
    return NextResponse.json({ error: "Run is not cancellable" }, { status: 409 });
  const quotaProfile = initial.profile === "manual-regression" ? "regression" : "smoke";
  let workflowRunId: string | undefined;
  let status: string | undefined;
  await withQaTargetedDispatchTransaction(payload, "staging", initial.fixtureKey, async (transactionReq) => {
    const options = { overrideAccess: true, req: transactionReq };
    const dispatch = await payload.findByID({ collection: "qa_smoke_dispatches", id, ...options }) as { id: number; status?: string; workflowRunId?: string };
    status = dispatch.status;
    if (dispatch.status === "queued") {
      await payload.update({ collection: "qa_smoke_dispatches", id, data: { status: "cancelled", cancelReason: body.data.reason, cancelledAt: new Date().toISOString() }, ...options });
      const leases = await payload.find({ collection: "qa_fixture_leases", where: { and: [{ dispatch: { equals: id } }, { status: { equals: "active" } }] }, limit: 10, ...options });
      await Promise.all(leases.docs.map((lease) => payload.update({ collection: "qa_fixture_leases", id: lease.id, data: { status: "released", releasedAt: new Date().toISOString() }, ...options })));
      status = "cancelled";
      return;
    }
    if (dispatch.status !== "dispatched" && dispatch.status !== "cancel_requested") return;
    workflowRunId = dispatch.workflowRunId;
    if (dispatch.status === "dispatched")
      await payload.update({ collection: "qa_smoke_dispatches", id, data: { status: "cancel_requested", cancelReason: body.data.reason, cancelRequestedAt: new Date().toISOString() }, ...options });
    status = "cancel_requested";
  }, quotaProfile);
  if (status !== "cancelled" && status !== "cancel_requested")
    return NextResponse.json({ error: "Only a non-terminal run can be cancelled" }, { status: 409 });
  if (workflowRunId) {
    const github = githubAppConfigFromEnv();
    if (!github) return NextResponse.json({ data: { id, status }, warning: "Cancellation remains pending reconciliation" }, { status: 202 });
    try {
      await cancelTargetedSmokeWorkflow(github, workflowRunId);
      await payload.update({ collection: "qa_smoke_dispatches", id, data: { workflowCancelledAt: new Date().toISOString() }, overrideAccess: true });
    } catch {
      return NextResponse.json({ data: { id, status }, warning: "Cancellation remains pending reconciliation" }, { status: 202 });
    }
  }
  return NextResponse.json({ data: { id, status } }, { status: 202 });
});
