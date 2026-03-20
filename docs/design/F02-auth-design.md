# UI Design Specification: Auth (F02)
> **Version:** 1.0 | **Updated:** 2026-03-19 | **Module:** User Authentication

---

## 1. Design Links & Resources

- **Figma Design:** [UI Design Link - Auth Section](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30675-275)
- **Prototype:** [Interactive Demo - Auth Flow](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=DLqQPtpTDgA4lMa9-1)
- **Internal Wireframes (Low-Fi):**
  - Đăng nhập: [`F02-ui-login.png`](F02-ui-login.png)
  - Đăng ký Owner: [`F02-ui-register.png`](F02-ui-register.png)
  - Xác thực OTP: [`F02-ui-otp.png`](F02-ui-otp.png)
  - Quên mật khẩu: [`F02-ui-forgot-password.png`](F02-ui-forgot-password.png)
  - Đổi mật khẩu: [`F02-ui-reset-password.png`](F02-ui-reset-password.png)
  - Source File: [`F02-auth-ui.pen`](F02-auth-ui.pen) (Xem bằng Pencil MCP)

---

## 2. User Flow (Luồng Chạy Chính)

Hệ thống xoay quanh 5 luồng chính bảo mật cao (qua Next.js Middleware và Payload CMS).

### 2.1. Auth Guard (Chưa đăng nhập)
- Người dùng truy cập các tuyến đường quản trị (`/dashboard`, `/editor`, `/products`...).
- Middleware kiểm tra session cookie. Nếu KHÔNG tồn tại / Không hợp lệ → `Redirect ép buộc` về `/login?redirect=[current_url]`.

### 2.2. Login (Đăng nhập) & Auto-Routing
- Người dùng vào `/login`. Điền Email / Password.
- Gửi POST tới API xác thực:
  - **Lỗi:** Hiển thị Banner đỏ báo lỗi (401).
  - **Thành công (Bật 2FA):** Tạm giữ, nhảy tới màn `/verify-otp`. Gửi mã OTP 6 con số qua email. Hết hạn trong 5 phút. Nhập OTP.
  - **Thành công (Chốt xong):** Khởi tạo Session Cookie HttpOnly.
- **Auto-Routing:**
  - Nếu Role = **Owner**: Vào thẳng `/dashboard` hoặc `/onboarding` màn hình chức năng.
  - Nếu Role = **Staff**: Vào thẳng giao diện nội bộ Payload CMS Admin Panel `/admin`.

### 2.3. Register (Đăng ký Owner)
- *Lưu ý: Chỉ Owner mới tự đăng ký ngoài frontend. Nhân viên (Staff) phải được Invite mới có tài khoản.*
- Người dùng vào `/register`.
- Điền các form bắt buộc: Tên công ty (SME), BRN (Mã doanh nghiệp), Họ tên người trượng, Email, Password.
- Submit dữ liệu:
  - Kiểm tra duplicate email trên TOÀN HỆ THỐNG.
  - Tạo tài khoản thành công → Auto-create 1 Workspace(Tenant) duy nhất kết nối vào tài khoản này.
  - Hook CMS gửi Welcome Email cùng banner HTML tự động.
  - Tự động đăng nhập và redirect sang trải nghiệm `/onboarding`.

### 2.4. Forget & Reset Password (Quên / Đặt lại mật khẩu)
- User vào `/forgot-password`. Nhập email gửi link.
- **Logic An Ninh:** Luôn trả về 200 OK trang "Gửi Email Thành Công" bất luận email đó có tồn tại hay không để né dò quét (email harvesting).
- User ấn link bảo mật trong thư, nhảy về `/reset-password?token=xxx`.
- Bắt buộc nhập lại mật khẩu mới đáp ứng đủ rules → Cập nhật và đổi hướng `/login`.

---

## 3. UI Logic & Constraints

### 3.1. General Layout
- **Giao diện Split Screen** chia nửa màn hình:
  - `Bên trái (50-60%)`: Không gian Branding — hiển thị Slogan của nền tảng, thiết kế màu khối mesh-gradient hoặc hình ảnh nghệ thuật (Midtech Glassmorphism).
  - `Bên phải (40-50%)`: Frame Glass Form chứa Input Fields + Logo Platform đặt trên đỉnh + Link Trợ giúp ở đáy form.
- **Mobile Responsive:** Nếu màn hình `<= 768px`, layout chuyển luồng dọc (Stack-Column). Khu vực hình ảnh trái tự động ẩn đi hoàn toàn, form nhập liệu được Zoom lớn trải kín 100% không gian tiện cho thao tác tap ngón tay. Tap targets tối thiểu 44px.

### 3.2. Form Component Rules
- **Tự động Trim khoảng trắng:** Các thẻ input Email và Password luôn ngầm định trim leading/trailing spaces trước khi pass schema validator và POST API.
- **Validation Password:** Hiện inline rules lỗi đỏ dưới ô input nếu mk chưa đủ: `≥ 8 ký tự, có 1 hoa, 1 thường, 1 số, 1 ký hiệu đặc biệt`.
- **Loading State:** Nút (Button CTA) sẽ Disable, thay thế nhãn chữ bằng icon spinner quay vòng liên tục (ví dụ: `[ Đang Xác Thực... ]`) khi tải request Auth qua mạng. Không bao giờ cho phép spam-click nhân đôi request.
- **Feedback Alerts:** Toàn bộ Action thất bại sử dụng hệ thống Alert Toast hoặc Inline Banner trên đỉnh form, kèm mã lỗi mô tả bằng ngôn ngữ thân thiện.

---

*Tham chiếu dữ liệu PRD F02 và Wireframe đã chạy.*
