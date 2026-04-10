# Bug Report Summary — F05 AI Editor (GitHub Issues)

> **Project:** ECH Prime Web v2
> **Environment:** Staging
> **Date:** 2026-04-10
> **Reported by:** QA Team (Extracted from GitHub Issues & Comments)
> **Status:** 🔴 OPEN — Pending Dev Fix

---

## Tổng quan

| Feature | Tổng Bug | P0 Critical | P1 High | P2 Medium | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| F05 — AI Editor | 21 | 4 | 3 | 3 | 🔴 BLOCKED |

> **⚠️ Release Decision: BLOCKED**
> Có 4 lỗi P0 Critical liên quan đến luồng chính (Block/Crash) phải được fix ngay lập tức.

---

## Bugs (FAILED) — 10 Issues

---

### BUG-F05-001 · Add Page API trả về HTTP 500 — không tạo được trang mới

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-02-04 |
| **Severity** | 🔴 P0 Blocker |
| **Module** | US-02 — Page Manager |
| **Priority** | Blocker |

**Mô tả**
Khi user thêm trang mới qua Page Manager, API `POST /api/sites/18/pages` trả về HTTP 500 Internal Error. Trang KHÔNG được tạo. Backend crash khi xử lý request.

**Bước tái hiện**
1. Vào Editor → mở Page Manager
2. Nhấn "Add New Page"
3. Nhập title, slug preview hiển thị đúng
4. Nhấn "Tạo trang"

**Kết quả thực tế:** `POST /api/sites/18/pages` → HTTP 500 Internal Error. Form vẫn mở, hiện toast lỗi.

**Kết quả mong đợi:** Trang được tạo thành công, Page list refresh hiển thị trang mới.

**Mức độ ảnh hưởng:** User **không thể tạo trang mới** trong Editor. Block hoàn toàn chức năng Page Management.

---

### BUG-F05-002 · Add Navigation Link — 2 vấn đề: nút không tồn tại + overlay chặn click

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-07-07 |
| **Severity** | 🟠 P1 High |
| **Module** | US-07 — Global Header & Footer |
| **Priority** | Blocker |

**Mô tả**
Phát hiện 2 root causes khiến user không thể thêm navigation link:

**Root Cause 1 — Nút "Add Link" KHÔNG TỒN TẠI:**
Trong Menu panel, danh sách buttons hiện có: `[Global, SEO, Menu, Block, Brand Identity, Upload, Contact, Social]`. Không có nút "Add Link" / "Thêm Link". Chỉ có nút "+" thuộc AI Chat (Add Section), không phải Add Menu Link. → Feature thêm menu link **chưa implement UI**.

**Root Cause 2 — Overlay z-50 chặn pointer events:**
Sau khi click vào header area, một `<div class="fixed inset-0 z-50">` (block settings overlay) phủ toàn màn hình và chặn mọi click bên dưới. Overlay này **không tự đóng** khi user chuyển tab/panel, khiến toàn bộ UI bị "đóng băng".

**Bước tái hiện**
1. Vào Editor → click vào Header
2. Panel Menu settings hiện ra bên phải
3. Tìm nút "Add Link" → **không tồn tại**
4. Click tiếp bất kỳ đâu → bị overlay z-50 chặn

**Kết quả thực tế:**
- Không có nút "Add Link" để thêm menu item
- Overlay `fixed inset-0 z-50` chặn pointer events toàn màn hình

**Kết quả mong đợi:**
- Có nút "Add Link" rõ ràng trong Menu panel
- Overlay tự đóng khi chuyển context

---

### BUG-F05-003 · Mobile bottom sheet không trigger — iframe ẩn ở 375px

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-14-07 |
| **Severity** | 🟠 P1 High |
| **Module** | US-14 — Mobile Web UX |
| **Priority** | Blocker |

**Mô tả**
Trên mobile viewport 375px, Preview iframe không hiển thị (boundingBox = null). User không thể tap vào block để trigger bottom sheet editing. Toàn bộ tính năng inline editing trên mobile bị vô hiệu.

**Bước tái hiện**
1. Mở Editor trên mobile hoặc resize viewport về 375px
2. Tap vào bất kỳ block nào trong preview

**Kết quả thực tế:** iframe không visible, boundingBox = null. Bottom sheet không xuất hiện. Không thể interact với blocks.

**Kết quả mong đợi:** Tap vào block → hiện bottom sheet với các tùy chọn edit (AI edit, move, delete).

---

### BUG-F05-004 · Kéo thả Component không mượt mà, UX chớp nhoáng (Drag & Drop)

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-08-xx |
| **Severity** | 🟢 P2 Medium |
| **Module** | Component Library |
| **Nguồn** | Issue #86 (Comment) |

**Mô tả**
Khó sử dụng tính năng kéo thả - không mượt mà khi hover vào sử dụng, hiển thị icon kéo thả chớp nhoáng, tương tác trải nghiệm kéo thả giật lag.

**Kết quả thực tế**
Icon kéo thả hiện chớp nhoáng, khó bắt được event kéo thả mượt mà trên UI. Mất cảm giác trơn tru.

---

### BUG-F05-005 · Tùy chỉnh Trang 404 KHÔNG được tạo mặc định và Bypass URL

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-09-01 |
| **Severity** | 🔴 P0 Blocker |
| **Module** | Custom 404 |
| **Nguồn** | Issue #87 (Comment) |

**Mô tả**
Theo Acceptance Criteria, hệ thống phải tự động generate một trang Custom 404 khi khởi tạo website. Tuy nhiên, luồng tạo trang bị hỏng. Reserved URL slug chưa bị khóa chặn (Block) triệt để.

**Kết quả thực tế**
Trang 404 bị mất tích, `GET /404` không trả về nội dung config. User không thể truy cập Edit Page Settings CMS cho 404.

---

### BUG-F05-006 · Unpublish API Error: Trả về HTTP 200 thay vì 503 Maintenance Mode

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-10-xx |
| **Severity** | 🟠 P1 High |
| **Module** | Publish & Unpublish Flow |
| **Nguồn** | Issue #88 (Comment) |

**Mô tả**
Khi thực hiện gọi thao tác Unpublish để đưa website về trạng thái bảo trì (Maintenance Mode), API endpoint xử lý sai luồng trạng thái mã lỗi HTTP, kèm lỗi Publish Status Badge trên UI vẫn là chấm màu xám thay vì indicator chuẩn.

**Kết quả thực tế**
API request trả về HTTP 200 OK thay vì HTTP 503 Service Unavailable, vi phạm logic workflow bảo trì CMS.

---

### BUG-F05-007 · Lỗi thiếu Options trong mục Global Settings (Chỉ có Facebook, Instagram)

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-12-xx |
| **Severity** | 🟢 P2 Medium |
| **Module** | Global Business Info |
| **Nguồn** | Issue #90 (Comment) |

**Mô tả**
Chức năng gắn link Social Settings yêu cầu phải có đủ 6 inputs nền tảng (Facebook, Instagram, Twitter/X, LinkedIn, YouTube, TikTok). Tuy nhiên cấu hình block form hiển thị trên Settings Panel bị hụt trầm trọng.

**Kết quả thực tế**
UI chỉ xổ ra 2 nền tảng: Facebook + Instagram. Các nền tảng còn lại không tồn tại nút config. 

---

### BUG-F05-008 · Toàn bộ luồng Page SEO bị chặn do lỗi PATCH 500 (Page Manager)

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-13-01 |
| **Severity** | 🔴 P0 Blocker |
| **Module** | Page-Level SEO |
| **Nguồn** | Issue #91 (Comment) |

**Mô tả**
Page Manager gặp lỗi chép đè HTTP 500 khi đẩy update dữ liệu Homepage. Lỗi này chặn luôn hoàn toàn flow lưu thay đổi Meta Title, SEO Description, và SEO AI Optimizer. Toàn bộ feature SEO bị tê liệt cứng trên Staging.

**Kết quả thực tế**
API `PATCH /api/sites/pages` crashed 500, thất bại hoàn toàn trong việc bind dữ liệu SEO Settings vào DB. 

---

### BUG-F05-009 · Preview Iframe trả 500 do thiếu Schema Database (version_is_visible)

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-0x |
| **Severity** | 🔴 P0 Blocker |
| **Module** | Live Preview Iframe |
| **Nguồn** | Issue #65 (Comment) |

**Mô tả**
Tính năng Preview Iframe cho Editor render chết, API Editor Preview trả về Server Error 500. Root cause check Database Error Missing column là do thiếu mất cột `version_is_visible` trong bảng `_pages_v` của Payload CMS (migration chưa synchronize với Collection mới).

**Kết quả thực tế**
Iframe Crash completely 500 kèm postgres error raw logs `column _pages_v.version_is_visible does not exist`.

---

### BUG-F05-010 · AI Chat: Nút Gửi không bị Disable khi Prompt gửi khoảng trắng (Empty String Validation)

| | |
| :--- | :--- |
| **TC-ID** | TC-F05-01-06 |
| **Severity** | 🟢 P2 Medium |
| **Module** | AI Chat / Inline Edit |
| **Nguồn** | Issue #65 (Comment) |

**Mô tả**
Validation Input rule của vùng chat AI Prompt vi phạm. Khi cung cấp một chuỗi khoảng trắng (empty spaces) vào khung Chatbox, hệ thống vẫn cho phép ấn Nút Gửi thay vì tự động khóa Disable Trigger (Submit Button).

**Kết quả thực tế**
Gửi request prompt trống (khoảng trắng) vô nghĩa, qua lọt Regex Validation tại Client gây lãng phí event trigger.

---

### BUG-F05-011 · Không block được section để edit trong Editor

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / Section Editing |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
User không thể click vào section để chọn (block) và edit. Chức năng block selection không hoạt động.

---

### BUG-F05-012 · Menu item trong Editor trỏ đến 404

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / Navigation |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Trong màn hình Review/Preview, khi user ấn vào trang trên Menu, báo lỗi 404. Link cho các trang trên Menu chưa được gắn.

---

### BUG-F05-013 · Chat AI sửa màu Header nhưng đổi màu toàn bộ trang

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / Chat AI |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi user yêu cầu Chat AI "đổi màu header", AI thực hiện đổi màu toàn bộ trang thay vì chỉ đổi màu header. AI không giới hạn scope thay đổi theo đúng yêu cầu user.

---

### BUG-F05-014 · Thêm logo/hình ảnh bị lỗi trong Editor

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / Media Upload |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Chức năng upload logo hoặc hình ảnh trong Editor bị lỗi. User không thêm được hình ảnh vào website.

---

### BUG-F05-015 · Xóa CTA Button không thể khôi phục lại

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / CTA Component |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi user thêm CTA vào trang, sau đó xóa mục CTA Button trong cột edit bên phải, CTA bị xóa hoàn toàn và không thể thêm lại được. Không có nút undo hoặc re-add.

---

### BUG-F05-016 · Chat AI không giới hạn scope — edit ngoài phạm vi website

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / Chat AI |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi user chat với AI các nội dung ngoài phạm vi website (ví dụ: hỏi chuyện, yêu cầu không liên quan đến website), AI không xử lý được hoặc trả kết quả sai. AI cần giới hạn scope chỉ edit các content thuộc website.

---

### BUG-F05-017 · Variant của template không áp dụng vào template

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Editor / Template Variant |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi user chọn variant (màu sắc, kiểu chữ...) cho template, thay đổi không áp dụng vào template. Variant không có tác dụng.

---

### BUG-F05-018 · Component block mới thêm không có content để user điền

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Editor / Components |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi user thêm một component mới vào trang, block hiển thị trên preview nhưng trong panel edit bên phải không có content/field nào để user nhập thông tin.

---

### BUG-F05-019 · Editor inline (text heading, căn lề) không hoạt động trên Review screen

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Editor / Inline Edit |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Tại màn hình Review, khi user sửa trực tiếp text (chọn heading, căn lề, bold...) qua inline editor, thay đổi không được áp dụng (không ăn).

---

### BUG-F05-020 · Editor — SEO config thiếu robots.txt và canonical URLs

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Editor / SEO |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi generate SEO config cho website, hệ thống đã tạo JSON-LD và sitemap nhưng thiếu file `robots.txt` và canonical URLs. Cần tạo đủ các file cấu hình SEO chuẩn.

**Hiện trạng:**
- ✅ JSON-LD — đã có
- ✅ Sitemap — đã có
- ❌ robots.txt — thiếu
- ❌ Canonical URLs — thiếu

---

### BUG-F05-021 · Editor — Block Library có 12 blocks cần loại bỏ

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Editor / Block Library |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Block Library Panel hiện chứa 12 blocks không phù hợp, cần loại bỏ khỏi UI (chỉ remove khỏi Library Panel, không xóa registry).

**Trùng chức năng (đã có variant thay thế):**
- `gallery-masonry` → dùng gallery (variant=masonry)
- `pricing-table` → dùng pricing (variant=table)
- `accordion` → dùng faq (variant=accordion)
- `client-logos` → dùng logo-cloud

**Out of scope (theo PRD):**
- `custom-html` → không hỗ trợ inject HTML/CSS
- `breadcrumb` → nên auto-generate
- `video-background` → trùng với video variant
- `before-after` → quá niche, không phổ biến

**Thiếu backend / tech constraint:**
- `blog-list` → chưa có CMS
- `download-cta` → chưa có file hosting
- `google-maps` → cần API key, không config được
- `countdown-timer` → chỉ client-side, không persist

---

## 🚫 Lỗi Thiếu Tính năng / Blocked Test Cases (Issue #507)

> **Ghi chú:** Đây là danh sách các tính năng chưa được phát triển (Not Implemented) hoặc lỗi thiết lập gốc dẫn đến 29 Test Cases bị Blocked hoàn toàn không thể test. Cần Dev xử lý như các lỗi Blocker.

| | |
| :--- | :--- |
| **Nguồn** | Issue #507 |
| **Severity** | 🔴 P0 Blocker |
| **Trạng thái** | Chưa có API / Chưa làm Frontend |

**Danh sách các module bị Block:**

1. **E-Commerce / Cart (6 TCs):** Tính năng giỏ hàng chưa được integrate. Cần E-commerce storefront interaction, không có component Cart trong thư viện.
2. **Unpublish / Maintenance Mode (2 TCs):** Tính năng hạ website xuống. Endpoint API `PATCH /unpublish` trả mã 404 Not Found (Chưa implement).
3. **Custom 404 Page (4 TCs):** Hệ thống không tự động khởi tạo trang 404 trong Page Manager như AC yêu cầu.
4. **Header/Footer Nesting (3 TCs):** Tính năng tạo Sub-menu kéo thả phân cấp (Max 1 level nesting) chưa có UI để làm.
5. **SEO & Automation (5 TCs):** Tính năng khóa đổi Slug (Slug lock) sau khi Publish chưa làm.
6. **Global Settings (4 TCs):** Tính năng hiển thị Modal cảnh báo Chưa Lưu (Unsaved warning modal) khi chuyển trang bị bỏ quên. (Navigate away không hiện cảnh báo).

**Hành động bắt buộc từ Dev Team (Missing Features):**
- Implement Unpublish API (`PATCH /api/sites/:id/unpublish`)
- Tự động tạo 404 Page trong Page Manager khi tạo Website.
- Implement Add Link UI (Nút thêm link) trong Menu panel (Liên đới BUG-F05-002).
- Tích hợp Cart/Checkout widget.
- Implement Unsaved Warning modal.
