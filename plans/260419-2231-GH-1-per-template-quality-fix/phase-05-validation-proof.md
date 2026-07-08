# Phase 05 — Validation + before/after proof

## Context links

- Parent plan: `./plan.md`
- Prior phases: 02 triage, 03 fix Majors, 04 fix Minors
- Harness CLI: `scripts/test-harness/cli.ts`, `npm run harness:gen`
- Drift validator: `src/lib/ai/template-drift-validator.ts` (from plan 260419-2022)

## Overview

- **Date:** 2026-04-19
- **Description:** Khép vòng chất lượng: re-run full harness, compile before/after proof deck, update plan-level metrics, PM sign-off ship v1.0.
- **Priority:** P1 (gate ship v1.0)
- **Implementation status:** pending
- **Review status:** n/a

## Key Insights

- Sau Phase 03 + 04, cần **evidence** rằng 56 blueprint thật sự tốt hơn. Không chỉ tin feel.
- Drift findings số (baseline 800) có thể GIẢM nếu fix Majors chạm vào variant-mismatch (footer@mega). Track delta.
- PM approval cần thấy side-by-side: before vs after → dùng HTML proof deck đơn giản.

## Requirements

**Functional**
- `npm run harness:gen` + `npm run drift:check` all pass (0 composer errors, baseline stable or down).
- Proof deck HTML: 56 card (fixtureId, before.png, after.png, verdict-before, verdict-after, change-note).
- Summary metrics: count OK/Minor/Major before vs after, drift count delta.
- PM approval pass → ship v1.0 template shelf.

**Non-functional**
- Deck self-contained (open trực tiếp, không cần server).
- Generate trong <5 phút từ reports data.

## Architecture

```
reports/
  ├── triage-verdicts.json (updated post Phase 04)
  ├── before-after/<preset-id>/{before,after}.png (from Phase 03)
  └── proof-deck.html (NEW — generated)

Script:
  scripts/template-quality-proof.ts  [NEW, <120 lines]
    ├── reads triage-verdicts.json
    ├── reads before-after/ folder
    ├── renders self-contained HTML deck
    └── outputs proof-deck.html
```

## Related code files

**To create**
- `scripts/template-quality-proof.ts` — generator script (<120 lines). Reads triage JSON + screenshot folder, outputs HTML.
- `plans/260419-2231-GH-1-per-template-quality-fix/reports/proof-deck.html` — output
- `plans/260419-2231-GH-1-per-template-quality-fix/reports/validation-summary.md` — final metrics write-up

**To read for context**
- `src/show-off/**` — nếu có template HTML showcase component sẵn có thể reuse
- `scripts/test-harness/report/` — existing report structure

**To modify** — none

## Implementation Steps

1. Run `npm run harness:gen` → confirm 390/390 compose clean.
2. Run `npm run drift:check` → compare count vs baseline 800. If fallen: celebrate. If spiked: bisect + fix.
3. Run `npx tsx scripts/template-quality-proof.ts` → generates proof-deck.html.
4. Open deck locally, spot-check 5-10 random cards ok.
5. Write `reports/validation-summary.md`:
   - Before: OK=X, Minor=Y, Major=Z (total 56)
   - After: OK=X', Minor=Y', Major=Z' (target: Z'=0, X' ≥ 50)
   - Drift: 800 → N
   - Harness composer errors: 0 (must be 0)
   - Deferred Minors: list
6. PM review deck + summary → approve/reject.
7. If approve → close plan, mark phases done, update journal.

## Todo list

- [ ] `npm run harness:gen` clean
- [ ] `npm run drift:check` clean
- [ ] Proof-deck generator script
- [ ] proof-deck.html generated
- [ ] validation-summary.md
- [ ] PM review + sign-off
- [ ] Update parent plan status

## Success criteria

- 0 blueprint Major post-fix.
- Harness composerErrors = 0.
- Drift baseline ≤ 800 (ideally lower).
- Proof deck shows clear before-after improvement.
- PM explicit approve trong summary comments.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Proof deck generator over-engineered | Low | Low | Keep <120 LOC, plain HTML, no deps |
| PM reject sau khi thấy deck | Medium | Medium | Loop back Phase 03/04 targeted — không làm lại toàn bộ |
| Drift count tăng sau fix | Low | Medium | Fix Phase 03 đã harness-check mỗi commit; spike xảy ra chỉ nếu Phase 04 batch gộp; git bisect |
| Screenshot missing cho vài preset | Medium | Low | Deck render placeholder "screenshot pending" — không block ship |

## Security Considerations

- Proof deck nếu share public có thể reveal internal naming/brand. Đừng host public — local file only.

## Next steps

- Ship v1.0 template shelf với 56 blueprint chuẩn.
- Backlog: Minor defer → v1.1 polish sprint.
- Kick off 4-tier expansion roadmap (preset count 4→8/cat) khi v1.0 ổn định 2 tuần.
