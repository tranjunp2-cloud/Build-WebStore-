import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSuperAdmin } from "@/lib/admin/api-utils";
import { getStoreDeepDiff } from "@/lib/admin/qa/migration-diff-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  store_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  page_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  legacy_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

/**
 * Explicit live-check seam. A production runner is intentionally not faked:
 * this endpoint only reports that no runner is registered until the platform
 * team supplies the authorized PW2 page/block probe.
 */
export const POST = withSuperAdmin(async (request: NextRequest, { user }) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid live-check request" }, { status: 400 });
  }
  const diff = getStoreDeepDiff(parsed.data.store_id);
  const page = diff?.pages.find((candidate) => candidate.id === parsed.data.page_id);
  const block = page?.blocks.find((candidate) => candidate.id === parsed.data.legacy_id);
  if (!block) return NextResponse.json({ error: "Migration block not found" }, { status: 404 });
  if (!checkRateLimit(`migration-live-check:${user.id}:${parsed.data.store_id}:${parsed.data.legacy_id}`, 5)) {
    return NextResponse.json({ error: "Too many live-check requests" }, { status: 429 });
  }

  return NextResponse.json({
    data: {
      legacyId: parsed.data.legacy_id,
      status: "unverified" as const,
      checkedAt: null,
      evidenceRef: null,
      reasonCode: "LIVE_CHECK_RUNNER_UNAVAILABLE",
      message:
        "Chưa có live-check runner PW2 được phê duyệt. Không suy đoán kết quả render.",
    },
  });
});
