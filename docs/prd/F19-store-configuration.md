# PRD — F19: Store Configuration & Domain Management

> **Document Status:** Draft
> **Feature Code:** F19
> **Target Release:** TBD
> **Epic:** Store Setup & Configuration

## 1. Context & Problem Statement
Merchants creating their stores on PrimeWeb need to establish their own brand identity. The platform provides a default subdomain (e.g., `store-name.echprime.com`), but professional merchants require the ability to connect custom domains purchased from external registrars (GoDaddy, Namecheap, Route53, etc.). They also need the ability to manage multiple domains and designate one as the primary canonical domain for SEO purposes.

## 2. Business Goals & Metrics
- **Goal:** Enable users to seamlessly connect and manage externally purchased domains.
- **Goal:** Ensure SSL is automatically provisioned for connected domains.
- **Metric:** % of active stores with a connected custom domain.
- **Metric:** Time taken for a user to successfully verify a custom domain.

## 3. Scope
**In Scope:**
- Adding custom domain names.
- Displaying DNS configuration settings (A, CNAME records).
- Verifying domain connection via DNS checks.
- Setting a Primary Domain among verified domains.
- Auto-redirecting secondary domains to the Primary Domain (301 redirect).
- Cấu hình phương thức thanh toán (Payment Settings): Tùy chọn bật/tắt COD và QR Banking.
- Thiết lập QR Banking: Bắt buộc upload hình ảnh QR Code (< 2MB, JPG/PNG).

**Out of Scope:**
- Buying/Registering domains directly within PrimeWeb.
- Email hosting configuration (MX records).
- Managing subdomains of the custom domain (unless added explicitly as a separate domain).

## 4. Target Audience
- **Store Owners / Admins:** Need a non-technical, guided way to link their domains to the platform.

## 5. Functional Requirements

| Req ID | Requirement | User Story Ref |
|---
-----|-------------|----------------|
| REQ-F19-01 | **Add Custom Domain:** The system must allow users to input a custom domain name to attach to their store. | US-F19-01 |
| REQ-F19-02 | **DNS Guidance:** The system must display the exact A Record (IP Address) and CNAME values the user needs to set at their registrar. | US-F19-01 |
| REQ-F19-03 | **Domain Verification:** The system must provide a mechanism to check DNS propagation. If matching records are found, the domain state becomes "Connected". | US-F19-01 |
| REQ-F19-04 | **SSL Provisioning:** Once "Connected", the system must automatically provision and manage an SSL certificate for the domain. | US-F19-01 |
| REQ-F19-05 | **Primary Domain Selection:** The system must allow the user to designate one "Connected" domain (custom or default) as the Primary Domain. | US-F19-02 |
| REQ-F19-06 | **Traffic Redirection:** All traffic coming to non-primary domains attached to the store must 301 redirect to the primary domain. | US-F19-02 |
| REQ-F19-07 | **Payment Configuration:** The system must allow the user to enable/disable payment options such as COD and QR Banking. Multiple options can be active simultaneously. | US-F19-03 |
| REQ-F19-08 | **QR Banking Upload Rules:** The system MUST strictly enforce the upload of a valid QR image (size < 2MB, JPG/PNG format) before allowing QR Banking to be enabled. | US-F19-03 |

## 6. Non-Functional Requirements
- **Security:** Free SSL certificates (e.g., via Let's Encrypt or similar infrastructure) must be automatically requested and renewed to ensure all checkout and store browsing is done over HTTPS.
- **Reliability:** Domain verification should accurately reflect DNS propagation. Given DNS caching, the UX should clearly indicate it might take up to 24-48 hours.
- **Performance:** 301 redirects from secondary to primary domains should happen with minimal latency, preferably at the CDN/Edge layer.

## 7. Assumptions & Constraints
- Platform architecture supports dynamic routing/ingress for any verified custom domain.
- Users will bring domains from external providers and know how to access their DNS control panels (though the UI should provide simple copied-to-clipboard instructions).

## 8. Open Questions
- What are the exact IP addresses or CNAME targets we will provide to users for DNS routing?
- Which SSL provisioning service will be used (e.g., Caddy, Traefik, Let's Encrypt via AWS/Cloudflare)?
- Do we need an automated regular check for DNS issues (e.g., if a user later removes the A record by mistake, do we flag the domain as disconnected)?

## 9. Screen Layout

> **[Global CMS Constraint]** Tuân thủ giao diện bên trong Main Content Area của F18 CMS Layout, sử dụng cấu trúc Settings Page chuẩn chia 2 cột: Cột trái Navigation Sub-menu (Domains, Payments), Cột phải Form Setup.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 9.1. Màn hình Tab Domain Settings
- **Mô tả:** Màn hình kết nối tên miền ngoài, kèm theo bảng hướng dẫn cấu hình DNS.
- **Components chính:**
  - Text input điền Domain. Nút "Connect Domain".
  - List danh sách Domain đang sở hữu (Hiển thị CNAME, IP, Trạng thái Verify). Nút Set Primary.
- **Wireframe:**
```text
┌─ Store Settings ────────────────────────────────────────┐
│ ┌─ Navigation ──┐  ┌─ Domain Management ───────────────┐│
│ │ 🌐 Domains    │  │ [Add Custom Domain]               ││
│ │ 💳 Payments   │  │                                   ││
│ │ 🚚 Shipping   │  │ ✓ store.echprime.com (Default)    ││
│ └───────────────┘  │ --------------------------------- ││
│                    │ ⚠️ mystore.my (Primary)           ││
│                    │ Status: Pending Verification      ││
│                    │ DNS: Set A Record to 192.168.1.1  ││
│                    │ [Verify Connection]               ││
│                    └───────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 9.2. Màn hình Tab Payment Configuration
- **Mô tả:** Nơi bật tắt các kênh thanh toán Manual (COD, QR).
- **Components chính:**
  - Khối Toggle Bật/Tắt COD. 
  - Khối Toggle Bật/Tắt Bank Transfer / QR. Kèm nút Upload Ảnh QR.
- **Wireframe:**
```text
┌─ Store Settings ────────────────────────────────────────┐
│ ┌─ Navigation ──┐  ┌─ Payment Methods ─────────────────┐│
│ │ 🌐 Domains    │  │ 💳 Credit/Debit (Stripe Active)   ││
│ │ 💳 Payments   │  │ --------------------------------- ││
│ │ 🚚 Shipping   │  │ [ON] Cash on Delivery (COD)       ││
│ └───────────────┘  │ --------------------------------- ││
│                    │ [ON] Bank Transfer / DuitNow QR   ││
│                    │ Upload QR Code: [📷 Upload Image] ││
│                    │ (Max 2MB, JPG/PNG)                ││
│                    └───────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 9.3. Các trạng thái UI (UI States) & Modals
- **Loading State:** Nút "Verify Connection" quay Spinner trong khi gọi lệnh check DNS Record.
- **Empty State:** N/A (Mặc định có sẵn Free EchPrime sub-domain).
- **Error State / Edge Cases:** "Domain connection failed - DNS setup incorrectly." Chữ đỏ ở dưới List Domain. Form upload QR giới hạn Max Size báo lỗi Toast đỏ "Dung lượng bự quá".
- **Success State:** Connect SSL/Verifed thành công -> Badge hiện màu xanh lá "✓ Connected".

### 9.4. Màn hình phụ & Modals (Add Custom Domain)
- **Wireframe (Add Domain Modal):**
```text
┌─ Add Custom Domain ─────────────────────────[X]┐
│  Enter the domain name you own.                │
│                                                │
│  Domain Name:                                  │
│  [ www.myawesomestore.com.my ]                 │
│                                                │
│  💡 Make sure you have access to your          │
│     registrar (GoDaddy, Namecheap) to          │
│     update the DNS settings.                   │
│                                                │
│  [ Cancel ]                      [ Add Domain ]│
└────────────────────────────────────────────────┘
```

### 9.5. Mobile View (Tap-to-copy & QR Upload)
- **Mô tả:** Trải nghiệm thiết lập Domain và Payment qua Mobile, chú trọng việc copy DNS siêu nhanh và gọi native camera roll.
- **Wireframe:**
```text
┌─ Mobile Store Settings ───────┐
│ [☰] Settings                  │
│ ───────────────────────────── │
│ 💳 Payment Methods            │
│ [ON] Bank Transfer / QR       │
│                               │
│ Upload QR Code:               │
│ [ 📷 Select from Camera ]     │
│ ───────────────────────────── │
│ 🌐 Domain Management          │
│ mystore.my (Primary)          │
│ Status: Pending               │
│                               │
│ A Record: 192.168.1.1 [Copy]  │
│ (👆 Toast: "Copied!")          │
│                               │
│ [ Verify Connection ]         │
└────────────────────────────────────────────────┘
```
