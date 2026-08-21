import { expect, test } from "@playwright/test";
import { prepareTargetedSmokeFixture } from "./fixture";

test.describe("F40 targeted product-variant Smoke", () => {
  test("[TC-F09.64] variant selection gates add-to-cart and preserves the chosen variant", async ({ page, browser }) => {
    // Arrange
    const fixture = await prepareTargetedSmokeFixture(page);
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(fixture.productPath, { waitUntil: "domcontentloaded" });
    const variantButtons = publicPage.locator("button[aria-pressed]");
    const addToCart = publicPage.getByRole("button", { name: /add to cart|thêm vào giỏ/i });
    await expect(variantButtons.first()).toBeVisible();
    await expect(addToCart).toBeDisabled();

    // Act
    const selected = publicPage.locator("button[aria-pressed]:not(:disabled)").first();
    await selected.click();
    await addToCart.click();

    // Assert
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    const drawer = publicPage.getByRole("dialog", { name: /shopping cart|giỏ hàng/i });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText((await selected.textContent() ?? "").trim());
    await publicContext.close();
  });
});
