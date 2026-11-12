import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getStoreDeepDiff } from "@/lib/admin/qa/migration-diff-engine";
import {
  createDemoRenderEvidence,
  createUnavailableRenderEvidence,
  getMigrationRenderEvidence,
  sanitizeRenderEvidence,
} from "@/lib/admin/qa/migration-render-evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const querySchema = z.object({
  store_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  page_id: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  demo: z.enum(["0", "1"]).default("0"),
});

/** Read-only, Super Admin evidence source. Real mappings are plugged in server-side. */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    store_id: searchParams.get("store_id"),
    page_id: searchParams.get("page_id"),
    demo: searchParams.get("demo") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid render evidence query" }, { status: 400 });

  const diff = getStoreDeepDiff(parsed.data.store_id);
  if (!diff) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  const page = diff.pages.find((candidate) => candidate.id === parsed.data.page_id);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  const legacyIds = page.blocks.map((block) => block.id);
  const snapshot = parsed.data.demo === "1"
    ? createDemoRenderEvidence({ storeId: parsed.data.store_id, pageId: parsed.data.page_id, legacyIds })
    : await getMigrationRenderEvidence({ storeId: parsed.data.store_id, pageId: parsed.data.page_id, legacyIds });

  try {
    return NextResponse.json({ data: sanitizeRenderEvidence(snapshot) });
  } catch {
    return NextResponse.json({
      data: sanitizeRenderEvidence(
        createUnavailableRenderEvidence({
          storeId: parsed.data.store_id,
          pageId: parsed.data.page_id,
          legacyIds,
        }),
      ),
    });
  }
});
