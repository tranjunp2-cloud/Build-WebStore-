import { expect, test } from "@playwright/test";

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

test.describe("F40 Project Health Security Boundary", () => {
  test("[TC-F40-01-E2E-01] rejects unauthenticated access to project health API", async ({
    request,
  }) => {
    // Act
    const response = await request.get("/api/admin/qa/project-health");

    // Assert: Unauthorized or Forbidden returned
    expect([401, 403]).toContain(response.status());
  });
});

test.describe("F40 Project Health Inventory & Unknown Target State", () => {
  test("[TC-F40-01-E2E-02] super-admin views full CMS inventory and Unknown targets", async ({
    browser,
    request,
  }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      if (process.env.CI) {
        throw new Error(
          "ADMIN_EMAIL and ADMIN_PASSWORD must be configured to test super-admin Project Health access",
        );
      }
      test.skip(
        true,
        "A super-admin account is required to verify the protected Project Health view",
      );
    }

    // Arrange: Create super-admin context
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Authenticate via Payload admin login
    await adminPage.goto("/admin");
    const emailInput = adminPage.locator(
      'input[name="email"], input[id="field-email"]',
    );
    await emailInput.fill(adminEmail);
    await adminPage
      .locator('input[name="password"], input[id="field-password"]')
      .fill(adminPassword);
    await adminPage.locator('button[type="submit"]').click();
    await adminPage.waitForLoadState("networkidle");

    // Act 1: Fetch Project Health API data as super-admin
    const healthResponse = await adminPage.request.get(
      "/api/admin/qa/project-health",
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

    // Act 2: Navigate to /studio/qa UI
    await adminPage.goto("/studio/qa");
    await adminPage.waitForLoadState("networkidle");

    // Assert UI elements
    await expect(
      adminPage.getByRole("heading", { name: /QA Control Center/i }),
    ).toBeVisible();

    // Check search input filter
    const searchInput = adminPage.locator("#target-search");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Page Publish & Rollback");

    // Verify search filters table to target
    await expect(
      adminPage.getByText("Page Publish & Rollback", { exact: true }),
    ).toBeVisible();

    await adminContext.close();
  });
});
