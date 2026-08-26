import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import {
  getManualRunPreflight,
  parseManualRunContext,
  validateManualIdempotencyKey,
} from "@/lib/admin/qa/manual-runs";
import {
  getManualQaProfileAvailability,
  resolveManualQaPack,
} from "@/lib/admin/qa/targeted-smoke-registry";

describe("[TC-F40-07-01] Manual targeted pack contract", () => {
  it("returns the approved Smoke pack but blocks unregistered Regression", () => {
    // Arrange / Act
    const smoke = resolveManualQaPack("editor-productgrid-variants", "smoke");
    const regression = resolveManualQaPack(
      "editor-productgrid-variants",
      "regression",
    );

    // Assert
    expect(smoke?.pack.packId).toBe("editor-product-grid-variants-smoke");
    expect(smoke?.profile.testCases.map((testCase) => testCase.id)).toEqual([
      "TC-F40-04-02",
    ]);
    expect(regression).toBeUndefined();
    expect(
      getManualQaProfileAvailability("editor-productgrid-variants"),
    ).toEqual({ smoke: true, regression: false });
  });

  it("requires paired immutable PR/SHA context and bounded idempotency key", () => {
    // Arrange / Act / Assert
    expect(() => parseManualRunContext({ pullRequest: 1746 })).toThrow(
      "PR and immutable SHA",
    );
    expect(() =>
      parseManualRunContext({ pullRequest: 1746, commitSha: "not-a-sha" }),
    ).toThrow("PR and immutable SHA");
    expect(
      parseManualRunContext({ pullRequest: 1746, commitSha: "abcdef1" }),
    ).toEqual({ pullRequest: 1746, commitSha: "abcdef1" });
    expect(validateManualIdempotencyKey("a".repeat(16))).toBe("a".repeat(16));
    expect(() => validateManualIdempotencyKey("short")).toThrow(
      "Invalid idempotency key",
    );
  });
});

describe("[TC-F40-08-04] Manual preflight coverage gate", () => {
  it("blocks an uncertified profile and returns its safe recovery guidance", async () => {
    // Arrange
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({
          docs: [{ pullRequest: 1772, commitSha: "abcdef1" }],
        })
        .mockResolvedValueOnce({
          docs: [],
        }),
    } as unknown as Payload;

    // Act
    const preflight = await getManualRunPreflight(payload, {
      targetId: "identity-login-otp",
      profile: "regression",
      context: { pullRequest: 1772, commitSha: "abcdef1" },
    });

    // Assert
    expect(preflight.canDispatch).toBe(false);
    expect(preflight.reasons).toEqual([
      {
        code: "NO_ACTIVE_PACK",
        recovery:
          "Có contract test đã được QA phê duyệt cho Staging (QC).",
      },
    ]);
    expect(preflight.context).toEqual({ pullRequest: 1772, commitSha: "abcdef1" });
    expect(preflight.target?.certification).toEqual({
      state: "certified_executable",
      owner: "qa-auth-team",
      recovery:
        "Có contract test đã được QA phê duyệt cho Staging (QC).",
      allowedProfiles: ["smoke"],
    });
    expect(preflight.pack).toBeUndefined();
    expect(payload.find).toHaveBeenCalledTimes(2);
  });
});
