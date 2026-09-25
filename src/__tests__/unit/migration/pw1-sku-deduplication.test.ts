// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type Doc, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCatalog } from "@/lib/migration/pw1-export/mappers/catalog";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "sku-dedup-fixture",
  activeCatalogOnly: false,
  deferEmailTemplates: true,
  allowSparseVariants: true,
  preserveUserCreators: true,
  resolveDuplicateSkus: true,
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

describe("SKU Deduplication across products in same store", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const category = { id: "1", store_id: "10", name: "Cat", slug: "cat", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };

  it.each(["ABC-P200", "abc-p200"])("TC-F42-EXP-100: keeps sibling SKU %s when resolving a cross-product collision", (siblingSku) => {
    // Arrange — generated suffixes must not take a sibling's original code.
    const ctx = createContext({
      stores: [store], currencies: [currency], categories: [category],
      products: ["100", "200"].map(id => ({ ...category, id, name: `Product ${id}`, slug: `product-${id}`, category_id: "1" })),
      product_skus: [
        { id: "1", product_id: "100", sku: "ABC" },
        { id: "2", product_id: "200", sku: "ABC" },
        { id: "3", product_id: "200", sku: siblingSku },
        { id: "4", product_id: "200", sku: "ABC-P200-1" },
      ].map(row => ({ ...row, store_id: "10", price: "10", stock: "3", status: "1" })),
      attributes: [{ id: "1", store_id: "10", name: "Color" }],
      attribute_values: ["Red", "Blue", "Green"].map((name, index) => ({ id: String(index + 1), store_id: "10", attribute_id: "1", name })),
      product_variants: ["2", "3", "4"].map((skuId, index) => ({ id: String(index + 1), product_sku_id: skuId, attribute_id: "1", attribute_value_id: String(index + 1) })),
    }, { excludeInvalidProducts: true });

    // Act
    mapCatalog(ctx);

    // Assert — neither the Product nor its valid variants are dropped.
    expect(ctx.output.products).toHaveLength(2);
    const product = ctx.output.products.find(row => row._ref === "@products:products:200");
    expect((product?.variants as Doc[] | undefined)?.map(variant => variant.sku)).toEqual(["ABC-P200-2", siblingSku, "ABC-P200-1"]);
    expect(ctx.diagnostics.filter(issue => issue.code === "SKU_COLLISION_RESOLVED")).toHaveLength(1);
    expect(ctx.diagnostics.some(issue => issue.code === "SOURCE_ENTITY_EXCLUDED" || issue.severity === "blocker")).toBe(false);
  });

  it("resolves duplicate SKU between two single products by appending -P{productId}", () => {
    const products: Row[] = [
      { id: "100", store_id: "10", name: "Product A", slug: "product-a", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
      { id: "200", store_id: "10", name: "Product B", slug: "product-b", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
    ];
    const product_skus: Row[] = [
      { id: "1001", store_id: "10", product_id: "100", sku: "SHARED-SKU", price: "10", stock: "5", status: "1" },
      { id: "2001", store_id: "10", product_id: "200", sku: "SHARED-SKU", price: "20", stock: "3", status: "1" },
    ];

    const ctx = createContext({
      stores: [store],
      currencies: [currency],
      categories: [category],
      products,
      product_skus,
    }, { resolveDuplicateSkus: true });

    mapCatalog(ctx);

    expect(ctx.output.products).toHaveLength(2);
    const prodA = ctx.output.products.find(p => p._ref === "@products:products:100");
    const prodB = ctx.output.products.find(p => p._ref === "@products:products:200");

    expect(prodA?.sku).toBe("SHARED-SKU");
    expect(prodB?.sku).toBe("SHARED-SKU-P200");

    const warnings = ctx.diagnostics.filter(d => d.code === "SKU_COLLISION_RESOLVED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.sourceId).toBe("200");
    expect(warnings[0]?.severity).toBe("warning");
  });

  it("handles case-insensitive duplicate SKUs", () => {
    const products: Row[] = [
      { id: "101", store_id: "10", name: "Item Upper", slug: "item-upper", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
      { id: "202", store_id: "10", name: "Item Lower", slug: "item-lower", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
    ];
    const product_skus: Row[] = [
      { id: "1002", store_id: "10", product_id: "101", sku: "ITEM-ABC", price: "15", stock: "2", status: "1" },
      { id: "2002", store_id: "10", product_id: "202", sku: "item-abc", price: "15", stock: "2", status: "1" },
    ];

    const ctx = createContext({
      stores: [store],
      currencies: [currency],
      categories: [category],
      products,
      product_skus,
    }, { resolveDuplicateSkus: true });

    mapCatalog(ctx);

    const first = ctx.output.products.find(p => p._ref === "@products:products:101");
    const second = ctx.output.products.find(p => p._ref === "@products:products:202");

    expect(first?.sku).toBe("ITEM-ABC");
    expect(second?.sku).toBe("item-abc-P202");
  });

  it("preserves original duplicate SKU when resolveDuplicateSkus is false", () => {
    const products: Row[] = [
      { id: "301", store_id: "10", name: "Item One", slug: "item-one", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
      { id: "302", store_id: "10", name: "Item Two", slug: "item-two", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
    ];
    const product_skus: Row[] = [
      { id: "3001", store_id: "10", product_id: "301", sku: "DUP-SKU", price: "10", stock: "1", status: "1" },
      { id: "3002", store_id: "10", product_id: "302", sku: "DUP-SKU", price: "10", stock: "1", status: "1" },
    ];

    const ctx = createContext({
      stores: [store],
      currencies: [currency],
      categories: [category],
      products,
      product_skus,
    }, { resolveDuplicateSkus: false });

    mapCatalog(ctx);

    // Without flag, collisions are detected, products are dropped, and PRODUCT_SKU_COLLISION blockers are raised
    expect(ctx.output.products).toHaveLength(0);

    const blockers = ctx.diagnostics.filter(d => d.code === "PRODUCT_SKU_COLLISION");
    expect(blockers).toHaveLength(2);
    expect(blockers.map(b => b.sourceId).sort()).toEqual(["301", "302"]);

    const warnings = ctx.diagnostics.filter(d => d.code === "SKU_COLLISION_RESOLVED");
    expect(warnings).toHaveLength(0);
  });

  it("truncates base SKU if total length would exceed 50 characters", () => {
    // 48 characters long
    const longSku = "A".repeat(48);
    const products: Row[] = [
      { id: "401", store_id: "10", name: "Long A", slug: "long-a", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
      { id: "5555", store_id: "10", name: "Long B", slug: "long-b", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" },
    ];
    const product_skus: Row[] = [
      { id: "4001", store_id: "10", product_id: "401", sku: longSku, price: "10", stock: "1", status: "1" },
      { id: "4002", store_id: "10", product_id: "5555", sku: longSku, price: "10", stock: "1", status: "1" },
    ];

    const ctx = createContext({
      stores: [store],
      currencies: [currency],
      categories: [category],
      products,
      product_skus,
    }, { resolveDuplicateSkus: true });

    mapCatalog(ctx);

    const second = ctx.output.products.find(p => p._ref === "@products:products:5555");
    expect(second?.sku).toBeDefined();
    expect(second!.sku!.length).toBeLessThanOrEqual(50);
    expect(second!.sku!.endsWith("-P5555")).toBe(true);
  });
});
