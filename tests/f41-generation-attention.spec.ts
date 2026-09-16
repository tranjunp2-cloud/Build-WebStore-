import { expect, test } from "@playwright/test";

type GenerationListResponse = {
  items: Array<Record<string, unknown>>;
  nextCursor: null;
  meta: {
    totalDocs: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

const attentionRow = {
  id: "e2e-attention-run",
  submittedAt: "2026-09-15T08:00:00.000Z",
  user: { id: "e2e-user", label: "Tracker test user", missing: false },
  site: { id: "e2e-site", label: "E2E recovery site", missing: false },
  lifecycle: "terminal",
  outcome: "failed",
  recoveryStatus: "ticket_required",
  priority: "cannot_recover",
  recoveryPolicy: {
    action: "create_ticket",
    retryable: false,
    reasonCode: "TICKET_REQUIRED",
  },
  pageSummary: { expected: 5, persisted: 4, failed: 1 },
  incidentSummary: {
    kind: "persistence",
    label: "Không thể lưu website",
    scope: "Sau khi AI tạo nội dung",
    totalErrors: 1,
  },
  affectedError: {
    code: "PAGE_PERSIST_FAILED",
    phase: "page_persist",
    locationType: "page",
    locationKey: "/contact",
    summary: "Không thể lưu trang Contact.",
  },
};

const successRow = {
  id: "e2e-success-run",
  submittedAt: "2026-09-15T07:00:00.000Z",
  user: { id: "e2e-user", label: "Tracker test user", missing: false },
  site: { id: "e2e-site", label: "E2E recovery site", missing: false },
  lifecycle: "terminal",
  outcome: "succeeded",
  recoveryStatus: "none",
  priority: "history",
  recoveryPolicy: {
    action: "view_detail",
    retryable: false,
    reasonCode: "NO_RECOVERY_ACTION",
  },
  pageSummary: { expected: 5, persisted: 5, failed: 0 },
  incidentSummary: null,
  affectedError: null,
};

const retryableRow = {
  id: "e2e-retryable-run",
  submittedAt: "2026-09-15T08:00:00.000Z",
  user: { id: "e2e-user", label: "Tracker test user", missing: false },
  site: { id: "e2e-site", label: "E2E recovery site", missing: false },
  lifecycle: "terminal",
  outcome: "partial_failed",
  recoveryStatus: "eligible",
  priority: "retryable",
  recoveryPolicy: {
    action: "retry_website",
    retryable: true,
    reasonCode: "RETRYABLE",
  },
  pageSummary: { expected: 5, persisted: 4, failed: 1 },
  incidentSummary: {
    kind: "component",
    label: "Lỗi tạo component",
    scope: "Sản phẩm / Gallery",
    totalErrors: 1,
  },
  affectedError: {
    code: "IMAGE_GENERATION_TIMEOUT",
    phase: "component_generate",
    locationType: "component",
    locationKey: "products.gallery",
    summary: "Không lấy được media trong thời gian cho phép.",
  },
};

function response(items: Array<Record<string, unknown>>): GenerationListResponse {
  return {
    items,
    nextCursor: null,
    meta: {
      totalDocs: items.length,
      limit: 50,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

function detailResponse(row: typeof attentionRow | typeof retryableRow) {
  const isRetryable = row.recoveryPolicy.action === "retry_website";
  return {
    data: {
      ...row,
      endpoint: "site-generator",
      category: "retail",
      website: { id: row.site.id, name: row.site.label, domain: "e2e.example.test", status: "draft", urls: { preview: null, live: "e2e.example.test" } },
      user: { id: row.user.id, name: row.user.label, email: "tracker@example.test" },
      input: { available: true, summary: [["Tên doanh nghiệp", "E2E recovery site"], ["Ngành hàng", "Retail"], ["Mô tả", "Test store"], ["Sản phẩm / dịch vụ", "Flowers"], ["Ngôn ngữ", "vi"]], full: { businessName: "E2E recovery site", extraInstructions: "Keep this content concise" } },
      inputSchemaVersion: "f41.v1",
      inputHash: "fixture-hash",
      traceId: "f41-ui-fixture-e2e-detail",
      pages: [{ pageKey: "contact", title: "Liên hệ", slug: "contact", pageId: "page-1", status: "failed", blockCount: 2, errorCode: "PAGE_FAILED", errorSummary: "Không thể lưu trang" }],
      errors: [{ phase: "page_persist", locationType: "page", locationKey: "contact", code: "PAGE_FAILED", category: "persistence", retryabilityReason: null, message: "Không thể lưu trang", technicalMessage: "safe evidence" }],
      incident: {
        kind: row.incidentSummary?.kind ?? "unknown",
        label: row.incidentSummary?.label ?? "Lỗi tạo website",
        location: { type: "page", key: null, label: "Trang bị ảnh hưởng", known: true },
        cause: { label: "Không thể tạo trang", code: "PAGE_GENERATION_FAILED", validationRule: null, observedState: null },
        impact: { expected: 5, persisted: 4, failed: 1, summary: "1/5 trang chưa tạo, 4 trang đã lưu." },
        recovery: { retryable: isRetryable, scope: isRetryable ? "website" : "none", reasonCode: row.recoveryPolicy.reasonCode },
        owner: { kind: isRetryable ? "operator" : "dev", label: isRetryable ? "Người trực tracking" : "Team Dev" },
        nextAction: isRetryable ? { kind: "retry_website", label: "Gen lại toàn bộ website." } : { kind: "open_issues", label: "Tạo ticket để team Dev điều tra." },
        developerEvidence: { phase: "page_persist", technicalMessage: "safe evidence" },
        legacy: false,
        relatedErrorCount: 1,
      },
      timeline: [{ event: "submitted", at: row.submittedAt }, { event: "terminal", at: row.submittedAt }],
      durationMs: 1200,
      lineage: { source: "user_submit", parentGenerationId: null, retryRootGenerationId: null, retryAttempt: 0 },
      retryHistory: [],
    },
  };
}

test.describe("US-F41-02 Needs Attention", () => {
  test("[TC-F41-17] Super Admin sees an actionable failure before success history", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the dedicated Super Admin E2E account configured by auth.setup.ts.",
    );

    // Arrange: only browser-facing list data is mocked. Navigation and the
    // Super Admin boundary remain real; no AI/provider service is required.
    await page.route("**/api/admin/generations**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      if (new URL(route.request().url()).pathname !== "/api/admin/generations") {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(detailResponse(attentionRow)) });
        return;
      }
      const view = new URL(route.request().url()).searchParams.get("view");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(response(view === "all" ? [attentionRow, successRow] : [attentionRow])),
      });
    });

    // Act: open the real Studio screen with the persisted Super Admin session.
    await page.goto("/studio/generations");

    // Assert: Needs Attention is the default and exposes safe operational
    // context/action before any historical success is requested.
    // Export's explanatory aria-label also contains this phrase; target the
    // tab's complete accessible name rather than a partial role match.
    const attentionTab = page.getByRole("button", { name: /^Needs Attention(?: · \d+)?$/ });
    await expect(attentionTab).toHaveAttribute("aria-pressed", "true");
    const actionableRow = page.getByRole("button", {
      name: "Xem generation e2e-attention-run",
    });
    await expect(actionableRow).toContainText("Tracker test user");
    await expect(actionableRow).toContainText("E2E recovery site");
    await expect(actionableRow).toContainText("4/5");
    await expect(actionableRow).toContainText("Không thể lưu website");
    await expect(actionableRow).toContainText("Sau khi AI tạo nội dung");
    await expect(actionableRow).toContainText("Cần Dev xử lý");
    await expect(page.getByRole("button", { name: "Xem generation e2e-success-run" })).toHaveCount(0);

    // A row remains actionable through the shareable safe detail page.
    await actionableRow.click();
    await expect(page).toHaveURL(/\/studio\/generations\/e2e-attention-run$/);
    await expect(page.getByRole("heading", { name: "E2E recovery site" })).toBeVisible();
    await page.goBack();

    // Act: request history explicitly.
    await page.getByRole("button", { name: "All Generations", exact: true }).click();

    // Assert: server order is retained in the browser: exception precedes success.
    await expect(page.getByRole("button", { name: "Xem generation e2e-success-run" })).toBeVisible();
    const orderedIds = await page.locator(".gen-row").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("aria-label")),
    );
    expect(orderedIds).toEqual([
      "Xem generation e2e-attention-run",
      "Xem generation e2e-success-run",
    ]);
  });

  test("[TC-F41-13] Super Admin sees a queued retry only after the retry API returns 202", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the dedicated Super Admin E2E account configured by auth.setup.ts.",
    );

    // Arrange — GET remains a real browser request with a safe fixture; POST
    // is mocked at its API boundary so no AI provider or recovery worker runs.
    await page.route("**/api/admin/generations**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(response([retryableRow])) });
    });
    await page.route("**/api/admin/generations/e2e-retryable-run/retry", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ jobId: "mock-job", childGenerationId: "mock-child", recoveryStatus: "retrying" }),
      });
    });

    // Act
    await page.goto("/studio/generations");
    await page.getByRole("button", { name: "Gen lại website e2e-retryable-run" }).click();
    await page.getByRole("button", { name: "Tạo lần gen lại" }).click();

    // Assert — only a positive accepted response changes the row into monitor state.
    await expect(page.getByRole("button", { name: "Đang gen lại website e2e-retryable-run" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Gen lại website e2e-retryable-run", exact: true })).toHaveCount(0);
  });

  test("[TC-F41-13] Super Admin keeps retry actionable when API returns a non-idempotent 409", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the dedicated Super Admin E2E account configured by auth.setup.ts.",
    );

    // Arrange
    await page.route("**/api/admin/generations**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(response([retryableRow])) });
    });
    await page.route("**/api/admin/generations/e2e-retryable-run/retry", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "RETRY_LIMIT_REACHED", message: "Retry đã hết lượt." } }),
      });
    });

    // Act
    await page.goto("/studio/generations");
    await page.getByRole("button", { name: "Gen lại website e2e-retryable-run" }).click();
    await page.getByRole("button", { name: "Tạo lần gen lại" }).click();

    // Assert — a generic conflict must never be represented as a queued retry.
    await expect(page.getByRole("alert")).toHaveText("Retry đã hết lượt.");
    // The confirmation dialog deliberately stays open with the safe server
    // message. Canceling returns the operator to the still-actionable CTA.
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(page.getByRole("button", { name: "Gen lại website e2e-retryable-run", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đang gen lại website e2e-retryable-run" })).toHaveCount(0);
  });

  test("[TC-F41-19] Retry accepted from the detail page updates its recovery CTA", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the dedicated Super Admin E2E account configured by auth.setup.ts.",
    );

    // Arrange
    await page.route("**/api/admin/generations**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      if (new URL(route.request().url()).pathname !== "/api/admin/generations") {
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(detailResponse(retryableRow)) });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(response([retryableRow])) });
    });
    await page.route("**/api/admin/generations/e2e-retryable-run/retry", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ jobId: "mock-detail-job", childGenerationId: "mock-detail-child", recoveryStatus: "retrying" }),
      });
    });

    // Act — use the detail CTA, not the listing CTA.
    await page.goto("/studio/generations");
    await page.getByRole("button", { name: "Xem generation e2e-retryable-run" }).click();
    await page.getByRole("button", { name: "Gen lại website e2e-retryable-run" }).click();
    await page.getByRole("button", { name: "Tạo lần gen lại" }).click();

    // Assert — the detail page reloads its server-owned state after acceptance.
    await expect(page.getByRole("button", { name: "Đang gen lại website e2e-retryable-run" })).toBeDisabled();
  });

  test("[TC-F41-20] Super Admin can open and inspect the full shareable detail page", async ({ page }) => {
    test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE, "Requires the dedicated Super Admin E2E account configured by auth.setup.ts.");

    // Arrange
    await page.route("**/api/admin/generations/e2e-attention-run", async (route) => {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(detailResponse(attentionRow)) });
    });

    // Act
    await page.goto("/studio/generations/e2e-attention-run");

    // Assert
    await expect(page.getByText("Preview URL")).toBeVisible();
    await expect(page.getByText("Live URL")).toBeVisible();
    await expect(page.getByRole("button", { name: "Xem form đầy đủ" })).toBeVisible();
    await page.getByRole("button", { name: "Xem form đầy đủ" }).click();
    await expect(page.getByText("Keep this content concise")).toBeVisible();
    await expect(page.getByText("Trang và component")).toBeVisible();
    await page.getByText("Thông tin kỹ thuật phục vụ Dev debug").click();
    await expect(page.getByText("safe evidence")).toBeVisible();
  });
});
