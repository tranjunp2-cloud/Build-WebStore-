import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import {
  getReconciliationSnapshot,
  RECONCILIATION_SCOPES,
  sanitizeReconciliationSnapshot,
} from "@/lib/admin/qa/migration-reconciliation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  scope: z.enum(RECONCILIATION_SCOPES).default("commerce"),
  store_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  demo: z.enum(["0", "1"]).default("0"),
});

/**
 * GET /api/qa/migration-reconciliation
 *
 * A Super Admin-only, read-only source for the Commerce/Settings reconciliation
 * shell. Before versioned PW1→PW2 evidence is registered it responds only with
 * the safe `unverified` state; it never guesses a match from business fields.
 */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse({
    scope: searchParams.get("scope") ?? undefined,
    store_id: searchParams.get("store_id") ?? undefined,
    demo: searchParams.get("demo") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "Invalid reconciliation query" }, { status: 400 });

  const snapshot = await getReconciliationSnapshot({
    scope: query.data.scope,
    storeId: query.data.store_id ?? null,
    demo: query.data.demo === "1",
  });

  return NextResponse.json({ data: sanitizeReconciliationSnapshot(snapshot) });
});
