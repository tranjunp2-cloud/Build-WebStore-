import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { saveWebsiteReview } from "@/lib/admin/qa/website-migration-review";
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
      .enum(["all", "unpublished", "failed", "attention", "unaudited"])
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
    if (query.data.store) {
      const data = await readWebsiteMigrationDetail(query.data.store);
      return NextResponse.json({ data }, { status: data ? 200 : 404 });
    }
    return NextResponse.json({ data: await readWebsiteMigrations(query.data) });
  } catch (error) {
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

export const POST = withSuperAdmin(async (request, { user }) => {
  const parsed = z
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
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid review; a note is required" },
      { status: 400 },
    );
  if (
    parsed.data.verdict === "passed" &&
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
    const saved = await saveWebsiteReview(parsed.data, Number(user.id));
    return NextResponse.json(
      saved
        ? { saved: true }
        : {
            error:
              "Evidence đã thay đổi hoặc chưa migrate thành công. Làm mới trước khi đánh giá.",
          },
      { status: saved ? 200 : 409 },
    );
  } catch {
    return NextResponse.json(
      { error: "Không lưu được đánh giá QC" },
      { status: 500 },
    );
  }
});
