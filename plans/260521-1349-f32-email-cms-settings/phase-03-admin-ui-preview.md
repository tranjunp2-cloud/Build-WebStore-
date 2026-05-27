# Phase 03 — Admin UI: Form + Realtime Preview

> Custom Payload admin view: split layout với form trái + HTML preview phải. Phân nhóm Buyer/Seller emails.

## Context Links

- PRD §7 (UI/UX) — layout mockup + variable hints
- Design doc: `docs/design/F32-email-cms-settings-design.md` (cần tạo separately — chưa exists)
- Payload custom views: https://payloadcms.com/docs/admin/views

## Overview

- **Priority:** P1
- **Status:** Pending
- **Depends on:** Phase 01 (collection exists)

## Key Insights

- Payload 3 hỗ trợ custom collection views qua `admin.components.views.Edit` field
- Split layout: dùng CSS grid (40/60) — tham khảo block editor view trong codebase nếu có
- Preview render: gọi same template function với fake data fixtures → đảm bảo visual parity với production
- Debounce typing 300ms để tránh re-render mỗi keystroke
- Fake data fixtures: 1 set duy nhất shared cho tất cả templates (orderNumber `#DEMO-001`, customer `John Doe`, items `["Demo Product 1", "Demo Product 2"]`, total `MYR 299.00`)

## Requirements

### Functional

- List view: collection grid với grouping Buyer/Seller (custom column hoặc tabs)
- Edit view: split 40/60 layout
  - **Left form:** template type dropdown (read-only nếu edit existing), enabled toggle, locale tabs EN/MS, 4 input fields với character counter
  - **Right preview:** iframe hoặc inline HTML render với fake data
- Preview update debounced 300ms khi user typing
- Variable hints: text dưới mỗi field liệt kê available vars (`{customerName}`, `{orderNumber}`, ...)
- Save button: optimistic UI + toast confirm + cache invalidation auto trigger

### Non-functional

- React 18 + Payload 3 admin components
- TypeScript strict
- Accessibility: form labels, keyboard nav (tab order trái → phải), aria-live cho preview updates
- No-leak: preview NOT pull real customer data — chỉ fake fixtures

## Related Code Files

**Create:**
- `src/admin/views/EmailTemplateSettings/EditView.tsx` — split layout container
- `src/admin/views/EmailTemplateSettings/PreviewPanel.tsx` — right panel iframe/render
- `src/admin/views/EmailTemplateSettings/ListView.tsx` — grouped list
- `src/admin/components/EmailFormFields.tsx` — left form (locale tabs + 4 inputs)
- `src/lib/email/preview-fixtures.ts` — fake data constants
- `src/lib/email/render-preview.ts` — server action render template với fake data

**Modify:**
- `src/collections/EmailTemplateSettings.ts` — register custom views trong `admin.components`

## Implementation Steps

1. Research Payload 3 custom view API (đọc docs hoặc existing custom view trong codebase, vd `src/admin/views/` nếu có)
2. Create `preview-fixtures.ts`:
   ```ts
   export const FAKE_ORDER = {
       orderNumber: '#DEMO-001',
       customerName: 'John Doe',
       customerEmail: 'john@example.com',
       items: [
           { productName: 'Demo Product A', quantity: 2, unitPrice: 99.50 },
           { productName: 'Demo Product B', quantity: 1, unitPrice: 100.00 },
       ],
       subtotal: 299.00, tax: 0, total: 299.00,
       currency: 'MYR',
   } as const
   ```
3. Create `render-preview.ts` server action:
   ```ts
   'use server'
   export async function renderPreview(opts: {
       templateType: string,
       recipient: 'buyer' | 'seller',
       customContent: { en, ms },
       locale: 'en' | 'ms',
   }): Promise<string> {
       // Call same template function used in production
       // Pass FAKE_ORDER + customContent → returns HTML
   }
   ```
4. Create `EmailFormFields.tsx`:
   - Locale tabs (EN active default)
   - 4 inputs với character counter
   - Variable hints dưới mỗi field
5. Create `PreviewPanel.tsx`:
   - Iframe hoặc `dangerouslySetInnerHTML` (iframe an toàn hơn — isolated CSS)
   - useEffect debounced 300ms call `renderPreview()` mỗi khi form values change
6. Create `EditView.tsx` split layout:
   ```tsx
   <div className="grid grid-cols-[40%_60%] h-screen">
       <EmailFormFields ... />
       <PreviewPanel ... />
   </div>
   ```
7. Create `ListView.tsx` grouped grid:
   - 2 tabs hoặc 2 sections: Buyer Emails / Seller Emails
   - Mỗi row hiển thị: template type, enabled badge, last updated
8. Register views trong collection:
   ```ts
   admin: {
       components: {
           views: {
               Edit: { Default: { Component: '/admin/views/EmailTemplateSettings/EditView' } },
               List: { Component: '/admin/views/EmailTemplateSettings/ListView' },
           },
       },
   }
   ```
9. Manual test:
   - Open admin → see grouped list
   - Click template → split view loads
   - Type in subject field → preview updates after 300ms
   - Switch EN/MS tab → form values + preview swap
   - Save → toast appears, list refreshes

## Todo List

- [ ] Research Payload 3 custom view registration
- [ ] Create preview-fixtures.ts
- [ ] Create render-preview server action
- [ ] Build EmailFormFields component (form left)
- [ ] Build PreviewPanel component (iframe right, debounced)
- [ ] Build EditView split layout container
- [ ] Build ListView grouped list
- [ ] Register custom views trong collection
- [ ] Manual test full flow
- [ ] Accessibility audit (keyboard nav, screen reader)

## Success Criteria

- Admin nav `Settings → Email Templates` hiển thị list grouped
- Click template → edit view split 40/60 loads
- Typing in form → preview updates 300ms sau
- EN/MS tab switching works
- Save → row update + toast feedback
- Preview HTML render khớp với production email (compare bằng cách trigger real test email)
- Accessibility: tab order logical, screen reader announces preview update

## Risk Assessment

- **Risk:** Payload 3 custom view API breaking changes
  - **Mitigation:** Pin Payload version; reference docs cho current version trước implement
- **Risk:** Preview render gọi template function với mock context có thể fail (vd missing payload instance)
  - **Mitigation:** Server action provides mock payload context; template functions phải pure (no payload dependency)
- **Risk:** Iframe CORS issues nếu serve preview HTML
  - **Mitigation:** Use `srcDoc` attribute (inline HTML) — no CORS
- **Risk:** Debounce timing too long → feels laggy; too short → preview flicker
  - **Mitigation:** 300ms is industry standard; A/B test với real seller feedback
- **Risk:** Character counter logic bypass nếu seller paste long content
  - **Mitigation:** maxLength attr + Zod validation backend + visible counter UI

## Security Considerations

- Preview render NEVER pull real customer data — assert fake fixtures only
- Iframe sandbox attribute: `sandbox="allow-same-origin"` (block scripts in preview HTML to prevent XSS through user-typed content)
- Server action validates user has `email_settings` permission + tenant scope

## Next Steps

- Unlocks Phase 04 (render integration — production email pickup config)
