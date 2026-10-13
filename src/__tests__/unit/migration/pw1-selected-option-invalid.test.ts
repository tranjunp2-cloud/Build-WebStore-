// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCatalog } from "@/lib/migration/pw1-export/mappers/catalog";
import { buildProductCatalogFromSource } from "@/lib/migration/pw2-product-eav.mjs";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "option-invalid-fixture",
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

describe("SOURCE_SELECTED_OPTION_INVALID diagnostics & granular reasons", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const category = { id: "1", store_id: "10", name: "Cat", slug: "cat", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
  const product: Row = { id: "100", store_id: "10", name: "Polo Shirt", slug: "polo-shirt", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };

  const attributes: Row[] = [
    { id: "1", store_id: "10", name: "Color" },
    { id: "2", store_id: "10", name: "Size" },
  ];
  const attribute_values: Row[] = [
    { id: "10", store_id: "10", attribute_id: "1", name: "Red" },
    { id: "11", store_id: "10", attribute_id: "1", name: "Blue" },
    { id: "20", store_id: "10", attribute_id: "2", name: "M" },
    { id: "21", store_id: "10", attribute_id: "2", name: "L" },
  ];
  const product_attributes: Row[] = [
    { id: "101", product_id: "100", attribute_id: "1", attribute_value_id: "10" },
    { id: "102", product_id: "100", attribute_id: "1", attribute_value_id: "11" },
    { id: "103", product_id: "100", attribute_id: "2", attribute_value_id: "20" },
    { id: "104", product_id: "100", attribute_id: "2", attribute_value_id: "21" },
  ];

  it("identifies MISSING_SELECTION when SKU has no selection for a tier", () => {
    const product_skus: Row[] = [
      { id: "201", store_id: "10", product_id: "100", sku: "POLO-RED", price: "100", stock: "10", status: "1" },
    ];
    // Only selects Color (1:10), misses Size (2)
    const product_variants: Row[] = [
      { id: "1001", product_sku_id: "201", attribute_id: "1", attribute_value_id: "10" },
    ];

    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus, attributes, attribute_values,
      product_attributes, product_variants,
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture", { allowSparseVariants: true });
    const error = catalog.errors.find(e => e.code === "SOURCE_SELECTED_OPTION_INVALID");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("MISSING_SELECTION");
  });

  it("identifies DUPLICATE_SELECTION when SKU selects multiple options for the same tier", () => {
    const product_skus: Row[] = [
      { id: "201", store_id: "10", product_id: "100", sku: "POLO-MULTI", price: "100", stock: "10", status: "1" },
    ];
    // Selects 2 colors (Red 10 and Blue 11) for the Color tier
    const product_variants: Row[] = [
      { id: "1001", product_sku_id: "201", attribute_id: "1", attribute_value_id: "10" },
      { id: "1002", product_sku_id: "201", attribute_id: "1", attribute_value_id: "11" },
      { id: "1003", product_sku_id: "201", attribute_id: "2", attribute_value_id: "20" },
    ];

    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus, attributes, attribute_values,
      product_attributes, product_variants,
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture", { allowSparseVariants: true });
    const error = catalog.errors.find(e => e.code === "SOURCE_SELECTED_OPTION_INVALID" && e.reason === "DUPLICATE_SELECTION");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("DUPLICATE_SELECTION");
  });

  it("identifies OUT_OF_DOMAIN when SKU selects an invalid/orphan attribute value", () => {
    const product_skus: Row[] = [
      { id: "201", store_id: "10", product_id: "100", sku: "POLO-ORPHAN", price: "100", stock: "10", status: "1" },
    ];
    // Selects value 999 which does not exist or belong to another store
    const product_variants: Row[] = [
      { id: "1001", product_sku_id: "201", attribute_id: "1", attribute_value_id: "999" },
      { id: "1002", product_sku_id: "201", attribute_id: "2", attribute_value_id: "20" },
    ];

    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus, attributes, attribute_values,
      product_attributes, product_variants,
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture", { allowSparseVariants: true });
    const error = catalog.errors.find(e => e.code === "SOURCE_SELECTED_OPTION_INVALID");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("OUT_OF_DOMAIN");
  });

  it("mapCatalog propagates granular reason to diagnostics", () => {
    const product_skus: Row[] = [
      { id: "201", store_id: "10", product_id: "100", sku: "POLO-RED", price: "100", stock: "10", status: "1" },
    ];
    const product_variants: Row[] = [
      { id: "1001", product_sku_id: "201", attribute_id: "1", attribute_value_id: "10" },
    ];

    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus, attributes, attribute_values,
      product_attributes, product_variants,
    };

    const ctx = createContext(tables);
    mapCatalog(ctx);

    const diagnostic = ctx.diagnostics.find(d => d.code === "SOURCE_SELECTED_OPTION_INVALID");
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.reason).toBe("MISSING_SELECTION");
  });
});
