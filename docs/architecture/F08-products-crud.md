# Architecture: Products CRUD (F08)

> **Version:** 1.0 | **PRD:** [F08-products-crud.md](../prd/F08-products-crud.md)  
> **Tech:** Payload CMS 3 (Products collection) + OpenAI

---

## 1. Data Model (Payload CMS Collection)

```typescript
// collections/Products.ts
const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true },
    { name: 'price', type: 'number', required: true },
    { name: 'compareAtPrice', type: 'number' },
    { name: 'description', type: 'richText' },
    { name: 'descriptionBM', type: 'richText' },  // Bahasa Melayu
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    { name: 'images', type: 'array', fields: [
      { name: 'image', type: 'upload', relationTo: 'media' }
    ], maxRows: 5 },
    { name: 'variants', type: 'array', fields: [
      { name: 'name', type: 'text' },
      { name: 'sku', type: 'text' },
      { name: 'price', type: 'number' },
      { name: 'stock', type: 'number' },
    ]},
    { name: 'stock', type: 'number', defaultValue: 0 },
    { name: 'status', type: 'select', options: ['draft', 'active', 'archived'] },
    { name: 'site', type: 'relationship', relationTo: 'sites', required: true },
  ],
  access: {
    read: ({ req }) => ({ site: { equals: req.user?.activeSite } }),
    create: ({ req }) => !!req.user,
  },
}
```

## 2. Component Tree

```
ProductsPage (/products)
├── ProductsHeader
│   ├── Title + Count
│   ├── FilterBar (status, category, search)
│   └── AddProductButton
├── ProductsTable
│   ├── ProductRow × N
│   │   ├── Thumbnail + Name
│   │   ├── Price
│   │   ├── Stock (low-stock warning)
│   │   ├── Status badge
│   │   └── Actions (Edit, Delete, Duplicate)
│   └── BulkActions
│       └── "Generate All Descriptions" (AI)
└── ProductDetailModal (slide-over)
    ├── ProductForm (Zod validation)
    ├── ImageUploader (max 5, drag-drop)
    ├── VariantsEditor
    └── AIDescriptionButton
```

## 3. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/products` | List products (paginated, filtered) |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/[id]` | Update product |
| DELETE | `/api/products/[id]` | Soft delete |
| POST | `/api/products/generate-description` | AI generate description |

## 4. AI Description Flow

```
User clicks "Generate Description with AI"
       ↓
POST /api/products/generate-description
  body: { name, price, category, images }
       ↓
OpenAI streamText():
  - Generate BM description (primary)
  - Generate EN description (secondary)
  - Include: selling points, material info, sizing, care instructions
       ↓
Stream response to UI → editable textarea
       ↓
User edits → saves
```

## 5. Publishing Gate (GH-1458, Phases 1–4 complete)

**Soft validation preventing incomplete products from becoming Active (visible on storefront).**

### Guard Logic (`src/lib/products/publish-guard.ts`)

Pure function `productPublishBlocks()` evaluates if a product can transition Draft → Active:

```typescript
interface ProductPublishResult {
  ok: boolean;
  missingFields?: Array<'price' | 'sku' | 'inventory' | 'variants' | 'weight'>;
}

function productPublishBlocks(product: Product): ProductPublishResult
```

**Rules:**
- Non-variant products require: `price` + `sku` + `inventory` (all non-null, but 0 is valid)
- Variant products require: `sku` + non-empty `variants[]` array (each variant: name + price + stock)
- `weight` required in BOTH modes — single top-level field (shipping calc), not part of the variant
  matrix. Unlike price/inventory, `0` (the collection default) is treated as MISSING, not valid —
  a physical product's weight can never legitimately be 0.
- Images, category, alt-text NOT required for Active (remain optional SEO warnings for Phase 4)

### Client-side Enforcement

- Location: `src/app/(dashboard)/products/page.tsx` `handleUpdateStatus()`
- Evaluates guard BEFORE optimistic update on Draft → Active toggle
- If blocked: opens `ConfirmModal` (variant='default', warning icon, "Cannot publish yet")
- Modal displays bulleted list of missing fields (localized labels)
- Alert-only dialog — uses `ConfirmModal`'s `hideCancel` prop (added 2026-07-03) to render a single
  "Got it" button instead of two identically-labeled buttons (Phase 2's original workaround, since
  `confirmLabel`/`cancelLabel` were both mandatory props on the shared component)
- No server call made if blocked; prevents flickering/rollback

### Server-side Enforcement

- Location: `src/app/(dashboard)/products/actions.ts` `updateProductFieldAction()` **and**
  `saveProductAction()` (both — see fix below)
- Re-evaluates guard after fetching product when `status: 'active'` requested
- Throws structured error: `{ code: 'PUBLISH_BLOCKED', missingFields: [...] }`
- Source of truth; client gate cannot be bypassed via direct API calls
- Subscription + tenant checks remain ordered before gate check

**Critical gap found and fixed (2026-07-03, adversarial code review):** the gate was originally
wired into `updateProductFieldAction()` only (the Active-toggle button on the product list). It was
NOT wired into `saveProductAction()` — the Server Action behind the product create/edit form. Since
`saveProductAction`'s `ProductServerSchema` is `.passthrough()` and the React form never sends
`status` on edits (only on create, hardcoded to `'draft'` — see `[id]/page.tsx`), a *direct* call to
`saveProductAction` (bypassing the form UI entirely) could smuggle `status: 'active'` past every
check, since Payload's own collection-level validation doesn't enforce the same rules
`productPublishBlocks()` does (only `price` is `required: true` on the collection; `sku`/`weight`
have no equivalent). Fixed: `saveProductAction` now re-runs `productPublishBlocks()` whenever the
incoming `data.status === 'active'`, evaluated against the merged existing-doc + incoming-fields view
(an edit may only touch a subset of fields). Tests: TC-09.45.

**Known accepted limitation (documented in code, not fixed):** no transaction/row-lock ties the gate
check's read to either action's write — a concurrent edit clearing `weight` could theoretically race
a concurrent activate between the read and write. Same risk class as the pre-existing variant-loss
race documented next to it in `actions.ts`; narrow window, no known exploit path.

### Collection-level Enforcement (added 2026-07-03, PR #1500 code review)

**Critical gap found and fixed:** the two Server Action checks above only fire when the *incoming
payload* explicitly sets `status: 'active'`. Editing an already-`active` product without touching
`status` (exactly what the edit form does on every save) skipped the gate entirely — `sku`/
`inventory`/`weight` have no `required` flag at the Payload field level, so a direct
`saveProductAction` call could silently clear them on a live active product. Worse, since both gates
lived only in Next.js Server Actions, Payload's default REST/GraphQL API bypassed both outright — any
authenticated tenant user with product-management access could `PATCH /api/products/:id` directly.

- Location: `publishGateHook` (`beforeChange`), `src/collections/Products.ts` — runs after
  `beforeChangeHook` (so the variant inventory auto-calc has already run) on **every** write path:
  both Server Actions, REST, GraphQL, Local API, and any future write path (bulk import, etc.)
- Keyed on the RESULTING status (`data.status` if present in the write, else `originalDoc.status`),
  not just the incoming payload — this is what closes the "edit an active product without touching
  status" gap.
- Fires when resulting status is `active` AND either (a) `status` is a REAL transition
  (`original?.status !== 'active'` — a draft/archived → active toggle, or a create with
  `status:'active'`), (b) a scalar gate-relevant field (`price`/`sku`/`inventory`/`weight`/
  `hasVariants`) has a VALUE that differs from `originalDoc`, or (c) `variants` CONTENT
  (id-normalized) differs from `originalDoc.variants`.
- Every trigger check compares by VALUE CHANGED against `originalDoc`, not by key presence —
  this was a two-step fix:
  - `variants` needed special handling, found via self-review: `updateProductFieldAction` always
    re-passes `existing.variants` stripped of Payload's auto-managed row `id` (a Payload 3.79
    workaround, see `stripIds()` in `actions.ts`), so a naive **key-presence** trigger would
    wrongly re-fire the gate on unrelated writes (e.g. soft-delete) to a legacy-incomplete active
    product. But naively **excluding** `variants` from the trigger set entirely (the first-draft
    fix) reopened the exact bug this hook exists to close: a direct call with only
    `{variants: [bad data]}` (no status/hasVariants key) would then skip the check outright.
    Resolved with `normalizeVariantsForCompare()` — strips row/option `id` the same way
    `stripIds()` does (including coercing non-array/`null` to `[]`, matching
    `stripIds(null) === []`, so a legacy row storing `variants: null` doesn't spuriously compare
    as "changed") — then compares CONTENT, not key presence.
  - The scalar fields (`price`/`sku`/`inventory`/`weight`/`hasVariants`) and `statusBeingSetActive`
    itself had the SAME key-presence bug, found by an independent review after the above fix
    shipped: Payload's own `/admin` panel (`src/app/(payload)/admin`) submits the FULL document on
    every save, not a partial diff like the two Server Actions — so `price`/`sku`/`inventory`/
    `weight`/`hasVariants`/`status` are ALWAYS present in that payload regardless of what a human
    actually edited. A key-presence trigger re-fired `PUBLISH_BLOCKED` on EVERY `/admin` save of a
    legacy-incomplete active product, even a pure `description` edit. Fixed by comparing each
    scalar field's VALUE against `originalDoc` (strict equality is sufficient — these are plain
    primitives, no id-normalization needed) and redefining `statusBeingSetActive` as
    `original?.status !== 'active'` rather than "the payload happens to include
    `status:'active'`."
- Throws the same `APIError(JSON.stringify({code:'PUBLISH_BLOCKED', missingFields}))` shape as the
  two Server Action checks, so existing client-side error parsing (`parsePublishBlockedError` in
  `page.tsx`) keeps working unchanged for both call sites; the hook is now the authoritative
  backstop for every other path.
- `productPublishBlocks()` itself was hardened in the same review round: `isBlank()` now type-guards
  instead of throwing on a non-string truthy value (`sku: {}` from a raw API call), and `price`/
  `inventory`/variant `price`/`stock` now share the same explicit `isValidNumber()` type-check
  `weight` already used — a non-numeric string previously passed as "present and valid."
- Tests: TC-09.47 (`src/__tests__/unit/collections/products-hooks.test.ts`, 9 scenarios including
  the regression guards — unrelated-field edits, soft-deletes on a legacy-incomplete active
  product, and a `variants:null` legacy row must NOT be blocked) + TC-09.51
  (`publish-guard.test.ts` — type-safety, no-throw on non-string input) + TC-09.52
  (`products-hooks.test.ts` — Payload `/admin` full-document save must NOT be blocked on an
  unrelated field edit, but MUST be blocked when a gate field's value actually changes).

### UX Flow

```
User toggles Active on Draft product with missing price
  ↓
Client guard: productPublishBlocks() → ok:false
  ↓
ConfirmModal ("Cannot publish yet") lists: "Price"
  ↓
User clicks "Got it" (acknowledge only, no proceed option)
  ↓
Modal closes, product remains Draft
```

**Complete product:** guard passes, toggle succeeds, no modal shown.

### i18n Keys

- `publishGateTitle` — modal heading ("Cannot publish yet")
- `publishGateAck` — modal intro text explaining requirement
- `price`, `sku`, `inventory`, `variants`, `weight` — field labels (reuse existing `dashboard.products.form.*` keys)

### Testing

- Test case TC-09.37 (`docs/qa/F09-products-crud.md`) — verify modal blocks incomplete products
- 5 concrete scenarios in `src/__tests__/unit/actions/save-product-action.test.ts` (all passing)
- Regression: Draft save with missing fields still succeeds (gate does NOT affect Draft saves)
- Archive/restore transitions unaffected

### AI-generated products parity (`generate-site` route, 2026-07-03)

`src/app/api/ai/generate-site/route.ts` (the "generate whole website" AI onboarding flow) creates
Product docs directly via `payload.create()` — never through `saveProductAction`/
`updateProductFieldAction` — so the publish-guard's weight requirement and the alt-text fallback
persistence never applied to it. Products came out `status:'active'` with `weight=0/undefined` and
blank `images[].alt`.

**Alt-text**: fixed by computing `buildProductAlt()` once and persisting it into `images[].alt` at
both image-setting call sites, reusing `result.siteName` already in scope — no extra query, unlike
`saveProductAction`'s per-save lookup.

**Weight/dimensions (corrected 2026-07-03, Phase 2)**: initial fix hardcoded `weight:1` +
`dimensions:{0,0,0}` as flat constants for every product, believing this mirrored
`BulkCreateModal.buildSavePayload()`'s `prod.weight || 1`. That pattern is actually a **defensive
fallback**, not the primary value — `BulkCreateModal`'s real weight/dimensions come from
`/api/ai/products-bulk-parse`'s AI prompt, which explicitly estimates them **per product**
("Estimated logical shipping weight in kg. Minimum 0.1"). `generate-sample-products.ts` (used by
`generate-site`) never asked its AI tier for these fields at all. Corrected by extending
`generateSampleProductsAI`'s prompt (Tier-1, GPT-4.1-nano) to estimate `weight`/`length`/`width`/
`height` per product, same as `products-bulk-parse`. `generate-site/route.ts`'s `baseData` now reads
`product.weight || 1` / `dimensions: {length: product.length || 0, ...}` — `||` (not `??`) is
deliberate: it falls back to the constant when the AI omits a value AND when the AI hallucinates
`weight: 0` (violating its own prompt's "minimum 0.1" instruction), since `0 ?? 1` would stay `0` but
`0 || 1` correctly becomes `1` — closing a gap `publish-guard.ts` can't catch here (this route creates
`status:'active'` directly, bypassing the guard). Tier-2 curated-fallback products are never
AI-estimated and have no dimension data to curate — accepted as a rare-path limitation, not enriched.
Tests: TC-09.41 (AI-omission fallback), TC-09.42 (alt persistence), TC-09.43 (AI-value passthrough),
TC-09.44 (weight:0 hallucination guard) in `src/__tests__/api/ai.test.ts`; TC-GH1458-P2-01/02 in
`src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts`.

**Known gap (flagged by code review, not yet fixed):** no upper/lower bound is enforced on the AI's
`weight`/`length`/`width`/`height` values before they reach `payload.create()` — unlike the form-side
Zod schema (`schema.ts`, weight max 1000, dims max 10000), a hallucinated extreme value (e.g.
`weight: 999999999` or a negative number) would pass through `product.weight || 1` unchanged (only
falsy values are replaced) and persist on a live `status:'active'` product.

### Alt-Text Fallback (GH-1458 Phase 3, complete)

**Ensures storefront product images never display with empty `<img alt>` attribute.**

#### Fallback Pattern

```
"{Product Name} - {Store Name}"
```

Example: A Nike Air Force 1 product in "TradeHub Store" renders as `alt="Nike Air Force 1 - TradeHub Store"`.

#### Implementation

**Build-time (save-side):**
- Location: `src/lib/products/build-product-alt.ts` (pure function `buildProductAlt(product, siteName)`)
- Called during `saveProductAction()` in `src/app/(dashboard)/products/actions.ts` to capture site context
- Server fetches tenant's `Sites.name` once per save (single query, no per-image cost)
- Fallback computed but not stored; always regenerated at render-time

**Render-time (display-side):**
- All storefront components apply fallback via `buildProductAlt()`:
  - `src/components/storefront/ProductImageGallery.tsx` — primary product detail gallery
  - `src/blocks/products-grid/index.tsx` — grid block across storefront pages
  - `src/blocks/products-featured/index.tsx` — featured products block
  - `src/blocks/product-quick-view/index.tsx` — quick-view overlay on listings
- Logic: `alt={product.images[i].alt || buildProductAlt(product, site.name)}`
- No database changes needed; fallback computed on-the-fly

#### Guard Order

1. Check if product image has explicit alt text (`product.images[i].alt`)
2. If missing/empty: use fallback `buildProductAlt(product, site.name)`
3. Result: `<img alt="...">` never empty

#### Non-breaking

- Existing products with explicit alt-text unchanged (fallback skipped)
- Products without alt-text now display semantic fallback (was previously empty)
- No UI changes; merchants not required to act
- All access patterns (site-slug route, direct product fetch, preview) use same fallback logic

### Phase 4 Wiring (GH-1458, complete; inline advisory hints + alt-text Popover)

**Inline advisory hints. Category field flexibility was attempted, then reverted same day.**

#### Advisory Hints (Non-blocking Warnings)

- **Category advisory:** When product category is empty, form displays optional hint text in `GeneralInfoSection.tsx`. Note: this hint is advisory UI copy only — Category itself is still a hard Save requirement (see below), so the hint functions as an early nudge before the Zod block fires on submit.
- **Images alt-text advisory:** When product images lack alt text, hint text appears near image uploader, guiding merchants toward accessibility without enforcement. Alt text is genuinely optional at Save.
- **Philosophy:** Advisory messages align with "soft validation" — inform without blocking, for Alt text. Publishing gate (Active transition) enforces only price/sku/inventory (per D1, Category is not part of that gate either).

#### Category Field — Required (reverted 2026-07-03)

- **Original state:** `src/components/dashboard/product-form/schema.ts` `categoryIds` was hard-required (`.min(1)`), preventing Save with empty category.
- **Briefly relaxed:** During Phase 4, `categoryIds.min(1)` was removed to match alt-text's advisory-only treatment and the GH-1458 issue's literal acceptance-criteria wording ("Save succeeds even with missing category").
- **Reverted same day:** Product owner confirmed Category must stay hard-required at Save, unlike Alt text. `.min(1)` restored, required-asterisk restored on the Category label, `TC-F08-01-01e` reverted to its original (failure-expected) assertion.
- **Publishing gate unaffected either way:** Category was never a blocking criterion for Draft → Active transition (per design decision D1) — that gate only checks price, sku, inventory (non-variant) or sku, variants matrix (variant). This is unrelated to the Save-time requirement above.
- **Net state:** Only Alt text is advisory-optional at Save. Category remains a hard requirement, same as before this plan started.

#### Save-as-Draft & Bulk-Create Regression

- **Save-as-draft:** Products with empty image alt-text save successfully to Draft (verified via TC-09.39). Category empty still blocks Save (by design, restored).
- **Bulk-create:** AI template generation (`buildSavePayload()`) always produces `status: 'draft'` regardless of category/image completeness (verified via TC-09.40). No risk of Active products accidentally generated.

#### Related

- Phase 1 (guard library): `docs/journals/260702-GH-1458-phase-1-guard-and-alt.md`
- Phase 2 (publishing gate wiring): See GH-1458 CHANGELOG entry
- Phase 3 (alt-fallback implementation): Shipped 2026-07-03
- Phase 4 (inline warnings + alt-text Popover): Shipped 2026-07-03; category-required reverted same day

## 7. GH-1502 — AI Bulk-Create UX Redesign (Phases 1–6, complete)

**Enhanced user experience for the AI chat bulk-product-generation feature. New field tracks AI-generated drafts, improved textarea input, suggestion pills, and visual indicators for AI-created products.**

### Data Model Changes

**New collection field:**
- `aiReviewPending: boolean` — default `false`. Set to `true` by `BulkCreateModal.buildSavePayload()` on every product created via AI chat. Cleared to `false` by `saveProductAction()` on any manual product edit, or by `updateProductFieldAction()` when transitioning product status to `'active'`. Used to visually distinguish AI-bulk-created products in the Products list until merchant review.

### Frontend Component: `BulkCreateModal.tsx`

**Enhanced prompt input:**
- Replaced single-line `<Input>` with multi-line auto-growing `<textarea>` (new hook: `src/hooks/use-auto-resize-textarea.ts` handles dynamic height on content change).
- Submit behavior changed: plain **Enter** inserts newline; **Cmd/Ctrl+Enter** submits. Encourages multi-sentence descriptions without accidental submission.
- Added 3 clickable **suggestion pills** below textarea (e.g. "Describe your product", "Add features", "Include materials"). Each pill pre-fills the textarea with a contextual prompt starter, reducing friction for first-time users.

**Modal state & persistence:**
- `buildSavePayload()` creates each product with `aiReviewPending: true`.
- Removed `router.refresh()` call from `handleSave` — parent page's `onSuccess` callback now refetches via `loadProducts()` without full page reload, improving performance.

### Frontend Component: `AiReviewIndicator.tsx`

**Visual indicator for AI-generated products:**
- New component rendered in ProductsPage (both desktop table rows and mobile cards).
- Display: emerald-colored pulsing dot + tooltip ("Created by AI — needs review").
- Auto-clears (optimistically + server-confirmed) when product status transitions to `'active'`.
- Merchant-facing cue: "These drafts came from AI and may need adjustments before publishing."

### Page Behavior After Bulk-Generate

After successful AI product generation:
1. Page auto-switches to **Draft tab** (shows draft products only).
2. Sort order resets to **"Latest"** so newly created AI-drafted products appear on top.
3. Existing products remain unaffected; no full-page reload.

### i18n Updates

New and updated strings in `src/i18n/locales/en.json` and `ms.json`:
- `dashboard.products.bulkCreate.submitButton` — "Generate Drafts" (was "Create")
- `dashboard.products.bulkCreate.suggestPills` — array of 3 suggestion texts
- `dashboard.products.bulkCreate.aiReviewTooltip` — "Created by AI — needs review"
- Button label changes (Malay: "Cipta" → "Jana Draf")
- Placeholder copy refinements

### State Lifecycle

```
User types prompt → Clicks "Generate Drafts" (or Cmd+Enter)
           ↓
POST /api/ai/products-bulk-parse
           ↓
AI generates N product drafts
           ↓
buildSavePayload() sets aiReviewPending: true for each
           ↓
saveProductAction() creates products in DB
           ↓
Page resets to Draft tab + Latest sort
           ↓
AiReviewIndicator renders on each AI product
           ↓
Merchant reviews AI draft → edits → saves
           ↓
saveProductAction() clears aiReviewPending: false
           ↓
AiReviewIndicator disappears
           ↓
Merchant toggles status: draft → active
           ↓
updateProductFieldAction() enforces publishGateHook (sees aiReviewPending still false, gate still applies)
           ↓
If complete: product goes live. AiReviewIndicator already gone.
```

### Testing

**New test cases:** TC-F08-04-34 through 41 in:
- `src/__tests__/unit/dashboard/bulk-create-save.test.tsx` — textarea, suggestion pills, form submission
- `src/__tests__/unit/dashboard/bulk-create-utils.test.ts` — `buildSavePayload()` sets `aiReviewPending: true`
- `src/__tests__/unit/actions/save-product-action.test.ts` — server-side `aiReviewPending` state management
- `src/__tests__/unit/dashboard/ai-review-indicator.test.tsx` — indicator rendering, tooltip, optimistic clear

**Amended test:** TC-F08-04-27 — assertion updated due to `router.refresh()` removal from modal's `handleSave`.

### Related

- CHANGELOG entry: GH-1502
- Bulk-create API: `/api/ai/products-bulk-parse` (GH-1410, unchanged)
- Publishing gate (GH-1458): applies to all products, AI-generated or manual

---

## 6. Error Matrix

| Error | User Sees | Recovery |
|-------|-----------|----------|
| Image upload > 5MB | Inline error "Max 5MB" | Resize/compress |
| Duplicate SKU | Inline error on variant field | Change SKU |
| AI description fail | Toast + manual input | Retry button |
| Stock = 0 | Auto-hide from storefront | Restock to show |
| Toggle Active without price/sku/inventory | Modal: "Cannot publish yet" + missing fields list | Fill required fields, retry toggle |
| Bulk-generate fails (API timeout) | Toast error + retry button | Adjust prompt or retry |
