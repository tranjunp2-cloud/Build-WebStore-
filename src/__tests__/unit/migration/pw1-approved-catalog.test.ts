import { historicalOrderItem } from '@/lib/migration/pw1-export/mappers/commerce'
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
  status: "1",
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

describe('[TC-F42-EXP-095] Reconcile variant definitions from real SKU selections', () => {
  function tables(): Record<string, Row[]> {
    return {
      stores: [{ id: '10', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }],
      products: [product], categories: [{ ...category, status: '1' }],
      product_skus: [sku, { ...sku, id: '4', sku: 'other', stock: '3' }],
      attributes: [{ id: '5', store_id: '10', name: 'Size' }],
      attribute_values: [{ id: '6', store_id: '10', attribute_id: '5', name: 'S' }, { id: '7', store_id: '10', attribute_id: '5', name: 'M' }],
      product_attributes: [{ id: '8', product_id: '1', attribute_id: '5', attribute_value_id: '6' }],
      product_variants: [{ id: '9', product_sku_id: '3', attribute_id: '5', attribute_value_id: '6' }, { id: '10', product_sku_id: '4', attribute_id: '5', attribute_value_id: '7' }],
    }
  }
  it.each([false, true])('recovers valid selected definitions when entire domain missing=%s', missing => {
    // Arrange
    const source = tables()
    if (missing) source.product_attributes = []
    const ctx = context(source)
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products, JSON.stringify(ctx.diagnostics)).toHaveLength(1)
    expect(ctx.output.products[0].variants).toHaveLength(2)
    expect(ctx.output.products[0].inventory).toBe(5)
    expect(ctx.output.products[0].variantConfigs).toEqual([{ name: 'Size', options: [{ value: 'S' }, { value: 'M' }] }])
    expect(ctx.contributions).toEqual(expect.arrayContaining([expect.objectContaining({ table: 'attribute_values', sourceId: '7', rule: 'master-16-eav-definition' })]))
    expect(source.product_skus).toHaveLength(2)
    expect(source.product_attributes).toHaveLength(missing ? 0 : 1)
  })
  it.each(['foreign', 'deleted', 'wrong-attribute'])('rejects %s definition instead of inventing ownership', kind => {
    // Arrange
    const source = tables()
    if (kind === 'foreign') source.attribute_values[1].store_id = '11'
    if (kind === 'deleted') source.attribute_values[1].deleted_at = '2020-01-01'
    if (kind === 'wrong-attribute') source.attribute_values[1].attribute_id = '99'
    // Act
    const result = buildProductCatalogFromSource(product, source, 'fixture', { allowSparseVariants: true })
    // Assert
    expect(result.errors.some(e => e.code === 'SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH')).toBe(true)
  })
  it('keeps real duplicate tuples blocked and does not merge stock', () => {
    // Arrange
    const source = tables(); source.product_variants[1].attribute_value_id = '6'
    // Act
    const ctx = context(source); mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toEqual([])
    expect(ctx.diagnostics.some(d => d.code === 'SOURCE_DUPLICATE_VARIANT_TUPLE')).toBe(true)
  })
  it('reports missing selections without falsely calling empty tuples duplicates', () => {
    // Arrange
    const source = tables(); source.product_variants = []
    // Act
    const result = buildProductCatalogFromSource(product, source, 'fixture', { allowSparseVariants: true })
    // Assert
    expect(result.errors.some(e => e.code === 'SOURCE_SELECTED_TIER_COUNT')).toBe(true)
    expect(result.errors.some(e => e.code === 'SOURCE_DUPLICATE_VARIANT_TUPLE')).toBe(false)
  })
})


describe('[TC-F42-EXP-096] Exclusion boundaries and historical Orders', () => {
  it('keeps historical line values when its current Product has missing stock', () => {
    // Arrange
    const ctx=context({stores:[{id:'10',currency_id:'1'}],currencies:[{id:'1',code:'MYR'}],products:[product],product_skus:[{...sku,stock:''}],categories:[category]},true,{preserveHistoricalOrders:true})
    // Act
    mapCatalog(ctx)
    const item=historicalOrderItem(ctx,{id:'90',store_id:'10',product_sku_id:'3',name:'Historical name',quantity:'2',price:'23.50'},'MYR')
    // Assert
    expect(ctx.output.products).toEqual([])
    expect(item).toMatchObject({productName:'Historical name',quantity:2,unitPrice:23.5})
    expect(item).not.toHaveProperty('product')
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({code:'ORDER_ITEM_CATALOG_REFERENCE_OMITTED',severity:'warning'}))
  })
  it.each([{price:'-1',stock:''},{price:'invalid',stock:''},{price:'',stock:'-1'},{price:'',stock:'1.5'},{price:'',stock:'2',store_id:'99'},{price:'',stock:'2',status:'9'}])('does not waive invalid numeric values or ownership/status: %j', change => {
    // Arrange
    const ctx=context({stores:[{id:'10',currency_id:'1'}],currencies:[{id:'1',code:'MYR'}],products:[product],product_skus:[{...sku,...change}],categories:[category]})
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toEqual([])
    expect(ctx.diagnostics.some(d=>d.code==='PRODUCT_MISSING_PRICE_STOCK_EXCLUDED')).toBe(false)
    expect(ctx.diagnostics.some(d=>d.severity==='blocker')).toBe(true)
  })
})

describe('[TC-F42-EXP-100] Canonical tuple inventory and partial invalid selections', () => {
  const tables = () => ({
    product_skus: [sku, {...sku,id:'4',sku:'alias',price:'1',stock:'99'}],
    attributes: [{id:'5',store_id:'10',name:'Size'}],
    attribute_values: [{id:'6',store_id:'10',attribute_id:'5',name:'S'}],
    product_attributes: [{id:'7',product_id:'1',attribute_id:'5',attribute_value_id:'6'}],
    product_variants: [{id:'8',product_sku_id:'3',attribute_id:'5',attribute_value_id:'6'},{id:'9',product_sku_id:'4',attribute_id:'5',attribute_value_id:'6'}],
  })
  it('uses numeric canonical SKU price and stock once regardless of CSV order', () => {
    // Arrange
    const source=tables(); source.product_skus.reverse()
    // Act
    const result=buildProductCatalogFromSource(product,source,'fixture',{allowSparseVariants:true,resolveDuplicateVariantTuples:true})
    // Assert
    expect(result.errors).toEqual([])
    expect(result.fields).toMatchObject({price:10,inventory:2})
    expect(result.skuCrosswalk).toHaveLength(2)
    expect(result.warnings).toEqual([{code:'DUPLICATE_VARIANT_TUPLE_RESOLVED',sourceSkuId:'4',canonicalSourceSkuId:'3'}])
  })
  it('excludes a SKU with missing selections but retains the valid variant', () => {
    // Arrange
    const source=tables(); source.product_variants.pop()
    // Act
    const result=buildProductCatalogFromSource(product,source,'fixture',{allowSparseVariants:true,pruneInvalidVariantSkus:true})
    // Assert
    expect(result.errors).toEqual([])
    expect(result.fields).toMatchObject({price:10,inventory:2})
    expect(result.excludedSkus).toEqual([{sourceSkuId:'4',reasons:['SOURCE_SELECTED_TIER_COUNT','MISSING_SELECTION']}])
  })
  it('quarantines when all selections are missing and never waives foreign ownership', () => {
    // Arrange
    const source=tables(); source.product_variants=[]
    // Act
    const result=buildProductCatalogFromSource(product,source,'fixture',{allowSparseVariants:true,pruneInvalidVariantSkus:true})
    source.product_skus[1].store_id='99'
    const foreign=buildProductCatalogFromSource(product,source,'fixture',{allowSparseVariants:true,pruneInvalidVariantSkus:true})
    // Assert
    expect(result.errors.map(e=>e.code)).toContain('SOURCE_NO_VALID_VARIANT')
    expect(foreign.errors.map(e=>e.code)).toContain('SOURCE_SKU_OWNER_MISMATCH')
  })
})

describe('[TC-F42-EXP-100] Inactive SKU mapping consistency', () => {
  it('retains an inactive Product using its inactive SKU and records that SKU contribution', () => {
    // Arrange
    const ctx=context({stores:[{id:'10',currency_id:'1'}],currencies:[{id:'1',code:'MYR'}],products:[{...product,status:'0'}],product_skus:[{...sku,status:'0'}],categories:[category]},true,{allowInactiveSkusForInactiveProduct:true})
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(ctx.output.products[0]).toMatchObject({status:'draft',inventory:2,price:10})
    expect(ctx.contributions).toContainEqual(expect.objectContaining({table:'product_skus',sourceId:'3'}))
  })
})

describe('TC-F42-EXP-104: explicit Product exclusions', () => {
  const base = () => ({ stores: [{ id: '10', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }], categories: [category], products: [product], product_skus: [sku] })
  it.each([false, true])('keeps lowest numeric Product ID for normalized slug (reversed=%s)', reverse => {
    // Arrange
    const tables = base()
    tables.products = [{ ...product, id: '100', slug: ' ITEM ' }, { ...product, id: '9' }, { ...product, id: '8', store_id: '99' }]
    tables.product_skus = [{ ...sku, product_id: '9' }, { ...sku, id: '4', product_id: '100', sku: 'OTHER' }]
    if (reverse) tables.products.reverse()
    const ctx = context(tables, true, { excludeDuplicateProductSlugs: true })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products.map(p => p._ref)).toEqual(['@products:products:9'])
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'PRODUCT_CATALOG_POLICY_EXCLUDED', sourceId: '100', severity: 'warning', reason: 'DUPLICATE_PRODUCT_SLUG' }))
    expect(ctx.contributions.some(c => c.table === 'products' && c.sourceId === '100')).toBe(false)
  })
  it('excludes variant Product missing a domain while retaining simple Products', () => {
    // Arrange
    const tables = base()
    tables.products.push({ ...product, id: '2', slug: 'simple' })
    tables.product_skus.push({ ...sku, id: '4', sku: 'OTHER' }, { ...sku, id: '5', product_id: '2', sku: 'SIMPLE' })
    const ctx = context(tables, true, { excludeProductsWithoutValidVariants: true })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products.map(p => p._ref)).toEqual(['@products:products:2'])
    expect(ctx.output.products[0].hasVariants).toBe(false)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'PRODUCT_CATALOG_POLICY_EXCLUDED', sourceId: '1', reason: 'MISSING_VARIANT_DOMAIN', severity: 'warning' }))
  })
  it.each([false, true])('all invalid variant selections excluded only without ownership errors (foreign=%s)', foreign => {
    // Arrange
    const tables = { ...base(), attributes: [{ id: '5', store_id: '10', name: 'Size' }], attribute_values: [{ id: '6', store_id: '10', attribute_id: '5', name: 'S' }], product_attributes: [{ id: '7', product_id: '1', attribute_id: '5', attribute_value_id: '6' }], product_variants: [] }
    if (foreign) tables.product_skus.push({ ...sku, id: '4', store_id: '99' })
    const ctx = context(tables, true, { pruneInvalidVariantSkus: true, excludeProductsWithoutValidVariants: true })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toEqual([])
    if (foreign) {
      expect(ctx.diagnostics.some(d => d.code === 'SOURCE_SKU_OWNER_MISMATCH' && d.severity === 'blocker')).toBe(true)
      expect(ctx.diagnostics.some(d => d.code === 'PRODUCT_CATALOG_POLICY_EXCLUDED')).toBe(false)
    } else expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'PRODUCT_CATALOG_POLICY_EXCLUDED', reason: 'NO_VALID_VARIANTS', severity: 'warning' }))
  })
})

describe('TC-F42-EXP-105: invalid source record rollback', () => {
  it('removes a source-invalid Product and its newly-created media/contributions', () => {
    // Arrange
    const ctx = context({ stores: [{ id: '10', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }], categories: [category], products: [{ ...product, name: 'x' }], product_skus: [sku], product_images: [{ id: '9', product_id: '1', url: 'https://example.test/image.png', created_at: product.created_at, updated_at: product.updated_at }] }, true, { excludeInvalidProducts: true })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toEqual([])
    expect(ctx.output.media).toEqual([])
    expect(ctx.contributions.some(c => ['products', 'product_images'].includes(c.table))).toBe(false)
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SOURCE_ENTITY_EXCLUDED', table: 'products', sourceId: '1', reason: 'PRODUCT_NAME_TOO_SHORT' }))
  })
  it('keeps an unexpected programming exception as a blocker without leaking its message', () => {
    // Arrange
    const ctx = context({ stores: [{ id: '10', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }], products: [product], product_skus: [sku] }, true, { excludeInvalidProducts: true })
    const find = ctx.find
    ctx.find = (table, id) => { if (table === 'categories') throw new TypeError('PRIVATE_ERROR_CANARY'); return find(table, id) }
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'PRODUCT_MAPPING_INVALID', severity: 'blocker', reason: 'UNEXPECTED_MAPPING_ERROR' }))
    expect(ctx.diagnostics.some(d => d.code === 'SOURCE_ENTITY_EXCLUDED')).toBe(false)
    expect(JSON.stringify(ctx.diagnostics)).not.toContain('PRIVATE_ERROR_CANARY')
  })
})

describe('[TC-F42-EXP-109] Products in inactive categories are omitted explicitly', () => {
  function source(categories: Row[] = [category]) {
    return { stores: [{ id: '10', currency_id: '1' }], currencies: [{ id: '1', code: 'MYR' }], products: [product], product_skus: [sku], categories }
  }
  it('omits the whole Product without contributions and preserves historical Order snapshot values', () => {
    // Arrange
    const ctx = context(source(), true, { excludeProductsInInactiveCategories: true, preserveHistoricalOrders: true })
    // Act
    mapCatalog(ctx)
    const item = historicalOrderItem(ctx, { id: '91', store_id: '10', product_sku_id: '3', name: 'Original historical item', quantity: '3', price: '23.50', variant: 'Original selection' }, 'MYR')
    // Assert
    expect(ctx.output.products).toEqual([])
    expect(ctx.output.media).toEqual([])
    expect(ctx.contributions.filter(c => c.table === 'products' || c.table === 'product_skus')).toEqual([])
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'PRODUCT_CATALOG_POLICY_EXCLUDED', table: 'products', sourceId: '1', severity: 'warning', reason: 'INACTIVE_CATEGORY' }))
    expect(ctx.diagnostics.some(d => d.code === 'PRODUCT_INACTIVE_CATEGORY_OMITTED' || d.severity === 'blocker')).toBe(false)
    expect(item).toMatchObject({ productName: 'Original historical item', quantity: 3, unitPrice: 23.5, variant: 'Original selection' })
    expect(item).not.toHaveProperty('product')
  })
  it('retains historical policy behavior when the new omission flag is absent', () => {
    // Arrange
    const ctx = context(source())
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(ctx.diagnostics.some(d => d.reason === 'INACTIVE_CATEGORY')).toBe(false)
  })
  it('keeps a Product whose category is active', () => {
    // Arrange
    const ctx = context(source([{ ...category, status: '1' }]), true, { excludeProductsInInactiveCategories: true })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.output.products).toHaveLength(1)
    expect(ctx.diagnostics.some(d => d.reason === 'INACTIVE_CATEGORY')).toBe(false)
  })
  it.each([
    ['missing', []],
    ['deleted', [{ ...category, deleted_at: '2025-01-01 00:00:00' }]],
    ['foreign', [{ ...category, store_id: '99' }]],
    ['unknown status', [{ ...category, status: '9' }]],
  ] as const)('does not disguise %s category problems as approved inactive omission', (_name, categories) => {
    // Arrange
    const ctx = context(source([...categories]), true, { excludeProductsInInactiveCategories: true })
    // Act
    mapCatalog(ctx)
    // Assert
    expect(ctx.diagnostics.some(d => d.reason === 'INACTIVE_CATEGORY')).toBe(false)
    expect(ctx.diagnostics.some(d => d.severity === 'blocker')).toBe(true)
  })
})
