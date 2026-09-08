import { NextRequest, NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { cancelSystemBatchRun } from "@/lib/admin/qa/system-batch-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withSuperAdmin(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Batch ID is required" }, { status: 400 });
  }

  const cancelled = cancelSystemBatchRun(id);
  return NextResponse.json({ data: { id, cancelled, status: "cancelled" } }, { status: 200 });
});
