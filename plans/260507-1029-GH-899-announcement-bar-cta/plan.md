---
title: "GH-899 Announcement Bar CTA Link Integration & Content Configuration"
description: "Restore editability of announcement-bar (message, CTA link, dual-color gradient, padding) and align preview/runtime variants with editor."
status: completed
priority: P2
effort: 5h
branch: feat/F05-899-announcement-bar-cta
tags: [F05, announcement-bar, editor, settings-panel, blocks, bug]
created: 2026-05-07
completed: 2026-05-07
---

## Context

- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/899
- Investigation: `plans/reports/investigate-260507-1029-GH-899-announcement-bar.md`
- Branch: `feat/F05-899-announcement-bar-cta`

## Problem (3 bugs)

1. **CTA missing from editor** — schema uses `linkText`/`linkUrl`; SettingsPanel generic CTA branch only handles `ctaLabel`/`ctaUrl`. `message` has no generic match either. Result: zero editable fields.
2. **Variant style mismatch** — `sections.ts:154` preview hardcodes solid bg ignoring variant; component gradient hardcodes Color 2 to `CSS_VARS.secondary` (no user control).
3. **Padding slider broken** — block in `FLOATING_BLOCK_TYPES` so `blockSpacing` ignored, but generic Layout & Spacing sliders still rendered → confusing/broken UX.

## Decisions (locked)

- D1: Keep `linkText`/`linkUrl` field names. Add dedicated `bt === 'announcement-bar'` section in SettingsPanel.
- D2: Padding Option B (full) — add internal `paddingY` schema field, component reads it; hide generic Layout & Spacing sliders for this block type.
- D3: CTA URL field supports toggle: external URL (text input) OR internal page (select from `pages` prop).
- D4: Add `backgroundColor2` for gradient Color 2.
- D5: Empty `linkText` (after trim) hides the link → no separate `ctaEnabled` toggle (simpler, satisfies AC3).

## Phases

| # | File | Status | Effort | Owner glob | Blockers |
|---|------|--------|--------|-----------|----------|
| 01 | [phase-01-schema-component.md](phase-01-schema-component.md) | completed | 1h | `src/blocks/announcement-bar/**` | none |
| 02 | [phase-02-settings-panel.md](phase-02-settings-panel.md) | completed | 1.5h | `src/components/editor/SettingsPanel.tsx` | 01 (schema fields) |
| 03 | [phase-03-preview-renderer.md](phase-03-preview-renderer.md) | completed | 0.5h | `src/app/api/preview/renderers/sections.ts` | 01 |
| 04 | [phase-04-demo-content.md](phase-04-demo-content.md) | completed | 0.25h | `src/lib/admin/block-preview-demo-content-part2.ts` | 01 |
| 05 | [phase-05-tests.md](phase-05-tests.md) | completed | 1.25h | `src/__tests__/unit/blocks/**` | 01-04 |
| 06 | [phase-06-qa-docs.md](phase-06-qa-docs.md) | completed | 0.5h | `docs/qa/F05-*`, `docs/CHANGELOG.md` | 05 |

## Execution order

01 → (02 ‖ 03 ‖ 04) parallel → 05 → 06

## Dependency graph

```
01 (schema+component, source of truth for fields)
   ├── 02 (SettingsPanel reads schema fields)
   ├── 03 (preview must match component variant logic)
   └── 04 (demo content uses new fields)
            └── 05 (tests verify all 4)
                  └── 06 (QA TC + changelog)
```

## File ownership (no overlap)

| Phase | Owns | Reads |
|-------|------|-------|
| 01 | `src/blocks/announcement-bar/config.ts`, `src/blocks/announcement-bar/index.tsx` | `src/blocks/types.ts`, `src/lib/theme/resolve.ts` |
| 02 | `src/components/editor/SettingsPanel.tsx` (additive only — new section) | phase-01 output |
| 03 | `src/app/api/preview/renderers/sections.ts` (lines 154-157) | phase-01 output |
| 04 | `src/lib/admin/block-preview-demo-content-part2.ts` (announcement-bar entry) | phase-01 output |
| 05 | `src/__tests__/unit/blocks/announcement-bar.test.tsx` (new), `src/__tests__/unit/blocks/new-blocks.test.ts` (extend) | all impl |
| 06 | `docs/qa/F05-ai-editor-testcases.md`, `docs/CHANGELOG.md` | none |

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Existing sites have announcement-bar blocks → adding required fields breaks runtime | Med | High | All new fields optional. Defaults preserve current behavior (`backgroundColor2` falls back to `CSS_VARS.secondary`, `paddingY` defaults to 12px = current `py-3`). |
| `linkUrl` toggle (external/internal) breaks existing string values | Med | Med | Store as plain string always; toggle is editor-only UX. Internal page select writes `/${slug}` to same `linkUrl` field. |
| SettingsPanel section duplicates generic CTA section visually | Low | Low | Place section gated by `bt === 'announcement-bar'`; generic CTA branch never matches (no `ctaLabel`). |
| Removing announcement-bar from FLOATING_BLOCK_TYPES → spacing wrapper breaks sticky positioning | High | High | KEEP in FLOATING_BLOCK_TYPES. Hide generic Layout sliders. Bar reads internal `paddingY` field on inner div only. |
| Padding range mismatch user expectation | Low | Low | Range 4-32px (default 12). Tooltip shows px value. |

## Backwards compatibility

- All schema additions: optional with defaults that match current visual output.
- Existing data with `backgroundColor` only → renders identically (Color 2 falls back to `CSS_VARS.secondary`).
- Existing data without `paddingY` → defaults to 12 (`py-3` equivalent).
- No data migration needed.

## Test matrix

| Layer | Coverage |
|-------|----------|
| Unit (component) | Variant render (gradient/solid/minimal), CTA shown/hidden by linkText, dismiss, paddingY applied, dual-color gradient |
| Unit (schema) | New optional fields parse, defaults applied |
| Unit (SettingsPanel) | Field write-through to onBlockFieldChange (deferred to existing patterns; minimal smoke) |
| Integration (preview) | sections.ts variant branches output expected HTML |
| Manual QA | AC1-AC5 from issue (per phase-06) |

## Rollback plan

Each phase is independent file-scope. To revert:
- 01: revert `src/blocks/announcement-bar/{config.ts,index.tsx}` — defaults restore current behavior.
- 02: remove the new `bt === 'announcement-bar'` block from SettingsPanel.
- 03: revert sections.ts:154-157 to single-line solid.
- 04: revert demo content file.
- Hard rollback: `git revert` the merge commit; no DB migration involved.

## Success criteria (measurable)

- AC1 ✔ Editor exposes textarea for `message` + input for `linkText` independently — verified by Playwright/manual.
- AC2 ✔ `<a href={linkUrl}>` renders with linkText; click navigates.
- AC3 ✔ `linkText.trim() === ''` → `<a>` not in DOM (unit test).
- AC4 ✔ Switching variant in editor → preview HTML and component output both reflect (gradient = `linear-gradient(...)`, solid = `background-color`, minimal = transparent + border).
- AC5 ✔ Layout & Spacing slider hidden for announcement-bar; new internal Padding slider 4-32px works on inner div.

## Unresolved questions

1. Internal page picker: reuse pattern from `NavigationEditor` (line 1531) or simpler native `<select>` over `pages` array? Default = native `<select>` for KISS unless QC requests parity.
2. `dismissible` toggle UX: render as switch/checkbox in new section? Investigation noted toggle pattern exists — confirm visual style with design.
3. Color picker component: which existing primitive? (Searched — likely `<input type="color">` already used in theme settings; phase-02 will scout exact pattern before implementation.)
