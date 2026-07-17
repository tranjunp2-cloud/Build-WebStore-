---
title: "GH-1652 EasyParcel QA audit scout report"
status: completed
issue: 1652
branch: codex/1652-easyparcel-qa-audit
created: 2026-07-17
---

# GH-1652 EasyParcel QA Audit Scout Report

## Summary

All 16 reported areas still need work on current `staging`: 11 remain open and 5 are partially addressed. The main structural problem is conflicting persistence UX: warehouse mutations auto-save immediately while the page also exposes a global Save button. This creates request races, false local success after API failure, and no meaningful dirty state.

No database schema change, new route, or new dependency is required.

## Issue Status

| # | Status | Current-code evidence | Planned direction |
|---|---|---|---|
| 1 | Open | OAuth callback returns `/settings/shipping?ep=connected`; tabs default to Flat Rate when `enabled=false`. | Redirect with `tab=easyparcel`; make tab selection query-aware and preserve the tab while clearing the one-shot toast param. |
| 2 | Open | EasyParcel cards use `border-white/*`, `bg-white/*`, fixed RGBA dividers, and inconsistent radii. | Replace with dashboard semantic tokens and established component styles in both themes. |
| 3 | Open | EasyParcel settings, pickup form, stepper, wallet, badges, toasts, and confirmations are hardcoded English. | Add `dashboard.settings.shipping.easyParcel` keys and consume through `useI18n`; GH-1652 explicitly requires VI/EN/MS, so extend the locale preference flow for VI. |
| 4 | Open | `PickupAddresses` renders the stored array directly. | Stable non-mutating default-first sort for display and persisted canonical order. |
| 5 | Partial | Shared `splitPhone`/`hasUsablePhone` exists, but the form accepts arbitrary characters and stores raw text; save API does not canonicalize. | Move MY canonicalization to the client-safe phone module, normalize to `60...`, validate client and server. |
| 6 | Partial | `address2` is omitted from the form; invalid required fields only disable the CTA with no field feedback. Editing also drops an existing `address2`. | Restore optional address line 2, keep it outside validity, add explicit field errors, and require city/postcode rules from TC-F36.12. |
| 7 | Open | Default checkbox is a hand-built inline-style span. | Use the shared shadcn Checkbox with semantic checked/focus tokens. |
| 8 | Partial | Save route writes `warehouses`, but UI fires one request per mutation, does not rollback on failure, and deletion of the last warehouse fails while `enabled=true`. Tests only inspect a mocked Payload call. | Keep a local draft, save once, return canonical state, and handle deleting the last active warehouse as an explicit deactivation. |
| 9 | Open | `PickupAddresses` does not expose add/edit state; parent Save remains active. | Add an editing-state callback and suppress global save/navigation while the nested editor is open. |
| 10 | Partial | Native selects share the input class but retain browser-specific placeholder/option behavior. | Use the shared Select primitives and one field-control style. |
| 11 | Open | Header, account actions, benefit grid, footer, and cards are desktop-only flex/grid layouts. | Add real 375px layouts, min-width guards, wrapping, and full-width mobile actions; use overflow hiding only as a final guard. |
| 12 | Open | State/city/postcode is always `grid-cols-3`. | `grid-cols-1 sm:grid-cols-3`; 44px mobile controls. |
| 13 | Open | Disconnected header, 2-column benefit grid, and footer can overflow at 390px. | Stack content/actions on mobile and tighten padding/type without removing essential copy. |
| 14 | Open | `canSave` checks connection/completeness only; no snapshot or dirty state exists. | Compare canonical draft to last saved snapshot; save only when dirty and valid. |
| 15 | Open | Trash action calls `remove()` immediately. | Reuse shared `ConfirmModal`; no local deletion before confirmation. |
| 16 | Partial | Management view confirms disconnect, but setup stepper disconnects immediately. | Reuse the same translated confirmation in both views. |

## Relevant Files

- `src/app/(dashboard)/settings/shipping/shipping-settings-client.tsx` - tab selection and top-level responsive tabs.
- `src/app/(dashboard)/settings/shipping/easyparcel-settings-tab.tsx` - connection state, warehouse draft, save/toggle/disconnect workflow.
- `src/app/(dashboard)/settings/shipping/pickup-addresses.tsx` - warehouse list, form, geo cascade, delete/default controls.
- `src/app/(dashboard)/settings/shipping/ep-setup-stepper.tsx` - first-time setup and the remaining unconfirmed disconnect path.
- `src/app/(dashboard)/settings/shipping/ep-wallet-banner.tsx` - wallet copy and mobile action layout.
- `src/app/api/easyparcel/oauth-callback/route.ts` - success/error redirect URL.
- `src/app/api/tenant/[id]/easyparcel-save/route.ts` - ownership guard and settings persistence.
- `src/lib/shipping/easyparcel/phone.ts` - client-safe MY phone parsing/validation.
- `src/lib/shipping/easyparcel/warehouse.ts` - warehouse readiness/default helpers.
- `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` - supported dashboard locales.
- `src/__tests__/api/easyparcel-oauth-callback.test.ts`, `src/__tests__/api/tenant-easyparcel-save.test.ts` - route regression coverage.
- `src/__tests__/unit/dashboard/ep-setup-stepper.test.tsx` - existing setup flow coverage.
- `e2e/f14-shipping.spec.ts` - current authenticated shipping-settings Playwright pattern.

## Scope Decisions

- Support VI/EN/MS for the EasyParcel surface. Adding VI requires updating the global `Locale` type, provider, user preference validation/options, and locale switchers; untranslated areas can use the existing English tree as fallback.
- Reuse `ConfirmModal`; this repo has no shared `AlertDialog` implementation.
- Remove warehouse auto-persistence and keep one explicit Save transaction.
- Deleting the final warehouse while active also drafts `enabled=false`; confirmation copy must state that checkout will return to Flat Rate.
- Do not revive deprecated courier-selection requirements mentioned in issue copy.
- Do not change Payload schema or `scripts/db-setup.js`.

## Risks And Open Verification

- The reported DB symptom cannot be proven with current mocked API tests. Add save/reload/delete UAT against a connected sandbox tenant and avoid claiming it fixed from unit tests alone.
- Current F36 QA docs have later test IDs through TC-F36.199. New regressions must use the next free IDs after re-checking the file at implementation time.
- Existing F36 plan metadata says `in-progress`, but its relevant code has already landed on `staging`; it is stale documentation, not a blocker for this audit plan.
