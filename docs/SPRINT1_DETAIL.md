# 🏃‍♂️ Sprint 1: Core Features (F01 & F02)

> **Mục tiêu Sprint:** Xây dựng hoàn chỉnh luồng xác thực (Auth flow cho Owner & Staff) và tính năng cốt lõi tạo website bằng AI (AI Chat Builder).
> **Thời gian dự kiến:** Bám sát timeline Sprint 1.
> **Tóm tắt quy chuẩn dự án:** [PROJECT_ALIGNMENT.md](PROJECT_ALIGNMENT.md)

---

## 📋 1. Quy Tắc Quản Lý Task (Naming Convention)

Để team dễ dàng theo dõi tiến độ và tránh làm sai scope, chúng ta áp dụng quy tắc sau (theo chuẩn Antigravity BA/PO):

- **Định dạng ID:** `[Loại_Task]-[Mã_Feature]-[Số_Thứ_Tự]`
  - 🎨 **UI:** Task thiết kế giao diện (VD: `UI-F01-01`).
  - 💻 **DEV:** Task lập trình Frontend/Backend/Fullstack (VD: `DEV-F02-02`).
  - 🧪 **QC:** Task kiểm thử, đảm bảo chất lượng (VD: `QC-F01-01`).
- **Story Khớp Nối (Story Ref):** Mọi nhánh công việc **BẮT BUỘC** phải có mã User Story đi kèm (VD: `[US-F01-01]`). **Không có Story ❌ Không code.**
- **Docs Tham Chiếu:** Luôn link trực tiếp tới PRD, Story và Architect để anh em dev đọc hiểu context.

---

## 📚 2. Tài Liệu Tham Chiếu Gốc

🔗 **Feature F01 — AI Chat Builder**
- 📄 PRD: [F01-ai-chat-builder.md](./prd/F01-ai-chat-builder.md)
- 📝 Stories: [F01-ai-chat-builder-stories.md](./stories/F01-ai-chat-builder-stories.md)
- 🏗️ Architecture: [F01-ai-chat-builder.md](./architecture/F01-ai-chat-builder.md)

🔗 **Feature F02 — Auth Flow**
- 📄 PRD: [F02-auth.md](./prd/F02-auth.md)
- 📝 Stories: [F02-auth-stories.md](./stories/F02-auth-stories.md)
- 🏗️ Architecture: [F02-auth.md](./architecture/F02-auth.md)

---

## 🎨 3. Cụm Task Thiết Kế UI (Design Tasks)

### 🌟 Nhóm F01: AI Chat Builder

#### 🎨 [UI-F01-01] Thiết kế màn hình Split-screen Chat & Preview `/builder/new`
- **Story Ref:** `[US-F01-01]`, `[US-F01-05]` | ⏱️ **Thời gian:** 1 ngày
- **Mô tả:** Thiết kế Figma cho chế độ tạo website bằng AI. Bản Desktop cần tách rành mạch 2 nửa (Chat Panel và Iframe). Bản Mobile thì khung chat phải đẩy xuống dạng bottom sheet thông minh.
- **✅ DoD:** Bàn giao link thiết kế chuẩn Responsive (Mobile + Web).

#### 🎨 [UI-F01-02] Trạng thái Kéo thả (Drag-and-Drop)
- **Story Ref:** `[US-F01-08]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Thiết kế các trạng thái làm hiệu ứng cho thao tác người dùng. Gồm có: Hover hiện icon handle, Đang nắm kéo (drag in progress mở độ trong suốt ngang mức 0.7), và điểm đích thả chuột (drop target highlight).
- **✅ DoD:** Hiển thị rõ ràng các màu sắc state active/inactive.

#### 🎨 [UI-F01-03] Modal Chúc mừng (Post-generation) & Nút Điều Hướng CMS
- **Story Ref:** `[US-F01-07]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Vẽ một cái modal "Congratulations" bật lên lúc site vừa render xong. Hiển thị chữ to domain live, 1 nút copy domain và 1 nút chuyển về Admin Dashboard.
- **✅ DoD:** Design sạch, phân cấp bậc Primary/Secondary button mạch lạc.

---

### 🔒 Nhóm F02: Auth Flow

#### 🎨 [UI-F02-01] Giao diện Login & Register (Chia đôi Split-Screen)
- **Story Ref:** `[US-F02-01]`, `[US-F02-02]` | ⏱️ **Thời gian:** 1 ngày
- **Mô tả:** Màn hình chia đôi: Một nửa là Banner ảnh thương hiệu lung linh, một nửa là form trong suốt nhẹ (Glassmorphism). Điểm nhấn vào nút Sign In / Sign Up.
- **✅ DoD:** Figma file hoàn tất đủ 2 luồng cho chủ tiệm tạo mới tài khoản.

#### 🎨 [UI-F02-02] Luồng Form Bảo Mật (Quên Pass, Reset, Nhập OTP)
- **Story Ref:** `[US-F02-05]`, `[US-F02-06]`, `[US-F02-07]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Graphic quy trình 2 lớp: màn hình báo check hòm thư (Always-Success UX), màn hình đòi password mới, và box nhập dãy số bí mật OTP 6 chữ số.
- **✅ DoD:** Bảng màu báo lỗi / thành công (đỏ/xanh) inline trên ô nhập báo ngay cho user.

#### 🎨 [UI-F02-03] Thư điện tử (Email Templates HTML)
- **Story Ref:** `[US-F02-01]`, `[US-F02-07]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Vẽ bố cục Email HTML cực đẹp gửi khách lúc Welcome mừng họ đăng ký và một bản gửi OTP thân thiện.
- **✅ DoD:** Giao diện phù hợp môi trường hiển thị email (Google Mail, Outlook).

---

## 💻 4. Cụm Task Lập Trình (Dev Tasks)

### 🌟 Nhóm F01: AI Chat Builder

#### 👨‍💻 [DEV-F01-01] Viết API `generate-site` nối OpenAI
- **Vị trí:** Backend | **Story Ref:** `[US-F01-01]` 
- **Mô tả:** Xây module gọi API với model GPT-4o, xả data ngược về theo dạng mảnh ghép SSE Streaming (Sự kiện).
- **✅ DoD:** Phải hiện được block trên giao diện chỉ sau 2 giây gõ phím, tổng build site dưới 60s.

#### 👨‍💻 [DEV-F01-02] Logic tạo ảnh DALL-E & Lưu Payload CMS Media
- **Vị trí:** Backend | **Story Ref:** `[US-F01-03]` 
- **Mô tả:** Auto call API DALL-E sinh luôn ảnh Hero banner cho shop. Tải ảnh dội ngược về bộ nhớ Media của CMS. Rớt mạng phải tự bù ảnh Stock.
- **✅ DoD:** Có fallback ảnh chống bể UI, up ảnh mượt.

#### 👨‍💻 [DEV-F01-03] AI Nhận diện Context & Chọn thứ tiếng
- **Vị trí:** Backend | **Story Ref:** `[US-F01-05]`, `[US-F01-06]` 
- **Mô tả:** Lập trình luồng API `api/ai/chat` đếm số lần hỏi đáp (chặn <= 4 câu). Đọc format chat rồi trích xuất cắm cờ loại ngôn ngữ (BM/VI/EN).
- **✅ DoD:** Bot phản hồi đúng tiếng của khách chat, context chuẩn luồng.

#### 👨‍💻 [DEV-F01-04] Dựng UI Nhận SSE & Iframe Live Preview 
- **Vị trí:** Frontend | **Story Ref:** `[US-F01-01]` 
- **Mô tả:** Lắp hook `useAIStream` hứng dữ liệu từ Backend, đẩy dữ liệu thô vào cái khung trang Iframe để khách thấy thao tác đổi ngay lập tức.
- **✅ DoD:** Khung review nhảy chữ y như cảm giác gõ chat GPT.

#### 👨‍💻 [DEV-F01-05] Code tương tác Kéo Thả (Drag-Drop) Blocks
- **Vị trí:** Frontend | **Story Ref:** `[US-F01-08]` 
- **Mô tả:** Lập trình gắn thư viện chặn/kéo thứ tự khối. Header với Footer bắt chết, không cho kéo. Cập nhật state Zuztand cho app lưu index.
- **✅ DoD:** Cầm chuột nhấc nhẹ, mượt mà chuyển vị trí block. Mở điện thoại vuốt thả trúng ô.

#### 👨‍💻 [DEV-F01-06] Giao diện chúc mừng (CMS Redirect / Subdomain Live)
- **Vị trí:** Frontend | **Story Ref:** `[US-F01-04]`, `[US-F01-07]` 
- **Mô tả:** Code cái form nhảy ra lúc site xong, gán subdomain chạy Live. Có nút Copy lưu link lên Clipboard trình duyệt, nảy Toast. Bấm Admin trỏ lẹ vô CMS.
- **✅ DoD:** Copy link vô vùng nhớ (Clipboard) xịn, sang Admin không bị đứt quãng Auth.

---

### 🔒 Nhóm F02: Auth Flow

#### 👨‍💻 [DEV-F02-01] Code Config Backend Payload CMS: Invisible Tenant
- **Vị trí:** Backend | **Story Ref:** `[US-F02-01]` 
- **Mô tả:** Cập nhật bảng Users gắn thêm field mã thuế BRN. Viết Payload Hook chạy sự kiện sau khi nhấp nút Đăng ký, Backend ngầm gài vào rổ riêng (Invisible Tenant).
- **✅ DoD:** Database nhận chuẩn quan hệ 1-1 Tenant vs User. Cây RBAC chuẩn.

#### 👨‍💻 [DEV-F02-02] Validation Định Dạng Input & Check Trùng lặp
- **Vị trí:** Backend | **Story Ref:** `[US-F02-01]` 
- **Mô tả:** Dùng Zod gọt (trim) khoảng trắng ai lỡ đánh dư ở 2 đầu Password. Trả lỗi Server 409 nếu Email bị đăng ký lần 2.
- **✅ DoD:** Chặn đứng mã sai ngoài rìa trước khi tới DB.

#### 👨‍💻 [DEV-F02-03] Chặn Token API (Luồng 2FA OTP Bằng Resend)
- **Vị trí:** Backend | **Story Ref:** `[US-F02-07]` 
- **Mô tả:** Khi Submit Form Login, dòm xem acc có bật OTP không, bật thì chặn lại nhả biến ra cho Frontend nhảy form đòi 6 số, bắn lệnh Resend đẩy mail tới máy. Mã OTP đúng thì mới ký phát Token Auth.
- **✅ DoD:** Xác thực OTP 2 chặng bảo mật nghiêm ngặt. Tốc độ nhận mail mau lẹ.

#### 👨‍💻 [DEV-F02-04] Dựng Form Giao Diện Split-Screen
- **Vị trí:** Frontend | **Story Ref:** `[US-F02-01]`, `[US-F02-02]` 
- **Mô tả:** Code nguyên cục giao diện Login / Register theo thiết kế Figma. Viết hook gọi API nối thẳng Backend.
- **✅ DoD:** Gõ email sai regex là form báo đỏ nội tuyến chớp tắt khẩn cấp ngay. Form responsive tốt.

#### 👨‍💻 [DEV-F02-05] Chống dò rỉ Thông tin (Forgot & Reset UX Security)
- **Vị trí:** Fullstack | **Story Ref:** `[US-F02-05]`, `[US-F02-06]` 
- **Mô tả:** Frontend hiện trạng thái "Chúng tôi đã gửi mail" Xanh nét ngay cả khi user gõ email không có thật trên đời - chống hacker rà soát database.
- **✅ DoD:** Dùng mã Token bí mật đổi pass an toàn siêu tốc <= 1 phút.

#### 👨‍💻 [DEV-F02-06] Lính Canh Middleware (Auth Guard / Rooting Router)
- **Vị trí:** Frontend | **Story Ref:** `[US-F02-03]`, `[US-F02-04]` 
- **Mô tả:** Setup Middleware Next.js kiểm tra tệp tin Cookies. Ngăn ông vô danh chọc file `/dashboard`. Điều hướng ông Owner nhảy Dashboard, lùa ông Staff vô CMS Admin rành rọt.
- **✅ DoD:** Bảo vệ route lõm và giữ vững tính riêng biệt mỗi vai trò. 

---

## 🧪 5. Cụm Task Kiểm Thử Chất Lượng (QC Tasks)

#### 🔍 [QC-F01-01] Code Script Playwright E2E cho Builder Generation Flow
- **Nguồn:** `[US-F01-01]` -> `[US-F01-07]` | ⏱️ **Thời gian:** 1 ngày
- **Mô tả:** Code tự động luồng chạy: Điển prompt > ngồi chờ đủ giây timeout > kiểm duyệt kết quả sinh đủ 4 cái Pages vứt lên Subdomain không.
- **✅ DoD:** Pipeline CI/CD xanh mượt lúc commit bot.

#### 🔍 [QC-F01-02] Soi Lỗi Đa Ngôn Ngữ (Edge Cases Stress)
- **Nguồn:** `[US-F01-05]`, `[US-F01-06]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Gắn prompt thập cẩm Tiếng Mã pha Tiếng Anh trộn Tiếng Việt vào hộp thoại xem AI nhảy luồng ngôn ngữ nào.
- **✅ DoD:** Cảnh giác AI lạc lối Context, sinh file bug report nếu lỗi.

#### 🔍 [QC-F01-03] Kiểm thử Khắc Nghiệt (Stress Test Kéo Thả & Internet Chập chờn)
- **Nguồn:** `[US-F01-01]`, `[US-F01-08]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Kéo thật ngốc nghếch dồn dập, rồi rút dây cáp mạng xem SSE Streaming có bị nổ Crash App không. 
- **✅ DoD:** App Retry dẻo dai. User input còn nguyên không bay biến mất.

#### 🔍 [QC-F02-01] Trình Diễn Băng Chuyền Auth Lifecycle
- **Nguồn:** Toàn bộ US F02 | ⏱️ **Thời gian:** 1 ngày
- **Mô tả:** Chạy E2E Regression: Tạo acc > Trích xuất mã mail > Điền OTP 6 số bảo vệ > Hứng Token lưu Cookie > Login > Tự chạy Logout chót lọt.
- **✅ DoD:** Bot Playwright test vèo vèo qua 5 lớp thành công chặn Auth.

#### 🔍 [QC-F02-02] Matrix Ma Trận Vai Trò Khách Cấm
- **Nguồn:** `[US-F02-03]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Lấy tài khoản nhân viên (Staff) nhưng chép link trang `/dashboard/billing` của ông Chủ (Owner) dán bạo vô trình duyệt gõ nút ấn. Truy cập Ẩn danh.
- **✅ DoD:** Bị văng đá móp méo về trang bắt Login lẹ cữ, báo lỗi 401 chu đáo gọn gàng.

#### 🔍 [QC-F02-03] Test Lõm Khoảng Trắng Form Code Bằng Tay 
- **Nguồn:** `[US-F02-01]` | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Nhấn chuột copy bôi đen Password dính phím Backspace/Spacebar vô lý ở 2 đầu đuôi coi Database cắt đuôi không. Nhập phone +60 của Malay test thử form chặn không số VN +84.
- **✅ DoD:** Ô text rung lắc đỏ ngầu không cho qua chặng.

---

## 🚀 6. Tác Vụ Thiết Lập Hạ Tầng (DevOps Tasks)

#### ⚙️ [OPS-F02-01] Cấu Hình Mạng Proxy (Wildcard Subdomain Routing)
- **Nguồn Trọng Tâm:** Middleware / DNS | ⏱️ **Thời gian:** 0.5 ngày
- **Mô tả:** Vượt chướng ngại vật Cloudflare đẩy dòng thác Request `*.primeweb.app` trúng mục tiêu Node App để render trang tương thích Cửa Hàng. Dập tắt truy cập rác trúng khoảng không vô định.
- **✅ DoD:** Truy cập URL `tui-la-slug-nao-do.primeweb.app` ra web như phép màu.

#### ⚙️ [OPS-F02-02] Dọn Rác Đường Ngầm DKIM & SPF 
- **Nguồn Trọng Tâm:** DNS Records / Vercel | ⏱️ **Thời gian:** 1 ngày
- **Mô tả:** Config chuẩn chỉ các cờ an ninh hòm thư cho Vendor gửi mướn Resend. Khắc phục vấn nạn khách rớt OTP / Welcome Mail thẳng vô vùng trũng Spam rác.
- **✅ DoD:** Mail nhận tức thì trong nháy mắt. Cú pháp thư đi sạch bóng mác rác. Verify API xanh check từ hệ thống bên thứ ba Resend.
