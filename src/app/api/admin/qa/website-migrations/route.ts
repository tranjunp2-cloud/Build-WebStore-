import { NextResponse } from "next/server";
import { z } from "zod";
import { withStudioPermission, withSuperAdmin } from "@/lib/admin/api-utils";
import { saveWebsiteReview } from "@/lib/admin/qa/website-migration-review";
import { assertF42SourceReady } from "@/lib/admin/qa/f42-source-readiness";
import { F42_SOURCE_UNAVAILABLE, F42_CATALOG_SCOPE_UNAVAILABLE, F42CatalogScopeError, F42_WEBSITE_SCHEMA, F42_WEBSITE_CATALOG_SCHEMA, isF42SourceUnavailable } from "@/lib/admin/qa/f42-source-contract";
import {
  readWebsiteMigrations,
  readWebsiteMigrationDetail,
} from "@/lib/admin/qa/website-migration-data";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const querySchema = z
  .object({
    store: z.string().regex(/^\d+$/).max(20).optional(),
    batch: z.string().uuid().optional(),
    run: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,160}$/)
      .optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(200).default(""),
    status: z
      .enum(["all", "not_started", "running", "completed", "incomplete", "unpublished", "failed", "attention", "unaudited"])
      .default("all"),
    qc: z
      .enum(["all", "passed", "warning", "failed", "unverified"])
      .default("all"),
  })
  .strict();
export const GET = withSuperAdmin(async (request) => {
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success)
    return NextResponse.json(
      { error: "Invalid migration query" },
      { status: 400 },
    );
  try {
    await assertF42SourceReady(query.data.store ? F42_WEBSITE_SCHEMA : F42_WEBSITE_CATALOG_SCHEMA);
    if (query.data.store) {
      const data = await readWebsiteMigrationDetail(query.data.store);
      return NextResponse.json({ data }, { status: data ? 200 : 404 });
    }
    return NextResponse.json({ data: await readWebsiteMigrations(query.data) });
  } catch (error) {
    if (error instanceof F42CatalogScopeError) {
      console.error('[F40 catalog scope]', error.reason);
      return NextResponse.json(F42_CATALOG_SCOPE_UNAVAILABLE, { status: 503 });
    }
    if (isF42SourceUnavailable(error)) return NextResponse.json(F42_SOURCE_UNAVAILABLE, { status: 503 });
    console.error(
      "[F40 migration data]",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "Không đọc được evidence migration. Kiểm tra DB migration và log server.",
      },
      { status: 500 },
    );
  }
});

export const POST = withStudioPermission('migration.review', async (request, { user }) => {
  const legacyReview = z
    .object({
      store: z.string().regex(/^\d+$/).max(20),
      version: z.string().regex(/^[a-f0-9]{32}$/),
      verdict: z.enum(["passed", "warning", "failed"]),
      note: z.string().trim().min(1).max(2000),
      checks: z
        .object({
          content: z.boolean(),
          media: z.boolean(),
          mapping: z.boolean(),
          visual: z.boolean(),
          audit: z.boolean(),
        })
        .strict(),
    })
    .strict();
  const quickReview = z.object({
    mode: z.literal("quick"),
    store: z.string().regex(/^\d+$/).max(20),
    version: z.string().regex(/^[a-f0-9]{32}$/),
    verdict: z.enum(["passed", "failed"]),
  }).strict();
  const parsed = z.union([quickReview, legacyReview])
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid review request" },
      { status: 400 },
    );
  if (
    !("mode" in parsed.data) && parsed.data.verdict === "passed" &&
    !Object.values(parsed.data.checks).every(Boolean)
  )
    return NextResponse.json(
      {
        error:
          "QC Pass yêu cầu kiểm tra đầy đủ nội dung, ảnh, mapping, giao diện và audit.",
      },
      { status: 400 },
    );
  try {
    await assertF42SourceReady(F42_WEBSITE_SCHEMA);
    // Quick verdicts record the tester's decision only. Do not invent the
    // five detailed check confirmations or interpret Failed as severity P0.
    const input = "mode" in parsed.data ? {
      store: parsed.data.store,
      version: parsed.data.version,
      verdict: parsed.data.verdict,
      note: `Đánh giá thủ công: ${parsed.data.verdict === "passed" ? "Pass" : "Failed"}`,
      checks: { content: false, media: false, mapping: false, visual: false, audit: false },
    } : parsed.data;
    const saved = await saveWebsiteReview(input, Number(user.id));
    return NextResponse.json(
      saved
        ? { saved: true }
        : {
            error:
              "Evidence đã thay đổi hoặc chưa migrate thành công. Làm mới trước khi đánh giá.",
          },
      { status: saved ? 200 : 409 },
    );
  } catch (error) {
    if (isF42SourceUnavailable(error)) return NextResponse.json(F42_SOURCE_UNAVAILABLE, { status: 503 });
    return NextResponse.json(
      { error: "Không lưu được đánh giá QC" },
      { status: 500 },
    );
  }
});
