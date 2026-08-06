import { describe, expect, it } from "vitest";
import { QaChangeSnapshots } from "@/collections/QaChangeSnapshots";
import { QaTestResults } from "@/collections/QaTestResults";
import { QaTestRuns } from "@/collections/QaTestRuns";

const collections = [QaTestRuns, QaTestResults, QaChangeSnapshots];

describe("[TC-F40-02-07] QA collection write boundary", () => {
  it("denies direct create, update and delete regardless of caller role", () => {
    // Arrange
    const args = { req: { user: { roles: ["super-admin"] } } } as never;

    // Act / Assert
    for (const collection of collections) {
      expect(collection.access?.create?.(args)).toBe(false);
      expect(collection.access?.update?.(args)).toBe(false);
      expect(collection.access?.delete?.(args)).toBe(false);
    }
  });
});
