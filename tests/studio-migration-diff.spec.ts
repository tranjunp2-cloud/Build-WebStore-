import { expect, test } from "@playwright/test";

test.describe("F40 US-F40-09 Reconciliation API guards (no session)", () => {
  // The project injects the Super Admin session; these guards must run without it.
  test.use({ storageState: { cookies: [], origins: [] } });

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

  test("[TC-F40-14-API-01] F42 ledger run selector rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.get("/api/qa/migration-reconciliation/runs?store_id=SITE-0001");
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-14-API-02] F42 ledger issue reader rejects unauthenticated access with 401/403", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/qa/migration-reconciliation/issues?store_id=SITE-0001&run_id=3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db",
    );
    expect([401, 403]).toContain(res.status());
  });

  test("[TC-F40-14-07] record field evidence rejects unauthenticated access", async ({ request }) => {
    // Arrange
    const url = `/api/qa/migration-reconciliation?scope=commerce&view=record_fields&store_id=42&run_id=3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db&record_ref=${'a'.repeat(32)}`;

    // Act
    const response = await request.get(url);

    // Assert
    expect([401, 403]).toContain(response.status());
  });

  test("[TC-F40-11-E2E-01] unauthenticated navigation to /studio/migration redirects to login", async ({
    page,
  }) => {
    await page.goto("/studio/migration");
    await expect(page).toHaveURL(/\/admin/);
  });

});

test.describe("F40 US-F40-09 Dual-Mode Ingestion & Reconciliation Security & API Tests (Super Admin)", () => {

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
    await page.getByPlaceholder("Tìm theo Email khách hàng, Domain, Mã Site...").fill("SITE-0001");
    await page.getByTestId("migration-store-compare-SITE-0001").click();
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
    await page.getByPlaceholder("Tìm theo Email khách hàng, Domain, Mã Site...").fill("SITE-0001");
    await page.getByTestId("migration-store-compare-SITE-0001").click();

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

  test("[TC-F40-14-04] Super Admin selects an explicit verified F42 child run without retaining stale results", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL
        || !process.env.TEST_PASSWORD
        || !process.env.E2E_TEST_OTP_CODE
        || !process.env.E2E_F42_SOURCE_STORE_ID
        || !process.env.E2E_F42_RUN_ID,
      "Requires a Super Admin session plus an approved F42 staging child run and source store ID.",
    );

    // Arrange
    await page.goto("/studio/qa/migration-diff");
    await page.getByTestId("migration-store-compare-SITE-0001").click();
    await page.getByRole("button", { name: "Đối soát Commerce" }).click();

    // Act
    await page.getByLabel("ID store nguồn PW1").fill(process.env.E2E_F42_SOURCE_STORE_ID ?? "");
    const runSelector = page.getByLabel("Chọn migration run F42");
    await expect(runSelector.locator(`option[value="${process.env.E2E_F42_RUN_ID}"]`)).toHaveCount(1);
    await runSelector.selectOption(process.env.E2E_F42_RUN_ID);

    // Assert
    const ledgerResponse = await page.request.get(
      `/api/qa/migration-reconciliation?scope=commerce&store_id=${encodeURIComponent(process.env.E2E_F42_SOURCE_STORE_ID ?? "")}&run_id=${encodeURIComponent(process.env.E2E_F42_RUN_ID ?? "")}`,
    );
    expect(ledgerResponse.status()).toBe(200);
    const ledger = (await ledgerResponse.json()).data;
    expect(ledger.evidence.available).toBe(true);
    expect(ledger.fieldGeneration).toBeTruthy();
    const shell = page.getByTestId("migration-reconciliation-shell");
    await expect(shell).toBeVisible();
    await expect(shell).toContainText("Bản ghi trong ledger");
    const product = ledger.records.find((record: { sourceEntity: string; sourceId: string; reference?: string }) =>
      record.sourceEntity === "products" && /^\d+$/.test(record.sourceId));
    if (product?.reference) {
      await shell.getByLabel("Tìm dữ liệu đối soát").fill(product.sourceId);
      await expect(shell.locator("table tbody tr").filter({ hasText: `PW1: ${product.sourceId}` }).first()).toBeVisible();
      await shell.getByRole('button', { name: `Xem chi tiết Sản phẩm PW1 ${product.sourceId}` }).click();
      const recordFields = page.getByRole('region', { name: 'Bằng chứng từng trường của bản ghi' });
      await expect(recordFields).toBeVisible();
      await expect(recordFields).toContainText('Giá trị PW1 và PW2 theo từng trường');
      const fieldResponse = await page.request.get(
        `/api/qa/migration-reconciliation?scope=commerce&view=record_fields&store_id=${encodeURIComponent(process.env.E2E_F42_SOURCE_STORE_ID ?? '')}&run_id=${encodeURIComponent(process.env.E2E_F42_RUN_ID ?? '')}&record_ref=${encodeURIComponent(product.reference)}&generation_id=${encodeURIComponent(ledger.fieldGeneration.generationId)}&generation_digest=${encodeURIComponent(ledger.fieldGeneration.digest)}`,
      );
      expect(fieldResponse.status()).toBe(200);
      const fieldData = (await fieldResponse.json()).data;
      if (fieldData.state === 'complete' && fieldData.total > 0) {
        await expect(recordFields.getByRole('columnheader', { name: 'PW1 gốc' })).toBeVisible();
        await expect(recordFields.getByRole('columnheader', { name: 'PW2 sau migration' })).toBeVisible();
      } else {
        await expect(recordFields).toContainText(fieldData.reason);
      }
    }
    expect(ledger.records.filter((record: { sourceEntity: string }) => record.sourceEntity === "customers")
      .every((record: { sourceId: string }) => /^\d+$/.test(record.sourceId))).toBe(true);
    await expect(page.getByTestId("migration-ledger-issues")).toBeVisible();
    await expect(page.getByTestId("migration-reconciliation-shell")).not.toContainText("Không tải được dữ liệu:");

    // Act / Assert — a new source Store must clear the old selected run and its issues.
    await page.getByLabel("ID store nguồn PW1").fill("999999999");
    await expect(runSelector).toHaveValue("");
    await expect(page.getByTestId("migration-ledger-issues")).toHaveCount(0);
  });
});
