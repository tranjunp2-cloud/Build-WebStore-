---
title: "GH-2107 block settings sidebar: lucide icon, spacing slider, variant chips"
issue: https://github.com/primeproduction/ech-prime-web-v2/issues/2107
branch: fix/F01-2107-block-settings-sidebar-ui (base: staging)
status: implemented
priority: P2
---

# GH-2107 — Block Settings sidebar UI fixes

Verified against `staging @ c46bd887f`. Main file `src/components/editor/SettingsPanel.tsx` (3089 LOC) + 2 new small components.

## Findings (verified in code)

| # | Problem | Location |
|---|---|---|
| 1 | Header shows emoji `meta.icon`; left panel uses lucide `BLOCK_ICONS` | `SettingsPanel.tsx:202-205, 1970`; `BlockLibraryPanel.tsx:115, 229` |
| 2a | Spacing slider: no fill, thumb 11px, dark track `#0B1120` = editor bg (invisible) | `globals.css:82,111` |
| 2b | **4 duplicated "Layout & Spacing" sections (8 sliders)**: generic `:1992-2036`, announcement-bar `:2355-2395`, feature-comparison `:2595-2635`, pricing `:2785-2825` | `SettingsPanel.tsx` |
| 2c | Sliders save only on `onPointerUp` → keyboard edits lost (all 8) | same |
| 2d | `Layout & Spacing` / `Top Spacing` / `Bottom Spacing` hardcoded EN (×4) | same |
| 2e | `labelCls`/`sectionCls` dark-only classes (rescued by `.editor-shell` remap) | `SettingsPanel.tsx:135, 141` |
| 3 | Variant chips hardcode blue (not remapped; DS primary = teal); 3 styles; no `aria-pressed`/focus ring | block `:1979-1987`, nav `:1414-1424`, footer `:1567-1577`, color mode `:705-709` |

## Screenshots
Img 1 = actual bug (emoji header). Img 2/3 = **target look** for slider (teal fill, ~16px thumb, visible track both modes; matches prototype `docs/design/ai-builder/editor-v2.dc.html:272-273`).

## Approach (KISS)
1. **`BlockSpacingControls`** (new `src/components/editor/settings-block-spacing-controls.tsx`): renders title + Top/Bottom sliders. Props: `top, bottom, onTopChange, onBottomChange, onCommit(field, value)`, `className?` (section wrapper differs: `sectionCls` vs `mt-4`). Replaces all **4** copies → fixes 2a-2d everywhere at once.
   - Slider: keep custom styling (token-controlled; native `accent-color` rejected — no `color-scheme` set in editor, native track color uncontrollable in dark + differs per browser). Fill via inline `background: linear-gradient(to right, hsl(var(--primary)) p%, var(--editor-slider-track) p%)` on the track; thumb 14px; track 6px.
   - Commit on `pointerup`, `keyup` (Arrow/Home/End/PageUp/PageDown), `blur` if value changed.
2. **Dark `--editor-slider-track`** → visible value (proposed `#334155`). Only consumers are these 8 sliders (verified).
3. **`VariantChip`** (new `src/components/editor/settings-variant-chip.tsx`): `<button type="button" aria-pressed>`.
   - Idle: transparent bg + `border-[var(--editor-border)]`, `text-[var(--editor-text-muted)]`, `hover:bg-[var(--editor-overlay-hover)] hover:text-[var(--editor-text)]` (idle transparent so hover is actually visible — `overlay-bg` .04 vs `overlay-hover` .06 would be invisible).
   - Active: `border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)]`; text = `--editor-text` in light, `hsl(var(--primary))` in dark (light primary `#00D3D4` on white ≈ 1.9:1 contrast — fails).
   - `focus-visible:ring-2 ring-[hsl(var(--ring))]`. One size `rounded-lg px-3 py-1.5 text-xs`. Apply to 4 call sites.
4. **Header icon**: `getBlockInfo` → `Icon: BLOCK_ICONS[type] ?? FALLBACK_BLOCK_ICON` (only consumer: `:1970`). Tile `h-8 w-8 rounded-lg` token colors.
5. **Tokens**: `labelCls` → `text-[var(--editor-text-muted)]`; `sectionCls` → `border-[var(--editor-border)]`. Same computed values as current remap → no visual shift.
6. **i18n** new keys `editor.settings.layoutSpacing|topSpacing|bottomSpacing` (en + ms; verified not existing).

## Out of scope
- New `BLOCK_ICONS` entries (navigation/footer/faq… keep fallback, same as left panel).
- Subtitle raw slug `[hero]` (`:1943`, visible in Img 1) → follow-up unless PO wants it here.
- Other hardcoded blue in sidebar (input focus borders, announcement toggle `:2230`, logo upload) → follow-up.
- Studio `generation-blocks-tab.tsx:41` emoji.
- Other `type="range"` outside editor: storefront `src/blocks/products-grid/filters/PriceRangeFilter.tsx` (follows site theme) and Studio QA tools `src/app/studio/qa/**` (internal). The 8 sliders in `SettingsPanel.tsx` are the only ones in the editor (verified by grep).
- Spacing logic unchanged: slider shows 32px when unset but renderer default is `--block-spacing-default` (32px desktop / 24px mobile) and first block under nav uses nav height (`SiteRenderer.tsx:544-547`). Display-only mismatch → follow-up if wanted.

## Implementation notes (deviations from plan)
- Slider CSS lives in `globals.css` as `.editor-range` (readable) instead of long Tailwind arbitrary classes.
- `VariantChip` applied to **5** sites, not 4: also WhatsApp position (`bottom-right/left`) chip — same blue pattern inside the Block tab.
- Panel test file named `settings-panel-block-settings-gh2107.test.tsx` (covers TC-01/02/05/10/11/12).
- Code review fix (HIGH): spacing save skip now compares against the value stored on the block (`savedTop/savedBottom` props), not a focus-reset ref — Safari does not focus range inputs on click, so the ref went stale and a drag could be silently not saved. Regression test TC-GH2107-14 (verified it fails on the old logic).
- Code review (LOW, fixed): WebKit fill edge offset by half the thumb (`--fill-ratio` + calc) so it meets the thumb center.
- Code review (LOW, not fixed): light-mode thumb/icon teal #00D3D4 on white ≈1.7:1 (brand primary, cosmetic); pre-existing spacing sync effect not keyed on blockIndex (harmless now, defaults equal).
- Real-editor check (localhost, site 2914, dark + light): header icon, spacing slider (fill, keyboard save persists after reselect), variant chips (Block/Menu/Global) OK. Found Tailwind preflight is OFF → `border` needs `border-solid`; added to VariantChip (idle border was invisible).
- Found (pre-existing, NOT changed yet): `sectionCls` `border-t` has no border-style → section divider is 0px in BOTH modes (never rendered). Out of scope for GH-2107 (decided by user); left as is.
- Visual check: static render of the real `.editor-range` CSS + tokens in both modes matches Img 2/3.

## Phases
- [phase-01-implementation.md](phase-01-implementation.md)
- [phase-02-tests-and-qa-docs.md](phase-02-tests-and-qa-docs.md)

## Constraints
No schema / env change. Branch → PR to `staging`, `Relates to #2107` (never `Closes`). Commit: `fix(editor): align block settings icons, spacing slider and variant chips`. User reviews diff before commit.
