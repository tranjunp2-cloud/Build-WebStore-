# PRD: Contact Submissions / Lead Capture (F25)

> **Version:** 1.0 | **Created:** 2026-05-25 | **Agent:** `docs-manager`
> **Priority:** P1 | **Sprint:** Backfill — v1.1 stabilization | **Size:** S
> **Depends on:** Sites collection ✅, F02 Auth (roles) ✅, AWS SES email ✅, `@/lib/rateLimit` ✅
> **Related:** F25 Shop Customers (sibling under F25 umbrella), F32 Email Template CMS Settings (templatize contact emails)

---

> [!IMPORTANT]
> **Backfill Note:** This feature was shipped by dev under **Plan 260415 contact-bugfix** without a formal PRD/story/design. This document **reverse-documents the as-built behavior** to standardize it. Sections flagged ⚠️ describe current limitations, not aspirational scope.
>
> **ID namespace:** F25 already uses `TC-F25-NN` / `US-F25-NN` for Shop Customers. To avoid collision, Contact Submissions uses the **`CS`** sub-namespace: `US-F25-CS-NN`, `TC-F25-CS-NN`.

---

## 0. Feature Alignment

| Property | Value |
|----------|-------|
| Feature ID | F25 (Contact Submissions sub-feature, `CS` namespace) |
| Origin | Plan 260415 contact-bugfix (as-built, backfilled 2026-05-25) |
| Acceptance Criteria | See [stories](../stories/F25-contact-submissions-stories.md) — US-F25-CS-01..05; QA matrix TBD `docs/qa/F25-contact-submissions.md` |
| Related Issues | — (no tracked issue; created via bugfix plan) |

---

## 1. Problem Statement

Storefront websites built on PrimeWeb need a way for visitors (potential leads) to send a contact message to the site owner. Before this feature there was a Contact **block** (form UI, F30/F31 — 6 variants) but **no backend** to persist submissions or notify the owner — the form had nowhere to POST. Leads were lost. This feature adds the storage + intake API + admin triage surface that turns the contact form into a working lead-capture funnel.

---

## 2. Target User

- **Website visitor (lead):** fills the public contact form on a storefront → expects message delivered
- **Site owner / Seller:** receives an email notification per submission; triages leads
- **Super-admin (platform staff):** ⚠️ currently the **only** role that can read/triage submissions in the Payload admin (see BR-07 limitation)

---

## 3. Solution Overview

A first-class **`contact-submissions`** collection + a public POST intake endpoint:

- Public endpoint `POST /api/contact-submit` — rate-limited, validated, spam-guarded
- Persists each submission keyed to a `site` (relationship → `sites`)
- Status workflow for triage: `new → read → replied → archived`
- Fire-and-forget email notification to the site owner (plain-text, ⚠️ to be templatized in F32)
- Admin list view filterable by site + status to triage leads
- Spam protection: per-IP rate limit (5/5min) + honeypot field

**Not in scope (this version):** auto-reply to the buyer, CSV export, tenant-scoped read access, wiring of `footer`/`popup` sources, locale/i18n of emails (see §15).

---

## 4. Scope

### In Scope

- `contact-submissions` collection: name, email, phone, message, site, status, source, ipAddress + timestamps
- Public create via `POST /api/contact-submit` (zod-validated)
- Per-IP rate limit: 5 submissions / 5 minutes (`checkRateLimit`), returns 429 when exceeded
- Honeypot field `website` — non-empty ⇒ silent `{ success: true }` (bot does not learn it was rejected)
- Site existence check before create (invalid `siteId` ⇒ 400)
- Fire-and-forget owner notification via `payload.sendEmail` (does not block the HTTP response)
- Admin list: `useAsTitle: email`, default columns `name, email, site, status, createdAt`; filter by site + status
- Status select: `new | read | replied | archived` (default `new`)
- `source` select with options `contact-block | footer | popup` (default `contact-block`)
- `ipAddress` captured (read-only) for spam/abuse review
- DB indexes: `(site_id, created_at DESC)`, `status`, `email`

### Out of Scope

- Buyer auto-reply / confirmation email (planned in F32 as `contact-buyer-confirmation`)
- HTML email template for owner notification — currently inline plain-text (F32 `contact-seller-notification`)
- CSV / bulk export of leads
- ⚠️ Tenant-scoped read access (currently super-admin only — see BR-07)
- Wiring `footer` and `popup` as live `source` values (schema supports, API hardcodes `contact-block`)
- Locale field on form / locale-aware emails (no `locale` captured today)
- CAPTCHA / third-party spam service (honeypot + rate limit only)
- Lead assignment, notes, or CRM sync

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Schema validation | 100% pass `check-migrations.js` | CI gate |
| Spam rejection | bot honeypot fills never persisted | TC-F25-CS (honeypot) |
| Rate limit enforcement | 6th request in 5 min → 429 | TC-F25-CS (rate limit) |
| Response non-blocking | email failure does not fail the POST | TC-F25-CS (email fire-forget) |
| Invalid site rejected | unknown `siteId` → 400, no row created | TC-F25-CS (site check) |

---

## 6. User Story Summary (Light Form)

```
AS A   website visitor (potential lead)
I WANT to send a message via the contact form on a storefront
SO THAT the site owner receives it and can follow up with me

AS A   site owner / super-admin
I WANT submissions stored and an email notification per lead
SO THAT I can triage and respond without losing any inquiry
```

Full stories: [`docs/stories/F25-contact-submissions-stories.md`](../stories/F25-contact-submissions-stories.md).

---

## 7. Functional Requirements

| FR-ID | Requirement | Priority | Notes |
|-------|-------------|----------|-------|
| FR-CS-01 | `contact-submissions` collection: name (req), email (req), phone (opt), message (req), site (rel→sites, req), status, source, ipAddress | P0 | `src/collections/ContactSubmissions.ts` |
| FR-CS-02 | Public `POST /api/contact-submit`: zod-validate body, create submission on success | P0 | `src/app/api/contact-submit/route.ts` |
| FR-CS-03 | Per-IP rate limit 5 / 5 min; exceed → 429 | P0 | `checkRateLimit('contact-submit:<ip>', 5, 300000)` |
| FR-CS-04 | Honeypot `website` field non-empty → silent success, no persistence | P0 | anti-bot; returns `{ success: true }` |
| FR-CS-05 | Validate `siteId` exists before create; unknown → 400 | P0 | `payload.findByID('sites', siteId)` |
| FR-CS-06 | Fire-and-forget owner email notify (does not block / fail response) | P1 | `payload.sendEmail` to `site.ownerEmail` ⟶ fallback `site.tenant.email` |
| FR-CS-07 | Status workflow `new/read/replied/archived`, default `new`, indexed | P1 | merchant triage |
| FR-CS-08 | Capture `ipAddress` (read-only) from `x-forwarded-for` | P1 | spam/abuse review |
| FR-CS-09 | Admin list: title=email, columns name/email/site/status/createdAt; filter site+status | P1 | Payload list view |
| FR-CS-10 | Access: create public; read/update/delete **super-admin only** | P0 | ⚠️ not tenant-scoped (BR-07) |

---

## 8. Business Rules

- **BR-CS-01:** Each submission belongs to exactly one `site` (required FK). No site ⇒ rejected (400).
- **BR-CS-02:** Client-side validation (name/email/phone/message) mirrored server-side via zod — server is source of truth.
- **BR-CS-03:** `message` min 5 chars, max 5000; `name` max 200; `email` RFC + max 254; `phone` optional, max 30.
- **BR-CS-04:** Honeypot `website` must be empty. Non-empty ⇒ treated as bot ⇒ silent success (HTTP 200, nothing stored).
- **BR-CS-05:** Rate limit is per-IP keyed `contact-submit:<ip>`; window 5 min, cap 5 (stricter than `/api/subscribe` due to higher spam risk).
- **BR-CS-06:** Email notification is **best-effort** — sent without `await` on the response path; a send failure is swallowed and never turns a successful create into an error.
- **BR-CS-07:** ⚠️ **Read/update/delete restricted to `super-admin`.** Unlike F25 Customers (tenant-scoped), site owners cannot currently view their own leads in the admin — they rely solely on the email notification. Tenant-scoping is deferred (§15).
- **BR-CS-08:** `source` defaults to `contact-block`. API hardcodes this value today; `footer`/`popup` exist in schema for forward-compat but are not yet emitted.
- **BR-CS-09:** Owner email resolution order: `site.ownerEmail` → `site.tenant.email` → skip (no notify if neither present).
- **BR-CS-10:** Hard-delete is **allowed** for super-admin (differs from Customers/Orders which forbid delete) — leads are transient triage data, not financial records.

---

## 9. User Flow

### 9.1 Visitor submits contact form (happy path)

```
[Storefront page with Contact block]
  ↓ visitor fills name/email/phone/message, clicks Send
useContactForm.handleSubmit → client validation (per-field)
  ↓ valid
POST /api/contact-submit { name, email, phone, message, siteId, website:'' }
  ├── Rate limit check (5/5min per IP) ──── exceeded → 429 toast
  ├── zod validate ──────────────────────── invalid → 400 + first error message
  ├── honeypot website empty? ───────────── filled → 200 silent (bot), nothing saved
  ├── site exists? ──────────────────────── no → 400 "Invalid site"
  ├── payload.create('contact-submissions') status=new, source=contact-block, ipAddress
  └── fire-and-forget: payload.sendEmail(ownerEmail, ...)  (not awaited)
  ↓
200 { success: true } → form shows success state, resets
```

### 9.2 Owner / super-admin triages a lead

```
[Email notify: "New contact form submission on {siteName}"]
  ↓ link → /admin/collections/contact-submissions/:id
Super-admin opens submission (status: new)
  ├── reads message → set status = read
  ├── replies to lead by email (manual) → set status = replied
  └── done → set status = archived
List view: filter by site + status to work the queue
```

### 9.3 Edge case: spam bot fills honeypot

```
[Bot auto-fills every field including hidden `website`]
  ↓ POST /api/contact-submit { ..., website: 'http://spam' }
Server: honeypot non-empty → return 200 { success:true } WITHOUT persisting
Result: bot believes it succeeded; no row created; no email sent
```

---

## 10. Screen Layout

### 10.1 Public Contact Form (storefront)

- **Surface:** Contact block (`src/blocks/contact/index.tsx`), 6 variants (form / info-only / split / card-float / map-split / minimal-inline)
  > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant.
- **Fields:** name, email, phone (optional), message + hidden honeypot `website`
- **States:** idle / loading (spinner) / success (reset + thank-you) / error (per-field + form-level message)
- **Detail:** see [design doc](../design/F25-contact-submissions-design.md)

### 10.2 Admin List (triage)

- **Path:** `/admin/collections/contact-submissions`
- **Columns:** Name, Email (title), Site, Status, Created
- **Filters:** Site (relationship), Status (select chips)
- **Access:** super-admin only (empty/403 for others)

### 10.3 Admin Detail

- **Path:** `/admin/collections/contact-submissions/:id`
- **Fields:** name, email, phone, message (textarea), site, status (editable select), source, ipAddress (read-only)
- **Actions:** Save (status change), Delete (allowed for super-admin)

---

## 11. Acceptance Criteria

### AC-1: Public intake + persistence (US-F25-CS-01, FR-CS-01/02/05)

```gherkin
GIVEN a storefront contact form for a valid site
WHEN a visitor submits valid name/email/message + siteId
THEN POST /api/contact-submit returns 200 { success: true }
  AND one contact-submissions row is created with status='new', source='contact-block'
  AND ipAddress is captured from x-forwarded-for
  AND an unknown siteId returns 400 with no row created
```

### AC-2: Validation (US-F25-CS-02, FR-CS-02, BR-CS-03)

```gherkin
GIVEN a submission payload
WHEN any field violates the schema (missing name, invalid email, message < 5 chars, phone > 30)
THEN the endpoint returns 400 with the first validation message
  AND no row is created
```

### AC-3: Spam protection (US-F25-CS-03, FR-CS-03/04, BR-CS-04/05)

```gherkin
GIVEN the contact endpoint
WHEN the honeypot field `website` is non-empty
THEN the endpoint returns 200 { success: true } WITHOUT persisting or emailing
WHEN a 6th request arrives from the same IP within 5 minutes
THEN the endpoint returns 429 and no row is created
```

### AC-4: Owner notification (US-F25-CS-04, FR-CS-06, BR-CS-06/09)

```gherkin
GIVEN a valid submission for a site with an ownerEmail (or tenant.email)
WHEN the submission is created
THEN payload.sendEmail is invoked to the resolved owner address (fire-and-forget)
  AND if the email send fails the HTTP response is still 200 { success: true }
  AND if neither ownerEmail nor tenant.email exists no email is attempted
```

### AC-5: Triage workflow + access (US-F25-CS-05, FR-CS-07/09/10, BR-CS-07/10)

```gherkin
GIVEN a super-admin in the Payload admin
WHEN viewing contact-submissions
THEN the list shows name/email/site/status/createdAt filterable by site + status
  AND status can be moved new → read → replied → archived
  AND a non-super-admin cannot read/update/delete submissions
  AND super-admin may hard-delete a submission
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Intake responds without waiting on email send | Fire-and-forget pattern |
| **Security** | Honeypot + per-IP rate limit guard spam | No CAPTCHA at MVP |
| **Security** | No PII leaked in error responses (generic 400/429/500) | First zod message only on 400 |
| **Security** | ⚠️ Read restricted to super-admin server-side | Payload access rule |
| **Privacy** | `ipAddress` stored for abuse review, read-only in admin | retention policy TBD |
| **Reliability** | Email failures swallowed, never break intake | `.catch()` on sendEmail |
| **Mobile** | Contact info values are tappable (mailto/tel/maps) | block UI |

---

## 13. Technical Architecture

### Key Files

| Component | File | Role |
|-----------|------|------|
| Collection schema | `src/collections/ContactSubmissions.ts` | fields, access, admin list config |
| Intake endpoint | `src/app/api/contact-submit/route.ts` | rate limit → zod → honeypot → site check → create → notify |
| Form block (UI) | `src/blocks/contact/index.tsx` | 6 variants, renders form |
| Form config/schema | `src/blocks/contact/config.ts` | `ContactConfig`, zod schema, block meta |
| Submit hook | `src/blocks/contact/useContactForm.ts` | client validation + fetch + state |
| Rate limiter | `src/lib/rateLimit.ts` | `checkRateLimit` |
| Migrations | `scripts/db-setup.js` (search `contact_submissions`) | table + 3 indexes (line ~2433) |
| Registration | `src/payload.config.ts` | collection import + array entry |

### Data Model (`contact_submissions`)

| Column | Type | Null | Default | Index |
|--------|------|------|---------|-------|
| id | serial | no | — | PK |
| name | varchar | no | — | (collection field indexed) |
| email | varchar | no | — | `contact_submissions_email_idx` |
| phone | varchar | yes | — | — |
| message | text | no | — | — |
| site_id | integer | no | — | `contact_submissions_site_created_idx` |
| status | varchar | yes | `new` | `contact_submissions_status_idx` |
| source | varchar | yes | `contact-block` | — |
| ip_address | varchar | yes | — | — |
| created_at | timestamptz | no | now() | (composite w/ site_id) |
| updated_at | timestamptz | no | now() | — |

---

## 14. Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| Payload CMS 3 | ✅ | collection + admin |
| Sites collection | ✅ | `site` FK + owner/tenant email resolution |
| F02 Auth (roles) | ✅ | `super-admin` access checks |
| AWS SES (Payload email) | ✅ | `payload.sendEmail` notification |
| `@/lib/rateLimit` | ✅ | per-IP throttle |
| F32 Email Templates | 🟡 in progress | will replace inline plain-text owner email + add buyer confirmation |

---

## 15. Known Limitations + Future Work

| Item | Priority | Reason |
|------|----------|--------|
| ⚠️ Site owners cannot view own leads (super-admin only) | High | Read access not tenant-scoped; owners rely on email only. Align with F25 Customers tenant pattern. |
| Plain-text owner email (no HTML template) | Med (F32) | Inline `text` at `route.ts`; F32 `contact-seller-notification` to templatize |
| No buyer auto-reply / confirmation | Med (F32) | F32 `contact-buyer-confirmation` planned |
| `footer` / `popup` sources not wired | Low | Schema-ready; API hardcodes `contact-block` |
| No CSV export of leads | Low | Mirror F25 Customers export when needed |
| No locale field / i18n emails | Low | F21 localization dependency |
| Honeypot + rate limit only (no CAPTCHA) | Low | Sufficient for current spam volume |
| `ipAddress` retention policy undefined | Low | Define before GDPR-style adoption |

---

## 16. Related Documents

- **User Stories:** [`docs/stories/F25-contact-submissions-stories.md`](../stories/F25-contact-submissions-stories.md)
- **Design:** [`docs/design/F25-contact-submissions-design.md`](../design/F25-contact-submissions-design.md)
- **Sibling PRD:** [`docs/prd/F25-shop-customers.md`](./F25-shop-customers.md)
- **Email templatization:** [`docs/architecture/email-templates.md`](../architecture/email-templates.md) (#1 contact-buyer, #2 contact-seller), [`docs/prd/F32-email-template-cms-settings.md`](./F32-email-template-cms-settings.md)
- **Block variants:** [`docs/prd/F30-sprint2-variants.md`](./F30-sprint2-variants.md) §FR-07, [`docs/prd/F31-block-variant-audit.md`](./F31-block-variant-audit.md)
- **QA Test Plan:** `docs/qa/F25-contact-submissions.md` *(TBD — TC-F25-CS-NN namespace)*

---

## 17. Definition of Done (as-built audit)

- [x] `contact-submissions` collection exists + registered in payload.config
- [x] Migration + 3 indexes in `db-setup.js`, passes `check-migrations.js`
- [x] Public `POST /api/contact-submit` with rate limit + zod + honeypot + site check
- [x] Fire-and-forget owner email (non-blocking)
- [x] Status workflow + admin list filter (site + status)
- [x] Block UI wired to endpoint (`useContactForm`)
- [ ] ⚠️ Tenant-scoped read access (deferred — see §15)
- [ ] QA matrix authored (`docs/qa/F25-contact-submissions.md`, TC-F25-CS-NN)
- [ ] Owner email templatized (F32)
