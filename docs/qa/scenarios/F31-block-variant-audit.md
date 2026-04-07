# Scenario Analysis: Block Variant Audit (F31-BVA)

> **Version:** 1.0 | **Created:** 2026-04-07
> **PRD:** `docs/prd/F31-block-variant-audit.md`
> **Plan:** `plans/260407-1021-block-variant-audit/plan.md`

---

## 35 Test Scenarios — Raw Analysis

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| S-01 | Variant Routing — Edge | `block.variant = undefined` → router receives undefined | CRITICAL | Fallback to `meta.defaultVariant`, render default, no crash, no console.error |
| S-02 | Backward Compat — Refactor | Hero refactor: import path `src/blocks/hero/index.tsx` vẫn work sau khi split variants/ directory | CRITICAL | Named export `HeroBlock` từ index.tsx vẫn resolves đúng, existing usages không break |
| S-03 | SSR Safety | No `window`/`document` access trong variant routing logic (Server Component context) | CRITICAL | Variant routing chỉ dùng props/config, không access browser API, không crash khi SSR |
| S-04 | Backward Compat — Saved Data | Site đã lưu `variant: "masonry"` (trước đây là dead) → load lại sau khi fix | CRITICAL | Render new masonry layout (CSS columns), không fallback về grid, dữ liệu cũ được upgrade tự nhiên |
| S-05 | Variant Config Sync | `config.ts` có variant trong `z.enum()` nhưng `index.tsx` thiếu branch trong switch/case | CRITICAL | `pnpm verify:variants` phát hiện và report FAIL với tên variant bị thiếu, exit code 1 |
| S-06 | Script Completeness | `pnpm verify:variants` chạy với partial implementation (5/51 blocks fixed) | CRITICAL | Script report đúng số pass/fail, không crash khi gặp block chưa implement, exit code 1 |
| S-07 | Variant Routing — Edge | `block.variant = ""` (empty string) | HIGH | Fallback to defaultVariant, render default, không throw |
| S-08 | Variant Routing — Edge | `block.variant = "TABLE"` (wrong case) → config có `"table"` | HIGH | Fallback to defaultVariant (case-sensitive match), không render wrong component |
| S-09 | Render Crash | `block.features = []` (empty array) → features block render | HIGH | Renders empty state gracefully (no items message hoặc empty grid), không crash `.map()` |
| S-10 | UI Interaction | User click rapid variant buttons (5 clicks trong 200ms) trong SettingsPanel | HIGH | Render cuối cùng là variant được chọn cuối, không có intermediate render artifacts, không memory leak |
| S-11 | Data Persistence | User chọn variant → save → reload → variant | HIGH | Variant value được lưu đúng trong Payload CMS, reload render đúng variant đã chọn |
| S-12 | Responsive — Mobile Safari | `100vh` trên Mobile Safari (92vh actual due to address bar) | HIGH | Hero fullscreen/video variants dùng `100dvh` hoặc CSS fallback, không bị clip |
| S-13 | Performance — Network | Video hero trên Slow 3G (video chưa load) | HIGH | Fallback poster image hiển thị, không blank screen, video load khi network available |
| S-14 | Visual Consistency | Dark mode toggle với CSS_VARS blocks (about, cta, faq, etc.) | HIGH | Tất cả CSS_VARS blocks render đúng màu trong dark mode khi theme có dark palette |
| S-15 | CSS_VARS Regression | Developer xóa `import { CSS_VARS }` khỏi một block file | HIGH | TypeScript compile error (`CSS_VARS is not defined`), CI typecheck fails, không deploy |
| S-16 | Registry Error | `blockRegistry.getComponent("non-existent-block")` trả về undefined | HIGH | SiteRenderer render null/empty với error boundary, không crash toàn page |
| S-17 | Build Error | Variant file (`hero/variants/video.tsx`) có syntax error | HIGH | `next build` fails với clear error message pointing đến file, không silent fail |
| S-18 | Config Sync | `meta.variants` array trong config.ts out of sync với actual variant files trong variants/ | HIGH | `pnpm verify:variants` phát hiện, report danh sách variants thiếu file implementation |
| S-19 | CSS_VARS — Theme Change | User đổi primaryColor từ blue sang green trong editor | HIGH | Tất cả 51 blocks re-render ngay lập tức với màu mới, không có block nào còn màu cũ |
| S-20 | Responsive — Overflow | Pricing table variant trên 375px viewport | HIGH | Table có horizontal scroll (`overflow-x: auto`), không break layout, không overflow viewport |
| S-21 | Dead Variant — Video | `hero/video` render với `block.videoUrl = null` | HIGH | Render fallback image hoặc gradient background, không crash, `<video>` element được skip |
| S-22 | Hero Refactor | `hero/index.tsx` sau refactor: count LOC | HIGH | `wc -l src/blocks/hero/index.tsx` < 200, CI check pass |
| S-23 | Testimonials Carousel | Carousel auto-rotate: tab ẩn (document.visibilityState = hidden) | MEDIUM | Auto-rotate pause khi tab hidden, resume khi tab active lại |
| S-24 | Accessibility | Navigation mega-menu: keyboard navigation (Tab/Escape) | MEDIUM | Menu mở bằng Enter, đóng bằng Escape, Tab đi qua items, ARIA attributes đúng |
| S-25 | Accessibility | Testimonials carousel: screen reader announcement khi slide change | MEDIUM | `aria-live="polite"` hoặc tương đương, screen reader thông báo slide mới |
| S-26 | Performance | CSS_VARS được gọi trong render loop vs module level | MEDIUM | `resolveTheme()` KHÔNG được gọi trong component body/render function, phải là module-level constant |
| S-27 | Footer Minimal Layout | Footer minimal trên mobile (375px) | MEDIUM | Content wrap (không tràn), đọc được, không bị overlap |
| S-28 | Gallery Carousel | Gallery carousel touch swipe trên mobile | MEDIUM | Swipe left/right navigate carousel, không trigger page scroll cùng lúc |
| S-29 | Navigation Centered | Navigation centered responsive: logo center layout trên mobile | MEDIUM | Mobile hamburger menu thay thế links (logo vẫn visible, centered) |
| S-30 | Design Token | `borderRadius: "sharp"` → tất cả blocks dùng `CSS_VARS.radiusSm` không còn round elements | MEDIUM | Buttons và cards không có border-radius khi theme `borderRadius = "sharp"` |
| S-31 | Typography Token | Block dùng `CSS_VARS.fontHeading` với font chưa load (fallback) | MEDIUM | Font fallback chain hoạt động, text đọc được, không có FOUT (Flash of Unstyled Text) nghiêm trọng |
| S-32 | Bundle Size | Hero refactor: dynamic import hay static import cho variants | LOW | Bundle analysis không tăng so với trước refactor (tree-shaking hoạt động) |
| S-33 | TypeScript | Variant file có `any` type | LOW | `tsc --noEmit` fail với clear error, CI typecheck blocks PR |
| S-34 | Cross-Browser | Pricing table variant trên Safari 17 (CSS grid/table support) | LOW | Table render đúng trên Safari, không có layout bug, test bằng Playwright WebKit |
| S-35 | Visual Diff | Verify script: "visual diff" check methodology | LOW | Script check CSS properties khác nhau (layout, flex-direction, grid-template-columns) giữa variants, không cần screenshot |

---

## Severity Summary

| Severity | Count | Scenarios |
|----------|-------|-----------|
| CRITICAL | 6 | S-01 đến S-06 |
| HIGH | 16 | S-07 đến S-22 |
| MEDIUM | 9 | S-23 đến S-31 |
| LOW | 4 | S-32 đến S-35 |

---

## Scenario → AC Mapping

| Scenario | AC Reference | FR Reference |
|----------|-------------|-------------|
| S-01 | AC-09 | FR-24 |
| S-02 | AC-07, AC-08 | FR-16, FR-17 |
| S-03 | AC-09 | FR-24 |
| S-04 | AC-01, AC-02 | FR-01, FR-02 |
| S-05 | AC-13 | FR-22 |
| S-06 | AC-13 | FR-22 |
| S-07 | AC-09 | FR-24 |
| S-08 | AC-09 | FR-24 |
| S-09 | AC-09 | FR-24 |
| S-10 | AC-01 to AC-04 | FR-01 to FR-10 |
| S-11 | AC-01 to AC-04 | FR-01 to FR-10 |
| S-12 | AC-10, AC-11 | FR-19, FR-20 |
| S-13 | AC-01 | FR-01 |
| S-14 | AC-05, AC-06 | FR-11, FR-12 |
| S-15 | AC-05, AC-06 | FR-11 |
| S-16 | AC-09 | FR-24 |
| S-17 | AC-07 | FR-16 |
| S-18 | AC-13 | FR-22 |
| S-19 | AC-05, AC-06 | FR-11, FR-12 |
| S-20 | AC-10 | FR-19 |
| S-21 | AC-01 | FR-01 |
| S-22 | AC-08 | FR-17 |
| S-23 | AC-12 | FR-06 |
| S-24 | NFR-Accessibility | FR-05 |
| S-25 | NFR-Accessibility | FR-06 |
| S-26 | NFR-Performance | BR-05 |
| S-27 | AC-15 | FR-10 |
| S-28 | AC-02, AC-11 | FR-02, FR-21 |
| S-29 | AC-03, AC-11 | FR-04, FR-20 |
| S-30 | AC-17 | FR-15 |
| S-31 | AC-05, AC-06 | FR-13 |
| S-32 | NFR-Bundle | FR-16 |
| S-33 | NFR-TypeScript | FR-16, FR-17, FR-18 |
| S-34 | NFR-Browser | FR-08 |
| S-35 | AC-13 | FR-22 |
