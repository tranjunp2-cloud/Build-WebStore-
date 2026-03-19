# F17 Blog Management - Test Plan & Test Cases

## 1. Overview
*   **Feature Name:** F17 - Blog Management
*   **Description:** Tính năng giúp Chủ Shop (SME Store Owner) dễ dàng quản lý (Tạo/Sửa/Xóa/Category) và tự động hóa SEO nội dung tin tức trên Storefront. Hệ thống tích hợp Trợ lý văn bản AI chống bí chữ, kèm UX tùy biến cho cả Mobile và Web.
*   **Ticket/Story:** [F17-blog-management-stories.md](../stories/F17-blog-management-stories.md)
*   **Author:** QC AI Engineer
*   **Date:** 2026-03-19

## 2. Test Environment
*   **Environment:** Staging / Production
*   **Browser(s):** Chrome 120+, Safari 17+, Edge (Desktop). Safari iOS, Chrome Android (Mobile).
*   **Device(s):** Laptops (1080p, 4K), Mobile (iPhone 14 Simulator: 390x844, SE: 375x667).
*   **Automation Framework:** Playwright CI

## 3. Pre-conditions (Setup)
*   Tài khoản đăng nhập có Role `Owner` hoặc Permission `blog:manage`.
*   Cửa hàng (Store) đã kích hoạt Template Storefront tương thích hiển thị bài viết.
*   AI Model API Config hợp lệ, không bị chặn Rate Limit lúc bắt đầu Test.

---

## 4. Test Cases (Manual & Automation)

### 🌍 Global UI/UX Design & 9-Point Checklist (Cross-cutting)

> **Lưu ý:** Module này test các yếu tố giao diện và vi mô (Micro-interactions) không thuộc US chức năng nhưng nằm trong 9-Point Done Checklist và Figma Design.

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-UX.01` | UI | Verify Blog List Skeleton (Loading State) | Yes | High | 1. Navigate to `/dashboard/blog`.<br>2. Simulate slow network (3G). | Màn hình hiển thị Skeleton Layout Animation (Shimmer effect) các dòng dữ liệu thay vì Spinner đứng im. Header và Sidebar vẫn Render ngay lập tức (Responsive Global Layout F18). | | `Not Run` |
| `TC-F17-UX.02` | UI | Verify Buttons Disabled State (AI Generating) | Yes | High | 1. Click "✨ Generate with AI".<br>2. Prompt and wait. | Trong lúc chờ API AI trả kết quả, Nút "Save", "Unpublish" và toàn bộ input bị Disable. Tránh User lưu bài khi content chưa về kịp. | | `Not Run` |
| `TC-F17-UX.03` | UI | Verify Toast Messages for all actions | Yes | High | 1. Create Post.<br>2. Delete Post.<br>3. Publish Post. | Toast Message bo góc mượt mà, chứa Icon Success xanh lá, tự mất sau 3s (Fade Out) theo chuẩn Design System. | | `Not Run` |
| `TC-F17-UX.04` | Error | Verify 404 & Global Error Bound | Yes | High | 1. Tắt mạng (Offline).<br>2. Lưu bài Blog. | Bắn thẳng Toast Error (Màu Đỏ) báo lỗi mạng hoặc Time-out, hệ thống không bị crash trắng trang (React Error Boundary hoạt động). | | `Not Run` |
| `TC-F17-UX.05` | UI/UX | Verify Global CMS Margin & Padding | Yes | Medium| 1. Resize Window sang 1024px, 1440px.<br>2. Đo kích thước. | Khung Blog Editor nằm lọt hoàn hảo trong Main Content Area, cách mép 24px (hoặc 16px tùy breakpoint) so với Sidebar (Chuẩn F18-03). | | `Not Run` |

---

### [US-F17-01] Blog Management Dashboard

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-01.01` | Functional | Verify Empty State (AC-1) | Yes | High | 1. Navigate to `/dashboard/blog` with 0 posts. | Hiển thị Illustration đồ họa, Text "Chưa có bài viết nào", và CTA Button "Create First Post". Trùng khớp UI với F08/F10. | | `Not Run` |
| `TC-F17-01.02` | Functional | View Populated List (Title, Status, Author) (AC-2) | Yes | High | 1. Create 5 diverse posts (Draft/Publish).<br>2. Go to Blog Page. | Màn hình liệt kê Grid/List chứa đủ 4 thông tin: Title, Status (Draft/Published - có màu Badge), Author, Date. | | `Not Run` |
| `TC-F17-01.03` | Functional | Verify Search and Sort functionality (AC-2) | Yes | High | 1. Input "Sale" into Search Bar.<br>2. Toggle Sort Title (A-Z) and Date (Newest/Oldest). | Bảng Dữ liệu lập tức update/thay đổi thứ tự trùng khớp với lệnh Search và Sort mà không bị Reload trình duyệt. | | `Not Run` |
| `TC-F17-01.04` | Functional | Verify Status/Category Filter (AC-2) | Yes | Medium | 1. Click Filter dropdown.<br>2. Select "Published" and Category "Promo". | Chỉ các bài viết vừa Published vừa thuộc "Promo" được hiển thị. Trạng thái Filter UI được highlight. | | `Not Run` |
| `TC-F17-01.05` | Functional | Verify Bulk Actions (Publish & Delete) (AC-2) | Yes | High | 1. Checkbox 3 Draft Posts.<br>2. Click "Bulk Publish".<br>3. Checkbox 2 Posts, Click "Bulk Delete". | Hệ thống cập nhật hàng loạt Status hoặc xóa bài thành công. Validate Database update chính xác. | | `Not Run` |
| `TC-F17-01.06` | Edge | Bulk Publish Conflict (Thiếu Title) | Yes | High | 1. Chọn Bulk Publish 3 bài (Trong đó 1 bài thiếu Title - Bug FR-03).<br>2. Click "Publish". | Hệ thống Publish thành công 2 bài Hợp lệ chữ màu xanh. Báo lỗi Partial Error (Đỏ) cho 1 bài bị lỗi chưa có tên. | | `Not Run` |

---

### [US-F17-02] Create & Edit Blog Post

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-02.01` | Functional | Create Post Happy Path (AC-1) | Yes | High | 1. Click "Create Post".<br>2. Fill Title, Category, Content.<br>3. Upload 100KB JPG Thumbnail.<br>4. Save. | Lưu thành công. Return về danh sách. Thumbnail Upload thành công lên Store CDN. | | `Not Run` |
| `TC-F17-02.02` | Boundary | Mandatory Title Validation (AC-2) | Yes | High | 1. Click "Create Post".<br>2. Nhập Content, bỏ trống Title.<br>3. Click "Save". | Validation đỏ rực Input Title: "Title is required". Bài không được tạo vào Database. | | `Not Run` |
| `TC-F17-02.03` | Functional | Auto-Generate SEO Metadata (AC-3) | Yes | Medium | 1. Nhập Title 10 chữ, Content 500 chữ.<br>2. Click nút "✨ Tối ưu SEO bằng AI". | Field Meta Title tự động điền (dựa theo Title gốc), Meta Description được tóm tắt logic < 160 ký tự. Có thể xóa tay nhập lại bình thường. | | `Not Run` |
| `TC-F17-02.04` | Semantic | Auto-generate Slug Uniqueness | Yes | Medium | 1. Tạo Bài Title: "Lễ Tết Mới". Sinh Slug tự động.<br>2. Tạo bài số 2 Title y hệt: "Lễ Tết Mới". | Slug bài 1:`/le-tet-moi`. Slug bài 2 tự động thêm ID unique: `/le-tet-moi-1` (Hoặc báo validation chặn bắt đổi tên). Không bị Crash SQL Duplicate Key. | | `Not Run` |

---

### [US-F17-03] AI Blog Writing Assistant (Text Only)

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-03.01` | Functional | Generate from Prompt (AC-1) | Yes | High | 1. Mở Editor.<br>2. Nhập AI Topic: "Write a promo post for coffee beans".<br>3. Click "Generate". | Content sinh ra bằng AI được chèn (Insert) chính xác vào khoảng trống (Caret) cuối con trỏ chuột trong Rich Text Editor. | | `Not Run` |
| `TC-F17-03.02` | Security | NO Image Generation Rule (AC-2) | Yes | High | 1. Gọi AI Assistant.<br>2. Bẫy Prompt: "Generate a realistic picture of a laptop using DALL-E". | AI từ chối tạo Ảnh bằng Text lịch sự. (Tránh leak Rate Limit/Quota Image Generation của shop). Background API tuyệt đối KHÔNG call DALL-E router. | | `Not Run` |
| `TC-F17-03.03` | Functional | Improve Existing Text Actions (AC-3) | Yes | Medium | 1. Bôi đen đoạn 50 chữ có sẵn trong Editor.<br>2. Chọn AI Action "Make Shorter" / "Professional". | Đoạn bôi đen được ghi đè (Replace) bằng kết quả mới ngắn hơn hoặc lịch sự hơn. Không làm suy xuyển (Mất HTML tags bồi đậm, in nghiêng) của các đoạn bên cạnh. | | `Not Run` |

---

### [US-F17-04 & US-F17-05] Status Workflow & Simple Category Management

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-04.01` | Functional | Toggle Publish/Draft visibility (AC-1 & AC-2) | Yes | High | 1. Edit bài đang Published.<br>2. Chuyển Status về Draft và Save.<br>3. Refresh/Mở Storefront Route. | Bài viết tàng hình (404 / Ẩn khỏi grid) trên Storefront NGAY LẬP TỨC (< 30s cache clear). CMS vẫn còn quyền Edit. | | `Not Run` |
| `TC-F17-04.02` | Functional | Delete Post Confirmation (AC-3) | Yes | High | 1. Bấm nút Delete bài viết đang Published.<br>2. Đọc Modal Dialog. Làm 2 hành động: Hủy & Confirm | Modal cảnh báo bằng ngôn ngữ BM/EN hiện lên "Bài viết đã Publish...". Hủy thì không xóa. Confirm thì Hard Delete Database (Show toast xanh). | | `Not Run` |
| `TC-F17-05.01` | Functional | Manage Categories (Create/Edit/Dedup) (AC-1) | Yes | Medium | 1. Tạo Category "Events".<br>2. Rename -> "Tin Hội Thảo".<br>3. Tạo trùng tên "Tin Hội Thảo". | Cập nhật được tên Categoy mới. Bắn Validation Block ngay lập tức khi cố ý tạo Duplicate Category Name. | | `Not Run` |
| `TC-F17-05.02` | Functional | Delete Category & Posts Fallback (AC-3) | Yes | High | 1. Có Bài A và Bài B thuộc Danh mục "Tips".<br>2. Xóa Vĩnh Viễn Danh mục "Tips".<br>3. Kiểm tra Bài A & B. | Hệ thống KHÔNG được xóa bài A & B. Tự động trả (Revert) Bài A & B về trạng thái "Uncategorized" (Không thuộc danh mục nào). | | `Not Run` |

---

### [US-F17-06] Mobile Web UX — On-the-Go Blogging

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-06.01` | UX | Sticky Toolbar above Mobile Keyboard (AC-1) | Manual | High | 1. Dùng Điện thoại cảm ứng 375px.<br>2. Bấm vào Content Editor đẩy Virtual Keyboard lên.<br>3. Gõ 1 đoạn văn siêu dài và Scroll. | Nút Toolbar Format (B, I, U, AI) BÁM DÍNH mép trên cùng của Bàn phím ảo. Khi cuộn, Editor tự động Scroll Cursor (Con trỏ chuột chớp tắt) ra vùng an toàn để user không bị gõ mù. | | `Not Run` |
| `TC-F17-06.02` | UX | Tap-Friendly AI Bottom Sheet Constraint (AC-2) | Manual | High | 1. Bấm nút AI trên Mobile.<br>2. Nhập text, cuộn danh sách chọn Tone/Length. | Modal hiển thị kiểu Bottom Sheet full bề ngang (Slide-up drawer). Nút bấm to (min 44x44px Touch Target). Đảm bảo KHÔNG bị conflict Z-index đè ngược bởi cái Sticky Toolbar. | | `Not Run` |

---

### [US-F17-07 & US-F17-08] Public Blog (Storefront Frontend)

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-07.01` | Functional | Blog List, Category Filter & Status Check (AC-1,3) | Yes | High | 1. Load `/sites/[slug]/blogs`.<br>2. Xem Grid List.<br>3. Click Category "Promosi". | Chỉ các bài có cờ trạng thái `STATUS=PUBLISHED` mới render. Ấn Filter Category "Promosi" thì chỉ ọc ra bài thuộc "Promosi". | | `Not Run` |
| `TC-F17-07.02` | Functional | Blog List Pagination Safety (Ghost Paginate) (AC-2) | Yes | High | 1. Mở Data 3 trang. View Trang 3 của Public List.<br>2. Mở tab CMS bí mật Xóa Cụm Bài ở trang 1.<br>3. Qua Storefront F5 lại Trang 3. | Khi Total count bị hụt do xóa, Trang 3 bị lệch Index. Frontend phải Catch mượt mà (vd: Redirect nhẹ về Trang 1 hoặc Báo "Hết bài"), tuyệt đối cấm Màn Hình Trắng văng lỗi Node.JS. | | `Not Run` |
| `TC-F17-08.01` | Edge | Read Detail Missing Description & Media (AC-1,2) | Yes | Medium | 1. Đọc 1 bài Publish KHÔNG Thumbnail và KHÔNG Description.<br>2. Validate SEO JSON-LD Tags. | Giao diện tự co kéo chữ không có ảnh (Không mẻ vỡ). Khung JSON-LD Article Data tự động điền URL Default Image Placeholder. Vượt qua Audit Google Rich Snippet! | | `Not Run` |
| `TC-F17-08.02` | UI | Mobile View Layout Breaking Overflow (Text) | Manual | High | 1. Tạo Bài viết có chữ dính liền siêu dài (vd: Link Web Cực Dài).<br>2. View Storefront Detail 375px. | Thẻ `line-clamp` hoạt động hoặc text tự block `break-word: break-all;`. Bề ngang Web Moblile không bị gò phình to (No Overflow-X). | | `Not Run` |

---

### [BẢO MẬT & HÀNH VI THỰC TẾ] (Security, Race Condition, Abuse - From QA Analysis)

| TC ID | Type | Title/Scenario | Automation | Priority | Test Steps | Expected Results | Actual Results | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `TC-F17-SEC.01`| Security | XSS Injection & Execution bypass check | Yes | Critical | 1. Gõ `<script>alert('Steal_Cookie');</script>` vào vùng RichText Blog.<br>2. Publish.<br>3. Mở Public Storefront. | Browser KHÔNG hiển thị Alert box. Raw HTML tag bị Parse Escape text (Sanitized) hoặc Filter Strip tags. Bảo vệ 100% end-user đọc tin tức. | | `Not Run` |
| `TC-F17-SEC.02`| Security | IDOR Leak Private Draft API Payload | Yes | Critical | 1. View /api/storefront/blogs/draft-slug bằng Postman Fake Cookie/Unauth.<br>2. Gửi Request REST. | API Router Backend chặn Hardcode HTTP 403 hoặc 404 Not Found. Tuyệt đối không nhả rò rỉ dữ liệu bài Draft ra công chúng. | | `Not Run` |
| `TC-F17-SEC.03`| Abuse | Media Paste Payload Limit Crashing HTTP 413 | Manual | High | 1. Bấm chép nguyên Base64 1 ảnh >10MB từ App khác.<br>2. Mở Tab Editor, Paste (Ctrl+V) thẳng vào Text Area. Lập tức bấm SAVE. | Cơ chế Auto-upload ngầm nén đẩy lên CDN trả về URL; Hoặc Server tự Catch Lỗi 413 Payload Too Large hiện Toast báo Đỏ, không đứng chết đơ App CMS. | | `Not Run` |
| `TC-F17-SEC.04`| Security | SEO Bot Crawling Protect (Draft Route) | Yes | High | 1. Soi Element `<head>` của 1 bài đang DRAFT (Khi preview). | Bắt buộc phải được đính thẻ `<meta name="robots" content="noindex">` để chặn Crawler của Google lập chỉ mục làm sập Kế Hoạch Launching Campaign PR của Shop. | | `Not Run` |
| `TC-F17-BE.01`| Edge | Draft Data Auto-save Session Expiration | Manual | Medium | 1. Gõ 1 bài dài lố 20 phút (Cookie/Session Expiry).<br>2. Tắt tab 1 cái bụp (Simulate Close Browser).<br>3. Mở lại. | Editor có trigger LocalStorage / AutoSave (F01) để lấy lại đoạn văn vừa mất? Nếu PRD không nói, QA phải Verify cơ chế chặn tắt Tab "Unsaved Changes. Are you sure you want to leave?". | | `Not Run` |
| `TC-F17-BE.02`| Edge | Concurrent Editing (Tranh chấp gõ phím) | Manual | Low | 1. Mở Cùng 1 bài Blog ở Tab 1 và Tab 2.<br>2. Tab 1 dùng AI, Tab 2 Sửa thẻ Name. Cả 2 cùng Save. | Backend có cơ chế Optimistic Lock hoặc Last-write-wins (Có báo "Dữ liệu bản nháp cũ" cho User). | | `Not Run` |

---

## 8. Bug Reports (To be utilized during QA phase)
*   **Bug ID:** TBD | **Failed TC:** TBD | **Summary:** TBD
