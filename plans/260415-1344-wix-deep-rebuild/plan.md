---
title: "Template Wix-Deep Rebuild — Component-by-Component Fix"
description: "Audit và fix từng block component để template gen render đạt chuẩn Wix — variants, visual diversity, theme defaults, image coverage"
status: pending
priority: P0
effort: 43-63h
branch: feat/F01-ai-gen-seo-guard
tags: [blocks, templates, wix, visual-quality, variants, theme]
created: 2026-04-15
---

# Template Wix-Deep Rebuild

## Problem (sửa lại 2026-04-15 sau khi deep-dive)
Site gen ra "chưa đẹp" vì 3 nguyên nhân chồng nhau:

1. **Variant rotation chỉ áp cho 4/54 block types**: hero (qua `CATEGORY_HERO_VARIANTS`) + nav/contact/footer (qua `rotateStructuralVariants` + pool 14 categories × 3 variants ở `category-requirements.ts`). **~45 blocks còn lại** (features, pricing, testimonials, about, cta, stats, newsletter, team, faq, gallery, service-cards, v.v.) vẫn hardcode 1 variant trong composer → các site cùng category ra giống hệt nhau ở những block này.
2. **Variants nhìn giống nhau dù khác tên**: features có 8 variants nhưng tất cả dùng cùng decorative (gradient blob + màu primary tint) — 8 variants render như 8 sắc thái của cùng 1 style. Thiếu các layer trang trí khác nhau (mesh gradient, noise texture, layered shapes, grid bất đối xứng).
3. **Các block thin variants**: team=2, cta/about/stats/newsletter/faq=3 — không đủ lựa chọn để đa dạng hoá.

Cộng thêm: theme fallback mặc định dark cyan/magenta (sẽ fix Phase 02), image pool chỉ bao 7/54 blocks (Phase 06), navigation monolith 924 dòng (Phase 03 — đã fix 11 chỗ hardcode màu trong vòng followup, xem `nav-bugfix-followup.md`).

## Research
- [Component Status Audit](research/researcher-01-component-status.md) — 14 critical blocks scored
- [Gen Flow Output Audit](research/researcher-02-gen-flow-output.md) — render path + visual bugs (có correction 2026-04-15)
- [Navigation bugfix followup](nav-bugfix-followup.md) — 4 lỗi nav còn lại sau vòng fix màu

## Phase Overview

| # | Phase | Priority | Effort | Status | Parallel? |
|---|---|---|---|---|---|
| [01](phase-01-variant-wiring.md) | Variant Wiring | P0 | 3-5h | pending | — |
| [02](phase-02-theme-fallback-hardening.md) | Theme Fallback Hardening | P0 | 2-4h | pending | ‖ w/ 01 |
| [03](phase-03-navigation-rebuild.md) | Navigation Rebuild | P0 | 8-12h | pending | after 01,02 |
| [04](phase-04-visual-diversity-pass.md) | Visual Diversity Pass | P1 | 10-14h | pending | after 01,02 |
| [05](phase-05-thin-block-expansion.md) | Thin Block Expansion | P1 | 10-14h | pending | after 01,02 |
| [06](phase-06-image-pool-coverage.md) | Image Pool Coverage | P1 | 6-8h | pending | after 01,02 |
| [07](phase-07-footer-form-polish.md) | Footer + Form Polish | P2 | 4-6h | pending | last |

**Total**: 43-63h

## Dependency Graph
```
01 (variant wiring) ──┐
02 (theme defaults) ──┤
                      ├─> 03 (nav)    ──┐
                      ├─> 04 (visual) ──┤
                      ├─> 05 (thin)   ──┼─> 07 (footer+forms)
                      └─> 06 (images) ──┘
```
01 + 02 are blockers. 03–06 run in parallel (different files). 07 last (polish).

## Success Metrics
1. **Variant diversity**: seed-based variant distribution ≥ 80% utilization across 10 generated sites per category (composer debug log).
2. **Visual differentiation**: side-by-side of same block × 3 variants shows ≥ 3 distinct decorative treatments (no shared GradientBlob vocabulary). Manual QA.
3. **Theme coverage**: 0 sites render fallback dark cyan/magenta. All sites receive full 6-color palette + colorMode.
4. **Image coverage**: BLOCK_IMAGE_SPEC ≥ 15 block types (from 7); 0 `placehold.co` emissions.
5. **Thin-block variants**: team≥5, cta≥6, about≥6, stats≥5, newsletter≥5, faq≥5.

## Open Questions
1. Newsletter `popup` variant: real `<dialog>` modal (focus trap, scroll lock, esc) or styled card? [Phase 05]
2. Pricing `comparison`/`table` variant: 375px mobile without horizontal overflow? [Phase 04]
3. Navigation `transparent` variant: scroll-shrink + solid on scroll? [Phase 03]
4. `category-theme-picker.ts`: writes full 6-color palette + colorMode, or only primary/secondary? **Must answer before Phase 02.**
5. `site.headerBlock`: pre-populated on first gen or only manual customization? If always present, `applyGlobalSystemBlocks` silently kills nav regens. **Must answer before Phase 03.**

## Related plans
- `plans/260406-template-system-quality-audit/` (done) — stubs + multi-page seeding
- `plans/260407-0201-block-wix-audit/` (done) — tokens + animations + SEO
- `plans/260414-2249-ai-gen-wix-level-optimize/` (pending) — AI gen pipeline personalization

## Changelog
- **2026-04-15** — Navigation block: đã fix 11 chỗ hardcode màu (nav bg đen, dropdown navy, pill trắng) → giờ theme-adaptive qua `color-mix(in srgb, var(--background) X%, transparent)`. TypeScript sạch.
- **2026-04-15** — `nav-bugfix-followup.md` **DONE** — fix 4 lỗi còn lại: (A) CTA URL hardcode → helper `resolveNavCtaUrl`; (B) xoá default `variant: 'simple'` khỏi composer; (C) shared `NavLogo` component nhận `gradientMode` + `scrolled`, TransparentNav dùng chung; (D) hook `useScrollShrink(50)` + apply vào simple/centered/mega-menu + migrate TransparentNav. 12/12 tests pass, code review 8.5/10.
- **2026-04-15** — Correction: variant rotation KHÔNG phải dead code như researcher-02 nói. Có rotation cho 4 block types (hero/nav/contact/footer). Phase 01 cần scope lại: mở rộng pattern sẵn có cho 45 blocks thiếu, không viết mới.
