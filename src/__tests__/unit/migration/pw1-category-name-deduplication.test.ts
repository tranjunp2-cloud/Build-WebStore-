// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCatalog } from "@/lib/migration/pw1-export/mappers/catalog";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "cat-name-fixture",
  activeCatalogOnly: false,
  deferEmailTemplates: true,
  allowSparseVariants: true,
  preserveUserCreators: true,
  siteTypeDefault: "ecommerce",
  siteTypeOverrides: {},
  shippingPolicy: "pw2-defaults",
};

function createContext(tables: Record<string, Row[]>, overrides: Partial<MigrationPolicy> = {}) {
  const config = sourceConfigSchema.parse({
    version: 1,
    sourceInstance: "fixture",
    sourceDatabase: "fixture",
    sourceInstanceToken: "fixture",
    snapshotId: "one",
    asOf: "2026-01-01T00:00:00Z",
    utcOffset: "+00:00",
    sourcePlatformSuffix: "old.test",
    targetPlatformSuffix: "new.test",
    tables: { stores: "stores.csv" },
    deletedStores: "review",
    migrationPolicy: { ...basePolicy, ...overrides },
  });
  const output = emptyStore();
  output.sites.push({ _ref: "@sites:stores:10" });
  return new SourceIndex(tables).context(config, "10", output, [], []);
}

describe("Category sibling name collision resolution (resolveDuplicateCategoryNames)", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };

  // 2 categories with same name "Thời Trang" and same parent "0" (root siblings)
  const cat1: Row = { id: "1", store_id: "10", parent_id: "0", name: "Thời Trang", slug: "thoi-trang-1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
  const cat2: Row = { id: "2", store_id: "10", parent_id: "0", name: "Thời Trang", slug: "thoi-trang-2", status: "1", created_at: "2024-01-02 00:00:00", updated_at: "2024-01-02 00:00:00" };
  // Child category belonging to cat2
  const childCat: Row = { id: "3", store_id: "10", parent_id: "2", name: "Váy Nữ", slug: "vay-nu", status: "1", created_at: "2024-01-03 00:00:00", updated_at: "2024-01-03 00:00:00" };

  // Products belonging to cat1 and cat2
  const prod1: Row = { id: "101", store_id: "10", category_id: "1", name: "Áo Nam", slug: "ao-nam", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
  const prod2: Row = { id: "102", store_id: "10", category_id: "2", name: "Áo Nữ", slug: "ao-nu", status: "1", created_at: "2024-01-02 00:00:00", updated_at: "2024-01-02 00:00:00" };

  const product_skus: Row[] = [
    { id: "201", store_id: "10", product_id: "101", sku: "NAM-01", price: "100", stock: "10", status: "1" },
    { id: "202", store_id: "10", product_id: "102", sku: "NU-01", price: "120", stock: "10", status: "1" },
  ];

  const tables = {
    stores: [store], currencies: [currency],
    categories: [cat1, cat2, childCat],
    products: [prod1, prod2],
    product_skus,
    attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
  };

  it("blocks duplicate sibling names and cascades failure when resolveDuplicateCategoryNames is false", () => {
    const ctx = createContext(tables, { resolveDuplicateCategoryNames: false });
    mapCatalog(ctx);

    // Both categories with duplicate sibling name are rejected
    expect(ctx.output.categories).toHaveLength(0);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_INVALID" && d.reason === "DUPLICATE_SIBLING_NAME")).toBe(true);

    // Child category is quarantined because parent 2 was rejected
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_PARENT_QUARANTINED" && d.sourceId === "3")).toBe(true);

    // Products are rejected because categories are missing
    expect(ctx.output.products).toHaveLength(0);
    expect(ctx.diagnostics.filter(d => d.code === "CATEGORY_REFERENCE_UNRESOLVED")).toHaveLength(2);
  });

  it("preserves original category names, resolves sibling collisions, and saves children and products when resolveDuplicateCategoryNames is true", () => {
    const ctx = createContext(tables, { resolveDuplicateCategoryNames: true });
    mapCatalog(ctx);

    // Both categories + child category are successfully exported
    expect(ctx.output.categories).toHaveLength(3);

    const exportedCat1 = ctx.output.categories.find(c => c._ref === "@categories:categories:1");
    const exportedCat2 = ctx.output.categories.find(c => c._ref === "@categories:categories:2");
    const exportedCat3 = ctx.output.categories.find(c => c._ref === "@categories:categories:3");

    expect(exportedCat1).toBeDefined();
    expect(exportedCat2).toBeDefined();
    expect(exportedCat3).toBeDefined();

    // Both retain original name
    expect(exportedCat1?.name).toBe("Thời Trang");
    expect(exportedCat2?.name).toBe("Thời Trang");
    expect(exportedCat3?.name).toBe("Váy Nữ");

    // Sibling collision warning is issued on the second category
    const warning = ctx.diagnostics.find(d => d.code === "CATEGORY_SIBLING_NAME_COLLISION_RESOLVED");
    expect(warning).toBeDefined();
    expect(warning?.sourceId).toBe("2");
    expect(warning?.severity).toBe("warning");

    // No CATEGORY_INVALID, no CATEGORY_PARENT_QUARANTINED, no CATEGORY_REFERENCE_UNRESOLVED
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_INVALID")).toBe(false);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_PARENT_QUARANTINED")).toBe(false);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_REFERENCE_UNRESOLVED")).toBe(false);

    // Both products successfully exported
    expect(ctx.output.products).toHaveLength(2);
  });

  it("handles both duplicate name and duplicate slug when both resolution flags are enabled", () => {
    // Both have same name "Phụ Kiện" AND same slug "phu-kien"
    const catA: Row = { id: "10", store_id: "10", parent_id: "0", name: "Phụ Kiện", slug: "phu-kien", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const catB: Row = { id: "20", store_id: "10", parent_id: "0", name: "Phụ Kiện", slug: "phu-kien", status: "1", created_at: "2024-01-02 00:00:00", updated_at: "2024-01-02 00:00:00" };

    const dualTables = {
      stores: [store], currencies: [currency],
      categories: [catA, catB],
      products: [], product_skus: [],
      attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
    };

    const ctx = createContext(dualTables, {
      resolveDuplicateCategoryNames: true,
      resolveDuplicateCategorySlugs: true,
    });
    mapCatalog(ctx);

    expect(ctx.output.categories).toHaveLength(2);

    const outA = ctx.output.categories.find(c => c._ref === "@categories:categories:10");
    const outB = ctx.output.categories.find(c => c._ref === "@categories:categories:20");

    // Both preserve original name
    expect(outA?.name).toBe("Phụ Kiện");
    expect(outB?.name).toBe("Phụ Kiện");

    // First slug is preserved, second slug has -C20 suffix
    expect(outA?.slug).toBe("phu-kien");
    expect(outB?.slug).toBe("phu-kien-C20");

    // Both warnings are recorded
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_SIBLING_NAME_COLLISION_RESOLVED" && d.sourceId === "20")).toBe(true);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_SLUG_COLLISION_RESOLVED" && d.sourceId === "20")).toBe(true);
  });
});
