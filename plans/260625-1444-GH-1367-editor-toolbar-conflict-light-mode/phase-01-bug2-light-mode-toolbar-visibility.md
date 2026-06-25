# Phase 01 — Bug 2: Light-mode block action toolbar visibility

## Context Links
- Issue: #1367 (Bug 2, AC3/AC4/AC5)
- File: `src/components/editor/BlockActionBar.tsx`
- Render site: `src/components/editor/PreviewFrame.tsx:1364` (parent doc, under ThemeProvider)
- Theme mechanism: `src/providers/theme-provider.tsx` → toggles `.dark` on `document.documentElement`
- CSS vars: `src/app/globals.css` (`--editor-surface-elevated`: light `#FFFFFF`, dark `#1E293B`)

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Block action toolbar (drag, move, duplicate, AI, delete) is near-invisible in light mode: container resolves to white via `--editor-surface-elevated`, icons hardcode `slate-300/400`, hover is `bg-white/10`. All fail on white. Make the floating toolbar dark in BOTH themes so existing light-on-dark icon colors stay valid.

## Key Insights
- BlockActionBar renders in the **parent** document, NOT the iframe. Parent has `.dark` on `<html>`. → Tailwind `dark:` variant works. No need for `html:not(.dark)` overrides or a new iframe-injected style.
- A floating action toolbar that is **dark in both themes** is the minimal, DRY fix: the icons (`slate-300/400`, `amber-300`, `red-400`) and hover (`bg-white/10`, `bg-red-500/15`) ALREADY pass contrast on a dark surface. So fixing only the **background** resolves AC3/AC4/AC5 with one change and zero icon edits.
- This avoids per-icon `dark:` duplication (DRY) and avoids a new CSS var (YAGNI). The issue's preferred option is exactly `bg-slate-900/95 dark:bg-[var(--editor-surface-elevated)]/95`.

## Requirements
**Functional**
- Light mode: toolbar background dark, all 5 icons clearly visible.
- Dark mode: unchanged appearance (still uses `--editor-surface-elevated` = `#1E293B`).
- Hover feedback visible in both themes.

**Non-functional**
- Icon-vs-background contrast ≥ 4.5:1 (WCAG AA). `slate-300 #CBD5E1` on `slate-900 #0F172A` ≈ 11:1 — passes. `amber-300` and `red-400` on slate-900 also pass.
- No new CSS variable; no global stylesheet edit.

## Architecture
Single-component CSS change. Data flow unaffected — `position`, props, message plumbing untouched.

```
BlockActionBar container className:
  before: bg-[var(--editor-surface-elevated)]/95   (white in light → invisible)
  after:  bg-slate-900/95 dark:bg-[var(--editor-surface-elevated)]/95
          border-white/10 → border-slate-700/60 dark:border-white/10  (border visible on both)
```
Icons + hover + dividers stay as-is (already valid on dark bg in both themes).

## Related Code Files
**Modify**
- `src/components/editor/BlockActionBar.tsx`
  - Line 58 container: swap bg + border to dark-in-both-themes form.
  - Verify divider `bg-white/10` (lines 76/100/113) reads on slate-900 — it does (white/10 on dark). No change.
  - `ACTION_BTN` hover `hover:bg-white/10` (line 26): valid on dark bg → no change.

**Create / Delete:** none.

## Implementation Steps
1. Edit line 58 container className:
   - `bg-[var(--editor-surface-elevated)]/95` → `bg-slate-900/95 dark:bg-[var(--editor-surface-elevated)]/95`
   - `border border-white/10` → `border border-slate-700/60 dark:border-white/10`
2. Leave ACTION_BTN, all icon colors, dividers, hover classes untouched (they already render correctly on a dark surface).
3. Compile check: `npx tsc --noEmit` (or project build) — pure className change, expect clean.
4. Manual visual check both themes: light shows dark pill w/ visible icons; dark identical to before.

## Todo List
- [ ] 01-1 Swap container bg to `bg-slate-900/95 dark:bg-[var(--editor-surface-elevated)]/95`
- [ ] 01-2 Swap container border to `border-slate-700/60 dark:border-white/10`
- [ ] 01-3 Confirm no icon/hover/divider edits needed (light-on-dark already valid)
- [ ] 01-4 Compile check passes
- [ ] 01-5 Visual smoke test light + dark (Logo Cloud section)

## Success Criteria
- AC3: light mode — 5 icons visible, contrast ≥ 4.5:1. ✔ via dark bg.
- AC4: dark mode — pixel-identical to pre-fix (still `--editor-surface-elevated`). ✔
- AC5: hover bg/text feedback visible both themes. ✔
- `npx tsc --noEmit` clean.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `dark:` variant doesn't apply (wrong context) | Low | High | VERIFIED: renders in parent doc with `.dark` on html. If somehow it failed, fallback = `bg-slate-900/95` unconditionally (toolbar dark in both themes is acceptable per AC). |
| amber/red icons low-contrast on slate-900 | Low | Low | Both pass AA on slate-900; no change. If flagged, bump to `amber-400`/`red-500`. |
| Border invisible on white page behind toolbar | Low | Low | `border-slate-700/60` + existing `shadow-2xl` separate it from page. |

## Security Considerations
None — presentational change only.

## Next Steps
Independent of phase 02. Proceed to phase 02 (Bug 1) next; both feed phase 03 tests (TC-EDIT-06/07/08).
