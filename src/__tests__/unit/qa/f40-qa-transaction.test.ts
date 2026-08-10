import { describe, expect, it, vi } from "vitest";
import { withQaIngestTransaction } from "@/lib/payload/qa-ingest-transaction";
import { withQaTargetedDispatchTransaction } from "@/lib/payload/qa-targeted-dispatch-transaction";

describe("[TC-F40-02-08] QA ingest transaction cleanup", () => {
  it("rethrows a write failure and always removes the transaction session", async () => {
    // Arrange
    const transaction = vi.fn(async (operation) =>
      operation({ execute: vi.fn() }),
    );
    const payload = {
      db: { drizzle: { transaction }, sessions: {} },
    };

    // Act / Assert
    await expect(
      withQaIngestTransaction(payload as never, async () => {
        throw new Error("result insert failed");
      }),
    ).rejects.toThrow("result insert failed");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(payload.db.sessions).toEqual({});
  });
});

describe("[TC-F40-03-02] Targeted Smoke transaction lock", () => {
  it("takes a fixture-scoped transaction lock and removes the session", async () => {
    // Arrange
    const execute = vi.fn();
    const transaction = vi.fn(async (operation) => operation({ execute }));
    const payload = { db: { drizzle: { transaction }, sessions: {} } };

    // Act
    await withQaTargetedDispatchTransaction(
      payload as never,
      "staging",
      "smoke-product-variants",
      async () => "claimed",
    );

    // Assert
    expect(execute).toHaveBeenCalledTimes(1);
    expect(payload.db.sessions).toEqual({});
  });
});
