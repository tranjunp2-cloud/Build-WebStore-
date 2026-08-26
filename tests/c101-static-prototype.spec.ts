import { expect, test } from "@playwright/test";

const routes = ["", "/products", "/articles", "/about-us", "/contact"];

for (const route of routes) {
  test(`C101 renderer fixture ${route || "/"} uses SiteRenderer`, async ({
    page,
  }) => {
    await page.goto(`/preview/static-prototype/c101${route}`);
    await expect(
      page.locator('[data-static-prototype="c101"]'),
    ).toHaveAttribute("data-render-provenance", "SiteRenderer");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
  });
}
