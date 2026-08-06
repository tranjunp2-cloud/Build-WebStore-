import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  QaRunSummarySchema,
  deriveQaRunStatus,
  hasApprovedArtifactUrl,
  verifyQaIngestSignature,
} from "@/lib/admin/qa/contracts";

// ── TC-F40-02-04: contract safety boundaries ────────────────────────────────
describe("[TC-F40-02-04] QA run summary contract", () => {
  it("rejects duplicate testcase IDs, raw text, and missing assertion code on failure", () => {
    // Arrange
    const payload = {
      workflowRunId: "run-1",
      attempt: 1,
      targetId: "editor.product-grid",
      suite: "smoke",
      profile: "smoke",
      environment: "staging",
      commitSha: "abcdef1",
      startedAt: "2026-08-06T01:00:00.000Z",
      finishedAt: "2026-08-06T01:01:00.000Z",
      summary: { passed: 0, failed: 2, skipped: 0, blocked: 0 },
      results: [
        {
          testCaseId: "TC-F40-02-01",
          status: "failed",
          message: '{"cookies":["secret"]}',
        },
        { testCaseId: "TC-F40-02-01", status: "failed" },
      ],
    };

    // Act
    const result = QaRunSummarySchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it("derives a failed run from a failed testcase instead of trusting client status", () => {
    // Arrange / Act / Assert
    expect(
      deriveQaRunStatus([
        { testCaseId: "TC-1", status: "failed", assertionCode: "HTTP_500" },
      ]),
    ).toBe("failed");
    expect(deriveQaRunStatus([{ testCaseId: "TC-1", status: "skipped" }])).toBe(
      "cancelled",
    );
  });

  it("accepts Next.js route-group and dynamic paths in an immutable change snapshot", () => {
    // Arrange
    const payload = {
      workflowRunId: "run-paths",
      attempt: 1,
      targetId: "orders.shipping",
      suite: "smoke",
      profile: "smoke",
      environment: "staging",
      pullRequest: 1741,
      commitSha: "abcdef1",
      startedAt: "2026-08-06T01:00:00.000Z",
      finishedAt: "2026-08-06T01:01:00.000Z",
      summary: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
      results: [{ testCaseId: "TC-F40-02-04", status: "passed" }],
      changeSnapshot: {
        pullRequest: 1741,
        commitSha: "abcdef1",
        environment: "staging",
        changedPaths: ["src/app/(dashboard)/orders/[id]/page.tsx"],
        mappedTargetIds: ["orders.shipping"],
        unmappedPaths: [],
        coverageMapVersion: "v1",
      },
    };

    // Act
    const result = QaRunSummarySchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(true);
  });

  it("verifies exact raw body HMAC and a bound, approved artifact reference", () => {
    // Arrange
    const secret = "test-secret";
    const timestamp = "1785978000000";
    const body = '{"workflowRunId":"run-1"}';
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    const expiry = "2026-08-06T02:00:00.000Z";

    // Act / Assert
    expect(
      verifyQaIngestSignature(
        body,
        `sha256=${signature}`,
        timestamp,
        secret,
        Number(timestamp),
      ),
    ).toBe(true);
    expect(
      hasApprovedArtifactUrl(
        `https://artifacts.example.com/sanitized/runs/123?expiresAt=${encodeURIComponent(expiry)}`,
        ["artifacts.example.com"],
        expiry,
        Date.parse("2026-08-06T01:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      hasApprovedArtifactUrl(
        `https://artifacts.example.com/sanitized/runs/123?expiresAt=2099-01-01T00%3A00%3A00.000Z`,
        ["artifacts.example.com"],
        expiry,
        Date.parse("2026-08-06T01:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
