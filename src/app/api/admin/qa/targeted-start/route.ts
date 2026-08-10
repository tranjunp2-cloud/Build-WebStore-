import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { verifyQaIngestSignature } from "@/lib/admin/qa/contracts";
import { withQaTargetedDispatchTransaction } from "@/lib/payload/qa-targeted-dispatch-transaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const StartSchema = z.object({
  dispatchId: z.number().int().positive(),
  workflowNonce: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
  workflowRunId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/).max(100),
  attempt: z.number().int().min(1).max(100),
}).strict();
const CLAIMED_LEASE_DURATION_MS = 30 * 60_000;

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
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/** Claims a dispatch once before any target test is allowed to touch its fixture. */
export async function POST(req: NextRequest) {
  const secret = process.env.QA_INGEST_SECRET;
  if (!secret) return NextResponse.json({ error: "QA ingestion is not configured" }, { status: 503 });
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 10_000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let rawBody: string;
  try {
    rawBody = await readBoundedBody(req);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!verifyQaIngestSignature(rawBody, req.headers.get("x-qa-signature"), req.headers.get("x-qa-timestamp"), secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }
  const parsed = StartSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation error" }, { status: 422 });

  const payload = await getPayload({ config });
  const initial = await payload.findByID({
    collection: "qa_smoke_dispatches",
    id: parsed.data.dispatchId,
    overrideAccess: true,
  }) as { id: string | number; fixtureKey?: string };
  if (!initial.fixtureKey) return NextResponse.json({ error: "Unknown dispatch" }, { status: 409 });
  try {
    await withQaTargetedDispatchTransaction(payload, "staging", initial.fixtureKey, async (transactionReq) => {
      const options = { overrideAccess: true, req: transactionReq };
      const dispatch = await payload.findByID({
        collection: "qa_smoke_dispatches",
        id: parsed.data.dispatchId,
        ...options,
      }) as {
        id: string | number;
        status?: string;
        workflowNonce?: string;
        workflowRunId?: string;
        workflowAttempt?: number;
      };
      if (dispatch.status !== "dispatched" || dispatch.workflowNonce !== parsed.data.workflowNonce)
        throw new Error("Dispatch is not claimable");
      if (
        dispatch.workflowRunId &&
        (dispatch.workflowRunId !== parsed.data.workflowRunId || dispatch.workflowAttempt !== parsed.data.attempt)
      )
        throw new Error("Dispatch is already claimed by another workflow");
      if (!dispatch.workflowRunId)
        await payload.update({
          collection: "qa_smoke_dispatches",
          id: dispatch.id,
          data: { workflowRunId: parsed.data.workflowRunId, workflowAttempt: parsed.data.attempt },
          ...options,
        });
      const activeLeases = await payload.find({
        collection: "qa_fixture_leases",
        where: {
          and: [
            { dispatch: { equals: dispatch.id } },
            { status: { equals: "active" } },
          ],
        },
        limit: 10,
        ...options,
      });
      if (activeLeases.docs.length !== 1)
        throw new Error("Dispatch has no exclusive active fixture lease");
      const claimedAt = new Date();
      await payload.update({
        collection: "qa_fixture_leases",
        id: activeLeases.docs[0].id,
        data: { expiresAt: new Date(claimedAt.getTime() + CLAIMED_LEASE_DURATION_MS).toISOString() },
        ...options,
      });
    });
  } catch {
    return NextResponse.json({ error: "Dispatch is not claimable" }, { status: 409 });
  }
  return NextResponse.json({ claimed: true });
}
