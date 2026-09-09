import { describe, expect, it } from "vitest";
import {
  assignFieldDiffRecordPageIds,
  assertReadOnlyQuery,
  getPw1ComponentShortlistItems,
  getPw1DbConfig,
} from "@/lib/admin/qa/pw1-mysql-connector";

describe("[US-F40-PW1-Connector] Read-Only Security Guardrails", () => {
  it("allows safe SELECT, SHOW, DESCRIBE and EXPLAIN queries", () => {
    expect(() => assertReadOnlyQuery("SELECT * FROM products;")).not.toThrow();
    expect(() => assertReadOnlyQuery("SELECT id, title, price FROM products WHERE store_id = 1;")).not.toThrow();
    expect(() => assertReadOnlyQuery("SHOW TABLES;")).not.toThrow();
    expect(() => assertReadOnlyQuery("SHOW COLUMNS FROM `categories`;")).not.toThrow();
    expect(() => assertReadOnlyQuery("DESCRIBE products;")).not.toThrow();
    expect(() => assertReadOnlyQuery("EXPLAIN SELECT * FROM orders;")).not.toThrow();
  });

  it("strictly blocks and rejects any INSERT mutation statements", () => {
    expect(() => assertReadOnlyQuery("INSERT INTO products (title) VALUES ('Hacked');")).toThrow(
      /SECURITY ERROR/,
    );
  });

  it("strictly blocks and rejects any UPDATE mutation statements", () => {
    expect(() => assertReadOnlyQuery("UPDATE products SET price = 0 WHERE id = 1;")).toThrow(
      /SECURITY ERROR/,
    );
  });

  it("strictly blocks and rejects any DELETE mutation statements", () => {
    expect(() => assertReadOnlyQuery("DELETE FROM products WHERE id = 1;")).toThrow(
      /SECURITY ERROR/,
    );
  });

  it("strictly blocks and rejects any DDL DROP, ALTER, TRUNCATE statements", () => {
    expect(() => assertReadOnlyQuery("DROP TABLE products;")).toThrow(/SECURITY ERROR/);
    expect(() => assertReadOnlyQuery("ALTER TABLE products ADD COLUMN hacked text;")).toThrow(
      /SECURITY ERROR/,
    );
    expect(() => assertReadOnlyQuery("TRUNCATE TABLE orders;")).toThrow(/SECURITY ERROR/);
    expect(() => assertReadOnlyQuery("CREATE TABLE rogue (id int);")).toThrow(/SECURITY ERROR/);
  });

  it("strictly blocks sneaky sub-mutations embedded in queries", () => {
    expect(() =>
      assertReadOnlyQuery("SELECT * FROM products; DELETE FROM users;"),
    ).toThrow(/SECURITY ERROR/);
  });

  it("parses PW1 configuration from environment variables", () => {
    const originalEnv = process.env.PW1_DATABASE_URL;
    try {
      process.env.PW1_DATABASE_URL = "mysql://qa_user:qa_pass@127.0.0.1:3306/legacy_db";
      const config = getPw1DbConfig();
      expect(config).toBeDefined();
      expect(config?.url).toBe("mysql://qa_user:qa_pass@127.0.0.1:3306/legacy_db");
    } finally {
      process.env.PW1_DATABASE_URL = originalEnv;
    }
  });

  it("[TC-F40-11-09] scopes PW1 entities to rendered component items without cross-page leakage", () => {
    // Arrange
    const records = [
      { id: "ent-banner-11", entityGroup: "banners" },
      { id: "ent-richtext-101", entityGroup: "richtext" },
      { id: "ent-richtext-202", entityGroup: "richtext" },
      { id: "ent-block-202", entityGroup: "blocks" },
      { id: "ent-prod-10", entityGroup: "products" },
      { id: "ent-prod-2", entityGroup: "products" },
      { id: "ent-prod-20", entityGroup: "products" },
      { id: "ent-prod-99", entityGroup: "products" },
      { id: "ent-sku-1001", entityGroup: "variants" },
      { id: "ent-cat-30", entityGroup: "categories" },
      { id: "ent-cat-31", entityGroup: "categories" },
      { id: "ent-post-40", entityGroup: "posts" },
    ];
    const pages = [
      { id: "page-1", blocks: [] },
      { id: "page-2", blocks: [] },
    ];
    const components = [
      { id: 101, page_id: 1, fc_name: "rich_text" },
      { id: 202, page_id: 2, fc_name: "rich_text" },
      { id: 301, page_id: 1, fc_name: "product_grid" },
      { id: 302, page_id: 2, fc_name: "product_grid" },
      { id: 401, page_id: 1, fc_name: "category_bar" },
      { id: 501, page_id: 2, fc_name: "blog_articles" },
    ];
    const banners = [{ id: 11, page_component_id: 101 }];

    // Act
    const scoped = assignFieldDiffRecordPageIds(records, pages, components, banners, {
      shortlistItems: [
        { page_component_id: "301", model_type: "Product", model_id: 10 },
        { page_component_id: 401, model_type: "Category", model_id: 30 },
        { page_component_id: 401, model_type: "App\\Models\\Post", model_id: 31 },
        { page_component_id: 501, model_type: "BlogPost", model_id: 40 },
      ],
      productIds: [1, 2, 3, 4, 5, 10, 20, 99],
      categoryIds: [30, 31],
      postIds: [40],
      variantProductIds: new Map([["1001", 10]]),
    });

    // Assert
    expect(scoped.find((record) => record.id === "ent-banner-11")?.pageIds).toEqual(["page-1"]);
    expect(scoped.find((record) => record.id === "ent-richtext-101")?.pageIds).toEqual(["page-1"]);
    expect(scoped.find((record) => record.id === "ent-richtext-202")?.pageIds).toEqual(["page-2"]);
    expect(scoped.find((record) => record.id === "ent-block-202")?.pageIds).toEqual(["page-2"]);
    expect(scoped.find((record) => record.id === "ent-prod-10")?.pageIds).toEqual(["page-1"]);
    expect(scoped.find((record) => record.id === "ent-sku-1001")?.pageIds).toEqual(["page-1"]);
    expect(scoped.find((record) => record.id === "ent-prod-2")?.pageIds).toEqual(["page-2"]);
    expect(scoped.find((record) => record.id === "ent-prod-20")?.pageIds).toEqual([]);
    expect(scoped.find((record) => record.id === "ent-prod-99")?.pageIds).toEqual([]);
    expect(scoped.find((record) => record.id === "ent-cat-30")?.pageIds).toEqual(["page-1"]);
    expect(scoped.find((record) => record.id === "ent-cat-31")?.pageIds).toEqual([]);
    expect(scoped.find((record) => record.id === "ent-post-40")?.pageIds).toEqual(["page-2"]);
  });

  it("[TC-F40-11-10] leaves a banner without a resolvable owner out of every page tab", () => {
    // Arrange
    const records = [{ id: "ent-banner-99", entityGroup: "banners" }];
    const pages = [{ id: "page-1", blocks: [] }, { id: "page-2", blocks: [] }];

    // Act
    const scoped = assignFieldDiffRecordPageIds(records, pages, [], [{ id: 99, page_component_id: null }], {
      shortlistItems: [],
      productIds: [],
      categoryIds: [],
      postIds: [],
      variantProductIds: new Map(),
    });

    // Assert
    expect(scoped[0].pageIds).toEqual([]);
  });

  it("[TC-F40-11-11] resolves string and numeric component IDs to the same shortlist", () => {
    // Arrange
    const shortlistItems = [
      { page_component_id: "301", model_type: "Product", model_id: "10" },
      { page_component_id: 302, model_type: "BlogPost", model_id: 40 },
    ];

    // Act
    const products = getPw1ComponentShortlistItems(shortlistItems, 301);
    const posts = getPw1ComponentShortlistItems(shortlistItems, "302");

    // Assert
    expect(products).toHaveLength(1);
    expect(products[0].model_id).toBe("10");
    expect(posts).toHaveLength(1);
    expect(posts[0].model_id).toBe(40);
  });

  it("handles invalid store ID gracefully", async () => {
    const { fetchLivePw1StoreDeepDiff } = await import("@/lib/admin/qa/pw1-mysql-connector");
    await expect(fetchLivePw1StoreDeepDiff("INVALID")).rejects.toThrow(/Invalid store ID/);
  });
});
