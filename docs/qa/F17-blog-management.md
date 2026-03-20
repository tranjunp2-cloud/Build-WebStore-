# Kịch bản Kiểm thử Đầu cuối (E2E Test Matrix) - F17: Blog Management

> **Module:** F17 — Blog Management (Quản lý Bài viết & SEO)
> **Author:** QA Automation Team
> **Mục tiêu:** Mật độ bao phủ (Coverage) 100% PRD & NFRs. Đảm bảo chất lượng Frontend, Backend, AI Assistant và Storefront.
> **Phạm vi (Env):** Staging (`staging.primeweb.app`)
> **Chú thích Locators:** Selector (ID/CSS/Xpath) được gắn trực tiếp vào Test Steps phục vụ cho Script Playwright Java.

---

## 1. Môi trường Giao diện Thực tế & 9-Point Checklist (Cross-cutting UI/UX)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_001` | UI | [Pos] Skeleton Loading (Visual Animation) | Yes | High | 1. Navigate `/dashboard/blog`. Mô phỏng Slow 3G.<br> *`[Loc: div.blog-list-skeleton]`* | Thay vì thẻ Spinner, hệ thống render Skeleton Layout mượt mà. Header, Sidebar Không bị re-render. | | `Not Run` |
| `TC_F17_002` | Logic| [Neg] Disable Element lúc gọi AI | Yes | High | 1. Click "✨ Generate with AI", đợi xử lý.<br> *`[Loc: button.btn-ai-generate]`, `[Loc: button.btn-save-post]`* | Nút Save và Data Form bị disable (`disabled=true`) để ngăn rủi ro lưu khi chưa có text mới trả về. | | `Not Run` |
| `TC_F17_003` | UI | [Pos] Toast Message Feedback | Yes | High | 1. Thực hiện tạo bài mới thành công.<br> *`[Loc: div.toast-success]`* | Trả về Toast màu xanh báo thành công ở mép màn hình, Animation Fade out sau 3 giây. Trùng khớp UI Kit Figma. | | `Not Run` |
| `TC_F17_004` | Error| [Neg] Báo lỗi Time-out Global | Yes | High | 1. Tắt Wifi, bấm Lưu Bài.<br> *`[Loc: div.toast-error]`* | Bắn Toast báo lỗi kết nối đỏ. Không Crash trắng màn hình React ứng dụng. Mọi Component giữ nguyên state. | | `Not Run` |
| `TC_F17_005` | UI | [Pos] Hệ thống Margin & Padding chuẩn Figma | No | Med | 1. Mở màn Editor, resize trình duyệt sang Desktop (1440px).<br> *`[Loc: main.blog-editor-container]`* | Khung làm việc nằm cách Sidebar/Header khoảng trắng 24px (`p-6`). Độ rộng layout chuẩn thiết kế F18-03. | | `Not Run` |

---

## 2. [US-F17-01] Quản lý Duyệt và Thao tác Danh sách Blog

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_006` | Func | [Pos] Empty State 0 Kết Quả | Yes | High | 1. Wipe clear dữ liệu bảng Blog.<br> *`[Loc: section.empty-state]`, `[Loc: button.create-first-post]`* | Màn hình hiển thị Illustration trống + Text "Chưa có bài viết nào" và CTA tạo bài mới chuẩn F08. | | `Not Run` |
| `TC_F17_007` | Func | [Pos] Lưới Table Data hiển thị đúng | Yes | High | 1. Load Data có 5 bản ghi. Xem lưới Blog.<br> *`[Loc: tr.blog-row]`* | Table hiển thị 4 cột: Tiêu đề (kèm Thumbnail nhỏ), Trạng thái (Draft/Pub), Tác giả, Thời gian. Format Date `DD/MM/YYYY`. | | `Not Run` |
| `TC_F17_008` | Func | [Pos] Search, Sort, Filter | Yes | High | 1. Nhập từ khóa "Mới" vào Search Bar.<br> *`[Loc: input.search-blog]`*, *`[Loc: select.filter-status]`* | Table React lập tức update (Debounce 500ms) Lưới dữ liệu (Không reload trình duyệt page gốc). | | `Not Run` |
| `TC_F17_009` | Func | [Pos] Bulk Publish / Delete Action | Yes | High | 1. Tick chọn 3 bài viết. Bấm nút Tác vụ hàng loạt.<br> *`[Loc: input.checkbox-blog-row]`, `[Loc: button.bulk-publish]`* | Hệ thống áp dụng tác vụ cho 3 bài. Status badge chuyển qua màu xanh "Published". Payload Database cập nhật chính xác. | | `Not Run` |
| `TC_F17_010` | Func | [Neg] Partial Error Bulk Action | Yes | Med | 1. Bulk Publish 2 bài. 1 Bài cố tình xóa Title ở DB để bắt lỗi Validation.<br> *`[Loc: div.toast-warning]`* | Hiện Toast Warning: Báo cáo Publish thành công 1 bài, 1 bài từ chối do thiếu Tiêu đề. Không Rollback bài hợp lệ. | | `Not Run` |

---

## 3. [US-F17-02] Trình soạn thảo (Create & Edit Blog)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_011` | Func | [Pos] Thao tác tạo mới Happy Path | Yes | High | 1. Điền Info: Title, Content, Upload Thumbnail.<br> *`[Loc: input[name="title"]]`, `[Loc: div.tiptap-editor]`* | Request `/api/blogs` được gọi, Data lưu chính xác, Image Thumbnail Upload lên S3/CDN. Routing quay về màn List. | | `Not Run` |
| `TC_F17_012` | Bound| [Neg] Bỏ trống trường Bắt buộc (Title) | Yes | High | 1. Bỏ trống Input Title. Điền Content. Bấm Lưu.<br> *`[Loc: input[name="title"].error]`, `[Loc: p.error-msg]`* | Validation Field đỏ rực với Text "Title is required". Không gửi HTTP Request. Data không rác DB. | | `Not Run` |
| `TC_F17_013` | Func | [Pos] Tối ưu hóa SEO Metadata bằng AI | Yes | Med | 1. Gõ Title và Content. Bấm nút ✨ Tối ưu SEO.<br> *`[Loc: button.btn-seo-ai]`, `[Loc: input[name="metaTitle"]]`* | API AI phân tích nội dung. Meta Title và Meta Description tự động chép Text hợp logic. Text có thể sửa tay sau đó. | | `Not Run` |
| `TC_F17_014` | Logic| [Pos] Thuật toán Uniqueness Slug URL | Yes | High | 1. Tạo Bài 1: Title "Khuyến Mãi". Slug -> `/khuyen-mai`. Tạo bài 2 Title "Khuyến Mãi".<br> *`[Loc: input[name="slug"]]`* | Bài số 2 tự động thêm Hậu tố Unique (VD: `/khuyen-mai-1`) vào Slug để chống Crash Error MongoDB Index. | | `Not Run` |

---

## 4. [US-F17-03] Trợ lý Viết Blog AI (Text Only Constraint)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_015` | Func | [Pos] Sinh nội dung văn bản (Generate) | Yes | High | 1. Prompt bài viết chủ đề "Cà phê sạch".<br> *`[Loc: textarea.ai-prompt]`, `[Loc: button.ai-submit]`* | Chèn Text đã gen vào vị trí con trỏ cuối cùng (Caret Focus) bên trong lõi Rich Text Editor. Giữ nguyên format. | | `Not Run` |
| `TC_F17_016` | Logic| [Pos] Tùy biến Đoạn văn (Make Professional) | Yes | Med | 1. Highlight bôi đen đoạn Text có sẵn. Chọn Action AI "Professional".<br> *`[Loc: button.ai-action-pro]`* | Đoạn văn bôi đen lập tức bị replace bởi đoạn Text xịn hơn. Text bên ngoài vùng bôi đen giữ nguyên. | | `Not Run` |
| `TC_F17_017` | Sec | [Neg] Chống gọi DALL-E (Block Image API) | Yes | Blocker| 1. Bẫy Prompt "Vẽ 1 hình con chó 3D bằng tính năng Image gen".<br> *`[Loc: textarea.ai-prompt]`* | Cấu hình System Prompt chặt, AI tuyệt đối từ chối kết xuất Hình Ảnh. Phải cảnh báo "Tôi chỉ có thể khởi tạo văn bản". An toàn cho API Quota. | | `Not Run` |

---

## 5. [US-F17-04] Status Workflow (Publish, Draft, Delete)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_018` | Func | [Pos] Switch Trạng Thái Draft <-> Publish | Yes | High | 1. Đổi Bài từ Pub sang Draft, check Storefront.<br> *`[Loc: button.toggle-status]`* | Bài Publish hiện Public Storefront. Chuyển thành Draft lập tức Gỡ Khỏi hệ thống Live (Cache invalidate). | | `Not Run` |
| `TC_F17_019` | Func | [Pos] Delete Post Warning Dialog | Yes | High | 1. Xóa bài viết đang Published.<br> *`[Loc: button.delete-post]`, `[Loc: div.confirm-modal]`* | Dialog Confirm màu đỏ cản lại. Cảnh báo URL Storefront có thể lỗi 404 cho User. Xác nhận Delete DB. | | `Not Run` |

---

## 6. [US-F17-05] Simple Category Management

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_020` | Func | [Pos] Luồng Category Fallback khi Xóa Gốc | Yes | High | 1. Bài "Sale" gắn Category "C1". Xóa Category "C1". Kiểm tra bài "Sale".<br> *`[Loc: button.delete-category]`* | Xóa Category thì Bài Viết `KHÔNG` bị xóa (Soft Fallback). Trạng thái phân loại của Bài "Sale" trả về Mặc định "Uncategorized"/Null. | | `Not Run` |

---

## 7. [US-F17-06] Giao diện Mobile (On-the-go Editor)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_021` | UI | [Pos] Thanh Sticky Toolbar vướng Keyboard | No | High | 1. Thiết bị iOS 375px. Bơm Text tràn dòng. Bắn Virtual Keyboard.<br> *`[Loc: div.toolbar-sticky]`* | Thanh Toolbar bám dính trên đỉnh Bàn Phím. Viewport chừa góc >30% để nhìn thấy chữ Focus gõ. Auto-Scroll con trỏ tránh đè khuất do Toolbar. | | `Not Run` |
| `TC_F17_022` | UX | [Pos] Kéo AI Bottom Sheet đè Z-Index | No | Med | 1. Click Nút AI Assistant trên Mobile Browser.<br> *`[Loc: div.bottom-sheet-ai]`* | Component AI mọc lên kiểu Bottom Sheet Drawer đè chuẩn phía trên (z-index cao hơn Sticky Toolbar). Các nút bấm rộng >44px dễ Tap bằng ngón tay. | | `Not Run` |

---

## 8. [US-F17-07] Public Blog List (Storefront)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_023` | Logic| [Neg] Bảo vệ Màn Trắng Pagination | Yes | High | 1. Khách xem List Trang 3. Admin Xóa cụm bài Trang 1. Khách Reload lại Trang 3.<br> *`[Loc: div.blog-grid-storefront]`* | Bẫy lỗi Out of Bound Page. Frontend đẩy khách về Trang 1 hoặc Text "Đã hết bài", Không Throw Runtime Crash Error làm trắng xóa App Web. | | `Not Run` |

---

## 9. [US-F17-08] Public Blog Detail (Storefront)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_024` | Sec | [Pos] Bảo mật Meta robots noindex Draft Bài | Yes | High | 1. Bật F12 soi thẻ `<head>` của link Preview 1 bài Đang Nháp (Draft).<br> *`[Loc: meta[name="robots"]]`* | Bắt buộc tiêm thẻ `<meta name="robots" content="noindex">`. Không cho Google Bot dò rỉ bò vào quét Content CMS nội bộ trước ngày ra mắt. | | `Not Run` |
| `TC_F17_025` | Edge | [Pos] Cứu Lỗi SEO Thiếu Thẻ Ảnh JSON-LD | Yes | High | 1. Render bài Live KHÔNG có Ảnh Cover và Tóm tắt.<br> *`[Loc: script[type="application/ld+json"]]`* | Thẻ Schema JSON-LD vẫn xuất xưởng hợp lệ. Auto Render File Ảnh Placeholder ngầm và Tóm tắt tự cắt từ chữ Body. Tool Audit Google Không Báo Đỏ. | | `Not Run` |
| `TC_F17_026` | Func | [Pos] Tích hợp Thẻ OpenGraph & Twitter Card | Yes | High | 1. Đọc bài Publish, view Page Source.<br> *`[Loc: meta[property="og:image"]]`* | Có đủ thẻ `og:title`, `og:description`, `og:image`. Bấm Share Link qua Facebook/Zalo phải Render ra đầy đủ Card chứa Khung Ảnh bự và Tiêu đề. | | `Not Run` |
| `TC_F17_027` | Sec | [Neg] Chặn IDOR Route API Get Blog Detail | Yes | Blocker| 1. Bắn cURL GET `api/storefront/blogs/[SLUG]` lấy mã bài DRAFT.<br> *`[Client: Postman/cURL]`* | Access Control chặn quyền truy nhập bài nháp qua Storefront. Bắn trả mã 404/403. Không để lộ Response Lõi Database ra ngoài. | | `Not Run` |
| `TC_F17_028` | UI | [Neg] Responsive Text Overflow trên Mobile | Manual | High | 1. Mở bài Publish có Text liên tục siêu dài (Không khoảng trắng, VD: Link).<br>2. Xem trên màn hình iPhone 375px.<br> *`[Loc: div.blog-detail-content]`* | Đoạn Text siêu dài bị CSS `word-break: break-all` hoặc cản lại. Bề ngang Storefront KHÔNG bị chình phình (Overflow-X) sinh thanh cuộn ngang gây bể layout. | | `Not Run` |

---

## 10. Payload Abuse & Edge Cases (Database, CMS Limit, Race Condition)

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_029` | Sec | [Neg] Rich Text XSS Payload Injection | Yes | Blocker| 1. Điền mã JavaScript rết `<script>alert(1)</script>` vào Lõi Content Blog. Publish ra Storefront.<br> *`[Loc: div.blog-detail-content]`* | Quá trình Render dùng Sanitizer bóc sạch Tag Script hoặc Escape tag thành dạng chữ nổi thô sơ `. Trình duyệt không chạy lệnh tấn công ăn cắp Cookie. | | `Not Run` |
| `TC_F17_030` | Error| [Neg] Nhồi Image Base64 Quá Payload Băng thông | No | High | 1. Copy Image Raw dán thẳng vào Text, Tăng dung lượng JSON lên 8MB. SAVE.<br> *`[Loc: div.tiptap-editor]`* | Nếu quá 413 Payload Too Large, API trả Lỗi Toast Đỏ. CMS sống sót (React ko chết), Editor chặn Save DB bắt nhả Text ra. Quản lý Rủi Ro Băng Thông tốt. | | `Not Run` |
| `TC_F17_031` | Logic| [Neg] Chạm Trán Sửa Đổi Giữa 2 Tabs (Race Condition)| No | Low | 1. M mở Cùng 1 bài Blog trên 2 Tabs Chrome. Tab 1 Sửa Text lưu. Tab 2 sửa Title Lưu tiếp.<br> *`[Loc: button.btn-save-post]`* | Last-write-wins (Lưu đè). Hoặc Hệ thống thông báo Version Conflict Update. Tránh gây đứng kẹt giao dịch CSDL MongoDB. | | `Not Run` |
| `TC_F17_032` | FailSafe| [Pos] Chống mất bài (Auto-Save / Leave Warning) | Yes | Blocker| 1. Gõ 1000 chữ. Tắt Tab đột ngột HOẶC Bấm nút Back.<br> *`[Loc: window.onbeforeunload]`* | Trình duyệt bắn Popup chặn đứng: "Unsaved changes...". Nếu rớt F5, LocalStorage khôi phục lại phần lớn nội dung vừa gõ. Bảo vệ công sức Editor. | | `Not Run` |
| `TC_F17_033` | Logic| [Neg] Đổi Slug Gây Gãy Link 404 Đầu Cuối | Yes | High | 1. Bài A đang dùng Slug `/link-cu`. Sửa thành `/link-moi` & Pub.<br>2. Khách click link URL `/link-cu`. | Hệ thống Back-end tự cấu hình (Auto-generate) Rule 301 Redirect đẩy Khách từ `/link-cu` sang `/link-moi`. KHÔNG văng màn trắng 404. | | `Not Run` |
| `TC_F17_034` | Func | [Pos] Dọn rác khi Paste Content từ MS Word | No | High | 1. Mở file Word (chứa Table, Styles). Copy và Paste tất cả vào Text Editor.<br> *`[Loc: div.tiptap-editor]`* | Tiptap Editor Clean/Strip Inline Styles rác. Storefront Mobile view không bị tràn viền (overflow-x) gây thanh cuộn ngang khó chịu. | | `Not Run` |
| `TC_F17_035` | Logic| [Neg] Xóa Bài Đang Được Sửa (Multi-Admin Conflict) | Yes | Blocker| 1. Admin A mở trang Edit bài X. Admin B ở ngoài trang List bấm Xóa bài X. 2. Admin A bấm Save bài X. | Backend trả về Lỗi Đỏ (Trạng thái 404 Update Fail) "Bài viết đã bị xóa!". CMS giữ nguyên Content ở Tab đang mở cho Admin A lấy lại văn tự chứ Không tự F5 Crash mất trắng. | | `Not Run` |
| `TC_F17_036` | Sec | [Neg] Phân Quyền IDOR POST API (Role-Based) | Yes | Blocker| 1. Khởi tạo Token tài khoản Staff (Role `order:manage`, KHÔNG có `blog:manage`).<br>2. Bắn API `POST /api/blogs` kèm JSON Body Tạo bài.<br> *`[Client: Postman/cURL]`* | Backend Middleware chặn Request báo `HTTP 403 Forbidden`. Không phụ thuộc vào giấu Nút UI Frontend. Hacker không thể tuồn bài viết lên CMS bằng Code. | | `Not Run` |
| `TC_F17_037` | Logic| [Pos] Thu hồi và Tái sử dụng Slug (Hard Delete) | Yes | High | 1. Tạo bài A có Slug `/tet-2026`.<br>2. Xóa Vĩnh Viễn bài A.<br>3. Tạo bài B mới, gỡ Slug thành `/tet-2026`.<br> *`[Loc: button.delete-post]`* | Do PRD yêu cầu Hard Delete, Slug `/tet-2026` phải được nhả ra free. Bài B lưu thành công không bị báo lỗi "Slug already exists" (Do đụng độ rác Soft-delete). | | `Not Run` |
| `TC_F17_038` | UX/SEO| [Neg] Lỗi Cache Stale Data (Cache Invalidation) | Manual | Blocker| 1. Bài "Sale" đang Live ở Storefront.<br>2. Admin vào CMS sửa sai chính tả chữ "Sale" -> "Sales" và Lưu.<br>3. Ra Storefront F5 ẩn danh ngay lập tức.<br> *`[Loc: div.blog-detail-content]`* | Lỗi chính tả phải được update MỚI trên Storefront trong vòng < 30 giây (Theo AC PRD). Hệ thống bắt buộc phải Purge/Invalidate CDN Cache (Next.js Revalidate) khi có lệnh PUT API. | | `Not Run` |
| `TC_F17_039` | Sec | [Neg] Tấn công giả mạo CSRF Xóa Blog | Yes | High | 1. Admin đang Login CMS.<br>2. Click vào 1 link Phishing dụ bấm nút. Link ngầm gửi `DELETE /api/blogs/123`.<br> *`[Client: HTML Form Auto Submit]`* | Trình duyệt chặn request vì thiếu Anti-CSRF Token trong Header hoặc Cookie SameSite=Lax chặn gửi Origin chéo. Bài viết của Admin không bị Hacker xóa lén. | | `Not Run` |
| `TC_F17_040` | Logic| [Neg] Lỗi Concurrency Xóa Category Khi Đang Edit | Yes | High | 1. Admin A mở bài X, chọn Dropdown Category "Tips". Chưa bấm Save.<br>2. Admin B xóa vĩnh viễn Category "Tips".<br>3. Admin A bấm Save bài X. | Bài X lưu thành công nhưng Fallback về "Uncategorized", hoặc API trả lỗi "Category không còn tồn tại". Hệ thống KHÔNG được ném Internal Server Error 500 do kẹt khóa Ngoại (Foreign Key constraint). | | `Not Run` |

---

## 11. Kịch bản Hành trình Người dùng Thực tế (E2E Real User Journey)

> **Mục tiêu:** Kiểm thử luồng tích hợp nguyên khối (Integration & Workflow) từ góc độ Người dùng thực tế (Store Owner) và Khách hàng (Customer) trải nghiệm xuyên suốt. Tuyệt đối không test rời rạc từng nút bấm.

| TC ID | Type | Title/Scenario | Auto | Pri | Test Steps & Locators | Expected Results | Actual Results | Status |
|-------|------|----------------|------|-----|-----------------------|------------------|----------------|--------|
| `TC_F17_E2E_01` | E2E | [Pos] Luồng xuất bản và hiển thị hoàn hảo | Yes | Blocker| **Chủ Shop:**<br>1. Login CMS -> Blog Menu.<br>2. Empty State, tạo Category "Sự kiện".<br>3. Tạo Bài, gõ Title "Khai Trương", dùng AI sinh text, up Thumbnail.<br>4. Save as Published.<br>**Khách hàng:**<br>5. Mở Tab ẩn danh, truy cập `/blogs`.<br>6. Đọc chi tiết Bài "Khai Trương". | 1-4. CMS lưu trơn tru, Toast xanh. Bảng dữ liệu update.<br>5. Khách thấy bài ở Grid.<br>6. Màn xem mượt, check JSON-LD SEO đầy đủ ảnh và Meta description. | | `Not Run` |
| `TC_F17_E2E_02` | E2E | [Neg] Viết bài trên Mobile & Gián đoạn Offline | Man | High | **Chủ Shop:**<br>1. Safari iOS (375px), mở bài "Khai Trương" Published để sửa (gõ text qua Toolbar Sticky).<br>2. Chưa kịp lưu, cúp Wifi (Offline).<br>3. Có mạng lại, đổi Status -> Draft, Lưu.<br>**Khách hàng:**<br>4. Khách đang xem bài Khai trương, bấm F5. | 1-3. Mobile UI không vỡ. Báo lỗi mạng Toast đỏ. Data gõ dở không bay màu (Auto-save/Local). Lưu Draft thành công.<br>4. Khách bị 404 hoặc trả về trang `/blogs` do bài đã rút khỏi Public. | | `Not Run` |
| `TC_F17_E2E_03` | E2E | [Neg] Xóa Danh mục & Link SEO 301 Sharing | Yes | High | **Chủ Shop CMS:**<br>1. Xóa vĩnh viễn Category "Sự kiện".<br>2. Đổi Slug bài "Khai Trương" sang "khai-truong-2026".<br>**Khách Mạng Xã Hội:**<br>3. Khách click URL cũ chia sẻ trên Zalo. | 1-2. Xóa Category không mất bài (Trả về Uncategorized). Đổi Slug ép sinh rule 301 ngầm.<br>3. URL cũ lập tức Redirect 301 (Permanent) sang URL `khai-truong-2026`. Trải nghiệm xuyên suốt. | | `Not Run` |

---

## 12. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates - F17)

| Criteria | Status | Target Agent .SKILL |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Not Run | `Locator_Healer_Agent`: Focus Playwright Skeleton Loading, Toolbar Sticky Mobile OS, Modal Bottom Sheet. |
| **2. API & Logic** | [ ] Not Run | `BDD_Cucumber_Agent`: Validate Category Deletion Fallback, Uniqueness Slug Routing URL. |
| **3. Security & Filter** | [ ] Not Run | `QC_Fixer_Test`: Audit NoSQLi/XSS tiêm thẻ Script, IDOR phân quyền bài Draft qua GET API, Block call ảnh AI DALLE. |
| **4. SEO Crawler SLA** | [ ] Not Run | `Performance_Tester`: JSON-LD Validation Script, `<meta noindex>`, Limit File Base64 413. |
| **5. E2E UAT Approval** | [ ] Not Run | Pass P0/P1 Suite (Blocker & High Priority Results = 100% Passed). |
