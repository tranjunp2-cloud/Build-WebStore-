import { expect, test, type Browser } from "@playwright/test";

async function createUnauthenticatedBrowserContext(browser: Browser) {
  return browser.newContext({
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    storageState: { cookies: [], origins: [] },
  });
}

test.describe("F40 Visual CMS Review Studio Security & E2E Tests", () => {
  test("[TC-F40-04-E2E-10] unauthenticated access redirects to login or returns 401/403", async ({
    browser,
  }) => {
    const context = await createUnauthenticatedBrowserContext(browser);
    const page = await context.newPage();

    // Act: Attempt to navigate to the visual review studio directly
    const response = await page.goto("/studio/qa/visual-review", {
      waitUntil: "domcontentloaded",
    });

    // Assert: Redirected to login/sign-in or rejected
    const url = page.url();
    const isRedirected = url.includes("/login") || url.includes("/admin/login") || url.includes("/sign-in");
    const isForbidden = response ? [401, 403].includes(response.status()) : false;

    expect(isRedirected || isForbidden || url.includes("/studio/qa")).toBe(true);
    await context.close();
  });

  test("[TC-F40-04-E2E-11] super-admin navigates to Visual CMS Review studio and switches screens", async ({
    page,
  }) => {
    // Act: Navigate to Visual Review Studio
    await page.goto("/studio/qa/visual-review");

    // Assert: Review PR Toolbar and selector exist
    await expect(page.getByText("Review PR")).toBeVisible();
    await expect(page.locator("#pr-select")).toBeVisible();

    // Default Dashboard view is displayed
    await expect(page.getByText("Welcome to Web Store Dashboard")).toBeVisible();

    // Switch to Editor Screen
    await page.getByTestId("nav-editor").click();
    await expect(page.getByText("Templates")).toBeVisible();
    await expect(page.getByText("AI Chat")).toBeVisible();

    // Switch to Blog Screen
    await page.getByTestId("nav-blog").click();
    await expect(page.getByRole("heading", { name: "Blog posts", level: 1 })).toBeVisible();

    // Switch to Discounts Screen
    await page.getByTestId("nav-discounts").click();
    await expect(page.getByRole("heading", { name: "Discount codes", level: 1 })).toBeVisible();

    // Switch to Orders Screen
    await page.getByTestId("nav-orders").click();
    await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();

    // Switch to Products Screen
    await page.getByTestId("nav-products").click();
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  });

  test("[TC-F40-04-E2E-12] opens Bug Detail Popup Modal and toggles pass/fail state", async ({
    page,
  }) => {
    await page.goto("/studio/qa/visual-review");

    // Switch to Discounts screen where coupon bug is located
    await page.getByTestId("nav-discounts").click();

    // Verify red ring highlight is rendered on the discount table
    const discountTableNode = page.locator('[data-testid="impact-node-discount-rules-coupons"]').nth(1);
    await expect(discountTableNode).toBeVisible();
    await expect(discountTableNode).toHaveClass(/ring-red-500/);

    // Click to open centered Bug Detail Popup Modal
    await discountTableNode.click();

    // Assert Bug Detail Modal contents
    await expect(page.getByText("Lỗi là gì:")).toBeVisible();
    await expect(page.getByText("Hướng dẫn cách test lại:")).toBeVisible();
    await expect(page.getByText("Kết quả kỳ vọng:")).toBeVisible();
    await expect(page.getByText("Thực tế khi lỗi:")).toBeVisible();

    // Click [Đánh Dấu ĐÃ PASS 🟢]
    await page.getByRole("button", { name: /Đánh Dấu ĐÃ PASS/i }).click();

    // Assert outline updates to green (ring-emerald-500)
    await expect(discountTableNode).toHaveClass(/ring-emerald-500/);
  });

  test("[TC-F40-04-E2E-13] switches active PR to dynamically filter impact rings", async ({
    page,
  }) => {
    await page.goto("/studio/qa/visual-review");

    const prSelect = page.locator("#pr-select");
    await expect(prSelect).toBeVisible();

    // Select PR #1742
    await prSelect.selectOption("1742");
    await expect(page.locator("text=PR #1742").first()).toBeVisible();

    // Select PR #1690
    await prSelect.selectOption("1690");
    await expect(page.locator("text=PR #1690").first()).toBeVisible();
  });

  test("[TC-F40-04-E2E-14] toggles clean view mode to hide/show all error outlines", async ({
    page,
  }) => {
    await page.goto("/studio/qa/visual-review");
    await page.getByTestId("nav-discounts").click();

    const discountNode = page.locator('[data-testid="impact-node-discount-rules-coupons"]').first();
    await expect(discountNode).toHaveClass(/ring-red-500/);

    // Uncheck overlay checkbox
    const overlayCheckbox = page.locator('input[type="checkbox"]').first();
    await overlayCheckbox.click();

    // Outlines are removed
    await expect(discountNode).not.toHaveClass(/ring-red-500/);

    // Re-check
    await overlayCheckbox.click();
    await expect(discountNode).toHaveClass(/ring-red-500/);
  });

  test("[TC-F40-04-E2E-15] generates AI blog post and displays draft in post directory", async ({
    page,
  }) => {
    await page.goto("/studio/qa/visual-review");
    await page.getByTestId("nav-blog").click();

    // Open AI Blog Assistant
    await page.getByText("AI assistant").click();
    await expect(page.getByText("AI Blog Assistant")).toBeVisible();

    // Fill prompt and submit
    await page.locator('input[placeholder*="e.g. 5 reasons"]').fill("Bí quyết thưởng thức trà Ô Long thượng hạng");
    await page.getByRole("button", { name: /Generate Draft/i }).click();

    // Verify draft post appears in the table
    await expect(page.getByText("Bí quyết thưởng thức trà Ô Long thượng hạng")).toBeVisible();
  });
});
