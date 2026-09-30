import { describe, expect, it } from "vitest";
import {
  F42_LEDGER_CONTRACT_VERSION,
  createF42LedgerEvidenceProvider,
  type F42LedgerReadResult,
} from "@/lib/admin/qa/f42-ledger-evidence-provider";

const RUN_ID = "3f5f32ef-5385-4b46-9b4e-7a7c13f5c5db";

function verifiedLedger(overrides: Partial<F42LedgerReadResult> = {}): F42LedgerReadResult {
  return {
    run: {
      run_id: RUN_ID,
      source_store_id: "205",
      run_state: "VERIFIED",
      import_store_state: "VERIFIED",
      updated_at: "2026-09-30T03:00:00.000Z",
    },
    maps: [{
      source_entity: "products",
      source_id: "451",
      target_collection: "products",
      target_id: "712",
      action: "CREATE",
      state: "VERIFIED",
      claim_active: true,
      mapping_confirmed: true,
      has_open_exception: false,
    }],
    exceptions: [],
    ...overrides,
  };
}

describe("[TC-F40-14-01][TC-F40-14-03] F42 ledger evidence provider", () => {
  it("TC-F40-14-03: exposes only an explicitly selected, verified F42 run", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger());

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
    });

    // Assert
    expect(snapshot.evidence).toMatchObject({
      available: true,
      mode: "verified",
      contractVersion: F42_LEDGER_CONTRACT_VERSION,
    });
    expect(snapshot.records).toEqual([expect.objectContaining({
      sourceEntity: "products",
      targetCollection: "products",
      targetIds: ["712"],
      status: "match",
      fields: [],
    })]);
  });

  it("TC-F40-14-01: fails closed when the F42 run or store is not verified", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger({
      run: {
        run_id: RUN_ID,
        source_store_id: "205",
        run_state: "VERIFYING",
        import_store_state: "APPLYING",
        updated_at: "2026-09-30T03:00:00.000Z",
      },
    }));

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
    });

    // Assert
    expect(snapshot.evidence.available).toBe(false);
    expect(snapshot.records).toEqual([]);
  });

  it("TC-F40-14-01: never certifies a map with an open exception or unconfirmed reuse", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger({
      maps: [{
        source_entity: "products",
        source_id: "451",
        target_collection: "products",
        target_id: "712",
        action: "SKIP",
        state: "SKIPPED",
        claim_active: false,
        mapping_confirmed: false,
        has_open_exception: true,
      }],
    }));

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
    });

    // Assert
    expect(snapshot.records).toEqual([expect.objectContaining({
      status: "unverified",
      targetCollection: null,
      targetIds: [],
    })]);
    expect(snapshot.summary.unverified).toBe(1);
  });

  it("TC-F40-14-01: keeps an F42 blocked map without a target visible as unverified", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger({
      maps: [{
        source_entity: "products",
        source_id: "451",
        target_collection: null,
        target_id: null,
        action: "BLOCK",
        state: "FAILED",
        claim_active: false,
        mapping_confirmed: false,
        has_open_exception: false,
      }],
    }));

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
    });

    // Assert
    expect(snapshot.records).toEqual([expect.objectContaining({
      sourceEntity: "products",
      status: "unverified",
      targetIds: [],
    })]);
  });

  it("TC-F40-14-01: fails closed when F42 has an open run-level exception", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger({
      exceptions: [{ source_entity: "products", source_id: null, state: "OPEN" }],
    }));

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
    });

    // Assert
    expect(snapshot.evidence.available).toBe(false);
    expect(snapshot.records).toEqual([]);
  });

  it("TC-F40-14-01: fails closed instead of certifying a truncated ledger result", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger({ truncated: true }));

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: RUN_ID,
    });

    // Assert
    expect(snapshot.evidence.available).toBe(false);
    expect(snapshot.records).toEqual([]);
  });

  it("TC-F40-14-03: allows QA for a verified child run while its broader batch is still progressing", async () => {
    // Arrange
    const provider = createF42LedgerEvidenceProvider(async () => verifiedLedger({
      run: { ...verifiedLedger().run!, run_state: "VERIFIED", import_store_state: "VERIFIED" },
    }));

    // Act
    const snapshot = await provider.getSnapshot({ scope: "commerce", storeId: "205", runId: RUN_ID });

    // Assert
    expect(snapshot.evidence.available).toBe(true);
    expect(snapshot.records).toHaveLength(1);
  });

  it("TC-F40-14-01: fails closed when the ledger database times out", async () => {
    // Arrange
    const timeout = Object.assign(new Error("database timeout"), { code: "ETIMEDOUT" });
    const provider = createF42LedgerEvidenceProvider(async () => { throw timeout; });

    // Act
    const snapshot = await provider.getSnapshot({ scope: "commerce", storeId: "205", runId: RUN_ID });

    // Assert
    expect(snapshot.evidence.available).toBe(false);
    expect(snapshot.records).toEqual([]);
  });

  it("TC-F40-14-01: refuses to query a missing or malformed run selection", async () => {
    // Arrange
    let calls = 0;
    const provider = createF42LedgerEvidenceProvider(async () => {
      calls += 1;
      return verifiedLedger();
    });

    // Act
    const snapshot = await provider.getSnapshot({
      scope: "commerce",
      storeId: "205",
      runId: "latest",
    });

    // Assert
    expect(calls).toBe(0);
    expect(snapshot.evidence.available).toBe(false);
  });
});
