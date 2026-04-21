# Phase 04 — Fix Minor blueprints (polish pass)

## Context links

- Parent plan: `./plan.md`
- Input: `./reports/triage-verdicts.json` filter verdict=Minor
- Prior phase: `./phase-03-fix-majors.md` (rubric đã calibrate)

## Overview

- **Date:** 2026-04-19
- **Description:** Quick-pass polish cho các blueprint verdict=Minor. Thường 1-2 tweak: swap variant, tweak content pool, fix CTA text, adjust theme color. Không rewrite structure.
- **Priority:** P2 (nice-to-have ship polish)
- **Implementation status:** pending
- **Review status:** n/a

## Key Insights

- Minor thường là: testimonial quote quá dài, footer variant xấu, CTA label generic ("Submit"), gallery chỉ 4 ảnh, hero image mờ, logo-cloud toàn "Partner N".
- Target: 80% Minor fix trong session, 20% defer ra backlog v1.1.
- Mỗi Minor fix ~5-10 phút → 20 items × 8 min = ~2.5h.

## Requirements

**Functional**
- 80%+ Minor được fix; defer còn lại ra `triage-summary.md` → "Deferred to v1.1" section.
- Mỗi fix commit: `polish(template): <preset-id> — <tweak>`.
- Không cần before/after screenshot cho Minor (optional).

**Non-functional**
- Harness re-run 1 lần cuối phase thay vì sau mỗi fix (fix Minor risk thấp, batch).
- Không break Major fixes đã làm.

## Architecture

```
Triage JSON
  └── filter verdict=Minor → polish queue
      └── batch process × 5-10 per sitting:
          ├── edit preset inline
          ├── (optional) edit content pack
          └── commit
  └── end of session: npm run harness:gen (1 time) → confirm 0 errors
```

## Common Minor fixes + patterns

| Loại Minor | Fix | Effort |
|-----------|-----|--------|
| Testimonial quote > 200 chars | Edit quote trong content pool `src/data/`; hoặc swap testimonials variant sang one-line variant | 5 min |
| Footer variant sai | Change preset `footer.variant` | 2 min |
| CTA label generic | Change preset `cta.buttonLabel` text | 2 min |
| Hero image keyword mờ | Change preset `hero.imageKeyword` → specific term | 3 min |
| Gallery thiếu items | Add 2-3 entries vào content pack | 5 min |
| Logo-cloud "Partner 1" | Comment out preset block OR wait Phase 04 curation plan 260419-2155 | 2 min or defer |
| Stats numbers toàn 100/200/500 | Tweak preset stats values | 3 min |

## Related code files

**To modify** — same as Phase 03:
- `src/lib/ai/template-presets-batch{1,2,3}.ts`
- `src/data/<cat>-content.ts`
- `src/lib/ai/industry-content-*.ts` (testimonials/features/etc. pool)

**To read for context**
- Rubric checklist từ Phase 02 note

## Implementation Steps

1. Pull Minor list từ triage JSON.
2. Sort by category (batch edits in same file cùng lúc).
3. For each Minor:
   - Open preset file
   - Apply tweak (thường 1-3 dòng)
   - Skip individual harness re-run
4. Sau khi fix ~10 items: `npm run harness:gen` check 0 regression.
5. If regression found → git bisect lần cuối fix → revert hoặc fix-forward.
6. Commit batch: `polish(template): batch X Minor fixes (N items)` — hoặc commit riêng từng nếu preferred.
7. Update triage JSON.

## Todo list

- [ ] Pull Minor queue
- [ ] Fix batch 1 (~10 items)
- [ ] Harness checkpoint
- [ ] Fix batch 2
- [ ] Harness checkpoint
- [ ] Fix batch 3 (if exists)
- [ ] Final harness re-run
- [ ] Commit + update triage JSON
- [ ] List deferred Minors ra summary

## Success criteria

- ≥80% Minor có verdict updated to OK.
- Harness 390/390 compose clean.
- Deferred Minor documented with reason (vd: "needs designer input — v1.1").

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Batch commit ẩn regression khó bisect | Medium | Medium | Commit theo category hoặc theo 5-item batch |
| Scope creep Minor → Major | Medium | Low | Nếu 1 Minor fix > 15 min → re-classify là Major, add vào Phase 03 backlog |
| Content pool edit break other blueprints cùng cat | Medium | Medium | Harness re-run checkpoints catch cross-cat regression |

## Security Considerations

- Same as Phase 03.

## Next steps

- Phase 05 validation.
- Deferred Minor → backlog v1.1 ticket.
