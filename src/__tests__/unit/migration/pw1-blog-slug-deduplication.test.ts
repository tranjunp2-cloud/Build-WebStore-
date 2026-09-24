// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapContent } from "@/lib/migration/pw1-export/mappers/content";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "blog-slug-dedupe-fixture",
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
  output.users.push({
    _ref: "@users:users:999",
    tenants: [{ tenant: "@tenants:stores:10", role: "owner" }],
  });
  return new SourceIndex(tables).context(config, "10", output, [], []);
}

describe("Blog category slug deduplication (resolveDuplicateBlogCategorySlugs)", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const user = { id: "999", store_id: "10", email: "owner@test.local", name: "Owner" };
  const dates = {
    created_at: "2025-01-01 00:00:00",
    updated_at: "2025-01-02 00:00:00",
  };

  // 2 blog categories with the same slug "tin-tuc" in Store 10
  const cat1: Row = { id: "201", store_id: "10", name: "Tin Tức Công Nghệ", slug: "tin-tuc", status: "1", ...dates };
  const cat2: Row = { id: "208", store_id: "10", name: "Tin Tức Thời Trang", slug: "tin-tuc", status: "1", ...dates };

  const blog1: Row = { id: "301", store_id: "10", blog_category_id: "201", name: "Tin AI", slug: "tin-ai", status: "1", created_by: "999", content: "<p>AI</p>", ...dates };
  const blog2: Row = { id: "302", store_id: "10", blog_category_id: "208", name: "Tin Áo", slug: "tin-ao", status: "1", created_by: "999", content: "<p>Áo</p>", ...dates };

  const tables = {
    stores: [store], currencies: [currency], users: [user],
    blog_categories: [cat1, cat2],
    blog_posts: [blog1, blog2],
  };

  it("blocks duplicate blog category slugs and fails blog references when resolveDuplicateBlogCategorySlugs is false", () => {
    const ctx = createContext(tables, { resolveDuplicateBlogCategorySlugs: false });
    mapContent(ctx);

    // Both categories are rejected due to BLOG_SLUG_COLLISION
    expect(ctx.output.blog_categories).toHaveLength(0);
    expect(ctx.diagnostics.filter(d => d.code === "BLOG_SLUG_COLLISION" && d.table === "blog_categories")).toHaveLength(2);

    // Blogs fail to resolve category references
    expect(ctx.diagnostics.filter(d => d.code === "BLOG_CATEGORY_UNRESOLVED")).toHaveLength(2);
  });

  it("resolves duplicate blog category slug with -BC{id} and rescues referenced blogs when resolveDuplicateBlogCategorySlugs is true", () => {
    const ctx = createContext(tables, { resolveDuplicateBlogCategorySlugs: true });
    mapContent(ctx);

    // Both categories exported
    expect(ctx.output.blog_categories).toHaveLength(2);

    const out1 = ctx.output.blog_categories.find(c => c._ref === "@blog_categories:blog_categories:201");
    const out2 = ctx.output.blog_categories.find(c => c._ref === "@blog_categories:blog_categories:208");

    expect(out1).toBeDefined();
    expect(out2).toBeDefined();

    // First retains original slug, second gets -BC208
    expect(out1?.slug).toBe("tin-tuc");
    expect(out2?.slug).toBe("tin-tuc-BC208");

    // Audit warning on cat2
    const warning = ctx.diagnostics.find(d => d.code === "BLOG_CATEGORY_SLUG_COLLISION_RESOLVED");
    expect(warning).toBeDefined();
    expect(warning?.sourceId).toBe("208");
    expect(warning?.severity).toBe("warning");

    // Both blogs successfully exported and linked!
    expect(ctx.output.blogs).toHaveLength(2);
    const b1 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:301");
    const b2 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:302");

    expect(b1?.category).toBe("@blog_categories:blog_categories:201");
    expect(b2?.category).toBe("@blog_categories:blog_categories:208");

    // No unresolved category errors
    expect(ctx.diagnostics.some(d => d.code === "BLOG_CATEGORY_UNRESOLVED")).toBe(false);
  });

  it("resolves duplicate blog post slugs with -B{id} when resolveDuplicateBlogSlugs is true", () => {
    // 2 blogs with same slug "tin-nong"
    const collidingBlog1: Row = { id: "401", store_id: "10", name: "Tin Nóng 1", slug: "tin-nong", status: "1", created_by: "999", content: "<p>1</p>", ...dates };
    const collidingBlog2: Row = { id: "402", store_id: "10", name: "Tin Nóng 2", slug: "tin-nong", status: "1", created_by: "999", content: "<p>2</p>", ...dates };

    const dualTables = {
      stores: [store], currencies: [currency], users: [user],
      blog_categories: [cat1],
      blog_posts: [collidingBlog1, collidingBlog2],
    };

    const ctx = createContext(dualTables, { resolveDuplicateBlogSlugs: true });
    mapContent(ctx);

    expect(ctx.output.blogs).toHaveLength(2);

    const outB1 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:401");
    const outB2 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:402");

    expect(outB1?.slug).toBe("tin-nong");
    expect(outB2?.slug).toBe("tin-nong-B402");

    const warning = ctx.diagnostics.find(d => d.code === "BLOG_SLUG_COLLISION_RESOLVED");
    expect(warning).toBeDefined();
    expect(warning?.sourceId).toBe("402");
    expect(warning?.severity).toBe("warning");
  });
});
