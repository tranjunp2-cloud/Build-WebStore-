# PrimeWeb — User Stories Index (P0)

> **Format:** BMAD-style Gherkin (GIVEN/WHEN/THEN)
> **ID Convention:** `US-F[FeatureNumber]-[SequenceNumber]` (e.g. `US-F01-01`, `US-F02-03`)
> **Rule:** Mỗi feature có file story riêng trong `docs/stories/`. File này là index tổng hợp.
> **Ref:** [SPEC.md §6](../SPEC.md#6-user-stories-p0) | [malaysia-market-context.md](../malaysia-market-context.md)

---

> [!IMPORTANT]
> **Stories-First Rule:** User Stories được viết TRƯỚC, PRD được viết SAU.
> Mọi Functional Requirement trong PRD PHẢI có Story ID tham chiếu.
> Không tự tạo scope mới trong PRD mà chưa có Story cover.

---

## 📋 Story Registry — P0 Stories

| Story ID | Feature | Title | File | Priority | Wave | Size | Status |
|----------|---------|-------|------|----------|------|------|--------|
| US-F01-01 | F01 AI Web Builder | AI Web Builder — Generate Site from Prompt ⭐ | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 🌟 | 3 | XL | Ready |
| US-F01-02 | F01 AI Web Builder | Store Setup — Basic Info (AI Context Collection) | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 | 1 | S | Ready |
| US-F01-03 | F01 AI Web Builder | AI Image Generation for Store | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 | 3 | L | Ready |
| US-F01-05 | F01 AI Web Builder | Conversational AI Onboarding Flow | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 | 3 | M | Ready |
| US-F01-06 | F01 AI Web Builder | Multilingual Site Output | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 | 3 | S | Ready |
| US-F01-07 | F01 AI Web Builder | Post-Generation Confirm & CMS Redirect | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 | 3 | M | Ready |
| US-F01-08 | F01 AI Web Builder | Drag-and-Drop Block Reorder in Builder Preview | [F01-ai-builder-stories.md](./F01-ai-builder-stories.md) | P0 | 3 | M | Ready |
| US-F02-01 | F02 Auth (Login / Register / Guard / Password Recovery) | Register & Welcome | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | M | Ready |
| US-F02-02 | F02 Auth (Login / Register / Guard / Password Recovery) | Login | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Ready |
| US-F02-03 | F02 Auth (Login / Register / Guard / Password Recovery) | Auth Guard — Route Protection | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Ready |
| US-F02-04 | F02 Auth (Login / Register / Guard / Password Recovery) | Logout | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | XS | Ready |
| US-F02-05 | F02 Auth (Login / Register / Guard / Password Recovery) | Forgot Password | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Ready |
| US-F02-06 | F02 Auth (Login / Register / Guard / Password Recovery) | Reset Password | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Ready |
| US-F02-07 | F02 Auth (Login / Register / Guard / Password Recovery) | Two-Factor Authentication (Email OTP) | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | M | Ready |
| US-F03-01 | F03 Dashboard Overview, Analytics & SEO | Dashboard — Overview | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P0 | 3 | M | Ready |
| US-F03-02 | F03 Dashboard Overview, Analytics & SEO | Analytics Details | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P0 | 3 | M | Ready |
| US-F03-03 | F03 Dashboard Overview, Analytics & SEO | SEO Dashboard Overview ⭐ | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P0 🌟 | 3 | L | Ready |
| US-F03-04 | F03 Dashboard Overview, Analytics & SEO | Auto SEO Meta Generation | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P0 | 3 | M | Ready |
| US-F03-05 | F03 Dashboard Overview, Analytics & SEO | AI SEO Fix All Issues | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P0 | 3 | L | Ready |
| US-F03-06 | F03 Dashboard Overview, Analytics & SEO | Basic SEO Keyword Tracker | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P1 | 3 | M | Ready |
| US-F05-01 | F05 AI Editor (Split Screen) | AI Editor — Split Screen Chat + Preview ⭐ | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 🌟 | 3 | XL | Ready |
| US-F05-02 | F05 AI Editor (Split Screen) | Page Manager | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | M | Ready |
| US-F05-03 | F05 AI Editor (Split Screen) | Inline Click-to-Edit Element | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | L | Ready |
| US-F05-04 | F05 AI Editor (Split Screen) | Add New Section via AI | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | L | Ready |
| US-F05-05 | F05 AI Editor (Split Screen) | Drag-and-Drop Block Reorder in Editor | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | M | Ready |
| US-F05-06 | F05 AI Editor (Split Screen) | Manual Visual Editing (WYSIWYG Text & Image) | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | L | Ready |
| US-F05-07 | F05 AI Editor (Split Screen) | Global Header & Footer Management | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P1 | 3 | M | Ready |
| US-F05-08 | F05 AI Editor (Split Screen) | Side Panel - Kéo Thả Drag-and-Drop Component Library | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 🌟 | 3 | XL | Ready |
| US-F05-09 | F05 AI Editor (Split Screen) | Tùy chỉnh Trang 404 (404 Not Found Page) | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P1 | 3 | M | Ready |
| US-F05-10 | F05 AI Editor (Split Screen) | Publish & Unpublish Flow (Live & Maintenance Mode) | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | M | Ready |
| US-F05-11 | F05 AI Editor (Split Screen) | Interactive Widgets (Cart & Social Media Components) | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | M | Ready |
| US-F05-12 | F05 AI Editor (Split Screen) | Global Business Info & Settings Panel | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | L | Ready |
| US-F06-01 | F06 Onboarding Flow | User Registration & Auto-Login | [F06-onboarding-stories.md](./F06-onboarding-stories.md) | P0 | 1 | S | Ready |
| US-F06-02 | F06 Onboarding Flow | Welcome Screen — Zero Friction to AI Builder | [F06-onboarding-stories.md](./F06-onboarding-stories.md) | P0 | 1 | S | Ready |
| US-F06-03 | F06 Onboarding Flow | AI Feature Discovery Wizard (CMS Welcome) | [F06-onboarding-stories.md](./F06-onboarding-stories.md) | P0 | 1 | M | Ready |
| US-F07-01 | F07 Template Gallery | Browse Templates by Category | [F07-template-gallery-stories.md](./F07-template-gallery-stories.md) | P1 | 2 | M | Draft |
| US-F07-02 | F07 Template Gallery | Preview Template Before Use | [F07-template-gallery-stories.md](./F07-template-gallery-stories.md) | P1 | 2 | M | Draft |
| US-F07-03 | F07 Template Gallery | Create Site from Template | [F07-template-gallery-stories.md](./F07-template-gallery-stories.md) | P1 | 2 | M | Draft |
| US-F08-01 | F08 Products CRUD (Dashboard) | Products CRUD + Trạng thái Sản phẩm (Active/Draft) | [F08-products-crud-stories.md](./F08-products-crud-stories.md) | P0 | 4 | L | Ready |
| US-F08-02 | F08 Products CRUD (Dashboard) | Quản lý Biến thể (Variants) & SKU Tồn kho | [F08-products-crud-stories.md](./F08-products-crud-stories.md) | P0 | 4 | XL | Ready |
| US-F08-03 | F08 Products CRUD (Dashboard) | Tự động Tối ưu Tìm kiếm (AI SEO Generation) | [F08-products-crud-stories.md](./F08-products-crud-stories.md) | P1 | 4 | M | Ready |
| US-F08-04 | F08 Products CRUD (Dashboard) | Tạo sản phẩm Hàng Loạt (Bulk Create) bằng AI & Hình ảnh mặc định | [F08-products-crud-stories.md](./F08-products-crud-stories.md) | P0 | 4 | M | Ready |
| US-F08-05 | F08 Products CRUD (Dashboard) | Quản lý Danh mục Phân cấp (Category 3-Level) | [F08-products-crud-stories.md](./F08-products-crud-stories.md) | P0 | 4 | M | Ready |
| US-F08-06 | F08 Products CRUD (Dashboard) | Thuộc tính Mở rộng (Attributes) & Giao diện Storefront | [F08-products-crud-stories.md](./F08-products-crud-stories.md) | P0 | 4 | M | Ready |
| US-F09-01 | F09 Storefront Commerce | Browse Products on Storefront | [F09-storefront-stories.md](./F09-storefront-stories.md) | P0 🌟 | 5 | M | Draft |
| US-F09-02 | F09 Storefront Commerce | Add to Cart + Cart Drawer | [F09-storefront-stories.md](./F09-storefront-stories.md) | P0 🌟 | 5 | M | Draft |
| US-F09-03 | F09 Storefront Commerce | Checkout — Purchase Flow ⭐ | [F09-storefront-stories.md](./F09-storefront-stories.md) | P0 🌟 | 5 | XL | Draft |
| US-F09-04 | F09 Storefront Commerce | Order Confirmation | [F09-storefront-stories.md](./F09-storefront-stories.md) | P0 | 5 | S | Draft |
| US-F10-01 | F10 Orders Management | Order Management & Status Updates | [F10-orders-stories.md](./F10-orders-stories.md) | P0 | 5 | L | Draft |
| US-F10-02 | F10 Orders Management | Customer Checkout with Stripe | [F10-orders-stories.md](./F10-orders-stories.md) | P0 | 5 | L | Draft |
| US-F11-01 | F11 Undo/Redo | Undo / Redo All Changes Including AI | [F11-undo-redo-stories.md](./F11-undo-redo-stories.md) | P0 | 3 | M | Draft |
| US-F12-01 | F12 Auto-Save & Draft | Auto-Save debounce 3s | [F12-auto-save-draft-stories.md](./F12-auto-save-draft-stories.md) | P0 | 3 | S | Ready |
| US-F12-02 | F12 Auto-Save & Draft | Draft Recovery | [F12-auto-save-draft-stories.md](./F12-auto-save-draft-stories.md) | P0 | 3 | M | Ready |
| US-F13-01 | F13 Payment Gateway (Malaysia) | Buy with FPX (Online Banking) | [F13-payment-gateway-stories.md](./F13-payment-gateway-stories.md) | P0 | 6 | L | Draft |
| US-F13-02 | F13 Payment Gateway (Malaysia) | Seller Payment Settings | [F13-payment-gateway-stories.md](./F13-payment-gateway-stories.md) | P0 | 6 | M | Draft |
| US-F14-01 | F14 Shipping (Malaysia) | Shipping Calculation at Checkout | [F14-shipping-stories.md](./F14-shipping-stories.md) | P0 | 6 | M | Draft |
| US-F14-02 | F14 Shipping (Malaysia) | Seller Shipping Settings | [F14-shipping-stories.md](./F14-shipping-stories.md) | P0 | 6 | M | Draft |
| US-F15-01 | F15 Admin Management | Xem tổng quan các chỉ số SaaS | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | M | Draft |
| US-F15-02 | F15 Admin Management | Quản lý danh sách và phân cấp tài khoản | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | M | Draft |
| US-F15-03 | F15 Admin Management | Đăng nhập giả lập (Impersonation) | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | M | Draft |
| US-F15-04 | F15 Admin Management | Cấu hình gói Subscription | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | L | Draft |
| US-F15-05 | F15 Admin Management | Quản lý Khuyến mãi (Promotion/Voucher) cho Subscription | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | M | Draft |
| US-F15-06 | F15 Admin Management | Theo dõi Audit Logs của hệ thống | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P2 | 4 | M | Draft |
| US-F15-07 | F15 Admin Management | Gửi In-app Broadcast & Release Notes | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P2 | 4 | M | Draft |
| US-F15-08 | F15 Admin Management | Tạo chiến dịch tự động (Automated Campaigns) | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | L | Draft |
| US-F15-09 | F15 Admin Management | Tích hợp Đa kênh (Email & Social Apps) | [F15-admin-management-stories.md](./F15-admin-management-stories.md) | P1 | 4 | M | Draft |
| US-F16-01 | F16 In-app Notification Center for Owner & Employee | Notification Center — Unread Badge | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P1 | 2 | S | Ready |
| US-F16-02 | F16 In-app Notification Center for Owner & Employee | Notification Center — Dropdown List | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P1 | 2 | M | Ready |
| US-F16-03 | F16 In-app Notification Center for Owner & Employee | Notification Center — Actionable Links | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P1 | 2 | S | Ready |
| US-F16-04 | F16 In-app Notification Center for Owner & Employee | Notification Center — Mark All as Read | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P2 | 2 | XS | Ready |
| US-F16-05 | F16 In-app Notification Center for Owner & Employee | Notification Center — Global System Broadcasts | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P2 | 2 | S | Ready |
| US-F16-06 | F16 In-app Notification Center for Owner & Employee | Notification Center — Live In-app Popup | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P1 | 2 | S | Ready |
| US-F16-07 | F16 In-app Notification Center for Owner & Employee | Notification Center — Browser Push Notifications | [F16-notification-center-stories.md](./F16-notification-center-stories.md) | P2 | 2 | M | Ready |
| US-F17-01 | F17 Blog Management | Blog Management Dashboard | [F17-blog-management-stories.md](./F17-blog-management-stories.md) | P1 | 4 | M | Ready |
| US-F17-02 | F17 Blog Management | Create & Edit Blog Post | [F17-blog-management-stories.md](./F17-blog-management-stories.md) | P1 | 4 | M | Ready |
| US-F17-03 | F17 Blog Management | AI Blog Writing Assistant (Text Only) | [F17-blog-management-stories.md](./F17-blog-management-stories.md) | P1 | 4 | M | Ready |
| US-F17-05 | F17 Blog Management | Simple Category Management | [F17-blog-management-stories.md](./F17-blog-management-stories.md) | P2 | 4 | S | Ready |
| US-F17-04 | F17 Blog Management | Publish, Draft, and Delete Posts | [F17-blog-management-stories.md](./F17-blog-management-stories.md) | P1 | 4 | S | Ready |
| US-F18-01 | F18 CMS Core Layout & Navigation | CMS Global Sidebar Navigation | [F18-cms-layout-stories.md](./F18-cms-layout-stories.md) | P0 | 1 | M | Ready |
| US-F18-02 | F18 CMS Core Layout & Navigation | CMS Global Top Header | [F18-cms-layout-stories.md](./F18-cms-layout-stories.md) | P0 | 1 | M | Ready |
| US-F18-03 | F18 CMS Core Layout & Navigation | Main Content Area Display | [F18-cms-layout-stories.md](./F18-cms-layout-stories.md) | P0 | 1 | S | Ready |
| US-F19-01 | F19 Store Configuration | Add Custom Domain | [F19-store-configuration-stories.md](./F19-store-configuration-stories.md) | P1 | 2 | M | Draft |
| US-F19-02 | F19 Store Configuration | Set Primary Domain | [F19-store-configuration-stories.md](./F19-store-configuration-stories.md) | P1 | 2 | S | Draft |

---

## 🗂️ Story Files by Feature

| Feature File | Stories Contained |
|-------------|-------------------|
| `F01-ai-builder-stories.md` | US-F01-01 |
| `F02-auth-stories.md` | US-F02-01 |
| `F03-dashboard-stories.md` | US-F03-01 |
| `F05-ai-editor-stories.md` | US-F05-01 |
| `F06-onboarding-stories.md` | US-F06-01 |
| `F07-template-gallery-stories.md` | US-F07-01 |
| `F08-products-crud-stories.md` | US-F08-01 |
| `F09-storefront-stories.md` | US-F09-01 |
| `F10-orders-stories.md` | US-F10-01 |
| `F11-undo-redo-stories.md` | US-F11-01 |
| `F12-auto-save-draft-stories.md` | US-F12-01 |
| `F13-payment-gateway-stories.md` | US-F13-01 |
| `F14-shipping-stories.md` | US-F14-01 → US-F14-02 |
| `F15-admin-management-stories.md` | US-F15-01 → US-F15-09 |
| `F16-notification-center-stories.md` | US-F16-01 → US-F16-07 |
| `F17-blog-management-stories.md` | US-F17-01 |
| `F18-cms-layout-stories.md` | US-F18-01 |
| `F19-store-configuration-stories.md` | US-F19-01 → US-F19-02 |

---

## 📖 ID Convention

```
Format:  US-F[XX]-[NN]
Example: US-F01-01

FXX = Feature number (F01 = AI Web Builder, F02 = Auth, etc.)
NN  = Story sequence number within the feature (01, 02, 03...)

KHÔNG dùng: US-001, US-AUTH-02, US-TG-001, US-10A, v.v.
```

---

## 🔗 Story Templates & Standards

- **Story Template:** [STORY_TEMPLATE.md](./STORY_TEMPLATE.md)
- **PRD Template:** [../prd/PRD_TEMPLATE.md](../prd/PRD_TEMPLATE.md)
- **Spec:** [../../SPEC.md](../../SPEC.md)
