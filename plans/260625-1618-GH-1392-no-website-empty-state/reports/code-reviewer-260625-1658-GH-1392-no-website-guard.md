# Code Review — GH-1392 No-Website Empty State Guard

Branch: `fix/1392-cms-no-website-empty-state` (changes uncommitted in worktree vs `staging`)
Reviewer: code-reviewer | Date: 2026-06-25
Verdict: **approve-with-nits** | Score: **9.3 / 10**

## Scope
- NEW: `get-tenant-site-state.ts`, `dashboard-guard-paths.ts`, 2 test files (70 tests total).
- MOD: `(dashboard)/layout.tsx`, `CMSLayoutClient.tsx`, `OverviewView.tsx`, `sites/page.tsx`.
- Verified: 70/70 new tests pass; `tsc --noEmit` clean on changed files; i18n EN+MS present; rocket PNG exists (64KB < 50KB target… see Nit-3).

## Overall
Clean, well-scoped A2 client-guard implementation. Deny-by-default exclude list is the right call (new modules auto-guarded). Pure guard fn is fully unit-tested incl. prefix-boundary cases. Fail-open default is correct. Refactor preserves prior inline behavior exactly. No security/correctness blockers.

---

## Critical
None.

## High
None.

## Medium

**M1 — Route paths in issue (`/cms/*`) differ from actual app routes; verify QA mapping.**
The issue lists `/cms/dashboard`, `/cms/products`, `/cms/account`, `/cms/team`, etc. The real routes (confirmed via `src/config/sidebar-nav.ts`) have NO `/cms` prefix: `/dashboard`, `/products`, `/settings/staff`, `/help`, `/sites`. The implementation correctly targets the real paths. Two semantic gaps to confirm with QC (@aryhibye), not code bugs:
- Issue excludes "Team / Account / Profile" at `/cms/account` + `/cms/team`. Implementation maps these to `/settings/profile` + `/settings/staff`. Confirm these are the only profile/team routes (no separate `/account` route exists in `(dashboard)`). Verified: no `/account` or `/team` segment exists — mapping is correct.
- `/builder/new` and `/onboarding` are outside the `(dashboard)` group so never hit this layout — correct, no entry needed (already documented in the file header).

**M2 — `/templates-health` is guarded; confirm intended.**
Issue lists "Templates gallery" (`/cms/templates`) as a ✅ guarded page. The only matching route is `/templates-health` (dev-only nav, prod-hidden). It IS guarded by deny-by-default (test line 82-84 asserts this). Acceptable, but it is a dev/super-admin tool — if a super-admin with no site needs it, they would see the empty state. Low real-world impact (prod-hidden). Confirm with QC; no change needed.

## Low

**L1 — Double empty-state render path on `/dashboard` (harmless redundancy).**
When tenant has no usable site and pathname is `/dashboard`, the layout guard renders `<DashboardEmptyState/>` in place of `children`, so `OverviewView`'s own no-site branch (lines 79-97) never renders. The OverviewView guard is now only reachable in the `generationStatus === 'failed'` case via `DashboardGenerationFailed` — but that branch is ALSO unreachable from the dashboard page now, because `hasWebsite=false` (failed-only tenant has no usable site → layout shows generic `DashboardEmptyState`, not `DashboardGenerationFailed`).
**Behavior change:** a tenant whose ONLY site is `generationStatus: 'failed'` previously saw `DashboardGenerationFailed` on `/dashboard`; now they see the generic `DashboardEmptyState` (layout guard wins, runs first). The OverviewView `DashboardGenerationFailed` branch is effectively dead code on the dashboard route. This is a minor UX regression (lost the tailored "generation failed" messaging on dashboard). The `failedSites` UI on `/sites` is preserved (excluded route). Recommend: either (a) confirm with QC that generic empty state is acceptable for failed-only tenants on `/dashboard`, or (b) teach the layout guard about failed state, or (c) keep OverviewView's failed branch by NOT guarding `/dashboard` failed-only. Given issue scope (guide users to create a site), generic empty state is arguably fine — but it is an unflagged behavior change worth a one-line note in the PR.

**L2 — `getTenantSiteState` and OverviewView both query `sites` with `limit:5` in the same request.**
On `/dashboard`, the layout runs `getTenantSiteState` (1 sites query) AND `OverviewView` runs its own `payload.find(sites, limit:5)` + later `limit:100` sites query. Not a regression (OverviewView queries pre-existed) and not N+1, but the layout query is now redundant work on the dashboard route specifically. Acceptable per YAGNI — sharing state across the server/client boundary would add complexity. Note only.

**L3 — `limit: 5` "safety margin" comment.**
`getTenantSiteState` uses `limit: 5` "1 site/tenant expected, extra for safety". `.some(isUsableSite)` only needs to know if ANY usable site exists; `limit: 1` filtered to usable would not work (need to scan past failed ones), so `limit: 5` is a reasonable cap. Fine. If a tenant could ever have >5 sites where the only usable one is the 6th, it'd false-negative → show empty state incorrectly. Current product reality is 1 site/tenant, so non-issue. Matches OverviewView's existing `limit:5`.

## Nits

- **Nit-1 (naming):** `DashboardEmptyState` is now used CMS-wide (products, orders, settings, etc.), not just dashboard. Name is mildly misleading but it IS in `components/dashboard/` and the empty state is conceptually "you have no dashboard-able data". Renaming touches OverviewView + this layout + tests. Not worth the churn now (YAGNI). Leave as-is.
- **Nit-2 (a11y):** rocket `alt="Rocket launch illustration"`; issue AC suggested `alt="No website illustration"`. Either conveys decorative-illustration intent; current is acceptable. CTA is a real `<Link>` (focusable, keyboard-accessible) — meets AC. No explicit `aria-label` on the CTA but visible text "+ Create New Website" serves as the accessible name. OK.
- **Nit-3 (perf):** rocket PNG is 64KB (issue AC: ≤50KB). Minor; uses `priority` + `next/image fill`. Consider compressing or converting to WebP/SVG. Non-blocking.
- **Nit-4:** `/settings` index redirects to `/dashboard` (no bare settings page), so the test asserting `shouldShowNoWebsiteGuard('/settings', false) === true` (line 87) covers a path users never land on. Harmless extra coverage.

---

## Focus-area answers

1. **Correctness — guard logic:** Correct. Prefix match with `=== p || startsWith(p + '/')` properly handles dynamic children (`/orders/123` → guarded) and rejects false matches (`/settings/profile-x`, `/sites-foo` → guarded). Fail-open default `true` is correct — transient DB error never hides a real site. `isUsableSite` semantics match prior inline filters byte-for-byte (verified via diff). Query shape `{collection:'sites', where:{tenant:{equals}}, limit:5}` matches OverviewView's existing query.
2. **Layout perf:** Correct. Site-state piggybacks on the existing single `getPayload()` session inside the same `Promise.allSettled` — no new session, no new blocking await (parallel with avatar + badge counts). Rejection handling correct: `hasWebsite` only overridden when `siteStateRes.status === 'fulfilled'`.
3. **Reactivity:** `hasWebsite` is SSR-resolved per request; both dashboard pages are `force-dynamic`. After creating a site at `/builder/new` and navigating back, the server layout re-renders → fresh query → `hasWebsite=true`. No client cache holds it. AC "no manual reload" met for full navigations. (Soft-nav back via router cache could in theory serve a stale layout, but `force-dynamic` + builder being a separate route group makes this a non-issue in practice.)
4. **Security:** Guard is UX-only. Server pages (`OverviewView`, `sites/page`, all settings pages) independently enforce tenant scoping via `getCurrentTenantId()` + `where:{tenant:{equals}}`. `tenantId` is derived from the authenticated session (`getCurrentUser` → `extractTenantId`), never from client input. No new data exposure — the guard hides UI but does not gate data; data gating remains in the server pages. Confirmed.
5. **Regression risk:** `failedSites` on `/sites` preserved (excluded route, refactor is pure rename). SSR flicker: none — `hasWebsite` resolved server-side before first paint, no client fetch swap. One behavior change flagged in **L1** (failed-only tenant loses `DashboardGenerationFailed` on `/dashboard`).
6. **A11y/i18n:** Reused `DashboardEmptyState`; i18n keys `t.dashboard.empty.{title,description,cta}` exist in both en.json and ms.json. CTA focusable. Acceptable per AC (see Nit-2/3 minors).
7. **Scope/naming:** `/sites` exclusion correct (own create-first UI). `DashboardEmptyState` name acceptable (Nit-1).

---

## Unresolved Questions (for QC / @aryhibye)
1. **L1:** Is the generic empty state (vs `DashboardGenerationFailed`) acceptable on `/dashboard` for a tenant whose only site failed generation? This is the one real behavior change.
2. **M2:** Should `/templates-health` (dev-only, prod-hidden) be guarded for a no-site super-admin, or excluded?
3. Issue's `/cms/*` paths vs real prefix-less routes — confirm QA test matrix uses actual routes (`/dashboard`, not `/cms/dashboard`).

**Status:** DONE_WITH_CONCERNS
**Summary:** Clean, well-tested A2 client guard; deny-by-default + fail-open are correct, 70/70 tests pass, tsc clean, refactor preserves inline behavior. Approve-with-nits (9.3).
**Concerns:** One unflagged behavior change (L1: failed-only tenant loses tailored generation-failed UI on /dashboard) — confirm acceptable with QC. Two route-mapping confirmations (M1/M2) needed but no code change required.
