---
owner: Dev
last_updated: 2026-05-28
---

# Codebase Summary

Map of `src/` directory, key modules, and entry points. Read this first to orient.

## Top-level structure

```
src/
├── app/              Next.js App Router — route groups: (auth), (builder), (dashboard),
│                     (editor), (frontend), (payload), (preview); plus api/, sites/
├── blocks/           Page builder block components (F01, F05 AI gen targets)
├── collections/      Payload CMS collection definitions (schema source of truth)
├── components/       Shared React components (UI + feature-specific)
│   ├── ui/           shadcn/ui primitives (DO NOT modify directly)
│   └── [feature]/    Feature-scoped components (builder/, editor/, storefront/, ...)
├── data/             Seed data, static JSON (themes, templates, industry packs)
├── hooks/            Custom React hooks (TanStack Query wrappers, form helpers)
├── i18n/             Locale dictionaries (F21 localization, en/vi/ms)
├── lib/              Business logic, API clients, utilities
│   ├── ai/           OpenAI + AI gen pipeline (F01 core)
│   ├── email/        SMTP via Payload (see .claude/rules/email-smtp.md)
│   ├── payment/      Payment integration (F13 — Phase 2)
│   ├── images/       Image processing + S3 upload (via Payload cloud-storage + AWS SDK)
│   ├── cache/        Caching utilities
│   ├── storefront/   Storefront utilities (cart, editor intercepts)
│   └── otp/, analytics/, notifications/, fonts/  Feature-specific utilities
├── providers/        React context providers (theme, query client, auth)
├── scripts/          CLI tools scoped to src/ (admin, migration helpers)
├── store/            Zustand stores (builderStore, cartStore, editorStore, notificationStore)
├── types/            Shared TypeScript types
├── utils/            Misc pure utilities
├── __tests__/        Vitest unit + integration tests
└── payload.config.ts Payload CMS + DB config (schema + SMTP + S3 + plugins)
```

## Entry points

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout — theme, providers, i18n |
| `src/app/(dashboard)/**` | Admin dashboard route group |
| `src/app/(frontend)/**` | Public storefront route group |
| `src/app/(builder)/**` | Visual builder route group (F01/F05) |
| `src/app/(editor)/**` | AI editor route group (F05) |
| `src/app/(payload)/**` | Payload CMS admin UI |
| `src/app/api/**` | REST API routes (`account`, `admin`, `ai`, `analytics`, `auth`, `blog-categories`, `blogs`, `contact-submit`, `cron`, `dashboard`, ...) |
| `src/app/api/v1/sso/**` | SSO provisioning endpoint (only versioned route currently) |
| `src/app/sites/[slug]/**` | Public site rendering |
| `src/payload.config.ts` | Collections, fields, access, plugins, SMTP |
| `scripts/db-setup.js` | Migration executor (runs in `vercel build`) |

## Collections (`src/collections/`)

23 Payload collections — schema source of truth:

- **Identity:** `Users`, `Tenants`, `Subscribers`, `Subscriptions`
- **CMS:** `Pages`, `Sites`, `Templates`, `Media`, `Blogs`, `BlogCategories`
- **Commerce:** `Products`, `Categories`, `Orders`, `Customers`, `Discounts`, `DiscountUsageHistory`, `ContactSubmissions`
- **Infra:** `AiUsageLogs`, `Analytics`, `Notifications`, `PushSubscriptions`, `SEOMetaJobs`, `EmailTemplateSettings`

Adding a new collection requires: Payload config + migration in `scripts/db-setup.js` + slug in `COLLECTION_SLUGS[]`. See `.claude/rules/database-schema.md`.

## Key modules

- **AI gen pipeline** (`src/lib/ai/`) — F01 core. OpenAI client, prompt templates, block generator, variant rotation, fallback SVG, section-label dedup. See `docs/architecture/F01-ai-builder.md`.
- **Builder store** (`src/store/builderStore.ts`) — Zustand store for in-memory page tree. Gold-standard test: `src/__tests__/unit/builder/builder-store.test.ts`.
- **Stores** (`src/store/`) — `builderStore`, `cartStore`, `editorStore`, `notificationStore` (Zustand).
- **Auth** (`src/app/api/auth/`, `src/lib/auth.ts`) — JWT + Payload session, OTP via AWS SES. SSO provisioning at `src/app/api/v1/sso/`.
- **Shipping** (`src/lib/shipping/`) — F14 flat-rate Malaysia shipping. Modules: `constants.ts` (region defs, defaults, MY_STATES enum), `classify-region.ts` (state→region via isEastState), `calculate-fee.ts` (config + state + subtotal → fee + hint), `types.ts` (ShippingConfig/ShippingHint). APIs: `GET /api/sites/:siteId/shipping-config` (public read), `PATCH /api/sites/:siteId/shipping-config` (authed write), `POST /api/orders/calculate-shipping` (public calc with null/array body guard). Dashboard settings page at `src/app/(dashboard)/settings/shipping/`. Unit tests: `src/__tests__/api/orders-calculate-shipping.test.ts` (17 tests), `src/__tests__/unit/hooks/use-debounce.test.ts` (3 tests for checkout debounce). E2E: `e2e/f14-shipping.spec.ts` (US-F14-05 suite). See `docs/architecture/F14-shipping.md`.
- **Storefront utilities** (`src/lib/storefront/`) — Cart + product handling for public storefront. Modules: `editor-intercept.ts` (utility: blocks navigation inside editor iframe, shows toast), `checkout.ts` (checkout state), `index.ts` (barrel export). API: `GET /api/storefront/products` (public listing with inventory field, supports pagination + sorting). Product blocks (`products-featured`, `products-grid`, `product-quick-view`) wire the hook for real cart integration on storefront; quick-view modal implements 3-branch CTA logic (ctaUrl / hasLiveData / static). See GH-1018 changelog entry.
- **Order item builder** (`src/app/api/orders/stripe-checkout/build-order-items.ts`) — F09 checkout validation + item composition. Exports `buildOrderItems()` function (92 LOC) with guards: eligibility (status=active, not soft-deleted), variant required/found, IDOR (cross-tenant check), OOS (uses aggregate `p.inventory` not stale `variant.stock`). Handles variant pricing, formats Stripe line items (prices in sen, display names include variant). Used by `src/app/api/orders/stripe-checkout/route.ts` (POST endpoint). Guard order: product-not-found → eligibility → IDOR → variant-required → variant-found → OOS. Interfaces: `OrderItemRow`, `CheckoutItemRow`, `BuildResult`. Direct unit tests: `src/__tests__/api/build-order-items.test.ts` (7 tests, TC-F09.230–236, all pass). See GH-1084 changelog entry.
- **Order stock helpers** (`src/app/api/orders/lib/stock-utils.ts`) — F10 bug fix: variant-aware stock restock (cancel) + atomic decrement (checkout). Exports `restockItem()` + `decrementVariantStock()` functions using raw SQL CAS (compare-and-swap) for atomic concurrent protection. `decrementVariantStock()` uses `UPDATE products_variants SET stock = stock - ? WHERE _parent_id = ? AND name = ? AND stock >= ? RETURNING id` (PostgreSQL atomic), eliminating read-modify-write race. Non-variant path uses SQL `UPDATE products SET inventory = inventory + ?` (already atomic). Both functions recompute `products.inventory` aggregate post-write to sync derived field. Used by `cancel/route.ts` (restocking on order cancel) and `checkout/route.ts` (per-variant decrement on COD checkout + bank_transfer approval). Handles 4 paths per function: non-variant (aggregate `inventory`), variant-found (update `variants.stock` via SQL), variant-not-found (skip + log), product-not-found (skip). Unit tests: `src/__tests__/api/orders-cancel.test.ts` (21 tests), `src/__tests__/api/orders-checkout.test.ts` (38 tests), 59/59 passing. See GH-1082 fix.
- **Approve-payment route** (`src/app/api/orders/[id]/approve-payment/route.ts`) — Seller-facing payment verification endpoint (PATCH). Uses SQL CAS (`UPDATE WHERE status NOT IN ('cancelled', 'refunded')`) to prevent concurrent cancel from overwriting approval state. Post-CAS recheck distinguishes cancelled-race (409 CONFLICT) from double-approve idempotency (200). Calls `decrementVariantStock()` for bank_transfer variant items at approval time (decrement deferred from checkout). Pre-approval guard checks `status !== 'cancelled'` for stale orders. Tests: `src/__tests__/api/orders-approve-reject.test.ts` (TC-F10-06-44..46 for race scenarios). See GH-1082 final fix.
- **Customers** (`src/collections/Customers.ts`) — F25 first-class shop buyers entity. Tenant-scoped with multi-address book and manual rank tag (bronze/silver/gold/vip). Auto-linked to Orders by tenant+email via beforeChange hook (idempotent upsert). Admin UI list/detail views, Orders history tab, CSV export (10k cap). Hard-delete forbidden (protects Order FK integrity). 39 automated tests (TC-F25-001..010) cover idempotency, access control, field validation. See `docs/architecture/F25-shop-customers.md` + `docs/prd/F25-shop-customers.md`.
- **Discounts** (`src/collections/Discounts.ts`, `src/lib/discounts/apply-discount.ts`, `src/lib/discounts/format.ts`, `src/app/(dashboard)/discounts/**`, `src/app/api/v1/discounts/**`) — F33 discount codes with admin CRUD + storefront preview. Collections: `Discounts` (code, type percentage|fixed, value, status, usage limits, start/expiry dates, tenant-scoped) + `DiscountUsageHistory` (track order usage). Pure function `applyDiscount()` handles 9 validity checks: not-found, expired, not-started, inactive, at-limit, wrong-tenant, clamping. Admin API: `POST /api/v1/discounts` (create), `GET /api/v1/discounts` (tenant-scoped list with type filter + sort), `PATCH /api/v1/discounts/:id` (update), `DELETE /api/v1/discounts/:id` (soft-delete), `GET /api/v1/discounts/usage-history` (cross-discount usage history with date range + pagination). Storefront API: `POST /api/storefront/discounts/apply` (rate-limited 20/60s, silent-reject no reason leak, always HTTP 200). Order integration: server-side recomputation at checkout/stripe-checkout, usage history row on order creation (idempotent). Dashboard UI (Phase 1): `src/app/(dashboard)/discounts/` RSC list page + client layout with sortable table, toolbar (search/filters), status badge, usage meter. Dashboard UI (Phase 2): `src/app/(dashboard)/discounts/new` (RSC create page), `src/app/(dashboard)/discounts/[id]` (RSC edit page with form + delete), `src/app/(dashboard)/discounts/usage-history` (S4 usage history with date range filters). Formatting utilities: `src/lib/discounts/format.ts` (fmtRM, fmtValue, fmtDate). Navigation added to Sidebar and EditorMenuDrawer. Unit tests (TC-F33-01..09), integration tests (TC-F33-10..23). See `docs/qa/F33-discounts.md`.
- **Email Template Settings** (`src/collections/EmailTemplateSettings.ts`) — F32 per-tenant email customization. Slug: `email-template-settings`. Stores subject/greeting/ctaLabel/closing overrides for 15 email template types (otp-verification, forgot-password, password-changed, order-confirmation, etc.) in 2 languages (English, Malay). Enable/disable toggle per template with critical-type guard (otp/forgot-pwd/pwd-changed cannot be disabled). Tenant-scoped access. afterChange/afterDelete hooks invalidate Redis cache. See `docs/architecture/F32-email-template-cms-settings.md`.
- **Site Renderer utilities** (`src/lib/site-renderer/`) — GH-1023 global block detection + injection. Pure utility functions: `detect-commerce-presence.ts` (scans pages for commerce block types), `extract-first-global-block.ts` (finds first block instance of given type), `has-header-cart.ts` (checks if header navigation includes cart button). Used by `SiteRenderer` to auto-inject globally-scoped blocks (cart widget, social, WhatsApp) into all pages. See GH-1023 changelog entry.
- **Images / S3** (`src/lib/images/`, Payload plugin-cloud-storage) — upload via AWS SDK v3 to DO Spaces-compatible S3.
- **Email** (`src/lib/email/`) — F32 email template customization + send integration. Modules: `types.ts` (EmailTemplateType enum, 15 types), `get-template-config.ts` (Redis cache 300s TTL + Payload DB lookup), `merge-template-config.ts` (config override merge + variable substitution with HTML escaping), `preview-fixtures.ts` (mock data per template type), `template-registry.ts` (type → render fn mapping), `send.ts` (extended with templateType/config params, enabled toggle suppresses send). API: `POST /api/email-preview` (authenticated, returns subject + html, no persist/send). Dashboard: `src/app/(dashboard)/settings/email-templates/` with live preview (sandboxed iframe, debounced). Backward compatible: no config row = hardcoded defaults. 25 automated tests (TC-F32-001..020). See `.claude/rules/email-smtp.md` + `docs/architecture/F32-email-template-cms-settings.md`.
- **Test harness** (`scripts/test-harness/`) — E2E page-gen regression harness with Playwright visual diff.
- **Template drift validator** (`src/lib/ai/template-drift-validator.ts`) — scans TS presets + DB templates against live block registry; CI gate + post-deploy preflight. Paired with `block-schema-version.ts` hash stamped on seed.
- **Templates health dashboard** (`src/app/(dashboard)/templates-health/`) — super-admin page surfacing per-template drift badges + re-seed/re-harness buttons.
- **Block CRUD (SettingsPanel)** (`src/components/editor/SettingsPanel.tsx`) — F05 editor settings panel with nested array manipulation for menu blocks (menu-display, menu-food). Exports helpers: `updateNestedItem()`, `addNestedItem()`, `removeNestedItem()` for two-level nesting (categories → items). Handles dietary tag validation, isPopular/isNew flags, RichText fields. See `docs/architecture/F08-products-crud.md` Phase 03 (GH-1024).

## Notable patterns

- **Path alias:** `@/*` → `./src/*` (tsconfig.json)
- **Strict TS:** `strict: true` in tsconfig; no `any` unless justified
- **Server components first:** App Router defaults to RSC; add `'use client'` only when needed
- **`force-dynamic` required:** Pages using `getPayload()` or `SiteRenderer` must `export const dynamic = 'force-dynamic'`

## Related docs

- Feature detail: `docs/architecture/F*.md`, `docs/prd/F*.md`
- System architecture (layers + data flow): `docs/architecture/_OVERVIEW.md`
- Code standards (lint, imports, naming): `docs/standards/CODE_STANDARDS.md`
- Harness rubric QC guide (all 11 dims, 58 criteria, FAQ): `docs/standards/HARNESS_EVALUATION_RULES.md`
- DB lifecycle: `docs/DB-LIFECYCLE.md`
