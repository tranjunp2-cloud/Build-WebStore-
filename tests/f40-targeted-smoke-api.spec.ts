import { expect, test } from "@playwright/test";

test.describe("F40 targeted Smoke API boundaries", () => {
  test("[TC-F40-03-E2E-01] rejects unsigned deploy dispatches before a fixture lease can be claimed", async ({ request }) => {
    // Arrange
    const deploy = {
      pullRequest: 1742,
      commitSha: "abcdef1",
      environment: "staging",
      changedPaths: ["src/app/products/page.tsx"],
    };

    // Act
    const response = await request.post("/api/internal/qa/targeted-dispatch", { data: deploy });

    // Assert
    expect([401, 503]).toContain(response.status());
    if (response.status() === 401) await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  test("[TC-F40-03-E2E-02] rejects an unclaimed workflow and an invalid evidence signature", async ({ request }) => {
    // Arrange / Act
    const start = await request.post("/api/admin/qa/targeted-start", {
      data: { dispatchId: 1, workflowNonce: "a".repeat(32), workflowRunId: "forged-run", attempt: 1 },
    });
    const evidence = await request.get("/api/admin/qa/evidence/1?expiresAt=2099-01-01T00%3A00%3A00.000Z&signature=deadbeef");

    // Assert
    expect([401, 503]).toContain(start.status());
    expect(evidence.status()).toBe(401);
  });

  test("[TC-F40-03-E2E-03] rejects an unauthorised reconciliation request", async ({ request }) => {
    // Arrange / Act
    const response = await request.get("/api/cron/reconcile-qa-targeted-smoke");

    // Assert
    expect(response.status()).toBe(401);
  });
});
