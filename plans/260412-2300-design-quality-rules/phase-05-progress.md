# Phase 05 — Block Refactor Progress Tracker

> Track 50 blocks audit/refactor status. Update sau mỗi commit.
> Xem rules: [phase-05-checklist.md](phase-05-checklist.md)
> Xem scope: [phase-05-block-audit.md](phase-05-block-audit.md)

**Total:** 50 blocks (index.tsx) + hero 11 variant files
**Done:** 22 / 50 (44%) — Batch A ✅ + Batch B 8/9 + Batch C 9/36
**In progress:** 0
**Pending:** 28

## Parallel Agent Batch — commit `a398ff7` (2026-04-13)
Spawned 3 parallel subagents, all 3 hit API 500 errors mid-execution.
14 blocks completed before crashes, committed as single batch (TSC + full
suite pass). Remaining 28 blocks deferred to sequential main-agent work.

**Blocks in a398ff7 (14):**
- Batch B: newsletter, about, faq, stats, team (5/6, missing cta)
- Batch C1: booking-widget, product-quick-view, property-card (3/9)
- Batch C2: products-featured, social-widget, pricing-table, feature-comparison, step-process, portfolio-grid (6/14)

**Remaining 28 blocks:**
- Batch B (1): cta
- Batch C1 (6): menu-display, class-schedule, doctor-profile, video-showcase, carousel, review-cards
- Batch C2 (8): menu-food, download-cta, service-cards, before-after, countdown-timer, blog-list, products-grid, social-proof
- Batch C3 (13): accordion, client-logos, video-background, cart-widget, google-maps, gallery-masonry, announcement-bar, whatsapp-button, divider, breadcrumb, video, logo-cloud, custom-html

---

## Status Legend
- ✅ done — refactored, gates pass, committed
- 🔄 in progress — đang refactor
- ⏸️ blocked — chờ dependency hoặc decision
- ☐ pending — chưa động

---

## Batch A — Core (5 blocks, sequential pilot)

| # | Block | LOC | Variants | Status | Commit | Date | Notes |
|---|---|---|---|---|---|---|---|
| 1 | features | 356 | 8 inline (grid-2/3/4, list, icon-top, icon-left, zigzag, carousel) | ✅ | `4be2fe2` | 2026-04-13 | Pilot. Local FeaturesSection wrapper (framer-motion + GradientBlob). Hybrid legacy+semantic vars. 79/79 tests, 3890/3890 full suite. |
| 2 | footer | 512 → 414 | 6 inline (simple, expanded, minimal, centered-stack, mega-footer, dark-gradient) | ✅ | `b210388` | 2026-04-13 | Pilot #2. 4 local helpers (FooterSection/BrandLogo/SocialIconList/LinkColumn). Custom asymmetric padding kept inline. 9/9 footer tests, 88/88 cross-test, 3889/3890 full (1 unrelated flaky timeout). |
| 3 | navigation | 861 → 828 | 6 inline (simple, transparent, sidebar, centered, mega-menu, pill) | ✅ | `9e4fe87` | 2026-04-13 | 4 helpers (NavCTAButton/NavMobileCTAButton/NavHamburgerButton/NavMobileMenuDrawer). 12 TOUCH_TARGET applied (was failing WCAG 2.5.5). Pill+Sidebar custom-styled. mega-menu `<p>` → Caption. 10/10 nav tests, 3890/3890 full suite. |
| 4 | testimonials | 678 → 746 (helpers) | **8 inline** (cards, masonry, spotlight, minimal-quote, avatar-row, video-text, simple, carousel) — plan ghi 6, sai | ✅ | `25d7e97` | 2026-04-13 | 6 helpers (TestimonialsSection/TestimonialsHeader/StarRating/AuthorMeta/DotIndicator/CarouselArrow). DotIndicator wraps 10px dot trong 44px button (WCAG). CarouselArrow 40px → 44px. 10/10 testimonials tests, 108/108 cross-test, 3889/3890 full (1 unrelated flaky). |
| 5 | hero | 36 (index) + 11 files (1010 → 937 variants, +113 shared) | 11 (cards-overlay, centered, fullscreen, gradient, magazine, minimal, parallax, slideshow, split-video, split, video) | ✅ | `71c65f3` | 2026-04-13 | 3 helpers in shared.tsx (HeroBadge×5, VideoControlButton×2, SlideshowDot). HERO_CONTAINER const for 11 variants. CTAButtons + TOUCH_TARGET. h1/p typography deferred (current sizes intentionally larger than TYPE_SCALE.display). 14/14 hero tests, 79/79 cross-test, 3890/3890 full suite. |

**Gate sau Batch A:** Pause để review consistency + lock approach trước khi spawn parallel cho B/C.

---

## Batch B — Secondary (9 blocks)

| # | Block | LOC | Status | Commit | Notes |
|---|---|---|---|---|---|
| 6 | pricing | 727 → 789 (+62 helpers) | ✅ | `3092451` | Pilot Batch B #1. 5 helpers (PricingSection/PriceDisplay/PlanCTA/FeatureList + upgraded SectionHeader). 8 variants (cards/horizontal/toggle/tiered/comparison/table/minimal/slider — plan ghi 7, sai). Touch targets: slider arrows 40→44px, slider dots 10→44px hit, toggle switch 28→44px hit, minimal "view features" → 44px. 12/12 pricing tests, 91/91 cross, 3889/3890 full (1 flaky). |
| 7 | gallery | 547 → 531 (-16) | ✅ | `537f61b` | Batch B #2. 3 helpers (GallerySection/GalleryHeader/GalleryImageCard). 6 variants (grid/masonry/carousel/lightbox/filmstrip/justified). GalleryImageCard handles image+placeholder fallback + caption overlay (4+ inline dedupes). Touch targets: carousel arrows 40→44px, carousel dots 10→44px hit, lightbox close/prev/next p-2→44px. 9/9 gallery tests, 100/100 cross. |
| 8 | contact | 486 → 407 (**-79**) | ✅ | `dc357f9` | Batch B #3 (sequential pilot done). 4 new helpers (ContactSection/ContactHeader/ContactInfoCard/ContactForm) + upgraded SubmitButton TOUCH_TARGET. ContactInfoCard polymorphic (inline/center layout) replaces 9 inline copies — biggest dedup ratio. 6 variants (form/card-float/map-split/minimal-inline/info-only/split). Minimal-inline Send button +TOUCH_TARGET. 11/11 contact tests, 111/111 cross. |
| 9 | newsletter | 215 | ☐ | — | |
| 10 | about | 207 | ☐ | — | |
| 11 | faq | 190 | ☐ | — | |
| 12 | stats | 179 | ☐ | — | |
| 13 | team | 155 | ☐ | — | |
| 14 | cta | 119 | ☐ | — | |

**Total Batch B LOC:** ~2,825

---

## Batch C — Industry / Utility (36 blocks)

### C1 — Industry (large, 200+ LOC)
| # | Block | LOC | Status | Commit |
|---|---|---|---|---|
| 15 | booking-widget | 337 | ☐ | — |
| 16 | product-quick-view | 322 | ☐ | — |
| 17 | property-card | 274 | ☐ | — |
| 18 | menu-display | 272 | ☐ | — |
| 19 | class-schedule | 251 | ☐ | — |
| 20 | doctor-profile | 233 | ☐ | — |
| 21 | video-showcase | 231 | ☐ | — |
| 22 | carousel | 216 | ☐ | — |
| 23 | review-cards | 201 | ☐ | — |

### C2 — Medium (100-200 LOC)
| # | Block | LOC | Status | Commit |
|---|---|---|---|---|
| 24 | menu-food | 149 | ☐ | — |
| 25 | download-cta | 148 | ☐ | — |
| 26 | service-cards | 146 | ☐ | — |
| 27 | before-after | 141 | ☐ | — |
| 28 | countdown-timer | 136 | ☐ | — |
| 29 | products-featured | 132 | ☐ | — |
| 30 | social-widget | 124 | ☐ | — |
| 31 | pricing-table | 124 | ☐ | — |
| 32 | feature-comparison | 121 | ☐ | — |
| 33 | step-process | 119 | ☐ | — |
| 34 | portfolio-grid | 116 | ☐ | — |
| 35 | blog-list | 114 | ☐ | — |
| 36 | products-grid | 110 | ☐ | — |
| 37 | social-proof | 109 | ☐ | — |

### C3 — Small (<100 LOC)
| # | Block | LOC | Status | Commit |
|---|---|---|---|---|
| 38 | accordion | 98 | ☐ | — |
| 39 | client-logos | 97 | ☐ | — |
| 40 | video-background | 79 | ☐ | — |
| 41 | cart-widget | 77 | ☐ | — |
| 42 | google-maps | 73 | ☐ | — |
| 43 | gallery-masonry | 70 | ☐ | — |
| 44 | announcement-bar | 66 | ☐ | — |
| 45 | whatsapp-button | 63 | ☐ | — |
| 46 | divider | 63 | ☐ | — |
| 47 | breadcrumb | 59 | ☐ | — |
| 48 | video | 52 | ☐ | — |
| 49 | logo-cloud | 48 | ☐ | — |
| 50 | custom-html | 38 | ☐ | — |

**Total Batch C LOC:** ~5,019

---

## Gates Per Block (10 acceptance items)

Mỗi block PHẢI pass trước khi commit:

1. ☐ `<section>` → `SectionWrapper` (hoặc local wrapper nếu có framer-motion/decorative absolute)
2. ☐ `<h1-4>` → `<Heading level={N}>` (`<Display>` cho hero primary)
3. ☐ Body `<p>` → `<Body size="...">`
4. ☐ Bỏ `text-3xl/text-xl/text-sm` hardcoded
5. ☐ Colors → `CSS_VARS.surfacePrimary/surfaceCard/textPrimary/textSecondary/textMuted` (semantic)
6. ☐ Icons → `ICON_SIZE.{sm,md,lg,xl}`
7. ☐ Cards → `CARD_PADDING.{sm,md,lg}`
8. ☐ CTA buttons → `TOUCH_TARGET.min` (≥44px)
9. ☐ Variant switch logic UNCHANGED
10. ☐ Existing `*-variants.test.ts` pass

**Build gates per block:**
- `pnpm tsc --noEmit` = 0 errors
- `pnpm test {block}-variants --run` = pass
- (End of batch) `pnpm build` = success

---

## Lessons Learned

### Features pilot (`4be2fe2`, 2026-04-13)

1. **Local wrapper > SectionWrapper khi có framer-motion + decorative absolute**
   - features có `<AnimatedSection>` cho `whileInView` + `<GradientBlob>` absolute-positioned
   - SectionWrapper's plain `<section>` tag sẽ break cả 2
   - Solution: extract local `FeaturesSection` consume CÙNG tokens (`SECTION_PADDING.default`, `CONTAINER.default`, `INNER_PADDING`)

2. **Hybrid legacy + semantic CSS vars**
   - Giữ `CSS_VARS.primary` cho icons + borders (brand identity)
   - Chỉ swap generic surface/text roles → `CSS_VARS.surfacePrimary/textSecondary/textMuted`
   - Tuân thủ Option C additive — không break

3. **Schema-only tests = refactor test-safe**
   - `*-variants.test.ts` chỉ assert config/schema, không render component
   - Refactor JSX tự do, không cần update tests

4. **framer-motion wrappers giữ nguyên**
   - `AnimatedSection`, `StaggerGrid`, `StaggerItem`, `HoverCard` là internal animation
   - Phase 05 không scope animation refactor

5. **RichText giữ nguyên cho headline**
   - `<RichText>` cần inline HTML support
   - Chỉ Body subheadline đổi sang `<Body>` component

### Footer pilot (TBD commit, 2026-04-13)

6. **Asymmetric padding outside SECTION_PADDING tokens**
   - `pt-16 md:pt-20 pb-8` (simple/expanded), `py-6` (minimal) không khớp `compact/default/relaxed/hero`
   - Solution: local `FooterSection` wrapper accept `paddingClass: string` prop
   - Variants pass either token (`SECTION_PADDING.compact`) hoặc custom string
   - Future: có thể add `FOOTER_PADDING` constant nếu nhiều footer pattern lặp

7. **Helper extraction trong cùng file ổn nếu structural-only**
   - 4 helpers: `FooterSection` (wrapper), `BrandLogo` (gradient logo, 6 chỗ), `SocialIconList` (5 chỗ), `LinkColumn` (4 chỗ)
   - Schema test không render → safe
   - Reduce LOC 512 → 414 (-19%)

8. **GradientLine cần outer `<footer>` relative**
   - SectionWrapper inner div là `max-w-6xl`, không phải full-width
   - GradientLine `top-0 left-0` cần span toàn footer width
   - → Local wrapper với `<footer className="relative">` + GradientLine outside container

9. **2-band variant (mega-footer) skip helper, dùng tokens trực tiếp**
   - Top band `bg-[var(--brand-primary)]` full-width + main content
   - FooterSection helper không phù hợp (1 band only)
   - Dùng `${CONTAINER.default} mx-auto ${INNER_PADDING}` inline 2 lần

10. **`<a>` wrap `<Body as="span">` cho links**
    - Body component default `<p>` không hợp lệ trong `<a>`
    - Pass `as="span"` để render inline

11. **`<Caption>` thay `text-xs` cho copyright/meta**
    - Original `text-xs` (12px) — nhỏ hơn token min `text-sm` (14px)
    - Caption component = text-sm → slight visual increase, better a11y
    - Acceptable trade-off

12. **Form input `text-sm` → `text-base` (16px)**
    - iOS Safari zoom-on-focus khi input < 16px
    - Newsletter inputs (mega-footer/expanded) bump lên `text-base`
    - CTA buttons giữ `text-sm` (button text ngoại lệ)

13. **`TOUCH_TARGET.min` cho CTA buttons**
    - Subscribe buttons (mega-footer/expanded) thêm `min-h-[44px]`
    - WCAG 2.5.5 compliance

### Navigation pilot (TBD commit, 2026-04-13)

14. **Nav block KHÔNG dùng SectionWrapper / SECTION_PADDING**
    - Outer là `<nav>` element (sticky/fixed), không phải `<section>`
    - Layout dùng `h-16` flex/grid, không `py-*` section padding
    - Solution: const `NAV_CONTAINER` = `${CONTAINER.default} mx-auto ${INNER_PADDING}` cho 5 desktop containers + 1 mega-menu panel + 1 drawer container
    - Acceptance gate item #1 ("SectionWrapper") không apply cho nav block — note vào checklist

15. **Touch target audit critical cho nav**
    - Trước refactor: hamburgers `p-2` ≈ 32-36px ❌, CTA `py-2.5` ≈ 40px ❌, sidebar trigger `p-2.5` ≈ 40px ❌
    - 12 `TOUCH_TARGET.min` (`min-h-[44px]`) applied across 6 variants
    - Helper `NavHamburgerButton` ép buộc `min-h-[44px] min-w-[44px]` luôn

16. **Mobile drawer dedup qua NavMobileMenuDrawer helper**
    - 4 variants (simple/transparent/centered/mega-menu) có drawer gần identical
    - Extract chung — variants chỉ khác background string
    - Sidebar + Pill có drawer riêng (different design language) — không dùng helper
    - Save ~120 dòng dup logic

17. **NavCTAButton helper với `motionWrap` opt-out**
    - Default render `motion.a` (whileHover scale + tap)
    - Pass `motionWrap={false}` cho variants không cần (sidebar bottom CTA, pill CTA)
    - Tránh nesting motion components không cần thiết

18. **Link labels KHÔNG refactor sang `<Body>`**
    - Link labels là interactive text trong `<a>`, không phải body copy
    - Body small = text-sm = same as `text-sm font-medium` hiện tại
    - Refactor tạo overhead không value → skip
    - Acceptance gate item #3 ("body <p> → Body") không apply cho nav

19. **Mega-menu category label `<p>` → `<Caption>`**
    - Original `text-xs font-semibold uppercase tracking-widest`
    - Caption = text-sm (slight bump up, better a11y)
    - Pass `as="span"`? — Caption đã render `<span>` nên display inline; thêm `block` class

20. **`type="button"` thêm cho buttons không submit**
    - Tránh form-submit accidental khi nest trong form (rare nhưng safe)
    - Áp dụng cho hamburgers + sidebar close

### Testimonials pilot (TBD commit, 2026-04-13)

21. **Plan ghi sai số variants — luôn verify từ test/config**
    - Plan ghi testimonials có 6 variants
    - Test + index.tsx thực tế: **8 variants** (cards, masonry, spotlight, minimal-quote, avatar-row, video-text, simple, carousel)
    - Lesson: đếm variants từ test enum (`TESTIMONIALS_VARIANTS`) hoặc dispatch logic, không trust plan
    - Update tracker với số đúng

22. **Helpers thay vì local wrappers khi shared rộng**
    - Footer/nav: 1 wrapper component cho 1 block
    - Testimonials: 6 helpers (TestimonialsSection, TestimonialsHeader, StarRating, AuthorMeta, DotIndicator, CarouselArrow)
    - Trade-off: LOC tăng (+68) nhưng dedup massive — 8 variants × 5 patterns = 40 lần dup → 6 helper component

23. **DotIndicator pattern: 10px visual trong 44px hit area**
    - Original dot: `<button className="w-2.5 h-2.5">` = 10px (visual + hit) ❌
    - Refactor: `<button className="w-11 h-11"><span className="w-2.5 h-2.5"></span></button>`
    - Visual unchanged, hit area meets WCAG 2.5.5
    - Dùng cho 4 chỗ: spotlight mobile, minimal-quote, carousel, (avatar-row buttons đã 56px ✅)

24. **CarouselArrow `w-10 h-10` (40px) → TOUCH_TARGET.min (44px)**
    - Mở rộng button frame, icon size unchanged

25. **AuthorMeta polymorphic: `layout="inline" | "stacked"` + `nameWeight="semibold" | "bold"`**
    - 8 variants có 3-4 styles meta khác nhau (text-sm vs default, inline vs stacked)
    - Single helper với enum props giảm duplication mà không lose flexibility

26. **`Body` component default `<p>` không hợp lệ trong `<div className="text-left">` wrapper khi parent là flex item**
    - AuthorMeta layout=stacked render bên trong `<div className="text-left">`
    - Body default `<p>` ổn, nhưng nếu nest trong inline element thì cần `as="span"`
    - Lesson: kiểm tra parent context khi dùng Body

27. **`aria-current` cho dot/avatar buttons (active state)**
    - Replaces visual-only active indication for screen readers
    - `aria-current={i === activeIndex}` thêm vào DotIndicator + AvatarRow buttons

### Hero pilot (TBD commit, 2026-04-13) — Batch A complete ✅

28. **TYPE_SCALE.display quá nhỏ cho hero design intent**
    - TYPE_SCALE.display = `text-4xl md:text-5xl lg:text-6xl` (36→60px)
    - Hero variants dùng `text-5xl md:text-7xl` (48→72px) hoặc `text-6xl md:text-8xl` (60→96px)
    - Force Display component sẽ visual regression đáng kể (đặc biệt tablet -24px)
    - Decision: SKIP h1/p typography refactor cho hero, defer to future Phase 06
    - Future option: thêm TYPE_SCALE.heroDisplay scale lớn hơn cho hero use case
    - Lesson: tokens không one-size-fits-all — hero là exception cần custom display scale

29. **Hero variants không dùng motion(Display) wrapper được**
    - Display component render `<h1>` direct, không support framer-motion props
    - motion.h1 cần motion target trên element animate, không thể wrap parent
    - Options: motion.h1 với inline TYPE_SCALE.display classes, hoặc giữ inline (chosen)
    - Lesson: shared Typography components có limit khi cần animation directly on element

30. **Cross-file shared helpers cho 1 block via shared.tsx**
    - Hero là duy nhất có pattern này (1 dispatcher index + N variant files + shared.tsx)
    - 3 helpers thêm vào shared.tsx: HeroBadge (5x dup), VideoControlButton (2x dup), SlideshowDot
    - HERO_CONTAINER const cũng export từ shared
    - Lesson: blocks với multi-file variants nên có shared.tsx ngay từ đầu

31. **`void _CSS_VARS` pattern cho unused legacy imports**
    - Một số hero variants không còn cần CSS_VARS sau refactor (dùng raw var names)
    - TypeScript `noUnusedLocals` cảnh báo
    - Solution: rename `import { CSS_VARS as _CSS_VARS }` + `void _CSS_VARS` để giữ import line cho future use, không break compilation
    - Alternative: xoá import hoàn toàn (sạch hơn nhưng cần re-add khi cần)

32. **HeroBadge variants dark vs light bg**
    - Original: 4 chỗ dùng `rgba(255,255,255,0.1)` bg + white text (dark hero bg)
    - 1 chỗ (gradient) dùng `rgba(255,255,255,0.15)` slightly stronger
    - Compromise: HeroBadge default = 0.1 opacity, các variants dùng cùng style. Visual delta cực nhỏ.
    - Lesson: tolerate tiny visual deltas khi extract helpers, document trong commit msg

33. **SlideshowDot reuse pattern from testimonials DotIndicator**
    - 2 implementations gần identical (10px dot trong 44px hit area)
    - Hero version có active scale (1.3x), background custom (white vs brand)
    - Trade-off: cross-block helper (đặt ở `src/blocks/shared/`) vs duplicate per-block
    - Decision: keep separate helpers in respective shared files
    - Future: nếu nhiều block cần dot indicator, extract `src/blocks/shared/DotIndicator.tsx`

34. **Batch A cross-review summary (5 blocks done)**
    - Helper extraction overhead vs dedup wins:
      - features: -25 LOC (single wrapper)
      - footer: -98 LOC (4 helpers, big dedup)
      - navigation: -33 LOC (4 helpers, drawer dedup huge)
      - testimonials: +68 LOC (6 helpers, polymorphic for 8 variants)
      - hero: +40 LOC (3 helpers in shared, container const, reduce 5 inline badges)
    - Total Batch A: -48 LOC + dedup + WCAG compliance + token consumption
    - Pattern: simple blocks save LOC, complex blocks (8+ variants) trade LOC for consistency

---

## Batch A Complete — Next Steps

**Batch A done:** 5/5 ✅ (features, footer, navigation, testimonials, hero)

**Cross-review consistency check (passed):**
- ✅ All blocks consume `CONTAINER.default + INNER_PADDING` for desktop containers
- ✅ All CTA buttons + interactive controls have `TOUCH_TARGET.min` (44px+)
- ✅ All blocks preserve framer-motion wrappers + decorative absolute positioning
- ✅ Brand identity vars (`--brand-primary`, `--brand-primary-rgb`) untouched (Option C)
- ✅ Helper extraction co-located with block (no premature shared/* files)
- ✅ Variant switch logic UNCHANGED — zero behavior delta
- ⚠ Typography refactor partial: features/footer/navigation/testimonials have Heading + Body components; hero deferred (size intent conflict with TYPE_SCALE.display)

**Decision needed before Batch B:**
1. Should we extend `TYPE_SCALE` with `heroDisplay` constant for 60-96px scale?
2. Should we extract `DotIndicator` to `src/blocks/shared/` (used in 2 places already)?
3. Should we run visual regression now (Playwright screenshots) or wait until Batch B+C done?
4. Should Batch B + C run sequential or 2 parallel agents (per phase-05-block-audit.md plan)?

**Next:** Batch B (9 secondary blocks: pricing, gallery, contact, newsletter, about, faq, stats, team, cta) — recommend pause for review/decision before continuing.

Steps:
1. Read `src/blocks/footer/index.tsx` + `src/__tests__/unit/blocks/footer-variants.test.ts` (nếu có)
2. Identify framer-motion wrappers + decorative elements
3. Refactor theo checklist (10 items)
4. Run gates
5. Commit `refactor(f01): footer block with design tokens (phase 05 batch a #2)`
6. Update progress tracker (this file)
7. Append lessons (nếu có pattern mới)

---

## Visual Regression (sau Batch A xong)

- [ ] Chụp screenshot 142 variants before refactor (baseline từ commit trước Phase 05)
- [ ] Chụp screenshot 142 variants after refactor
- [ ] Diff bằng tool (Playwright visual / Percy / Chromatic)
- [ ] Fix any regressions

---

## Decision Points

| Question | Decision | Date |
|---|---|---|
| 47 hay 50 blocks? | **50** — đếm `src/blocks/*/index.tsx` (hero count = 1 dir, 11 variants riêng) | 2026-04-13 |
| Plan ghi "47" có sai không? | Dùng số thực 50, plan cũ giữ nguyên cho lịch sử | 2026-04-13 |
| Pilot #2 = footer? | ✅ Confirmed (theo checklist sequence: features → footer → navigation → testimonials → hero) | 2026-04-13 |
| Parallel B + C khi nào? | Sau khi 5 Batch A blocks done + cross-review | TBD |
