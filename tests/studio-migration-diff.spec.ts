import { expect, test } from "@playwright/test";

test.describe("F40 US-F40-09 Dual-Mode Ingestion & Reconciliation Security & API Tests", () => {
  test("[TC-F40-09-API-01] GET /api/qa/migration-diff rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.get("/api/qa/migration-diff?filter=all&page=1&limit=15");
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-09-API-02] GET /api/qa/migration-diff deep diff rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.get("/api/qa/migration-diff?store_id=SITE-0001");
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-09-API-03] POST /api/qa/migration-diff rejects unauthenticated actions with 401/403", async ({
    request,
  }) => {
    const res = await request.post("/api/qa/migration-diff", {
      data: {
        action: "approve_pass",
        storeId: "SITE-0001",
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-09-API-04] POST /api/qa/migration-diff rejects unauthenticated JSON dump with 401/403", async ({
    request,
  }) => {
    const res = await request.post("/api/qa/migration-diff", {
      data: {
        action: "ingest_json",
        payload: [{ id: "SITE-0001", name: "OrganicNest Farm" }],
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-12-API-01] GET /api/qa/template-preview/fb101 rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.get("/api/qa/template-preview/fb101");
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-11-E2E-01] unauthenticated navigation to /studio/migration redirects to login", async ({
    page,
  }) => {
    await page.goto("/studio/migration");
    await expect(page).toHaveURL(/\/admin/);
  });
});
