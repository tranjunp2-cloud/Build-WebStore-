# Phase 02 — Dashboard integration and production UI

## Context Links

- Plan: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-secure-data-contract-and-loader.md)
- Current page integration: `src/app/(dashboard)/dashboard/page.tsx:47-176`
- Current mock widget: `src/components/dashboard/revamp/pending-orders.tsx`
- Dashboard design rule: `docs/design/F03-dashboard-design.md:266` (Orders default OFF)

## Overview

- **Priority:** P1
- **Status:** Completed
- **Effort:** 3h
- Wire the loader only when visible and authorized, isolate optional-widget failures, replace the locked mock with accessible real rows/empty/unavailable states, and remove the Orders-only Soon metadata.

## Key Insights

- `SectionHead` already has a `right` slot for the count badge; no atom API change is needed.
- `hasUsableSites = false` returns a unified dashboard empty/failure view; avoid an invisible order query before that branch.
- `.tp-row` and `.tp-rank` belong to Traffic. Dedicated order classes are required for four fields and mobile layout.
- Shared `revamp.soon`, `revamp.comingSoon`, and `.cs-*` styles remain used by Traffic/SEO/Revenue.
- Customize preferences are tenant-wide. This PR leaves the existing option and save action unchanged; only server-side query/render is permission-gated.

## Requirements

### Functional

- Fetch only when tenant exists + usable site + Orders block enabled + user has `orders` permission.
- Authorized user sees real rows or localized empty state.
- Loader or mapping failure leaves the rest of the dashboard intact and shows a localized unavailable state.
- Entire row links to `/orders/{documentId}`.
- Count badge uses `totalCount`; list shows at most five.
- Orders remains default OFF and becomes a normal Customize option without a Soon badge.

### UX/accessibility

- Row is a semantic Next.js link: Tab focus, Enter activation, no fake click handler.
- Visible hover and `:focus-visible` states.
- 375px mobile has no four-column overflow; order number, count, total, and status remain readable.
- All user-facing strings are EN/MS localized.

## Architecture

```text
current user -> tenant + widget permission
                │
raw blocks -----┴-> inline four-gate decision
                     ├─ false -> no query, no Orders render
                     └─ true  -> pending loader
                                  ├─ success 0 -> empty state
                                  ├─ success N -> rows + total badge
                                  └─ failure   -> unavailable state; other blocks survive
```

Keep `blocks` as the persisted source. Derive a filtered render list for unauthorized users; do not mutate preferences merely by viewing the dashboard.

## Related Code Files

| Action | Absolute path | Change |
|---|---|---|
| Modify | `/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/dashboard/page.tsx` | Fetch user once, derive tenant/permission, run the conditional loader, and filter unauthorized Orders rendering. |
| Modify | `/home/liam/data/ech-prime-web-v2/src/components/dashboard/revamp/pending-orders.tsx` | Replace mock/overlay with DTO-driven rows and empty state. |
| Modify | `/home/liam/data/ech-prime-web-v2/src/lib/dashboard-utils.ts` | Remove Orders `soon: true`; keep it absent from defaults and update stale comments. |
| Modify | `/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/dashboard/dashboard-revamp.css` | Add dedicated order layout, hover, focus, empty, and breakpoints. |
| Modify | `/home/liam/data/ech-prime-web-v2/src/i18n/locales/en.json` | Replace mock-only order keys with real count/item/empty copy. |
| Modify | `/home/liam/data/ech-prime-web-v2/src/i18n/locales/ms.json` | Mirror EN key shape with natural Malay copy. |

## Implementation Steps

1. In `DashboardRoot`, replace the tenant-only auth lookup with one `getCurrentUser()` call and `tenantIdForQuery(user)`; preserve current no-tenant/empty behavior.
2. Compute the load condition inline: tenant exists, usable site exists, Orders is enabled, and `canReadPendingOrders(user)` is true. Do not add a one-line boolean utility.
3. Add pending data to the existing parallel fetch only when the inline condition is true; otherwise use a typed ready/empty DTO without issuing a query.
   - Catch only the Pending Orders promise, log a sanitized message without order/user data, and return the typed unavailable DTO.
   - Do not catch or change existing glance/traffic/SEO failure behavior.
4. Derive `renderBlocks = canViewOrders ? blocks : blocks.filter(id => id !== 'orders')`. Pass `{ orders, totalCount }` only in the Orders switch case.
5. Leave `CustomizeModal` and `updateDashboardPreferences` untouched. Shared preference authorization is existing behavior and a separate security concern.
6. Remove `soon: true` only from Orders metadata. Keep Orders absent from `DEFAULT_DASHBOARD_BLOCKS` and update its stale comment.
7. Rewrite `PendingOrders` props using the Phase 01 DTO/load state.
   - Use `SectionHead.right` for a localized total count pill.
   - Render up to five whole-row `Link`s with order number, pluralized item quantity, locale-aware currency total, and localized awaiting label.
   - Use `Intl.NumberFormat` with the active locale/currency; tests normalize Unicode spaces.
   - Empty data renders localized title/description and no order links.
   - Unavailable renders different localized title/description, no links, and never masquerades as “no pending orders.”
   - Remove `ComingSoonCorner`, lock zone, inline grid, hardcoded IDs/counts/totals, `mockOrder`, and `soonTip` usage.
8. Add `.po-*` CSS classes.
   - Desktop: explicit grid areas/columns for the four values.
   - Tablet/mobile: collapse to a readable two-row or stacked layout at existing breakpoints.
   - Add cursor, subtle hover affordance, and token-based `:focus-visible` outline; honor existing reduced-motion rules.
   - Do not edit/remove shared `.tp-*` or `.cs-*` rules.
9. Update locale keys in lockstep.
   - Keep `title`, `subtitle`, `awaiting`.
   - Add `emptyTitle`, `emptyDesc`, `unavailableTitle`, `unavailableDesc`, plus nested `count: { one, other }` and `items: { one, other }` objects for `tp`.
   - Remove only `orders.mockOrder` and `orders.soonTip`; keep top-level Soon/Coming Soon keys.

## Todo List

- [x] Gate fetch/render by usable site, visibility, tenant, and permission.
- [x] Isolate Pending Orders failure from the dashboard.
- [x] Replace locked mock with real row, empty, and unavailable UI.
- [x] Add dedicated responsive/interactive CSS.
- [x] Keep EN/MS locale structures identical.

## Verification Evidence

- Dashboard unit suite: 1051/1051 passed.
- TypeScript typecheck: passed.
- Code review: 9.8/10 with 0 critical issues and 0 warnings.

## Success Criteria

- AC01–AC07 pass with no fake content or locked overlay.
- Unauthorized custom role generates no Orders query and sees no widget; existing Customize preference behavior is unchanged.
- Authorized empty state is distinguishable from unauthorized suppression.
- New tenants still have Orders OFF; saved authorized tenants may enable/reorder it.
- Traffic/SEO/Revenue Soon behavior and shared styles remain unchanged.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Existing shared Customize action can mutate tenant preferences | Explicitly unchanged and deferred; loader remains the data-security boundary. |
| Query runs while block OFF | Inline four-gate decision; page orchestration test verifies loader is untouched. |
| Orders query/mapping fails | Catch only that promise and render unavailable; test that glance/traffic/SEO still render. |
| Mobile overflow from four fields | Dedicated grid areas and 375/768px manual checks. |
| Currency rendering varies by NBSP/symbol | Use `Intl`, locale-aware assertions, and verify MYR/USD/SGD samples. |
| Shared Coming Soon cleanup breaks other cards | Delete only Orders imports/keys/metadata; retain shared atoms/CSS/locale keys. |

## Security Considerations

- Permission is enforced in the loader and page render path; Customize remains presentation/preferences only.
- Never pass raw `user`, tenant ID, customer data, or Payload documents into the client component.
- The widget-level guard does not claim to fix pre-existing Orders API authorization gaps.

## Next Steps

Phase 03 locks the behavior with QA mappings and regression tests.
