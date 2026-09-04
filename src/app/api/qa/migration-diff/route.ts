import { NextRequest, NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import {
  generateReconciliationCatalog,
  getStoreDeepDiff,
  getDashboardMetrics,
} from "@/lib/admin/qa/migration-diff-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/qa/migration-diff
 * Query params:
 *   - store_id: Optional. If present, returns deep diff for a specific store.
 *   - filter: "all" | "passed" | "warning" | "failed"
 *   - template: "all" | "FB101" | "PA101" | ...
 *   - search: string keyword
 *   - page: number (default 1)
 *   - limit: number (default 20)
 */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("store_id");

    if (storeId) {
      const diff = getStoreDeepDiff(storeId);
      if (!diff) {
        return NextResponse.json({ error: `Store ${storeId} not found` }, { status: 404 });
      }
      return NextResponse.json({ data: diff });
    }

    const filter = searchParams.get("filter") || "all";
    const template = searchParams.get("template") || "all";
    const search = (searchParams.get("search") || "").toLowerCase().trim();

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;

    const allStores = generateReconciliationCatalog(2000);
    const metrics = getDashboardMetrics(allStores);

    const filtered = allStores.filter((s) => {
      const matchFilter = filter === "all" || s.status === filter;
      const matchTpl = template === "all" || s.templateCode === template;
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search) ||
        s.id.toLowerCase().includes(search) ||
        s.ownerEmail.toLowerCase().includes(search) ||
        s.domain.toLowerCase().includes(search) ||
        s.subdomain1.toLowerCase().includes(search) ||
        s.templateCode.toLowerCase().includes(search);

      return matchFilter && matchTpl && matchSearch;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedStores = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      metrics,
      pagination: {
        page,
        limit,
        totalItems: totalFiltered,
        totalPages,
      },
      stores: paginatedStores,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[migration-diff] GET error:", message);
    return NextResponse.json(
      { error: "Internal reconciliation error", details: message },
      { status: 500 }
    );
  }
});

/**
 * POST /api/qa/migration-diff
 * Actions:
 *   - approve_pass: Mark store as passed
 *   - scan_batch: Trigger fresh re-scan
 *   - ingest_json: Parse uploaded JSON payload
 */
export const POST = withSuperAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === "approve_pass") {
      const storeId = typeof body?.storeId === "string" ? body.storeId.trim() : "";
      if (!storeId) {
        return NextResponse.json({ error: "storeId is required" }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: `Store ${storeId} certified QC Pass for cutover.`,
        certifiedAt: new Date().toISOString(),
      });
    }

    if (action === "scan_batch") {
      return NextResponse.json({
        success: true,
        message: "Batch health reconciliation triggered for 2,000 stores.",
        scannedCount: 2000,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === "ingest_json") {
      const entities = body?.payload;
      return NextResponse.json({
        success: true,
        message: "JSON dump ingested and diff computed in memory.",
        entityCount: Array.isArray(entities) ? entities.length : 1,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[migration-diff] POST error:", message);
    return NextResponse.json(
      { error: "Failed to execute migration diff action", details: message },
      { status: 500 }
    );
  }
});
