import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { readPw1DeltaTracking } from "@/lib/admin/qa/pw1-delta-tracking-reader";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  store_id: z.string().trim().min(1).max(128).regex(/^\d+$/),
});

/** Super Admin-only, read-only view of PW1 delta migration runs and changes for one PW1 store. */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse({ store_id: searchParams.get("store_id") ?? undefined });
  if (!query.success) return NextResponse.json({ error: "Invalid delta migration query" }, { status: 400 });

  try {
    return NextResponse.json({ data: await readPw1DeltaTracking(query.data.store_id) });
  } catch (error) {
    console.error("[migration-reconciliation/delta] Failed to read delta ledger", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json({ error: "Delta migration ledger is temporarily unavailable" }, { status: 503 });
  }
});
