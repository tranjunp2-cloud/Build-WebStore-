# Phase 03 — Fix Major blueprints

## Context links

- Parent plan: `./plan.md`
- Input: `./reports/triage-verdicts.json` (từ Phase 02)
- Input summary: `./reports/triage-summary.md`
- Preset sources: `src/lib/ai/template-presets-batch{1,2,3}.ts`
- Composer: `src/lib/ai/template-composer.ts`
- Content packs: `src/data/`, `src/lib/ai/industry-content-*.ts`

## Overview

- **Date:** 2026-04-19
- **Description:** Fix tất cả blueprint verdict = Major. Cách fix: rewrite preset `blocks[]` recipe, swap variant, replace content keys, hoặc delete + recreate preset nếu hỏng sâu.
- **Priority:** P1 (v1.0 ship-blocker cho những cat có Major)
- **Implementation status:** pending
- **Review status:** n/a

## Key Insights

- Preset là object hardcode TypeScript — fix = edit object literal. Không có migration.
- Mỗi batch file ~20 preset → 1 Major fix thường < 30 phút (nếu copy + variant swap), 1-2h nếu rewrite cấu trúc.
- Tái sử dụng variant đã tốt từ blueprint OK: vd `restaurant-warung-kampung` dùng hero=split-image + gallery=masonry → copy pattern sang restaurant Major nếu fit.
- Content text trong preset thường không render (composer personalize lại) → fix text-only = vô nghĩa. Fix structure + variant trước.

## Loại fix phổ biến (expected, refine sau Phase 02)

1. **Wrong block order** → reorder `blocks[]` trong preset. 5 phút.
2. **Missing signature block** (restaurant thiếu booking-widget) → insert block object vào array. 10 phút.
3. **Wrong variant cho content** (testimonials=carousel khi chỉ có 2 items) → swap variant sang grid/simple. 5 phút.
4. **Theme preset không fit ngành** (dark neon cho beauty) → swap themePreset. 2 phút.
5. **Content pack quá nghèo** (features chỉ 3 items) → add 2-3 features vào content pool cat đó. 15 phút.
6. **Hard redesign** (preset cả structure + theme đều sai) → copy 1 preset OK cùng cat, thay businessIndex + customize light. 30-60 phút.

## Requirements

**Functional**
- Mọi blueprint verdict=Major được update (không còn Major sau phase).
- Mỗi fix có commit message `fix(template): <preset-id> — <issue>`.
- Before/after screenshot pair lưu `reports/before-after/<preset-id>/`.

**Non-functional**
- Không break blueprint khác (regression): re-run `npm run harness:gen` sau mỗi fix confirm 0 composer error.
- Không expand pool (thêm preset mới) — scope Phase 03 là fix cái đã có.

## Architecture

```
Triage JSON (Phase 02)
  └── filter verdict=Major → list to fix
      └── for each preset:
          ├── read src/lib/ai/template-presets-batch{N}.ts
          ├── identify issue type (rubric note)
          ├── apply fix (reorder/swap/rewrite)
          ├── npm run harness:gen → verify no new composer error
          ├── visual re-check on /test-harness/[fixtureId]
          ├── screenshot before + after → save to reports/before-after/
          └── commit
```

## Related code files

**To modify** (depends on triage):
- `src/lib/ai/template-presets-batch1.ts` (restaurant, ecommerce, beauty, fnb, tech)
- `src/lib/ai/template-presets-batch2.ts` (health, education, fitness, realestate, creative)
- `src/lib/ai/template-presets-batch3.ts` (business, events, blog, travel)
- Optionally `src/data/<cat>-content.ts` or `src/lib/ai/industry-content-*.ts` if need richer pool
- Optionally `src/lib/ai/theme-presets.ts` if swap theme

**To read for context**
- `src/lib/ai/template-definitions.ts` — `TemplatePreset` type
- `src/lib/ai/template-composer.ts` — how preset → rendered blocks

**To create**
- `plans/260419-2231-GH-1-per-template-quality-fix/reports/before-after/<preset-id>/before.png` + `after.png` per fix

## Implementation Steps (per Major)

1. Pick lowest-ID Major từ triage JSON.
2. Screenshot current render `/test-harness/<fixtureId>` → save `before.png`.
3. Mở `template-presets-batch*.ts`, find preset object by `id`.
4. Apply fix theo note trong triage (reorder / variant / theme / content).
5. `npm run harness:gen` — confirm `composerErrors=0` (0 regression).
6. Re-render `/test-harness/<fixtureId>` → screenshot `after.png`.
7. Diff visual — confirm improved not worse.
8. Git commit: `fix(template): <preset-id> — <short reason>`.
9. Update triage JSON: mark verdict=OK với note "fixed in phase 03".
10. Next Major.

## Todo list

- [ ] Pull Major list từ triage JSON (expected 5-15 items sau Phase 02)
- [ ] Setup before-after screenshot folder
- [ ] Fix loop × N items
- [ ] Harness no regression per fix
- [ ] PM review 3 first fixes before batch commit (catch misalignment)
- [ ] Commit all fixes
- [ ] Update triage JSON status

## Success criteria

- 0 blueprint còn verdict=Major sau phase.
- Harness: 390/390 compose không lỗi (before + after).
- PM approve before-after pairs qua dashboard / Slack.
- Mỗi fix = 1 commit rõ ràng cho audit trail.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Fix 1 preset vô tình break preset khác (shared content / theme) | Medium | High | Harness re-run sau mỗi fix; commit nhỏ từng cái |
| Major > 15 → effort explosion | Medium | Medium | Nếu Major > 15, re-scope: fix top 10 most-severe ship v1.0, defer 5 sang v1.1 |
| Screenshot workflow chậm → review slow | Medium | Low | Dùng Playwright `scripts/test-harness` visual-diff nếu đã có; else manual screenshot |
| PM changes rubric mid-phase | Low | Medium | Freeze rubric sau Phase 02 sign-off |

## Security Considerations

- Preset text có thể chứa brand names / placeholder địa chỉ — không PII.

## Next steps

- Phase 04: tiếp tục fix Minor bằng rubric tương tự nhưng quick-pass.
- Phase 05: validation re-run full harness + compile proof deck.
