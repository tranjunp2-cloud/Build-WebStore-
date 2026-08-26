# Phase 01 — Fix footer `mega` variant mismatch

**Priority:** P0 (trivial unblock) | **Effort:** 5 min | **Status:** pending

## Context Links

- Research: `research/researcher-02-quality-issues-and-levers.md` §1 (Drift Findings Breakdown)
- Drift report: `plans/260419-2022-GH-1-harness-template-block-sync-flow/reports/fullstack-02-drift-validator.md`
- Grep evidence: 56 presets dung `variant: 'mega'`, registry chi enum `mega-footer`

## Overview

280/800 drift findings (35%) chi vi preset dung `variant: 'mega'` nhung `src/collections/Pages.ts:225` va footer registry chi accept `mega-footer`. Silent fallback -> render basic footer thay vi mega. Fix 5 phut boc 280 finding.

## Key Insights

- Researcher-02 §1: "footer 280 -- Preset: `variant: 'mega'` vs registry: `mega-footer` -- CRITICAL renders basic footer"
- Grep xac nhan: 56 matches `variant: 'mega'` trong `template-presets-batch{1,2,3}.ts`; 0 matches `variant: 'mega-footer'`
- 2 fix options:
  - (A) Rename preset value `mega` -> `mega-footer` (batch edit 56 occurrences)
  - (B) Them alias `mega` o registry + Pages.ts select options
- Chon (A): self-documenting, source-of-truth la registry, khong them special case

## Requirements

**Functional:**
- All 56 preset refs doi thanh `'mega-footer'`
- Pages.ts select options khong doi (da co `mega-footer`)
- Harness re-run: drift findings cho footer giam tu 280 -> 0

**Non-functional:**
- Zero behavior regression: fixtures van compose OK (390/390)
- Zero schema change

## Architecture

```
template-presets-batch1.ts  ─┐
template-presets-batch2.ts  ─┼─> variant: 'mega-footer'  ─> footerMeta.variants ─> render MegaFooter component
template-presets-batch3.ts  ─┘
```

Trigger: grep `variant: 'mega'` + replace_all. Khong can codemod; edit truc tiep.

## Related Code Files

**Modify:**
- `src/lib/ai/template-presets-batch1.ts` (~30 occurrences)
- `src/lib/ai/template-presets-batch2.ts` (~20 occurrences)
- `src/lib/ai/template-presets-batch3.ts` (~6 occurrences)

**Read for context:**
- `src/collections/Pages.ts:225` (mega-footer enum source)
- `src/blocks/footer/config.ts` (variant list)
- `scripts/test-harness/assertions/variant-whitelist.ts` (guard logic)

**Create/Delete:** None.

## Implementation Steps

1. Grep-confirm total count: `rg "variant: 'mega'" src/lib/ai/template-presets-batch*.ts -c`
2. Trong moi file dung Edit voi `replace_all: true` cho chuoi `blockType: 'footer', variant: 'mega'` -> `blockType: 'footer', variant: 'mega-footer'`
3. Chay `npm run harness:gen` + `drift:check` — verify footer findings giam 280 -> 0
4. Spot-check 1 compose output (e.g. restaurant-warung-kampung) render `<Footer variant="mega-footer" />`
5. Commit: `fix(template): align footer variant to registered mega-footer`

## Todo List

- [ ] Grep `variant: 'mega'` count
- [ ] Edit batch1.ts (replace_all)
- [ ] Edit batch2.ts (replace_all)
- [ ] Edit batch3.ts (replace_all)
- [ ] Run `npm run harness:gen`
- [ ] Run drift check — verify 280 fewer findings
- [ ] Commit + PR

## Success Criteria

- `rg "variant: 'mega'\\b" src/lib/ai/template-presets-batch*.ts` -> 0 matches
- Drift report: `unknown-variant footer@mega` = 0 findings
- All 390 fixtures compose OK (no new errors)

## Risk Assessment

- **Risk:** `mega` matches nhu `mega-menu` cho navigation blocks neu dung pattern sai. Mitigation: match chuoi `'footer', variant: 'mega'` co prefix blockType.
- **Risk:** Component render logic check `variant === 'mega'` hardcoded. Mitigation: grep `variant === 'mega'` trong `src/blocks/footer/` truoc khi sua; doi tuong ung neu can.

## Security Considerations

N/A — pure data rename, khong lien quan auth / user input.

## Next Steps

- Phase 02 (unknown blocks) doc lap, co the parallel.
- Phase 05 (CI gate) can phase 01 done de baseline drift giam truoc.
