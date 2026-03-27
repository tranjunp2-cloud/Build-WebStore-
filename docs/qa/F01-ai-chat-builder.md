# Kiểm Thử Chi Tiết: F01 — AI Website Builder
> **Phiên bản:** 6.0 (85-Case Full Coverage) | **Cập nhật:** 2026-03-27 | **Thực hiện:** QA Team
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

**Tổng số kịch bản:** **85 test cases** (Positive + Negative + Edge + Mobile)

---

## 2. Môi Trường Kiểm Thử

| Hạng mục | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome (v110+), Firefox (v105+), Safari |
| Thiết bị | Desktop (1920×1080), Mobile (iPhone 14 Pro — 375px) |
| Dữ liệu kiểm thử | Input XSS/SQLi vectors, network throttling, SLA metrics `<60s` |
| URL | `https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app` |

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

---

### 3.6 Cấu Trúc Website & Layout Theo Ngành (US-F01-01)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.17 | AC-9 | Func | **[Positive]** Website tạo ra có đủ 4 trang bắt buộc | **1.** Mở website vừa tạo xong. Kiểm tra menu điều hướng (navigation). | Có đúng 4 trang: Homepage, About, Products, Contact. Tất cả link trả mã HTTP 200. | Blocker | [x] |
| TC-F01.18 | AC-10 | Theme | **[Positive]** Layout phù hợp ngành F&B | **1.** Nhập: "Mở Quán Phở bò Nam Định". Tạo website, kiểm tra layout. | Layout sử dụng component phù hợp ngành ẩm thực (VD: Menu Grid, Food Gallery). Tone màu ấm. | High | [ ] |
| TC-F01.19 | AC-10 | Theme | **[Positive]** Layout phù hợp ngành Spa/Beauty | **1.** Nhập: "Mở tiệm Nails Spa". Tạo website, kiểm tra layout. | Layout sử dụng Gallery mẫu nails. Tone màu chủ đạo Pastel mềm mại, thanh nhã. | High | [ ] |

---

### 3.7 Tạo Ảnh Bằng AI (US-F01-03)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.20 | AC-6 | API | **[Positive]** Tạo ảnh Hero Banner bằng DALL-E | **1.** Nhập prompt tạo cửa hàng thú cưng. Kiểm tra ảnh Hero. | Ảnh Hero Banner được tạo (1200×400px), URL ảnh trỏ về Payload CMS media (`/media/dalle-img.jpg`). | Blocker | [x] |
| TC-F01.21 | AC-6 | Edge | **[Negative]** Sử dụng ảnh dự phòng khi API ảnh lỗi | **1.** Mock API DALL-E trả lỗi. Tạo website. | Website vẫn tạo thành công. Ảnh Hero sử dụng stock image phù hợp ngành từ thư viện dự phòng. Không hiển thị ảnh bị lỗi (broken image). | High | [x] |
| TC-F01.59 | AC-3 (03) | Func | **[Positive]** Tạo lại ảnh AI (Regenerate Image) | **1.** Sau khi tạo website xong, nhấn nút "Generate New Image" trên ảnh Hero.<br>**2.** Chờ ảnh mới được tạo. | Ảnh mới thay thế ảnh cũ. Ảnh mới tự động lưu vào Payload CMS media library. | High | [ ] |

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
| TC-F01.36 | AC-17 | Edge | **[Negative]** Fallback sang tiếng Anh với ngôn ngữ không hỗ trợ | **1.** Nhập bằng tiếng Ả Rập: `أريد بناء` hoặc tiếng H'Mông. | Website vẫn tạo thành công bằng tiếng Anh (fallback). Hiển thị thông báo giải thích (VD: "Your site has been generated in English"). Không bị crash. | High | [x] |

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

---

### 3.12 Mobile Reorder — Chạm An Toàn (US-F01-10)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.M12 | AC-1 (10) | Mobile | **[Positive]** Sắp xếp block bằng nút Lên/Xuống (Tap Up/Down) | **1.** Trên mobile, chạm vào block (VD: About Us).<br>**2.** Nhấn nút [⬆ Lên] trên floating action bar. | Block hoán đổi vị trí với block phía trên tức thì. State được cập nhật, không cần reload. Nút chạm phải ≥ 44×44px (chuẩn touch target). | High | [ ] |
| TC-F01.M13 | AC-2 (10) | Mobile | **[Positive]** Chế độ sắp xếp dạng danh sách (Card List Mode) | **1.** Trên mobile, nhấn nút "≡ Sắp xếp" trên toolbar.<br>**2.** Kéo thả các card nhỏ gọn.<br>**3.** Nhấn "Xong". | Iframe preview tạm thời thay bằng danh sách Card (Hero, About, Products, Contact). Kéo thả card native smooth, không xung đột scroll. Sau khi nhấn "Xong", quay lại preview đầy đủ với thứ tự mới. | High | [ ] |

---

### 3.13 Giới Hạn Kinh Doanh & Bảo Mật (Business Rules & Security)

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

---

### 3.14 Luồng Phụ — Template Flow (US-F01-02)

| ID | Ref | Loại | Tiêu đề | Các bước thực hiện | Kết quả mong đợi | Mức độ | Auto |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| TC-F01.58 | AC-2 (02) | Func | **[Positive]** Chọn Template thay vì AI Builder | **1.** Tại màn hình onboarding, chọn "Chọn Template" thay vì "Tạo bằng AI".<br>**2.** Chuyển tới `/templates`, chọn 1 template.<br>**3.** Xác nhận chọn template. | Hệ thống tạo website từ template đã chọn. Chuyển hướng tới `/editor/:id`. Website hiển thị đúng layout của template. | Medium | [ ] |

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
| **1. UI/UX & Design System** | [ ] 0/18 TC đã chạy | Bao gồm Desktop + Mobile responsive |
| **2. AI Logic & NLU** | [ ] 0/16 TC đã chạy | Đa ngôn ngữ, code-switching, slang |
| **3. Security & DB Validation** | [ ] 0/12 TC đã chạy | XSS, SQLi, Tenant Isolation, NSFW filter |
| **4. Performance SLA** | [ ] Chưa chạy | SSE < 2s, Generation < 60s, Publish < 30s |
| **5. E2E UAT** | [ ] Chưa chạy | Full flow từ đăng nhập → publish → verify live |
| **6. Mobile Responsive** | [ ] 0/13 TC đã chạy | US-F01-09 + US-F01-10 coverage |

> **Khuyến nghị Release:** Bộ kiểm thử bao gồm **85 kịch bản** phủ 100% các Acceptance Criteria, Functional Requirements, và Business Rules. Cần đạt tỷ lệ **≥ 95% PASS** ở nhóm Blocker/High trước khi chuyển lên Production.
