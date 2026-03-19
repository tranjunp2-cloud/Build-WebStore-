# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F01 - AI Chat Builder
> **Phiên bản:** 5.2 (52-Case Exhaustive Matrix AC-Mapped) | **Cập nhật:** 2026-03-18 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F01-ai-chat-builder.md`), User Stories (26 ACs), Figma Design (Node 30607:17719)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, Security Contexting, Automation Locator Healer, Payload CMS DB Assertions.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng khởi tạo Website qua hội thoại AI (AI Chat Builder - F01). Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho 8 User Stories, bao quát chính xác **26 Acceptance Criteria (ACs)** đã định nghĩa tại tài liệu đặc tả và các yêu cầu thẩm mỹ UI từ bản thiết kế Figma hiện tại.

Bộ kiểm thử bao gồm **52 kịch bản chi tiết** (Positive + Negative edge cases). Toàn bộ kịch bản được tổng hợp trong Unified Matrix.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | Input XSS/SQLi Vectors, Network Throttling, SLA Metrics `<60s` |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[FIGMA US-00] Xác thực Người dùng (Authentication)** |
| **TC-F01.01** | `Design` | `UI` | **[Negative]** Validation Form Đăng Ký (Password Strength) | **1.** Tới `/signup`. Nhập Name, Email hợp lệ.<br>**2.** Nhập Password: `abcxyz12` (Không in hoa). | **GIVEN** User nhập Pass thiếu In Hoa **WHEN** Submit **THEN** Nut đăng ký Disabled.<br>UI Đỏ 1 mục checklist `One uppercase`. | High | [ ] |
| **TC-F01.02** | `Design` | `Sec` | **[Negative]** Ràng buộc SQL Injection Đăng nhập | **1.** Tới `/login`. Email nhập: `admin' OR 1=1--`.<br>**2.** Nhập Pass ngẫu nhiên, ấn Submit. | Request trả Http 401. Không lỗi SQL ra ngoài màn hình. Backend Sanitized payload sạch sẽ. | Blocker | [x] |
| **TC-F01.03** | `Design` | `Func` | **[Positive]** Đăng nhập thành công với Remember Me | **1.** Điền Email & Pass chuẩn xác.<br>**2.** Tích ô "Remember me" và Login. | **THEN** Điều hướng `/builder/new`. Trình duyệt ghi nhận Auth Cookie sống tới 30 ngày (Expire Limit). | Blocker | [x] |
| **[FIGMA Step 1/3] Biểu mẫu Thông tin Doanh nghiệp thay thế Chat** |
| **TC-F01.04** | `Design` | `UI` | **[Positive]** Hiển thị Form thông tin UI Step 1/3 | **1.** Truy cập luồng Create AI Website. | Màn hình Form thay vì Chat. Hiển thị đủ Input: Business Name, Industry, Products, Style Button Single. | Blocker | [x] |
| **TC-F01.05** | `Design` | `Boundary`| **[Negative]** Ngăn chặn Form thiếu trường bắt buộc | **1.** Để trống toàn bộ Box.<br>**2.** Nhấn `Continue`. | UI Báo lỗi bắt buộc ở `Business Name` (`Must be at least 3 chars`) và `Industry`. DOM chặn không bắn API POST. | High | [ ] |
| **TC-F01.06** | `Design` | `Func` | **[Positive]** Trạng thái chọn Single-Select Industry | **1.** Hover/Click "Tech / IT".<br>**2.** Hover/Click "Restaurant". | **WHEN** Nhấp Button thứ 2 **THEN** Chuyển style `.active`, Button 1 bị gỡ active. Store chỉ nhận 1 Value duy nhất. | Medium | [ ] |
| **TC-F01.07** | `Design` | `Sec` | **[Negative]** Injection XSS trong Text Phụ trợ | **1.** Điền Prompt Products: `<iframe src="javascript:alert('XSS')">`. Bấm Continue. | Payload được HTML encode lúc Submit. Request OpenAI an toàn. Website HTML sinh ra escape chuỗi string trong thẻ. | Blocker | [x] |
| **[US-01: Generate Site from Prompt - Khởi tạo Web AI]** |
| **TC-F01.08** | `AC-1` | `Perf` | **[Positive]** Stream khởi tạo web thành công dưới 60s | **1.** Submit Business Name và Industry hợp lệ. | **THEN** Bắt đầu kết nối SSE dưới `2000ms`. Sự kiện Message `done` phải đến trước cột mốc StartTime `60,000` ms. | Blocker | [x] |
| **TC-F01.09** | `AC-1` | `UI` | **[Positive]** Giao diện Live Preview Update Realtime | **1.** Quan sát iFrame vùng phải trong quá trình Generation (Khoảng giây 10 - 20). | Lần lượt nhận Component Skeleton qua Component Text Block Cập nhập Mượt Mà theo chuỗi Stream của Backend. | High | [ ] |
| **TC-F01.10** | `AC-2` | `NLU` | **[Positive]** Cơ chế Phản hồi hỏi thêm (Clarifying) | **1.** Submit thông tin quá nghèo nàn: "Web Bán Hàng". | **GIVEN** Dữ liệu thiếu intent **WHEN** API Trigger **THEN** AI hỏi thêm để làm rõ loại mặt hàng đang bán. | High | [x] |
| **TC-F01.11** | `AC-2` | `Logic` | **[Edge]** Tự động Khởi tạo (Assume) sau 2 lần hỏi | **1.** User cố lặp trả lời cụt (VD: "Không biết"). Lặp lại 2 Turn. | Từ Turn thứ 3, Cắt chuỗi Prompt hỏi đáp, LLM chốt Assume giá trị Default ngẫu nhiên và Lệnh tạo Web bắt buộc chạy. | Medium | [x] |
| **TC-F01.12** | `AC-3` | `Flow` | **[Positive]** Cụm CTAs khi Build Done Hoàn thành | **1.** Chờ Progress Bar Bar 100%. | Trạng thái Editor kích hoạt 2 nút CTA bự: `[Tinh chỉnh]` (Go Edits) & `[Publish ngay]`. CMS Auto lưu tệp vào Draft Table. | High | [x] |
| **TC-F01.13** | `AC-4` | `Data` | **[Positive]** Khôi phục Session SessionRecovery (F5) | **1.** Luồng chạy Tới 50%, Tắt trình duyệt hoặc bấm F5 Reload. | **WHEN** Khởi tạo lại Page **THEN** Call GET `/api/drafts`. Giao diện không Drop Progress bằng 0%, nối lại đúng điểm 50%. | High | [x] |
| **TC-F01.14** | `AC-5` | `Edge` | **[Negative]** Timeout Lỗi 500 Từ API OpenAI | **1.** Mô phỏng Timeout Mạng Node OpenAI. | Thanh Progress Ngắt. Băng rôn Error Toast Đỏ: `Không thể tạo website` xuất hiện. | High | [ ] |
| **TC-F01.15** | `AC-5` | `UX` | **[Positive]** Khôi phục dữ liệu Mồi khi Retry OpenAI Fail | **1.** Tiếp nối TC-F01.14. Nhìn vào khung Input Prompt/Form. | **EXPECTED** Dữ liệu TextField đã gõ trước đó không bị Xóa/Reset Blank. Nút `Làm Lại` giữ nguyên Body Request cũ. | Blocker | [x] |
| **TC-F01.16** | `AC-8` | `Mobile`| **[Positive]** Toggle Chế độ Màn hình nhỏ 375px | **1.** Chạy Mobile Simulator Window. | **THEN** Chatbot / Form Layout ăn Form 100% Mobile Screen. iFrame Preview tự động Ẩn (Display None). Có Icon Mắt bật qua lại. | Low  | [ ] |
| **TC-F01.17** | `AC-9` | `Func` | **[Positive]** Cấu trúc 4 Trang Bắt Buộc Tạo ra | **1.** Mở Site vừa gen xong. Crawler Link Navigation. | Crawler tìm thấy chính xác 4 HyperLinks Anchor Tag: (1) `Homepage`, (2) `About`, (3) `Products`, (4) `Contact` hoạt động trả 200 Code. | Blocker | [x] |
| **TC-F01.18** | `AC-10` | `Theme` | **[Positive]** Lấy Layout Category F&B Food | **1.** Nhập Input: "Mở Quán Phở bò Nam Định". Gen rùi Dòm Layout. | Layout CMS chọn Filter Component có `MenuFoodBlocks` Object. Cấu Hình Theme Tone Màu Ấm. | High | [ ] |
| **TC-F01.19** | `AC-10` | `Theme` | **[Positive]** Lấy Layout Thẩm Mỹ Khối Spa/Beauty | **1.** Nhập Input: "Mở tiệm Nails Spa". Gen Dòm Layout. | Layout CMS Gen xuất Gallery Mẫu Nails Bóng, Tông màu chủ đạo chuyển sang Pastel/Mềm mại Nữ tính thanh nhã. | High | [ ] |
| **[US-03: AI Image Generation (DALL-E)]** |
| **TC-F01.20** | `AC-6` | `API` | **[Positive]** Tạo Ảnh DALL-E Hero Banner Nhúng vào Payload CMS | **1.** Prompt Gen cửa hàng thú cưng. | DB Object Layout trả tham số URL Ảnh. Src Ảnh trỏ về Payload CMS Uploaded `.../media/dalle-img.jpg` Thành công. Node Resize đúng 1200x400px. | Blocker | [x] |
| **TC-F01.21** | `AC-6` | `Edge` | **[Negative]** Fallback sang Stock Image (Khi API Ảnh Fail) | **1.** Ép Mock Function DALLH_Fail. Generate site. | Hệ System không Block Generation. Trang web kết xuất gán src thẻ img Hero thành file Base Local Fallback (`stock-pet.png`) hợp lí. | High | [x] |
| **[US-04 & US-07: Domain Publishing & Route Handoff]** |
| **TC-F01.22** | `AC-7` | `Flow` | **[Positive]** Đẩy Phát Hành Live Cloud Domain Dưới 30 Giây | **1.** Tại Page Draft Build, Click Action "Publish ngay". | Trigger CMS Route Ghi Publish. Bắt Subdomain Router trong `30,000ms`. Call Http.get(`slug.primeweb.app`) Passed StatusCode 200. | Blocker | [x] |
| **TC-F01.23** | `AC-18` | `UI` | **[Positive]** Modal Post-Publish Highlight Thông Điệp | **1.** Kết thúc Lệnh Publish Post. Chờ Popup Modal Hiện Lên. | Màn Hình Hiển Thị Block Label Link Tên Miền Màu Xanh. Gồm Các Group Action Buttons: "Copy Link", "View Live Site", "Goto Admin". | Medium | [ ] |
| **TC-F01.24** | `AC-19` | `Sec` | **[Positive]** Seamless SSO CMS Redirect (Admin Board Auth) | **1.** Nhấp Label Click To "Go to Admin Dashboard". | Payload Route Pass Auth JWT Header Check. User Đi Vào `/admin/collections/sites` Thành công, Không bắt phải Bơm Key Pass/Email Log Lại. | Blocker | [x] |
| **TC-F01.25** | `AC-20` | `State` | **[Positive]** Thao Tác Continue Editing Đẩy Mode | **1.** Nhấp Label Click To "Continue Editing". | Controller Chuyển Hướng Route App URL `/editor/:id`. Status Field Database Page Đã Up Tái từ Draft Sàng Label Nhãn Published. | High | [x] |
| **TC-F01.26** | `AC-21` | `Func` | **[Positive]** Copy To Clipboard API Native Support Logic | **1.** Nhấp Link Text Nút Copy Link Trực Trên Cụm Panel Success. | Notification Pop Hiện Text `Copied ✓`. Browser Read Text Document Clipboard trả Giá Trị Khớp Mã SubDomain Slug URL Chính Xác 100%. | Low | [ ] |
| **[US-05 & 06: Conversational Language Flow NLU]** *(Chạy Nếu Ứng Dụng Chat UI)* |
| **TC-F01.27** | `AC-11` | `Locale`| **[Positive]** Hiển thị Cấu Trúc Khởi Màn Bằng Tiếng Anh Ngay | **1.** Xóa Session, Mở Trình `/builder/new` Account Tươi Trắng. | Bot Cất Giọng Chào Bằng Text Literal Ngôn English `< 2 Cặp Câu` (Vd: *"Hi! I'm your AI Builder"*), Có Khối Dòng Sample Example Text Guide. | Medium | [ ] |
| **TC-F01.28** | `AC-12` | `NLU` | **[Positive]** NPU Tiếng Việt - Nhận Dạng Context Vietnamese | **1.** Send Text: *"Tôi muốn xây trang bán cơm sườn"*. | Context Trigger Model Detect `vi`. Lập Tức Dịch Base Prompt Chuyển Luồng Hành Văn Thành Thạo Tiếng Việt Mời Khách Hàng. | High | [ ] |
| **TC-F01.29** | `AC-12` | `NLU` | **[Positive]** NPU Mã Lai - Nhận Dạng Bahasa Melayu | **1.** Send Text: *"Kedai Makan sedap"*. | Language Switcher Detect `ms`. Bot Reply Trở Lại Dựa Trên Base Lang MS (Formal). Ghi File Header Locales Lưu Data DB Tờ Mẫu Trang BM. | High | [x] |
| **TC-F01.30** | `AC-13` | `Logic` | **[Positive]** Quick-reply Chips thu thập Option nhánh | **1.** Nhấp Tap Box Text Rời Label Chip Tag `[👗 Fashion]`. | Thay Màn Hình Hiện Text Gõ Rời Cục, Chip Phát Đi Tác Cử Send Trực Tiếp Context Fashion Tương Đường Chuỗi Type. | Low | [ ] |
| **TC-F01.31** | `AC-13` | `Limit` | **[Negative]** Trạng Lặp Bot Khống Chế Limit Cố Định Không Quá Vòng 4 | **1.** Chat Rác Text "hmmm..." Qua Lại Trả Lời Vòng Thứ 4 | Lệnh System Config Limit Cứng (IF turn >= 4). Trực Cấp Bot Ngắt Giao Thức Hỏi Cầm Khách, Kick Lệnh Generator Execute Tạo Website Khống. | High | [x] |
| **TC-F01.32** | `AC-14` | `NLU` | **[Positive]** Trích Suất Khói Dữ Liệu Thực Thể Multi Entity 1 Điểm | **1.** Send Chuỗi: *"Tiệm Coffee Sữa đá Quận 1 Mở 2 Năm"* 1 Câu Đơn. | Logic Node Bóc Được: Object { loai: 'coffee', viTri: 'q1', years: 2 }. Trả Xác Nhận Không Hỏi Rời Rạc Từng Mẩu Lại Nữa. | Medium | [ ] |
| **TC-F01.33** | `AC-15` | `Locale`| **[Positive]** Ngữ Nghĩa Phát Tiếng Việt CopyWrite Chuẩn Lõi SME | **1.** Test Tròn Luồng Từ Điểm Cài Tiếng Việt Output Render Ra. | Body Các Text Khối Nút Nút Kêu Gọi Nhu Cầu Mua Hàng Không Lạch Đạch Text Ngô Nghê, Thích Nghi Hoàn Toàn Cách Văn Doanh Nghiệp Việt. | High | [x] |
| **TC-F01.34** | `AC-15` | `Locale`| **[Positive]** Ngữ Nghĩa Phát Bản BM Formal Copywrite Tròn Text | **1.** Test Tròn Luồng Context Tọa Nhánh BM Ra Output Hàng Cuối. | Lệnh Text Content Của Navigation Và Body Paragraph Chuẩn Bahasa Melayu Lịch Sự Cho Business Malaisia Thay Vì Indonesia Locale Mix. | High | [x] |
| **TC-F01.35** | `AC-16` | `Func` | **[Positive]** Tùy Chọn Cấp Modal Build Nhánh Version Tiếng Anh Kẹp Nách | **1.** Build Xong App Local. Dừng Tại Màn Suggest. Nhấp Nút Option Suggest Bơm English. | Chạy Nạp Tool Pipeline Lệnh Generate Song Song Branch Content Thứ 2. Trả Link Bản Translate Node Text Bằng Tiếng Anh Full Lắp Nhanh Lẹ. | Medium | [ ] |
| **TC-F01.36** | `AC-17` | `Edge` | **[Negative]** Xử lý Fallback Tiếng Anh với Ngôn ngữ hiếm | **1.** Send Text Tiếng H-Mông Hoặc Arabic `أريد بناء` Không Support. | Không Sập Cục CMS Server Backend. Xử Lý Rơi Khung Data Text Content Toàn Cầu Tiếng Anh (English Fallback). Nhắc Thông Toast Báo Vận. | High | [x] |
| **[US-08: Drag and Drop Interactive Previews] Cấu Chúc Khối** |
| **TC-F01.37** | `AC-22` | `UX` | **[Positive]** Tương Tác Cấp Drag Chuột Kéo Lê Chuyển Khối Component | **1.** Desktop Click Ngay Div Điểm Biểu Tượng Grid Lấy Chuột Kéo Kẹp Khối Products Đẩy Lên Trên Hero Block Bỏ Ra.| Khối Target Đổi Vị Trí Node Tới Điểm Hero Trước Đó. Thay Đổi React Chỉnh Order Áp Ngay Vị Trí Mới. Preview Frame Không Đảo Cục Reload Reload Flash. | Blocker | [ ] |
| **TC-F01.38** | `AC-22` | `Func` | **[Positive]** Đồng Bộ Đơn Cấu Trúc Khối Bọc Render Của BuilderStore Mới | **1.** Kéo Blocks Xong Tại Web Client Check Biến BuilderStore Local Var Status.| Datalist Array Khối Element Thay Đổi Cặp Index Lịch Sự Trong Client Trạng Thái Phản Xả, Phục Vụ Nạp Dữ Liệu Call Lệnh Publish Cấp Sợi Chốt. | High | [ ] |
| **TC-F01.39** | `AC-23` | `UI` | **[Positive]** Cầm Bắt Giao Diện Ánh Xạ CSS Transition Smooth Bắt Trọng Vị | **1.** Nhấp Kéo Khối Đang Di Trên Không Trung (Drag IN-Progress Phase).| Mảnh DOM Nguồn Thay Đổi Ánh Opacity Dịch Hạ Thang Nhẹ 0.7 Chỉ Độ Chướng Kèm Box Shadows. Đường Threshold Highlight Sáng Gợi Nền Target Điểm Xác Nhận Đi Đặt. Thả Khối Cài Hiệu Ứng Bắt Slide In Frame Ngắn Animation (200~300ms). | Low | [ ] |
| **TC-F01.40** | `AC-24` | `DB` | **[Positive]** Payload Layout SortOrder Push Đồng Vị Database Object Storage Lệnh| **1.** Kéo Layout Hoàn Chỉnh Mọi Điểm Index. Gọi Save Nhấn Publish Action Button.| Đóng Gói Yêu Cầu `PATCH/PUT` File CMS Payload Đẩy Cây Mảng Array Tác Vụ Ghi Object Dọc `page.layout.sortOrder`. Mở Cấp Call DB Tìm Array Render Đích Trả Code Map 100% Cấu Hình Sort Vừa Kéo Tại Màn Preview. | Blocker | [x] |
| **TC-F01.41** | `AC-24` | `DB` | **[Positive]** Layout Bơm Check Đồng Bộ Tại Website Phía Mắt User Ngoại Trái| **1.** Đổ Xong Bước TC-F01.40. Mở Cửa Sổ Trình Duyệt Bằng Nhánh External Khách Hàng View Target Trực Live Web Subdomain Vừa Gọi Up Đi.| Dữ Liệu Bố Cục Thật Trên URL Public Mả Giống Tuyệt Bức Với Phiên Render Móng Test Vừa Kéo Trước Khi Đẩy Save Xuống Không Sai Lệch Điểm Thang. | High | [x] |
| **TC-F01.42** | `AC-25` | `Mobile`| **[Positive]** Lật Trọng Năng Cấp Longpress Touch Cho Mobile Screen | **1.** Mobile View Resize Tương Kích Khung. Điểm Kích Mở Con Mắt Bật View Cục Mảnh Cắt Preview Touch Chạm Chắn Sát Khay HandGrip Block Chực Lưu Rê Giữ 500MS Mới Lăn Cục Touch. | Node DOM Nhả Sự Kiện Context Drag Được. Thả Lùi Tay Để Swap Khối Touch Pad Mượt Chế Ngự Ràng Buộc Element. | High | [ ] |
| **TC-F01.43** | `AC-25` | `Mobile`| **[Negative]** Chặn Lỗi Ráp Window Scroll Cảm Ứng Di Touch Kéo Conflict Nhau | **1.** Touch Cuộn Động Rê Drag Handle. Lăn Cục Ngón Tay Căng View Trên Tab Chạm Vừa Di Cục Bất Kỳ Bọc View Y Window.| Khóa Freeze Hàm Native CSS Javascript Ghi Mệnh `touch-action: none` Ở Trình Scroll Bar Kín Trên Khay Y. Cục Kéo Duy Nhất Ăn Điểm Touch. Quá Trình Không Bị Lấn Cấn Cuộn Web Rơi Tụt Kéo Không Tới Block Đích. | High | [ ] |
| **TC-F01.44** | `AC-26` | `Logic` | **[Negative]** Ràng Buộc Cơ Sở Core Cấp Thiết Chống Xê Dịch Top Navbar Header Khối Block Lên Nóc| **1.** Hover Trỏ Pointer Lên Tít Cục Thẻ Block Lõi Header Navigation Dọc Lưng Layout Trái Chóp. Nhắm Bó Cục Lép Click Di Lôi Handle.| Không Phát Tín Hiệu Grip Biểu Tượng Kéo. Nhồi Tooltip Info Thông Báo: "Navigation Phụ Định Fixed". Thuật Toán Drop Z-Index Ngăn Cường Chế Ngự Header Đảo Thấp. | Blocker | [ ] |
| **TC-F01.45** | `AC-26` | `Logic` | **[Negative]** Miễn Trừ Dây Khối Chức Năng Cố Fix Vị Cuối Đáy Mép Chân Trang Element Footer Cuối Cục| **1.** Kéo Khối Text Body Hoặc Ảnh Đi Tìm Cọc Rễ Footer Kích Block Drag Lút Xuống Khay Dưới Cục Footer. Nhắm Thổi Đáy.| Bất Thành Thang Điểm Insert Chèn Target Thềm DropZone Đáy Của Khay Khung Footer Cuối Site Hoàn Toàn Bị Block Nốt Chữ Ký Fix Chống Xê Tròn Trịa Vỡ Bóp Mảng Thiết Kế Cứ Điểm Navigation Chéo. | High | [ ] |
| **[Business Limits & Security Shield Rules] Dẫn Khung Cước, Hậu Check & Giới Hạn SLA AI Dịch Tầm Vóc** |
| **TC-F01.46** | `FR-15` | `API` | **[Negative]** Bảo Mật Gateway Cấm Xả Lụt Quota Stress Lượng Gen Cũ Tạo Cước OpenAI Đội Gấp Khủng | **1.** Kích Cầu Tác Cửa Scripts Code Bypass API Flood Tấn Công POST `api/ai/generate-site` Nhanh 10 Request/Giây.| Middleware Hàng Tiền Tuyến Không Cho Payload Lọt Vô Request OpenAI Core Tốn Credits. Chặn Trả Mốc Code Response Rate Liimit `HTTP 429 Too Many Requests`. | Blocker | [x] |
| **TC-F01.47** | `FR-15` | `DB` | **[Negative]** Rule Trữ Gói Cước Doanh Thu Tiền User Lõi Hạn Trần Plan Free Build AI | **1.** Tài khoản Free Plan, Build Web Thành Công 1 Lần. Bấm Build Lần 2.| Lớp Limit Cản Lượt Gen Lên Server. Gọi Modal UI "Upgrade Trả Cước Để Xây Dựng Tiệp Web". API Không Bắn. | Blocker | [x] |
| **TC-F01.48** | `BR-01` | `Sec` | **[Negative]** Chống Trượt Bảng Data Tenant Identity Token Quyền Cấp | **1.** Đổ Chéo Identity Gán JWT User A gửi GET Request Lén Cắp Dữ Liệu Site Object Của User B Mật Bằng ID Trực Tiếp.| Rào Quyền CMS Tự Bóp Data Object Policy Ref Role Gán Quyền Cản Code Chuẩn Thắng `HTTP 403 Forbidden` Đoạt Mã. Đóng Chặn Dữ Liệu Site Object Tắt Hoạt. | Blocker | [x] |
| **TC-F01.49** | `BR-06` | `Data` | **[Negative]** Hệ Điều Moderation Lớp Tường Cấm Xuyên Prompt Nguồn Phản Cảm Khóa Vĩnh| **1.** Nhập Prompt Từ Nội Khu NSFW (Khiêu dâm bạo lực lừa đảo).| API Rà Cản Policy Nhả Cảnh Cáo Bỏ Khối Output Request Fail Chặn Call OpenAI. 400 Bad Vi Phạm Chính Sách Không Build Độc Lệnh Dữ. Toast Màn Báo Lỗi Nguy Bạo Tác Bãi. | Blocker | [x] |
| **TC-F01.50** | `BR-09` | `Cron`| **[Positive]** Hệ Tự Dọn Trút Trọn Khung Khỏa Tẩy Bản Data Draft 30 Days Out Cũ | **1.** Kí Mongo DB Collection Sinh Draft Site Object Age Date 30 Days+. Trigger Node Cron API Mất.| Payload CMS Delete Cục Bản Rác (Hard Rớt Bỏ Data Object Status Không Hoàn Lại). Chống Ngập Khung CSD Storage Tốc Tốn Giữ Size Gọng Cốc Sạch. | High | [x] |
| **TC-F01.51** | `BR-09` | `Cron`| **[Positive]** Tẩy Không Dọn Status Published Xuyên Rule Nặng Đè Bảo Tồn Live Core Cứng Site Vàng | **1.** Draft File Document Khớp Mốc Đã Cũ 31 Days, Cố Tình Thay Thuộc `Status == 'Published'`. Đắp Cron Job Target Data Nhắm Trừng Phạt Quét Thu.| Móc Quét Tách Lọc Lệnh Delete. Object Cánh Không Phai Mực Vẹn Nguyên Giữ An Toàn Cho Web Đã Bắn Link Live Sống Chắc Lên Mạng Tránh Dọn Nhầm. | Blocker | [x] |
| **TC-F01.52** | `Limit` | `ToKen` | **[Negative]** Độ Bàn Phím Khung Nhồi Ký Tự Input Text Quá Biên Bóp Chặn Sập OpenAI| **1.** Chạy Test Code Paster Paste Nhả Dump Chuỗi Text Payload > `10,000` Size Chars Tới Khay Text Send.| Khóa Lại Frontend Validator Cấm Đi Phím JS Ngăn Submit Payload Trả Cảnh Báo Limit. API Chặn Không Bắn Request Kể Cả Hack Bypass Khống Khống Ngắn Thổi Khủng OOM Bộ LLM Băm Đo Cỡ Nát Core Tràn Nhớ Memory Leak Out.| High | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của Cửa hàng Bán lẻ (SME Owner)._

**Kịch bản E2E Cốt Lõi:** 
1. **[Bơm Context]** Đăng ký/đăng nhập User Account SME (Pass Auth Limit qua). Nhập Tên Quán, Ngành `Cake Bakery`, Text Body Content Prompt (Bao Phủ Lọc NLU Bơm Chuyển Ngữ Từ Tiếng Việt Đọc Sinh Text Mảng Sống Tường Lõi Thư Mẫu Tươi UI Form). Check Validate Quá Số Liền Lỗi Gửi Data Nhích Bọn Submit Hoàn Chốt Đỏ Ngang.
2. **[Thổi Lõi AI Stream & Phanh Đáy Ảnh Error]** Nút Start Bày Nấu Tạo 4 Thang Lệnh Trang Home... Gắn Nền. Mắt Bắt Lệnh Khảo Đồng Tiến Chạp Chóp Thanh Lấy Kẽ Ngưng Nối Trình 60s Bật SLA SSE Bắn Nhịp Chặn Khối Hero Data Render Cấp DALL-E (Không sập Cấp Gọi Khung Khi Trượt Fail Đổ Rác Fallback Hình Mẫu Cứng Đóng). Kẽ Drop Kéo Lại DOM Rải Đều Order Blocks List 375px Mới Layout Rõ Lại Ổn.
3. **[Xuất Bản Thầu Live & Single CMS Bypass]** Nhấp Nút Mắc Bật Bền Cloud Live Phát Publish Sub Domain `Cập-Bến-Bánh-ABC` Gắn Code Ping OK Mã 200 Cho Lần View Ngoài. Click Copy Link Rẽ Đám Bật Bền Redirect Khỏi Bố Trình Chặn App Lót Kẽ Mở Lưng Bơm Thằng Vào Core Panel Payload Admin Admin Điểm Edit Quản Lý Lại Core Dữ Data Cực Thoáng Thỏa Ký Nháy Lượt Code Chặn Tenant Isolation An Bình Tuyệt Cứng Chống Bơm Hỏa Tấn Rác Hack Móc.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules .Agent Trích Chọn) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Đã chạy 0/20 TC | `Locator Healer Agent` Định Giá Thang Giao DOM Test. Bảo Trì Touch Drag & Drop |
| **2. AI Logic & Functions** | [ ] Đã chạy 0/15 TC | Khắc Lõi Mở `BDD Cucumber Agent` Gắn Expected Theo Bền Chắc Đỡ Rung Khung Chốt Đọc Ngôn Ngọt Logic Phản Xạ |
| **3. Security & DB Validation** | [ ] Đã chạy 0/12 TC | Code Kháng Mạng Bypass Data Rác Prompt NSFW Lõi Database Payload Check `QC & Flaky Fixer Test` |
| **4. Performance SLA** | [ ] Not Run | Call Benchmark `Performance Load Tester Agent` SLA Cứng Đo API SSE & DALL-E Nháp |
| **5. E2E UAT Approval** | [ ] Not Run | Chốt File P0/P1 Lệnh Hoàn Thành Cứng Cựa Cho Năng Lực Core Giá Giá Của App V2 |

> **Khuyến Nghị Release:** Với việc bổ sung 52 Cases Tường Tận tới Độ Sâu Giới Hạn Boundary Payload Cập Nhập DB. Vòng Automation Regression Sẽ Cần Chặn Hầu Rate 100% Cột Điểm Auto[X] Tại Tương Lai Gần Chốt Cửa.
