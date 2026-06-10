# F33 Discount Setting CMS — Design & Wireframe Spec

> **Status:** Draft for Claude Design  ·  **Updated:** 2026-05-30  ·  **Owner:** Design
> **Related:** `docs/prd/F33-discount-cms.md` · `docs/stories/F33-discount-cms-stories.md` · `plans/260529-1135-f33-discount-cms/`
> **Claude Design (placeholder):** https://claude.ai/public/artifacts/ (placeholder — update after build)
> **Claude Design:** https://claude.ai/design/p/a2811344-f556-4b61-b1af-abfe95541560?file=f33%2FF33%20Discount%20Codes.html&present=1
> **Purpose:** Self-contained handoff brief — everything Claude Design needs to build F33's 4 screens without reading other docs.

---

## 1. Overview

Admin-managed discount-code system, **multi-tenant**. Merchants create/manage discount codes in Payload admin; customers apply a single code at any checkout (COD / QR-banking / Stripe); system tracks usage per order and exports the discount list to CSV.

**Depends on:** F01 Builder, F10 Orders, F13 Stripe. **GitHub:** Issue #1114.

## 2. Design Goal

Let a non-technical merchant run promotions end-to-end — create a code, watch live usage against its limit, export the list — without dev help. At checkout, make savings instantly clear; invalid codes never block the order (silent reject, full price).

## 3. Design Principles

- **Status + usage at a glance** — every code shows status badge + `usageCount / usageLimit`
- **Never hard-fail checkout** — expired / at-limit / inactive / wrong-tenant code → silently dropped, order proceeds at full price
- **Validation up front (admin)** — block bad input inline (percentage 0–100, fixed ≥ 0, code unique per tenant, start < expiry)
- **Discount on subtotal only** — `finalAmount = (subtotal − discount) + shipping + tax`
- **Tenant-safe** — a merchant only ever sees its own codes & usage
- **Admin-native** — S1/S2/S4 follow Payload admin conventions; S3 matches storefront checkout
- **Immutable audit** — usage history is read-only; deleting a code never deletes its history

## 4. Design System Reference

| Token | Value / Source |
|-------|----------------|
| Framework | Next.js 15 App Router + Payload admin UI |
| Styling | Tailwind + shadcn/ui |
| Icons | lucide-react |
| Base components | Payload admin default (S1/S2/S4) + custom storefront (S3) |
| Timezone | `Asia/Kuala_Lumpur` for all date display/normalization |
| Currency | Malaysia — RM; stored in **sen** (smallest unit). Show discount as negative line `−RM 50.00` |

### 4.1 Status badge colors

| Status | Color | Tailwind hint |
|--------|-------|---------------|
| active | green | `bg-green-100 text-green-700` |
| inactive | slate | `bg-slate-100 text-slate-600` |

### 4.2 Usage indicator

- `usageCount / usageLimit` text + thin Progress bar (if `usageLimit` set; else "∞ unlimited").
- At limit (`count == limit`) → bar red; code is exhausted (silently rejected at checkout).
- Near limit (≥80%) → bar amber.

### 4.3 Type / value display

| type | Render |
|------|--------|
| percentage | `50%` (value = percent) |
| fixed | `RM 25.00` (value stored in sen, e.g. 2500) |

---

## 5. Screen Inventory

| ID | Screen | Role | Surface | Stories |
|----|--------|------|---------|---------|
| S1 | Discount list + CSV export | Merchant | Payload admin | US-F33-04, US-F33-05 |
| S2 | Discount create/edit form | Merchant | Payload admin | US-F33-01, US-F33-02, US-F33-03 |
| S3 | Checkout discount field | Customer | Storefront checkout (COD/QR + Stripe) | US-F33-06, US-F33-07 |
| S4 | Discount usage history (read-only) | Merchant | Payload admin (custom view) | US-F33-08 |

---

## 6. Screen Wireframes

### S1 — Discount list + CSV export (Payload admin)

Payload collection list view, customized columns. **[Export CSV]** button lives here (exports the discount list, US-F33-05).

```
┌────────────────────────────────────────────────────────────┐
│  Discount Codes               [ ⬇ Export CSV ] [ + Create ]│
│  [ Status ▾ ]  [ Type ▾ ]            [ Search code/desc ]  │
├──────────┬────────┬────────┬──────────┬───────────┬────────┤
│ Code     │ Type   │ Value  │ Usage    │ Expires   │ Status │
├──────────┼────────┼────────┼──────────┼───────────┼────────┤
│ SUMMER50 │ %      │ 50%    │ 3 / 10   │ 31 Aug 26 │ ●active│
│          │        │        │ ▓▓▓░░░░░ │           │        │
│ WELCOME  │ fixed  │ RM 25  │ 100 /100 │ 15 Jun 26 │ ●active│
│          │        │        │ ▓▓▓▓▓▓▓▓ │ (at limit)│        │
│ OLD2025  │ %      │ 10%    │ 8 / ∞    │ —         │ ○inact.│
└──────────┴────────┴────────┴──────────┴───────────┴────────┘
                                              1–10 of 37  ‹ ›
```

**Columns (per FR-01):** code · type · value (formatted §4.3) · usage (count/limit + Progress §4.2) · expires (date `Asia/Kuala_Lumpur`, "—" if none) · status badge.
**Search:** by code OR description, case-insensitive (US-F33-04 AC-2).
**Filters:** status (active/inactive), type (percentage/fixed) — AND logic.
**Row actions:** open (→ S2 edit) · delete (confirm dialog "Delete discount 'SUMMER50'?"; usage history survives — soft semantics).
**Pagination:** Payload default; search/filter state preserved across pages.
**Export CSV (US-F33-05):**
- Button → `GET /api/v1/discounts/export`; downloads `discounts-{tenant}-{date}.csv`.
- CSV columns: `Code, Type, Value, Status, Usage Limit, Usage Count, Started At, Expires At, Created At` (dates ISO `YYYY-MM-DD HH:MM:SS`).
- Tenant-scoped; 10k-row cap → on exceed show "Export limited to 10,000 rows. Please apply a date filter first."
- Formula-injection guard: cells starting `= + - @` get a leading `'`.
**States:** loading (skeleton rows) · empty ("No discount codes yet" + Create CTA) · populated.

---

### S2 — Discount create/edit form (Payload admin)

```
┌────────────────────────────────────────────────────────────┐
│  ← Discount Codes        Create discount        [ Save ]   │
├────────────────────────────────────────────────────────────┤
│  Code *            [ SUMMER50                  ]            │
│                    unique for this store · auto-UPPERCASE   │
│  Description       [ Summer campaign            ] (≤500)    │
│                                                            │
│  Type *            ( ) Percentage   ( ) Fixed amount       │
│  Value *           [ 50       ] %     (0–100)              │
│                    └ if fixed: [ 2500 ] sen = RM 25.00     │
│                                                            │
│  Status            [ Active ▾ ]                            │
│  Usage limit       [ 10       ]   (blank = unlimited)      │
│  Used so far       3              (read-only)              │
│                                                            │
│  Starts at         [ 01 Jun 2026 ]   (→ start of day)     │
│  Expires at        [ 31 Aug 2026 ]   (→ end of day)       │
└────────────────────────────────────────────────────────────┘
```

**Fields:** code (unique per tenant, trimmed + UPPERCASE) · description (optional, ≤500) · type (percentage|fixed) · value (`%` suffix when percentage, sen→RM helper when fixed) · status (active|inactive, default active) · usageLimit (optional; blank = unlimited) · usageCount (**read-only**, edit mode only) · startsAt · expiresAt.
**Modes:** create (usageCount hidden / 0) · edit (all editable except usageCount; pre-populated).
**Validation (inline, block save):**
- percentage 0–100 → "Percentage must be between 0 and 100"
- fixed ≥ 0 → "Fixed amount must be ≥ 0"
- code unique per tenant (async) → "This code is already in use for your tenant" (same code in *other* tenant is allowed)
- if both dates set: startsAt < expiresAt → "Start date must be before expiry date"
- both dates blank = always available
**Normalization:** code trim+uppercase; startsAt → start-of-day, expiresAt → end-of-day (`Asia/Kuala_Lumpur`).
**Delete (US-F33-03):** in edit mode; confirm dialog; usage history preserved.
**States:** create · edit · validation errors · saving.

---

### S3 — Checkout discount field (storefront, all gateways)

Lives in the order-summary panel on checkout. Identical UX for COD, QR-banking, and Stripe (US-F33-06 + US-F33-07).

```
Order summary
┌────────────────────────────────────────────┐
│ Subtotal                       RM 100.00    │
│                                             │
│ Discount or promo code                      │
│ [ summer50          ]   [ Apply ]           │
│                                             │
│ — APPLIED STATE —                           │
│ ✓ SUMMER50 applied          [ Remove ]      │
│ Discount (50%)               −RM 50.00      │
│ Shipping                     +RM 10.00      │
│ Tax (6%)                     +RM  6.60      │
│ ──────────────────────────────────────────  │
│ Total                        RM 66.60       │
│                                             │
│ — INVALID CODE (silent) —                   │
│ [ EXPIRED99         ]   [ Apply ]           │
│ (code clears / no discount line; NO error;  │
│  order proceeds at full price)              │
└────────────────────────────────────────────┘
```

**Components:** code input (case-insensitive, backend normalizes) + Apply button; applied chip + Remove; discount line (distinct, negative); recomputed total.
**Pricing rule (BR-02):** discount on **subtotal only**, then add shipping + tax → `finalAmount`. Stripe charged exactly `finalAmount` (no Stripe Coupon; line items rebuilt to sum to it, no negative items, total ≥ 0).
**States:**
- **empty** — input + Apply
- **applying** — button spinner / disabled
- **applied** — success chip, discount line, total updated, Remove available
- **invalid (silent reject)** — no error toast/message; code field clears; order continues at full price. Covers expired / at-limit / inactive / wrong-tenant / non-existent.
- **removed** — total reverts to full price
**Confirmation parity:** applied discount must appear identically in summary, payment step, and the email receipt line `Discount: −RM 50.00`.

---

### S4 — Discount usage history (Payload admin, read-only)

Separate collection view (US-F33-08). **No CSV button here** — CSV export of the discount list is on S1.

```
┌────────────────────────────────────────────────────────────┐
│  Discount Usage History                  [ Search code/# ] │
├──────────┬──────┬──────────┬─────────┬──────────────┬──────┤
│ Code     │ Type │ Amount   │ Order # │ Customer     │ Date │
├──────────┼──────┼──────────┼─────────┼──────────────┼──────┤
│ SUMMER50 │ %50  │ RM 50.00 │ #1001   │ a@mail.com   │29May │
│ WELCOME  │ RM25 │ RM 25.00 │ #1044   │ b@mail.com   │27May │
└──────────┴──────┴──────────┴─────────┴──────────────┴──────┘
                                              1–25 of 312  ‹ ›
```

**Columns (per US-F33-08 AC-1):** Discount Code · Type · Amount Applied · Order # (link → F10 order) · Customer Email (snapshot) · Used Date. Sorted by Used Date desc.
**Search:** by discount code OR order number.
**Tenant-scoped:** merchant sees only its own usage; super-admin sees all.
**Immutable:** no edit/delete actions — "Usage history is immutable for audit purposes." One row per order (idempotent on orderId; no duplicate on webhook retry).
**States:** empty ("No redemptions yet") · populated.

---

## 7. Cross-cutting Requirements

- **Responsive:** S3 mobile-first (checkout on phone — input + Apply stack cleanly, discount line legible). S1/S2/S4 desktop-first admin; usable on tablet.
- **Accessibility:** WCAG 2.1 AA — labeled fields, keyboard nav, focus states; status conveyed by text + color (never color alone); error messages tied to inputs via `aria-describedby`.
- **i18n:** all visible strings translatable; storefront S3 honors active locale; currency + dates per `Asia/Kuala_Lumpur`.
- **States everywhere:** every list/view needs loading (skeleton), empty, and error variants.

## 8. Data Shapes for UI Binding

> Full schema in PRD §9.

**discounts:** `code`, `description`, `type` (percentage|fixed), `value` (percent or sen), `status` (active|inactive), `usageLimit` (nullable), `usageCount` (read-only), `startsAt`, `expiresAt`, `tenant`, `site` (nullable = all tenant sites).
**discount_usage_history:** `discount`, `order`, `amountApplied` (sen), `customerEmail`, `usedAt`, `tenant` — immutable, one row per order.
**orders (added):** `discount` (rel, snapshot), `discountCode` (text), `discountAmount` (sen) — all read-only.

## 9. Build Priority (for Claude Design)

| Wave | Screens | Stories | Rationale |
|------|---------|---------|-----------|
| **Core admin** | S1, S2 | US-F33-01–04 | Create/manage codes (P0) |
| **Customer** | S3 | US-F33-06, US-F33-07 | Apply at checkout, all gateways (P0) |
| **Reporting** | S4, S1-CSV | US-F33-05, US-F33-08 | Usage history view + discount-list CSV (P1) |

## 10. Out of Scope (do NOT design)

- Subscription-tier promo codes (platform-level super-admin → F15).
- Affiliate / referral codes; coupon distribution via email.
- Code stacking, per-customer usage limit, free-shipping type, auto-apply cart rules.
- S1/S2/S4 are Payload admin surfaces — prefer Payload-native list/edit patterns; only S4 needs a light custom read-only view.
