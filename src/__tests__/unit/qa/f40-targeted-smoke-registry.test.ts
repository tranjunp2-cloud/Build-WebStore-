import { describe, expect, it } from "vitest";
import {
  TARGETED_SMOKE_PACKS,
  resolveTargetedSmokePacks,
  validateTargetedSmokePacks,
  type TargetedSmokePack,
} from "@/lib/admin/qa/targeted-smoke-registry";

const knownTargetIds = new Set([
  "editor-productgrid-variants",
  "products-variants-inventory",
  "order-payment-verification",
  "storefront-discount-checkout",
]);

describe("[TC-F40-03-01] Targeted critical-flow Smoke registry", () => {
  it("allows only the three declared pilot critical-flow packs", () => {
    // Arrange
    const targetIds = [
      "storefront-discount-checkout",
      "unknown-target",
      "editor-productgrid-variants",
      "products-variants-inventory",
    ];

    // Act
    const packs = resolveTargetedSmokePacks(targetIds);

    // Assert
    expect(packs.map((pack) => pack.targetId)).toEqual([
      "editor-productgrid-variants",
      "products-variants-inventory",
      "storefront-discount-checkout",
    ]);
    expect(packs.flatMap((pack) => pack.testCases).every((testCase) => (
      testCase.assertion.length > 0 && testCase.id.startsWith("TC-")
    ))).toBe(true);
  });

  it("TC-F40-03-01: keeps an unmapped or inactive target from becoming a broad fallback", () => {
    // Arrange
    const targetIds = ["unmapped-target", "retired-target"];

    // Act
    const packs = resolveTargetedSmokePacks(targetIds);

    // Assert
    expect(packs).toEqual([]);
  });

  it("TC-F40-03-01: rejects unsafe specs and duplicate test case declarations", () => {
    // Arrange
    const unsafePack: TargetedSmokePack = {
      ...TARGETED_SMOKE_PACKS[0],
      spec: "tests/targeted-smoke/../full-regression.spec.ts",
      testCases: [
        ...TARGETED_SMOKE_PACKS[0].testCases,
        ...TARGETED_SMOKE_PACKS[0].testCases,
      ],
    };

    // Act / Assert
    expect(() => validateTargetedSmokePacks([unsafePack], knownTargetIds)).toThrow(
      "Unsafe targeted Smoke spec",
    );
  });

  it("TC-F40-03-01: validates the checked-in registry against known targets", () => {
    // Arrange / Act / Assert
    expect(() => validateTargetedSmokePacks(TARGETED_SMOKE_PACKS, knownTargetIds)).not.toThrow();
  });
});
