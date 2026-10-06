import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { listOpenF42LedgerIssues } from "@/lib/admin/qa/f42-ledger-evidence-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  store_id: z.string().trim().min(1).max(128).regex(/^\d+$/),
  run_id: z.string().uuid(),
});

/** Safe, Super Admin-only read model for open issues on one selected F42 run. */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse({
    store_id: searchParams.get("store_id") ?? undefined,
    run_id: searchParams.get("run_id") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "Invalid migration issue query" }, { status: 400 });

  try {
    const data = await listOpenF42LedgerIssues({
      storeId: query.data.store_id,
      runId: query.data.run_id,
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[migration-reconciliation/issues] Failed to read ledger issues", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "Migration ledger is temporarily unavailable" }, { status: 503 });
  }
});
