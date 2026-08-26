# F23 Personal Profile — User Stories

> **Epic:** User Management & Security
> **Feature Code:** F23
> **Status:** Draft

## Feature Overview
Provides a dedicated space for all authenticated users (Store Owner, Staff) to manage their personal information and security settings (passwords, 2FA) without affecting the global Store Configuration.

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 📋 Story Index

| Story ID | Title | Status | Priority |
|----------|-------|--------|----------|
| US-F23-01 | View and Upload Avatar | Draft | P0 |
| US-F23-02 | Edit Personal Info (Staff Only) | Draft | P0 |
| US-F23-03 | Redirect to SSO (Owner Only) | Draft | P0 |
| US-F23-04 | Change Password Native (Staff Only) | Draft | P0 |

---

## 📝 User Stories

### US-F23-01: View and Upload Avatar
**As any** Authenticated User (Owner/Staff)
**I want to** view my profile and upload a custom avatar
**So that** my account feels personalized and easily identifiable in the system.

#### Acceptance Criteria
1. **Access Profile:**
   - **Given** I am logged into the CMS
   - **When** I click my Avatar in the Global Top Header and select "My Profile"
   - **Then** I am routed to the General Info tab of the Profile page.
2. **Upload Avatar (Validation):**
   - **Given** I am on the General Info tab
   - **When** I click on the Avatar image and select a file
   - **Then** the file must be strictly JPG/PNG and under 2MB. If invalid, reject and show a Toast error.
   - **And** upon successful upload, the avatar updates immediately across the CMS (Header, Staff Directory).

### US-F23-02: Edit Personal Info (Staff Only)
**As a** Staff User
**I want to** edit my basic personal information
**So that** my contact details are up to date.

#### Acceptance Criteria
1. **Readonly & Editable Fields:**
   - **Given** I am logged in as a Staff
   - **When** I view the General Info tab
   - **Then** my Email address is strictly Readonly (login identity).
   - **And** I can edit my First Name, Last Name, and Phone Number.
2. **Validation:**
   - **Given** I have modified my information
   - **When** I click "Save Changes"
   - **Then** First Name and Last Name must be 2-50 characters long.
   - **And** Phone number input must include a Country Code dropdown (e.g., +60, +84) and validate the number format based on the selected region.
   - **And** if invalid, standard Zod form validation inline errors appear. If valid, changes are saved.

### US-F23-03: Redirect to SSO (Owner Only)
**As a** Store Owner
**I want to** see which information is synced via SSO and know how to change it
**So that** I understand why I cannot edit it locally and know where to go.

#### Acceptance Criteria
1. **Readonly Fields:**
   - **Given** I am logged in as an Owner
   - **When** I view the General Info tab
   - **Then** my First Name, Last Name, Phone, and Email are Disabled (Readonly) with a lock icon.
   - **And** a tooltip explains: "Thông tin được đồng bộ bởi hệ thống SSO. Bạn không thể sửa đổi tại đây."
2. **SSO Redirect CTA:**
   - **Given** I am on the Security tab or General Info tab
   - **When** I click "Manage SSO Account"
   - **Then** a new browser tab opens, directing me to the SSO management portal.

### US-F23-04: Change Password Native (Staff Only)
**As a** Staff User
**I want to** change my login password directly within the Webstore
**So that** I can secure my account when needed.

#### Acceptance Criteria
1. **Password Form:**
   - **Given** I am logged in as a Staff
   - **When** I go to the Security tab
   - **Then** I see the fields: Current Password, New Password, Confirm New Password.
2. **Validation & Update Execution:**
   - **Given** I filled the password fields
   - **When** I click "Change Password"
   - **Then** the New Password must be at least 8 characters, containing uppercase, lowercase, number, and special character. Confirm Password must match exactly.
   - **And** if validation passes, the system securely updates my password and signs me out of all other active sessions except the current one.
