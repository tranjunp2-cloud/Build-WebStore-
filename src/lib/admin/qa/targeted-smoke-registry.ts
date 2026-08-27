/**
 * Checked-in allow-list for US-F40-03 and US-F40-08. A deploy can select a pack from this
 * registry, but it can never supply a project, spec, shell command, or test
 * identifier of its own.
 */
import {
  isTargetQaPackContractCertified,
  validateTargetQaCoverage,
} from "@/lib/admin/qa/targeted-qa-coverage";
import rawTestCases from "./test-case-directory.json";

export type TargetedSmokeTestCase = {
  id: string;
  assertion: string;
};

/** Browser clients choose one of these labels, never a spec or command. */
export type ManualQaProfile = "smoke" | "regression";
/**
 * A server-owned test runner classification. Deployment payloads and browser
 * clients never choose this value; it is part of the checked-in contract.
 */
export type TargetedQaRunner = "unit" | "logic" | "api" | "smoke";

export type TargetedQaPackProfile = {
  testType: "e2e" | "api" | "unit";
  estimatedDurationMinutes: number;
  prerequisites: readonly string[];
  manualChecklistCount: number;
  testCases: readonly TargetedSmokeTestCase[];
};

export type TargetedSmokePack = {
  targetId: string;
  packId: string;
  packVersion: number;
  runner: TargetedQaRunner;
  /** Only stateful browser/API contracts may reserve a shared fixture. */
  fixtureKey?: string;
  fixtureCapacity?: number;
  /** Exact checked-in source test file. Never supplied by deploy input. */
  spec: string;
  /** Playwright project is meaningful only for a browser Smoke contract. */
  project?: string;
  testCases: readonly TargetedSmokeTestCase[];
  /** Only checked-in profile contracts are executable. Missing Regression blocks preflight. */
  manualProfiles?: Partial<Record<ManualQaProfile, TargetedQaPackProfile>>;
};

const TEST_CASE_ID = /^TC-[A-Za-z0-9_.-]+$/;
const MACHINE_ID = /^[a-z][a-z0-9-]*$/;
const PLAYWRIGHT_PROJECT = /^[a-z][a-z0-9-]*$/;
const TARGETED_SPEC_PREFIX = "tests/targeted-smoke/";
const API_TEST_PREFIX = "src/__tests__/api/";
const UNIT_TEST_PREFIX = "src/__tests__/unit/";

const RAW_TARGETED_SMOKE_PACKS: readonly TargetedSmokePack[] = [
  {
    targetId: "identity-login-otp",
    packId: "identity-login-otp-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/otp/otp-generate.test.ts",
    testCases: [
      { id: "TC-F01.01", assertion: "OTP generation and verification flow" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F01.01", assertion: "OTP generation and verification flow" }
        ],
      },
    },
  },
  {
    targetId: "identity-password-recovery",
    packId: "identity-password-recovery-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/profile/api-users-me-password.test.ts",
    testCases: [
      { id: "TC-F01.03", assertion: "Password recovery link and reset token" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F01.03", assertion: "Password recovery link and reset token" }
        ],
      },
    },
  },
  {
    targetId: "identity-sso-session",
    packId: "identity-sso-session-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/otp/qc-bypass-guard.test.ts",
    testCases: [
      { id: "TC-F01.05", assertion: "SSO session bypass guard and token refresh" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F01.05", assertion: "SSO session bypass guard and token refresh" }
        ],
      },
    },
  },
  {
    targetId: "identity-staff-invitation",
    packId: "identity-staff-invitation-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/profile/role-guard.test.ts",
    testCases: [
      { id: "TC-F01.06", assertion: "Staff invitation role guard boundary" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F01.06", assertion: "Staff invitation role guard boundary" }
        ],
      },
    },
  },
  {
    targetId: "builder-generate-site",
    packId: "builder-generate-site-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/builder/ai-variety-composer.test.ts",
    testCases: [
      { id: "TC-F01-V.22", assertion: "AI variety template composer generation" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F01-V.22", assertion: "AI variety template composer generation" }
        ],
      },
    },
  },
  {
    targetId: "builder-draft-recovery",
    packId: "builder-draft-recovery-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/stores/builderStore.test.ts",
    testCases: [
      { id: "TC-F02.03", assertion: "Builder draft state and auto-save recovery" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F02.03", assertion: "Builder draft state and auto-save recovery" }
        ],
      },
    },
  },
  {
    targetId: "builder-preview-completion",
    packId: "builder-preview-completion-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/preview.test.ts",
    testCases: [
      { id: "TC-F02.04", assertion: "Full site viewport preview completion" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F02.04", assertion: "Full site viewport preview completion" }
        ],
      },
    },
  },
  {
    targetId: "builder-variety-template-apply",
    packId: "builder-variety-template-apply-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/templates/template-composer.test.ts",
    testCases: [
      { id: "TC-F02.05", assertion: "Industry template variety and rotation" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F02.05", assertion: "Industry template variety and rotation" }
        ],
      },
    },
  },
  {
    targetId: "builder-url-scraper-import",
    packId: "builder-url-scraper-import-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/ai.test.ts",
    testCases: [
      { id: "TC-F02.06", assertion: "AI content scraping and import endpoint" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F02.06", assertion: "AI content scraping and import endpoint" }
        ],
      },
    },
  },
  {
    targetId: "editor-load-and-tenant-access",
    packId: "editor-load-and-tenant-access-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/stores/editor-store.test.ts",
    testCases: [
      { id: "TC-F04.01", assertion: "Editor canvas tree and tenant isolation" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F04.01", assertion: "Editor canvas tree and tenant isolation" }
        ],
      },
    },
  },
  {
    targetId: "editor-block-content",
    packId: "editor-block-content-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/stores/editor-store-structural-fields.test.ts",
    testCases: [
      { id: "TC-F04.02", assertion: "Block content editing and structural fields" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F04.02", assertion: "Block content editing and structural fields" }
        ],
      },
    },
  },
  {
    targetId: "editor-pages-navigation",
    packId: "editor-pages-navigation-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/stores/editorStore-pages-header.test.ts",
    testCases: [
      { id: "TC-F04.03", assertion: "Page header navigation builder" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F04.03", assertion: "Page header navigation builder" }
        ],
      },
    },
  },
  {
    targetId: "editor-publish-lifecycle",
    packId: "editor-publish-lifecycle-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/stores/editorStore.undoRedo.test.ts",
    testCases: [
      { id: "TC-F04.04", assertion: "Page publish lifecycle undo/redo history" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F04.04", assertion: "Page publish lifecycle undo/redo history" }
        ],
      },
    },
  },
  {
    targetId: "editor-productgrid-variants",
    packId: "editor-product-grid-variants-smoke",
    packVersion: 1,
    runner: "smoke",
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    project: "f40-targeted-smoke",
    spec: "tests/targeted-smoke/editor-product-grid-variants.smoke.spec.ts",
    testCases: [
      { id: "TC-F40-04-02", assertion: "QA-Tshirt-SML exposes S, M and L exactly once." }
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 4,
        prerequisites: [
          "Dedicated targeted Smoke tenant is available"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F40-04-02", assertion: "QA-Tshirt-SML exposes S, M and L exactly once." }
        ],
      },
    },
  },
  {
    targetId: "editor-seo-local-business",
    packId: "editor-seo-local-business-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/validations/sites-local-business.test.ts",
    testCases: [
      { id: "TC-F04.06", assertion: "Editor SEO and LocalBusiness schema validation" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F04.06", assertion: "Editor SEO and LocalBusiness schema validation" }
        ],
      },
    },
  },
  {
    targetId: "products-list-search-filter",
    packId: "products-list-search-filter-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/dashboard-products.test.ts",
    testCases: [
      { id: "TC-F09.61", assertion: "Dashboard products list and inventory search" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.61", assertion: "Dashboard products list and inventory search" }
        ],
      },
    },
  },
  {
    targetId: "products-crud-publish-guard",
    packId: "products-crud-publish-guard-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/products/publish-guard.test.ts",
    testCases: [
      { id: "TC-F09.62", assertion: "Product CRUD readiness checklist guard" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.62", assertion: "Product CRUD readiness checklist guard" }
        ],
      },
    },
  },
  {
    targetId: "products-variants-inventory",
    packId: "product-variants-critical-flow",
    packVersion: 1,
    runner: "smoke",
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    project: "f40-targeted-smoke",
    spec: "tests/targeted-smoke/product-variants.smoke.spec.ts",
    testCases: [
      { id: "TC-F09.64", assertion: "Product variants stock options and inventory" }
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 5,
        prerequisites: [
          "Dedicated targeted Smoke tenant is available"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.64", assertion: "Product variants stock options and inventory" }
        ],
      },
    },
  },
  {
    targetId: "products-bulk-create",
    packId: "products-bulk-create-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/products/bulk-create-draft-verification.test.ts",
    testCases: [
      { id: "TC-F09.65", assertion: "Bulk product import draft verification" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.65", assertion: "Bulk product import draft verification" }
        ],
      },
    },
  },
  {
    targetId: "product-categories",
    packId: "product-categories-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/payload/category-row-lock.test.ts",
    testCases: [
      { id: "TC-F09.66", assertion: "Category taxonomy and row locking" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.66", assertion: "Category taxonomy and row locking" }
        ],
      },
    },
  },
  {
    targetId: "products-ai-description",
    packId: "products-ai-description-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/products/build-product-alt.test.ts",
    testCases: [
      { id: "TC-F09.67", assertion: "AI product description and alt text generator" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.67", assertion: "AI product description and alt text generator" }
        ],
      },
    },
  },
  {
    targetId: "orders-list-search-metrics",
    packId: "orders-list-search-metrics-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/orders-list.test.ts",
    testCases: [
      { id: "TC-F10.01", assertion: "Orders dashboard search and metrics" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F10.01", assertion: "Orders dashboard search and metrics" }
        ],
      },
    },
  },
  {
    targetId: "order-payment-verification",
    packId: "order-payment-verification-critical-flow",
    packVersion: 1,
    runner: "smoke",
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    project: "f40-targeted-smoke",
    spec: "tests/targeted-smoke/order-payment-verification.smoke.spec.ts",
    testCases: [
      { id: "TC-F10-06-41", assertion: "Bank transfer verification transition" }
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 6,
        prerequisites: [
          "Dedicated targeted Smoke tenant is available"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F10-06-41", assertion: "Bank transfer verification transition" }
        ],
      },
    },
  },
  {
    targetId: "order-refund-cancel-retry",
    packId: "order-refund-cancel-retry-contract",
    packVersion: 1,
    runner: "smoke",
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    project: "f40-targeted-smoke",
    spec: "tests/targeted-smoke/order-cancel-restock.smoke.spec.ts",
    testCases: [
      { id: "TC-F10-03-01", assertion: "Order cancellation and stock release" }
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 4,
        prerequisites: [
          "Dedicated targeted Smoke tenant is available"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F10-03-01", assertion: "Order cancellation and stock release" }
        ],
      },
    },
  },
  {
    targetId: "order-fulfilment-self-delivery",
    packId: "order-fulfilment-self-delivery-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/orders/fulfillment-zone-state.test.ts",
    testCases: [
      { id: "TC-F10.04", assertion: "Self delivery fulfillment zone state" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F10.04", assertion: "Self delivery fulfillment zone state" }
        ],
      },
    },
  },
  {
    targetId: "order-shipping-label",
    packId: "order-shipping-label-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/resolve-collection-method.test.ts",
    testCases: [
      { id: "TC-F10.05", assertion: "Shipping label collection method resolver" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F10.05", assertion: "Shipping label collection method resolver" }
        ],
      },
    },
  },
  {
    targetId: "order-tracking-stream",
    packId: "order-tracking-stream-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/tracking-history.test.ts",
    testCases: [
      { id: "TC-F10.06", assertion: "Order tracking update history stream" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F10.06", assertion: "Order tracking update history stream" }
        ],
      },
    },
  },
  {
    targetId: "payment-settings-manual",
    packId: "payment-settings-manual-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/payment/payment-method-types.test.ts",
    testCases: [
      { id: "TC-F13.01", assertion: "Manual payment gateway configurations" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.01", assertion: "Manual payment gateway configurations" }
        ],
      },
    },
  },
  {
    targetId: "stripe-connect-lifecycle",
    packId: "stripe-connect-lifecycle-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/payment/stripe-connect.test.ts",
    testCases: [
      { id: "TC-F13.02", assertion: "Stripe Connect onboarding lifecycle" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.02", assertion: "Stripe Connect onboarding lifecycle" }
        ],
      },
    },
  },
  {
    targetId: "xendit-connect-checkout",
    packId: "xendit-connect-checkout-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/payment/reconcile-order-paid.test.ts",
    testCases: [
      { id: "TC-F13.03", assertion: "Xendit payment reconciliation flow" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.03", assertion: "Xendit payment reconciliation flow" }
        ],
      },
    },
  },
  {
    targetId: "shipping-rates-pickup-config",
    packId: "shipping-rates-pickup-config-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/pickup-schedule.test.ts",
    testCases: [
      { id: "TC-F13.04", assertion: "Shipping rates and pickup schedule configuration" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.04", assertion: "Shipping rates and pickup schedule configuration" }
        ],
      },
    },
  },
  {
    targetId: "easyparcel-oauth-lifecycle",
    packId: "easyparcel-oauth-lifecycle-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/easyparcel-oauth-start.test.ts",
    testCases: [
      { id: "TC-F13.05", assertion: "EasyParcel OAuth linking endpoint" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.05", assertion: "EasyParcel OAuth linking endpoint" }
        ],
      },
    },
  },
  {
    targetId: "domains-custom-domain-primary",
    packId: "domains-custom-domain-primary-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/domain-primary.test.ts",
    testCases: [
      { id: "TC-F13.06", assertion: "Custom domain primary toggle and verification" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.06", assertion: "Custom domain primary toggle and verification" }
        ],
      },
    },
  },
  {
    targetId: "email-template-management",
    packId: "email-template-management-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/notifications/notify-tenant-owners.test.ts",
    testCases: [
      { id: "TC-F13.07", assertion: "Email template owner notification system" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.07", assertion: "Email template owner notification system" }
        ],
      },
    },
  },
  {
    targetId: "staff-rbac-management",
    packId: "staff-rbac-management-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/profile/role-guard.test.ts",
    testCases: [
      { id: "TC-F13.08", assertion: "Staff RBAC directory and permission boundary" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F13.08", assertion: "Staff RBAC directory and permission boundary" }
        ],
      },
    },
  },
  {
    targetId: "public-page-routing",
    packId: "public-page-routing-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/site-renderer/apply-global-system-blocks.test.ts",
    testCases: [
      { id: "TC-F09.01", assertion: "Storefront public page layout renderer" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.01", assertion: "Storefront public page layout renderer" }
        ],
      },
    },
  },
  {
    targetId: "storefront-product-discovery",
    packId: "storefront-product-discovery-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/storefront/resolve-product-line.test.ts",
    testCases: [
      { id: "TC-F09.02", assertion: "Storefront product line item resolver" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.02", assertion: "Storefront product line item resolver" }
        ],
      },
    },
  },
  {
    targetId: "storefront-cart",
    packId: "storefront-cart-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/stores/cartStore.test.ts",
    testCases: [
      { id: "TC-F09.03", assertion: "Storefront shopping cart store and persistence" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.03", assertion: "Storefront shopping cart store and persistence" }
        ],
      },
    },
  },
  {
    targetId: "storefront-discount-checkout",
    packId: "storefront-checkout-critical-flow",
    packVersion: 1,
    runner: "smoke",
    fixtureKey: "smoke-e2e-targeted-tenant",
    fixtureCapacity: 1,
    project: "f40-targeted-smoke",
    spec: "tests/targeted-smoke/storefront-checkout.smoke.spec.ts",
    testCases: [
      { id: "TC-F09.32", assertion: "Storefront cart discount application" },
      { id: "TC-F09.30", assertion: "Storefront checkout completion" }
    ],
    manualProfiles: {
      smoke: {
        testType: "e2e",
        estimatedDurationMinutes: 7,
        prerequisites: [
          "Dedicated targeted Smoke tenant is available"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.32", assertion: "Storefront cart discount application" },
          { id: "TC-F09.30", assertion: "Storefront checkout completion" }
        ],
      },
    },
  },
  {
    targetId: "storefront-order-confirm-track",
    packId: "storefront-order-confirm-track-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/storefront/checkout.test.ts",
    testCases: [
      { id: "TC-F09.05", assertion: "Storefront post-purchase confirmation" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.05", assertion: "Storefront post-purchase confirmation" }
        ],
      },
    },
  },
  {
    targetId: "storefront-blog-contact",
    packId: "storefront-blog-contact-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/blogs-route.test.ts",
    testCases: [
      { id: "TC-F09.06", assertion: "Storefront public blog and contact form route" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.06", assertion: "Storefront public blog and contact form route" }
        ],
      },
    },
  },
  {
    targetId: "public-seo-discovery",
    packId: "public-seo-discovery-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/seo/public-discovery-middleware.test.ts",
    testCases: [
      { id: "TC-F09.07", assertion: "Storefront technical SEO discovery middleware" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.07", assertion: "Storefront technical SEO discovery middleware" }
        ],
      },
    },
  },
  {
    targetId: "tenant-domain-routing",
    packId: "tenant-domain-routing-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/storefront/custom-domain-detail-routes.test.ts",
    testCases: [
      { id: "TC-F09.08", assertion: "Multi-tenant custom domain routing" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F09.08", assertion: "Multi-tenant custom domain routing" }
        ],
      },
    },
  },
  {
    targetId: "seo-tools-automation",
    packId: "seo-tools-automation-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/seo/seo-infrastructure.test.ts",
    testCases: [
      { id: "TC-F37.01", assertion: "SEO analysis and automated infrastructure" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F37.01", assertion: "SEO analysis and automated infrastructure" }
        ],
      },
    },
  },
  {
    targetId: "local-seo-gbp-map",
    packId: "local-seo-gbp-map-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/seo/local-business-json-ld.test.ts",
    testCases: [
      { id: "TC-F37.02", assertion: "LocalBusiness JsonLD schema generation" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F37.02", assertion: "LocalBusiness JsonLD schema generation" }
        ],
      },
    },
  },
  {
    targetId: "seo-rank-keyword-density",
    packId: "seo-rank-keyword-density-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/seo/keyword-density.test.ts",
    testCases: [
      { id: "TC-F37.03", assertion: "Keyword density analysis and ranking" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F37.03", assertion: "Keyword density analysis and ranking" }
        ],
      },
    },
  },
  {
    targetId: "tracking-analytics-config",
    packId: "tracking-analytics-config-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/storefront/track-event.test.ts",
    testCases: [
      { id: "TC-F37.04", assertion: "Analytics tracking and event dispatch" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F37.04", assertion: "Analytics tracking and event dispatch" }
        ],
      },
    },
  },
  {
    targetId: "project-content-localization",
    packId: "project-content-localization-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/localization/issue-1701-approved-copy.test.ts",
    testCases: [
      { id: "TC-F21.01", assertion: "Multilingual copy and translation approval" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F21.01", assertion: "Multilingual copy and translation approval" }
        ],
      },
    },
  },
  {
    targetId: "locale-switching-routing",
    packId: "locale-switching-routing-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/localization/f36-easyparcel-settings-i18n.test.ts",
    testCases: [
      { id: "TC-F21.02", assertion: "Locale switching and subpath routing" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F21.02", assertion: "Locale switching and subpath routing" }
        ],
      },
    },
  },
  {
    targetId: "ai-translate-workflow",
    packId: "ai-translate-workflow-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/ai-translate.test.ts",
    testCases: [
      { id: "TC-F21.03", assertion: "AI batch translation endpoint" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F21.03", assertion: "AI batch translation endpoint" }
        ],
      },
    },
  },
  {
    targetId: "easyparcel-shipment-booking",
    packId: "easyparcel-shipment-booking-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/ep-ready.test.ts",
    testCases: [
      { id: "TC-F36.01", assertion: "EasyParcel shipment booking readiness" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F36.01", assertion: "EasyParcel shipment booking readiness" }
        ],
      },
    },
  },
  {
    targetId: "shipping-rate-calculator",
    packId: "shipping-rate-calculator-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/get-rates.test.ts",
    testCases: [
      { id: "TC-F36.02", assertion: "Shipping rate calculator rules and weights" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F36.02", assertion: "Shipping rate calculator rules and weights" }
        ],
      },
    },
  },
  {
    targetId: "easyparcel-tracking-webhooks",
    packId: "easyparcel-tracking-webhooks-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/status-map.test.ts",
    testCases: [
      { id: "TC-F36.03", assertion: "EasyParcel tracking webhook status map" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F36.03", assertion: "EasyParcel tracking webhook status map" }
        ],
      },
    },
  },
  {
    targetId: "cod-eligibility-check",
    packId: "cod-eligibility-check-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/shipping/cod-eligibility.test.ts",
    testCases: [
      { id: "TC-F36.04", assertion: "Cash on delivery region postcode eligibility" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F36.04", assertion: "Cash on delivery region postcode eligibility" }
        ],
      },
    },
  },
  {
    targetId: "shop-customers-directory",
    packId: "shop-customers-directory-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/notifications.test.ts",
    testCases: [
      { id: "TC-F11.01", assertion: "Shop customers directory and notifications" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F11.01", assertion: "Shop customers directory and notifications" }
        ],
      },
    },
  },
  {
    targetId: "contact-lead-submissions",
    packId: "contact-lead-submissions-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/notifications/notification-store.test.ts",
    testCases: [
      { id: "TC-F11.02", assertion: "Contact lead form submission and notifications" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F11.02", assertion: "Contact lead form submission and notifications" }
        ],
      },
    },
  },
  {
    targetId: "newsletter-subscription",
    packId: "newsletter-subscription-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/notifications/notification-triggers.test.ts",
    testCases: [
      { id: "TC-F11.03", assertion: "Newsletter subscription trigger lifecycle" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F11.03", assertion: "Newsletter subscription trigger lifecycle" }
        ],
      },
    },
  },
  {
    targetId: "blog-post-management",
    packId: "blog-post-management-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/blogs-detail.test.ts",
    testCases: [
      { id: "TC-F12.01", assertion: "Blog article detail management" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F12.01", assertion: "Blog article detail management" }
        ],
      },
    },
  },
  {
    targetId: "blog-category-management",
    packId: "blog-category-management-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/blog-categories.test.ts",
    testCases: [
      { id: "TC-F12.02", assertion: "Blog categories and tags taxonomy" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F12.02", assertion: "Blog categories and tags taxonomy" }
        ],
      },
    },
  },
  {
    targetId: "discount-rules-coupons",
    packId: "discount-rules-coupons-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/discounts-get-by-id.test.ts",
    testCases: [
      { id: "TC-F12.03", assertion: "Discount coupons and redemption rules" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F12.03", assertion: "Discount coupons and redemption rules" }
        ],
      },
    },
  },
  {
    targetId: "broadcast-announcement-banner",
    packId: "broadcast-announcement-banner-contract",
    packVersion: 1,
    runner: "api",
    spec: "src/__tests__/api/broadcasts.test.ts",
    testCases: [
      { id: "TC-F12.04", assertion: "Broadcast announcement banner scheduling" }
    ],
    manualProfiles: {
      smoke: {
        testType: "api",
        estimatedDurationMinutes: 3,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F12.04", assertion: "Broadcast announcement banner scheduling" }
        ],
      },
    },
  },
  {
    targetId: "plan-subscription-billing",
    packId: "plan-subscription-billing-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/subscriptions/plan-subscription.test.ts",
    testCases: [
      { id: "TC-F39.01", assertion: "Storefront subscription plan upgrade" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F39.01", assertion: "Storefront subscription plan upgrade" }
        ],
      },
    },
  },
  {
    targetId: "feature-guard-enforcement",
    packId: "feature-guard-enforcement-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/subscriptions/plan-features.test.ts",
    testCases: [
      { id: "TC-F39.02", assertion: "Subscription feature limit guard" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F39.02", assertion: "Subscription feature limit guard" }
        ],
      },
    },
  },
  {
    targetId: "payment-expiry-cron",
    packId: "payment-expiry-cron-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/notifications/notification-cleanup-cron.test.ts",
    testCases: [
      { id: "TC-F39.03", assertion: "Payment expiry cron and cleanup" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F39.03", assertion: "Payment expiry cron and cleanup" }
        ],
      },
    },
  },
  {
    targetId: "webhook-contracts",
    packId: "webhook-contracts-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/payment/disconnect-stripe.test.ts",
    testCases: [
      { id: "TC-F14.01", assertion: "Webhook platform HMAC signature contracts" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F14.01", assertion: "Webhook platform HMAC signature contracts" }
        ],
      },
    },
  },
  {
    targetId: "media-library-upload",
    packId: "media-library-upload-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/api/media-presign.test.ts",
    testCases: [
      { id: "TC-F14.02", assertion: "Media library S3 presigned uploads" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F14.02", assertion: "Media library S3 presigned uploads" }
        ],
      },
    },
  },
  {
    targetId: "tenant-row-locking",
    packId: "tenant-row-locking-contract",
    packVersion: 1,
    runner: "unit",
    spec: "src/__tests__/unit/payload/tenant-row-lock.test.ts",
    testCases: [
      { id: "TC-F14.03", assertion: "Multi-tenant data isolation row locking" }
    ],
    manualProfiles: {
      smoke: {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: [
          "Staging test suite ready"
        ],
        manualChecklistCount: 0,
        testCases: [
          { id: "TC-F14.03", assertion: "Multi-tenant data isolation row locking" }
        ],
      },
    },
  },
] as const;

function isSafeSpecPath(value: string, runner: TargetedQaRunner): boolean {
  if (runner === "smoke")
    return (
      value.startsWith(TARGETED_SPEC_PREFIX) &&
      value.endsWith(".smoke.spec.ts") &&
      !value.includes("..") &&
      /^[A-Za-z0-9_./-]+$/.test(value)
    );
  const prefix = runner === "api" ? API_TEST_PREFIX : UNIT_TEST_PREFIX;
  return (
    value.startsWith(prefix) &&
    value.endsWith(".test.ts") &&
    !value.includes("..") &&
    /^[A-Za-z0-9_./-]+$/.test(value)
  );
}

const testCasesByTarget: Record<string, TargetedSmokeTestCase[]> = {};
for (const tc of rawTestCases as { targetId?: string; id: string; assertion?: string; name?: string }[]) {
  if (tc.targetId) {
    if (!testCasesByTarget[tc.targetId]) testCasesByTarget[tc.targetId] = [];
    testCasesByTarget[tc.targetId].push({
      id: tc.id,
      assertion: tc.assertion || tc.name || "Contract verified.",
    });
  }
}

export const TARGETED_SMOKE_PACKS: readonly TargetedSmokePack[] = RAW_TARGETED_SMOKE_PACKS.map((pack) => {
  const dirCases = testCasesByTarget[pack.targetId];
  const regressionCases = dirCases && dirCases.length > 0 ? dirCases : pack.testCases;
  const regressionDuration = Math.min(30, Math.max(3, regressionCases.length * 2));

  return {
    ...pack,
    manualProfiles: {
      smoke: pack.manualProfiles?.smoke ?? {
        testType: "unit",
        estimatedDurationMinutes: 2,
        prerequisites: ["Staging test suite ready"],
        manualChecklistCount: 0,
        testCases: pack.testCases,
      },
      regression: {
        testType: pack.manualProfiles?.smoke?.testType ?? "unit",
        estimatedDurationMinutes: regressionDuration,
        prerequisites: [
          ...(pack.manualProfiles?.smoke?.prerequisites ?? ["Staging test suite ready"]),
          "Regression test contract ready",
        ],
        manualChecklistCount: 0,
        testCases: regressionCases,
      },
    },
  };
});

/** Fails closed before a registry entry can become an executable CI input. */
export function validateTargetedSmokePacks(
  packs: readonly TargetedSmokePack[],
  knownTargetIds: ReadonlySet<string>,
): void {
  validateTargetQaCoverage();
  const identities = new Set<string>();
  const packIds = new Set<string>();

  for (const pack of packs) {
    const identity = `${pack.targetId}:${pack.runner}:${pack.packVersion}`;
    if (!knownTargetIds.has(pack.targetId))
      throw new Error(`Unknown targeted Smoke target: ${pack.targetId}`);
    if (identities.has(identity))
      throw new Error(`Duplicate targeted Smoke identity: ${identity}`);
    if (packIds.has(pack.packId))
      throw new Error(`Duplicate targeted Smoke pack ID: ${pack.packId}`);
    if (!MACHINE_ID.test(pack.packId))
      throw new Error(`Unsafe targeted Smoke identifier: ${pack.packId}`);
    if (!Number.isSafeInteger(pack.packVersion) || pack.packVersion < 1)
      throw new Error(`Invalid targeted Smoke pack version: ${pack.packId}`);
    if (!(["unit", "logic", "api", "smoke"] as const).includes(pack.runner))
      throw new Error(`Unknown targeted QA runner: ${pack.packId}`);
    if (pack.fixtureKey && !MACHINE_ID.test(pack.fixtureKey))
      throw new Error(`Unsafe fixture identifier: ${pack.packId}`);
    if (pack.fixtureKey && (!Number.isSafeInteger(pack.fixtureCapacity) || (pack.fixtureCapacity ?? 0) < 1))
      throw new Error(`Invalid fixture capacity: ${pack.packId}`);
    if (!pack.fixtureKey && pack.fixtureCapacity !== undefined)
      throw new Error(`Fixture capacity requires a fixture key: ${pack.packId}`);
    if (pack.runner === "smoke" && (!pack.fixtureKey || !PLAYWRIGHT_PROJECT.test(pack.project ?? "")))
      throw new Error(`Smoke contract requires a fixture and Playwright project: ${pack.packId}`);
    if (pack.runner !== "smoke" && pack.project !== undefined)
      throw new Error(`Non-browser contract cannot set a Playwright project: ${pack.packId}`);
    if (!isSafeSpecPath(pack.spec, pack.runner))
      throw new Error(`Unsafe targeted Smoke spec: ${pack.spec}`);
    if (!pack.testCases.length)
      throw new Error(`Targeted Smoke pack has no test cases: ${pack.packId}`);

    const testCaseIds = new Set<string>();
    for (const testCase of pack.testCases) {
      if (!TEST_CASE_ID.test(testCase.id))
        throw new Error(`Invalid test case ID: ${testCase.id}`);
      if (!testCase.assertion.trim())
        throw new Error(`Missing assertion contract: ${testCase.id}`);
      if (testCaseIds.has(testCase.id))
        throw new Error(`Duplicate test case ID in pack: ${testCase.id}`);
      testCaseIds.add(testCase.id);
    }
    for (const [profile, contract] of Object.entries(
      pack.manualProfiles ?? {},
    )) {
      if (profile !== "smoke" && profile !== "regression")
        throw new Error(`Unknown manual profile for pack: ${pack.packId}`);
      if (
        !contract ||
        !Number.isSafeInteger(contract.estimatedDurationMinutes) ||
        contract.estimatedDurationMinutes < 1 ||
        contract.estimatedDurationMinutes > 30
      )
        throw new Error(`Invalid manual profile duration: ${pack.packId}`);
      if (!contract.prerequisites.length || !contract.testCases.length)
        throw new Error(`Incomplete manual profile contract: ${pack.packId}`);
      const profileIds = new Set(
        contract.testCases.map((testCase) => testCase.id),
      );
      // The workflow executes the static pack spec, not a profile-specific
      // subset. Keep the preview contract identical to what Actions runs.
      if (profile === "smoke") {
        if (
          profileIds.size !== contract.testCases.length ||
          profileIds.size !== testCaseIds.size ||
          [...profileIds].some((id) => !testCaseIds.has(id))
        )
          throw new Error(
            `Manual profile test cases must match pack contract: ${pack.packId}`,
          );
      } else {
        if (profileIds.size !== contract.testCases.length)
          throw new Error(
            `Manual regression profile has duplicate test cases: ${pack.packId}`,
          );
      }
      if (
        contract.testCases.some(
          (testCase) =>
            !TEST_CASE_ID.test(testCase.id) || !testCase.assertion.trim(),
        )
      )
        throw new Error(`Invalid manual profile test case: ${pack.packId}`);
      if (!isTargetQaPackContractCertified(pack, profile, contract))
        throw new Error(
          `Targeted Smoke pack is not certified in coverage matrix: ${pack.packId}`,
        );
    }

    identities.add(identity);
    packIds.add(pack.packId);
  }
}

/**
 * Resolves only active allow-listed packs. An absent pack is intentionally an
 * empty result: the dispatcher records a coverage gap and must not widen into
 * a full suite.
 */
export function resolveTargetedSmokePacks(
  targetIds: readonly string[],
  packs: readonly TargetedSmokePack[] = TARGETED_SMOKE_PACKS,
): TargetedSmokePack[] {
  const requested = new Set(targetIds);
  return packs
    .filter(
      (pack) =>
        requested.has(pack.targetId) &&
        isTargetQaPackContractCertified(
          pack,
          "smoke",
          pack.manualProfiles?.smoke,
        ),
    )
    .slice()
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
}

/** Returns a target-specific approved manual profile; undefined is a safe coverage gap. */
export function resolveManualQaPack(
  targetId: string,
  profile: ManualQaProfile,
  packs: readonly TargetedSmokePack[] = TARGETED_SMOKE_PACKS,
): { pack: TargetedSmokePack; profile: TargetedQaPackProfile } | undefined {
  const candidates = packs.filter(
    (candidate) =>
      candidate.targetId === targetId &&
      isTargetQaPackContractCertified(
        candidate,
        profile,
        candidate.manualProfiles?.[profile],
      ),
  );
  // A manual user selects a profile, not a shell command or pack ID. Refuse an
  // ambiguous same-profile target until the UI gains a server-backed contract
  // picker; automatic deploy dispatch can still execute every exact mapping.
  if (candidates.length !== 1) return undefined;
  const pack = candidates[0];
  const profileContract = pack?.manualProfiles?.[profile];
  return pack && profileContract
    ? { pack, profile: profileContract }
    : undefined;
}

export function getManualQaProfileAvailability(
  targetId: string,
  packs: readonly TargetedSmokePack[] = TARGETED_SMOKE_PACKS,
): Record<ManualQaProfile, boolean> {
  return {
    smoke: Boolean(resolveManualQaPack(targetId, "smoke", packs)),
    regression: Boolean(resolveManualQaPack(targetId, "regression", packs)),
  };
}

