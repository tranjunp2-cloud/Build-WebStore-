import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconciliationRecordReference } from "@/lib/admin/qa/reconciliation-record-reference";
import { clearRecordReferenceCache, indexRecordReferences, lookupRecordReference } from "@/lib/admin/qa/record-reference-resolver";

const RUN = "3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db";
const OTHER_RUN = "46dcd066-6319-484c-9235-6c23a7acfb8c";
const record = { sourceEntity: "products", sourceId: "41603" } as const;
const original = process.env.PAYLOAD_SECRET;

beforeEach(() => {
  process.env.PAYLOAD_SECRET = "unit-test-secret";
  clearRecordReferenceCache();
});
afterEach(() => {
  if (original === undefined) delete process.env.PAYLOAD_SECRET; else process.env.PAYLOAD_SECRET = original;
});

describe("[TC-F40-14-07] record reference is an HMAC bound to Store, run, entity and id", () => {
  it("is stable for the same input and 32 hex characters", () => {
    // Arrange / Act
    const a = reconciliationRecordReference({ storeId: "205", runId: RUN, record });
    const b = reconciliationRecordReference({ storeId: "205", runId: RUN, record });

    // Assert
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("changes when Store, run, entity or source id changes", () => {
    // Arrange
    const base = reconciliationRecordReference({ storeId: "205", runId: RUN, record });

    // Act
    const variants = [
      reconciliationRecordReference({ storeId: "206", runId: RUN, record }),
      reconciliationRecordReference({ storeId: "205", runId: OTHER_RUN, record }),
      reconciliationRecordReference({ storeId: "205", runId: RUN, record: { ...record, sourceEntity: "orders" } }),
      reconciliationRecordReference({ storeId: "205", runId: RUN, record: { ...record, sourceId: "41604" } }),
    ];

    // Assert
    for (const variant of variants) expect(variant).not.toBe(base);
  });

  it("changes with the secret and refuses to run without one", () => {
    // Arrange
    const base = reconciliationRecordReference({ storeId: "205", runId: RUN, record });

    // Act
    process.env.PAYLOAD_SECRET = "another-secret";
    const rotated = reconciliationRecordReference({ storeId: "205", runId: RUN, record });
    delete process.env.PAYLOAD_SECRET;

    // Assert
    expect(rotated).not.toBe(base);
    expect(() => reconciliationRecordReference({ storeId: "205", runId: RUN, record })).toThrow();
  });
});

describe("[TC-F40-14-07] reference index is scoped to one Store and run", () => {
  const records = [{ ...record, targetIds: ["9"] }] as never;

  it("reports no index until one is built, then resolves only references of that Store and run", () => {
    // Arrange
    const ref = reconciliationRecordReference({ storeId: "205", runId: RUN, record });
    expect(lookupRecordReference("205", RUN, ref)).toBeUndefined();

    // Act
    indexRecordReferences("205", RUN, records);

    // Assert
    expect(lookupRecordReference("205", RUN, ref)?.sourceId).toBe("41603");
    expect(lookupRecordReference("205", RUN, "f".repeat(32))).toBeNull();
    expect(lookupRecordReference("206", RUN, ref)).toBeUndefined();
    expect(lookupRecordReference("205", OTHER_RUN, ref)).toBeUndefined();
  });

  it("expires the index so a rebuilt ledger is re-read", () => {
    // Arrange
    const ref = reconciliationRecordReference({ storeId: "205", runId: RUN, record });
    indexRecordReferences("205", RUN, records, 1_000);

    // Act / Assert
    expect(lookupRecordReference("205", RUN, ref, 1_000 + 59_000)).not.toBeUndefined();
    expect(lookupRecordReference("205", RUN, ref, 1_000 + 61_000)).toBeUndefined();
  });
});
