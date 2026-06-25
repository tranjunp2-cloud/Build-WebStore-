---
title: "Fix GH-1367 — Editor toolbar conflict + light-mode invisibility"
description: "Bug1: block-background click wrongly opens text toolbar. Bug2: block action toolbar invisible in light mode."
status: pending
priority: P1
effort: 4h
branch: fix/1367-editor-toolbar-conflict-light-mode
tags: [editor, bugfix, ux, light-mode, p1]
created: 2026-06-25
---

# GH-1367 — Editor toolbar conflict + light-mode visibility

2 P1 bugs in the page Editor. Root causes already verified (see task brief / issue #1367).

- **Bug 1** — Click on a block's background activates the TEXT edit toolbar instead of the BLOCK action toolbar. `validTags` includes `'DIV'`; `onTextClick` walks up to a wrapper DIV with text descendants and posts `TEXT_EDITING_STARTED` before the block-select `onClick` posts `BLOCK_CONTAINER_CLICKED` (registration order on `document`). File: `PreviewScripts.tsx`.
- **Bug 2** — Block action toolbar uses `bg-[var(--editor-surface-elevated)]` (= `#FFF` in light) with hardcoded `slate-300/400` icons → invisible on white. File: `BlockActionBar.tsx`.

## Key verified facts
- `BlockActionBar` renders in the **parent** document (`PreviewFrame.tsx:1364`), under `ThemeProvider` which toggles `.dark` on `document.documentElement`. → Tailwind `dark:` variant WORKS here. Bug 2 fix is pure CSS, low risk.
- `caretRangeFromPoint` / `caretPositionFromPoint` not used anywhere yet → safe to introduce for Bug 1 text-hit discrimination.
- Theme = `.dark` class (NOT data-attribute).

## Sequencing rationale
Bug 2 first (low-risk CSS, quick win, no behavioral coupling), then Bug 1 (selection logic, higher risk), then tests. Phases touch disjoint files except the shared test phase.

## Phases

| # | Phase | File(s) owned | Risk | Status |
|---|-------|--------------|------|--------|
| 01 | Bug 2 — light-mode toolbar visibility | `BlockActionBar.tsx` | Low | pending |
| 02 | Bug 1 — text-vs-block click discrimination | `PreviewScripts.tsx` | Med-High | pending |
| 03 | Tests — TC-EDIT-01..09 | `src/__tests__/unit/editor/*` + `docs/qa/F04-block-renderer.md` | Low | pending |

## Dependencies
- 01 → independent (start first).
- 02 → independent of 01 (different file). Can run parallel, but sequence after 01 to keep PR review simple.
- 03 → depends on 01 + 02 (tests the fixed behavior).

## Acceptance Criteria (issue)
- AC1: text node click → text toolbar; block background click → block toolbar.
- AC2: empty blocks (Logo Cloud, Image Gallery, Spacer, Divider) → any click → block toolbar.
- AC3: light mode toolbar visible, icon-vs-bg contrast ≥ 4.5:1 (WCAG AA).
- AC4: dark mode no regression (AI amber, delete red).
- AC5: hover states work both themes.

## Out of scope (YAGNI)
- No new global CSS var unless `dark:` approach proves insufficient (it does not — see phase-01).
- No refactor of the dual `onTextClick`/`onClick` registration architecture; minimal guard only.

## Reports
`plans/260625-1444-GH-1367-editor-toolbar-conflict-light-mode/reports/`
