import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import {
  getReconciliationSnapshot,
  RECONCILIATION_SCOPES,
  registerMigrationEvidenceProvider,
  sanitizeReconciliationSnapshot,
} from "@/lib/admin/qa/migration-reconciliation";
import { f42LedgerEvidenceProvider } from "@/lib/admin/qa/f42-ledger-evidence-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  scope: z.enum(RECONCILIATION_SCOPES).default("commerce"),
  store_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).optional(),
  run_id: z.string().uuid().optional(),
  demo: z.enum(["0", "1"]).default("0"),
}).superRefine((value, context) => {
  if (value.demo === "0" && value.store_id && !/^\d+$/.test(value.store_id)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["store_id"], message: "F42 source store ID must be numeric" });
  }
});

// This is the only production registration point. The adapter itself performs
// read-only ledger access and fails closed when the F42 schema is unavailable.
registerMigrationEvidenceProvider(f42LedgerEvidenceProvider);

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
    run_id: searchParams.get("run_id") ?? undefined,
    demo: searchParams.get("demo") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "Invalid reconciliation query" }, { status: 400 });
  if (query.data.run_id && !query.data.store_id) {
    return NextResponse.json({ error: "A store is required when selecting a migration run" }, { status: 400 });
  }

  try {
    const snapshot = await getReconciliationSnapshot({
      scope: query.data.scope,
      storeId: query.data.store_id ?? null,
      runId: query.data.run_id ?? null,
      demo: query.data.demo === "1",
    });

    return NextResponse.json({
      data: sanitizeReconciliationSnapshot(snapshot, { allowDemoFixture: query.data.demo === "1" }),
    });
  } catch (error) {
    console.error("[migration-reconciliation] Failed to read ledger evidence", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "Migration ledger is temporarily unavailable" }, { status: 503 });
  }
});
