# PRD: Personal Profile (F23)
> **Version:** 1.2 | **Updated:** 2026-03-26 | **Agent:** `Antigravity Copilot`
> **Priority:** P1 | **Sprint:** Wave 2 | **Size:** M
> **Depends on:** F02 Auth | **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này PHẢI được xây dựng dựa trên các User Stories đã tồn tại và được approve.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F23-01 | View and Upload Avatar | [F23-personal-profile-stories.md](../stories/F23-personal-profile-stories.md) | Draft |
| US-F23-02 | Edit Personal Info (Staff Only) | [F23-personal-profile-stories.md](../stories/F23-personal-profile-stories.md) | Draft |
| US-F23-03 | Redirect to SSO (Owner Only) | [F23-personal-profile-stories.md](../stories/F23-personal-profile-stories.md) | Draft |
| US-F23-04 | Change Password Native (Staff Only) | [F23-personal-profile-stories.md](../stories/F23-personal-profile-stories.md) | Draft |

---

## 1. Problem Statement
Sau khi đăng nhập thành công vào Hệ quản trị nội dung (CMS/Dashboard), người dùng chưa có một giao diện tập trung để quản lý các thông tin cá nhân của riêng họ (My Account / My Profile), dẫn đến sự bất tiện khi muốn cập nhật Avatar hay đổi mật khẩu nội bộ. Đồng thời, cấu trúc SSO khiến thông tin của Owner bị Read-only trên Webstore, cần UI rõ ràng để định hướng họ về SSO mà không gây bối rối.

## 2. Target User
- **Store Owner:** Muốn xem thông tin định danh của mình và nhảy sang SSO để đổi mật khẩu/thông tin.
- **Store Staff:** Muốn cá nhân hoá tài khoản (đổi Tên hiển thị, Avatar) và tự chủ động đổi mật khẩu.

## 3. Solution Overview
Cung cấp trang "Hồ sơ cá nhân" (Personal Profile) độc lập truy cập từ Avatar Header. Màn hình phân loại form thông tin thông minh: Cho phép Staff chỉnh sửa tên, số điện thoại và mật khẩu (kèm validation chặt chẽ); trong khi đó Block (Disable) Form định danh đối với Chủ cửa hàng (Owner) và hướng dẫn họ điều hướng sang cổng SSO gốc bằng CTA button chuyên biệt.

## 4. Scope

**In Scope**
- Xem và chỉnh sửa thông tin cá nhân cơ bản (Avatar, First Name, Last Name, Phone Number). Email là Readonly.
- Chức năng bảo mật tuỳ biến theo Role: Staff đổi mật khẩu Native tại chỗ; Owner được redirect sang SSO.
- Xác thực dữ liệu Form (Data Validation) chặt chẽ cho ảnh và text.

**Out of Scope**
- Cấu hình ngôn ngữ cá nhân (Đã được F18 và F21 cover, đưa switcher lên Top Header chứ không đưa vào Profile).
- Quản lý thiết bị / phiên đăng nhập đang hoạt động (Out of phase).
- Quản lý phân quyền (Staff Roles - nằm ở F19).
- Xoá tài khoản từ Webstore.

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Tỷ lệ load trang Profile | < 1s | API latency theo dõi |
| Lỗi dữ liệu update Profile | 0% | Server logs chặn bad validation |

## 6. User Story Summary

```
AS A Authenticated User (Owner/Staff)
I WANT TO quản lý thông tin tài khoản và bảo mật
SO THAT thông tin tài khoản luôn chính xác và an toàn.
```
> Source Story: [US-F23-01](../stories/F23-personal-profile-stories.md#us-f23-01)

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | **Upload Avatar:** Có thể upload JPG/PNG (< 2MB). Crop 1:1. | US-F23-01 | P0 | Zod File Validation |
| FR-02 | **Edit Info (Staff):** Staff sửa Name và Phone (kèm dropdown chọn mã quốc gia). Email là Readonly. | US-F23-02 | P0 | Zod Form Validation |
| FR-03 | **Info Blocked (Owner):** Form Tên, Số điện thoại của Owner rơi vào trạng thái Disabled. | US-F23-03 | P0 | Tooltip giải thích SSO |
| FR-04 | **SSO Redirection:** Provide "Manage SSO Account" external portal link. | US-F23-03 | P0 | Owner Security Tab |
| FR-05 | **Staff Password:** Form checks Current, New, Confirm (min 8 chars, strong rules). | US-F23-04 | P0 | Staff Security Tab |

## 8. Business Rules

- **BR-23-01 (Single Source of Truth - Owner):** Các thuộc tính Identity (First Name, Last Name, Email, Phone) của Owner bị khoá (Read-only) để đảm bảo đồng nhất với SSO. Còn đối với Staff, vì là tài khoản nội bộ (Local) tạo từ F19 nên Staff có quyền sửa Tên và Số điện thoại, nhưng Email (Login ID) vẫn khoá cứng. Webstore KHÔNG ghi đè data của Owner từ Profile Page về SSO.
- **BR-23-02 (Avatar Independence):** Ảnh Avatar là entity do Webstore quản lý độc lập để tối ưu truyền tải, KHÔNG cần sync từ/đến SSO.
- **BR-23-03 (Validation Enforcement):** Toàn bộ Form Edit Info và Change Password bắt buộc phải được Validate ở cả Client-side (nhằm hiển thị inline error field) và Server-side (nhằm phòng chống spam API lọt data xấu).

## 9. User Flow

```
[CMS Dashboard - Click Avatar dropdown]
   ↓ 
Click "My Profile"
   ↓
[Profile Interface Load]
   ├── Action Staff: Nhập Name/Phone/Password → Invalid (Quá ngắn, format sai) → Báo lỗi Inline đỏ
   ├── Action Staff: Edit Names/Phone & Save hợp lệ → Success Toast
   └── Action Owner: See Locked Names → Click [Manage account in SSO] → Outer SSO Tab opens
```

## 10. Screen Layout

> **[Global CMS Constraint]** Tuân thủ F18. Render trong Main Content Area.

### 10.1 Màn hình Thẻ "General Info"
- **Mô tả:** Chỉnh sửa ảnh đại diện và tên họ.
- **Components:** Banner & Avatar component. FormGroup gồm Name, Phone, Email.
- **State Logic (Role):** Email luôn bị Disable cho mọi Role. Với Owner, Disable thêm ô First Name, Last Name và Phone. Với Staff, Enable ô nhập Name và Phone (đi kèm Component chọn mã vùng Country Code).
- **Validation State:** Viền đỏ quanh TextBox + Helper Text đỏ bên dưới mô tả lỗi Zod Schema (VD: "Mật khẩu quá ngắn").

### 10.2 Màn hình Thẻ "Security"
- **Mô tả:** Đổi mật khẩu nội bộ.
- **Components (Staff):** Form nhập Password (Old, New, Confirm New). Nút Submit "Update Password".
- **Components (Owner):** Box thông báo SSO Guard + CTA external link button "Manage SSO...".

## 11. Acceptance Criteria

> Các AC dưới đây được copy trực tiếp từ `docs/stories/F23-personal-profile-stories.md`.

### AC-1: Upload Avatar Validation
> 📌 Source: [US-F23-01](../stories/F23-personal-profile-stories.md) — AC-2

```gherkin
GIVEN I am on the General Info tab
WHEN I click on the Avatar image and select a file
THEN the file must be strictly JPG/PNG and under 2MB. If invalid, reject and show a Toast error.
   AND upon successful upload, the avatar updates immediately.
```

### AC-2: Edit Info Validation (Staff Only)
> 📌 Source: [US-F23-02](../stories/F23-personal-profile-stories.md) — AC-2

```gherkin
GIVEN I have modified my information
WHEN I click "Save Changes"
THEN First Name and Last Name must be 2-50 characters long.
   AND Phone number input must include a Country Code dropdown (e.g., +60, +84) and validate the number format based on the selected region.
   AND if invalid, standard Zod form validation inline errors appear. If valid, changes are saved.
```

### AC-3: Change Password Native Validation (Staff Only)
> 📌 Source: [US-F23-04](../stories/F23-personal-profile-stories.md) — AC-2

```gherkin
GIVEN I filled the password fields
WHEN I click "Change Password"
THEN the New Password must be at least 8 characters, containing uppercase, lowercase, number, and special character. Confirm Password must match exactly.
   AND if validation passes, the system securely updates my password.
```

## 12. Non-Functional Requirements & Data Validation

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Data Validation** | First Name / Last Name: 2-50 chars, no special scripts. | |
| **Data Validation** | Phone Number: Dropdown chọn mã vùng quốc gia (+60, +84). Regex matching chính xác theo cấu trúc độ dài của quốc gia đó. | |
| **Data Validation** | Password: >= 8 chars, 1 Upper, 1 Lower, 1 Number, 1 Special. | |
| **Data Validation** | Avatar Image: MIME Type `image/jpeg` `image/png`, Size <= 2048 KB. | |

## 13. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | URL của SSO management route để inject vào nút CTA dành cho Owner chính xác là path nào (`/manage-account` hay `/settings`)? | PO | ⬜ Open |

## 14. Definition of Ready

- [x] User Stories approved và linked ở Section 0
- [x] AC ở Section 11 đã được copy từ story file
- [x] FR ở Section 7 có đầy đủ Story Ref
- [x] Business Rules confirmed với PO
- [x] Validation constraints explicitly identified
- [ ] Open Questions resolved
