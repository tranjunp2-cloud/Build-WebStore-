// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCatalog } from "@/lib/migration/pw1-export/mappers/catalog";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "cat-slug-fixture",
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

describe("Category slug collision resolution (resolveDuplicateCategorySlugs)", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };

  // 2 categories with duplicate slug "thoi-trang"
  const cat1: Row = { id: "1", store_id: "10", name: "Thời Trang Nam", slug: "thoi-trang", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
  const cat2: Row = { id: "2", store_id: "10", name: "Thời Trang Nữ", slug: "thoi-trang", status: "1", created_at: "2024-01-02 00:00:00", updated_at: "2024-01-02 00:00:00" };
  // Child category belonging to cat2
  const childCat: Row = { id: "3", store_id: "10", parent_id: "2", name: "Váy Nữ", slug: "vay-nu", status: "1", created_at: "2024-01-03 00:00:00", updated_at: "2024-01-03 00:00:00" };

  // Products belonging to cat1 and cat2
  const prod1: Row = { id: "101", store_id: "10", category_id: "1", name: "Áo Nam", slug: "ao-nam", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
  const prod2: Row = { id: "102", store_id: "10", category_id: "2", name: "Áo Nữ", slug: "ao-nu", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };

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

  it("blocks duplicate slug and cascades failure when resolveDuplicateCategorySlugs is false", () => {
    const ctx = createContext(tables, { resolveDuplicateCategorySlugs: false });
    mapCatalog(ctx);

    // Both categories with duplicate slug are rejected
    expect(ctx.output.categories).toHaveLength(0);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_INVALID" && d.reason === "DUPLICATE_SLUG_IN_STORE")).toBe(true);

    // Child category is quarantined because parent 2 was rejected
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_PARENT_QUARANTINED" && d.sourceId === "3")).toBe(true);

    // Products are rejected with CATEGORY_REFERENCE_UNRESOLVED
    expect(ctx.output.products).toHaveLength(0);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_REFERENCE_UNRESOLVED")).toBe(true);
  });

  it("resolves duplicate category slug, preserves child categories and emits all products when resolveDuplicateCategorySlugs is true", () => {
    const ctx = createContext(tables, { resolveDuplicateCategorySlugs: true });
    mapCatalog(ctx);

    // All 3 categories are successfully emitted!
    expect(ctx.output.categories).toHaveLength(3);

    const emittedCat1 = ctx.output.categories.find(c => c._ref === "@categories:categories:1");
    const emittedCat2 = ctx.output.categories.find(c => c._ref === "@categories:categories:2");
    const emittedChild = ctx.output.categories.find(c => c._ref === "@categories:categories:3");

    expect(emittedCat1).toBeDefined();
    expect(emittedCat2).toBeDefined();
    expect(emittedChild).toBeDefined();

    // Canonical category 1 keeps original slug
    expect(emittedCat1?.slug).toBe("thoi-trang");
    // Colliding category 2 gets disambiguated with -C2 suffix
    expect(emittedCat2?.slug).toBe("thoi-trang-C2");
    // Child category retains proper parent reference
    expect(emittedChild?.parent).toBe("@categories:categories:2");

    // Collision warning is emitted for audit
    const warning = ctx.diagnostics.find(d => d.code === "CATEGORY_SLUG_COLLISION_RESOLVED" && d.sourceId === "2");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");

    // Cascading failures are completely eliminated: 0 quarantined parent, 0 category reference unresolved!
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_PARENT_QUARANTINED")).toBe(false);
    expect(ctx.diagnostics.some(d => d.code === "CATEGORY_REFERENCE_UNRESOLVED")).toBe(false);

    // Both products are emitted successfully!
    expect(ctx.output.products).toHaveLength(2);
    expect(ctx.output.products.map(p => p._ref)).toEqual([
      "@products:products:101",
      "@products:products:102",
    ]);
  });
});
