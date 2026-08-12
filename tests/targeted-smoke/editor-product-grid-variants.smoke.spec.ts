import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { prepareTargetedSmokeFixture } from "./fixture";

test.describe("F40 Editor Product Grid variant Smoke", () => {
  test("[TC-F40-04-02] QA-Tshirt-SML is bound in Product Grid and exposes S, M and L exactly once", async ({
    page,
    browser,
  }) => {
    // Arrange
    const fixture = await prepareTargetedSmokeFixture(page);
    const observationPath = process.env.QA_RESULT_OBSERVATIONS_PATH;
    if (observationPath) writeFileSync(observationPath, JSON.stringify({
      "TC-F40-04-02": {
        fixtureReference: "QA-Tshirt-SML", expectedCount: 3,
        expectedSummary: "Product Grid exposes exactly three selectable sizes.",
        actualSummary: "Measurement unavailable because the flow stopped before variant discovery.",
        classification: "product", evidenceKind: "report",
      },
    }));
    await page.goto(fixture.editorPath, { waitUntil: "domcontentloaded" });
    const preview = page.locator("iframe").contentFrame();
    await expect(preview.locator(`a[href="${new URL(fixture.productPath).pathname}"]`)).toBeVisible();

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(fixture.productGridPath, { waitUntil: "domcontentloaded" });
    const productLink = publicPage.locator(`a[href="${new URL(fixture.productPath).pathname}"]`);
    await expect(productLink).toContainText("QA-Tshirt-SML");
    await productLink.click();
    await expect(publicPage).toHaveURL(fixture.productPath);

    // Act
    const variants = publicPage.getByText("Phân loại", { exact: true }).locator("..").getByRole("button");
    const actualCount = await variants.count();
    if (observationPath) {
      writeFileSync(observationPath, JSON.stringify({
        "TC-F40-04-02": {
          fixtureReference: "QA-Tshirt-SML",
          expectedCount: 3,
          actualCount,
          expectedSummary: "Product Grid exposes exactly three selectable sizes.",
          actualSummary: `Observed ${actualCount} selectable sizes.`,
          classification: "product",
          evidenceKind: "report",
        },
      }));
    }

    // Assert
    expect(actualCount).toBe(3);
    await expect(variants).toHaveText(["S", "M", "L"]);
    await publicContext.close();
  });
});
