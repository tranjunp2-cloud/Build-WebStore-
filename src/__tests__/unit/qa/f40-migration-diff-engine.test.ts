import { describe, it, expect } from "vitest";
import {
  generateReconciliationCatalog,
  getStoreDeepDiff,
  getDashboardMetrics,
  CANONICAL_TEMPLATES,
} from "@/lib/admin/qa/migration-diff-engine";

describe("F40 US-F40-09 Migration Reconciliation Engine Unit Tests", () => {
  it("[TC-F40-09-01] generates 2,000 canonical store index with complete metadata", () => {
    const catalog = generateReconciliationCatalog(2000);
    expect(catalog).toHaveLength(2000);

    const firstStore = catalog[0];
    expect(firstStore.id).toBe("SITE-0001");
    expect(firstStore.templateCode).toBe("FB101");
    expect(firstStore.templateName).toBe("OrganicNest");
    expect(firstStore.legacyDomain).toContain("fb101.web.dev.ecommercehub.my");
    expect(firstStore.migratedDomain).toContain("fb101.primeweb.io");
    expect(firstStore.fileV2).toBe("fb101-standalone-full.html");
    expect(firstStore.larkUrl).toBeDefined();
  });

  it("[TC-F40-09-02] verifies canonical templates catalog contains all 9 design recipes", () => {
    expect(CANONICAL_TEMPLATES).toHaveLength(9);
    const codes = CANONICAL_TEMPLATES.map((t) => t.code);
    expect(codes).toEqual([
      "FB101",
      "PA101",
      "F102",
      "FN104",
      "FN103",
      "C102",
      "C101",
      "FN102",
      "FN101",
    ]);
  });

  it("[TC-F40-09-03] calculates dashboard aggregate metrics accurately", () => {
    const catalog = generateReconciliationCatalog(2000);
    const metrics = getDashboardMetrics(catalog);

    expect(metrics.totalStores).toBe(2000);
    expect(metrics.passedStores + metrics.warningStores + metrics.failedStores).toBe(2000);
    expect(parseFloat(metrics.avgScore)).toBeGreaterThanOrEqual(90);
    expect(metrics.p0BlockersCount).toBe(metrics.failedStores);
    expect(metrics.lastSyncTimestamp).toBeDefined();
  });

  it("[TC-F40-09-04] retrieves deep store diff with page breakdown and reconciliation audit", () => {
    const diff = getStoreDeepDiff("SITE-0001");
    expect(diff).not.toBeNull();
    if (!diff) return;

    expect(diff.id).toBe("SITE-0001");
    expect(diff.templateCode).toBe("FB101");
    expect(diff.pages.length).toBeGreaterThanOrEqual(1);

    // Audit counters check
    expect(diff.reconciliationAudit.totalProductsV1).toBe(24);
    expect(diff.reconciliationAudit.totalProductsV2).toBe(24);

    // Check Home page breakdown
    const homePage = diff.pages.find((p) => p.path === "/");
    expect(homePage).toBeDefined();
    expect(homePage?.breakdown.length).toBeGreaterThanOrEqual(5);

    // Check block positions
    const pos1 = homePage?.breakdown[0];
    expect(pos1?.pos).toBe("#01");
    expect(pos1?.leg).toContain("Hero Banner");
    expect(pos1?.mig).toBe("hero/split-left");
  });

  it("[TC-F40-09-05] correctly flags P0 blockers on failed stores", () => {
    // SITE-0025 is engineered as a failed store (i % 25 === 0)
    const diff = getStoreDeepDiff("SITE-0025");
    expect(diff).not.toBeNull();
    if (!diff) return;

    expect(diff.status).toBe("failed");
    expect(diff.pages[0].defects.length).toBeGreaterThan(0);

    const brandDefect = diff.pages[0].defects.find((d) => d.affectedField === "products.brand_id");
    expect(brandDefect).toBeDefined();
    expect(brandDefect?.type).toBe("p0");
    expect(brandDefect?.fix).toContain("brands");

    const variantDefect = diff.pages[0].defects.find((d) => d.affectedField === "variants[].sku");
    expect(variantDefect).toBeDefined();
    expect(variantDefect?.type).toBe("p0");
  });

  it("[TC-F40-12-06] returns null for non-existent store id (no silent fallback)", () => {
    const diff = getStoreDeepDiff("SITE-9999");
    expect(diff).toBeNull();
  });
});
