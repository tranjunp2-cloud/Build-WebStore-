# PRD: Admin Management & SaaS Ops (F15)
> **Version:** 1.0 | **Created:** 2026-03-17 | **Agent:** `Antigravity BA/PO Copilot`
> **Priority:** P1 | **Sprint:** [TBD] | **Size:** XL
> **Depends on:** F02 (Auth), F13 (Payment) | **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này được xây dựng dựa trên các User Stories đề xuất tại `F13-admin-management-stories.md`.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F15-01 | Xem tổng quan các chỉ số SaaS | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-02 | Quản lý danh sách và phân cấp tài khoản | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-03 | Đăng nhập giả lập (Impersonation) | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-04 | Cấu hình gói Subscription | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-05 | Quản lý Khuyến mãi (Promotion/Voucher) | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-06 | Theo dõi Audit Logs của hệ thống | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-07 | Gửi In-app Broadcast | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-08 | Tạo chiến dịch tự động (Automated Campaigns) | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-09 | Tích hợp Đa kênh (Email & Social Apps) | [F13-admin-management-stories.md](../stories/F13-admin-management-stories.md) | Draft |
| US-F15-10 | Mobile Web UX — Responsive SaaS Dashboard | [F15-admin-management-stories.md](../stories/F15-admin-management-stories.md) | Ready |

---

## 1. Problem Statement

Khi chuyển đổi sang mô hình kinh doanh SaaS thương mại với 4 gói cước (Freemium, Starter, Standard, Professional), hệ thống thiếu một trung tâm điều hành (Super Admin Panel) dành riêng cho đội ngũ nội bộ (System Admins, Support, Sales) để quản lý tài khoản khách hàng, theo dõi sức khỏe tài chính và cấu hình các gói khuyến mãi.

---

## 2. Target User

- **Primary User**: System Admins, Super Admins, Support Staff, Sales/Marketing Staff nội bộ.
- **Technical Level**: High (Nắm rõ quy trình vận hành và nghiệp vụ SaaS).
- **Language**: Bilingual (Anh/Việt), ưu tiên Admin Panel tiếng Anh/Việt.

---

## 3. Solution Overview

Xây dựng module **Admin Management** tập trung, hoạt động độc lập với giao diện người dùng cuối (Tenant app). Module cung cấp Dashboard tổng quan các chỉ số MRR/Churn, trình quản lý phân cấp User/Workspace chi tiết, đi kèm công cụ Impersonate để hỗ trợ kỹ thuật khách hàng. Bên cạnh đó, cốt lõi kinh doanh được quản lý thông qua tính năng Cấu hình Subscription Tiers và Quản lý Promotion (Khuyến mãi) để thúc đẩy doanh thu.

---

## 4. Scope

### In Scope
- SaaS Analytics Dashboard (MRR, Active Users, Conversion Rate).
- Advanced User & Workspace Management (Có phân cấp Owner/Staff).
- Tính năng Impersonate Account (Hỗ trợ KH).
- Quản lý gói Subscription (4 Tiers) & Promo Codes.
- Dynamic Sync: Cập nhật giới hạn tính năng lên UI của Client ngay lập tức khi Admin đổi Limit.
- Automated Campaigns (Trigger based - Đăng ký, Hết hạn Trial, Abandoned Cart).
- Multi-channel Integrations (Gửi tin nhắc nhở/khuyến mãi tự động qua Email, Zalo ZNS, Facebook Messenger).
- Audit logs cơ bản cho thao tác của Admin.
- Global In-app Broadcast/Release Notes (bằng Rich Text Editor sinh động).

### Out of Scope
- Tự động thay đổi giá tiền thực trên Payment Gateway (Chỉ cấu hình tại database nội bộ, dev/ops sẽ map theo mã Plan ID trên Stripe/VNPay).
- Xây dựng hệ thống chat trực tiếp (Live Chat Customer Support) trong panel.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Admin Task Resolution Time | Xử lý yêu cầu support < 5 mins | Đo thời gian phiên Impersonate |
| Promotion Adoption | >10% user up-tier dùng code | Số lượng mã code được apply thành công |
| System Visibility | 0 critical errors bị bỏ lót | Audit log covers 100% action quan trọng |
| Security Incidents | 0 unauthorized tier changes | Audit log ghi nhận 100% lần thay đổi giá/tier đều có re-auth thành công |

---

## 6. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Admin must be able to view SaaS metrics dashboard | US-F15-01 | P1 (Mid) | |
| FR-02 | Admin must be able to list and search all workspaces/stores | US-F15-02 | P0 (High) | Blocker cho Support |
| FR-03 | Admin must be able to view user hierarchy (Owner/Staff) in a workspace | US-F15-02 | P1 (Mid) | |
| FR-04 | Admin can impersonate any workspace owner | US-F15-03 | P1 (Mid) | |
| FR-05 | Admin must be able to config limits for 4 subscription tiers | US-F15-04 | P0 (High) | |
| FR-06 | Admin must be able to create and manage promotion codes by tier | US-F15-05 | P1 (Mid) | |
| FR-07 | Admin can create automated campaigns triggered by user actions | US-F15-08 | P1 (Mid) | |
| FR-08 | System must integrate with Email/Social APIs to send campaign messages | US-F15-09 | P1 (Mid) | Requires Zalo OA / SendGrid Setup |
| FR-09 | System must log critical admin actions (Audit Log) | US-F15-06 | P2 (Low) | |
| FR-10 | Admin can create global announcements using a Rich Text Editor (Support Image/Text format) | US-F15-07 | P2 (Low) | |
| FR-11 | **[Mobile]** Layout Dashboard tự động cuộn ngang (Horizontal scroll) hoặc xếp dạng cột cho các thông số MRR, Users. | US-F15-10 | P1 (Mid) | Responsive |
| FR-12 | **[Mobile]** Các bảng dữ liệu phức tạp (Workspaces) tự động ẩn cột phụ hoặc chuyển sang dạng Cards trên viewport < 768px. | US-F15-10 | P1 (Mid) | Tránh cuộn ngang table |

---

## 7. Business Rules

- **BR-01 (Impersonation):** Khi Admin impersonate, hệ thống PHẢI có banner cảnh báo rực rỡ và mọi action thay đổi data dưới quyền KH phải được log vào Audit Log với format `[Admin_ID] act as [User_ID]`.
- **BR-02 (Promotion):** Coupon áp dụng cho gói Standard/Pro KHÔNG ĐƯỢC phép user dùng để trừ tiền các dịch vụ khác ngoài mua gói.
- **BR-03 (Tier Limit):** Không được xóa một bảng Tier nếu đang có user sử dụng tier đó. Chỉ được đổi trạng thái thành "Hidden" hoặc "Legacy".
- **BR-04 (Hierarchy):** Workspace Owner không thể bị xóa bởi Admin trừ khi Workspace đó bị xóa hoàn toàn.
- **BR-05 (Security Re-auth):** BẤT KỲ hành động nào liên quan đến **Thêm mới / Chỉnh sửa gói Subscription (Price, Limit, Feature, Name)** đều KHÔNG ĐƯỢC LƯU trừ khi Admin đã nhập lại mật khẩu thành công trong phiên làm việc hiện tại (hoặc qua cơ chế kiểm tra OTP/Password step-up auth).
- **BR-06 (Dynamic Feature Sync):** Mọi thay đổi về "Limit" (VD: Số lượng sản phẩm tối đa) của một gói cấu hình trên Admin Panel PHẢI TỰ ĐỘNG áp dụng để block/hiển thị UI tương ứng bên thiết bị của User mà không yêu cầu User phải đăng nhập/tải lại trang (có thể dùng Redis pub/sub hoặc Websocket/SSE, nếu ko thì TTL cache ngắn cho tính năng kiểm tra Limit).

---

## 10. Screen Layout

> **[Global CMS Constraint]** Đây là Super Admin Panel nội bộ (Host/Owner của hệ thống vận hành đa Tenants). Giao diện Admin này hoạt động độc lập và hoàn toàn tách biệt cấu trúc F18 CMS Layout (dành cho end-users). Ưu tiên Layout kiểu Dashboard tiêu chuẩn với Global Sidebar (Ant Design style).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 10.1. Màn hình Dashboard (Overview Metrics)
- **Mô tả:** Màn hình chào ngay khi Admin đăng nhập, theo dõi KPI SaaS.
- **Components chính:**
  - Khu vực Overview Cards: MRR, Active Workspaces, Churn Rate (Của tháng này so với tháng trước).
  - Biểu đồ Bar/Line Chart (doanh thu theo kế hoạch).
  - Nút thao tác nhanh (Quick Actions): "Broadcast message", "Add Promotion".
- **Wireframe:**
```text
┌─ Super Admin ───────────────────────────────────────────┐
│ ┌─ Sidebar ────────┐ ┌─ Dashboard ─────────────────────┐│
│ │ 📊 Overview      │ │ [MRR: $12K ↑] [Users: 15K ↑]    ││
│ │ 🏢 Workspaces    │ │                                 ││
│ │ 💳 Subscriptions │ │ ( ) MTD Revenue Chart          ││
│ │ 🎟️ Promotions    │ │                                 ││
│ │ 📢 Broadcasts    │ │ Recent Signups Table:           ││
│ │ 🛡️ Audit Logs    │ │ 1. Kopi Shop (Standard)         ││
│ └──────────────────┘ └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 10.2. Màn hình Data List (Các danh sách quản lý)
- **Mô tả:** Format chung cho các màn hình Workspaces / Promotions / Subscriptions ...
- **Components chính:**
  - Header with Actions: Nút [+ Thêm Mới Khuyến Mãi] hoặc Search Box.
  - Data Grid / Table: Hiển thị đầy đủ cột trạng thái, phân trang, có cột Action (Edit/Impersonate/Delete).
- **Wireframe (Ví dụ màn Workspaces):**
```text
┌─ Workspaces Management ─────────────────────────────┐
│  🔍 Search by ID/Email [Filter by Tier ▼]           │
│  ────────────────────────────────────────────────── │
│  ID │ Tenant Name │ Owner Email  │ Tier   │ Action  │
│  1  │ Kopi Shop   │ owner@...    │ Pro    │ [👁] [🔑]│
│  2  │ Fashion MY  │ fah@...      │ Starter│ [👁] [🔑]│
│ * Lệnh 🔑 (Impersonate) đòi Pass Admin               │
└─────────────────────────────────────────────────────┘
```

### 10.3. Các trạng thái UI (UI States) & Modals
- **Impersonating State:** Khi Admin mượn quyền user (Ấn nút 🔑), Top Global Header của ứng dụng sẽ đổi sang HỒNG RỰC hoặc CÓ BANNER ĐỎ "You are impersonating [Tenant Name] - X Tắt", để Admin ý thức được mình đang thao tác dữ liệu khách.
- **Modals:** Form tạo/sửa Subscription Tier là Sidebar Drawer lớn; Form tạo Promo Code hiển thị dạng Center Modal nhỏ; Modal Re-Authenticate Yêu cầu nhập mật khẩu bảo vệ ở những action cực nhạy cảm (Sửa giá Tier).

### 10.4. Màn hình phụ & Chuyên sâu (Sub-screens)
- **Wireframe (SaaS Subscription Tier Config Modal):**
```text
┌─ Configure Tier: [Professional] ────────────[X]┐
│                                                │
│  Biểu phí (Pricing)                            │
│  Monthly: [ $49.00 ]     Yearly: [ $490.00 ]   │
│                                                │
│  Giới hạn tĩnh (Limits)                        │
│  Max Products: [ Unlimited ]                   │
│  Max Staff Accounts: [ 10 ]                    │
│  Storage (GB): [ 50 ]                          │
│                                                │
│  Tính năng (Features Toggle)                   │
│  [✓] Priority Support                          │
│  [✓] Custom Domain                             │
│  [✓] Advanced Analytics                        │
│                                                │
│  [ Bỏ qua ]                       [ Lưu Data ] │
└────────────────────────────────────────────────┘

### 10.5. Mobile View (SaaS Dashboard & Support)
- **Mô tả:** Giao diện tối ưu cho Admin thao tác trên màn hình điện thoại (VD: Khi đi ra ngoài cần cấp quyền, support gấp).
- **Wireframe:**
```text
┌─ Super Admin (Mobile) ────────┐
│ [☰] [Logo]             [🔔] │
│ ─────────────────────────── │
│ Dashboard                   │
│ ┌─────────────────────────┐ │
│ │ MRR: $12K ↑             │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Active Users: 15K ↑     │ │
│ └─────────────────────────┘ │
│                             │
│ Recent Workspaces           │
│ ┌─────────────────────────┐ │
│ │ #1 Kopi Shop (Pro)      │ │
│ │ owner@kopi.com          │ │
│ │ [👁 View] [🔑 Impersonate]│ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ #2 Fashion MY (Starter) │ │
│ │ fah@fashion.com.my      │ │
│ │ [👁 View] [🔑 Impersonate]│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```
```

---

## 11. Open Questions (For Review)

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | **Phân quyền nội bộ Admin:** Chúng ta có cần chia nhỏ role trong nội bộ System Admin không? (Ví dụ: `Super Admin` toàn quyền, `Support Staff` chỉ được xem nhưng không được tạo Promotion?). | PO/Team | ⬜ Open |
| 2 | **Billing cycle:** Hệ thống SaaS sẽ thu phí theo chu kỳ Tháng (Monthly) hay có thêm chu kỳ Năm (Yearly)? | PO | ⬜ Open |
| 3 | **Payment Integration:** Phần Promotion Code sẽ do backend của chúng ta validate hay delegate validation cho Stripe/Payment Gateway? | Tech Lead | ⬜ Open |
| 4 | **Third-party Services (Social/Email):** Ngân sách/phân loại nhà cung cấp nào ưu tiên tích hợp trước? (VN thường dùng Zalo ZNS thay vì SMS). | PO/Tech Lead | ⬜ Open |

---

## 12. Definition of Ready (Next Steps)

- [ ] PO/Team review và chốt phạm vi tính năng (In/Out scope).
- [ ] Xác nhận các Open Questions.
- [ ] Chốt quyết định về thiết kế UI cho Admin Panel (Dùng framework có sẵn như AntD/MUI Admin hay code custom hoàn toàn?).
- [ ] Move Feature Status từ Draft -> Approved.
