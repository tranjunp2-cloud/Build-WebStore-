import { describe, expect, it } from "vitest";
import {
  assertQaFindingTransition,
  canVerifyQaFinding,
  createQaFindingFingerprint,
  lifecycleForQaFindingFailure,
  qaFindingMarker,
} from "@/lib/admin/qa/findings";

const identity = {
  targetId: "editor-productgrid-variants",
  suite: "editor-product-grid-variants-smoke",
  testCaseId: "TC-F40-04-02",
  assertionCode: "VARIANT_COUNT_MISMATCH",
};

describe("[TC-F40-06-01] QA finding identity and deduplication key", () => {
  it("creates one stable fingerprint for repeated deliveries of the same product failure", () => {
    // Arrange
    const retry = { ...identity };

    // Act
    const first = createQaFindingFingerprint(identity);
    const repeated = createQaFindingFingerprint(retry);

    // Assert
    expect(first).toBe(repeated);
    expect(first).toMatch(/^qaf_v1_[a-f0-9]{64}$/);
  });

  it("changes the fingerprint when the assertion identity changes and excludes volatile evidence", () => {
    // Arrange
    const differentAssertion = { ...identity, assertionCode: "VISUAL_THRESHOLD_EXCEEDED" };

    // Act
    const original = createQaFindingFingerprint(identity);
    const changed = createQaFindingFingerprint(differentAssertion);

    // Assert
    expect(changed).not.toBe(original);
    expect(() => createQaFindingFingerprint({ ...identity, targetId: "target with spaces" })).toThrow();
  });
});

describe("[TC-F40-06-02] QA finding verification and recurrence lifecycle", () => {
  it("permits an active finding to move through GitHub creation to verified fix", () => {
    // Arrange

    // Act
    const verificationEligible = canVerifyQaFinding("github_created");
    const transition = () => {
      assertQaFindingTransition("needs_review", "promoting");
      assertQaFindingTransition("promoting", "github_created");
      assertQaFindingTransition("github_created", "verify_fix");
    };

    // Assert
    expect(verificationEligible).toBe(true);
    expect(transition).not.toThrow();
    expect(canVerifyQaFinding("verify_fix")).toBe(false);
  });

  it("reopens a verified finding for review while preserving active promotion state", () => {
    // Arrange

    // Act
    const reopened = lifecycleForQaFindingFailure("verify_fix");
    const stillPromoted = lifecycleForQaFindingFailure("github_created");

    // Assert
    expect(reopened).toBe("needs_review");
    expect(stillPromoted).toBe("github_created");
    expect(() => assertQaFindingTransition("verify_fix", "github_created")).toThrow(
      "Invalid QA finding lifecycle transition",
    );
  });

  it("creates a deterministic GitHub idempotency marker from a finding identity", () => {
    // Arrange
    const fingerprint = createQaFindingFingerprint(identity);

    // Act
    const marker = qaFindingMarker(42, fingerprint);

    // Assert
    expect(marker).toBe(`qa-finding:42:${fingerprint}`);
    expect(() => qaFindingMarker(42, "untrusted")).toThrow("Invalid QA finding fingerprint");
  });
});
