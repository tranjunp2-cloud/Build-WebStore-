# 📐 Low-fi Wireframes: F02 Auth Flow

Dựa trên PRD v2.3 (`F02-auth.md`) — **Dual Auth Flows** (SSO cho Owner, Native cho Staff) + Mandatory 2FA.
Bao gồm Desktop và Mobile wireframes, toàn bộ màn hình xác thực.

---

## 🔄 0. USER FLOW DIAGRAM

### 0.1 Tổng Quan Luồng Auth (Full Auth Flow)
```text
                           ┌─────────────────┐
                           │  User truy cập  │
                           │  Protected Route │
                           └────────┬────────┘
                                    │
                           ┌────────▼────────┐
                           │  Auth Guard     │
                           │  Kiểm tra       │
                           │  Session/JWT    │
                           └────────┬────────┘
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                  Có Session               Không có
                        │                       │
                ┌───────▼───────┐       ┌───────▼───────────┐
                │ Cho phép truy │       │ Redirect → /login │
                │ cập route     │       │ ?redirect=[url]   │
                └───────────────┘       └───────────────────┘
```

### 0.2 Luồng Đăng Nhập (Login Flow — Dual Auth)
```text
                              ┌────────────────┐
                              │   /login Page  │
                              └───────┬────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                   ┌─────▼──────┐           ┌──────▼──────┐
                   │  OWNER     │           │   STAFF     │
                   │ "Đăng nhập │           │ Nhập Email  │
                   │  với SSO"  │           │ + Password  │
                   └─────┬──────┘           └──────┬──────┘
                         │                         │
                ┌────────▼────────┐       ┌────────▼────────┐
                │ Redirect sang   │       │ Xác thực nội bộ │
                │ SSO Login Page  │       │ Webstore 2.0    │
                └────────┬────────┘       └────────┬────────┘
                         │                         │
                ┌────────▼────────┐       ┌────────▼────────┐
                │ SSO Auth xong   │       │  Đúng Email/    │
                │ Callback về     │       │  Password?      │
                │ Webstore        │       └────────┬────────┘
                └────────┬────────┘                │
                         │               ┌────────┴────────┐
                         │               │                  │
                         │          SAI (401)          ĐÚNG
                         │               │                  │
                         │     ┌─────────▼──────┐          │
                         │     │ Alert Banner    │          │
                         │     │ "Sai thông tin" │          │
                         │     └────────────────┘          │
                         │                                  │
                         └──────────┬───────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │ HỆ THỐNG GỬI   │
                           │ OTP 6 SỐ QUA   │
                           │ EMAIL (BẮT BUỘC)│
                           └────────┬────────┘
                                    │
                           ┌────────▼────────┐
                           │  /verify-otp    │
                           │  Nhập OTP 6 số  │
                           │  (Hạn 5 phút)   │
                           └────────┬────────┘
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                   SAI / HẾT HẠN           ĐÚNG
                        │                       │
                ┌───────▼───────┐       ┌───────▼───────┐
                │ Báo lỗi /     │       │ Set Session   │
                │ "Gửi lại mã" │       │ Cookie an toàn│
                └───────────────┘       └───────┬───────┘
                                                │
                                   ┌────────────┴────────────┐
                                   │                         │
                             ┌─────▼──────┐           ┌──────▼──────┐
                             │  OWNER     │           │   STAFF     │
                             │ → /dashboard│           │ → /admin    │
                             │ (hoặc      │           │ (Payload    │
                             │ /onboarding)│           │  CMS)      │
                             └────────────┘           └─────────────┘
```

### 0.3 Luồng Forgot / Reset Password (Dual Routing)
```text
                           ┌─────────────────┐
                           │  /login Page    │
                           │  Click "Quên    │
                           │  mật khẩu?"     │
                           └────────┬────────┘
                                    │
                           ┌────────▼──────────┐
                           │ /forgot-password  │
                           │ Nhập Email        │
                           └────────┬──────────┘
                                    │
                        ┌───────────▼───────────┐
                        │  Kiểm tra loại        │
                        │  tài khoản (Email)    │
                        └───────────┬───────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   │                                  │
            ┌──────▼──────┐                    ┌──────▼──────┐
            │   OWNER     │                    │   STAFF     │
            └──────┬──────┘                    └──────┬──────┘
                   │                                  │
         ┌─────────▼─────────┐              ┌─────────▼─────────┐
         │ Redirect sang SSO │              │ Gửi Email chứa    │
         │ /forgot-password  │              │ Reset Link         │
         │ (External domain) │              │ (Webstore native)  │
         └───────────────────┘              └─────────┬─────────┘
                                                      │
                                                      │
                                           ┌──────────▼──────────┐
                                           │ Hiển thị thông báo  │
                                           │ "Đã gửi link" (luôn │
                                           │ hiện dù email có    │
                                           │ tồn tại hay không)  │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ Staff click link    │
                                           │ /reset-password     │
                                           │ ?token=xxx          │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ Nhập mật khẩu mới   │
                                           │ + Xác nhận           │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ ✅ Thành công         │
                                           │ Redirect → /login   │
                                           └─────────────────────┘
```

### 0.4 Luồng Owner Provisioning (SSO Webhook)
```text
         ┌──────────────┐          ┌────────────────────┐          ┌─────────────────┐
         │  SSO System  │          │   Webstore 2.0     │          │   Owner Email   │
         │  (External)  │          │   (Backend API)    │          │                 │
         └──────┬───────┘          └─────────┬──────────┘          └────────┬────────┘
                │                            │                              │
                │  POST /api/v1/tm/users     │                              │
                │  (Payload: company_name,   │                              │
                │   email, customer_id,      │                              │
                │   service_id, first_name,  │                              │
                │   last_name, pack_code)    │                              │
                │ ──────────────────────────►│                              │
                │                            │                              │
                │                   ┌────────▼────────┐                     │
                │                   │ Validate 6      │                     │
                │                   │ trường Unique   │                     │
                │                   │ + pack_code     │                     │
                │                   └────────┬────────┘                     │
                │                            │                              │
                │              ┌─────────────┴─────────────┐                │
                │              │                           │                │
                │         INVALID                      VALID                │
                │              │                           │                │
                │    ┌─────────▼──────┐          ┌─────────▼──────┐         │
                │    │ Return 400/409 │          │ Tạo Account    │         │
                │    │ Error Response │          │ Owner + Tenant │         │
                │    └────────────────┘          └─────────┬──────┘         │
                │                                          │                │
                │                                          │  Welcome Email │
                │                                          │ ──────────────►│
                │                                          │                │
                │           Return 201 Created             │                │
                │ ◄────────────────────────────────────────│                │
                │                                          │                │
```

---

## 💻 1. DESKTOP WIREFRAME (≥ 768px)

Cấu trúc: **Full Split Screen** — Brand Panel trái (50-60% width), Form Panel phải (40-50% width).

### 1.1 Màn hình Login (`/login`) — Dual Auth
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Chào mừng trở lại           │     │
│     │    [Background Artwork]      │     ││     │  Welcome Back                │     │
│     │    Dark Glassmorphism /      │     ││     │                              │     │
│     │    Midnight Tech             │     ││     │  ─── ĐĂNG NHẬP NỘI BỘ ───   │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Email Address               │     │
│     │    ┌────────────────────┐    │     ││     │  ┌──────────────────────┐    │     │
│     │    │                    │    │     ││     │  │ staff@company.com    │    │     │
│     │    │   "Xây dựng cửa   │    │     ││     │  └──────────────────────┘    │     │
│     │    │    hàng trực tuyến │    │     ││     │                              │     │
│     │    │    chỉ trong       │    │     ││     │  Password                    │     │
│     │    │    vài phút"       │    │     ││     │  ┌──────────────────────┐    │     │
│     │    │                    │    │     ││     │  │ ••••••••        [👁]  │    │     │
│     │    │   — PrimeWeb —     │    │     ││     │  └──────────────────────┘    │     │
│     │    └────────────────────┘    │     ││     │          Quên mật khẩu? ──► │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     └──────────────────────────────┘     ││     │  │   🔐 Đăng Nhập       │    │     │
│                                          ││     │  └──────────────────────┘    │     │
│                                          ││     │                              │     │
│                                          ││     │  ──────── hoặc ────────     │     │
│                                          ││     │                              │     │
│                                          ││     │  ┌──────────────────────┐    │     │
│                                          ││     │  │ 🌐 Đăng nhập với SSO │    │     │
│                                          ││     │  └──────────────────────┘    │     │
│                                          ││     │  (Dành cho Chủ doanh nghiệp)│     │
│                                          ││     │                              │     │
│                                          ││     └──────────────────────────────┘     │
│                                          ││                                          │
│                                          ││        Help / User Guideline             │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```
**Ghi chú:**
- **Form Staff (Native):** Nhập Email + Password trực tiếp. Alert Banner đỏ phía trên form khi lỗi 401.
- **Nút SSO Login:** Dành riêng cho Owner. Click → Redirect external sang SSO Login Page.
- **Link "Quên mật khẩu?"** nằm dưới trường Password, căn phải.

### 1.2 Màn hình Login — Trạng thái Lỗi (Error State)
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌────────────────────────┐  │     │
│     │    [Background Artwork]      │     ││     │  │ ⚠️ Email hoặc mật khẩu │  │     │
│     │                              │     ││     │  │   không chính xác.     │  │     │
│     │                              │     ││     │  └────────────────────────┘  │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Chào mừng trở lại           │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Email Address               │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ staff@company.com    │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Password                    │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ ••••••••        [👁]  │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │          Quên mật khẩu? ──► │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │   🔐 Đăng Nhập       │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     └──────────────────────────────┘     ││     └──────────────────────────────┘     │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```

### 1.3 Màn hình Xác thực OTP (`/verify-otp`) — Bắt buộc 2FA
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │    [Background Artwork]      │     ││     │  🔒 Xác Thực 2 Bước          │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Vui lòng nhập 6 số OTP     │     │
│     │                              │     ││     │  vừa được gửi tới           │     │
│     │                              │     ││     │  e***@domain.com            │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐│
│     │                              │     ││     │  │    ││    ││    ││    ││    ││    ││
│     │                              │     ││     │  │    ││    ││    ││    ││    ││    ││
│     │                              │     ││     │  └────┘└────┘└────┘└────┘└────┘└────┘│
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ⏱ Mã hết hạn sau: 04:59     │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │   ✅ Xác Nhận OTP    │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Gửi lại mã (Sau 59s)       │     │
│     │                              │     ││     │  ↑ Text link countdown       │     │
│     │                              │     ││     │                              │     │
│     └──────────────────────────────┘     ││     └──────────────────────────────┘     │
│                                          ││                                          │
│                                          ││        Help / User Guideline             │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```
**Ghi chú:**
- **OTP 6 ô vuông rời rạc**: Auto-focus ô kế tiếp khi nhập xong 1 số. Paste mã tự động fill.
- **Countdown**: Nút "Gửi lại mã" bị disabled trong 60s, hiện đếm ngược.
- **OTP hết hạn**: Hiển thị timer 5 phút. Hết hạn → hiện thông báo + nút "Gửi lại mã".

### 1.4 Màn hình Forgot Password (`/forgot-password`)
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │    [Background Artwork]      │     ││     │  🔑 Khôi Phục Mật Khẩu       │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Nhập email của bạn để nhận  │     │
│     │                              │     ││     │  hướng dẫn đặt lại mật khẩu │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Email Address               │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ your@email.com       │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ 📧 Gửi Link Khôi Phục│    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ◄ Quay lại Đăng nhập       │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌────────────────────────┐  │     │
│     │                              │     ││     │  │ ℹ️ Nếu bạn là Chủ DN,  │  │     │
│     │                              │     ││     │  │ bạn sẽ được chuyển    │  │     │
│     │                              │     ││     │  │ sang SSO để đổi MK.   │  │     │
│     │                              │     ││     │  └────────────────────────┘  │     │
│     │                              │     ││     │                              │     │
│     └──────────────────────────────┘     ││     └──────────────────────────────┘     │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```
**Ghi chú:**
- **Owner**: Khi nhập email Owner → hệ thống redirect sang SSO forgot-password page (`https://sso-dev.ech.primecommerce.asia/auth/forgot-password`).
- **Staff**: Gửi email chứa reset link native. **Luôn hiển thị thông báo thành công** (bảo mật — không lộ email có tồn tại).
- **Info banner**: Thông báo rằng Owner sẽ được redirect sang SSO.

### 1.5 Trạng thái "Đã Gửi Link" (Success Feedback)
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │    [Background Artwork]      │     ││     │  ✅ Đã gửi hướng dẫn!        │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Nếu email s***@company.com  │     │
│     │                              │     ││     │  tồn tại trong hệ thống,    │     │
│     │                              │     ││     │  bạn sẽ nhận được link đặt  │     │
│     │                              │     ││     │  lại mật khẩu trong vài     │     │
│     │                              │     ││     │  phút.                      │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │  📧 Mở Email Client  │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ◄ Quay lại Đăng nhập       │     │
│     │                              │     ││     │                              │     │
│     └──────────────────────────────┘     ││     └──────────────────────────────┘     │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```

### 1.6 Màn hình Reset Password (`/reset-password?token=xxx`) — Staff Only
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │    [Background Artwork]      │     ││     │  🔐 Đặt Mật Khẩu Mới         │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Mật khẩu mới *              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ ••••••••        [👁]  │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │  ✓ Ít nhất 6 ký tự          │     │
│     │                              │     ││     │  ✓ Chứa chữ HOA             │     │
│     │                              │     ││     │  ✓ Chứa số                  │     │
│     │                              │     ││     │  ✗ Chứa ký tự đặc biệt     │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Xác nhận mật khẩu mới *    │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ ••••••••        [👁]  │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │  🔄 Cập Nhật Mật Khẩu│    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     └──────────────────────────────┘     ││     └──────────────────────────────┘     │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```
**Ghi chú:**
- **Password Strength Indicator**: Hiển thị realtime, checklist yêu cầu dưới ô password.
- **Reset thành công** → Redirect về `/login` kèm Toast xanh "Mật khẩu đã được cập nhật thành công!".
- **Token hết hạn / không hợp lệ** → Hiện thông báo lỗi + Link "Gửi lại link mới".

### 1.7 Trạng thái Token Hết Hạn (Reset Password Error)
```text
┌──────────────────────────────────────────┐┌──────────────────────────────────────────┐
│                                          ││                                          │
│                                          ││            [Logo PrimeWeb]               │
│                                          ││                                          │
│     ┌──────────────────────────────┐     ││     ┌──────────────────────────────┐     │
│     │                              │     ││     │                              │     │
│     │    [Background Artwork]      │     ││     │           ⚠️                  │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Link đã hết hạn hoặc       │     │
│     │                              │     ││     │  không hợp lệ               │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  Vui lòng yêu cầu lại       │     │
│     │                              │     ││     │  link đặt lại mật khẩu.     │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ┌──────────────────────┐    │     │
│     │                              │     ││     │  │ 📧 Gửi Lại Link Mới  │    │     │
│     │                              │     ││     │  └──────────────────────┘    │     │
│     │                              │     ││     │                              │     │
│     │                              │     ││     │  ◄ Quay lại Đăng nhập       │     │
│     │                              │     ││     │                              │     │
│     └──────────────────────────────┘     ││     └──────────────────────────────┘     │
│                                          ││                                          │
└──────────────────────────────────────────┘└──────────────────────────────────────────┘
```

---

## 📱 2. MOBILE WIREFRAME (< 768px)

Layout dọc (Stack column), ẩn Brand Panel bên trái. Form Card chiếm full width. Tap targets tối thiểu 44px.

### 2.1 Login — Mobile
```text
┌──────────────────────────┐
│ [Logo PrimeWeb]          │
├──────────────────────────┤
│                          │
│  Chào mừng trở lại       │
│  Welcome Back            │
│                          │
│  ─── ĐĂNG NHẬP ───      │
│                          │
│  Email Address           │
│  ┌──────────────────────┐│
│  │ staff@company.com    ││
│  └──────────────────────┘│
│                          │
│  Password                │
│  ┌──────────────────────┐│
│  │ ••••••••        [👁]  ││
│  └──────────────────────┘│
│        Quên mật khẩu? ──►│
│                          │
│  ┌──────────────────────┐│ ← Sticky bottom
│  │   🔐 Đăng Nhập       ││    CTA buttons
│  └──────────────────────┘│
│                          │
│  ──────── hoặc ────────  │
│                          │
│  ┌──────────────────────┐│
│  │ 🌐 Đăng nhập với SSO ││
│  └──────────────────────┘│
│  (Dành cho Chủ DN)       │
│                          │
│      Help / Guideline    │
└──────────────────────────┘
```
**Font ≥16px** để tránh Safari auto-zoom. Nút CTA **sticky đáy** không bị bàn phím che.

### 2.2 OTP Verification — Mobile
```text
┌──────────────────────────┐
│ [Logo]           [← Back]│
├──────────────────────────┤
│                          │
│  🔒 Xác Thực 2 Bước      │
│                          │
│  Vui lòng nhập 6 số OTP │
│  vừa được gửi tới       │
│  e***@domain.com         │
│                          │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐│
│  │  ││  ││  ││  ││  ││  ││
│  └──┘└──┘└──┘└──┘└──┘└──┘│
│                          │
│  ⏱ Mã hết hạn sau: 04:59 │
│                          │
│  ┌──────────────────────┐│ ← Sticky bottom
│  │   ✅ Xác Nhận OTP    ││
│  └──────────────────────┘│
│                          │
│  Gửi lại mã (Sau 59s)   │
│                          │
└──────────────────────────┘
```
**Touch-safe:** Ô OTP kích thước lớn (48x48px), auto-focus ô kế tiếp. Keyboard type: numeric.

### 2.3 Forgot Password — Mobile
```text
┌──────────────────────────┐
│ [Logo]           [← Back]│
├──────────────────────────┤
│                          │
│  🔑 Khôi Phục Mật Khẩu   │
│                          │
│  Nhập email của bạn để   │
│  nhận hướng dẫn đặt lại │
│  mật khẩu               │
│                          │
│  Email Address           │
│  ┌──────────────────────┐│
│  │ your@email.com       ││
│  └──────────────────────┘│
│                          │
│  ┌──────────────────────┐│
│  │ 📧 Gửi Link Khôi Phục││
│  └──────────────────────┘│
│                          │
│  ◄ Quay lại Đăng nhập    │
│                          │
│  ┌────────────────────┐  │
│  │ ℹ️ Owner → SSO Reset│  │
│  └────────────────────┘  │
│                          │
└──────────────────────────┘
```

### 2.4 Reset Password — Mobile (Staff Only)
```text
┌──────────────────────────┐
│ [Logo]                   │
├──────────────────────────┤
│                          │
│  🔐 Đặt Mật Khẩu Mới     │
│                          │
│  Mật khẩu mới *          │
│  ┌──────────────────────┐│
│  │ ••••••••        [👁]  ││
│  └──────────────────────┘│
│  ✓ Ít nhất 6 ký tự      │
│  ✓ Chứa chữ HOA         │
│  ✓ Chứa số              │
│  ✗ Chứa ký tự đặc biệt  │
│                          │
│  Xác nhận mật khẩu *    │
│  ┌──────────────────────┐│
│  │ ••••••••        [👁]  ││
│  └──────────────────────┘│
│                          │
│  ┌──────────────────────┐│ ← Sticky bottom
│  │ 🔄 Cập Nhật Mật Khẩu ││
│  └──────────────────────┘│
│                          │
└──────────────────────────┘
```

---

## 🛡 3. Ghi Chú UI Patterns

### 3.1 General UI Rules
- **Split Screen Layout:** Desktop sử dụng 2 cột. Cột trái hiện Brand/Visuals (Dark Glassmorphism), cột phải là Glassmorphism card chứa form.
- **Mobile:** Layout dọc, ẩn Brand Visuals. Form card chiếm full width. CTA buttons sticky bottom.
- **Logo PrimeWeb:** Luôn hiển thị ở đỉnh form panel.
- **Help / Guideline Link:** Góc dưới cùng mọi màn hình Auth.

### 3.2 Form Validation
- **Inline Validation:** Hiển thị lỗi đỏ ngay dưới trường input khi thiếu hoặc sai format.
- **Email auto-trim:** Tự động cắt khoảng trống thừa đầu/cuối trước khi submit.
- **Password Visibility Toggle:** Icon 👁 bật/tắt hiển thị password.
- **Password Strength:** Checklist realtime (≥6 ký tự, chữ HOA, số, ký tự đặc biệt).

### 3.3 Error Handling
- **Alert Banner:** Hiển thị phía trên form khi Auth fail (nền đỏ/cam, text trắng).
- **Toast Notification:** Pop-up góc phải trên cho thông báo thành công (xanh lá) hoặc lỗi hệ thống (đỏ).
- **Token Expired:** Màn hình riêng khi reset password token hết hạn.

### 3.4 Security Patterns
- **2FA Mandatory:** OTP qua Email bắt buộc 100% người dùng.
- **OTP Input:** 6 ô vuông rời rạc, auto-advance, support paste.
- **Rate Limit:** Lock tài khoản sau 5 lần nhập sai OTP liên tiếp.
- **Resend Cooldown:** Nút "Gửi lại mã" disabled 60s, có countdown.
- **Forgot Password Security:** Luôn hiện "Đã gửi" dù email có tồn tại hay không.

### 3.5 Dual Auth Routing Rules
- **Owner Login:** Click nút SSO → Redirect external SSO login page → Callback → OTP → `/dashboard`.
- **Staff Login:** Nhập Email/Pass native → OTP → `/admin` (Payload CMS).
- **Owner Reset PW:** Redirect sang SSO (`https://sso-dev.ech.primecommerce.asia/auth/forgot-password`).
- **Staff Reset PW:** Native reset flow tại Webstore 2.0.

---

## 📋 4. Danh Sách Màn Hình (Screen Inventory)

| # | Màn hình | Route | Desktop | Mobile | Roles |
|---|----------|-------|---------|--------|-------|
| 1 | Login (Dual Auth) | `/login` | ✅ 1.1 | ✅ 2.1 | Owner + Staff |
| 2 | Login Error State | `/login` | ✅ 1.2 | ✅ (inline) | Owner + Staff |
| 3 | OTP Verification | `/verify-otp` | ✅ 1.3 | ✅ 2.2 | Owner + Staff |
| 4 | Forgot Password | `/forgot-password` | ✅ 1.4 | ✅ 2.3 | Owner + Staff |
| 5 | Đã Gửi Link (Success) | `/forgot-password` | ✅ 1.5 | ✅ (inline) | Staff |
| 6 | Reset Password | `/reset-password` | ✅ 1.6 | ✅ 2.4 | Staff only |
| 7 | Token Expired Error | `/reset-password` | ✅ 1.7 | ✅ (inline) | Staff only |
