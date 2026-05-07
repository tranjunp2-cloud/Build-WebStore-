# Phase 06 — Docs + CHANGELOG + QA TC

**Status:** pending
**Effort:** 0.25h
**Owns:** `docs/CHANGELOG.md`, `docs/qa/F05-ai-editor-testcases.md`, `docs/architecture/F05-ai-editor.md` (if surface change)

## Overview

Final docs sweep per `.claude/rules/documentation-management.md`:
- Add new TC-IDs to F05 QA doc
- CHANGELOG entry referencing #864
- Architecture doc mention only if Page Library ↔ Menu coupling is now load-bearing for the F05 architecture

## Files to modify

- `docs/qa/F05-ai-editor-testcases.md`
- `docs/CHANGELOG.md`
- `docs/architecture/F05-ai-editor.md` — only if delta described below applies

## Implementation steps

### 1. QA TC additions — `docs/qa/F05-ai-editor-testcases.md`

Append under "US-02: Page Manager":

| TC-ID | Story/AC | Type | Test name | Steps | Expected | Priority | Status |
|-------|----------|------|-----------|-------|----------|----------|--------|
| **TC-F05-02-13** | `US-02/UX` | `Logic` | `collectMenuPageIds` collects linked page IDs from nav tree | 1. Build `NavLinkItem[]` w/ nested children + mixed types. 2. Call `collectMenuPageIds(links, pages)`. | Returns Set with IDs of pages whose slug appears as `type:'page'` link. Homepage always included. | High | [ ] |
| **TC-F05-02-14** | `US-02/UX` | `UI` | Page Library header + tooltip + no search | 1. Open Pages panel. 2. Hover Live/Draft badge. | Header reads "Page Library" + micro-copy. Search input absent. Tooltip shows correct copy per status. | High | [ ] |
| **TC-F05-02-15** | `US-02/Logic` | `State` | Live ↔ Draft transitions follow menu linkage | 1. Publish site + page. 2. Add page to menu → Live. 3. Remove page from menu → Draft. | Badge updates within next render. | Blocker | [ ] |
| **TC-F05-02-16** | `US-02/UX` | `UI` | First-time coach marks 2-step flow | 1. Clear `localStorage`. 2. Open editor. 3. Walk through "Tiếp theo" / "Hoàn tất". 4. Reload. | Step 1 → Step 2 (right panel auto-switches to Menu) → flag persists → no re-show. Skip works at any step. | Medium | [ ] |

### 2. CHANGELOG entry — `docs/CHANGELOG.md`

Under the "Unreleased" section (or current sprint header):

```markdown
### Changed
- `editor`: rename "Page Manager" panel to "Page Library", add micro-copy explaining Menu Settings linkage (#864)
- `editor`: status badge now requires page to be linked from menu structure to display "Live" (#864)

### Added
- `editor`: hover tooltip on page status badge clarifies Live/Draft semantics (#864)
- `editor`: first-time 2-step coach marks introduce Page Library → Menu Settings flow (#864)

### Removed
- `editor`: search input in Page Library panel (was unused given 100-page cap, #864)
```

### 3. Architecture doc tweak — `docs/architecture/F05-ai-editor.md`

Skip if file does not describe page-vs-menu coupling. Otherwise add ≤5 lines:

> Page status display is derived from `(page.status, site.status, menuPageIds)`. The `menuPageIds` set is computed by `src/lib/menu-page-links.ts::collectMenuPageIds(headerBlock.links, pages)`. Editing menu links via `NavigationEditor` re-derives the set on next render, automatically flipping affected page badges between Live/Draft.

### 4. plan.md status

Update `plan.md` frontmatter `status: completed` and tick all phase rows in the table:

```bash
ck plan check 06  # if ck CLI available; else edit table directly
```

## Acceptance criteria

- [ ] 4 new TCs in F05 QA doc with valid IDs and proper table formatting
- [ ] CHANGELOG entries reference #864
- [ ] Architecture mention added only if it makes the doc more useful (avoid noise)
- [ ] `plan.md` reflects final status

## Risk

Low. Documentation only.
