import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { z } from "zod";
import { withStudioPermission, withSuperAdmin } from "@/lib/admin/api-utils";
import {
  getActiveSystemBatchRun,
  getSystemBatchRun,
  startSystemBatchRun,
} from "@/lib/admin/qa/system-batch-runner";
import type { TargetDomain } from "@/lib/admin/qa/target-registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const StartBatchSchema = z.object({
  scope: z.enum(["all", "domain"]).default("all"),
  domain: z.string().optional(),
  profile: z.enum(["all", "smoke", "regression", "user_flow", "impact", "security"]).default("all"),
  failFast: z.boolean().optional(),
});

export const GET = withSuperAdmin(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const batch = getSystemBatchRun(id);
    if (!batch) {
      return NextResponse.json({ error: "Batch run not found" }, { status: 404 });
    }
    return NextResponse.json({ data: batch });
  }

  const active = getActiveSystemBatchRun();
  return NextResponse.json({ data: active ?? null });
});

export const POST = withStudioPermission('qa.run', async (req: NextRequest) => {
  const rawBody = await req.json().catch(() => ({}));
  const parsed = StartBatchSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid batch request parameters", details: parsed.error.issues },
      { status: 422 },
    );
  }

  const payload = await getPayload({ config });
  const batch = await startSystemBatchRun(payload, {
    scope: parsed.data.scope,
    domain: parsed.data.domain as TargetDomain | undefined,
    profile: parsed.data.profile,
    failFast: parsed.data.failFast,
  });

  return NextResponse.json({ data: batch }, { status: 202 });
});
