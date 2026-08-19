import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import {
  getManualRunPreflight,
  manualRunRequestDigest,
  parseManualRunContext,
  validateManualIdempotencyKey,
} from "@/lib/admin/qa/manual-runs";
import { resolveManualQaPack } from "@/lib/admin/qa/targeted-smoke-registry";
import { claimTargetedSmokeDispatch, blockTargetedSmokeDispatch, TargetedSmokeDispatchConflictError } from "@/lib/admin/qa/targeted-smoke-dispatch";
import { dispatchTargetedSmokeWorkflow, githubAppConfigFromEnv, GitHubWorkflowDispatchRejectedError } from "@/lib/admin/qa/github-targeted-smoke";
import { withQaTargetedDispatchTransaction } from "@/lib/payload/qa-targeted-dispatch-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z.object({
  targetId: z.string().regex(/^[a-z][a-z0-9-]*$/),
  profile: z.enum(["smoke", "regression"]),
  pullRequest: z.number().int().positive().optional(),
  commitSha: z.string().regex(/^[a-f0-9]{7,64}$/i).optional(),
  idempotencyKey: z.string().min(16).max(100),
}).strict();

async function readBoundedBody(req: NextRequest, maxBytes = 10_000): Promise<string> {
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
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const record = current as Record<string, unknown>;
    if (record.code === "23505") return true;
    current = record.cause;
  }
  return false;
}

export const POST = withSuperAdmin(async (req: NextRequest, { user }) => {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 10_000)
    return NextResponse.json({ error: "Manual-run request too large" }, { status: 413 });
  let raw: unknown;
  try {
    raw = JSON.parse(await readBoundedBody(req));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "Payload too large" ? "Manual-run request too large" : "Invalid manual-run request" },
      { status: error instanceof Error && error.message === "Payload too large" ? 413 : 422 },
    );
  }
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid manual-run request" }, { status: 422 });
  let context: ReturnType<typeof parseManualRunContext>;
  let idempotencyKey: string;
  try {
    context = parseManualRunContext(parsed.data);
    idempotencyKey = validateManualIdempotencyKey(parsed.data.idempotencyKey);
  } catch {
    return NextResponse.json({ error: "Invalid manual-run context" }, { status: 422 });
  }
  const payload = await getPayload({ config });
  const preflight = await getManualRunPreflight(payload, {
    targetId: parsed.data.targetId,
    profile: parsed.data.profile,
    context,
  });
  if (!preflight.canDispatch || !preflight.context || !preflight.pack)
    return NextResponse.json({ data: preflight }, { status: 409 });
  const resolved = resolveManualQaPack(parsed.data.targetId, parsed.data.profile);
  const github = githubAppConfigFromEnv();
  if (!resolved || (!github && process.env.NODE_ENV !== "development"))
    return NextResponse.json({ error: "Manual targeted runs are not configured" }, { status: 503 });
  const requestedBy = user.id;
  const digest = manualRunRequestDigest({
    targetId: parsed.data.targetId,
    profile: parsed.data.profile,
    context: preflight.context,
    idempotencyKey,
    requestedBy,
  });
  const existing = await payload.find({
    collection: "qa_smoke_dispatches",
    where: { and: [{ requestedBy: { equals: user.id } }, { idempotencyKey: { equals: idempotencyKey } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const prior = existing.docs[0] as { id: string | number; requestDigest?: string; status?: string } | undefined;
  if (prior) {
    if (prior.requestDigest !== digest)
      return NextResponse.json({ error: "Idempotency key conflicts with another request" }, { status: 409 });
    return NextResponse.json({ data: { id: prior.id, status: prior.status } }, { status: 202 });
  }
  let outcome;
  try {
    outcome = await claimTargetedSmokeDispatch(payload, {
      pullRequest: preflight.context.pullRequest,
      commitSha: preflight.context.commitSha,
      environment: "staging",
      profile: parsed.data.profile === "smoke" ? "manual-smoke" : "manual-regression",
      requestDigest: digest,
      idempotencyKey,
      requestedBy,
      retestNonce: idempotencyKey,
      pack: resolved.pack,
    });
  } catch (error) {
    if (error instanceof TargetedSmokeDispatchConflictError || isUniqueViolation(error))
      return NextResponse.json({ error: "Idempotency key conflicts with another request" }, { status: 409 });
    throw error;
  }
  if (outcome.blocked)
    return NextResponse.json({ data: { id: outcome.dispatch.id, status: "blocked" } }, { status: 409 });
  if (!outcome.created)
    return NextResponse.json({ data: { id: outcome.dispatch.id, status: outcome.dispatch.status } }, { status: 202 });
  try {
    const quotaProfile = parsed.data.profile === "regression" ? "regression" : "smoke";
    let transitionStatus: string | undefined;
    await withQaTargetedDispatchTransaction(payload, "staging", resolved.pack.fixtureKey ?? `runner-${resolved.pack.runner}`, async (transactionReq) => {
      const options = { overrideAccess: true, req: transactionReq };
      const current = await payload.findByID({ collection: "qa_smoke_dispatches", id: outcome.dispatch.id, depth: 0, ...options }) as { status?: string };
      transitionStatus = current.status;
      if (current.status !== "queued") return;
      await payload.update({ collection: "qa_smoke_dispatches", id: outcome.dispatch.id, data: { status: "dispatched" }, ...options });
      transitionStatus = "dispatched";
    }, quotaProfile);
    if (transitionStatus !== "dispatched")
      return NextResponse.json({ data: { id: outcome.dispatch.id, status: transitionStatus ?? "queued" } }, { status: 202 });
    // Local QA tests must prove the full browser confirmation and durable
    // ledger transition without ever dispatching an external Actions workflow.
    if (process.env.NODE_ENV === "development")
      return NextResponse.json({ data: { id: outcome.dispatch.id, status: "dispatched", packId: resolved.pack.packId, packVersion: resolved.pack.packVersion } }, { status: 202 });
    if (!github) throw new Error("GitHub App configuration disappeared during dispatch");
    await dispatchTargetedSmokeWorkflow(github, {
      dispatchId: String(outcome.dispatch.id),
      commitSha: preflight.context.commitSha,
      packId: resolved.pack.packId,
      workflowNonce: outcome.dispatch.workflowNonce ?? "",
      runProfile: parsed.data.profile === "smoke" ? "manual-smoke" : "manual-regression",
    });
  } catch (error) {
    // The protected transition already reserved a destructive fixture. Every
    // external-dispatch failure (timeout, DNS, crypto, or 4xx/5xx) must release
    // it conservatively; no error may strand capacity until cron expiry.
    await blockTargetedSmokeDispatch(payload, { id: outcome.dispatch.id, fixtureKey: resolved.pack.fixtureKey }, "GITHUB_DISPATCH_FAILED", error instanceof GitHubWorkflowDispatchRejectedError ? "Retry after GitHub Actions is available." : "GitHub dispatch failed before acceptance; retry after investigating the integration.");
    return NextResponse.json({ error: "Targeted run could not be dispatched" }, { status: 503 });
  }
  return NextResponse.json({ data: { id: outcome.dispatch.id, status: "dispatched", packId: resolved.pack.packId, packVersion: resolved.pack.packVersion } }, { status: 202 });
});
