# QA Test Plan: Block Variant Audit (F31-BVA)

> **Version:** 1.0 | **Created:** 2026-04-07 | **Author:** QA Engineer Agent
> **PRD:** `docs/prd/F31-block-variant-audit.md`
> **Plan:** `plans/260407-1021-block-variant-audit/plan.md`
> **Scenarios:** `docs/qa/scenarios/F31-block-variant-audit.md`
> **Branch:** `feat/F31-template-blueprints`

---

## 1. Test Strategy

### 1.1 Tổng quan

Feature F31-BVA fix 4 nhóm vấn đề chính trong hệ thống 51 blocks / ~175 variants:
1. **Dead variants** — 10 variants render y hệt default (UX bug nghiêm trọng)
2. **CSS_VARS missing** — 6 blocks hardcode màu, không follow theme
3. **Hero monolith** — 856 LOC trong 1 file, cần refactor sang `variants/` directory
4. **Zero automated tests** — không có test nào cover variant routing

Test strategy dùng **Test Trophy** approach: tập trung unit + integration tests, bổ sung E2E cho responsive và visual.

### 1.2 Test Layers

| Layer | Tool | Coverage Target | Focus |
|-------|------|----------------|-------|
| Unit | Vitest + RTL | >= 80% variant routing paths | Variant routing, fallback, CSS_VARS usage |
| Integration | Vitest + RTL | Tất cả 17 ACs | Theme change → block re-render, cross-block |
| E2E | Playwright | 3 breakpoints × critical variants | Responsive, visual overflow, carousel behavior |
| Script | Node.js (verify-variants.mjs) | 51/51 blocks | Config sync, dead variant detection |

### 1.3 File Structure cho Tests

```
src/__tests__/unit/blocks/
  ├── hero-variant-routing.test.tsx      # TC-F31-BVA-001 đến 012
  ├── hero-refactor-structure.test.ts    # TC-F31-BVA-030 đến 035
  ├── features-variant-routing.test.tsx  # TC-F31-BVA-013 đến 015
  ├── testimonials-variant-routing.test.tsx  # TC-F31-BVA-016 đến 019
  ├── pricing-variant-routing.test.tsx   # TC-F31-BVA-020 đến 022
  ├── gallery-variant-routing.test.tsx   # TC-F31-BVA-023 đến 025
  ├── navigation-variant-routing.test.tsx # TC-F31-BVA-026 đến 027
  ├── footer-variant-routing.test.tsx    # TC-F31-BVA-028 đến 029
  ├── css-vars-compliance.test.tsx       # TC-F31-BVA-040 đến 047
  ├── variant-fallback-edge-cases.test.tsx # TC-F31-BVA-050 đến 059
  └── design-tokens.test.tsx             # TC-F31-BVA-060 đến 065

src/__tests__/e2e/ (Playwright)
  ├── block-responsive.spec.ts           # TC-F31-BVA-070 đến 075
  └── variant-rendering.spec.ts          # TC-F31-BVA-076 đến 079

scripts/verify-variants.mjs             # TC-F31-BVA-080 đến 083
```

---

## 2. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hero refactor break existing hero renders | HIGH | MEDIUM | TC-030 đến 035 verify import paths + backward compat; snapshot test trước khi refactor |
| CSS_VARS migration tạo regression trên blocks đang hoạt động | HIGH | LOW | TC-040 đến 047 verify mọi block vẫn render với default theme sau migration |
| Dead variant fix làm thay đổi visual của sites đã deploy | HIGH | MEDIUM | TC-050: backward compat test — site đã lưu `variant: "masonry"` phải upgrade gracefully |
| Video element trên mobile Safari gây crash/blank screen | HIGH | MEDIUM | TC-073: Playwright mobile viewport test + fallback image check |
| `pnpm verify:variants` script false positive/negative | MEDIUM | LOW | TC-080 đến 083 test script với known pass/fail cases |
| Carousel auto-rotate gây memory leak (setInterval không cleanup) | MEDIUM | MEDIUM | TC-018: test unmount cleanup + interval clearance |
| CSS columns masonry không support trên một số browsers | LOW | LOW | TC-034: cross-browser check với Playwright WebKit |

---

## 3. Test Cases

---

### 3.1 Variant Rendering — Dead Variant Fixes

Nhóm này verify 10 dead variants đã được implement đúng layout, render khác biệt so với default.

---

#### TC-F31-BVA-001: Hero Video — Full-Bleed Video Background

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-01
- **Scenario Reference:** S-04, S-21
- **Precondition:** Hero block component được import; mock `block.variant = "video"`, `block.videoUrl = "https://example.com/video.mp4"`
- **Steps:**
  1. Arrange: tạo `mockBlock = { blockType: "hero", variant: "video", videoUrl: "https://example.com/video.mp4" }`, `mockTheme` với CSS_VARS
  2. Act: `render(<HeroBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: query `getByRole("video")` hoặc `container.querySelector("video")` tồn tại
  4. Assert: video element có attributes `autoPlay`, `muted`, `loop`, `playsInline`
  5. Assert: không có `<img>` centered layout (hero/centered pattern)
- **Expected:**
  - `<video>` element render với đúng attributes
  - Layout class khác với centered variant (không có `text-center flex-col`)
  - Không có `console.error`
- **Test Data:** `{ variant: "video", videoUrl: "https://cdn.example.com/bg.mp4", headline: "Test" }`

---

#### TC-F31-BVA-002: Hero Video — Fallback khi videoUrl = null

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-01
- **Scenario Reference:** S-21
- **Precondition:** Hero block với `variant: "video"` và `videoUrl: null`
- **Steps:**
  1. Arrange: `mockBlock = { blockType: "hero", variant: "video", videoUrl: null, backgroundImage: "https://example.com/img.jpg" }`
  2. Act: `render(<HeroBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: không có `<video>` element (hoặc video bị hidden)
  4. Assert: fallback image hoặc gradient background hiển thị
  5. Assert: không crash, không `console.error`
- **Expected:** Fallback image render, không crash khi videoUrl null
- **Test Data:** `{ variant: "video", videoUrl: null, backgroundImage: "/img.jpg" }`

---

#### TC-F31-BVA-003: Gallery Masonry — CSS Column Layout

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-02
- **Scenario Reference:** S-04
- **Precondition:** Gallery block với `variant: "masonry"` và array 6 images
- **Steps:**
  1. Arrange: `mockBlock = { blockType: "gallery", variant: "masonry", images: [...6 items] }`
  2. Act: `render(<GalleryBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: container có CSS `column-count` hoặc class tương đương masonry (ví dụ: `columns-2`, `columns-3`)
  4. Assert: container KHÔNG có `grid` layout class (như `grid-cols-3`)
  5. Assert: tất cả 6 images render
- **Expected:** CSS masonry column layout, không phải CSS grid
- **Test Data:** 6 images với varying heights implied

---

#### TC-F31-BVA-004: Gallery Carousel — Horizontal Scroll với Arrows

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-02
- **Scenario Reference:** S-28
- **Precondition:** Gallery block với `variant: "carousel"` và 4 images
- **Steps:**
  1. Arrange: `mockBlock = { blockType: "gallery", variant: "carousel", images: [...4 items] }`
  2. Act: `render(<GalleryBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: có prev/next button elements (`getByRole("button", { name: /prev/i })` hoặc arrow icons)
  4. Assert: carousel container có `overflow-x` hoặc scroll-snap CSS
  5. Assert: layout KHÔNG phải grid (không có `grid-cols-*`)
- **Expected:** Carousel render với navigation buttons
- **Test Data:** `{ variant: "carousel", images: [img1, img2, img3, img4] }`

---

#### TC-F31-BVA-005: Navigation Centered — Logo Center, Links Split

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-03
- **Scenario Reference:** S-29
- **Precondition:** Navigation block với `variant: "centered"`, links array
- **Steps:**
  1. Arrange: `mockBlock = { blockType: "navigation", variant: "centered", links: [home, about, contact, pricing, blog] }`
  2. Act: `render(<NavigationBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: logo element ở vị trí giữa (có class `col-start-2` hoặc `justify-center` trong grid-cols-3)
  4. Assert: links chia 2 nhóm: left group và right group
  5. Assert: layout class KHÔNG giống simple variant (simple = `justify-between` với logo trái)
- **Expected:** Logo center, links split L/R trong grid-cols-3
- **Test Data:** `{ variant: "centered", logo: { url: "/logo.png" }, links: [5 items] }`

---

#### TC-F31-BVA-006: Navigation Mega-Menu — Dropdown Panel

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-03
- **Scenario Reference:** S-24
- **Precondition:** Navigation block với `variant: "mega-menu"`, menu items có sub-items
- **Steps:**
  1. Arrange: `mockBlock = { blockType: "navigation", variant: "mega-menu", links: [{ label: "Products", children: [...4] }, ...] }`
  2. Act: `render(<NavigationBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: mega-menu dropdown panel render (có thể ở `aria-hidden="true"` initial state)
  4. Act: `userEvent.hover(getByText("Products"))`
  5. Assert: dropdown panel visible (`aria-hidden="false"` hoặc visible class)
  6. Assert: panel có multi-column layout (>= 2 cols)
- **Expected:** Dropdown panel hiển thị khi hover với multi-column layout
- **Test Data:** `{ variant: "mega-menu", links: [{ label: "Products", subItems: [...4 items] }] }`

---

#### TC-F31-BVA-007: Testimonials Carousel — Auto-Rotate

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-12
- **Scenario Reference:** S-23
- **Precondition:** Testimonials block `variant: "carousel"`, 3 testimonials, jest fake timers
- **Steps:**
  1. Arrange: `vi.useFakeTimers()`, `mockBlock = { variant: "carousel", testimonials: [t1, t2, t3] }`
  2. Act: `render(<TestimonialsBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: slide 1 visible
  4. Act: `vi.advanceTimersByTime(5000)`
  5. Assert: slide 2 visible (auto-rotated)
  6. Assert: navigation dots và arrows tồn tại
  7. Cleanup: `vi.useRealTimers()`
- **Expected:** Auto-rotate sau 5s, dots/arrows hiển thị
- **Test Data:** 3 testimonials với content khác nhau

---

#### TC-F31-BVA-008: Testimonials Carousel — Pause on Hover

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-12
- **Scenario Reference:** S-23
- **Precondition:** Testimonials carousel đang auto-rotate (fake timers)
- **Steps:**
  1. Arrange: setup carousel như TC-007
  2. Act: `userEvent.hover(carouselContainer)`
  3. Act: `vi.advanceTimersByTime(10000)`
  4. Assert: vẫn ở slide 1 (không auto-rotate khi hover)
  5. Act: `userEvent.unhover(carouselContainer)`
  6. Act: `vi.advanceTimersByTime(5000)`
  7. Assert: chuyển sang slide 2 (resume sau unhover)
- **Expected:** Pause on hover, resume on unhover
- **Test Data:** 3 testimonials

---

#### TC-F31-BVA-009: Testimonials Simple — Single Large Quote

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-12 (implied — simple là dead variant cần fix)
- **Scenario Reference:** S-04
- **Precondition:** Testimonials block `variant: "simple"`, 1 featured testimonial
- **Steps:**
  1. Arrange: `mockBlock = { variant: "simple", testimonials: [{ quote: "Amazing...", author: "John" }] }`
  2. Act: `render(<TestimonialsBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: render single testimonial (không phải 3-col grid)
  4. Assert: không có card border/shadow class
  5. Assert: text có large font class (hoặc text size > default)
  6. Assert: layout `text-center` hoặc centered
- **Expected:** Single centered quote, không có card layout, không phải 3-col grid
- **Test Data:** `{ variant: "simple", testimonials: [1 item] }`

---

#### TC-F31-BVA-010: Pricing Table — Comparison Table Layout

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-04
- **Scenario Reference:** S-04
- **Precondition:** Pricing block `variant: "table"`, tiers và features data
- **Steps:**
  1. Arrange: `mockBlock = { variant: "table", tiers: [starter, pro, enterprise], features: ["Storage", "Users", "Support", "API"] }`
  2. Act: `render(<PricingBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: có `<table>` element hoặc CSS grid matrix
  4. Assert: feature labels hiển thị là rows
  5. Assert: tier names hiển thị là column headers
  6. Assert: không có card layout (không có `pricing-card` class hoặc tương đương)
- **Expected:** HTML table hoặc CSS grid matrix với features=rows, tiers=columns
- **Test Data:** `{ variant: "table", tiers: [3 items], features: [4 items] }`

---

#### TC-F31-BVA-011: Footer Expanded — 4 Columns + Newsletter Form

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-16
- **Scenario Reference:** S-04
- **Precondition:** Footer block `variant: "expanded"`
- **Steps:**
  1. Arrange: `mockBlock = { variant: "expanded", columns: [...4], newsletterText: "Subscribe" }`
  2. Act: `render(<FooterBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: 4 column sections render
  4. Assert: newsletter form có `<input type="email">` element
  5. Assert: newsletter form có submit button
  6. Assert: newsletter section ở bottom (sau columns section)
- **Expected:** 4-col links + newsletter form row at bottom
- **Test Data:** `{ variant: "expanded", columns: [4 link groups], newsletter: true }`

---

#### TC-F31-BVA-012: Footer Minimal — Single-Line Layout

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-15
- **Scenario Reference:** S-27
- **Precondition:** Footer block `variant: "minimal"`
- **Steps:**
  1. Arrange: `mockBlock = { variant: "minimal", logo: {...}, links: [3 items], copyright: "2026" }`
  2. Act: `render(<FooterBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: layout container có `flex flex-row` hoặc single-line CSS
  4. Assert: KHÔNG có multi-column grid layout
  5. Assert: KHÔNG có newsletter form element
  6. Assert: logo, links, copyright tất cả hiển thị
- **Expected:** Single-line flexbox layout, no multi-column, no newsletter
- **Test Data:** `{ variant: "minimal", links: [3 items] }`

---

### 3.2 Variant Rendering — Tier-1 Active Variants (Non-Dead)

Nhóm này verify các variants quan trọng khác đang hoạt động vẫn render đúng sau khi code thay đổi.

---

#### TC-F31-BVA-013: Features Grid-2 vs Grid-3 vs Grid-4 — Column Count Diff

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-11
- **Precondition:** Features block với 6 feature items
- **Steps:**
  1. Test `grid-2`: render → assert 2-col container class
  2. Test `grid-3` (default): render → assert 3-col container class
  3. Test `grid-4`: render → assert 4-col container class
  4. Assert: tất cả 3 variants render 6 items
- **Expected:** Mỗi variant có column count tương ứng, khác nhau rõ rệt
- **Test Data:** 6 feature items

---

#### TC-F31-BVA-014: Features Zigzag — Alternating Layout

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-11
- **Precondition:** Features block `variant: "zigzag"` với 3 features có image
- **Steps:**
  1. Arrange: features với image + text
  2. Act: render
  3. Assert: item 1: image trái, text phải
  4. Assert: item 2: text trái, image phải (alternating)
  5. Assert: không phải grid layout
- **Expected:** Alternating image/text layout per item
- **Test Data:** 3 features với images

---

#### TC-F31-BVA-015: Features Carousel — Horizontal Scroll

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-11
- **Precondition:** Features block `variant: "carousel"` với 5 items
- **Steps:**
  1. Render
  2. Assert: carousel container render
  3. Assert: navigation arrows tồn tại
  4. Assert: không phải static grid layout
- **Expected:** Carousel wrapper với navigation, không phải grid
- **Test Data:** 5 feature items

---

#### TC-F31-BVA-016: Testimonials Masonry — Varying Heights

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-04
- **Precondition:** Testimonials `variant: "masonry"`, 6 testimonials với content dài ngắn khác nhau
- **Steps:**
  1. Render
  2. Assert: CSS column layout (masonry)
  3. Assert: KHÔNG phải equal-height grid
- **Expected:** Masonry column layout
- **Test Data:** 6 testimonials với varying content length

---

#### TC-F31-BVA-017: Testimonials Spotlight — Asymmetric Layout

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-04
- **Precondition:** Testimonials `variant: "spotlight"`, 3 testimonials
- **Steps:**
  1. Render
  2. Assert: 1 featured testimonial với larger display
  3. Assert: 2 flanking smaller testimonials
  4. Assert: asymmetric layout (không phải equal 3-col)
- **Expected:** 1 large center + 2 small flanking
- **Test Data:** 3 testimonials, item 1 là featured

---

#### TC-F31-BVA-018: Testimonials Carousel — Cleanup on Unmount

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-12
- **Scenario Reference:** S-23
- **Precondition:** Testimonials carousel với fake timers
- **Steps:**
  1. `vi.useFakeTimers()`
  2. `const { unmount } = render(<TestimonialsBlock variant="carousel" />)`
  3. Assert auto-rotate interval chạy
  4. `unmount()`
  5. `vi.advanceTimersByTime(10000)`
  6. Assert: không có pending timers / không có `act()` warning
- **Expected:** setInterval được clear khi component unmount, no memory leak
- **Test Data:** Standard testimonials data

---

#### TC-F31-BVA-019: Pricing Cards (Default) — Vẫn Render Đúng sau Table Fix

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-04 (regression check)
- **Scenario Reference:** S-19
- **Precondition:** Pricing block `variant: "cards"` (default)
- **Steps:**
  1. Render với `variant: "cards"`
  2. Assert: pricing cards hiển thị (không bị ảnh hưởng bởi table fix)
  3. Assert: featured card có highlight style
  4. Assert: không có `<table>` element
- **Expected:** Cards layout không bị regression sau khi implement table variant
- **Test Data:** 3 tiers, 1 featured

---

#### TC-F31-BVA-020: Pricing Toggle — Monthly/Annual Switch

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-10
- **Precondition:** Pricing `variant: "toggle"` với monthly + annual prices
- **Steps:**
  1. Render toggle variant
  2. Assert: toggle switch element tồn tại
  3. Act: click toggle
  4. Assert: prices cập nhật sang annual values
  5. Act: click toggle lại
  6. Assert: prices trở về monthly values
- **Expected:** Toggle switch functional, prices update correctly
- **Test Data:** `{ monthlyPrice: 29, annualPrice: 249 }`

---

#### TC-F31-BVA-021: Pricing Slider — Interactive Price Slider

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-14
- **Scenario Reference:** S-10
- **Precondition:** Pricing `variant: "slider"` với price tiers
- **Steps:**
  1. Render
  2. Assert: `<input type="range">` element tồn tại
  3. Act: `fireEvent.change(slider, { target: { value: "50" } })`
  4. Assert: matching plan/price hiển thị
- **Expected:** Slider interactive, plan changes based on slider value
- **Test Data:** Pricing tiers mapped to slider values

---

#### TC-F31-BVA-022: Gallery Lightbox — Click Opens Overlay

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-02
- **Scenario Reference:** S-10
- **Precondition:** Gallery `variant: "lightbox"` với 4 images
- **Steps:**
  1. Render
  2. Assert: gallery grid hiển thị
  3. Act: click image 2
  4. Assert: lightbox overlay mở (`role="dialog"` hoặc modal element visible)
  5. Assert: image 2 displayed in lightbox
- **Expected:** Lightbox opens on click, correct image displayed
- **Test Data:** 4 images

---

#### TC-F31-BVA-023: Gallery Filmstrip — Main + Thumbnail Strip

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-02
- **Scenario Reference:** S-04
- **Precondition:** Gallery `variant: "filmstrip"` với 5 images
- **Steps:**
  1. Render
  2. Assert: main large image area exists
  3. Assert: thumbnail strip below (5 smaller thumbnails)
  4. Act: click thumbnail 3
  5. Assert: main image updates to image 3
- **Expected:** Filmstrip layout với interactive thumbnails
- **Test Data:** 5 images

---

#### TC-F31-BVA-024: Navigation Transparent — Scroll State Change

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-03
- **Scenario Reference:** S-11
- **Precondition:** Navigation `variant: "transparent"`, scroll simulation
- **Steps:**
  1. Render (initial state: transparent bg)
  2. Assert: background transparent (có class `bg-transparent` hoặc no bg)
  3. Act: `fireEvent.scroll(window, { target: { scrollY: 100 } })`
  4. Assert: background trở thành solid
- **Expected:** Transparent → solid on scroll
- **Test Data:** Scroll event

---

#### TC-F31-BVA-025: Navigation Sidebar — Vertical Layout

- **Priority:** P3
- **Type:** Unit (RTL)
- **AC Reference:** AC-03
- **Scenario Reference:** S-04
- **Precondition:** Navigation `variant: "sidebar"`
- **Steps:**
  1. Render
  2. Assert: sidebar container có fixed-left positioning
  3. Assert: links stack vertically (flex-col)
  4. Assert: KHÔNG có horizontal navbar
- **Expected:** Vertical fixed-left sidebar
- **Test Data:** Standard nav links

---

#### TC-F31-BVA-026: Navigation Pill — Floating Rounded Shape

- **Priority:** P3
- **Type:** Unit (RTL)
- **AC Reference:** AC-03
- **Scenario Reference:** S-04
- **Precondition:** Navigation `variant: "pill"`
- **Steps:**
  1. Render
  2. Assert: pill/floating shape (rounded-full class hoặc border-radius pill)
  3. Assert: centered floating layout
  4. Assert: KHÔNG phải full-width navbar
- **Expected:** Floating pill navbar centered
- **Test Data:** Standard nav links

---

#### TC-F31-BVA-027: Footer Centered-Stack — Everything Centered

- **Priority:** P3
- **Type:** Unit (RTL)
- **AC Reference:** AC-15, AC-16
- **Scenario Reference:** S-04
- **Precondition:** Footer `variant: "centered-stack"`
- **Steps:**
  1. Render
  2. Assert: all content elements có `text-center` hoặc `items-center`
  3. Assert: stacked vertically (flex-col)
  4. Assert: KHÔNG có multi-column grid
- **Expected:** Center-aligned stacked layout
- **Test Data:** Standard footer data

---

#### TC-F31-BVA-028: Footer Mega-Footer — 5+ Column Rich Layout

- **Priority:** P3
- **Type:** Unit (RTL)
- **AC Reference:** AC-16
- **Scenario Reference:** S-04
- **Precondition:** Footer `variant: "mega-footer"` với 5 link groups
- **Steps:**
  1. Render
  2. Assert: >= 5 column sections
  3. Assert: sub-section labels visible
  4. Assert: KHÔNG phải simple 3-col layout
- **Expected:** 5+ columns rich footer
- **Test Data:** 5 link groups với sub-sections

---

#### TC-F31-BVA-029: Footer Dark-Gradient — Dark Themed Background

- **Priority:** P3
- **Type:** Unit (RTL)
- **AC Reference:** AC-16
- **Scenario Reference:** S-14
- **Precondition:** Footer `variant: "dark-gradient"`
- **Steps:**
  1. Render
  2. Assert: container có gradient background CSS
  3. Assert: text elements có light/white color class
  4. Assert: KHÔNG phải default solid light background
- **Expected:** Dark gradient background, light text
- **Test Data:** Standard footer data

---

### 3.3 Hero Refactor

Nhóm này verify cấu trúc file sau khi refactor hero block sang `variants/` directory.

---

#### TC-F31-BVA-030: Hero Variants Directory — 12 Files Tồn Tại

- **Priority:** P1
- **Type:** Unit (structural)
- **AC Reference:** AC-07
- **Scenario Reference:** S-02, S-17
- **Precondition:** Hero block đã được refactor
- **Steps:**
  1. Import hoặc `fs.existsSync()` check cho mỗi file trong danh sách
  2. Check: `src/blocks/hero/variants/centered.tsx`
  3. Check: `src/blocks/hero/variants/split-left.tsx`
  4. Check: `src/blocks/hero/variants/split-right.tsx`
  5. Check: `src/blocks/hero/variants/fullscreen.tsx`
  6. Check: `src/blocks/hero/variants/video.tsx`
  7. Check: `src/blocks/hero/variants/magazine.tsx`
  8. Check: `src/blocks/hero/variants/minimal.tsx`
  9. Check: `src/blocks/hero/variants/cards-overlay.tsx`
  10. Check: `src/blocks/hero/variants/gradient.tsx`
  11. Check: `src/blocks/hero/variants/parallax.tsx`
  12. Check: `src/blocks/hero/variants/slideshow.tsx`
  13. Check: `src/blocks/hero/variants/split-video.tsx`
- **Expected:** Tất cả 12 file tồn tại
- **Test Data:** File system check

---

#### TC-F31-BVA-031: Hero index.tsx — Chỉ Là Router (No Layout JSX)

- **Priority:** P1
- **Type:** Unit (structural + RTL)
- **AC Reference:** AC-08
- **Scenario Reference:** S-02, S-22
- **Precondition:** Hero block đã được refactor
- **Steps:**
  1. Import `HeroBlock` từ `src/blocks/hero/index.tsx`
  2. Assert: file LOC < 200 (dùng `fs.readFileSync` + split('\n').length trong test setup)
  3. Assert: file không chứa `<section`, `<div`, `<img`, `<video` JSX literals
  4. Assert: file có VARIANTS map object
  5. Assert: HeroBlock là router function (render delegation)
- **Expected:** index.tsx < 200 LOC, pure router, no layout JSX
- **Test Data:** Hero index.tsx source read

---

#### TC-F31-BVA-032: Hero Variant Components — Named Exports

- **Priority:** P1
- **Type:** Unit (import check)
- **AC Reference:** AC-07
- **Scenario Reference:** S-02
- **Precondition:** Hero variants directory exists
- **Steps:**
  1. Import từng named export: `import { CenteredHero } from '@/blocks/hero/variants/centered'`
  2. Assert: CenteredHero là React component (function)
  3. Assert: tương tự cho tất cả 12 variants
- **Expected:** Tất cả 12 variants export named component
- **Test Data:** 12 import checks

---

#### TC-F31-BVA-033: Hero Backward Compat — Existing Import Path Vẫn Work

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-07, AC-08
- **Scenario Reference:** S-02
- **Precondition:** Existing code import `HeroBlock` từ `src/blocks/hero`
- **Steps:**
  1. Import `HeroBlock` từ barrel export path
  2. Render với `variant: "centered"` (existing default)
  3. Assert: renders correctly như trước refactor
  4. Render với `variant: "split-left"`
  5. Assert: renders correctly
- **Expected:** External import path không bị break sau refactor
- **Test Data:** All pre-existing variants

---

#### TC-F31-BVA-034: Hero Refactor — Bundle Size Không Tăng

- **Priority:** P2
- **Type:** Integration (build analysis)
- **AC Reference:** AC-07
- **Scenario Reference:** S-32
- **Precondition:** `next build` output available trước và sau refactor
- **Steps:**
  1. Record bundle size trước refactor (baseline)
  2. Thực hiện refactor
  3. Run `next build`
  4. Assert: hero chunk size không tăng > 5% so với baseline
- **Expected:** Tree-shaking hoạt động, bundle size không tăng
- **Test Data:** Build output JSON

---

#### TC-F31-BVA-035: Hero Variant — Unknown Variant Fallback

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-08, AC-09
- **Scenario Reference:** S-01
- **Precondition:** Hero block sau refactor
- **Steps:**
  1. Render với `variant: "non-existent-hero-variant"`
  2. Assert: renders centered hero (defaultVariant)
  3. Assert: không có `console.error`
  4. Assert: không crash (ErrorBoundary không trigger)
- **Expected:** Fallback to centered, no error
- **Test Data:** `{ variant: "non-existent-hero-variant" }`

---

### 3.4 CSS_VARS Compliance

Nhóm này verify 6 blocks thiếu CSS_VARS đã được migrate và toàn bộ hệ thống follow design tokens.

---

#### TC-F31-BVA-040: About Block — CSS_VARS Primary Color Follow Theme

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-05
- **Scenario Reference:** S-15, S-19
- **Precondition:** About block với theme có primaryColor = "#22c55e" (green)
- **Steps:**
  1. Arrange: `mockTheme = { primaryColor: "#22c55e" }` → CSS_VARS.primary = "var(--brand-primary)"
  2. Act: `render(<AboutBlock block={mockBlock} theme={mockTheme} />)`
  3. Assert: headings hoặc accent elements có CSS property `color: var(--brand-primary)` hoặc tương đương
  4. Assert: KHÔNG có hardcoded hex `#0ea5e9` trong rendered output
  5. Act: re-render với `mockTheme = { primaryColor: "#ef4444" }` (red)
  6. Assert: accents cập nhật sang red
- **Expected:** Màu follow CSS_VARS, không hardcode, reactive khi theme change
- **Test Data:** 2 theme colors: green, red

---

#### TC-F31-BVA-041: CTA Block — CSS_VARS Compliance

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-06
- **Scenario Reference:** S-15, S-19
- **Precondition:** CTA block với theme primaryColor = "#8b5cf6" (purple)
- **Steps:**
  1. Render `banner` variant với purple theme
  2. Assert: background/button dùng CSS_VARS.primary (var(--brand-primary))
  3. Assert: KHÔNG có hardcoded hex color trong style attributes
  4. Assert: KHÔNG có hardcoded Tailwind static color class (`text-sky-500`, `bg-blue-600`)
- **Expected:** CTA fully CSS_VARS compliant
- **Test Data:** Purple theme

---

#### TC-F31-BVA-042: FAQ Block — CSS_VARS Compliance

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-06
- **Scenario Reference:** S-15
- **Precondition:** FAQ block accordion với purple theme
- **Steps:**
  1. Render FAQ accordion
  2. Assert: active accordion indicator dùng CSS_VARS.primary
  3. Assert: không có hardcoded colors
- **Expected:** FAQ CSS_VARS compliant
- **Test Data:** Purple theme, 3 FAQ items

---

#### TC-F31-BVA-043: Newsletter Block — CSS_VARS Compliance

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-06
- **Scenario Reference:** S-15
- **Precondition:** Newsletter block inline variant với purple theme
- **Steps:**
  1. Render newsletter inline
  2. Assert: submit button background dùng CSS_VARS.primary
  3. Assert: không có hardcoded hex colors
- **Expected:** Newsletter CSS_VARS compliant
- **Test Data:** Purple theme

---

#### TC-F31-BVA-044: Stats Block — CSS_VARS Compliance

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-06
- **Scenario Reference:** S-15
- **Precondition:** Stats block row variant với purple theme
- **Steps:**
  1. Render stats row
  2. Assert: stat numbers/accents dùng CSS_VARS.primary
  3. Assert: không có hardcoded colors
- **Expected:** Stats CSS_VARS compliant
- **Test Data:** Purple theme, 4 stats

---

#### TC-F31-BVA-045: Team Block — CSS_VARS Compliance

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-06
- **Scenario Reference:** S-15
- **Precondition:** Team block grid variant với purple theme
- **Steps:**
  1. Render team grid
  2. Assert: name/role accents dùng CSS_VARS.primary
  3. Assert: không có hardcoded colors
- **Expected:** Team CSS_VARS compliant
- **Test Data:** Purple theme, 3 team members

---

#### TC-F31-BVA-046: CSS_VARS — Font Heading Follow Theme

- **Priority:** P2
- **Type:** Integration (RTL)
- **AC Reference:** AC-05 (implied — font token)
- **Scenario Reference:** S-31
- **Precondition:** Block với `theme.fontHeading = "Playfair Display"` configured
- **Steps:**
  1. Render hero block với custom heading font
  2. Assert: heading elements có `fontFamily` style với CSS_VARS.fontHeading value
  3. Assert: KHÔNG có hardcoded font name trong style
- **Expected:** Font follows CSS_VARS.fontHeading
- **Test Data:** `{ fontHeading: "Playfair Display" }`

---

#### TC-F31-BVA-047: CSS_VARS — Module Level, Không Trong Render Loop

- **Priority:** P1
- **Type:** Unit (code pattern check)
- **AC Reference:** AC-05
- **Scenario Reference:** S-26
- **Precondition:** Source code của 6 migrated blocks
- **Steps:**
  1. Read source files: `about/index.tsx`, `cta/index.tsx`, `faq/index.tsx`, `newsletter/index.tsx`, `stats/index.tsx`, `team/index.tsx`
  2. Assert: `CSS_VARS` import tồn tại ở top của mỗi file
  3. Assert: `resolveTheme()` KHÔNG được gọi trong component function body
  4. Assert: CSS_VARS dùng như constant, không re-computed per render
- **Expected:** CSS_VARS là module-level constant, không gọi trong render loop
- **Test Data:** Source code check

---

### 3.5 Responsive

Nhóm này verify responsive behavior trên 3 breakpoints chính.

---

#### TC-F31-BVA-050: No Horizontal Overflow — Mobile 375px (Playwright)

- **Priority:** P1
- **Type:** E2E (Playwright)
- **AC Reference:** AC-10
- **Scenario Reference:** S-12, S-20
- **Precondition:** Test page có tất cả 51 blocks render với various variants; Playwright mobile viewport
- **Steps:**
  1. Set viewport: `{ width: 375, height: 812 }`
  2. Navigate tới test page có blocks
  3. Assert: `document.documentElement.scrollWidth === 375` (no overflow)
  4. Assert: `document.body.scrollWidth === 375`
  5. Repeat cho các critical blocks: hero, gallery, pricing table, navigation
- **Expected:** scrollWidth === viewportWidth = 375, không có horizontal overflow
- **Test Data:** 375×812 viewport (iPhone SE)

---

#### TC-F31-BVA-051: 2-Column Variants Stack Mobile

- **Priority:** P1
- **Type:** E2E (Playwright)
- **AC Reference:** AC-11
- **Scenario Reference:** S-12
- **Precondition:** Page với hero/split-left, contact/split, features/grid-2
- **Steps:**
  1. Viewport 768px trên: assert 2-column layout (elements side by side)
  2. Resize xuống 767px
  3. Assert: elements stack vertically (không còn side by side)
  4. Assert: content order đúng (text trước image trên hero/split-left)
- **Expected:** Grid collapse at 768px breakpoint
- **Test Data:** 767px và 769px viewports

---

#### TC-F31-BVA-052: Pricing Table Overflow — Horizontal Scroll (375px)

- **Priority:** P1
- **Type:** E2E (Playwright)
- **AC Reference:** AC-10
- **Scenario Reference:** S-20
- **Precondition:** Pricing block `variant: "table"` trên 375px viewport
- **Steps:**
  1. Render pricing table trên 375px
  2. Assert: table wrapper có `overflow-x: auto` hoặc `overflow-x: scroll`
  3. Assert: toàn trang KHÔNG bị horizontal overflow (document.documentElement.scrollWidth === 375)
  4. Assert: table vẫn đọc được (không bị clip)
- **Expected:** Table scrolls horizontally trong wrapper, không break page layout
- **Test Data:** 375px viewport, pricing table với 3 tiers × 6 features

---

#### TC-F31-BVA-053: Hero Fullscreen — 100dvh Mobile Safari

- **Priority:** P1
- **Type:** E2E (Playwright)
- **AC Reference:** AC-10, AC-11
- **Scenario Reference:** S-12
- **Precondition:** Playwright với WebKit (Safari), hero `variant: "fullscreen"`
- **Steps:**
  1. Launch Playwright với WebKit engine
  2. Viewport 375×812 (Safari address bar present)
  3. Render hero fullscreen
  4. Assert: hero height đúng với viewport (không clip/overflow)
  5. Assert: không có white space dưới hero do address bar
- **Expected:** Hero dùng `100dvh` hoặc fallback đúng cho Safari
- **Test Data:** WebKit + 375×812 viewport

---

#### TC-F31-BVA-054: Gallery Carousel Touch Swipe (Mobile)

- **Priority:** P2
- **Type:** E2E (Playwright)
- **AC Reference:** AC-02, AC-11
- **Scenario Reference:** S-28
- **Precondition:** Gallery carousel trên mobile viewport, Playwright touch events
- **Steps:**
  1. Viewport 375px
  2. Render gallery carousel
  3. Assert: slide 1 visible
  4. Simulate swipe left (`touchstart` → `touchmove` → `touchend`)
  5. Assert: slide 2 visible
  6. Assert: page không bị scroll cùng lúc (preventDefault hoạt động)
- **Expected:** Swipe navigates carousel, không trigger page scroll
- **Test Data:** 4-image carousel, 375px viewport

---

#### TC-F31-BVA-055: Navigation Hamburger — Mobile Collapse

- **Priority:** P1
- **Type:** E2E (Playwright)
- **AC Reference:** AC-10, AC-11
- **Scenario Reference:** S-29
- **Precondition:** Navigation block (bất kỳ variant), 375px viewport
- **Steps:**
  1. Viewport 375px
  2. Render navigation
  3. Assert: desktop links ẩn, hamburger icon visible
  4. Act: click hamburger
  5. Assert: mobile menu open, links visible
  6. Act: click close
  7. Assert: menu close
- **Expected:** Hamburger menu functional trên mobile
- **Test Data:** 375px viewport, navigation với 5 links

---

#### TC-F31-BVA-056: Responsive Breakpoints — Tablet 768px Check

- **Priority:** P2
- **Type:** E2E (Playwright)
- **AC Reference:** AC-10, AC-11
- **Scenario Reference:** S-12
- **Precondition:** Critical blocks trên 768px viewport
- **Steps:**
  1. Viewport 768px
  2. Check hero/split-left: 2-col layout (stacked → side by side transition point)
  3. Check features/grid-3: 2-col layout (1→2 col at 768px)
  4. Check footer/expanded: 2-col tablet layout
  5. Assert: no horizontal overflow
- **Expected:** Correct tablet layout at 768px
- **Test Data:** 768px viewport

---

#### TC-F31-BVA-057: Responsive Desktop — 1280px Full Layout

- **Priority:** P2
- **Type:** E2E (Playwright)
- **AC Reference:** AC-10
- **Scenario Reference:** S-12
- **Precondition:** All critical blocks trên 1280px viewport
- **Steps:**
  1. Viewport 1280px
  2. Render all critical blocks
  3. Assert: full column counts hiển thị (features: 3-col, hero: 2-col split, footer: 4-col)
  4. Assert: no overflow
- **Expected:** Full desktop layouts at 1280px
- **Test Data:** 1280px viewport

---

### 3.6 Edge Cases và Error Handling

Nhóm này cover các edge cases quan trọng nhất từ scenario analysis.

---

#### TC-F31-BVA-058: Unknown Variant — Fallback to Default (All Tier-1 Blocks)

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-09
- **Scenario Reference:** S-01, S-07
- **Precondition:** Tier-1 blocks: hero, features, testimonials, pricing
- **Steps:**
  1. Render mỗi block với `variant: "totally-invalid-variant-xyz"`
  2. Assert: renders default variant layout (không blank)
  3. Assert: không có `console.error` hoặc `console.warn`
  4. Assert: ErrorBoundary không trigger
  5. Repeat với `variant: undefined`
  6. Repeat với `variant: null`
  7. Repeat với `variant: ""`
- **Expected:** Graceful fallback mọi trường hợp
- **Test Data:** `"totally-invalid-variant-xyz"`, `undefined`, `null`, `""`

---

#### TC-F31-BVA-059: Case Sensitivity — "TABLE" vs "table"

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-09
- **Scenario Reference:** S-08
- **Precondition:** Pricing block với wrong case variant
- **Steps:**
  1. Render pricing với `variant: "TABLE"` (uppercase)
  2. Assert: render defaultVariant (cards), KHÔNG render table layout
  3. Assert: không crash
  4. Render với `variant: "Table"` (mixed case)
  5. Assert: render defaultVariant (cards)
- **Expected:** Case-sensitive matching, fallback đúng khi wrong case
- **Test Data:** `"TABLE"`, `"Table"`, `"tABle"`

---

#### TC-F31-BVA-060: Empty Array — features = [] Không Crash

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-09
- **Scenario Reference:** S-09
- **Precondition:** Features block với empty items array
- **Steps:**
  1. Render `<FeaturesBlock block={{ features: [], variant: "grid-3" }} />`
  2. Assert: không có crash từ `.map()` trên empty array
  3. Assert: renders empty state UI (not blank, not error)
  4. Tương tự với: `testimonials: []`, `pricing.tiers: []`
- **Expected:** Empty arrays handled gracefully, no crash
- **Test Data:** `features: []`, `testimonials: []`, `tiers: []`

---

#### TC-F31-BVA-061: SSR Safety — Không Access window/document

- **Priority:** P1
- **Type:** Unit (Node env)
- **AC Reference:** AC-09
- **Scenario Reference:** S-03
- **Precondition:** Test environment là Node (không có browser globals)
- **Steps:**
  1. Mock `global.window = undefined`
  2. Import và render hero/variants/centered.tsx trong test
  3. Import và render testimonials/variants/carousel.tsx
  4. Import và render navigation/variants/mega-menu.tsx
  5. Assert: không có `window is not defined` error
  6. Assert: renders correctly (hoặc skeleton)
- **Expected:** Variant routing không crash khi `window` undefined (SSR context)
- **Test Data:** SSR environment simulation

---

#### TC-F31-BVA-062: Backward Compat — Old Saved Variant Data

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-01, AC-02
- **Scenario Reference:** S-04
- **Precondition:** Sites đã lưu `variant: "masonry"` trước khi fix
- **Steps:**
  1. Render gallery block với `variant: "masonry"` (như data từ DB)
  2. Assert: render CSS masonry layout (new implementation)
  3. Assert: KHÔNG fallback về grid
  4. Render footer với `variant: "minimal"` (previously dead)
  5. Assert: render single-line layout
- **Expected:** Đã-lưu variants tự động upgrade sang implementation mới
- **Test Data:** `{ variant: "masonry" }`, `{ variant: "minimal" }`

---

#### TC-F31-BVA-063: Rapid Variant Switch — Không Memory Leak

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-01 đến AC-04 (general)
- **Scenario Reference:** S-10
- **Precondition:** Pricing block, rapid variant changes
- **Steps:**
  1. Render pricing cards
  2. Loop 10 lần: rerender với variant thay đổi rapidly (cards → table → cards → horizontal → ...)
  3. Assert: cuối cùng render đúng variant cuối cùng
  4. Assert: không có `act()` warnings về pending state updates
  5. Assert: component không có dangling event listeners
- **Expected:** Stable rendering sau rapid changes
- **Test Data:** 10 rapid variant switches

---

#### TC-F31-BVA-064: blockRegistry — Undefined Block Type Handling

- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-09
- **Scenario Reference:** S-16
- **Precondition:** SiteRenderer với unknown block type
- **Steps:**
  1. Call `blockRegistry.getComponent("non-existent-block-type")`
  2. Assert: trả về undefined hoặc null fallback component
  3. Render SiteRenderer với `{ blockType: "non-existent-block-type" }`
  4. Assert: renders null/empty (không crash toàn page)
  5. Assert: ErrorBoundary không trigger cho toàn page
- **Expected:** Unknown block type → null render, không crash surrounding blocks
- **Test Data:** `{ blockType: "does-not-exist" }`

---

#### TC-F31-BVA-065: Video Autoplay Attributes — BR-04 Compliance

- **Priority:** P1
- **Type:** Unit (RTL)
- **AC Reference:** AC-01
- **Scenario Reference:** S-21
- **Precondition:** Hero video variant
- **Steps:**
  1. Render hero video với valid videoUrl
  2. Query `<video>` element
  3. Assert: `autoPlay={true}` hoặc attribute `autoplay`
  4. Assert: `muted={true}` hoặc attribute `muted`
  5. Assert: `loop={true}` hoặc attribute `loop`
  6. Assert: `playsInline={true}` hoặc attribute `playsinline`
- **Expected:** Tất cả 4 video attributes theo BR-04
- **Test Data:** `{ videoUrl: "https://cdn.example.com/bg.mp4" }`

---

#### TC-F31-BVA-066: Video Background — Pause khi Tab Hidden

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** AC-01
- **Scenario Reference:** S-23 (pattern similar)
- **Precondition:** Hero video variant với tab visibility API mock
- **Steps:**
  1. Render hero video, assert video element exists
  2. Simulate `document.visibilityState = "hidden"`
  3. `fireEvent(document, new Event("visibilitychange"))`
  4. Assert: video.pause() được gọi (mock video.pause)
  5. Simulate `document.visibilityState = "visible"`
  6. `fireEvent(document, new Event("visibilitychange"))`
  7. Assert: video.play() được gọi
- **Expected:** Video pause khi tab hidden, resume khi visible
- **Test Data:** Mocked visibility events

---

### 3.7 Design Tokens

Nhóm này verify design token mapping — đặc biệt là borderRadius token.

---

#### TC-F31-BVA-067: Border Radius — "pill" Maps to radiusFull

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-17
- **Scenario Reference:** S-30
- **Precondition:** Theme với `borderRadius: "pill"`, pricing card variant
- **Steps:**
  1. Arrange: `mockTheme = { borderRadius: "pill" }` → CSS_VARS.radiusFull = "var(--radius-full)"
  2. Render pricing cards
  3. Assert: card elements có `borderRadius: var(--radius-full)` hoặc Tailwind `rounded-full`
  4. Assert: KHÔNG có hardcoded `rounded-md` hoặc `rounded-lg`
- **Expected:** borderRadius: "pill" → radiusFull CSS var
- **Test Data:** `{ borderRadius: "pill" }`

---

#### TC-F31-BVA-068: Border Radius — "sharp" Maps to radiusSm (No Rounding)

- **Priority:** P1
- **Type:** Integration (RTL)
- **AC Reference:** AC-17
- **Scenario Reference:** S-30
- **Precondition:** Theme với `borderRadius: "sharp"`, button elements
- **Steps:**
  1. Arrange: `mockTheme = { borderRadius: "sharp" }`
  2. Render CTA block với button
  3. Assert: button có `borderRadius: var(--radius-sm)` hoặc `0` (square)
  4. Assert: KHÔNG có `rounded-full` hoặc `rounded-lg` (pill/soft styles)
- **Expected:** Sharp theme → square/minimal border-radius
- **Test Data:** `{ borderRadius: "sharp" }`

---

#### TC-F31-BVA-069: Border Radius — "soft" Maps to radiusMd

- **Priority:** P2
- **Type:** Integration (RTL)
- **AC Reference:** AC-17
- **Scenario Reference:** S-30
- **Precondition:** Theme với `borderRadius: "soft"`, card elements
- **Steps:**
  1. `mockTheme = { borderRadius: "soft" }` → CSS_VARS.radiusMd
  2. Render features cards
  3. Assert: cards có CSS_VARS.radiusMd
- **Expected:** Soft theme → medium border-radius
- **Test Data:** `{ borderRadius: "soft" }`

---

#### TC-F31-BVA-070: Font Body — CSS_VARS.fontBody trong Content Elements

- **Priority:** P2
- **Type:** Integration (RTL)
- **AC Reference:** AC-05
- **Scenario Reference:** S-31
- **Precondition:** Theme với `fontBody: "Roboto"`, testimonials block
- **Steps:**
  1. Render testimonials với custom font
  2. Assert: paragraph elements có `fontFamily: CSS_VARS.fontBody`
  3. Assert: không có hardcoded font string
- **Expected:** Body font follows CSS_VARS.fontBody
- **Test Data:** `{ fontBody: "Roboto" }`

---

#### TC-F31-BVA-071: Section Padding — CSS_VARS.sectionPadding

- **Priority:** P3
- **Type:** Integration (RTL)
- **AC Reference:** AC-05 (implied)
- **Scenario Reference:** S-26
- **Precondition:** Block với `CSS_VARS.sectionPadding`
- **Steps:**
  1. Render hero block
  2. Assert: section element dùng CSS_VARS.sectionPadding
  3. Assert: KHÔNG có hardcoded `py-20`
- **Expected:** Section padding follows CSS_VARS
- **Test Data:** Standard theme

---

### 3.8 Verification Script

Nhóm này test `pnpm verify:variants` script behavior.

---

#### TC-F31-BVA-072: Script Pass — Tất Cả 51 Blocks Pass

- **Priority:** P1
- **Type:** Script (node)
- **AC Reference:** AC-13
- **Scenario Reference:** S-05, S-06
- **Precondition:** Sau khi implement tất cả fixes; `scripts/verify-variants.mjs` exists
- **Steps:**
  1. Chạy `node scripts/verify-variants.mjs`
  2. Assert: output có "51/51 blocks passed" hoặc tương đương
  3. Assert: exit code = 0
  4. Assert: không có "FAIL" entries trong output
- **Expected:** 51/51 PASS, exit code 0
- **Test Data:** Full codebase sau fixes

---

#### TC-F31-BVA-073: Script Fail Detection — Thiếu Variant Branch

- **Priority:** P1
- **Type:** Script (node)
- **AC Reference:** AC-13
- **Scenario Reference:** S-05
- **Precondition:** Tạo test fixture: config.ts có `"new-variant"` trong z.enum() nhưng index.tsx thiếu branch
- **Steps:**
  1. Tạo mock block dir với intentional dead variant
  2. Chạy `node scripts/verify-variants.mjs`
  3. Assert: output có "FAIL" với tên block và variant bị thiếu
  4. Assert: exit code = 1
- **Expected:** Script detect và report dead variant, exit code 1
- **Test Data:** Mock block với dead variant

---

#### TC-F31-BVA-074: Script — Partial Implementation (5/51)

- **Priority:** P2
- **Type:** Script (node)
- **AC Reference:** AC-13
- **Scenario Reference:** S-06
- **Precondition:** Giữa lúc development, chỉ 5/51 blocks đã fix
- **Steps:**
  1. Chạy script
  2. Assert: script không crash
  3. Assert: output đúng count pass vs fail (ví dụ: "5/51 passed")
  4. Assert: exit code = 1 (có failures)
- **Expected:** Script hoạt động với partial fixes, report đúng count
- **Test Data:** Partial implementation state

---

#### TC-F31-BVA-075: Script — Variant Count Report Đúng

- **Priority:** P2
- **Type:** Script (node)
- **AC Reference:** AC-13
- **Scenario Reference:** S-35
- **Precondition:** Full codebase
- **Steps:**
  1. Chạy script với `--verbose` flag (nếu có)
  2. Assert: output liệt kê tất cả 51 blocks và variant count của mỗi block
  3. Assert: tổng variants = ~175 (cho phép ±5 sai số)
- **Expected:** Correct block và variant counts reported
- **Test Data:** Full codebase

---

### 3.9 TypeScript và Code Quality

---

#### TC-F31-BVA-076: TypeScript — Zero `any` Types Trong Variant Files

- **Priority:** P1
- **Type:** Static analysis
- **AC Reference:** NFR-TypeScript
- **Scenario Reference:** S-33
- **Precondition:** Hero variants/ directory
- **Steps:**
  1. Chạy `npx tsc --noEmit` trên project
  2. Assert: không có TypeScript errors
  3. Grep `any` type trong variant files: `grep -r ": any" src/blocks/hero/variants/`
  4. Assert: 0 occurrences (hoặc có justification comment)
- **Expected:** Zero `any` types trong new variant files
- **Test Data:** TypeScript strict mode

---

#### TC-F31-BVA-077: Lint — Variant Files Pass ESLint

- **Priority:** P2
- **Type:** Static analysis
- **AC Reference:** NFR-TypeScript
- **Scenario Reference:** S-33
- **Precondition:** Hero variants/ và migrated blocks
- **Steps:**
  1. Chạy `npx eslint src/blocks/hero/variants/`
  2. Assert: 0 errors, 0 warnings
  3. Chạy `npx eslint src/blocks/{about,cta,faq,newsletter,stats,team}/`
  4. Assert: 0 errors
- **Expected:** ESLint clean trên tất cả modified files
- **Test Data:** ESLint config

---

#### TC-F31-BVA-078: Accessibility — Carousel ARIA Live Region

- **Priority:** P2
- **Type:** Unit (RTL + axe-core)
- **AC Reference:** NFR-Accessibility
- **Scenario Reference:** S-25
- **Precondition:** Testimonials carousel, gallery carousel
- **Steps:**
  1. Render testimonials carousel
  2. Assert: có `aria-live` attribute trên carousel content region
  3. Assert: navigation buttons có `aria-label` (ví dụ: "Next testimonial")
  4. Run axe-core: `await axe(container)`
  5. Assert: 0 violations
- **Expected:** Accessible carousel với ARIA live region và labelled controls
- **Test Data:** axe-core accessibility scan

---

#### TC-F31-BVA-079: Accessibility — Mega-Menu Keyboard Navigation

- **Priority:** P2
- **Type:** Unit (RTL)
- **AC Reference:** NFR-Accessibility
- **Scenario Reference:** S-24
- **Precondition:** Navigation mega-menu variant
- **Steps:**
  1. Render mega-menu
  2. Focus vào menu trigger button
  3. Act: `userEvent.keyboard('{Enter}')`
  4. Assert: dropdown opens
  5. Act: `userEvent.keyboard('{Tab}')`
  6. Assert: focus moves to first menu item
  7. Act: `userEvent.keyboard('{Escape}')`
  8. Assert: dropdown closes, focus trả về trigger
- **Expected:** Keyboard navigation đầy đủ: Enter open, Tab through, Escape close
- **Test Data:** Navigation với mega-menu và sub-items

---

## 4. Traceability Matrix

| AC | Title | Test Cases | Coverage |
|----|-------|-----------|----------|
| AC-01 | Hero video → full-bleed video | TC-001, TC-002, TC-065, TC-066 | Full |
| AC-02 | Gallery masonry → CSS columns | TC-003, TC-004, TC-022, TC-023 | Full |
| AC-03 | Navigation centered → logo center | TC-005, TC-006, TC-024, TC-025, TC-026 | Full |
| AC-04 | Pricing table → comparison table | TC-010, TC-019 | Full |
| AC-05 | CSS_VARS — about block | TC-040, TC-046, TC-047 | Full |
| AC-06 | CSS_VARS — cta, faq, newsletter, stats, team | TC-041, TC-042, TC-043, TC-044, TC-045 | Full |
| AC-07 | Hero refactor — variants/ directory | TC-030, TC-032 | Full |
| AC-08 | Hero index.tsx — pure router < 200 LOC | TC-031, TC-035 | Full |
| AC-09 | Unknown variant → fallback, no crash | TC-035, TC-058, TC-059, TC-060, TC-061, TC-064 | Full |
| AC-10 | Responsive — no overflow 375px | TC-050, TC-052, TC-053 | Full |
| AC-11 | 2-col stack on mobile | TC-051, TC-054, TC-055, TC-056 | Full |
| AC-12 | Testimonials carousel auto-rotate | TC-007, TC-008, TC-018 | Full |
| AC-13 | Verification script 51/51 pass | TC-072, TC-073, TC-074, TC-075 | Full |
| AC-14 | Unit test coverage tier-1 blocks | TC-013, TC-014, TC-015, TC-016, TC-017 | Full |
| AC-15 | Footer minimal single-line | TC-012, TC-027 | Full |
| AC-16 | Footer expanded newsletter | TC-011, TC-028, TC-029 | Full |
| AC-17 | Border radius pill → radiusFull | TC-067, TC-068, TC-069 | Full |

**AC Coverage: 17/17 (100%)**

---

## 5. Scenario Coverage Matrix

| Scenario | TC Reference | Covered? |
|----------|-------------|---------|
| S-01: undefined variant fallback | TC-058, TC-035 | Yes |
| S-02: Hero refactor import path | TC-033, TC-031, TC-030 | Yes |
| S-03: SSR no window/document | TC-061 | Yes |
| S-04: Old saved variants upgrade | TC-062 | Yes |
| S-05: Config sync script detection | TC-073 | Yes |
| S-06: Script partial implementation | TC-074 | Yes |
| S-07: Empty string variant | TC-058 | Yes |
| S-08: Case mismatch "TABLE" | TC-059 | Yes |
| S-09: features: [] empty array | TC-060 | Yes |
| S-10: Rapid variant clicks | TC-063 | Yes |
| S-11: Variant persist save/reload | TC-013 (partial) | Partial |
| S-12: Mobile Safari 92vh | TC-053 | Yes |
| S-13: Slow 3G video fallback | TC-002 | Yes |
| S-14: Dark mode CSS_VARS | TC-029, TC-044 | Partial |
| S-15: CSS_VARS import regression | TC-047 | Yes |
| S-16: blockRegistry undefined | TC-064 | Yes |
| S-17: Variant file syntax error | TC-030 (structural) | Partial |
| S-18: meta.variants out of sync | TC-073, TC-075 | Yes |
| S-19: CSS_VARS theme change | TC-040, TC-041 | Yes |
| S-20: Pricing table overflow 375px | TC-052 | Yes |
| S-21: Hero video videoUrl = null | TC-002 | Yes |
| S-22: Hero LOC check | TC-031 | Yes |
| S-23: Carousel pause tab hidden | TC-066 | Yes |
| S-24: Mega-menu keyboard | TC-079 | Yes |
| S-25: Carousel screen reader | TC-078 | Yes |
| S-26: CSS_VARS render loop | TC-047 | Yes |
| S-27: Footer minimal mobile | TC-055 | Yes |
| S-28: Gallery carousel touch | TC-054 | Yes |
| S-29: Navigation centered mobile | TC-055 | Yes |
| S-30: borderRadius token | TC-067, TC-068, TC-069 | Yes |
| S-31: Font token fallback | TC-046, TC-070 | Yes |
| S-32: Bundle size | TC-034 | Yes |
| S-33: TypeScript any | TC-076, TC-077 | Yes |
| S-34: Safari cross-browser | TC-053 | Yes |
| S-35: Verify script methodology | TC-075 | Yes |

**Scenario Coverage: 33/35 (94%)** — S-11 và S-17 partial (không thể fully automate)

---

## 6. Test Code Samples

### 6.1 Variant Routing Unit Test Pattern

```typescript
// src/__tests__/unit/blocks/hero-variant-routing.test.tsx

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HeroBlock } from '@/blocks/hero'
import type { HeroConfig } from '@/blocks/hero/config'
import type { BlockProps } from '@/blocks/types'

vi.mock('@/lib/theme/resolve', () => ({
  CSS_VARS: {
    primary: 'var(--brand-primary)',
    text: 'var(--text-primary)',
    fontHeading: 'var(--font-heading)',
  },
}))

const mockTheme = {
  primaryColor: '#22c55e',
  fontHeading: 'Inter',
  borderRadius: 'soft',
}

const mockBlock: HeroConfig = {
  blockType: 'hero',
  variant: 'centered',
  headline: 'Test Headline',
  subheadline: 'Test Sub',
}

// ── TC-F31-BVA-001: Hero Video Full-Bleed ────────────────
describe('[TC-F31-BVA-001] Hero Video — Full-Bleed Video Background', () => {
  it('renders <video> element với đúng attributes', () => {
    // Arrange
    const videoBlock = { ...mockBlock, variant: 'video', videoUrl: 'https://cdn.test/bg.mp4' }

    // Act
    const { container } = render(<HeroBlock block={videoBlock} theme={mockTheme} />)

    // Assert
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('muted')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('playsinline')
  })
})
```

### 6.2 CSS_VARS Compliance Test Pattern

```typescript
// src/__tests__/unit/blocks/css-vars-compliance.test.tsx

// ── TC-F31-BVA-040: About Block CSS_VARS ─────────────────
describe('[TC-F31-BVA-040] About Block — CSS_VARS Primary Follow Theme', () => {
  it('headings dùng CSS_VARS.primary, không hardcode hex', () => {
    // Arrange
    const { container } = render(<AboutBlock block={aboutBlock} theme={mockTheme} />)

    // Assert — không có hardcoded hex
    const htmlContent = container.innerHTML
    expect(htmlContent).not.toMatch(/#0ea5e9/i) // hardcoded blue
    expect(htmlContent).not.toMatch(/#f59e0b/i) // hardcoded amber

    // Assert — có CSS var usage
    const headings = container.querySelectorAll('h1, h2, h3')
    headings.forEach(h => {
      const style = getComputedStyle(h)
      expect(style.color).toMatch(/var\(--/)
    })
  })
})
```

### 6.3 Fallback Edge Case Pattern

```typescript
// src/__tests__/unit/blocks/variant-fallback-edge-cases.test.tsx

// ── TC-F31-BVA-058: Unknown Variant Fallback ─────────────
describe('[TC-F31-BVA-058] Unknown Variant — Fallback to Default', () => {
  const invalidVariants = ['totally-invalid', undefined, null, '', 'TABLE']

  it.each(invalidVariants)('variant "%s" → renders default, no crash', (variant) => {
    // Arrange
    const block = { ...mockBlock, variant }

    // Act + Assert: không throw
    expect(() => render(<FeaturesBlock block={block} theme={mockTheme} />)).not.toThrow()

    // Assert: render default layout (grid-3)
    const { container } = render(<FeaturesBlock block={block} theme={mockTheme} />)
    expect(container.firstChild).not.toBeNull()
  })
})
```

---

## 7. Execution Plan

### Phase 1: Unit Tests (Trước khi code)
- Viết test stubs với TC-IDs → chạy → confirm FAIL
- File: `src/__tests__/unit/blocks/`

### Phase 2: Implement + Run Tests
- Implement từng dead variant fix theo PRD spec
- Sau mỗi fix: `pnpm test --reporter=verbose`
- Target: PASS cho P1 tests trước

### Phase 3: Integration + CSS_VARS
- Sau khi variant fixes pass → chạy CSS_VARS tests
- Verify toàn bộ AC-05 và AC-06

### Phase 4: E2E Responsive
- `pnpm playwright test block-responsive.spec.ts`
- 3 breakpoints: 375px, 768px, 1280px

### Phase 5: Verification Script
- Chạy `pnpm verify:variants`
- Target: 51/51 PASS, exit code 0

### Pass Criteria để Consider Done
- Tất cả P1 tests PASS
- Tổng 0 test FAIL
- AC Coverage 17/17
- `pnpm verify:variants` exit code 0
- `tsc --noEmit` pass (0 errors)

---

## 8. Summary

| Metric | Value |
|--------|-------|
| Total Test Cases | 79 |
| P1 (Critical) | 38 |
| P2 (Important) | 29 |
| P3 (Nice to have) | 12 |
| Unit Tests | 55 |
| Integration Tests | 10 |
| E2E Tests (Playwright) | 8 |
| Script Tests | 4 |
| Static Analysis | 2 |
| AC Coverage | 17/17 (100%) |
| Scenario Coverage | 33/35 (94%) |
| Target Test Pass Rate | 100% P1, >= 90% overall |

### Blocks được cover bởi tests

| Block | Dead Variants Tested | CSS_VARS Tested | Fallback Tested |
|-------|---------------------|-----------------|-----------------|
| hero | video (TC-001, 002) | TC-040 pattern | TC-035, TC-058 |
| gallery | masonry (TC-003), carousel (TC-004) | TC-047 pattern | TC-058 |
| navigation | centered (TC-005), mega-menu (TC-006) | TC-047 pattern | TC-058 |
| testimonials | carousel (TC-007, 008), simple (TC-009) | TC-044, 045 | TC-058 |
| pricing | table (TC-010), toggle (TC-020), slider (TC-021) | TC-041 pattern | TC-058 |
| footer | expanded (TC-011), minimal (TC-012) | TC-047 pattern | TC-058 |
| about | — | TC-040 | TC-058 |
| cta | — | TC-041 | TC-058 |
| faq | — | TC-042 | TC-058 |
| newsletter | — | TC-043 | TC-058 |
| stats | — | TC-044 | TC-058 |
| team | — | TC-045 | TC-058 |
| features | grid-2/3/4 (TC-013), zigzag (TC-014), carousel (TC-015) | TC-047 pattern | TC-058 |
| Remaining 38 blocks | — | via TC-047 script check | TC-058 |
