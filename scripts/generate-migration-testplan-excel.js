const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const wb = XLSX.utils.book_new();

// -------------------------------------------------------------
// Sheet 0: Lộ Trình Trực Quan & Dashboard (Roadmap Dashboard)
// -------------------------------------------------------------
const visualRoadmapData = [
  ["LỘ TRÌNH KIỂM THỬ TỔNG QUAN (EXECUTIVE VISUAL ROADMAP - 40H / 5 DAYS)", "", "", "", "", ""],
  ["Dự án", "ECH Prime Web v2 (Migration PW1 -> PW2)", "Quy mô", "2.000 Website Merchants", "Nhân sự", "1 QC Tester (40 Man-hours)"],
  ["Mục tiêu", "Đạt Parity Score >= 99%, 0 lỗi P0, 100% ảnh sống HTTP 200, bảo toàn 9 theme chuẩn", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["LỘ TRÌNH 5 NGÀY VÀ MỐC BÀN GIAO (5-DAY MILESTONE TRACKER)", "", "", "", "", ""],
  ["Mốc ngày", "Tiến độ mục tiêu", "Thanh tiến độ (Progress Bar)", "Khối lượng Est", "Trọng tâm kiểm thử", "Mốc bàn giao (Milestone Deliverable)"],
  ["Ngày 1 (Thứ 2)", "20%", "[██░░░░░░░░] 20%", "8.0 Giờ (5 Tasks)", "Setup kết nối MySQL Live & Quét Lớp 1 (CSDL 2.000 store)", "Báo cáo % Pass ban đầu & Danh sách store cờ Đỏ"],
  ["Ngày 2 (Thứ 3)", "40%", "[████░░░░░░] 40%", "8.0 Giờ (4 Tasks)", "Soi CSDL 1-to-1 (Sản phẩm, biến thể SKU, giá tiền)", "Danh sách lỗi P0 kèm sẵn Remediation Script gửi Dev"],
  ["Ngày 3 (Thứ 4)", "60%", "[██████░░░░] 60%", "8.0 Giờ (5 Tasks)", "Quét Lớp 2 (Ảnh chết 404, font tiếng Việt, mất thẻ table)", "Danh sách link ảnh chết & bài viết rớt bảng VietGAP"],
  ["Ngày 4 (Thứ 5)", "80%", "[████████░░] 80%", "8.0 Giờ (5 Tasks)", "So sánh giao diện 9 Theme mẫu (Swipe Slider & Mobile 375px)", "9/9 Theme chuẩn được xác nhận khớp bố cục giao diện"],
  ["Ngày 5 (Thứ 6)", "100%", "[██████████] 100%", "8.0 Giờ (5 Tasks)", "Re-scan toàn hệ thống, kiểm thử Lớp 3 (SSO & E2E) & Cutover", "Biên bản nghiệm thu Cutover hoàn tất, sẵn sàng trỏ DNS"],
  ["", "", "", "", "", ""],
  ["CHIẾN LƯỢC 3 LỚP KIỂM ĐỊNH CHẤT LƯỢNG (3-LAYER QUALITY STRATEGY)", "", "", "", "", ""],
  ["Lớp kiểm thử (Layer)", "Phạm vi & Đối tượng", "Mục tiêu kiểm định", "Phương pháp & Thao tác chi tiết", "Tiêu chuẩn Đạt (Pass)", "Ngăn ngừa rủi ro"],
  [
    "Lớp 1: Toàn Vẹn Dữ Liệu (Data Integrity)",
    "100% toàn bộ 2.000 stores (Không bỏ sót store nào)",
    "Bảo toàn 100% dữ liệu gốc: Sản phẩm, biến thể SKU, giá bán, danh mục, bài viết, đơn hàng",
    "Tool chạy ngầm so sánh từng ô CSDL giữa MySQL PW1 và Postgres PW2; tự động gắn cờ Đỏ (P0) nếu thiếu biến thể hoặc lệch giá; tự động xuất mã Dev Remediation Script để Dev sửa CSDL",
    "Parity Score toàn hệ thống >= 99.0%, 0 lỗi P0 Blocker, 100% không mất biến thể",
    "Triệt tiêu 100% rủi ro mất dữ liệu của merchant, dù là shop to hay shop nhỏ"
  ],
  [
    "Lớp 2: Trực Quan Giao Diện & Truyền Thông",
    "Đại diện theo 9 Theme Gốc & toàn bộ tài nguyên ảnh",
    "Đảm bảo giao diện chuẩn mực, không vỡ layout trên mobile, không có ảnh chết 404, không font rác",
    "QC dùng Swipe Slider kéo từ 0% -> 100% soi độ lệch bố cục; mở khung iPhone Mobile 375px kiểm tra tràn viền; Tool gửi request HTTP HEAD quét ảnh 404 và kiểm tra bảng mã UTF-8",
    "100% ảnh trả về HTTP 200; không lỗi font rác (mojibake); giữ nguyên thẻ <table>; 9/9 Theme đạt chuẩn giao diện",
    "Đảm bảo website mới đẹp, chuyên nghiệp, giữ nguyên trải nghiệm mua hàng cho khách"
  ],
  [
    "Lớp 3: Vận Hành Thực Tế (E2E Business Flow)",
    "Mẫu thực chiến trên môi trường Live (Top cửa hàng)",
    "Xác nhận toàn bộ luồng kinh doanh của Merchant và Khách mua hàng hoạt động thông suốt",
    "Thử nghiệm đăng nhập SSO từ TM SSO Portal vào /dashboard trong < 3s; thực hiện luồng đặt hàng thật, thêm vào giỏ, kiểm tra tính thuế SST, trừ kho và tạo hóa đơn",
    "Đăng nhập SSO thành công < 3s; luồng tạo đơn hàng và trừ kho chuẩn xác 100%; SEO 301 redirects hoạt động đúng",
    "Đảm bảo Merchant mở bán và nhận đơn hàng được ngay sau Cutover, không gián đoạn kinh doanh"
  ],
];

const wsRoadmap = XLSX.utils.aoa_to_sheet(visualRoadmapData);
wsRoadmap["!cols"] = [
  { wch: 25 },
  { wch: 30 },
  { wch: 35 },
  { wch: 55 },
  { wch: 45 },
  { wch: 35 },
];
XLSX.utils.book_append_sheet(wb, wsRoadmap, "0. Lo Trinh Tong Quan");

// -------------------------------------------------------------
// Sheet 1: Tổng Quan & Chiến Lược (Overview)
// -------------------------------------------------------------
const overviewData = [
  ["KẾ HOẠCH KIỂM THỬ CHUYỂN ĐỔI (TEST PLAN: MIGRATION PW1 -> PW2)", ""],
  ["Dự án", "ECH Prime Web v2 (ech-prime-web-v2)"],
  ["Hạng mục", "Data & Layout Migration (Laravel MySQL -> Next.js PostgreSQL)"],
  ["Mã tài liệu", "TP-MIG-PW1-PW2-2026"],
  ["Phiên bản", "1.4.0 (Chiến lược 3 Lớp Kiểm Định Chất Lượng Toàn Diện)"],
  ["Thời lượng thực hiện", "5 Ngày làm việc (40 Man-hours)"],
  ["Quy mô", "2.000 Website Merchants & 9 Bộ Canonical Templates"],
  ["Nhân sự kiểm thử", "1 QC Tester duy nhất (40h)"],
  ["Công cụ QC phục vụ", "/studio/qa/migration-diff (Live MySQL Connector, Deep Diff, Swipe Slider, 375px Mobile)"],
  ["Người phê duyệt", "Tech Lead / Project Manager (PM)"],
  ["Trạng thái phê duyệt", "Chờ Leader Phê Duyệt"],
  ["", ""],
  ["CHIẾN LƯỢC 3 LỚP KIỂM ĐỊNH CHẤT LƯỢNG (3-LAYER QUALITY STRATEGY)", ""],
  ["Lớp kiểm thử (Layer)", "Phạm vi & Đối tượng", "Mục tiêu kiểm định", "Phương pháp & Thao tác chi tiết", "Tiêu chuẩn Đạt (Pass)", "Ngăn ngừa rủi ro"],
  [
    "Lớp 1: Toàn Vẹn Dữ Liệu (Data Integrity)",
    "100% toàn bộ 2.000 stores (Không bỏ sót store nào)",
    "Bảo toàn 100% dữ liệu gốc: Sản phẩm, biến thể SKU, giá bán, danh mục, bài viết, đơn hàng",
    "Tool chạy ngầm so sánh từng ô CSDL giữa MySQL PW1 và Postgres PW2; tự động gắn cờ Đỏ (P0) nếu thiếu biến thể hoặc lệch giá; tự động xuất mã Dev Remediation Script để Dev sửa CSDL",
    "Parity Score toàn hệ thống >= 99.0%, 0 lỗi P0 Blocker, 100% không mất biến thể",
    "Triệt tiêu 100% rủi ro mất dữ liệu của merchant, dù là shop to hay shop nhỏ"
  ],
  [
    "Lớp 2: Trực Quan Giao Diện & Truyền Thông",
    "Đại diện theo 9 Theme Gốc & toàn bộ tài nguyên ảnh",
    "Đảm bảo giao diện chuẩn mực, không vỡ layout trên mobile, không có ảnh chết 404, không font rác",
    "QC dùng Swipe Slider kéo từ 0% -> 100% soi độ lệch bố cục; mở khung iPhone Mobile 375px kiểm tra tràn viền; Tool gửi request HTTP HEAD quét ảnh 404 và kiểm tra bảng mã UTF-8",
    "100% ảnh trả về HTTP 200; không lỗi font rác (mojibake); giữ nguyên thẻ <table>; 9/9 Theme đạt chuẩn giao diện",
    "Đảm bảo website mới đẹp, chuyên nghiệp, giữ nguyên trải nghiệm mua hàng cho khách"
  ],
  [
    "Lớp 3: Vận Hành Thực Tế (E2E Business Flow)",
    "Mẫu thực chiến trên môi trường Live (Top cửa hàng)",
    "Xác nhận toàn bộ luồng kinh doanh của Merchant và Khách mua hàng hoạt động thông suốt",
    "Thử nghiệm đăng nhập SSO từ TM SSO Portal vào /dashboard trong < 3s; thực hiện luồng đặt hàng thật, thêm vào giỏ, kiểm tra tính thuế SST, trừ kho và tạo hóa đơn",
    "Đăng nhập SSO thành công < 3s; luồng tạo đơn hàng và trừ kho chuẩn xác 100%; SEO 301 redirects hoạt động đúng",
    "Đảm bảo Merchant mở bán và nhận đơn hàng được ngay sau Cutover, không gián đoạn kinh doanh"
  ],
  ["", ""],
  ["TIÊU CHÍ GO / NO-GO CHO PHÉP CHUYỂN ĐỔI (CUTOVER QUALITY GATE)", ""],
  ["STT", "Tiêu chí bắt buộc", "Ngưỡng chấp thuận (Threshold)", "Ghi chú"],
  ["1", "Điểm đối soát toàn hệ thống (Parity Score)", ">= 99.0%", "Hiển thị nhãn xanh trên Tool"],
  ["2", "Số lượng lỗi P0 Blocker tồn đọng", "= 0 lỗi", "Không mất SKU biến thể, không lệch giá, không rớt thẻ table"],
  ["3", "Tỷ lệ liên kết ảnh sống (Media HTTP Status)", "= 100% HTTP 200", "Không có bất kỳ ảnh nào bị 404"],
  ["4", "Độ tương đồng giao diện 9 Theme chuẩn", "= 100% Pass", "Ký duyệt xác nhận bố cục mắt thường"],
];

const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
wsOverview["!cols"] = [
  { wch: 25 },
  { wch: 30 },
  { wch: 35 },
  { wch: 55 },
  { wch: 45 },
  { wch: 35 },
];
XLSX.utils.book_append_sheet(wb, wsOverview, "1. Tong Quan & Chien Luoc");

// -------------------------------------------------------------
// Sheet 2: Task Breakdown & Estimation Chi Tiết (WBS EST)
// -------------------------------------------------------------
const breakdownData = [
  ["BẢNG PHÂN RÃ CÔNG VIỆC & ƯỚC TÍNH THỜI LƯỢNG (TASK BREAKDOWN & ESTIMATION)", "", "", "", "", "", "", "", "", ""],
  ["Mã Task", "Ngày", "Ca", "Hạng mục công việc chi tiết", "Phân loại", "Phương thức", "Thời gian Est (Giờ)", "Người làm", "Đầu ra bàn giao (Deliverable)", "Trạng thái"],
  
  // Ngày 1 (8h)
  ["TASK-01", "Ngày 1", "Sáng", "Cấu hình .env.local (PW1_DATABASE_URL), test ping kết nối MySQL Live qua Tool, xác nhận độ trễ < 200ms và quyền Read-Only an toàn", "Environment", "Tool + Tay", 1.5, "QC", "Kết nối CSDL PW1 an toàn, không thể ghi sửa xóa", "Chưa chạy"],
  ["TASK-02", "Ngày 1", "Sáng", "Kích hoạt nút [ Quét Lại CSDL ] để batch scan tự động Lớp 1 (CSDL 2.000 store); kiểm tra logs và xử lý timeout mạng nếu có", "Batch Scan", "Tool (90%)", 1.5, "QC", "CSDL 2.000 store được phân loại Xanh/Vàng/Đỏ", "Chưa chạy"],
  ["TASK-03", "Ngày 1", "Chiều", "Thu thập & phân tích số liệu Dashboard tổng quan: tỷ lệ % Pass, số lượng Warning, số lượng Fail", "Analytics", "Tool + Tay", 1.5, "QC", "Bảng thống kê tỷ lệ sẵn sàng Cutover ban đầu", "Chưa chạy"],
  ["TASK-04", "Ngày 1", "Chiều", "Lọc & phân loại danh sách các store bị cờ Đỏ (P0 Blocker) theo nhóm nguyên nhân sơ bộ (biến thể, bảng, kết nối)", "Defect Triage", "Tay", 2.5, "QC", "Danh mục store cờ Đỏ cần xử lý ưu tiên cho Ngày 2", "Chưa chạy"],
  ["TASK-05", "Ngày 1", "Chiều", "Tổng hợp và gửi Daily Report Ngày 1 cho Leader / PM", "Reporting", "Tay", 1.0, "QC", "Báo cáo tiến độ Ngày 1 trên nhóm chat", "Chưa chạy"],

  // Ngày 2 (8h)
  ["TASK-06", "Ngày 2", "Sáng", "Mở tab field_diff trên các store cờ Đỏ đại diện (SITE-0001, SITE-0025...); đối soát chi tiết 7 nhóm thực thể CSDL Lớp 1", "DB Diff", "Tay + Tool", 3.0, "QC", "Bảng bóc tách chi tiết trường dữ liệu bị lệch", "Chưa chạy"],
  ["TASK-07", "Ngày 2", "Sáng", "Kiểm tra sâu lỗi rớt biến thể SKU (size, màu sắc, dung tích) và sai lệch đơn giá sản phẩm", "Data Integrity", "Tay", 2.0, "QC", "Danh sách chính xác các mã sản phẩm/biến thể bị thiếu", "Chưa chạy"],
  ["TASK-08", "Ngày 2", "Chiều", "Mở rộng dòng lỗi, trích xuất đoạn code Dev Remediation Script; tạo ticket gửi Dev kèm sẵn mã script sửa lỗi", "Bug Logging", "Tay", 2.0, "QC", "Ticket bug gửi Dev kèm sẵn mã script sửa lỗi", "Chưa chạy"],
  ["TASK-09", "Ngày 2", "Chiều", "Tổng hợp và gửi Daily Report Ngày 2 cho Leader / PM", "Reporting", "Tay", 1.0, "QC", "Báo cáo tiến độ Ngày 2 & danh sách bug gửi Dev", "Chưa chạy"],

  // Ngày 3 (8h)
  ["TASK-10", "Ngày 3", "Sáng", "Mở tab media_audit (Kiểm thử Lớp 2): Tool quét tự động URL ảnh PW1 vs PW2, lọc danh sách ảnh bị 404 Not Found hoặc méo tỷ lệ", "Media Audit", "Tool Auto", 2.5, "QC", "Danh sách link ảnh 404 bàn giao Dev sửa link CDN/S3", "Chưa chạy"],
  ["TASK-11", "Ngày 3", "Sáng", "Mở tab text_audit: Quét mã UTF-8 tiếng Việt trên các bài viết và sản phẩm, phát hiện lỗi font rác (mojibake)", "Content Audit", "Tool Auto", 2.0, "QC", "Báo cáo kiểm định font chữ tiếng Việt có dấu", "Chưa chạy"],
  ["TASK-12", "Ngày 3", "Chiều", "Kiểm tra cấu trúc thẻ bảng <table> (bảng thành phần, bảng VietGAP) khi chuyển đổi sang Lexical AST RichText", "RichText Audit", "Tool + Tay", 1.5, "QC", "Danh sách bài viết bị lỗi rớt bảng table", "Chưa chạy"],
  ["TASK-13", "Ngày 3", "Chiều", "Tạo ticket tổng hợp lỗi ảnh 404 và rớt bảng gửi Dev team sửa link CDN và hàm parser Lexical", "Bug Logging", "Tay", 1.0, "QC", "Ticket chuyển giao lỗi Media & RichText cho Dev", "Chưa chạy"],
  ["TASK-14", "Ngày 3", "Chiều", "Tổng hợp và gửi Daily Report Ngày 3 cho Leader / PM", "Reporting", "Tay", 1.0, "QC", "Báo cáo tiến độ Ngày 3 trên nhóm chat", "Chưa chạy"],

  // Ngày 4 (8h)
  ["TASK-15", "Ngày 4", "Sáng", "Kiểm thử Lớp 2 trên 9 Store đại diện 9 Theme; dùng thanh trượt Swipe Slider (0% -> 100%) kéo trượt đối chiếu độ lệch bố cục", "Visual Parity", "Tay", 3.0, "QC", "9/9 Theme chuẩn được xác nhận độ khít giao diện", "Chưa chạy"],
  ["TASK-16", "Ngày 4", "Sáng", "Bật chế độ Mobile (375px), kiểm tra hiển thị trên khung iPhone: menu hamburger, nút mua hàng, banner không bị tràn viền", "Responsive", "Tay", 2.0, "QC", "Xác nhận giao diện mobile 375px không vỡ bố cục", "Chưa chạy"],
  ["TASK-17", "Ngày 4", "Chiều", "Mở tab live_webview, thử nghiệm tương tác thật trên dual iframe (cuộn trang, xem sản phẩm, mở giỏ hàng)", "Live Webview", "Tay", 1.0, "QC", "Kiểm thử hành vi tương tác thật của khách hàng", "Chưa chạy"],
  ["TASK-18", "Ngày 4", "Chiều", "Bấm [ Quét Lại CSDL ] kiểm tra độ hồi phục sau khi Dev nạp bản vá CSDL và cập nhật script", "Re-test", "Tool (90%)", 1.0, "QC", "Báo cáo re-test các bản fix của Dev team", "Chưa chạy"],
  ["TASK-19", "Ngày 4", "Chiều", "Tổng hợp và gửi Daily Report Ngày 4 cho Leader / PM", "Reporting", "Tay", 1.0, "QC", "Báo cáo tiến độ Ngày 4 trên nhóm chat", "Chưa chạy"],

  // Ngày 5 (8h)
  ["TASK-20", "Ngày 5", "Sáng", "Bấm [ Quét Lại CSDL ] lần cuối trên toàn bộ 2.000 store; kiểm tra Parity Score >= 99.0%, P0 = 0, Media HTTP 200 = 100%", "Final Audit", "Tool Auto", 2.0, "QC", "Toàn bộ hệ thống 2.000 store đạt chuẩn xanh Lớp 1 & Lớp 2", "Chưa chạy"],
  ["TASK-21", "Ngày 5", "Sáng", "Bấm nút [ Duyệt QC Pass ] cho các store đạt chuẩn để hệ thống ghi nhận dấu chứng thực (certifiedBy, certifiedAt)", "Sign-off Gate", "Tay", 1.5, "QC", "100% store được đóng dấu QC Pass cho Cutover", "Chưa chạy"],
  ["TASK-22", "Ngày 5", "Chiều", "Kiểm thử Lớp 3 (E2E Live): Merchant đăng nhập SSO (TM Portal -> /dashboard < 3s); đặt thử đơn hàng kiểm tra trừ kho", "SSO & E2E", "Tay", 1.5, "QC", "Xác nhận luồng đăng nhập và bán hàng thông suốt", "Chưa chạy"],
  ["TASK-23", "Ngày 5", "Chiều", "Kiểm thử mẫu 5 link SEO 301 Redirects cũ (.html chuyển hướng sang URL mới trên PW2)", "SEO Redirects", "Tay", 1.0, "QC", "Xác nhận các liên kết cũ tự chuyển hướng 301 chuẩn", "Chưa chạy"],
  ["TASK-24", "Ngày 5", "Chiều", "Lập Biên bản nghiệm thu chuyển đổi (Final Cutover Sign-off Report), trình ký với Tech Lead và PM", "Final Report", "Tay", 2.0, "QC", "Biên bản nghiệm thu Cutover hoàn tất, sẵn sàng trỏ DNS", "Chưa chạy"],
  ["", "", "", "", "", "TỔNG CỘNG GIỜ CÔNG (TOTAL MAN-HOURS)", 40.0, "", "Hoàn thành 100% kế hoạch trong 5 ngày làm việc", ""],
];

const wsBreakdown = XLSX.utils.aoa_to_sheet(breakdownData);
wsBreakdown["!cols"] = [
  { wch: 10 },
  { wch: 10 },
  { wch: 8 },
  { wch: 55 },
  { wch: 15 },
  { wch: 15 },
  { wch: 18 },
  { wch: 12 },
  { wch: 45 },
  { wch: 12 },
];
XLSX.utils.book_append_sheet(wb, wsBreakdown, "2. Breakdown Task (EST 40h)");

// -------------------------------------------------------------
// Sheet 3: Ma Trận Test Case (Traceability Matrix)
// -------------------------------------------------------------
const testCaseData = [
  ["MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT (TRACEABILITY MATRIX - BDD GHERKIN)", "", "", "", "", "", "", "", "", "", ""],
  ["Mã TC", "Tham chiếu US/AC", "Phân loại", "Tiêu đề kịch bản (Scenario)", "Các bước thực hiện (Steps)", "Dữ liệu đầu vào (Test Data)", "Kết quả mong đợi Gherkin & DB Validation", "Mức độ", "Phương thức", "Kết quả thực tế", "Ghi chú / Bug ID"],
  [
    "TC-MIG.01",
    "US-F40-PW1",
    "Security",
    "Kiểm tra cơ chế Read-Only bảo vệ CSDL MySQL PW1",
    "1. Kết nối CSDL PW1\n2. Gửi lệnh cố tình chứa INSERT, UPDATE, DELETE, DROP TABLE\n3. Quan sát phản hồi",
    "PW1_DATABASE_URL hợp lệ",
    "GIVEN kết nối MySQL PW1 WHEN thực thi lệnh ghi THEN hệ thống chặn cứng với lỗi [SECURITY ERROR], không thay đổi dữ liệu",
    "P0 Blocker",
    "Tool Auto",
    "Pending",
    "Bảo mật cốt lõi",
  ],
  [
    "TC-MIG.02",
    "US-F40-09",
    "Func",
    "Quét Batch và tổng hợp chỉ số 2.000 store",
    "1. Truy cập /studio/migration\n2. Bấm [ Quét Lại CSDL ]\n3. Kiểm tra các thẻ chỉ số",
    "Catalog 2.000 stores",
    "GIVEN Dashboard tổng quan WHEN bấm Quét Lại THEN hiển thị đủ 2.000 store, phân loại Pass/Warning/Fail, tính đúng Parity Score",
    "P1 Warning",
    "Tool Auto",
    "Pending",
    "Chỉ số Dashboard",
  ],
  [
    "TC-MIG.03",
    "US-F40-11\nUS-MIGA-03",
    "Data/DB",
    "Đối soát trường Sản phẩm và Biến thể SKU 1-to-1",
    "1. Mở tab field_diff trên store lỗi\n2. Chọn nhóm Products & Variants\n3. So sánh từng cell dữ liệu",
    "Store SITE-0001, SITE-0025",
    "GIVEN sản phẩm PW1 WHEN so sánh với PW2 THEN tên, slug, giá bán, tồn kho khớp 100%, không rớt biến thể size/màu",
    "P0 Blocker",
    "Tay + Tool",
    "Pending",
    "Ngăn rớt biến thể",
  ],
  [
    "TC-MIG.04",
    "US-F40-10\nUS-MIGA-07",
    "Content",
    "Bảo toàn cấu trúc bảng RichText (Table tag) khi chuyển sang Lexical",
    "1. Mở tab text_audit\n2. Chọn bài viết/sản phẩm có bảng tiêu chuẩn VietGAP\n3. Kiểm tra cấu trúc thẻ table",
    "Nội dung có thẻ <table>",
    "GIVEN HTML gốc có thẻ table WHEN chuyển sang Lexical AST THEN cấu trúc 3 cột bảng được giữ nguyên, không bị phẳng thành text",
    "P0 Blocker",
    "Tool + Tay",
    "Pending",
    "Bắt lỗi rớt bảng",
  ],
  [
    "TC-MIG.05",
    "US-F40-10\nUS-MIGA-09",
    "Media",
    "Quét liên kết ảnh và trạng thái phản hồi HTTP 200",
    "1. Mở tab media_audit\n2. Chạy quét URL ảnh PW1 vs PW2\n3. Xem cột mã HTTP và kích thước",
    "Danh sách URL ảnh",
    "GIVEN danh sách ảnh WHEN gửi request HTTP THEN 100% ảnh trả về HTTP 200 OK, không có link 404, không méo tỷ lệ",
    "P1 Warning",
    "Tool Auto",
    "Pending",
    "Bắt lỗi ảnh chết",
  ],
  [
    "TC-MIG.06",
    "US-F40-10",
    "Content",
    "Kiểm tra mã hóa font tiếng Việt UTF-8 (Anti-mojibake)",
    "1. Mở tab text_audit\n2. Quét tiêu đề và nội dung bài viết có dấu\n3. Tìm ký tự lạ",
    "Chuỗi tiếng Việt có dấu",
    "GIVEN văn bản tiếng Việt WHEN kiểm tra UTF-8 THEN 100% hiển thị tiếng Việt chuẩn, không xuất hiện font rác",
    "P0 Blocker",
    "Tool Auto",
    "Pending",
    "Chống font rác",
  ],
  [
    "TC-MIG.07",
    "US-F40-12",
    "UI/UX",
    "So sánh độ lệch bố cục bằng thanh trượt Split Swipe Slider",
    "1. Mở tab visual_stream\n2. Bật chế độ Swipe Slider\n3. Kéo con trượt từ 0% sang 100%",
    "Theme FB101, F102, C101",
    "GIVEN lớp phủ PW2 trên PW1 WHEN kéo trượt phân cách THEN hình ảnh và khối chữ đè khít 60 FPS, không lệch vị trí",
    "P1 Warning",
    "Test Tay",
    "Pending",
    "Kéo trượt đối chiếu",
  ],
  [
    "TC-MIG.08",
    "US-F40-12",
    "UI/UX",
    "Kiểm tra độ tương thích trên khung giả lập Mobile iPhone 375px",
    "1. Bấm nút Mobile (375px)\n2. Kiểm tra giao diện trên khung iPhone\n3. Thử menu hamburger và nút mua hàng",
    "Khung 375x812px",
    "GIVEN chế độ Mobile WHEN render giao diện THEN bố cục thu gọn chuẩn 375px, menu và nút không bị tràn viền",
    "P1 Warning",
    "Test Tay",
    "Pending",
    "Chống vỡ mobile",
  ],
  [
    "TC-MIG.09",
    "US-MIG-01",
    "E2E/Auth",
    "Merchant đăng nhập SSO sau Cutover với đầy đủ dữ liệu",
    "1. Đăng nhập qua TM SSO Portal\n2. Quan sát redirect sang /post-sso-landing\n3. Kiểm tra số lượng sản phẩm, đơn hàng",
    "Tài khoản Merchant đã chuyển đổi",
    "GIVEN tài khoản Owner PW1 WHEN đăng nhập SSO THEN vào /dashboard trong < 3s, số lượng sản phẩm và đơn hàng khớp 100%",
    "P0 Blocker",
    "Test Tay",
    "Pending",
    "Luồng Merchant login",
  ],
  [
    "TC-MIG.10",
    "US-F40-09",
    "Gate",
    "Khóa chặn phê duyệt Cutover khi store còn lỗi P0",
    "1. Chọn store có cờ đỏ P0 (như SITE-0001)\n2. Thử bấm nút [ Duyệt QC Pass ]\n3. Quan sát cảnh báo",
    "Store có lỗi P0",
    "GIVEN store còn lỗi P0 WHEN bấm duyệt THEN hệ thống khóa chặn, hiển thị cảnh báo bắt buộc giải quyết lỗi P0 trước",
    "P0 Blocker",
    "Tool + Tay",
    "Pending",
    "Cổng kiểm soát chất lượng",
  ],
];

const wsTestCases = XLSX.utils.aoa_to_sheet(testCaseData);
wsTestCases["!cols"] = [
  { wch: 12 },
  { wch: 15 },
  { wch: 12 },
  { wch: 35 },
  { wch: 40 },
  { wch: 25 },
  { wch: 50 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch: 20 },
];
XLSX.utils.book_append_sheet(wb, wsTestCases, "3. Ma Tran Test Case");

// -------------------------------------------------------------
// Sheet 4: 9 Canonical Templates Checklist
// -------------------------------------------------------------
const templatesData = [
  ["CHECKLIST THẨM ĐỊNH 9 THEME GIAO DIỆN GỐC (CANONICAL TEMPLATES)", "", "", "", "", "", "", ""],
  ["Mã Theme", "Tên Template", "Ngành hàng / Lĩnh vực", "Domain PW1 (Laravel)", "Domain PW2 (Next.js)", "Test Swipe Slider", "Test Mobile 375px", "Ký Duyệt UI (Pass/Fail)"],
  ["FB101", "OrganicNest", "Thực phẩm sạch & Nông sản", "https://fb101.web.dev.ecommercehub.my/", "https://fb101.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["PA101", "EcoGarden", "Cây cảnh & Hoa tươi", "https://pa101.web.dev.ecommercehub.my/", "https://pa101.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["F102", "FashionEase", "Thời trang nam nữ & May mặc", "https://f102.web.dev.ecommercehub.my/", "https://f102.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["FN104", "Minimalist", "Tối giản & Gia dụng", "https://fn104.web.dev.ecommercehub.my/", "https://fn104.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["FN103", "Viora", "Nội thất cao cấp", "https://fn103.web.dev.ecommercehub.my/", "https://fn103.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["C102", "GlowBeauty", "Mỹ phẩm & Spa", "https://c102.web.dev.ecommercehub.my/", "https://c102.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["C101", "BeautyStore", "Chăm sóc da & Làm đẹp", "https://c101.web.dev.ecommercehub.my/", "https://c101.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["FN102", "FurnitureHub", "Đồ gỗ mỹ nghệ truyền thống", "https://fn102.web.dev.ecommercehub.my/", "https://fn102.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
  ["FN101", "SofaDecor", "Trang trí phòng khách", "https://fn101.web.dev.ecommercehub.my/", "https://fn101.primeweb.io/", "Chưa test", "Chưa test", "Pending"],
];

const wsTemplates = XLSX.utils.aoa_to_sheet(templatesData);
wsTemplates["!cols"] = [
  { wch: 12 },
  { wch: 18 },
  { wch: 30 },
  { wch: 42 },
  { wch: 30 },
  { wch: 18 },
  { wch: 18 },
  { wch: 20 },
];
XLSX.utils.book_append_sheet(wb, wsTemplates, "4. Checklist 9 Theme");

// -------------------------------------------------------------
// Sheet 5: Mẫu Báo Cáo Hằng Ngày (Daily Report Sheet)
// -------------------------------------------------------------
const dailyReportData = [
  ["BÁO CÁO TIẾN ĐỘ KIỂM THỬ HẰNG NGÀY (DAILY STATUS TRACKER)", "", "", "", "", "", ""],
  ["Ngày báo cáo", "Tổng Store đã quét", "Tỷ lệ Pass (%)", "Số Store Warning", "Số Store Lỗi P0", "Tiến độ kế hoạch (%)", "Ghi chú & Đề xuất hỗ trợ"],
  ["Ngày 1 (Thứ 2)", "2.000", "", "", "", "20%", "Setup kết nối CSDL và quét batch lần 1, lọc danh sách store cờ Đỏ"],
  ["Ngày 2 (Thứ 3)", "2.000", "", "", "", "40%", "Soi chi tiết CSDL 1-to-1, gửi script remediation cho Dev team"],
  ["Ngày 3 (Thứ 4)", "2.000", "", "", "", "60%", "Quét ảnh chết 404 và kiểm tra font tiếng Việt, mất thẻ table"],
  ["Ngày 4 (Thứ 5)", "2.000", "", "", "", "80%", "Test mắt thường giao diện 9 Theme mẫu (Swipe Slider & Mobile 375px)"],
  ["Ngày 5 (Thứ 6)", "2.000", "", "", "", "100%", "Re-scan tổng lực, bấm Duyệt QC Pass và lập Biên bản nghiệm thu Cutover"],
  ["", "", "", "", "", "", ""],
  ["BẢNG KÝ TÊN BÀN GIAO & PHÊ DUYỆT (SIGN-OFF)", "", "", "", "", "", ""],
  ["Đại diện bên liên quan", "Họ và tên", "Chức danh", "Chữ ký", "Ngày ký", "Quyết định", ""],
  ["Đội ngũ kiểm thử", "", "QC Lead / Tester", "", "", "[ ] Đạt chuẩn Cutover", ""],
  ["Đội ngũ phát triển", "", "Tech Lead / Dev Lead", "", "", "[ ] Đạt chuẩn Cutover", ""],
  ["Quản lý dự án", "", "Project Manager (PM)", "", "", "[ ] Phê duyệt trỏ DNS", ""],
];

const wsDaily = XLSX.utils.aoa_to_sheet(dailyReportData);
wsDaily["!cols"] = [
  { wch: 18 },
  { wch: 20 },
  { wch: 15 },
  { wch: 18 },
  { wch: 18 },
  { wch: 20 },
  { wch: 60 },
];
XLSX.utils.book_append_sheet(wb, wsDaily, "5. Daily Report & Sign-off");

// Write files
const outputExcelPath = path.join(process.cwd(), "docs/qa/TEST_PLAN_MIGRATION_PW1_PW2.xlsx");
XLSX.writeFile(wb, outputExcelPath);
console.log("Excel generated successfully at:", outputExcelPath);

const brainExcelPath = "/home/primer69/.gemini/antigravity-cli/brain/04559325-6f92-4216-9f3e-389673be5f8f/TEST_PLAN_MIGRATION_PW1_PW2.xlsx";
XLSX.writeFile(wb, brainExcelPath);
console.log("Excel copied to artifact at:", brainExcelPath);
