# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F04 - Block Renderer Engine
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-03-26 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F04-block-renderer.md`), Block Registry (`src/blocks/registry.ts`), SiteRenderer (`src/components/site-renderer/SiteRenderer.tsx`), Block Types (`src/blocks/types.ts`)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, Security XSS Sanitization, Accessibility WCAG 2.1 AA Auditing, Responsive Layout Healer.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho **Block Renderer Engine (F04)** — hệ thống lõi chịu trách nhiệm render 20 block types do AI tạo ra thành giao diện website hoàn chỉnh. Mục tiêu cốt lõi:

- Đạt **>99% render thành công** với cấu hình hợp lệ (valid config)
- Bắt **100% cấu hình không hợp lệ** (invalid config) với fallback/error boundary mà không crash
- **Lighthouse Performance >90**, thời gian render **<50ms/block**
- **WCAG 2.1 AA** cho toàn bộ 20 block types
- **Zero XSS** — sanitize toàn bộ user content trong blocks

Bộ kiểm thử bao gồm **25 kịch bản chi tiết** bao quát: Happy path (mỗi block type), Invalid config, Responsive, Performance, Security, Accessibility.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Localhost (force-dynamic mode, Docker standalone) |
| Browsers | Chrome (v110+), Firefox (v105+), Safari (Latest) |
| Devices (Responsive) | Desktop (1920x1080), Tablet (768x1024), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | 20 block types registry, XSS payload vectors, Lighthouse CLI, render time profiler `<50ms/block` |
| Block Registry | 20 types: navigation, hero, features, about, testimonials, faq, contact, gallery, footer, pricing, cta, stats, team, newsletter, video, logo-cloud, blog-list, products-grid, products-featured, custom-html |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[NHOM 1] Render Block Types — Happy Path (Valid Config)** |
| **TC-F04.01** | `Registry` | `Func` | **[Positive]** Render Hero block với config hợp lệ | **1.** Tạo page layout chứa hero block với đầy đủ props: title, subtitle, backgroundImage, cta buttons.<br>**2.** Truy cập trang storefront. | **GIVEN** Page layout chứa 1 hero block với config hợp lệ (Zod validation pass) **WHEN** SiteRenderer render page **THEN** HeroBlock component hiển thị đúng: tiêu đề, ảnh nền, CTA buttons. Không có console error. DOM output khớp variant default. | Blocker | [x] |
| **TC-F04.02** | `Registry` | `Func` | **[Positive]** Render toàn bộ 20 block types đăng ký trong registry | **1.** Tạo page layout chứa lần lượt cả 20 block types (navigation, hero, features, about, testimonials, faq, contact, gallery, footer, pricing, cta, stats, team, newsletter, video, logo-cloud, blog-list, products-grid, products-featured, custom-html).<br>**2.** Render page qua SiteRenderer. | **GIVEN** Layout array chứa 20 blocks với config tối thiểu hợp lệ **WHEN** SiteRenderer iterate qua `blocks.map()` **THEN** Mỗi block resolve qua `blockRegistry.getComponent()` trả về component non-null. Tất cả 20 blocks render thành công (DOM output >0 elements mỗi block). `blockRegistry.count === 20`. | Blocker | [x] |
| **TC-F04.03** | `Registry` | `Func` | **[Positive]** Render Pricing block với nhiều tiers (3 plans) | **1.** Config pricing block: 3 pricing plans (Free, Pro, Enterprise) với features list, price, CTA.<br>**2.** Render page. | **GIVEN** Pricing config có 3 plan items **WHEN** PricingBlock render **THEN** Hiển thị 3 pricing cards song song (desktop). Mỗi card có tên plan, giá, danh sách features, nút CTA. Layout cân đối không tràn. | High | [ ] |
| **TC-F04.04** | `Registry` | `Func` | **[Positive]** Render FAQ block với accordion (5 items) | **1.** Config FAQ block: 5 câu hỏi/trả lời.<br>**2.** Click vào câu hỏi đầu tiên. | **GIVEN** FAQ block chứa 5 items **WHEN** User click vào question **THEN** Answer expand với animation mượt. Chỉ 1 item mở tại 1 thời điểm (accordion behavior). Các item còn lại collapse. | High | [ ] |
| **TC-F04.05** | `Registry` | `Func` | **[Positive]** Render Gallery block với grid ảnh (6 images) | **1.** Config gallery block: 6 images với alt text.<br>**2.** Render và kiểm tra layout. | **GIVEN** Gallery config chứa 6 ImageRef objects **WHEN** GalleryBlock render **THEN** Ảnh hiển thị dạng grid responsive (3 cột desktop, 2 cột tablet, 1 cột mobile). Mọi ảnh có thuộc tính `alt` text. Lazy loading kích hoạt (`loading="lazy"`). | High | [ ] |
| **TC-F04.06** | `Registry` | `Func` | **[Positive]** Render Navigation block với menu items + logo | **1.** Config navigation: logo, 5 menu items, CTA button.<br>**2.** Render trên desktop và mobile. | **GIVEN** Navigation config hợp lệ **WHEN** Render trên desktop **THEN** Logo trái, menu items ngang, CTA button phải. **WHEN** Render trên mobile (375px) **THEN** Hamburger menu icon thay thế menu items, tap mở mobile drawer. | High | [x] |
| **TC-F04.06b**| `AC-5`     | `Logic`| **[Positive]** Điều hướng render các Block Variants & Fallback | **1.** Inject Hero block với `variant: "split"`.<br>**2.** Inject Hero block với `variant: "unknown-variant"`. | **GIVEN** Các thuộc tính biến thể (Variant) **WHEN** Component render **THEN** Bản split layout (có ảnh chia cột) xuất hiện đúng. Bản unknown-variant tự động bị fallback về default variant (centered layout) không gây Crash. | Blocker | [ ] |
| **TC-F04.06c**| `AC-7`     | `Data` | **[Positive]** Đảm bảo Tính tương thích ngược (Backward Compatibility) | **1.** Query một Layout Page cũ trong quá khứ lúc chưa có field `variant` hoặc thiếu schema mới.<br>**2.** Gửi cho SiteRenderer bản V1.1 móc lên UI. | **GIVEN** Object config cũ (Legacy schema) **WHEN** SiteRenderer móc block array **THEN** Zod Default Values tự chêm vào các khoảng thiếu sót. Giao diện trang cũ không bị phá vỡ, tỷ lệ render khớp 100% với lúc chưa Refactor hệ thống Renderer. | Critical | [ ] |
| **[NHOM 2] Invalid Config & Error Boundary — Negative Cases** |
| **TC-F04.07** | `AC-6` | `Logic` | **[Negative]** Block type không tồn tại trong registry (unknown type) | **1.** Inject layout block với `blockType: "non-existent-block"`.<br>**2.** Render page qua SiteRenderer. | **GIVEN** Layout chứa block với type không đăng ký **WHEN** `blockRegistry.getComponent("non-existent-block")` trả về null **THEN** SiteRenderer skip block đó silently (return null). Các block khác trong page render bình thường. Không console error, không white screen. | Blocker | [x] |
| **TC-F04.08** | `Zod` | `Logic` | **[Negative]** Config thiếu required fields (partial config) | **1.** Gọi `blockRegistry.validate("hero", { blockType: "hero" })` — thiếu title, subtitle.<br>**2.** Render hero block với config thiếu. | **GIVEN** Config không pass Zod schema validation **WHEN** `validate()` returns `{ success: false, error: "..." }` **THEN** Lỗi trả về message rõ ràng chỉ ra field thiếu. Block render với giá trị default (Zod `.default()`) hoặc hiện fallback UI. Page không crash. | Blocker | [x] |
| **TC-F04.09** | `ErrorBoundary` | `Sec` | **[Negative]** Block component throw runtime error | **1.** Mock 1 block component throw Error("Test crash") khi render.<br>**2.** Render page chứa block lỗi + 2 block bình thường. | **GIVEN** 1 trong 3 blocks throw exception **WHEN** React render tree **THEN** `BlockErrorBoundary` bắt lỗi, hiển thị fallback UI cho block đó (thông báo lỗi hoặc blank space). 2 blocks còn lại render bình thường 100%. Không white screen toàn page. | Blocker | [x] |
| **TC-F04.10** | `Registry` | `Logic` | **[Negative]** Layout array rỗng (0 blocks) | **1.** Render SiteRenderer với `page.layout = []`.<br>**2.** Quan sát output. | **GIVEN** Page layout là mảng rỗng **WHEN** SiteRenderer render **THEN** Trang hiển thị trống (chỉ có global styles, CSS variables). Không error, không crash. Body background color đúng theo theme colorMode. | Medium | [x] |
| **TC-F04.11** | `Zod` | `Logic` | **[Negative]** Block config với data type sai (string thay vì number) | **1.** Config stats block: `value: "not-a-number"` thay vì `value: 1500`.<br>**2.** Validate và render. | **GIVEN** Field nhận type không khớp Zod schema **WHEN** `blockRegistry.validate()` **THEN** Returns `{ success: false }` với error message "Expected number, received string". Block hiển thị fallback hoặc dùng giá trị default. | High | [ ] |
| **TC-F04.12** | `AC-6` | `Logic` | **[Negative]** Block thiếu blockType property (null/undefined) | **1.** Inject block object `{ title: "Hello" }` — không có `blockType`.<br>**2.** Render qua SiteRenderer. | **GIVEN** Block object không có property `blockType` **WHEN** SiteRenderer check `if (!block.blockType) return null` **THEN** Block bị skip hoàn toàn. Không error, không ảnh hưởng flow các blocks khác. | High | [x] |
| **[NHOM 3] Theme Integration & CSS Variables** |
| **TC-F04.13** | `Theme` | `UI` | **[Positive]** Theme CSS variables áp dụng đúng cho tất cả blocks | **1.** Cấu hình theme: primaryColor `#ff6600`, fontHeading `Poppins`, colorMode `light`.<br>**2.** Render page với 5 blocks khác nhau. | **GIVEN** ThemeConfig truyền vào SiteRenderer **WHEN** CSS render **THEN** `:root` variables: `--brand-primary: #ff6600`, `--font-heading: 'Poppins'`. Body background white (light mode). Heading fonts khớp Poppins. Buttons sử dụng primaryColor. | High | [ ] |
| **TC-F04.14** | `Theme` | `UI` | **[Positive]** Dark mode vs Light mode toggle | **1.** Render cùng layout với colorMode `dark`.<br>**2.** Render lại với colorMode `light`. | **GIVEN** Cùng 1 layout, 2 theme configs khác colorMode **WHEN** Render dark **THEN** Body `background: #09090b`, `color: #fafafa`. **WHEN** Render light **THEN** Body `background: #ffffff`, `color: #09090b`. Tất cả text đọc được (contrast ratio >= 4.5:1). | High | [ ] |
| **[NHOM 4] Responsive Design — Desktop / Tablet / Mobile** |
| **TC-F04.15** | `Responsive` | `UI` | **[Positive]** Tất cả blocks responsive trên mobile 375px | **1.** Render page với 10 block types.<br>**2.** Resize viewport xuống 375px width. | **GIVEN** Page chứa 10 blocks đa dạng **WHEN** Viewport 375px **THEN** Không horizontal scroll bar. Tất cả text đọc được (không bị cắt). Images scale proportionally. Grid layouts chuyển về 1-2 cột. Touch targets >= 44px. | Blocker | [ ] |
| **TC-F04.16** | `Responsive` | `UI` | **[Positive]** Testimonials block responsive 3-col -> 1-col | **1.** Config testimonials: 6 items.<br>**2.** Kiểm tra Desktop (3 cột) -> Tablet (2 cột) -> Mobile (1 cột). | **GIVEN** Testimonials block 6 cards **WHEN** Desktop >= 1024px **THEN** 3 cột. **WHEN** Tablet 768px **THEN** 2 cột. **WHEN** Mobile 375px **THEN** 1 cột full-width, scroll dọc. Cards không overlap, spacing đều. | High | [ ] |
| **[NHOM 5] Performance SLA** |
| **TC-F04.17** | `Perf` | `SLA` | **[Positive]** Render time < 50ms mỗi block (Unit Benchmark) | **1.** Chạy performance profiler: render 1 hero block 100 lần, đo average time.<br>**2.** Lặp lại cho pricing, testimonials, gallery blocks. | **GIVEN** Block config hợp lệ, browser idle **WHEN** Measure `performance.now()` trước và sau render **THEN** Average render time < 50ms cho từng block type. P99 < 100ms. Không memory leak (heap size stable sau 100 iterations). | Critical | [x] |
| **TC-F04.18** | `Perf` | `SLA` | **[Positive]** Lighthouse Performance Score > 90 (Full page 10 blocks) | **1.** Render full page: navigation + hero + features + pricing + testimonials + FAQ + gallery + stats + CTA + footer.<br>**2.** Chạy Lighthouse audit. | **GIVEN** Page đầy đủ 10 blocks **WHEN** Lighthouse audit trên Desktop **THEN** Performance Score > 90. LCP < 2.5s. CLS < 0.1. FID < 100ms. No render-blocking resources từ block components. | Critical | [ ] |
| **TC-F04.19** | `Perf` | `SLA` | **[Positive]** Lazy loading images trong Gallery và Hero blocks | **1.** Render gallery block với 12 ảnh nặng (>500KB mỗi ảnh).<br>**2.** Kiểm tra Network tab — chỉ ảnh in-viewport được tải. | **GIVEN** Gallery 12 ảnh lớn **WHEN** Initial page load **THEN** Chỉ 3-4 ảnh đầu (in-viewport) được tải. Các ảnh dưới fold tải khi scroll gần tới (Intersection Observer). Attribute `loading="lazy"` trên `<img>` tags. | High | [ ] |
| **[NHOM 6] Security — XSS & Content Sanitization** |
| **TC-F04.20** | `Sec` | `XSS` | **[Negative]** Chống XSS injection trong block text content | **1.** Config hero block: title = `<script>alert('xss')</script>Hacked`.<br>**2.** Config about block: description chứa `<img onerror="alert(1)" src="x">`.<br>**3.** Render page. | **GIVEN** Block config chứa XSS payload trong text fields **WHEN** SiteRenderer render blocks **THEN** Script tags bị stripped hoàn toàn. Event handlers (onerror, onclick) bị loại bỏ. Text hiển thị an toàn: "Hacked" (không alert popup). HTML output qua DOMPurify/sanitizer. | Blocker | [x] |
| **TC-F04.21** | `Sec` | `XSS` | **[Negative]** Chống XSS trong Custom HTML block | **1.** Config custom-html block: `html = "<div onmouseover='fetch(\"evil.com\")'>Hover me</div>"`.<br>**2.** Render page. | **GIVEN** Custom HTML block cho phép user nhập HTML tự do **WHEN** Render custom-html block **THEN** Event handlers JS bị strip (onmouseover removed). Chỉ safe HTML tags/attributes còn lại. Iframe sandbox nếu cho phép embed. Không gọi external fetch. | Blocker | [x] |
| **TC-F04.22** | `Sec` | `XSS` | **[Negative]** Chống injection qua image URL (javascript: protocol) | **1.** Config gallery block: image url = `javascript:alert(document.cookie)`.<br>**2.** Config hero block: backgroundImage url = `data:text/html,<script>alert(1)</script>`. | **GIVEN** Image URLs chứa protocol nguy hiểm **WHEN** Block render ảnh **THEN** URLs bị reject hoặc sanitize. Chỉ cho phép `http://`, `https://`, `data:image/*` protocols. `javascript:` protocol bị chặn 100%. | Blocker | [x] |
| **[NHOM 7] Accessibility — WCAG 2.1 AA** |
| **TC-F04.23** | `A11y` | `WCAG` | **[Positive]** Semantic HTML cho tất cả block types | **1.** Render full page 10 blocks.<br>**2.** Chạy axe-core accessibility audit. | **GIVEN** Full page rendered **WHEN** axe-core scan **THEN** Zero critical violations. Navigation dùng `<nav>`, hero dùng `<section>` với heading hierarchy (h1 > h2 > h3). Footer dùng `<footer>`. Images có `alt` text. Links có descriptive text (không "click here"). | High | [ ] |
| **TC-F04.24** | `A11y` | `WCAG` | **[Positive]** Keyboard navigation qua FAQ accordion và CTA buttons | **1.** Tab qua page từ navigation tới footer.<br>**2.** Enter trên FAQ item để expand.<br>**3.** Tab tới CTA button, Enter để activate. | **GIVEN** User chỉ dùng keyboard **WHEN** Tab navigation **THEN** Focus outline hiển thị rõ ràng trên mọi interactive element. FAQ items expand/collapse bằng Enter/Space. Tab order logic (top -> bottom, left -> right). Không focus trap. | High | [ ] |
| **TC-F04.25** | `A11y` | `WCAG` | **[Positive]** Color contrast ratio >= 4.5:1 cho text trên background | **1.** Render page với dark theme (text #fafafa trên nền #09090b).<br>**2.** Render page với light theme (text #09090b trên nền #ffffff).<br>**3.** Kiểm tra primary color buttons. | **GIVEN** Theme config chuẩn **WHEN** Measure contrast ratio **THEN** Body text contrast >= 4.5:1 (AA). Large text (heading) contrast >= 3:1. CTA button text trên primary color background >= 4.5:1. Không text "invisible" (same color as background). | High | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của AI Builder + End User._

1. **[AI Gen -> Render]**: User gõ lệnh AI "Tạo landing page cho quán cafe". AI trả về layout JSON chứa 8 blocks (navigation, hero, features, gallery, testimonials, pricing, CTA, footer). SiteRenderer nhận layout và render toàn bộ 8 blocks thành trang web hoàn chỉnh trong <400ms (TC-F04.01, 02, 17).
2. **[Invalid Config Recovery]**: AI gen sai 1 block (thiếu field required). BlockErrorBoundary bắt lỗi, hiện fallback. 7 blocks còn lại render bình thường. User không thấy white screen (TC-F04.08, 09).
3. **[Responsive Preview]**: User chuyển sang mobile preview 375px. Tất cả blocks co giãn responsive — navigation chuyển hamburger, gallery grid 1 cột, pricing cards stack dọc. Không horizontal scroll (TC-F04.15, 16).
4. **[Security Sweep]**: QA inject XSS payload vào hero title qua AI chat. Content bị sanitize, không alert popup. Custom HTML block strip event handlers. Lighthouse audit pass >90 (TC-F04.20, 21, 18).
5. **[Accessibility Audit]**: Screen reader navigate full page bằng keyboard. Tab order logic, heading hierarchy đúng, images có alt text. axe-core zero critical violations (TC-F04.23, 24, 25).

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes) |
|---|---|---|
| **1. Block Coverage (20/20 types)** | [ ] Đã chạy 0/6 TC | Tất cả 20 block types trong registry phải render thành công. `blockRegistry.count === 20`. |
| **2. Error Boundary & Invalid Config** | [ ] Đã chạy 0/6 TC | 100% invalid configs bị catch. Không white screen. BlockErrorBoundary isolate lỗi per-block. |
| **3. Responsive (Desktop/Tablet/Mobile)** | [ ] Đã chạy 0/2 TC | Không horizontal scroll trên 375px. Grid layouts adaptive. Touch targets >= 44px. |
| **4. Performance SLA** | [ ] Not Run | Render < 50ms/block. Lighthouse > 90. Lazy loading images. No memory leak. |
| **5. Security (XSS Zero)** | [ ] Not Run | DOMPurify sanitize toàn bộ user content. javascript: protocol blocked. Custom HTML sandboxed. |
| **6. Accessibility WCAG 2.1 AA** | [ ] Not Run | axe-core zero critical. Keyboard navigable. Contrast >= 4.5:1. Semantic HTML. |
| **7. E2E UAT Approval** | [ ] Not Run | Full AI-gen -> render -> preview -> publish flow hoạt động end-to-end. |

---
> **Khuyến Nghị Release:** Block Renderer Engine là hệ thống lõi (Core) của sản phẩm — mọi trang web đều phụ thuộc vào nó. Yêu cầu **100% Blocker TCs pass** + **Lighthouse > 90** + **Zero XSS** trước khi release. Khuyến nghị chạy automated regression suite (12 TCs đánh dấu AUTO) mỗi PR merge.
