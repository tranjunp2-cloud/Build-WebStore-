import {
  CMS_TARGET_REGISTRY,
  type TargetDomain,
} from "@/lib/admin/qa/target-registry";

export type QaCoveragePriority =
  | "critical"
  | "high"
  | "standard"
  | "unassigned";
export type QaCertificationState =
  | "certified_executable"
  | "planned"
  | "manual_only"
  | "no-certified-pack"
  | "deprecated";
export type QaPackProfile = "smoke" | "regression";

export type CertifiedPackEvidence = {
  packId: string;
  packVersion: number;
  profile: QaPackProfile;
  /** Runner is immutable execution identity, not a workflow/UI input. */
  runner: "unit" | "logic" | "api" | "smoke";
  testCaseIds: readonly string[];
  testType: "e2e" | "api" | "unit";
  spec: string;
  fixtureKey?: string;
  estimatedDurationMinutes: number;
  approvalRef: string;
  stagedProofRef: string;
};

export type TargetQaCoverage = {
  targetId: string;
  domain: TargetDomain;
  owner: string;
  priority: QaCoveragePriority;
  certificationState: QaCertificationState;
  allowedProfiles: readonly QaPackProfile[];
  recovery: string;
  /** Required only after the target is certified executable. */
  /** A target may have several independently certified exact contracts. */
  executions?: readonly CertifiedPackEvidence[];
};

type TargetQaPackContract = {
  targetId: string;
  packId: string;
  packVersion: number;
  runner: "unit" | "logic" | "api" | "smoke";
  fixtureKey?: string;
  spec: string;
  testCases: readonly { id: string }[];
};

type TargetQaProfileContract = {
  testType: "e2e" | "api" | "unit";
  estimatedDurationMinutes: number;
  testCases: readonly { id: string }[];
};

const CERTIFIED_PACKS: readonly (CertifiedPackEvidence & { targetId: string })[] = [
  {
    targetId: "identity-login-otp",
    packId: "identity-login-otp-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F01.01"],
    testType: "unit",
    spec: "src/__tests__/unit/otp/otp-generate.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "identity-password-recovery",
    packId: "identity-password-recovery-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F01.03"],
    testType: "unit",
    spec: "src/__tests__/unit/profile/api-users-me-password.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "identity-sso-session",
    packId: "identity-sso-session-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F01.05"],
    testType: "unit",
    spec: "src/__tests__/unit/otp/qc-bypass-guard.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "identity-staff-invitation",
    packId: "identity-staff-invitation-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F01.06"],
    testType: "unit",
    spec: "src/__tests__/unit/profile/role-guard.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "builder-generate-site",
    packId: "builder-generate-site-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F01-V.22"],
    testType: "unit",
    spec: "src/__tests__/unit/builder/ai-variety-composer.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "builder-draft-recovery",
    packId: "builder-draft-recovery-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F02.03"],
    testType: "unit",
    spec: "src/__tests__/unit/stores/builderStore.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "builder-preview-completion",
    packId: "builder-preview-completion-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F02.04"],
    testType: "unit",
    spec: "src/__tests__/unit/preview.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "builder-variety-template-apply",
    packId: "builder-variety-template-apply-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F02.05"],
    testType: "unit",
    spec: "src/__tests__/unit/templates/template-composer.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "builder-url-scraper-import",
    packId: "builder-url-scraper-import-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F02.06"],
    testType: "api",
    spec: "src/__tests__/api/ai.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "editor-load-and-tenant-access",
    packId: "editor-load-and-tenant-access-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F04.01"],
    testType: "unit",
    spec: "src/__tests__/unit/stores/editor-store.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "editor-block-content",
    packId: "editor-block-content-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F04.02"],
    testType: "unit",
    spec: "src/__tests__/unit/stores/editor-store-structural-fields.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "editor-pages-navigation",
    packId: "editor-pages-navigation-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F04.03"],
    testType: "unit",
    spec: "src/__tests__/unit/stores/editorStore-pages-header.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "editor-publish-lifecycle",
    packId: "editor-publish-lifecycle-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F04.04"],
    testType: "unit",
    spec: "src/__tests__/unit/stores/editorStore.undoRedo.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "editor-productgrid-variants",
    packId: "editor-product-grid-variants-smoke",
    packVersion: 1,
    profile: "smoke",
    runner: "smoke",
    testCaseIds: ["TC-F40-04-02"],
    testType: "e2e",
    spec: "tests/targeted-smoke/editor-product-grid-variants.smoke.spec.ts",
    fixtureKey: "smoke-e2e-targeted-tenant",
    estimatedDurationMinutes: 4,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "editor-seo-local-business",
    packId: "editor-seo-local-business-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F04.06"],
    testType: "unit",
    spec: "src/__tests__/unit/validations/sites-local-business.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "products-list-search-filter",
    packId: "products-list-search-filter-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F09.61"],
    testType: "api",
    spec: "src/__tests__/api/dashboard-products.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "products-crud-publish-guard",
    packId: "products-crud-publish-guard-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.62"],
    testType: "unit",
    spec: "src/__tests__/unit/products/publish-guard.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "products-variants-inventory",
    packId: "product-variants-critical-flow",
    packVersion: 1,
    profile: "smoke",
    runner: "smoke",
    testCaseIds: ["TC-F09.64"],
    testType: "e2e",
    spec: "tests/targeted-smoke/product-variants.smoke.spec.ts",
    fixtureKey: "smoke-e2e-targeted-tenant",
    estimatedDurationMinutes: 5,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "products-bulk-create",
    packId: "products-bulk-create-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.65"],
    testType: "unit",
    spec: "src/__tests__/unit/products/bulk-create-draft-verification.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "product-categories",
    packId: "product-categories-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.66"],
    testType: "unit",
    spec: "src/__tests__/unit/payload/category-row-lock.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "products-ai-description",
    packId: "products-ai-description-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.67"],
    testType: "unit",
    spec: "src/__tests__/unit/products/build-product-alt.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "orders-list-search-metrics",
    packId: "orders-list-search-metrics-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F10.01"],
    testType: "api",
    spec: "src/__tests__/api/orders-list.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "order-payment-verification",
    packId: "order-payment-verification-critical-flow",
    packVersion: 1,
    profile: "smoke",
    runner: "smoke",
    testCaseIds: ["TC-F10-06-41"],
    testType: "e2e",
    spec: "tests/targeted-smoke/order-payment-verification.smoke.spec.ts",
    fixtureKey: "smoke-e2e-targeted-tenant",
    estimatedDurationMinutes: 6,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "order-refund-cancel-retry",
    packId: "order-refund-cancel-retry-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "smoke",
    testCaseIds: ["TC-F10-03-01"],
    testType: "e2e",
    spec: "tests/targeted-smoke/order-cancel-restock.smoke.spec.ts",
    fixtureKey: "smoke-e2e-targeted-tenant",
    estimatedDurationMinutes: 4,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "order-fulfilment-self-delivery",
    packId: "order-fulfilment-self-delivery-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F10.04"],
    testType: "unit",
    spec: "src/__tests__/unit/orders/fulfillment-zone-state.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "order-shipping-label",
    packId: "order-shipping-label-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F10.05"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/resolve-collection-method.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "order-tracking-stream",
    packId: "order-tracking-stream-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F10.06"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/tracking-history.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "payment-settings-manual",
    packId: "payment-settings-manual-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F13.01"],
    testType: "unit",
    spec: "src/__tests__/unit/payment/payment-method-types.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "stripe-connect-lifecycle",
    packId: "stripe-connect-lifecycle-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F13.02"],
    testType: "unit",
    spec: "src/__tests__/unit/payment/stripe-connect.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "xendit-connect-checkout",
    packId: "xendit-connect-checkout-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F13.03"],
    testType: "unit",
    spec: "src/__tests__/unit/payment/reconcile-order-paid.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "shipping-rates-pickup-config",
    packId: "shipping-rates-pickup-config-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F13.04"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/pickup-schedule.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "easyparcel-oauth-lifecycle",
    packId: "easyparcel-oauth-lifecycle-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F13.05"],
    testType: "api",
    spec: "src/__tests__/api/easyparcel-oauth-start.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "domains-custom-domain-primary",
    packId: "domains-custom-domain-primary-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F13.06"],
    testType: "api",
    spec: "src/__tests__/api/domain-primary.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "email-template-management",
    packId: "email-template-management-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F13.07"],
    testType: "unit",
    spec: "src/__tests__/unit/notifications/notify-tenant-owners.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "staff-rbac-management",
    packId: "staff-rbac-management-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F13.08"],
    testType: "unit",
    spec: "src/__tests__/unit/profile/role-guard.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "public-page-routing",
    packId: "public-page-routing-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.01"],
    testType: "unit",
    spec: "src/__tests__/unit/site-renderer/apply-global-system-blocks.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "storefront-product-discovery",
    packId: "storefront-product-discovery-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.02"],
    testType: "unit",
    spec: "src/__tests__/unit/storefront/resolve-product-line.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "storefront-cart",
    packId: "storefront-cart-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.03"],
    testType: "unit",
    spec: "src/__tests__/unit/stores/cartStore.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "storefront-discount-checkout",
    packId: "storefront-checkout-critical-flow",
    packVersion: 1,
    profile: "smoke",
    runner: "smoke",
    testCaseIds: ["TC-F09.32", "TC-F09.30"],
    testType: "e2e",
    spec: "tests/targeted-smoke/storefront-checkout.smoke.spec.ts",
    fixtureKey: "smoke-e2e-targeted-tenant",
    estimatedDurationMinutes: 7,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "storefront-order-confirm-track",
    packId: "storefront-order-confirm-track-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.05"],
    testType: "unit",
    spec: "src/__tests__/unit/storefront/checkout.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "storefront-blog-contact",
    packId: "storefront-blog-contact-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F09.06"],
    testType: "api",
    spec: "src/__tests__/api/blogs-route.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "public-seo-discovery",
    packId: "public-seo-discovery-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.07"],
    testType: "unit",
    spec: "src/__tests__/unit/seo/public-discovery-middleware.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "tenant-domain-routing",
    packId: "tenant-domain-routing-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F09.08"],
    testType: "unit",
    spec: "src/__tests__/unit/storefront/custom-domain-detail-routes.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "seo-tools-automation",
    packId: "seo-tools-automation-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F37.01"],
    testType: "unit",
    spec: "src/__tests__/unit/seo/seo-infrastructure.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "local-seo-gbp-map",
    packId: "local-seo-gbp-map-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F37.02"],
    testType: "unit",
    spec: "src/__tests__/unit/seo/local-business-json-ld.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "seo-rank-keyword-density",
    packId: "seo-rank-keyword-density-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F37.03"],
    testType: "unit",
    spec: "src/__tests__/unit/seo/keyword-density.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "tracking-analytics-config",
    packId: "tracking-analytics-config-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F37.04"],
    testType: "unit",
    spec: "src/__tests__/unit/storefront/track-event.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "project-content-localization",
    packId: "project-content-localization-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F21.01"],
    testType: "unit",
    spec: "src/__tests__/unit/localization/issue-1701-approved-copy.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "locale-switching-routing",
    packId: "locale-switching-routing-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F21.02"],
    testType: "unit",
    spec: "src/__tests__/unit/localization/f36-easyparcel-settings-i18n.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "ai-translate-workflow",
    packId: "ai-translate-workflow-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F21.03"],
    testType: "api",
    spec: "src/__tests__/api/ai-translate.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "easyparcel-shipment-booking",
    packId: "easyparcel-shipment-booking-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F36.01"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/ep-ready.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "shipping-rate-calculator",
    packId: "shipping-rate-calculator-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F36.02"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/get-rates.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "easyparcel-tracking-webhooks",
    packId: "easyparcel-tracking-webhooks-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F36.03"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/status-map.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "cod-eligibility-check",
    packId: "cod-eligibility-check-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F36.04"],
    testType: "unit",
    spec: "src/__tests__/unit/shipping/cod-eligibility.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "shop-customers-directory",
    packId: "shop-customers-directory-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F11.01"],
    testType: "api",
    spec: "src/__tests__/api/notifications.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "contact-lead-submissions",
    packId: "contact-lead-submissions-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F11.02"],
    testType: "unit",
    spec: "src/__tests__/unit/notifications/notification-store.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "newsletter-subscription",
    packId: "newsletter-subscription-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F11.03"],
    testType: "unit",
    spec: "src/__tests__/unit/notifications/notification-triggers.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "blog-post-management",
    packId: "blog-post-management-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F12.01"],
    testType: "api",
    spec: "src/__tests__/api/blogs-detail.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "blog-category-management",
    packId: "blog-category-management-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F12.02"],
    testType: "api",
    spec: "src/__tests__/api/blog-categories.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "discount-rules-coupons",
    packId: "discount-rules-coupons-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F12.03"],
    testType: "api",
    spec: "src/__tests__/api/discounts-get-by-id.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "broadcast-announcement-banner",
    packId: "broadcast-announcement-banner-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "api",
    testCaseIds: ["TC-F12.04"],
    testType: "api",
    spec: "src/__tests__/api/broadcasts.test.ts",
    estimatedDurationMinutes: 3,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "plan-subscription-billing",
    packId: "plan-subscription-billing-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F39.01"],
    testType: "unit",
    spec: "src/__tests__/unit/subscriptions/plan-subscription.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "feature-guard-enforcement",
    packId: "feature-guard-enforcement-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F39.02"],
    testType: "unit",
    spec: "src/__tests__/unit/subscriptions/plan-features.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "payment-expiry-cron",
    packId: "payment-expiry-cron-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F39.03"],
    testType: "unit",
    spec: "src/__tests__/unit/notifications/notification-cleanup-cron.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "webhook-contracts",
    packId: "webhook-contracts-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F14.01"],
    testType: "unit",
    spec: "src/__tests__/unit/payment/disconnect-stripe.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "media-library-upload",
    packId: "media-library-upload-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F14.02"],
    testType: "unit",
    spec: "src/__tests__/unit/api/media-presign.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
  {
    targetId: "tenant-row-locking",
    packId: "tenant-row-locking-contract",
    packVersion: 1,
    profile: "smoke",
    runner: "unit",
    testCaseIds: ["TC-F14.03"],
    testType: "unit",
    spec: "src/__tests__/unit/payload/tenant-row-lock.test.ts",
    estimatedDurationMinutes: 2,
    approvalRef: "F40-08 QA approved test contract",
    stagedProofRef: "F40-08 catalog-v1",
  },
];

function defaultState(coverage: string): QaCertificationState {
  if (coverage === "manual_only") return "manual_only";
  return "no-certified-pack";
}

/** Orders, payments and storefront are admitted before the remaining domains.
 * This is a scheduling priority only: a blocked row never becomes runnable. */
function rolloutPriority(target: {
  id: string;
  domain: TargetDomain;
}): QaCoveragePriority {
  if (
    target.id === "order-payment-verification" ||
    target.id === "storefront-discount-checkout"
  )
    return "critical";
  if (
    target.domain === "Orders" ||
    target.domain === "Settings & Payments" ||
    target.id.startsWith("storefront-")
  )
    return "high";
  return "standard";
}

/**
 * Checked-in execution policy for the complete CMS catalog. The target
 * registry supplies catalog ownership/domain; this policy alone grants the
 * ability to execute a pack. Do not derive executable status from historical
 * `coverage: automated` evidence.
 */
export const TARGET_QA_COVERAGE: readonly TargetQaCoverage[] =
  CMS_TARGET_REGISTRY.filter((target) => target.active).map((target) => {
    const executions = CERTIFIED_PACKS.filter((entry) => entry.targetId === target.id);
    return executions.length
      ? {
          targetId: target.id,
          domain: target.domain,
          owner: target.owner,
          priority: rolloutPriority(target),
          certificationState: "certified_executable",
          allowedProfiles: [...new Set(executions.map((entry) => entry.profile))],
          recovery: "Có contract test đã được QA phê duyệt cho Staging (QC).",
          executions,
        }
      : {
          targetId: target.id,
          domain: target.domain,
          owner: target.owner || "qa-unassigned",
          priority: rolloutPriority(target),
          certificationState: defaultState(target.coverage),
          allowedProfiles: [],
          recovery:
            "QA/Engineering cần map TC-ID, test thực, fixture resettable và pack được phê duyệt trước khi chạy.",
        };
  });

export function getTargetQaCoverage(
  targetId: string,
): TargetQaCoverage | undefined {
  return TARGET_QA_COVERAGE.find((entry) => entry.targetId === targetId);
}

export function isTargetQaPackCertified(
  targetId: string,
  packId: string,
  profile: QaPackProfile,
): boolean {
  const entry = getTargetQaCoverage(targetId);
  return Boolean(
    entry?.certificationState === "certified_executable" &&
    entry.executions?.some((execution) => execution.packId === packId && execution.profile === profile) &&
    entry.allowedProfiles.includes(profile),
  );
}

/**
 * Execution authority is bound to the complete static contract, not merely a
 * friendly pack ID. This remains safe in serverless runtime because it only
 * compares checked-in metadata; source-file existence is asserted in CI.
 */
export function isTargetQaPackContractCertified(
  pack: TargetQaPackContract,
  profile: QaPackProfile,
  profileContract: TargetQaProfileContract | undefined,
): boolean {
  const execution = getTargetQaCoverage(pack.targetId)?.executions?.find(
    (candidate) => candidate.packId === pack.packId && candidate.profile === profile,
  );
  if (
    !execution ||
    !profileContract ||
    !isTargetQaPackCertified(pack.targetId, pack.packId, profile) ||
    execution.packVersion !== pack.packVersion ||
    execution.runner !== pack.runner ||
    execution.fixtureKey !== pack.fixtureKey ||
    execution.spec !== pack.spec ||
    execution.testType !== profileContract.testType ||
    execution.estimatedDurationMinutes !==
      profileContract.estimatedDurationMinutes
  )
    return false;
  const executionIds = [...execution.testCaseIds].sort();
  const packIds = pack.testCases.map((testCase) => testCase.id).sort();
  const profileIds = profileContract.testCases
    .map((testCase) => testCase.id)
    .sort();
  return (
    executionIds.length === packIds.length &&
    executionIds.every((id, index) => id === packIds[index]) &&
    executionIds.length === profileIds.length &&
    executionIds.every((id, index) => id === profileIds[index])
  );
}

/** Fails closed when catalog policy is incomplete or an executable row lacks proof. */
export function validateTargetQaCoverage(
  entries: readonly TargetQaCoverage[] = TARGET_QA_COVERAGE,
): void {
  const activeTargets = CMS_TARGET_REGISTRY.filter((target) => target.active);
  const ids = new Set<string>();
  for (const entry of entries) {
    const target = activeTargets.find(
      (candidate) => candidate.id === entry.targetId,
    );
    if (!target)
      throw new Error(`Unknown or inactive coverage target: ${entry.targetId}`);
    if (ids.has(entry.targetId))
      throw new Error(`Duplicate coverage target: ${entry.targetId}`);
    if (!entry.owner.trim() || !entry.recovery.trim())
      throw new Error(`Coverage owner/recovery missing: ${entry.targetId}`);
    if (entry.certificationState === "certified_executable") {
      const executions = entry.executions ?? [];
      if (!executions.length || !entry.allowedProfiles.length)
        throw new Error(
          `Incomplete certified coverage contract: ${entry.targetId}`,
        );
      for (const execution of executions) {
        const validSpec = execution.runner === "smoke"
          ? execution.spec.startsWith("tests/targeted-smoke/") && execution.spec.endsWith(".smoke.spec.ts")
          : (execution.runner === "api" ? execution.spec.startsWith("src/__tests__/api/") : execution.spec.startsWith("src/__tests__/unit/")) && execution.spec.endsWith(".test.ts");
        if (
          !entry.allowedProfiles.includes(execution.profile) ||
          !execution.testCaseIds.length ||
          !validSpec ||
          execution.estimatedDurationMinutes < 1 ||
          execution.estimatedDurationMinutes > 30 ||
          !execution.approvalRef ||
          !execution.stagedProofRef ||
          (execution.runner === "smoke" && !execution.fixtureKey)
        )
          throw new Error(`Invalid certified test contract: ${entry.targetId}`);
      }
    } else if (entry.executions?.length || entry.allowedProfiles.length) {
      throw new Error(
        `Uncertified target cannot expose an executable profile: ${entry.targetId}`,
      );
    }
    ids.add(entry.targetId);
  }
  if (ids.size !== activeTargets.length)
    throw new Error(
      `Coverage matrix incomplete: expected ${activeTargets.length}, received ${ids.size}`,
    );
}
