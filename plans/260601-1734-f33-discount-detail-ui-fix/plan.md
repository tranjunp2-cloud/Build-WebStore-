---
title: "F33 Discount Detail/Edit UI Gap Fix"
description: "Add Live Preview sidebar, ID/Created metadata, and sticky bottom save bar to discount form to match design."
status: pending
priority: P2
effort: 4h
branch: staging
tags: [f33, discounts, ui, dashboard]
created: 2026-06-01
---

# F33 — Discount Detail/Edit UI Gap Fix

UI-only changes to align `discounts/[id]` + `discounts/new` form with design (`docs/design/f33/form-view.jsx`). No new API calls — all new UI derives from existing draft state + one new prop (`tenantName`).

## Problem

Current form ships fields + header but is missing design elements:
1. Live Preview sidebar (right rail) — code chip + type badge, value "off subtotal", usage meter, date window, tenant-scoped box.
2. ID + Created metadata row under title.
3. Sticky bottom status bar (`Up to date` / `Unsaved changes` + Cancel/Save).
4. Value input "sen" affix variant (design) vs current RM input — **decision: keep RM** (see Phase 01 note).
5. Delete button — standalone top-right (already mostly correct, refine).
6. Dirty bar → replaced by bottom bar (keep top dirty bar OR remove; see Phase 02).

## Phases

| Phase | Title | Status | Effort | Blockers |
|-------|-------|--------|--------|----------|
| 01 | [Layout + Live Preview sidebar](phase-01-layout-and-sidebar.md) | pending | 2h | none |
| 02 | [Header metadata + bottom save bar](phase-02-header-and-bottom-bar.md) | pending | 2h | Phase 01 (shared `discount-form.tsx` layout container) |

## Sequencing

Phase 01 and 02 both edit `discount-form.tsx` (the layout container). **Sequential, not parallel** — same file. Phase 01 establishes the `flex-col` + 2-col grid skeleton; Phase 02 slots the bottom bar into that skeleton and reworks the header.

## Key decisions

- **Value input stays RM** (not sen). Design shows sen, but RM is more user-friendly and the wire format / storage (sen) is unchanged — `handleSave` already converts RM→sen. Documented as intentional divergence. The Live Preview value display uses `fmtValue` which expects sen for fixed; convert RM draft → sen before formatting.
- **Tenant name** sourced server-side: edit page bumps `findByID` to `depth: 1` (or separate tenant fetch) → passes `tenantName` prop. New page passes current user's primary tenant name. Single new prop threaded through `DiscountForm`.
- **No new API, no schema change, no migration.** Pure presentational. Storage format untouched.

## Out of scope

- Checkout discount field (separate file, already done).
- Usage history page.
- Any API / validation logic changes.

## Success criteria (whole plan)

- Edit page renders 2-col layout: form card (left) + side rail (right, stacks below on <1100px).
- Live Preview updates live as draft changes (no save needed).
- ID `disc_00009` + `Created <date>` shown on edit; `New code · <tenant>` on new.
- Sticky bottom bar shows correct status + working Cancel/Save.
- `npm run build` / typecheck clean. Existing tests still pass.
