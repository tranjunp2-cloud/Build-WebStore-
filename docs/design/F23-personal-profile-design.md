# F23 Personal Profile — Design & Wireframe Report

> **Epic:** User Management & Security
> **Feature Code:** F23
> **Interactive Demo:** [F23-profile-ui-demo.html](F23-profile-ui-demo.html)
> - [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=31543-4488&t=5iRs7zduIFWCE9h3-1)

Tài liệu này là bản vẽ Wireframe + User Flow cho tính năng Hồ sơ Cá nhân (F23), bám sát PRD, User Stories và **demo tương tác** ở trên. Tất cả giao diện tuân thủ **F18 CMS Global Layout** (Sidebar trái + Topbar) và [Design System](Design%20system/Design%20system.md).

> **⚠️ Trạng thái:** UX audit đã chốt **single-page, không có sub-tabs**. Code hiện tại render Owner view hoặc các Staff sections xếp dọc trong `/settings/profile`; tên component legacy `GeneralInfoTab`/`SecurityTab` không đại diện cho tab navigation.

> [!IMPORTANT]
> **F23 v1.3 integration handoff — 2026-09-08:** Owner avatar rule trong tài liệu này đã bị supersede bởi [PRD F23 v1.3](../prd/F23-personal-profile.md) và [US-F23-01/05](../stories/F23-personal-profile-stories.md). Owner avatar phải Read-only và do SSO quản lý; dòng Owner upload local cũ không còn hiệu lực. UI/UX cần bổ sung loading/sync, last-known, initials và error states sau khi SSO/Architecture contract được duyệt.

**Thay đổi cốt lõi so với bản cũ:**
- **Bỏ sub-tabs** "General Info / Security". Cả Staff và Owner đều là **1 trang cuộn dọc**.
- **Staff:** 2 section card xếp dọc — *Personal Information* + *Password & Security*. Personal Information save bar chỉ hiện khi dirty; Password action bar luôn hiện sau khi form được expand và Submit disabled cho đến khi hợp lệ.
- **Owner:** 1 trang read-only — *Account Information card* (bên trái) + *SSO widget* (bên phải), 1 CTA duy nhất ra SSO.
- **Banner compact** (avatar 72px), bỏ chỉ báo "Active Now" (trước đây hard-code).

---

## 1. User Flow

### 1.1 Truy cập Profile

```
[CMS Dashboard — bất kỳ trang nào]
    │  Click Avatar trên Global Top Header (F18-02)
    ▼
[Dropdown: My Profile ◄ / Language / Workspace / Logout]
    │  Click "My Profile"
    ▼
[Route → /settings/profile]  → render theo Role (Staff | Owner)
```

### 1.2 Staff — Chỉnh sửa thông tin (card *Personal Information*)

```
├── Upload Avatar
│   ├── Click Avatar → File Picker
│   └── Hợp lệ (JPG/PNG, ≤ 2MB)? ✅ Upload → Toast success · ❌ Toast error
│
├── Edit First / Last Name, Phone (Country Code +60/+84)
│   ├── Field dirty → Save bar hiện (Save Change / Cancel)
│   └── Click "Save Change" → validation?
│       ├── ✅ PATCH /api/users/me → Toast "Profile updated"
│       └── ❌ Inline error đỏ dưới field lỗi
│
└── Email → luôn Disabled (Login Identity, 🔒)
```

### 1.3 Staff — Đổi mật khẩu (card *Password & Security*)

```
├── Current Password (👁 toggle)
├── New Password + Confirm New Password (👁 toggle)
│   └── Checklist realtime (3 rule): ≥ 8 ký tự · 1 chữ hoa · 1 chữ số
├── Form expanded → Action bar luôn hiện (Update Password / Cancel); Submit disabled đến khi hợp lệ
└── Click "Update Password" → validation?
    ├── ✅ POST /api/users/me/password → Toast "Password changed successfully"
    └── ❌ Inline error:
        ├── Current sai        → "Current password is incorrect"
        ├── New = Current      → "New password must differ from current password"
        └── Confirm ≠ New      → "Passwords do not match"
```

### 1.4 Owner — Xem thông tin & điều hướng SSO (view-only, 1 trang)

```
[Owner Profile — không có sub-tabs]
    │
    ├── Avatar → Read-only, hiển thị cached SSO avatar hoặc initials; không có local upload action
    │
    ├── Account Information Card (read-only, không editable)
    │   ├── Personal Details: Full Name · Email · Phone (mỗi ô có 🔒)
    │   └── Security & Auth: Password (••••••) · Authentication Provider: SSO
    │
    └── SSO Widget (sidebar)
        ├── "Account Managed by SSO" + mô tả đồng bộ
        └── CTA duy nhất: [ Go to SSO Portal ↗ ] → mở tab mới
```

---

## 2. Wireframe: Staff Compact Banner

*Banner nền `--background` + viền, bo `16px`. Avatar 72px (nền `--info`, viền glow). Tên + role badge inline; email ngay dưới. **Không** còn "Active Now".*

```text
┌──────────────┬──────────────────────────────────────────┐
│ 📊 Dashboard │ Account Settings                          │
│ 🌐 Webstore  │                                          │
│ 📦 Products  │ ┌─ Banner ───────────────────────────┐  │
│ 🛒 Orders    │ │ ┌────┐  Nguyen Van A   [ STAFF ]     │  │
│ ⚙️ Config    │ │ │ N📷│  staff@example.com            │  │
│              │ │ └────┘                              │  │
│              │ └─────────────────────────────────────┘  │
│              │ ...Nội dung theo Role render bên dưới... │
└──────────────┴──────────────────────────────────────────┘
```
- Staff avatar 72px · initial 30px · nút camera bo `10px` (nền `--primary`). Owner không dùng banner/upload control này.
- Role badge: pill `--primary`/10 + viền `--primary`/20, chữ 10px uppercase.
- Staff email hiển thị trong compact banner; Owner dùng Profile Card riêng tại Section 4.

---

## 3. Wireframe: Staff — Single Page (2 section card)

*Không tabs. Hai card xếp dọc, mỗi card có tiêu đề + mô tả riêng. Personal Information save bar chỉ hiện khi dirty; Password action bar luôn hiện khi form expanded. Các action bar nằm **trong** card.*

### 3.1 Card — Personal Information

```text
┌─ Personal Information ───────────────────────────────────┐
│ Your name and contact details.                           │
│                                                          │
│  First Name                    Last Name                 │
│  [ Nguyen                  ]   [ Van A               ]  │
│                                                          │
│  Phone Number                  Email Address 🔒          │
│  [ 🇲🇾 +60 ▼ ][ 123456789 ]   [ staff@…asia ] Disabled  │
│                                "Email cannot be changed   │
│                                 (Login identity)"         │
│                                                          │
│ ──────────────── (chỉ hiện khi dirty) ────────────────── │
│                          [ ↺ Cancel ]  [ ✓ Save Change ] │
└──────────────────────────────────────────────────────────┘
```

**Error state:** field lỗi đổi viền `--destructive`, helper đỏ 12px bên dưới ("First name must be 2–50 characters" / "Please enter a valid phone number").

### 3.2 Card — Password & Security (collapse mặc định)

*Mặc định thu gọn để trang ngắn/sạch — chỉ 1 dòng tóm tắt + nút outline. Click "Change Password" mới expand form 3 ô.*

```text
Collapsed (mặc định):
┌─ Password & Security ────────────────────────────────────┐
│  Password was last changed 3 months ago.  [ Change Password ]│
└──────────────────────────────────────────────────────────┘

Expanded (sau khi click):
┌─ Password & Security ────────────────────────────────────┐
│  Current Password                                        │
│  [ ●●●●●●●●                                     ] [👁]  │
│                                                          │
│  New Password                  Confirm New Password      │
│  [ ●●●●●●             ] [👁]   [ ●●●●●●         ] [👁]  │
│                                                          │
│  ✓ At least 8 characters   ✕ One uppercase   ✕ One number│
│   (✓ = teal khi đạt · ✕ = xám khi chưa đạt)              │
│                                                          │
│ ───── (luôn hiện khi expanded; Update disabled đến khi hợp lệ) ───── │
│                       [ ↺ Cancel ]  [ ✓ Update Password ]│
└──────────────────────────────────────────────────────────┘
```
- **Collapse trigger:** nút `Change Password` (Outline, height 40px). Cancel / đổi thành công / rời trang → tự thu gọn lại.
> **Lưu ý (fix vs bản cũ):** chỉ **3 rule** (≥8 / 1 hoa / 1 số) đúng theo code (`passwordBaseSchema`). **Không** Strength Meter, **không** chữ thường / ký tự đặc biệt. Ô mật khẩu **không** có icon khóa bên trái (khóa trái = hiểu nhầm disabled) — chỉ có 👁 bên phải.

---

## 4. Wireframe: Owner — Single Page (view-only)

*Layout 2 cột `2fr / 1fr`, `align-items:stretch` (2 card cao bằng nhau). **Banner trên bị ẩn** — identity gộp vào card trái. Mobile xếp dọc.*

```text
┌─ Profile Card (2/3) ──────────────────────┐  ┌─ SSO Widget (1/3) ───┐
│ ( J )  Jun Tran-02   [ OWNER ]            │  │ 🔒                    │
│ ───────────────────────────────────────── │  │ Account Managed by   │
│  EMAIL ADDRESS          PHONE NUMBER      │  │ SSO                  │
│  juntran02@yopmail.com  094448462579      │  │                      │
│                                           │  │ Your personal profile│
│  PASSWORD               AUTH PROVIDER      │  │ fields, password &   │
│  ••••••••••••           SSO               │  │ security are managed │
│                                           │  │ centrally by SSO.    │
│                                           │  │                      │
│                                           │  │ [ Go to SSO Portal ↗]│
└───────────────────────────────────────────┘  └──────────────────────┘
```
- **Card trái gộp identity + info:** avatar 72px + tên + tag OWNER trên cùng; divider (24px trên/dưới); rồi info **text thuần** dạng grid 2 cột đều — Email | Phone (hàng 1), Password | Authentication Provider (hàng 2).
- **KHÔNG dùng ô input xám, KHÔNG icon 🔒.** Nhãn nhỏ (uppercase, dim) trên — giá trị (đậm hơn) dưới → user hiểu ngay là trang "xem", không phải form điền.
- **2FA:** không hiển thị trong F23 hiện tại vì chưa có field/data contract; nếu bổ sung sẽ là requirement riêng.
- **SSO widget (phải):** full-height bằng card trái; 1 button `--info` "Go to SSO Portal ↗" neo đáy (mở tab mới). Thay cho 2 text-link rời rạc bản cũ.
- **Đã bỏ:** banner riêng ở trên, bảng "Account Info" cũ (Auth Provider / Last Login / Sessions), các ô xám + khóa.

---

## 5. Mobile Responsive (≤ 768px)

*Sidebar → Hamburger. Banner giữ hàng ngang gọn (avatar không stack vì đã nhỏ). Các card single-column. Owner: 2 cột → xếp dọc, SSO widget hết trôi (static).*

```text
📱 Staff                         📱 Owner (banner ẩn)
┌───────────────────────┐        ┌───────────────────────┐
│ ☰ PrimeWeb      [👤]  │        │ ☰ PrimeWeb      [👤]  │
├───────────────────────┤        ├───────────────────────┤
│ [ N📷 ] Nguyen· STAFF │        │ ┌ Profile Card ─────┐ │
│ staff@…asia           │        │ │ (J) Jun · OWNER   │ │
│ ┌ Personal Info ────┐ │        │ │ ───────────────   │ │
│ │ First / Last …    │ │        │ │ Email / Phone     │ │
│ │ Phone / Email 🔒   │ │        │ │ Password / SSO    │ │
│ └───────────────────┘ │        │ │ (text thuần)      │ │
│ ┌ Password & Security┐│        │ └───────────────────┘ │
│ │ [Change Password]  ││        │ ┌ SSO Widget ───────┐ │
│ │ (collapse mặc định)││        │ │ Account Managed…  │ │
│ └───────────────────┘ │        │ │ [Go to SSO ↗]     │ │
└───────────────────────┘        └───────────────────────┘
```

---

## 6. UI States & Component Summary

### 6.1 States Matrix

| Component | Default | Hover | Focus | Disabled / Read-only | Error |
|-----------|---------|-------|-------|----------------------|-------|
| Text Input | Border `#2A3645`, nền `#161E2E` | — | Border + ring **Teal `#2DD4BF`** (1px) | Nền `#1F2937`, `cursor-not-allowed`, 🔒 | Border `#EF4444` + helper đỏ |
| Primary Button (Save/Update) | Gradient **Blue→Teal** (`#3B82F6`→`#2DD4BF`), chữ trắng | Opacity 90% | ring | — | — |
| SSO CTA Button | Nền `--info` `#3B82F6`, chữ trắng, icon ↗ | Opacity 90% | — | — | — |
| Avatar Upload (Staff only) | Camera icon (nền `--primary`) | Opacity 90% | — | Spinner khi uploading | Toast error |
| Password rule | ✕ xám (chưa đạt) | — | — | — | ✓ Teal (đạt) |

### 6.2 Toast Notifications (i18n `profile.*`, EN)

| Event | Type | Message |
|-------|------|---------|
| Avatar upload success | ✅ | "Click to upload avatar" *(banner.uploadAvatar)* |
| Avatar sai định dạng | ❌ | "Avatar must be JPG or PNG" |
| Avatar quá lớn | ❌ | "Avatar must be 2MB or smaller" |
| Save info success | ✅ | "Profile updated" |
| Password update success | ✅ | "Password changed successfully" |
| Save/network fail | ❌ | "Failed to save profile" / "Network error. Please try again." |

### 6.3 Validation Rules (Zod — `src/lib/profile/schemas.ts`)

| Field | Rule | Client | Server |
|-------|------|--------|--------|
| First / Last Name | 2–50 ký tự | ✅ Inline | ✅ Reject |
| Phone | `+code` (+60/+84) + 8–15 chữ số (E.164), cho phép chỉ mã vùng | ✅ Inline | ✅ Reject |
| Avatar | MIME `image/jpeg\|png`, ≤ 2 MB | ✅ Toast | ✅ Reject |
| New Password | ≥ 8 ký tự, 1 chữ hoa, 1 chữ số | ✅ Inline + checklist | ✅ Reject |
| New Password | ≠ Current Password | ✅ Inline | ✅ Reject |
| Confirm Password | khớp New Password | ✅ Inline | — |

---

## 7. Design System Compliance

Bám [Design System](Design%20system/Design%20system.md) (dark theme tokens):

| Token | Value | Ghi chú |
|-------|-------|---------|
| Background | `#0B1120` | `--background` |
| Surface (Card) | `#161E2E` | `--card` |
| Secondary (read-only bg) | `#1F2937` | `--secondary` |
| Border / Input border | `#2A3645` | `--border` = `--input-border` (dark) |
| **Primary (Teal)** | `#2DD4BF` | badge, focus ring, password ✓, status dot |
| **Info (Blue)** | `#3B82F6` | avatar bg, SSO widget + CTA |
| Destructive | `#EF4444` | error border/helper |
| Muted text | `#9CA3AF` | label, helper, placeholder |
| Font | Inter | — |
| **Field height** | **48px** (lg) | theo *Field Height Scale* — profile = nhóm touch-priority |
| Card radius | `16px` (banner, card) · `8px` (input) · `12px` (badge/camera) | — |
| Save/Update button | radius `10px`, height `48px` | dashPrimary gradient |

> **Sửa vs bản cũ:** Primary = **Teal** (không phải Blue `#3B82F6` — blue chỉ là `--info`); Border `#2A3645` (không phải `#1F2937`); Field height **48px** (không phải 40px); bỏ token "Success `#10B981`" (không dùng ở màn này).
