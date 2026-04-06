---
title: "Template System Quality — Fill Gaps for Production"
description: "Fix stub blocks, multi-page seeding, and polish partials so templates deliver real quality"
status: done
priority: P0
effort: 3d
branch: staging-2
tags: [templates, blocks, quality, multi-page, polish]
created: 2026-04-06
---

# Template System Quality — Fill Gaps for Production

## Problem

Template System v2 configs/schemas/registry are 100% complete. But **block components** and **seeding flow** have gaps:

1. **3 stub blocks** (stats, team, newsletter) are used in every template but render minimal/broken content
2. **3 partial blocks** (about, faq, cta) lack variants and polish
3. **Multi-page templates broken** — Professional (3 pages) and Premium (5 pages) only create 1 homepage
4. **Template seed not automated** — requires manual API call

## Research
- [Block Quality Audit](research/researcher-01-block-quality.md) — all 51 blocks assessed
- [E2E Flow Audit](research/researcher-02-e2e-flow.md) — full flow traced, 4 gaps found

## Implementation Phases

### Phase 1: Fix Stub Blocks (1d) — P0
| # | Block | Current | Target | Effort |
|---|-------|---------|--------|--------|
| 1 | [stats](phase-01-fix-stub-blocks.md) | 23 lines, no variants | 150+ lines, 3 variants (numbers, cards, progress-bars) | 2h |
| 2 | team | 24 lines, no variants | 150+ lines, 3 variants (grid, cards, carousel) | 2h |
| 3 | newsletter | 18 lines, no variants | 100+ lines, 2 variants (inline, card) | 1h |
- **Status:** done
- **Progress:** 3/3 blocks

### Phase 2: Polish Partial Blocks (1d) — P0
| # | Block | Current | Target | Effort |
|---|-------|---------|--------|--------|
| 1 | [about](phase-02-polish-partial-blocks.md) | 78 lines, basic | 200+ lines, 3 variants (split, full-width, timeline) | 3h |
| 2 | faq | 54 lines, basic | 120+ lines, 2 variants (accordion, two-column) | 2h |
| 3 | cta | 55 lines, basic | 120+ lines, 3 variants (centered, split, banner) | 2h |
- **Status:** done
- **Progress:** 3/3 blocks

### Phase 3: Multi-Page Template Seeding (0.5d) — P1
- [Details](phase-03-multi-page-seeding.md)
- Add `pages` JSON field to Templates collection
- Update seed endpoint to store ALL pages (not just homepage)
- Update apply-template to create multi-page sites
- **Status:** done
- **Progress:** 3/3 steps

### Phase 4: Template Seed Automation + Smoke Test (0.5d) — P1
- [Details](phase-04-seed-automation.md)
- Auto-seed on first admin visit or startup
- Smoke test: apply each template category, verify blocks render
- **Status:** done
- **Progress:** 2/2 steps

## Dependency Graph

```
Phase 1 (stubs) ──→ Phase 4 (smoke test)
Phase 2 (partials) ──→ Phase 4 (smoke test)
Phase 3 (multi-page) ──→ Phase 4 (smoke test)
```

Phases 1, 2, 3 can run in parallel. Phase 4 depends on all three.

## Validation Summary

**Validated:** 2026-04-06 (2 rounds)
**Questions asked:** 12

### Confirmed Decisions

| # | Decision | User Choice |
|---|----------|-------------|
| 1 | Stats variant count | **3 variants** (numbers, cards, progress-bars) — full coverage |
| 2 | Pages storage in Templates | **Separate templates_template_pages table** — normalized, not JSON column |
| 3 | Auto-seed trigger | **db-setup.js** — runs before Next.js, reliable |
| 4 | Priority order | **Song song hết** — parallel agents for max speed |
| 5 | Animation approach | **Framer Motion** — scroll-triggered, stagger (~30KB bundle) |
| 6 | Dark mode | **Có** — dùng design tokens, blocks auto-adapt colorMode |
| 7 | Apply template to existing site | **Xóa pages cũ, tạo mới** — apply = reset site với layout mới |
| 8 | Seed import strategy | **Raw SQL INSERT** — pre-generate JSON, hardcode SQL, no TS import |
| 9 | Newsletter form submit | **Real API + Payload collection** — tạo Subscribers collection |
| 10 | Bundle size (Framer Motion) | **Ok thêm** — animation quality > 30KB |
| 11 | Subscribers collection scope | **Gộp vào Phase 1** — collection đơn giản, +30 phút |
| 12 | About timeline data | **Thêm timeline-specific fields** — year, icon fields riêng |

### Action Items (updated sau predict report)
- [ ] Phase 1+2: **BẮT BUỘC** — Thêm `'use client'` vào stats, team, newsletter TRƯỚC khi thêm Framer Motion
- [ ] Phase 1+2: Tạo shared `AnimatedSection` wrapper với `useReducedMotion()` — dùng chung cho 6 blocks
- [ ] Phase 1+2: All blocks dùng `var(--surface)`, `var(--text)` cho dark mode
- [ ] Phase 1: framer-motion đã có trong package.json — KHÔNG cần install thêm
- [ ] Phase 1: Create Subscribers collection + POST /api/subscribe + rate limit + admin view trong Payload
- [ ] Phase 2: Thêm timeline fields (year, icon) vào about block config — giữ timeline variant
- [ ] Phase 3: Create `templates_template_pages` table (normalized)
- [ ] Phase 3: Apply-template: DELETE existing pages + CREATE mới, **bọc transaction** (`payload.db.beginTransaction()`)
- [ ] Phase 3: Thêm warning modal trong EditorTemplateModal: "Thay đổi template sẽ xóa nội dung hiện tại"
- [ ] Phase 4: Raw SQL INSERT trong db-setup.js — pre-generate seed data, không import TS

## Predict Report (5-persona analysis)

**Verdict: CAUTION** — Làm được, đã patch các risks vào plan.

| Risk | Mức độ | Đã patch? |
|------|--------|-----------|
| `'use client'` thiếu ở stats/team/newsletter → crash SSR | Critical | ✅ Thêm vào Phase 1 step 0 |
| Apply-template không có DELETE logic + không transaction | High | ✅ Thêm transaction + delete vào Phase 3 |
| `prefers-reduced-motion` chỉ 2/18 blocks respect | Medium | ✅ Tạo shared AnimatedSection wrapper |
| Subscribers collection không ai xem | Medium | ✅ Thêm admin view (Payload tự hiện) |
| About timeline AI không biết generate | Medium | ✅ Giữ variant + thêm note update AI prompt |
| Warning modal khi apply template | Medium | ✅ Thêm vào Phase 3 |

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Stub blocks in template flow | 3 (23 avg lines) | 0 (all 100+ lines) |
| Partial blocks in template flow | 3 (62 avg lines) | 0 (all 120+ lines) |
| Pages created per Premium template | 1 | 5 |
| Pages created per Professional template | 1 | 3 |
| Template auto-seed on fresh DB | ❌ manual | ✅ auto |
