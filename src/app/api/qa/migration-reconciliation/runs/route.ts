import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { listVerifiedF42LedgerRuns } from "@/lib/admin/qa/f42-ledger-evidence-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  store_id: z.string().trim().min(1).max(128).regex(/^\d+$/),
});

/** Safe, Super Admin-only selector for verified F42 child migration runs. */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse({ store_id: searchParams.get("store_id") ?? undefined });
  if (!query.success) return NextResponse.json({ error: "Invalid migration run query" }, { status: 400 });

  try {
    const result = await listVerifiedF42LedgerRuns(query.data.store_id);
    return NextResponse.json({ data: result.runs, meta: { truncated: result.truncated } });
  } catch (error) {
    console.error("[migration-reconciliation/runs] Failed to read ledger runs", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "Migration ledger is temporarily unavailable" }, { status: 503 });
  }
});
