# Phase 02 — Triage 56 blueprints

## Context links

- Parent plan: `./plan.md`
- Prior phase: `./phase-01-review-workflow-setup.md`
- Drift findings reference: `plans/260419-2022-GH-1-harness-template-block-sync-flow/reports/fullstack-02-drift-validator.md` (800 findings: footer@mega 280, unknown-block 140, variant drift ~380)
- Quality rubric source: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` (if exists) + Wix-level reference

## Overview

- **Date:** 2026-04-19
- **Description:** Đi qua 56 blueprint, verdict 1 trong 3: **OK** (ship được), **Minor** (1-2 tweak nhỏ), **Major** (redesign / swap preset / rewrite copy). Output: triage report với note cụ thể per blueprint.
- **Priority:** P1 (blocker cho fix phases)
- **Implementation status:** pending
- **Review status:** n/a

## Key Insights

- Anh tự review — em không thay thế mắt PM. Role em = prep workflow + capture verdicts + translate thành fix task.
- Rubric chuẩn giúp triage nhanh + consistent. Đề xuất 5 checkpoint per blueprint (bên dưới).
- 56 items / 5 phút mỗi = 4.5h. Nếu dùng rubric + skim → 2-3 phút mỗi = 2-3h tổng.

## Rubric đề xuất (5 checkpoint per blueprint)

1. **First impression (hero)** — headline rõ, image đúng mood, CTA nổi không?
2. **Block sequence** — flow hợp lý không? (hero → proof → features → cta thường win)
3. **Content richness** — testimonials có tên/avatar, features có icon, gallery đủ ảnh không?
4. **Visual hierarchy** — spacing, font size, color contrast có chuẩn không?
5. **Industry fit** — có đúng "DNA" ngành không (restaurant có menu, beauty có booking, tech có pricing...)?

Verdict cuối:
- **OK**: 5/5 checkpoint pass → ship
- **Minor**: 3-4/5 pass, 1-2 tweak dễ (copy, variant swap) → Phase 04
- **Major**: ≤2/5 pass, cần rewrite preset / swap recipe / redesign → Phase 03

## Requirements

**Functional**
- Anh hoặc reviewer đi qua 56 blueprint trên `/test-harness` (Phase 01 UI).
- Mỗi item: verdict + note text (≥10 chữ if Minor/Major explaining why).
- Export kết quả ra JSON file.

**Non-functional**
- Triage xong trong 1 session 3h max.
- Output format standard để Phase 03/04 consume.

## Architecture

```
User (PM) on /test-harness index
  ├── clicks blueprint card
  ├── opens /test-harness/[fixtureId] in tab → eyeball review
  ├── goes back, selects OK/Minor/Major + note
  └── repeats × 56

End of session:
  └── click "Export JSON" → triage-verdicts.json saved to plan reports/
```

## Related code files

**To create**
- `plans/260419-2231-GH-1-per-template-quality-fix/reports/triage-verdicts.json` (populated during triage)
- `plans/260419-2231-GH-1-per-template-quality-fix/reports/triage-summary.md` (post-session write-up, <60 lines)

**To modify** — none
**To read for context** — `src/lib/ai/template-presets-batch{1,2,3}.ts` (nếu cần hiểu preset shape khi viết note)

## Implementation Steps

1. Chạy `npm run harness:gen` → matrix.json up-to-date.
2. `npm run dev` → http://localhost:3000/test-harness (Phase 01 index).
3. Optional: Anh dành 15 phút đầu calibrate rubric bằng cách xem 3 blueprint mẫu (restaurant-warung-kampung, tech-cyber-saas, beauty-rose-petal) để canh tiêu chuẩn OK.
4. Đi qua 56 blueprint, chấm verdict + note.
5. Export JSON → commit vào `reports/triage-verdicts.json`.
6. Em viết `triage-summary.md`: đếm OK/Minor/Major, list top 5 recurring issues (vd: "9 blueprint thiếu testimonials avatar"), xếp major theo category.

## Todo list

- [ ] `npm run harness:gen` fresh
- [ ] Phase 01 UI tested local
- [ ] Calibrate 3 mẫu (15 min)
- [ ] Triage 56 × ~3 min = 3h total
- [ ] Export JSON + commit
- [ ] Em viết summary.md

## Success criteria

- 100% 56 blueprint có verdict (không bỏ sót)
- Major + Minor đều có note cụ thể (không chỉ label)
- `triage-summary.md` có top 5 recurring issues (input cho Phase 03)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Anh quá bận → triage chậm nhiều ngày | Medium | Medium | Chia 2 session: batch1+2 (40 items) chiều 1, batch3 (16) chiều 2 |
| Rubric không đủ discriminate → verdict inconsistent | Medium | Low | Calibrate 3 mẫu đầu; adjust rubric sau batch1 nếu thấy cần |
| Verdict lệch standards → Phase 03 fix sai hướng | Low | High | Em review 5 Major đầu trước khi anh fix → catch misalignment sớm |

## Security Considerations

- Triage output là internal quality signal, không chứa secret.

## Next steps

- Phase 03: fix tất cả Major (prioritized by severity + category coverage).
- Phase 04: fix Minor batch.
- Nếu Major > 20 → phạm vi lớn, cân nhắc tách sprint riêng.
