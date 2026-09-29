// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { buildProductCatalogFromSource } from "@/lib/migration/pw2-product-eav.mjs";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "no-eligible-sku-fixture",
  activeCatalogOnly: false,
  deferEmailTemplates: true,
  allowSparseVariants: true,
  preserveUserCreators: true,
  siteTypeDefault: "ecommerce",
  siteTypeOverrides: {},
  shippingPolicy: "pw2-defaults",
};

describe("SOURCE_NO_ELIGIBLE_SKU handling & diagnostic reasons", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const category = { id: "1", store_id: "10", name: "Cat", slug: "cat", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };

  it("fails with NO_SKU_ROWS when product has no SKU rows at all", () => {
    const product: Row = { id: "100", store_id: "10", name: "No SKU Shirt", slug: "no-sku", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus: [],
      attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture");
    const error = catalog.errors.find(e => e.code === "SOURCE_NO_ELIGIBLE_SKU");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("NO_SKU_ROWS");
  });

  it("fails with NO_LIVE_OWNED_SKU when all SKUs are soft-deleted", () => {
    const product: Row = { id: "100", store_id: "10", name: "Deleted SKU Shirt", slug: "deleted-sku", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const deletedSku: Row = { id: "201", store_id: "10", product_id: "100", sku: "DEL-01", price: "100", stock: "10", status: "1", deleted_at: "2024-01-01 00:00:00" };
    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus: [deletedSku],
      attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture");
    const error = catalog.errors.find(e => e.code === "SOURCE_NO_ELIGIBLE_SKU");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("NO_LIVE_OWNED_SKU");
  });

  it("fails with ALL_LIVE_OWNED_SKUS_INACTIVE when product has only status=0 SKUs and default policy", () => {
    const product: Row = { id: "100", store_id: "10", name: "Inactive SKU Shirt", slug: "inactive-sku", category_id: "1", status: "0", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const inactiveSku: Row = { id: "201", store_id: "10", product_id: "100", sku: "INACT-01", price: "120", stock: "5", status: "0" };
    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus: [inactiveSku],
      attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture");
    const error = catalog.errors.find(e => e.code === "SOURCE_NO_ELIGIBLE_SKU");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("ALL_LIVE_OWNED_SKUS_INACTIVE");
  });

  it("accepts inactive SKU for inactive product when allowInactiveSkusForInactiveProduct is true", () => {
    const product: Row = { id: "100", store_id: "10", name: "Inactive SKU Shirt", slug: "inactive-sku", category_id: "1", status: "0", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const inactiveSku: Row = { id: "201", store_id: "10", product_id: "100", sku: "INACT-01", price: "120", stock: "5", status: "0" };
    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [product], product_skus: [inactiveSku],
      attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
    };

    const catalog = buildProductCatalogFromSource(product, tables, "fixture", {
      allowInactiveSkusForInactiveProduct: true,
    });
    expect(catalog.errors).toHaveLength(0);
    expect(catalog.fields.price).toBe(120);
    expect(catalog.fields.inventory).toBe(5);
    expect(catalog.fields.sku).toBe("INACT-01");
  });

  it("still blocks active product when allowInactiveSkusForInactiveProduct is true but product.status is 1", () => {
    const activeProduct: Row = { id: "100", store_id: "10", name: "Active Shirt with Inactive SKU", slug: "active-shirt", category_id: "1", status: "1", created_at: "2024-01-01 00:00:00", updated_at: "2024-01-01 00:00:00" };
    const inactiveSku: Row = { id: "201", store_id: "10", product_id: "100", sku: "INACT-01", price: "120", stock: "5", status: "0" };
    const tables = {
      stores: [store], currencies: [currency], categories: [category],
      products: [activeProduct], product_skus: [inactiveSku],
      attributes: [], attribute_values: [], product_attributes: [], product_variants: [],
    };

    const catalog = buildProductCatalogFromSource(activeProduct, tables, "fixture", {
      allowInactiveSkusForInactiveProduct: true,
    });
    const error = catalog.errors.find(e => e.code === "SOURCE_NO_ELIGIBLE_SKU");
    expect(error).toBeDefined();
    expect(error?.reason).toBe("ALL_LIVE_OWNED_SKUS_INACTIVE");
  });
});
