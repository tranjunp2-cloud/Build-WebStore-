---
title: "Template Wix-Deep Rebuild — Component-by-Component Fix"
description: "Audit và fix từng block component để template gen render đạt chuẩn Wix — variants, visual diversity, theme defaults, image coverage"
status: done
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

---

## Architectural Extension — Wix Deep-Dive Findings (2026-04-15 chiều)

> 7-phase tactical plan ở trên vẫn valid. Section này THÊM vào 5 phase architectural + R&D, không thay thế. Session research này spawn 6 parallel agents (3 Wix research + 3 internal verify) để verify approach trước khi code.

### Findings quan trọng từ forensic Wix audit

**Verified từ 5 live Wix ADI sites + Velo dev docs + Webflow/Framer/Squarespace triangulation:**

1. **Section layout của Wix là CSS Grid mostly-1D** (`grid-template-columns: 1fr`), spacing là **grid-row-driven** (`grid-template-rows: repeat(N, min-content) 1fr`) — KHÔNG phải padding ratio 120/96/80 như suy đoán ban đầu. 2D chỉ happen trong nested `wixui-column-strip`.
2. **Section widths KHÔNG quantized** — real `:root --section-max-width: 9999px` (uncapped). Drop ý tưởng 3-width rule.
3. **`px*` Scale unit = CSS `clamp(min-vp, full-vp, min(section-max, max-vp))`** với `--one-unit: 1vw`. Formula copy verbatim được, nhưng Wix không public — implementing clamp() là OUR design choice, không phải "steal".
4. **Canonical Wix breakpoints: 1001 / 751 / 320** (không phải 1920/1440/1280). ⛔ KHÔNG global-swap Tailwind `md:` — project dùng default `md=768`, swap sẽ break 30+ blocks. Adopt parallel alias `wix-mobile/wix-tablet/wix-desktop`.
5. **Docking = 5-pin** (Top/Bottom/Left/Right/**Center**), multi-pin allowed.
6. **Slot schema là UI metaphor, KHÔNG phải Wix data model**. Velo `$w.Section` API expose zero grid/slots/docking properties. Wix editor schema closed-source. Nếu mình làm = **invent, không copy**.
7. **Post-gen validators (rhythm + cohesion)**: KHÔNG builder nào (Wix/Webflow/Framer/Squarespace) public cơ chế này. Đây là **R&D bet của mình** — có thể moat, có thể harder than assumed. Budget +30%.
8. **Peer convergence**: CSS Grid substrate = 4/4 builders. Steal: Squarespace `minmax(row-min, auto)` (free text-wrap safety), Framer Stack-first cho 1D sections (đừng ép Grid), Webflow `grid-template-areas` (CSS-native slot naming).

### Dependency verify — `260414-2249-ai-gen-wix-level-optimize` đã SHIP HẾT 7 phase

Frontmatter `status:pending` là **STALE**. Code thật sự đã có trên disk:
- `src/lib/ai/business-info-mapper.ts` (127L, commit `6c5c4b6f`) — user data threading
- `src/lib/ai/product-translator.ts` (148L) — vi/ms → en Unsplash translation
- `src/lib/ai/theme-moods.ts` (381L, commit `49b417ca`) — 6 moods bundled
- `src/lib/ai/image-pool.ts` (349L, commit `50b1836a`) — per-site pool + seeded picker + `buildImagePool` + `pickFromPool`
- `src/lib/ai/consistency-validator.ts` (294L) — C1-C5 đã có ở WARN-ONLY mode
- Multipage + SEO + variety retrofit đã ship: commits `02e27643`, `6ebcb6ea`, `315c6238`, `ec41e587`

**Impact**: các ý "user data threading", "lang-aware image", "mood required param" KHÔNG còn scope vì đã shipped.

### `consistency-validator.ts` đã có C1-C5 nhưng WARN-ONLY

File header ghi rõ "Auto-retry is explicitly out of scope for Phase 06". Rules sẵn có:
- **C1** palette adherence — theme primary/secondary/heading/body
- **C2** image mood consistency — hero/section share Unsplash query hint
- **C3** headline length ≤ 10 words
- **C4** CTA rhythm ≥ 3 CTAs/page
- **C5** layout recipe — nav/hero/footer present

3 call sites `openai-generator.ts:462, 522, 554` push warnings vào `done` SSE event, never throw. Promote sang hard-gate = easy (S effort, half day), nhưng **CHƯA có repair path** → flip switch sẽ làm AI gen fail loud không retry → phải viết retry loop TRƯỚC khi bật hard-gate.

### 5 phase thêm vào (architectural extension)

Tất cả depend trên 7 phase tactical ở trên ship trước. Run sau khi A1/A2/A3 stable.

| # | Phase | Effort | Prio | Mô tả |
|---|---|---|---|---|
| **X1** | Slot-Schema Foundation + clamp tokens | **40-80h** ⚠️ | P0 | `SectionSchema` type (row-grammar CSS Grid + Webflow-style `grid-template-areas` slot naming). Hero pilot: 11 variants collapse vào 1 grid + 11 slot-area maps. Clamp-based TYPE_SCALE + SPACING tokens. Parallel Wix BP alias (`wix-mobile/wix-tablet/wix-desktop`). **Effort cao vì 11 variants × 3 BP × 2 anim states = 66 states cần visual regression diff**. Hero hiện dùng `min-h-[92vh] flex items-center` + `mb-*` stack, KHÔNG phải grid-rows → phải rewrite. Nếu blocked > 60h, fall back incremental refactor. |
| **X2** | Layout Primitives + Grid-over-Flex Audit | 6-8h | P0 | `SectionWrapper` max-width prop **uncapped default** (không còn 3-width rule). Migrate features/pricing/gallery/testimonials sang CSS Grid cho 2D. Nav/button-group/tag-list = Stack (Framer rule — đừng ép Grid lên 1D). Depends on X1. |
| **X3** | Rhythm Validator (R&D) | 8-10h +30% buffer | P0 | NEW `src/lib/ai/validators/rhythm.ts`. Enforce: (a) no 3-in-a-row same bg, (b) row-grid-track min-height (NOT padding ratio), (c) CTA cadence every 2-3 sections, (d) kill `height:90vh` hero lock. Fail → per-axis reroll qua seeded retry. Max 3 passes. Depends on X1 + existing A1. **R&D bet** — không builder nào public cơ chế này. Nếu stuck > 1 tuần, ship bg alternation only, defer row-grammar. |
| **X4** | Cohesion Validator — extend C1-C5 + hard-gate (R&D) | 6-10h +30% buffer | P0 | Thêm 3 axes mới vào `consistency-validator.ts`: **C6 H1 count** (= 1), **C7 font family count** (≤ 2), **C8 WCAG AA contrast** (4.5:1 body / 3:1 large). Promote C1-C8 từ WARN-ONLY sang HARD-GATE với per-axis retry path (max 2 passes, fallback warn-only on 2nd fail). **Quan trọng: retry path PHẢI ship trước khi flip switch** — không thì AI gen fail loud. Depends on X3. |
| **X5** | Visual Diversity Layer — `_decorative/` library | 10-14h | P1 | 8 decorative primitives: `mesh-gradient, noise-texture, layered-shapes, asymmetric-grid, duotone-overlay, typographic-mark, grid-lines, diagonal-stripe`. Mỗi variant của features/testimonials/pricing/contact/hero dùng 1 decorative khác → kill "8 shades of the same gradient blob". Overlap với Phase 04 tactical nhưng scope sâu hơn (Phase 04 fix colors, X5 fix decorative vocabulary). |

**Tổng X1-X5: 70-122h** (~9-16 ngày). Cộng với 7 phase tactical (43-63h) → **total 113-185h** (~15-24 ngày).

### Execution order — tactical trước, architectural sau

```
Week 1:   Phase 01 + 02 + 03 (tactical blockers) → ship fixes
Week 2:   Phase 04 + 05 + 06 + 07 (parallel, different files)
Week 3-4: X1 (heavy slot-schema refactor)
Week 5:   X2 + X5 (parallel after X1)
Week 6:   X3 → X4 (validators, order matters: rhythm trước cohesion)
```

### Risks cần anh biết

| Risk | Phase | Mitigation |
|---|---|---|
| X1 effort blows past 80h (66 visual states) | X1 | Time-box 60h cho hero pilot, fall back incremental |
| X4 hard-gate retry loop infinite-loop hoặc burn Unsplash quota | X4 | Max 2 passes, per-axis budget, fallback warn-only |
| Wix BP 1001/751/320 global swap break 30+ blocks | X1 | Parallel alias không phải global rename |
| X3+X4 R&D — không public reference | X3+X4 | +30% buffer, ship rhythm trước, defer cohesion nếu stuck |
| A3 overlap với shipped `ec41e587` variety-retrofit | A3 | 15-min code read trước khi A1 start |

### Unresolved questions (thêm vào 5 câu đã có)

6. **X1**: rebuild hero in-place hay feature-flagged parallel path? **Default: in-place** + commit per variant.
7. **X1**: store grid template trong `GeneratedBlock` props (inline CSS vars) hay expand Zod schema? **Default: inline CSS vars**.
8. **X3**: run server-side (post-composer) hay client-side? **Default: server-side** (retry rẻ hơn).
9. **X4**: partial re-roll vs full re-roll on fail? **Default: partial**, fallback full on 2nd pass.
10. **Cross-cutting**: `applyGlobalSystemBlocks` (`SiteRenderer.tsx:52-78`) có silent overwrite nav regens không? Answer trước khi Phase 03 start.

### ⚠️ Session artifacts lost

Session này em spawn 6 research/verify agents viết tổng cộng ~13 file (researcher-03-wix-forensic-html, researcher-04-wix-velo-studio-docs, researcher-05-competitor-triangulation, verify-plan-cu-refs, verify-dependencies, verify-b1-d1-corrections, 6 phase-x*.md). Các file đó đã disappear do branch bị switch 3 lần giữa session (`variety-retrofit` → `about-richtext-timeline` → `remaining-500-bugs`). Findings chính đã được capture hết trong section này — chi tiết hơn có thể re-run agents nếu cần.
