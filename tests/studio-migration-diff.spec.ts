import { expect, test } from "@playwright/test";

test.describe("F40 US-F40-09 Dual-Mode Ingestion & Reconciliation API Tests", () => {
  test("[TC-F40-09-API-01] GET /api/qa/migration-diff returns 2,000 stores aggregate metrics", async ({
    request,
  }) => {
    const res = await request.get("/api/qa/migration-diff?filter=all&page=1&limit=15");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.metrics).toBeDefined();
    expect(json.metrics.totalStores).toBe(2000);
    expect(json.metrics.passedStores).toBeGreaterThan(0);
    expect(json.pagination.totalItems).toBe(2000);
    expect(json.stores.length).toBe(15);
  });

  test("[TC-F40-09-API-02] GET /api/qa/migration-diff supports deep store diff by ID", async ({
    request,
  }) => {
    const res = await request.get("/api/qa/migration-diff?store_id=SITE-0001");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.id).toBe("SITE-0001");
    expect(json.data.templateCode).toBe("FB101");
    expect(json.data.pages.length).toBeGreaterThanOrEqual(1);
    expect(json.data.reconciliationAudit).toBeDefined();
    expect(json.data.reconciliationAudit.totalProductsV1).toBe(24);
  });

  test("[TC-F40-09-API-03] POST /api/qa/migration-diff supports approve_pass action", async ({
    request,
  }) => {
    const res = await request.post("/api/qa/migration-diff", {
      data: {
        action: "approve_pass",
        storeId: "SITE-0001",
      },
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain("certified QC Pass");
  });

  test("[TC-F40-09-API-04] POST /api/qa/migration-diff supports offline JSON dump ingestion", async ({
    request,
  }) => {
    const res = await request.post("/api/qa/migration-diff", {
      data: {
        action: "ingest_json",
        payload: [{ id: "SITE-0001", name: "OrganicNest Farm" }],
      },
    });
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toContain("JSON dump ingested");
  });
});
