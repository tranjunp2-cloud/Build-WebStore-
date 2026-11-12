import { chromium, expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type HealthTarget = {
  targetId: string;
  state: string;
  links: Array<{ type: string; issueNumber?: number }>;
};

type HealthResponse = { data?: { targets?: HealthTarget[] } };

test.describe("F40 GitHub issue security boundary", () => {
  test("[TC-F40-05-03-E2E-01] rejects unauthenticated sync and mapping writes", async ({ request }) => {
    // Arrange

    // Act
    const sync = await request.post("/api/admin/qa/github-issues/sync");
    const mapping = await request.post("/api/admin/qa/github-issues/1/mapping", {
      data: { action: "confirm", targetId: "editor-publish-lifecycle" },
    });

    // Assert
    expect([401, 403]).toContain(sync.status());
    expect([401, 403]).toContain(mapping.status());
  });
});

test.describe("F40 GitHub issue mapping browser flow", () => {
  test.afterEach(async () => {
    // Reset, rather than dismiss: the seeded baseline must be `unknown`.
    if (process.env.F40_E2E_ADMIN_PASSWORD)
      await execFileAsync("npm", ["run", "--silent", "db:reset-f40-github-issues"], { env: process.env });
  });

  test("[TC-F40-05-05-E2E-02] unknown is safe, confirmed open P1 is Critical, and cleared mapping has no old-target effect", async () => {
    // Arrange: this mutation is only enabled with resettable QC fixture IDs.
    const email = process.env.F40_E2E_ADMIN_EMAIL;
    const password = process.env.F40_E2E_ADMIN_PASSWORD;
    const issueId = process.env.F40_GITHUB_MAPPING_ISSUE_ID;
    const issueNumber = Number(process.env.F40_GITHUB_MAPPING_ISSUE_NUMBER);
    const targetId = process.env.F40_GITHUB_MAPPING_TARGET_ID;
    const clearedIssueNumber = Number(process.env.F40_GITHUB_CLEARED_ISSUE_NUMBER);
    const clearedIssueId = process.env.F40_GITHUB_CLEARED_ISSUE_ID;
    const clearedTargetId = process.env.F40_GITHUB_CLEARED_TARGET_ID;
    const remappedTargetId = process.env.F40_GITHUB_REMAPPED_TARGET_ID;
    if (!email || !password || !issueId || !Number.isSafeInteger(issueNumber) || !targetId || !clearedIssueId || !Number.isSafeInteger(clearedIssueNumber) || !clearedTargetId || !remappedTargetId) {
      test.skip(true, "Requires resettable F40 fixture IDs plus super-admin credentials");
      return;
    }

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Password login on purpose: F40_E2E_ADMIN_EMAIL is a super-admin (scripts/f40-github-issue-fixture.ts),
      // whose password-step token app routes still accept (TC-PERF-142); the E2E OTP bypass refuses super-admins.
      // The context inherits baseURL and the config's Origin header, which the cookie-authenticated POSTs need.
      const login = await page.request.post("/api/users/login", { data: { email, password } });
      expect(login.ok()).toBe(true);

      await page.goto("/studio/qa");
    await expect(page.getByRole("heading", { name: "QA Control Center" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`#${issueNumber}`) })).toBeVisible();

    const before = await page.request.get("/api/admin/qa/project-health");
    expect(before.ok()).toBe(true);
    const beforeJson = (await before.json()) as HealthResponse;
    const beforeTarget = beforeJson.data?.targets?.find((target) => target.targetId === targetId);
    expect(beforeTarget?.links.some((link) => link.issueNumber === issueNumber)).toBe(false);

    // Act: Ary confirms the otherwise Unknown fixture issue.
    const confirmed = await page.request.post(`/api/admin/qa/github-issues/${issueId}/mapping`, {
      data: { action: "confirm", targetId },
    });
    expect(confirmed.ok()).toBe(true);
    const after = await page.request.get("/api/admin/qa/project-health");
    const afterJson = (await after.json()) as HealthResponse;
    const mappedTarget = afterJson.data?.targets?.find((target) => target.targetId === targetId);
    const remapped = await page.request.post(`/api/admin/qa/github-issues/${clearedIssueId}/mapping`, {
      data: { action: "confirm", targetId: remappedTargetId },
    });
    expect(remapped.ok()).toBe(true);
    const afterRemap = await page.request.get("/api/admin/qa/project-health");
    const afterRemapJson = (await afterRemap.json()) as HealthResponse;
    const clearedTarget = afterRemapJson.data?.targets?.find((target) => target.targetId === clearedTargetId);

    // Assert: Critical has an explainable issue link; remapping removes it from the old target.
    expect(mappedTarget).toMatchObject({ state: "Critical" });
    expect(mappedTarget?.links).toEqual(expect.arrayContaining([expect.objectContaining({ type: "issue", issueNumber })]));
    expect(clearedTarget?.links.some((link) => link.issueNumber === clearedIssueNumber)).toBe(false);
    await page.goto("/studio/qa");
    await page.locator("#target-search").fill(targetId);
    await page.getByRole("button", { name: "Mở chi tiết" }).click();
    await expect(page.locator(`#target-${targetId}`).getByText("Nghiêm trọng", { exact: true })).toBeVisible();
    await expect(page.locator(`a[href*="/issues/${issueNumber}"]`)).toBeVisible();
    const dismissed = await page.request.post(`/api/admin/qa/github-issues/${issueId}/mapping`, {
      data: { action: "dismiss", reason: "F40 automated fixture cleanup" },
    });
    expect(dismissed.ok()).toBe(true);
    const afterDismiss = await page.request.get("/api/admin/qa/project-health");
    const afterDismissJson = (await afterDismiss.json()) as HealthResponse;
    const dismissedTarget = afterDismissJson.data?.targets?.find((target) => target.targetId === targetId);
    expect(dismissedTarget?.links.some((link) => link.issueNumber === issueNumber)).toBe(false);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});
