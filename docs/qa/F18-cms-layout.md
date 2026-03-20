# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F18 - CMS Core Layout & Navigation
> **Phiên bản:** 2.2 (25-Case Cập nhật AC Mới BA-QC-Design) | **Cập nhật:** 2026-03-20 | **Thực hiện:** QA Team (Antigravity QC)
> **Nguồn Tham chiếu:** PRD (`F18-cms-layout.md`), User Stories (3 US chính)
> **Kỹ năng ứng dụng (.agent):** UI/UX Boundary Check, Mobile Touch Validation, i18n Localization Testing, Performance SLA Metrics.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này xây dựng lưới kiểm thử bao phủ toàn diện 100% logic giao diện cốt lõi của **CMS Layout (F18)**. Bao gồm 3 phân hệ chính: Top Header cố định, Side Menu linh hoạt theo kích thước màn hình, và Main Content Area có khả năng scroll độc lập.

Bộ test đặc biệt nhấn mạnh vào **trải nghiệm Mobile (Hamburger Drawer)** và tính năng **Đa ngôn ngữ (BM/EN)** qua Avatar Dropdown nhằm phục vụ sát sao đối tượng SME/Dropshipper tại thị trường Malaysia.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Safari iOS, Firefox |
| Devices (Responsive) | Desktop (1920x1080), Tablet iPad (768px), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | Mạng chậm (Fast 3G), Touch padding 44px, Điểm Lighthouse Mobile > 90 |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F18-01: CMS Global Sidebar Navigation] - Trình Đơn Bên Trái** |
| **TC-F18.01** | `AC-1` | `UI` | **[Positive]** Giao diện Sidebar mặc định trên Desktop | **1.** Đăng nhập CMS trên Desktop (Màn >1024px). | **THEN** Sidebar mở rộng (Expanded).<br>Các item hiển thị đủ Icon + Text (Ví dụ: 📦 Products). Active state tô sáng nền. | Blocker | [x] |
| **TC-F18.02** | `AC-2` | `Mobile`| **[Positive]** Thu gọn Sidebar & Nút Hamburger Mobile | **1.** Chuyển sang View Mobile (375px).<br>**2.** Nhìn góc trái Header. | Sidebar tự động ẩn. Chỉ còn Nút Hamburger `☰` trên Top Header. Khung content tràn 100% width. | Blocker | [ ] |
| **TC-F18.03** | `AC-2` | `Interact`| **[Positive]** Cử chỉ Kéo mở Slide-in Drawer Mobile | **1.** Ở View Mobile, click nút Hamburger `☰`. | **WHEN** Click **THEN** Sidebar trượt mượt mà từ trái sang, phủ lấp có Overlay mờ, z-index cao hơn Content. | High | [ ] |
| **TC-F18.04** | `UX`   | `Layout`| **[Negative]** Click Outside Đóng Drawer Mobile | **1.** Mở Sidebar Drawer trên Mobile.<br>**2.** Click chuột/Chạm ngón tay ra vùng Overlay xám bên ngoài. | Hook ClickOutside bắt được sự kiện. Drawer tự động slide-out đóng lại mượt mà, trả lại không gian Main Content. | High | [ ] |
| **TC-F18.23** | `AC-4` | `Interact`| **[Positive]** Vuốt (Swipe Left) để đóng Drawer Mobile | **1.** Mở Sidebar Drawer trên thiết bị cảm ứng.<br>**2.** Vuốt nhanh tay từ vùng phải sang trái. | **THEN** Drawer bắt event Swipe và nương theo lực vuốt để trượt đóng lại dứt khoát. | High | [ ] |
| **TC-F18.24** | `AC-4` | `Route` | **[Positive]** Đóng Drawer tự động khi click Leaf Link | **1.** Mở Drawer trên Mobile.<br>**2.** Click vào link "Products". | **THEN** Nền tải nội dung Products.<br>**AND** Drawer tự động đóng lại để trả không gian cho user xem ruột nhanh nhất. | High | [ ] |
| **TC-F18.05** | `AC-3` | `Logic` | **[Positive]** Điều hướng Help Center Nút Cuối | **1.** Cuộn xuống cuối cùng Sidebar.<br>**2.** Click "Help Center". | Route chuyển hướng nội bộ CMS sang `/help` (Module F20). Active state nhảy sang Help Center, Main Content tải màn hỗ trợ. | Medium | [ ] |
| **TC-F18.06** | `UX`   | `Access`| **[Positive]** Kích thước vùng chạm (Touch Area 44px) | **1.** Dùng devtools soi padding/margin các nút trong Sidebar trên Mobile. | Element có clickable area tối thiểu `44x44px` (Fat-finger friendly) chống việc bấm nhầm trên màn hình nhỏ. | Medium | [ ] |
| **TC-F18.21** | `UI`   | `Menu`  | **[Positive]** Mở rộng Sub-menu Accordion | **1.** Click vào mục "My Webstore" (có icon mũi tên). | **THEN** Menu con xổ xuống (Slide down) hiển thị "Editor" và "Blog". Mũi tên đổi hướng xoay góc. | High | [ ] |
| **TC-F18.22** | `UI`   | `Inte`  | **[Positive]** Badge Đếm Số Lượng Trên Sidebar | **1.** Nhìn vào menu "Orders". Cấp API có 5 đơn chờ. | Cạnh chữ "Orders" hiển thị cục Badge nổi màu Xanh lục mang số `5`. | Medium | [ ] |
| **[US-F18-02: CMS Global Top Header] - Thanh Công Cụ Trên Cùng** |
| **TC-F18.07** | `AC-1` | `Func` | **[Positive]** Chức năng Quay Về Trang Chủ (Logo Routing) | **1.** Đang đứng ở trang `/products/123`.<br>**2.** Click Logo PrimeWeb ở Header. | Trình duyệt gọi Route nhảy tuột về trang `/dashboard`. Component React không reload toàn trang, đổi ruột cực nhanh. | High | [x] |
| **TC-F18.08** | `AC-2` | `Integrate`| **[Positive]** Hiển thị Bell Notification & Red Badge | **1.** Inject data Notification chưa đọc.<br>**2.** Kiểm tra góc phải Header. | Icon Bell rung chuông, gắn Badge Đỏ (Eg: `3`). Khi Click vào, thả xuống Dropdown thông báo F16 (Z-index cao nhất). | High | [ ] |
| **TC-F18.09** | `AC-4` | `UI` | **[Positive]** Dropdown Menu của Avatar User | **1.** Click vào hình Avatar User góc phải Header. | Xổ xuống Menu nổi chứa 2 item chính: `Profile` và Nút `Logout` màu đỏ (Không chứa phần đổi ngôn ngữ). | Blocker | [ ] |
| **TC-F18.10** | `BR-03`| `i18n` | **[Positive]** Toggle Đổi Ngôn Ngữ Nơi Đáy Sidebar (MY/EN) | **1.** Cuộn xuống đáy Sidebar (trên nút Logout).<br>**2.** Bấm chuyển đổi nút Switch (MY / EN) sang `EN`. | **THEN** Giao diện Sidebar/Header Reload ngôn ngữ tương ứng.<br>State lưu chặt, Highlight màu Xanh/Trắng cho nút Active. | Blocker | [x] |
| **TC-F18.11** | `UX`   | `SLA`  | **[Negative]** Chặn Click Xuyên Lủng Layer Dropdown | **1.** Mở Avatar Dropdown thả dọc xuống.<br>**2.** Bên dưới Background có dòng chữ Title của Main Content. Thử click đè lên chữ. | Overlay trong suốt che cú click, Menu Popover tự động đóng khép lại, không kích hoạt Link lầm cọc dưới nền. | High | [ ] |
| **[US-F18-03: Main Content Area Display] - Không Gian Nội Dung Chính** |
| **TC-F18.12** | `AC-1` | `Layout`| **[Positive]** Bố cục Độc Lập Scrolling (Independent Scroll) | **1.** Mở trang Products có 100 sản phẩm.<br>**2.** Cuộn thanh Scroll dọc xuống giữa trang. | **EXPECTED** Sidebar TRÁI và Header TRÊN vẫn Đứng Im (Fixed/Sticky). Chỉ có thẻ `<main>` bị lăn cuộn. | Blocker | [x] |
| **TC-F18.13** | `UX`   | `Route` | **[Positive]** Khôi phục Vị Trí Cuộn (Reset Scroll Top) | **1.** Kéo xuống cuối trang màn Products.<br>**2.** Click sang menu Orders. | Tại màn Orders mới load, Trục Scroll Bar Tự Động Rút Lên Đỉnh Y=0. Không bị kẹt ở đáy. | High | [ ] |
| **TC-F18.14** | `AC-3` | `State` | **[Positive]** Trạng thái Rỗng (Empty State) & Layout Vững Chắc | **1.** Xóa sạch DB để trang `/blog` rỗng không.<br>**2.** F5 Web. | Lòng Main Content sinh component Empty (Vector ảnh, "Chưa có bài viết nào"). Không làm phình to hay bóp xéo tỷ lệ Header/Sidebar. Layout vững như thạch. | Medium | [ ] |
| **TC-F18.15** | `SLA`  | `Perf` | **[Negative]** Render Performance Ngưỡng Dưới 1 giây | **1.** Reload trang F5 toàn khung CMS Layout. | Lớp Vỏ CMS (Shell) App Shell bật lên ngay lập tức dưới 100ms. Tiến trình Fetch Data Modules chạy Async không Block Màn Header. | Medium | [x] |
| **TC-F18.25** | `AC-4` | `UI`   | **[Positive]** Kích hoạt Global Loading Transition Bar | **1.** Click mở một module nặng.<br>**2.** Quan sát thanh Top Header lập tức. | Xuất hiện thanh progress loading bar `2px` trôi ngang mép dưới Header. Load xong đạt 100% tự động biến mất. | High | [ ] |
| **[MISSING ACs PHÁT HIỆN TỪ PRD - CẬP NHẬT BỞI AI QC AGENT]** |
| **TC-F18.16** | `QC-AI`| `Tablet` | **[Boundary]** Chế độ Mini-Sidebar (Collapsed Mode) trên Tablet | **1.** Kéo Window size xuống mức mốc `768px - 1024px`. | **THEN** Sidebar KHÔNG ẩn mất (như Mobile) cũng KHÔNG mở rộng (như Desktop) mà co thành cột hẹp (Width 60px) chỉ hiện Icon. Tooltip bật ra khi Hover. | Blocker | [ ] |
| **TC-F18.17** | `i18n` | `Layout` | **[Boundary]** Vỡ Khung Do Độ Dài Ký Tự Bahasa Melayu Khi Đổi Ngôn Ngữ | **1.** Switch Language qua Mã Lai.<br>**2.** Chờ Sidebar text re-render. | Chữ tiếng Mã Lai thường dài hơn 30-40% so với tiếng Anh. **EXPECTED:** Element tự động thu gọt `Text Overflow: Ellipsis...` không đội Width của Sidebar để Main Content bị lép. | High | [ ] |
| **TC-F18.18** | `Sec`  | `Header` | **[Negative]** XSS Injection vào Vùng Cảnh Báo Avatar Name | **1.** Cho User tên là dài có bọc `<script>alert('idor')</script>`. | **EXPECTED** Khung Avatar Header Ráp Hàm Sanitize Html Cắt Mã Nóng Độc Quyền, Chỉ Hiện Nguyên Bản Chữ PlainText. Thắt Nút Sập DOM CMS. | Blocker | [x] |
| **TC-F18.19** | `Perf` | `Load`   | **[Negative]** Giới hạn Bơm Nhồi DOM (Sidebar React Rerender Load Testing) | **1.** Run Script k6 bắn Click liên thanh vào 5 Sidebar Menu Items (200 clicks/min). | Khung Giao Diện Được Sử Dụng `React.memo` Và Không Bị Bào Lấy RAM, Khóa Bug Lỏng State Gây Unmount Component Con Layout Áp Đảo Trình Duyệt. Trả mượt Web Vitals. | High | [ ] |
| **TC-F18.20** | `UX`   | `A11y`   | **[Positive]** Phóng To Giao Diện Lên Cỡ Đại (Zoom 200%) | **1.** Nhấn `Ctrl +` zoom 200%. Tắt Thu Phóng. | Dính Khớp Cấp Khống UI Accessbility Màn WCAG Lõi: Không Vỡ Tràn Header Box, Cột Chữ Sidebar Chữ Mèo Co Túm Nhưng Quả Nút Kế Đăng Xuất Vẫn Hiện Dễ Thấy. | Medium | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End Thực Tế (E2E UAT Flow)
_Đánh giá hệ thống dựa trên thói quen điều hướng của tập Người Kinh Doanh (SME/Dropshipper)._

| Mã UAT | Bài toán Kinh tế (User Persona) | Hành trình thao tác (E2E Steps) | Nút thắt cần Verify (Critical Checkpoints) |
|---|---|---|---|
| **UAT-01** | **Chủ SME Truyền Thống (Desktop user)**<br>Thường xuyên thao tác quản trị trên Laptop. Có nhu cầu đọc Báo cáo, xem Đơn, tạo Sản phẩm luân phiên liên tục. | 1. Ngồi Dashboard xem biểu đồ (Main cuộn).<br>2. Liếc mắt thấy Chuông rung Đỏ.<br>3. Mở Chuông xem Đơn Hàng mới.<br>4. Lập tức click Sidebar qua kho `Orders` xử lý. | - Scroll main document mượt mà, Sidebar đứng im không bị rung.<br>- Click Sidebar qua tab mới phải chớp nháy dưới 500ms (Client-side routing). Trạng thái Menu đổi màu Active đúng chỗ. |
| **UAT-02** | **KOC/Dropshipper (Mobile User)**<br>Di chuyển liên tục, check luồng chạy đơn bằng Điện thoại màn hình dọc 375px. Thích ngôn ngữ Tiếng Anh. | 1. Mở web bằng iPhone Safari.<br>2. Màn hình đập vào mặt là Content. Header có ☰.<br>3. Chạm ☰ vuốt khay Menu ra.<br>4. Chạm Avatar đổi ngôn ngữ, vuốt xuống đáy click `Help Center`. | - Drawer Menu Sidebar trượt mượt mà (Không bị lag CSS frame).<br>- Padding Touch Area trên Avatar và Link Menu > 44px vuông chuẩn mập ngón tay không bấm trượt.<br>- Đổi EN/BM không bị reflow bóp méo khung Flexbox. |

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules .Agent Trích Chọn) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Đã chạy 0/9 TC | Focus kỹ Form Grid, Z-Index Drawer Mobile, Widget Tablet, Touch Target >44px. Cấp `A11y` Zoom UI. |
| **2. Logic Routing** | [ ] Đã chạy 0/3 TC | Logo Redirect, Side Menu Active Highlight state không kẹt màu. |
| **3. Integration API** | [ ] Đã chạy 0/2 TC | Chuỗi Component Avatar + Data F16 Component Bell Dropdown Lấy Thông Chống Đứt Socket. |
| **4. Performance SLA** | [ ] Not Run | CMS App Shell Chạy Lighthouse Cắm Mốc Chắc Chắn 90 Điểm, Lỗi CLS <= 0.1 (`performance-test-engineer` k6 Stress) |
| **5. E2E UAT Approval** | [ ] Not Run | Kéo Auto Test Đánh Playwright Flow UAT-02 Mobile Drawer Đổ Ra Xác Định Xanh Toàn Tuyến Mạch (`bdd-cucumber-expert` Gherkin) |
| **6. Security Gate** | [ ] Not Run | Dò quét XSS Profile Input, Lỗi Avatar Header Ràng Khuôn Code. (`qc-ai-engineer` CISA Rules) |

> **Khuyến Nghị Release:** Đây là Root Layout ốp toàn bộ Site. Các Bug P0 liên quan đến z-index đè Form Module bên trong Content Area (Ex: Z-index Drawer Sidebar Mobile phải bọc cẩn thận). Bắt buộc Pass 100% case Cảm Ứng Smartphone trước khi Merge Nhánh Dưới. Trang Shell Không Cho Phép Đứt CLS Dịch Layer Hình.
