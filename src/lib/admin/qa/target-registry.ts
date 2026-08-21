export type TargetDomain =
  | "Auth & Identity"
  | "AI & Builder"
  | "Editor"
  | "Products"
  | "Orders"
  | "Settings & Payments"
  | "Storefront"
  | "SEO & Analytics"
  | "Localization"
  | "Shipping & Logistics"
  | "Subscribers & Customers"
  | "Blog & Marketing"
  | "Subscriptions"
  | "Webhooks & Platform";

export type TargetType = "screen" | "user_flow" | "feature";

export type CoverageStatus = "automated" | "partial" | "manual_only" | "unknown";

export interface TargetPackInfo {
  name: string;
  testCountLabel: string;
  estimatedDuration: string;
  description: string;
}

export interface CmsTarget {
  id: string;
  name: string;
  domain: TargetDomain;
  description: string;
  type: TargetType;
  coverage: CoverageStatus;
  active: boolean;
  fixture?: string;
  defaultPacks?: TargetPackInfo[];
  owner: string;
}

/**
 * Complete versioned CMS Target Registry (67 targets).
 * Note: Studio admin features (template builder, block editor, admin analytics, etc.)
 * are intentionally excluded because Studio admin is the internal host, never a product test target.
 */
export const CMS_TARGET_REGISTRY: readonly CmsTarget[] = [
  // ── 1. Auth & Identity (4) ────────────────────────────────────────────────
  {
    id: "identity-login-otp",
    name: "Login & OTP Verification",
    domain: "Auth & Identity",
    description: "Seller login flow with OTP verification and rate limiting",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-User-Seller-01",
    owner: "qa-auth-team",
  },
  {
    id: "identity-password-recovery",
    name: "Password Recovery & Reset",
    domain: "Auth & Identity",
    description: "Forgot password email link and tokenized password reset",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-User-Seller-02",
    owner: "qa-auth-team",
  },
  {
    id: "identity-sso-session",
    name: "SSO Session & Refresh Token",
    domain: "Auth & Identity",
    description: "Cross-domain SSO session exchange and token refresh lifecycle",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-auth-team",
  },
  {
    id: "identity-staff-invitation",
    name: "Staff Invitation & Registration",
    domain: "Auth & Identity",
    description: "Inviting team members with role assignments and token activation",
    type: "user_flow",
    coverage: "manual_only",
    active: true,
    owner: "qa-auth-team",
  },

  // ── 2. AI & Builder (5) ───────────────────────────────────────────────────
  {
    id: "builder-generate-site",
    name: "AI Site Generation Wizard",
    domain: "AI & Builder",
    description: "Multi-step AI wizard creating page blocks from prompt input",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-Prompt-Bakery",
    owner: "qa-builder-team",
  },
  {
    id: "builder-draft-recovery",
    name: "Builder Draft & Auto-Save",
    domain: "AI & Builder",
    description: "Auto-saving builder changes and recovering uncommitted drafts",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-builder-team",
  },
  {
    id: "builder-preview-completion",
    name: "Full Site Preview & Completion",
    domain: "AI & Builder",
    description: "Switching viewport previews and completing site setup",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-builder-team",
  },
  {
    id: "builder-variety-template-apply",
    name: "Template Variety & Rotation",
    domain: "AI & Builder",
    description: "Applying Industry templates and block variety pools",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-builder-team",
  },
  {
    id: "builder-url-scraper-import",
    name: "URL Content Scraper & Import",
    domain: "AI & Builder",
    description: "Scraping brand content from external URL into site draft",
    type: "user_flow",
    coverage: "manual_only",
    active: true,
    owner: "qa-builder-team",
  },

  // ── 3. Editor (6) ────────────────────────────────────────────────────────
  {
    id: "editor-load-and-tenant-access",
    name: "Editor Core & Tenant Guard",
    domain: "Editor",
    description: "Loading canvas, layout tree and verifying tenant isolation",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-editor-team",
  },
  {
    id: "editor-block-content",
    name: "Block Content Editing",
    domain: "Editor",
    description: "Inline rich text, image replacement and props configuration",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-editor-team",
  },
  {
    id: "editor-pages-navigation",
    name: "Page & Navigation Builder",
    domain: "Editor",
    description: "Creating pages, reordering menu links and page slug settings",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-editor-team",
  },
  {
    id: "editor-publish-lifecycle",
    name: "Page Publish & Rollback",
    domain: "Editor",
    description: "Publishing page draft to live storefront and rollback history",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-Spa-Publish",
    defaultPacks: [
      {
        name: "Smoke",
        testCountLabel: "8 TC",
        estimatedDuration: "3 min",
        description: "Publish, unpublish and basic rollback checks",
      },
    ],
    owner: "qa-editor-team",
  },
  {
    id: "editor-productgrid-variants",
    name: "Product Grid & Variant Selection",
    domain: "Editor",
    description: "Configuring Product Grid block, variant lists and stock display",
    type: "feature",
    coverage: "partial",
    active: true,
    fixture: "QA-Tshirt-SML",
    defaultPacks: [
      {
        name: "Smoke",
        testCountLabel: "12 TC",
        estimatedDuration: "4 min",
        description: "Variant selection flow and product data binding",
      },
    ],
    owner: "qa-editor-team",
  },
  {
    id: "editor-seo-local-business",
    name: "Editor SEO & Local Business",
    domain: "Editor",
    description: "Configuring meta tags, OpenGraph images and LocalBusiness schema",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-editor-team",
  },

  // ── 4. Products (6) ───────────────────────────────────────────────────────
  {
    id: "products-list-search-filter",
    name: "Products List & Filters",
    domain: "Products",
    description: "Searching, sorting and filtering seller product inventory",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-products-team",
  },
  {
    id: "products-crud-publish-guard",
    name: "Product CRUD & Readiness Guard",
    domain: "Products",
    description: "Creating/updating products and verifying publish readiness checklist",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-Product-Bag-01",
    owner: "qa-products-team",
  },
  {
    id: "products-variants-inventory",
    name: "Product Variants & Inventory",
    domain: "Products",
    description: "Managing SKU options, prices, weights and stock levels",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-products-team",
  },
  {
    id: "products-bulk-create",
    name: "Bulk Products Import",
    domain: "Products",
    description: "Parsing CSV/Excel product catalog and bulk creating items",
    type: "user_flow",
    coverage: "partial",
    active: true,
    owner: "qa-products-team",
  },
  {
    id: "product-categories",
    name: "Category Taxonomy",
    domain: "Products",
    description: "Parent-child categories, slug integrity and product assignments",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-products-team",
  },
  {
    id: "products-ai-description",
    name: "AI Product Generator",
    domain: "Products",
    description: "Generating AI product title, description, tags and alt text",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-products-team",
  },

  // ── 5. Orders (6) ─────────────────────────────────────────────────────────
  {
    id: "orders-list-search-metrics",
    name: "Orders Dashboard & Search",
    domain: "Orders",
    description: "Filtering orders by status, buyer name and calculating revenue metrics",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-orders-team",
  },
  {
    id: "order-payment-verification",
    name: "Order Payment Verification",
    domain: "Orders",
    description: "Reviewing bank transfer receipts, approving or rejecting payments",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-Order-Visa-001",
    defaultPacks: [
      {
        name: "Smoke",
        testCountLabel: "18 TC",
        estimatedDuration: "6 min",
        description: "Payment verification and order status transition",
      },
    ],
    owner: "qa-orders-team",
  },
  {
    id: "order-refund-cancel-retry",
    name: "Order Cancellation & Refund",
    domain: "Orders",
    description: "Cancelling orders, restocking inventory and triggering refund emails",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-orders-team",
  },
  {
    id: "order-fulfilment-self-delivery",
    name: "Self Delivery Fulfilment",
    domain: "Orders",
    description: "Fulfilling orders with custom courier and tracking number",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-orders-team",
  },
  {
    id: "order-shipping-label",
    name: "Shipping Label Generation",
    domain: "Orders",
    description: "Rendering printable PDF air waybills and mobile labels",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-orders-team",
  },
  {
    id: "order-tracking-stream",
    name: "Order Tracking & Event Stream",
    domain: "Orders",
    description: "Live tracking updates stream for buyers and sellers",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-orders-team",
  },

  // ── 6. Settings & Payments (8) ───────────────────────────────────────────
  {
    id: "payment-settings-manual",
    name: "Manual Payment Gateways",
    domain: "Settings & Payments",
    description: "Configuring bank transfer instructions and QR code uploads",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "stripe-connect-lifecycle",
    name: "Stripe Connect Integration",
    domain: "Settings & Payments",
    description: "Stripe OAuth onboarding, account status sync and webhook handling",
    type: "user_flow",
    coverage: "partial",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "xendit-connect-checkout",
    name: "Xendit Payment Integration",
    domain: "Settings & Payments",
    description: "Configuring Xendit API keys, e-wallets and checkout redirect",
    type: "user_flow",
    coverage: "partial",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "shipping-rates-pickup-config",
    name: "Shipping Rates & Pickup",
    domain: "Settings & Payments",
    description: "Setting flat/weight shipping rates and store pickup address",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "easyparcel-oauth-lifecycle",
    name: "EasyParcel OAuth & API",
    domain: "Settings & Payments",
    description: "EasyParcel account linking, API credentials and rate sync",
    type: "user_flow",
    coverage: "partial",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "domains-custom-domain-primary",
    name: "Custom Subdomain & Primary Domain",
    domain: "Settings & Payments",
    description: "Vercel domain addition, SSL validation and primary domain toggle",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "email-template-management",
    name: "Email Templates & Test Sender",
    domain: "Settings & Payments",
    description: "Customizing transactional email templates and sending test emails",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-settings-team",
  },
  {
    id: "staff-rbac-management",
    name: "Staff Directory & RBAC",
    domain: "Settings & Payments",
    description: "Managing staff permissions, roles and store access boundaries",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-settings-team",
  },

  // ── 7. Storefront (8) ─────────────────────────────────────────────────────
  {
    id: "public-page-routing",
    name: "Public Page Routing",
    domain: "Storefront",
    description: "Rendering storefront home, custom pages and 404 handler",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },
  {
    id: "storefront-product-discovery",
    name: "Storefront Product Discovery",
    domain: "Storefront",
    description: "Product catalog grid, detail modal, price display and variant selector",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },
  {
    id: "storefront-cart",
    name: "Shopping Cart & Persistence",
    domain: "Storefront",
    description: "Cart drawer, item quantity updates, subtotal and local persistence",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },
  {
    id: "storefront-discount-checkout",
    name: "Cart Discount & Checkout",
    domain: "Storefront",
    description: "Applying coupon codes, customer details and submitting order",
    type: "user_flow",
    coverage: "automated",
    active: true,
    fixture: "QA-Checkout-COD-001",
    defaultPacks: [
      {
        name: "Smoke",
        testCountLabel: "14 TC",
        estimatedDuration: "5 min",
        description: "Checkout completion and order confirmation page",
      },
    ],
    owner: "qa-storefront-team",
  },
  {
    id: "storefront-order-confirm-track",
    name: "Order Confirmation & Track",
    domain: "Storefront",
    description: "Post-purchase confirmation page, bank details and public tracking",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },
  {
    id: "storefront-blog-contact",
    name: "Storefront Blog & Contact",
    domain: "Storefront",
    description: "Public blog reader, category filter and contact form submission",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },
  {
    id: "public-seo-discovery",
    name: "Storefront Technical SEO",
    domain: "Storefront",
    description: "Robots.txt, sitemap.xml, canonical URLs and structured JsonLD",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },
  {
    id: "tenant-domain-routing",
    name: "Multi-Tenant Domain Resolver",
    domain: "Storefront",
    description: "Resolving tenant storefront by custom domain or subdomain slug",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-storefront-team",
  },

  // ── 8. SEO & Analytics (4) ────────────────────────────────────────────────
  {
    id: "seo-tools-automation",
    name: "SEO Analyzer & Fix Automation",
    domain: "SEO & Analytics",
    description: "Auditing page SEO scores, auto-generating missing meta tags",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-seo-team",
  },
  {
    id: "local-seo-gbp-map",
    name: "Local Business & Google Map",
    domain: "SEO & Analytics",
    description: "Validating Google Business Profile links and LocalBusiness schema",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-seo-team",
  },
  {
    id: "seo-rank-keyword-density",
    name: "Keyword Density & Ranking",
    domain: "SEO & Analytics",
    description: "Analyzing keyword frequency, head/body density and search ranks",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-seo-team",
  },
  {
    id: "tracking-analytics-config",
    name: "Analytics & Pixel Tracking",
    domain: "SEO & Analytics",
    description: "Google Tag Manager, Facebook Pixel and custom analytics script injection",
    type: "feature",
    coverage: "manual_only",
    active: true,
    owner: "qa-seo-team",
  },

  // ── 9. Localization (3) ───────────────────────────────────────────────────
  {
    id: "project-content-localization",
    name: "Multi-Language Content",
    domain: "Localization",
    description: "Editing multilingual fields (EN/MS/ZH) and translation fallbacks",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-i18n-team",
  },
  {
    id: "locale-switching-routing",
    name: "Locale Detection & Subpath",
    domain: "Localization",
    description: "Browser locale detection and language switcher dropdown",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-i18n-team",
  },
  {
    id: "ai-translate-workflow",
    name: "AI Content Translation",
    domain: "Localization",
    description: "Batch translating page content using AI translation endpoint",
    type: "user_flow",
    coverage: "unknown",
    active: true,
    owner: "qa-i18n-team",
  },

  // ── 10. Shipping & Logistics (4) ──────────────────────────────────────────
  {
    id: "easyparcel-shipment-booking",
    name: "EasyParcel Shipment Booking",
    domain: "Shipping & Logistics",
    description: "Auto-booking EasyParcel couriers and retrieving AWB PDF",
    type: "user_flow",
    coverage: "partial",
    active: true,
    owner: "qa-shipping-team",
  },
  {
    id: "shipping-rate-calculator",
    name: "Shipping Rate Calculator",
    domain: "Shipping & Logistics",
    description: "Calculating shipping fees based on item weight, destination and rules",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-shipping-team",
  },
  {
    id: "easyparcel-tracking-webhooks",
    name: "EasyParcel Tracking Webhooks",
    domain: "Shipping & Logistics",
    description: "Processing webhook status updates from EasyParcel API",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-shipping-team",
  },
  {
    id: "cod-eligibility-check",
    name: "COD Region Eligibility",
    domain: "Shipping & Logistics",
    description: "Checking postcode eligibility for Cash-on-Delivery payment",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-shipping-team",
  },

  // ── 11. Subscribers & Customers (3) ────────────────────────────────────────
  {
    id: "shop-customers-directory",
    name: "Customer Directory & History",
    domain: "Subscribers & Customers",
    description: "Listing shop customers, spending metrics and purchase history",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-customers-team",
  },
  {
    id: "contact-lead-submissions",
    name: "Contact Form Submissions",
    domain: "Subscribers & Customers",
    description: "Storing contact inquiries, seller notifications and export",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-customers-team",
  },
  {
    id: "newsletter-subscription",
    name: "Newsletter Subscriptions",
    domain: "Subscribers & Customers",
    description: "Collecting subscriber emails and digest summary export",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-customers-team",
  },

  // ── 12. Blog & Marketing (4) ──────────────────────────────────────────────
  {
    id: "blog-post-management",
    name: "Blog Article Management",
    domain: "Blog & Marketing",
    description: "CRUD operations for blog posts, cover images and AI draft assistant",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-content-team",
  },
  {
    id: "blog-category-management",
    name: "Blog Categories & Tags",
    domain: "Blog & Marketing",
    description: "Organizing blog posts into categories and SEO slug generation",
    type: "screen",
    coverage: "automated",
    active: true,
    owner: "qa-content-team",
  },
  {
    id: "discount-rules-coupons",
    name: "Discount Coupons & Rules",
    domain: "Blog & Marketing",
    description: "Percentage/amount discount coupons, usage limits and expiry dates",
    type: "user_flow",
    coverage: "automated",
    active: true,
    owner: "qa-content-team",
  },
  {
    id: "broadcast-announcement-banner",
    name: "Broadcast Announcement Banners",
    domain: "Blog & Marketing",
    description: "Creating top bar announcement banners and scheduled popups",
    type: "feature",
    coverage: "partial",
    active: true,
    owner: "qa-content-team",
  },

  // ── 13. Subscriptions (3) ─────────────────────────────────────────────────
  {
    id: "plan-subscription-billing",
    name: "Storefront Subscription & Upgrade",
    domain: "Subscriptions",
    description: "Seller plan selection (Free/Pro), upgrade flow and Xendit billing",
    type: "user_flow",
    coverage: "partial",
    active: true,
    owner: "qa-billing-team",
  },
  {
    id: "feature-guard-enforcement",
    name: "Plan Feature Guarding",
    domain: "Subscriptions",
    description: "Enforcing plan limits (custom domain, staff seats, AI quotas)",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-billing-team",
  },
  {
    id: "payment-expiry-cron",
    name: "Payment Expiry & Auto-Cancel",
    domain: "Subscriptions",
    description: "Cron job expiring unpaid orders and releasing reserved inventory",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-billing-team",
  },

  // ── 14. Webhooks & Platform (3) ───────────────────────────────────────────
  {
    id: "webhook-contracts",
    name: "Webhook Ingestion Contracts",
    domain: "Webhooks & Platform",
    description: "Validating Stripe, Xendit and Vercel webhook HMAC signatures",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-platform-team",
  },
  {
    id: "media-library-upload",
    name: "Media Library & S3 Presign",
    domain: "Webhooks & Platform",
    description: "S3 presigned upload URLs, image compression and stock media catalog",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-platform-team",
  },
  {
    id: "tenant-row-locking",
    name: "Multi-Tenant Data Isolation",
    domain: "Webhooks & Platform",
    description: "Row-level locking and tenant isolation guards across collections",
    type: "feature",
    coverage: "automated",
    active: true,
    owner: "qa-platform-team",
  },
] as const;

export function getAllActiveTargets(): CmsTarget[] {
  return CMS_TARGET_REGISTRY.filter((target) => target.active);
}

export function getTargetById(id: string): CmsTarget | undefined {
  return CMS_TARGET_REGISTRY.find((target) => target.id === id);
}

export function getTargetsByDomain(domain: TargetDomain): CmsTarget[] {
  return CMS_TARGET_REGISTRY.filter(
    (target) => target.active && target.domain === domain,
  );
}

export function getTargetDomains(): TargetDomain[] {
  const domains = new Set<TargetDomain>();
  for (const target of CMS_TARGET_REGISTRY) {
    if (target.active) {
      domains.add(target.domain);
    }
  }
  return Array.from(domains);
}
