# Phase 02 — Tests & QA docs

**Priority:** P2 · **Status:** done · Depends on: phase 01

## Files
- Create `src/__tests__/unit/editor/settings-variant-chip.test.tsx`
- Create `src/__tests__/unit/editor/settings-block-spacing-controls.test.tsx`
- Create `src/__tests__/unit/editor/settings-panel-block-header-icon.test.tsx`
- **Modify** `src/__tests__/unit/navigation/settings-panel-variant-picker.test.tsx` — lines 125-148 assert `bg-blue-500/10`; switch to `aria-pressed` (behavior, not color class). Keep TC-NAV IDs.
- Modify `docs/qa/F05-ai-editor-testcases.md` — new section `### GH-2107: Block Settings sidebar UI`

Pattern: `settings-panel-variant-picker.test.tsx` (registry mock, `I18nProvider`, AAA). Import from source; no re-implemented logic.

## Test cases
| TC-ID | Type | Scenario | Expected |
|---|---|---|---|
| TC-GH2107-01 | Unit | Block header for `hero` | lucide svg rendered, no `meta.icon` emoji text |
| TC-GH2107-02 | Unit | Block header for unmapped type | fallback icon rendered |
| TC-GH2107-03 | Unit | VariantChip active | `aria-pressed="true"`, `type="button"`, no `blue-` class |
| TC-GH2107-04 | Unit | VariantChip idle click | `onClick` called, `aria-pressed="false"` |
| TC-GH2107-05 | Unit | Block variant switcher in SettingsPanel | click calls `onBlockFieldChange(idx,'variant',v)`; active chip pressed |
| TC-GH2107-06 | Unit | Spacing slider pointerup | `onCommit('paddingTop', v)` once |
| TC-GH2107-07 | Unit | Spacing slider ArrowRight + keyup | `onCommit` with value+step |
| TC-GH2107-08 | Unit | Spacing slider blur without change | `onCommit` not called |
| TC-GH2107-09 | Unit | Fill | `--fill` style matches pct of value |
| TC-GH2107-10 | Unit | Spacing labels `ms` locale | Malay labels rendered |
| TC-GH2107-11 | Unit | `it.each` pricing / feature-comparison / announcement-bar in SettingsPanel | spacing controls rendered once per block type (covers the 3 non-generic copies); commit writes `blockSpacing` |
| TC-GH2107-12 | Unit | Announcement bar without `blockSpacing` | slider shows default from `paddingY` (or 12), not 32 — existing default logic preserved |
| TC-GH2107-13 | Manual | Light/dark: header tile, sliders (4 block types), chips (Block/Menu/Global) | matches Img 2/3 + DS, no invisible states |

## Steps
1. Write/update tests (AAA, top-level `vi.mock()`).
2. `npx vitest run src/__tests__/unit/editor src/__tests__/unit/navigation` — all green.
3. QA doc section + traceability.

## Todo
- [x] 3 new test files
- [x] update variant-picker test assertions
- [x] all editor/navigation tests pass
- [x] QA doc section

## Success criteria
All tests pass; every test references a TC-ID present in the QA doc.
