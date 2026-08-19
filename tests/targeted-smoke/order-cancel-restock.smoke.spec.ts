import { expect, test } from "@playwright/test";
import { prepareTargetedSmokeFixture, readCancellationFixtureStock } from "./fixture";

test.describe("F40 targeted order cancellation Smoke", () => {
  test.use({ storageState: "./e2e/.auth/user.json" });

  test("[TC-F10-03-01][TC-F10-03-03] confirmed bank-transfer order requires a reason and cancels with one restock", async ({ page }) => {
    // Arrange
    const fixture = await prepareTargetedSmokeFixture(page);
    await expect.poll(() => readCancellationFixtureStock(page)).toBe(9);
    await page.goto(fixture.cancelOrderPath, { waitUntil: "domcontentloaded" });
    const skipOnboarding = page.getByRole("button", {
      name: "Skip instructions",
    });
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click();
    }
    const cancel = page.getByRole("button", { name: /cancel order|hủy đơn/i });
    await expect(cancel).toBeVisible();

    // Act
    await cancel.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: /cancel this order|xác nhận hủy/i });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill("E2E targeted cancellation verification");
    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" && /\/api\/orders\/[^/]+\/cancel$/.test(response.url()),
    );
    await confirm.click();
    const response = await responsePromise;

    // Assert
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json() as { restock?: Array<{ restocked?: number }> };
    expect(body.restock?.[0]?.restocked).toBe(1);
    await expect.poll(() => readCancellationFixtureStock(page)).toBe(10);
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  });
});
