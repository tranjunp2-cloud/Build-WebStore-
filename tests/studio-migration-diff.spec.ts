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

  test("[TC-F40-13-API-01] GET /api/qa/migration-render-evidence rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/qa/migration-render-evidence?store_id=SITE-0001&page_id=page-home&demo=0",
    );
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-13-API-02] POST live-check rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.post("/api/qa/migration-render-evidence/live-check", {
      data: { store_id: "SITE-0001", page_id: "page-home", legacy_id: "block-1" },
    });
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
    await page.goto("/studio/qa/migration-diff?demo=1");
    await page.getByPlaceholder("Tìm theo Email khách hàng, Domain, Mã Site...").fill("SITE-0001");
    await page.getByTestId("migration-store-compare-SITE-0001").click();
    await page.getByRole("button", { name: "Soi CSDL 1-to-1" }).click();
    await page.getByTestId("field-diff-ui-demo-toggle").click();
    await expect(page.getByTestId("field-diff-ui-demo-notice")).toBeVisible();
    await page.getByTestId("field-status-filter-all").click();
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

  test("[TC-F40-11-E2E-03] field inspector prioritizes attention and expands a record on demand", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the super-admin E2E account configured by the f40-migration-diff project.",
    );

    await page.goto("/studio/qa/migration-diff?demo=1");
    await page.getByPlaceholder("Tìm theo Email khách hàng, Domain, Mã Site...").fill("SITE-0001");
    await page.getByTestId("migration-store-compare-SITE-0001").click();
    await page.getByRole("button", { name: "Soi CSDL 1-to-1" }).click();
    await page.getByTestId("field-diff-ui-demo-toggle").click();

    await expect(page.getByTestId("field-status-filter-attention")).toHaveClass(/bg-sky-950/);
    await expect(page.getByTestId("field-diff-record-ent-demo-ui-product")).toBeVisible();
    const demoRecordToggle = page.getByTestId("field-diff-toggle-ent-demo-ui-product");
    await expect(demoRecordToggle).toHaveAttribute("aria-expanded", "true");
    const demoRecordDetails = page.locator("#field-diff-details-ent-demo-ui-product");
    await expect(demoRecordDetails).toBeVisible();
    await demoRecordToggle.click();
    await expect(demoRecordToggle).toHaveAttribute("aria-expanded", "false");
    await expect(demoRecordDetails).toBeHidden();
    await demoRecordToggle.click();
    await expect(demoRecordToggle).toHaveAttribute("aria-expanded", "true");
    await expect(demoRecordDetails).toBeVisible();

    await page.getByTestId("field-status-filter-matched_value").click();
    await expect(page.locator('[data-evidence-state="attention"]')).toHaveCount(0);
    await page.getByTestId("field-status-filter-matched_empty").click();
    await expect(page.locator('[data-evidence-state="matched_empty"]')).toHaveCount(1);
  });

  test("[TC-F40-13-E2E-02] mock evidence never treats inferred PW2 UI as verified", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the super-admin E2E account configured by the f40-migration-diff project.",
    );

    await page.goto("/studio/qa/migration-diff?demo=1");
    await page.getByRole("button", { name: "So Sánh Khối" }).click();
    await page.getByLabel("Xem dữ liệu mẫu để duyệt UI").check();

    await expect(page.getByText("Dữ liệu mẫu để duyệt UI; không phải bằng chứng migration thực tế.")).toBeVisible();
    await expect(page.getByText("Dữ liệu PW2").first()).toBeVisible();
    await expect(page.getByTestId("pw2-evidence-placeholder").first()).toBeVisible();
  });

  test("[TC-F40-14-02] Super Admin can open the Commerce reconciliation workspace and filter by feature", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the super-admin E2E account configured by the f40-migration-diff project.",
    );

    // Arrange
    await page.goto("/studio/qa/migration-diff?demo=1");

    // Act
    await page.getByRole("button", { name: "Đối soát Commerce" }).click();
    await page.getByRole("checkbox", { name: "Xem dữ liệu mẫu" }).check();
    await page.getByRole("button", { name: "Products" }).click();

    // Assert
    await expect(page.getByTestId("migration-reconciliation-shell")).toBeVisible();
    await expect(page.getByText("Áo thun mẫu")).toBeVisible();
    await expect(page.getByText("Đơn hàng #1024")).toHaveCount(0);

    // Switching scopes must not retain the Commerce-only Products filter.
    await page.getByRole("button", { name: "Đối soát Settings" }).click();
    await expect(page.getByText("Account profile")).toBeVisible();
  });
});
