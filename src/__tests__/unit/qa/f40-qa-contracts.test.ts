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

  it("accepts route groups, dynamic segments, and tracked paths with spaces", () => {
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
        changedPaths: [
          "src/app/(dashboard)/orders/[id]/page.tsx",
          "docs/design/UX Audit/F01-UX-Audit.md",
        ],
        mappedTargetIds: ["orders.shipping"],
        unmappedPaths: ["docs/design/UX Audit/F01-UX-Audit.md"],
        coverageMapVersion: "v1",
      },
    };

    // Act
    const result = QaRunSummarySchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(true);
  });

  it("accepts only machine identifiers for persisted run fields", () => {
    // Arrange: this is the format emitted by GitHub Actions in the staging workflow.
    const payload = {
      workflowRunId: "123456789-2",
      attempt: 2,
      targetId: "cms.staging.e2e",
      suite: "staging-e2e",
      profile: "staging-e2e",
      environment: "staging",
      commitSha: "abcdef1",
      startedAt: "2026-08-06T01:00:00.000Z",
      finishedAt: "2026-08-06T01:01:00.000Z",
      summary: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
      results: [{ testCaseId: "TC-F40-02-04", status: "passed" }],
    };

    // Act / Assert: header-shaped free text must never become persisted metadata.
    expect(QaRunSummarySchema.safeParse(payload).success).toBe(true);
    for (const field of ["workflowRunId", "suite", "profile"] as const) {
      expect(
        QaRunSummarySchema.safeParse({
          ...payload,
          [field]: "Authorization:Bearer sensitive-token",
        }).success,
      ).toBe(false);
    }
  });

  it("accepts a failed terminal sentinel even when Playwright emitted no failed count", () => {
    // Arrange / Act: the workflow normalizes any non-success terminal outcome.
    const result = QaRunSummarySchema.safeParse({
      workflowRunId: "123456789-2",
      attempt: 2,
      targetId: "cms.staging.e2e",
      suite: "staging-e2e",
      profile: "staging-e2e",
      environment: "staging",
      commitSha: "abcdef1",
      startedAt: "2026-08-06T01:00:00.000Z",
      finishedAt: "2026-08-06T01:01:00.000Z",
      summary: { passed: 0, failed: 1, skipped: 0, blocked: 0 },
      results: [
        {
          testCaseId: "TC-F40-STAGING-E2E",
          status: "failed",
          assertionCode: "STAGING_E2E_TERMINAL_FAILURE",
        },
      ],
    });

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

  it("TC-F40-04-01: accepts complete safe visual evidence but rejects unsafe detail text", () => {
    // Arrange
    const expiry = new Date(Date.now() + 60 * 60_000).toISOString();
    const safeArtifact = (name: string) => ({
      url: `https://artifacts.example.com/sanitized/${name}?expiresAt=${encodeURIComponent(expiry)}`,
      expiresAt: expiry,
    });
    const payload = {
      workflowRunId: "visual-run-1",
      attempt: 1,
      targetId: "editor.product-grid.variants",
      suite: "visual",
      profile: "visual-regression",
      environment: "staging",
      commitSha: "abcdef1",
      startedAt: "2026-08-10T01:00:00.000Z",
      finishedAt: "2026-08-10T01:01:00.000Z",
      summary: { passed: 0, failed: 1, skipped: 0, blocked: 0 },
      results: [
        {
          testCaseId: "TC-F40-04-01",
          status: "failed",
          assertionCode: "VISUAL_THRESHOLD_EXCEEDED",
          fixtureReference: "QA-Tshirt-SML",
          expectedSummary: "Product grid keeps three visible variants",
          actualSummary: "Product grid renders one visible variant",
          classification: "product",
          evidenceKind: "screenshot",
          visualComparison: {
            baseline: safeArtifact("baseline"),
            current: safeArtifact("current"),
            diff: safeArtifact("diff"),
            thresholdPercent: 0.5,
            differencePercent: 1,
          },
        },
      ],
    };

    // Act
    const valid = QaRunSummarySchema.safeParse(payload);
    const unsafe = QaRunSummarySchema.safeParse({
      ...payload,
      results: [{ ...payload.results[0], actualSummary: "<script>alert(1)</script>" }],
    });

    // Assert
    expect(valid.success).toBe(true);
    expect(unsafe.success).toBe(false);
  });
});
