# Phase 02 — Client guard in CMSLayoutClient + exclude-list

## Context
- Depends on Phase 01 (`hasWebsite` prop).
- `CMSLayoutClient` already uses `usePathname()` (line 35) → no new hook wiring needed.

## Overview
Priority: P1 · Status: pending · Effort: 2.5h
In `CMSLayoutClient`, decide per-route whether to render `<DashboardEmptyState/>` or `children`,
based on `!hasWebsite` + a pathname **exclude-list** (deny-by-default within `(dashboard)`).

## Key insights
- **Exclude-list, not include-list.** Guard ALL `(dashboard)` routes by default; list only the few exceptions.
  New modules get guarded automatically (issue acceptance: "dễ miss page mới" risk eliminated).
- Pages OUTSIDE `(dashboard)` (`/builder/new`, `/onboarding`, `/login`, …) never reach this layout → no manual exclude.
- Dynamic/detail routes (`/orders/[id]`, `/products/[id]`, `/blog/[id]`, `/customers/[id]`, `/discounts/[id]`,
  `/discounts/new`, `/products/new`, `/products/categories`, `/blog/categories`) share the parent layout →
  prefix matching covers them automatically. Acceptance: deep-link with no site → empty state, NOT 404/500.
- Guard renders INSIDE `<main>` (replacing `{children}`) so sidebar + header stay → user can still navigate
  to excluded pages (Help, Profile, Team) and to the CTA.

## Decisions
### Exclude list (NO guard) — verified real routes
- `/settings/profile` (Profile)
- `/settings/staff` (Team Account)
- `/help` (Help Center, incl. `/help/modules`, `/help/qna` via prefix)
- `/sites` — **OPEN ITEM RESOLVED → EXCLUDE.** `SitesPageClient` already renders its own
  empty/failed/create-first UI (`usableSites.length===0 && failedSites.length===0`, verified
  `sites/page.tsx:41-43`, `SitesPageClient.tsx:62`). Showing the global rocket would (a) double up and
  (b) hide the "create" affordance on the very page meant to manage sites. So `/sites` opts out and keeps
  its own UX. **Recommendation to QC: exclude `/sites`.**

### Guarded (default, no entry needed)
`/dashboard`, `/products`, `/orders`, `/customers`, `/blog`, `/discounts`, `/contact-leads`, `/media`,
`/templates-health`, `/settings` (root), `/settings/payments`, `/settings/domains`,
`/settings/email-templates`, `/settings/shipping`, plus all their dynamic children.

> Issue listed `/cms/storefront`, `/cms/notifications`, `/cms/settings/{tracking,localization}`, `/cms/templates`
> — these do NOT exist as `(dashboard)` routes today (verified). Deny-by-default means they're guarded if/when added.

## Architecture / data flow
```
hasWebsite (prop) ─┐
usePathname() ─────┼─► shouldShowNoWebsiteGuard(pathname, hasWebsite)
EXCLUDED_PREFIXES ─┘            │  true → <DashboardEmptyState/>
                               │  false → {children}
                               ▼  (rendered inside <main>, sidebar/header preserved)
```

## Related code files
- CREATE `src/app/(dashboard)/_components/dashboard-guard-paths.ts` — `EXCLUDED_PREFIXES` const +
  pure `shouldShowNoWebsiteGuard(pathname: string, hasWebsite: boolean): boolean`. Pure → unit-testable.
- MODIFY `src/app/(dashboard)/_components/CMSLayoutClient.tsx` — accept `hasWebsite` prop; compute guard;
  render `<DashboardEmptyState/>` vs `children` inside `<main>`.

## Implementation steps
1. Create `dashboard-guard-paths.ts`:
   ```ts
   export const NO_WEBSITE_EXCLUDED_PREFIXES = ['/settings/profile', '/settings/staff', '/help', '/sites'] as const
   export function shouldShowNoWebsiteGuard(pathname: string, hasWebsite: boolean): boolean {
     if (hasWebsite) return false
     return !NO_WEBSITE_EXCLUDED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
   }
   ```
   - Prefix match guards `/settings/payments` etc. while excluding `/settings/profile` + children.
   - Exact-or-`/`-boundary check prevents `/settings/profile-x` falsely matching `/settings/profile`.
2. `CMSLayoutClient`: add `hasWebsite?: boolean` to props (default `true` → fail-open: never hide content if
   prop missing/upstream error). Compute `const showGuard = shouldShowNoWebsiteGuard(pathname, hasWebsite)`.
   In `<main>`'s inner `<div className="p-4 …">`, render `{showGuard ? <DashboardEmptyState/> : children}`.
3. `layout.tsx` already passes `hasWebsite` (Phase 01).
4. Typecheck/build.

## Todo
- [ ] Create `dashboard-guard-paths.ts` (const + pure fn)
- [ ] Add `hasWebsite` prop + guard render to `CMSLayoutClient`
- [ ] Confirm `DashboardEmptyState` import path
- [ ] Build passes

## Success criteria
- No-site tenant on any guarded route → rocket empty state; sidebar/header intact; CTA → `/builder/new`.
- Excluded routes (`/help`, `/settings/profile`, `/settings/staff`, `/sites`) render normally with no site.
- Deep link `/orders/123` with no site → empty state (not 404/500).
- Has-site tenant → always `children`, never the guard.
- Tenant change via route nav re-renders server layout → `hasWebsite` recomputed (reactive, no manual reload).

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| Flicker: children paint then swap to empty | L×M | `hasWebsite` is server-resolved & SSR'd — decision made before first paint, no client fetch. No flicker. (Issue perf AC met.) |
| New excluded page forgotten | L×M | Centralized const + phase-04 test asserting each excluded prefix. |
| In-app tenant switch w/o nav leaves stale state | L×M | Scout found no no-reload switcher; `TenantAccessWatcher` handles access changes via reload. If a switcher is added later, it must trigger a server re-render (router refresh). Note for future. |
| `usePathname` returns trailing-slash variants | L×L | Next normalizes; prefix fn tolerant. |

## Security
- Pure client-side display gate, not an authz boundary. Server pages still enforce tenant scoping
  independently (a guarded page reached directly returns its own data only for the user's tenant).
  Guard is UX, not access control — no security regression.

## Next steps
- Phase 03 polishes i18n/a11y on the now-shared empty state; Phase 04 tests `shouldShowNoWebsiteGuard`.
