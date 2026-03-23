# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F05 - AI Editor (Split Screen)
> **Phiên bản:** 2.0 (Professional Traceability Matrix) | **Cập nhật:** 2026-03-18 | **Thực hiện:** QA Team
> **Tài liệu tham chiếu PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md) | **Tài liệu tham chiếu User Stories (13 US):** [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md)

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng AI Editor (F05). Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho 13 User Stories và các Acceptance Criteria (ACs) đã định nghĩa tại tài liệu đặc tả.

Bộ kiểm thử bao gồm **49 kịch bản chi tiết** (bao quát luồng chính, trường hợp ngoại lệ, kiểm thử biên, bảo mật, và tương tác iframe DND). Nhằm tối ưu hóa quá trình theo dõi và thực thi, toàn bộ kịch bản được tổng hợp trong một ma trận duy nhất (Unified Matrix).

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| OS / Desktop | Windows 11, macOS |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Network | 4G (Fast/Slow), Wifi, Mạng ngắt kết nối giả lập (Offline Simulator) |
| Automation Framework | Playwright (Java) |

---

## 3. Unified Test Cases (Traceability Matrix)
_Bảng tổng hợp kịch bản kiểm thử, phân loại theo User Story nhằm đảm bảo khả năng truy vết._

| ID | Tham chiếu | LOẠI (Type) | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN (Steps) | KẾT QUẢ MONG ĐỢI (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-01: AI Editor — Split Screen Chat + Preview]** | | | | | | | |
| **TC-F05.01** | `US-01/AC1` | `UI/UX` | **[Layout]** Khởi tạo Layout 3 vùng chức năng | 1. Truy cập `/editor/:siteId` hợp lệ. | Màn hình hiển thị 3 vùng (Chat, Iframe Preview, Settings). Toolbar chứa đủ nút chức năng. | Blocker | [x] |
| **TC-F05.02** | `US-01/AC2` | `Func`  | **[SSE Chat]** Render giao diện realtime qua AI Chat | 1. Gõ Command vào AI Chat.<br>2. Nhấn Submit Enter. | Iframe update xong giao diện trong `< 3 giây` bằng luồng SSE. Hiện nút Hoàn tác ở Panel chat. | Blocker | [x] |
| **TC-F05.03** | `US-01/AC3` | `Logic` | **[Undo]** Hoàn tác (Undo) sự kiện chỉnh sửa | 1. Hoàn tất edit text/AI gen.<br>2. Nhấn Ctrl+Z hoặc nút Undo trên Toolbar. | Phục hồi (Revert) lại trạng thái State liền kề trong `< 200ms`. | High | [x] |
| **TC-F05.04** | `US-01/AC5` | `Edge`  | **[Auto-save]** Throttling Lưu Database (Debounce 3s) | 1. Gõ text phím liên tục 5s.<br>2. Ngừng tay > 3s. | Trạng thái hiển thị `Saving...` và chỉ gọi API PATCH 1 lần duy nhất sau khi ngừng gõ 3s, sau đó báo `Saved`. | High | [x] |
| **TC-F05.04b** | `US-01/AC2` | `UX`    | **[Chat Shortcuts]** Gửi lệnh AI Chat bằng phím tắt | 1. Gõ lệnh vào TextArea Chat.<br>2. Nhấn phím Enter.<br>3. Bấm Shift+Enter. | Khung chat tự động Submit lệnh đi khi nhấn Enter. Con trỏ tự động xuống dòng không Submit khi bấm Shift+Enter đúng nguyên lý UX Messenger. | High | [ ] |
| **TC-F05.04c** | `US-01/AC1` | `UI`    | **[Block Style]** Tùy chỉnh Block Settings Style trên Right Panel | 1. Click chọn 1 Block (VD: Hero).<br>2. Nhìn sang Right Panel, đổi Background Color (HEX) và Padding Top/Bottom về 40px. | Giao diện Iframe cập nhật thay đổi Layout + Màu nền ngay lập tức khớp 100% Figma Block Settings Panel. | Blocker | [ ] |
| **TC-F05.05** | `US-01/Mob` | `Mobile`| **[Responsive]** Tương thích giao diện Mobile (Độ rộng < 768px) | 1. Resize viewport xuống 375px (iPhone 14). | Iframe Preview full width 100%. Chat Panel ghim thành Bottom Sheet (swipe up để mở). | High | [ ] |
| **[US-02: Page Manager]** | | | | | | | |
| **TC-F05.06** | `US-02/AC1` | `UI/DB` | **[List]** Hiển thị màn hình Grid Cấp Page | 1. Mở Tab Pages trên thanh công cụ Sidebar. | Trả đúng danh sách trang, có cờ Trạng Thái (Live/Draft), đếm Card/Blocks, Ngày update gần nhất. | High | [x] |
| **TC-F05.07** | `US-02/AC2` | `Func`  | **[Add Page]** Thêm Trang Mới Đồng Bộ | 1. Bấm "Thêm trang mới".<br>2. Nhập Title: `Về Tổ Chức`. 3. Save | Tự động sinh `slug: ve-to-chuc`. Redirect Iframe I/O về khung trắng của Page mới. | Blocker | [x] |
| **TC-F05.08** | `US-02/AC2` | `Bound` | **[Conflict]** Khóa Khung Tạo Page Trùng Slug | 1. Tiến hành Add một page có Title lặp lại: `Về Tổ Chức`. | Báo lỗi hoặc Tự đính kèm ID hậu tố (vd: `ve-to-chuc-1`). Ép không báo sập 500 do conflict Unique Index DB. | Medium | [x] |
| **TC-F05.09** | `US-02/AC3` | `Logic` | **[Soft Delete]** Mạng Xóa Mềm 1 Trang  | 1. Click Icon Thùng Rác (Delete).<br>2. Xác Nhận Modal Xóa. | Cập nhật trường `deletedAt`. Mất DOM ở danh mục Editor. Toast báo 5s: "Đã xóa. Hoàn tác?". | High | [x] |
| **TC-F05.10** | `US-02/AC4` | `Flow`  | **[Hide Page]** Bật Tắt Tạm Ẩn Trang (Toggle Visibility) | 1. Bấm Nút Icon Con Mắt (Hide) của 1 trang. | Trang chuyển cờ `isVisible=false`. Gỡ ngay khỏi Navbar Header. Truy cập Domain live trả HTTP 404. | Blocker | [x] |
| **TC-F05.10b** | `BR-05/06` | `Bound` | **[Hide/Delete]** Ràng buộc cấm Xóa/Ẩn Trang Hệ Thống (Home, 404) | 1. Nắm trỏ vào Nút Icon Tạm Ẩn / Xóa của Trang Chủ (Home) và 404. | Nút Ẩn và Xóa bị làm mờ (Disabled). Kèm Tooltip "Không thể chỉnh sửa trạng thái trang hệ thống". Field URL Slug của 404 bị khóa cứng (Read-only) (BR-05/06). | Blocker | [ ] |
| **[US-03: Inline Click-to-Edit Element]** | | | | | | | |
| **TC-F05.11** | `US-03/AC1` | `UX`    | **[Hover]** Nút gọi ✨ Edit With AI bằng Hover | 1. Đưa trỏ chuột đậu tại Text Block tĩnh Iframe (Delay 200ms). | Hiện popup "✨ Edit with AI" nằm tọa bên trên Góc Căn lề Phải (Top-Right) DOM Block đó. | Medium | [ ] |
| **TC-F05.12** | `US-03/AC2` | `Func`  | **[Inline AI]** Gọi Tool AI thực thi Inline Edit | 1. Click nút "✨ Edit with AI".<br>2. Nhập prompt: "Làm nội dung này xúc tích hơn". | Component Text hiện tại (chỉ nó) được AI Stream nội dung mới vào. Không làm lệch Layout trang. | Blocker | [x] |
| **TC-F05.12b** | `US-03/AC2` | `UX`    | **[Close Popup & Sync]** Đóng Inline Edit Popup & Đồng bộ lịch sử chat | 1. Mở Inline Edit Popup.<br>2. Nhấn Escape (Esc) hoặc Click Outline.<br>3. Sau đó sinh AI content mới và soi Chat Panel Left. | Bảng Pop-over Edit tắt lặn ngay. Dòng log thay đổi AI sinh Inline hiển thị lưu vết đẩy đủ bên cột AI Chat Panel bên trái cho User theo dõi. | Medium | [ ] |
| **[US-04: Add New Section via AI]** | | | | | | | |
| **TC-F05.13** | `US-04/AC1` | `AI Logic`| **[Add Block]** Gọi thêm Fragment Component mới Qua Lệnh AI | 1. Quăng lệnh chat: "Thêm 1 section Testimonials có 3 đánh giá". | 1 khối Component `Testimonials` tự động gắn nhúng (Append) xuống dưới cùng trang Iframe kèm Mock Data 3 bài Text. | High | [x] |
| **[US-05: Drag-and-Drop Block Reorder in Editor]** | | | | | | | |
| **TC-F05.14** | `US-05/AC1` | `DND`   | **[Sort]** Thao tác kéo thả Reorder Swap Vị Trí | 1. Bắt lấy Hand-Grip (⠿) của Block P.<br>2. Kéo đè đè Lên trên Block Q. | Iframe Cập Nhật thứ tự DOM Render Phóng Tức Thì. Đã Push trạng thái Lên List Action Mảng của History Redo Stack. | Blocker | [ ] |
| **TC-F05.15** | `US-05/AC2` | `Logic` | **[Undo DND]** Hoàn tác (Undo) tác vụ Reorder | 1. Sau khi thả Block thành công ở TC_F05.14.<br>2. Nhấn Undo. | Component trả ngược về index tọa độ ban đầu hoàn hảo. | High | [x] |
| **TC-F05.15b** | `US-05/AC4` | `AI Logic`| **[AI Undo Swap]** Đảo ngược Reorder bằng lệnh Chat AI | 1. Vừa thực hiện Drag & Drop xong.<br>2. Gõ khung chat: "Hoàn tác lại vị trí cũ". | LLM hiểu mảng Object Action cuối, bắn Command Revert đổi Sort Order Component. Iframe render y vị trí cũ. | High | [ ] |
| **[US-06: Manual Visual Editing (WYSIWYG Text & Image)]** | | | | | | | |
| **TC-F05.16** | `US-06/AC1` | `Func`  | **[WYSIWYG]** Sửa Text trực tiếp (ContentEditable) | 1. Double Click Trực Diện 1 Node Đoạn Text (Heading/P).<br>2. Chọn In Đậm (Bold) từ Float Toolbar. 3. Blur khỏi box. | Box Text kích `contentEditable="true"`. Tự lưu thay đổi API PATCH DB (Sau 3 giây Blur Debounce). | High | [x] |
| **TC-F05.16b** | `US-06/AC1` | `UX`    | **[Floating Toolbar]** Ứng dụng Format qua Text Toolbar | 1. Bôi đen (Highlight) một khúc text tĩnh Iframe.<br>2. Ở thanh Float Toolbar nhô lên -> Bấm Bold, Italic, Canh Giữa, Underline. | Dòng bôi đen bắt tag `<b>, <i>, <u>, text-center` chuẩn DOM React không nảy vỡ viền. Inline style apply chính xác. | High | [ ] |
| **TC-F05.17** | `US-06/AC1` | `Neg`   | **[Empty Box]** Xóa Text Block WYSIWYG Về Null | 1. Đưa Text Editor Node Node Căn Về rỗng "". 2. Tiết Click Blur Đi Ngõ Khác. | DOM Block Không Đứt Chân Layout Sập Trang. Tự Bám Placeholder Lại Hiển Trạng Thái: `Type your text here`. | Medium | [x] |
| **TC-F05.18** | `US-06/AC2` | `Bound` | **[Upload Img]** Auto Compress Image kích thước Siêu Dày (> 2MB) | 1. Tại Component Ảnh, ấn Thay Ảnh (Replace).<br>2. Vứt File Cỡ Bự JPEG Raw độ phân giải 10MB lên mạng. | Frontend ép Shrink Tự Nén Tệp Giảm Payload Nhỏ < 2MB Scale Khung (Object-Fit) Trước Lúc Dispatch Cho BackEnd Lưu Core Tránh Vỡ Render UI Mạng Yếu. | Blocker | [x] |
| **[US-07: Global Header & Footer Management]** | | | | | | | |
| **TC-F05.19** | `US-07/AC1` | `Func`  | **[Menu Tree]** Chỉnh Lên Menu Đa Cấp Tree (Nested Submenu) | 1. Focus Menu Header Element Tại Panel Settings.<br>2. Bổ Sub-menu Kéo Thụt Vào (Drag Item Con) 1 Menu Khác. | Dữ Liệu Apply Phóng Rộng Xuất Tràn Toàn Bô Các Trang (Global). Rê chuột Menu Frontend Iframe Nhả Lệnh Rơi Dropdown. | High | [ ] |
| **TC-F05.20** | `US-07/AC2` | `Logic` | **[Logo Gen]** Tự Auto-Scale Logo & Trích Icon Favicon | 1. Component Click Header Nhấn Logo Upload 1 File Format Lớn Tỉ Lệ 1K. | AI Tính Toán Tự Fix Limit Scale Yếu Mức `max-height 60px` Ổn Phân Vùng Lõi. Code Tự Xuất Cắt Extract Base Lọt Vào Tag `<link rel="icon">` Header HTML. | High | [x] |
| **[US-08: Drag-and-Drop Component Library]** | | | | | | | |
| **TC-F05.21** | `US-08/AC1` | `UI`    | **[Library]** Mở Sidebar Component Library Bảng | 1. Chạy Nút Tab Menu Mở Kho Components Bên Trái Cột Nhánh. | Hiển thị Node List Phân Quần Khối: Base, Tĩnh Sản Phẩm (Ecommerce), Nội Phẩm (Bài Viết), Form Phản Hồi. | Medium | [ ] |
| **TC-F05.22** | `US-08/AC2` | `DND`   | **[Drag Block]** Gọi Block Rút Thể Thả Từ Menu Rơi Sang Layout | 1. Chuột Dẫn Cục Icon Block "Product List".<br>2. Thả Cắm Giữa Trục 2 Section Trên Cầu Iframe Màn Giữa. | Báo Trục Ngang Xanh Indicator Drop. Iframe Vững Layout Mở Đoạn Code Mockup Block Giao Thật Gắn Kết Form Mobile Tốt Đậm Kích Thước Chuyển Chỉnh. | Blocker | [ ] |
| **TC-F05.22b** | `US-08/Mob` | `Mobile`| **[Tap to Add]** Thay thế Drag & Drop bằng Chạm (Tap) trên Mobile | 1. Ở Viewport < 768px, mở Component Library.<br>2. Chạm 1 lần (Tap) vào "Product List". | Vô hiệu hóa hệ thống Kéo Thả (Drag). Thẻ Unit Component tự động chèn thẳng xuống Đáy Iframe và trình duyệt Cuộn tới mượt mà (FR-30). | High | [ ] |
| **[US-09: Tùy chỉnh Trang 404 (404 Not Found Page)]** | | | | | | | |
| **TC-F05.23** | `US-09/AC1` | `Func`  | **[Edit 404]** Edit Cấu Tạo Render Thẳng Trang 404 Cơ Bản Hệ Thống | 1. Page Cột Quản Lý Tìm Kiếm Gọi Màn Hệ Thống Trang Mặc Định "404 Not Found".<br>2. Đánh Sửa Đoạn Header Text Bằng Lệnh WYSIWYG Hoặc Gọi AI Đổi Nền. | URL Route Sai Truy Xuất Ra Bản Thể Này Ngoài Đời Mang Đúng Kèm Code Status Trả HTTP Res. Không Chạm Lệnh 500 Nằm Iframe. | High | [x] |
| **[US-10: Publish & Unpublish Flow (Live & Maintenance)]** | | | | | | | |
| **TC-F05.24** | `US-10/AC1` | `Flow`  | **[Publish]** Thực Thi Publish Đẩy Code Deploy Phân Mạch Subdomain | 1. Nhấn Nút "Publish" Ở Cửa Top Toolbar.<br>2. Modal Check Form Pre-Publish Liệt Rành List Route Nhấn Xác Nhận. | Trịnh System Trả Dòng Tín Subdomain Gán DNS Lực Mạng Đáo Rớt `<30 giây`. Cắm Nháy Xanh Biếc Hiện Badge `Live`. Iframe Đưa Link HTTP Test Chuẩn Domain. | Blocker | [x] |
| **TC-F05.24b** | `US-10/AC2` | `Flow`  | **[Re-Publish]** Publish lại bản Web đang Live (Update Changes) | 1. Edit lại trang đang gắn mác Live.<br>2. Bấm Publish lần 2. | Render nội dung cấp cập nhật trên Web Live trong `<30 giây`. Server kích hoạt Cronjob tự động Re-generate Sitemap cấu trúc mới URL. | High | [ ] |
| **TC-F05.25** | `US-10/AC3` | `Flow`  | **[Unpublish]** Ấn Bật Sập Khung Chế Độ Tĩnh Bảo Trì (Maintenance) | 1. Editor Tương Đốc Ấn Set `Unpublish`.<br>2. Bật Tab Gắn Ngoài Truy Lệnh URL Mạng Site User Khác. | Dịch Route API Load HTML Không Render Data Trang Khách Mà Đả Mã `503 Service Unavailable`, UI Hiển Thị Warning Code "Bảo Trì". Admin Tác Chủ Nhánh Vẫn Dựng Web Trong Iframe Đều Tính Thường Quy. | High | [x] |
| **[US-11: Interactive Widgets (Cart & Social Media)]** | | | | | | | |
| **TC-F05.26** | `US-11/AC1` | `Func`  | **[Social UX]** Gắn Widget Nút Social Media Đích Link MXH | 1. Thả Gắn Button Social Lên Header Cắm Layout.<br>2. Phục Box Gõ Form URL Target `Facebook` | Phân Mạch Public View Truy Cập Gắn Target Click Móc Dấu Bảy Rút Icon Dính Mở Tác Tab Mới Tính Năng (`_blank` HTML), Render Đúng Lõi Href Đi. | Priority | [x] |
| **TC-F05.27** | `US-11/AC2` | `Logic` | **[Cart UI]** Giao Hành Component Phục Giỏ Hàng & Fallback Checkout | 1. Thả Nút Giỏ Hàng Lên Khung Cột Layout.<br>2. Bấm Nút Thanh toán (Checkout/Mua Hàng) Trên Iframe. | Các Cửa Popover Số Đếm Counter Xuất Huyện Đều. Chặn Cấm Nháy Nút Checkout Sinh 404 Báo Toast: "Tính năng Checkout đang được phát triển" (Ngăn Prevent Default) (BR-08). | High | [x] |
| **[US-12: Global Business Info & Settings Panel]** | | | | | | | |
| **TC-F05.27b** | `US-12/AC1` | `UX/UI` | **[Open Settings]** Bật Navigation/Global Panel tự động | 1. Click phím trái hụt ra Outline Trắng rào Iframe (Un-focus Text) Lập Tức Chờ. | Sidebar phải (Right Panel 320px) Chuyển Ngữ Cảnh Qua "GLOBAL SITE SETTINGS" có Brand, Contact, Social, SEO accordion. | High | [ ] |
| **TC-F05.28** | `US-12/AC2` | `DB`    | **[Data Bind]** Data Bound Phân Tức Real-time Render Thông Tin Doanh Nghiệp | 1. Nhập Mã Phone Định Lệnh Dấu Hotline: `0909000` (Settings Panel Dọc). | Mạng Node Trục Dữ Liệu Footer Iframe (Nếu Đang Bám Rào Cú Binding Số ĐT) Đổi Form Kíp Lập Tức Dạng Nguồn. | High | [x] |
| **TC-F05.28b** | `US-12/AC3` | `DB`    | **[Global SEO]** Lưu Thiết Lập SEO Dùng Chung Toàn Hệ Page | 1. Gõ Meta Title Tổng (Bio) và Tải Thumbnail OG:Image Lên Box Global SEO Setting. | Code Source Iframe Cấy Metadata SEO Cứng Vào Mạch Root `<head>` Phủ Gốc Cho Web Bật Toàn Cục SEO Thể Chuẩn. | High | [ ] |
| **[US-13: Page-Level SEO & AI Optimization]** | | | | | | | |
| **TC-F05.29** | `US-13/AC1` | `Func`  | **[Manual SEO]** Tùy Biến Chỉ Số SEO Cho Từng Mảnh Page (Page-level) | 1. Chuyển Panel Nhánh Route `/about`. Mở Tab "PAGE SEO SETTINGS".<br>2. Nhập tay `URL Slug`, `Meta Title`, `Description`. | Google Preview Snippet Card giả lập Khởi Kết Quả Search Thay Cập Nhật Chữ Viền Khung URL. Slug URL Tự Ngậm Đổi DB Router. | Priority | [ ] |
| **TC-F05.29b** | `US-13/AC2` | `AI Logic`| **[Auto SEO]** Dùng Prompt API Quét Chữ Auto-Gen Meta Dịch Data SEO | 1. Nút Form Trọng Trang Phục Target Nhấn Cấp "✨ Tự Động Tối Ưu SEO Cây SEO". | LLM Khảo Dữ Lưới Văn Bản Căn Kéo Box Text Render Tác Iframe. Viền Mã Dữ Form Meta Title / Desc Code Ngọt Ráp Khớp Bỏ Khung Schema Tự Sinh Form Code Không Quá Mạch Nghĩa. | High | [x] |
| **TC-F05.30** | `US-13/AC2` | `Bound` | **[Truncate SEO]** Chặn Boundary Giới Lệnh Text Khảo Tràn Form SEO Max | 1. Tool Mock Nhái API Rớt Response LLM Giả 300 Chữ Text Băng Dày. | HTML Phản Hồi Chặn Schema Chém Thẳng Tag Cữ Khúc `< 60 chars` Code Title. Không Rào Dấu Nhồi Bể Quá Frame Code HTML Văng SQL Lỗi Box Ngàm Bảng. | Medium | [x] |
| **[Non-Functional: Bảo Mật, SLA & Kiểm Soát Lệch Lệnh API]** | | | | | | | |
| **TC-F05.31** | `Negative`| `Limit`   | **[Undo Stack]** Rào Tràn Bộ Nhớ Stack Rút Cáo Trạng > 50 Nút State Kéo RAM | 1. Bấm Click Thực Chạy Dịch Khối Edit Rộng 60 Lần Hạch Liên Tiếp.<br>2. Gõ Code Yêu Cầu Undo Trình Hoàn Liên Nháy Quá Đích 55 Cú Rollback. | List Dựng Kích Quản Giới Rút Threshold Phá Rào Tối Đa `50 Vòng Quay Undo`. Khóa Bấm Disable Xám Cứng Để Cáp RAM Chrome Browser Mạng Không Trọng Báo Khóa Bug Bể Rớt RAM Kích Kém Nhằm DOM Iframe Giữ Chắc. | Blocker | [x] |
| **TC-F05.32** | `Edge`    | `Logic`   | **[Concurrency]** Bắt Nhịp Tắt Concurrency Ráp AI SSE Stream & Tác Lệnh Bấm Undo Trái Nhanh Chống Sập DOM | 1. Trào Mạng Phóng Stream Lõi HTML Đang Rớt. Kích Liền Tool Nhấn Hoàn Tác (Undo). | Nút Icon Hoàn Tác Cầm Disabled Block Ác Xám Mã Quá Quá Trình Stream Đoạn Lệnh SSE Khéo 3s Đáy Mốc Rút Để Cáp Trái Giới Trình Re-flow Render Render Dép Corrupted Markup Vỡ Web Page Hoàn Toàn Xó Cũ. | Blocker | [x] |
| **TC-F05.33** | `Negative`| `Sec/XSS` | **[Prompt XSS]** Bóc Token Trạm Bắn Bypass JavaScript Malicious Code XSS Trong Bảng Bot AI Dẫn | 1. Nạp Script Thẳng Móc Lệnh Dịch `<script>alert('hack')</script>` Khung Chat. | Không Dính Mã Hack. React Bóc Dom Render Thành Dải Encode Bão Hạn Trơ Chuỗi Text Tĩnh HTML Chữ. Giữ Báo Vành Backend Middleware Vượt. | Blocker | [x] |
| **TC-F05.34** | `Edge`    | `Network` | **[Stream Drop]** Ngắt kết nối mạng (Offline) đột ngột khi AI đang Stream dữ liệu dang dở | 1. Nhập lệnh AI Chat đổi nền.<br>2. Cắt mạng Wifi/LAN khi tiến trình SSE chạy được 50%. | Iframe không hiển thị mã HTML vỡ lở (Corrupted). Báo lỗi "Mất kết nối", khôi phục Iframe về mốc Undo gần nhất khi có mạng lại. | Blocker | [ ] |
| **TC-F05.35** | `Neg`     | `WYSIWYG` | **[Paste Dirty]** Dán (Paste) Rich Text rác từ MS Word chứa Style, Script ngầm | 1. Copy đoạn text dài từ Word rác.<br>2. Paste (Ctrl+V) thẳng vào Text Block đang Edit WYSIWYG. | Frontend phải kích hoạt DOMPurify tự động lọc sạch các thẻ `<style>`, `<script>`, class rác, chỉ giữ plaintext hoặc cấu trúc HTML Allow-list. | High | [x] |
| **TC-F05.36** | `Edge`    | `Logic`   | **[Multi-tab]** Mở Editor Iframe song song trên 2 Tab Browser cùng 1 Website | 1. Mở Editor ở Tab A và Tab B.<br>2. Sửa ở Tab A chờ Auto-save.<br>3. Sửa nghịch lại ở Tab B. | Tab B gọi API PATCH trả về HTTP 409 Conflict (Mismatched Version). Cấm lưu cờ bạc, bật bảng cảnh báo bắt người dùng Refresh lấy data mới. | Blocker | [x] |
| **TC-F05.37** | `Neg`     | `UI`      | **[Drag Ghosting]** Rê (Drag) Component Library và vứt thả ra ngoài cửa sổ Browser OS | 1. Nắm Handgrip Block Product.<br>2. Kéo văng chuột ra khỏi mép Window Desktop rồi thả nhả tay. | Con trỏ Ghost Element tự hủy, không bị kẹt dính chết cứng trên con trỏ chuột. UI Iframe trả Layout về nguyên trạng ban đầu an toàn. | Medium | [ ] |
| **TC-F05.38** | `Neg`     | `Sec/SVG` | **[SVG Inject]** Upload giả dạng ảnh SVG nhúng chứa mã lệnh độc hại XML | 1. Lấy file logo `.svg` chèn script XSS Header.<br>2. Thay Image qua form tải lên Upload. | Backend Reject file hoặc tự động Sanitize xóa mã lớp SVG XML nguy hiểm. Output Iframe View File ảnh không kích hoạt Script ăn cắp Cookie Browser. | Blocker | [x] |
| **TC-F05.39** | `Neg`     | `Logic`   | **[Cart No F10]** Thả Widget Giỏ Hàng khi Tenant chưa mua gói cài Module Cửa Hàng | 1. Gắp khối Giỏ Hàng vào UI khi Site Doanh Nghiệp User này chưa thiết lập Commerce. | Render UI giỏ hàng nhưng khi test Click sẽ hiện Popup Toast "Vui lòng kích hoạt tính năng Cửa Hàng ở Dashboard", không gọi API lỗi HTTP 500 chập chờn. | High | [ ] |
| **TC-F05.40** | `Edge`    | `Race`    | **[Race Condition]** Bấm vội nút Publish và đè tiếp nút Unpublish liên hoàn trong 1 giây | 1. Bấm nút Publish Trên Toolbar (Cờ đang Load).<br>2. Cú hích bấm lách Unpublish trước cả khi Domain trỏ xong. | Nút Publish Clicked => Đóng băng Block khóa giao diện nút Unpublish bằng Disabled Lock để ép không phát Race Condition trên máy chủ DNS/Cloudflare. | Blocker | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của Cửa hàng Bán lẻ (SME Owner)._

**Kịch bản E2E:** 
1. **[Bơm dữ liệu mồi - US-01]** Truy cập trình Builder Editor với Site ID mới. Thực hiện chat thử lệnh thay đổi nền website sang màu đậm. API streaming trả về layout trong thời gian chưa đến 3 giây mà không làm sập giao diện preview (TC-F05.02).
2. **[Hiệu đính thủ công - US-05, US-06, US-08]** Người dùng tiếp tục tương tác kéo thả component như Giỏ hàng hoặc Form Contact từ danh mục (Library) sang Iframe. Layout không bị xô lệch trên di động. Sửa nhanh 1 dòng chữ bằng cách Double-Click WYSIWYG và Upload Logo mới hệ thống tự sinh Favicon đẹp chuẩn (TC-F05.20).
3. **[Quản lý rẽ nhánh - US-02]** Thêm 1 trang hoàn toàn mới "Khuyến Mãi" bằng Page Manager. Cấu trúc link tự động render và đẩy menu header cập nhật realtime lên toàn bộ 2 trang. Thao tác xóa mượt mà với tính năng Undo Toast (TC-F05.09).
4. **[Phát hành xuất bản - US-10]** Xem trước toàn bộ thiết bị (Desktop, Mobile) trước khi check Pre-Publish Box. Hệ thống render live trên subdomain public trong chưa tới nửa phút mà không gặp trục trặc CDN hay lỗi SSL 503 (TC-F05.24). DNS đẩy Live thành công 100%. Đảm bảo User thao tác lưu mượt (Throttle 3 giây) xuyên suốt dòng đời hành trình trải nghiệm Hybrid Bot này (TC-F05.04).

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Not Run | Thực thi kiểm định đa kích thước màn hình & tương thích Layout Component Drag And Drop trên DOM Iframe Sandboxed. |
| **2. AI Logic & Functions** | [ ] Not Run | Xác minh các tác vụ Stream SSE và Render Hoàn tác State Management Zustand thông qua Automation Test Script Playwright. |
| **3. Security & DB Validation** | [ ] Not Run | Kiểm duyệt cơ chế Auto-Save không gây Overload DB, Sandbox Protocol ngăn chặn Script Cross-frame Inject. |
| **4. Performance SLA** | [ ] Not Run | Đánh giá Render DOM và phản hồi Network < 3s cho từng tương tác cập nhật Web tĩnh, 30s cho Submit Live DNS Web Route Publish Gateway Server Network Lực Mạng Kéo Chuẩn Nhanh Chống Sập Lag. |
| **5. E2E UAT Approval** | [ ] Not Run | BA và PM Review kịch bản UAT User Story Journey, phê duyệt độ hoàn thiện mức 9/10 User-Satisfaction Metric cho Launch. |
