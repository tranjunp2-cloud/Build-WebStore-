# Scout Report — F03 Dashboard Single-Column Revamp

> Branch: `feat/F03-dashboard-ui-ux-revamp` · Plan: `plans/260624-1114-dashboard-single-column-revamp/IMPLEMENTATION_PLAN.md`
> Scope confirmed: kill tab system → single-column block stream driven by flat preference list. Pure UI/UX + soft preference migration (no DB migration).

## TL;DR — what the revamp touches
- **1 page** (`dashboard/page.tsx`) loses tab routing, renders block stream
- **2 components deleted** (`DashboardTabs`, `DashboardTabContent`)
- **~8 components edited** (Stats, AnalyticsChart, TopPerformingList, SEOHealthWidget, CustomizeModal, 3 views)
- **3 components created** (`UnifiedEmptyState`, `ComingSoonOverlay`, + helper in existing `dashboard-utils.ts`)
- **No schema/DB migration** — `dashboardPreferences` stays `json`/`string[]`, only value namespace expands
- **i18n: `en.json` + `ms.json`** (NOT `vi.json` — see ⚠️ below)

---

## ⚠️ Plan corrections (verified discrepancies)
1. **Locale is `ms` (Malay), not `vi` (Vietnamese).** Plan §6/§9 repeatedly says "en + vi" and references `vi.json`. Actual repo: `src/i18n/locales/` = **`en.json` + `ms.json`** only. All new i18n keys must go into `en.json` + `ms.json` or CI i18n parity gate fails. **This is the single most important fix before coding.**
2. **`dashboardPreferences` has NO `defaultValue` in schema.** Plan §3 says default `['views','leads','engagement']`. In `Tenants.ts:302-305` the field is `type: json` with description only — no `defaultValue`. The `['views','leads','engagement']` default lives in app code, not schema. `normalizeDashboardBlocks()` must handle `null`/`undefined` (no stored prefs), legacy values, AND new IDs. Plan's runtime-migration approach is correct; just confirm it covers the null case.
3. **`AnalyticsChart` is a `BarChart`, not a line chart.** Plan §4.2 says "add `<YAxis/>`" — correct, but note current chart has only `<XAxis>` (lines 109-118), gradient defs, animated `<Bar>`. `<YAxis>` import + margin adjustment needed.

---

## Layer 1 — Page & Tab System

| File | Lines | Role / revamp action |
|------|-------|----------------------|
| `src/app/(dashboard)/dashboard/page.tsx` | 165 | **Core rewrite.** Reads `searchParams.tab` (default `overview`); server forces `tab='overview'` when `!hasUsableSites`. Fetches `hasUsableSites` (sites with `generationStatus` ∈ completed/none/null). Passes `dashboardPreferences` → CustomizeModal, `searchParams` → Overview/Analytics views. Wraps content in `<TabPanel>` (CSS `hidden`). → Replace with block stream via `normalizeDashboardBlocks(prefs)`. |
| `src/app/(dashboard)/dashboard/layout.tsx` | 15 | Renders `<DashboardGreeting>` above children. No change. |
| `src/app/(dashboard)/dashboard/loading.tsx` | — | Skeleton. Reuse per-section. |
| `src/app/(dashboard)/actions.ts` | 53 | `updateDashboardPreferences(preferences: string[])` (lines 9-32): merges into `tenant.settings.dashboardPreferences`, `revalidatePath('/dashboard')`. Signature unchanged — flat list still `string[]`. |
| `src/components/dashboard/DashboardTabContent.tsx` | 52 | **DELETE.** Exports `DashboardTabContent`, `TabPanel`, `useTabContext`, `TabId` (`'overview'|'analytics'|'seo'`). Owns `pushState('?tab=X')` + popstate listener. |
| `src/components/dashboard/DashboardTabs.tsx` | 45 | **DELETE.** Tab button group, consumes `useTabContext`. |
| `src/components/dashboard/views/OverviewView.tsx` | ~380 | Period-aware server fetch (analytics counts, orders/revenue, timeseries SQL, SEO scan). Computes own `hasUsableSites`; returns `DashboardEmptyState`/`DashboardGenerationFailed` early. Renders `DashboardStats` + `SEOHealthWidget`. → becomes a section component. |
| `src/components/dashboard/views/AnalyticsView.tsx` | ~200 | Parses `searchParams.period`, aggregates 5000 analytics docs. → `#section-analytics`. |
| `src/components/dashboard/views/SEOView.tsx` | ~170 | One-time scan, score weights 40/35/25 (meta/content/technical). Passes scores+keywords to SEOViewContent. → `#section-seo-health`/`seo-tools`. |
| `src/components/dashboard/views/SEOViewContent.tsx` | 218 | Client UI: score rings, keyword tracker, `AIFixModal`, Ctrl+Z undo. → add SEO History placeholder + Keyword placeholder. |
| `src/components/dashboard/DashboardOnboarding.tsx` | 137 | Checklist banner, gated by `hasUsableSites && !(all 4 steps done)`. Keep, render full-width top of stream. |
| `src/components/dashboard/PeriodSelector.tsx` | ~50 | `router.push('?period=X')` → full server re-render. Keep in sticky toolbar. |

**Call-site note:** `SEOHealthWidget` consumes `useTabContext().setActiveTab` — deleting `DashboardTabContent` **breaks this import**; must convert to scroll-to-anchor in same PR. `AnalyticsHeader.tsx` also renders `DashboardTabs` but appears to be **dead code** (only referenced in tests, not page.tsx) — verify before deleting Tabs.

---

## Layer 2 — Widget / Card Components

| File | Lines | Revamp target (specific lines) |
|------|-------|--------------------------------|
| `src/components/dashboard/DashboardStats.tsx` | 189 | `STAT_CARDS` map (89-181); revenue card already defined (157-180) but filtered out at L84. → un-filter as Coming Soon. `TrendBadge` (29-52) + Sparkline (55-78, Recharts) reusable. **`YAxis` already imported here** (L5, `hide`) — template for AnalyticsChart. |
| `src/components/dashboard/AnalyticsChart.tsx` | 139 | `<BarChart>` (92-134), `<XAxis>` only (109-118), margin (94), gradient defs (101-105). → add `<YAxis/>`. |
| `src/components/dashboard/TopPerformingList.tsx` | 107 | `activeTab` + `TABS` (22-31, Products already conditional-spread at 29), button-group (50-70), `getRankClass` (38-45), item render (80-101). → add disabled Products "Soon" tab. |
| `src/components/dashboard/SEOHealthWidget.tsx` | 132 | **L26** `const { setActiveTab } = useTabContext()`; **L52** `setActiveTab('seo')` in `handleNavigate`. → replace both with scroll-to `#section-seo-health`. |
| `src/components/dashboard/DashboardCustomizeModal.tsx` | 277 | `ALL_METRICS` useMemo (122-128, revenue commented 126-27); dnd-kit sensors (138-148); `handleDragEnd`/`moveUp`/`moveDown` (150-175); `toggleVisibility`+`handleSave`→`updateDashboardPreferences` (177-198); `SortableItem` (28-114). → `ALL_BLOCKS` flat list (stat+section), keep dnd-kit. |

**Reusable patterns found (avoid duplication for `ComingSoonOverlay`):** `disabled:opacity-50` (AIFixModal/BulkCreateModal), TrendBadge green/red/gray, gradient buttons `bg-gradient-to-r`, modal `motion`+`AnimatePresence`.

---

## Layer 3 — Foundation (schema / utils / api / i18n / tests)

**Schema** — `src/collections/Tenants.ts:302-305`: `settings.dashboardPreferences`, `type: json`, **no defaultValue**, desc "User widget layout configuration". → no DB migration (confirmed: content change only, not column type). No `scripts/db-setup.js` entry needed.

**Utils** — `src/lib/dashboard-utils.ts` (existing, 27 exports incl. `parsePeriod`, `mapToTopList`, `classifySeoCategoryIssues`, `MAX_KEYWORDS`, `VALID_PERIODS`). → **add here** (plan): `normalizeDashboardBlocks()`, `DEFAULT_DASHBOARD_BLOCKS`, `ALL_BLOCKS`, `DashboardBlockId` type. (Open: keep here vs new `block-config.ts` — recommend here, file is the established home.)

**lib/dashboard/** — `sidebar-badge-counts.ts` (57), `sidebar-badge-counts-cached.ts` (32, 60s TTL), `revalidate-badge-counts-hook.ts` (38). Unrelated to revamp; do not touch.

**API** — `src/app/api/dashboard/summary/route.ts`: `GET ?period=today|7d|30d` → `{ success, data: { metrics{views,leads,engagement,revenue,*Change,pendingOrdersCount}, pendingOrders[], series{views,leads,engagement,revenue:[{date,value}]} } }`, per-tenant 60s cache. Already returns revenue + pendingOrders — backend data exists even though UI shows Coming Soon.

**i18n** — `src/i18n/locales/`: **`en.json` + `ms.json` only**. `dashboard` namespace at en.json ~L780. Existing subtree: `overview{greeting,tabs{overview,analytics,seo},stats{views,leads,engagement,revenue,pendingOrders},actions,seo,periods,customizeModal}`, `banner`, `onboarding`, `resetAccount`. → add `comingSoon`, `unifiedEmpty`, `seo.history`, `analytics.products.soon`, `customizeModal.sections.*` to **both** files.

**Tests likely to break / update** (`src/__tests__/unit/dashboard/`):
- `tab-panel.test.tsx` — tests `TabPanel`/`DashboardTabContent` → **will break on deletion**, rewrite or remove.
- `dashboard-components.test.tsx` — renders `DashboardStats`, `SEOHealthWidget`, `TopPerformingList` (mocks useUser) → update for new props/Coming Soon.
- `dashboard-utils.test.ts` / `-extended` / `-scenarios` — add `normalizeDashboardBlocks` cases (legacy map, null, append-defaults).
- `f03-dashboard-components-extended.test.tsx`, `f03-onboarding-checklist.test.tsx` — F03-tagged, re-verify.

---

## Default block order (from plan §5)
```
Toolbar(sticky: PeriodSelector+Customize) → DashboardOnboarding(full-width)
→ At-a-Glance 4 cards [stat-views|stat-leads|stat-engagement|stat-revenue*Soon]
→ [if !hasUsableSites → UnifiedEmptyState, STOP]
→ #section-analytics (AnalyticsChart+YAxis → TopPerformingList)
→ #section-seo-health (Gauge | SEO History placeholder · bars · AI Fix · footer)
→ #section-seo-tools (Sitemap/Meta · Issues · Keyword placeholder)
→ (optional) #section-pending-orders (default OFF, F10)
```

---

## Files to create
- `src/components/dashboard/UnifiedEmptyState.tsx` — large empty state under At-a-Glance when `!hasUsableSites`
- `src/components/dashboard/ComingSoonOverlay.tsx` — reusable blur+badge+tooltip (Revenue, Products, Pending Orders, SEO History, Keyword)
- (edit) `src/lib/dashboard-utils.ts` — block config + `normalizeDashboardBlocks`

## Files to delete
- `src/components/dashboard/DashboardTabs.tsx`
- `src/components/dashboard/DashboardTabContent.tsx`

---

## Unresolved Questions
1. **i18n locale** — plan assumes `vi`; repo has `ms`. Confirm: add keys to `en`+`ms` (CI parity), drop all `vi` references? (recommend yes)
2. **`normalizeDashboardBlocks` home** — `dashboard-utils.ts` (recommended) vs new `block-config.ts`?
3. **`AnalyticsHeader.tsx`** — confirmed dead code? It renders `DashboardTabs`; if truly unused, delete alongside Tabs (else its import breaks). Only referenced in tests currently.
4. **`<YAxis>` scale** — auto-scale view counts or fixed ticks? Plan says "reference marker" only.
5. **Period selector post-revamp** — keep `router.push()` (full re-render, acceptable since rare) or move to client state? Plan implies keep (KISS).
6. **TopPerformingList 5000 cap** — plan §4.2 mentions "cap 5000"; current code has no display cap (only Analytics fetch limit is 5000 docs). Clarify intent.
