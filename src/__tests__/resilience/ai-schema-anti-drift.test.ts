import { describe, expect, it } from "vitest";
import { Pages } from "@/collections/Pages";
import { normalizeBlocksForPersistence, sanitizeBlockVariant } from "@/lib/block-normalization";

// ── TC-RES-02: AI Website Builder Schema Stability & Anti-Drift ─────
describe("[TC-RES-02] AI Website Builder Schema Stability & Anti-Drift", () => {
  it("TC-RES-02.01: ensures all registered Page Block slugs are defined in Payload collection schema", () => {
    // Act: Find the layout field in Pages collection
    const layoutField = Pages.fields?.find((f) => "name" in f && f.name === "layout") as any;
    const availableBlockSlugs = layoutField?.blocks?.map((b: any) => b.slug) || [];

    // Assert: Pages collection must have layout blocks configured
    expect(layoutField).toBeDefined();
    expect(layoutField.type).toBe("blocks");
    expect(availableBlockSlugs.length).toBeGreaterThan(0);
    expect(availableBlockSlugs).toContain("hero");
  });

  it("TC-RES-02.02: coerces invalid block variants to defaults using sanitizeBlockVariant", () => {
    // Arrange: Block with an invalid/unregistered variant
    const blockWithInvalidVariant = {
      blockType: "hero",
      variant: "non_existent_crazy_variant",
      headline: "Hero title",
    };

    // Act: Run actual codebase sanitizer
    const sanitized = sanitizeBlockVariant(blockWithInvalidVariant);

    // Assert: Coerces to valid default variant
    expect(sanitized.blockType).toBe("hero");
    expect(sanitized.variant).not.toBe("non_existent_crazy_variant");
  });

  it("TC-RES-02.03: normalizes layout blocks for persistence without crashing on missing headline", () => {
    // Arrange: AI blocks with missing or undefined headline
    const rawBlocks = [
      { id: "b1", blockType: "hero", headline: undefined },
    ];

    // Act: Run real codebase normalizer
    const normalized = normalizeBlocksForPersistence(rawBlocks);

    // Assert: headline coerced safely to string
    expect(normalized.length).toBe(1);
    expect(normalized[0].headline).toBe("");
  });
});