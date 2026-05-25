# PRD — F32: Email Template Settings — CMS

> **Document Status:** Draft v1.0
> **Feature Code:** F32
> **Target Release:** TBD (post v1.0)
> **Epic:** Email Customization & Tenant Branding
> **Updated:** 2026-05-21
> **Related:** [design/F32-email-template-settings-design.md](../design/F32-email-template-settings-design.md) (admin UI design), [architecture/email-templates.md](../architecture/email-templates.md), [design/email-templates-design.md](../design/email-templates-design.md) (email content design), [plans/260521-1349-f32-email-cms-settings/](../../plans/260521-1349-f32-email-cms-settings/)
> **Origin:** PW1 (PrimeWeb v1) implemented this feature. PW2 currently has all templates hardcoded in `src/lib/email/templates/*.ts`.

## 1. Context & Problem Statement

Hiện tại PW2 có 8+ transactional email templates (welcome, OTP, order-confirmation, ...) **hardcoded** trong TypeScript files. Seller (Owner/Admin) không thể:
- Edit nội dung (subject, greeting, CTA) phù hợp với brand voice của họ
- Bật/tắt từng loại email (vd: không muốn gửi newsletter confirmation)
- Customize per-tenant trong khi hệ thống đa tenant

PW1 đã có tính năng "Email Template Setting" cho phép admin config trực tiếp trên CMS với realtime preview. PW2 cần parity feature để đạt được merchant satisfaction tương đương.

## 2. Business Goals & Metrics

- **Goal:** Cho phép Seller customize transactional emails mà không cần dev intervention
- **Goal:** Giảm support ticket về "email không match brand"
- **Goal:** Parity với PW1 feature set (migration retention)
- **Metric:** % active sellers đã customize ít nhất 1 template
- **Metric:** % active sellers đã toggle off ít nhất 1 template
- **Metric:** Time-to-customize (target: < 5 phút cho 1 template)

## 3. Scope

### MVP (Phase 1 — v1.x)

**In Scope:**
- Quản lý 16+ template types (xem `docs/architecture/email-templates.md` — 7 existing + 9 commerce planned, gồm cả `order-shipped` mới)
- Phân nhóm **Buyer-facing** vs **Seller-facing** trong UI navigation
- Toggle on/off enabled state per template (per recipient: buyer/seller variants riêng)
- Customize 4 fields per template per locale (EN + MS):
  - Email subject
  - Greeting message (vd: "Hi {customerName}")
  - CTA button label
  - Closing message (footer-area copy)
- Realtime preview: split layout (form trái, HTML preview phải) với fake demo data (orderNumber `#DEMO-001`, customer "John Doe", ...)
- Save/update — single button, optimistic update với toast confirm
- Per-tenant scoping (multi-tenant isolation)
- Fallback graceful: nếu seller không customize → dùng default hardcoded template

**Out of Scope (Phase 2 — defer):**
- Branding customization (logo upload, brand color picker, font selector) → riêng PRD bổ sung
- Full HTML/WYSIWYG editor (PW1 cũng không có, KISS decision)
- A/B testing variants
- Email analytics / open rate tracking
- Custom variable system / conditional blocks
- Per-template send test email
- Version history / rollback

### Out of Scope (forever or unlikely)

- Drag-drop email builder
- Multi-step email flow (drip campaign) — đã ngoài scope F32, có thể là feature riêng (F-marketing-automation)

## 4. Users & Roles

| Role | Can do |
|------|--------|
| **Owner (Seller)** | Full access — toggle, edit, preview tất cả templates của workspace |
| **Staff (với permission `email_settings`)** | Same as Owner nếu được granted |
| **Staff (không permission)** | Không thấy menu, redirect 403 |

## 5. Requirements

### Functional

| ID | Requirement | Story |
|----|-------------|-------|
| REQ-F32-01 | Hệ thống lưu per-tenant config cho từng template type + recipient | US-F32-01 |
| REQ-F32-02 | Owner có thể toggle enable/disable từng template; disabled → skip send silently | US-F32-02 |
| REQ-F32-03 | Owner edit 4 fields (subject, greeting, CTA, closing) per locale (EN + MS) | US-F32-03 |
| REQ-F32-04 | Admin UI hiển thị preview HTML realtime bên phải khi edit | US-F32-04 |
| REQ-F32-05 | Preview render với fake data fixtures (orderNumber, customer, items) để seller thấy kết quả thực | US-F32-04 |
| REQ-F32-06 | `sendEmail()` lookup config trước khi render; fallback default nếu không có | US-F32-05 |
| REQ-F32-07 | Multi-tenant isolation: Owner A không thể xem/edit config của Owner B | US-F32-06 |
| REQ-F32-08 | UI phân nhóm Buyer-facing / Seller-facing emails để dễ navigate | US-F32-04 |

### Non-functional

| Aspect | Requirement |
|--------|-------------|
| Performance | Lookup config phải < 50ms (cached per-tenant) |
| Security | Per-tenant access control; preview KHÔNG leak data của tenant khác |
| Accessibility | Form labels, keyboard nav, screen reader friendly |
| Mobile | Admin UI responsive ≥ 768px (CMS-only, desktop priority) |
| i18n | UI labels trong admin: EN + MS |
| Data | DB column constraints: subject ≤ 200 chars, body fields ≤ 2000 chars |

## 6. User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-F32-01 | Là Owner, tôi muốn xem danh sách tất cả email templates | Sidebar có "Email Settings", click → list theo Buyer/Seller nhóm |
| US-F32-02 | Là Owner, tôi muốn bật/tắt từng email | Toggle switch; off → email không gửi; setting persisted |
| US-F32-03 | Là Owner, tôi muốn edit nội dung email theo brand voice | 4 fields editable + tab EN/MS; placeholders cho variables |
| US-F32-04 | Là Owner, tôi muốn xem preview trước khi save | Split layout; preview update khi typing (debounced 300ms) |
| US-F32-05 | Là buyer, tôi nhận email customized của seller A | Render dùng custom config; nếu chưa customize → default template |
| US-F32-06 | Là Owner A, tôi KHÔNG thấy được config của Owner B | API filter by tenant; preview chỉ render data tenant tôi |

## 7. UI/UX

### Navigation
- Sidebar Admin Panel: `Settings → Email Templates`
- 2 tabs phân nhóm: **Buyer Emails** (8 templates) + **Seller Emails** (4 templates)

### Editor layout
```
┌──────────────────────────┬─────────────────────────────┐
│ FORM (40%)               │ PREVIEW (60%)               │
│                          │                             │
│ [Template Dropdown ▾]    │ ┌─────────────────────────┐ │
│ [● Enabled]              │ │                         │ │
│                          │ │   Email HTML rendered   │ │
│ Locale: [EN] [MS]        │ │   với fake data         │ │
│                          │ │                         │ │
│ Subject:                 │ │   - subject preview     │ │
│ [_____________________]  │ │   - greeting preview    │ │
│                          │ │   - body với demo data  │ │
│ Greeting:                │ │   - CTA button preview  │ │
│ [_____________________]  │ │   - closing preview     │ │
│                          │ │                         │ │
│ CTA Label:               │ └─────────────────────────┘ │
│ [_____________________]  │                             │
│                          │ Demo data: Order #DEMO-001  │
│ Closing:                 │ Customer: John Doe          │
│ [_____________________]  │ Total: MYR 299.00           │
│                          │                             │
│ [Save Changes]           │ [Send Test Email] (Phase 2) │
└──────────────────────────┴─────────────────────────────┘
```

### Variable hints
Mỗi field có placeholder hint hiển thị available variables (vd: `{customerName}`, `{orderNumber}`, `{total}`). KHÔNG support custom variables Phase 1.

## 8. Data Model

```ts
// Payload collection: email-template-settings
{
    id: serial,
    tenant: relationship → sites,  // 1 tenant = 1 row per (templateType, recipient)
    templateType: select [
        'welcome', 'otp-verification', 'forgot-password', 'password-changed',
        'order-confirmation', 'order-cancelled', 'order-delivered', 'order-failed',
        'order-shipped', 'payment-timeout-cancelled-buyer',
        'contact-buyer-confirmation', 'contact-seller-notification',
        'newsletter-buyer-confirmation', 'newsletter-seller-notification',
        'new-order-seller',
        // ... future-extensible
    ],
    recipient: select ['buyer', 'seller'],
    enabled: checkbox (default true),
    contentEn: group {
        subject: text (≤ 200),
        greeting: text (≤ 500),
        ctaLabel: text (≤ 100),
        closing: textarea (≤ 2000),
    },
    contentMs: group { ...same fields },
    updatedBy: relationship → users,
    createdAt, updatedAt
}
```

**Unique constraint:** `(tenant, templateType, recipient)` — 1 row per combination.

## 9. Migration & Rollout

- New table `email_template_settings` via `scripts/db-setup.js` MIGRATIONS array
- KHÔNG migrate dữ liệu từ PW1 (different schemas, manual seller re-config)
- Feature flag: rollout 100% ngay khi merge (no gradual rollout needed — opt-in feature)
- Backward compat: hardcoded templates vẫn dùng khi setting không tồn tại → safe default

## 10. Security Considerations

- ACL: Tenant scoping qua Payload `access.read/update` hooks (đã có pattern multi-tenant)
- XSS: Sanitize input HTML escape khi render preview + production email
- CSRF: Payload built-in protection
- Rate limit: Lookup cache (Redis hoặc in-memory LRU) để chống N+1 query
- No PII leak: Preview dùng fake fixtures, KHÔNG pull real customer data

## 11. Dependencies

- F19 Store Configuration (Sites collection, branding fields cho Phase 2)
- F02 Auth (Owner/Staff permission system)
- Email rollout plan `plans/260519-1549-commerce-email-rollout/` (cần merge trước để có 8 commerce templates làm baseline)

## 12. Open Questions

1. **Variable substitution syntax:** `{varName}` vs `{{varName}}` vs `${varName}`? — Đề xuất `{varName}` (simple, hiển thị tốt trong text inputs)
2. **Preview cache:** Render server-side mỗi keystroke (debounced) hay client-side với fake JS template? — Đề xuất server-side với debounce 300ms (consistency với production render)
3. **i18n locked:** Owner chỉ active 1 locale (vd MS only) → vẫn require fill EN? — Đề xuất: EN required, MS optional (fallback EN)
4. **Audit log:** Track ai đổi gì khi nào? — Đề xuất: Phase 2 (Payload có `versions: true` nếu cần)
5. **Email "shipped" template:** Phát hiện `order-shipped.ts` mới được add ở staging (chưa trong commerce roadmap). Cần thêm vào enum templateType.

## 13. Acceptance Test Plan

QA testcases sẽ chi tiết trong `docs/qa/F32-email-template-cms-settings.md` (sau khi PRD approved). Key flows:
- Toggle disable → trigger event → verify email không gửi
- Edit subject → save → trigger event → buyer nhận email với subject mới
- Multi-tenant isolation: 2 Owner accounts → mỗi người chỉ thấy config của mình
- Preview render khớp với production email
- Fallback: setting deleted → revert default template

## 14. Out-of-band Notes

- **PW1 reference:** Codebase PW1 không accessible cho v2 team — design dựa trên user-described requirements (chat session 2026-05-21)
- **Estimate:** ~2 sprints / 10-12 dev days (xem plan `260521-1349-f32-email-cms-settings/`)
