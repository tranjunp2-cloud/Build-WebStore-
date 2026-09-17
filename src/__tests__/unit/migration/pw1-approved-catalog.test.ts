// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  inactiveOnlyProduct,
  packageWeightKg,
} from "@/lib/migration/pw1-export/mappers/catalog-policy";
import { operationalIssues } from "@/lib/migration/pw1-export/validate-master";
import { validateProductDocument } from "@/lib/migration/pw2-product-migration.mjs";
import { buildProductCatalogFromSource } from "@/lib/migration/pw2-product-eav.mjs";
import {
  emptyStore,
  type MigrationPolicy,
  type Row,
} from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCatalog } from "@/lib/migration/pw1-export/mappers/catalog";
import { mapContent } from "@/lib/migration/pw1-export/mappers/content";

const policy: MigrationPolicy = {
  decisionEvidence: "approved fixture",
  activeCatalogOnly: true,
  deferEmailTemplates: true,
  allowSparseVariants: true,
  preserveUserCreators: true,
  siteTypeDefault: "ecommerce",
  siteTypeOverrides: {},
  shippingPolicy: "pw2-defaults",
};
function context(tables: Record<string, Row[]>, approved = true, overrides: Partial<MigrationPolicy> = {}) {
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
    ...(approved ? { migrationPolicy: { ...policy, ...overrides } } : {}),
  });
  const output = emptyStore();
  output.sites.push({ _ref: "@sites:stores:10" });
  return new SourceIndex(tables).context(config, "10", output, [], []);
}
const product = {
  id: "1",
  store_id: "10",
  name: "Item",
  slug: "item",
  category_id: "2",
  created_at: "2024-01-01 00:00:00",
  updated_at: "2024-01-01 00:00:00",
};
const sku = {
  id: "3",
  product_id: "1",
  store_id: "10",
  status: "1",
  sku: "item",
  price: "10",
  stock: "2",
};
const category = {
  id: "2",
  store_id: "10",
  name: "Category",
  slug: "category",
  status: "0",
  created_at: "2024-01-01 00:00:00",
  updated_at: "2024-01-01 00:00:00",
};

describe("[TC-F42-066] Approved active catalog", () => {
  it("detaches an owned inactive category but retains a valid product", () => {
    // Arrange
    const ctx = context({
      stores: [{ id: "10", currency_id: "1" }],
      currencies: [{ id: "1", code: "MYR" }],
      products: [product],
      product_skus: [sku],
      categories: [category],
    });
    // Act
    mapCatalog(ctx);
    // Assert
    expect(ctx.output.categories).toEqual([]);
    expect(ctx.output.products, JSON.stringify(ctx.diagnostics)).toHaveLength(
      1,
    );
    expect(ctx.output.products[0].category).toEqual([]);
    expect(
      validateProductDocument(ctx.output.products[0]).map((row) => row.code),
    ).toContain("CATEGORY_CARDINALITY_INVALID");
    expect(
      validateProductDocument(ctx.output.products[0], {
        allowEmptyCategory: true,
      }),
    ).toEqual([]);
  });
  it("requires explicit active-catalog policy for empty category in operational artifacts", () => {
    // Arrange
    const store = emptyStore();
    store.tenants.push({
      _ref: "@tenants:stores:10",
      metaData: { pw1StoreId: "10" },
    });
    store.sites.push({
      _ref: "@sites:stores:10",
      tenant: "@tenants:stores:10",
    });
    store.products.push({
      _ref: "@products:products:1",
      tenant: "@tenants:stores:10",
      site: "@sites:stores:10",
      category: [],
    });
    // Act / Assert
    expect(operationalIssues([store])).toContainEqual(
      expect.objectContaining({
        code: "PRODUCT_EMPTY_CATEGORY_POLICY_REQUIRED",
      }),
    );
    expect(
      operationalIssues([store], undefined, {
        ...policy,
        activeCatalogOnly: false,
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: "PRODUCT_EMPTY_CATEGORY_POLICY_REQUIRED",
      }),
    );
    expect(operationalIssues([store], undefined, policy)).toEqual([]);
  });
  it("does not mistake missing or foreign SKUs for an intentional inactive exclusion", () => {
    // Arrange
    const inactive = { ...sku, status: "0" };
    // Act / Assert
    expect(inactiveOnlyProduct(product, [inactive])).toBe(true);
    expect(inactiveOnlyProduct(product, [])).toBe(false);
    expect(
      inactiveOnlyProduct(product, [inactive, { ...sku, store_id: "99" }]),
    ).toBe(false);
  });
  it.each(["99", "missing"])("retains quarantine for category %s", (owner) => {
    // Arrange
    const ctx = context({
      products: [product],
      product_skus: [sku],
      categories: owner === "missing" ? [] : [{ ...category, store_id: owner }],
      stores: [{ id: "10", currency_id: "1" }],
      currencies: [{ id: "1", code: "MYR" }],
    });
    // Act
    mapCatalog(ctx);
    // Assert
    expect(ctx.output.products).toEqual([]);
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({code: "CATEGORY_REFERENCE_UNRESOLVED", severity: "blocker", sourceId: "1"}));
  });
});

describe('[TC-F42-066] Inactive category ancestry', () => {
  it('quarantines an active child whose inactive parent was excluded instead of flattening its ancestry', () => {
    // Arrange
    const ctx = context({categories:[category,{...category,id:'3',slug:'child',name:'Child',status:'1',parent_id:'2'}]})
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.categories).toEqual([])
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({code:'CATEGORY_INVALID',sourceId:'3',reason:'PARENT_MISSING_OR_NOT_LIVE_IN_STORE',severity:'blocker'}))
  })
})

describe("[TC-F42-067] Weight conversion and sparse tuples", () => {
  it.each([
    ["300", "2", 0.3],
    ["1.5", "1", 1.5],
    ["0", "2", 0],
  ])("converts %s unit %s to kilograms", (weight, unit, expected) => {
    // Arrange / Act
    const actual = packageWeightKg({
      package_weight: weight,
      package_weight_type: unit,
    });
    // Assert
    expect(actual).toBe(expected);
  });
  it.each([
    ["300", ""],
    ["300", "3"],
    ["garbage", "1"],
    ["-2", "1"],
  ])("rejects ambiguous weight %s unit %s", (weight, unit) => {
    // Arrange / Act / Assert
    expect(() =>
      packageWeightKg({ package_weight: weight, package_weight_type: unit }),
    ).toThrow();
  });
  it("allows approved sparse tuples without creating absent variants and keeps legacy quarantine", () => {
    // Arrange
    const tables = {
      product_skus: [sku],
      attributes: [{ id: "4", store_id: "10", name: "Size" }],
      attribute_values: [
        { id: "5", store_id: "10", attribute_id: "4", name: "Small" },
        { id: "6", store_id: "10", attribute_id: "4", name: "Large" },
      ],
      product_attributes: [
        {
          id: "7",
          product_id: "1",
          attribute_id: "4",
          attribute_value_id: "5",
        },
        {
          id: "8",
          product_id: "1",
          attribute_id: "4",
          attribute_value_id: "6",
        },
      ],
      product_variants: [
        {
          id: "9",
          product_sku_id: "3",
          attribute_id: "4",
          attribute_value_id: "5",
        },
      ],
    };
    // Act
    const approved = buildProductCatalogFromSource(product, tables, "fixture", {
      allowSparseVariants: true,
    });
    const legacy = buildProductCatalogFromSource(product, tables, "fixture");
    // Assert
    expect(approved.errors).toEqual([]);
    expect(approved.fields.variants).toHaveLength(1);
    expect(approved.skuCrosswalk.map((row) => row.sourceSkuId)).toEqual(["3"]);
    expect(legacy.errors.map((row) => row.code)).toContain(
      "SOURCE_SPARSE_VARIANT_MATRIX",
    );
  });
});

describe("[TC-F42-070] Email deferral", () => {
  it("does not emit or mark email source fields mapped", () => {
    // Arrange
    const ctx = context({
      store_email_templates: [
        { id: "1", store_id: "10", type_id: "4", status: "1" },
      ],
    });
    // Act
    mapContent(ctx);
    // Assert
    expect(ctx.output["email-template-settings"]).toEqual([]);
    expect(
      ctx.contributions.filter((row) => row.table === "store_email_templates"),
    ).toEqual([]);
    expect(
      ctx.diagnostics.filter((row) => row.code.startsWith("EMAIL_")),
    ).toEqual([]);
  });
});


describe("[TC-F42-073] Approved inactive-parent promotion", () => {
  const child = { ...category, id: "4", name: "Child", slug: "child", status: "1", parent_id: "2" };
  const promotion = { promoteActiveCategoriesToRoot: true };
  it("retains a child and its Product, with descendants using the new root breadcrumb", () => {
    // Arrange
    const ctx = context({
      categories: [category, child, { ...child, id: "5", name: "Grandchild", slug: "grandchild", parent_id: "4" }],
      products: [{ ...product, category_id: "4" }], product_skus: [sku],
      stores: [{ id: "10", currency_id: "1" }], currencies: [{ id: "1", code: "MYR" }],
    }, true, promotion);
    // Act
    mapCatalog(ctx);
    // Assert
    expect(ctx.output.categories).toHaveLength(2);
    expect(ctx.output.categories[0]).toMatchObject({ _ref: "@categories:categories:4", breadcrumbs: "Child" });
    expect(ctx.output.categories[0]).not.toHaveProperty("parent");
    expect(ctx.output.categories[1]).toMatchObject({ parent: "@categories:categories:4", breadcrumbs: "Child > Grandchild" });
    expect(ctx.output.products).toHaveLength(1);
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: "CATEGORY_INACTIVE_PARENT_PROMOTED", sourceId: "4", severity: "warning" }));
  });
  it.each(["missing", "deleted", "foreign"])("does not promote when parent is %s", (kind) => {
    // Arrange
    const parent = kind === "deleted" ? { ...category, deleted_at: "2025-01-01" } : { ...category, store_id: "99" };
    const ctx = context({ categories: kind === "missing" ? [child] : [parent, child] }, true, promotion);
    // Act
    mapCatalog(ctx);
    // Assert
    expect(ctx.output.categories).toEqual([]);
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: "CATEGORY_INVALID", sourceId: "4", reason: "PARENT_MISSING_OR_NOT_LIVE_IN_STORE" }));
  });
  it("quarantines name collisions introduced at the root and their descendants", () => {
    // Arrange
    const ctx = context({ categories: [category, child,
      { ...child, id: "6", slug: "other-root", parent_id: "0" },
      { ...child, id: "7", name: "Descendant", slug: "descendant", parent_id: "4" },
    ] }, true, promotion);
    // Act
    mapCatalog(ctx);
    // Assert
    expect(ctx.output.categories).toEqual([]);
    expect(ctx.diagnostics.filter((row) => row.reason === "DUPLICATE_SIBLING_NAME").map((row) => row.sourceId)).toEqual(["4", "6"]);
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: "CATEGORY_PARENT_QUARANTINED", sourceId: "7" }));
  });
});
