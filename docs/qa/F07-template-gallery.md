# Kịch bản Kiểm thử Đầu cuối (E2E Test Matrix) - F07: Template Gallery

> **Module:** F07 — Template Gallery (Thư viện Giao diện Mẫu)
> **Author:** QA Automation Team
> **Mục tiêu:** Mật độ bao phủ (Coverage) 100% PRD & NFRs. Đảm bảo chất lượng Frontend, Backend và Infrastructure.
> **Phạm vi (Env):** Staging (`staging.primeweb.app`)
> **Chú thích Locators:** Selector (ID/CSS/Xpath) được gắn trực tiếp vào Test Steps phục vụ cho Script Playwright Java.

---

## 1. [US-01] Quản lý Duyệt và Lọc Mẫu (API / Tối ưu Hiệu năng)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_001` | Func | [Pos] Tải trang mặc định (All Categories) | Yes | High | 1. Navigate `/templates`. Kiểm tra mảng `data` API `/api/templates`.<br> *`[Loc: div.template-grid > article.template-card]`* | Lưới Card hiển thị mặc định (All). Các Card chứa Thumbnail, Name, Tags. Danh sách sắp xếp theo `Sort: Popularity DESC`. | | `Not Run` |
| `TC_F07_002` | UI | [Pos] Trạng thái Hover Card (Micro-interaction) | Yes | Med | 1. Di chuột (Hover) vào Card Template.<br> *`[Loc: article.template-card:hover]`* | Card scale tỷ lệ hợp lý (`transform: scale(1.02)`). Xuất hiện Overlay chứa nút `Preview` và `Use Template`. Transition mượt mà. | | `Not Run` |
| `TC_F07_003` | Func | [Pos] Lọc Category (Data hợp lệ) | Yes | High | 1. Click Category Filter `[Fashion]`.<br> *`[Loc: button[data-filter="fashion"]]`* | API gửi Request `?where[category][equals]=fashion`. UI cập nhật danh sách Fashion tức thì. URL Bar thay đổi tương ứng. | | `Not Run` |
| `TC_F07_004` | Bound| [Neg] Lọc Category (Empty State - 0 kết quả) | Yes | High | 1. Truy cập URL filter rỗng `?category=empty_category_99`.<br> *`[Loc: section.empty-state]`* | Giao diện hiển thị Empty State: Hình ảnh Placeholder & Text "No templates in this category". Ứng dụng không Crash. | | `Not Run` |
| `TC_F07_005` | Logic| [Neg] Xử lý Race Condition (Debounce Click) | No | High | 1. Click liên tục các Category: Fashion -> F&B -> Services -> All trong 1 giây. | Áp dụng AbortController cho Fetch API. Hệ thống chỉ Render kết quả của API Call cuối cùng. Không xảy ra lỗi trộn lẫn Data. | | `Not Run` |
| `TC_F07_006` | Perf | [Pos] Phân trang (Pagination/Infinite Scroll) | Yes | High | 1. Mock Data 100 Templates vào `Fashion`.<br>2. Cuộn trang đến cuối danh sách (Bottom).<br> *`[Loc: div.intersection-observer-trigger]`* | Kích hoạt API phân trang `limit=12&page=2`. Chỉ số First Contentful Paint (FCP) ổn định. Hạn chế chiếm dụng RAM trình duyệt (OOM). | | `Not Run` |
| `TC_F07_007` | Perf | [Pos] Tối ưu hóa Ảnh Thumbnail qua CDN | No | Blocker| 1. Kiểm tra Network Tab (Log tab Img). Load danh sách.<br> *`[Loc: img.template-thumbnail]`* | Src URL trỏ qua Image CDN (VD: `_next/image`). Định dạng ảnh tự động chuyển sang `WebP/AVIF`. Dung lượng mỗi ảnh `< 100KB/tỷ lệ`. | | `Not Run` |

---

## 2. [US-02] Trải nghiệm Xem Trước (Modal & iFrame Sandboxing)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_008` | Func | [Pos] Mở Modal Full-Screen Preview | Yes | High | 1. Click "Preview" button trên Card.<br> *`[Loc: button.btn-open-preview]`* | Ngăn Scroll trang gốc (`overflow: hidden`). Hiển thị Full-screen Modal. Nút `[Use This Template]` Sticky trên Header. | | `Not Run` |
| `TC_F07_009` | A11Y | [Pos] Điều hướng Keyboard (Focus Trap/WCAG) | Yes | Med | 1. Sử dụng phím `Tab` duyệt element. Nhấn `Escape` thoát.<br> *`[Loc: dialog.preview-modal]`* | **Focus Trapping:** Tab Index giới hạn lặp vòng trong Modal. Nút `Escape` đóng Modal chính xác trạng thái. | | `Not Run` |
| `TC_F07_010` | UI | [Pos] Chuyển đổi trạng thái Desktop / Mobile view | Yes | High | 1. Click Icon Toggle Mobile/Desktop.<br> *`[Loc: button.device-mobile]`, `[Loc: iframe#preview-frame]`* | Iframe Width cố định về `375px` (Mobile) và `100%` (Desktop). Layout Template phản hồi Responsive CSS Media Query chính xác. | | `Not Run` |
| `TC_F07_011` | UI | [Neg] Xử lý lỗi Tải iFrame (Fallback UI) | No | Med | 1. Đoạn iFrame trỏ về URL 404 (Không tồn tại/Timeout).<br> *`[Loc: iframe#preview-frame]`* | Kích hoạt sự kiện `iframe.onerror`. Hiển thị Fallback Component báo lỗi: "Preview not available, please try again". Ẩn iFrame rỗng. | | `Not Run` |
| `TC_F07_012` | Sec | [Neg] Chống Clickjacking trên iFrame (Sandboxing) | Yes | Blocker| 1. Inject thẻ `<a href="..." target="_parent">` vào giao diện Template Preview.<br>2. Bấm URL Mới. | Thuộc tính `sandbox="allow-scripts allow-same-origin"` khả dụng. Ngăn chặn Event chuyển hướng trang `/templates` của trang gốc (Parent Window). | | `Not Run` |

---

## 3. Quản trị URL và Chế độ Chia sẻ (Deep Linking)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_013` | Logic| [Pos] Khởi tạo Modal Preview qua Deep Linking | Yes | High | 1. Push URI trực tiếp: `/templates?preview=64f1a23b`<br> *`[Loc: dialog.preview-modal]`* | Router Capture Query Param. Hệ thống Tự Động mở popup Modal Preview của đúng Document ID tham số mà không yêu cầu thao tác Click. | | `Not Run` |
| `TC_F07_014` | Bound| [Neg] URL Deep Link không tồn tại (Fake ID 404) | Yes | Med | 1. Push URI trực tiếp: `/templates?preview=fake_id_123`<br> *`[Loc: div.toast-error]`* | Hệ thống bắt lỗi Exception HTTP 404. Xóa Query Param, giữ nguyên nền Grid. Hiển thị UI Toast "Template không tồn tại". | | `Not Run` |
| `TC_F07_015` | UX | [Pos] Đóng Modal và Duy trì Scroll State | No | Med | 1. Cuộn tới Y=1500px -> Mở Modal Preview -> Đóng Modal (X).<br> *`[Loc: button.btn-close-modal]`* | Event Close kích hoạt History Back. Xóa `?preview=`. ScrollY (1500px) được bảo toàn tại List ban đầu, không Reset cuộn lên trên đỉnh. | | `Not Run` |

---

## 4. [US-03] Luồng Khởi tạo Template (Core Backend CMS & Security)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_016` | Logic| [Neg] Chặn Un-auth Access (Redirect Flow) | Yes | Blocker| 1. Trạng thái Khách (Guest). Click nút `Use This Template`.<br> *`[Loc: button.btn-use-template]`* | Backend HTTP 401. Route Navigation dời sang `/login?returnUrl=/templates?preview=xxx`. Khôi phục Session điều hướng người dùng lại sau login. | | `Not Run` |
| `TC_F07_017` | Bound| [Pos] Cấu hình Slug: Kiểm thử Giới hạn biên (Max/Min) | Yes | High | 1. Nhập Slug: `a` (Boundary Min: 1 char).<br>2. Nhập Slug: (Boundary Max: 63 ký tự alphanumeric).<br> *`[Loc: input#store-slug]`* | Validation hợp lệ theo dải RFC Sub-domain. Tham số API Submit `/api/sites` đạt Status 201 Created. | | `Not Run` |
| `TC_F07_018` | Logic| [Neg] Check lặp Slug (Debounce Async Validator) | Yes | High | 1. Submit chuỗi "demo-shop" (Đã đăng ký trước trên DB).<br> *`[Loc: input#store-slug]`* | Gọi API HEAD verify. Frontend hiển thị báo lỗi Exists: "Tên miền đã tồn tại, vui lòng chọn tên khác". Ngăn ngừa lỗi MongoDB Duplicate Key. | | `Not Run` |
| `TC_F07_019` | Sec | [Neg] Payload Injection CMS (NoSQLi / XSS) | Yes | Blocker| 1. Nhập Input Slug Payload: `{"$ne": null}` hoặc `<script>alert('xss')</script>`.<br> *`[Loc: input#store-slug]`* | Middleware Validation và Sanitizer xử lý lọc bỏ RegExp chuỗi ngoài dải `a-z0-9-`. Block request không xác thực (Trả HTTP 422 Bad Request). Cơ sở dữ liệu an toàn. | | `Not Run` |
| `TC_F07_020` | Sec | [Neg] Double Submission Form Protection | Yes | Med | 1. Double-click nhanh liên tục vào nút `[Confirm Create]`.<br> *`[Loc: button.btn-submit-create]`* | Trạng thái nút bấm Button `[disabled=true]` được kích hoạt lập tức sau Click số 1. Ngăn chặn Server gửi Multi-Request POST chồng chéo. | | `Not Run` |
| `TC_F07_021` | Logic| [Pos] Cách ly Dữ liệu (Deep Clone Isolation) | Yes | Blocker| 1. Tạo Site mới `/editor/{id}` -> Thay đổi Tiêu đề và Hình ảnh -> Lấy Account khác mở xem Master Template chuẩn. | Tiến trình sao chép Database thực hiện Recursive Deep Copy (Media, Blocks). Template gốc (Readonly Document) bảo toàn Document Data miễn nhiễm 100% trước thao tác Edit của Site User. | | `Not Run` |
| `TC_F07_022` | Perf | [Neg] Giới hạn thời gian (Timeout) & 504 Gateway | Yes | High | 1. Giả lập chặn kết nối API (Stub Server Timeout / 504).<br> *`[Loc: div.toast-container]`* | Thời gian Response Backend lọt ngưỡng Timeout SLA. Frontend giải phóng State Loading, Render Toast Error màu đỏ "Creation Timeout, vui lòng thử lại". Nút submit cho phép Retry. | | `Not Run` |
| `TC_F07_023` | Func | [Pos] Route Handoff Thành công (< 5s SLA) | Yes | High | 1. Trigger Luồng tạo Template hợp lệ (No Errors).<br> *`[Loc: button.btn-submit-create]`* | API kết xuất HTTP 201 trong chuẩn SLA `< 5s`. Tự động rẽ nhánh sang Route `[Editor_URL]`. App Editor khởi tạo đủ Component Content của Site mới. | | `Not Run` |

---

## 5. [A11Y & UAT] Môi trường Giao diện Thực tế (End-User Experience)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_024` | UX | [Pos] Thuộc tính Hình ảnh & Text Thay thế (A11Y) | Yes | High | 1. Kiểm duyệt DOM Image Tag Attribute.<br> *`[Loc: img.template-thumbnail]`* | Trị số chuẩn WCAG: Component Image sở hữu giá trị `alt="Template [Name]"`. Hỗ trợ Screen Reader đọc hiểu và hiện Fallback Text nếu băng thông tải ảnh bị đứt gãy. | | `Not Run` |
| `TC_F07_025` | UX | [Pos] Phục hồi Navigation (Empty Filters) | Yes | Med | 1. Cấu hình Filter Category rỗng (0 kết quả).<br> *`[Loc: button.btn-clear-filter]`* | Container Empty State bắt buộc đi kèm nút CTA Button "Clear All Filters" (Xóa bộ lọc). Cung cấp phím tắt khôi phục danh sách hiển thị gốc cho User. | | `Not Run` |
| `TC_F07_026` | UI | [Neg] Tương thích Windows OS Scrollbar Padding | No | High | 1. Load trình duyệt kích thước Max Width (100vw) bằng OS Windows. Thực hiện cuộn dọc. | Thuộc tính CSS phân bổ Padding Grid bù trừ bề ngang Width thanh Scrollbar của Windows (15-17px). Đảm bảo thẻ Card không rớt dòng do mất Wrap Box. | | `Not Run` |
| `TC_F07_027` | E2E | [Pos] Tính nhất Quán Dữ liệu (Post-Creation Reality) | No | Blocker| 1. Nhân Bản Template A sang Site cá nhân. Mở URL Public Live của Site mới trên Tab ẩn danh (Incognito). | Giao diện Public Live trùng khớp CSS/Font và Layout 100% so với Template Demo Iframe trong hệ thống. | | `Not Run` |
| `TC_F07_028` | UX | [Pos] Luồng phản hồi tiến trình (Loading Micro-Feedback) | Yes | Low | 1. Mạch tạo Site `Use This Template` gửi Request. Đợi 2-4 giây.<br> *`[Loc: div.toast-success]`, `[Loc: div.loading-progress-bar]`* | UI Khởi chạy Animated Toast "Đang khởi tạo Site...". Thanh Progress-Bar giả lập tiến trình (Fake Progress) mức 90-95% trước khi Server trả Res để tối ưu User Experience. | | `Not Run` |
| `TC_F07_029` | Perf | [Pos] Tối ưu hóa FOUT/FOIT (Chống chớp Text trống) | No | High | 1. Mô phỏng Slow Network. Load màn Gallery `/templates`. Đứng Đợi phản hồi. | Lệnh CSS `font-display: swap` được áp dụng. Chuỗi Text Label/Category Render bằng System Font thay thế. Chống vi phạm màn hình trắng nội dung (FOIT) trong lúc chờ gói Web Fonts tải xuống. | | `Not Run` |

---

## 6. [i18n] Đa ngôn ngữ và Địa phương hóa (Localization)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_030` | Func | [Pos] Chuyển đổi ngôn ngữ UI Giao diện (Language Switcher) | Yes | High | 1. Chọn ngôn ngữ `Tiếng Việt (VI)` trên Header.<br> *`[Loc: div.lang-switcher > button[value="vi"]]`* | Hệ thống văn bản tĩnh của Gallery (Tab Category, Nút "Preview", "Use This Template") chuyển sang tiếng Việt lập tức (Client-side sync) mà không tải/F5 lại trang. | | `Not Run` |
| `TC_F07_031` | Func | [Pos] Đồng bộ Ngôn ngữ vào Data Modal Preview iFrame | Yes | High | 1. Thiết lập ngữ cảnh gốc `VI`, click Preview một Template.<br> *`[Loc: iframe#preview-frame]`* | URL của Modal iFrame được tự động Push tham số ngôn ngữ hiện tại (VD: `src="/template-demo/123?lng=vi"`). Website Mẫu bên trong iFrame Render nội dung toàn bộ bằng Tiếng Việt. | | `Not Run` |
| `TC_F07_032` | Logic| [Pos] Khởi tạo Site CMS Kế thừa trạng thái Ngôn ngữ | Yes | High | 1. Điều hướng duyệt ở ngôn ngữ `Bahasa Melayu (MS)`.<br>2. Bấm tạo Site từ Template.<br> *`[Loc: button.btn-submit-create]`* | Parameter `locale: "ms"` được truyền mượt dưới HTTP POST CMS Payload. Cấu trúc DB khởi tạo Site mới được gán mặc định Config ngôn ngữ Malay khi Handoff qua màn hình Editor. | | `Not Run` |

---

## 7. [Design / Visual QA] Kiểm duyệt Giao diện & Hệ thống Thiết kế (Match Figma)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F07_033` | UI | [Pos] Xác thực Design System Tokens (Màu sắc, Typography) | No | High | 1. Inspect DOM phần tử UI của Gallery (Nút CTA, Tựa đề Thẻ).<br> *`[Loc: h3.template-title]`, `[Loc: button.btn-primary]`* | Sử dụng công cụ đo màu và Computed CSS: Font chữ (VD: `Inter`), Font weight (`500/600`), Mã màu Brand (`#1A73E8`), Độ bo góc `border-radius` thẻ Card phải khớp chuẩn 100% với Asset của Figma. | | `Not Run` |
| `TC_F07_034` | UI | [Pos] Xác thực Grid Spacing & Layout Alignment | No | High | 1. Inspect khoảng cách dọc ngang giữa các Thẻ Template (Grid Gap).<br> *`[Loc: div.template-grid]`* | Khoảng cách Margin/Padding và Grid Gap (`gap-6`, `24px`) tuân thủ nghiêm ngặt hệ thống khoảng trắng của UI Kit. Content trong thẻ Căn lề trái/phải không bị lệch dù Text dài hay ngắn. | | `Not Run` |
| `TC_F07_035` | UI | [Pos] Visual Regression Testing (So khớp Pixel-Perfect) | Yes | High | 1. Chạy Auto-script chụp ảnh màn hình Component `Template Card` và `Preview Modal`.<br>2. Dùng thư viện Compare Image. | Tool tự động so khớp ảnh chụp thực tế với ảnh "Golden Baseline" cắt từ Figma. Dung sai lệch khác biệt hình ảnh (Diff Tolerance) phải `< 0.1%`. Bắt chính xác lỗi Font, Màu, hoặc Padding sai lệch. | | `Not Run` |
| `TC_F07_036` | UI | [Pos] Kiểm tra Asset Trực quan Empty State | No | Med | 1. Truy cập mảng Filter rỗng (0 templates).<br> *`[Loc: img.empty-state-illustration]`* | Không chỉ hiển thị Text thô, hệ thống bắt buộc Render chính xác File SVG/WebP Illustration minh họa trạng thái "Trống" độc quyền do team Design thiết kế, kích thước tỷ lệ chuẩn giữa màn hình. | | `Not Run` |

---

## 8. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates - F07)

| Criteria | Status | Target Agent .SKILL |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Not Run | `Locator_Healer_Agent`: Focus Playwright handle DOM Scrollbar, Hover states, CSS Match. |
| **2. API & Logic Functions** | [ ] Not Run | `BDD_Cucumber_Agent`: Validate Filter Edge cases, CMS Submission Workflow. |
| **3. Security & Isolation** | [ ] Not Run | `QC_Fixer_Test`: Audit NoSQLi Payload, Deep Clone Independent DB, Sandboxing iFrame. |
| **4. Performance SLA** | [ ] Not Run | `Performance_Tester`: Load Test Grid Pagination / FCP < 1.2s, SLA Handoff < 5s. |
| **5. E2E UAT Approval** | [ ] Not Run | Pass P0/P1 Suite (Blocker & High Priority Results = 100% Passed). |

