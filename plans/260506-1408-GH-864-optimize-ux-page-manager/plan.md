---
title: "GH-864 — Optimize UX for Page Library and Menu Navigation Linkage"
description: "Rename Page Manager → Page Library, add micro-copy, remove search, contextual Live/Draft tooltip linked to menu structure, plus 2-step coach marks"
status: done
priority: P2
effort: 5h
branch: feat/864-optimize-ux-page-manager-menu-navigation
tags: [F05, ux, editor, onboarding, i18n]
created: 2026-05-06
---

## Context

GitHub Issue: #864 (label `F05`, assignee levietducprime)
Goal: Reduce confusion between left "Page Library" (internal editing) and right "Menu Settings" (public visibility). Help users understand the linkage between *creating a page* and *exposing it on the website*.

## Files in scope

| File | Role | Owner phase |
|------|------|-------------|
| `src/components/editor/PageManagerPanel.tsx` | Left panel UI (rename, micro-copy, remove search, tooltip on badge, coach-mark anchors) | P1, P2, P4 |
| `src/components/editor/SettingsPanel.tsx` | Right panel — anchor for coach mark step 2 | P4 |
| `src/app/(editor)/editor/[siteId]/page.tsx` | Editor shell — mount `EditorCoachMarks` overlay | P4 |
| `src/components/editor/EditorCoachMarks.tsx` | NEW — 2-step spotlight overlay (Radix Popover) | P4 |
| `src/lib/menu-page-links.ts` | NEW — pure helper `collectMenuPageIds(links)` | P2 |
| `src/i18n/locales/en.json` + `ms.json` | i18n keys for new copy | P1, P2, P4 |
| `src/__tests__/unit/editor/page-manager.test.tsx` | Update existing assertions for renamed title | P5 |
| `src/__tests__/unit/editor/f05-save-and-nav.test.ts` | Update local mirror of `getStatusBadge` | P5 |
| `src/__tests__/unit/editor/menu-page-links.test.ts` | NEW — pure helper unit tests | P5 |
| `src/__tests__/unit/editor/editor-coach-marks.test.tsx` | NEW — coach-mark behaviour | P5 |
| `docs/qa/F05-ai-editor-testcases.md` | Add TC-F05-02-13..16 for new features | P6 |
| `docs/CHANGELOG.md` | Entry for #864 | P6 |

## Phases

| # | Phase | Status | Effort | Blockers |
|---|-------|--------|--------|----------|
| 01 | Panel header + micro-copy + remove search | done | 0.5h | — |
| 02 | Status badge tooltip + menu-link logic | done | 1.5h | P1 (touches same file) |
| 03 | i18n keys finalize (en + ms) | done | 0.25h | P1, P2, P4 |
| 04 | Coach marks (2-step Radix Popover overlay) | done | 2h | P1 (anchor selectors) |
| 05 | Tests (unit + RTL) | done | 0.75h | P1–P4 |
| 06 | QA TC + CHANGELOG + architecture doc tweak | done | 0.25h | P5 |

Total: ~5h. Phases 1, 2, 4 sequential (touch `PageManagerPanel.tsx`). Phase 3 can interleave. Phase 5–6 strictly after.

## High-level data flow

```
PageManagerPanel
 ├─ reads `pages` from useEditorStore
 ├─ NEW: receives `menuLinks` prop (resolved by editor page from headerBlock.links)
 │      → collectMenuPageIds(menuLinks) returns Set<string>
 ├─ getStatusBadge(page, siteStatus, menuPageIds) → {label, tone, tooltipKey}
 │      Live  ⇔ page.status==='published' AND siteStatus==='published' AND menuPageIds.has(page.id)
 │      Draft ⇔ otherwise (new, not-in-menu, removed-from-menu)
 └─ Tooltip wraps badge → renders pm.tooltipLive / pm.tooltipDraft

EditorPage (siteId)
 ├─ derives `menuLinks` (already done in SettingsPanel via headerBlock.links / nav block fallback)
 ├─ passes `menuLinks` down to PageManagerPanel
 └─ mounts <EditorCoachMarks /> conditionally on first visit
        ├─ reads localStorage key `editor:coach-marks:v1:seen`
        ├─ Step 1 → Popover anchored to data-coach="page-library" (left col)
        ├─ Step 2 → Popover anchored to data-coach="menu-settings" (right col, menu tab)
        └─ writes `seen=true` after dismiss/finish
```

## Naming decisions

- Panel title: `t.editor.pageManagerPanel.title` value flips `"Page Manager"` → `"Page Library"` (en) / `"Thư viện trang"` reused via vi (project uses en + ms; vi flows through en). Component identifier `PageManagerPanel` and i18n key `pageManager*` UNCHANGED to keep diff minimal — only display strings change.
- Helper: `collectMenuPageIds(links: NavLinkItem[]): Set<string>` lives in `src/lib/menu-page-links.ts`. Uses `link.type==='page'` and matches `link.url` to `page.slug` via shared resolver (mirrors `normalizePageOptionUrl` already in `NavigationEditor.tsx`).
- Coach-mark storage key: `editor:coach-marks:v1:seen` (versioned so future overhaul can re-trigger).

## Risk + mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rename breaks i18n value lookup elsewhere | Low | Medium | Component key unchanged; only string value updates. Grep for hardcoded "Page Manager" — only `PageManagerPanel` JSX uses it. |
| `getStatusBadge` signature change breaks tests | High | Low | Phase 5 updates the local mirror in `f05-save-and-nav.test.ts` (pure-function copy already noted in test file). |
| Menu link resolution edge cases (external URL with same slug, homepage) | Medium | Medium | Skip system slugs (`404`, homepage handled by `isHomepage`). Match on `type==='page'` only — never match external links. Unit tests cover edge cases. |
| Coach marks block keyboard / a11y | Medium | High | Use Radix Popover (built-in focus trap + ESC). Provide explicit "Skip" button. Don't render if user already saw v1. |
| Coach mark anchor not yet rendered (SSR / initial loading) | Medium | Medium | Mount `EditorCoachMarks` only after `pages` loaded AND right panel mounted. Use `useEffect` + `setTimeout(0)` defer. |
| Removing search regresses workflows for users with >20 pages | Low | Low | F05 page cap = 100 (TC-F05-02-09). Scrollable list sufficient. Issue explicitly requests removal. |
| siteStatus flip from `published` to `draft` while menu link exists → stale "Live" | Low | Low | Existing logic already gates on `siteStatus==='published'`. Adding menu check makes it stricter, not looser. |

## Backwards compatibility

- No DB schema changes. No API changes.
- Existing `PageManagerPanel` consumers (only `editor/[siteId]/page.tsx`) pass new optional `menuLinks` prop — defaults to `[]` → behaves as if no page is in menu → all pages show "Draft". This is the *intended* stricter semantic.
- localStorage key `editor:coach-marks:v1:seen` is additive; absence = first visit.

## Test matrix

| Layer | Target | Cases |
|-------|--------|-------|
| Unit (pure) | `collectMenuPageIds` | empty, flat, nested children, mixed page+external, duplicates |
| Unit (pure) | `getStatusBadge` | live (all 3 conds), draft (page-not-published / site-not-published / not-in-menu / removed-from-menu) |
| RTL | `PageManagerPanel` | renders new title "Page Library" + micro-copy; no search input present; tooltip text renders on badge hover |
| RTL | `EditorCoachMarks` | first visit shows step 1 → next → step 2 → finish writes localStorage; subsequent mount renders nothing; "Skip" works |
| i18n | en + ms | all new keys present, no missing-key warnings |

E2E intentionally skipped: visual / DOM-only changes already covered by RTL + i18n key lint.

## Rollback plan

Single PR, single feature flag NOT required. To revert: `git revert` the merge commit; localStorage key is benign (orphaned data harmless). If coach-marks cause production noise, ship a follow-up flipping `editor:coach-marks:v1:seen` to always-`true` in code, then revert.

## Success criteria

- [ ] Left panel header reads "Page Library" with micro-copy below
- [ ] Search input removed from left panel
- [ ] Hovering Live/Draft badge shows tooltip with the issue's exact wording
- [ ] Page badge becomes "Live" only when published+site-published+linked-in-menu
- [ ] Removing a page from Menu Settings flips badge to "Draft" within next render cycle
- [ ] First-time visitor to editor sees 2-step coach mark, can dismiss with Skip or finish to step 2
- [ ] Re-visit after dismissal: no coach mark
- [ ] All new + updated unit tests green; existing tests still green
- [ ] No new TS / lint errors; bundle delta negligible (<5 kB gzip)

## Unresolved questions

1. Vietnamese copy: project ships `en.json` + `ms.json`. Issue copy is in Vietnamese — does this site default to `vi` via `en.json` (current pattern) OR do we need a `vi.json`? Assumption for plan: keep current pattern, put Vietnamese strings into the user-facing slots already used (i.e., the existing `en.json` already contains Vietnamese-ish UX in some places — confirm with PM before merge).
2. Coach mark should re-trigger when user clears site or switches to a brand-new site? Plan keeps it global (per-user, per-browser). Confirm.
3. Should Step 2 auto-switch the right panel to the "Menu" tab (`activeTab='menu'`) so the spotlight has something to point at, or just point at the tab button itself? Plan: auto-switch to menu tab when entering Step 2; restore previous tab on dismissal.
