# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F03 - Dashboard Suite
> **Phiên bản:** 5.2 (Omni-Channel Quality & Agent-Driven) | **Cập nhật:** 2026-07-27 | **Thực hiện:** QA Team
> **Tài liệu tham chiếu PRD:** [F03-dashboard.md](../prd/F03-dashboard.md) | **Tài liệu tham chiếu User Stories:** [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md)

---

## 1. Mục Tiêu (Objective)

Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng **Bảng điều khiển Tổng Quan (Dashboard Suite - F03)**. Bộ kiểm thử bao gồm **78 kịch bản chi tiết**, được phân bổ theo từng User Story.

Áp dụng 100% các kỹ năng từ hệ sinh thái AI QA Agents: **BDD Cucumber, K6 Performance, Locator Healer, Test Data Generator, CI/CD Runner, Security Check**.

---

## 2. Test Environment (Môi trường Kiểm thử)

| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari (macOS), iOS WebKit |
| OS / Desktop | Windows 11, macOS |
| Devices (Responsive) | Desktop (1920x1080), Tablet (768px), Mobile (iPhone 14 Pro 375px) |
| Network | 4G (Fast/Slow), WiFi, Throttling, Offline Simulator |
| Test Data | Database Mock tự động giả lập 100,000+ records đơn hàng, traffic 5 năm |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-01: Dashboard Overview & Personalization

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.01** | `US-01/AC-4` | `UX/UI` | **[Empty State]** Hiển thị giao diện rỗng khi chưa cấu hình site | 1. Đăng nhập tài khoản chưa tạo Site.<br>2. Truy cập `/dashboard`. | - Hiển thị icon + nút CTA "Tạo Website đầu tiên".<br>- Nút điều hướng đúng về `/onboarding`. | High | [x] |
| **TC-F03.02** | `US-01/AC-1` | `Func` | **[Happy Path]** Hiển thị 4 thẻ thống kê mặc định | 1. Đăng nhập tài khoản có dữ liệu.<br>2. Truy cập `/dashboard`. | - Render đúng 4 Metric Card: Traffic, Leads, Engagement, Revenue/Orders. | Blocker | [x] |
| **TC-F03.03** | `US-01/AC-1` | `Integrate` | **[F10 Integration]** Lấy danh sách Pending Orders | 1. Chuẩn bị N đơn Pending với N từ 1 đến 5 và tổng số đơn Pending có thể lớn hơn N.<br>2. Vào section "Pending Orders" trên Dashboard. | - Hiển thị chính xác N đơn Pending mới nhất, tối đa 5 dòng.<br>- Mỗi dòng có order number, số lượng item, tổng tiền, currency và trạng thái "Awaiting".<br>- Số lượng item chỉ cộng quantity dạng số nguyên dương an toàn; bỏ qua chuỗi, số thập phân, số không dương, số nguyên không an toàn và phép cộng làm tổng vượt `Number.MAX_SAFE_INTEGER`.<br>- Badge hiển thị tổng số đơn Pending. | High | [x] |
| **TC-F03.04** | `US-01/AC-1` | `Integrate` | **[F10 Redirect]** Điều hướng liên thông đến chi tiết đơn hàng | 1. Nhấn vào một item trong danh sách Pending Orders. | - Trình duyệt chuyển chính xác sang `/orders/{documentId}`.<br>- Session được giữ nguyên. | High | [x] |
| **TC-F03.05** | `GH-1627/AC-R02..R06` | `Math/Unit` | **[Metric Math]** Contract tổng doanh thu của active loader | 1. Chuẩn bị orders cùng tenant và khác tenant với status, currency, payment method khác nhau.<br>2. Gọi `getGlanceData` cho current/comparison range.<br>3. Kiểm tra total, delta và series. | - Chỉ tính order cùng tenant có **status hiện tại** là `completed`.<br>- MYR và currency null legacy được tính; USD/SGD bị loại.<br>- COD không có ngoại lệ; payment method/payment status không thay đổi kết quả.<br>- Refunded và mọi status khác bị loại.<br>- Revenue ghi nhận theo UTC `createdAt`, không dùng ngày completed/payment.<br>- Total, delta và zero-filled series lấy từ cùng một aggregate, không có cap 2.000 documents.<br>- Giá trị malformed hoặc phép tính overflow được chuẩn hóa để total, delta và series không trả `NaN`/`Infinity`.<br>- User có quyền đọc Orders nhận aggregate; user không có quyền đọc Orders không chạy Orders Revenue query và nhận zero/empty Revenue. | Blocker | [x] |
| **TC-F03.06** | `US-01/AC-1` | `Math` | **[Metric Math]** Tính Unique Visitors chính xác | 1. Tải thẻ Traffic trên Dashboard. | - Đếm đúng theo Session ID (Unique Visitor).<br>- Không đếm tổng số lần hit trang. | Blocker | [ ] |
| **TC-F03.07** | `US-01/AC-2` | `Func/UX` | **[Filter]** Lọc dữ liệu theo khoảng thời gian | 1. Nhấn mở menu bộ lọc thời gian.<br>2. Lần lượt chọn các tùy chọn: 7d, 14d, 30d, 90d. | - 4 thẻ Stat Card cập nhật dữ liệu ngay lập tức.<br>- Không reload lại trang. | High | [x] |
| **TC-F03.08** | `US-01/AC-2` | `Storage` | **[Session]** Ghi nhớ trạng thái bộ lọc sau khi F5 | 1. Chỉnh filter sang `30d`.<br>2. Nhấn F5 reload trang. | - Trang phục hồi về filter `30d`.<br>- Dữ liệu hiển thị khớp với lựa chọn đã lưu. | Medium | [x] |
| **TC-F03.09** | `US-01/AC-2` | `Boundary` | **[Data Load]** Thử nghiệm tải 100,000 records | 1. Chèn dữ liệu khổng lồ vào DB.<br>2. Chọn filter `All Time`. | - Trang không bị crash hay treo.<br>- Dữ liệu được stream/phân trang.<br>- Response SLA < 2 giây. | Blocker | [x] |
| **TC-F03.10** | `US-01/AC-2` | `Boundary` | **[Rage Click]** Chặn spam click vào bộ lọc | 1. Nhấp liên tục vào nút Filter 10 lần trong 1 giây. | - Debouncer chỉ gọi 1 API request (lần click cuối).<br>- Không spam API. | High | [x] |
| **TC-F03.11** | `US-01/AC-3` | `Func/UI` | **[Customize]** Lưu/Hủy tùy chỉnh layout card | 1. Nhấn "Tùy chỉnh Dashboard".<br>2. Bỏ tick một số card, nhấn **Cancel**.<br>3. Thử lại, kéo thả và nhấn **Save Changes**. | - Nhấn Cancel: layout không thay đổi.<br>- Nhấn Save Changes: layout cập nhật ngay lập tức. | High | [ ] |
| **TC-F03.12** | `US-01/AC-3` | `Desktop` | **[DND Mouse]** Drag & Drop trên PC | 1. Dùng chuột kéo một Card từ vị trí A sang B. | - Card di chuyển mượt mà.<br>- State thứ tự mảng được cập nhật đúng. | High | [x] |
| **TC-F03.13** | `US-01/AC-3` | `Mobile` | **[DND Touch]** Drag & Drop cảm ứng (iPhone) | 1. Trên iPhone 375px, giữ long-press một card và kéo sang vị trí khác. | - Không conflict với hành động cuộn trang.<br>- Card di chuyển đến đúng vị trí mong muốn. | Blocker | [ ] |
| **TC-F03.14** | `US-01/AC-3` | `Edge` | **[Sync Tab]** Xử lý thay đổi cấu hình đồng thời trên nhiều tab | 1. Đổi cấu hình card ở Tab 1.<br>2. Quan sát Tab 2 cùng đăng nhập. | - Hệ thống không crash.<br>- Ghi nhận phiên bản mới nhất khi có xung đột. | Medium | [ ] |
| **TC-F03.15** | `NFR/Perf` | `Perf/UI` | **[UX Load]** Skeleton shimmer khi tải trang | 1. Tải nhanh trang `/dashboard`. | - Hiển thị khung skeleton nhấp nháy trong khi chờ dữ liệu.<br>- Không hiển thị spinner (vòng tròn xoay). | Medium | [x] |
| **TC-F03.16** | `NFR/Sec` | `Security` | **[Auth Redirect]** Redirect về Login khi hết session | 1. Xóa LocalStorage/cookie.<br>2. Gửi request vào URL bất kỳ của Dashboard. | - Redirect về `/login`.<br>- API trả về `HTTP 401 Unauthorized`. | Blocker | [x] |
| **TC-F03.17** | `NFR/Sec` | `Access` | **[Tenant Rules]** Cô lập dữ liệu giữa các Tenant | 1. Sửa tham số TenantID trong request để trỏ sang tenant khác.<br>2. Gửi request. | - Server từ chối với `HTTP 403 Forbidden`.<br>- Không trả về dữ liệu của tenant khác. | Blocker | [x] |
| **TC-F03.18** | `NFR/Mobile` | `UI/Layout` | **[Responsive]** Breakpoint Mobile 375px | 1. Thu hẹp viewport xuống 375px. | - Thẻ Card hiển thị dạng grid 2x2.<br>- Sidebar ẩn, thay bằng hamburger menu trên header.<br>- Không có text bị tràn ra ngoài. | Blocker | [x] |

---

### US-02: Analytics Details

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.19** | `US-02/AC-1` | `Func` | **[Chart View]** Bar Chart render chuẩn | 1. Vào `/dashboard/analytics`.<br>2. Chờ biểu đồ tải xong. | - Biểu đồ hiển thị trục X/Y với dữ liệu theo ngày.<br>- Không chèn lấn layout. | High | [x] |
| **TC-F03.20** | `US-02/AC-1` | `Touch` | **[Tooltip]** Tooltip dữ liệu trên cảm ứng | 1. Dùng màn hình Tablet, tap vào đầu cột dữ liệu trên biểu đồ. | - Tooltip hiển thị đúng số liệu.<br>- Không phụ thuộc vào hover chuột.<br>- Tooltip không tràn ra khỏi viewport. | High | [ ] |
| **TC-F03.21** | `US-02/AC-1` | `Render` | **[Safari Bug]** Kiểm tra CSS render trên Safari | 1. Tải trang Analytics bằng macOS Safari. | - Biểu đồ không bị nhòe.<br>- Layout không bị vỡ Flex/Grid. | Medium | [ ] |
| **TC-F03.22** | `US-02/AC-1` | `Boundary` | **[Data Limits]** Giới hạn Top Pages/Products hiển thị | 1. Đẩy hơn 50 rows traffic vào DB.<br>2. Xem component Top Pages/Products/Blogs. | - Chỉ hiển thị tối đa 10 dòng.<br>- DOM nhẹ, không render quá mức. | High | [x] |
| **TC-F03.23** | `US-02/AC-1` | `Math` | **[Delta +]** Tính tỷ lệ tăng trưởng dương | 1. Cấu hình dữ liệu: kỳ trước = 1500, kỳ này = 2000. | - Hiển thị `+33.3%` màu xanh lá với mũi tên lên. | Blocker | [x] |
| **TC-F03.24** | `US-02/AC-1` | `Math` | **[Delta -]** Tính tỷ lệ suy giảm âm | 1. Cấu hình dữ liệu: kỳ trước = 300, kỳ này = 200. | - Hiển thị `-33.3%` màu đỏ với mũi tên xuống. | Blocker | [x] |
| **TC-F03.25** | `US-02/AC-1` | `Math Zero` | **[Fail-safe Formula]** Xử lý chia cho 0 | 1. Cấu hình dữ liệu: kỳ trước = 0, kỳ này = 500. | - Không hiển thị `Infinity` hoặc `NaN`.<br>- Hiển thị `N/A` hoặc `+100% Growth`. | Blocker | [x] |
| **TC-F03.26** | `US-02/AC-2` | `UX` | **[Empty Logic]** Khoảng thời gian không có dữ liệu | 1. Chọn bộ lọc thời gian không có record trong DB. | - Thay biểu đồ bằng thông báo "Chưa có dữ liệu trong kỳ này".<br>- 4 thẻ Card hiển thị giá trị 0. | High | [x] |
| **TC-F03.27** | `US-02/AC-3` | `Failover` | **[API Crash]** Xử lý timeout khi API analytics lỗi | 1. Dùng DevTools block request `/api/analytics/`. | - Không treo toàn bộ trang.<br>- Hiển thị thông báo lỗi và nút "Thử Lại". | Blocker | [x] |
| **TC-F03.28** | `BR-02/Sec` | `Privacy` | **[Data Crypto]** Mã hóa IP người dùng trong log | 1. Kiểm tra log backend khi có user thao tác. | - Địa chỉ IP được mã hóa SHA-256.<br>- Không lưu plaintext IP trong DB. | Blocker | [x] |
| **TC-F03.66** | `US-02/AC-1` | `Func` | **[Top Blogs — Happy Path]** Widget hiển thị blog kèm view count khi có traffic thực tế (GH-1386) | 1. Đăng nhập Owner có ≥1 blog đã publish.<br>2. Đảm bảo có visitor (non-owner) đã truy cập blog post trong 7 ngày qua.<br>3. Vào Dashboard → Analytics → tab Top Blogs.<br>4. Chọn range 7 Days. | - Widget liệt kê blog posts kèm view count, sort descending.<br>- Số liệu nhất quán với Traffic Overview chart (cùng range).<br>- Click vào blog row → mở đúng blog post. | Blocker | [ ] |
| **TC-F03.67** | `US-02/AC-1` | `Boundary` | **[Top Blogs — Empty State]** Empty state chỉ hiển thị khi thực sự không có blog pageview (GH-1386) | 1. Dùng tài khoản Owner có site published nhưng chưa có ai (non-owner) truy cập blog trong range đã chọn.<br>2. Vào tab Top Blogs. | - Hiển thị empty state "No data available for this period."<br>- Traffic Overview có thể có data (non-blog pages) nhưng Top Blogs rỗng = expected.<br>- Nếu có blog traffic → phải hiển thị (không được rỗng giả). | High | [ ] |

---

### US-03: SEO Dashboard Overview

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.29** | `US-03/AC-1` | `Func/UI` | **[Score Board]** Widget điểm SEO tổng quan | 1. Truy cập Dashboard → SEO Health. | - Chỉ có một score /100.<br>- Không có Score History.<br>- Bốn bucket bars hiển thị dạng 2×2, không hiện điểm bucket.<br>- Root-cause issues dùng đúng badge AI/You, CTA và destination theo F37 §12.3.<br>- AI Fix All chỉ hiện khi còn metadata issue AI-fixable.<br>- Derived/platform metrics không tạo issue trùng. | Blocker | [ ] |
| **TC-F03.31** | `US-03/AC-2` | `Failover` | **[Timeout]** Xử lý khi Auto Scan bị timeout | 1. Giảm băng thông kênh crawer.<br>2. Kích hoạt quét SEO tự động. | - Widget hiển thị thông báo lỗi timeout.<br>- Hiện nút **Retry Scan**. | High | [x] |
| **TC-F03.72** | `US-03/AC-1` | `UI/Copy` | **[CTA Copy]** Hiển thị nhãn nút AI Fix Issues tinh gọn không chứa emoji ở các ngôn ngữ EN/MS | 1. Kiểm tra nhãn nút CTA SEO Fix ở các locale EN và MS trong file i18n và UI component SEOHealthWidget. | - Nút hiển thị chính xác "AI Fix Issues" (EN) và "AI Baiki Isu" (MS), không chứa emoji ✨ hay từ dư thừa ("All"). | High | [x] |


---

### US-05: AI Metadata Fix All

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.39** | `QA/Auto` | `Locator` | **[Conditional CTA]** Nút Fix all with AI | 1. Render có rồi không có title/description issue. | - Có metadata issue: nút `Fix all with AI` hiển thị.<br>- Không có metadata issue: nút vắng mặt.<br>- Total human issues không được dùng để bật nút. | High | [ ] |
| **TC-F03.40** | `US-05/AC-1` | `UX` | **[Propose Mode]** Xem trước thay đổi trước khi áp dụng | 1. Nhấn nút **Fix all with AI**. | - Modal chỉ hiển thị Before/After của meta title/description.<br>- Có checkbox để chọn từng dòng muốn áp dụng hoặc bỏ qua. | Blocker | [ ] |
| **TC-F03.41** | `US-05/AC-1` | `Perf/SLA` | **[SSE 15s Load]** Stream dữ liệu qua SSE < 15 giây | 1. Kích hoạt AI Fix với 20 lỗi meta cần sửa. | - API trả dữ liệu dạng Server-Sent Events (SSE).<br>- Toàn bộ kết quả nhận về trong < 15 giây. | Blocker | [x] |
| **TC-F03.41b** | `US-05/AC-1` | `UI/State` | **[Tracking Checklist]** Hiển thị tiến độ SSE theo từng metadata item | 1. Quan sát UI trong khi SSE đang nhận dữ liệu. | - Thanh progress tăng dần.<br>- Từng meta title/description item có dấu tick xanh xuất hiện tuần tự theo dữ liệu trả về.<br>- Không có content, alt, Local Business, schema, crawler hoặc technical item. | High | [ ] |
| **TC-F03.42** | `NFR/UX` | `Button` | **[State Disable]** Khóa nút khi SSE đang chạy | 1. Nhấn nút sửa dữ liệu trong khi SSE đang kéo. | - Nút chuyển sang Disabled với loading icon.<br>- Không thể gửi thêm request. | High | [x] |
| **TC-F03.43** | `US-05/AC-2` | `Failover` | **[Timeout UI]** Xử lý SSE bị gián đoạn quá 15 giây | 1. Giả lập mạng bị đứt giữa chừng, SSE không nhận response > 15 giây. | - Hiển thị alert "Sự cố kết nối, vui lòng thử lại".<br>- Không treo UI hay vòng lặp vô hạn. | Blocker | [x] |
| **TC-F03.44** | `US-05/AC-2` | `SQL/DB` | **[Rollback DB]** Hoàn tác transaction khi insert thất bại | 1. Gây sự cố ngắt kết nối giữa chừng khi transaction đang insert (từ TC-F03.43). | - Hệ thống rollback toàn bộ transaction.<br>- Không có dữ liệu dở dang hoặc lỗi nửa vời trong DB. | Blocker | [x] |
| **TC-F03.45** | `US-05/AC-1` | `Func` | **[Batch Undo]** Hoàn tác toàn bộ thay đổi AI bằng 1 click | 1. Approve toàn bộ thay đổi AI.<br>2. Nhận thấy kết quả sai, nhấn nút **Hoàn Tác**. | - Toàn bộ nội dung khôi phục về trạng thái trước khi AI sửa.<br>- Hoạt động như Ctrl+Z cho 1 batch. | Blocker | [x] |
| **TC-F03.45b** | `US-05/AC-1` | `Regression` | **[Metadata Boundary]** AI Fix không sửa seller-owned signals | 1. Lưu snapshot Local Business, schema, content, alt text, publish, domain, verification.<br>2. Chạy Fix all with AI cho metadata. | - Chỉ meta title/description thay đổi.<br>- Toàn bộ seller-owned snapshot giữ nguyên. | Blocker | [ ] |

---

### US-06: Basic SEO Keyword Tracker & Cross-Locale UI

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.46** | `US-06/AC-1` | `UI` | **[Keywords Adding]** Thêm từ khóa theo dõi | 1. Nhập từ khóa `Bánh Bao` vào ô input.<br>2. Nhấn Enter. | - Từ khóa xuất hiện dạng chip/tag trong bảng theo dõi. | High | [x] |
| **TC-F03.47** | `US-06/AC-1` | `Boundary` | **[Lock Target 5 Limit]** Giới hạn tối đa 5 từ khóa | 1. Gửi API POST với mảng chứa 6 từ khóa mới. | - API từ chối, trả về validation error "Không thể thêm quá 5 từ khóa".<br>- Ô input bị disable. | High | [x] |
| **TC-F03.48** | `US-06/AC-2` | `View` | **[Ranking SERP]** Hiển thị thứ hạng Google của từng từ khóa | 1. Quan sát bảng danh sách từ khóa đang theo dõi. | - Cột thứ hạng hiển thị rõ ràng vị trí trên Google (vd: #12). | High | [x] |
| **TC-F03.49** | `US-06/AC-2` | `UX` | **[Trend Arrows]** Mũi tên xu hướng thứ hạng | 1. Xem danh sách từ khóa sau khi có dữ liệu cũ/mới. | - Tăng hạng: mũi tên lên 🔺 (xanh).<br>- Giảm hạng: mũi tên xuống 🔻 (đỏ).<br>- Không đổi: dấu ➖. | Medium | [ ] |
| **TC-F03.50** | `US-06/AC-3` | `Worker` | **[Background Job]** Cron job crawl thứ hạng ban đêm | 1. Kiểm tra log backend lúc 00:00 AM. | - Service tự động crawl thứ hạng Google cho từng từ khóa.<br>- Dữ liệu mới nhất hiển thị khi admin mở Dashboard sáng hôm sau. | Blocker | [x] |
| **TC-F03.51** | `BR-05/F21` | `Integrate` | **[Malaysia Targeting]** Crawl thứ hạng từ Google.com.my | 1. Cài đặt locale người dùng là `ms` (Malaysia/Indonesia). | - Hệ thống crawl thứ hạng từ Google.com.my thay vì Google.com.<br>- Kết quả phản ánh đúng thị trường địa phương. | High | [x] |
| **TC-F03.52** | `Sec/SQLi` | `Security` | **[Sanitization]** Chặn SQL Injection qua ô nhập từ khóa | 1. Nhập chuỗi tấn công vào ô từ khóa: `` `; DROP TABLE Keywords; --` ``.<br>2. Submit. | - Input được sanitize, không thực thi lệnh SQL.<br>- Dữ liệu DB không bị ảnh hưởng. | Blocker | [x] |

---

### Integration: F21 Localization (BM/EN) — Dashboard UI

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.53** | `F21/UI` | `State` | **[No-Reload Switch]** Chuyển ngôn ngữ không reload trang | 1. Chọn ngôn ngữ **Bahasa Melayu** trong dropdown trên header. | - Nhãn biểu đồ, tên card, labels chuyển sang BM ngay lập tức.<br>- Trang không reload (SPA behavior). | High | [x] |
| **TC-F03.54** | `F21/Data` | `Data Form` | **[Protect Dynamic User Payload]** Không dịch nội dung người dùng tự nhập | 1. Chuyển sang giao diện Bahasa Melayu.<br>2. Quan sát tiêu đề bài viết trong danh sách. | - Tiêu đề bài viết do người dùng nhập giữ nguyên gốc, không bị dịch tự động.<br>- Chỉ nhãn UI (tên column, button...) mới được dịch. | Blocker | [x] |
| **TC-F03.55** | `GH-1627/AC-R01,R05,R07; F21/UI` | `Format/Unit` | **[Currency Format RM]** Định dạng tiền theo chuẩn Malaysia | 1. Render thẻ Revenue với giá trị 0, số có phần thập phân và locale EN/MS.<br>2. Quan sát total, delta, comparison note và sparkline. | - Số tiền hiển thị `RM 0.00` hoặc dạng nhóm như `RM 200,342.11`, luôn đúng 2 chữ số thập phân và không dùng `$`.<br>- Card không còn trạng thái Coming Soon.<br>- Nhãn/note đổi theo EN/MS; dữ liệu động và định dạng MYR không bị dịch.<br>- Delta và sparkline hiển thị từ cùng dữ liệu Revenue. | Medium | [x] |
| **TC-F03.56** | `F21/UI` | `Format` | **[Date Format]** Định dạng ngày trên biểu đồ theo locale | 1. Hover hoặc tap vào cột dữ liệu trên biểu đồ. | - Ngày hiển thị theo format `DD/MM/YYYY` (Malaysia) thay vì `MM/DD/YYYY` (Mỹ). | High | [ ] |
| **TC-F03.57** | `F05/Flow` | `E2E/UAT` | **[End-to-End]** Duyệt đơn hàng và dashboard cập nhật real-time | 1. Đăng nhập, Dashboard F03 hiển thị đơn hàng #002 đang chờ duyệt.<br>2. Vào F10, duyệt đơn hàng #002.<br>3. Quay lại F03 Dashboard. | - Danh sách "Action Required" không còn đơn #002.<br>- Metric doanh thu được cộng thêm giá trị đơn #002.<br>- Không crash, dữ liệu sync đúng. | Blocker | [x] |
| **TC-F03.58** | `F03/Onboarding` | `Func` | **[Onboarding Null]** DashboardOnboarding trả về null khi hoàn tất tất cả 4 bước | 1. Set hasProducts=true, isDesignCustomized=true, hasPaymentConfigured=true, hasPublishedSite=true.<br>2. Render DashboardOnboarding. | - Component trả về null (không hiển thị gì). | High | [x] |
| **TC-F03.59** | `F03/Onboarding` | `UI` | **[Step States]** Bước đầu tiên chưa hoàn thành hiển thị nút "Continue"; các bước hoàn thành hiển thị CheckCircle2; bước khóa không có nút | 1. Set hasProducts=false (đầu tiên chưa xong), isDesignCustomized=true, hasPaymentConfigured=true, hasPublishedSite=true.<br>2. Render component. | - Bước "Add Your First Product" (chưa xong) hiển thị nút "Continue".<br>- Bước "Customize Your Store Design" (hoàn thành) hiển thị icon CheckCircle2 xanh lá.<br>- Bước "Set Up Payment & Shipping" (khóa) không hiển thị nút. | High | [x] |
| **TC-F03.60** | `F03/Onboarding` | `Math` | **[Progress Percentage]** Tính % tiến độ = (completedCount / 4) * 100 | 1. Set 0/4 tasks done: hasProducts=false, isDesignCustomized=false, hasPaymentConfigured=false, hasPublishedSite=false.<br>2. Set 2/4 done: hasProducts=true, isDesignCustomized=true, others false.<br>3. Set 4/4 done (return null). | - 0/4 → Progress = 0%.<br>- 2/4 → Progress = 50%.<br>- 4/4 → Component returns null. | High | [x] |
| **TC-F03.61** | `F03/Onboarding` | `Integrate` | **[SetupAlertBanner Render]** SetupAlertBanner được render khi hasPaymentConfigured=false; không render khi true | 1. Set hasPaymentConfigured=false, render DashboardOnboarding.<br>2. Set hasPaymentConfigured=true, render again. | - hasPaymentConfigured=false → SetupAlertBanner visible với nút "Complete Setup".<br>- hasPaymentConfigured=true → SetupAlertBanner không render. | High | [x] |
| **TC-F03.62** | `F03/SetupBanner` | `Func` | **[Banner Visibility]** SetupAlertBanner hiển thị khi hasPaymentConfigured=false | 1. Render SetupAlertBanner với hasPaymentConfigured=false. | - Banner visible, hiển thị text "Your Store is Almost Ready!" và nút. | High | [x] |
| **TC-F03.63** | `F03/SetupBanner` | `Func` | **[Banner Hidden]** SetupAlertBanner trả về null (không render) khi hasPaymentConfigured=true | 1. Render SetupAlertBanner với hasPaymentConfigured=true. | - Component không render gì (return null). | High | [x] |
| **TC-F03.64** | `F03/SetupBanner` | `UX` | **[Dismiss Action]** Nút "I'll do this later" ghi sessionStorage + ẩn banner | 1. Render SetupAlertBanner, sessionStorage trống.<br>2. Click nút "I'll do this later".<br>3. Render lại component. | - Sau click: sessionStorage.getItem('onboarding_banner_dismissed') = 'true'.<br>- Banner ẩn ngay sau click.<br>- Re-render không hiển thị banner (đã dismissed). | High | [x] |
| **TC-F03.65** | `F03/SetupBanner` | `Link` | **[Complete Setup Link]** Nút "Complete Setup" link đến /settings/payments | 1. Render SetupAlertBanner. | - Nút "Complete Setup" có href="/settings/payments". | High | [x] |

---

### GH-1491: Dashboard Responsive Fixes (Welcome popup scroll, at-a-glance layout, top tabs wrap)

> Unit tests below verify the JS/DOM-level behavior (hook logic, scroll-lock lifecycle). The
> CSS breakpoint layout itself (2-row wrap, tab scroll, value+delta 1-row) isn't verifiable
> in jsdom — no real media-query evaluation — so those parts rely on manual/QA visual check
> at 375/768/1280 per the issue's test matrix, not automated coverage here.

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F03.68** | `GH-1491/Issue1` | `Unit` | **[Scroll Lock]** `useLockBodyScroll(true)` sets `body.style.overflow=hidden`; unmount restores it | 1. Render hook với `locked=true`.<br>2. Unmount. | - Overflow = `hidden` khi mount.<br>- Overflow = `''` sau unmount. | Blocker | [x] |
| **TC-F03.69** | `GH-1491/Issue1` | `Unit` | **[Scroll Lock Toggle]** Toggle `locked` false→true→false lock rồi restore đúng lúc | 1. Render hook `locked=false`.<br>2. Rerender `locked=true`.<br>3. Rerender `locked=false`. | - Ban đầu `''`.<br>- Sau true: `hidden`.<br>- Sau false: `''` lại. | High | [x] |
| **TC-F03.70** | `GH-1491/Issue1` | `Unit` | **[Overlapping Locks]** 2 modal cùng lock — đóng 1 cái không mở khóa scroll khi cái kia còn mở | 1. Mount 2 instance `useLockBodyScroll(true)` độc lập.<br>2. Unmount instance A.<br>3. Unmount instance B. | - Sau unmount A: vẫn `hidden` (B còn mở).<br>- Sau unmount B: restore `''`. | High | [x] |
| **TC-F03.71** | `GH-1491/Issue1` | `Integrate` | **[Welcome Popup = Customize Modal]** Mở Customize dashboard modal lock scroll nền; đóng (Cancel) hoặc unmount restore lại | 1. Render `CustomizeModal`.<br>2. Click nút mở modal.<br>3. Click Cancel. | - Mở: `document.body.style.overflow === 'hidden'`.<br>- Đóng: restore `''`. | Blocker | [x] |
| **TC-F03.72** | `GH-1627/AC-2` | `Unit/UI` | **[Pending Empty State]** Hiển thị empty state khi không có đơn Pending | 1. Tài khoản hợp lệ có site và quyền xem Orders.<br>2. Loader trả về 0 đơn Pending.<br>3. Mở Dashboard. | - Hiển thị tiêu đề và mô tả empty state đã localization bằng pattern `.empty-block` dùng chung.<br>- Không render link chi tiết đơn hàng. | High | [x] |
| **TC-F03.73** | `GH-1627/AC-3` | `Unit/Sec` | **[Pending Visibility Gates]** Chỉ query/render widget khi đủ điều kiện | 1. Lần lượt kiểm tra: không có tenant, không có site khả dụng, block Orders bị tắt, membership không active hoặc role không có quyền Orders.<br>2. Kiểm tra trường hợp đủ tenant + site + block + quyền. | - Trường hợp thiếu bất kỳ điều kiện nào: không query đơn và không render widget.<br>- Trường hợp hợp lệ: gọi loader bằng user hiện tại và render widget. | Blocker | [x] |
| **TC-F03.74** | `GH-1627/AC-4` | `Unit/Failover` | **[Pending Failover]** Lỗi tải Orders không làm hỏng Dashboard | 1. Cho loader Pending Orders reject.<br>2. Mở Dashboard. | - Widget hiển thị trạng thái unavailable riêng biệt.<br>- Các block Dashboard độc lập vẫn render.<br>- Log lỗi không chứa tenant/order/customer payload. | Blocker | [x] |
| **TC-F03.75** | `F03/Regression` | `Unit/UI` | **[Greeting Regression]** DashboardGreeting vẫn render tiêu đề | 1. Render `DashboardGreeting`. | - Hiển thị tiêu đề và mô tả Dashboard đúng localization. | Medium | [x] |
| **TC-F03.76** | `F03/Regression` | `Unit/UI` | **[Site Grid Regression]** DashboardSiteGrid vẫn render danh sách site | 1. Render grid với nhiều site. | - Hiển thị đúng tên từng site card. | Medium | [x] |
| **TC-F03.77** | `GH-1627/AC-R03,R04,R08; F03/UTC Contract` | `Unit/Integration/Boundary` | **[Shared UTC Boundaries]** Cả 4 At-a-glance metrics dùng cùng UTC0 contract | 1. Kiểm tra `today`, `7d`, `30d` tại ranh giới ngày/tháng và bằng instant có non-UTC offset.<br>2. Kiểm tra Payload bounds và SQL grouping của Views, Leads, Engagement, Revenue. | - Constant chung là `DASHBOARD_TIME_ZONE = UTC`.<br>- Current/comparison windows half-open, bằng nhau và không overlap.<br>- Series có chính xác 1/7/30 UTC day keys.<br>- Range label/day key không phụ thuộc timezone của Node host.<br>- Mọi SQL daily grouping dùng explicit UTC, không phụ thuộc PostgreSQL session timezone.<br>- PostgreSQL regression chạy production loader với TEMP enum/tables, kiểm tra completed-only, MYR/null, tenant/date boundaries và real Orders permission gate. | Blocker | [x] |

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | User chưa đăng nhập truy cập Dashboard. | Redirect về `/login` (TC-F03.16). |
| 2 | Đăng nhập thành công, Dashboard tải dữ liệu lớn. | Skeleton shimmer hiển thị, sau đó 4 thẻ metric render < 2s (TC-F03.09, 15). |
| 3 | Chuyển filter từ 7d → 30d, reload lại trang. | Dữ liệu cập nhật ngay, filter được ghi nhớ sau F5 (TC-F03.07, 08). |
| 4 | Vào Analytics, tap biểu đồ trên Tablet. | Tooltip đúng số liệu, không phụ thuộc hover chuột (TC-F03.20). |
| 5 | Nhấn AI Fix All → nhận SSE → approve → undo. | Toàn bộ luồng hoạt động, rollback thành công (TC-F03.40–45). |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. UI/UX & Responsive Touch** | [ ] 0/15 | Kiểm tra layout Safari, Tablet tooltip, mobile breakpoint. |
| **2. BDD/Math Logic Validation** | [ ] 0/14 | Kiểm tra Delta %, chia cho 0, filter trạng thái đơn hàng. |
| **3. Non-Functional Perf & Load** | [ ] 0/8 | K6 load 100K records, SSE < 15s, SLA < 2s, RabbitMQ retry. `EXPLAIN ANALYZE` cho Revenue aggregate trên database local/disposable có dữ liệu đại diện vẫn chưa chạy; chưa xác nhận query plan hoặc nhu cầu index. |
| **4. Integration & Security Flow** | [ ] 0/11 | SHA-256 IP hashing, Tenant isolation, SQL injection sanitize. |
| **5. Cross-Language (F21)** | [ ] 0/6 | Chuyển ngôn ngữ mượt, format RM, date DD/MM/YYYY, không dịch nội dung gốc. |
| **6. Automation Pipeline** | [ ] Chưa cấu hình | CI/CD GitHub Actions, BDD Cucumber, không flaky test. |

> **Khuyến Nghị Release:** Các lỗi tiềm ẩn chính của F03 là: Division by Zero trong Math, timeout SSE do OpenAI chậm, và tràn memory khi tải 100K records. Cần chạy automation load test trước khi release Production.
