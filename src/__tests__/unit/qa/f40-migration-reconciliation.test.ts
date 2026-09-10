import { afterEach, describe, expect, it } from "vitest";
import {
  createDemoReconciliationSnapshot,
  createUnverifiedReconciliationSnapshot,
  getReconciliationSnapshot,
  registerMigrationEvidenceProvider,
  sanitizeReconciliationSnapshot,
} from "@/lib/admin/qa/migration-reconciliation";

afterEach(() => registerMigrationEvidenceProvider(null));

describe("[TC-F40-14-01][TC-F40-14-03] Migration reconciliation evidence boundary", () => {
  it("TC-F40-14-01: returns an explicit unverified snapshot when mapping evidence is unavailable", () => {
    // Arrange
    const now = new Date("2026-09-10T03:00:00.000Z");

    // Act
    const snapshot = createUnverifiedReconciliationSnapshot({
      scope: "commerce",
      storeId: "SITE-0205",
      now,
    });

    // Assert
    expect(snapshot.evidence.available).toBe(false);
    expect(snapshot.summary.match).toBe(0);
    expect(snapshot.summary.unverified).toBe(0);
    expect(snapshot.records).toEqual([]);
    expect(snapshot.generatedAt).toBe("2026-09-10T03:00:00.000Z");
  });

  it("TC-F40-14-03: delegates only to an explicitly registered evidence provider", async () => {
    // Arrange
    registerMigrationEvidenceProvider({
      getSnapshot: async ({ scope, storeId }) => ({
        scope,
        storeId,
        generatedAt: "2026-09-10T03:00:00.000Z",
        evidence: { available: true, mode: "verified", contractVersion: "v1", message: "Evidence verified" },
        summary: { pw1Total: 1, pw2Total: 1, match: 1, missing: 0, mismatch: 0, duplicate: 0, unsupported: 0, unverified: 0 },
        records: [],
      }),
    });

    // Act
    const snapshot = await getReconciliationSnapshot({ scope: "settings", storeId: "SITE-0205" });

    // Assert
    expect(snapshot.evidence.contractVersion).toBe("v1");
    expect(snapshot.summary.match).toBe(1);

  });

  it("TC-F40-14-01: marks demo fixtures as non-evidence while exposing every result state for UI review", () => {
    // Arrange
    const now = new Date("2026-09-10T03:00:00.000Z");

    // Act
    const snapshot = createDemoReconciliationSnapshot({ scope: "commerce", storeId: "SITE-0205", now });

    // Assert
    expect(snapshot.evidence.mode).toBe("demo");
    expect(snapshot.evidence.available).toBe(false);
    expect(snapshot.records.map((record) => record.status)).toEqual([
      "match",
      "missing",
      "mismatch",
      "duplicate",
      "unverified",
    ]);
  });

  it("TC-F40-14-01: masks PII and removes credential fields from adapter output", () => {
    // Arrange
    const snapshot = createDemoReconciliationSnapshot({ scope: "commerce", storeId: "SITE-0205" });
    snapshot.records = [{
      sourceEntity: "customers",
      sourceId: "PW1-CUS-001",
      targetCollection: "customers",
      targetId: "PW2-CUS-001",
      label: "Mai Example",
      status: "match",
      reason: "Adapter-provided free text must not be returned.",
      fields: [
        { label: "Email", sourceKey: "customers.email", pw1: "mai@example.test", pw2: "mai@example.test", status: "match" },
        { label: "Password", sourceKey: "users.password", pw1: "super-secret", pw2: "super-secret", status: "match" },
      ],
    }];

    // Act
    const sanitized = sanitizeReconciliationSnapshot(snapshot);

    // Assert
    expect(sanitized.records[0].label).toBe("Bản ghi cá nhân đã che dữ liệu");
    expect(sanitized.records[0].reason).not.toContain("Adapter-provided");
    expect(sanitized.records[0].fields).toEqual([
      expect.objectContaining({ label: "Email", pw1: "m***@example.test", pw2: "m***@example.test" }),
    ]);
  });
});
