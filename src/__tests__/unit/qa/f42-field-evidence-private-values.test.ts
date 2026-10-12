import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ db: { drizzle: { execute: mocks.execute } } })) }));
vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("@/lib/admin/qa/f42-source-readiness", () => ({ isF42SchemaReady: vi.fn(async () => true) }));
vi.mock("@/lib/admin/qa/website-migration-catalog", () => ({
  readWebsiteCatalogScope: vi.fn(async () => ({ sourceInstance: "pw1", targetInstance: "pw2" })),
}));

import { readRecordFieldEvidence } from "@/lib/admin/qa/f42-field-evidence-reader";

const RUN = "3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db";
const GEN = "46dcd066-6319-484c-9235-6c23a7acfb8c";
const base = { entity: "orders", sourceId: "1", targetField: null, elementKey: "secret-fingerprint",
  sourcePresence: "value", status: "match", reason: "OK", transform: "none", disposition: "mapped", targetId: "9" };

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.execute
    .mockResolvedValueOnce({ rows: [{ generationId: GEN, snapshotId: GEN, sourceSnapshotAt: null, verifiedAt: "2026-10-01", digest: "d" }] })
    .mockResolvedValueOnce({ rows: [{ present: true }] })
    .mockResolvedValueOnce({ rows: [{ status: "match", total: 2 }] })
    .mockResolvedValueOnce({ rows: [
      { ...base, sourceField: "code", source: "ORD-PRIVATE-1", target: "ORD-PRIVATE-1" },
      { ...base, sourceField: "status", source: "paid", target: "paid" },
    ] });
});

describe("[TC-F40-14-07] record field evidence never returns private display values", () => {
  it("nulls source and target for private keys, keeps reviewed keys and hides element keys", async () => {
    // Arrange / Act
    const result = await readRecordFieldEvidence({
      storeId: "205", runId: RUN, entity: "orders", sourceId: "1", targetIds: ["9"], page: 1, status: "all",
    });

    // Assert
    const code = result.rows.find(row => row.key === "orders.code")!;
    const status = result.rows.find(row => row.key === "orders.status")!;
    expect(code.displayAllowed).toBe(false);
    expect(code.source).toBeNull();
    expect(code.target).toBeNull();
    expect(status.displayAllowed).toBe(true);
    expect(status.source).toBe("paid");
    expect(JSON.stringify(result)).not.toContain("ORD-PRIVATE-1");
    expect(JSON.stringify(result)).not.toContain("secret-fingerprint");
  });
});
