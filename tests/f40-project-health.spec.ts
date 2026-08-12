import { expect, test, type Browser } from "@playwright/test";

async function createUnauthenticatedBrowserContext(browser: Browser) {
  return browser.newContext({
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    storageState: { cookies: [], origins: [] },
  });
}

interface ProjectHealthTarget {
  targetId: string;
  state: string;
  reasonCode: string;
}

interface ProjectHealthResponse {
  data?: {
    targets?: ProjectHealthTarget[];
    summary?: {
      totalTargets: number;
    };
  };
}

test.describe("F40 QA Control Center security boundary", () => {
  test("[TC-F40-01-E2E-01] rejects unauthenticated access to project health API", async ({
    browser,
  }) => {
    // Act
    const context = await createUnauthenticatedBrowserContext(browser);
    const response = await context.request.get("/api/admin/qa/project-health");

    // Assert: Unauthorized or Forbidden returned
    expect([401, 403]).toContain(response.status());
    await context.close();
  });

  test("[TC-F40-04-E2E-01] rejects unauthenticated access to QA Inbox data", async ({
    browser,
  }) => {
    // Act
    const context = await createUnauthenticatedBrowserContext(browser);
    const response = await context.request.get("/api/admin/qa/control-center");

    // Assert
    expect([401, 403]).toContain(response.status());
    await context.close();
  });

  test("[TC-F40-04-E2E-04] rejects an unauthenticated manual targeted Retest", async ({
    browser,
  }) => {
    // Act
    const context = await createUnauthenticatedBrowserContext(browser);
    const response = await context.request.post(
      "/api/admin/qa/targets/editor-productgrid-variants/retest",
    );

    // Assert: dispatching a browser-writing pack is super-admin only.
    expect([401, 403]).toContain(response.status());
    await context.close();
  });

  test("[TC-F40-04-E2E-05] rejects an unauthenticated QA fixture request", async ({
    browser,
  }) => {
    // Arrange
    const context = await createUnauthenticatedBrowserContext(browser);

    // Act
    const response = await context.request.post(
      "/api/e2e/qa-control-center-fixture",
    );

    // Assert
    expect([401, 403]).toContain(response.status());
    await context.close();
  });
});

test.describe("F40 Project Health Inventory & Unknown Target State", () => {
  test("[TC-F40-01-E2E-02] super-admin views full CMS inventory and Unknown targets", async ({
    page,
  }) => {
    // Arrange: the project depends on auth.setup.ts, which persists the
    // super-admin Studio session verified through the app's OTP flow.

    // Act 1: Fetch protected control-center data as the authenticated user.
    const healthResponse = await page.request.get(
      "/api/admin/qa/control-center",
    );
    expect(healthResponse.ok()).toBe(true);

    const json = (await healthResponse.json()) as ProjectHealthResponse;
    const targets = json.data?.targets;
    const summary = json.data?.summary;

    // Assert API response: 67 active CMS targets present, all default to deterministic Unknown when no runs exist
    expect(summary?.totalTargets).toBe(67);
    expect(targets).toHaveLength(67);

    // Verify AC-2: Targets with no runs are Unknown, never displayed as Healthy
    const unmappedTarget = targets?.find(
      (t) => t.targetId === "ai-translate-workflow",
    );
    expect(unmappedTarget).toBeDefined();
    expect(unmappedTarget?.state).toBe("Unknown");
    expect(unmappedTarget?.reasonCode).toBeTruthy();

    // Act 2: Navigate to /studio/qa UI and use the real health inventory.
    const fixtureResponse = await page.request.post(
      "/api/e2e/qa-control-center-fixture",
    );
    expect(fixtureResponse.ok()).toBe(true);

    await page.goto("/studio/qa");
    await page.waitForLoadState("networkidle");

    // Assert UI elements
    await expect(
      page.getByRole("heading", { name: /QA Control Center/i }),
    ).toBeVisible();

    // AC-1/2: an actionable Product Grid failure is ordered into Inbox and
    // exposes its persisted scenario detail rather than demo content.
    const productGridRow = page.getByTestId(
      "qa-inbox-row-editor-productgrid-variants",
    );
    await expect(productGridRow).toBeVisible();
    await expect(
      page.getByTestId("qa-inbox-row-editor-publish-lifecycle"),
    ).toBeVisible();
    const orderedInboxTargets = await page
      .locator("[data-testid^='qa-inbox-row-']")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")));
    expect(orderedInboxTargets.indexOf("qa-inbox-row-editor-productgrid-variants")).toBeLessThan(
      orderedInboxTargets.indexOf("qa-inbox-row-editor-publish-lifecycle"),
    );
    await page
      .getByTestId("qa-open-detail-editor-productgrid-variants")
      .click();
    await expect(page.getByTestId("qa-detail-testcase-id")).toHaveText(
      "TC-F40-04-02",
    );
    await expect(page.getByTestId("qa-detail-fixture")).toHaveText(
      "QA-Tshirt-SML",
    );
    await expect(page.getByTestId("qa-detail-expected")).toContainText("S, M");
    await expect(page.getByTestId("qa-detail-actual")).toHaveText("Chỉ thấy S và M");
    await expect(page.getByTestId("qa-visual-comparison")).toBeVisible();
    await expect(page.getByTestId("qa-visual-review-status")).toContainText(
      "Chờ tester xác nhận",
    );
    await expect(page.getByTestId("qa-evidence-baseline")).toHaveAttribute(
      "href",
      /qa-e2e\.local\/sanitized\/baseline/,
    );
    await expect(page.getByTestId("qa-evidence-current")).toHaveAttribute(
      "href",
      /qa-e2e\.local\/sanitized\/current/,
    );
    await expect(page.getByTestId("qa-evidence-diff")).toHaveAttribute(
      "href",
      /qa-e2e\.local\/sanitized\/diff/,
    );
    await page.getByRole("button", { name: "Đánh dấu thay đổi hợp lệ" }).click();
    await expect(page.getByTestId("qa-visual-review-status")).toContainText(
      "Đã đánh dấu thay đổi hợp lệ",
    );
    await page.getByTestId("qa-retest").click();
    await expect(page.getByTestId("qa-retest-confirm")).toBeVisible();
    await page.getByTestId("qa-retest-confirm").click();
    await expect(page.getByRole("status")).toContainText(
      /Targeted Smoke|Retest requires|Không thể dispatch/i,
    );
    await page.keyboard.press("Escape");

    await page.getByTestId("qa-health-tab").click();
    const searchInput = page.locator("#qa-target-search");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Page Publish & Rollback");

    // Verify search filters table to target
    await expect(
      page.getByText("Page Publish & Rollback", { exact: true }),
    ).toBeVisible();

    // Keyboard navigation must keep all local QA tabs operable.
    await page.getByTestId("qa-health-tab").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("qa-inbox-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("qa-health-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("qa-runs-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: "Lịch sử chạy" }),
    ).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("tab"))
      .toBe("runs");
    await page.getByTestId("qa-health-tab").click();
    await page
      .getByRole("button", { name: "Mở chi tiết" })
      .first()
      .click();
    await expect(page.getByTestId("qa-retest-pending")).toBeVisible();
    await page.keyboard.press("Escape");

    // The Studio shell must not create a horizontal page overflow on mobile.
    await page.setViewportSize({ width: 375, height: 800 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

  });
});
