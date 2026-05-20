# PRD — F19: Store Configuration & Staff Management

> **Document Status:** Draft (v1.1 — Bank Transfer settings expanded per PD-018)
> **Feature Code:** F19
> **Target Release:** Wave 6 (v1.1) · TBD (base v1.0)
> **Epic:** Store Setup & Configuration
> **Updated:** 2026-05-15
> **Decisions Log:** [PD-018](../decisions/decisions-log.md#pd-018--manual-payment-bank-transfer-verification-flow) · Issue [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004)

## 1. Context & Problem Statement
Merchants creating their stores on PrimeWeb need to establish their own brand identity and manage their internal team. The platform provides a default subdomain (e.g., `store-name.echprime.com`), but professional merchants require the ability to connect custom domains. Furthermore, Owners (Sellers) need a secure way to invite their staff to help manage the store without sharing their own credentials, requiring granular Role-Based Access Control (RBAC) trực tiếp cấu hình ở Store Settings.

## 2. Business Goals & Metrics
- **Goal:** Enable users to seamlessly connect and manage externally purchased domains.
- **Goal:** Ensure SSL is automatically provisioned for connected domains.
- **Goal:** Hỗ trợ Seller ủy quyền an toàn cho Staff thông qua việc gán Roles (Full Access và Custom Permission).
- **Metric:** % of active stores with a connected custom domain.
- **Metric:** Số lượng Staff trung bình được mời trên mỗi Workspace.

## 3. Scope
**In Scope:**
- Adding custom domain names and SSL verification.
- Setting a Primary Domain among verified domains to auto-redirect.
- Cấu hình phương thức thanh toán (Payment Settings): Tùy chọn bật/tắt COD và **Bank Transfer** (rename khỏi "QR Banking" — v1.1 per PD-018).
- **[v1.1]** Bank Transfer config block: Upload QR/STK image + bank account details (tên ngân hàng, STK, tên TK) + auto-generate `paymentReferencePrefix` per tenant (default `BT`).
- Chức năng Staff Management: Phân quyền dành cho Seller/Owner để quản lý hệ thống.
- Cấu trúc 2 Roles chính:
  1. **Full Quyền (Full Access):** Quyền tương đương Admin có thể thao tác mọi tính năng.
  2. **Custom theo tính năng:** Trực tiếp chọn/tick các module mà nhân viên được phép truy cập (Ví dụ: Cho phép vào Sản phẩm, Đơn hàng nhưng cấm truy cập Cài đặt và Blog).
- Gửi lời mời qua Email, Xem danh sách Staff, Hủy/Xóa quyền Staff.

**Out of Scope:**
- **Cấu hình Tracking & Analytics:** (GA4, Facebook Pixel, TikTok Pixel) được tách thành một module độc lập **F22**.
- Buying/Registering domains directly within PrimeWeb.
- Email hosting configuration (MX records).
- Managing subdomains of the custom domain (unless added explicitly as a separate domain).

## 4. Target Audience
- **Store Owners / Admins:** Need a non-technical, guided way to link their domains to the platform, as well as manage their internal staff permissions securely.

## 5. Functional Requirements

| Req ID | Requirement | User Story Ref |
|--------|-------------|----------------|
| REQ-F19-01 | **Add Custom Domain:** The system must allow users to input a custom domain name to attach to their store. | US-F19-01 |
| REQ-F19-02 | **DNS Guidance:** The system must display the exact A Record (IP Address) and CNAME values the user needs to set at their registrar. | US-F19-01 |
| REQ-F19-03 | **Domain Verification:** The system must provide a mechanism to check DNS propagation. If matching records are found, the domain state becomes "Connected". | US-F19-01 |
| REQ-F19-04 | **SSL Provisioning:** Once "Connected", the system must automatically provision and manage an SSL certificate for the domain. | US-F19-01 |
| REQ-F19-05 | **Primary Domain Selection:** The system must allow the user to designate one "Connected" domain (custom or default) as the Primary Domain. | US-F19-02 |
| REQ-F19-06 | **Traffic Redirection:** All traffic coming to non-primary domains attached to the store must 301 redirect to the primary domain. | US-F19-02 |
| REQ-F19-07 | **Payment Configuration:** The system must allow the user to enable/disable payment options such as COD and Bank Transfer. Multiple options can be active simultaneously. | US-F19-03 |
| REQ-F19-08 | **Bank Transfer Upload Rules:** The system MUST strictly enforce the upload of a valid QR image (size < 2MB, JPG/PNG format) before allowing Bank Transfer to be enabled. | US-F19-03 |
| **REQ-F19-08.1** | **[v1.1] Bank Transfer Details Fields:** Khi bật Bank Transfer, seller bắt buộc nhập: `bankName` (text), `bankAccountNumber` (text — validate alphanumeric), `bankAccountHolderName` (text). Optional `paymentReferencePrefix` (default `BT`, 2-4 chars uppercase). | US-F19-03 |
| **REQ-F19-08.2** | **[v1.1] Storefront Bank Transfer Visibility:** Nếu `payment_bank_transfer = false` (toggle OFF), storefront checkout KHÔNG hiển thị Bank Transfer option. Tenant settings là single source of truth (fix gap audit G-01). | US-F19-03 |
| **REQ-F19-08.3** | **[v1.1] Post-Order Upload Page Inheritance:** Buyer-facing Post-Order Upload page (F10 FR-16) read tenant Bank Transfer config (QR image, bank details, reference prefix) để render. | US-F19-03 |
| REQ-F19-09 | **Invite Staff:** Hệ thống cho phép Chủ cửa hàng (Seller/Owner) nhập Email để gửi lời mời tham gia quản lý Workspace. | US-F19-05 |
| REQ-F19-10 | **Role Assignment:** Khi mời Staff, Seller bắt buộc chọn 1 trong 2 loại quyền: `Full Access` hoặc `Custom Features` (cho phép tick chọn từng nhóm tính năng cụ thể). | US-F19-05 |
| REQ-F19-11 | **Staff Directory:** Liệt kê danh sách Staff hiện tại kèm Trạng thái (Pending / Active) và Phân quyền đang có. | US-F19-06 |
| REQ-F19-12 | **Remove Staff:** Seller có quyền Xóa (Remove) quyền truy cập của bất kỳ Staff nào trong hệ thống, ngoại trừ Owner gốc. | US-F19-06 |

## 6. Non-Functional Requirements
- **Security:** Free SSL certificates (e.g., via Let's Encrypt or similar infrastructure) must be automatically requested and renewed to ensure all checkout and store browsing is done over HTTPS.
- **Reliability:** Domain verification should accurately reflect DNS propagation. Given DNS caching, the UX should clearly indicate it might take up to 24-48 hours.
- **Performance:** 301 redirects from secondary to primary domains should happen with minimal latency, preferably at the CDN/Edge layer.

## 7. Assumptions & Constraints
- Platform architecture supports dynamic routing/ingress for any verified custom domain.
- Logic "Custom theo tính năng": Yêu cầu Payload CMS hoặc middleware Auth của Next.js hỗ trợ RBAC (Role-Based Access Control) quét tới từng route / collections. Dữ liệu của Workspace này hoàn toàn chia ly với Workspace khác.

## 8. Open Questions
- What are the exact IP addresses or CNAME targets we will provide to users for DNS routing?
- Bảng giới hạn Features: Tên chính thức của các nhóm tính năng được phép tick chọn cho role "Custom" là gì? (Ví dụ: Products, Orders, Blog, Builder, AI Editor, Settings, v.v.) Cần có danh sách cụ thể.

## 9. Screen Layout

> **[Global CMS Constraint]** Tuân thủ giao diện bên trong Main Content Area của F18 CMS Layout, sử dụng cấu trúc Settings Page chuẩn chia 2 cột: Cột trái Navigation Sub-menu (Domains, Payments, Staff), Cột phải Form Setup.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 9.1. Màn hình Tab Domain Settings
- **Mô tả:** Màn hình kết nối tên miền ngoài, kèm theo bảng hướng dẫn cấu hình DNS.
- **Components chính:**
  - Text input điền Domain. Nút "Connect Domain".
  - List danh sách Domain đang sở hữu (Hiển thị CNAME, IP, Trạng thái Verify). Nút Set Primary.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 9.2. Màn hình Tab Payment Configuration
- **Mô tả:** Nơi bật tắt các kênh thanh toán Manual (COD, Bank Transfer). Stripe Card/FPX configured qua F13 (Stripe Connect onboarding).
- **Components chính:**
  - Khối Toggle Bật/Tắt **COD**.
  - **[v1.1]** Khối Toggle Bật/Tắt **Bank Transfer** (rename khỏi "Bank Transfer / QR"). Khi expanded:
    - Upload QR image (max 2MB, JPG/PNG) với preview
    - Input `bankName` (e.g., "Maybank")
    - Input `bankAccountNumber` (e.g., "1234567890")
    - Input `bankAccountHolderName` (e.g., "Cty TNHH ABC")
    - Optional input `paymentReferencePrefix` (default `BT`, 2-4 chars uppercase) — preview: "Reference Code sẽ có dạng `BT-XXXXXX`"
  - Toggle Bank Transfer chỉ có thể bật ON khi tất cả 4 fields trên hợp lệ (QR + 3 bank details bắt buộc).
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 9.3. Màn hình Tab Staff Management
- **Mô tả:** Nơi Seller/Owner quản lý nhân viên và phân quyền truy cập.
- **Components chính:**
  - Nút [+ Invite Staff] mở Modal.
  - Cấu trúc bảng: Avatar, Email, Role Type (Full Access / Custom), Status, Nút Remove.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 9.4. Màn hình Phụ / Modals (Invite Staff & Role Picker)
- **Mô tả:** Form để Seller điền email và chọn quyền cho Staff. Nếu click vào "Custom", hệ thống hiển thị List Checkbox.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 9.5. Các trạng thái UI (UI States) & Modals
- **Loading State:** Nút "Verify Connection" quay Spinner trong khi gọi lệnh check DNS Record.
- **Empty State:** N/A (Mặc định có sẵn Free EchPrime sub-domain).
- **Error State / Edge Cases:** "Domain connection failed - DNS setup incorrectly." Chữ đỏ ở dưới List Domain. Form upload QR giới hạn Max Size báo lỗi Toast đỏ "Dung lượng bự quá".
- **Success State:** Connect SSL/Verifed thành công -> Badge hiện màu xanh lá "✓ Connected".

### 9.6. Màn hình phụ & Modals (Add Custom Domain)
- **Design / Wireframe (Add Domain Modal):**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 9.7. Mobile View (Tap-to-copy & QR Upload)
- **Mô tả:** Trải nghiệm thiết lập Domain và Payment qua Mobile, chú trọng việc copy DNS siêu nhanh và gọi native camera roll.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

