import { describe, expect, it } from "vitest";
import {
  createQaEvidenceUrl,
  isApprovedQaEvidenceUrl,
  verifyQaEvidenceLink,
} from "@/lib/admin/qa/safe-evidence";

describe("[TC-F40-03-03] Targeted Smoke safe evidence links", () => {
  it("creates a signed, expiring run-evidence URL", () => {
    // Arrange
    const now = Date.parse("2026-08-10T00:00:00.000Z");

    // Act
    const evidence = createQaEvidenceUrl(42, "https://staging.example.test", "test-secret", now);
    const url = new URL(evidence.url);

    // Assert
    expect(url.pathname).toBe("/api/admin/qa/evidence/42");
    expect(verifyQaEvidenceLink("42", evidence.expiresAt, url.searchParams.get("signature"), "test-secret", now)).toBe(true);
  });

  it("rejects an expired or modified signed evidence URL", () => {
    // Arrange
    const now = Date.parse("2026-08-10T00:00:00.000Z");
    const evidence = createQaEvidenceUrl(42, "https://staging.example.test", "test-secret", now);
    const signature = new URL(evidence.url).searchParams.get("signature");

    // Act / Assert
    expect(verifyQaEvidenceLink("43", evidence.expiresAt, signature, "test-secret", now)).toBe(false);
    expect(verifyQaEvidenceLink("42", evidence.expiresAt, signature, "test-secret", Date.parse("2026-08-12T00:00:00.000Z"))).toBe(false);
  });

  it("recognises a generated internal evidence link as safe for Feature Detail", () => {
    // Arrange
    const now = Date.parse("2026-08-10T00:00:00.000Z");
    const evidence = createQaEvidenceUrl(42, "https://staging.example.test", "test-secret", now);

    // Act / Assert
    expect(
      isApprovedQaEvidenceUrl(
        evidence.url,
        evidence.expiresAt,
        "https://staging.example.test",
        "test-secret",
        now,
      ),
    ).toBe(true);
    expect(
      isApprovedQaEvidenceUrl(
        evidence.url.replace("/42", "/43"),
        evidence.expiresAt,
        "https://staging.example.test",
        "test-secret",
        now,
      ),
    ).toBe(false);
  });
});
