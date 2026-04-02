# Tài Liệu Kiểm Thử Toàn Diện (Comprehensive QA Matrix): F17 - Quản Lý Bài Viết (Blog Management)

> **Framework Áp Dụng:** Comprehensive QA Expert (`.agent/skills/comprehensive-qa-expert`)
> **Tham chiếu US:** Lưới PRD F17 (Bao gồm 8 User Story độc lập + 1 Global AC). Tổng số **22 AC** (Acceptance Criteria).

---

## 1. Mục Tiêu Kiểm Thử (Objective)
Bộ Test Case V9.0 quy hoạch lại sự giao thoa (Traceability) giữa 100% Acceptance Criteria của BA/Product Owner ban hành tại PRD và hệ tiêu chuẩn `Comprehensive QA Expert`. 
- Mỗi dòng `AC` cơ sở trong PRD đều có Test Case đối ứng (`Happy Path`).
- Các Điểm mù (Blind Spots) được cấy nối tiếp và nâng cấp: `Form Validation`, `UI/UX States`, `Concurrency`, `Security Guards`.

---

## 2. Ma Trận Kịch Bản Comprehensive BDD (Traceability Matrix)

| ID | [THAM CHIẾU AC] | LOẠI (TAG) | KỊCH BẢN KIỂM THỬ (SCENARIO) | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | PRIORITY |
|:---|:---|:---|:---|:---|:---|:---:|
| **[Global AC: CMS Layout Compliance]** (1 Giao dịch) | | | | | | |
| **TC-F17-GB-01**| `Global AC` | `[Happy Path]` | Layout phân nhánh Main Area | Truy cập trang Quản lý Blog. | Widget, Grid Data phải Render lọt lòng Main Content Area. Các Module Sidebar và Top Header giữ nguyên hoạt động, không bị đè CSS. | Blocker |
| **[US-F17-01: Quản Trị Danh Sách Bài Viết]** (5 Giao dịch) | | | | | | |
| **TC-F17-01-01**| `US-01/AC-1` | `[Happy Path]` | Trạng thái rỗng (Empty State) | Tải CMS khi hệ thống có 0 Blog. | Hiển thị màn hình "Chưa có bài viết nào" dùng chung Component (Shared empty state) kèm Button Create. | High |
| **TC-F17-01-02**| `US-01/AC-2` | `[Happy Path]` | Tìm kiếm & Lọc kết hợp | Gán nội dung Khung Search + Trạng thái Lọc "Draft". | Lưới bảng Data Table Filter 2 lớp (Toán tử AND) mượt mà giữ nguyên cấu trúc hiển thị 4 cột. | High |
| **TC-F17-01-03**| `US-01/AC-2` | `[Validation]` | Sắp xếp mảng (Sort Table) | Nhấn đúp Trục `Last Modified Date`. | Render Sort Date ASC/DESC trọn vẹn, không Crash Object JS Data. | Medium |
| **TC-F17-01-04**| `US-01/AC-2` | `[Concurrency]`| Ngưỡng Tải Bulk Actions | Tick Bulk Delete chọn siêu lớn 5,000 bài viết. | Cấm OOM Crash RAM Node Server, từ chối Request trả 413 Payload Error hoặc chuyển sang Worker Job ngầm. | High |
| **TC-F17-01-05**| `Skill Expert` | `[UI State]` | Chặn Tải chậm (Fetch Latency) | Bóp mạng Throttling Slow 3G. | Render Khung Load Skeleton Framework tránh Flash White/Lỗi Null biến số. | Medium |
| **[US-F17-02: Bộ Soạn Thảo và Cập Nhật Bài Viết]** (8 Giao dịch) | | | | | | |
| **TC-F17-02-01**| `US-02/AC-1` | `[Happy Path]` | Khởi tạo thành công End-To-End | Điền dữ liệu Title, Body, Thumbnail hợp lệ nhấn Save. | Toast xanh "Thành công", bài viết hiển thị trên CMS List. | Blocker |
| **TC-F17-02-02**| `US-02/AC-2` | `[Negative]` | Ràng buộc Title bỏ trống (Trim) | Điền khoảng trắng "     " hoặc để Null Title. | Báo Validation Form đỏ rực "Title is required", gãy Submit Cấm đẩy Rác vào DB. | High |
| **TC-F17-02-03**| `US-02/AC-3` | `[Happy Path]` | Mở Tính năng AI Gen SEO Meta | Nhấn nút Button "✨ Optimize with AI". | Form Auto-Gen điền ngay chuỗi Metadata SEO chính xác lấy ngầm từ Body Text. | High |
| **TC-F17-02-04**| `Skill Expert` | `[Validation]` | Trói Chuẩn AI Meta SEO Length | Viết >50,000 từ Body siêu dài ép AI Gen. | Hệ AI bắt buộc Cắt Ngọn Trích Đoạn Meta Title `< 60 ký tự` và Meta Description `< 160 ký tự` chuẩn luật SERP Google Snippets (Dựa trên thiết kế UI Design). | Blocker |
| **TC-F17-02-05**| `Skill Expert` | `[UI State]` | Khớp Đồng bộ Đếm Số Ký Tự | Gõ nhanh văn bản ngẫu nhiên vào ô Meta Title và Rich Text. | Bộ đếm Ký Tự góc dưới ô (Ví dụ: `15/60 characters`) nảy số mượt mà theo từng chu trình OnKeyPress, Không văng Lỗi độ trễ React Render. | High |
| **TC-F17-02-06**| `Skill Expert` | `[Negative]`| Database Unique Slugifier Lỗi | Trùng 2 bài viết có cùng tên "Sự kiện". | Auto-Slug Function phải tự hậu đính ID chuỗi (`/su-kien-1`) chặn 100% Lỗi sập MongoDB vì Trùng Unique Index Key Mạng. | Blocker |
| **TC-F17-02-07**| `Skill Expert` | `[Validation]`| Chặn Định dạng Chỉnh sửa Slug Bẩn | Nhập ký tự đặc biệt `!@# $^` vào trường Editable Slug. | Regex Form Front-end tự động cắt (Sanitize) bỏ hoặc hiện Validation Lỗi Đỏ cấm nhập (Ví dụ URL hợp lệ chỉ nhận chữ thường và dấu gạch nối `a-z, 0-9, -`). | High |
| **TC-F17-02-08**| `Skill Expert` | `[Negative]` | Chống Phá Dung Lượng Tệp Ảnh Bìa (10MB Constraint) | Upload tệp `.PDF` hoặc Tệp Ảnh PNG/JPG có dung lượng `10.5 MB`. | Cổng chặn File Uploader ném ra cảnh báo "File vượt quá giới hạn 10MB / Định dạng không hỗ trợ". Hệ thống API không xử lý ghi chặn 413 Payload. | Blocker |
| **[US-F17-03: Trợ Lý Soạn Thảo Văn Bản Bằng AI]** (5 Giao dịch) | | | | | | |
| **TC-F17-03-01**| `US-03/AC-1` | `[Happy Path]` | Tích hợp Generated Copy AI | Focus Input Editor, gọi AI tạo Paragraph từ Prompt. | Khối Text được tạo ra mượt, trả thẳng vào Caret Point (Con trỏ) nội trong Editor Component. | High |
| **TC-F17-03-02**| `US-03/AC-2` | `[Negative]` | Chặn Tính Năng Lừa Mạng DALL-E | Nhập Prompt "Gen hình con chó 3D để vào web" | Cấm Sinh Hình tiêu Token API lố. Hệ trả lời bằng Text: "Chỉ xử lý văn bản (No Image)". | Blocker |
| **TC-F17-03-03**| `US-03/AC-3` | `[Happy Path]` | Tính năng "Improve Text" | Bôi đen Đoạn Lỗi, click "Make Professional". | Replace Đoạn mới trực tiếp mà không lôi Error Rách DOM Rich-Text Tag Editor. | High |
| **TC-F17-03-04**| `Skill Expert` | `[Concurrency]`| Khống Lệnh Nhanh Rate Throttled | Spam liên tục Click AI Generator 15 Lần. | Trả API 429 Ngắt HTTP Gate Request Too Fast, Nút Nảy Lên Disable Phòng Đứt OOM Tải Gateway Trả Tiền Rate Limit OpenAI. | Blocker |
| **TC-F17-03-05**| `Skill Expert` | `[Security]` | Tẩy Rác Dirty SQL/XSS Code | Bơm Command Prompt `<script>alert(1)</script>`. | Hệ DOM Sanitize (Html Escape Decode) Ngắt Rớt Lệnh Lọc Thành Dạng String Tĩnh Cấm Thực Thi Gây Độc Hại XSS Code Cho Khách Frontend. | Blocker |
| **[US-F17-04: Quản Trị Trạng Thái Phiên Bản - Publish/Draft/Delete]** (5 Giao dịch) | | | | | | |
| **TC-F17-04-01**| `US-04/AC-1` | `[Happy Path]` | Đặt Live Public | Đổi Status Draft -> Published. | Hệ Next JS Vượt Khung Invalid Cache `< 30s` Public Storefront Hiển Thị. | High |
| **TC-F17-04-02**| `US-04/AC-2` | `[State Trans]`| Ẩn Hình Về Giao Diện (Unpublish) | Giấu Status Bài Đang Live thành Draft. | Chặn 404 Route Cứng Leak File Khách Khi Bấm Refresh Rớt Văng. Data Edit Nằm Chỉ Bên Trong CMS Giữa Thể Draft Ẩn Trọn Vẹn. | Blocker |
| **TC-F17-04-03**| `US-04/AC-3` | `[State Trans]`| Khóa Hộp Thoại (Delete Guard Modal) | Bóp Remove Xóa 1 Bài Viết Bất Kỳ (Draft / Live). | Dialog Warning Bật Popup "Xóa Cứng Vĩnh Viễn Không Bọc Rác", Tránh Tay Nhầm. | High |
| **TC-F17-04-04**| `Skill Expert` | `[Concurrency]`| Xung Đột Race-Condition Lưu Delete | Một User Save Lệnh, User Khác Lệnh Delete Form. | API Reject Báo Mã Xung Lệnh Document Version Locked, Tránh Treo Node Memory MongoDB F5 White Screen Lật UI. | Blocker |
| **TC-F17-04-05**| `Skill Expert` | `[UI State]` | Lưu Hồi Mạch Rớt Kết Nối Cache | Rút Cáp Mạng / Nhấn Tải Lại F5 Trình Ở Editor. | Unload Warning Browser Bậc "Dữ Liệu Mất Alert". Re-load Hệ Đổ Text Từ LocalStorage Rót Trôi Xuống Lại Form Bảo Hộ Text. | High |
| **[US-F17-05: Quản Lý Phân Tuần Tự Danh Mục (Category Management)]** (4 Giao dịch) | | | | | | |
| **TC-F17-05-01**| `US-05/AC-1` | `[Happy Path]` | Tổ Chức Cây Category 1 Bậc Cứng | Edit Tạo Chỉnh Xóa Menu CMS Table Category. | Table Thêm Rút Data Cập Nhật Gọi Lệnh Sang Dropdown Editor Gọn Ghẽ. | High |
| **TC-F17-05-02**| `US-05/AC-2` | `[Happy Path]` | Chọn Dạng Categorize Editor | Móc Assign Chọn Tên Thẻ Category Nhấn Save Bài | List Route Đã Thắt Chứa Data Bài Gắn Component Danh Mục Thẻ Hiện Storefront Thẳng Cánh. | Medium |
| **TC-F17-05-03**| `US-05/AC-3` | `[State Trans]`| Đệm Ngắt Cứng Lọc Thẻ Gắn (Orphan Fallback) | Tróc Xóa Category Trùng Node Dính Giữ Bài Data Mạch | System Không Rót Lệnh Rớt Cắn Constraint Database. Bài Blog Đưa Sang Bẫy Đợi Trạng Thái Mặc Định "Uncategorized". Cấm Bể Web. | Blocker |
| **TC-F17-05-04**| `Skill Expert` | `[Negative]` | Cấm Sinh Trùng Thẻ Label Category | Render Tạo Lại Category Đã Nằm "Giảm Giá". | DB Mongo Nổi Lệnh Unique 400 Bad Tùy Lề Nhện Component UI Toast Red Label Ép Buộc Sửa Tên Category Mới. | High |
| **[US-F17-06: Tương Tác Thiết Bị Di Động Giao Diện Admin]** (3 Giao dịch) | | | | | | |
| **TC-F17-06-01**| `US-06/AC-1` | `[UI State]` | Giữ Toolbar Đứng Trượt Di (Sticky Top Keypad)| Layout View Điện Thoại Touch Focus Ngõ Bàn Phím Keyboard Ảo. | Bảng Toolbar (Bold, Lin) Chạy Fixed Lên Trân Layout Bàn Đục Gác Phá Che Khuất Của Editor React Form, Focus Caret Vuốt Text Thoáng Trục. | Blocker |
| **TC-F17-06-02**| `US-06/AC-2` | `[UI State]` | Lệnh Rạch Tap Dễ Giao Nút AI | Mở Tab AI Drawer Lược Rút Chạm Dưới Mobile Bụng App. | Rát Drawer Trượt Kèo Không Giữ Lõi Modal Hiện Giữa Center Pop, Nút Cấu To Button Full-width Bức Khung Tap `> 44px` Định Layout Responsive Ngón Tương Giúp Nhấn. | Blocker |
| **TC-F17-06-03**| `Skill Expert` | `[UI State]` | Cấm Rạch Responsive Grid Liệt Yếu Màn Mobile| Ngắm Dòng Card Dữ CMS Nét Màn Chạm Cỡ Phân Width 320. | Flex Card React Đổi Đóng Table Trống Layout Dọc, Cuộn Ngang Scroll-X Khóa Trật Chặt Gây Bó Layout View Front. | High |
| **[US-F17-07: Public Blog List Storefront]** (3 Giao dịch) | | | | | | |
| **TC-F17-07-01**| `US-07/AC-1` | `[Happy Path]` | Tải hiển thị Component Grid Bài Viết | Điều hướng duyệt Store URL `/blogs`. | Component hiển thị chuẩn xác Thông tin Cột: Ảnh Thumbnail, Category, Title, Excerpt, Date. Dữ liệu bắt buộc cấu hình tham số `Status="Published"` (Tuyệt đối không lọt bài Nháp/Draft ra màn hình Khách Hàng). | Blocker |
| **TC-F17-07-02**| `US-07/AC-2` | `[Concurrency]`| Xử lý Bố cục Phân trang Số Lượng Lớn (Pagination)| Dữ liệu Backend vượt quá >50 Bài đăng để Hệ thống tải trang. | Hệ API đặt Giới hạn Render hiển thị mặc định `limit = 12` bài/trang. Tích hợp nút Load More hoặc Phân Trang Số. Hệ thống tránh treo RAM Component (React DOM OOM Crash) ở màn hình khách. | High |
| **TC-F17-07-03**| `US-07/AC-3` | `[Validation]`| Chuyển hướng Lọc Danh Mục (Router Filter) | Click chọn Thẻ Nhóm Category "Tin tức". | Tuyến Code React Route tự động lọc lọc nội dung Component theo dạng SPA Filter. Không tải lại F5 (White flash) toàn trang. | Blocker |
| **[US-F17-08: Giao Diện Blog Chi Tiết Kèm Lưới Mạch SEO Tĩnh]** (4 Giao dịch) | | | | | | |
| **TC-F17-08-01**| `US-08/AC-1` | `[Happy Path]` | Điều phối Component HTML Rich Text | Truy cập nội dung Chi tiết Blog `blogs/[slug]`. File CMS chứa định dạng In Đậm, Tiêu đề Lớn, Bảng (Table). | Hệ Layout Dàn trang Storefront đảm bảo biên dịch (Compile HTML) kết xuất định dạng 100% chuẩn quy tắc Khối CMS. Các khung chữ HTML không được vỡ tràn sang cột CSS Mobile. | Blocker |
| **TC-F17-08-02**| `US-08/AC-2` | `[SEO Logic]` | Khai báo Bot Graph Object Tĩnh Thẻ SEO | Sử dụng F12 hoặc Tool Audit đọc Header Object SEO Schema của Web Store Hướng Ngoại. | Đảm bảo Code Sinh Ra chèn `<meta name="description">` chuẩn. Tích hợp hệ thẻ Graph Header Object: Cấu trúc Open Graph (`og:title`, `og:image`) và JSON-LD Article Schema tiêu chuẩn Google Bot Index Data. | Blocker |
| **TC-F17-08-03**| `US-08/AC-3` | `[UI State]` | Lược Tuyến Định Hướng Mạch Quay Lại | Scroll Cuộn xuống Bài Blog Khách Hàng, Click nút Back / Quay danh sách. | Component Cache History kích hoạt trả Component UI chuyển động mềm trở lại danh sách `/blogs`. Không văng F5, React DOM Update State hoàn thiện. | High |
| **TC-F17-08-04**| `Skill Expert` | `[Negative]` | Thường Form Render Chống Leak Payload XSS | Admin CMS tiêm Text Mã Phá Ngầm: `<script>alert(XSS)</script>` Ra Public Route Store. | Hệ Html Code Encode Render lột trần mã Text HTML Tĩnh. Triệt hạ không thể thực thi Code Lệnh Block Alert tại Front-end khách. Đóng rủi ro Security Token Sessions. | Blocker |

---

## 3. Checklist Điểm Mù (Blind Spots Sign-off) - "Comprehensive QA"
> Áp dụng phân lớp theo chuẩn `.agent/skills/comprehensive-qa-expert`. Trọng tâm quản lý 5 nhóm Rủi ro Điểm Mù (Blind Spots).

1. **[X] Kiểm Xét Giá Trị Biên và Rỗng (Form Validation/BVA):** Đẩy Giới hạn Regex Khai lược Meta SEO đúng chuẩn hệ Form UI Design (Meta Title `<60 kí tự`, Meta Description `<160 kí tự`). Rào Chặn Hành vi lưu Tiêu đề bài trống gán bằng khoảng trắng. Ràng buộc Tệp Ảnh Ảnh Bìa (Thumbnail) khắt khe ở mức Boundary 10MB và Format (Chỉ chấp nhận PNG, JPG).
2. **[X] Kiểm định Tín hiệu Biến Chuyển Kép (State Transition Logic):** Quay bài viết về trạng thái Nháp (Draft) -> tự động Routing 404. Phá Category Mẹ -> kích hoạt Fallback Null (Uncategorized). Giám sát Bộ Đếm Ký Tự Động (Dynamic Character Counter UI State) khi KeyPress.
3. **[X] Khống Lỗi Cảnh Giác Rủi Ro Âm Mưu (Error Guessing / Negative Bounds):** Xử lý React Sanitize DOM chống Script Payload XSS. Ngăn chặn Prompt AI tạo DALL-E (Giữ giới hạn Text). Lọc sạch các ký tự đặc biệt lọt qua khi Biên tập viên cố ý chỉnh sửa trường URL Slug.
4. **[X] Hoạch Tính Cường Độ Đồng Thời (Concurrency & Limits):** Ngăn chặn Rate API HTTP 429 nếu thao tác Request API AI liên tục (Spam). Quản lý phiên giao tiếp 2 Tab Admin Editor chống Đè Form. Hệ đếm Character không Re-render chớp nhảy làm chết DOM Memory khi gõ nhanh (Debounce / Trạng thái React ảo).
5. **[X] Trải Nghiệm Giao Diện Tĩnh (UI/UX Backup):** Xử lý Loading Skeleton. Giữ Sticky Keypad Editor cho thiết bị Mobile Điện Thoại. Backup LocalStorage khi lỡ tay nhấn F5 Refresh hoặc sập trình duyệt Unload.

---

## 4. Kịch Bản Thực Thi Chi Tiết (UAT Execution Test Scripts)
> Bản mô tả chi tiết từng bước (Step-by-step) dành cho Tester Manual chạy UAT hoặc Automation Engineer thiết lập Playwright Script.

### [UAT-FLOW-01]: Tạo Bài Viết và Sinh Tự Động AI SEO
**Tiền điều kiện:** Đăng nhập tk Admin. Chuẩn bị ảnh `cover-seo.jpg` (2MB).
* **Bước 1:** Trỏ chuột Menu trái, chọn "Blog Management", nhấn nút `Create New Post`.
* **Bước 2:** Nhập Test Data:
  - Title: `Review Dịch Vụ SEO 2026`
  - URL Slug: (Bỏ trống để tự nhảy)
  - Category: Chọn `Thủ thuật SEO`
  - Thumbnail: Tải File `cover-seo.jpg` lên (Kiểm tra xem thanh hiển thị tiến trình Load ảnh tải 100%).
  - Nội dung Editor (Body): Viết 3 dòng nội dung dài tầm 200 chữ mô tả thủ thuật SEO cơ bản.
* **Bước 3:** Ở Sidebar Cột Phải (SEO Settings), bấm nút `✨ Optimize with AI`.
* **Bước 4:** Quan sát (Verify) trường Meta Title và Meta Description. *Hệ thống AI tự sinh chữ và đếm ngược bộ Count (VD: 55/60 và 140/160 chars).*
* **Bước 5:** Bấm nút `Publish` góc trên bên phải.
**Kết quả mong đợi:** 
  1. Giao diện báo Toast "Lưu bài viết Live thành công".
  2. Router tự đẩy user ra lại danh sách CMS, mục Status bài này hiển thị "Published".
  3. URL Slug tự sinh thành `review-dich-vu-seo-2026`.

### [UAT-FLOW-02]: Cắt Phá Lỗi Giao Diện và Boundary
**Tiền điều kiện:** Mở tính năng Create New Post.
* **Bước 1:** Cố tình bôi đen Paste Data bẩn dài 5,000 ký tự rác vào trường Title.
* **Bước 2:** Bấm nút `Save Draft`. -> **Verify**: Validation đỏ chặn lại "Title quá dài".
* **Bước 3:** Tải File Ảnh `hacked.pdf` hoặc Ảnh PNG nặng `15MB` vào Box Thumbnail.
* **Bước 4:** -> **Verify**: Khối Ảnh đẩy Validation Lỗi "File quá giới hạn 10MB hoặc Sai định dạng". Hệ thống không làm rớt Page báo 500 Network.
* **Bước 5:** Tại khung Content Rich Text, nhấn Gõ chữ liên tục tốc độ cao (Spasm). Nhìn qua bộ đếm Ký Tự góc dưới bên phải. -> **Verify**: Số `Characters` nhảy nhanh nhưng Cửa sổ thao tác App không bị sượng/đơ (Xác minh cơ chế Đếm React DOM đã được tối ưu Debounce).

### [UAT-FLOW-03]: Xác Thực Mạch Public StoreFront & Navigation (Khách Hàng)
**Tiền điều kiện:** URL của bài viết đã Live từ *UAT-FLOW-01* là `/blogs/review-dich-vu-seo-2026`. Mở 1 Tab Trình duyệt ẩn danh Mới (Chế độ Người dùng vãng lai).
* **Bước 1:** Khách truy cập vào tên miền ngoài Public URL `/blogs`.
* **Bước 2:** Quét tìm xem Card Banner hiển thị File Ảnh `cover-seo.jpg` có Loading bị vỡ Layout không. -> **Verify**: Grid Component thẳng thớn.
* **Bước 3:** Click thẳng vào Tên Bài Viết. Hệ thống Render sang `/blogs/review-dich-vu-seo-2026`.
* **Bước 4:** -> **Verify SEO**: Bấm Phím `F12` kiểm tra Thẻ Mạng (Elements Header DOM). Tìm thuộc tính Meta Property `og:title` & `description`. Check Object JSON Schema `<script type="application/ld+json">`. Chắc chắn mọi thứ trùng khớp với SEO Meta mà AI Generate ở Bước 3 UAT-FLOW-01.
* **Bước 5:** Bấm Link Nút "Back / Về trang trước" hoặc Breadcrumb bên góc màn hình. -> **Verify**: Khách hàng trượt SPA Mượt mà về lại Trang Danh sách Blogs (Trải nghiệm liền mạch, không load trắng web 404).

---

## 5. Hành Trình Trải Nghiệm Tóm Tắt (End-To-End Journey)

1. **[Tạo Nội Dung]**: Admin vào quản trị. Gọi Menu tạo Bài viết Category "Công Nghệ". Quét 1 câu nhấn Nút LLM (AI Assistant) nhờ viết dài Phân Tích Kép. AI tự động làm xong. Admin tải ảnh chuẩn 5MB lên. Bấm Lưu Save Draft do Wifi đứt mạng ngang -> LocalStorage phục hồi lại 100% Nội dung ngay lập tức.
2. **[Xuất Bản]**: Admin Bấm AI sinh Meta SEO Tự Động. Bấm Publish Online.
3. **[Khách Storefront]**: Client dạo mua sắm, mò mẫm vào Trang Web "/blogs". Bấm thẻ Category "Công Nghệ". Data Render ra đúng Bài viết Mới. Nội dung Blog đẹp vì Rich - Html Formatting, Google Bot nhận dải Code Schema đúng chuẩn SEO Indexing Tươi Gọn 100%. Mạch Vận Hành Khép Kín Hoàn Hảo.
