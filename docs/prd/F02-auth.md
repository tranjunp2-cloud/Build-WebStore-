# PRD: Auth Flow (F02)
> **Version:** 2.3 | **Updated:** 2026-03-23 | **Agent:** `Antigravity Copilot`
> **Priority:** P0 | **Sprint:** Wave 1 | **Size:** L
> **Depends on:** Payload CMS Users & Tenants collections, External SSO System ✅
> **Blocks:** Everything (Dashboard, Builder, Editor, Storefront)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 1. Problem Statement

Hệ thống yêu cầu luồng xác thực (Auth Flow) tích hợp kết nối với hệ thống SSO Login bên ngoài. Các tài khoản Store Owner được quản lý đăng ký tại SSO; khi khởi tạo thành công sẽ tự động đồng bộ (payload sync) để Webstore 2.0 cấp phát tài khoản và Tenant (Workspace). Đồng thời Webstore vẫn duy trì cơ chế đăng nhập/quản lý mật khẩu nội bộ cho tài khoản nhân viên (Staff). Tầng bảo mật 2FA qua Email OTP là BẮT BUỘC áp dụng cho mọi tài khoản ngay lập tức khi đăng nhập.

---

## 2. Target User

- **Owner (Quản trị viên Doanh nghiệp):** Đăng ký thông tin và xác thực đăng nhập thông qua hệ thống SSO. 
- **Staff (Nhân viên quản trị hệ thống):** Được Owner mời (Invite), sử dụng luồng đăng nhập nội bộ (Native login) của Webstore 2.0.

---

## 3. Solution Overview

- **Đồng bộ hóa tài khoản (Account Provisioning):** Webstore 2.0 tiếp nhận payload đăng ký từ SSO để tự tạo Account ID và Tenant cho Owner dựa trên các thông số định danh thiết yếu (unique properties).
- **Phân luồng Xác thực (Dual Auth Flows):** 
  - Owner: Redirect đăng nhập & đổi mật khẩu thông qua hệ thống SSO.
  - Staff: Đăng nhập & đối mật khẩu bằng form bảo mật nội bộ của Webstore 2.0.
- **Bảo mật bắt buộc (Mandatory 2FA):** Bất kể nguồn đăng nhập (SSO cho Owner hay Native cho Staff), sau bước xác nhận tài khoản mật khẩu nền tảng (pre-auth), hệ thống tự động gửi 1 Email OTP. Người dùng phải nhập đúng OTP để truy cập Dashboard.

---

## 4. Scope

### 4.1. Kiến Trúc User Roles & Cấu Trúc Khách (RBAC)
- **Owner**: Tạo và quản lý chủ chốt bởi SSO. Tự động sinh 1 Workspace duy nhất từ lúc SSO báo sang.
- **Staff**: Nhân viên được Owner mời qua Payload CMS. KHÔNG có quyền tự đăng ký. Sử dụng credential nội bộ Webstore 2.0.

### 4.2. In Scope
- Xây dựng API Webhook tiếp nhận Payload khởi tạo tài khoản từ SSO.
- Xử lý Payload thông tin bắt buộc và Unique (Duy nhất): `company_name`, `email`, `customer_id_number`, `service_id`, `first_name`, `last_name`. Xử lý lưu trữ thuộc tính gói `pack_code`.
- Tách luồng Login: Cho phép Staff nhập Email/ID, trong khi Owner sẽ có lối rẽ redirect xác thực bằng SSO.
- Bắt buộc bắt mã 2FA bằng Email OTP cho TOÀN BỘ luồng đăng nhập thành công.
- Reset / Quên mật khẩu: Điều hướng thẳng Owner sang trang reset của SSO. Tính năng Native Reset Password trên Webstore 2.0 chỉ áp dụng cho Staff.
- Auth guard & auto-routing. Logout và hủy phiên hoàn toàn.

### 4.3. Out of Scope
- Form Đăng ký (Register native) cho Owner tại giao diện Webstore 2.0 bị loại bỏ (tạm ẩn UI). Đầu vào Owner hoàn toàn lệ thuộc SSO (hệ thống dùng account admin lấy token và gọi API register ở Webstore 2.0 để khởi tạo).
- Social Logins trực tiếp.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| SSO Payload Sync processing | < 2s | API logs |
| Login → 2FA Prompt | < 2s | Timing |

---

## 6. Functional Requirements

| FR-ID | Requirement | Priority | Notes |
|-------|-------------|----------|-------|
| FR-01 | SSO Sync: Cung cấp API endpoint nội bộ lấy thông tin từ hệ thống SSO tạo Owner liên kết (Webhook / Register API). Bảo mật: SSO dùng account admin để lấy token và gọi gọi qua API này. | P0 | Server API |
| FR-02 | SSO Sync Validation: Payload gửi sang bắt buộc phải hợp lệ cho các trường sau và tất cả phải là UNIQUE trong DB: `company_name`, `email`, `customer_id_number`, `service_id`, `first_name`, `last_name`. | P0 | Reject 400 or 409 error |
| FR-03 | SSO Target Sync: Payload bắt buộc gửi kèm mã gói đăng ký `pack_code` để phân loại gói doanh nghiệp trên CMS. | P0 |
| FR-04 | Provisioning: Tự động khởi tạo Account Owner và 1 Tenant duy nhất gắn liền với thông tin SSO gửi sang. | P0 | After Hook |
| FR-05 | Login Form Switch: Tuỳ biến trang `/login`. Staff có thể đăng nhập bằng tài khoản nội bộ. Owner sẽ cần dùng tùy chọn Auth với SSO. | P0 |
| FR-06 | 2FA Mandatory: Ngay sau khi nhập mật khẩu đúng (Staff) HOẶC nhận Callback Auth thành công từ SSO (Owner), HỆ THỐNG GỬI NGAY 1 OTP 6 số qua Email. Yêu cầu nhập đúng để vào Dashboard. | P0 | Resend |
| FR-07 | Reset Password Routing: Màn đổi mật khẩu. Chỉ duy nhất STAFF mới được làm mới mật khẩu tại trang đăng nhập Webstore 2.0. | P0 | Security Check |
| FR-08 | Reset Password SSO Direct: Mọi yêu cầu đổi mật khẩu hoặc phát hiện tài khoản là Owner muốn đổi đều phải direct 100% sang link của trang web SSO login (ví dụ: `https://sso-dev.ech.primecommerce.asia/auth/forgot-password`). | P0 |
| FR-09 | Auth Guard: Tự động Redirect về `/login` nếu truy cập tài nguyên bảo mật không phép. | P0 |
| FR-10 | Logout: Xóa session và JWT nội bộ. Redirect về login. | P0 |

---

## 7. Business Rules

- **BR-01 (Single Source of Truth cho Owner):** Mọi tài khoản Owner đều trỏ về một gốc đăng ký tại SSO. Hệ thống Webstore lấy Payload làm chuẩn để sinh tài khoản tự động (Tên, Mã khách hàng, Service ID, Pack Code). Thông tin tài khoản cốt lõi của Owner khóa chéo không thể tự sửa ở Webstore.
- **BR-02 (Mandatory 2FA):** Việc bảo mật OTP qua Email là BẮT BUỘC 100% người dùng, kích hoạt NGAY LẬP TỨC khi phiên truy cập bắt đầu.
- **BR-03 (Reset Password Routing):** Owner phải và chỉ có thể đổi mật khẩu bên hệ thống SSO. Staff phải và chỉ có thể truy cập Đổi mật khẩu Native tại `/login`.
- **BR-04 (Staff Constraints):** Không ai được tự đăng ký luồng Staff. Phải do hệ thống phân quyền/mời người vào Payload CMS.
- **BR-05 (SSO Account Status):** SSO quản lý trạng thái tài khoản Owner gồm 3 trạng thái:
  - **activated** — đang hoạt động, Owner + Staff đăng nhập bình thường.
  - **inactivated** (deactivated) — bị khóa tạm thời. Workspace status = suspended. Owner + tất cả Staff thuộc workspace đó KHÔNG đăng nhập được. Có thể mở lại từ SSO.
  - **terminated** (deactivated) — gói bị xóa vĩnh viễn. Workspace status = terminated. Owner + Staff KHÔNG đăng nhập được. Website bị unpublish. Dữ liệu giữ 90 ngày. Phải tạo lại tài khoản SSO mới.
- **BR-06 (Login Block khi Workspace suspended/terminated):** Khi user (Owner hoặc Staff) cố đăng nhập mà workspace đang ở trạng thái `suspended` hoặc `terminated`, hệ thống PHẢI:
  - Block đăng nhập (không gửi OTP, không cấp session).
  - Hiển thị thông báo rõ ràng:
    - suspended: "Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ nhà cung cấp dịch vụ."
    - terminated: "Tài khoản của bạn đã bị xóa. Vui lòng liên hệ nhà cung cấp dịch vụ để tạo lại."
- **BR-07 (Staff theo workspace):** Staff bị ảnh hưởng theo trạng thái workspace, không cần khóa từng Staff riêng. Khi workspace activated lại → Staff tự động truy cập được.

---

## 8. User Flow

```text
1. Owner Provisioning (SSO Webhook Flow):
   SSO System (Create User) → Gọi POST Payload API sang Webstore 2.0 
   → Webstore Validate đủ 6 trường unique + pack_code
   → Tạo Account Owner & Tenant (status = 'active')
   → (Optional) Gửi Welcome Email có nút "Tới Webstore"

2. SSO Status Change (MỚI):
   SSO gửi status change → Webstore API cập nhật:
   - inactivated → tenants.status = 'suspended' → Owner + Staff bị block login
   - terminated → tenants.status = 'terminated' → website unpublish + block login
   - activated → tenants.status = 'active' → Owner + Staff đăng nhập được lại

3. Đăng nhập (Login) + Mandatory 2FA:
   - Truy cập `/login`.
   - Hệ thống check workspace status TRƯỚC:
     - Nếu workspace suspended → hiển thị "Tài khoản đang bị tạm khóa" → DỪNG
     - Nếu workspace terminated → hiển thị "Tài khoản đã bị xóa" → DỪNG
     - Nếu workspace active → tiếp tục luồng đăng nhập
   - [Chạy Luồng Owner]: Bấm "Đăng nhập với SSO" → Hệ thống SSO Auth → Trả về Webstore (Callback) → Trigger Gửi OTP Email → [Màn hình Xác thực OTP] → Cấp Session Cookie (Dashboard).
   - [Chạy Luồng Staff]: Điền Email/Pass nội bộ → Trigger Gửi OTP Email → [Màn hình Xác thực OTP] → Cấp Session Cookie (CMS Admin).

4. Đổi Mật Khẩu (Forgot/Reset):
   - Vào mục Quên mật khẩu.
   - Owner → Điều hướng External sang domain hệ thống SSO /reset-password (URL mẫu: `https://sso-dev.ech.primecommerce.asia/auth/forgot-password`).
   - Staff → Nhập email → Nhận link về email → Khôi phục tại Cổng Webstore 2.0.
```

---

## 9. API Contract (SSO Payload & Mapping)

Webstore 2.0 sẽ nhận cấu trúc Payload nguyên bản từ hệ thống SSO (TM Legacy) với các trường dữ liệu chi tiết. Để quá trình xử lý được gọn nhẹ, Webstore sẽ bóc tách các trường thiết yếu để khởi tạo tài khoản và đưa các thông tin còn lại vào bộ lưu trữ phụ (`meta_data`).

### 9.1 Data Payload Example (từ SSO)
```json
POST /api/v1/tm/users
Content-Type: application/json
Authorization: ********

{
    "company_name": "ECH Store 2026 v5",
    "customer_id_type": 1,
    "segment_group": "SME",
    "segment_sub_group": 1,
    "industry_code": 25,
    "brn_format": 3,
    "brn_type": 10,
    "relationship_code": 1,
    "contracting_party": 1,
    "foreign_telco": 2,
    "customer_id_number": "5320919-6794387",
    "first_name": "ECH",
    "last_name": "Store 2025",
    "preferred_language": 1,
    "telephone": "01234622081",
    "email": "testduyne8@yopmail.com",
    "address_type": 1,
    "unit_number": "18",
    "floor_number": "NA",
    "building_name": "NA",
    "street_type": 22,
    "street_name": "INDUSTRI SEBERANG 1",
    "section": "KAWASAN INDUSTRI SEBERANG TEMERLOH",
    "post_code": "72000",
    "city": "TEMERLOH",
    "state": 6,
    "country": 1,
    "existing_tm_customer": 1,
    "waiver": 2,
    "commission_to_id": "NA",
    "commission_to_name": "NA",
    "pack_code": "STARTER",
    "business_model": 1,
    "training_plan": "",
    "service_id": "NA",
    "unifi_order_id": "PC-CV17SXDUSAAAA"
}
```

### 9.2 Data Mapping Rules (SSO → Webstore)

| SSO Payload Field | Webstore Field (User/Tenant) | Ràng buộc | Mục đích sử dụng |
|-------------------|------------------------------|-----------|------------------|
| `email` | `users.email` | Bắt buộc (Unique) | Login ID, nhận thông báo 2FA |
| `first_name` | `users.firstName` | Bắt buộc | Hiển thị lời chào nội bộ |
| `last_name` | `users.lastName` | Bắt buộc | Hiển thị tài khoản |
| `telephone` | `users.phone` | Tuỳ chọn | Chăm sóc khách hàng |
| `preferred_language` | `users.prefer_lang` | Tuỳ chọn | Auto-switch ngôn ngữ (Ví dụ `1` = EN) |
| `company_name` | `tenants.companyName` | Bắt buộc | Tên Workspace/Cửa hàng |
| `customer_id_number`| `tenants.customerId` | Bắt buộc (Unique) | Đối soát (Reconciliation) dữ liệu Owner |
| `service_id` | `tenants.serviceId` | Bắt buộc (Unique) | Định danh dịch vụ gói (Reject/Báo lỗi nếu nhận giá trị "NA" hoặc rỗng) |
| `pack_code` | `tenants.packCode` | Bắt buộc | Phân loại gói doanh nghiệp (freemium/starter/standard/professional). Hiện tại tất cả gói giới hạn giống nhau — chưa có rate limits khác nhau. |
| `unifi_order_id` | `tenants.orderId` | Tuỳ chọn | Lưu log tracking mã đơn hàng |
| *(Các trường Địa chỉ)* | `tenants.address` (JSON) | Tuỳ chọn | Tham khảo cho Auto-fill Billing |

> **Quy tắc Xử lý Dữ liệu thô (Raw Data Policy):** Các thuộc tính còn lại từ SSO (như `industry_code`, `segment_group`, `brn_type`...) sẽ KHÔNG được tạo cột riêng trong Database để tránh làm phình cấu trúc. Thay vào đó, toàn bộ cục JSON payload ban đầu sẽ được serialize lưu vào 1 trường dạng JSONB gọi là `meta_data` trong Collection `Tenants` của Payload CMS. Khi có nghiệp vụ Report/Analytics phát sinh sau này, hệ thống vẫn có thể query và truy xuất ra được.

---

## 10. Open Questions (Cần PO / Tech Lead confirm)

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Xác nhận phương thức bảo mật chứng thực API kết nối giữa SSO đẩy Data Payload và Webstore 2.0 (Dùng API Key, HMAC hay OAuth Bearer)?<br><br>**Decision:** Hiện tại hệ thống chỉ dùng account admin để lấy token và request qua API register ở Webstore 2.0 (vẫn có 1 api register ở Webstore 2.0 nhưng không có giao diện, UI tạm ẩn). | Tech Lead | ✅ Resolved |
| 2 | Redirect đổi mật khẩu: Domain/URL SSO login cấp để Webstore chuyển hướng là gì?<br><br>**Decision:** URL server dev đang dùng là `https://sso-dev.ech.primecommerce.asia/auth/forgot-password`. | PO | ✅ Resolved |
| 3 | Khi Owner login SSO thành công rồi, Webstore gửi lại thêm 1 OTP mail thì có rườm rà (UX) không, vì bản thân SSO cũng có thể chặn Auth 2 lớp rồi?<br><br>**Decision:** Đây là yêu cầu bắt buộc của đối tác, không thay đổi ở thời điểm hiện tại. | BA/PO | ✅ Resolved |
