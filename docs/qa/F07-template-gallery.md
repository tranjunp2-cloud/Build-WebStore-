# Kịch bản Kiểm thử Đầu cuối (E2E Test Matrix) - F07: Template Gallery
> **Module:** F07 — Template Gallery (Thư viện Giao diện Mẫu)
> **Phiên bản:** 1.0 | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Automation Team
> **Mục tiêu:** Coverage 100% PRD & NFRs — Frontend, Backend, Infrastructure.
> **Môi trường:** Staging (`staging.primeweb.app`)

---

## 1. Mục Tiêu (Objective)

Tài liệu Test Case này đảm bảo chất lượng toàn diện cho **Template Gallery (F07)** — module cho phép người dùng duyệt, xem trước, và khởi tạo website từ mẫu có sẵn. **Tổng cộng 46 kịch bản** bao phủ: Filtering, Preview Modal, Deep Linking, Template Initialization, AI Search, Smart Mapping & Undo, Mobile UX, i18n, Design QA.

---

## 2. Test Environment

| Biến | Yêu cầu |
|---|---|
| Môi trường | Staging (`staging.primeweb.app`) |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices | Desktop (1920x1080), Mobile (< 768px) |
| SLA | FCP < 1.2s, Template Handoff < 5s, Images < 100KB |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-01: Quản lý Duyệt và Lọc Mẫu (7 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_001** | `Func` | **[Positive]** Tải trang mặc định (All Categories) | 1. Truy cập `/templates`.<br>2. Kiểm tra API `/api/templates` trong Network tab. | - Lưới card hiển thị mặc định (All).<br>- Mỗi card có Thumbnail, Name, Tags.<br>- Sắp xếp theo `Sort: Popularity DESC`. | High | Yes |
| **TC_F07_002** | `UI` | **[Positive]** Hover Card — Micro-interaction | 1. Di chuột (Hover) lên bất kỳ Template Card. | - Card scale lên nhẹ (`transform: scale(1.02)`).<br>- Overlay xuất hiện với 2 nút: "Preview" và "Use Template".<br>- Transition mượt mà. | Med | Yes |
| **TC_F07_003** | `Func` | **[Positive]** Lọc theo Category | 1. Click Category Filter `[Fashion]`. | - API gửi request `?where[category][equals]=fashion`.<br>- Danh sách cập nhật ngay lập tức.<br>- URL thay đổi tương ứng. | High | Yes |
| **TC_F07_004** | `Bound` | **[Negative]** Category không có kết quả (0 items) | 1. Truy cập URL `?category=empty_category_99`. | - Hiển thị Empty State: hình placeholder + text "No templates in this category".<br>- Ứng dụng không crash. | High | Yes |
| **TC_F07_005** | `Logic` | **[Negative]** Race Condition khi click Filter nhanh | 1. Click liên tục: Fashion → F&B → Services → All trong 1 giây. | - AbortController hủy các request cũ.<br>- Chỉ render kết quả của API Call cuối cùng.<br>- Không trộn lẫn data giữa các filter. | High | No |
| **TC_F07_006** | `Perf` | **[Positive]** Phân trang (Pagination/Infinite Scroll) | 1. Mock 100 templates vào category Fashion.<br>2. Cuộn trang đến cuối. | - Kích hoạt API `limit=12&page=2`.<br>- FCP ổn định.<br>- Không chiếm quá nhiều RAM (chống OOM). | High | Yes |
| **TC_F07_007** | `Perf` | **[Positive]** Ảnh Thumbnail tối ưu qua CDN | 1. Mở Network tab, tải danh sách templates. | - URL ảnh trỏ qua Image CDN (`_next/image`).<br>- Định dạng tự chuyển sang WebP/AVIF.<br>- Dung lượng mỗi ảnh **< 100KB**. | Blocker | No |

---

### US-02: Trải nghiệm Xem Trước — Modal & iFrame Sandboxing (5 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_008** | `Func` | **[Positive]** Mở Modal Full-Screen Preview | 1. Click nút "Preview" trên Template Card. | - Scroll trang gốc bị chặn (`overflow: hidden`).<br>- Modal Full-screen hiển thị.<br>- Nút `[Use This Template]` Sticky trên Header Modal. | High | Yes |
| **TC_F07_009** | `A11Y` | **[Positive]** Điều hướng bằng Keyboard (Focus Trap / WCAG) | 1. Nhấn Tab để duyệt các element trong Modal.<br>2. Nhấn Escape để thoát. | - **Focus Trap**: Tab Index lặp vòng bên trong Modal.<br>- Nhấn Escape đóng Modal và phục hồi focus đúng trạng thái. | Med | Yes |
| **TC_F07_010** | `UI` | **[Positive]** Chuyển đổi Desktop / Mobile view trong Preview | 1. Click icon Toggle Mobile trong Modal Preview. | - Iframe chuyển về width `375px` (Mobile).<br>- Click lại → width `100%` (Desktop).<br>- Template responsive đúng theo CSS Media Query. | High | Yes |
| **TC_F07_011** | `UI` | **[Negative]** Fallback khi iFrame không tải được | 1. Trỏ iFrame preview đến URL 404 hoặc bị timeout. | - Sự kiện `iframe.onerror` được bắt.<br>- Hiển thị Fallback: "Preview not available, please try again".<br>- iFrame rỗng bị ẩn. | Med | No |
| **TC_F07_012** | `Sec` | **[Negative]** Chống Clickjacking qua iFrame Sandboxing | 1. Inject thẻ `<a href="..." target="_parent">` vào nội dung Preview.<br>2. Click link đó. | - Thuộc tính `sandbox="allow-scripts allow-same-origin"` ngăn chặn điều hướng Parent Window.<br>- Trang `/templates` không bị redirect. | Blocker | Yes |

---

### Section 3: Quản trị URL & Deep Linking (3 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_013** | `Logic` | **[Positive]** Mở Modal qua Deep Link | 1. Truy cập trực tiếp `/templates?preview=64f1a23b`. | - Router tự động mở Modal Preview đúng template có ID `64f1a23b`.<br>- Không cần click thủ công. | High | Yes |
| **TC_F07_014** | `Bound` | **[Negative]** Deep Link với ID không tồn tại | 1. Truy cập `/templates?preview=fake_id_123`. | - Bắt lỗi HTTP 404.<br>- Xóa query param `?preview=`.<br>- Hiển thị Toast "Template không tồn tại".<br>- Lưới template gốc vẫn hiển thị. | Med | Yes |
| **TC_F07_015** | `UX` | **[Positive]** Đóng Modal & giữ nguyên vị trí scroll | 1. Cuộn xuống Y=1500px.<br>2. Mở Modal Preview.<br>3. Đóng Modal (X). | - URL xóa `?preview=`.<br>- Trang giữ nguyên vị trí scroll Y=1500px, không cuộn về đầu. | Med | No |

---

### US-03: Luồng Khởi tạo Template — Core Backend CMS & Security (8 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_016** | `Logic` | **[Negative]** Chặn Guest không có auth | 1. Ở trạng thái Guest (chưa đăng nhập).<br>2. Click nút `[Use This Template]`. | - Backend trả HTTP 401.<br>- Redirect sang `/login?returnUrl=/templates?preview=xxx`.<br>- Sau khi đăng nhập, điều hướng lại đúng template. | Blocker | Yes |
| **TC_F07_017** | `Bound` | **[Positive]** Validate Slug: kiểm tra biên Min/Max | 1. Nhập Slug: `a` (1 ký tự — Min).<br>2. Nhập Slug: 63 ký tự alphanumeric (Max). | - Cả hai trường hợp đều hợp lệ theo RFC Sub-domain.<br>- API POST `/api/sites` trả về **HTTP 201 Created**. | High | Yes |
| **TC_F07_018** | `Logic` | **[Negative]** Slug đã tồn tại (Async Debounce Validator) | 1. Nhập slug "demo-shop" (đã có trong DB).<br>2. Quan sát validation. | - Gọi API HEAD để kiểm tra.<br>- Hiển thị lỗi "Tên miền đã tồn tại, vui lòng chọn tên khác".<br>- Không tạo bản ghi trùng (MongoDB Duplicate Key). | High | Yes |
| **TC_F07_019** | `Sec` | **[Negative]** Injection vào Slug (NoSQLi / XSS) | 1. Nhập Slug: `{"$ne": null}` hoặc `<script>alert('xss')</script>`. | - Middleware sanitize, chỉ cho phép ký tự `a-z0-9-`.<br>- Trả về **HTTP 422 Bad Request**.<br>- DB không bị ảnh hưởng. | Blocker | Yes |
| **TC_F07_020** | `Sec` | **[Negative]** Chặn Double Submit Form | 1. Double-click nhanh vào nút `[Confirm Create]`. | - Nút Disabled ngay sau lần click đầu.<br>- Chỉ gửi 1 request POST lên server. | Med | Yes |
| **TC_F07_021** | `Logic` | **[Positive]** Cách ly dữ liệu Template gốc (Deep Clone) | 1. Tạo site từ template A, sửa tiêu đề và ảnh.<br>2. Dùng tài khoản khác mở xem master template A. | - Template gốc không bị thay đổi (Readonly Document).<br>- Deep Copy hoạt động đúng (Media + Blocks được clone độc lập). | Blocker | Yes |
| **TC_F07_022** | `Perf` | **[Negative]** Timeout & 504 Gateway Error | 1. Giả lập timeout API server khi tạo template.<br>2. Quan sát UI. | - Frontend giải phóng Loading state sau ngưỡng timeout.<br>- Toast đỏ "Creation Timeout, vui lòng thử lại".<br>- Nút Submit cho phép Retry. | High | Yes |
| **TC_F07_023** | `Func` | **[Positive]** Handoff thành công sang Editor (< 5s SLA) | 1. Thực hiện luồng tạo template hợp lệ. | - API trả về HTTP 201 trong **< 5 giây**.<br>- Tự động redirect sang `/editor/{siteId}`.<br>- Editor khởi tạo đầy đủ nội dung site mới. | High | Yes |

---

### US-04 & A11Y: UX & Accessibility (6 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_024** | `UX` | **[Positive]** Alt text cho ảnh Thumbnail (WCAG) | 1. Inspect DOM các thẻ `<img>` trong lưới Template. | - Mỗi ảnh có `alt="Template [Name]"`.<br>- Screen Reader đọc được mô tả.<br>- Nếu ảnh không tải: Fallback text hiển thị. | High | Yes |
| **TC_F07_025** | `UX` | **[Positive]** Nút "Clear Filters" khi không có kết quả | 1. Chọn category không có template.<br>2. Quan sát Empty State. | - Empty State hiển thị kèm nút CTA "Clear All Filters".<br>- Nhấn nút → danh sách gốc được khôi phục. | Med | Yes |
| **TC_F07_026** | `UI` | **[Negative]** Tương thích với Windows OS Scrollbar | 1. Load trang ở width `100vw` trên Windows.<br>2. Cuộn trang dọc. | - CSS bổ thêm padding bù trừ độ rộng thanh scrollbar Windows (15-17px).<br>- Card không bị rớt dòng. | High | No |
| **TC_F07_027** | `E2E` | **[Positive]** Dữ liệu thống nhất sau khi tạo site | 1. Clone template A sang site cá nhân.<br>2. Mở URL Public của site mới trên tab ẩn danh (Incognito). | - Giao diện Public trùng khớp 100% CSS/Font/Layout với template Demo trong hệ thống. | Blocker | No |
| **TC_F07_028** | `UX` | **[Positive]** Loading Micro-Feedback khi tạo site | 1. Nhấn "Use This Template", chờ 2-4 giây. | - Toast "Đang khởi tạo Site..." xuất hiện.<br>- Progress Bar giả lập tiến trình (Fake Progress lên 90-95%) trước khi server trả response. | Low | Yes |
| **TC_F07_029** | `Perf` | **[Positive]** Chống FOIT — Chớp text trống khi load | 1. Mô phỏng Slow Network, load `/templates`. | - CSS `font-display: swap` được áp dụng.<br>- Text dùng System Font thay thế khi Web Fonts chưa tải.<br>- Không có màn hình trắng nội dung. | High | No |

---
### i18n: Đa ngôn ngữ và Địa phương hóa (3 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_030** | `Func` | **[Positive]** Chuyển ngôn ngữ UI Gallery | 1. Chọn ngôn ngữ "Tiếng Việt (VI)" trên Header. | - Toàn bộ text tĩnh (Tab Category, nút "Preview", "Use This Template") chuyển sang Tiếng Việt ngay lập tức.<br>- Không cần reload trang. | High | Yes |
| **TC_F07_031** | `Func` | **[Positive]** Đồng bộ ngôn ngữ vào Modal Preview iFrame | 1. Đặt ngôn ngữ "VI" trên trang gốc.<br>2. Click Preview một template. | - URL iFrame tự động thêm param ngôn ngữ: `src="/template-demo/123?lng=vi"`.<br>- Nội dung bên trong iFrame hiển thị đầy đủ bằng Tiếng Việt. | High | Yes |
| **TC_F07_032** | `Logic` | **[Positive]** Site mới kế thừa ngôn ngữ khi khởi tạo | 1. Đang duyệt ở ngôn ngữ "Bahasa Melayu (MS)".<br>2. Nhấn tạo site từ template. | - POST payload CMS chứa `locale: "ms"`.<br>- Site mới được khởi tạo mặc định ngôn ngữ Malay trong Editor. | High | Yes |

---

### Design / Visual QA: So khớp Figma (4 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_033** | `UI` | **[Positive]** Xác thực Design Tokens (Màu, Typography) | 1. Inspect DOM các element UI của Gallery (nút CTA, tiêu đề thẻ). | - Font: `Inter`, Weight: `500/600`.<br>- Màu Brand: `#1A73E8`.<br>- `border-radius` thẻ Card khớp 100% Figma. | High | No |
| **TC_F07_034** | `UI` | **[Positive]** Xác thực Grid Spacing & Alignment | 1. Inspect khoảng cách giữa các thẻ Template. | - Grid gap đúng `24px`.<br>- Margin/Padding tuân thủ UI Kit.<br>- Content căn lề không bị lệch dù text dài hay ngắn. | High | No |
| **TC_F07_035** | `UI` | **[Positive]** Visual Regression Testing (Pixel-Perfect) | 1. Chạy script chụp ảnh màn hình "Template Card" và "Preview Modal".<br>2. So khớp với ảnh Golden Baseline từ Figma. | - Sai lệch hình ảnh **< 0.1%** (Diff Tolerance).<br>- Phát hiện chính xác lỗi Font, Màu, Padding. | High | Yes |
| **TC_F07_036** | `UI` | **[Positive]** Asset SVG hiển thị đúng ở Empty State | 1. Lọc category không có template (0 kết quả). | - Không chỉ hiển thị text thô.<br>- Render đúng file SVG/WebP Illustration "trống" do Design team thiết kế, kích thước tỷ lệ chuẩn. | Med | No |

---

### US-04: Cửa sổ AI Search — Natural Language Discovery (2 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_037** | `Func` | **[Positive]** AI Search đa ngôn ngữ (VI/BM) | 1. Nhập: "Mẫu cho shop thể thao" (VI) hoặc "kedai baju" (BM).<br>2. Nhấn Enter. | - API `POST /api/templates/search` trả về >= 2 template phù hợp ngữ cảnh.<br>- Kết quả hiển thị dạng Grid Thumbnails trong **< 2 giây**. | Blocker | Yes |
| **TC_F07_038** | `UI` | **[Negative]** Tìm kiếm không có kết quả (Empty Search) | 1. Nhập từ khóa không có nghĩa thực tế (vd: "Phi hành gia vũ trụ"). | - Grid trả về rỗng.<br>- Hiển thị Illustration "Phi hành gia bối rối" + text "Chúng tôi chưa có mẫu giao diện phù hợp với yêu cầu này". | High | Yes |

---

### US-05 & US-06: Smart Mapping & Editor Undo Mechanism (6 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_039** | `Logic` | **[Positive]** Smart Mapping giữ nguyên nội dung | 1. Sửa Hero Text thành "Sale Khủng".<br>2. Click `[Apply Template]` chọn mẫu B. | - Editor chuyển sang Template B mượt mà trong **< 2 giây**.<br>- Hero Text vẫn là "Sale Khủng" (không bị xóa). | Blocker | Yes |
| **TC_F07_040** | `UI` | **[Negative]** Mapping thiếu block (Orphan Component) | 1. Apply Template B — template này không có section tương ứng với mẫu cũ. | - Template Swap hoàn tất bình thường.<br>- Data cũ được lưu ẩn (Draft state).<br>- Toast vàng: "Một phần giao diện đã được ẩn...". | High | Yes |
| **TC_F07_041** | `Logic` | **[Positive]** Undo 1-Step — phục hồi template cũ | 1. Sau khi Apply mẫu B.<br>2. Nhấn nút đỏ `[⤺ Hoàn tác]` trên Toolbar. | - Backend khôi phục Revision Snapshot trước đó.<br>- Giao diện quay về đúng layout và nội dung Template A gốc. | Blocker | Yes |
| **TC_F07_042** | `Bound` | **[Negative]** Undo Stack bị ghi đè (Chỉ 1 bước) | 1. Apply liên tiếp: Mẫu A → B → C.<br>2. Nhấn Undo lần 1, sau đó lần 2. | - Undo lần 1: quay về B.<br>- Nút Undo **Disabled ngay** (không thể lùi về A).<br>- Chỉ lưu 1 điểm Undo để tránh phình RAM. | High | Yes |
| **TC_F07_043** | `Sec` | **[Negative]** Guard trước khi Save xóa lịch sử Undo | 1. Apply mẫu B.<br>2. Nhấn ngay `[🚀 Lưu]`. | - Popup xác nhận: "Thay đổi sẽ lưu vĩnh viễn, KHÔNG THỂ HOÀN TÁC".<br>- Chọn "Hủy" → Editor giữ nguyên trạng thái an toàn. | Blocker | Yes |
| **TC_F07_044** | `Logic` | **[Positive]** Khóa Undo sau khi commit dữ liệu | 1. Xác nhận Lưu ở Popup (TC_F07_043).<br>2. Quan sát nút Undo sau khi Save thành công. | - `UndoStackManager` xóa cache stack.<br>- Nút Undo chuyển Disabled vĩnh viễn (màu xám).<br>- Không còn khả năng rollback DB. | Blocker | Yes |

---

### US-08: Mobile Web UX (2 Cases)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC_F07_045** | `Mob` | **[Positive]** Bottom Sheet thay vì Modal trên Mobile | 1. Bật viewport < 768px.<br>2. Nhấn mở Gallery Preview. | - Modal chuyển thành Bottom Sheet trượt lên (chiều cao 90vh).<br>- Nút "Preview/Apply" có Touch target ≥ 44×44px. | High | Yes |
| **TC_F07_046** | `UI` | **[Positive]** Grid 2 cột trên Mobile | 1. Xem danh sách templates trên thiết bị Mobile. | - CSS hiển thị `grid-template-columns: repeat(2, 1fr)`.<br>- 2 thumbnail card kề nhau trên 1 hàng, tối ưu không gian lướt. | Med | No |
| **TC_F07_047** | `Logic` | **[Positive]** Apply template giữ font heading/body của template | 1. Template B dùng font ngoài bộ mặc định (Lora, Josefin Sans, Oswald, Karla, Quicksand...).<br>2. Apply template B lên site có sẵn. | - `fontHeading`/`fontBody` của site bằng font của template B.<br>- Không bị đổi về `Outfit`/`Inter` khi font hợp lệ. | High | Yes |
| **TC_F07_048** | `Bound` | **[Negative]** Font không hợp lệ rơi về mặc định | 1. Template có font không nằm trong danh sách font hỗ trợ (vd `Helvetica`).<br>2. Apply template. | - Heading rơi về `Outfit`, body về `Inter`.<br>- Giá trị font lưu vào site luôn nằm trong enum của Sites. | Med | Yes |

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | Load `/templates`, lọc category "Fashion". | Lưới cập nhật ngay, URL đổi params, đúng dữ liệu API (TC_F07_001, 003). |
| 2 | Hover card → click Preview → chuyển Mobile/Desktop view. | Modal hiển thị, iFrame responsive (TC_F07_008, 010). |
| 3 | Deep link `/templates?preview=abc123`, đóng Modal. | Modal tự mở, đóng giữ nguyên scroll position (TC_F07_013, 015). |
| 4 | Click "Use This Template" (Guest user). | Redirect sang Login với `returnUrl` (TC_F07_016). |
| 5 | Đăng nhập → Chọn Slug → Submit. | Validate Slug, Deep Clone template, redirect Editor < 5s (TC_F07_017, 021, 023). |
| 6 | Dùng AI Search "kedai baju", Apply template B, Undo. | Kết quả AI đúng, Smart Mapping giữ content, Undo 1-step thành công (TC_F07_037, 039, 041). |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Not Run | Hover states, CSS Match Figma, Scrollbar Windows, Font FOIT. |
| **2. API & Logic Functions** | [ ] Not Run | Filter Edge cases, CMS Submission, Deep Link, Async Slug Validator. |
| **3. Security & Isolation** | [ ] Not Run | NoSQLi Payload, Deep Clone DB độc lập, Sandboxing iFrame, Double Submit. |
| **4. Performance SLA** | [ ] Not Run | Grid Pagination FCP < 1.2s, Template Handoff < 5s, Images < 100KB. |
| **5. E2E UAT Approval** | [ ] Not Run | Pass toàn bộ Blocker & High Priority TCs (100% passed). |

