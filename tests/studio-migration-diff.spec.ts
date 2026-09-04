import { expect, test } from "@playwright/test";

test.describe("F40 US-F40-11 Field-by-Field Database Diff Inspector Tests", () => {
  test("[TC-F40-11-API-01] GET /api/qa/migration-diff returns 2,000 stores aggregate metrics", async ({
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

  test("[TC-F40-11-API-02] GET /api/qa/migration-diff supports deep store diff by ID", async ({
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

  test("[TC-F40-11-API-03] POST /api/qa/migration-diff supports approve_pass action", async ({
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

  test("[TC-F40-11-API-04] POST /api/qa/migration-diff supports offline JSON dump ingestion", async ({
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

  test("[TC-F40-11-E2E-01] loads /studio/qa/migration-diff, displays 2,000 websites and filters by search", async ({
    page,
  }) => {
    await page.goto("/studio/qa/migration-diff");
    await expect(page.locator("h1")).toContainText("Website Migration");

    // Check metric cards exist
    await expect(page.getByText("Tổng Số Website")).toBeVisible();
    await expect(page.getByText("2,000", { exact: true })).toBeVisible();

    // Test search filter by domain
    const searchInput = page.getByPlaceholder("Tìm theo Email khách hàng, Domain, Mã Site...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("organicnest.vn");

    // Table should filter to organicnest.vn
    await expect(page.getByText("organicnest.vn").first()).toBeVisible();
  });

  test("[TC-F40-11-E2E-02] opens detail modal and switches to Field Diff tab", async ({
    page,
  }) => {
    await page.goto("/studio/qa/migration-diff");

    // Click "So Sánh" on the first store
    const compareBtn = page.getByRole("button", { name: "So Sánh" }).first();
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // Modal should be visible
    await expect(page.getByText("So Sánh 2 Website")).toBeVisible();
    await expect(page.getByText("Soi Từng Trường (Field Diff)")).toBeVisible();

    // Switch to Field Diff Tab
    await page.getByText("Soi Từng Trường (Field Diff)").click();
    await expect(page.getByText("ĐỐI SOÁT TRƯỜNG DỮ LIỆU CSDL 1-TO-1")).toBeVisible();
  });
});
