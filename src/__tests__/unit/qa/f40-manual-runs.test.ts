import { describe, expect, it } from "vitest";
import {
  parseManualRunContext,
  validateManualIdempotencyKey,
} from "@/lib/admin/qa/manual-runs";
import { resolveManualQaPack } from "@/lib/admin/qa/targeted-smoke-registry";

describe("[TC-F40-07-01] Manual targeted pack contract", () => {
  it("returns the approved Smoke pack but blocks unregistered Regression", () => {
    // Arrange / Act
    const smoke = resolveManualQaPack("editor-productgrid-variants", "smoke");
    const regression = resolveManualQaPack("editor-productgrid-variants", "regression");

    // Assert
    expect(smoke?.pack.packId).toBe("editor-product-grid-variants-smoke");
    expect(smoke?.profile.testCases.map((testCase) => testCase.id)).toEqual(["TC-F40-04-02"]);
    expect(regression).toBeUndefined();
  });

  it("requires paired immutable PR/SHA context and bounded idempotency key", () => {
    // Arrange / Act / Assert
    expect(() => parseManualRunContext({ pullRequest: 1746 })).toThrow("PR and immutable SHA");
    expect(() => parseManualRunContext({ pullRequest: 1746, commitSha: "not-a-sha" })).toThrow("PR and immutable SHA");
    expect(parseManualRunContext({ pullRequest: 1746, commitSha: "abcdef1" })).toEqual({ pullRequest: 1746, commitSha: "abcdef1" });
    expect(validateManualIdempotencyKey("a".repeat(16))).toBe("a".repeat(16));
    expect(() => validateManualIdempotencyKey("short")).toThrow("Invalid idempotency key");
  });
});
