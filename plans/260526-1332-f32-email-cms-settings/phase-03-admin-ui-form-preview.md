# Phase 03 — Admin UI: List + Form + Preview

> Run AFTER Phase 04 (preview imports refactored templates + mergeTemplateConfig).
> **Design source:** `docs/design/emails-f32/` (shell.jsx, list-view.jsx, edit-view.jsx, f32.css)

## Context Links
- Design files: `docs/design/emails-f32/{shell,list-view,edit-view,f32}.jsx/css`
- Pattern: `src/app/(dashboard)/settings/payments/{layout,page,actions}.tsx` + `*Client.tsx`
- Phase 01 types.ts, Phase 02 merge helper + getTemplateConfig, Phase 04 templates
- `src/components/dashboard/Sidebar.tsx` lines 100-107

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** 2-view settings page (List → Edit). List groups by Buyer/Seller tabs, each row shows toggle + status. Edit view is split 40/60 (form left / live preview right) with locale tabs EN/MS, 4 editable fields, variable chips, char counters, dirty bar.

---

## Design Spec (from `docs/design/emails-f32/`)

### Template data (13 types, exact IDs from design)
**Buyer (8):** `order_confirmation`, `order_cancelled`, `order_delivered`, `order_failed`, `order_refunded`, `payment_reminder_bank_transfer`, `welcome`, `password_reset`
**Seller (5):** `new_order_seller`, `payment_received_seller`, `daily_sales_summary`, `contact_form_seller`, `newsletter_seller`

> Note: `order_failed`, `daily_sales_summary`, `newsletter_seller` default `enabled: false`.
> `password_reset` = critical type → no disable allowed (guard).

### Navigation (Sidebar)
```
Globals
  └ Emails  [mail icon, collapsible]
      ├ Templates  [active]  {count badge}
      ├ Logs
      └ Sender domains
```
- Add under Globals group in `src/components/dashboard/Sidebar.tsx`
- href: `/settings/email-templates`
- permissionId: `'settings'`
- Same entry in `EditorMenuDrawer.tsx`

### List View
```
Page title: "Email Templates"
Subtitle: "Customize the transactional emails your store sends to buyers and to yourself."

Tabs: [user icon] Buyer Emails (8) | [store icon] Seller Emails (5)
      Right of tabs: "{N} of {total} customized" muted text

Card:
  Section header: "{user/store icon} Buyer-facing emails  {count pill}"
  Rows (grid: 44px | 1fr | 160px | 110px | 28px):
    [icon] [name + "Customized" badge | desc] [toggle + Enabled/Disabled] [Edited Xd ago | Default] [pencil btn]

Footer tip:
  [info icon] "Tenant-scoped overrides. Disabling a template stops it from sending in your
  store only — global defaults keep serving other tenants. Reset any template to default at
  any time from the edit view."
```

**Row states:**
- Disabled row: `opacity: 0.65`, hover restores to `opacity: 1`
- "Customized" badge: `background: var(--brand-100)`, `color: var(--brand-600)`, uppercase 10px
- Toggle: 36×20px pill — Off `#cbd5e1`, On `#22c55e` (green); thumb 16×16px white

### Edit View
```
Header row:
  [← back] [template icon 44×44 radius-12] [name + "Customized" badge | meta row] [Send test btn] [Open in new tab btn]

  Meta row: "{Buyer-facing | Seller-facing}" · "Last edited {relTime}" · `tpl_{id}` monospace badge

Dirty bar (visible when form changed):
  "⚠ Unsaved changes on this template."  |  [Revert]  [Save changes ✓]

Split layout (grid: minmax(360px, 4fr) | minmax(420px, 6fr)):
  ←1100px breakpoint → stacked single column

LEFT — Form card (padding 24px):
  1. Template pill:
     [icon 32×32] [name | "{Sent to buyers | Sent to seller (you)} · {id}"] [⇅ chevrons icon]

  2. Status row (surface-2 bg, line-1 border, radius-md):
     "Sending status"
     "Live — this email is sent in production." | "Paused — no buyers will receive this email."
     [toggle + "Enabled"/"Disabled" label]

  3. Divider

  4. Content locale row:
     Label: "Content locale"
     Help: "Each locale stores its own copy. Visitors get the closest match."
     Right: [EN tab] [MS tab]  (inline pill group, surface-3 bg, active = white shadow)
     Flag icons: GB flag (EN), MY flag (MS)

  5. Fields (each: label+counter row, input/textarea, hint, var chips):
     Subject*    input    200 chars    hint: "Shown in the inbox preview. Keep it under 60 chars for mobile."
     Greeting*   textarea 2 rows  500 chars    (name-related vars only)
     CTA Label   input    100 chars    hint: "Button text. Use a strong verb — "Track Order", "Confirm", "Open Inbox"."
     Closing     textarea 3 rows  2000 chars   (brand/support/seller vars)

     Char counter colors:
       normal: var(--ink-4)
       warn (>90%): #b45309
       over (>100%): var(--danger)

     Variable chips (clickable, inserts `{varName}`):
       Pill shape, mono font 11px
       Hover: brand-50 bg + brand-600 text + brand-line border

  6. Save row (border-top):
     "Unsaved changes" | "All changes saved"  +  [✓ Save Changes] btn (disabled when !dirty)

RIGHT — Preview pane card (no padding, overflow hidden):
  Header bar (surface-2):
    ● LIVE PREVIEW  (green dot, uppercase)  |  [monitor] [smartphone] [refresh] buttons

  Canvas (bg #eef3f8, min-h 540px, max-h 720px, overflow-y auto):
    Email shell (max-width 560px desktop / 360px mobile):
      Header: gradient(135deg, #0ea5e9 → #6366f1)
        - Brand mark (logo dot + "Aurora Batik")
        - h2: subject (interpolated with demo data)
        - sub: "Order receipt · sent automatically" | "Internal notification"

      Body (padding 24px 32px):
        - Greeting (17px bold, white-space: pre-line)
        - Template-specific body (order table / delivery note / password link / etc)
        - CTA button: gradient(#0ea5e9 → #2563eb), radius 8px, shadow
        - Closing (pre-line, #475569, 13px)

      Footer: muted address + "receiving" note

  Demo data card (below canvas, left border brand):
    Order #: DEMO-001 | Customer: John Doe | Total: MYR 299.00
    Brand: Aurora Batik | Support email: help@aurora-batik.my

  Preview footer:
    "Rendered with sample data · won't be sent to real customers"
    [↺ Reset to default] link (clears config row)
```

### Variable substitution map (from design EmailPreview)
```ts
{customerName} → "John Doe"
{orderNumber}  → "DEMO-001"
{brandName}    → "Aurora Batik"
{supportEmail} → "help@aurora-batik.my"
{sellerName}   → "Siti Yusoff"
{orderTotal}   → "MYR 299.00"
{orderCount}   → "12"
{totalRevenue} → "MYR 4,180.00"
{submittedAt}  → "Mon, 18 May, 14:22"
{reviewLink}   → "https://aurora-batik.my/r/x4n"
{resetLink}    → "https://aurora-batik.my/reset/x4n"
{discountCode} → "WELCOME10"
{failureReason}→ "Card declined"
{expiresIn}    → "30 minutes"
{newSubscribers}→ "47"
{openRate}     → "34%"
```

### Field limits (from design LIMITS const)
```ts
const LIMITS = { subject: 200, greeting: 500, cta: 100, closing: 2000 }
```

---

## Architecture
```
page.tsx (server) → getEmailTemplateSettings(tenantId) → rows → EmailTemplatesClient
EmailTemplatesClient:
  state: audienceTab, selectedTemplateId, locale, draft, enabled
  List view → click row → Edit view (no page navigation, SPA-style within client)
  Edit: onChange debounce 300ms → POST /api/email-preview {templateType, locale, draftConfig}
    → EmailPreviewPane renders html in <iframe srcDoc sandbox>
  Save → server action saveEmailTemplateConfig → upsert row → invalidate cache
```

Preview API (no DB write, no send):
```
POST /api/email-preview (authed, withAuth middleware)
  body: { templateType: EmailTemplateType, locale: 'en'|'ms', draftConfig: EmailTemplateConfig }
  → validate templateType ∈ EMAIL_TEMPLATE_TYPES
  → fixture = EMAIL_PREVIEW_FIXTURES[templateType]
  → { subject, html } = templateRegistry[templateType](fixture, draftConfig)
  → return { subject, html }
```

---

## Related Code Files

**Create:**
- `src/app/(dashboard)/settings/email-templates/layout.tsx` — `requirePermission('settings')`
- `src/app/(dashboard)/settings/email-templates/page.tsx` — server: load tenant rows
- `src/app/(dashboard)/settings/email-templates/actions.ts` — get/save/reset + critical-type guard
- `src/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient.tsx` — list + edit views SPA-style
- `src/app/(dashboard)/settings/email-templates/_components/EmailPreviewPane.tsx` — iframe srcDoc + debounce
- `src/app/api/email-preview/route.ts` — POST preview render (authed)
- `src/lib/email/preview-fixtures.ts` — `EMAIL_PREVIEW_FIXTURES` per type (demo data from design)
- `src/lib/email/template-registry.ts` — map `EmailTemplateType` → template fn

**Modify:**
- `src/components/dashboard/Sidebar.tsx` — add Emails group (collapsible) with Templates subitem
- `src/components/editor/EditorMenuDrawer.tsx` — matching nav entry

---

## actions.ts contract
```ts
"use server"
export async function getEmailTemplateSettings(): Promise<{success, rows?, error?}>
export async function saveEmailTemplateConfig(input: {
  templateType: EmailTemplateType; recipient: EmailRecipient;
  enabled: boolean; contentEn: ContentFields; contentMs?: ContentFields;
}): Promise<{success, error?}>
export async function resetEmailTemplateConfig(
  templateType: EmailTemplateType, recipient: EmailRecipient
): Promise<{success, error?}>
```

Critical-type guard (server-side defense):
```ts
const CRITICAL_TYPES = ['password_reset', 'otp-verification', 'forgot-password'] as const
// Block disabling in saveEmailTemplateConfig + UI (toggle locked in edit view)
```

---

## Implementation Steps

1. Create `preview-fixtures.ts` with demo data matching design (DEMO-001, John Doe, MYR 299.00, Aurora Batik)
2. Create `template-registry.ts` mapping 13 template IDs → template fns (Phase 04 imports)
3. Create `/api/email-preview/route.ts`: auth + validate + render + return `{subject, html}`
4. Create `actions.ts`: get/save/reset with tenant scope + length validation + critical-type guard
5. Create `layout.tsx` (perm guard) + `page.tsx` (load rows)
6. Build `EmailTemplatesClient.tsx`:
   - State: `audienceTab`, `selectedId`, `locale`, `draft`, `enabled`
   - ListView component: tabs (Buyer/Seller), rows with grid layout, toggle, customized badge
   - EditView component: header bar, dirty bar, split form/preview, 4 fields + char counters + var chips
   - Locale tabs: EN/MS inline pill (flag icons)
7. Build `EmailPreviewPane.tsx`: `<iframe srcDoc={html} sandbox="allow-same-origin">` + debounce 300ms
8. Update Sidebar: add "Emails" collapsible group under Globals → Templates subitem
9. Update EditorMenuDrawer: same entry
10. `npx tsc --noEmit` + lint

---

## Todo List
- [ ] preview-fixtures.ts (demo data per 13 types)
- [ ] template-registry.ts (13 type → fn map)
- [ ] /api/email-preview route (authed, no persist, no send)
- [ ] actions.ts (get/save/reset, validation, tenant scope, critical-type guard)
- [ ] layout.tsx + page.tsx
- [ ] EmailTemplatesClient: list view (tabs + rows + toggle + badges)
- [ ] EmailTemplatesClient: edit view (header + dirty bar + split layout)
- [ ] Form fields: 4 inputs + char counters + var chips + locale tabs
- [ ] EmailPreviewPane: iframe srcDoc + debounce 300ms + desktop/mobile toggle
- [ ] Demo data card below preview
- [ ] Sidebar nav (Emails collapsible group)
- [ ] EditorMenuDrawer nav entry
- [ ] tsc + lint clean

---

## Success Criteria
- Email Templates appears in Settings sidebar under Globals → Emails → Templates
- List shows Buyer/Seller tabs with correct counts; toggle updates immediately (optimistic)
- Click row → Edit view; back → List view (no page reload)
- Editing any field updates preview within ~300ms (debounced), no DB write
- Char counter turns amber at >90%, red at >100%
- Variable chip click inserts `{varName}` at end of field value
- Save → reload → values persist scoped to tenant
- MS left empty → preview falls back to EN (fallback shown in preview)
- Critical templates (password_reset, otp-verification, forgot-password) → toggle locked ON
- Reset → clears DB row → reverts to hardcoded default template
- No real customer data in preview (only demo fixtures)

---

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Preview endpoint abused (unauth) | withAuth + enum-validate templateType |
| Email CSS leaks into dashboard | Sandboxed `<iframe srcDoc>` |
| Debounce storm | 300ms debounce + abort in-flight on new input |
| Disable critical email locks users out | CRITICAL_TYPES allowlist (UI locked + server guard) |
| Sidebar Globals group restructure breaks other nav items | Add new group entry without touching existing items |

---

## Security
- All actions scoped to `getCurrentTenantId()` — IDOR prevention
- Preview route: authed + enum-validated; no persist/send
- Sandboxed iframe prevents email CSS/script in dashboard
- Server-side block on disabling security-critical templates
