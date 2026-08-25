import { describe, it, expect } from "vitest";
import {
  generateReconciliationCatalog,
  getDashboardMetrics,
} from "@/lib/admin/qa/migration-diff-engine";

describe("F40 US-F40-10 Reconciliation Overview Grid & Filter Hub Tests", () => {
  it("[TC-F40-10-01] calculates metric cards data with 100% integrity across 2,000 stores", () => {
    const catalog = generateReconciliationCatalog(2000);
    const metrics = getDashboardMetrics(catalog);

    // AC-1: Verify summary metrics
    expect(metrics.totalStores).toBe(2000);
    expect(metrics.passedStores).toBeGreaterThan(1500);
    expect(metrics.warningStores).toBeGreaterThan(100);
    expect(metrics.failedStores).toBeGreaterThan(50);
    expect(metrics.passedStores + metrics.warningStores + metrics.failedStores).toBe(2000);
    expect(metrics.avgScore).toMatch(/^[0-9]+(\.[0-9]+)?%$/);
  });

  it("[TC-F40-10-02] filters stores accurately by status (passed, warning, failed)", () => {
    const catalog = generateReconciliationCatalog(2000);

    const passedStores = catalog.filter((s) => s.status === "passed");
    const warningStores = catalog.filter((s) => s.status === "warning");
    const failedStores = catalog.filter((s) => s.status === "failed");

    expect(passedStores.every((s) => parseFloat(s.score) >= 95)).toBe(true);
    expect(warningStores.every((s) => parseFloat(s.score) >= 85 && parseFloat(s.score) < 95)).toBe(true);
    expect(failedStores.every((s) => parseFloat(s.score) < 85)).toBe(true);
  });

  it("[TC-F40-10-03] filters stores accurately by template code", () => {
    const catalog = generateReconciliationCatalog(2000);

    const fb101Stores = catalog.filter((s) => s.templateCode === "FB101");
    expect(fb101Stores.length).toBeGreaterThan(200);
    expect(fb101Stores.every((s) => s.templateCode === "FB101" && s.templateName === "OrganicNest")).toBe(true);
    expect(fb101Stores[0].fileV2).toBe("fb101-standalone-full.html");

    const pa101Stores = catalog.filter((s) => s.templateCode === "PA101");
    expect(pa101Stores.every((s) => s.templateCode === "PA101" && s.templateName === "EcoGarden")).toBe(true);
    expect(pa101Stores[0].fileV2).toBe("pa101-standalone-full.html");
  });

  it("[TC-F40-10-04] searches stores by keyword (ID, Name, Domain)", () => {
    const catalog = generateReconciliationCatalog(2000);

    // Search by ID
    const searchById = catalog.filter((s) => s.id.toLowerCase().includes("site-0001"));
    expect(searchById).toHaveLength(1);
    expect(searchById[0].id).toBe("SITE-0001");

    // Search by Name keyword
    const searchByName = catalog.filter((s) => s.name.toLowerCase().includes("organicnest"));
    expect(searchByName.length).toBeGreaterThan(100);

    // Search by Domain keyword
    const searchByDomain = catalog.filter((s) => s.subdomain1.toLowerCase().includes("ech.my"));
    expect(searchByDomain.length).toBe(2000);
  });

  it("[TC-F40-10-05] validates traffic light health badges and failed block tags", () => {
    const catalog = generateReconciliationCatalog(2000);
    const failedStore = catalog.find((s) => s.status === "failed");

    expect(failedStore).toBeDefined();
    if (!failedStore) return;

    expect(failedStore.failedBlocks.length).toBeGreaterThan(0);
    expect(failedStore.failedBlocks).toContain("Thiếu Brand ID (Layer 2)");
    expect(failedStore.failedBlocks).toContain("Mất Biến Thể Size 1L");
  });
});
