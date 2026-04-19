# Phase 03 — Verify Wave 1 Success Metrics + Close Parent Plan

## Context

- Parent: [plan.md](plan.md)
- Parent plan: [`260417-0817-wave1-wix-detailed-plan/plan.md`](../260417-0817-wave1-wix-detailed-plan/plan.md) §Success Metrics
- Dependencies: Phase 01 (merge) + Phase 02 (dedup wire) complete

## Overview

- Date: 2026-04-18
- Description: Run 5 Wave 1 success metric checks. Produce completion report. Update parent plan status to `done`. Log residual gaps (A3.1 / A3.2 / C2.4 / C2.5 if any) into Wave 2 follow-up plan or parent plan "Open Questions".
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights

- Metrics were defined before the actual ship — metric #1 (distribution test) requires debug log which may not have shipped. Either implement `[composer] rotate=` log (10m) or relax metric to "distribution test in CI passes" (which already does if exported).
- Metrics should be CI-checkable where possible. Manual visual QA OK for metric #4 (hero overlay).

## Requirements

- 5 metric checks executed, each ✅/❌/❓ with evidence
- Completion report saved to `reports/wave1-completion-YYYYMMDD.md`
- Parent plan's `status` flipped to `done` (or `blocked-on-gap` with link here)
- Residual gap tickets created (GitHub issues) or documented

## Architecture

No code changes by default. If metric #1 requires debug log → 10m addition.

## Related code files

- `src/lib/ai/template-composer.ts` — metric #1 + #3 + #5
- `src/lib/theme/resolve.ts` — metric #2
- `src/lib/ai/media-injector.ts` — metric #3
- `src/blocks/hero/variants/*.tsx` — metric #4
- `src/__tests__/unit/ai/variant-rotation.test.ts` — metric #1
- staging logs (Vercel/Better Stack) — metrics #2, #5

## Implementation Steps

1. **Metric #1 — Variant distribution ≥ 80% pool utilization**:
   - Run `pnpm vitest src/__tests__/unit/ai/variant-rotation.test.ts`
   - Test should cover 10 seeds × 14 categories and assert ≥ 80% coverage per block with pool size ≥ 3
   - If test passes → ✅
   - If test absent → add (2h, defer if urgent) OR mark ❓ with ticket

2. **Metric #2 — 0 sites render fallback dark cyan/magenta**:
   - `grep "FALLBACK_COLOR_MODE" src/lib/theme/resolve.ts` → assert `'light'`
   - `grep "#0ea5e9\|#d946ef" src/lib/theme/resolve.ts` → assert 0 or only in explicit dark block
   - Bonus: tail staging logs for `[theme] fallback` — assert 0 hits in last 7d

3. **Metric #3 — `BLOCK_IMAGE_SPEC` ≥ 15 entries + 0 `placehold.co`**:
   - Count `BLOCK_IMAGE_SPEC` keys in `media-injector.ts` (read file, count top-level keys)
   - `grep -c "placehold.co" src/lib/ai/template-composer.ts` → assert 0

4. **Metric #4 — 11/11 hero variants pass overlay check**:
   - `for f in src/blocks/hero/variants/*.tsx; do grep -l "from-black\|bg-black/" "$f" || echo "MISSING: $f"; done`
   - Want 0 "MISSING" lines. If > 0 → gap ticket for Wave 2.

5. **Metric #5 — 0 "unknown variant" fallback**:
   - Staging logs (Better Stack) grep `unknown variant` last 7d → want 0
   - Alt: CI log assert `BROKEN_VARIANTS` covers all orphans (harder; defer to Wave 2 if gap).

6. **Write report** `reports/wave1-completion-260418.md` using template:
   ```md
   # Wave 1 Completion Report
   ## Metrics
   | # | Metric | Status | Evidence |
   ## Residual Gaps
   | Item | Severity | Ticket/Defer |
   ## Parent plan status change
   ```

7. **Update parent plan** `260417-0817-wave1-wix-detailed-plan/plan.md`:
   - If all 5 metrics ✅ → `status: done`, add changelog entry
   - If 1-2 ❓ (hero overlay, BROKEN_VARIANTS audit) → `status: done-with-followup`, log in Open Questions

8. **Update phase-03/04** of parent plan: set `Implementation status: done` or `Implementation status: done-partial` with link to follow-up tickets.

## Todo list

- [ ] Run metric #1 (variant distribution test)
- [ ] Run metric #2 (theme fallback check)
- [ ] Run metric #3 (image pool + placehold.co count)
- [ ] Run metric #4 (hero overlay coverage)
- [ ] Run metric #5 (unknown variant log check)
- [ ] Write completion report
- [ ] Update parent plan frontmatter + changelog
- [ ] Update parent phase files status
- [ ] Create GitHub issues for residual gaps (if any)

## Success Criteria

- 5 metric checks executed with evidence
- Completion report committed to repo under `plans/260418-2358-wave1-completion/reports/`
- Parent plan status transitions `in_progress` → `done` (or `done-with-followup`)
- Any ❓/❌ metric has either a ticket or explicit defer-to-Wave-2 note

## Risk Assessment

- **Medium — metric #4 failure**: if hero overlay shipped only for 3/11 variants, metric fails. Defer to Wave 2 as ticket, document in parent Open Questions.
- **Low — metric #5 unverifiable**: staging log access needed. Alt: rely on unit test `BROKEN_VARIANTS` coverage.
- **Low — test infra breakage**: if variant-rotation test wasn't shipped with export fix, 10m to add export + re-run.

## Security Considerations

None.

## Next steps

- If all ✅: close parent plan, archive Wave 1 learnings into `docs/journals/260418-wave1-completion.md`, move attention to `260417-0837-all-cate-full-and-strong` (next Wave work).
- If gaps: open tickets, update `260418-1740-wave2-continuation-harness-cleanup` to absorb gaps.
