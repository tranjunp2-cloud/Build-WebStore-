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
  it("returns both the approved Smoke and certified Regression packs", () => {
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
    expect(regression?.pack.packId).toBe("editor-product-grid-variants-smoke");
    expect(regression?.profile.testCases.map((testCase) => testCase.id)).toEqual([
      "TC-F40-04-02",
    ]);
    expect(
      getManualQaProfileAvailability("editor-productgrid-variants"),
    ).toEqual({ smoke: true, regression: true });
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
  it("blocks an uncertified profile or inactive target and returns safe recovery guidance", async () => {
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
      targetId: "unknown-inactive-target",
      profile: "regression",
      context: { pullRequest: 1772, commitSha: "abcdef1" },
    });

    // Assert
    expect(preflight.canDispatch).toBe(false);
    expect(preflight.reasons).toEqual([
      {
        code: "TARGET_INACTIVE",
        recovery: "Choose an active QA target.",
      },
      {
        code: "NO_ACTIVE_PACK",
        recovery: "Choose a profile with an approved target-specific pack.",
      },
    ]);
    expect(preflight.context).toEqual({ pullRequest: 1772, commitSha: "abcdef1" });
    expect(preflight.pack).toBeUndefined();
  });

  it("successfully resolves context and enables dispatch when qa_test_runs is empty in DB", async () => {
    // Arrange: Simulate brand new staging deployment where qa_test_runs has 0 records
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({
          docs: [], // No prior test runs found
        })
        .mockResolvedValueOnce({
          docs: [], // No active fixture lease conflicts
        }),
    } as unknown as Payload;

    // Act: Request preflight with valid target and profile
    const preflight = await getManualRunPreflight(payload, {
      targetId: "identity-login-otp",
      profile: "smoke",
      context: { pullRequest: 1785, commitSha: "a1b2c3d4e5f6" },
    });

    // Assert: Preflight must succeed without STAGING_CONTEXT_UNAVAILABLE error
    expect(preflight.canDispatch).toBe(true);
    expect(preflight.reasons).toEqual([]);
    expect(preflight.context).toEqual({
      pullRequest: 1785,
      commitSha: "a1b2c3d4e5f6",
    });
    expect(preflight.pack?.id).toBe("identity-login-otp-contract");
  });
});
