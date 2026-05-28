---
owner: Dev
last_updated: 2026-05-20
---

# Project Changelog

Curated per-release notes. Seeded 2026-04-19 from v1.0 kickoff (commit `6c06d015`, 2026-03-13) through 2026-04-19. Maintained per-release going forward — see `docs/PROJECT_ALIGNMENT.md` for priorities.

Source: `git log main --since=2026-03-13 --merges --first-parent` (~370 merges, filtered to `feat:` + `fix:` only).

For full architectural decisions + incident post-mortems: see `docs/journals/`.

---

## [Unreleased] — Staging

### F32 — Email Template CMS Settings

**Features:**
- Per-tenant customization of 15 transactional email templates (subject, greeting, CTA label, closing) in 2 languages (English, Malay)
- Enable/disable toggle per template with critical-type guard (otp-verification, forgot-password, password-changed cannot be disabled)
- Real-time preview via `/api/email-preview` (sandboxed iframe, debounced 300ms, no DB write/send)
- Upstash Redis cache (TTL 300s) for config lookups; invalidates on save/delete
- New Payload collection: `email-template-settings` (multi-tenant scoped, unique index on tenant+type+recipient)
- Dashboard navigation: Settings → Email Templates
- 15 email template functions refactored to accept optional CMS override config
- Backward compatible: no config row = hardcoded defaults, send behavior unchanged

**Email Template Types (15):**
- Critical (cannot disable): otp-verification, forgot-password, password-changed
- Commerce: order-confirmation, shipment-notification, refund-processed
- User: welcome, contact-confirmation, subscription-created, subscription-canceled
- Engagement: review-notification, product-restock, discount-alert, feature-announcement, generic

**Code changes:**
- New: `src/collections/EmailTemplateSettings.ts` (Payload collection definition)
- New: `src/lib/email/types.ts` (EmailTemplateType enum, EmailRecipient enum)
- New: `src/lib/email/get-template-config.ts` (Redis cache + Payload DB lookup)
- New: `src/lib/email/merge-template-config.ts` (config merge + variable substitution with HTML escaping)
- New: `src/lib/email/preview-fixtures.ts` (mock data per template type)
- New: `src/lib/email/template-registry.ts` (templateType → render fn mapping)
- New: `src/lib/redis.ts` (shared Upstash Redis singleton, extracted from rateLimit.ts)
- New: `src/app/api/email-preview/route.ts` (authenticated preview endpoint)
- New: `src/app/(dashboard)/settings/email-templates/` (page + UI components, server actions)
- Modified: `src/lib/email/send.ts` (extended with templateType/recipient/tenantId/config params)
- Modified: `src/lib/rateLimit.ts` (import redis from ./redis)
- Modified: `src/payload.config.ts` (register EmailTemplateSettings collection)
- Modified: `scripts/db-setup.js` (4 migrations: create table, add columns, create indices)
- Modified: `src/components/dashboard/Sidebar.tsx` + `src/components/editor/EditorMenuDrawer.tsx` (add "Email Templates" nav item)

**Tests:**
- 25 automated test cases (TC-F32-001..020): cache layer (hit/miss/null/fallback), merge/variable substitution, multi-tenant isolation, backward compat, critical-type guard, HTML escaping
- Unit tests: `src/__tests__/unit/email/get-template-config.test.ts` (6 tests), `src/__tests__/unit/email/merge-template-config.test.ts` (11 tests)
- Integration tests: `src/__tests__/integration/email-settings/multi-tenant-isolation.test.ts` (8 tests)
- All tests pass; 100% coverage on new code

**Security:**
- All DB ops scoped to getCurrentTenantId() (IDOR prevention)
- Critical types (otp/forgot-pwd/pwd-changed) cannot be disabled (gated at server action + UI)
- Preview API: authenticated, enum-validated templateType, no DB write/send
- HTML-escaping of all substituted values prevents XSS injection

**Non-breaking:**
- No changes to existing email send paths
- Existing order/user emails render identically when no config row exists
- All 15 template functions accept optional config; backward compatible with undefined

### GH-1084 — Add-to-Cart Variant Selection + Stock Fix (F09 Phase 03)

**Bug → Feature:** Checkout flow failed silently when products with variants were added without explicit variant selection, or when variant pricing was stale. Root cause: `buildOrderItems` function was embedded in stripe-checkout route, duplicating logic and making testing difficult. Eligibility guards were missing (draft/deleted products accepted), and OOS logic used per-variant `stock` field which is never decremented (causing stale reads).

**Implementation:**
- **New module:** `src/app/api/orders/stripe-checkout/build-order-items.ts` — extracted `buildOrderItems()` function (92 LOC) with comprehensive guards:
  - **Eligibility guard** — rejects draft products (`status !== 'active'`) + soft-deleted products (`deletedAt` set) before attempting variant/stock resolution
  - **Variant guards** — `VARIANT_REQUIRED` (hasVariants product missing variant field), `VARIANT_NOT_FOUND` (variant name doesn't exist on product)
  - **IDOR guard** — cross-tenant rejection when `tenantId` mismatch
  - **OOS guard** — uses aggregate `p.inventory` (decrement via stock-CAS in COD flow), NOT per-variant `variant.stock` (never decremented, permanently stale)
  - **Pricing:** variant.price used when variant selected; base product.price otherwise
  - **Stripe format:** line items include variant name in display ("Shirt (Red)"), prices in sen (smallest unit: 100 sen = RM 1)
- **Route integration:** `src/app/api/orders/stripe-checkout/route.ts` — imports `buildOrderItems()`, eliminates duplicated logic
- **Direct unit tests:** `src/__tests__/api/build-order-items.test.ts` (7 tests, TC-F09.230–236) — covers eligibility, variant, pricing, OOS, non-variant paths. All pass.
- **TypeScript:** `OrderItemRow`, `CheckoutItemRow`, `BuildResult` interfaces exported from module for reuse.

**Guard order (defensive depth):**
1. Product not found (NULL check)
2. Eligibility (status + deletedAt)
3. IDOR (tenant mismatch)
4. Variant required (if hasVariants)
5. Variant resolution (name lookup)
6. OOS (aggregate inventory)

**Code review fixes (post-merge):**
- Removed orphaned `useAddToCart` hook (`use-add-to-cart.ts`) — dead code superseded by `AddToCartButton` inline logic
- Fixed inventory source-of-truth in `ProductAddToCartSection`: was using `selectedVariant.stock` (stale), now uses `product.inventory` (aggregate, CAS-decremented)

**Breaking change:** None. New module is extraction + consolidation; stripe-checkout route behavior unchanged. Old tests for route now test module directly.

**Impact:**
- Checkout now rejects draft products and correctly identifies missing/stale variants before Stripe API call
- OOS logic now uses authoritative aggregate inventory (not stale per-variant stock)
- Future per-variant stock decrement (US-1084 Phase 04) will extend variant.stock logic; today aggregate only

**UX Design Decision — Listing pages route to PDP, not direct add-to-cart:**
- `products-grid` block: all products (variant or not) show **"View Detail"** → navigate to PDP. Rationale: PDP is the authoritative purchase entry point; enforces correct variant selection and stock display before cart.
- `products-featured` hero block: **"Add to Cart" button removed**. Only "View Details" link remains.
- `product-quick-view` modal (live products): CTA changed from direct add-to-cart to **"View Product"** → navigate to PDP. Applies regardless of OOS state — PDP handles stock display.

This is intentional — not a regression. `useAddToCart` is still used on PDP via `ProductAddToCartSection`.

**Related:** GH-1084 Phase 01 (client-side variant picker), Phase 02 (eligibility guards), Phase 03 (extraction + direct testing), Phase 04 (per-variant stock — pending)

### F25 Code Review Gap Fixes (Phase 1 — CQ-01 to CQ-04)

**4 important issues fixed post-implementation review:**
- **CQ-01:** Added `orders.customer_id_fk` FK migration with `ON DELETE SET NULL` constraint. Ensures customer deletion (if ever enabled) does not cascade-delete orders; sets `customer_id` to NULL instead.
- **CQ-02:** Phone field schema + validation hardened. Added `customers.phone_type_varchar20` migration (aligns schema to spec); added > 20 chars null-guard in `normalizePhone()` for defence-in-depth against malicious direct API calls bypassing frontend validation.
- **CQ-03:** Fixed useCallback missing dep warning in `customers-client-layout.tsx`. Extracted `loadFailedMsg` const before `load` callback to avoid stale-closure on locale change; added to dependency array.
- **CQ-04:** CSV export `csvField` now strips `\r\n` before formula-injection guard (aligns with `sanitizeCell` behavior in dashboard, prevents row-boundary confusion in RFC 4180 parsers).

**Tests:** All customers-related unit tests pass; ESLint exhaustive-deps warning resolved.

**Impact:** F25 backend robustness + API contract hardening. Zero breaking changes; feature fully spec-compliant.

### F25 Code Review Gap Fixes (Phase 2 — CQ-05 to CQ-06)

**2 minor docs issues resolved post-implementation review:**
- **CQ-05:** Fixed stale architecture description — `docs/architecture/F25-shop-customers.md` §2 now correctly documents latest-wins behavior: `syncCustomerSnapshot` patches denormalized name/phone on `operation=create` AND on `update` when `customerName` or `customerPhone` differ from `previousDoc`. Previously doc said "create-only", but implementation was already correct.
- **CQ-06:** Added missing `customers.normalize_existing_phones` migration entry to `docs/architecture/F25-shop-customers.md` §4 migrations table. Migration exists in `scripts/db-setup.js` and is required for partial unique index on existing phone data; now spec-aligned.

**Impact:** Architecture docs now fully align with implementation. Zero code changes; pure documentation accuracy fix.

### F25 Light/Dark Mode Theming (CSS Variable Refactor)

**Theming refactor — pure visual, no behavior changes:**
- **CSS variables added:** `src/app/globals.css` introduces `--cus-*` semantic token set for F25 Customers feature (26 tokens + rank badge variants). Covers surfaces (card, header, dropdown, info), borders (subtle/medium/strong), text layers (secondary/muted/subtle/faint), code blocks, skeletons, and 4 rank badges (VIP/Gold/Silver/Bronze) with light + dark mode overrides.
- **Component refactoring:** All 6 customer UI components refactored to replace hardcoded dark colors with `var(--cus-*)` tokens. Affected: `customer-list.tsx`, `customer-detail.tsx`, `customer-*-tab.tsx`, rank badge components.
- **Light mode support:** Full light mode palette added to complement existing dark baseline; all UI automatically respects `<html class="dark">` toggle.

**Impact:** F25 feature now theme-aware; no breaking changes; visual behavior identical, just token-driven instead of hardcoded.

### F25 Review Bug Fixes (Wave 2 polish)

**10 bugs fixed across backend + frontend after code review:**
- **BE-1:** `Customers.ts` beforeChange hook now normalizes phone: trim → strip `[-\s().]` → lowercase → null on empty
- **BE-2:** `auto-link-customer.ts` found-customer path no longer overwrites existing customer addresses (was losing address book on duplicate phone)
- **FE-1:** `customers-client-layout.tsx` — added stale genRef response guard + useCallback memoization for click handler
- **BE-3/BE-4:** `Orders.ts` corrected `shippingAddress` + `customerName` field descriptions (were swapped)
- **FE-3:** Renamed `customers-atoms.tsx` → `customers-shared-ui.tsx` (clarity)
- **FE-4:** `customers-detail-default-tab.tsx` added fallback split guard `?? ''` (prevent undefined spread in JSX)
- **FE-5:** `actions.ts` `meta` returns `safePage` not raw `page` (defensive pagination bound)
- **FE-6:** `customers-list-toolbar.tsx` Apply button now disabled when `localFrom > localTo` (date range validation)
- **BE-7:** Added 3 regression tests: `auto-link-customer.test.ts` (TC-F25-006b, TC-F25-02-20) covering phone edge cases + address preservation

**Impact:** F25 feature now spec-aligned; no breaking changes; all tests pass.

### F25 Round 2 — Bug Fixes (Phone Normalization + Hooks Stability)

**6 issues fixed post-review:**
- **fix(customers):** strip `+` from phone normalization — prevents identity fragmentation (`+60...` vs `60...` treated as different customers). Regex `/[-\s()+.]/g` applied in `auto-link-customer.ts`, `Customers.ts` beforeChange hook, plus tests (TC-F25-09-01..02).
- **fix(customers):** `latestOrderAt` now only written on `operation=create` in `syncCustomerSnapshot.ts`. Previously updated on edit, causing historical timestamp corruption (TC-F25-09-03).
- **fix(customers):** `syncCustomerSnapshot.ts` checks `operation === 'create'` before writing denormalized fields, preventing overwrites on order edits (TC-F25-09-04..05).
- **fix(customers):** CSV export `sanitizeCell` now strips embedded newlines (`\r\n`) per RFC 4180. Prevents cell value escape corruption in Excel (TC-F25-09-06).
- **fix(customers):** `fetchOrderStats` single-customer limit raised from 1 000 to 5 000 rows. Supports high-volume customer detail pages without query pagination (TC-F25-09-07).
- **test(customers):** new `sync-customer-snapshot.test.ts` — 9 tests covering operation semantics, field isolation, latestOrderAt timing (TC-F25-09-01..07).

**Impact:** Phone identity fragmentation eliminated; snapshot isolation guarantees met; large customer exports stable. Zero breaking changes; 79 tests pass.

---

### GH-1018 — Code Review Bug Fixes (iframe guard + DRY editor detection)

**Bug fixes (fix/BUG-F05-1018-block-product-view-detail):**
- **Quick View iframe guard tightened** — replaced over-broad `if (window.parent !== window)` with scoped `isInEditorPreview()` check. Fixes silent navigation break in non-editor iframe embeds (preview tools, embeds); preserves editor-preview toast behavior when `?editor` or `?builder` query param present.
- **DRY editor detection** — extracted duplicated `window.parent !== window && (?editor || ?builder)` logic into `isInEditorPreview()` utility exported from `src/lib/storefront/editor-intercept.ts`. Consumed by `handleCartClick()`, `useAddToCart()`, and Quick View button handler. Includes SSR guard (`typeof window === 'undefined'` → false).

**Impact:** Quick View button now navigates correctly in non-editor iframe embeds; add-to-cart toast still blocks navigation in editor preview.

---

### GH-1018 — Block Product Navigation + Add to Cart Wiring (F05 Bug Fix + Enhancement)

**Bug → Feature:** Product block links (products-featured "View Details", products-grid "Quick View") navigated inside editor iframe, breaking layout. Enhanced to add real Add to Cart functionality on public storefront.

**Implementation:**
- **New hook:** `src/lib/storefront/use-add-to-cart.ts` — `useAddToCart(product, siteSlug, siteId)` hook encapsulates cart logic: adds item to `cartStore`, tracks `add_to_cart` event, editor guard via iframe detection (`window.parent !== window`), out-of-stock check via `product.inventory`.
- **API enhancement:** `src/app/api/storefront/products/route.ts` (new) — public endpoint for product listing. Query params: `site` (required), `limit`, `page`, `sort`. Returns products with inventory field, variant details stripped to prevent schema drift.
- **Block integration:** `src/blocks/products-featured/index.tsx` + `src/blocks/products-grid/index.tsx` + `src/blocks/product-quick-view/index.tsx` — extracted inner components (`HeroProductView`, `ProductCard`, `QuickViewModal`), wired `useAddToCart` hook. Quick-view modal implements 3-branch CTA logic: ctaUrl (navigation) → hasLiveData (real cart) → static (editor-guarded). "Add to Cart" button replaces "View Details" link on storefront (editor still shows navigation block).
- **Product enrichment:** Products fetched via API now include `inventory` field; hooks check `inventory <= 0` to disable button.
- **Type updates:** `src/blocks/product-quick-view/config.ts` — extended `QuickViewProduct` type with optional `slug` field (for dynamic quick-view modal); runtime block enriches products with `_id`, `_inventory`, `_compareAtPrice`, `_currencyCode` from API response.

**Pattern:** Editor nav blocking via `window.parent !== window` iframe guard (posts toast); storefront nav via real cart actions + analytics tracking.

**Impact:** 
- Editor preview: Product blocks show "Add to Cart" text but clicking raises "Navigation is disabled" toast (unchanged from GH-1018 initial fix).
- Public storefront: "Add to Cart" button functional, adds to cart, tracks event, disables if out-of-stock.

**Non-breaking:** Existing editor behavior preserved. Public storefront now has working cart integration (previously unavailable).
### F25 — Shop Customers Collection (Restore PW1 Parity)

**Features:**
- First-class Customers collection: email (normalized per-tenant), name, phone, rank (manual bronze/silver/gold/vip), addresses book (≤10 per customer)
- Auto-link to Orders via beforeChange hook: orders with customerEmail auto-upsert Customer by (tenant_id, normalized_email), idempotent (5 orders same email = 1 Customer)
- Tenant-scoped access control: users see only their tenant's customers; super-admin unrestricted; delete forbidden (protects Order FK integrity)
- Admin UI: list view (search by email/name, filter by rank), detail view (edit addresses + rank), Orders history tab (custom Payload component), CSV export (10k row cap)
- CSV export endpoint `/api/v1/customers/export?tenantId=X`: streams 7 columns (email, name, phone, rank, createdAt, addressCount, orderCount), formula-injection guarded, PII data cached privately

**Acceptance Criteria:**
- TC-F25-001..010: Email normalization, auto-link idempotency (5 orders = 1 Customer), empty/invalid email silent skip (non-throwing), database fault tolerance, tenant isolation (read+update+no delete), addresses validator (max 10), rank enum (bronze|silver|gold|vip only)

**Code changes:**
- New: `src/collections/Customers.ts` (177 LOC) — schema, Payload hooks, tenant-scoped access
- New: `src/collections/orders-hooks/auto-link-customer.ts`, `sync-customer-snapshot.ts` — Order linkage hooks (non-throwing, idempotent upsert)
- New: `src/app/api/v1/customers/export/route.ts` — CSV streaming with tenant isolation + 10k cap
- New: `src/components/admin/customers-*.tsx` — Admin list/detail UI, custom Orders tab
- Modified: `src/collections/Orders.ts` — add `customer` FK field + hook wiring
- Modified: `src/payload.config.ts` — import + register Customers collection
- Database: 9 migration entries (`customers.create_table`, `customers_addresses.create_table`, `orders.customer` FK, indices, Payload rels tables)

**Tests:**
- 39 automated tests (TC-F25-001..010): auto-link-customer.test.ts (5 tests), customers-access.test.ts (2 tests), customers-field-validation.test.ts (2 tests), customers-export.test.ts (2 tests) — all pass
- Manual smoke matrix deferred (user QA post-merge): list/search/filter UI, Orders tab navigation, CSV 10k cap

**Non-breaking:**
- Order denormalized snapshot fields (`customerEmail/Name/Phone/shippingAddress`) untouched → backward-compatible
- Existing orders without customer FK remain valid (NULL FK allowed)
- Orphan backfill script pseudocode in phase-03 spec; not executed (pending US-MIGA-12 ETL plan)

**Restores PW1 parity:** Tier-S priority #9, Group B3 / US-MIGA-12. PW2 entity built; historical data migration deferred.

---

### GH-1024 — Block CRUD Helpers + Menu Block Nested Arrays (F08 Phase 03) + Code Review Fixes

**Features:**
- Added nested CRUD helper functions to SettingsPanel: `updateNestedItem()`, `addNestedItem()`, `removeNestedItem()` for two-level array nesting (categories → items)
- Implemented settings sections for `menu-display` and `menu-food` blocks in editor SettingsPanel, enabling live category/item editing
- Menu items support extended fields: `dietaryTags` (validated against `VALID_DIETARY_TAGS` set), `isPopular` checkbox, `isNew` flag
- RichText rendering fixed for menu-food items (classic + card variants now parse HTML markup in `item.name`/`item.description`)
- Menu-display photo-grid variant: item text center-aligned with proper flex wrapping

**Code changes:**
- `src/components/editor/SettingsPanel.tsx` (~2700 lines) — added three nested CRUD helpers + two 60+ line CRUD sections for menu-display + menu-food blocks (categories label, add-category button, category iteration with remove button, items CRUD within each category)
- `src/i18n/locales/en.json` + `ms.json` — 10 new keys: `categoriesLabel`, `addCategory`, `categoryN`, `itemsLabel`, `addMenuItem`, `menuItemN`, `dietaryTags`, `isNew`, `tag`, `storefront.checkout.calculatingShipping` (carryover from F14)
- Block render updates: `src/blocks/menu-food/index.tsx`, `src/blocks/menu-display/index.tsx` — RichText integration, alignment fixes
- Config types: `src/blocks/menu-display/config`, `src/blocks/menu-food/config` — MenuDisplayCategory, MenuDisplayItem, MenuCategory, MenuItem type exports

**Tests:** 10 TC-IDs in Phase 03 suite (TC-F08-CRUD-MENUDISP-*, TC-F08-CRUD-MENUFOOD-*) covering category/item add/remove/update, dietary tag validation, isPopular/isNew toggles. All tests pass.

**Code review fixes (Phase 03 follow-up):**
- **C-1 (Critical):** Removed `menu-display` from `SupportedAddSectionType` union, matcher regexes, labels map, and builder case in `src/lib/ai/add-section.ts` — closes AI injection path where chat prompts like "add menu" could bypass `BLOCKS_TEMP_HIDDEN` policy and create unsupported `menu-display` blocks. Expanded `menu-food` matcher to explicitly include synonyms (menu, food, restaurant, dish).
- **I-1 (Important):** Fixed variable shadowing in `src/components/editor/FeatureComparisonSettings.tsx` — renamed callback param `t` → `prev` (inner `t` shadowed i18n `useI18n().t`).
- **I-2 (Important):** Added `safeTab` defensive derivation in `FeatureComparisonSettings.tsx` to prevent undefined array index access when `products.length` shrinks below `activeTab` post-decrement.
- **M-1 (Minor):** Changed React keys in menu-food CRUD from name-based to index-only (`mf-cat-${ci}`, `mf-item-${ci}-${ii}`) in `src/components/editor/SettingsPanel.tsx` — prevents blur-driven remount when category/item name changes mid-keystroke.
- **M-2 (Minor):** Added `type="button"` attribute to 4 menu-food CRUD buttons (remove category, remove item, add item, add category) in `src/components/editor/SettingsPanel.tsx` — prevents accidental form submission.
- **M-3 (Minor):** Fixed `noreferrer` deduplication logic in `src/lib/utils/rich-text-render.tsx` — splits `noopener`/`noreferrer` checks; prevents duplicate `noreferrer` when `rel="noreferrer"` already present.
- **M-4 (Minor):** Added nested image FK cleanup for menu-food `categories[].items[].image` in `src/app/api/sites/[siteId]/save/route.ts` — ensures numeric image IDs are stripped during save retry.
- **M-5 (Minor):** Added intent comment above `useEffect` with `exhaustive-deps` suppression in `src/components/editor/FeatureComparisonFeatureModal.tsx` — documents intentional snapshot-on-open (draft-on-open) pattern.

**Related:** GH-960 (product blocks F05 editor enablement) + GH-962 (F14 shipping). Phase 01 (product variants, UI) and Phase 02 (AI generation, SEO) previously merged.

---

### GH-1023 — Floating Cart Global Visibility & Checkout Auto-sync

**Features:**
- Cart widget, WhatsApp button, and social media blocks now support global scope: auto-injected into all pages regardless of where configured, reducing editor redundancy
- Cart drawer footer always visible (even with empty cart) to reinforce checkout affordance; "Checkout" button disabled when cart is empty
- Global block detection and injection via `applyGlobalSystemBlocks()` in `SiteRenderer`; scans pages for commerce blocks and auto-applies globally if marked `scope: 'global'`
- Block registry exposes scope metadata (`scope`, `scopeTooltip`) for admin UI classification
- Editor UI: 🌐 badge on global-scope blocks in Block Library Panel for visual distinction

**Code changes:**
- New library: `src/lib/site-renderer/` — pure utility functions: `detect-commerce-presence.ts` (scans pages for commerce block types), `extract-first-global-block.ts` (finds first block instance of given type), `has-header-cart.ts` (checks if header navigation includes cart button)
- `src/components/site-renderer/SiteRenderer.tsx` — `applyGlobalSystemBlocks()` extended; `NavPage` type updated with `layout?` + `isHomepage?` metadata
- `src/components/storefront/CartDrawer.tsx` — checkout footer visibility + button disabled state when cart empty
- `src/blocks/types.ts` — `BlockMeta` gains `scope?: 'global'|'page'` + `scopeTooltip?: string`
- Block configs updated (`cart-widget`, `social-widget`, `whatsapp-button`, `navigation`, `footer`): added `scope: 'global'`
- `src/lib/admin/block-registry-reader.ts` — `NormalizedBlock` gains `scope` + `scopeTooltip` fields
- `src/components/editor/BlockLibraryPanel.tsx` — renders 🌐 badge for global-scope blocks

**Benefits:**
- Eliminates manual repetition of global UI elements (cart, contact, social) across pages
- Improves commerce UX by always showing checkout affordance
- Reduces editor cognitive load for multi-page sites

**Non-breaking:**
- Pure enhancement; existing page-scoped blocks remain unchanged. Global blocks are opt-in via config.

---

### GH-962 — Shipping Flat-Rate Configuration (F14) — Phase 1–3

**Phase 1–2 Features (existing):**
- Flat-rate shipping by Malaysian region (West RM 8 / East RM 15 default): sellers configure rates in dashboard, buyers see dynamic fees at checkout
- Three API endpoints: `GET /api/sites/:siteId/shipping-config`, `PATCH /api/sites/:siteId/shipping-config` (authed), `POST /api/orders/calculate-shipping` (public)
- Free shipping threshold: sellers set minimum order amount → shipping = RM 0 when subtotal ≥ threshold; checkout hint "Add RM X more for FREE shipping" (highlight tier when gap ≤ RM 50, neutral >RM 50)
- Live checkout calculation: state selection debounces 300ms, recalc shipping fee without page reload, updates order summary dynamically
- Supports 16 Malaysian states + Labuan territory; postcode validation regex `^\d{5}$` (format only)
- Dashboard settings form: West/East rate inputs (RM 0.00–RM 1,000.00), free shipping toggle + threshold input, Reset to Defaults button

**Phase 3 Pure functions + Component wiring (NEW):**
- `validateRate()` — validates RM input (13 edge cases: empty, negative, over-max, scientific notation, comma/dot decimals, multiple decimals, zero warning)
- `parseRateRm()` — parses comma/dot decimals, trims whitespace, returns null on non-numeric
- `validateCrossField()` — cross-field validation: warns if free threshold below max(westRate, eastRate)
- Form input wiring: `onChange` filter rejects non-numeric, `onBlur` auto-formats to 2 decimals, paste normalization (trim+parse), `aria-invalid`/`aria-describedby` attributes, error paragraphs with `role=alert`

**Code changes (Phase 1–3):**
- Library: `src/lib/shipping/` — `classify-region.ts`, `calculate-fee.ts`, `constants.ts`, plus new `validate-rate.ts`, `parse-rate.ts`, `validate-cross-field.ts` helpers
- API routes: `src/app/api/orders/calculate-shipping/route.ts`, `src/app/api/sites/[siteId]/shipping-config/route.ts`
- Dashboard: `src/app/(dashboard)/settings/shipping/shipping-settings-client.tsx` with form validation wiring, error display, accessibility attributes
- Checkout: `src/app/sites/[slug]/checkout/page.tsx` — state selection triggers debounced calculate-shipping call, live fee update

**Security:**
- PATCH rate validation: boundaries enforced (0 ≤ rate ≤ RM 1,000), tenant member check, cross-tenant 403 guard
- State classification: invalid states rejected at API level (400 INVALID_STATE), fallback to West region
- Body null guard: POST/PATCH return 400 on malformed JSON instead of 500

**Tests (Phase 3 new):**
- Unit: `src/__tests__/unit/dashboard/shipping-rate-validation.test.tsx` — TC-F14.21–F14.38 (13 validateRate edge cases + 5 component wiring tests covering paste, onBlur format, onChange filter, aria attributes)
- Coverage: pure input validation (13 cases), parseRateRm, validateCrossField, form integration (paste handling, blur auto-format, onChange filter, ARIA labeling)

**Non-breaking:**
- Existing `Sites.shippingConfig` schema unchanged; `freeAbove` default = 10000 sen (RM 100)
- Wave 6 scope: self-delivery tracking number = free-text (no carrier API)

**Total tests:** 138 TC-IDs (TC-F14.01–123b) covering calculation, API validation, edge cases, integration, unit validation. All Phase 1–3 tests pass.

---

### GH-899 — Announcement Bar: CTA Link Integration & Content Configuration

**Features:**
- Editor settings panel now exposes all announcement-bar fields: message, CTA link text/URL (external or internal page picker), dismissible toggle, color pickers (BG Color 1 + Color 2 for gradient), vertical padding slider (4–32px)
- Gradient variant now supports independent Color 2 via `backgroundColor2` field
- Vertical padding controlled via internal `paddingY` field (default 12px = py-3)
- Preview renderer correctly branches gradient/solid/minimal variants

**Bug fixes:**
- CTA fields (`linkText`, `linkUrl`) were invisible in SettingsPanel — zero editable fields
- Gradient Color 2 was hardcoded to `CSS_VARS.secondary` — now user-configurable
- Padding slider had no effect (block is FLOATING_BLOCK_TYPE) — replaced with internal paddingY
- Preview HTML renderer always showed solid background regardless of variant

**Security:** HTML-escaped `message`/`linkText` in preview renderer; `rel="noopener noreferrer"` on external CTA links

**Tests:** 16 unit TCs (all pass) in `src/__tests__/unit/blocks/announcement-bar.test.tsx` covering gradient/solid/minimal variants, CTA rendering, padding, and dismissible toggle.

---

### GH-960 — Enable Product Blocks in Editor (F05-08)

**Features:**
- 9 product/commerce blocks now enabled for drag-drop and AI generation in F05 editor: `products-grid`, `products-featured`, `cart-widget`, `menu-food`, `product-quick-view`, `pricing-table`, `menu-display`, `pricing`, `property-card`
- `cart-widget` re-enabled (was hidden since GH-839, checkout ships in v1.1) with "Add to Cart" preview toast in editor
- `menu-display` and `pricing-table` blocks registered in Payload Pages collection (previously absent → silently dropped on save)
- Product blocks marked `aiVisible: true` and re-categorized from archive → commerce/store, enabling AI gen for industry-appropriate industries
- AI system prompt updated with VARIETY RULES 8–10 for industry-specific block recommendations
- Restaurant/food blocks (`menu-food`, `menu-display`) now appear in category recipes for hospitality industry

**Related changes:**
- Migrations: new DB fields for `menu-display` + `pricing-table` block configurations
- Payload schema: registered 2 new blocks in `src/collections/Pages.ts`
- AI pipeline: removed blocks from `unsupported-blocks.ts` (menu-display, property-card) and `template-composer.ts` (property-card)
- Editor registry: removed cartWidget from `EDITOR_HIDDEN_BLOCKS`

**Tests:** 5+ unit TCs covering block visibility, AI generation, and toast behavior. All CI tests pass (lint, type-check).

---

### Added
- **GH-871 Blog Auto-seed on Website Generation (F08)** — when user generates a website, 3 published blog posts are now auto-seeded per tenant using hand-curated seed data. Prevents blog-list block from appearing empty. Ships `src/lib/ai/seed-blog-posts.ts` with `seedBlogPosts()` and `wrapExcerptInLexical()` helpers, integrated into generate-site pipeline. Non-fatal operation; skips if tenant already has posts. Unit tests: `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` (5 tests, TC-F08-BS.01–05, all pass). Slug collision avoided via tenantId prefix.
- **GH-871+ Blog Seed Thumbnails (F08)** — auto-seeded blog posts now include distinct thumbnail images using 2-tier strategy: Tier A searches Unsplash by blog category; Tier C falls back to gallery pool if search returns no results. Non-fatal per-post; posts created without thumbnail if fetch fails. Extracted shared `src/lib/ai/upload-media.ts::uploadImageUrl()` helper for reuse across product and blog seed flows (DRY refactor). Extended tests: `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` (9 tests, TC-F08-BS.01–09, all pass).
- **GH-871++ AI-generated Blog Seeds (F08)** — replaced static blog-seed library with GPT-4.1-nano per-business generation. New task entry `'blog-seed'` added to AI config with rate-limits (free 5, starter 20, pro 100, business unlimited). Caller-agnostic: static seeds preserved as fallback on AI failure (quota, timeout, parse error). New module `src/lib/ai/generate-blog-seeds.ts` (85 LOC) exports `generateBlogSeedsAI`, `BlogSeedAI` interface. `seedBlogPosts()` signature extended with optional `industry?: string` param (8th arg, backward-compatible) to plumb raw user industry into AI prompt for better niche-specific output. Image search keyword now sourced from AI `imageKeyword` field when available (vs static category). Within-batch slug de-duplication applied after static fill. Unit tests extended: 19 TC-IDs total (TC-F08-BS.01–18), all pass. Estimated cost ≤ $0.0002 per site-gen (negligible vs existing $0.004 site-gen call). Non-blocking `void` seeder ensures user experience not impacted.
- **GH-864 Page Library UX + Menu Linkage** — Renamed "Page Manager" → "Page Library" (`PageManagerPanel.tsx`); added micro-copy below title; removed search input; introduced `menuPageIds` prop wired via new `src/lib/menu-page-links.ts` (`collectMenuPageIds` pure helper); Live/Draft badge now reflects menu linkage (published + in-menu + site-published → Live, else Draft) wrapped in Radix Tooltip; `data-coach` anchors on Page Library and Menu Settings panels; 2-step `EditorCoachMarks` overlay for first-time users (localStorage flag `editor:coach-marks:v1:seen`, ESC/backdrop/skip/finish dismiss). i18n keys added in `en.json`/`ms.json`. Unit tests: 49 tests across 4 files (TC-F05-02-13..16).
- **F30 Hero Media Overlay (GH-12)** — inline hover overlay for hero blocks enabling live image/video swap without leaving the site renderer. Ships `src/lib/media/compress-image.ts` (canvas-based client compression: 1920px, 2MB cap, WebP 0.85), `src/components/site-renderer/BlockEditCallbackContext.tsx` (React context wiring `blockIndex` + `onFieldChange`), and `src/blocks/hero/hero-media-overlay.tsx` ("Change Image" + optional "Change Video" buttons, file-type validation, upload via `uploadMediaAction`, `VideoInputPopover` for URL entry, `positionClass` prop for background-image variants). Wired into 6 hero variants: split, magazine, cards-overlay, slideshow, video, split-video. QA doc `docs/qa/F30-hero-media-overlay.md` (10 TC-IDs); unit tests `src/__tests__/unit/blocks/hero-media-overlay.test.tsx` (9 tests, all pass). Branch: `fix/F05-12-image-upload-ai-gen`.

### Fix
- **GH-935 Variant Form Clarity & Validation** — redesigned product variant tier input UX with improved labeling ("Option N (Example: ...)" replaces ambiguous "Tier N"), inline validation (required indicators, duplicate-value detection per-tier), and corrected button labels ("Generate variants" vs "Create SKU Table", "Add values" vs "Add option"). Generate button now gated when any tier lacks a name or has no values or contains duplicates, preventing malformed variant matrices. i18n updates to `en.json` and `ms.json`. Changes: `src/components/dashboard/product-form/VariantsInventorySection.tsx`, `src/components/dashboard/product-form/schema.ts`.
- **GH-103 Attributes Dashboard UI (F08-06)** — added "Thông tin Mở rộng (Attributes)" section to product create/edit form with dynamic key/value rows (max 20, `useFieldArray`), inline validation, dark theme support, and correct load/save mapping to Payload `attributes` array. Server-side constraints: `key: maxLength 100`, `value: maxLength 500`. i18n support added (`en.json`, `ms.json`). Component: `src/components/product-form/attributes-section.tsx`.
- **GH-737**: Heading and body font selections now apply correctly in storefront preview — `fontNameToCSSVar` reordered to put literal font name first (resolves AppShell scope limitation); added missing `body` key to Tailwind `fontFamily` config so `font-body` utility generates a CSS rule
- **GH-12 Hero Block PRD Gap Fixes** — resolved 11 compliance gaps in `src/blocks/hero/`: fixed gradient PRM duplicate div bug (C1), added prefers-reduced-motion to split-video (C2), wired overlayOpacity in cards-overlay (C3), added split-right column reversal (I1), removed dead `height`/`overlay` config fields (I2, I3), added Framer Motion scroll parallax to magazine image (I4), optimized slideshow to render current+next only (I5), fixed minimal CTA to use RichText (I6), suppressed video autoplay on mobile (I7), replaced fullscreen py-32 with HERO_MIN_HEIGHT constant (I8)

### Added
- feat(ci): auto re-seed templates + drift/harness gate on CI (plan 260419-2022)
- feat(admin): `/dashboard/templates-health` drift dashboard (super-admin) — re-seed + harness buttons, per-template drift badges (plan 260419-2022 phase 04)
- feat(templates): stamp `blockSchemaVersion` sha256 on seed — enables per-row staleness detection via `scanDbTemplates` (plan 260419-2022 phase 05)
- ClaudeKit rules + docs refactor (2026-04-19): split `CLAUDE.md` 296→113 lines, created 8 `.claude/rules/*.md` (database-schema, vercel-deploy, env-vars, git-flow, testing, email-smtp, workflow, orchestration), seeded 6 canonical `docs/*.md`

### Pending
- v1.0 stabilization (staging /admin 404, SSO JWT mismatch, AI gen JSON parse intermittent)
- Key rotation (DO Spaces + Unsplash — leaked 2026-04-15)
- Production S3 bucket + prod credentials

---

## 2026-04-17 → 2026-04-19 — Wave 1 / Wave 2 Wix-parity polish

**Focus:** F01 AI Builder robustness + F05 AI Editor publish correctness.

- **F01:** Wave 1 completion (#698), wave 2 Wix-detailed (#697), template-first-gen (#680, #682), variant wiring demo (#683, #685), register industry blocks (#686), subpage polish (#687), pipeline + block-quality fixes (#684), old templates fix (#688)
- **F05:** Publish block-id collision fix (#694), publish validation error surface (#693), update-page-draft bug fix (#692), merge drag buttons bug (#691), AI editor improvements (#689), 404 page rendering fix (#677), unhide-page 500 (#678), inline AI chat lost fix (#673), hidden page still live (#676), empty block data (#669), publish new pages (#670)

Journal: `plans/260418-1740-wave2-continuation-harness-cleanup/`, `plans/260418-2358-wave1-completion/`.

---

## 2026-04-15 — 500 Fix Campaign

**Outcome:** 450 → < 10 errors/day. 8 bugs, 6 PRs.

Key modules patched:
- `pages-schema` — draft/published collision
- `site-type` detection — missing industry fallback
- `payload-retry` — transient DB timeout handling
- `post-ai-swap` — block reference integrity
- `stripOrphanMediaRefs` — hanging media pointers after block deletion

Full post-mortem: `docs/journals/260415-500-fix-campaign-and-ai-gen-v2.md`.

---

## 2026-04-13 → 2026-04-14 — Vercel CI-driven deploy

**Problem:** Vercel Pro blocked commits from non-team-members ("The Deployment was blocked because the commit author does not have contributing access"). Team has 1 member (phuongltweb) — inviting more = $20/seat/mo.

**Fix:** Switch from Vercel git webhook → GitHub Actions CI using `VERCEL_TOKEN` (token owner = team member). All deploys now attributed to phuongltweb, bypassing author check.

PRs: #559 (disable webhook), #560 (CI deploy scaffold), #562 (staging target fix), #565 (env pull scoping), #567 (alias rollover verification), #569 (smart-notify integration).

Plan: `plans/260413-1126-vercel-deploy-blocked/`.
Journal: `docs/journals/260414-ai-gen-flow-overview.md`, `docs/journals/260414-session-ai-gen-deep-dive.md`.

---

## 2026-04-12 — DigitalOcean → Vercel migration

Retired DigitalOcean App Platform (ech-prime-web v1). All runtime + bot moved to Vercel. Legacy files (`Dockerfile`, `.github/scripts/sync-do-envs.py`) retained for reference; `Dockerfile` still used for local `docker-compose` dev.

---

## 2026-03-29 (PR #364 – #374) — Test infra + DB stability sprint

### Added
- Fix missing FK columns + auto-sync rels tables (#364)
- SMTP migration: Resend → Payload SMTP via AWS SES (#365)
- Smoke tests + Quality Metrics + Env sync fix (#366)
- 12 missing DB tables + CI table check (#367)
- Git flow docs + AGENTS.md + Security scan + Codex setup (#368)
- `products_rels` table (#369)
- Locale validation (AI Builder) (#370)
- Unit test count parsing fix (#371)
- `docs/TEST_CONVENTION.md` (#372)
- 26 Pages block tables + block columns (#373)
- ALTER TABLE fallbacks for all array tables (#374)

---

## 2026-03-26 → 2026-03-31 — Sprint 1 (Crash Launch)

**Outcome:** Core USP + CMS + Auth + Commerce shipped; Phase 1 launch 2026-03-31 → extended to 2026-04-14 for stabilization.

Feature waves:
- **2026-03-26 → 28:** F01 (AI Builder), F05 (AI Editor), F11 (SEO), F12 (Undo/Redo), F18 (CMS Layout), F02 (Auth), F06 (Onboarding)
- **2026-03-29 → 30:** F19 (Store Config), F08 (Products), F09 (Storefront), F10 (Orders), F21 (Localization), F20 (Analytics)
- **2026-03-31:** F17 (Blog), F03 (Dashboard), F07 (Templates), F16 (Notifications) — best-effort

---

## 2026-03-13 → 2026-03-25 — Sprint 0 (Foundation)

**Outcome:** Backend APIs, CI/CD green, test infrastructure, Figma design alignment.

- GitHub Actions pipeline (`ci.yml`): quality → test → deploy
- Vitest + React Testing Library + Playwright E2E
- Payload CMS 3 + Drizzle + Neon Postgres schema
- Lark bot integration (`prime-bot-assistant`) for CI notifications
- DigitalOcean App Platform initial deploy (retired 2026-04-12)

v1.0 kickoff: commit `6c06d015` (2026-03-13 15:58).

---

## Related docs

- Full merged PR list: `git log main --since=2026-03-13 --merges --oneline`
- Per-feature architecture changes: `docs/architecture/F*.md`
- Strategic decisions + post-mortems: `docs/journals/`
- Timeline + priority: `docs/PROJECT_ALIGNMENT.md`
- Open blockers: `docs/tracking/OPEN_BLOCKERS.md`
