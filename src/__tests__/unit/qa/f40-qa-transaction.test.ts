import { describe, expect, it, vi } from "vitest";
import { withQaIngestTransaction } from "@/lib/payload/qa-ingest-transaction";

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
