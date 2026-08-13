import { expect, test } from "@playwright/test";

interface FixtureResponse {
  data?: { findingId?: number | string };
}

test.describe("F40 finding review and GitHub promotion", () => {
  test("[TC-F40-06-05] reviewer cancels safely, then confirms exactly one GitHub promotion", async ({
    page,
  }) => {
    // Arrange: server-owned fixture contains only deterministic, approved test evidence.
    const fixtureResponse = await page.request.post(
      "/api/e2e/qa-control-center-fixture",
    );
    expect(fixtureResponse.ok()).toBe(true);
    const fixture = (await fixtureResponse.json()) as FixtureResponse;
    const findingId = fixture.data?.findingId;
    expect(findingId).toBeTruthy();

    let promotionCalls = 0;
    await page.route("**/api/admin/qa/findings", async (route) => {
      if (promotionCalls === 0) return route.continue();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [
              {
                id: String(findingId),
                fingerprint: "e2e-finding",
                targetId: "editor-productgrid-variants",
                lifecycle: "github_created",
                severity: "P1",
                testCaseId: "TC-F40-04-02",
                githubIssue: {
                  issueNumber: 1745,
                  url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1745",
                  title: "E2E finding",
                },
              },
            ],
          },
        }),
      });
    });
    await page.route(
      `**/api/admin/qa/findings/${findingId}/promote`,
      async (route) => {
        promotionCalls += 1;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: String(findingId),
              fingerprint: "e2e-finding",
              targetId: "editor-productgrid-variants",
              lifecycle: "github_created",
              severity: "P1",
              testCaseId: "TC-F40-04-02",
              githubIssue: {
                issueNumber: 1745,
                url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1745",
                title: "E2E finding",
              },
            },
          }),
        });
      },
    );

    // Act: opening the confirmation and cancelling it must remain side-effect free.
    await page.goto("/studio/qa?tab=findings");
    await expect(
      page.getByTestId(`qa-open-finding-${findingId}`),
    ).toBeVisible();
    await page.getByTestId(`qa-open-finding-${findingId}`).click();
    await page.getByTestId("qa-finding-open-promotion").click();
    await expect(
      page.getByTestId("qa-finding-promotion-confirmation"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hủy" }).click();

    // Assert: cancel did not call the protected create endpoint.
    expect(promotionCalls).toBe(0);

    // Act: a separate explicit confirmation sends one request.
    await page.getByTestId("qa-finding-open-promotion").click();
    await page.getByTestId("qa-finding-confirm-promotion").click();

    // Assert: one request and the canonical post-reload DTO expose the link.
    await expect.poll(() => promotionCalls).toBe(1);
    await expect(page.getByText("GitHub #1745")).toBeVisible();
  });
});
