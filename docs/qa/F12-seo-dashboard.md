# Test Cases: SEO Dashboard (F12)

**Feature:** F12 — SEO Dashboard & Crawler Support
**Reference:** US-009, US-010, US-011

---

## 1. Functional & Validation (Chức năng & Kiểm soát dữ liệu)

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-12.01 | Verify Crawler Chấm Điểm Audit Tổng Quan SEO Score (Health Dashboard App) (Happy Path) | User Load Tên Miền App | 1. Mở Cửa Sổ Trình Report Giao Diện Admin Menu `SEO`. View Report Score. | Data Điểm DB Chấm /100 Scale | Load UI Panel Điểm Số Phân Tích Hiện % Kèm Bảng Biểu Trình Báo Danh Sách Các Trang Missing Kẽ Hở (Lỗi Meta/Lỗi Thẻ Keyword Image Text). | High |
| TC-12.02 | Verify Chức Năng Căn Bản Tạo Được Khung Cây Sơ Đồ XML Mapping Tree Auto `sitemap.xml` | CSDL Có Số Bài CMS Và URL Page Published Bật Sẵn Lấy Link Cần. | 1. Nhập Bấm Update XML Auto Triggers.<br>2. Nhập Browser Call Gõ Link URL Phụ `/sitemap.xml`. | HTTP Get `/sitemap.xml` Request | Trả Node Code Text Cấu Hình Render Thẻ Tags XML Thuần Header Valid Gốc `<url><loc+lastmod></url>`. Tốt Chuẩn Search Schema Khuyến Nghị Google. | High |
| TC-12.03 | Verify Nổ Đỏ Chấm Lỗi Rác Bỏ Trống Trường Meta Form Core Khi Content Rỗng Trắng SEO Fields **[Negative]** | Giao Diện Nhập CMS Blog Tạo Page Form. | 1. Mặc Kệ Trắng TextBox Trôi Lệnh Không Đánh Type Văn Cho Vùng Input Thẻ `Title`, `Meta Desc`. Cứ Cứ Bấm Save Publish | `metaTitle` = Rỗng | Report Tool Sẽ Phạt Thang Mức Đỏ Trừ Thẳng Thẻ Score Điểm CMS Trang Trắng Ấy. Khóa Valid SEO Error Đưa Hàng Đăng Lên Bảng Truy Nã Dashboard. | High |
| TC-12.04 | Verify Report Báo Sai Tuyệt Luồng Data Ảo Link Trạng Draft / Nháp Ẩn Giấu Ngầm Trong XML Cây Public **[Negative]** | Admin Tạo Form Nháp CMS Unpublished Trạng Draft Giấu Kín | 1. Render Hit Tái Kích Hoạt Nút Nhổ Dữ Sơ Đồ XML Gọi. Đọc Text `<loc>` Nối Code Lấy Url File Ra. Cố Soi Link Đã Đánh Nháp | `Status` Page: "Draft" Mode | Trạng Thái Nháp Phải Tuyệt Đối Không Có Mặt Ở File Này. Lượt Quét Spider Google Chỉ Được Cho Phép Index Bài Published Xong. Lỗi Cấm Nạp Code Tải Leak Sơ Đồ XML Ra Sớm | Khẩn |
| TC-12.05 | Verify Thuật Toán Conflict Chỉnh Dấu SEO Trùng Định Dạng Đầu Đuôi Header (Double Tag Crash Engine SEO Rank) **[Negative]** | Layout Theme Editor Front Tiền | 1. Tool Cầm Quét Chuột F12 Inspector Bấm Dò Rọi Từng CẶP THẺ `<HEAD>` Meta Cứng Ở Nextjs Build Static Render | DOM Page Front Component | Component Gán Lệnh Chèn Code Không Dump Chèn Thẻ Đè 2 Phát Trùng Nhau Đúp (Hai `<title>` Nhau, Hoặc Đôi Code 2 Lần `<meta description>`). Ảnh Hưởng Bot Spider Ngạt Rank Code Sập Xung Đột Nhau. Buộc Phải Fix Single Tag Head Chuẩn. | Khẩn |
| TC-12.06 | Verify Cập Nhật Hàng Loạt Gán Default Alt Text Cho Media Nếu User Lười Ghi Bằng AI **[Admin Operation]** | Giao Diện Trình Dashboard Quét Nhận 50 Ảnh Thiếu Văn Bản. | 1. Tool Cho Ấn Phát Chữ Dòng Action `Thúc AI Điền Thay Alt` Cho Hàng Loạt. | Nhóm IDs Thẻ Rỗng Cần Điền. | Data Node Trả Ảnh Nhận Get API Caption Vision Hoặc Prompt NLP. Bù Sạch 50 Thẻ Nào Hở Gọn Đẹp, Không Cần Mở Tab Form Photo Gõ Vô Nghĩa Nhạt Phèo `Anh Bán Áo 01 02` Nữa. Chấm Thang Điểm Fix | Medium |

---

## 2. UI/UX, Edge Cases & Compatibility

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-12.07 | Verify Form Meta Text Có Đo Đếm Thước (Gauge Bar) Đạt Chuẩn Kí Tự Xanh Của SEO UX **[UX Empathy]** | Panel Edit Thẻ Meta SEO Post | 1. Rê type gõ kí tự trên bàn Phím Box Type `Meta Description`. | Mảng Text Length Count Dài Hơn 120 | Có Cây Thước Đo Bo Viền ToolTip Dẫn Form Hành Trình. Nếu Ngữ Quá Rỗng < 50 Hiện Đỏ, Mức Vừa Trúng Chuẩn 130 Kí Tự Vàng Khéo SEO Hiện Xanh Lá Cây Tốt, Viết Vượt 160 Ký Tự Trượt Xấu Dẫn Xám Đỏ Cắt Cụt Giới Hạn Báo User. | High |
| TC-12.08 | Verify Viết Báo Lỗi SEO Plain English Giản Đơn Ít Mang Tính Jargon/Kĩ Sư Code Thuần Tránh Nghẽn Tầm Đọc User Chủ Web Ko Rành **[UX Empathy]** | Radar Scan Panel Tool Table Audit Hiện Báo Ghi Lệnh | 1. Chạm Read 1 Dòng Cảnh Báo "Tình Trạng: Thẻ `H1` Lỗi Render Bị Thiếu DOM". | Form Chữ Data Text Trưng Diện Mắt   | Dòng Cảnh Giới Form Chuyển Ngay Ra Câu Sinh Ngữ Bám Khách "Bạn Đang Thiếu Tiêu Đề Chính Cho Bài Này Nhé, Trình Google Đang Khó Tính Tìm! (Mã: H1 Missing)". Giải Nghĩa Thân Mật Trúng Lỗi Xử UX Giao Chiến Báo Báo System Log Khú. | High |
| TC-12.09 | Verify Hành Động Chạy Thẳng Nút Trơn (⚡ Fix All Issues AI Bot) Sửa Máy Móc Tràn Ngập Data Chống Khựng Đơ Form Layout | Hằng Hà Sa Số Hơn Vài Trăm Lỗi | 1. User Vừa Bấm Vào Cục Trigger Cả Gói Update Lần Tức Thì (Bulk Process Mode). | UI Process Animation State Nhấp Nháy. | Thanh Trượt Animation Progress Trơn Lượn Tùy Ý 0 -> Vạch 100%. Web Không Bắn Phản Hồi Đứng Giật, Treo Cứng Window Chuột Kẹt. Refresh Bảng Data Chạy Sạch Lệnh Lưu Điểm Phục Hồi Score Up Lên Level Xịn | High |
| TC-12.10 | Verify Trải Nghiệm Điều Hướng Sửa Trực Nhanh Chuyển Cảnh Navigation Nhấp Thông Lỗi Báo Chéo Trang Edit SEO Riêng Fix Trực Diện | Bảng Báo Lỗi Radar Row Cảnh Báo Data | 1. Bấm Nút Action Chữ / Mũi Tên Link Đè Nép Vào Lỗi Issue "Ảnh Này Cần Bổ Sung Từ Khóa ALT Text". | Navigation Cục Bộ App Flow Bảng Báo Cáo. | Tab Link Component Push Đi Chuyển Qua Form Edit Đúng Chóc ID Hình/Bài Đó Trong Panel CMS Trình Chỉnh Sửa Trượt Nạp Component Thuộc Nhánh Nào Thì Nhảy Menu Right Sidebar Chỗ Ấy, Sẵn Khung Type Bàn Phím Thay Bắt Trượt Tự Dò. | High |
| TC-12.11 | Verify Tính Năng Ctrl+Z Phục Hồi Cứu Dữ Liệu Sau Bấm Bất Ổn Chạy Bulk SEO (Interrupt / Revert Tool). | Đã Vừa Lỡ Submit Lệnh AI Generate Hàng Loạt | 1. Nhận Rằng Data Sửa By AI Sai Ngữ Cảnh.<br>2. Bấm Chữ Undo / Shortcut Thu Hồi. | Undo Memento Ghi Cấu Hình CMS | API Phá Bỏ Sạch Transaction Chùm Undo Back Về Kịch Bản Memento Gốc Không Thiệt Hại Thêm Thẻ Điểm Đen Data Mũi Nào Móp Rác Form. Xóa Điểm SEO Khỏi CMS Database DB SQL Rớt Trở Về Lúc Chấm Cũ. | Medium |
| TC-12.12 | Verify View Tương Thích Biểu Đồ Radar Chấm Dashboard Không Tràn Màn Hình Canvas Móp Méo Ở Hệ Mobile View Giao Diện | Thiết Bị iOS Web Phone Hoặc Tắt Split Chrome Nhỏ < 400PX Width. | 1. Vào Màn Giao Diện Analytics Điểm Số 100 / Biểu Đồ Radar Đa Chiều Form Lỗi Màng Nhện. | Viewport CSS Mobile Flex | Element Vector / Image Canvas Render Phải Biết Resized Co Tỉ Lệ Đều Cân Nhau Ở Màn Điện Thoại Nhỏ Chứ Không Được Lấn Cắt Biến Đứt Dọc Chart Ẩn Ra Viền, Mất Click Hover ToolTip Khi Touch. | Medium |

---

## 3. Performance & Security

| ID | Title | Pre-condition | Steps | Test Data | Expected Result | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| TC-12.13 | Verify Kẽ Hở Ranh Mã Header Tag Injection XSS Mã Độc Gửi Tiêm Trúng Sờ Cào Sitemap Node Lỗi Phá Ban Kẹt Phá Header Form XML **[Negative]** | Tool Gọi Lệnh Form Cập Nhật | 1. Nguồn Data Tên Trang, Tên Topic Chèn Hacker `<loc>Bệnh</loc><script src=ha>Cấm</script><loc>` | Inject Data XML Lệnh Tiêm Payload | Parse Hàm Encode Sanitize Lọc Bay Mọi Thứ Cặn Cú Cáo Lõi Mở Rộng Bọc JSON / Node Mã XML Ở Chuẩn Tinh Gọn Để Xuất Code XML View Sitemap. Tránh Tiêm Phá Lỗi Parsing Error Lụi Đứt Chết Nút Khách Hàng Chọt Google Console Đọc Data Crawl Báo Cấm Từ Chối Mảng Search Results Lộ Trống Lệnh Tool Hủy Xa Tít. | Khẩn |
| TC-12.14 | Verify Rate Limiting Đẩy Rỗng Bảo Vệ Két Trữ Số Chấm Tiền Tệ OpenAI Request AI Auto Chặn Nạn Trút Nhấp DDoS Đòn Lạm Dụng **[Negative]** | Endpoint Route Chỉnh SEO Bulk Mở | 1. Nhan Cớ Phím Tắt/Bot Curl Nhồi 180 Phát Lệnh Yêu Cầu Tính Lại Chấm Trả Bulk Bỏ Token Cho Rảnh Phút Chót Vớt Liên Trục Hết CPU. | Request Bomb Load CPU/Tokes Quota | API Gateway Đẩy Khiên Khiển Thẳng Mã Response `HTTP 429 Too Many Requests`. Nhằm Siết Bảo Vệ Quả Token Chất Lượng (Tier Pricing LLM) Chịu Thất Thoát Phí Bill Lỗi Oan Uổng Cháy Túi Do Vòi Lọc Đấm Get Dư Liệu Hư. | Khẩn |
| TC-12.15 | Verify Schema Nhúng DOM Code Structured Markup JSON-LD Dành Snippet Mảng Kết Quả Tìm Kiếm Chợ Rich Card Format Cứng. | Test Code Rọi Trả Card Product A Nào Đó Lưng Lộ Mặt | 1. User/ QA Tool Cứ Mở F12 Tab Console / Network View Bóc Inspect Lấy Lõi DOM Raw. Cắm Dò Tìm Chữ `application/ld+json`. | Document DOM Lệnh Mã Search Chữ. | Thấy Có Lòi Khối Thẻ Gói Nhúng Khai Báo Data Cực Sạch Có Hình Vuông Chuẩn, Đầy Đủ Biến Field Google Yêu Cầu (Type=Product / Name / Offer / PriceCurrency = MYR). Kiểm Nhóm Dò Báo Validator Check Passed Không Trượt Điểm Thiếu Cú Cấu Mã Thẻ Khung Đo Đồ Lặn Hụt Ranking Vớt Mốc | Khẩn |
| TC-12.16 | Verify Nguy Cơ OOM (Out Of Memory Crash API Death) Hiệu Năng Tạo Sitemap Tuyệt Cứng Chết Môi Trường JS Server Lúc Có 5,000 Nodes Khổng Lồ **[Negative]** | DB MongoDB Dữ Liệu Dày Chặt. | 1. Tải Load Get File `sitemap.xml` Sinh Động Server Side Route Next. | `Scale Size DB Limit` Tầm Tượng Đáng Tới Vạch 10,000 Nodes | Chống Memory Hút Hết Nhồi JSON Phạt RAM. Logic Xây Dựng Streaming Chunk Ghi Từng Ngấn Dữ Liệu XML Chứ Không Lôi Tất Cục Node Ra Bằng Lệnh `docs[]` Một Nhát Vật Lí Chết Tươi Tiến Trình Next Mảng Build Tĩnh Lụi Tắt 502 Bad Gateway. Tốc Độ Môi Limit Mốc Limit Response Render Giảm Trông Đợi Xấp Xỉ < 1.0 Giây Hoàn Toàn Cache Redis XML File Sẵn. | Khẩn |

---

## 4. Quality 10-Point Checklist Summary

| Hạng mục (10-Point) | Trạng thái | Ghi chú / Test Case Bao Phủ |
|---|---|---|
| 1. Happy Path | [ ] Untested | TC-12.01, TC-12.02, TC-12.06 |
| 2. UI/UX (UX Empathy) | [ ] Untested | TC-12.07, TC-12.08, TC-12.09, TC-12.10 |
| 3. Validation | [ ] Untested | TC-12.03 |
| 4. Boundary | [ ] Untested | TC-12.05, TC-12.07 |
| 5. Data | [ ] Untested | TC-12.15, TC-12.04, TC-12.11 |
| 6. Performance | [ ] Untested | TC-12.16, TC-12.09 |
| 7. Security | [ ] Untested | TC-12.13, TC-12.14 |
| 8. Navigation | [ ] Untested | TC-12.10 |
| 9. Interruption | [ ] Untested | TC-12.11, TC-12.03 |
| 10. Compatibility | [ ] Untested | TC-12.12 |
