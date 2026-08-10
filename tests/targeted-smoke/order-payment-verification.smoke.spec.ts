import { expect, test } from "@playwright/test";
import { prepareTargetedSmokeFixture } from "./fixture";

test.describe("F40 targeted order-payment-verification Smoke", () => {
  test.use({ storageState: "./e2e/.auth/user.json" });

  test("[TC-F10-06-41] staff approval persists the fixture payment verification", async ({ page }) => {
    // Arrange
    const fixture = await prepareTargetedSmokeFixture(page);
    await page.goto(fixture.paymentOrderPath, { waitUntil: "domcontentloaded" });
    const approveButton = page.getByRole("button", { name: /approve payment|duyệt.*thanh toán/i });
    await expect(approveButton).toBeVisible();
    const approvalResponse = page.waitForResponse((response) => (
      response.request().method() === "PATCH" && /\/api\/orders\/[^/]+\/approve-payment$/.test(response.url())
    ));

    // Act
    await approveButton.click();
    const response = await approvalResponse;

    // Assert
    expect(response.ok(), await response.text()).toBe(true);
    await expect(approveButton).toHaveCount(0);
    await expect(page.getByText(/payment approved|đã duyệt thanh toán/i)).toBeVisible();
  });
});
