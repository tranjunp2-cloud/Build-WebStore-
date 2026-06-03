# Phase 01 — Layout restructure + Live Preview sidebar

## Context links
- Design source: `docs/design/f33/form-view.jsx` (lines 103–229: `detail-layout`, `side-rail`, rail cards)
- Design CSS: `docs/design/f33/admin.css:638` (`.detail-layout` grid `1fr 320px`, stacks <1100px), `:810` (`.side-rail`)
- Current form: `src/app/(dashboard)/discounts/_components/discount-form.tsx`
- Existing reusable: `discount-usage-meter.tsx`, `discount-status-badge.tsx`, `format.ts` (`fmtValue`, `fmtDate`, `fmtRM`)

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Restructure the form body from single max-w-2xl card into a 2-column layout (form card left, Live Preview side rail right). Add the Live Preview sidebar that mirrors draft state live. Add a reusable `DiscountTypeBadge`. Thread a `tenantName` prop server→client.

## Key insights
- Live Preview is **pure derived UI** — reads `draft` + `discount?.usageCount` + `tenantName`. No API, no new state.
- `DiscountUsageMeter` already exists and matches design (`count`, `limit` props). Reuse as-is.
- Design shows the type badge in two places (rail + value list). A `TypeBadge` exists in design `shell.jsx:121` but not yet extracted in our code (table inlines it). Extract `DiscountTypeBadge` once, reuse in rail. (DRY — but do NOT refactor the table in this phase; YAGNI for scope. Note as follow-up.)
- **Value formatting gotcha:** `fmtValue('fixed', value)` expects **sen**. Draft stores fixed value as **RM string** (e.g. "31.00"). So rail must convert: `type==='fixed' ? Math.round(parseFloat(valueInput)*100) : parseInt(valueInput,10)` before `fmtValue`. Reuse the exact same conversion already in `discount-form.tsx` `handleSave` (lines 115–117) — extract a tiny helper `draftValueToStored(type, valueInput)` to avoid divergence (DRY).

## Data flow

```
[server] edit page.tsx
  findByID discounts (depth:1)  ──► discount.tenant.name ─┐
                                                          ├─► <DiscountForm tenantName=... />
[server] new page.tsx                                     │
  getCurrentUser → extractTenantId → findByID tenants ────┘
                                                          │
[client] DiscountForm ──(draft, tenantName, usageCount)──► DiscountLivePreview (rail)
           draft changes ─► re-render ─► rail updates (no save)
```

## Requirements

### Functional
1. Form body = CSS grid: `1fr 320px`, gap 24px, `align-items: flex-start`; collapses to single column under ~1100px.
2. Left column: existing form fields card (keep `DiscountFormFields` unchanged).
3. Right column (side rail), two stacked cards:
   - **Live preview card:** title "Live preview"; row = code chip (`draft.code || "CODE"`) + `DiscountTypeBadge`; big value line = `fmtValue(type, storedValue)` + muted "off subtotal" (`—` when value empty/NaN); "Usage" label + `DiscountUsageMeter count={isNew?0:usageCount} limit={usageLimit}`; "Window" row = `fmtDate(startsAt)` → `fmtDate(expiresAt)` (`—` when blank).
   - **Tenant-scoped card:** shield icon + "Tenant-scoped" title; copy: scoped to **{tenantName}**, same code allowed for other stores, applies to subtotal only.
4. `usageLimit` derived: `draft.usageLimit === '' ? null : Number(draft.usageLimit)`.

### Non-functional
- New rail components ≤ 200 lines each (per dev rules). Split rail into its own file `discount-live-preview.tsx`.
- Use existing CSS-var theming (`--dash-surface`, `--dash-border`, `--dash-text`, `--dash-text-muted`). Do NOT import design's `admin.css` classes (different design system) — translate to Tailwind + inline vars like the rest of the dashboard.

## Related code files

**Create:**
- `src/app/(dashboard)/discounts/_components/discount-live-preview.tsx` — side rail (both cards). Props: `{ draft, tenantName, usageCount, isNew }`.
- `src/app/(dashboard)/discounts/_components/discount-type-badge.tsx` — `DiscountTypeBadge` ({ type }).
- `src/lib/discounts/draft-value.ts` — `draftValueToStored(type, valueInput): number | null` helper (used by rail + `handleSave`).

**Modify:**
- `src/app/(dashboard)/discounts/_components/discount-form.tsx` — wrap body in 2-col grid; render `<DiscountLivePreview>`; accept + pass `tenantName`; use `draftValueToStored` in `handleSave` (replace inline math).
- `src/app/(dashboard)/discounts/[id]/page.tsx` — `findByID` depth `1`; derive `tenantName` from `discount.tenant?.name`; pass prop.
- `src/app/(dashboard)/discounts/new/page.tsx` — fetch current user → primary tenant → `tenantName`; pass prop. (Mirror auth pattern; `redirect('/login')` if no user.)
- `src/app/(dashboard)/discounts/_components/discount-form-fields.tsx` — add `DiscountFormErrors`/`DiscountDraft` already exported here; no change needed unless rail import cycle. Keep types in fields file; rail imports `DiscountDraft` type from there.

## Implementation steps
1. Create `src/lib/discounts/draft-value.ts` with `draftValueToStored(type, valueInput)` returning `null` for empty/NaN, else sen (fixed) / int (percentage).
2. Create `discount-type-badge.tsx` — percentage = purple, fixed = cyan, icons `Percent`/`Banknote` (match table colors for consistency).
3. Create `discount-live-preview.tsx` — both rail cards; import `DiscountUsageMeter`, `DiscountTypeBadge`, `fmtValue`, `fmtDate`, `draftValueToStored`, `DiscountDraft` type. Shield icon = `ShieldCheck` (lucide).
4. Edit `discount-form.tsx`: add `tenantName?: string` to props; replace `<div className="p-6">…max-w-2xl…</div>` with grid container (`grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start p-6`); left = existing card, right = `<DiscountLivePreview draft={draft} tenantName={tenantName} usageCount={discount?.usageCount ?? 0} isNew={isNew} />`. Swap `handleSave` inline value math → `draftValueToStored`.
5. Edit `[id]/page.tsx`: `depth: 1`; `const tenantName = typeof discount.tenant === 'object' ? discount.tenant?.name : undefined`; pass prop. Keep `DiscountDoc` mapping (still depth-0 fields; tenant only used for name).
6. Edit `new/page.tsx`: convert to async; `getCurrentUser` → redirect if none; `extractTenantId` → `payload.findByID({collection:'tenants', id, depth:0})` → `tenantName = tenant?.name`; pass prop.
7. Typecheck / build.

## Todo list
- [ ] `draft-value.ts` helper
- [ ] `discount-type-badge.tsx`
- [ ] `discount-live-preview.tsx`
- [ ] `discount-form.tsx` grid + rail wiring + helper reuse
- [ ] `[id]/page.tsx` depth:1 + tenantName
- [ ] `new/page.tsx` tenant fetch + tenantName
- [ ] build/typecheck clean

## Success criteria
- Edit page shows 2-col layout; rail value/usage/window/code/type update live while typing (no save).
- Empty value → rail shows "—". Fixed "31.00" → rail shows "RM 31.00 off subtotal".
- Tenant-scoped card shows real store name.
- <1100px viewport: rail stacks below form.
- No TS errors; existing discount tests pass.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `discount.tenant` null/ID-only at depth:1 (relation not populated) | Med | Med | Guard `typeof === 'object'`; fall back to `undefined` → rail renders without name ("this store"). Verify depth:1 populates in dev. |
| New page now async + auth fetch adds latency / double user fetch | Low | Low | Page already `force-dynamic`; one extra findByID acceptable. |
| `fmtValue` sen/RM mismatch produces wrong preview | Med | High | Centralize via `draftValueToStored`; unit-test helper in Phase tests. |
| Rail import cycle (`DiscountDraft` lives in fields file) | Low | Low | Type-only import; if cycle, move `DiscountDraft` type to a `discount-types.ts`. |
| File >200 lines | Low | Low | Rail split into own file; badge + helper separate. |

## Backwards compatibility
- No schema/API/storage change. Existing rows render unchanged. `tenantName` optional → if absent, rail degrades gracefully. Old saved discounts (depth-0 path) unaffected.

## Test matrix
- **Unit:** `draftValueToStored` — empty→null, "50" percentage→50, "31.00" fixed→3100, "abc"→null. (`src/__tests__/unit/discounts/`)
- **Integration/RTL (optional, follow existing pattern):** rail renders code chip + value from draft; updates on prop change.
- **Manual:** type in each field, confirm rail live-updates; resize to <1100px.

## Security considerations
- `new/page.tsx` must `redirect('/login')` when no user (mirror edit page). Tenant fetch via `payload.findByID` with `overrideAccess:false` + `user` to respect tenant scoping. Never trust client for tenant name — server-derived only.

## Next steps
- Phase 02 slots the bottom save bar into the `flex-col` container this phase establishes and reworks the header metadata. Phase 02 depends on this grid skeleton existing.
- Follow-up (out of scope): refactor `discounts-table.tsx` to use `DiscountTypeBadge` (DRY) — note, don't do now.
