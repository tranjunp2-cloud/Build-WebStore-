import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getQaControlCenterData } from "@/lib/admin/qa/control-center";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CURSOR_PATTERN = /^\d{1,6}$/;

/** Super-admin-only, evidence-safe read model for the QA Inbox and detail UI. */
export const GET = withSuperAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor")?.trim();
  if (cursor && !CURSOR_PATTERN.test(cursor))
    return NextResponse.json({ error: "Invalid cursor" }, { status: 422 });

  const payload = await getPayload({ config });
  const data = await getQaControlCenterData(payload, { cursor });
  return NextResponse.json({ data });
});
