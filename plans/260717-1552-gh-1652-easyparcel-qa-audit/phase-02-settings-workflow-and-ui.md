# Phase 02 - Settings Workflow, Localization, And Responsive UI

## Context

- Plan: [GH-1652 overview](./plan.md)
- Depends on: [Phase 01](./phase-01-canonical-warehouse-contract.md)
- Priority: P1
- Estimate: 10h
- Issues covered: 1-16 (UI/workflow), with Phase 01 owning canonical persistence

## Requirements

- OAuth callback always opens the EasyParcel tab for success and error.
- Warehouse list is a local draft with an explicit saved snapshot; add/edit/delete/default does not call the API.
- Save is dirty-aware, unavailable during nested editing, and resets snapshot from the canonical server response.
- All required form errors are visible; `address2` is optional and preserved.
- Delete and disconnect are confirmed in management and setup flows.
- Complete EasyParcel settings copy is localized in EN/MS.
- Every connection/setup/management state works from 375px upward in light and dark themes.

## Related Code Files

- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/api/easyparcel/oauth-callback/route.ts` - include `tab=easyparcel` in success/error redirects.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/(dashboard)/settings/shipping/shipping-settings-client.tsx` - query-aware controlled tab and mobile tab sizing.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/(dashboard)/settings/shipping/easyparcel-settings-tab.tsx` - local draft/snapshot, dirty save, form state, translated copy, responsive states.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/(dashboard)/settings/shipping/pickup-addresses.tsx` - stable draft order, default styling, form validation, optional address2, shared controls, delete confirmation, mobile layout.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/(dashboard)/settings/shipping/ep-setup-stepper.tsx` - editing guard, disconnect confirmation, translations, mobile layout.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/app/(dashboard)/settings/shipping/ep-wallet-banner.tsx` - translations and mobile wrapping.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/i18n/locales/en.json` - canonical EasyParcel strings.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/i18n/locales/ms.json` - matching Malay strings.

## Implementation Steps

1. Redirect callback to `/settings/shipping?tab=easyparcel&ep={connected|error}`.
2. Make `ShippingSettingsClient` derive/control the active tab from `tab`; `ep` also implies EasyParcel for backward compatibility. Tab changes update only the `tab` query.
3. In `EasyParcelSettingsTab`, remove `handleWarehousesChange` network calls. Keep `draft` and `savedSnapshot` using canonical warehouses and `enabled`.
4. Make toggle edits local. Save one `{ enabled, warehouses }` transaction; disable duplicate submissions and reset draft/snapshot from API response.
5. Add `onEditingChange` to `PickupAddresses`. Hide the global save action while add/edit is open; in stepper, disable Next/Back while a nested edit is uncommitted.
6. Expand the form:
   - digits-only phone entry; canonicalize on commit;
   - address line 2 optional;
   - label, phone, address1, state, city, and 5-digit postcode errors shown per field;
   - shared shadcn Select for geo controls and Checkbox for default;
   - preserve geo cascade behavior and existing saved address2.
7. Keep draft order stable when default changes; after Save succeeds, animate the canonical default-first response into place (respect reduced-motion). Confirm delete before draft mutation. If deleting the final active warehouse, confirmation states that EasyParcel will be disabled and the parent drafts `enabled=false`.
8. Reuse `ConfirmModal` for setup-stepper disconnect; keep the management confirmation.
9. Add a nested `easyParcel` locale object under dashboard shipping in EN/MS. Migrate strings from settings tab, pickup form, setup stepper, wallet banner, status badges, toasts, validation, and confirmations.
10. Replace hardcoded white/RGBA borders/backgrounds with dashboard semantic tokens and shared controls. Preserve established page hierarchy; avoid a broad dashboard redesign.
11. Apply responsive behavior:
    - tabs fill width and do not resize/overflow at 375px;
    - header/account/footer action groups stack on mobile;
    - benefit cards become one column;
    - form grids become one column below `sm` and controls are 44px tall;
    - cards/actions use `min-w-0`, wrapping, and full-width mobile buttons;
    - padding is 16px mobile / 24px desktop;
    - no text clipping or horizontal scroll in disconnected, setup, or management state.
12. Preserve `tab=easyparcel` when clearing `ep` from browser history after the toast.

## State Model

```text
server snapshot -> local draft
local edit -> dirty draft (no request)
nested form open -> global Save hidden
confirm nested edit -> draft changes, editor closes
Save -> one API request -> canonical response -> new snapshot (clean)
Save failure -> draft remains dirty; no false success/rollback illusion
```

## Risks

- Large translation objects can drift between EN/MS. Phase 03 adds key-parity and render checks.
- Native Select-to-Radix migration must preserve async state/city/postcode value reconciliation.
- Last-warehouse deletion changes two fields (`warehouses=[]`, `enabled=false`) and must be described before confirmation.
- Query-controlled tabs must not cause hydration mismatch; derive initial state entirely client-side from `useSearchParams`.

## Todo

- [x] Fix callback and controlled tab query behavior.
- [x] Replace auto-save with draft/snapshot/dirty workflow.
- [x] Add nested-editor guard and explicit field validation.
- [x] Add delete/setup-disconnect confirmations.
- [x] Localize full EasyParcel settings surface in EN/MS.
- [x] Apply semantic light/dark tokens and 375px layouts.

## Success Criteria

- One deliberate Save request per batch of settings changes.
- No global save/navigation during an uncommitted nested edit.
- All destructive actions require confirmation.
- No hardcoded user-facing EasyParcel settings strings remain in the affected components.
- No horizontal overflow at 375px/390px; form controls remain readable and tappable.
