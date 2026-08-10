import { expect, test } from "@playwright/test";
import { prepareTargetedSmokeFixture } from "./fixture";

async function openGuestCheckout(page: import("@playwright/test").Page, browser: import("@playwright/test").Browser) {
  const fixture = await prepareTargetedSmokeFixture(page);
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(fixture.productPath, { waitUntil: "domcontentloaded" });
  const variant = publicPage.locator("button[aria-pressed]:not(:disabled)").first();
  await expect(variant).toBeVisible();
  await variant.click();
  await publicPage.getByRole("button", { name: /add to cart|thêm vào giỏ/i }).click();
  await publicPage.goto(fixture.checkoutPath, { waitUntil: "domcontentloaded" });
  return { fixture, publicContext, publicPage };
}

test.describe("F40 targeted storefront checkout Smoke", () => {
  test("[TC-F09.32] guest reaches checkout without an authentication redirect", async ({ page, browser }) => {
    // Arrange
    const { publicContext, publicPage } = await openGuestCheckout(page, browser);

    // Assert
    await expect(publicPage).not.toHaveURL(/login|sign-in|dang-nhap/i);
    await expect(publicPage.getByRole("heading", { name: /checkout|thanh toán/i })).toBeVisible();
    await publicContext.close();
  });

  test("[TC-F09.30] configured COD fixture creates one order and reaches confirmation", async ({ page, browser }) => {
    // Arrange
    const { publicContext, publicPage } = await openGuestCheckout(page, browser);
    await publicPage.getByLabel(/name|tên/i).fill("Targeted Smoke Buyer");
    await publicPage.getByLabel(/email/i).fill("targeted-smoke@example.invalid");
    await publicPage.getByLabel(/phone|điện thoại/i).fill("0123456789");
    const cod = publicPage.getByRole("radio", { name: /cash on delivery|cod/i });
    await cod.check();
    const placeOrder = publicPage.getByRole("button", { name: /place order|đặt hàng/i });
    const orderResponse = publicPage.waitForResponse((response) => (
      response.request().method() === "POST" && /\/api\/orders\/checkout$/.test(response.url())
    ));

    // Act
    await placeOrder.click();
    const response = await orderResponse;

    // Assert
    expect(response.ok(), await response.text()).toBe(true);
    await expect(publicPage).toHaveURL(/\/order\//);
    await expect(publicPage.getByText(/order confirmed|cash on delivery|đơn hàng/i)).toBeVisible();
    await publicContext.close();
  });
});
