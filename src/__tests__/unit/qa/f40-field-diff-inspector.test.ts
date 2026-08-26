import { describe, it, expect } from "vitest";
import {
  getFieldDiffAuditForStore,
  getStoreDeepDiff,
  type EntityDiffRecord,
  type FieldDiffItem,
} from "@/lib/admin/qa/migration-diff-engine";

describe("[TC-F40-11] Deep Field-by-Field Database Diff Inspector Suite", () => {
  it("[TC-F40-11-01] matches entities 1-to-1 using legacy_id across 5 data groups", () => {
    const audit = getFieldDiffAuditForStore("SITE-0001");
    expect(audit).toBeDefined();
    expect(audit.storeId).toBe("SITE-0001");
    expect(audit.records.length).toBeGreaterThan(0);

    // Verify all 5 entity groups exist
    const groups = new Set(audit.records.map((r) => r.entityGroup));
    expect(groups.has("products")).toBe(true);
    expect(groups.has("variants")).toBe(true);
    expect(groups.has("categories")).toBe(true);
    expect(groups.has("posts")).toBe(true);
    expect(groups.has("settings")).toBe(true);
    expect(groups.has("blocks")).toBe(true);
  });

  it("[TC-F40-11-02] detects missing variants and dropped brand_id in failed stores (AC-1 & AC-2)", () => {
    // SITE-0025 is simulated as a failed store with missing variant and dropped brand_id
    const audit = getFieldDiffAuditForStore("SITE-0025");
    expect(audit.summary.missingInPW2Count).toBeGreaterThan(0);

    // Find the missing variant record
    const missingVariant = audit.records.find((r) => r.matchStatus === "missing_in_pw2");
    expect(missingVariant).toBeDefined();
    expect(missingVariant?.entityGroup).toBe("variants");
    expect(missingVariant?.entityIdentifier).toContain("ONG-RUNG-1L");

    // Find the product with dropped brand_id
    const productRecord = audit.records.find((r) => r.entityGroup === "products" && r.legacyId === "PROD-101");
    expect(productRecord).toBeDefined();
    const brandField = productRecord?.fields.find((f) => f.fieldName === "brand_id");
    expect(brandField).toBeDefined();
    expect(brandField?.status).toBe("error");
    expect(brandField?.classification).toBe("P0 Blocker");
    expect(brandField?.legacyValue).toBe("Nông Trại Hữu Cơ Ba Vì");
    expect(brandField?.migratedValue).toBeNull();
  });

  it("[TC-F40-11-03] detects missing cost and warning fields with actionable remediation (AC-2)", () => {
    const audit = getFieldDiffAuditForStore("SITE-0014"); // Warning store
    const warnField = audit.records
      .flatMap((r) => r.fields)
      .find((f) => f.status === "warning");

    expect(warnField).toBeDefined();
    expect(warnField?.remediationAction).toBeDefined();
    expect(warnField?.diffExplanation).toBeDefined();
  });

  it("[TC-F40-11-04] calculates groupStats and fieldMatchRate accurately", () => {
    const audit = getFieldDiffAuditForStore("SITE-0001");
    expect(audit.summary.fieldMatchRate).toBeDefined();
    expect(audit.summary.groupStats.products.total).toBeGreaterThan(0);
    expect(audit.summary.groupStats.categories.total).toBeGreaterThan(0);
    expect(audit.summary.groupStats.posts.total).toBeGreaterThan(0);
  });

  it("[TC-F40-11-05] supports live re-scan resolution returning 100% matched fields", () => {
    const resolvedAudit = getFieldDiffAuditForStore("SITE-0025", "passed");
    expect(resolvedAudit.summary.missingInPW2Count).toBe(0);
    expect(resolvedAudit.summary.fieldMatchRate).toBe("100.0%");
    const allErrors = resolvedAudit.records.flatMap((r) => r.fields).filter((f) => f.status === "error");
    expect(allErrors.length).toBe(0);
  });
});
