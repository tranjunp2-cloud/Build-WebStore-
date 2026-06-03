# Phase 02 — Header metadata + sticky bottom save bar

## Context links
- Design source: `docs/design/f33/form-view.jsx` (lines 67–101 header + meta + dirty bar; 231–239 `save-bar`)
- Design CSS: `docs/design/f33/admin.css:995` (`.save-bar` sticky bottom), `:660-672` (`.detail-title .meta`, `.dot`)
- Current header: `src/app/(dashboard)/discounts/_components/discount-form-header.tsx`
- Current form container: `src/app/(dashboard)/discounts/_components/discount-form.tsx` (modified in Phase 01)

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Add `ID disc_NNNNN · Created <date>` meta row under the title (edit) / `New code · <tenant>` (new). Add a sticky bottom save bar (status text left, Cancel + Save right). Keep Delete as standalone top-right button (already close to design — minor refine).
- **Blockers:** Phase 01 (this phase places the bottom bar inside the `flex-col min-h-0` container Phase 01 keeps; the grid body must already exist so the bar sits below it).

## Key insights
- **Dirty bar vs bottom bar:** design keeps BOTH — top `dirty-bar` (yellow, with Revert/Save) AND bottom `save-bar` (status + Cancel/Save). Current code already has the top dirty bar. **Decision: keep the existing top dirty bar as-is, ADD the bottom save bar.** Matches design exactly; no removal needed. (Item 6 in brief said "replace" but design `form-view.jsx` shows both — design wins.)
- Bottom bar status text: `dirty ? 'Unsaved changes' : isNew ? 'New discount' : 'Up to date'`.
- Bottom bar Save is **disabled when `!dirty && !isNew`** (same rule as header Save). Cancel = back navigation (reuse header's back logic: confirm if dirty).
- ID format: `disc_${String(discount.id).padStart(5,'0')}`. Created: `fmtDate(discount.createdAt)`.
- Sticky positioning needs the form container to be the scroll context. Current root is `flex flex-col min-h-0`. Bottom bar = `sticky bottom-0` with top border + surface bg + small shadow. Place as last child of the root `flex-col`, AFTER the grid body, OUTSIDE the `p-6` padding wrapper so it spans full width.

## Data flow

```
discount.id, discount.createdAt ─► header meta row (edit)
tenantName ─► header meta row (new: "New code · {tenant}")
dirty, isNew, saving ─► bottom save bar status + button en/disable
Cancel click ─► same back-guard as header back button
Save click ─► onSave (shared handler from discount-form.tsx)
```

## Requirements

### Functional
1. **Header meta row** under `<h1>` in `discount-form-header.tsx`:
   - Edit: `ID ` + mono chip `disc_00009` + dot separator + `Created 22 May 2026`.
   - New: `New code · {tenantName}`.
   - Requires new props on header: `id?`, `createdAt?`, `tenantName?`.
2. **Bottom save bar** (new component `discount-save-bar.tsx`):
   - Left: muted status text (see rule above).
   - Right: `Cancel` (ghost) + `Save`/`Save discount` (primary, disabled when `!dirty && !isNew`, spinner when saving).
   - Sticky to bottom of form container, full-width, top border, surface bg.
3. **Delete button:** keep current top-right placement; refine to match design `btn-secondary danger-on-hover` feel (border + hover→danger). Minor style tweak only.

### Non-functional
- New `discount-save-bar.tsx` ≤ 200 lines (will be ~50). Header stays ≤ 200.
- Theme via existing CSS vars, not design `admin.css`.

## Related code files

**Create:**
- `src/app/(dashboard)/discounts/_components/discount-save-bar.tsx` — props `{ dirty, isNew, saving, onCancel, onSave }`.

**Modify:**
- `src/app/(dashboard)/discounts/_components/discount-form-header.tsx` — add `id`, `createdAt`, `tenantName` props; render meta row under title; refine Delete button styling (border + danger-on-hover).
- `src/app/(dashboard)/discounts/_components/discount-form.tsx` — pass `id`/`createdAt`/`tenantName` to header; render `<DiscountSaveBar>` as last child of root `flex-col`; provide `onCancel` (back-with-guard, extract shared with header or pass `router.push('/discounts')` guarded by dirty).
- `src/lib/discounts/format.ts` — (optional) add `fmtDiscountId(id)` = `disc_${padStart(5,'0')}` if reused; else inline in header. KISS: inline unless reused in list too — check, else inline.

## Implementation steps
1. Create `discount-save-bar.tsx`: sticky bar (`sticky bottom-0 z-[5]`, `border-t`, surface bg, `px-6 py-3 flex items-center justify-between`, subtle top shadow). Left = status span; right = Cancel ghost + Save primary (reuse Save button style from header: brand bg, Check/Loader2 icon).
2. Edit `discount-form-header.tsx`: extend props (`id`, `createdAt`, `tenantName`); add `<div>` meta row beneath `<h1>` block — edit branch (ID chip + dot + Created date via `fmtDate`) and new branch (`New code · {tenantName}`); apply mono style to ID chip. Refine Delete button: add `border` + hover danger colors.
3. Edit `discount-form.tsx`:
   - Pass `id={discount?.id}`, `createdAt={discount?.createdAt}`, `tenantName={tenantName}` to header.
   - Add `handleCancel` = `() => { if (dirty && !window.confirm('You have unsaved changes. Leave page?')) return; router.push('/discounts') }` (or extract back-guard into one fn shared by header back + cancel — DRY: lift guard into form, pass `onBack` to header instead of header owning router). **Preferred:** lift navigation guard into `discount-form.tsx`, pass `onBack` callback to header (removes `useRouter` from header). Keeps single source of nav-guard truth.
   - Render `<DiscountSaveBar dirty={dirty} isNew={isNew} saving={saving} onCancel={handleCancel} onSave={handleSave} />` as final child after the grid body div.
4. Typecheck / build.

## Todo list
- [ ] `discount-save-bar.tsx`
- [ ] header: meta row (edit + new) + Delete refine + accept `onBack`/`id`/`createdAt`/`tenantName`
- [ ] form: thread props, `handleCancel`/back-guard lift, render save bar
- [ ] build/typecheck clean

## Success criteria
- Edit page: meta row shows `ID disc_00009 · Created <date>`. New page: `New code · <tenant>`.
- Sticky bottom bar visible; status flips `Up to date` ↔ `Unsaved changes` with draft.
- Bottom Save disabled when clean (edit); enabled when dirty or new. Cancel guards unsaved changes.
- Delete button top-right with border, danger on hover.
- Build/typecheck clean; existing tests pass.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sticky bar overlaps form content / not actually sticky (no scroll container height) | Med | Med | Root must be `flex-col` with body scrollable; bar `sticky bottom-0`. Verify dashboard layout gives form full-height container. If not sticky, fall back to fixed within content area. |
| Two Save buttons (top dirty bar + bottom bar) confuse users | Low | Low | Intentional per design; both call same `handleSave`. Acceptable. |
| Lifting nav-guard breaks header back button | Low | Med | Pass `onBack` callback; header calls it instead of `router.push`. Test back button still warns when dirty. |
| `discount.id` numeric vs string for padStart | Low | Low | `String(id).padStart(5,'0')` handles both. |
| Date `createdAt` undefined on new | Low | Low | New branch doesn't render Created; guard on `isNew`. |

## Backwards compatibility
- Header gains optional props — `new/page.tsx` and `[id]/page.tsx` unaffected beyond passing them (Phase 01 already wires `tenantName`). No API/schema change.
- Lifting `useRouter` from header → form: behavior identical (guarded back nav). No external callers of header besides `discount-form.tsx`.

## Test matrix
- **Unit:** status-text logic (dirty/new/clean) if extracted; `fmtDiscountId` if added.
- **RTL (follow existing pattern in `src/__tests__/integration/discounts/`):** bottom bar shows "Unsaved changes" after field edit; Save disabled when clean; Cancel triggers guard when dirty.
- **Manual:** edit → meta row correct; dirty → both bars update; cancel with unsaved → confirm prompt; delete button hover state.

## Security considerations
- None new — presentational. `id`/`createdAt`/`tenantName` already server-sourced and access-scoped (Phase 01 / existing page). No client-trusted data introduced.

## Next steps
- After both phases: tester runs `npm test` for discounts; code-reviewer reviews diff (focus: sticky layout, sen/RM preview correctness, nav-guard lift). docs-manager: update `docs/architecture/F33-discounts.md` if it documents the form surface.

## Unresolved questions
1. **Sticky context:** does the dashboard route layout give the form a full-height scroll container so `sticky bottom-0` pins to viewport bottom? If the page scrolls at body level instead, the bar pins to content bottom (still acceptable, less ideal). Verify against `(dashboard)/layout.tsx` during implementation; adjust to `fixed` only if sticky fails.
2. **Top dirty bar:** brief item 6 implied removing it; design keeps it. Plan keeps both per design. Confirm with design owner if a single-bar variant is preferred — low-risk either way.
