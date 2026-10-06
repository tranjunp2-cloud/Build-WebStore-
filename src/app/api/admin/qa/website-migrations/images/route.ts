import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { auditWebsiteImages } from "@/lib/admin/qa/website-image-audit";
import { assertF42SourceReady } from "@/lib/admin/qa/f42-source-readiness";
import { F42_SOURCE_UNAVAILABLE, F42_IMAGE_CHECK_SCHEMA, F42_IMAGE_REVIEW_SCHEMA, isF42SourceUnavailable } from "@/lib/admin/qa/f42-source-contract";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = withSuperAdmin(async (request) => {
  const input = z
    .object({
      store: z.string().regex(/^\d+$/).max(20),
      version: z.string().regex(/^[a-f0-9]{32}$/),
      offset: z.number().int().min(0).max(100000).default(0),
      force: z.boolean().default(false),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "Invalid image check request" },
      { status: 400 },
    );
  try {
    await assertF42SourceReady(F42_IMAGE_CHECK_SCHEMA);
    return NextResponse.json({
      data: await auditWebsiteImages(
        input.data.store,
        input.data.version,
        input.data.offset,
        input.data.force,
      ),
    });
  } catch (error) {
    if (isF42SourceUnavailable(error)) return NextResponse.json(F42_SOURCE_UNAVAILABLE, { status: 503 });
    console.error(
      "[F40 image check]",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "EVIDENCE_CHANGED"
            ? "Evidence đã thay đổi; làm mới trước khi kiểm tra."
            : "Không chạy được kiểm tra ảnh. Kiểm tra DB migration và cấu hình storage.",
      },
      {
        status:
          error instanceof Error && error.message === "EVIDENCE_CHANGED"
            ? 409
            : 500,
      },
    );
  }
});

const reviewIdentity = z.object({
  store: z.string().regex(/^\d+$/).max(20),
  version: z.string().regex(/^[a-f0-9]{32}$/),
});
export const GET = withSuperAdmin(async (request) => {
  const parsed = reviewIdentity
    .strict()
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid image review query" },
      { status: 400 },
    );
  return imageReviewsResponse(parsed.data);
});
export const PUT = withSuperAdmin(async (request, { user }) => {
  const parsed = reviewIdentity
    .extend({
      page: z.string().min(1).max(160),
      block: z.string().min(1).max(160),
      field: z.string().min(1).max(200),
      path: z.string().min(1).max(500),
      confirmed: z.boolean(),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid manual image confirmation" },
      { status: 400 },
    );
  return imageReviewsResponse(parsed.data, Number(user.id));
});
async function imageReviewsResponse(
  input: {
    store: string;
    version: string;
    page?: string;
    block?: string;
    field?: string;
    path?: string;
    confirmed?: boolean;
  },
  reviewerId?: number,
) {
  try {
    await assertF42SourceReady(F42_IMAGE_REVIEW_SCHEMA);
    const { websiteImageReviews } =
      await import("@/lib/admin/qa/website-image-review");
    const identity =
      input.page &&
      input.block &&
      input.field &&
      input.path &&
      input.confirmed !== undefined
        ? {
            page: input.page,
            block: input.block,
            field: input.field,
            path: input.path,
            confirmed: input.confirmed,
          }
        : undefined;
    return NextResponse.json({
      data: await websiteImageReviews(
        input.store,
        input.version,
        identity,
        reviewerId,
      ),
    });
  } catch (error) {
    if (isF42SourceUnavailable(error)) return NextResponse.json(F42_SOURCE_UNAVAILABLE, { status: 503 });
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          message === "EVIDENCE_CHANGED"
            ? "Evidence đã thay đổi; mở lại đối chiếu."
            : "Không lưu/đọc được xác nhận ảnh.",
      },
      {
        status:
          message === "EVIDENCE_CHANGED"
            ? 409
            : message === "INVALID_IMAGE_FIELD"
              ? 400
              : 500,
      },
    );
  }
}
