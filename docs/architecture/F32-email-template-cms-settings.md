# Architecture: Email Template CMS Settings — F32

> **Version:** 1.0 | **Created:** 2026-05-26 | **Agent:** `docs-manager`
> **PRD:** [`docs/prd/F32-email-template-cms-settings.md`](../prd/F32-email-template-cms-settings.md)
> **QA:** [`docs/qa/F32-email-template-cms-settings.md`](../qa/F32-email-template-cms-settings.md)
> **Status:** Shipped
> **Scope:** Per-tenant customization of 15 transactional email templates; enable/disable with critical-type protection; Redis cache (TTL 300s)

---

## 1. Overview

F32 enables sellers to customize transactional emails (subject, greeting, CTA label, closing) per-tenant via a new Payload collection (`email-template-settings`). Features:

- **15 email template types** (otp-verification, forgot-password, password-changed, order-confirmation, shipment-notification, refund-processed, contact-confirmation, subscription-created, subscription-canceled, review-notification, product-restock, discount-alert, feature-announcement, welcome, generic)
- **4 content fields per template** (subject, greeting, ctaLabel, closing) in 2 languages (English, Malay)
- **Enable/disable toggle** with critical-type guard (otp-verification, forgot-password, password-changed cannot be disabled)
- **Redis cache** (Upstash) with 300s TTL for config lookups
- **Real-time preview** via `/api/email-preview` (sandboxed iframe, no DB write/send)
- **Multi-tenant scoping** — tenant members see/edit only their config
- **Backward compatible** — no config row = template renders with hardcoded defaults

---

## 2. System Context

```
┌──────────────────────────────────────────────────────────────┐
│ Seller Dashboard                                             │
│  └── Settings → Email Templates                              │
│      └── EmailTemplatesClient (React page + form)            │
└──────────────────┬──────────────────────────────────────────┘
                   │ GET /api/email-templates?tenantId=X (fetch)
                   │ POST /api/email-templates/save (CMS override)
                   │ POST /api/email-templates/reset (restore defaults)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js API Routes                                            │
│  ├── src/app/(dashboard)/settings/email-templates/_actions   │
│  │   └── Payload CRUD (create/update/delete + cache clear)   │
│  ├── POST /api/email-preview (preview only, no persist)      │
│  └── Server actions: saveEmailTemplateConfig, etc.           │
└──────────────────┬──────────────────────────────────────────┘
                   │ cached via Upstash Redis
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Email Lib (Configuration Lookup + Variable Substitution)     │
│  ├── getTemplateConfig() — cache + DB lookup                 │
│  ├── mergeTemplateConfig() — override defaults               │
│  ├── applyVariables() — token substitution + HTML escape     │
│  └── invalidateTemplateConfigCache() — on config change      │
└──────────────────┬──────────────────────────────────────────┘
                   │ reads/writes
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ Email Send Flow                                              │
│  └── sendEmail({ to, subject, html, templateType,           │
│                   recipient, tenantId, config? })            │
│      ├── if config.enabled === false → skip send (return false)
│      └── else → payload.sendEmail()                          │
└──────────────────────────────────────────────────────────────┘
                   │ backed by AWS SES via Payload SMTP
                   ▼
┌──────────────────────────────────────────────────────────────┐
│ External: AWS SES, Upstash Redis, PostgreSQL (Neon)         │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### EmailTemplateSettings Collection

**Slug:** `email-template-settings`

**Fields:**

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | serial primary key | auto | — |
| `tenant` | FK (Tenants) | required, indexed | Multi-tenant scoping |
| `templateType` | enum | required, 15 values | Email type identifier |
| `recipient` | enum | required, 2 values (customer, admin) | Recipient class |
| `enabled` | boolean | default: true | Send toggle |
| `contentEn` | group | required | English content (subject, greeting, ctaLabel, closing) |
| `contentMs` | group | required | Malay content (same structure) |
| `updatedBy` | FK (Users) | nullable | Audit trail |
| `createdAt` | timestamp | auto | — |
| `updatedAt` | timestamp | auto | — |

**Unique Index:** `UNIQUE(tenant, templateType, recipient)` — one config per (tenant, type, recipient).

**Access Control:**
- Tenant members (role: seller/admin/owner) can CRUD their own tenant's config only
- Super-admin can CRUD any tenant's config
- Read requires `tenantId` in query or session context

**Hooks:**
- `afterChange` → calls `invalidateTemplateConfigCache(tenantId, type, recipient)` to clear Redis
- `afterDelete` → same cache invalidation

---

## 4. Email Template Types & Recipients

### Template Types (15)

```typescript
type EmailTemplateType =
  | 'otp-verification'
  | 'forgot-password'
  | 'password-changed'
  | 'order-confirmation'
  | 'shipment-notification'
  | 'refund-processed'
  | 'contact-confirmation'
  | 'subscription-created'
  | 'subscription-canceled'
  | 'review-notification'
  | 'product-restock'
  | 'discount-alert'
  | 'feature-announcement'
  | 'welcome'
  | 'generic';
```

### Recipients (2)

```typescript
type EmailRecipient = 'customer' | 'admin';
```

### Critical Types (Cannot be disabled)

```
CRITICAL_TYPES = ['otp-verification', 'forgot-password', 'password-changed'];
```

Attempting to disable a critical type returns 400 Bad Request: "Critical email types cannot be disabled."

---

## 5. Cache Strategy

### Cache Layer: Upstash Redis

**Singleton import:**
```typescript
import { redis } from '@/lib/redis';
```

**Cache key format:**
```
email_config:{tenantId}:{templateType}:{recipient}
```

**TTL:** 300 seconds (5 minutes)

**No-Redis fallback:** If Redis unavailable, log warning and proceed with DB-only (no crash).

### getTemplateConfig() Flow

```
1. Key = templateConfigCacheKey(tenantId, type, recipient)
2. Try redis.get(key)
   ├─ HIT → return cached config + stop
   └─ MISS or error
3. Try payload.find({ tenant: tenantId, templateType: type, recipient })
   ├─ HIT → cache result with redis.set(key, config, ex: 300) → return
   └─ MISS → return null (do not cache null)
4. Return config or null
```

### Invalidation

On `email-template-settings` create/update/delete:
- Call `invalidateTemplateConfigCache(tenantId, type, recipient)`
- Deletes the Redis key

---

## 6. Variable Substitution & Merge

### applyVariables(template: string, vars: Record<string, string>): string

Replaces `{token}` placeholders in template with values from `vars` dict.

**Behavior:**
- Unknown tokens left intact: `"Hello {firstName}, {unknownVar}"` with `vars = { firstName: "John" }` → `"Hello John, {unknownVar}"`
- HTML escaping: all substituted values are HTML-escaped (`<` → `&lt;`, `&` → `&amp;`, `"` → `&quot;`, `'` → `&#x27;`, `>` → `&gt;`)
- Undefined input: if template is undefined, return undefined

**Example:**
```typescript
applyVariables(
  "Hello {customerName}, your order {orderNumber} is confirmed.",
  { customerName: "Alice <xss>", orderNumber: "#123" }
)
// Returns: "Hello Alice &lt;xss&gt;, your order #123 is confirmed."
```

### mergeTemplateConfig(override: EmailTemplateConfig | null, defaults: EmailTemplateConfig): EmailTemplateConfig

Merges override config with defaults.

**Rules:**
- If `override` is null → return defaults
- If override field is non-empty string → use override value
- If override field is empty string or undefined → use default value

**Example:**
```typescript
mergeTemplateConfig(
  { subject: "Welcome!", greeting: "", ctaLabel: "Shop Now", closing: undefined },
  { subject: "Hi", greeting: "Hello", ctaLabel: "View", closing: "Thanks" }
)
// Returns: {
//   subject: "Welcome!",
//   greeting: "Hello",
//   ctaLabel: "Shop Now",
//   closing: "Thanks"
// }
```

---

## 7. Send Integration

### sendEmail() Extension

Extended `src/lib/email/send.ts` signature:

```typescript
sendEmail({
  to: string;
  subject: string;
  html: string;
  templateType?: EmailTemplateType;
  recipient?: EmailRecipient;
  tenantId?: string;
  config?: EmailTemplateConfig;
}): Promise<boolean | { messageId: string }>
```

**Logic:**
1. If `config?.enabled === false` → return false (skip send)
2. If config not provided and templateType/tenantId supplied:
   - Call `getTemplateConfig(tenantId, templateType, recipient)` to fetch from cache/DB
3. Apply merge + variable substitution if config present
4. Call `payload.sendEmail({ to, subject, html })`
5. Return result

**Backward compatibility:** Omitting templateType/config sends email as-is (pre-F32 behavior).

---

## 8. Dashboard Settings Page

### Route

`src/app/(dashboard)/settings/email-templates/`

**Access:** Authenticated tenant members only (seller, admin, owner roles).

### Components

```
EmailTemplatesPage (RSC)
└── EmailTemplatesClient (Client)
    ├── EmailTemplateListView
    │   └── Template type buttons (otp, forgot-pwd, welcome, ...)
    ├── EmailTemplateEditView
    │   ├── EmailTemplateFormCard (language tabs: EN / MS)
    │   │   ├── Subject input (configEn.subject / configMs.subject)
    │   │   ├── Greeting input
    │   │   ├── CTA Label input
    │   │   ├── Closing input
    │   │   └── Enable/Disable toggle (disabled for critical types)
    │   └── EmailPreviewPane (sandboxed iframe)
    │       ├── Real-time preview (debounced 300ms)
    │       └── Variable hints (mockable for each template type)
    ├── Action buttons
    │   ├── Save (server action)
    │   ├── Reset to Defaults (server action)
    │   └── Preview (calls POST /api/email-preview)
    └── Success/error toast notifications
```

### Inline Preview

**Component:** `src/components/dashboard/email-templates/EmailPreviewPane.tsx`

- Sandboxed `<iframe srcDoc={previewHtml}>` isolates email CSS from dashboard
- Real-time rendering (debounced 300ms on form change)
- Mock data per template type (e.g., order-confirmation previews with sample order details)
- No database write, no email send
- Shows subject + body HTML

---

## 9. Preview API Route

### POST /api/email-preview

**Access:** Authenticated (withAuth middleware).

**Request:**
```json
{
  "templateType": "welcome",
  "draftConfig": {
    "subject": "Welcome to ECH!",
    "greeting": "Hi there",
    "ctaLabel": "Start Selling",
    "closing": "Best regards"
  }
}
```

**Response (200):**
```json
{
  "subject": "Welcome to ECH!",
  "html": "<p>Hi there,</p>...<a>Start Selling</a>...</p>Best regards"
}
```

**Validation:**
- `templateType` must be in EMAIL_TEMPLATE_TYPES enum → 400 if invalid
- `draftConfig` optional; if omitted, use hardcoded defaults for the type
- No database read/write
- No email send
- No cache write

**Security:**
- Authenticated (must have valid session)
- Enum validation prevents injection
- HTML is escaped (no XSS risk from config values)

---

## 10. Critical Type Guard

**Server action:** `saveEmailTemplateConfig()`

```typescript
if (CRITICAL_TYPES.includes(templateType) && !enabled) {
  throw new Error('Critical email types cannot be disabled');
}
```

**UI:** Disable/hide toggle for critical types; display tooltip: "This email type is critical to user account security and cannot be disabled."

---

## 11. Multi-Tenant Isolation

### Access Control

**Database level:**
- `email-template-settings` has `tenant` FK field
- All reads filtered by `WHERE tenant = getCurrentTenantId()`
- All writes check `getCurrentTenantId() === config.tenantId` or throw 403

**API level:**
- Server actions (save/reset/delete) call `getCurrentTenantId()` and compare
- API routes check query param `tenantId` against session
- Cross-tenant access returns 403 Forbidden

**Test validation:** Integration test TC-I-01 creates configs for 2 tenants and verifies isolation (Tenant A cannot read Tenant B config).

---

## 12. Backward Compatibility

When no `email-template-settings` row exists for a (tenant, type, recipient):
- `getTemplateConfig()` returns null
- Template render applies hardcoded defaults
- Email output identical to pre-F32 behavior

**Migration path:** No data migration required. Configs are created on-demand (lazy) when seller edits.

---

## 13. Data Flow Diagrams

### Checkout Send (Buyer receives order-confirmation)

```
Buyer submits order
  └─ Order created in Payload
     └─ Order hook triggers: sendEmail({
          to: buyer.email,
          subject: "Order Confirmation",
          html: "<p>Your order...</p>",
          templateType: "order-confirmation",
          recipient: "customer",
          tenantId: site.tenantId
        })
        ├─ getTemplateConfig(tenantId, "order-confirmation", "customer")
        │  ├─ redis.get(email_config:tenantId:order-confirmation:customer)
        │  │  ├─ HIT → return cached {subject, greeting, ...}
        │  │  └─ MISS → payload.find + redis.set(300s)
        │  └─ return config || null
        ├─ if config.enabled === false → return false (skip send)
        ├─ mergeTemplateConfig(config, DEFAULTS[type][lang])
        ├─ applyVariables(merged.subject, {orderNumber: "#123", ...})
        ├─ payload.sendEmail({
             to: buyer.email,
             subject: "Your Order #123 is Confirmed",
             html: "<p>Your order #123...</p>"
           })
        └─ Email queued to AWS SES
           └─ Sent to buyer
```

### Admin Form Save (Seller edits email template)

```
Seller edits form: subject, greeting, ctaLabel, closing
  └─ Clicks Save
     └─ saveEmailTemplateConfig({
          templateType: "welcome",
          contentEn: { subject: "Welcome!", ... },
          contentMs: { subject: "Selamat Datang!", ... }
        })
        ├─ Validate: if critical type and enabled=false → throw error
        ├─ payload.create() or payload.update()
        │  └─ DB INSERT/UPDATE into email_template_settings
        ├─ afterChange hook fires
        │  └─ invalidateTemplateConfigCache(tenantId, "welcome", "customer|admin")
        │     └─ redis.del(email_config:tenantId:welcome:customer)
        │     └─ redis.del(email_config:tenantId:welcome:admin)
        └─ Toast: "Email template saved"
           └─ Next send will fetch fresh config from DB
```

### Real-time Preview (No Send)

```
Seller types in form: subject = "New Welcome!"
  └─ Form onChange → debounce 300ms
     └─ POST /api/email-preview {
          templateType: "welcome",
          draftConfig: {
            subject: "New Welcome!",
            greeting: "Hi {customerName}",
            ctaLabel: "Get Started",
            closing: "Cheers"
          }
        }
        ├─ Validate templateType enum
        ├─ mergeTemplateConfig(draftConfig, defaults)
        ├─ applyVariables(merged, EMAIL_PREVIEW_FIXTURES["welcome"])
        ├─ templateRegistry["welcome"](fixtures, merged)
           └─ Render email HTML (subject + body)
        └─ Return { subject, html }
           └─ Iframe srcDoc updated with preview HTML
              └─ Seller sees live subject + body render
                 (NO database write, NO email sent)
```

---

## 14. Security Considerations

### HTML Escaping (XSS Prevention)

All substituted values in `applyVariables()` are HTML-escaped before insertion into template:

```typescript
const escaped = value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;');
```

Example: If seller sets subject to `"Order <img src=x onerror=alert('xss')>"`, the rendered email will show literal text with escaped tags, not execute the script.

### Tenant Isolation (IDOR Prevention)

- All DB queries scoped to `getCurrentTenantId()`
- Cross-tenant write returns 403
- Cache key includes tenantId (Tenant A cannot access Tenant B's cached config)

### Critical Type Protection

Sellers cannot disable otp-verification, forgot-password, or password-changed emails. These are gated at:
1. **Server action validation** — throws error
2. **UI toggle disabled** — cannot interact
3. **Database constraint** — optional but enforced at application level

### Preview API (No Side Effects)

- POST /api/email-preview does NOT:
  - Write to database
  - Modify Redis cache
  - Send email
  - Fetch real user data
- Uses mock fixtures (safe test data) for preview rendering

---

## 15. Template Registry

**File:** `src/lib/email/template-registry.ts`

Maps `EmailTemplateType` → template render function.

```typescript
const templateRegistry: Record<EmailTemplateType, TemplateRenderFn> = {
  'otp-verification': renderOtpTemplate,
  'forgot-password': renderForgotPasswordTemplate,
  'order-confirmation': renderOrderConfirmationTemplate,
  // ... all 15 types
};

type TemplateRenderFn = (
  fixtures: EmailFixtures,
  config?: EmailTemplateConfig
) => { subject: string; html: string };
```

Each template function:
- Accepts optional `config` (CMS override)
- Falls back to hardcoded defaults if config not provided
- Merges config with defaults
- Applies variable substitution
- Returns { subject, html }

---

## 16. Related Documentation

- **Test Plan:** [`docs/qa/F32-email-template-cms-settings.md`](../qa/F32-email-template-cms-settings.md)
- **Email Rules:** `.claude/rules/email-smtp.md`
- **Database Schema:** `.claude/rules/database-schema.md`
- **Testing:** `docs/TEST_CONVENTION.md`

---

## 17. Implementation Files

**New:**
- `src/collections/EmailTemplateSettings.ts` — collection definition
- `src/lib/email/types.ts` — EmailTemplateType, EmailRecipient, enums
- `src/lib/email/get-template-config.ts` — cache layer + DB lookup
- `src/lib/email/merge-template-config.ts` — config merge + variable substitution
- `src/lib/email/preview-fixtures.ts` — mock data per template type
- `src/lib/email/template-registry.ts` — templateType → render fn mapping
- `src/lib/redis.ts` — shared Upstash Redis singleton
- `src/app/api/email-preview/route.ts` — preview endpoint
- `src/app/(dashboard)/settings/email-templates/` — page + UI components
- `src/__tests__/unit/email/*.test.ts` — unit tests
- `src/__tests__/integration/email-settings/*.test.ts` — integration tests

**Modified:**
- `src/lib/email/send.ts` — extended with templateType/config params
- `src/lib/rateLimit.ts` — imports redis from ./redis
- `src/payload.config.ts` — register EmailTemplateSettings collection
- `scripts/db-setup.js` — 4 migrations (create tables, add indices)
- `src/components/dashboard/Sidebar.tsx` — add "Email Templates" nav item
- `src/components/editor/EditorMenuDrawer.tsx` — add "Email Templates" nav item
- All 15 template render functions in `src/lib/email/templates/` — accept optional config param

---

## 18. Navigation

**Dashboard Settings menu:**
```
Settings (gear icon)
  ├── General Settings
  ├── Shipping
  ├── Email Templates  ← F32 NEW
  ├── Notifications
  └── API Keys
```

**Editor menu (sidebar):**
```
Tools (top right hamburger)
  ├── Settings
  │   └── Email Templates  ← F32 NEW
  └── Help
```

---

## 19. Known Limitations & Future Work

- **No bulk export/import:** Settings per-tenant only; no CSV export
- **No template versioning:** Old versions not retained; only current config stored
- **No A/B testing:** Single config per (templateType, recipient, tenant)
- **Wave 7+:** Multi-recipient override (e.g., different subject for customer vs admin for same order-confirmation)
