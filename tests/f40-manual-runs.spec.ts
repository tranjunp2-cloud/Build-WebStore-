import { expect, test } from "@playwright/test";

test.describe("[TC-F40-07-05] Targeted manual-run authorization boundary", () => {
  test("blocks unauthenticated preflight, dispatch, cancellation, and history", async ({ browser }) => {
    // Arrange
    const context = await browser.newContext({
      baseURL: process.env.BASE_URL || "http://localhost:3000",
      storageState: { cookies: [], origins: [] },
    });

    // Act
    const [preflight, dispatch, cancel, history] = await Promise.all([
      context.request.get("/api/admin/qa/manual-runs/preflight?targetId=editor-productgrid-variants&profile=smoke"),
      context.request.post("/api/admin/qa/manual-runs", { data: { targetId: "editor-productgrid-variants", profile: "smoke", idempotencyKey: "a".repeat(16) } }),
      context.request.post("/api/admin/qa/manual-runs/1/cancel", { data: { reason: "unauthorized test" } }),
      context.request.get("/api/admin/qa/runs"),
    ]);

    // Assert
    for (const [label, response] of Object.entries({ preflight, dispatch, cancel, history })) {
      expect([401, 403], `${label} must reject an anonymous request`).toContain(response.status());
    }
    await context.close();
  });
});

test.describe("[TC-F40-07-05] Targeted manual-run browser flow", () => {
  test("shows server preflight, blocks an uncovered profile, and keeps history filters addressable", async ({ page }) => {
    // Arrange: the local-only fixture is protected by the setup super-admin
    // storage state used by the f40-manual-runs project.
    const fixture = await page.request.post("/api/e2e/qa-control-center-fixture");
    expect(fixture.status(), await fixture.text()).toBe(200);

    // Act: select exactly one target and the immutable deployed context.
    await page.goto("/studio/qa");
    await page.getByRole("tab", { name: "Lịch sử chạy" }).click();
    await page.getByRole("button", { name: "Run targeted test" }).click();
    await page.getByRole("radio", { name: /Product Grid/ }).click();
    await page.getByLabel("Pull request context").fill("1746");
    await page.getByLabel("Commit SHA context").fill("abcdef1");
    await page.getByRole("button", { name: "Kiểm tra preflight" }).click();

    // Assert: a valid server-derived preview precedes the confirmation dialog.
    await expect(page.getByText("Preflight đạt")).toBeVisible();
    await expect(page.getByText("Test type")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Chạy manual targeted test" })).toBeVisible();
    const dispatchResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/qa/manual-runs") && response.request().method() === "POST");
    await page.getByRole("button", { name: /Chạy \d+ checks/ }).click();
    const response = await dispatchResponse;
    expect(response.status(), await response.text()).toBe(202);
    await expect(page.getByText(/Run dispatched|Run queued|Run accepted/i)).toBeVisible();

    // Act/Assert: Regression remains visibly blocked when no certified pack exists.
    await page.getByRole("button", { name: "Run targeted test" }).click();
    await page.getByRole("radio", { name: /Product Grid/ }).click();
    await page.getByLabel("QA profile").selectOption("regression");
    await page.getByRole("button", { name: "Kiểm tra preflight" }).click();
    await expect(page.getByText("Preflight bị chặn")).toBeVisible();
    await expect(page.getByText(/NO_ACTIVE_PACK/)).toBeVisible();
    await page.getByRole("dialog", { name: "Chạy manual targeted test" }).getByRole("button", { name: "Đóng" }).click();

    // Act/Assert: history filters are URL-addressable and never expose artifact links.
    await page.getByLabel("Lọc PR", { exact: true }).fill("1746");
    await expect.poll(() => new URL(page.url()).searchParams.get("pullRequest")).toBe("1746");
    await expect(page.getByRole("heading", { name: "Run history" })).toBeVisible();
    await expect(page.getByText(/artifact_url|must-not-leak/)).toHaveCount(0);
  });

  test("uses an accessible bottom sheet for mobile history filters", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 375, height: 812 });
    await page.request.post("/api/e2e/qa-control-center-fixture");
    await page.goto("/studio/qa");
    await page.getByRole("tab", { name: "Lịch sử chạy" }).click();

    // Act
    await page.getByRole("button", { name: "Bộ lọc lịch sử" }).click();
    const sheet = page.getByRole("dialog", { name: "Bộ lọc lịch sử chạy" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Lọc PR mobile").fill("1746");
    await sheet.getByRole("button", { name: "Áp dụng" }).click();

    // Assert
    await expect.poll(() => new URL(page.url()).searchParams.get("pullRequest")).toBe("1746");
    await expect(sheet).toBeHidden();
  });
});
