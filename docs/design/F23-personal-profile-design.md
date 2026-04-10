# F23 Personal Profile — Design & Wireframe Report

> **Epic:** User Management & Security
> **Feature Code:** F23
> **Interactive Demo:** [F23-profile-ui-demo.html](F23-profile-ui-demo.html)
> - [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=31543-4488&t=5iRs7zduIFWCE9h3-1)

Tài liệu này cung cấp bản vẽ Wireframe chi tiết và luồng người dùng (User Flow) cho tính năng Hồ sơ Cá nhân (F23), bám sát PRD và User Stories. Tất cả giao diện tuân thủ **F18 CMS Global Layout** (Sidebar trái và Topbar giữ nguyên).

---

## 1. User Flow

### 1.1 Luồng Truy Cập Profile

```
[CMS Dashboard — Bất kỳ trang nào]
    │
    ▼
[Click Avatar trên Global Top Header (F18-02)]
    │
    ▼
[Dropdown Menu hiện ra]
    │ ├── My Profile ◄── Click vào đây
    │ ├── Language (BM/EN)
    │ ├── Workspace
    │ └── Logout
    │
    ▼
[Route → /profile]
    │
    ▼
[Profile Page Load — Tab "General Info" mặc định]
```

### 1.2 Luồng Staff — Chỉnh Sửa Thông Tin

```
[Tab: General Info — Staff View]
    │
    ├── Upload Avatar
    │   ├── Click Avatar → File Picker
    │   ├── File hợp lệ (JPG/PNG, ≤ 2MB)?
    │   │   ├── ✅ Yes → Upload → Avatar cập nhật ngay → Toast Success
    │   │   └── ❌ No → Toast Error ("Chỉ chấp nhận JPG/PNG dưới 2MB")
    │
    ├── Edit Name / Phone
    │   ├── Sửa First Name, Last Name, Phone (với Country Code dropdown)
    │   ├── Click "Save Changes"
    │   ├── Validation pass?
    │   │   ├── ✅ Yes → API Update → Toast Success
    │   │   └── ❌ No → Inline Error đỏ trên field lỗi
    │   │       ├── Name: "Tên phải từ 2–50 ký tự"
    │   │       └── Phone: "Số điện thoại không hợp lệ"
    │
    └── Email → Luôn Disabled (Login Identity)
```

### 1.3 Luồng Staff — Đổi Mật Khẩu

```
[Tab: Security — Staff View]
    │
    ├── Nhập Current Password
    ├── Nhập New Password → Strength Meter cập nhật real-time
    │   ├── Checklist: ≥ 8 chars, 1 Upper, 1 Lower, 1 Number, 1 Special
    ├── Nhập Confirm New Password
    │
    ├── Click "Update Password"
    │   ├── Validation pass?
    │   │   ├── ✅ Yes → API Update → Toast Success
    │   │   │   └── Đăng xuất tất cả phiên khác (trừ phiên hiện tại)
    │   │   └── ❌ No → Inline Error
    │   │       ├── Current PW trống: "Vui lòng nhập mật khẩu hiện tại"
    │   │       ├── New PW yếu: "Mật khẩu chưa đáp ứng yêu cầu bảo mật"
    │   │       └── Confirm ≠ New: "Mật khẩu xác nhận không khớp"
```

### 1.4 Luồng Owner — Xem Thông Tin (Read-Only)

```
[Tab: General Info — Owner View]
    │
    ├── Upload Avatar → Hoạt động bình thường (Avatar độc lập SSO)
    │
    ├── Xem Name / Phone / Email
    │   ├── ALL DISABLED + Lock Icon 🔒
    │   ├── SSO Notice Box hiện ở trên form:
    │   │   "Thông tin được đồng bộ bởi hệ thống SSO. Bạn không thể sửa đổi tại đây."
    │   └── CTA: "Manage Account in SSO →" → Mở tab mới
    │
    └── Không có nút "Save Changes"
```

### 1.5 Luồng Owner — Bảo Mật SSO

```
[Tab: Security — Owner View]
    │
    ├── SSO Protected Account Guard Box
    │   ├── Thông báo: Mật khẩu và bảo mật được quản lý bởi SSO
    │   └── CTA: "Manage SSO Account →" → Mở tab mới → SSO Portal
    │
    └── Account Info hiển thị:
        ├── Auth Provider: SSO (PrimeID)
        ├── Last Login: timestamp
        ├── 2FA Status: Enabled/Disabled
        └── Sessions: số phiên đang hoạt động
```

---

## 2. Wireframe: Profile Banner & Tab Navigation

*Phần đầu trang Profile. Banner gradient chứa Avatar (có nút upload), tên, email, role badge. Bên dưới là Tab switcher.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                       [🔔 3] [👤 ▼]│
├──────────────┬──────────────────────────────────────────┤
│ 📊 Dashboard │ Personal Profile                         │
│ 🌐 Webstore  │ Quản lý thông tin cá nhân và bảo mật.   │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌─── Profile Banner ──────────────────┐ │
│ ⚙️ Config    │ │  ┌────┐                              │ │
│              │ │  │ 📷 │  Trần Dũng                   │ │
│              │ │  │ TD │  trandung@example.com         │ │
│              │ │  └────┘  [STAFF]                      │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ [ General Info ]  [ Security ]            │
│              │ ════════════════                          │
│              │                                          │
│              │ ...Tab Content Renders Below...           │
│              │                                          │
│ 💬 Help (WA) │                                          │
└──────────────┴──────────────────────────────────────────┘
```

---

## 3. Wireframe: Tab "General Info" — Staff View

*Staff có thể chỉnh sửa First Name, Last Name, Phone (kèm Country Code dropdown). Email luôn Disabled.*

```text
┌─ Personal Information ───────────────────────────────────┐
│ Cập nhật thông tin cá nhân của bạn.                      │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│  First Name                    Last Name                 │
│  [ Dũng                    ]   [ Trần                 ]  │
│                                                          │
│  Email Address 🔒                                         │
│  [ trandung@example.com    ]  ← Disabled                 │
│  "Email không thể thay đổi (Login Identity)"             │
│                                                          │
│  Phone Number                                            │
│  [ 🇻🇳 +84 ▼ ] [ 912345678                           ]  │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│  [ 🎨 Save Changes ]   [ Cancel ]                        │
└──────────────────────────────────────────────────────────┘
```

**Validation Error State (Staff):**
```text
│  First Name                        Last Name             │
│  [ D                          ]    [ Trần             ]  │
│  ╔══ viền đỏ ══╗                                         │
│  🔴 Tên phải từ 2–50 ký tự                               │
│                                                          │
│  Phone Number                                            │
│  [ 🇻🇳 +84 ▼ ] [ abc              ]                     │
│  ╔══ viền đỏ ══╗                                         │
│  🔴 Số điện thoại không hợp lệ                            │
```

---

## 4. Wireframe: Tab "General Info" — Owner View

*Owner thấy tất cả fields bị Disabled (trừ Avatar). SSO Notice Box hiển thị ở trên form. CTA điều hướng SSO thay nút Save.*

```text
┌─ 🔒 SSO Notice ─────────────────────────────────────────┐
│  Thông tin được quản lý bởi SSO                          │
│  Các trường thông tin cá nhân được đồng bộ từ hệ thống   │
│  SSO. Bạn không thể chỉnh sửa tại đây.                  │
│  ⚠️ Để thay đổi, vui lòng truy cập cổng SSO              │
└──────────────────────────────────────────────────────────┘

┌─ Personal Information ───────────────────────────────────┐
│ Cập nhật thông tin cá nhân của bạn.                      │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│  First Name 🔒                     Last Name 🔒           │
│  [ Quân              ]  ← Disabled [ Nguyễn Minh ]      │
│                                                          │
│  Email Address 🔒                                         │
│  [ owner@example.com ]  ← Disabled                       │
│                                                          │
│  Phone Number 🔒                                          │
│  [ 🇲🇾 +60 ▼ ] [ 123456789 ]  ← Disabled                │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│  [ 🔗 Manage Account in SSO → ]   ← Mở tab mới          │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Wireframe: Tab "Security" — Staff View

*Form đổi mật khẩu Native gồm 3 trường: Current, New (kèm Strength Meter), Confirm. Bảng yêu cầu mật khẩu ở dưới.*

```text
┌─ Change Password ────────────────────────────────────────┐
│ Đổi mật khẩu đăng nhập. Mật khẩu mới phải đáp ứng       │
│ tiêu chuẩn bảo mật.                                     │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│  Current Password                                        │
│  [ ●●●●●●●●                                     ] [👁]  │
│                                                          │
│  New Password                                            │
│  [ ●●●●●●                                       ] [👁]  │
│  [ ████░░░░ ] ← Strength: Medium                        │
│                                                          │
│  Confirm New Password                                    │
│  [ ●●●●●●                                       ] [👁]  │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│  [ 🎨 Update Password ]   [ Cancel ]                     │
└──────────────────────────────────────────────────────────┘

┌─ Password Requirements ─────────────────────────────────┐
│  ○ Ít nhất 8 ký tự          ○ 1 chữ hoa (A-Z)          │
│  ○ 1 chữ thường (a-z)       ○ 1 chữ số (0-9)           │
│  ○ 1 ký tự đặc biệt (!@#...)                           │
│                                                          │
│  ✓ = Xanh lá (pass)    ○ = Xám (chưa pass)              │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Wireframe: Tab "Security" — Owner View

*Không có form password. Chỉ hiện SSO Guard Box kèm CTA và bảng Account Info.*

```text
┌─ Account Security ──────────────────────────────────────┐
│ Tài khoản được bảo mật thông qua hệ thống SSO.          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│  ┌─ 🛡️ SSO Protected Account ──────────────────────┐     │
│  │                                                  │     │
│  │  Mật khẩu và cài đặt bảo mật của bạn được quản   │     │
│  │  lý bởi hệ thống Single Sign-On (SSO). Để thay  │     │
│  │  đổi mật khẩu, bật 2FA, hoặc cập nhật bảo mật,  │     │
│  │  vui lòng truy cập cổng quản lý SSO.             │     │
│  │                                                  │     │
│  └──────────────────────────────────────────────────┘     │
│                                                          │
│  [ 🔗 Manage SSO Account → ]   ← Full-width button      │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│  Account Info                                            │
│  ──────────────                                          │
│  Auth Provider  : SSO (PrimeID)                          │
│  Last Login     : 01/04/2026 14:30                       │
│  2FA Status     : ✓ Enabled (Xanh)                       │
│  Sessions       : 2 active                               │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Mobile Responsive View (≤ 768px)

*Sidebar ẩn → Hamburger. Form chuyển sang single-column. Banner avatar stack dọc.*

```text
📱 Mobile — General Info (Staff)
┌─────────────────────────────┐
│ ☰  PrimeWeb        [🔔][👤]│
├─────────────────────────────┤
│                             │
│         ┌────┐              │
│         │ TD │              │
│         │ 📷 │              │
│         └────┘              │
│       Trần Dũng             │
│   trandung@example.com      │
│         [STAFF]             │
│                             │
│ [General Info] [Security]   │
│ ═══════════════             │
│                             │
│ ┌─ Personal Information ──┐ │
│ │                          │ │
│ │ First Name               │ │
│ │ [ Dũng               ]  │ │
│ │                          │ │
│ │ Last Name                │ │
│ │ [ Trần               ]  │ │
│ │                          │ │
│ │ Email Address 🔒          │ │
│ │ [ trandung@example.. ]  │ │
│ │                          │ │
│ │ Phone Number             │ │
│ │ [+84▼] [912345678    ]  │ │
│ │                          │ │
│ │ [Save Changes] [Cancel]  │ │
│ └──────────────────────────┘ │
└─────────────────────────────┘

📱 Mobile — Security (Owner)
┌─────────────────────────────┐
│ ☰  PrimeWeb        [🔔][👤]│
├─────────────────────────────┤
│ [General Info] [Security]   │
│               ═════════     │
│                             │
│ ┌─ Account Security ──────┐ │
│ │                          │ │
│ │ 🛡️ SSO Protected Account │ │
│ │ Mật khẩu và bảo mật     │ │
│ │ được quản lý bởi SSO.   │ │
│ │                          │ │
│ │ [Manage SSO Account →]   │ │
│ │                          │ │
│ │ Auth Provider: SSO       │ │
│ │ Last Login: 01/04/2026   │ │
│ │ 2FA: ✓ Enabled           │ │
│ │ Sessions: 2 active       │ │
│ └──────────────────────────┘ │
└─────────────────────────────┘
```

---

## 8. UI States & Component Summary

### 8.1 States Matrix

| Component | Default | Hover | Focus | Disabled | Error |
|-----------|---------|-------|-------|----------|-------|
| Text Input | Border `#1F2937` | — | Border `#3B82F6` | Opacity 50%, `cursor-not-allowed` | Border `#EF4444` + helper đỏ |
| Primary Button | Gradient Blue→Teal | Opacity 90%, `translateY(-1px)` | — | — | — |
| SSO CTA Button | BG `rgba(59,130,246,.15)` | BG `.25` | — | — | — |
| Avatar Upload | Camera icon | Scale 1.1 | — | — | — |
| Tab | Color `#9CA3AF` | Color `#FFFFFF` | — | — | Active: `#3B82F6` + underline |
| Password Strength | — | — | — | — | Bars: Weak(đỏ) / Medium(vàng) / Strong(xanh) |

### 8.2 Toast Notifications

| Event | Type | Message |
|-------|------|---------|
| Avatar upload success | ✅ Success | "Avatar đã được cập nhật thành công!" |
| Avatar invalid file | ❌ Error | "Chỉ chấp nhận file JPG hoặc PNG dưới 2MB" |
| Save info success | ✅ Success | "Thông tin cá nhân đã được cập nhật!" |
| Password update success | ✅ Success | "Mật khẩu đã được cập nhật! Các phiên khác đã bị đăng xuất." |
| SSO redirect | ℹ️ Info | "Đang mở cổng SSO trong tab mới..." |

### 8.3 Validation Rules (Zod Schema)

| Field | Rule | Client-side | Server-side |
|-------|------|-------------|-------------|
| First Name | 2–50 chars, no XSS | ✅ Inline error | ✅ Reject |
| Last Name | 2–50 chars, no XSS | ✅ Inline error | ✅ Reject |
| Phone | Country code + regex by region | ✅ Inline error | ✅ Reject |
| Avatar | MIME `image/jpeg\|png`, ≤ 2048 KB | ✅ Toast error | ✅ Reject |
| New Password | ≥ 8 chars, 1 Upper, 1 Lower, 1 Num, 1 Special | ✅ Inline + strength | ✅ Reject |
| Confirm Password | Exact match New Password | ✅ Inline error | ✅ Reject |

---

## 9. Design System Compliance

Tất cả components tuân thủ [Design System](Design%20system.md):

| Token | Value Applied |
|-------|---------------|
| Background | `#0B1120` |
| Surface (Card) | `#161E2E` |
| Border | `#1F2937` |
| Primary Blue | `#3B82F6` |
| Primary Teal | `#2DD4BF` |
| Error | `#EF4444` |
| Success | `#10B981` |
| Font | Inter, sans-serif |
| Input Height | 40px |
| Card Radius | 12px |
| Button Radius | 8px |
