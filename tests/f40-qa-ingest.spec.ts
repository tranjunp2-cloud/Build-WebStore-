import crypto from "crypto";
import { expect, test } from "@playwright/test";

test.describe("F40 QA ingest security boundary", () => {
  test("[TC-F40-02-E2E-01] rejects an unsigned CI summary before persistence", async ({
    request,
  }) => {
    // Arrange
    const summary = {
      workflowRunId: "e2e-unsigned",
      attempt: 1,
      targetId: "editor.product-grid",
      suite: "smoke",
      profile: "smoke",
      environment: "staging",
      commitSha: "abcdef1",
      startedAt: "2026-08-06T01:00:00.000Z",
      finishedAt: "2026-08-06T01:01:00.000Z",
      summary: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
      results: [{ testCaseId: "TC-F40-02-E2E-01", status: "passed" }],
    };

    // Act
    const response = await request.post("/api/admin/qa/ingest", {
      data: summary,
    });

    // Assert
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

test.describe("F40 QA ingest summary", () => {
  test("[TC-F40-02-E2E-02] lists a signed staging run after ingestion", async ({
    browser,
    request,
  }) => {
    if (!process.env.QA_INGEST_SECRET) {
      if (process.env.CI)
        throw new Error(
          "QA_INGEST_SECRET must be configured for the staging ingestion project",
        );
      test.skip(
        true,
        "QA ingestion secret is required for this protected staging flow",
      );
    }
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      if (process.env.CI)
        throw new Error(
          "ADMIN_EMAIL and ADMIN_PASSWORD must be configured to verify the protected QA summary",
        );
      test.skip(
        true,
        "A super-admin account is required to verify the protected QA summary",
      );
    }

    // Arrange
    const now = new Date();
    const body = {
      workflowRunId: `e2e-${Date.now()}`,
      attempt: 1,
      targetId: "editor.product-grid",
      suite: "smoke",
      profile: "smoke",
      environment: "staging",
      commitSha: "abcdef1",
      startedAt: now.toISOString(),
      finishedAt: new Date(now.getTime() + 1_000).toISOString(),
      summary: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
      results: [{ testCaseId: "TC-F40-02-E2E-02", status: "passed" }],
    };
    const raw = JSON.stringify(body);
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac("sha256", process.env.QA_INGEST_SECRET as string)
      .update(`${timestamp}.${raw}`)
      .digest("hex");

    // Act
    const ingest = await request.post("/api/admin/qa/ingest", {
      data: raw,
      headers: {
        "Content-Type": "application/json",
        "x-qa-timestamp": timestamp,
        "x-qa-signature": `sha256=${signature}`,
      },
    });
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin");
    const emailInput = adminPage.locator(
      'input[name="email"], input[id="field-email"]',
    );
    await emailInput.fill(adminEmail);
    await adminPage
      .locator('input[name="password"], input[id="field-password"]')
      .fill(adminPassword);
    await adminPage.locator('button[type="submit"]').click();
    await adminPage.waitForLoadState("networkidle");
    const listed = await adminPage.request.get(
      `/api/admin/qa/runs?targetId=${body.targetId}`,
    );
    const result = await listed.json();

    // Assert
    expect(ingest.ok(), await ingest.text()).toBe(true);
    expect(listed.ok(), await listed.text()).toBe(true);
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowRunId: body.workflowRunId,
          targetId: body.targetId,
        }),
      ]),
    );
    await adminContext.close();
  });
});
