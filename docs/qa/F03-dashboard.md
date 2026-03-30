# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F03 - Dashboard Suite
> **Phiên bản:** 5.0 (Omni-Channel Quality & Agent-Driven) | **Cập nhật:** 2026-03-20 | **Thực hiện:** QA Team
> **Tài liệu tham chiếu PRD:** [F03-dashboard.md](../prd/F03-dashboard.md) | **Tài liệu tham chiếu User Stories:** [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md)

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng Bảng điều khiển Tổng Quan (Dashboard Suite - F03). Bộ kiểm thử bao gồm **62 kịch bản chi tiết**, được phân bổ khắt khe theo từng User Story (Không gộp chung).

Đặc biệt thiết kế và triển khai áp dụng 100% các kỹ năng từ hệ sinh thái tác nhân (AI QA Agents): **BDD Cucumber, K6 Performance, Locator Healer, Test Data Generator, CI/CD Runner, Security Check**.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari (macOS), iOS WebKit |
| OS / Desktop | Windows 11, macOS |
| Devices (Responsive) | Desktop (1920x1080), Tablet (768px), Mobile (iPhone 14 Pro 375px) |
| Network | 4G (Fast/Slow), WiFi, Throttling giả lập Request API đứt quãng (Offline Simulator) |
| Test Data | Database Mock tự động giả lập 100,000+ Record Đơn hàng, Mốc Tín hiệu Traffic 5 năm |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-01: Dashboard — Overview & Personalization]** *(Bao gồm Trải nghiệm, Hiệu năng, Bảo mật Lõi)* |
| **TC-F03.01** | `US-01/AC-4`| `UX/UI`     | **[Empty State]** Kích hoạt trạng thái Giao diện Rỗng | 1. Đăng nhập User chưa cấu hình Site.<br>2. Vào `/dashboard`. | Khung hiển thị `[Icon] + "Tạo Website đầu tiên"`. Nút CTA điều hướng chính xác về `/onboarding`. | High | [x] |
| **TC-F03.02** | `US-01/AC-1`| `Func`      | **[Happy Path]** Hiển thị 4 Thẻ Thống Kê mặc định | 1. Bằng TK có Date, truy cập `/dashboard`. | Render đúng 4 Metric Card: Traffic, Leads, Engagement, Revenue/Orders (F10 Load). | Blocker| [x] |
| **TC-F03.03** | `US-01/AC-1`| `Integrate` | **[F10 Intergration]** Lấy danh sách Pending Orders | 1. Kiểm tra list `Action Required`. | Hiển thị 3-5 Đơn hàng MỚI NHẤT trạng thái Pending từ CMS F10. | High | [x] |
| **TC-F03.04** | `US-01/AC-1`| `Integrate` | **[F10 Redirect]** Đường dẫn liên thông Đơn hàng | 1. Bấm vào 1 Item "Order #001" trên list. | Trình duyệt chuyển Route `/dashboard/orders/:id`, giữ nguyên Session. | High | [x] |
| **TC-F03.05** | `US-01/AC-1`| `Math`      | **[Metric Math]** Công thức Đếm Tổng Lượt Chọn | 1. Kiểm tra số hiển thị thẻ Revenue. | Tính `%` và `$ Doanh Thu` chỉ đếm Đơn `[Paid]`/`[Completed]`. Lọc bỏ ngoại trừ `[Cancelled]`/`[Refunded]`. | Blocker| [x] |
| **TC-F03.06** | `US-01/AC-1`| `Math`      | **[Metric Math]** Unique Visitors vs Total | 1. Tải thẻ Traffic. | Đếm đúng cấu trúc Unique Visitor theo Session ID thay vì đếm dồn số lần Hit Web. | Blocker| [ ] |
| **TC-F03.07** | `US-01/AC-2`| `Func/UX`   | **[Filter]** Tương tác Lọc thời gian Menu | 1. Chọn Mở Menu khoảng thời gian (7d, 14d, 30d, 90d). | 4 Thẻ Stat Card update Data (Biểu đồ Tịnh Tiến) lập tức, KHÔNG TẢI LẠI TRANG (No Reload). | High | [x] |
| **TC-F03.08** | `US-01/AC-2`| `Storage`   | **[Session]** Persistent State (Lưu Trạng Thái) | 1. Chỉnh Filter sang `30d`. F5 lại Page. | Hệ thống nhớ tuỳ chọn lưu trong Storage. Phục hồi View `30d`. Dữ liệu ăn khớp. | Medium | [x] |
| **TC-F03.09** | `US-01/AC-2`| `Boundary`  | **[Data Load]** Mock K6 Perf 100,000 Records | 1. Chèn Database Khổng Lồ, Filter Max Date `[All Time]`. | React Table/Charts ko bị Crash Heap. Pagination API Data Streaming ngầm. SLA Response `< 2 giây`. | Blocker| [x] |
| **TC-F03.10** | `US-01/AC-2`| `Boundary`  | **[Rage Click]** Ngăn thao tác bấm lặp API Spam | 1. Nhấp liên tục vào List Filter (10 lần/1s). | Debouncer Component khóa luồng Request dư. Chỉ gọi Request Cập nhật Ở lần Click cuối cùng. | High | [x] |
| **TC-F03.11** | `US-01/AC-3`| `Func/UI`   | **[Customize]** Lưu/Hủy Thẻ Card Cá Nhân | 1. Bấm `[Tùy chỉnh Dashboard]`. Bỏ tick views rồi bấm [Cancel]. Thử kéo lại và bấm [Save]. | Bấm [Cancel] KHÔNG ĐỔI layout bên ngoài. Bấm [Save Changes] Layout Card lấp đầy khoảng trống ngay lập tức. | High | [ ] |
| **TC-F03.12** | `US-01/AC-3`| `Desktop`   | **[DND Mouse]** Drag & Drop PC Browser | 1. Chuột bôi tay Cầm Component, Vượt Box A sang B. | Layout chuyển Cạnh Smoothly. Update State Array Index. | High | [x] |
| **TC-F03.13** | `US-01/AC-3`| `Mobile`    | **[DND Touch]** Drag & Drop Cảm Ứng (iPhone) | 1. Màn iPhone 375px, Giữ Long-press thả Panel A sang B. | Ko Lỗi Conflict Kéo Window Cuộn Trang của Trình Duyệt. Block Tách Điểm Di Động Rõ Ràng. | Blocker| [ ] |
| **TC-F03.14** | `US-01/AC-3`| `Edge`      | **[Sync Tab]** Xử lý Multi-Tabs Conflict | 1. Đổi Config Card ở Tab 1. Xem xét Tab 2. | Không sập System. Request POST Ghi đè State Dữ Liệu Version mới nhất. | Medium | [ ] |
| **TC-F03.15** | `NFR/Perf`  | `Perf/UI`   | **[UX Load]** Xài Skeleton Shimmer Tải Trước | 1. Fast Load Component `DashboardPage`. | Khung Component lên hình `[Skeleton]` Nhấp Nháy Màu Khói. Không Hiển Thị Vòng Xoay (No Spinner Layout). | Medium | [x] |
| **TC-F03.16** | `NFR/Sec`   | `Security`  | **[Auth Redirect]** Xác thực Session Access 401 | 1. Clear LocalStorage, Request Call URL. | Redirection KICK người dùng ra trang `/login`. API Trả trạng thái Từ Chối HTTP `401 Unauthorized`. | Blocker| [x] |
| **TC-F03.17** | `NFR/Sec`   | `Access`    | **[Tenant Rules]** Cô Lập Dữ Liệu Tách Biệt Site | 1. Đổi Tham Số Token Fetch TenantID Của Khách Hàng Khác. | Bắt dính JWT Mã Access Khác Biệt. HTTP `403 Forbidden` Server API Limit Chống Penetration. | Blocker| [x] |
| **TC-F03.18** | `NFR/Mobile`| `UI/Layout` | **[Responsive]** Breakpoint Mobile Width 375px | 1. Thu hẹp Window 375px. | Thẻ Card chia Grid `2x2`, Sidebar Trái `[Hidden]` Thay Bằng Hamburger Menu Top Header. Chữ không Tràn. | Blocker| [x] |
| **[US-02: Analytics Details]** *(Bao gồm Math Validation & Analytics Format)* |
| **TC-F03.19** | `US-02/AC-1`| `Func`      | **[Chart View]** Biểu đồ Bar Chart Render Chuẩn | 1. Vào `/dashboard/analytics`. Load Canvas. | Biểu đồ Nạp Trục X/Y Phân Chia Ngày Khắc. Scaling Dynamic Mức Khỏa Không Chen Lấn Layout X. | High | [x] |
| **TC-F03.20** | `US-02/AC-1`| `Touch`     | **[Tooltip]** Mồi Dữ Liệu Trạm Cảm Ứng Point | 1. Màn Hình Cảm ứng (Tablet), Gõ Tap Lên Đầu Cột Dữ liệu. | Tooltip Box nhảy số thông minh Không Phụ thuộc Kích Click Hover Của Chuột Cơ. Box Không Tràn Khung Viewport. | High | [ ] |
| **TC-F03.21** | `US-02/AC-1`| `Render`    | **[Safari Bug]** Apple Webkit CSS Display Check | 1. Load Bar Chart Bằng MacOS Safari Browser. | Tránh Tình Trạng Nhòe Nét Canvas / HTML Grid Sập Flex Layout (Lỗi Truyền thống Browser Engine). | Medium | [ ] |
| **TC-F03.22** | `US-02/AC-1`| `Boundary`  | **[Data Limits]** List Top Pages / Product Giới hạn | 1. DB Push Hơn 50 Row Traffic Khác nhau. | Component `[Top Pages/Products/Blogs]` Limit render Khống max 10 dòng Row. Tối ưu Client DOM Nhẹ Nhàng. | High | [x] |
| **TC-F03.23** | `US-02/AC-1`| `Math`      | **[Delta +]** Tính Tỷ Lệ Grow Dương | 1. Giả Bước Trước 1500, Kì Này 2000. | In Cụm Chữ Số: `+33.3%` Tông Xanh Có Mũi Tên Hướng Lên. | Blocker| [x] |
| **TC-F03.24** | `US-02/AC-1`| `Math`      | **[Delta -]** Tính Tỷ Lệ Grow Suy Giảm Âm | 1. Giả Bước Trước 300, Kỳ Này 200. | Thiết Lập Text: `-33.3%` Tông Đỏ Có Mũi Tên Dốc Xuống. | Blocker| [x] |
| **TC-F03.25** | `US-02/AC-1`| `Math Zero` | **[Fail-safe Formula]** Công Thức Bị Chia Zero | 1. Data Analytics Báo Tháng Cũ Bằng 0, Mới là 500 views. | Component Loại Bỏ Output Toán Học JS Lỗi (Infinity/NaN). Xử lý HardCode Ký tự `N/A` hoặc `+100% Growth`. | Blocker| [x] |
| **TC-F03.26** | `US-02/AC-2`| `UX`        | **[Empty Logic]** Mốc Dữ Liệu Thời Gian Tạm Trống | 1. Lọt DB Kỳ Date Select Trống Records. | Empty State Thay Cốt Canvas Chart Báo "Chưa Có Tham Chiếu Thông Số Trong Kỳ Này". Giá trị 4 Card Báo Neutral 0. | High | [x] |
| **TC-F03.27** | `US-02/AC-3`| `Failover`  | **[API Crash]** Mạng Lưới Phục Hồi Load Timeout | 1. DevTools Block Request `/api/analytics/`. | Cắt Gẫy Hiệu Ứng DOM Treo Nát Trang bằng React Error Boundary. Hiện Ra Nút Button Lệnh `[Thử Lại Data]`. | Blocker| [x] |
| **TC-F03.28** | `BR-02/Sec` | `Privacy`   | **[Data Crypto]** Băm Thông Số Mạng Thu Thập User | 1. Lướt Log Backend Service Tích Vào Hành vi. | Kiểm đếm Địa chỉ IPv4/v6 Đã Được Mã Hóa Cứng `SHA-256 Hashing`. Không Phát hiện Bóc Tách Plain Text Lưu Dấu Dữ liệu Nhạy Cảm User End-Web. | Blocker| [x] |
| **[US-03: SEO Dashboard Overview]** |
| **TC-F03.29** | `US-03/AC-1`| `Func/UI`   | **[Score Board]** Định Hình Widget Nhóm Base Cấp Độ | 1. View `/dashboard/seo`. | Có Vòng Nhẫn Ranh Hiện Score /100. Tách Liệt Kê Các Khoản: Lỗi Code Tech, Meta Tag Rác, Layout Chữ Bài. | Blocker| [x] |
| **TC-F03.30** | `US-03/AC-2`| `Func`      | **[Sitemap]** Trình Push XML Map Generator File | 1. Đánh Action `Generate Sitemap`. | Tệp Sitemap Sinh Trong Local Directory Tĩnh Máy Chủ Rả Route XML. Lên Toast Inform UI Xanh Lá Trong `< 2s`. | High | [x] |
| **TC-F03.31** | `US-03/AC-3`| `Failover`  | **[Timeout]** API Auto Scan Tắc Nghẽn Service Gốc | 1. Làm Giảm Băng Thông Kênh Máy Quét Crawler. | Widget Hiện Báo Bực `[Timeout Lỗi Cấu Trúc Đọc HTML]`. Cung Cấp Phá Vây Nút `Retry Scan` Khẩn. | High | [x] |
| **[US-04: Auto SEO Meta Generation]** *(Intergration F05/Localize)* |
| **TC-F03.32** | `US-04/AC-1`| `Intergrate`| **[First Publish]** Hooking Editor Auto Sinh SEO | 1. Trong F05 Web Editor: Sinh Thử 1 Page Trắng Không Đánh Chữ Setting SEO Meta. Click Lệnh Publish Công Khai. | Backend Route Chạy Trình Duyệt Ngầm Cấu trúc LLM Bot AI Ráp Nghĩa. Page Output Mới Thành Phẩm Tồn Tại Header Chuyên Có Hẳn SEO Text Cứu Trang. | Blocker| [x] |
| **TC-F03.33** | `US-04/AC-1`| `Format`    | **[Title Rule Homepage]** Template Title Trang Chủ | 1. Publish Page Gắn Flag Trang Chính Home. | Gen Định Dạng Code Tuân Thủ Text Base: `{Tên Shop} | {Category Ngành} Online Malaysia`. | High | [x] |
| **TC-F03.34** | `US-04/AC-1`| `Format`    | **[Title Rule Product]** Template Title Cho SP Nhóm | 1. Publish Single Page Đơn Sản Phẩm Bán Hàng. | Title Render Khung Chữ Form Chuẩn SEO E-Com: `{Tên Hàng Hóa} | {Tên Shop} | Buy Online Malaysia`. | High | [x] |
| **TC-F03.35** | `BR-05 / F21`| `Locale`    | **[Format Locale]** Target Thị Trường Malaysia MS | 1. System Config `locale=ms`. Publish Sinh Keyword. | Text Thay Vì Tiếng Anh Tự Dò Hệ Số `Online Malaysia` Dịch Quá Ngữ Nghĩa Về Formal Bahasa Melayu Mã Lai. | Blocker| [ ] |
| **TC-F03.36** | `US-04/AC-1`| `Boundary`  | **[Trim Length]** Cắt Gọn Kí Tự Chống Mù Kích Thước | 1. Prompt Ép Gen > 100 Từ. | Data Bịt Mức `Max: 60 Chars Title` Và Khống `Max: 160 Description`. Bypass Hàm String Truncate. | High | [x] |
| **TC-F03.37** | `US-04/AC-1`| `Schema`    | **[JSON-LD Inject]** Đúc Lệnh Bot Crawler Spider Code | 1. Inspect Document HTML Header Website Đã Public. | Block Cấu Trúc Thẻ `<script type="application/ld+json">` Chứa Khung Rich Snippet Schema Bắn Rành Mạch Product Chờ Crawler Đọc. | High | [x] |
| **TC-F03.38** | `US-04/AC-2`| `Queue`     | **[Background Job]** Background Retry Delay API Nước | 1. Ngắt Connection ChatGPT 504. Dấn Publish. | Luồng Web UI Không Căng Chờ Response. UI Trả Về Toast "Thành Công Web". Còn Trình Gen SEO Thì Cố Khép Gửi RabbitMQ Job Nền Cố Tái Sinh Lại Khi Mạng Thở Đều. | Blocker| [x] |
| **[US-05: AI SEO Fix All Issues - 🚀 Vũ Khí Hạt Nhân]** |
| **TC-F03.39** | `QA/Auto`   | `Locator`   | **[Data-TestID]** Bắt Hook Gắn Điểm Node Chuẩn BDD | 1. Inspect F12 Code Phím `[AI Fix All]`. | Phím Node Gắn Tag `data-testid="btn-ai-fix-all"` Phục Vụ Quy Trình Automation Chạy Locator Vững Bước Bằng Playwright Framework. | High | [x] |
| **TC-F03.40** | `US-05/AC-1`| `UX`        | **[Propose Mode]** Xem Trước Output Hành Trình Dịch | 1. Click Lệnh Fix Tổng Lỗi. | Modal Gọi Đọc Trình Bày List Before - After Kèm Tich Box Chọn Dòng Cần Đồng Ý Change Hay Ngó Lơ Cố Giữ Gốc Văn Khách Tự Đặt. | Blocker| [x] |
| **TC-F03.41** | `US-05/AC-1`| `Perf/SLA`  | **[SSE 15s Load]** Cày Kéo Tải Mảng Dữ Liệu Socket | 1. Request Dãy Bự 20 Lỗi Meta Code Bèo Nhèo. | API Load Data Dạng Connection Keep-Alive Server-Sent Events. Output Response Text Sạch Về Từng Chunks Chốt Limit `< 15s`. | Blocker| [x] |
| **TC-F03.41b**| `US-05/AC-1`| `UI/State`  | **[Tracking Checklist]** Render Dấu Tick Trạng Thái SSE | 1. Quan sát UI Cửa sổ Tiến độ khi SSE đang trả Data về. | UI hiện Thanh Progress tiến lên, kèm các hạng mục (Tối ưu Ảnh, Sinh Tiêu đề...) được Dấu Tick Xanh tuần tự theo nhịp Server trả về. | High | [ ] |
| **TC-F03.42** | `NFR/UX`    | `Button`    | **[State Disable]** Khóa Kép Ngăn Tự Bấm Lệnh Nhiều Lần | 1. Tác Nghiệp Bấm Nút Sửa Data Khi SSE Đang Kéo. | Nút Nẩy Bật State `Disabled="true"` Mức Chờ (Loading Icon). Chống Spam Click Bắn Request Xóa Quota API Bot Nước Ngoài Đau Túi. | High | [x] |
| **TC-F03.43** | `US-05/AC-2`| `Failover`  | **[Timeout UI]** Mạng Giật Lác Lỗi API Giữa Chừng SSE | 1. Gây Sụp Gián Đoạn Request Trả Khuya > 15 Giây. | Hiện Thị Alert "Sự Cố Render Đứt Quãng, Yêu Cầu Gửi Khác". Chặn Data Khung Preview Chạy Vòng Quay Vô Hình Hại PC Khách. | Blocker| [x] |
| **TC-F03.44** | `US-05/AC-2`| `SQL/DB`    | **[Mệnh Lệnh Rollback DB]** Gỡ Bỏ Dữ Liệu Kẹt Cửa Nửa Vời | 1. Mạng API Tỉnh Nhịp Kẹp Gãy Transaction Insert (Sụp TC-43). | Ràng Hệ Query Code Nền Hủy Khương Lệnh ACID. Thu Nạp Về Rộng 0 Thay Đổi Chữ HTML Nào Tránh Lưu Nhập Nhằng Lỗi Nửa Này Cắm Lỗi Kia Nơi Database Web Content. | Blocker| [x] |
| **TC-F03.45** | `US-05/AC-1`| `Func`      | **[Batch Undo]** Sức Chứa Nền Ctrl+Z Lấp Biển HTML Kém | 1. Nhấn Approve Đồng ý Quẹt Toàn Lỗi Mới Chữa Xong, Nhận Định Result Cự Kỳ Ngớ Ngẩn Bèn Bấm Nút Hoàn Tác Batch. | Toàn Cấu Hình Text Bảng Sửa Dối Lập Tức Hoàn Gọi Lại State Trữ Tạm Gốc Lõi Session Cũ (Ctrl+Z Tác Dụng Cho 1 Click). Khách Yên Lòng Nới Sai Mà Không Sợ Quên Gốc Content Text Lịch Sử Cũ Lâu Năm. | Blocker| [x] |
| **[US-06: Basic SEO Keyword Tracker & Cross-Locale UI]** |
| **TC-F03.46** | `US-06/AC-1`| `UI`        | **[Keywords Adding]** Thêm Chip Từ Khóa Kích Hoạt Nguồn | 1. Nhập Input `Bánh Bao`, Ấn Bàn Phím Enter. | Tách Rộng Khung Bảng Lên Chip 1 Khối Nhãn Cây Keyword Nguồn Dây Rốn Theo Dõi. | High | [x] |
| **TC-F03.47** | `US-06/AC-1`| `Boundary`  | **[Lock Target 5 Limit]** Giam Kho Đếm Kịch Mức 5 Max | 1. Force Gửi Array POST API Chứa Tham Mảng 6 Cây Từ Khóa Mới Lạ. | BE Chặn Đầu Ngắt Luồng Lưu. Lên Validation Error Text Cấm Dội Database "Không Cầm Giới Quá 5". Nút Gõ Input Disable Form Câm Lặng Tránh Khách Tiêm Vô Tội Vạ. | High | [x] |
| **TC-F03.48** | `US-06/AC-2`| `View`      | **[Ranking SERP]** Gọi Trình So Hàm Bậc Bảng Hạng Google | 1. Quét Nhìn Trực Diện Layout Ô Keyword Tồn. | In Cột Chữ Thông Báo Rõ Ràng Mức Vị Trí Domain Trên Google Index (Ví Dụ Hạng: #12 Trực Quan Dễ Đọc). | High | [x] |
| **TC-F03.49** | `US-06/AC-2`| `UX`        | **[Trend Arrows]** Biểu Đồ Nhãn Dán Phán Hướng Mũi Tên | 1. Dò Đánh Giá List API Backend Soi Cũ/Mới Lên Rank. | Map Chuẩn Ký Hiệu CSS Trend Vector Trắng Nhỏ Kéo Lên Trên 🔺 (Grow Rank) / Trịch Sụp Đáy Mũi Kẹp 🔻 Down Rank Và Phẳng Nước Ngang ➖ Unchanged Khác Rất Rõ Nhìn Hiểu Tranh Báo. | Medium | [ ] |
| **TC-F03.50** | `US-06/AC-3`| `Worker`    | **[Background Job]** Node Nhặt Data Crawler Đêm (Cron Tasks) | 1. Log Soát Trạm Thức Đồng Hồ Gốc Database `00:00AM`. | Service Backend Kích API Thủng Hoặc Vét Scrape Quét Top URL Từng Keyword Trong List. Khách Lỗ Ngủ Sáng Dậy Mở Admin Là Thấy Báo Cáo Rớt Thăng Vị Trí Vừa Render Dưới Giường Ra. | Blocker| [x] |
| **TC-F03.51** | `BR-05 / F21`| `Integrate` | **[Malaysia Targeting]** Bóp Goolgle Search .com.my Code | 1. Locale Khai Mở Gốc Báo User Của Indo/Malay Mã `Ms`. | Scrape Móc Đầu Host Tham Số Tìm Kiếm API Search Ưu Tiên URL Dốc Thường Google.com.my Để Kết Quả List Rank Trả Về Khớp Nhu Cầu Local Chữ Thay Vì Query Tìm Khống Global Mù Câm US Mẽo Lạc Quẻ Search Tiếng Malay Đuối Top. | High | [x] |
| **TC-F03.52** | `Sec/SQLi`  | `Security`  | **[Sanitization]** Diệt Khuẩn Mũi Text Inject DB Crawler SQLi | 1. Insert Kí tự Rác, Móc Ngặc Single Quoted SQL Văng Chặn Từ Khóa Target Đầu Hộp Form Input Cố Tình Hack Sạch Table Rỗng DB Core (VD: ``;DROP TABLE Keywords;--`). | Input Validation Thẳng Tay Sanitize Kẹp Đóng Ngoặc Giữ Payload Dưới Phép Text Clean JSON API String. Không Thực Thi Execute Rác DB Quét Lỗ Nước Rò Hacker Độc. | Blocker| [x] |
| **[Integration: F21 Localization (BM/EN) - Toàn Bộ Dashboard UI]** |
| **TC-F03.53** | `F21/UI`    | `State`     | **[No-Reload Switch]** Lật React State Đổi Ngữ Header | 1. Chọn Dropdown Ngôn Ngữ Top Admin Nhảy Sang (Bahasa Melayu BM). | Tên Trục Biểu Đồ Đếm, Card Box Thuộc Widget Và Nhãn Labels Tức Khắc Nhảy Gõ Chuyển Đổi Sang Text Dịch Ráp Không Quay Tròn Nạp Chờ Cánh Browser Kẹp Lại Window Location `(SPA Smoothness)`. | High | [x] |
| **TC-F03.54** | `F21/Data`  | `Data Form` | **[Protect Dynamic User Payload]** Giữ Định Tuyến Dòng Form Ngôn Ngữ Gốc Do User Tự Viết Khống Dịch Nhầm | 1. Thao Tác Chuyển Thẻ Interface Mã Lai, Quan Nhìn Vào Box Dải Nhánh Top List Blogs. | Code Text Title Của "Bài Viết Lợn Cưới Áo Mới Bán Hàng" Do Khách Nhập (User Generator Values Data Gốc) Bảo Mật Ròng Không Sứt Trôi Dịch Máy Về Tiếng Anh (Chỉ Dịch Nhãn Khung Component Viền Không Vọc Ruột Content Lỗ Thông Text Động Nháp Data User Cây Bảng Table Tự Mọc Lên Cấm Fix Thâm Đổi Lạ Sang Anh Dịch Trật Bản Gốc). | Blocker| [x] |
| **TC-F03.55** | `F21/UI`    | `Format`    | **[Currency Format RM]** Số Toán Học Tiền Tệ Định Mức Vùng | 1. Card Order / Revenue Dashboard. | Auto Regex Dòng Cột Numeric Code Nhét Tiền Lẻ Mã Bảng Phân Tách Ngàn Phảy Giữa, Gắn Mác Bằng Text Tĩnh Code: `RM 200,342.11` Phủ Lõi Rành Cho Form Nhóm Thị Trường Mã Lai Thay Vì Tiếng Chuẩn Default API Cầm Là Kí Quỳ Trí $ (Dollar Mỹ Dè). | Medium | [ ] |
| **TC-F03.56** | `F21/UI`    | `Format`    | **[Date Format]** Trục Tooltip Timeline Chart Cáp Dịch Locale | 1. Hover Hoặc Dùng Tay Tap Trạm Cột Biểu Đồ Data Chart Dashboard Bar Báo Cáo Lịch. | Đuôi Format Khung Cửa Trình View Đổi Từ Dốc Mỹ `<MM/DD/YYYY>` Biến Ngược Lại Đổi Thay Form `DD/MM/YYYY` Cây Mã Lai Quê Địa Chọn, Khớp Tôn Chỉ Thời Gian Format Local Tán. | High | [ ] |
| **TC-F03.57** | `F05/Flow`  | `E2E/UAT`   | **[End-to-End Hành Động]** Khách Thấy Pending Đơn Liền Lập Hành Vi Lăn Kho F10 Approval Chạy Lùi View F03 Overview Cần Rớt Đơn Đã Nhận Trống Danh Sách Cần Yêu Cầu Gấp Gọi Trống Sót Task Pending Chậm Chễ Kịp Giao. | 1. Login. F03 Overview Báo Chờ Duyệt Lệnh Order 002. Tap Đi Tới F10 Lấy View Duyệt Accepted Cọc Xong. Lùi Route Trả Gót Window Phím Quay Admin CMS View Đầu F03 List Lệnh Khởi Lược Ban. | Danh Sách To-Do Lệnh Yêu Cầu Bắt Phụ Hàng Của Khách Giảm Nét Component Reload Array, Loại Rớt Item `#002`, Data Card Mức Doanh Số Tổng Dội Tiền Thêm (Metric Math Triggered Live Sync Ràng Xuyên Khoản Cũ Đơn Vọng App Cửa). Hệ Hoạt Động Không Crash Tách Rời Block Kẻ Lắp Lại DB Data Cache Query Bị Khựng Lác Trễ Cập Cấu Trúc Khối. | Blocker| [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Kết hợp góc độ Business Analytics, QA Load Perfomance & Hệ Khái Trải Nghiệm Mượt mà từ Khách Hàng Chóp Rễ SME Business Malaysia._

**Hành trình Use Case Cốt Lõi (Omni-Flow F02 -> F03 -> F04/F05 -> F10):**
1. **Login State Security (F02->F03):** SME Log Code Trải Nghiệm Đẩy Chấm 401 Kick (TC-F03.16). Đăng nhập Trúng Chuyển Tức Thời Ngắm Layout Command Screen Dashboard Lóa Chờ Khóa Tải Bằng Component API Shimmer `SLA < 2s` Chống Spinner Khó Luông Mắt (TC-F03.15, TC-F03.09 Data Lớn Phễu 100K Mốc).
2. **Khảo sát Thông Minh (No Data Limit Break):** SME Chủ Kho xem 4 Mật Khấu Trình Tiền Bạc + Lead, Nhích Dropdown Data 30d Chóp. Bảng Card Gọi Nhảy Hook Code Live Fetch Ngành Delta Xanh/Đỏ Khứ (+/-% - Zero Div) Vùng Logic Không Reload Cản F5 (TC-F03.07, TC-F03.25). Túng Tooltip Xem Trệt Điểm Bar Chart Cẩm Vượt Bằng Lướt Tap Cảm Ứng IPad Screen Báo Biểu Safari Mac Chống Glitches Code HTML5 Vỡ Form DOM Tràng Vị Trí Trái Màn (TC-F03.20, TC-F03.21).
3. **Cross Module Trút Đơn Mảnh Ghép Store (F10->F03):** Check Pending Cần Bấm Click Hành Động Tự Nảy Window Quản Lệnh Bán F10 Xử Xong Tóm Bấm Lùi Trang Dashboard Biến Khỏi List Việc Móc Thâm Đồng Doanh Số Gross Revenue Xịn Xác Thu Mảnh Chống Mất Tràng Order Dữ DB (TC-F03.04, TC-F03.57 - Đỉnh Mốc).
4. **Trình Ghi AI Tự Sinh Sinh SEO Cứu Rank Track (F05->F03):** Mở Hộp Thùng SEO Đáy Ring Đỏ Gọi Cứu Gọi Hạch AI Bấm Nút Quét Streaming Phục Hồi Load Timeout Sập Tự Lăn Tải RollBack SQL Batch Báo Hoàn Tác Cứu Data Khách Hoảng Hồi (TC-F03.44, TC-F03.45). Add Chip Tracker Key Limit Bound Mức Max 5 Core Kêu Scrape Mã Lai `locale=ms` Cron Chạc Lệnh Chạy Check Google.com.my Rõ Rank (TC-F03.47, TC-F03.51). Lệnh Chỉnh Mượt Mã Đa NN Language Format Số / Tiền RM F21 Đổi Thẳng Toàn Bộ Form Dashboard Không Tải Reset Máy Client Web Mất Hứng Load Form Hoàn Hảo Code. (TC-F03.55).

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái | Ghi chú Trọng Tâm & Ứng Dụng Chuyên Gia Agent QC (AI Tools Mapping) |
|---|---|---|
| **1. UI/UX & Responsive Touch** | [ ] 0/15 | Ứng Dụng Tool `ui-debug-agent` Kéo Check Layout Safari Grid Vỡ Flex. Đảm Bảo Khớp Tablet Touch Tooltip Ko Gọi Trúng Hàm Click Mouse Đẩy Component Bấn Loạn. |
| **2. BDD/Math Logic Validation** | [ ] 0/14 | Tool Sinh Phân Rã Math Delta `% Grow`, Bắt Phép Zero Division Math Lỗ Thẳng Code Mạch React Khi Nền Cũ = 0. Tịch Thu `test_data_generator` Kí Quota Form Order Status Thừa Thiếu Tính Cũ Cancel Cấn Sai Toán. |
| **3. Non-Functional Perf & Load** | [ ] 0/8 | Load Perf Lắp Khúc Data Nhảy 100K Views Quét SQL Code Dội K6 `performance-test-engineer` Giữ Vững Tải `SLA 2 Second Request` Đánh Nát Băng Tải Mạng Throttling Phá Test Lệnh Queue RabbitMQ Nằm Background Khúc Gọi SEO AI Thủng Timeout Hoặc OpenAI 504 Crash Quá Mức Độ Request Giây `Rate Limit`. |
| **4. Integration & Security Flow** | [ ] 0/11 | Kỹ Năng Địch Hashing `SHA-256 IP User Tracking` Kẹp Luồng Trút `Tenant Data Isolation` Ngừa Mã Bug Rò API Xuyên Không Đấu Tố Hacker Nhảy Lâu Răng Database Kẹp Cổng `qc-ai-engineer`. |
| **5. Cross-Language Base (F21)** | [ ] 0/6 | Tool Phá Tĩnh Vọt Ngôn Trải Bằng Lệnh `locator_healer_agent` Sinh Automation Bóp Lỗi Khóa Bảng Biểu Format Date Nhảy Sai Date Mỹ Thay Dùng Mã Lai Hoặc Sập List Sản Phẩm User Chừa Mềm Trống Vi Cẩm Dịch Dòng Đổi Thành Chữ Tự Động Sai Nội Dung Mặc Cảm Gốc. |
| **6. Automation Auto Pipeline** | [ ] Không Cấp | Yêu Cầu Code Commit File Pipeline Đứng Kịch Bản BDD Bọc Thân Dưới CI/CD GitHub Action Mảng Khống File Automation Tải `ci-cd-test-runner` Đẩy Gọt Dọt Pass 100% Sạch Bụi Khung Test Script Không Flaky Lủng (Nhờ Check Code Tại File `flaky_test_analyzer`). |

> **Khuyến Nghị Release:** Mã Lỗi Đặc Công Của Màn F03 Lâu Rất Mỏng (Hầu Hết Math Ẩn Sai Do Division Zero, Lấn Quán Lỗi API Do Timeout SSE, Data Dàn 100K Lủng Tràn Memory Tải Khúc Component Table JS). Bắn Automation Chạy Data Load Nhét Cốt Sắp Pass Tuyệt Trí Đáy Không Lọt Khung UI Lác Kí Release Q1 Production Safe Hoàn Đảo.
