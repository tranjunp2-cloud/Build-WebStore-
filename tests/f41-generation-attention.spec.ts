import { expect, test } from "@playwright/test";

type GenerationListResponse = {
  items: Array<Record<string, unknown>>;
  nextCursor: null;
  meta: {
    totalDocs: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

const attentionRow = {
  id: "e2e-attention-run",
  submittedAt: "2026-09-15T08:00:00.000Z",
  user: { id: "e2e-user", label: "Tracker test user", missing: false },
  site: { id: "e2e-site", label: "E2E recovery site", missing: false },
  lifecycle: "terminal",
  outcome: "failed",
  recoveryStatus: "ticket_required",
  priority: "cannot_recover",
  recoveryPolicy: {
    action: "create_ticket",
    retryable: false,
    reasonCode: "TICKET_REQUIRED",
  },
  pageSummary: { expected: 5, persisted: 4, failed: 1 },
  affectedError: {
    code: "PAGE_PERSIST_FAILED",
    phase: "page_persist",
    locationType: "page",
    locationKey: "/contact",
    summary: "Không thể lưu trang Contact.",
  },
};

const successRow = {
  id: "e2e-success-run",
  submittedAt: "2026-09-15T07:00:00.000Z",
  user: { id: "e2e-user", label: "Tracker test user", missing: false },
  site: { id: "e2e-site", label: "E2E recovery site", missing: false },
  lifecycle: "terminal",
  outcome: "succeeded",
  recoveryStatus: "none",
  priority: "history",
  recoveryPolicy: {
    action: "view_detail",
    retryable: false,
    reasonCode: "NO_RECOVERY_ACTION",
  },
  pageSummary: { expected: 5, persisted: 5, failed: 0 },
  affectedError: null,
};

function response(items: Array<Record<string, unknown>>): GenerationListResponse {
  return {
    items,
    nextCursor: null,
    meta: {
      totalDocs: items.length,
      limit: 50,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

test.describe("US-F41-02 Needs Attention", () => {
  test("[TC-F41-17] Super Admin sees an actionable failure before success history", async ({ page }) => {
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD || !process.env.E2E_TEST_OTP_CODE,
      "Requires the dedicated Super Admin E2E account configured by auth.setup.ts.",
    );

    // Arrange: only browser-facing list data is mocked. Navigation and the
    // Super Admin boundary remain real; no AI/provider service is required.
    await page.route("**/api/admin/generations**", async (route) => {
      const view = new URL(route.request().url()).searchParams.get("view");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(response(view === "all" ? [attentionRow, successRow] : [attentionRow])),
      });
    });

    // Act: open the real Studio screen with the persisted Super Admin session.
    await page.goto("/studio/generations");

    // Assert: Needs Attention is the default and exposes safe operational
    // context/action before any historical success is requested.
    const attentionTab = page.getByRole("tab", { name: "Needs Attention" });
    await expect(attentionTab).toHaveAttribute("aria-selected", "true");
    const actionableRow = page.getByRole("button", {
      name: "Xem generation e2e-attention-run",
    });
    await expect(actionableRow).toContainText("Tracker test user");
    await expect(actionableRow).toContainText("E2E recovery site");
    await expect(actionableRow).toContainText("4/5");
    await expect(actionableRow).toContainText("PAGE_PERSIST_FAILED: Không thể lưu trang Contact.");
    await expect(actionableRow).toContainText("Cần ticket Dev");
    await expect(page.getByRole("button", { name: "Xem generation e2e-success-run" })).toHaveCount(0);

    // A row remains actionable through the safe detail navigation. F41-02
    // intentionally does not expose a retry/ticket mutation button yet.
    await actionableRow.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Generation #e2e-attention-run")).toBeVisible();

    // Act: request history explicitly.
    await page.getByRole("tab", { name: "All generations" }).click();

    // Assert: server order is retained in the browser: exception precedes success.
    await expect(page.getByRole("button", { name: "Xem generation e2e-success-run" })).toBeVisible();
    const orderedIds = await page.locator(".gen-row").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("aria-label")),
    );
    expect(orderedIds).toEqual([
      "Xem generation e2e-attention-run",
      "Xem generation e2e-success-run",
    ]);
  });
});
