# Wireframe & User Flow: Auth (F02)
> **Version:** 1.0 | **Feature:** Xác thực người dùng (F02)
> **Reference PRD:** [F02-auth.md](../prd/F02-auth.md)

---

## 1. Tóm Tắt Luồng Chạy (User Flow Summary)

Hệ thống Auth (F02) vận hành tập trung vào việc ưu tiên hiển thị đăng nhập, phân quyền tự động sau khi xác thực và bảo vệ an toàn các route nhạy cảm.

### 1.1. Luồng Chưa Đăng Nhập (Auth Guard Flow)
- Người dùng vào trang chủ (`/`) hoặc bất kỳ protected route nào (vd. `/dashboard`, `/builder`).
- Hệ thống kiểm tra session → Không có → **Redirect ép buộc** về trang `/login` cùng tham số `?redirect=[url]`.

### 1.2. Luồng Đăng Nhập (Login Flow)
- User vào `/login` → Nhập **Email** và **Password** (hệ thống tự động cắt khoảng trống thừa).
- Submit xác thực:
  - Lỗi: Hiển thị Alert Banner báo lỗi (401).
  - Đúng, nhưng **Có 2FA bật**: Chuyển sang màn hình `/verify-otp`. Nhập mã OTP 6 số nhận từ Email (hạn 5 phút).
  - Đúng (Xác nhận thành công): Set Cookie an toàn, chuyển hướng dựa trên Role:
    - Nếu là **Owner**: Chuyển hướng vào `/dashboard` (hoặc `/onboarding` nếu tài khoản mới).
    - Nếu là **Staff**: Chuyển hướng vào `/admin` (Giao diện Payload CMS cấp quyền theo nhóm).

### 1.3. Luồng Đăng Ký (Register Flow - Chỉ dành cho Owner)
- Chủ doanh nghiệp vào `/register` → Hiện form chi tiết.
- **Trường bắt buộc**: Tên Công Ty (Company Name), Mã số doanh nghiệp (BRN), Tên người đại diện, Email, Password (≥8 ký tự, mix HOA-số-đặc biệt).
- **Trường tùy chọn**: SĐT, Địa chỉ, TM Customer.
- Submit Data:
  - Check email trùng trên DB → Quét hợp lệ → Tạo User.
  - Tự động tạo duy nhất 1 Tenant (Workspace) ngầm định gán cho User này.
  - Gửi **Welcome Email** (kèm hình ảnh Banner, nút Login).
  - Tự động login và chuyển thẳng tới trang **Onboarding** (`/onboarding`).

### 1.4. Quên Mật Khẩu & Đặt Lại (Forgot/Reset Password Flow)
- **Forgot Password**: Vào `/forgot-password` → Nhập Email → Bấm "Gửi" → Hệ thống **luôn hiển thị trạng thái thành công** (để không lộ email có tôn tại hay không). Gửi email chứa link.
- **Reset Password**: Bấm link từ Email → Mở `/reset-password?token=xxx` → Nhập mật khẩu mới → Đặt lại → Redirect lại trang `/login` kèm thông báo thành công.

---

## 2. Gợi Ý Cấu Trúc Wireframe UI (Low-Fi)

Toàn bộ Authentication sẽ sử dụng giao diện **Full Split Screen** trên Desktop.

### 2.1. Bố Cục Tổng Quan (Global Split Layout)
- **Cột Trái (50% - 60% Width): Brand & Visuals**
  - Hiển thị hỉnh ảnh nghệ thuật/Background (Midnight Tech/Dark Glassmorphism).
  - Slogan / USP của PrimeWeb.
- **Cột Phải (40% - 50% Width): Form Container**
  - Nền mờ (Glassmorphism card).
  - `Logo PrimeWeb` nằm ở giữa đỉnh.
  - Form thay đổi tùy màn hình (Login/Register).
  - Nằm góc dưới cùng là Text/Link: *Help / User Guideline*.

**Mobile Layout (≤ 768px):**
- Đổi thành layout dọc (Stack column), ẩn hình ảnh đồ họa Trái đi (hoặc thu rất nhỏ).
- Form Card chiếm full width màn hình. Tap targets to đảm bảo UX (nút bấm cao 44px).

### 2.2. Màn hình chi tiết

#### A. Màn hình Login (`/login`)
- **Tiêu đề**: "Đăng Nhập" / "Welcome Back"
- **Form**:
  - `Email Address` (Input)
  - `Password` (Input)
  - Link điều hướng `Forgot Password?` rẽ phải dưới ô Password.
- **Nút bấm**: 
  - `[ Đăng Nhập ]` (Primary CTA)
  - `[ Đăng Ký Tài Khoản PrimeWeb ]` (Secondary/Outline) -> chuyển tới /register.

#### B. Màn hình Đăng ký (`/register`)
- **Tiêu đề**: "Tạo Tài Khoản PrimeWeb"
- **Form** (Có thể chia cột dọc/ngang để giảm dài, hoặc dùng Scroll):
  - Khối Thông tin Doanh nghiệp: `Company Name*`, `BRN Number*`.
  - Khối Chủ sở hữu: `First Name*`, `Last Name*`, `Email*`, `Phone`.
  - Khối Mật khẩu: `Password*` (có ghi chú rule bảo mật bên dưới), `Confirm Password`.
- **Nút bấm**:
  - `[ Đăng Ký & Khởi Tạo Gian Hàng ]` (Primary CTA)
  - Text link: `Đã có tài khoản? Trở về Đăng nhập`.

#### C. Màn hình OTP (`/verify-otp`)
- **Tiêu đề**: "Xác Thực 2 Bước"
- **Nội dung**: "Vui lòng nhập 6 số OTP vừa được gửi tới e***@domain.com"
- **Form**:
  - Ô nhập số: `[ ] [ ] [ ] [ ] [ ] [ ]` (UI 6 ô vuông rời rạc).
- **Nút bấm**:
  - `[ Xác Nhận OTP ]` (Primary)
  - `Gửi lại mã (Sau 59s)` (Text link countdown).

#### D. Màn hình Forgot Password (`/forgot-password`)
- **Tiêu đề**: "Khôi phục Mật khẩu"
- **Nội dung**: "Nhập email của bạn để nhận link đặt lại mật khẩu"
- **Form**: `Email Address` (Input)
- **Nút bấm**: `[ Gửi Link Khôi Phục ]`
- *(Thông báo mảng xanh báo lỗi/thành công luôn pop-up hiển thị bên trên khi ấn).*

#### E. Màn hình Reset Password (`/reset-password`)
- **Tiêu đề**: "Đặt mật khẩu mới"
- **Form**: `Mật khẩu mới*`, `Xác nhận Mật khẩu mới*`.
- **Nút bấm**: `[ Cập Nhật Mật Khẩu ]`
