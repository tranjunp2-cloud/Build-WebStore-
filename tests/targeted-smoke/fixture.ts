import { expect, type Page } from "@playwright/test";

export type TargetedSmokeFixture = {
  productPath: string;
  productGridPath: string;
  editorPath: string;
  checkoutPath: string;
  paymentOrderPath: string;
};

/** Rebuilds only deterministic records in the isolated staging QA tenant. */
export async function prepareTargetedSmokeFixture(page: Page): Promise<TargetedSmokeFixture> {
  const response = await page.request.post("/api/e2e/targeted-smoke-fixture", {
    headers: { "x-e2e-fixture-intent": "targeted-smoke-fixture-v1" },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const fixture = await response.json() as Partial<TargetedSmokeFixture>;
  if (!fixture.productPath || !fixture.productGridPath || !fixture.editorPath || !fixture.checkoutPath || !fixture.paymentOrderPath) {
    throw new Error("Targeted Smoke fixture response is incomplete");
  }
  return {
    productPath: fixture.productPath,
    productGridPath: fixture.productGridPath,
    editorPath: fixture.editorPath,
    checkoutPath: fixture.checkoutPath,
    paymentOrderPath: fixture.paymentOrderPath,
  };
}
