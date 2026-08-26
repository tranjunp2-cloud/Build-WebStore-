import { expect, type Page } from "@playwright/test";

export type TargetedSmokeFixture = {
  productPath: string;
  productGridPath: string;
  editorPath: string;
  checkoutPath: string;
  paymentOrderPath: string;
  cancelOrderPath: string;
};

/** Rebuilds only deterministic records in the isolated staging QA tenant. */
export async function prepareTargetedSmokeFixture(page: Page): Promise<TargetedSmokeFixture> {
  const dispatchId = process.env.TARGETED_DISPATCH_ID;
  if (!dispatchId) throw new Error("TARGETED_DISPATCH_ID is required for a leased fixture");
  const response = await page.request.post("/api/e2e/targeted-smoke-fixture", {
    headers: { "x-e2e-fixture-intent": "targeted-smoke-fixture-v1", "x-targeted-dispatch-id": dispatchId },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const fixture = await response.json() as Partial<TargetedSmokeFixture>;
  if (!fixture.productPath || !fixture.productGridPath || !fixture.editorPath || !fixture.checkoutPath || !fixture.paymentOrderPath || !fixture.cancelOrderPath) {
    throw new Error("Targeted Smoke fixture response is incomplete");
  }
  return {
    productPath: fixture.productPath,
    productGridPath: fixture.productGridPath,
    editorPath: fixture.editorPath,
    checkoutPath: fixture.checkoutPath,
    paymentOrderPath: fixture.paymentOrderPath,
    cancelOrderPath: fixture.cancelOrderPath,
  };
}

/** Reads the controlled variant stock without exposing arbitrary tenant data. */
export async function readCancellationFixtureStock(page: Page): Promise<number> {
  const dispatchId = process.env.TARGETED_DISPATCH_ID;
  if (!dispatchId) throw new Error("TARGETED_DISPATCH_ID is required for a leased fixture");
  const response = await page.request.get("/api/e2e/targeted-smoke-fixture", {
    headers: { "x-e2e-fixture-intent": "targeted-smoke-fixture-v1", "x-targeted-dispatch-id": dispatchId },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = await response.json() as { variant?: string; stock?: unknown };
  if (body.variant !== "M" || typeof body.stock !== "number") {
    throw new Error("Cancellation fixture stock response is incomplete");
  }
  return body.stock;
}
