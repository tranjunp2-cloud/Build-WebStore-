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

  test("[TC-F40-11-E2E-02] switching page tabs scopes the field diff grid", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the super-admin E2E account configured by the f40-migration-diff project.",
    );

    // Arrange
    await page.goto("/studio/qa/migration-diff");
    await page.getByRole("button", { name: "So Sánh" }).first().click();
    await expect(page.getByTestId("field-diff-page-scope")).toContainText("Trang Chủ");

    // Act / Assert — Home-only banner is visible on Home.
    await expect(page.getByTestId("field-diff-record-ent-ban-01")).toBeVisible();

    // Act / Assert — Catalog hides the Home-only banner and exposes category data.
    await page.getByTestId("migration-page-tab-page-catalog").click();
    await expect(page.getByTestId("field-diff-page-scope")).toContainText("Sản Phẩm & Danh Mục");
    await expect(page.getByTestId("field-diff-record-ent-ban-01")).toHaveCount(0);
    await expect(page.getByTestId("field-diff-record-ent-cat-12")).toBeVisible();

    // Act / Assert — Blog has its own field record set.
    await page.getByTestId("migration-page-tab-page-blog").click();
    await expect(page.getByTestId("field-diff-page-scope")).toContainText("Tin Tức & Cẩm Nang");
    await expect(page.getByTestId("field-diff-record-ent-cat-12")).toHaveCount(0);
    await expect(page.getByTestId("field-diff-record-ent-post-88")).toBeVisible();
  });
});
