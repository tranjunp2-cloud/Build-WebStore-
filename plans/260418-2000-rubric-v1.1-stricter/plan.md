---
title: "Rubric v1.1 — chặt hơn, catch visual/design gaps"
description: "Tighten rubric từ 8.96 avg → 6.5-7.2 để force differentiation, thêm 10 criteria đo quality"
status: pending
priority: P2
effort: 5h
branch: fix/F01-wave2-wix-detailed
tags: [rubric, quality, harness, f01]
created: 2026-04-18
---

# Rubric v1.1 — Stricter Quality Criteria

## Context

Rubric v1 (đã ship) chạy baseline 390 fixtures = avg **8.96/10, 100% pass** — too lenient. Ceiling issues:
- Typography 10/10 (fontPairingId fallback always true)
- Spacing 10/10 (`themeHasSpacingPreset` trivial)
- Density 10/10 (varietyHalfUnique 50% = floor)

User phản hồi: "rubric chặt hơn đi". Mục tiêu: rubric differentiate được templates "tốt" vs "tạm được" vs "yếu".

## Research

- `research/researcher-01-v1.1-design.md` — ceiling audit, stricter replacements, 10 new criteria, weight rebalance, expected outcome

## Phases

| # | Phase | Effort | Status | File |
|---|---|---|---|---|
| 01 | Design rubric-v1.1.json (tighten + new criteria, weight 66 → 79) | 1h | pending | [phase-01-rubric-v1.1-spec.md](phase-01-rubric-v1.1-spec.md) |
| 02 | Implement new evaluators (10 new + 4 updated) | 2h | pending | [phase-02-evaluators.md](phase-02-evaluators.md) |
| 03 | CLI `--rubric-version` support, keep v1 callable for comparison | 1h | pending | [phase-03-versioning.md](phase-03-versioning.md) |
| 04 | Baseline v1.1 + update docs + calibration tweaks | 1h | pending | [phase-04-baseline-docs.md](phase-04-baseline-docs.md) |

Total: **5h**. Critical path linear.

## Key Changes v1 → v1.1

| Dim | v1 weight | v1.1 weight | What's new/tight |
|---|---|---|---|
| Visual Richness | 10 | 12 | +image-coverage (non-SVG), +features-have-icons |
| Typography | 9 | 12 | +headline-length ideal, +subheadline-length, distinct fonts required |
| Social Proof | 9 | 10 | +testimonials-have-ratings |
| Micro-Interactions | 8 | 9 | +nav-links-balanced (3-7) |
| Spacing & Rhythm | 8 | 10 | +borderRadius + shadowPreset required, sweet-spot 9-14 blocks |
| Conversion | 8 | 10 | +hero-cta-pair (≥2 CTAs), +cta-text-quality |
| Content | 7 | 8 | +content-depth (≥150 chars copy) |
| Density | 7 | 8 | +footer-mega-columns ≥4, variety 50% → 60% |
| **Total** | **66** | **79** | +13 (20% stricter) |

## Goal

Sau Phase 04:
- avg 8.96 → **6.5-7.2** (30% drop)
- Distribution spread: 10% top / 40% good / 40% mediocre / 10% broken
- v1 vẫn callable cho historical comparison
- Admin dashboard default v1.1, toggle to v1 available
- Fixtures failing v1.1 = actionable fix targets (not ceiling-inflated)

## Open Questions (user review)

1. Generic CTA blacklist: include "Get Started" hay không? (common in SaaS)
2. Image coverage: check URL != `data:image/svg` để reject placeholders?
3. v1 deprecation: keep forever hay xóa sau 3 tháng?
4. Partial credit: implement full partial scoring (50% credit cho near-miss) hay pass/fail only?

## Out of Scope

- Rubric v2 với a11y/perf dimensions — separate plan
- Real-time score on AI-first regen — existing scorer handles it
- Cross-template benchmarking (best-in-class reference templates) — future
