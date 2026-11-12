import { describe, expect, it } from "vitest";
import { QC_FIELD_REGISTRY, QC_PRIVATE_DISPLAY_KEYS } from "@/lib/admin/qa/f42-reader-contract";

describe("[TC-F40-14-07] Private display keys never reach the reader as public values", () => {
  it("blocks every private key that the registry already tracks", () => {
    // Arrange
    const tracked = ["orders.code", "customers.email", "promotion_codes.code"];
    const registryKeys = new Set(QC_FIELD_REGISTRY.map((field) => field.key));

    // Act / Assert
    for (const key of tracked) {
      expect(registryKeys.has(key)).toBe(true);
      expect(QC_PRIVATE_DISPLAY_KEYS.has(key)).toBe(true);
    }
  });

  it("pre-blocks customer name and phone before they join the registry", () => {
    // Arrange / Act / Assert
    expect(QC_PRIVATE_DISPLAY_KEYS.has("customers.name")).toBe(true);
    expect(QC_PRIVATE_DISPLAY_KEYS.has("customers.phone")).toBe(true);
  });
});
