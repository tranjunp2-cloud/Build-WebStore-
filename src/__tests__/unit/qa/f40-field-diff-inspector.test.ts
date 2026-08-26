import { describe, it, expect } from "vitest";
import {
  getFieldDiffAuditForStore,
  getStoreDeepDiff,
  type EntityDiffRecord,
  type FieldDiffItem,
} from "@/lib/admin/qa/migration-diff-engine";

describe("[TC-F40-11] Deep Field-by-Field Database Diff Inspector Suite", () => {
  it("[TC-F40-11-01] matches entities 1-to-1 across ALL data groups (products, banners, richtext, navigation, categories, posts, settings, blocks)", () => {
    const audit = getFieldDiffAuditForStore("SITE-0001");
    expect(audit).toBeDefined();
    expect(audit.storeId).toBe("SITE-0001");
    expect(audit.records.length).toBeGreaterThan(0);

    // Verify comprehensive entity groups exist
    const groups = new Set(audit.records.map((r) => r.entityGroup));
    expect(groups.has("products")).toBe(true);
    expect(groups.has("variants")).toBe(true);
    expect(groups.has("banners")).toBe(true);
    expect(groups.has("richtext")).toBe(true);
    expect(groups.has("navigation")).toBe(true);
    expect(groups.has("categories")).toBe(true);
    expect(groups.has("posts")).toBe(true);
    expect(groups.has("settings")).toBe(true);
    expect(groups.has("blocks")).toBe(true);
  });

  it("[TC-F40-11-02] audits banner media links, mobile images, and CTA targets (AC-1 & AC-2)", () => {
    const audit = getFieldDiffAuditForStore("SITE-0001");
    const banner = audit.records.find((r) => r.entityGroup === "banners" && r.legacyId === "BAN-1365");
    expect(banner).toBeDefined();

    const fields = banner!.fields;
    const imgField = fields.find((f) => f.fieldName === "image_url");
    const mobileImgField = fields.find((f) => f.fieldName === "mobile_image_url");
    const linkField = fields.find((f) => f.fieldName === "link_url");
    const buttonTextField = fields.find((f) => f.fieldName === "button_text");
    const newTabField = fields.find((f) => f.fieldName === "open_new_tab");

    expect(imgField).toBeDefined();
    expect(mobileImgField).toBeDefined();
    expect(linkField?.legacyValue).toBe("/products");
    expect(buttonTextField?.legacyValue).toBe("Khám Phá Ngay");
    expect(newTabField?.legacyValue).toBe(false);
  });

  it("[TC-F40-11-03] audits rich_text inline images, hyperlinks, and table structures (AC-2)", () => {
    const failedAudit = getFieldDiffAuditForStore("SITE-0025");
    const rt = failedAudit.records.find((r) => r.entityGroup === "richtext");
    expect(rt).toBeDefined();

    const tableField = rt!.fields.find((f) => f.fieldName === "table_structure");
    expect(tableField).toBeDefined();
    expect(tableField?.status).toBe("error");
    expect(tableField?.classification).toBe("P0 Blocker");

    const linkField = rt!.fields.find((f) => f.fieldName === "hyperlinks");
    expect(linkField).toBeDefined();
    expect(linkField?.legacyValue).toContain("href: '/chinh-sach-doi-tra'");

    const inlineImgField = rt!.fields.find((f) => f.fieldName === "inline_images");
    expect(inlineImgField).toBeDefined();
  });

  it("[TC-F40-11-04] audits navigation menu items and header dropdown links", () => {
    const audit = getFieldDiffAuditForStore("SITE-0001");
    const nav = audit.records.find((r) => r.entityGroup === "navigation");
    expect(nav).toBeDefined();
    expect(nav?.fields.length).toBeGreaterThanOrEqual(4);
  });

  it("[TC-F40-11-05] detects missing variants and dropped brand_id in failed stores (AC-1 & AC-2)", () => {
    const audit = getFieldDiffAuditForStore("SITE-0025");
    expect(audit.summary.missingInPW2Count).toBeGreaterThan(0);

    const missingVariant = audit.records.find((r) => r.matchStatus === "missing_in_pw2");
    expect(missingVariant).toBeDefined();
    expect(missingVariant?.entityGroup).toBe("variants");
    expect(missingVariant?.entityIdentifier).toContain("ONG-RUNG-1L");

    const productRecord = audit.records.find((r) => r.entityGroup === "products" && r.legacyId === "PROD-101");
    expect(productRecord).toBeDefined();
    const brandField = productRecord?.fields.find((f) => f.fieldName === "brand_id");
    expect(brandField).toBeDefined();
    expect(brandField?.status).toBe("error");
  });

  it("[TC-F40-11-06] supports live re-scan returning 100% matched fields across all entities", () => {
    const resolvedAudit = getFieldDiffAuditForStore("SITE-0025", "passed");
    expect(resolvedAudit.summary.missingInPW2Count).toBe(0);
    expect(resolvedAudit.summary.fieldMatchRate).toBe("100.0%");
    const allErrors = resolvedAudit.records.flatMap((r) => r.fields).filter((f) => f.status === "error");
    expect(allErrors.length).toBe(0);
  });
});
