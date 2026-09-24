// @vitest-environment node
// TC-F42-EXP-100/101: reviewed conflict mapper behavior; handoff is version-gated by contract 1.9.0.
import { reportSchema } from '@/lib/migration/pw1-export/artifact-schemas'
import { describe, expect, it } from "vitest";
import { emptyStore, type MigrationPolicy, type Row } from "@/lib/migration/pw1-export/contracts";
import { sourceConfigSchema } from "@/lib/migration/pw1-export/source-config";
import { SourceIndex } from "@/lib/migration/pw1-export/source-index";
import { mapContent } from "@/lib/migration/pw1-export/mappers/content";

const basePolicy: MigrationPolicy = {
  decisionEvidence: "blog-cat-flatten-fixture",
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
  // Add a tenant owner user to satisfy blog author resolution
  output.users.push({
    _ref: "@users:users:999",
    tenants: [{ tenant: "@tenants:stores:10", role: "owner" }],
  });
  return new SourceIndex(tables).context(config, "10", output, [], []);
}

describe("Blog category flattening to root (flattenBlogCategoriesToRoot)", () => {
  const store = { id: "10", name: "Shop", currency_id: "1" };
  const currency = { id: "1", code: "MYR" };
  const user = { id: "999", store_id: "10", email: "owner@test.local", name: "Owner" };
  const dates = {
    created_at: "2025-01-01 00:00:00",
    updated_at: "2025-01-02 00:00:00",
  };

  // Hierarchy:
  // Root: id 1 (parent_id 0)
  //   -> Child: id 2 (parent_id 1)
  //        -> Grandchild: id 3 (parent_id 2)
  const rootCat: Row = { id: "1", store_id: "10", parent_id: "0", name: "Tin Tức", slug: "tin-tuc", status: "1", ...dates };
  const childCat: Row = { id: "2", store_id: "10", parent_id: "1", name: "Công Nghệ", slug: "cong-nghe", status: "1", ...dates };
  const grandchildCat: Row = { id: "3", store_id: "10", parent_id: "2", name: "AI & ML", slug: "ai-ml", status: "1", ...dates };

  const blogPostRoot: Row = { id: "101", store_id: "10", blog_category_id: "1", name: "Bản tin tổng hợp", slug: "ban-tin", status: "1", created_by: "999", content: "<p>News</p>", ...dates };
  const blogPostChild: Row = { id: "102", store_id: "10", blog_category_id: "2", name: "Ra mắt điện thoại mới", slug: "dien-thoai", status: "1", created_by: "999", content: "<p>Phone</p>", ...dates };
  const blogPostGrandchild: Row = { id: "103", store_id: "10", blog_category_id: "3", name: "Ứng dụng Claude AI", slug: "claude-ai", status: "1", created_by: "999", content: "<p>AI</p>", ...dates };

  const tables = {
    stores: [store], currencies: [currency], users: [user],
    blog_categories: [rootCat, childCat, grandchildCat],
    blog_posts: [blogPostRoot, blogPostChild, blogPostGrandchild],
  };

  it("exports all categories and leaves child blog references unchanged when flattenBlogCategoriesToRoot is false", () => {
    const ctx = createContext(tables, { flattenBlogCategoriesToRoot: false });
    mapContent(ctx);
    expect(ctx.diagnostics.every(d => reportSchema.shape.diagnostics.element.safeParse(d).success)).toBe(true);
    expect(ctx.contributions.some(c => c.rule === "MASTER-8.1-CHILD-CATEGORY-EXCLUDED")).toBe(false);

    // All 3 categories exported
    expect(ctx.output.blog_categories).toHaveLength(3);
    expect(ctx.output.blog_categories.map(c => c._ref)).toEqual([
      "@blog_categories:blog_categories:1",
      "@blog_categories:blog_categories:2",
      "@blog_categories:blog_categories:3",
    ]);

    // All 3 blogs exported with their original category refs
    expect(ctx.output.blogs).toHaveLength(3);
    expect(ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:101")?.category).toBe("@blog_categories:blog_categories:1");
    expect(ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:102")?.category).toBe("@blog_categories:blog_categories:2");
    expect(ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:103")?.category).toBe("@blog_categories:blog_categories:3");

    // No remapping or exclusion warnings
    expect(ctx.diagnostics.some(d => d.code === "BLOG_CHILD_CATEGORY_EXCLUDED")).toBe(false);
    expect(ctx.diagnostics.some(d => d.code === "BLOG_CATEGORY_REMAPPED_TO_ROOT")).toBe(false);
  });

  it("excludes child categories and remaps blog posts to top-most root category when flattenBlogCategoriesToRoot is true", () => {
    const ctx = createContext(tables, { flattenBlogCategoriesToRoot: true });
    mapContent(ctx);
    expect(ctx.diagnostics.every(d => reportSchema.shape.diagnostics.element.safeParse(d).success)).toBe(true);
    expect(ctx.contributions.some(c => c.rule === "MASTER-8.1-CHILD-CATEGORY-EXCLUDED")).toBe(false);

    // Only 1 root category exported! Child and grandchild are excluded!
    expect(ctx.output.blog_categories).toHaveLength(1);
    expect(ctx.output.blog_categories[0]._ref).toBe("@blog_categories:blog_categories:1");
    expect(ctx.output.blog_categories[0].name).toBe("Tin Tức");

    // Audit warnings for child category exclusions
    const excludedWarnings = ctx.diagnostics.filter(d => d.code === "BLOG_CHILD_CATEGORY_EXCLUDED");
    expect(excludedWarnings).toHaveLength(2);
    expect(excludedWarnings.map(w => w.sourceId)).toEqual(["2", "3"]);

    // All 3 blogs are exported
    expect(ctx.output.blogs).toHaveLength(3);

    // All 3 blogs now point to the ROOT category!
    const b101 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:101");
    const b102 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:102");
    const b103 = ctx.output.blogs.find(b => b._ref === "@blogs:blog_posts:103");

    expect(b101?.category).toBe("@blog_categories:blog_categories:1");
    expect(b102?.category).toBe("@blog_categories:blog_categories:1");
    expect(b103?.category).toBe("@blog_categories:blog_categories:1");

    // Remapped warnings recorded for b102 (child) and b103 (grandchild)
    const remappedWarnings = ctx.diagnostics.filter(d => d.code === "BLOG_CATEGORY_REMAPPED_TO_ROOT");
    expect(remappedWarnings).toHaveLength(2);
    expect(remappedWarnings.map(w => w.sourceId)).toEqual(["102", "103"]);

    // No unresolved blog category errors
    expect(ctx.diagnostics.some(d => d.code === "BLOG_CATEGORY_UNRESOLVED")).toBe(false);
  });

  it("does not cause slug collision on root category when an excluded child category shares the same slug", () => {
    // Child category shares the slug "tin-tuc" with root
    const collidingChildCat: Row = {
      id: "2",
      store_id: "10",
      parent_id: "1",
      name: "Tin Tức Con",
      slug: "tin-tuc", // Same slug as root!
      status: "1",
      ...dates,
    };

    const collidingTables = {
      ...tables,
      blog_categories: [rootCat, collidingChildCat],
      blog_posts: [blogPostRoot],
    };

    const ctx = createContext(collidingTables, { flattenBlogCategoriesToRoot: true });
    mapContent(ctx);
    expect(ctx.diagnostics.every(d => reportSchema.shape.diagnostics.element.safeParse(d).success)).toBe(true);
    expect(ctx.contributions.some(c => c.rule === "MASTER-8.1-CHILD-CATEGORY-EXCLUDED")).toBe(false);

    // Root category should NOT be killed by BLOG_SLUG_COLLISION
    expect(ctx.output.blog_categories).toHaveLength(1);
    expect(ctx.output.blog_categories[0]._ref).toBe("@blog_categories:blog_categories:1");
    expect(ctx.diagnostics.some(d => d.code === "BLOG_SLUG_COLLISION")).toBe(false);
  });
});
