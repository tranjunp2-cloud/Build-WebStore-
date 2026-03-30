# Webstore 2.0 — SSO Integration API Documentation

> **Version:** 1.0 | **Updated:** 2026-03-26
> **Prepared by:** PrimeWeb v2 Team
> **For:** TM SSO Integration Team

---

## 1. Tổng Quan

Webstore 2.0 cung cấp API endpoint để hệ thống SSO tự động khởi tạo tài khoản **Store Owner** kèm **Workspace (Tenant)**. Sau khi tạo thành công, Owner có thể đăng nhập ngay vào Webstore 2.0.

### Luồng Tích Hợp

```
┌──────────────┐         ┌──────────────────────┐
│  SSO System  │         │   Webstore 2.0 API   │
└──────┬───────┘         └──────────┬───────────┘
       │                            │
       │  Step 1: Login Admin       │
       │  POST /api/users/login     │
       ├───────────────────────────►│
       │         { token }          │
       │◄───────────────────────────┤
       │                            │
       │  Step 2: Create User       │
       │  POST /api/v1/tm/users     │
       │  Authorization: Bearer xxx │
       ├───────────────────────────►│
       │   { user, tenant }  201    │
       │◄───────────────────────────┤
       │                            │
```

---

## 2. Environments

| Environment | Base URL | Status |
|-------------|----------|--------|
| **Dev** | `https://dev.primeweb.app` | ✅ Active |
| **Staging** | `https://staging.primeweb.app` | 🔜 Coming |
| **Production** | `https://app.primeweb.app` | 🔜 Coming |

---

## 3. Authentication

### 3.1 Service Account Credentials

| Field | Value |
|-------|-------|
| Email | `sso-service@primeweb.app` |
| Password | `HxMQx_7GmmkzLJS8ssu2nK3D1Q1PHcfx` |

### 3.2 Login — Lấy Access Token

```
POST {BASE_URL}/api/users/login
Content-Type: application/json
```

**Request Body:**
```json
{
    "email": "sso-service@primeweb.app",
    "password": "HxMQx_7GmmkzLJS8ssu2nK3D1Q1PHcfx"
}
```

**Response 200 OK:**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "exp": 1711384800,
    "user": {
        "id": "6621a...",
        "email": "sso-service@primeweb.app"
    }
}
```

> **⚠️ Lưu ý:**
> - Token hết hạn sau **24 giờ**. Nên cache token và refresh khi nhận 401.
> - Field login là `email` (không phải `username` như v1).
> - Response trả `token` (không phải `access_token` như v1).

### 3.3 Env Config (phía SSO)

```env
PRIME_WEB_ADMIN_USERNAME=sso-service@primeweb.app
PRIME_WEB_ADMIN_PASSWORD=HxMQx_7GmmkzLJS8ssu2nK3D1Q1PHcfx
```

---

## 4. API — Tạo User + Workspace

### 4.1 Endpoint

```
POST {BASE_URL}/api/v1/tm/users
Content-Type: application/json
Authorization: Bearer {token}
```

### 4.2 Request Fields

| Field | Type | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `name` | string | ✅ | Họ tên đầy đủ (auto tách thành first/last name) |
| `email` | string | ✅ | Email đăng nhập (unique) |
| `password` | string | ✅ | Mật khẩu (min 5 chars) |
| `phone` | string | ❌ | Số điện thoại |
| `company_name` | string | ✅ | Tên công ty / cửa hàng |
| `subscription_code` | string | ✅ | Mã gói: `starter`, `pro`, `business` |
| `customer_id_number` | string | ❌ | Mã khách hàng (unique nếu có) |
| `service_id` | string | ❌ | Service ID (unique nếu có, reject "NA") |
| `unifi_order_id` | string | ❌ | Mã đơn hàng Unifi |

> **Ghi chú:** Toàn bộ payload gốc được lưu trữ vào trường `metaData` để truy xuất sau. Bạn có thể gửi thêm bất kỳ field nào khác, tất cả sẽ được lưu.

### 4.3 Request Body Mẫu

```json
{
    "name": "ECH Store 2025",
    "email": "testduyne8@yopmail.com",
    "password": "abc12345",
    "phone": "01234622081",
    "company_name": "ECH Store 2025",
    "subscription_code": "starter"
}
```

### 4.4 Response

**201 Created — Thành công:**
```json
{
    "message": "Provisioning successful",
    "user": {
        "id": "6621abc123...",
        "email": "testduyne8@yopmail.com"
    },
    "tenant": {
        "id": "6621def456...",
        "slug": "ech-store-2025-a3f2b1"
    }
}
```

---

## 5. Error Codes

| HTTP Status | Ý nghĩa | Response Body |
|-------------|---------|---------------|
| **400** | Thiếu field bắt buộc | `{ "message": "Missing required fields: company_name, email" }` |
| **401** | Token sai / hết hạn / không có | `{ "message": "Authorization required" }` |
| **403** | Token không có quyền admin | `{ "message": "Insufficient permissions. Super-admin role required." }` |
| **409** | Email đã tồn tại | `{ "message": "User with this email already exists" }` |
| **500** | Lỗi server | `{ "message": "Internal server error" }` |

---

## 6. So Sánh v1 vs v2

### 6.1 Thay đổi cần cập nhật

| Hạng mục | v1 (cũ) | v2 (mới) |
|----------|---------|----------|
| **Content-Type** | `application/x-www-form-urlencoded` | `application/json` |
| **Login field** | `username` | `email` |
| **Login param** | Cần `is_system` | Không cần |
| **Token field** | `access_token` | `token` |
| **Register URL** | `config('prime_web.api_url.register')` | `/api/v1/tm/users` |
| **Login URL** | `config('prime_web.api_url.login')` | `/api/users/login` |

### 6.2 Params giữ nguyên (không cần đổi)

| Field | Ghi chú |
|-------|---------|
| `name` | ✅ Giữ nguyên |
| `email` | ✅ Giữ nguyên |
| `password` | ✅ Giữ nguyên |
| `phone` | ✅ Giữ nguyên |
| `company_name` | ✅ Giữ nguyên |
| `subscription_code` | ✅ Giữ nguyên |

### 6.3 Params bỏ đi (v2 tự xử lý)

| Field | Lý do |
|-------|-------|
| `account_type` | v2 auto set `tenant-owner` |
| `expired_at` | v2 chưa quản lý subscription expiry |
| `status` | v2 auto set `active` |
| `subscription_type` | v2 chưa dùng |

---

## 7. Code Migration (PHP)

### 7.1 Login

```php
// ===== v1 (CŨ) =====
$adminToken = $this->requestToProductServiceByXForm(
    _v($config, 'login'),
    [
        'username' => env('PRIME_WEB_ADMIN_USERNAME'),
        'password' => env('PRIME_WEB_ADMIN_PASSWORD'),
        'is_system' => IS_SYSTEM,
    ]
);
$accessToken = _v(response_data($adminToken), 'access_token');

// ===== v2 (MỚI) =====
$response = Http::post(
    config('product.prime_web.api_url.login'),
    [
        'email'    => env('PRIME_WEB_ADMIN_USERNAME'),
        'password' => env('PRIME_WEB_ADMIN_PASSWORD'),
    ]
);
$accessToken = $response->json('token');
```

### 7.2 Register

```php
// ===== v1 (CŨ) =====
$params = [
    'name' => _v($profile, 'full_name'),
    'email' => _v($user, 'email'),
    'password' => $password,
    'phone' => _v($profile, 'telephone'),
    'account_type' => _v($user, 'account_type'),
    'expired_at' => $endTime,
    'status' => STATUS_ACTIVE,
    'company_name' => _v($profile, 'company_name'),
    'subscription_code' => $subscription->lower_code,
    'subscription_type' => $profile->existing_tm_customer,
];
$response = $this->requestToProductServiceByXForm(
    _v($config, 'register'), $params,
    ["Authorization: Bearer " . $accessToken]
);

// ===== v2 (MỚI) - Chỉ đổi 3 thứ =====
// 1. Bỏ params không cần
// 2. Đổi Content-Type sang JSON
// 3. Đổi endpoint
$params = [
    'name'              => _v($profile, 'full_name'),
    'email'             => _v($user, 'email'),
    'password'          => $password,
    'phone'             => _v($profile, 'telephone'),
    'company_name'      => _v($profile, 'company_name'),
    'subscription_code' => $subscription->lower_code,
];
$response = Http::withToken($accessToken)
    ->post(config('product.prime_web.api_url.register'), $params);

if ($response->status() === 201) {
    // Success
    $userData = $response->json('user');    // { id, email }
    $tenantData = $response->json('tenant'); // { id, slug }
} elseif ($response->status() === 409) {
    // Email already exists
} elseif ($response->status() === 400) {
    // Missing required fields
}
```

---

## 8. Checklist Tích Hợp

- [ ] Cập nhật `.env` với credentials service account mới
- [ ] Cập nhật `config('product.prime_web.api_url')`:
  - `login` → `/api/users/login`
  - `register` → `/api/v1/tm/users`
- [ ] Đổi `requestToProductServiceByXForm` → `Http::post` (JSON)
- [ ] Đổi login field `username` → `email`, bỏ `is_system`
- [ ] Đổi response token field `access_token` → `token`
- [ ] Bỏ params: `account_type`, `expired_at`, `status`, `subscription_type`
- [ ] Test trên môi trường Dev
- [ ] Verify user tạo xong login được vào Webstore 2.0
