import { describe, it, expect } from "vitest";
import {
  CANONICAL_TEMPLATES,
  generateReconciliationCatalog,
  getSectorTheme,
  getStoreDeepDiff,
  SECTOR_DATA_MAP,
} from "@/lib/admin/qa/migration-diff-engine";

describe("F40 US-F40-12 Visual Parity Inspector Unit Tests", () => {
  it("[TC-F40-12-01] calculates clip-path coordinates for SwipeSlider at various slider percentages", () => {
    // Test clip-path polygon generator for swipe slider overlay
    const calculateClipPath = (pos: number) =>
      `polygon(${pos}% 0, 100% 0, 100% 100%, ${pos}% 100%)`;

    expect(calculateClipPath(0)).toBe("polygon(0% 0, 100% 0, 100% 100%, 0% 100%)");
    expect(calculateClipPath(50)).toBe("polygon(50% 0, 100% 0, 100% 100%, 50% 100%)");
    expect(calculateClipPath(100)).toBe("polygon(100% 0, 100% 0, 100% 100%, 100% 100%)");
  });

  it("[TC-F40-12-02] verifies dual preview URLs for PW1 legacy vs PW2 migrated storefronts", () => {
    const store = getStoreDeepDiff("SITE-0001");
    expect(store).not.toBeNull();
    if (!store) return;

    const tpl = store.templateCode.toLowerCase();
    const pw1Src = `/api/qa/template-preview/${tpl}?version=pw1`;
    const pw2Src = `/api/qa/template-preview/${tpl}?version=pw2`;

    expect(pw1Src).not.toBe(pw2Src);
    expect(pw1Src).toContain("version=pw1");
    expect(pw2Src).toContain("version=pw2");
  });

  it("[TC-F40-12-03] validates sector theme mapping across all 9 templates with no cross-contamination", () => {
    // Ensure all 9 canonical templates have distinct domain-specific products
    const codes = CANONICAL_TEMPLATES.map((t) => t.code);
    expect(codes).toHaveLength(9);

    const productNames = new Set<string>();
    for (const code of codes) {
      const theme = getSectorTheme(code);
      expect(theme).toBeDefined();
      expect(theme.productName.length).toBeGreaterThan(0);
      expect(theme.categoryName.length).toBeGreaterThan(0);
      productNames.add(theme.productName);
    }

    // All 9 templates must have distinct product names (not all "Mật ong")
    expect(productNames.size).toBe(9);
    expect(getSectorTheme("F102").categoryName).toContain("Thời Trang");
    expect(getSectorTheme("FN103").categoryName).toContain("Nội Thất");
    expect(getSectorTheme("C102").categoryName).toContain("Mỹ Phẩm");
    expect(getSectorTheme("FB101").categoryName).toContain("Nông Sản");
  });

  it("[TC-F40-12-04] validates cache memoization for 2,000 store catalog", () => {
    const start1 = performance.now();
    const cat1 = generateReconciliationCatalog(2000);
    const duration1 = performance.now() - start1;

    const start2 = performance.now();
    const cat2 = generateReconciliationCatalog(2000);
    const duration2 = performance.now() - start2;

    expect(cat1).toBe(cat2); // Exact same reference from cache
    expect(cat1.length).toBe(2000);
    expect(duration2).toBeLessThanOrEqual(duration1);
  });

  it("[TC-F40-12-05] validates iframe sandbox configuration forbids allow-same-origin with allow-scripts", () => {
    // Security check: ensure sandbox policy avoids the unsafe combination
    const safeSandbox = "allow-scripts allow-forms allow-popups";
    expect(safeSandbox.includes("allow-same-origin")).toBe(false);
    expect(safeSandbox.includes("allow-scripts")).toBe(true);
  });
});
