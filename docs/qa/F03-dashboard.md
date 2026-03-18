# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F03 - Dashboard Suite
> **Phiên bản:** 1.0 (Comprehensive Matrix) | **Cập nhật:** 2026-03-18 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`docs/prd/F03-dashboard.md`), User Stories (18 ACs)
> **Kỹ năng ứng dụng (.agent):** BDD (`Given-When-Then`), Locators Healer, Performance SLA (`< 2s`, `< 15s`), Payload DB Assertions.

---

## 1. Mục Tiêu (Objective)
Đảm bảo chất lượng toàn diện cho tính năng **F03 - Dashboard Suite** phục vụ tập khách hàng SME. Mục tiêu đạt độ phủ 100% cho 6 luồng User Stories (Overview, Analytics, SEO, Meta Gen, AI Fix, Keyword Tracker) và 18 Acceptance Criteria.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | Network Throttling, SLA Metrics `< 2s` Loading, `< 15s` AI Fix SSE |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[Security & Non-Functional] Xác thực & Layout Cơ Bản** |
| **TC-F03.01** | `NFR` | `Sec` | **[Negative]** Chặn rào Access `401 Unauthorized` | **1.** Truy cập trực tiếp đường dẫn `/dashboard` khi chưa Login. | **THEN** Hệ thống đá văng về `/login`. Middleware chặn API GET `/api/dashboard/summary`. | Blocker | [x] |
| **TC-F03.02** | `NFR` | `Perf` | **[Positive]** Thời gian Load Overview `< 2s` | **1.** Login thành công. Mở `/dashboard`. | **GIVEN** Dashboard load **WHEN** Fetch API **THEN** Khung Skeleton Shimmer hiện lên mượt. Tổng thời gian render Dữ liệu `< 2000ms`. | High | [x] |
| **TC-F03.03** | `BR-01` | `Sec` | **[Negative]** Tenant Data Isolation (Multi-tenant) | **1.** Đội Headers Token User A gọi GET API đính `tenantId=B`. | **THEN** Backend Server đối chiếu Context báo HTTP `403 Forbidden` chống rò rỉ. | Blocker | [x] |
| **TC-F03.04** | `NFR` | `UI` | **[Positive]** Layout Responsive Mobile `375px` | **1.** Trình giả lập màn hình iPhone 14 (375px). | Sidebar tự động Collapsed. 4 Stats Cards bẻ gập từ ngang sang `2x2 Grid Layout`. | High | [ ] |
| **[US-01] Dashboard — Overview & Personalization** |
| **TC-F03.05** | `AC-4` | `UI` | **[Empty]** State Rỗng Khi Chưa Tạo Site | **1.** Dùng Tài khoản Trắng (0 Site). Truy cập `/dashboard`. | **THEN** Hiển thị màn hình Icon Trống + Nút `[Tạo website đầu tiên]` điều hướng sang `/onboarding`. Không hiện Data Khống. | Blocker | [x] |
| **TC-F03.06** | `AC-1` | `Func` | **[Positive]** Bố cục 4 Stat Cards Cốt Lõi | **1.** Dashboard load xong. User đang có site Live và Tracking Data. | **THEN** DOM Render 4 Thẻ (`data-testid="stat-card"`): Traffic (Views), Leads (Clicks Gọi), Engagement (Click SP), Revenue (F10 Order). | Blocker | [x] |
| **TC-F03.07** | `AC-2` | `Func` | **[Positive]** Tác vụ Switch Logic Bộ Lọc Thời Gian | **1.** Chọn Dropdown Filter -> Nhấp `[Today]`, sau đó `[30 days]`. | Dữ liệu Chart & Thẻ Cập nhật Real-time Không tải lại trang (Single Page App). Store ghi nhớ Filter cho Session hiện tại. | High | [ ] |
| **TC-F03.08** | `AC-3` | `UX` | **[Positive]** Tùy Chỉnh Thêm/Ẩn Các Widget Metric | **1.** Click Nut `Tùy chỉnh Dashboard`. Bỏ tick "Views tổng", tick thêm "Lượt Click Checkout". | Widget View Hủy Giấu Khỏi Grid. Thẻ Click Mới Hiện Ra Thay Thế. Kêu Gọi Cấp POST `/api/dashboard/preferences`. | Medium | [ ] |
| **TC-F03.09** | `AC-3` | `UX` | **[Positive]** Drag & Drop Đảo Vị Trí Metric Widget | **1.** Mở Widget Panel. Chuột Trái Kéo Nắm Grip Handle Thẻ Dưới Tráo Lên Đầu. | **REACT** Thẻ UI Được Đổi Chỗ. Biến `widgetOrder` Lệnh CMS Trả Layout Sort Order Mới Lưu Gọn Lẽ. | Medium | [ ] |
| **[US-02] Analytics Details** |
| **TC-F03.10** | `AC-1` | `Func` | **[Positive]** Tính Điểm So Sánh Tăng/Giảm Rõ Ràng % | **1.** Mở `/dashboard/analytics`. | Data Từng Widget Trả Hiệu Ứng Delta Số Dương (Xanh Mũi Tên Lên +12%) hoặc Số Âm (Đỏ Hướng Xuống -5%) So Vụ Kỳ Cũ Cùng Size. | Blocker | [x] |
| **TC-F03.11** | `AC-1` | `UI` | **[Positive]** Danh Sách Liệt Kê Top Pages, Prod, Blogs | **1.** Quan Sát Bảng Cấp Dưới Cùng Của Analytics Tab. | Bục Render Table Phân List Theo 3 Tab Top Pages/Top Products/Top Blogs Cạnh Nhau Cực Gọn. Dữ Giữa Cửa Không Dư 10 Khối Rows. | High | [ ] |
| **TC-F03.12** | `AC-2` | `Boundary`| **[Empty]** Ứng Phó Khung Data Kỳ Vắng Khách | **1.** Chỉnh Calendar Lùi Về Tháng Trước Lúc Site Chưa Live Được. | Layout Render Đồ Thị Bar Rỗng Đều Đáy. Nhồi Text Dữ Liệu `Chưa có dữ liệu trong khoảng thời gian này`. Tất Cả Dấu Chữ Số Chỉ Đều Zero `0`. | High | [ ] |
| **TC-F03.13** | `AC-3` | `API` | **[Negative]** Xử Lý Biến Cố Sập Kết Nối Nguồn Data | **1.** Kill Service / Force Abort Lệnh GET `/api/analytics/summary`. | Màn Không Trắng Cạch (White Screen Of Death). Lệnh Error Boundary Trả Toast Error `Không thể tải dữ liệu`. Nở Nút `[Thử Lại]` Phục Trình App Bình An. | High | [x] |
| **[US-03 & 04] SEO Dashboard & Auto Meta Generation** |
| **TC-F03.14** | `AC-1` | `Func` | **[Positive]** Tổng Quan Dashboard Cấu Trúc Điểm SEO | **1.** Mở `/dashboard/seo`. Đợt Render Hoàn Chốt. | Ghi Điểm Overall `0-100` Bùng Phá Nổi Bật Vòng Khuyên. Tách Điểm Breakdown Thành Meta/Content/Tech. Móc API Call Chéo Check Pass Payload. | Blocker | [ ] |
| **TC-F03.15** | `AC-2` | `API` | **[Positive]** Thao Tác Generator Sitemap Lõi | **1.** Click Kêu Action "Generate Sitemap".| Auto Phát Lệnh Background Tool Run Lạo HTML Tree Khép `.xml`. Báo Pop Toast Success Lên Gọn Lẹ Cho User Ổn Định Core. | High | [x] |
| **TC-F03.16** | `US04-AC1`| `Func` | **[Positive]** Trụ Auto Generator Title/Description Lần Publish Đầu | **1.** Vào Editor App Của Site Nháp. Chưa Đoái Hoài Gì Tới Tool SEO Tay. Bấm Nut Cứng `Publish`. | Tầng Lõi Publish Thầu Trigger Prompt Kèm Gọi Thêm OpenAI LLM Run. Bàn Web Chạy Xuất File Lõi Bắn Đủ Header `Meta Title <= 60 chars`, Kèm `Meta Desc <= 160`. Cú Đúp Gọi `Payload CMS` Insert Trường SEO Dày Dặn. | Blocker | [x] |
| **TC-F03.17** | `US04-AC2`| `Edge` | **[Negative]** Chống Chạp Khi OpenAI Fail Bị Quá Tải Giữa Chừng Meta Gen | **1.** Lệnh AI Bị Đứt Network Giữa Cữ Lúc Push Site Lên Mạng Trực. | Khâu Chốt Post Hậu Không Vùi Error Báo Vỡ Cục Nhấn Publish. Request Vẫn Pass Done Mảng Trang Thật Cho Mua Hàng. File Log Treo Cữ Ghi Event Gắn Job Queue Retry Background Hồi Auto Lại Thẻ Tags Phía Hậu Sân Lúc Không Kẹt Xe. | High | [x] |
| **TC-F03.18** | `US04-AC1`| `Limit`| **[Negative]** Guardrail Cầm Ngàm Vượt Số Chars SEO Quá Định Chuẩn | **1.** Text Cấu Nhập Store Name Dài Thoa 80 Chars Tràn Trấu Khỏi Limit Rule Tiêu Đề. | Hệ Giới Hạn Cưỡng Ep Thuật Toán Slice Split Cắt Cứng Substring Kèm Dấu `...` Hoặc Buộc Co Chỉ Lại Đảm Phủ Phép Chuẩn Limit Strict 60 Title. | Medium | [ ] |
| **[US-05] AI SEO Fix All Issues (Điểm Nhấn Chốt Hạ Móng Vuốt System)** |
| **TC-F03.19** | `AC-1` | `API` | **[Positive]** Nút Giao Phép AI Auto Fix Hàng Loạt | **1.** Check Bảng Score Bị Rơi Xuống Mốc Warn Thiếu Alt Text / Title Nặng. Bấm Gõ Button Action Lớn `[AI Fix All Issues]`. | Chuyển Modal Popup View Propose Trả Kết Quả Của LLM Xin Chốt Deal. Hiển Nút Accept Cả Mảng Cục. Nhấn Accept. | Blocker | [x] |
| **TC-F03.20** | `AC-1` | `Perf` | **[SLA]** Bố Cục Thầu Fix Stream Lũ Lụt Tốc Độ Nhanh Gọi Gọn `< 15s` | **1.** Trong Khung Click AI Fix Quá Trình Load SSE Thả Progress. | Đoạn Gói Event Data Đẩy Tới Trái App Cục Update Quá Độ Tới Mạch Dưới Đáy Mốc Bọc 15000 Miliseconds. API Trả Chặn Fix Hoàn Thiết HTML Lịch Sự Không Chậm Treo Mõi Mòn Đầu Tư Cắt. | Blocker | [x] |
| **TC-F03.21** | `AC-1` | `Func` | **[Positive]** Khung Undo Cục Thầu Kép Thu Hồi Nhất Đồng Lệnh Chốt | **1.** Test Sửa Auto 10 Đầu Lỗi Đồng Thảy Mảng Fix Xong. Mắt Dòm Trả Lỗi Lạnh, Nhấn Nút Hoặc Khóa Bàn Phím Ctrl+Z. | Mở Nối Khung Undo Batch Lôi Đảo Dữ Data API Lật Back To Nguyền Trạng Ban Sơ. Single Action Revert Rollback Sạch Chỉnh Đoạn Mớ Rác Thay. 10 Điểm Fix Trúc Về Khởi Đầu Bạt Layout Cũ Tròn Láng Không Vỡ Mảng Database. | High | [ ] |
| **TC-F03.22** | `AC-2` | `Edge` | **[Negative]** Rollback Kẹt TimeOut Lỗi Viễn Mạng Quá 15s Vượt Thầu | **1.** Network Tụt Bóp Throttling Chạy SSE Treo Kẹt Tàn Mòng 20 Giây Đồng Hồ LLM Mắc Lệnh Gen. | Đồng Hồ Giám Sát Giật Hủy Thread Worker Của Lệnh Fix. Kêu To Modal Error `Lỗi Thời Gian Lệnh Fix`. Data Nào Lưu Kẹt Giữa Nhịp Xả Hàm Rollback Đưa Database Trả Nguyên Sạch Lành Vị Đầu Sửa Chưa Cấn Code Chắp Vá Khác Biệt Nát Base. | Blocker | [x] |
| **[US-06] Basic SEO Keyword Tracker** |
| **TC-F03.23** | `AC-1` | `Boundary`| **[Negative]** Chốt Khóa Guard Trần Giới Hạn Cứng 5 Từ Khóa Tracker Core | **1.** User Kêu Gõ Nắm Kéo Thêm Chữ Vị Keyword Đầy Khung Quá Lượt Lần Click 6 Lố. | Màn Tracker App Khóa Disbaled Dị Nút Nút `+ Thêm Từ Khóa`. Cảnh Khung Input Gray Out Đóng Lại Trắng Màu Cho Ngàm Strict Chuẩn Nguồn Api Cước Phí Quá Max. | High | [ ] |
| **TC-F03.24** | `AC-2` | `Func` | **[Positive]** Đồng Khởi Hiện Keyword Trend Biểu Giá Hạng Lót Kênh | **1.** Điểm Add Thêm Chữ Xong Trễ. Trông Dõi Component Bảng Lõi Hiện Form Phản Lại Mới Track Trạng. | Hiển Mục Chữ Data Trend Khớp Text `[Cơm Ngon HCM]`. Lấy Hạng Biểu Trưng Trả Số Phóng Target `Rank 15`. Mũi Tên View Bày Form Hình Mũi Xanh UP Hoặc Vệ Xuống Tượng Cảnh Vượt Khó Hụt Gặp. | Medium | [ ] |
| **TC-F03.25** | `AC-3` | `Cron`| **[Positive]** Auto Lệnh Batch Fetch Data Ranking Cấp Đảo Theo Chốt Đuôi Chu Kỳ Tuần | **1.** Lệnh Cron Job Server Gõ Gọi Run 1 Cú Lọc Vòng Tua Batch Chốt Lệnh Update Ranking List Tracker Tất Cả DB Dữ CMS Mới Lên Fetch Độc Lập Trả Khúc. | Nền System Đi Run Hàm Check Tracker Lõi Trả Lại Array Kế Hạng Đảo Chiều Trúng Thay Máu Record Update Cấp Vị Ngay Payload Database Mở Table Từ Khóa Keyword Lặng Ổn Không Tắc Mạch Đổ Lỗi Code Nút DB Crash Timeout Bể Lịch Đoạt. | High | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
**Kịch bản Use Case Chính (Command Center Khai Thác & Hành Động Tốc Biên):**
1. **[Giám Sát Doanh Số Cửa Mặt Hàng Mới Nhất]** Chủ shop (chưa hiểu mẹo quản web sâu xa gì cả) Bơm Click vô Luồng `/dashboard`. Con Mắt ngả ngay vào Khung Mệnh "Revenue Cửa Số Khá Cao Lớn Cỡ Tỉ Đỉnh Tiền Thu Hôm Qua `+12%`". Chụp Tay Mở Grid Layout Lưới Gạt Đeo Nhanh Các Bục Clicks Mở Checkout Cầm Bảng Xem Lõi Lẫn.
2. **[Ngửi Đáy Điểm Nóng & Chuyển Kho Thao Lệnh]** Con Mắt Giữ Điểm Thấy List Thống Nốt Kể Dọc Hàng Nặng Khung Đỏ To Lỗi "3 Khách Mở Oder Lặng Trừ Sớm Chưa Đón Order Xác". Nhanh Chân Cú Click Qua Order Gắn Liền Page Thầu Module F10 Hành Đồng.
3. **[Nắm Kẻ Thù Móc Túi Lệnh Hô Biến Cảnh Sát Lõi Chết Ngược]** Cuộn Trượt Xuống Tới Bìa Trang. Khung Chart Quét Sẹo Lạch Tạch Lỏng Ngàm `72/100 Điểm Health Seo Thủng Thiếu Text Lỗi Thư Từ Bụi Mô`. Ngơ Ngác Nhấn Thử Mở Phép AI Nut Phép Thuật Biến Mát "Fix Tới Đây Giờ Tất Cả Liền". Load Phẳng Kỹ Xả Stream Chạy Trút Fix Thay Đảo Tiêu Đề Đóng Data Payload Thành Quả Nguy Thủy Nhấn Thổi Vút Lê Cột Đo Tới 98 Điểm Xanh Chót! Giải Phóng Vong Test Tỏa Niềm Giao Chủ Trải Nghiệm Khách Dùng Khắp Mặt Cuộc.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Agent Automation Apply) |
|---|---|---|
| **1. UI/UX Dashboard Visual** | [ ] Đã chạy 0/10 TC | Verify Grid Drag & Drop lưu vào DB CMS, kiểm tra Empty States cho Khách hàng trắng site. |
| **2. Analytics Metrics Precision** | [ ] Đã chạy 0/5 TC | Đoán Check Test Data Lệnh So Số % Tăng Giảm Đổi Phép Toán Toán Tính Logic Backend Hashing Anonymize Cực Độ Kẹt API Trầm. |
| **3. SEO Autofix & Limits** | [ ] Đã chạy 0/7 TC | Mồi Gắn Trượt Test Chạy Bạo SLA Vượt Cữ Fix Quá 15s Buộc Nhả Rollback Nguy Cấp Chống Quỳ Gối Server App. |
| **4. E2E UAT Approval** | [ ] Not Run | Phê Check Chấp Nhận Luồng Flow Kêu Cửa Từ Mép View Trắng Nợ Sang Cấu Chuẩn Tool Click Action Fix Bệnh. |

> **Khuyến Nghị Release:** Với việc gắn đủ 25 Lệnh Test Case Quét Lọc Đủ Lớp Boundary Kẹt Sự Chạm Limits Lấp Của 6 Nút Story Cấp Cực Dễ Nát F03 Dashboard Nhạy Cảm Số Tiền Metric Này. Yếu Cầu Cần Tích Chuẩn Code Pipeline Tẩy Allure Run Lực Nặng Bật Dữ Trả Chốt Trước Bàn Giao Thầu Code Merge Rộng Thả Kín Production Release An Nhiên.
