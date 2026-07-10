# Kiểm Thử Chi Tiết: F01 — AI Website Builder
> **Phiên bản:** 8.0 (130-Case Comprehensive Coverage) | **Cập nhật:** 2026-04-03 | **Thực hiện:** QA Team
> **Nguồn tham chiếu:** PRD v2.1 (`F01-ai-builder.md`), User Stories 10 US / 26 ACs (`F01-ai-builder-stories.md`), Figma Design (Desktop + Mobile)
> **Nhánh làm việc:** `qa/F01-testcase-update`

---

## 1. Mục Tiêu

Bộ kiểm thử này đảm bảo chất lượng toàn diện cho tính năng **AI Website Builder (F01)** — cho phép người dùng SME nhập thông tin doanh nghiệp qua form và để AI tự động tạo website hoàn chỉnh.

**Phạm vi bao phủ:**
- 10 User Stories (US-F01-01 → US-F01-10) với 26 Acceptance Criteria
- 26 Functional Requirements (FR-01 → FR-26)
- 9 Business Rules (BR-01 → BR-09)
- Responsive Design: Desktop (1920×1080) + Mobile (375px)

**Tổng số kịch bản:** **130 test cases** (Positive + Negative + Edge + Mobile + Recovery + Race Condition)

---

## 2. Môi Trường Kiểm Thử

| Hạng mục | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome (v110+), Firefox (v105+), Safari |
| Thiết bị | Desktop (1920×1080), Mobile (iPhone 14 Pro — 375px) |
| Dữ liệu kiểm thử | Input XSS/SQLi vectors, network throttling, SLA metrics `<60s` |
| URL |https://web-cms-v2.dev.ecommercehub.my/

---

## 3. Ma Trận Kiểm Thử Tổng Hợp (Traceability Matrix)

### 3.1 Xác Thực Người Dùng (Authentication)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.01 | Design | UI | **[Negative]** Validation đăng ký — Mật khẩu yếu | **1.** Truy cập `/signup`. Nhập Name, Email hợp lệ.<br>**2.** Nhập Password: `abcxyz12` (thiếu chữ in hoa). | Nút đăng ký ở trạng thái Disabled. Checklist mật khẩu đánh dấu đỏ mục "One uppercase". | High | [ ] |
| TC-F01.02 | Design | Sec | **[Negative]** Chống SQL Injection khi đăng nhập | **1.** Truy cập `/login`. Nhập Email: `admin' OR 1=1--`.<br>**2.** Nhập mật khẩu bất kỳ, nhấn Submit. | Server trả HTTP 401. Không hiển thị lỗi SQL ra màn hình. Payload được sanitize. | Blocker | [x] |
| TC-F01.03 | Design | Func | **[Positive]** Đăng nhập thành công với Remember Me | **1.** Nhập Email và Password chính xác.<br>**2.** Tích ô "Remember me", nhấn Login. | Chuyển hướng tới `/builder/new`. Auth Cookie có thời hạn 30 ngày. | Blocker | [x] |

---

### 3.2 Giao Diện & Thiết Kế (UI/UX Design System)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.03a | UI/UX | Design | **[Positive]** Typography & Color Scheme | **1.** Mở `/builder/new`.<br>**2.** Kiểm tra (Inspect F12) màu và font các Headline, Button. | Mã màu Primary, Secondary, Error khớp 100% với Design Token trong Figma. Sử dụng font `Inter` hoặc `Roboto`, không dùng font mặc định trình duyệt. | High | [ ] |
| TC-F01.03b | UI/UX | Layout | **[Positive]** Bố cục khung Chat — Padding & Border | **1.** Nhập văn bản dài trong khung chat.<br>**2.** Đo khoảng cách Margin/Padding của Chat Bubble. | Padding giữa các Bubble đúng chuẩn (VD: `16px`). Border-radius bo góc mềm mại (VD: `8px`). Không bị méo khi nội dung dài. | High | [ ] |
| TC-F01.03c | UI/UX | State | **[Positive]** Trạng thái trang trống (Empty State) | **1.** Truy cập `/builder/new` khi chưa nhập gì.<br>**2.** Quan sát phần preview bên phải. | Hiển thị hình minh họa kèm dòng chữ gợi ý (VD: "Hãy bắt đầu bằng cách mô tả cửa hàng của bạn"). Không để trang trắng. | Medium | [ ] |
| TC-F01.03d | UI/UX | Interact | **[Positive]** Hiệu ứng Hover & Active trên nút CTA | **1.** Di chuột (Hover) và giữ chuột (Active) lên nút "Continue" hoặc "Publish". | Nút có hiệu ứng CSS Transition mượt: tối hơn 10% khi Hover, thu nhỏ nhẹ (scale 0.98) khi Click. | Medium | [ ] |
| TC-F01.03e | UI/UX | State | **[Positive]** Skeleton Loading khi đang tạo website | **1.** Nhấn tạo website.<br>**2.** Quan sát khung Preview trong 3 giây đầu. | Preview hiển thị các khối xám nhấp nháy (Shimmer/Skeleton) thay vì màn hình trắng chờ tải DOM. | High | [ ] |

---

### 3.3 Form Nhập Liệu & Validation (US-F01-02 & US-F01-05)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.04 | AC-1 | UI | **[Positive]** Hiển thị đầy đủ Form nhập liệu (Step 1/3) | **1.** Truy cập luồng tạo website bằng AI (`/builder/new`). | Hiển thị Form (không phải Chat) gồm 4 trường: Business Name (required), Industry (chips/buttons required), Products/Services (required), Description (optional). Nút "Continue — AI will create your website →" ở cuối form. Sidebar phải hiện 3 bước: "1. Enter business information → 2. AI creates content & design → 3. Preview & Publish". | Blocker | [x] |
| TC-F01.05 | AC-2 | Boundary | **[Negative]** Không cho submit khi thiếu trường bắt buộc | **1.** Để trống toàn bộ các trường bắt buộc.<br>**2.** Nhấn "Continue". | Hiển thị lỗi tại Business Name ("Must be at least 3 characters") và Industry. Form không gửi API request. | High | [ ] |
| TC-F01.06 | AC-3 | Func | **[Positive]** Industry — Chỉ chọn được 1 (Single-Select) | **1.** Click chọn "Tech / IT / SaaS".<br>**2.** Click chọn "Restaurant / Cafe / F&B". | Khi chọn chip thứ 2, chip thứ 1 tự động bỏ chọn (mất trạng thái `.active`). Industry chỉ lưu 1 giá trị duy nhất. Cần verify tất cả 9 options: Restaurant/Cafe/F&B, Shop/Fashion/Ecommerce, Tech/IT/SaaS, Health/Dental/Clinic, Real Estate/Property, Portfolio/Freelancer/Agency, Education/Training, Gym/Fitness/Yoga, Other. | Medium | [ ] |
| TC-F01.07 | Design | Sec | **[Negative]** Chống XSS Injection trong form | **1.** Nhập vào Products/Services: `<iframe src="javascript:alert('XSS')">`. Nhấn Continue. | Payload được HTML encode trước khi gửi. Request gửi tới API an toàn. Website được tạo ra escape chuỗi đúng cách. | Blocker | [x] |
| TC-F01.68 | AC-2 (02) | Val | **[Validation]** Business Name chỉ chứa dấu cách (Whitespace) | **1.** Nhập Business Name: `"     "` (5 dấu cách).<br>**2.** Nhấn Continue. | Hệ thống trim whitespace → hiển thị lỗi "Tên doanh nghiệp là bắt buộc". Form không gửi API. | High | [ ] |
| TC-F01.69 | AC-3 (02) | BVA | **[Boundary]** Business Name đúng 3 ký tự (Min BVA Pass) | **1.** Nhập Business Name: `"ABC"` (3 ký tự).<br>**2.** Điền đủ các trường khác, nhấn Continue. | Form chấp nhận (pass validation). API được gọi bình thường. | Medium | [ ] |
| TC-F01.70 | AC-3 (02) | BVA | **[Boundary]** Business Name 2 ký tự (Min BVA Fail) | **1.** Nhập Business Name: `"AB"` (2 ký tự).<br>**2.** Nhấn Continue. | Hiển thị lỗi "Must be at least 3 characters". Form không gửi API. | Medium | [ ] |
| TC-F01.71 | AC-2 (05) | BVA | **[Boundary]** Business Name vượt 255 ký tự (Max BVA) | **1.** Paste chuỗi 300 ký tự vào Business Name.<br>**2.** Nhấn Continue. | Frontend chặn hoặc cắt chuỗi tại 255 ký tự. DB không lưu chuỗi tràn. | High | [ ] |
| TC-F01.72 | AC-2 (05) | Val | **[Negative]** Industry không được chọn (bỏ qua required) | **1.** Điền Business Name, Products/Services hợp lệ.<br>**2.** Không chọn Industry chip nào. Nhấn Continue. | Hiển thị lỗi validation tại vùng Industry. Form không gửi API. | High | [ ] |
| TC-F01.73 | AC-1 (05) | UI | **[UI State]** Placeholder text hiển thị đúng mẫu gợi ý | **1.** Truy cập `/builder/new` lần đầu.<br>**2.** Quan sát các trường form chưa nhập. | Trường "Mô tả ngắn" hiện placeholder: "VD: Tiệm bánh handmade hoạt động từ 2020...". Các trường khác hiện gợi ý phù hợp. | Low | [ ] |
| TC-F01.74 | AC-2 (05) | Val | **[Negative]** Chỉ điền 1/3 trường bắt buộc (Partial Submit) | **1.** Chỉ nhập Business Name, bỏ trống Industry + Products/Services.<br>**2.** Nhấn Continue. | Hiển thị lỗi đồng thời tại 2 trường còn thiếu. Form không gửi API. | High | [ ] |

---

### 3.4 Tạo Website Bằng AI (US-F01-01: AI Generation & SSE)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.08 | AC-1 | Perf | **[Positive]** Tạo website thành công dưới 60 giây | **1.** Nhập đầy đủ Business Name và Industry hợp lệ, nhấn "Continue". | SSE stream bắt đầu trong < 2 giây. Giao diện hiển thị 3 bước tiến trình: "✅ Analyzing business information" → "⏳ Generating content & design" → "Preparing preview". Toàn bộ quá trình hoàn thành trong < 60 giây. Form bị khóa (disable) trong suốt quá trình. | Blocker | [x] |
| TC-F01.09 | AC-1 | UI | **[Positive]** Live Preview cập nhật theo thời gian thực | **1.** Quan sát iFrame preview bên phải trong quá trình tạo (khoảng giây 10–20). | Preview cập nhật mượt mà từng block theo chuỗi SSE stream. Có toggle **Desktop / Mobile** preview và nút **"View Full Preview"** để xem toàn màn hình. | High | [ ] |
| TC-F01.10 | AC-2 | NLU | **[Positive]** AI hỏi thêm khi thông tin quá mơ hồ | **1.** Submit thông tin nghèo nàn: chỉ "Web Bán Hàng" ở Business Name, không có mô tả chi tiết. | AI phát hiện thiếu ngữ cảnh và yêu cầu bổ sung thêm thông tin (VD: loại mặt hàng đang kinh doanh). | High | [x] |
| TC-F01.11 | AC-2 | Logic | **[Edge]** Tự động tạo website sau 2 lần hỏi thêm | **1.** Trả lời cụt lần 1 (VD: "Không biết").<br>**2.** Trả lời cụt lần 2. | Từ lượt thứ 3, AI ngừng hỏi, tự điền giá trị mặc định hợp lý và bắt đầu tạo website. | Medium | [x] |
| TC-F01.12 | AC-3 | Flow | **[Positive]** Hiển thị CTAs sau khi tạo xong | **1.** Chờ quá trình tạo website hoàn thành 100%. | Xuất hiện thông báo thành công: "Website has been created successfully!" kèm thống kê (số sections, thời gian). Hiển thị 2 nút CTA: **"Dashboard"** (primary) và **"Open Editor"** (secondary). Bản nháp tự động lưu vào DB. | High | [x] |
| TC-F01.13 | AC-4 | Data | **[Positive]** Khôi phục phiên làm việc khi Refresh (F5) | **1.** Trong lúc đang tạo (≈50%), nhấn F5 hoặc đóng trình duyệt.<br>**2.** Mở lại trang. | Gọi API `GET /api/drafts`. Giao diện không mất dữ liệu, tiếp tục từ điểm dừng (~50%). | High | [x] |
| TC-F01.14 | AC-5 | Edge | **[Negative]** Xử lý lỗi khi API OpenAI timeout | **1.** Mô phỏng timeout mạng tới OpenAI. | Thanh tiến trình dừng lại. Hiển thị toast đỏ: "Không thể tạo website". | High | [ ] |
| TC-F01.15 | AC-5 | UX | **[Positive]** Giữ nguyên dữ liệu form khi Retry | **1.** Tiếp nối TC-F01.14. Kiểm tra form nhập liệu. | Dữ liệu đã nhập trước đó không bị xóa. Nút "Thử lại" gửi lại request cũ mà không cần nhập lại. | Blocker | [x] |
| TC-F01.75 | AC-3 (05) | State | **[UI State]** Form bị khóa (disable) trong lúc generate | **1.** Nhấn Continue với dữ liệu hợp lệ.<br>**2.** Trong lúc SSE stream đang chạy, thử click vào các input field và nút Submit. | Tất cả input fields và button đều ở trạng thái Disabled. Không thể chỉnh sửa hoặc submit lần 2. | Blocker | [ ] |
| TC-F01.76 | AC-1 (01) | Perf | **[Negative]** Generation vượt quá 60 giây (Timeout) | **1.** Simulate API OpenAI phản hồi chậm >60 giây. | Hệ thống hiển thị thông báo timeout. Toast báo lỗi "Quá trình tạo website mất quá lâu. Vui lòng thử lại". Form unlock cho retry. | Blocker | [ ] |
| TC-F01.77 | AC-1 (01) | Net | **[Negative]** SSE stream bị ngắt giữa chừng | **1.** Bắt đầu generate bình thường.<br>**2.** Cắt kết nối mạng khi tiến trình đạt ~50%. | Preview giữ nguyên trạng thái cuối cùng nhận được (không bị trắng). Toast đỏ báo lỗi kết nối. Nút "Thử lại" xuất hiện. | Blocker | [x] |
| TC-F01.78 | AC-3 (01) | Edge | **[Edge]** Full-screen view vô hiệu hóa Drag-and-Drop | **1.** Tại preview, nhấn "View Full Preview" để chuyển Full-screen.<br>**2.** Thử hover và kéo block. | Drag handle không xuất hiện. Không thể kéo thả block. Chỉ khi quay về Normal view mới kéo thả được. | High | [ ] |
| TC-F01.79 | AC-1 (01) | Flow | **[Recovery]** Hủy (Abort) quá trình generate giữa chừng | **1.** Nhấn Generate, chờ SSE stream chạy ~30%.<br>**2.** Nhấn nút Hủy (X) hoặc navigate sang trang khác. | SSE stream bị đóng. Dữ liệu nháp (nếu có) được lưu dưới dạng Draft incomplete. Form dữ liệu gốc được giữ nguyên khi quay lại. | High | [ ] |
| TC-F01.80 | FR-08 | Race | **[Race]** Double-click nút "Tạo Website" (Anti-spam) | **1.** Điền form hợp lệ.<br>**2.** Click nhanh 2 lần liên tiếp vào nút "Continue — AI will create your website →". | Nút chuyển sang trạng thái Disabled + Loading ngay sau click đầu tiên. Chỉ gửi 1 API request duy nhất. Không tạo 2 site trùng lặp. | Blocker | [ ] |
| TC-F01.81 | AC-4 (01) | Edge | **[Edge]** Draft hết hạn 24 giờ — hiển thị thông báo | **1.** Tạo draft, không hoàn thành. Đợi >24 giờ (hoặc set createdAt cũ trong DB).<br>**2.** Truy cập lại `/builder/new`. | Hệ thống không load draft cũ. Hiển thị form trống mới hoàn toàn. Không báo lỗi crash. | Medium | [ ] |
| | | | **--- [Issue #246] Comprehensive QA Expert: 13 TCs bổ sung ---** | | | | |
| TC-F01.99 | AC-3 (01) | UI | **[UI State]** Toggle Desktop ↔ Mobile trong Full-screen Preview | **1.** Sau generate → mở Full-screen view.<br>**2.** Click toggle Desktop/Mobile lần lượt. | Preview chuyển đúng viewport (1920px ↔ 375px). Content responsive, layout không vỡ. Không thể edit ở cả 2 mode. Toggle active state highlight đúng. | High | [ ] |
| TC-F01.100 | AC-3 (01) | Flow | **[Flow]** "Tinh chỉnh" redirect đúng Editor với Draft data | **1.** Generate xong → click "Tinh chỉnh".<br>**2.** Kiểm tra URL và data trong Editor. | Redirect đúng `/editor/:siteId`. Toàn bộ 4 trang + navigation + content AI tạo load đầy đủ. Draft status hiện trong Editor. | Blocker | [ ] |
| TC-F01.101 | AC-3 (01) | Flow | **[Flow]** "Publish ngay" deploy live subdomain | **1.** Generate xong → click "Publish ngay".<br>**2.** Truy cập `{slug}.primeweb.app`. | Site deploy < 30s. Subdomain accessible. 4 trang + navigation hoạt động. Content hiển thị đúng. | Blocker | [ ] |
| TC-F01.102 | AC-4 (01) | State | **[Recovery]** Close tab → reopen giữ draft | **1.** Đang generate ~50% → đóng tab hoàn toàn.<br>**2.** Mở lại `/builder/new`. | Draft recoverable từ DB. Form không yêu cầu nhập lại. Tiếp tục từ bước đã dừng hoặc hiện draft đã generate. | High | [ ] |
| TC-F01.103 | AC-6 (01) | Func | **[Validation]** Homepage chứa Banner + Image Carousel + tổng quan | **1.** Generate xong → mở Homepage trong preview.<br>**2.** Kiểm tra các block. | Homepage có: Hero Banner (ảnh AI/stock), Image Carousel nổi bật, và đoạn tổng quan business dựa trên input. Không thiếu block nào. | Blocker | [ ] |
| TC-F01.104 | AC-6 (01) | Func | **[Validation]** About Us chứa Vision + Mission | **1.** Navigate đến trang About Us.<br>**2.** Kiểm tra nội dung. | Trang About Us có: đoạn About company, Vision (tầm nhìn), Mission (sứ mệnh). Nội dung phù hợp với business info đã nhập. | High | [ ] |
| TC-F01.105 | AC-6 (01) | Func | **[Validation]** Products & Services liệt kê đúng mặt hàng | **1.** Navigate đến trang Products.<br>**2.** Kiểm tra nội dung. | Trang liệt kê các mặt hàng/dịch vụ đã nhập trong form (VD: "Phở bò, phở gà"). Layout tối ưu cho ngành nghề. Không có nội dung trống. | High | [ ] |
| TC-F01.106 | AC-6 (01) | Func | **[Validation]** Contact Us chứa đủ thông tin liên hệ | **1.** Navigate đến trang Contact.<br>**2.** Kiểm tra các field. | Trang Contact có: Địa chỉ, số điện thoại, email, contact form. Dữ liệu lấy từ input hoặc AI generate hợp lý. | High | [ ] |
| TC-F01.107 | AC-7 (01) | Theme | **[Validation]** Màu sắc + Font phù hợp ngành F&B | **1.** Tạo website ngành F&B.<br>**2.** Inspect CSS: primary color, font-family. | Tone màu ấm (đỏ/cam/vàng). Font thân thiện (sans-serif). Không dùng tone lạnh (xanh tech). Background/hero phù hợp food imagery. | High | [ ] |
| TC-F01.108 | AC-7 (01) | Theme | **[Validation]** Màu sắc + Font phù hợp ngành Thời trang | **1.** Tạo website ngành Fashion/Retail.<br>**2.** Inspect CSS. | Tone hiện đại (đen/trắng/gold hoặc trendy). Font thanh lịch. Layout image-heavy, product grid nổi bật. | High | [ ] |
| TC-F01.109 | AC-1 (01) | UI | **[UI State]** Progress steps realtime: "Đang tạo Banner... About Us..." | **1.** Nhấn "Tạo Website".<br>**2.** Quan sát progress messages. | Progress cập nhật tuần tự: "Đang tạo Banner..." → "About Us..." → "Products..." → "Contact...". Mỗi step hiện ít nhất 2 giây. Không bị skip. | High | [ ] |
| TC-F01.110 | AC-1 (01) | Perf | **[Performance]** AI stream first token < 2 giây | **1.** Nhấn "Tạo Website" với tiếng Việt + BM.<br>**2.** Đo thời gian từ click → SSE first event. | SSE stream bắt đầu trong < 2 giây. Preview bắt đầu render. Không có blank wait > 2s. | Blocker | [ ] |
| TC-F01.111 | AC-7 (01) | Edge | **[Edge]** Ngành nghề không rõ ràng → AI chọn layout mặc định | **1.** Nhập ngành: "Kinh doanh tổng hợp" hoặc mô tả mơ hồ.<br>**2.** Generate website. | AI detect không rõ category → dùng generic layout mặc định. Website vẫn có đủ 4 trang + navigation. Không crash. | Medium | [ ] |

---

### 3.5 Responsive Mobile — Form & Preview (US-F01-09)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.16 | AC-8 | Mobile | **[Positive]** Chuyển đổi chế độ xem trên mobile (375px) | **1.** Mở trang trên thiết bị mobile hoặc simulator 375px. | Form chiếm 100% chiều rộng màn hình. iFrame Preview ẩn mặc định. Có toggle để chuyển qua lại giữa Form và Preview. | Low | [ ] |
| TC-F01.M01 | AC-1 (09) | Mobile | **[Positive]** Form xếp dọc (Vertical Layout) trên mobile | **1.** Truy cập `/builder/new` trên thiết bị 375px. | 4 trường nhập liệu (Business Name, Industry, Products/Services, Description) xếp dọc full-width. Labels nằm **phía trên** input. Không có thanh cuộn ngang (horizontal scroll). | High | [ ] |
| TC-F01.M02 | AC-1 (09) | Mobile | **[Positive]** Font size ≥ 16px chống iOS auto-zoom | **1.** Trên iPhone/Safari: nhấn vào ô nhập liệu bất kỳ. | Font-size tất cả input ≥ 16px. Safari không tự zoom màn hình khi focus vào input. | High | [ ] |
| TC-F01.M03 | AC-1 (09) | Mobile | **[Positive]** Nút CTA dính đáy màn hình (Sticky) | **1.** Trên mobile, mở bàn phím ảo bằng cách nhấn vào ô nhập liệu. | Nút "Continue — AI will create your website →" luôn hiển thị ở đáy màn hình, không bị bàn phím ảo che khuất. | Blocker | [ ] |
| TC-F01.M04 | Design | Mobile | **[Positive]** Industry Chips hiển thị 2 cột trên mobile | **1.** Trên mobile 375px, quan sát phần Industry. | 9 chips Industry hiển thị trong layout 2 cột, đủ chỗ cho text, không bị tràn hoặc cắt chữ. | Medium | [ ] |
| TC-F01.M05 | Design | Mobile | **[Positive]** Trường Description không bắt buộc | **1.** Trên mobile, để trống trường Description (optional).<br>**2.** Nhấn "Continue". | Form cho phép submit mà không báo lỗi ở trường Description. | Medium | [ ] |
| TC-F01.M06 | Bug | Mobile | **[Negative]** Trường Products/Services không bị hiển thị trùng lặp | **1.** Trên mobile 375px, cuộn xuống phần dưới form. | Trường "Products / Services" chỉ xuất hiện **đúng 1 lần**. Không có hiện tượng render trùng (duplicate). | Blocker | [ ] |
| TC-F01.M07 | AC-2 (09) | Mobile | **[Positive]** Chuyển từ Form sang màn hình Generation | **1.** Trên mobile, nhấn "Continue" sau khi điền đủ thông tin. | Form trượt ra (slide away) biến mất. Màn hình chuyển sang trạng thái Generation với thông báo "Starting website creation..." dạng chat bubble. Không hiển thị inline iframe preview. | High | [ ] |
| TC-F01.M08 | AC-3 (09) | Mobile | **[Positive]** Hiển thị tiến trình tạo website trên mobile | **1.** Quan sát màn hình mobile trong quá trình AI đang tạo website. | Hiển thị floating pill hoặc chat bubble ở cuối màn hình thông báo bước hiện tại (VD: "✨ Đang tạo Hero Banner..."). Backdrop hơi mờ (blur) để không che hoàn toàn nội dung. | High | [ ] |
| TC-F01.M09 | Design | Mobile | **[Positive]** Màn hình thành công trên mobile | **1.** Chờ tạo website hoàn tất trên mobile. | Hiển thị card thành công: "Website has been created successfully!" kèm "+N sections generated" và thời gian tạo. Có nút "View Full Preview" để mở preview toàn màn hình. | High | [ ] |
| TC-F01.M10 | Design | Mobile | **[Positive]** Nút CTA xếp dọc trên mobile (Success) | **1.** Quan sát phần nút bấm sau khi tạo xong website trên mobile. | Hai nút **"Dashboard"** (primary, gradient xanh, full-width) và **"Open Editor"** (secondary, outline) xếp dọc theo thứ tự. | Medium | [ ] |
| TC-F01.M11 | Design | Mobile | **[Positive]** Nút "View Full Preview" mở preview toàn màn hình | **1.** Trên mobile, nhấn nút "View Full Preview" ở màn hình thành công. | Mở preview website full-screen vì mobile không có panel preview inline như desktop. | High | [ ] |
| TC-F01.M14 | AC-1 (09) | Mobile | **[Edge]** Xoay ngang màn hình (Landscape) trong khi nhập form | **1.** Trên mobile, đang nhập form ở Portrait.<br>**2.** Xoay ngang sang Landscape. | Layout responsive không vỡ. Input data vẫn giữ nguyên. Nút sticky CTA vẫn hiển thị đúng vị trí. | Medium | [ ] |
| TC-F01.M15 | AC-2 (09) | Mobile | **[Recovery]** Nhấn Back khi đang ở chế độ Immersive Preview | **1.** Trên mobile, đang xem Immersive Preview (generation hoàn tất).<br>**2.** Nhấn nút Back của trình duyệt. | Quay lại form với dữ liệu đã nhập. Không bị mất trạng thái. Không gọi API generate lại. | High | [ ] |

---

### 3.6 Cấu Trúc Website & Layout Theo Ngành (US-F01-01)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.17 | AC-9 | Func | **[Positive]** Website tạo ra có đủ 4 trang bắt buộc | **1.** Mở website vừa tạo xong. Kiểm tra menu điều hướng (navigation). | Có đúng 4 trang: Homepage, About, Products, Contact. Tất cả link trả mã HTTP 200. | Blocker | [x] |
| TC-F01.18 | AC-10 | Theme | **[Positive]** Layout phù hợp ngành F&B | **1.** Nhập: "Mở Quán Phở bò Nam Định". Tạo website, kiểm tra layout. | Layout sử dụng component phù hợp ngành ẩm thực (VD: Menu Grid, Food Gallery). Tone màu ấm. | High | [ ] |
| TC-F01.19 | AC-10 | Theme | **[Positive]** Layout phù hợp ngành Spa/Beauty | **1.** Nhập: "Mở tiệm Nails Spa". Tạo website, kiểm tra layout. | Layout sử dụng Gallery mẫu nails. Tone màu chủ đạo Pastel mềm mại, thanh nhã. | High | [ ] |
| TC-F01.82 | AC-7 (01) | Theme | **[Positive]** Layout phù hợp ngành Tech/IT/SaaS | **1.** Nhập: "SaaS platform for project management".<br>**2.** Tạo website, kiểm tra layout. | Layout text-focused với trust signals, testimonials section. Tone màu chuyên nghiệp (xanh dương/xám). | High | [ ] |
| TC-F01.83 | AC-7 (01) | Edge | **[Edge]** Layout ngành "Other" — Fallback mặc định | **1.** Chọn Industry = "Other".<br>**2.** Nhập mô tả chung chung. Tạo website. | Hệ thống sử dụng layout generic mặc định. Website vẫn tạo thành công với cấu trúc 4 trang đầy đủ. | Medium | [ ] |
| TC-F01.84 | AC-6 (01) | Func | **[Positive]** Navigation menu liên kết đầy đủ 4 trang | **1.** Tạo website hoàn chỉnh.<br>**2.** Click lần lượt từng link trong menu: Home, About, Products, Contact. | Tất cả 4 link trả về HTTP 200. Nội dung mỗi trang hiển thị đúng. Không có link trỏ sai hoặc broken (404). | Blocker | [x] |

---

### 3.7 Tạo Ảnh Bằng AI (US-F01-03)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.20 | AC-6 | API | **[Positive]** Tạo ảnh Hero Banner bằng DALL-E | **1.** Nhập prompt tạo cửa hàng thú cưng. Kiểm tra ảnh Hero. | Ảnh Hero Banner được tạo (1200×400px), URL ảnh trỏ về Payload CMS media (`/media/dalle-img.jpg`). | Blocker | [x] |
| TC-F01.21 | AC-6 | Edge | **[Negative]** Sử dụng ảnh dự phòng khi API ảnh lỗi | **1.** Mock API DALL-E trả lỗi. Tạo website. | Website vẫn tạo thành công. Ảnh Hero sử dụng stock image phù hợp ngành từ thư viện dự phòng. Không hiển thị ảnh bị lỗi (broken image). | High | [x] |
| TC-F01.59 | AC-3 (03) | Func | **[Positive]** Tạo lại ảnh AI (Regenerate Image) | **1.** Sau khi tạo website xong, nhấn nút "Generate New Image" trên ảnh Hero.<br>**2.** Chờ ảnh mới được tạo. | Ảnh mới thay thế ảnh cũ. Ảnh mới tự động lưu vào Payload CMS media library. | High | [ ] |
| TC-F01.85 | AC-1 (03) | Net | **[Negative]** Upload ảnh CDN timeout | **1.** Simulate CDN (Cloudinary/Payload media) upload bị timeout.<br>**2.** Quan sát quá trình generate. | Website vẫn tạo thành công. Vị trí ảnh Hero sử dụng stock image fallback. Không hiển thị broken image icon. | High | [ ] |
| TC-F01.86 | AC-3 (03) | Race | **[Race]** Nhấn Regenerate Image liên tục (Rate Limit) | **1.** Nhấn "Generate New Image" 5 lần liên tiếp trong vòng 10 giây. | Nút bị disable sau lần click đầu, chỉ gửi 1 API request. Hoặc hiển thị thông báo rate limit sau N lần. Không tạo 5 ảnh trùng lặp. | High | [ ] |

---

### 3.8 Xuất Bản & Hậu Xuất Bản (US-F01-04 & US-F01-07)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.22 | AC-7 | Flow | **[Positive]** Publish website dưới 30 giây | **1.** Tại trang kết quả, nhấn nút Publish. | Website xuất bản thành công trong < 30 giây. Truy cập `{slug}.primeweb.app` trả HTTP 200. | Blocker | [x] |
| TC-F01.23 | AC-18 | UI | **[Positive]** Màn hình thành công sau Publish | **1.** Chờ Publish hoàn tất, quan sát Popup/Modal hiện lên. | Hiển thị domain màu xanh nổi bật. Có các nút: "Copy Link", "View Live Site", "Go to Admin Dashboard". | Medium | [ ] |
| TC-F01.24 | AC-19 | Sec | **[Positive]** Chuyển hướng SSO vào CMS Admin | **1.** Nhấn nút "Go to Admin Dashboard". | Chuyển hướng tới `/admin/collections/sites` thành công. Không yêu cầu đăng nhập lại (JWT auth tự động). | Blocker | [x] |
| TC-F01.25 | AC-20 | State | **[Positive]** Tiếp tục chỉnh sửa (Continue Editing) | **1.** Nhấn nút "Open Editor" (hoặc "Continue Editing"). | Chuyển hướng tới `/editor/:id`. Trạng thái website trong DB đã cập nhật từ Draft sang Published. | High | [x] |
| TC-F01.26 | AC-21 | Func | **[Positive]** Sao chép link website (Copy to Clipboard) | **1.** Nhấn nút "Copy Link" trên màn hình thành công. | Hiển thị thông báo "Copied ✓" hoặc "Link copied! 🎉". Giá trị trong clipboard khớp chính xác với subdomain URL. | Low | [ ] |
| TC-F01.60 | AC-2 (04) | Func | **[Positive]** Unpublish — Website trả 404 | **1.** Vào Settings của website đã publish.<br>**2.** Nhấn "Unpublish". | Website chuyển về trạng thái Draft. Truy cập URL `{slug}.primeweb.app` trả HTTP 404. Dashboard hiển thị trạng thái "Draft". | Blocker | [ ] |
| TC-F01.87 | AC-1 (04) | Net | **[Negative]** Publish thất bại do mất kết nối mạng | **1.** Nhấn Publish.<br>**2.** Ngắt kết nối mạng ngay khi tiến trình bắt đầu. | Hiển thị Toast lỗi kết nối. Website vẫn giữ trạng thái Draft. Nút Publish khôi phục enabled cho retry. | Blocker | [ ] |
| TC-F01.88 | AC-1 (04) | Race | **[Race]** Double-click nút Publish (Anti-spam) | **1.** Nhấn nút Publish nhanh 2 lần liên tiếp. | Nút chuyển Disabled + Loading spinner ngay lần click đầu. Chỉ gửi 1 API request. Không tạo trùng lặp 2 bản Live. | Blocker | [ ] |
| TC-F01.89 | AC-1 (04) | State | **[UI State]** Loading state khi Publish đang chạy | **1.** Nhấn Publish.<br>**2.** Quan sát giao diện trong 30 giây. | Nút Publish hiện spinner/loading text. Thanh progress hoặc thông báo bước đang thực hiện. User không thể thực hiện thao tác khác trong lúc đợi. | High | [ ] |
| TC-F01.90 | AC-2 (04) | Flow | **[Recovery]** Re-publish sau khi đã Unpublish | **1.** Unpublish website (TC-F01.60).<br>**2.** Nhấn Publish lại. | Website chuyển lại trạng thái Published. URL `{slug}.primeweb.app` hoạt động trả HTTP 200. Nội dung hiển thị đúng version mới nhất. | High | [ ] |

---

### 3.9 Đa Ngôn Ngữ & NLU (US-F01-06)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.27 | AC-11 | Locale | **[Positive]** Giao diện mặc định hiển thị tiếng Anh | **1.** Xóa session, truy cập `/builder/new` với tài khoản mới. | Giao diện chào bằng tiếng Anh (VD: "Hi! I'm your AI Builder"). Có dòng hướng dẫn mẫu bằng tiếng Anh. | Medium | [ ] |
| TC-F01.28 | AC-12 | NLU | **[Positive]** Nhận diện ngữ cảnh tiếng Việt | **1.** Nhập: "Tôi muốn xây trang bán cơm sườn". | AI nhận diện ngôn ngữ tiếng Việt. Phản hồi và nội dung website được tạo bằng tiếng Việt phù hợp. | High | [ ] |
| TC-F01.29 | AC-12 | NLU | **[Positive]** Nhận diện Bahasa Melayu | **1.** Nhập: "Kedai Makan sedap". | AI nhận diện ngôn ngữ Bahasa Melayu. Phản hồi bằng BM formal (không phải Bahasa Indonesia). Nội dung website bằng BM. | High | [x] |
| TC-F01.30 | AC-13 | Logic | **[Positive]** Quick-reply Chips thu thập lựa chọn nhanh | **1.** Nhấn vào chip gợi ý (VD: `[👗 Fashion]`). | Chip gửi giá trị tương ứng (như "Fashion") mà không cần gõ. Hệ thống xử lý như input thông thường. | Low | [ ] |
| TC-F01.31 | AC-13 | Limit | **[Negative]** Giới hạn số lượt hỏi đáp tối đa 4 vòng | **1.** Nhập nội dung vô nghĩa (VD: "hmmm...") qua lại 4 lần. | Từ lượt thứ 4, AI ngừng hỏi và tự động bắt đầu tạo website với thông tin đã thu thập được. | High | [x] |
| TC-F01.32 | AC-14 | NLU | **[Positive]** Trích xuất nhiều thực thể từ một câu | **1.** Nhập: "Tiệm Coffee Sữa đá Quận 1 Mở 2 Năm". | AI trích xuất được: loại hình = coffee, vị trí = Quận 1, thâm niên = 2 năm. Không hỏi lại từng mục riêng lẻ. | Medium | [ ] |
| TC-F01.33 | AC-15 | Locale | **[Positive]** Nội dung tiếng Việt chuyên nghiệp cho SME | **1.** Tạo website hoàn chỉnh bằng tiếng Việt, kiểm tra nội dung output. | Các đoạn văn (heading, CTA, mô tả) sử dụng văn phong chuyên nghiệp phù hợp doanh nghiệp Việt Nam. Không có lỗi ngữ pháp nghiêm trọng. | High | [x] |
| TC-F01.34 | AC-15 | Locale | **[Positive]** Nội dung Bahasa Melayu formal | **1.** Tạo website bằng BM, kiểm tra nội dung output. | Nội dung sử dụng Bahasa Melayu lịch sự (formal), phù hợp thị trường Malaysia. Không lẫn với Bahasa Indonesia. | High | [x] |
| TC-F01.35 | AC-16 | Func | **[Positive]** Gợi ý thêm phiên bản tiếng Anh | **1.** Tạo xong website bằng tiếng Việt hoặc BM.<br>**2.** Quan sát màn hình kết quả. | Hiển thị gợi ý: "Want an English version too? [Add English Content]". Nếu chọn → tạo thêm bản dịch tiếng Anh song song. | Medium | [ ] |
| TC-F01.36 | AC-17 | Edge | **[Negative]** Fallback sang tiếng Anh với ngôn ngữ không hỗ trợ | **1.** Nhập bằng tiếng Ả Rập: `أريد بناء` hoặc tiếng H’Mông. | Website vẫn tạo thành công bằng tiếng Anh (fallback). Hiển thị thông báo giải thích (VD: "Your site has been generated in English"). Không bị crash. | High | [x] |
| TC-F01.91 | AC-1 (06) | Edge | **[Edge]** Input trộn 3 ngôn ngữ cùng lúc | **1.** Nhập: "Kedai makan, bán phở bò, with delivery service".<br>(BM + Việt + English trộn lẫn) | AI nhận diện ngôn ngữ chính xác nhất (hoặc fallback EN). Website tạo thành công với nội dung nhất quán 1 ngôn ngữ duy nhất. Không bị lộn xộn đa ngữ. | Medium | [ ] |
| TC-F01.92 | AC-2 (06) | Flow | **[Negative]** Bỏ qua gợi ý ngôn ngữ thứ 2 (Skip) | **1.** Tạo website bằng tiếng Việt thành công.<br>**2.** Gợi ý "Want an English version too?" xuất hiện. Nhấn bỏ qua (skip). | Hệ thống không tạo bản dịch. Website giữ nguyên 1 ngôn ngữ duy nhất. Không tốn token API. Không hiển lại gợi ý. | Low | [ ] |

---

### 3.10 NLU Nâng Cao — Tình Huống Thực Tế

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.53 | NLU | Lang | **[Positive]** Nhận diện trộn ngôn ngữ (Code-switching) | **1.** Nhập: "Mình muốn open 1 cái coffee shop ở district 1, phong cách vintage". | AI nhận diện ngôn ngữ chính là tiếng Việt. Hiểu các từ tiếng Anh xen kẽ (coffee shop, district 1, vintage) để chọn layout phù hợp quán cà phê phong cách cổ điển. | High | [ ] |
| TC-F01.54 | NLU | Logic | **[Positive]** Xử lý lỗi chính tả và tiếng lóng | **1.** Nhập: "Mk mún dg 1 wán nướng vĩa hè cho shvu sinh vin". | AI tự normalize thành: "Tôi muốn dựng 1 quán nướng vỉa hè cho sinh viên". Nội dung website sử dụng văn phong chuyên nghiệp, không có tiếng lóng. | High | [ ] |
| TC-F01.55 | NLU | Flow | **[Positive]** Chuyển ngôn ngữ giữa chừng (Mid-thread Pivot) | **1.** Bắt đầu bằng tiếng Anh: "I need a pizza store". AI phản hồi tiếng Anh.<br>**2.** Tiếp: "À quên, làm web tiếng Việt giúp nha, khách ở Hà Nội". | Từ lượt thứ 2, AI chuyển hoàn toàn sang tiếng Việt cho cả giao diện hội thoại lẫn nội dung website. Đơn vị tiền tệ đổi sang VNĐ. | High | [ ] |
| TC-F01.56 | UI/UX | Font | **[Boundary]** Hiển thị ký tự đặc biệt (CJK, RTL) trong Chat | **1.** Nhập câu chứa ký tự tiếng Trung: "Mở Nhà Hàng Dimsum 點心" hoặc ký tự Ả Rập (RTL). | Font render đúng ký tự tượng hình, không hiện ô vuông (□). Không bị tràn hoặc nhảy dòng bất thường trong ô nhập liệu. | Medium | [ ] |
| TC-F01.57 | NLU | Logic | **[Positive]** Nội dung song ngữ trong cùng 1 website | **1.** Nhập: "Tạo web bán áo thun, nội dung để cả tiếng Anh và tiếng Việt đan xen nhé". | AI tạo website với nội dung song ngữ (VD: heading "Sản Phẩm Mới / New Arrivals"). | High | [ ] |

---

### 3.11 Kéo Thả Sắp Xếp Block (US-F01-08: Drag-and-Drop)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.37 | AC-22 | UX | **[Positive]** Kéo thả đổi vị trí block trên Desktop | **1.** Tại preview (Normal view), hover vào block Products.<br>**2.** Kéo handle (⠿) lên trên Hero Block rồi thả. | Block Products di chuyển tới vị trí trước Hero. Preview cập nhật tức thì, không reload. Không thể kéo thả ở chế độ Full-screen view. | Blocker | [ ] |
| TC-F01.38 | AC-22 | Func | **[Positive]** Đồng bộ thứ tự block trong State | **1.** Sau khi kéo thả, kiểm tra biến `builderStore` trong DevTools. | Mảng blocks đã cập nhật thứ tự index mới, sẵn sàng cho lệnh Publish. | High | [ ] |
| TC-F01.39 | AC-23 | UI | **[Positive]** Hiệu ứng CSS khi đang kéo | **1.** Kéo một block, giữ ở giữa (drag in-progress). | Block gốc có opacity 0.7 + box-shadow. Vị trí drop target hiển thị đường highlight. Animation smooth 200–300ms khi thả block. | Low | [ ] |
| TC-F01.40 | AC-24 | DB | **[Positive]** Lưu thứ tự block vào Database | **1.** Hoàn tất kéo thả, nhấn "Publish". | Request `PATCH/PUT` gửi mảng `page.layout.sortOrder` tới Payload CMS. Dữ liệu trong DB khớp 100% với thứ tự vừa sắp xếp trong Preview. | Blocker | [x] |
| TC-F01.41 | AC-24 | DB | **[Positive]** Website live hiển thị đúng thứ tự đã sắp xếp | **1.** Hoàn tất TC-F01.40. Mở website public trên trình duyệt khác. | Thứ tự block trên website live khớp chính xác với thứ tự vừa kéo thả. | High | [x] |
| TC-F01.42 | AC-25 | Mobile | **[Positive]** Kéo thả bằng cử chỉ chạm (Touch Drag) trên mobile | **1.** Trên mobile 375px, bật chế độ Preview. Giữ chạm (longpress 500ms) vào drag handle của block. | Block có thể kéo thả bằng cử chỉ touch. Thả tay → block hoán đổi vị trí mượt mà. | High | [ ] |
| TC-F01.43 | AC-25 | Mobile | **[Negative]** Không xung đột giữa kéo block và cuộn trang | **1.** Trên mobile, kéo block trong khi cuộn trang. | CSS `touch-action: none` khóa cuộn trang khi đang kéo block. Chỉ 1 thao tác xảy ra tại một thời điểm, không bị giật hoặc cuộn nhầm. | High | [ ] |
| TC-F01.44 | AC-26 | Logic | **[Negative]** Không cho kéo block Navigation (Header) | **1.** Hover vào block Navigation Header trên cùng. | Drag handle **không xuất hiện**. Tooltip hiển thị: "Navigation and Footer position is fixed". | Blocker | [ ] |
| TC-F01.45 | AC-26 | Logic | **[Negative]** Không cho kéo block Footer | **1.** Kéo block nội dung xuống dưới Footer. | Không thể thả block vào vị trí dưới Footer. Footer cố định ở cuối trang, không thể di chuyển. | High | [ ] |
| TC-F01.93 | AC-1 (08) | Recov | **[Recovery]** Undo reorder bằng Ctrl+Z | **1.** Kéo block About Us lên trước Hero.<br>**2.** Nhấn Ctrl+Z. | Block trở về vị trí ban đầu. State (builderStore) revert chính xác. Preview cập nhật tức thì. | High | [ ] |
| TC-F01.94 | AC-3 (08) | DB | **[Negative]** Kéo thả nhưng không Publish — DB chưa lưu | **1.** Kéo thả đổi vị trí 2 block.<br>**2.** Đóng tab mà không nhấn Publish. Kiểm tra DB. | DB vẫn giữ thứ tự cũ. Dữ liệu chỉ được persist khi user xác nhận Publish hoặc Save. | High | [ ] |

---

### 3.13 Mobile Reorder — Chạm An Toàn (US-F01-10)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.M12 | AC-1 (10) | Mobile | **[Positive]** Sắp xếp block bằng nút Lên/Xuống (Tap Up/Down) | **1.** Trên mobile, chạm vào block (VD: About Us).<br>**2.** Nhấn nút [⬆ Lên] trên floating action bar. | Block hoán đổi vị trí với block phía trên tức thì. State được cập nhật, không cần reload. Nút chạm phải ≥ 44×44px (chuẩn touch target). | High | [ ] |
| TC-F01.M13 | AC-2 (10) | Mobile | **[Positive]** Chế độ sắp xếp dạng danh sách (Card List Mode) | **1.** Trên mobile, nhấn nút "≡ Sắp xếp" trên toolbar.<br>**2.** Kéo thả các card nhỏ gọn.<br>**3.** Nhấn "Xong". | Iframe preview tạm thời thay bằng danh sách Card (Hero, About, Products, Contact). Kéo thả card native smooth, không xung đột scroll. Sau khi nhấn "Xong", quay lại preview đầy đủ với thứ tự mới. | High | [ ] |
| TC-F01.M16 | AC-1 (10) | Edge | **[Edge]** Nhấn Up khi block đã ở vị trí đầu tiên | **1.** Trên mobile, chạm vào block đầu tiên (Hero).<br>**2.** Nhấn [⬆ Lên]. | Nút [⬆ Lên] bị disabled (mờ) vì không có block nào phía trên. Block không thay đổi vị trí. Không xuất hiện lỗi. | Medium | [ ] |
| TC-F01.M17 | AC-1 (10) | Edge | **[Edge]** Nhấn Down khi block đã ở vị trí cuối cùng | **1.** Trên mobile, chạm vào block cuối (Contact).<br>**2.** Nhấn [⬇ Xuống]. | Nút [⬇ Xuống] bị disabled. Block giữ nguyên vị trí. Không xuất hiện lỗi. | Medium | [ ] |
| TC-F01.M18 | AC-2 (10) | Flow | **[Edge]** Nhấn "Xong" mà không kéo thả gì | **1.** Mở Card List Mode.<br>**2.** Không kéo thả bất kỳ card nào. Nhấn "Xong". | Preview quay lại bình thường. Thứ tự block không thay đổi. API không gọi update. | Low | [ ] |

---

### 3.14 Giới Hạn Kinh Doanh & Bảo Mật (Business Rules & Security)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.46 | FR-15 | API | **[Negative]** Chống tấn công Rate Limit (API Flood) | **1.** Gửi 10 request/giây tới `POST /api/ai/generate-site` bằng script. | Middleware chặn trước khi request tới OpenAI. Trả mã `HTTP 429 Too Many Requests`. | Blocker | [x] |
| TC-F01.47 | FR-15 | DB | **[Negative]** Giới hạn tạo website cho gói Free | **1.** Tài khoản Free đã tạo 1 website thành công. Nhấn tạo website lần 2. | Hiển thị modal "Nâng cấp gói để tạo thêm website". API không gửi request tới OpenAI. | Blocker | [x] |
| TC-F01.48 | BR-01 | Sec | **[Negative]** Cách ly dữ liệu theo Tenant (Tenant Isolation) | **1.** Dùng JWT của User A gửi GET request lấy dữ liệu website của User B bằng ID trực tiếp. | Server trả `HTTP 403 Forbidden`. Không trả dữ liệu của user khác. | Blocker | [x] |
| TC-F01.49 | BR-06 | Data | **[Negative]** Chặn nội dung phản cảm (NSFW Content Filter) | **1.** Nhập prompt chứa nội dung bạo lực, khiêu dâm, hoặc lừa đảo. | API từ chối xử lý, trả HTTP 400. Không gọi tới OpenAI. Hiển thị thông báo lỗi vi phạm chính sách. | Blocker | [x] |
| TC-F01.50 | BR-09 | Cron | **[Positive]** Tự động xóa bản nháp quá 30 ngày | **1.** Tạo document Draft trong MongoDB với `createdAt` > 30 ngày. Kích hoạt Cron Job. | Payload CMS xóa bản nháp cũ (hard delete). Giải phóng dung lượng DB. | High | [x] |
| TC-F01.51 | BR-09 | Cron | **[Positive]** Giữ nguyên website đã Publish khi dọn dẹp | **1.** Tạo document có `createdAt` > 31 ngày nhưng `status = Published`. Kích hoạt Cron Job. | Cron Job bỏ qua document này. Website Published luôn được bảo toàn, không bị xóa nhầm. | Blocker | [x] |
| TC-F01.52 | Limit | Token | **[Negative]** Chặn nhập quá 10.000 ký tự | **1.** Paste chuỗi văn bản > 10.000 ký tự vào ô nhập liệu. | Frontend chặn submit, hiển thị cảnh báo giới hạn ký tự. API không gửi request ngay cả khi bypass frontend. | High | [x] |
| TC-F01.65 | BR-02 | DB | **[Negative]** Chỉ Soft Delete — Không Hard Delete website | **1.** Gọi API xóa website.<br>**2.** Kiểm tra database. | Website chỉ được đánh dấu `deletedAt` (soft delete). Record vẫn tồn tại trong DB. Không hard delete. | High | [ ] |
| TC-F01.66 | BR-04 | UI | **[Positive]** Nhãn "AI Generated ✨" hiện trong Editor, ẩn trên Storefront | **1.** Mở website trong Editor → kiểm tra ảnh/nội dung AI tạo.<br>**2.** Mở website live (storefront) cùng vị trí. | Trong Editor: hiển thị nhãn "AI Generated ✨" trên các ảnh/nội dung do AI tạo. Trên Storefront: nhãn không hiển thị cho khách truy cập. | Medium | [ ] |
| TC-F01.67 | BR-07 | Logic | **[Negative]** Không trừ quota khi tạo website thất bại | **1.** Tạo website, để API OpenAI timeout (simulate server error).<br>**2.** Kiểm tra quota còn lại. | Quota không bị trừ khi lỗi server. Sau khi Retry thành công, quota mới bị trừ. | High | [ ] |
| TC-F01.95 | PRD §17 | Sec | **[Security]** Truy cập /builder/new không xác thực (Unauthenticated) | **1.** Mở trình duyệt ẩn danh (không đăng nhập).<br>**2.** Truy cập trực tiếp `/builder/new`. | Server trả HTTP 401. Chuyển hướng tự động về `/login`. Không hiển thị form nhập liệu. | Blocker | [x] |
| TC-F01.96 | AC-2 (07) | Sec | **[Security]** JWT hết hạn khi redirect vào CMS Admin | **1.** Nhấn "Go to Admin Dashboard".<br>**2.** Simulate JWT token đã expired. | Hệ thống yêu cầu đăng nhập lại. Redirect về `/login` với return URL về `/admin`. Không hiển thị trang trắng hoặc lỗi 500. | High | [ ] |
| TC-F01.97 | FR-15 | Concu | **[Race]** Mở 2 Tab cùng /builder/new đồng thời | **1.** Mở Tab A và Tab B cùng truy cập `/builder/new`.<br>**2.** Điền form và nhấn Generate ở cả 2 Tab. | Chỉ 1 request được xử lý. Tab thứ 2 nhận thông báo conflict hoặc tải lại draft từ Tab 1. Không tạo 2 site trùng lặp. | Blocker | [ ] |

---

### 3.16 Navigation Dynamic Mapping (GH-817)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-NAV-DYN-01 | GH-817 | Unit | `extractPageLinks(undefined)` trả null | Call `extractPageLinks(undefined)` | Trả về `null` | Blocker | [x] |
| TC-NAV-DYN-02 | GH-817 | Unit | `extractPageLinks([])` trả null | Call `extractPageLinks([])` | Trả về `null` | Blocker | [x] |
| TC-NAV-DYN-03 | GH-817 | Unit | Map multi-page list sang label/url đúng | `extractPageLinks([{title:'Home',slug:'/',isHomepage:true},{title:'Services',slug:'services'}])` | `[{label:'Home',url:'/'},{label:'Services',url:'/services'}]` | Blocker | [x] |
| TC-NAV-DYN-04 | GH-817 | Unit | Page đầu tiên luôn có url "/" | Page đầu không có `isHomepage`, slug là "/" | `url` = `"/"` | High | [x] |
| TC-NAV-DYN-05 | GH-817 | Unit | Non-homepage page thêm leading slash cho bare slug | `slug: 'gallery'` | `url: '/gallery'` | High | [x] |
| TC-NAV-DYN-06 | GH-817 | Unit | Nav bị thiếu → inject nav dùng pageLinks | `ensureNavigationBlocks(pages, 'Acme', AI_PAGE_LINKS)`, page không có nav block | Nav injected có links === AI_PAGE_LINKS | Blocker | [x] |
| TC-NAV-DYN-07 | GH-817 | Unit | Không truyền pageLinks → dùng DEFAULT_NAV_LINKS (back-compat) | `ensureNavigationBlocks(pages, 'Acme')` không có pageLinks | Links = DEFAULT_NAV_LINKS | Blocker | [x] |
| TC-NAV-DYN-08 | GH-817 | Unit | Hollow nav (links rỗng) được patch bằng pageLinks | Nav block có `links: []`, truyền AI_PAGE_LINKS | Nav links = AI_PAGE_LINKS | Blocker | [x] |
| TC-NAV-DYN-09 | GH-817 | Unit | Strip double leading slash khỏi slug | `slug: '/about'` | `url: '/about'` (không phải `'//about'`) | High | [x] |
| TC-NAV-DYN-10 | GH-817 | Unit | Fallback `Page N` khi title bị thiếu | Page không có title | `label: 'Page 2'` | Medium | [x] |
| TC-NAV-DYN-11 | GH-817 | Unit | Non-hollow nav (hardcoded từ enforcer) bị force-replace bằng aiPageLinks | Nav có 4 hardcoded links [Home/About/Services/Contact], truyền aiPageLinks [Home/Gallery/Blog/Contact] | Nav links = aiPageLinks, không phải hardcoded links | Blocker | [x] |
| TC-NAV-DYN-12 | GH-817 | Unit | Non-hollow nav giữ nguyên khi không có pageLinks (back-compat) | Nav có links, không truyền pageLinks | Links giữ nguyên như cũ | High | [x] |
| TC-NAV-DYN-13 | GH-817 | Unit | `resolveCtaUrl` trả URL contact page khi có trong aiPageLinks | aiPageLinks có `{label:'Contact', url:'/contact'}` | Trả `/contact` | Blocker | [x] |
| TC-NAV-DYN-14 | GH-817 | Unit | `resolveCtaUrl` fallback về last page khi không có contact | aiPageLinks: [Home, Portfolio, Blog] (không có Contact) | Trả `/blog` (last page), không phải `/contact` chết | Blocker | [x] |
| TC-NAV-DYN-15 | GH-817 | Unit | force-replace cũng cập nhật ctaButton URL khi Contact tồn tại | Nav có ctaButton `/contact`, aiPageLinks có Contact | ctaButton.url = `/contact` | Blocker | [x] |
| TC-NAV-DYN-16 | GH-817 | Unit | force-replace cập nhật ctaButton về last page khi không có Contact | Nav có ctaButton `/contact`, aiPageLinks không có Contact | ctaButton.url = last page, không phải `/contact` | Blocker | [x] |
| TC-NAV-SYNC-17 | GH-817 | Integration | Post-creation nav sync: link của page bị lỗi bị xoá khỏi nav | AI gen [Home, Services, Contact], Contact page create fail → pageFailures = [{slug:'contact'}] | Nav links của Home, Services chỉ còn [Home, Services], không còn Contact | Blocker | [ ] |
| TC-NAV-SYNC-18 | GH-817 | Integration | Post-creation nav sync: ctaButton được cập nhật theo surviving links | Tương tự TC-17 + nav có ctaButton.url='/contact' | ctaButton.url = last surviving page (e.g. '/services') | Blocker | [ ] |
| TC-FOOTER-DYN-01 | GH-817 | Unit | Injected footer Pages column dùng pageLinks, không phải DEFAULT_NAV_LINKS | pageLinks = [Home, Gallery, Blog] (không có Contact), không có footer block | footer.columns[0].links = pageLinks | Blocker | [x] |
| TC-FOOTER-DYN-02 | GH-817 | Unit | Injected footer Contact column fallback về last page khi không có Contact | pageLinks = [Home, Portfolio, Blog] | footer.columns[1].links[0].url = '/blog', không phải '/contact' | Blocker | [x] |
| TC-FOOTER-DYN-03 | GH-817 | Unit | Injected footer Contact column dùng /contact khi Contact page tồn tại | pageLinks có Contact | footer.columns[1].links[0].url = '/contact' | High | [x] |
| TC-FOOTER-SYNC-04 | GH-817 | Integration | Post-creation footer sync: link của page bị lỗi bị xoá khỏi footer columns | Contact page fail → pageFailures = [{slug:'contact'}] | footer.columns của các trang đã lưu không còn Contact link | Blocker | [ ] |
| TC-FOOTER-SYNC-05 | GH-817 | Integration | Nav + footer patched trong cùng 1 payload.update per page | Tương tự TC-FOOTER-SYNC-04 | Chỉ 1 update call per page (không phải 2 calls riêng) | Medium | [ ] |

---

### 3.15 Luồng Phụ — Template Flow (US-F01-02)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.58 | AC-2 (02) | Func | **[Positive]** Chọn Template thay vì AI Builder | **1.** Tại màn hình onboarding, chọn "Chọn Template" thay vì "Tạo bằng AI".<br>**2.** Chuyển tới `/templates`, chọn 1 template.<br>**3.** Xác nhận chọn template. | Hệ thống tạo website từ template đã chọn. Chuyển hướng tới `/editor/:id`. Website hiển thị đúng layout của template. | Medium | [ ] |
| TC-F01.98 | AC-2 (02) | State | **[UI State]** Template gallery rỗng (0 templates) | **1.** Xóa hoặc ẩn toàn bộ templates trong DB.<br>**2.** Chọn "Chọn Template" ở onboarding. | Hiển thị Empty State: "Chưa có template nào. Hãy tạo bằng AI". Cung cấp nút quay lại AI Builder. Không hiển trang trắng hoặc lỗi. | Medium | [ ] |

### 3.11 CTA Internal-Link Mapping (GH-1359)

| TC-ID | AC | Category | Tiêu đề | Các bước | Kết quả mong đợi | Mức độ | Status |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.CTA-DRAG-01 | AC1 | Unit | **[Unit]** Kéo hero vào site có `/about`+`/contact` → cả 2 nút resolve canonical | **1.** Tạo hero với 2 CTA: "Get Started"(`#contact`) + "Learn More"(`#about`).<br>**2.** Kéo vào site có pages: `[{slug:'/'}, {slug:'/about'}, {slug:'/contact'}]`.<br>**3.** Kiểm tra ctaButtons sau khi drop. | Hero có 2 nút CTA. Nút 1: `url='/contact'`, Nút 2: `url='/about'`. Cả 2 nút được giữ lại. | Critical | [ ] |
| TC-F01.CTA-DRAG-02 | AC2 | Unit | **[Unit]** Site thiếu `/contact` → ẩn nút "Get Started", giữ "Learn More" (per-button hide) | **1.** Tạo hero với 2 CTA: "Get Started"(`#contact`) + "Learn More"(`#about`).<br>**2.** Kéo vào site có pages: `[{slug:'/'}, {slug:'/about'}]` (KHÔNG có `/contact`).<br>**3.** Kiểm tra ctaButtons sau khi drop. | Hero chỉ còn 1 nút: "Learn More" (`url='/about'`). Nút "Get Started" bị ẩn (dropped). | Critical | [ ] |
| TC-F01.CTA-DRAG-03 | AC3 | Unit | **[Unit]** Pricing plan `ctaUrl: '#'` → fallback `/contact`, KHÔNG ẩn nút | **1.** Tạo pricing block với 3 plans, mỗi plan có `ctaUrl='#'`.<br>**2.** Kéo vào site có pages đầy đủ `[{slug:'/'}, {slug:'/contact'}]`.<br>**3.** Kiểm tra `plans[].ctaUrl` sau khi drop. | Tất cả 3 plans giữ nguyên (`plans.length === 3`). Mỗi plan: `ctaUrl === '/contact'` (fallback). | Critical | [ ] |
| TC-F01.CTA-DRAG-04 | AC4 | Unit | **[Unit]** Site MS (slug canonical) → CTA resolve đúng, không broken | **1.** Tạo hero với CTA `#contact`.<br>**2.** Kéo vào site MS-style pages: `[{slug:'/'}, {slug:'/contact'}]`.<br>**3.** Kiểm tra ctaButtons[0].url. | CTA resolve thành `/contact`. Không bị drop. Supports fuzzy match (`#contact-us` → `/contact`). | High | [ ] |
| TC-F01.CTA-DRAG-05 | AC5 | Unit | **[Unit]** Block không có CTA (newsletter) → trả nguyên block, không đổi | **1.** Tạo newsletter block: `{blockType:'newsletter', buttonLabel:'Subscribe', placeholder:'Email'}` (no ctaButtons, no plans).<br>**2.** Kéo vào site.<br>**3.** Kiểm tra block sau drop. | Block trả nguyên: `toEqual(inputBlock)`. Tất cả fields giữ nguyên. Không có field được modify. | Medium | [ ] |
| TC-F01.CTA-DRAG-06 | AC2 | Recovery | **[Recovery]** Pages rỗng → nav CTA bị ẩn hết, pricing fallback `/contact` | **1.** Tạo hero 2 CTA + pricing block.<br>**2.** Kéo vào site với `pages=[]` (rỗng).<br>**3.** Kiểm tra ctaButtons + plans. | Hero: `ctaButtons.length === 0` (tất cả bị ẩn). Pricing: `plans[].ctaUrl === '/contact'` (fallback fallback). | High | [ ] |
| TC-F01.CTA-DRAG-07 | AC5 | Regression | **[Regression]** Sửa CTA URL thủ công ở settings panel vẫn lưu đúng (helper chỉ chạy lúc insert) | **1.** Kéo hero vào. CTA auto-resolve thành `/contact`.<br>**2.** Mở settings editor, thay đổi manually thành `/about`.<br>**3.** Save. Kiểm tra DB. | URL được lưu thành `/about` (manual edit được preserve). Helper KHÔNG re-run trên existing blocks khi edit. | High | [ ] |
| TC-F01.CTA-DRAG-08 | AC5 | Unit | **[Unit]** Pricing ctaUrl resolve thành internal → `ctaActionType` đồng bộ `internal` | **1.** Tạo pricing plan `{ctaUrl:'#', ctaActionType:'external'}`.<br>**2.** Kéo vào site có `/contact`.<br>**3.** Kiểm tra plan sau drop. | `ctaUrl === '/contact'` và `ctaActionType === 'internal'` → editor hiển thị "Internal Page" + page picker, không phải ô URL external. | Medium | [ ] |
| TC-F01.CTA-DRAG-09 | AC4 | Unit | **[Unit]** `resolvePricingPlanCta` (dùng chung AI-gen + manual): `#`/unresolvable → `/contact`+internal; `#about` có page → `/about`+internal; external http → giữ nguyên+external | **1.** Gọi helper với các ctaUrl: `'#'`, `'#about'`, `'#services'` (no page), `'https://...'`.<br>**2.** Kiểm tra ctaUrl + ctaActionType. | Lần lượt: `/contact`+internal; `/about`+internal; `/contact`+internal; URL gốc+external. Áp dụng cho **cả** website AI-generate (patchPageCtaUrls) lẫn manual drag. | High | [ ] |
| TC-F01.CTA-AIGEN-01 | AC1 | Manual/QC | **[Manual]** Generate website mới có block Pricing → CTA plan không broken, action hiển thị Internal Page | **1.** Generate 1 website (SaaS/agency có pricing).<br>**2.** Vào editor, mở CTA Settings của plan. | Action = "Style: Internal Page", URL trỏ `/contact` (hoặc page hợp lệ), click trên live site điều hướng đúng. | High | [ ] |

---

### 3.12 Streaming Stuck Recovery (GH-1371)

| TC-ID | AC | Category | Mô tả | Steps | Expected | Priority | Status |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.STUCK-01 | AC1 | Unit | **[Unit]** partialize converts streaming → idle | Gọi `partialize()` khi `status='streaming'` | `persisted.status === 'idle'`, `persisted.step === 'info'`, `blocks/messages/progress` cleared, `businessInfo` giữ nguyên | Critical | [ ] |
| TC-F01.STUCK-02 | AC1 | Unit | **[Unit]** partialize không ảnh hưởng done status | Gọi `partialize()` khi `status='done'` | `persisted.status === 'done'`, `siteId` giữ nguyên | Critical | [ ] |
| TC-F01.STUCK-03 | AC3 | Unit | **[Unit]** onRehydrateStorage resets stale streaming state | Gọi callback với `state.status='streaming'` | `state.status === 'idle'`, `step === 'info'`, `blocks/messages` cleared, `businessInfo` preserved | Critical | [ ] |
| TC-F01.STUCK-04 | AC3 | Unit | **[Unit]** onRehydrateStorage giữ error behavior cũ | Gọi callback với `state.status='error'` + error object | `state.error === null`, `state.status === 'idle'` | High | [ ] |
| TC-F01.STUCK-05 | AC1 | Recovery | **[Recovery]** Reload F5 giữa lúc gen → form hiện lại | Đang gen → F5 reload | Form hiện lại với `businessInfo` preserved. Toast "Generation was interrupted". KHÔNG bị stuck loading | Critical | [ ] |
| TC-F01.STUCK-06 | AC2 | Recovery | **[Recovery]** Back browser giữa lúc gen → forward lại | Đang gen → Back → Forward | Form hiện lại. Không stuck. `businessInfo` preserved | Critical | [ ] |
| TC-F01.STUCK-07 | AC2 | Recovery | **[Recovery]** Reload 5 lần liên tiếp không lần nào stuck | Reload 5 lần trong khi gen (hoặc sau gen) | Mỗi lần reload đều về form, không stuck. | Critical | [ ] |
| TC-F01.STUCK-08 | AC6 | Unit | **[Unit]** partialize converts error → idle (existing behavior preserved) | Gọi `partialize()` khi `status='error'` | `persisted.status === 'idle'`, `persisted.error === null` | High | [ ] |
| TC-F01.STUCK-09 | AC5 | UI | **[UI]** beforeunload cảnh báo khi đang streaming | Đang gen → thử close tab / navigate away | Browser hiện cảnh báo "Leave page?" | Medium | [ ] |
| TC-F01.STUCK-10 | AC2 | Sec | **[Security]** Cross-user: reset clears userId | User A gen → reload → login User B | State User A không còn. `userId` và `businessInfo` cleared | Critical | [ ] |

### 3.x. Auto-add Cart khi generate site có block product (branch feat/auto-add-cart-block-on-product-generation)

_Unit: `src/__tests__/unit/lib/ai/ensure-cart-global-block.test.ts` (`ensureCartGlobalBlock`). Áp dụng cho cả AI generate (`generate-site/route.ts`) và apply-template (`apply-template/route.ts` — 2 path: re-skin + tạo site mới)._

| TC ID | Nguồn | Loại | Mô tả | Bước thực hiện | Kết quả mong đợi | Ưu tiên | Trạng thái |
|---|---|---|---|---|---|---|---|
| TC-F01.CART-01 | US | Unit | **[Unit]** Page có commerce block → patch chứa cartWidget floating mặc định | Gọi `ensureCartGlobalBlock(undefined, pages có products-grid)` | Trả về `{ globalBlocks: { cartWidget: { blockType:'cartWidget', variant:'floating', label:'Cart', showLabel:false } } }` | Critical | [ ] |
| TC-F01.CART-02 | US | Unit | **[Unit]** Không có commerce block → không đổi gì | Gọi với pages chỉ hero/about | Trả về `{}` (spread vào data không thêm key) | Critical | [ ] |
| TC-F01.CART-03 | US | Unit | **[Unit]** cartWidget đã config sẵn → giữ nguyên, không ghi đè | `existingGlobalBlocks = { cartWidget: {...custom} }` + pages có products-featured | Trả về `{}` | High | [ ] |
| TC-F01.CART-04 | US | Unit | **[Unit]** Giữ các global block khác (whatsapp/social) khi merge cart | `existingGlobalBlocks = { whatsappButton: {...} }` + commerce pages | Patch chứa cả `whatsappButton` cũ lẫn `cartWidget` mới | High | [ ] |
| TC-F01.CART-05 | US | Unit | **[Unit]** Header đã có cart (showCart) → không thêm floating cart | `headerBlock = { showCart: true }` + commerce pages | Trả về `{}` | Medium | [ ] |
| TC-F01.CART-06 | US | E2E | **[E2E]** Generate site ecommerce → cart hiện trong editor + storefront | Generate site ngành ecommerce (có products-grid) → mở editor → publish | `site.globalBlocks.cartWidget` tồn tại trong DB; floating cart hiện ở editor canvas và site published | Critical | [ ] |

---

## 4. Hành Trình Trải Nghiệm End-to-End (E2E UAT Flow)

_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của chủ cửa hàng SME._

**Kịch bản E2E cốt lõi:**
1. **[Đăng ký & Nhập thông tin]** Đăng ký/đăng nhập tài khoản SME. Truy cập `/builder/new`. Nhập tên quán, chọn ngành "Restaurant / Cafe / F&B", mô tả sản phẩm. Kiểm tra validation khi thiếu trường bắt buộc. Nhấn "Continue — AI will create your website →".
2. **[AI Stream & Tạo Website]** Quan sát 3 bước tiến trình (Analyzing → Generating → Preparing). Preview cập nhật realtime qua SSE. Ảnh Hero Banner tạo bằng DALL-E (fallback stock image nếu lỗi). Kéo thả sắp xếp lại block trong Preview. Trên mobile: xem tiến trình qua floating pill, success screen hiển thị "View Full Preview".
3. **[Xuất bản & Quản trị]** Nhấn "Dashboard" hoặc "Publish". Domain `{slug}.primeweb.app` hiển thị, copy link thành công. SSO redirect vào CMS Admin không cần đăng nhập lại. Kiểm tra Tenant Isolation, chống tấn công API flood.

---

## 5. Tiêu Chí Đánh Giá Chất Lượng (Quality Gates)

| Nhóm kiểm thử | Trạng thái | Ghi chú |
|---|---|---|
| **1. UI/UX & Design System** | [ ] 0/20 TC đã chạy | Desktop + Mobile responsive + UI States |
| **2. Form Validation & BVA** | [ ] 0/14 TC đã chạy | Whitespace, BVA min/max, partial submit, XSS |
| **3. AI Logic & Generation** | [ ] 0/18 TC đã chạy | SSE stream, timeout, abort, NLU, multilingual |
| **4. Security & Auth** | [ ] 0/14 TC đã chạy | XSS, SQLi, Tenant Isolation, NSFW, JWT, 401 |
| **5. Race Condition & Anti-spam** | [ ] 0/6 TC đã chạy | Double-click Generate/Publish, 2 Tab, Regenerate spam |
| **6. Recovery & Cancel** | [ ] 0/8 TC đã chạy | Undo DND, abort generation, draft expired, back button, re-publish |
| **7. Performance SLA** | [ ] Chưa chạy | SSE < 2s, Generation < 60s, Publish < 30s |
| **8. E2E UAT** | [ ] Chưa chạy | Full flow từ đăng nhập → publish → verify live |
| **9. Mobile Responsive** | [ ] 0/17 TC đã chạy | US-F01-09 + US-F01-10 + landscape + back button |

> **Khuyến nghị Release:** Bộ kiểm thử bao gồm **130 kịch bản** phủ 100% các Acceptance Criteria (bao gồm Issue #246 US-F01-01), Functional Requirements, và Business Rules, bổ sung đầy đủ Negative/Edge/Race/Recovery theo chuẩn Comprehensive QA Expert. Cần đạt tỷ lệ **≥ 95% PASS** ở nhóm Blocker/High trước khi chuyển lên Production.
