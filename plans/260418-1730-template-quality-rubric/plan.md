---
title: "Template Quality Rubric — đánh giá + fix 56 templates lên chuẩn Wix"
description: "Chuẩn hóa 8-dimension rubric, automated scorer, fix gaps để lên Wix-professional level"
status: pending
priority: P1
effort: 20h
branch: fix/F01-wave2-wix-detailed
tags: [template, rubric, quality, wix, f01]
created: 2026-04-18
---

# Template Quality Rubric & Fix Program

## Context

56 blueprint templates đang render trong harness — user feedback "vẫn còn lỗi và chưa đạt chuẩn Wix chuyên nghiệp". Project đã có `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` (328 lines) làm baseline nhưng:
- Chưa có scoring mechanism → không biết template nào đang ở đâu so với chuẩn
- Chưa có automated check → khó maintain khi thêm template mới
- Several gaps known: 0/56 có Logo Cloud, 0/280 testimonials có avatar, 56/56 dùng cùng primary color `#0ea5e9`, 115+ missing component instances

Plan này: (1) chuẩn hóa rubric thành JSON machine-scorable, (2) build scorer tool, (3) fix top gaps để 56 templates đạt Wix-professional level.

## Research

- `research/researcher-01-wix-benchmarks.md` — 8-dimension rubric với weights + acceptance criteria (Visual Richness 10, Micro-Interactions 8, Typography 9, Spacing 8, Content Authenticity 7, Social Proof 9, Conversion 8, Density 7)
- `research/researcher-02-current-inventory-gaps.md` — coverage matrix 56 presets vs standard section 1.1 + 1.2; content library richness; design/color gap analysis

## Phases

| # | Phase | Effort | Status | File |
|---|---|---|---|---|
| 01 | Rubric spec + JSON schema | 2h | pending | [phase-01-rubric-spec.md](phase-01-rubric-spec.md) |
| 02 | Automated scorer — harness:score | 4h | pending | [phase-02-automated-scorer.md](phase-02-automated-scorer.md) |
| 03 | Baseline run + gap report | 1h | pending | [phase-03-baseline-scoring.md](phase-03-baseline-scoring.md) |
| 04 | High-impact fixes (Logo Cloud + category colors + testimonial avatars) | 6h | pending | [phase-04-high-impact-fixes.md](phase-04-high-impact-fixes.md) |
| 05 | Category-specific enhancements | 6h | pending | [phase-05-category-specific.md](phase-05-category-specific.md) |
| 06 | Re-score + acceptance | 1h | pending | [phase-06-acceptance.md](phase-06-acceptance.md) |

Total effort: **20h**. Critical path: 01 → 02 → 03 → (04 + 05 parallel) → 06.

## Goal

Sau khi hoàn thành:
- Every template có điểm rubric (0-10 per dimension, weighted total)
- Automated scorer chạy trong `npm run harness:score` → JSON report + HTML dashboard
- ≥80% templates đạt score ≥7/10 trung bình weighted (Wix-professional threshold)
- Critical gaps fixed: 100% có Logo Cloud, 100% có category-aware color, 100% testimonials có avatar slot

## Out of Scope

- Real image assets (Unsplash/Pexels integration) — separate plan, deployment-time
- Full sub-page depth refactor — separate plan
- Animation library upgrade — separate plan (framer-motion unified)
- Accessibility audit (WCAG AAA) — separate plan
