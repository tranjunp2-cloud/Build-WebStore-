# Phase 01 — Centralize site-state helper + wire into layout

## Context
- Scout: `plans/reports/scout-260625-1605-GH-1392-no-website-empty-state.md`
- Duplicated "usable site" logic: `views/OverviewView.tsx:76-79` and `sites/page.tsx:41-43`.

## Overview
Priority: P1 · Status: pending · Effort: 2.5h
Create one shared server helper that resolves whether a tenant has a usable website, reuse it in the
layout (to drive the guard) and in `OverviewView` (to dedup). DRY the filter that currently lives in 2+ files.

## Key insights
- Layout already runs a payload session via `Promise.allSettled` (avatar + badge counts). Add the
  site-state query to that same `allSettled` array → no extra `getPayload()`/session, no extra blocking call.
- The "usable" filter is identical in both call sites: `!generationStatus || generationStatus === 'none' || generationStatus === 'completed'`. Freeze this as the single source.
- Layout has NO `searchParams` → cannot evaluate the `ai_status=failed`/generation-failed branch. The global
  guard therefore renders only the plain empty state. The generation-failed variant stays the dashboard
  page's concern (OverviewView keeps its `DashboardGenerationFailed` branch).

## Requirements
- Functional: `getTenantSiteState(payload, tenantId)` → `{ hasUsableSite: boolean }` (extend later if needed).
  - `tenantId == null` → `{ hasUsableSite: false }`.
  - Query `sites` where `tenant == tenantId`, limit 5, apply usable filter, `hasUsableSite = usable.length > 0`.
- Non-functional: pure-ish (takes injected `payload`, no config import) → unit-testable like `sidebar-badge-counts.ts`.

## Architecture / data flow
```
layout.tsx (server)
  getPayload() session ──► Promise.allSettled([ avatar, badgeCounts, getTenantSiteState(payload, tenantId) ])
                                                                          │
                                                          { hasUsableSite } ──► hasWebsite prop
                                                                          ▼
                                                              <CMSLayoutClient hasWebsite=... />
OverviewView.tsx (server)  ──► getTenantSiteState(payload, tenantId)  (replaces inline filter)
```

## Related code files
- CREATE `src/lib/dashboard/get-tenant-site-state.ts` — exported `getTenantSiteState` + reusable `isUsableSite` predicate.
- MODIFY `src/app/(dashboard)/layout.tsx` — add helper to `allSettled`, derive `hasWebsite`, pass to `CMSLayoutClient`.
- MODIFY `src/components/dashboard/views/OverviewView.tsx` — replace inline `usable` filter (lines 70-92) with helper; KEEP the `DashboardGenerationFailed` branch (still needs raw `allSites.docs` + searchParams).

## Implementation steps
1. Create helper. Export `isUsableSite(site): boolean` (the predicate) and `getTenantSiteState(payload, tenantId)`.
   No `@payload-config` import — receive `payload` so tests inject a mock (gold-standard pattern).
2. In `layout.tsx`: inside the existing `if (user)` block, add `getTenantSiteState(payload, tenantId)` as a 3rd
   `allSettled` entry. Default `hasWebsite = false`; set from fulfilled result. Pass `hasWebsite` to `CMSLayoutClient`.
   - Edge: when `user` is null the `allSettled` block is skipped → `hasWebsite` stays `false` (acceptable; unauthenticated never reaches guarded content anyway).
3. In `OverviewView.tsx`: import `isUsableSite`; replace the `usable` filter with `allSites.docs.filter(isUsableSite)`.
   Leave generation-failed detection (`hasFailed`, `ai_status`) untouched. Net: dedup filter only, behavior identical.
4. Run `npm run build` (or `tsc --noEmit`) to confirm types compile.

## Todo
- [ ] Create `get-tenant-site-state.ts` (helper + `isUsableSite`)
- [ ] Wire into `layout.tsx` `allSettled`, derive + pass `hasWebsite`
- [ ] Refactor `OverviewView.tsx` to use `isUsableSite`
- [ ] Typecheck/build passes

## Success criteria
- One definition of "usable site"; grep finds the filter literal only inside `get-tenant-site-state.ts`
  (OverviewView + sites/page.tsx no longer inline it — sites/page.tsx refactor optional, note below).
- Layout exposes `hasWebsite` with zero additional payload sessions (still one `getPayload`).
- OverviewView output unchanged for the has-site and failed-generation cases.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| Extra query slows every navigation | M×M | Piggyback on existing `allSettled`; query is 1 indexed `find` limit 5. Optionally wrap in `unstable_cache` per-tenant (mirror `sidebar-badge-counts-cached.ts`) if profiling shows cost — defer (YAGNI). |
| `allSettled` rejection blanks `hasWebsite` | L×M | Default `false` only when no website is the safe-but-wrong direction (shows empty to a user WITH a site). Mitigate: on rejected status, default to `true` (fail-open) so a transient DB error never hides a real site. Decide: **fail-open (true)**. |
| OverviewView refactor changes failed-gen behavior | L×H | Keep `allSites.docs` + `hasFailed`/`ai_status` logic; only swap the filter fn. Covered by phase-04 tests. |

## Security
- No new data exposure; same tenant-scoped query already used. `tenantId` derived server-side from session.

## Next steps
- Phase 02 consumes the `hasWebsite` prop.

## Open / confirm
- Should `sites/page.tsx` also adopt `isUsableSite`? Recommend YES for full DRY, but it's outside the guard
  path — fold in only if cheap; otherwise note as follow-up to avoid scope creep.
- Cache strategy: default NO cache (correctness > 60s staleness for "did I just create my first site?").
  After creating a site the user navigates back → server layout re-renders → fresh read. Caching would
  delay the empty-state→content flip. **Decision: no cache.**
