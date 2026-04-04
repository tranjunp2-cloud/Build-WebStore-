# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F05 - AI Editor (Split Screen)
> **Phiên bản:** 6.0 (Formal Traceability Matrix) | **Cập nhật:** 2026-04-02 | **Thực hiện:** QA Team
> **Tài liệu tham chiếu PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md) | **Tài liệu tham chiếu User Stories (13 US):** [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md)

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng đạt quy chuẩn **Comprehensive QA Expert**, hướng đến Coverage 100% rủi ro (Risk-based Coverage) xuyên suốt 13 User Stories. 

**Số lượng Testcase:** Tổng cộng **85 Kịch bản chi tiết** bao phủ: Kiểm thử luồng chính (Positive), Kiểm thử luồng ngoại lệ (Negative/Edge cases), Trạng thái giao diện (UI States), Tính hợp lệ dữ liệu (Form Validation), Xử lý tương tranh (Concurrency), và An toàn bảo mật (Security). Toàn bộ nội dung sử dụng ngôn ngữ kiểm thử phần mềm chuyên nghiệp, rõ ràng và khách quan.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Automation Framework | Playwright (BDD) |
|URL |https://web-cms-v2.dev.ecommercehub.my/

---

## 3. Unified Test Cases (Traceability Matrix)


| ID | Tham chiếu | LOẠI (Type) | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN (Steps) | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-01: AI Editor — Split Screen Chat + Preview]** (10 Cases) | | | | | | | |
| **TC-F05-01-01**| `US-01/AC1` | `UI`    | Kiểm tra khởi tạo Layout 3 vùng | Truy cập URL `/editor/:siteId` | Hệ thống hiển thị đầy đủ 3 phân vùng (Chat, Preview, Settings). | Blocker | [x] |
| **TC-F05-01-02**| `US-01/AC2` | `Func`  | Phản hồi giao diện qua luồng SSE | Nhập lệnh (Prompt) và nhấn Submit| Giao diện Iframe cập nhật với luồng stream `< 3 giây`. | Blocker | [x] |
| **TC-F05-01-03**| `US-01/AC3` | `Logic` | Xử lý lệnh Hoàn tác (Undo) | Sử dụng phím tắt Ctrl+Z hoặc UI | Phục hồi trạng thái State gần nhất trong khoảng `< 200ms`. | High    | [x] |
| **TC-F05-01-04**| `US-01/AC5` | `Edge`  | Cơ chế Auto-save (Throttling) | Nhập từ khóa liên tục 5s, dừng 3s | Hệ thống chỉ kích hoạt API PATCH 1 lần duy nhất để lưu DB. | High    | [x] |
| **TC-F05-01-05**| `US-01/UX`  | `UX`    | Tương tác phím tắt | Bấm phím Shift+Enter tại Chat | Con trỏ chuyển dòng văn bản, không gửi (Submit) đoạn lệnh. | High    | [ ] |
| **TC-F05-01-06**| `US-01/Val` | `Val`   | Xử lý chuỗi lệnh rỗng (Empty) | Nhập toàn bộ ký tự trắng (Space) | Giao diện vô hiệu hóa (Disable) nút Gửi, không gọi API LLM. | Priority| [x] |
| **TC-F05-01-07**| `US-01/Val` | `Bound` | Giới hạn tối đa chuỗi ký tự | Dán chuỗi lệnh trên 5,000 ký tự | Hiển thị chuỗi lỗi "Vượt quá độ dài tối đa", hệ thống hủy gọi API. | Blocker | [ ] |
| **TC-F05-01-08**| `US-01/Net` | `Net`   | Lỗi ngắt kết nối trong lúc truyền | Cắt kết nối mạng khi stream chạy| Sinh Toast lỗi kết nối. Phục hồi Iframe về mốc dữ liệu cũ. | Blocker | [x] |
| **TC-F05-01-09**| `US-01/Race`| `Race`  | Hủy lệnh AI đang thực thi | Nhấn phím Mũi Tên Hủy (Abort) | Kết thúc tiến trình stream ngay lập tức. Không lưu dữ liệu rác. | High    | [ ] |
| **TC-F05-01-10**| `US-01/Con` | `Concu` | Xung đột phiên chỉnh sửa song song | Thao tác đồng thời trên 2 Tab | Tab thao tác sau trả về HTTP 409 Conflict. Yêu cầu làm mới trang. | Blocker | [ ] |
| **[US-02: Page Manager]** (12 Cases) | | | | | | | |
| **TC-F05-02-01**| `US-02/AC1` | `UI`    | Hiển thị lưới danh sách Page | Mở Tab Pages tại công cụ Sidebar | Trả về danh sách gồm: Cờ Live/Draft, số lượng khối, Ngày update. | High    | [x] |
| **TC-F05-02-02**| `US-02/Stt` | `State` | Trạng thái lưới khi Dữ liệu rỗng | Xóa toàn bộ trang trong cơ sở dữ liệu | Giao diện Empty State hiển thị thông báo "Chưa có trang". | High    | [x] |
| **TC-F05-02-03**| `US-02/Stt` | `State` | Trạng thái Loading Skeleton | Giảm tốc độ đường truyền kết nối | Cấu trúc Skeleton mờ sáng hiển thị đến khi Load xong dữ liệu. | Medium  | [ ] |
| **TC-F05-02-04**| `US-02/AC2` | `Func`  | Thêm trang mới hợp lệ | Nhập tên trang mới hợp lệ | Tạo trang thành công. Slug định dạng `kebal-caseL`. Redirect đúng URL| Blocker | [x] |
| **TC-F05-02-05**| `US-02/Val` | `Val`   | Form Title bị bỏ trống | Click Submit mà không nhập liệu| Cản luồng Form Submit. Trường Zod báo lỗi "Tên trang là bắt buộc". | High    | [x] |
| **TC-F05-02-06**| `US-02/Sec` | `Sec`   | XSS Injection vào Form Tên | Nhập chuỗi HTML `<script>` nguy hiểm| Payload CMS Sanitize lọc bỏ XSS. Tên trang loại trừ rủi ro JS chạy ngầm. | Blocker | [x] |
| **TC-F05-02-07**| `US-02/Val` | `Val`   | Phân tích giá trị biên Title Length| Nhập chuỗi 300 ký tự vào Name | Lỗi Input Maxlength (Tối đa 255 ký tự). Block tiến trình API Save. | Priority| [ ] |
| **TC-F05-02-08**| `US-02/Limit`| `Bound` | Trùng lặp đường dẫn (Duplicated Slug)| Thêm một trang có tên đã tồn tại| Cơ chế tự động thêm đuôi số thứ tự vào slug mới để tránh DB Conflict. | Medium  | [x] |
| **TC-F05-02-09**| `BR-08.1`   | `Limit` | Giới hạn số lượng trang (Max Pages) | Tạo vượt quá 100 trang trong Site| Trả về lỗi Validation "Đã đạt giới hạn 100 trang cho cơ sở dữ liệu". | Medium  | [ ] |
| **TC-F05-02-10**| `US-02/AC3` | `Logic` | Xóa mềm một trang (Soft Delete)| Xác nhận lệnh xóa trang | Thiết lập `deletedAt`. Mảng danh sách loại bỏ ID này. | High    | [x] |
| **TC-F05-02-11**| `US-02/Undo`| `Recov` | Hủy thao tác xóa (Undo Deletion)| Bấm "Hoàn tác" ngay tại Toast | Xóa giá trị `deletedAt`. Trang hiển thị trả về đúng vị trí danh sách cũ. | Blocker | [x] |
| **TC-F05-02-12**| `US-02/AC4` | `Flow`  | Đổi trạng thái Ẩn trang (Hide/Unhide)| Dùng Toggle kích hoạt vô hiệu hóa| Giá trị isVisible thay đổi. Trạng thái Live của User ngoài báo 404. | Blocker | [x] |
| **[US-03: Inline Click-to-Edit Element]** (6 Cases) | | | | | | | |
| **TC-F05-03-01**| `US-03/AC1` | `UX`    | Tương tác hiển thị Nút gọi AI | Hover chuột lên một Text Block tĩnh | Gọi Popup "Edit with AI" tọa lề chính xác. | Medium  | [ ] |
| **TC-F05-03-02**| `US-03/AC2` | `Func`  | Viết lệnh Inline Text AI | Cung cấp ngữ cảnh sửa nội dung | Khối Block nhận lệnh điều chỉnh ký tự cục bộ không làm lệch layout CSS.| Blocker | [x] |
| **TC-F05-03-03**| `US-03/Flow`| `Flow`  | Hủy quá trình soạn thảo Inline | Click chuột viền ngoài Component | Thoát bảng Popup. Không tạo lịch sử nháp lưu trên State. | Medium  | [ ] |
| **TC-F05-03-04**| `US-03/Mob` | `Mob`   | Tương thích Popup Inline Mobile | Mô phỏng tại Viewport 375px | Popup chuyển thể thành Bottom Sheet thay vì Floating Box tràn lề. | High    | [ ] |
| **TC-F05-03-05**| `US-03/AI`  | `Val`   | Ngoại lệ kết nối API Backend | Ngắt ngầm kết nối trong Inline Edit | Text Component được bảo tồn giá trị ban đầu, cờ Error Toast báo kết nối. | High    | [x] |
| **TC-F05-03-06**| `US-03/Limit`| `Bound` | Rào cản ký tự Text Input Prompt | Nhập quá số lượng từ quy ước | Dấu hiệu đỏ hiển thị Form Validation chống Bypass gửi Request dư. | Medium  | [ ] |
| **[US-04: Add New Section via AI]** (3 Cases) | | | | | | | |
| **TC-F05-04-01**| `US-04/AC1` | `Logic` | Khởi tạo Component tự động | Lệnh khởi tạo một Block Footer | Cập nhật cấu trúc JSON DOM bổ sung Element mượt mà. | High    | [x] |
| **TC-F05-04-02**| `US-04/Hall`| `Edge`  | Lệnh Ảo/Out of Context Scope | LLM nhầm cấu trúc Block phi chuẩn | Fallback cơ chế từ chối rủi ro, thông báo Chat "Không nhận dạng khối". | Medium  | [ ] |
| **TC-F05-04-03**| `US-04/Lim` | `Bound` | Tràn bộ nhớ Component DOM Limit | Gấp số lượng Block > Max Length | Chặn đứng cơ chế ghép DOM vượt hạn độ (Chống quá tải Render Engine). | High    | [ ] |
| **[US-05: Drag-and-Drop Block Reorder in Editor]** (5 Cases) | | | | | | | |
| **TC-F05-05-01**| `US-05/AC1` | `DND`   | Thao tác hoán đổi vị trí Block | Kéo Block lên một khoảng mục tiêu | Index Z-Order đổi chỗ hợp lệ. Render trực diện tại Iframe chuẩn thông số. | Blocker | [ ] |
| **TC-F05-05-02**| `US-05/AC2` | `Logic` | Hủy thay đổi Hoán Vị DND | Gọi lại Component Undo State | Undo khôi phục chính xác ID định khối Block. API Redo State hoạt động. | High    | [x] |
| **TC-F05-05-03**| `US-05/Spam`| `Race`  | Tương tác Drag and Drop dồn dập | Liên tục thay vị trí Block 5s | Throttling chống tạo Race Condition Array, API Update ghi nhận bản lưu cùng. | Blocker | [ ] |
| **TC-F05-05-04**| `US-05/Sec` | `UI`    | Tha thả Component Ngoài Boundary | Keo element rời ra ngoài phạm vi Window | Xóa thành công Ghost Element khỏi DOM. Reset Layout an toàn gốc. | Medium  | [ ] |
| **TC-F05-05-05**| `US-05/Mob` | `Mob`   | Thiết lập giới hạn Drag trên Mobile | Kiểm thử Môi trường điện thoại | Cơ chế trượt vuốt (Scroll) không Xung đột Lẫn Lộn với cơ chế Kéo thả. | High    | [ ] |
| **[US-06: Manual Visual Editing (WYSIWYG Text & Image)]** (8 Cases)| | | | | | | |
| **TC-F05-06-01**| `US-06/AC1` | `Func`  | Định dạng chuẩn Bold/Italic | Sử dụng thanh công cụ Text Toolbar| Tag `<b>`, `<i>` được wrap an toàn trong mã nguồn Rich Text DB. | High    | [x] |
| **TC-F05-06-02**| `US-06/AC2` | `DB`    | Tình huống xóa Null toàn vẹn Block| Cố tình xóa rỗng phần Text | Khóa chặn đứt mạch Document bằng Placeholder Text, duy trì Padding CSS.| Medium  | [ ] |
| **TC-F05-06-03**| `US-06/Img` | `Val`   | Nén hình ảnh tự động (Auto Compress) | Tải tệp hình Bitmap >10MB lên | Frontend Middleware thực thi Resize hình đạt chuẩn, giảm nhẹ File Size API.| Blocker | [x] |
| **TC-F05-06-04**| `BR-08.1`   | `Limit` | Chối File Upload Ngoại Lệ định dạng | Nhúng file `.exe` thay vì ảnh | Xác thực Validator khóa API chặn gọi Cloud Storage S3 dư thừa. | High    | [ ] |
| **TC-F05-06-05**| `US-06/Sec` | `Sec`   | Chống Injection Style Dơ từ Office | Copy/Paste nội dung dài từ Word | Hàm DOMPurify làm sạch mọi thẻ Inline Style rủi ro hỏng định dạng App. | High    | [x] |
| **TC-F05-06-06**| `US-06/Sec` | `Sec`   | Security Check Injection SVG XML | Upload File Logo mang mã SVG Hack | Object Base Server xóa bỏ Payload XML không an toàn phòng chống XSS triệt.| Blocker | [x] |
| **TC-F05-06-07**| `US-06/UI`  | `UI`    | Hiển thị Floating Toolbar Chuẩn | Text selection Highlight phạm vi | Bảng Tool xuất hiện canh lề chuẩn, không chắn View nội dung phía dưới. | High    | [ ] |
| **TC-F05-06-08**| `US-06/Race`| `Race`  | History Undo Limit Test (Tràn Range)| Tổ hợp Ctrl+Z 60 vòng lặp nhanh | Chỉ giữ mảng tối đa 50 Undo Array (Nút mờ đi) chống nguy cơ Crash Memory. | Blocker | [ ] |
| **[US-07: Global Header & Footer Management]** (5 Cases) | | | | | | | |
| **TC-F05-07-01**| `US-07/AC1` | `Func`  | Sắp xếp phân cấp Sub-menu Navigation| Neo và đưa Item Menu lồng | Cấu hình Menu cha-con hiển thị Global Navigation Bar xuyên suốt các List Page. | High    | [ ] |
| **TC-F05-07-02**| `BR-08.1`   | `Limit` | Hạn chế cấp lồng tối đa tầng Node | Gắn một tầng cấp 3 vào Tree | Cơ chế cản Nested level 3 (Toast Cấm: Chỉ hỗ trợ Navigation 1 cấp con). | High    | [x] |
| **TC-F05-07-03**| `US-07/AC2` | `Logic` | Tính năng cắt gọt sinh Favicon Tự | Thay đổi Main Logo Root | Xử lý hình ảnh gốc xuống tỷ lệ 32x32px ghim tự động cho thẻ `[rel="icon"]`.| High    | [x] |
| **TC-F05-07-04**| `US-07/Val` | `Val`   | Check Validation Menu Không Cố Dãn| Liên kết Link Empty không Url | Trường Dữ liệu báo Valid Error yêu cầu nhúng Đích Cụ Thể (URL Target Lived). | High    | [ ] |
| **TC-F05-07-05**| `US-07/Race`| `Sec`   | Giới Hạn Array Item Header Menu | Load vượt mốc 15 Title Danh Cấp | Khóa cấm mốc List vượt ngạch Navigation tránh Trầm Cấp Mobile Render Nát.| Medium  | [ ] |
| **[US-08: Drag-and-Drop Component Library]** (5 Cases) | | | | | | | |
| **TC-F05-08-01**| `US-08/UI`  | `UI`    | Hiểu Thị Menu Dạng List Danh Block| Chọn mở Thanh Cụ Component Vãn | Render đầy đủ Library Element tách từng phân loại Ecommerce / Content Tĩnh.| Medium  | [ ] |
| **TC-F05-08-02**| `US-08/Stt` | `State` | Cấp Độ Lỗi Fallback Database Fetch| Ngưng Server API Blocks List Model| Trả Lỗi Empty State Rỗng Network Đính "Nút Lỗi Tải Mạng, Nhấn Xin Thử Đi Lại".| Priority| [x] |
| **TC-F05-08-03**| `US-08/DND` | `DND`   | Thao Tác Neo Ráp Chạm Đích DND Chuẩn| Gọi Chọn Cấu Đáy Trục Dọc Layout | Tính Toán Iframe Z-Order Mượt Sóng Không Khựng Hiệu Ứng Nối Nút (Indicator Nổi).| Blocker | [ ] |
| **TC-F05-08-04**| `US-08/Mob` | `Mob`   | Click Thẳng Trên Màn Hình Handset | View Trộm Di Động Bấm Màn Chọn | Mobile Hỗ Trợ Ghi Đáy Iframe Qua Mode Nút Tap Chìm Chạm Chống Nhập Drag Drop. | High    | [ ] |
| **TC-F05-08-05**| `US-08/Sec` | `Race`  | Bắt Rào Căn Cản Vứt Component Nhấn| Đẩy Nhanh Chuỗi Touch API Liên Tục| API Batch Call Cản Giảm Vãn Click Gây Race Dội Load Server Khi Spawn Data Block. | High    | [ ] |
| **[US-09: Tùy chỉnh Trang 404 (404 Not Found Page)]** (3 Cases) | | | | | | | |
| **TC-F05-09-01**| `US-09/AC1` | `Func`  | Update Hình Ảnh Nền Template Cũ 404| Cung cấp Content Mới Ở Form 404 | System Route Ánh Xạ Đường Lỗi Http 404 Bắt Format Page Template 404 Khách Tạo. | High    | [x] |
| **TC-F05-09-02**| `US-09/Val` | `Bound` | Ràng buộc Bảo Vệ Field Root Path | Đè Trịch Chỉnh Sửa Path Routing | Nút Sửa Slug Tắt Input Đen Không Vãn Đổi Hệ Cắt Root Error Domain Phá 500 Vỡ. | Blocker | [x] |
| **TC-F05-09-03**| `US-09/Flow`| `Flow`  | Đánh Unpublish Rút Chân 404 Form Mới| Xoay Giao Diện Dọc Đổi Khóa Bật Trang| Hệ System 404 Cấm Quyền Unpublish Block Nút Đè Trái Màn Web System Default. | High    | [x] |
| **[US-10: Publish & Unpublish Flow (Live & Maintenance)]** (6 Cases)| | | | | | | |
| **TC-F05-10-01**| `US-10/AC1` | `Flow`  | Thử Nghiệm Chuỗi Dựng Live Web Domain| Chọn Khóa Form Triền Publish Ra | Đẩy API Subdomain Nối Pipeline Cloud Flare Ping Khách Trong Range 30 Giây. | Blocker | [x] |
| **TC-F05-10-02**| `US-10/AC2` | `Flow`  | Gọi Lặp Lệnh Re-Publish Dữ Liệu | Đổi Text Live Web Và Gửi Sync Deploy| Server Refresh Trả 100% Nội Render Cache Sạch Mọi Endpoint URL DNS Truy Xuất. | High    | [x] |
| **TC-F05-10-03**| `US-10/AC3` | `Flow`  | Đẩy Form Ngưng Dùng Route Maintenance| Thiết Lập Quản Unpublish Chặn Khách| Router Code Quảy 503 Web Ngang Giật Thay Bảng Maintenace Thay Khách Ngã. | Blocker | [x] |
| **TC-F05-10-04**| `US-10/Err` | `Net`   | Lỗi Trạm Cloud Server Mạng Sập Đột Ngột| Mất Network Giữa Cú Deploy Lõi | Loading Timeout 30s Chặn Đứt Gắn Alert "Lỗi Đồng Bộ Backend Hệ Thống Sống". | Blocker | [ ] |
| **TC-F05-10-05**| `US-10/Race`| `Race`  | Nháp Nháy Kép Publish Component Ngay | Double Tán Nút Gọi Khí Giật Đô Cấp | Bảng Khóa Disable Tool Chặn Dữ Liệu Kênh Race API Route Cạn Nguồn Cloud Nhất. | Blocker | [x] |
| **TC-F05-10-06**| `US-10/UI`  | `UI`    | Render Card Live Liên Tuyến Link Vành| Hiện Badge Xanh Chướng Nút Route Mở| Form Dâng "Mở Web" Trực Bật Trang Link Tĩnh Bảng New Tab Tách Mảng Edit Khách. | Medium  | [ ] |
| **[US-11: Interactive Widgets (Cart & Social Media)]** (4 Cases)| | | | | | | |
| **TC-F05-11-01**| `US-11/AC1` | `UX`    | Tích Giác Click Link Direct Social | Khúc Form Nền Gõ Kênh Mạng FaceBook | Nút Nhấn Nẩy Route Trang Mục Tiêu `_blank` Đảm Bảo Dữ Target Chuẩn Hành Vi Mới.| Priority| [x] |
| **TC-F05-11-02**| `US-11/Val` | `Val`   | Form Input Validate Định Ngữ Error Lạc| Truy Cập Text Box Chừa Lố Link URL Rỗng| Regex Kiểm Gốc Kích Đỏ Khung Input Required Định Ngăn Form API Rỗng Gây Dump.| High    | [ ] |
| **TC-F05-11-03**| `US-11/AC2` | `Logic` | Lệnh Gọi CheckOut Kênh Cart Chưa Pay| Ráp Giỏ Hàng Tenant Tòa Free Mức Dưới| Nền Iframe Có Cart Ngưng Hành Toast Báo "Hãy Kích Hoạt Tính Năng Ở Bảng Dashboard".| Blocker | [x] |
| **TC-F05-11-04**| `US-11/Flow`| `Flow`  | Mạng Giỏ Hàng Lệch Index Ngãng Sync | Thao Tác Chặn Thêm Giỏi Lệnh Data Cart| API Cống Nạp Item Render Căng Sóng Iframe Mượt Cấm Nháy Quá Đếm Số Ảo Gây Vỡ Layout.| Medium  | [ ] |
| **[US-12: Global Business Info & Settings Panel]** (6 Cases)| | | | | | | |
| **TC-F05-12-01**| `US-12/AC1` | `UI`    | Quan Sát Giao Diện Right Global Settings| Trích Form Navigation Chọn Global Khung| Component Cấu Kiến Form Contact Social Media Mở Ngang UI Mượt Dọc Tĩnh Rất Bền.| Medium  | [ ] |
| **TC-F05-12-02**| `US-12/AC2` | `DB`    | Tương Cặp Binding Root Data Dây Chuyền| Nhập Dữ Liệu Email Số HotLine Số Doanh | Hệ Layout Tương Chéo API Render Nối Layout Bật Kịp Mép Dữ Header Rẽ Không Trễ Cáp.| Blocker | [x] |
| **TC-F05-12-03**| `US-12/Del` | `State` | Càn Quét Logo Icon Xóa Tức Rút Kho | Đánh Biến Nút Logo Image Bóc Null Quản| Component Logo Bật Xóa, Chặn Mảng Trống Fallback Sang Chữ Text Name Bảng Thay Image.| High    | [ ] |
| **TC-F05-12-04**| `US-12/Val` | `Val`   | Check Validation Email Contact Wrong | Gõ Email Cốc Lạc Định Lỗi Thừa Mã `@@`| Zod Bắt Áp Regex Red Check Error Text Nhá Tọa Lệnh Ngăn Save API Nhập Rác Lưới Iframe.| High    | [x] |
| **TC-F05-12-05**| `US-12/Alert`| `Safe` | Vùi Cửa Sổ Form Chưa Save Khi Sửa Thoát| Sửa Email Lại Bấm Phím Nút Đóng Popup| Chóp Modal Confirm Phanh Vành Khẳng Cáo "Bạn Chưa Lưu Form Nhé Tắt Không Kệ Bỏ Xong".| High    | [ ] |
| **TC-F05-12-06**| `BR-08.1`   | `Limit` | Điền Tên Mạng Tràn Max Regex Độ Rộng| Cặp Tên Store Max Quá Giá 150 Dài Cuốc| Frontend Input Field Chặn Quản Ngang Nhập, Quýt Mã Boundary Không Cấu Rách Mảng Navbar.| Priority| [ ] |
| **[US-13: Page-Level SEO & AI Optimization]** (5 Cases) | | | | | | | |
| **TC-F05-13-01**| `US-13/AC1` | `Func`  | Nắn Trục Form Metadata Input SEO | Gõ Tay Đoạn Dòng Thẻ Meta Route Đỉnh| Mạng Form Hiển View Tựa Bảng Google Search Result Đúng Y Nét Ảo Code DOM Head Gài Iframe.| High    | [ ] |
| **TC-F05-13-02**| `US-13/AI`  | `AI`    | Gọi Auto-Gen AI Text Gen Description| Nút Nhấp Chuỗi API Prompt Sinh Chuẩn Kép| Bộ Payload Tool Extract Ngọt Nghĩa Nhả Đoạn Meta Text Đưa Chữ Kéo Thẻ Route Chính Iframe. | Blocker | [x] |
| **TC-F05-13-03**| `US-13/Lim` | `AI`    | Quản Spam Auto SEO Liên Hoành | Hit Call Generate Quá 15 Rate Limits Cáp| 429 Error Tắt Gen Mã Lệnh, Text Đỏ Thông Giới AI Bọc Chóp Rate Token Ráo Ngăn Vỗ Ngay Cấp.| Blocker | [x] |
| **TC-F05-13-04**| `BR-08.1`   | `Limit` | Chừa Vành Vỏ Title Dài Quá Ngưỡng | Viết Quá Số Character Recommend Ngập Khung | Lỗi Soft Limit Warn Cảnh Vàng Viền Thể Hiện Rút Mức Text Cắt Title Trên Màn Hình Search.| Priority| [ ] |
| **TC-F05-13-05**| `US-13/Stt` | `State` | Network Auto-Gen Drop Giữa Form Quá Tĩnh| AI Tải Mã Đứt Đuôi Error Kẹt Ngang Trục Rớt| Giao Diện Input Text Rỗng Form, Toast Bắn Báo Kẽ Hỏng Route Fallback Mạng An Toàn Dịch Lưu.| High    | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của Cửa hàng Bán lẻ (SME Owner)._

**Kịch bản E2E:** 
1. **[Bơm dữ liệu mồi - US-01]** Truy cập trình Builder Editor với Site ID mới. Thực hiện chat thử lệnh thay đổi nền website sang màu đậm. API streaming trả về layout trong thời gian chưa đến 3 giây mà không làm sập giao diện preview (TC-F05-01-02).
2. **[Hiệu đính thủ công - US-05, US-06, US-08]** Người dùng tiếp tục tương tác kéo thả component như Giỏ hàng hoặc Form Contact từ danh mục (Library) sang Iframe. Layout không bị xô lệch trên di động. Sửa nhanh 1 dòng chữ bằng cách Double-Click WYSIWYG và Upload Logo mới hệ thống tự sinh Favicon đẹp chuẩn.
3. **[Quản lý rẽ nhánh - US-02]** Thêm 1 trang hoàn toàn mới "Khuyến Mãi" bằng Page Manager. Cấu trúc link tự động render và đẩy menu header cập nhật realtime lên toàn bộ 2 trang. Thao tác xóa mượt mà với tính năng Undo Toast (TC-F05-02-09).
4. **[Phát hành xuất bản - US-10]** Xem trước toàn bộ thiết bị (Desktop, Mobile) trước khi check Pre-Publish Box. Hệ thống render live trên subdomain public trong chưa tới nửa phút mà không gặp trục trặc CDN hay lỗi SSL 503 (TC-F05-10-01). DNS đẩy Live thành công 100%. Đảm bảo User thao tác lưu mượt (Throttle 3 giây) xuyên suốt dòng đời hành trình trải nghiệm Hybrid Bot này.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes) |
|---|---|---|
| **1. Trận Địa UI/UX Coverage & UI States** | [ ] Not Run | Xác Minh Skeleton, Ngắn Mạng Không Đứt, Bảng Liệt Kê Empty Cứng Cáp Đóng Cổng Gãy Trắng Đáy. |
| **2. AI Logic & Recovery Limits** | [ ] Not Run | Đo 100% Rate Limit Bot, Tràn Token Text Dài, Mạng Tháo Socket SSE Vẫn Tinh Tế Revert Lại Mã Iframe Lõi Bền Bỉ. |
| **3. Negative Form Validation** | [ ] Not Run | Áp Lệnh Zod Ngăn Ôn Blank Space Mọi Lỗ Hổng Add Page, Chặn Vọc Tự Tiêm Mã Script Độc `<>`. |
| **4. E2E UAT Approval** | [ ] Not Run | PO Review Hành Trình Liên Tuyết Nối Thành Công, Đạt Tỷ Lệ Approved Coverage 100% Theo Kịch Bản Định Chuẩn Nhất. |
