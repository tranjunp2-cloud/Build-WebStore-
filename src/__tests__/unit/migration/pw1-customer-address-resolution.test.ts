// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapCommerce } from "@/lib/migration/pw1-export/mappers/commerce";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "customer-address-fixture",
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

describe("Customer address overflow and invalid geography resolution", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const country = { id: "1", name: "Malaysia" };
  const province = { id: "10", country_id: "1", name: "Kuala Lumpur" };
  const dates = {
    created_at: "2025-01-01 00:00:00",
    updated_at: "2025-01-02 00:00:00",
  };

  const customer: Row = {
    id: "40",
    store_id: "10",
    name: "VIP Buyer",
    email: "vip@test.local",
    phone: "+60123456789",
    ...dates,
  };

  it('TC-F42-079: records emitted and deduplicated Customer address coverage even when related Orders are omitted', () => {
    // Arrange: the Orders are invalid, but their valid Customer addresses are retained.
    const ctx = createContext({
      stores: [store], currencies: [currency], countries: [country], provinces: [province],
      customers: [customer],
      addresses: ['600', '601'].map(id => ({ id, store_id: '10', address: 'Same street', country_id: '1', province_id: '10', ...dates })),
      orders: ['600', '601'].map((addressId, index) => ({
        id: String(500 + index), store_id: '10', customer_id: '40', customer_name: 'VIP Buyer',
        code: `ORDER-${index}`, currency_id: '1', payment_method_id: '1',
        shipping_address_id: addressId, billing_address_id: addressId,
        status: 'unknown', purchase_status: '1', ...dates,
      })),
      payment_methods: [{ id: '1', code: 'cod' }],
    }, { skipUnverifiedOrders: true, preserveHistoricalOrders: true })

    // Act
    mapCommerce(ctx)

    // Assert: one target address, two source rows covered, no duplicate receipts per usage.
    expect(ctx.output.orders).toEqual([])
    expect(ctx.output.customers[0].addresses).toHaveLength(1)
    const receipts = ctx.contributions.filter(c => c.table === 'addresses')
    expect(receipts).toHaveLength(2)
    expect(receipts.map(c => c.sourceId).sort()).toEqual(['600', '601'])
    for (const receipt of receipts) {
      expect(receipt.targetPath).toBe('@customers:customers:40.addresses.0')
      expect(receipt.rule).toBe('master-6-customer-address')
      expect(receipt.fields).toEqual(expect.arrayContaining(['address', 'country_id', 'province_id']))
      expect(receipt.fields).not.toContain('created_at')
    }
    expect(ctx.diagnostics.some(d => d.code === 'CUSTOMER_COHORT_INVALID')).toBe(false)
  })

  it("treats CUSTOMER_ADDRESS_OVERFLOW as blocker by default, and demotes to warning when allowCustomerAddressOverflow is true", () => {
    // 11 distinct addresses for this customer across 11 orders
    const orders: Row[] = Array.from({ length: 11 }, (_, i) => ({
      id: String(500 + i),
      store_id: "10",
      customer_id: "40",
      customer_name: "VIP Buyer",
      code: `ORD-${500 + i}`,
      currency_id: "1",
      payment_method_id: "1",
      shipping_address_id: String(600 + i),
      total_weight: "1.000",
      sub_total: "100",
      total: "100",
      status: "1",
      purchase_status: "1",
      ...dates,
    }));

    const addresses: Row[] = Array.from({ length: 11 }, (_, i) => ({
      id: String(600 + i),
      store_id: "10",
      address: `Street ${i}`,
      country_id: "1",
      province_id: "10",
      ...dates,
    }));

    const orderDetails: Row[] = Array.from({ length: 11 }, (_, i) => ({
      id: String(700 + i),
      order_id: String(500 + i),
      store_id: "10",
      name: "Item",
      quantity: "1",
      price: "100",
    }));

    const tables = {
      stores: [store],
      currencies: [currency],
      countries: [country],
      provinces: [province],
      districts: [],
      wards: [],
      payment_methods: [{ id: "1", code: "cod" }],
      customers: [customer],
      orders,
      addresses,
      order_details: orderDetails,
      ranks: [],
      promotions: [],
      promotion_codes: [],
    };

    // 1. Strict mode (default)
    const strictCtx = createContext(tables, { allowCustomerAddressOverflow: false });
    mapCommerce(strictCtx);

    expect(strictCtx.output.customers[0].addresses).toHaveLength(10);
    const strictOverflow = strictCtx.diagnostics.find(d => d.code === "CUSTOMER_ADDRESS_OVERFLOW");
    expect(strictOverflow).toBeDefined();
    expect(strictOverflow?.severity).toBe("blocker");

    // 2. Permissive mode (allowCustomerAddressOverflow: true)
    const permissiveCtx = createContext(tables, { allowCustomerAddressOverflow: true });
    mapCommerce(permissiveCtx);

    expect(permissiveCtx.output.customers[0].addresses).toHaveLength(10);
    expect(permissiveCtx.output.customers[0].addresses[0].line1).toBe('Street 10');
    expect(permissiveCtx.output.customers[0].addresses[9].line1).toBe('Street 1');
    const permissiveOverflow = permissiveCtx.diagnostics.find(d => d.code === "CUSTOMER_ADDRESS_OVERFLOW");
    expect(permissiveOverflow).toBeDefined();
    expect(permissiveOverflow?.severity).toBe("warning");
  });

  it("handles broken geography addresses as warning and exports order with fallback when allowInvalidCustomerAddresses is true", () => {
    // Address with province pointing to non-existent or mismatched country
    const brokenAddress: Row = {
      id: "999",
      store_id: "10",
      address: "123 Legacy Street",
      country_id: "1",
      province_id: "9999", // Broken reference!
      ...dates,
    };

    const orderWithBrokenAddress: Row = {
      id: "800",
      store_id: "10",
      customer_id: "40",
      customer_name: "VIP Buyer",
      code: "ORD-800",
      currency_id: "1",
      payment_method_id: "1",
      shipping_address_id: "999",
      total_weight: "1.000",
      sub_total: "100.00",
      total_shipping: "0",
      total_discount: "0",
      total_tax: "0",
      total: "100.00",
      status: "1",
      purchase_status: "1",
      ...dates,
    };

    const orderDetail: Row = {
      id: "900",
      order_id: "800",
      store_id: "10",
      name: "Item",
      quantity: "1",
      price: "100.00",
    };

    const brokenTables = {
      stores: [store],
      currencies: [currency],
      countries: [country],
      provinces: [province],
      districts: [],
      wards: [],
      payment_methods: [{ id: "1", code: "cod" }],
      customers: [customer],
      orders: [orderWithBrokenAddress],
      addresses: [brokenAddress],
      order_details: [orderDetail],
      ranks: [],
      promotions: [],
      promotion_codes: [],
    };

    // 1. Strict mode: blocks customer address and throws ORDER_ADDRESS_GEOGRAPHY
    const strictCtx = createContext(brokenTables, {
      allowInvalidCustomerAddresses: false,
      preserveHistoricalOrders: true,
    });
    mapCommerce(strictCtx);

    const strictIssue = strictCtx.diagnostics.find(d => d.code === "CUSTOMER_ADDRESS_INVALID_SOURCE_ADDRESS");
    expect(strictIssue).toBeDefined();
    expect(strictIssue?.severity).toBe("blocker");

    // Order was rejected because ORDER_ADDRESS_GEOGRAPHY was thrown
    expect(strictCtx.output.orders).toHaveLength(0);
    expect(strictCtx.diagnostics.some(d => d.code === "ORDER_ADDRESS_GEOGRAPHY")).toBe(true);

    // 2. Permissive mode: warns and exports order with fallback address
    const permissiveCtx = createContext(brokenTables, {
      allowInvalidCustomerAddresses: true,
      preserveHistoricalOrders: true,
    });
    mapCommerce(permissiveCtx);

    const permissiveIssue = permissiveCtx.diagnostics.find(d => d.code === "CUSTOMER_ADDRESS_INVALID_SOURCE_ADDRESS");
    expect(permissiveIssue).toBeDefined();
    expect(permissiveIssue?.severity).toBe("warning");

    // Order is saved!
    expect(permissiveCtx.output.orders).toHaveLength(1);
    expect(permissiveCtx.output.orders[0].shippingAddress).toMatchObject({
      line1: "123 Legacy Street",
      country: "Malaysia",
    });
    expect(permissiveCtx.diagnostics.some(d => d.code === "ORDER_ADDRESS_GEOGRAPHY_FALLBACK")).toBe(true)
    // TC-F42-EXP-101: preserve missing source values without PW2 country defaults.
    const missingCtx = createContext({ ...brokenTables, countries: [], addresses: [{ ...brokenAddress, address: null }] }, {
      allowInvalidCustomerAddresses: true, preserveHistoricalOrders: true,
    });
    mapCommerce(missingCtx);
    expect(missingCtx.output.orders).toHaveLength(1);
    expect(missingCtx.output.orders[0].shippingAddress).toMatchObject({ line1: null, country: null });
    expect(missingCtx.output.orders[0].shippingAddress).not.toHaveProperty('state');
;
  });
});
