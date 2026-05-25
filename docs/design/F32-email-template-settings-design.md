# F32 — Email Template Settings (CMS) — Design

> Design spec cho **admin CMS UI** của F32: màn hình Seller customize transactional emails (toggle on/off, edit 4 fields per locale, realtime preview).
> Pair với: [`docs/prd/F32-email-template-cms-settings.md`](../prd/F32-email-template-cms-settings.md) (PRD) · [`docs/architecture/email-templates.md`](../architecture/email-templates.md) (technical index) · [`plans/260521-1349-f32-email-cms-settings/`](../../plans/260521-1349-f32-email-cms-settings/) (implementation plan).
>
> **Scope file này:** UI/UX của trang Settings (form + preview). Thiết kế **nội dung từng email** nằm ở [`email-templates-design.md`](./email-templates-design.md) — preview pane render lại các template đó với fake data.

## Design source (Claude Design)

- **Admin UI mockup:** [F32 Email Templates — Claude Design](https://claude.ai/design/p/019dd7e0-9ebb-7240-9a01-c5a1a8aa733b?file=emails-f32%2FF32%20Email%20Templates.html&present=1)
  - File: `emails-f32/F32 Email Templates.html`
  - ⚠️ Chỉ accessible cho team có workspace access (giống các Claude Design link khác trong repo).
- **Email content previews** (render trong preview pane bên phải): [`./email-templates/index.html`](./email-templates/index.html) — bundle 10 templates, xem chi tiết từng template ở [`email-templates-design.md`](./email-templates-design.md).

## Editor layout (recap PRD §7)

Split layout — form trái 40% / preview phải 60%. Chi tiết ASCII + variable hints xem [PRD §7 UI/UX](../prd/F32-email-template-cms-settings.md#7-uiux).

- **Form (40%):** Template dropdown → Enabled toggle → Locale tabs (EN/MS) → 4 inputs (Subject / Greeting / CTA Label / Closing) → Save Changes.
- **Preview (60%):** HTML email render realtime (debounced 300ms) với fake demo data — `Order #DEMO-001`, customer `John Doe`, `Total MYR 299.00`.
- **Navigation:** Sidebar `Settings → Email Templates`, 2 nhóm tab: **Buyer Emails** (8) + **Seller Emails** (4).
- **Variable hints:** mỗi field show available vars dạng `{customerName}`, `{orderNumber}`, `{total}` (no custom vars Phase 1).

## Conventions

- **Email render (preview + production):** Max width `600px`; default palette `#0d9488 → #6366f1` (teal-indigo gradient header); font `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`. Khớp với `src/lib/email/templates/welcome.ts`.
- **Status colors** (order-status variants): processing `#f59e0b` · shipped `#3b82f6` · delivered `#10b981` · cancelled `#ef4444` · failed `#dc2626`.
- **Admin UI:** dùng dashboard design system hiện có (shadcn/ui), responsive ≥ 768px (CMS desktop-priority per PRD §5).
- **Locale:** EN required, MS optional (fallback EN) — per PRD Open Question #3.
- **Demo/fake data:** static fixtures, KHÔNG pull real customer data (per PRD §10 — no PII leak).

## Handoff checklist (design → dev)

- [ ] Claude Design link accessible cho dev assignee (workspace access)
- [ ] List view: Buyer/Seller grouping + enabled badge + last-updated
- [ ] Editor: 4 fields + EN/MS tabs + variable-hint placeholders khớp PRD §7
- [ ] Preview pane: split 40/60, debounce 300ms, fake fixtures khớp `#DEMO-001`/`John Doe`/`MYR 299.00`
- [ ] Empty/disabled states (template chưa customize → hiển thị default; toggle off → visual cue)
- [ ] Responsive ≥ 768px verified; < 768px graceful (CMS desktop-first)
- [ ] Accessibility: form labels, keyboard nav, screen-reader (PRD §5 non-functional)
