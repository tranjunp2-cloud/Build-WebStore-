# Phase 01 — Implementation

**Priority:** P2 · **Status:** done · Context: [plan.md](plan.md), issue #2107

## Files
- Create `src/components/editor/settings-variant-chip.tsx` (<60 LOC)
- Create `src/components/editor/settings-block-spacing-controls.tsx` (<120 LOC)
- Modify `src/components/editor/SettingsPanel.tsx` (net LOC should drop ~100)
- Modify `src/i18n/locales/en.json`, `ms.json` (`editor.settings`, near `variant`)
- Modify `src/app/globals.css` (dark `--editor-slider-track` only)

## Steps
1. **VariantChip** `({ active, onClick, children, className? })` — classes per plan §3. Light/dark active text via `text-[var(--editor-text)] dark:text-[hsl(var(--primary))]` (confirm `dark:` variant works inside editor — `.dark` on `<html>`).
2. Replace 4 call sites: color mode `:705-709` (pass `className="flex-1"`), nav `:1414-1424`, footer `:1567-1577`, block `:1979-1987`. Keep existing labels/handlers/filters unchanged.
3. **BlockSpacingControls** — internal `SpacingSlider` (same file, not exported):
   - fill pct = `(value-min)/(max-min)*100`, set as inline `style={{ '--fill': pct+'%' }}` and track bg `linear-gradient(to right, hsl(var(--primary)) var(--fill), var(--editor-slider-track) var(--fill))` (webkit track + `::-moz-range-progress` for Firefox).
   - thumb 14px primary, track 6px; label 11-12px `--editor-text-muted`, value 10px muted.
   - commit on pointerup / keyup (nav keys) / blur-if-changed; track last committed value in a ref to avoid duplicate `onBlockUpdate`.
   - `aria-label` = label; title uses `s.layoutSpacing`.
4. Replace 4 Layout & Spacing copies (`:1992-2036`, `:2355-2395`, `:2595-2635`, `:2785-2825`). `onCommit(field, val)` → existing `onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prev, [field]: val } })` — extract one local handler in SettingsPanel, reuse 4×.
5. `globals.css` dark `--editor-slider-track: #334155`.
6. Header: `getBlockInfo` returns `Icon`; `:1970` renders tile + `<info.Icon aria-hidden className="h-4 w-4" />` + label.
7. `labelCls` / `sectionCls` → token classes.
8. i18n en: `Layout & Spacing`, `Top spacing`, `Bottom spacing`; ms: `Susun atur & jarak`, `Jarak atas`, `Jarak bawah`.
9. `npx tsc --noEmit` + `npx eslint` on touched files.
10. Manual check light + dark: Block tab (Hero, Pricing, Feature comparison, Announcement bar), Menu tab (nav/footer variants), Global tab (color mode), SEO tab (sectionCls/labelCls).

## Todo
- [x] VariantChip + 5 call sites
- [x] BlockSpacingControls + 4 call sites + keyboard commit
- [x] dark slider track token
- [x] header lucide icon
- [x] labelCls / sectionCls tokens
- [x] i18n en/ms
- [x] typecheck + lint
- [x] manual light/dark in real editor (TC-GH2107-13) — automated via Playwright on localhost site 2914, dark + light, incl. pricing / feature-comparison / announcement-bar / whatsapp-button (blocks added to test site)

## Success criteria
- `grep "blue-" ` returns none at the 4 chip sites; no emoji in header; `grep 'type="range"' SettingsPanel.tsx` = 0 (all moved to component).
- Keyboard arrow on any spacing slider persists to block.
- Matches Img 2/3 look in both modes.

## Risks
- `labelCls`/`sectionCls` widely used → values equal current remap; verify SEO/Menu/Global tabs.
- `dark:` variant may not apply if editor theme toggles class on a non-root element → fallback: CSS rule `html:not(.dark) .editor-shell [data-variant-chip][aria-pressed=true]`.
- Section wrapper differs between the 4 copies (`sectionCls` vs `mt-4`) → pass via `className`.
