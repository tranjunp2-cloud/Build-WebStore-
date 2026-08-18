import { expect, test } from "@playwright/test";

test.describe("[TC-F40-07-05] Targeted manual-run authorization boundary", () => {
  test("blocks unauthenticated preflight, dispatch, cancellation, and history", async ({
    browser,
  }) => {
    // Arrange
    const context = await browser.newContext({
      baseURL: process.env.BASE_URL || "http://localhost:3000",
      storageState: { cookies: [], origins: [] },
    });

    // Act
    const [preflight, dispatch, cancel, history] = await Promise.all([
      context.request.get(
        "/api/admin/qa/manual-runs/preflight?targetId=editor-productgrid-variants&profile=smoke",
      ),
      context.request.post("/api/admin/qa/manual-runs", {
        data: {
          targetId: "editor-productgrid-variants",
          profile: "smoke",
          idempotencyKey: "a".repeat(16),
        },
      }),
      context.request.post("/api/admin/qa/manual-runs/1/cancel", {
        data: { reason: "unauthorized test" },
      }),
      context.request.get("/api/admin/qa/runs"),
    ]);

    // Assert
    for (const [label, response] of Object.entries({
      preflight,
      dispatch,
      cancel,
      history,
    })) {
      expect([401, 403], `${label} must reject an anonymous request`).toContain(
        response.status(),
      );
    }
    await context.close();
  });
});

test.describe("[TC-F40-07-05] Targeted manual-run browser flow", () => {
  test("shows server preflight, blocks an uncovered profile, and keeps history filters addressable", async ({
    page,
  }) => {
    // Arrange: the local-only fixture is protected by the setup super-admin
    // storage state used by the f40-manual-runs project.
    const fixture = await page.request.post(
      "/api/e2e/qa-control-center-fixture",
    );
    const fixtureBody = (await fixture.json()) as {
      data?: { manualContext?: { pullRequest: number; commitSha: string } };
    };
    expect(fixture.status()).toBe(200);
    const context = fixtureBody.data?.manualContext;
    expect(context).toBeTruthy();
    const validPreflight = await page.request.get(
      `/api/admin/qa/manual-runs/preflight?targetId=editor-productgrid-variants&profile=smoke&pullRequest=${context!.pullRequest}&commitSha=${context!.commitSha}`,
    );
    const validPreflightBody = (await validPreflight.json()) as {
      data?: { canDispatch?: boolean };
    };
    expect(validPreflight.status()).toBe(200);
    expect(validPreflightBody.data?.canDispatch).toBe(true);

    // Act: select exactly one target, then provide the immutable Staging
    // context only when server preflight explicitly asks for it.
    await page.goto("/studio/qa");
    await page.getByRole("tab", { name: "Lịch sử chạy" }).click();
    await page.getByRole("button", { name: "Chạy test theo target" }).click();
    await page
      .getByLabel("Target cần chạy")
      .selectOption("editor-productgrid-variants");
    await expect(page.getByLabel("PR Staging")).toBeVisible();
    await page.getByLabel("PR Staging").fill(String(context!.pullRequest));
    await page
      .locator('input[aria-label="Commit SHA"]:visible')
      .fill(context!.commitSha);
    // Assert: a valid server-derived preview precedes the confirmation dialog.
    await expect(page.getByText("Sẵn sàng chạy test")).toBeVisible();
    await expect(page.getByText("Test type")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Regression/ }),
    ).toBeDisabled();
    await expect(
      page.getByRole("dialog", { name: "Chạy manual targeted test" }),
    ).toBeVisible();
    const dispatchResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin/qa/manual-runs") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Xác nhận chạy \d+ TC/ }).click();
    const response = await dispatchResponse;
    expect(response.status(), await response.text()).toBe(202);
    await expect(page.getByText("Run đã được gửi vào hàng đợi.")).toBeVisible();

    // A second request for the same fixture is blocked while the first run is
    // active. Cancel it from the real browser surface so the permitted
    // cancellation path and the capacity recovery are both covered.
    await page.getByRole("button", { name: "Chạy test theo target" }).click();
    await page
      .getByLabel("Target cần chạy")
      .selectOption("editor-productgrid-variants");
    await expect(
      page.getByText("Môi trường test đang được một lần chạy khác sử dụng"),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Chạy manual targeted test" })
      .getByLabel("Đóng")
      .click();
    const refreshedHistory = await page.request.get("/api/admin/qa/runs?days=7");
    expect(refreshedHistory.status(), await refreshedHistory.text()).toBe(200);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Hủy run" }).first().click();
    await expect(page.getByText("Yêu cầu hủy đã được ghi nhận.")).toBeVisible();

    // Assert the real protected preflight rejects an uncovered catalog target;
    // this remains server-enforced even if client availability is stale.
    const blockedPreflight = await page.request.get(
      `/api/admin/qa/manual-runs/preflight?targetId=ai-translate-workflow&profile=smoke&pullRequest=${context!.pullRequest}&commitSha=${context!.commitSha}`,
    );
    expect(blockedPreflight.status()).toBe(200);
    const blockedBody = (await blockedPreflight.json()) as {
      data?: { canDispatch?: boolean; reasons?: Array<{ code?: string }> };
    };
    expect(blockedBody.data?.canDispatch).toBe(false);
    expect(blockedBody.data?.reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "NO_ACTIVE_PACK" })]),
    );
    await page.getByRole("button", { name: "Chạy test theo target" }).click();
    await page.getByLabel("Target cần chạy").selectOption("ai-translate-workflow");
    await expect(
      page.getByText("Target này chưa có gói test được QA phê duyệt"),
    ).toBeVisible();
    await expect(
      page.getByText(/QA\/Engineering cần đăng ký Smoke hoặc Regression pack/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Xác nhận chạy" })).toBeDisabled();

    // Close the launch dialog before interacting with the underlying Runs page.
    await page
      .getByRole("dialog", { name: "Chạy manual targeted test" })
      .getByLabel("Đóng")
      .click();

    // Act/Assert: history filters are URL-addressable and never expose artifact links.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Bộ lọc lịch sử" }).click();
    await page.getByLabel("Lọc PR mobile").fill("1746");
    await page.getByRole("button", { name: "Áp dụng" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("pullRequest"))
      .toBe("1746");
    await expect(
      page.getByRole("heading", { name: "Lịch sử chạy test" }),
    ).toBeVisible();
    await expect(page.getByText(/artifact_url|must-not-leak/)).toHaveCount(0);
  });

  test("uses an accessible bottom sheet for mobile history filters", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 375, height: 812 });
    await page.request.post("/api/e2e/qa-control-center-fixture");
    await page.goto("/studio/qa");
    await page.getByRole("tab", { name: "Lịch sử chạy" }).click();

    // Act
    await page.getByRole("button", { name: "Bộ lọc lịch sử" }).click();
    const sheet = page.getByRole("dialog", { name: "Bộ lọc lịch sử chạy" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("Lọc Pack mobile")).toBeVisible();
    await expect(sheet.getByLabel("Lọc Trạng thái mobile")).toBeVisible();
    await sheet.getByLabel("Lọc PR mobile").fill("1746");
    await sheet.getByRole("button", { name: "Áp dụng" }).click();

    // Assert
    await expect
      .poll(() => new URL(page.url()).searchParams.get("pullRequest"))
      .toBe("1746");
    await expect(sheet).toBeHidden();
  });
});
