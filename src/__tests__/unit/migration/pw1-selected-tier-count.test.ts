// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCatalog } from "@/lib/migration/pw1-export/mappers/catalog";
import { buildProductCatalogFromSource } from "@/lib/migration/pw2-product-eav.mjs";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "tier-count-fixture",
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

describe("SOURCE_SELECTED_TIER_COUNT resolution", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const category = { id: "1", store_id: "10", name: "Cat", slug: "cat", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };

  describe("Single SKU with domain attributes but no selections", () => {
    const singleProduct: Row = { id: "100", store_id: "10", name: "Single Shirt", slug: "single-shirt", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const singleSku: Row = { id: "201", store_id: "10", product_id: "100", sku: "SINGLE-01", price: "150", stock: "25", status: "1" };
    const attributes: Row[] = [{ id: "1", store_id: "10", name: "Color" }];
    const attribute_values: Row[] = [{ id: "10", store_id: "10", attribute_id: "1", name: "Red" }];
    const product_attributes: Row[] = [{ id: "101", product_id: "100", attribute_id: "1", attribute_value_id: "10" }];
    // No product_variants (selections) for this SKU!
    const product_variants: Row[] = [];

    const tables = {
      stores: [store],
      currencies: [currency],
      categories: [category],
      products: [singleProduct],
      product_skus: [singleSku],
      attributes,
      attribute_values,
      product_attributes,
      product_variants,
    };

    it("fails with SOURCE_SELECTED_TIER_COUNT when treatSingleSkuWithoutSelectionsAsSimple is false", () => {
      const ctx = createContext(tables, { treatSingleSkuWithoutSelectionsAsSimple: false });
      mapCatalog(ctx);

      expect(ctx.output.products).toHaveLength(0);
      const blocker = ctx.diagnostics.find(d => d.code === "SOURCE_SELECTED_TIER_COUNT");
      expect(blocker).toBeDefined();
    });

    it("maps to Simple Product successfully when treatSingleSkuWithoutSelectionsAsSimple is true", () => {
      const ctx = createContext(tables, { treatSingleSkuWithoutSelectionsAsSimple: true });
      mapCatalog(ctx);

      expect(ctx.diagnostics).toEqual([{ code: "PRODUCT_VARIANT_DEFINITION_RETAINED", severity: "warning", storeId: "10", table: "product_attributes", sourceId: "101", reason: "SIMPLE_PRODUCT_ATTRIBUTES" }]);
      expect(ctx.output.products).toHaveLength(1);
      const prod = ctx.output.products[0];
      expect(prod._ref).toBe("@products:products:100");
      expect(prod.hasVariants).toBe(false);
      expect(prod.sku).toBe("SINGLE-01");
      expect(prod.price).toBe(150);
      expect(prod.inventory).toBe(25);
      expect(prod.variants).toEqual([]);
      expect(prod.variantConfigs).toEqual([]);

      const catalog = buildProductCatalogFromSource(singleProduct, tables, "fixture", {
        treatSingleSkuWithoutSelectionsAsSimple: true,
      });
      expect(catalog.errors).toHaveLength(0);
      expect(catalog.fields.hasVariants).toBe(false);
      expect(catalog.identities).toHaveLength(0);
      expect(catalog.skuCrosswalk).toHaveLength(0);
    });
  });

  describe("Extraneous unused tier in domain pruned when pruneUnreferencedTiers is true", () => {
    const multiProduct: Row = { id: "200", store_id: "10", name: "Polo Shirt", slug: "polo-shirt", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const product_skus: Row[] = [
      { id: "301", store_id: "10", product_id: "200", sku: "POLO-RED-M", price: "100", stock: "10", status: "1" },
      { id: "302", store_id: "10", product_id: "200", sku: "POLO-BLUE-L", price: "100", stock: "15", status: "1" },
    ];
    // Domain defines 3 tiers: Color (1), Size (2), and Material (3)
    const attributes: Row[] = [
      { id: "1", store_id: "10", name: "Color" },
      { id: "2", store_id: "10", name: "Size" },
      { id: "3", store_id: "10", name: "Material" },
    ];
    const attribute_values: Row[] = [
      { id: "10", store_id: "10", attribute_id: "1", name: "Red" },
      { id: "11", store_id: "10", attribute_id: "1", name: "Blue" },
      { id: "20", store_id: "10", attribute_id: "2", name: "M" },
      { id: "21", store_id: "10", attribute_id: "2", name: "L" },
      { id: "30", store_id: "10", attribute_id: "3", name: "Cotton" },
    ];
    const product_attributes: Row[] = [
      { id: "201", product_id: "200", attribute_id: "1", attribute_value_id: "10" },
      { id: "202", product_id: "200", attribute_id: "1", attribute_value_id: "11" },
      { id: "203", product_id: "200", attribute_id: "2", attribute_value_id: "20" },
      { id: "204", product_id: "200", attribute_id: "2", attribute_value_id: "21" },
      { id: "205", product_id: "200", attribute_id: "3", attribute_value_id: "30" }, // Material is never selected!
    ];
    // SKUs only select Color and Size (2 selections each)
    const product_variants: Row[] = [
      { id: "1001", product_sku_id: "301", attribute_id: "1", attribute_value_id: "10" },
      { id: "1002", product_sku_id: "301", attribute_id: "2", attribute_value_id: "20" },
      { id: "1003", product_sku_id: "302", attribute_id: "1", attribute_value_id: "11" },
      { id: "1004", product_sku_id: "302", attribute_id: "2", attribute_value_id: "21" },
    ];

    const tables = {
      stores: [store],
      currencies: [currency],
      categories: [category],
      products: [multiProduct],
      product_skus,
      attributes,
      attribute_values,
      product_attributes,
      product_variants,
    };

    it("fails with SOURCE_SELECTED_TIER_COUNT when pruneUnreferencedTiers is false", () => {
      const ctx = createContext(tables, { pruneUnreferencedTiers: false });
      mapCatalog(ctx);

      expect(ctx.output.products).toHaveLength(0);
      const blocker = ctx.diagnostics.find(d => d.code === "SOURCE_SELECTED_TIER_COUNT");
      expect(blocker).toBeDefined();
    });

    it("prunes Material tier and emits product successfully when pruneUnreferencedTiers is true", () => {
      const ctx = createContext(tables, { pruneUnreferencedTiers: true, allowSparseVariants: true });
      mapCatalog(ctx);

      expect(ctx.diagnostics).toEqual([{ code: "PRODUCT_VARIANT_DEFINITION_RETAINED", severity: "warning", storeId: "10", table: "product_attributes", sourceId: "205", reason: "UNREFERENCED_TIER" }]);
      expect(ctx.output.products).toHaveLength(1);
      const prod = ctx.output.products[0];
      expect(prod._ref).toBe("@products:products:200");
      expect(prod.hasVariants).toBe(true);

      // Only 2 tiers remain: Color and Size
      const configs = prod.variantConfigs as any[];
      expect(configs).toHaveLength(2);
      expect(configs.map(c => c.name)).toEqual(["Color", "Size"]);

      // Variants have 2 items
      const variants = prod.variants as any[];
      expect(variants).toHaveLength(2);
      expect(variants[0].name).toBe("Red - M");
      expect(variants[1].name).toBe("Blue - L");
    });
  });

  describe("Multiple SKUs with completely missing selections", () => {
    const missingSelectionsProduct: Row = { id: "300", store_id: "10", name: "Broken Variants", slug: "broken-variants", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const product_skus: Row[] = [
      { id: "401", store_id: "10", product_id: "300", sku: "BROKEN-01", price: "200", stock: "10", status: "1" },
      { id: "402", store_id: "10", product_id: "300", sku: "BROKEN-02", price: "220", stock: "10", status: "1" },
    ];
    const attributes: Row[] = [{ id: "1", store_id: "10", name: "Color" }];
    const attribute_values: Row[] = [{ id: "10", store_id: "10", attribute_id: "1", name: "Red" }];
    const product_attributes: Row[] = [{ id: "301", product_id: "300", attribute_id: "1", attribute_value_id: "10" }];
    const product_variants: Row[] = []; // Completely missing

    const tables = {
      stores: [store],
      currencies: [currency],
      categories: [category],
      products: [missingSelectionsProduct],
      product_skus,
      attributes,
      attribute_values,
      product_attributes,
      product_variants,
    };

    it("strict safety: still blocks with SOURCE_SELECTED_TIER_COUNT without inferring fake options", () => {
      const ctx = createContext(tables, {
        treatSingleSkuWithoutSelectionsAsSimple: true,
        pruneUnreferencedTiers: true,
      });
      mapCatalog(ctx);

      // Must NOT emit product because we have multiple SKUs and no evidence of selections
      expect(ctx.output.products).toHaveLength(0);
      const blocker = ctx.diagnostics.find(d => d.code === "SOURCE_SELECTED_TIER_COUNT");
      expect(blocker).toBeDefined();
    });
  });
});
