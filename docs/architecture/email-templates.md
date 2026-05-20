# Email Templates

> Index of all transactional email templates in `src/lib/email/templates/`.
> See `.claude/rules/email-smtp.md` for SMTP transport rules and patterns.

## Transport layer

| File | Purpose |
|------|---------|
| `src/payload.config.ts` | AWS SES SMTP config (uses `MAIL_*` env vars) |
| `src/lib/email/send.ts` | Thin wrapper around `payload.sendEmail()` — returns `boolean` |
| `src/lib/email/templates/index.ts` | Barrel export for all template functions |

**Dev fallback:** Without `MAIL_HOST`, Payload uses stream transport (logs to console, no crash).

**Locale support:** Template strings sourced from `src/i18n/locales/{en,ms}.json` under the `email.*` namespace. All templates accept `locale?: 'en' | 'ms'` (default `en`). Exception: `staff-invitation` is hardcoded EN only.

## Templates (7 total)

### 1. `welcome.ts` — `welcomeEmail()`

- **Purpose:** Onboarding email for newly registered user
- **Trigger:** `src/collections/Users.ts:24` — Users collection `afterChange` hook on create
- **Input:** `{ userName, dashboardUrl?, locale? }`
- **i18n key:** `email.welcome` (EN + MS)
- **CTA:** Dashboard link (default `https://primeweb.app/dashboard`)

### 2. `otp-verification.ts` — `otpVerificationEmail()`

- **Purpose:** 6-digit OTP for 2FA login + staff invite verification
- **Trigger:** `src/collections/Users.ts:758` — `send-otp` endpoint
- **Input:** `{ userName, otpCode, locale? }`
- **i18n key:** `email.otp` (EN + MS, with hardcoded fallback)
- **TTL:** 5 minutes (per F02 spec)
- **Pattern:** Fire-and-forget — non-blocking per `.claude/rules/email-smtp.md`

### 3. `forgot-password.ts` — `forgotPasswordEmail()`

- **Purpose:** Password reset link
- **Trigger:** `src/collections/Users.ts:108` — Payload `forgotPassword.generateEmailHTML` override
- **Input:** `{ userName, resetUrl, locale? }`
- **i18n key:** `email.forgotPassword` (EN + MS)
- **Security:** Always returns success regardless of email existence (anti-enumeration, per F02)

### 4. `password-changed.ts` — `passwordChangedEmail()`

- **Purpose:** Confirmation that password was changed; warns user if they did not initiate
- **Trigger:** `src/app/api/users/me/password/route.ts:67`
- **Input:** `{ userName, locale? }`
- **i18n key:** `email.passwordChanged` (EN + MS)
- **Hardening:** `userName` HTML-escaped before render

### 5. `staff-invitation.ts` — `staffInvitationEmail()`

- **Purpose:** Invite staff member to a workspace
- **Trigger:**
  - `src/collections/Users.ts:296` — Owner-created staff (with `temporaryPassword`)
  - `src/collections/Users.ts:595` — Resend invitation
- **Input:** `{ userName, workspaceName, loginUrl?, locale?, temporaryPassword? }`
- **i18n:** Hardcoded EN (TODO: extract to `email.staffInvitation`)
- **Flow:** Staff logs in with temp password → receives OTP via `otpVerificationEmail`

### 6. `order-confirmation.ts` — `orderConfirmationEmail()`

- **Purpose:** Receipt email after successful payment
- **Trigger:** `src/app/api/webhooks/stripe/route.ts:167` — Stripe `checkout.session.completed` webhook
- **Input:** `{ orderNumber, customerName, items[], subtotal, tax, total, currency, locale?, shippingAddress? }`
- **i18n key:** `email.order` (EN + MS)
- **Formatting:** Currency formatted per locale (EN: `MYR 299.00`, MS: `RM299.00`)

### 7. `order-status.ts` — `orderStatusEmail()`

- **Purpose:** Notify customer of order status change (processing / shipped / delivered / cancelled)
- **Trigger:** **Not wired** in production code (exported only). Referenced by test `docs/qa/playwright-testcase/f14-shipping.spec.ts:248,543`.
- **Input:** `{ customerName, orderNumber, status, locale?, trackingNumber?, trackingUrl?, storeName? }`
- **i18n key:** `email.status.{processing|shipped|delivered|cancelled}` (EN + MS)
- **Variants:** Per-status emoji + accent color; shipping variant renders tracking block

## Ad-hoc inline emails (no template module)

Two endpoints send email directly without a template — flagged here for future consolidation:

| Endpoint | Use case | Recommendation |
|----------|----------|----------------|
| `src/app/api/orders/[id]/cancel/route.ts:118` | Order cancellation notice (admin → buyer) | Migrate to `orderStatusEmail({ status: 'cancelled' })` |
| `src/app/api/contact-submit/route.ts:93` | Contact-form forward (visitor → owner) | Plain-text only — low priority to templatize |

## Commerce templates — planned

Full commerce-flow email coverage (buyer ↔ seller). Auth/account templates above are out of scope here.

| # | Template | Recipient | Trigger | Current state | Action |
|---|----------|-----------|---------|---------------|--------|
| 1 | `contact-buyer-confirmation` | Buyer | Contact form submitted | ❌ Missing | Create template + wire in `src/app/api/contact-submit/route.ts` |
| 2 | `contact-seller-notification` | Seller (site owner) | Contact form submitted | ⚠️ Inline plain-text at `src/app/api/contact-submit/route.ts:93` | Extract to template module |
| 3 | `newsletter-buyer-confirmation` | Buyer | Newsletter signup | ❌ Missing — `src/app/api/subscribe/route.ts` only inserts DB | Create template + wire in subscribe endpoint |
| 4 | `newsletter-seller-notification` | Seller | Newsletter signup | ❌ Missing — same endpoint | Create template + wire (optional: digest mode to batch) |
| 5 | `order-confirmation` | Buyer | Payment success | ✅ Wired (Stripe webhook) | — |
| 6 | `new-order-seller` | Seller | New order placed (any payment method) | ❌ Missing email. In-app notif only at `Orders.ts:55` (COD/QR) + `stripe/route.ts:194` (Stripe) | Create template + wire alongside existing `ORDER_NEW` notif |
| 7 | `order-status` (cancelled variant) | Buyer | Order cancelled by admin | ⚠️ Inline HTML at `orders/[id]/cancel/route.ts:118` + `orderStatusEmail({status:'cancelled'})` orphaned | Migrate inline to `orderStatusEmail` |
| 8 | `order-status` (delivered variant) | Buyer | Order marked delivered | ⚠️ Template exists (`orderStatusEmail({status:'delivered'})`), not wired | Wire into F14 shipping completion hook |
| 9 | `order-status` (failed variant) | Buyer | Delivery failed | ❌ `orderStatusEmail` enum has no `'failed'` status | Add `'failed'` to `OrderStatus` union + i18n key + wire to shipping webhook |

### F10 payment templates (separate)

Per D-09 in `docs/decisions/decisions-log.md`:

| Template | Source | Status |
|----------|--------|--------|
| `payment-confirmed` | `docs/stories/F10-orders-stories.md:355,441` | Pending — reuse `orderStatusEmail` per D-09 (unified COD + Bank Transfer) |
| `payment-rejected` | `docs/qa/F10-orders-management.md:239` | Pending — must include rotated magic link + rejection reason enum |

## Conventions for new commerce templates

Use these defaults when implementing #1–#9 above. Anything not specified here → follow patterns in existing templates (e.g. `welcome.ts` as canonical reference for HTML structure).

### Seller / site context lookup

Commerce emails that target seller need `ownerEmail` + `siteName`. Use the pattern from `src/app/api/contact-submit/route.ts:85-89`:

```ts
const ownerEmail =
    (site.ownerEmail as string) ||
    (typeof site.tenant === 'object' && site.tenant !== null
        ? ((site.tenant as Record<string, unknown>).email as string)
        : undefined)
const siteName = (site.name as string) || 'PrimeWeb'
```

For multi-owner tenants (#6 new-order-seller): mirror the in-app notif pattern at `src/collections/Orders.ts:55` — enumerate tenant owners, send to each.

### From / Reply-To

- **From:** Always `noreply@primeweb.app` (Payload default — `MAIL_FROM_ADDRESS` env, see `src/payload.config.ts:83`). Do NOT override per-template.
- **Reply-To:** Set on **buyer→seller** emails (#2 contact-seller, #4 newsletter-seller, #6 new-order-seller) so seller can reply to buyer. Use `replyTo: buyerEmail`. Skip for seller→buyer emails.

### Locale source of truth

Priority order (first match wins):
1. **Buyer-provided** (contact/newsletter form has `locale` field) — preferred
2. **Site default** — `sites.locale` ('en' | 'ms', default 'ms', see `src/collections/Sites.ts:110`)
3. **Hardcoded fallback** — `'en'`

### File naming + module structure

- One template per file, kebab-case: `contact-buyer-confirmation.ts`, `new-order-seller.ts`
- Export single named function matching filename: `contactBuyerConfirmationEmail()`
- Re-export from `src/lib/email/templates/index.ts`
- Standard return shape: `{ subject: string; html: string }`

### i18n key prefixes

Add new namespace per template under `email.*` in `src/i18n/locales/{en,ms}.json`:

| Template | i18n key prefix |
|----------|-----------------|
| `contact-buyer-confirmation` | `email.contactBuyer.*` |
| `contact-seller-notification` | `email.contactSeller.*` |
| `newsletter-buyer-confirmation` | `email.newsletterBuyer.*` |
| `newsletter-seller-notification` | `email.newsletterSeller.*` |
| `new-order-seller` | `email.newOrderSeller.*` |

Required sub-keys per namespace: `subject`, `heading`, `subheading`, `greeting`, `body`, `footer`. Add MS translations in same PR (use `staff-invitation` as anti-pattern — EN-only ships then rots).

### Suggested input schemas

Starting point — refine per PRD:

```ts
// #1
contactBuyerConfirmationEmail({ visitorName, siteName, messagePreview?, locale? })
// #2 — extract from contact-submit/route.ts:93
contactSellerNotificationEmail({ visitorName, visitorEmail, visitorPhone?, message, siteName, locale? })
// #3
newsletterBuyerConfirmationEmail({ visitorEmail, siteName, locale? })
// #4
newsletterSellerNotificationEmail({ subscriberEmail, source, siteName, locale? })
// #6
newOrderSellerEmail({ orderNumber, customerName, customerEmail, items[], total, currency, paymentMethod, siteName, locale? })
```

### Rate limiting

Newsletter (`subscribe/route.ts:14-21`) + contact form already have 5/min per IP rate limits. New email triggers inherit this — no extra throttling needed at template layer.

### Design system

Use `welcome.ts` as canonical HTML structure reference: max-width 600px wrapper, gradient header (`#0d9488 → #6366f1` teal-indigo for default; `#ef4444` for error states), white card body, gray footer. Match shadow/radius/typography exactly.

## Coverage matrix

| Template | EN | MS | Tests | Production wired |
|----------|----|----|-------|------------------|
| welcome | ✅ | ✅ | `src/__tests__/unit/email/` | ✅ |
| otp-verification | ✅ | ✅ | ✅ | ✅ |
| forgot-password | ✅ | ✅ | ✅ | ✅ |
| password-changed | ✅ | ✅ | ✅ | ✅ |
| staff-invitation | ✅ | ❌ | ✅ | ✅ |
| order-confirmation | ✅ | ✅ | ✅ | ✅ |
| order-status | ✅ | ✅ | `src/__tests__/unit/lib/email/order-status-tracking.test.ts` | ❌ (orphaned) |

## Open items

- [ ] Implement 4 missing commerce templates (#1, #3, #4, #6 in commerce table)
- [ ] Extend `OrderStatus` union with `'failed'` + wire delivery-failed email (#9)
- [ ] Wire `orderStatusEmail` `delivered` + `cancelled` variants (#7, #8)
- [ ] Extract inline contact-form email to template module (#2)
- [ ] Implement F10 payment-confirmed + payment-rejected variants (per D-09)
- [ ] Extract `staff-invitation` strings to `i18n/locales/*.json` for MS support
- [ ] Add XSS input tests on user-controllable fields (per `docs/qa/TEST-QUALITY-REVIEW-2026-03-27.md:139`)
