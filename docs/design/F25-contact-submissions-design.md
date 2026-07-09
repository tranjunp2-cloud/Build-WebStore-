# F25 Contact Submissions / Lead Capture — Design & Wireframe Report

> **Epic:** Contact Submissions (F25 sub-feature — Lead Capture)
> **Feature Code:** F25 (`CS` sub-namespace)
> **Version:** 1.0 — Backfill of as-built behavior (Plan 260415 contact-bugfix)
> **Updated:** 2026-05-25
> **Claude Design (interactive):** [F25 Customer Management prototype](https://claude.ai/design/p/019dd7e0-9ebb-7240-9a01-c5a1a8aa733b?file=customers%2FCustomer%20Management.html&present=1)
> **Figma Design:** TBD
> **Decisions:** [PRD F25 Contact Submissions](../prd/F25-contact-submissions.md) · [Stories](../stories/F25-contact-submissions-stories.md) · related [F32 Email Templates](../prd/F32-email-template-cms-settings.md)

Tài liệu cung cấp wireframe + spec UI cho luồng **Contact Submissions / Lead Capture** (F25). Gồm 2 mặt: (1) **public Contact form** trên storefront (block builder) nơi visitor gửi message, và (2) **Payload Admin** nơi super-admin triage leads. Phần lớn admin UI ship miễn phí từ Payload list/edit defaults; phần custom là **public intake API** (`/api/contact-submit`) với rate-limit + honeypot + fire-and-forget email notify.

> ⚠️ **Backfill note:** Đây là tài liệu hoá ngược tính năng đã dev code. Mục gắn ⚠️ mô tả **limitation hiện tại**, không phải scope mong muốn.

---

## 1. Public Contact Form (Storefront Block)

*Block `contact` (`src/blocks/contact/index.tsx`) — 6 variants. Visitor điền form → POST `/api/contact-submit`. Form fields configurable qua `ContactConfig.formFields[]`.*

### 1.1. Variants

| Variant | Layout tóm tắt |
|---------|----------------|
| `form` **(default)** | Full form (name, email, message) + optional info chips |
| `info-only` | Chỉ info cards (phone/email/address), không có form |
| `split` | 2-col: info trái + form phải |
| `card-float` | Form trong floating card có shadow trên gradient nền |
| `map-split` | 2-col: map placeholder trái + form phải (mobile: map stack trên) |
| | > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant. |
| `minimal-inline` | Form gọn, padding nhỏ (py-8) |

(Chi tiết variant: `docs/prd/F30-sprint2-variants.md` §FR-07, `docs/prd/F31-block-variant-audit.md`.)

### 1.2. Form layout (variant `form`)

```text
┌──────────────────────────────────────────────────────────┐
│                    — Contact —                            │
│                   Contact Us                              │
│         Got a question? Send us a message.                │
│                                                           │
│  ┌─ info chips (optional) ──────────────────────────────┐│
│  │  ✉ hello@shop.my    ☎ +60 12 345 6789    📍 KL      ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Name *      [______________________________]        │ │
│  │ Email *     [______________________________]        │ │
│  │ Phone       [______________________________]        │ │
│  │ Message *   ┌────────────────────────────────┐      │ │
│  │             │                                │       │ │
│  │             └────────────────────────────────┘      │ │
│  │                                                      │ │
│  │  (hidden honeypot: website — visually hidden)        │ │
│  │                                                      │ │
│  │            [  Send message  ⟳ ]                      │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 1.3. Field spec

| Field | Type | Required | Client validation | Server (zod) |
|-------|------|----------|-------------------|--------------|
| `name` | text | yes* | non-empty | min 1, max 200 |
| `email` | email | yes* | regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `.email()`, max 254 |
| `phone` | tel | optional* | `PHONE_PATTERN_MY` `[0-9+\s()-]{9,20}` if present | max 30, optional |
| `message` | textarea | yes* | non-empty, ≥5 chars | min 5, max 5000 |
| `website` | hidden | — | honeypot (must stay empty) | `max(0)` else "Spam detected" |

\* Required-ness per field is driven by `formFields[].required` config; the table shows the default contact preset. The hidden `website` honeypot is always present.

### 1.4. Submit states (`useContactForm`)

```text
idle      → form interactive, no messages
loading   → button shows spinner (Loader2), inputs locked
success   → form.reset(), thank-you/success message
error     → per-field error map + form-level submitError text
```

State transitions:
```
[user clicks Send]
  → client validate → invalid? → state=error, show per-field errors (no API call)
  → valid → state=loading → fetch POST /api/contact-submit
       res.ok           → state=success, reset form
       res !ok (4xx/5xx)→ state=error, submitError = body.error
       network throw    → state=error, submitError="Network error. Please try again."
```

### 1.5. Mobile interactivity

- Info card values are tappable: email→`mailto:`, phone→`tel:`(digits+`+` only), address→`maps.google.com/?q=`
- See `hrefForContactValue()` in `index.tsx`

---

## 2. Intake API Flow (`POST /api/contact-submit`)

*Public endpoint. Order of guards matters — cheapest/safest first.*

```text
[Storefront form submit]
        │  { name, email, phone, message, siteId, website }
        ▼
┌─────────────────────────────────────────────────────────┐
│ POST /api/contact-submit                                  │
│                                                           │
│  1. Derive IP from x-forwarded-for[0]  (fallback unknown) │
│  2. Rate limit: checkRateLimit('contact-submit:'+ip,5,5m) │
│        exceeded → 429 "Too many submissions"              │
│  3. zod parse body                                        │
│        invalid → 400 { error: <first message> }           │
│  4. Honeypot: website non-empty?                          │
│        yes → 200 { success:true }  (NO persist, NO email) │
│  5. payload.findByID('sites', siteId, depth:1)            │
│        not found → 400 { error:'Invalid site' }           │
│  6. payload.create('contact-submissions', {               │
│        status:'new', source:'contact-block', ipAddress }) │
│  7. Resolve ownerEmail = site.ownerEmail                  │
│                      ?? site.tenant.email                 │
│  8. IF ownerEmail → payload.sendEmail(...).catch(noop)    │
│        ── fire-and-forget, NOT awaited ──                 │
│  9. return 200 { success: true }                          │
│                                                           │
│  catch (any) → 500 { error:'Something went wrong...' }    │
└─────────────────────────────────────────────────────────┘
```

### 2.1. Response contract

| Status | Body | Trigger |
|--------|------|---------|
| 200 | `{ success: true }` | created OR honeypot silent-reject |
| 400 | `{ error: <zod msg> }` | validation failure |
| 400 | `{ error: 'Invalid site' }` | unknown siteId |
| 429 | `{ error: 'Too many submissions...' }` | >5 req / 5 min / IP |
| 500 | `{ error: 'Something went wrong...' }` | payload/DB failure |

---

## 3. Owner Email Notification

*Fire-and-forget. Plain-text today; HTML template deferred to F32 (`contact-seller-notification`).*

```text
to:      <ownerEmail | tenant.email>
subject: New contact form submission on {siteName}
text:    You received a new message from {name} <{email}>{ (phone)}:

         {message}

         --
         View in admin: /admin/collections/contact-submissions/{id}
```

- ⚠️ No `replyTo` set today; F32 plans `replyTo: buyerEmail` so owner can reply directly
- ⚠️ No buyer confirmation email (F32 `contact-buyer-confirmation`)
- Send failure is swallowed (`.catch`) — never breaks the 200 response

---

## 4. Admin List View (Triage)

*URL: `/admin/collections/contact-submissions`. Payload default list view configured via `ContactSubmissions.admin`. ⚠️ super-admin only.*

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                              [👤 Admin] │
├──────────────┬──────────────────────────────────────────────┤
│ 🏠 Dashboard │ 📬 Contact Submissions                       │
│ 📦 Products  │ ┌─ Filters ──────────────────────────────┐  │
│ 🛒 Orders    │ │ Site: [ All ▼ ]   Status: [ New ▼ ]     │  │
│ 👥 Customers │ └─────────────────────────────────────────┘  │
│ 📬 Contact   │ ┌─ Submissions Table ────────────────────┐  │
│ ⚙️ Settings  │ │ Name      │ Email          │Site│Status│…│  │
│              │ │ ──────────┼────────────────┼────┼──────┼─│  │
│              │ │ Ali Baba  │ ali@shop.my    │ S1 │🔵New │ │  │
│              │ │ Siti N.   │ siti@x.my      │ S1 │👁Read│ │  │
│              │ │ John Doe  │ john@co        │ S2 │↩Repl │ │  │
│              │ │ Abu Bakar │ abu@x.my       │ S2 │🗄Arch│ │  │
│              │ └──────────────────────────────────────────┘  │
│              │  ◀ 1 2 3 ... ▶   (Payload default paging)    │
└──────────────┴──────────────────────────────────────────────┘
```

### 4.1. Default columns

Configured via `ContactSubmissions.admin.defaultColumns`:

| Column | Source | useAsTitle |
|--------|--------|-----------|
| Name | `name` | — |
| Email | `email` | ✓ (useAsTitle) |
| Site | `site` (relationship) | — |
| Status | `status` (badge) | — |
| Created | `createdAt` | — |

### 4.2. Status badges

```text
🔵 New      — value `new`     (default; needs triage)
👁 Read     — value `read`    (seen, not yet replied)
↩ Replied  — value `replied` (owner responded)
🗄 Archived — value `archived`(closed / dismissed)
```

### 4.3. Filters

- **Site:** Payload relationship filter → `?where[site][equals]=<id>`
- **Status:** select chips (New / Read / Replied / Archived)
- Backed by indexes: `contact_submissions_site_created_idx`, `contact_submissions_status_idx`

### 4.4. Access (silent)

- ⚠️ `read = roles.includes('super-admin')` — **only** super-admins see this collection
- Non-super-admin → collection hidden / 403; site owners rely on email notify
- Future: tenant-scope read to expose owners' own leads (PRD §15)

---

## 5. Admin Detail View

*URL: `/admin/collections/contact-submissions/:id`. Payload default Edit view.*

```text
┌─────────────────────────────────────────────────────────────┐
│ Contact Submissions > ali@shop.my            [💾 Save]      │
├─────────────────────────────────────────────────────────────┤
│ Name *      [Ali Baba                       ]                │
│ Email *     [ali@shop.my                    ]                │
│ Phone       [+60 12 345 6789                ]                │
│ Message *   ┌────────────────────────────────────────────┐  │
│             │ Hi, do you ship to Sabah? Need 3 units...  │  │
│             └────────────────────────────────────────────┘  │
│ Site *      [ Site S1               ▼ ]                      │
│ Status      [ 🔵 New                ▼ ]  ← editable          │
│ Source      [ contact-block         ▼ ]                      │
│ IP Address  203.0.113.7  (read-only)                         │
│ Created     2026-05-25 11:02   Updated 2026-05-25 11:02      │
│                                                              │
│        [ Save ]            [ 🗑 Delete ]  (super-admin)       │
└─────────────────────────────────────────────────────────────┘
```

### 5.1. Field spec

| Field | Type | Editable | Notes |
|-------|------|----------|-------|
| `name` | text | yes | required |
| `email` | email | yes | required |
| `phone` | text | yes | optional |
| `message` | textarea | yes | required |
| `site` | relationship | yes | required FK → sites |
| `status` | select | yes | triage workflow |
| `source` | select | yes | `contact-block`/`footer`/`popup` (only contact-block emitted today) |
| `ipAddress` | text | **no** | read-only; spam/abuse review |
| `createdAt`/`updatedAt` | date | no | Payload auto |

### 5.2. Delete

- ⚠️ Differs from Customers/Orders: **hard-delete allowed** for super-admin (`delete = super-admin`). Leads are transient triage data.

---

## 6. Empty / Error States Map

| Surface | Empty | Error |
|---------|-------|-------|
| Public form | n/a | per-field errors (client) + form-level `submitError`; toast on 429/500 |
| Form success | "Thank you" + form reset | — |
| Admin list | "No submissions yet" (Payload default) | Payload default error |
| Admin detail | required-field inline validation | 500 → Payload toast |

---

## 7. Spam / Abuse Handling (Invisible)

```text
Honeypot `website`  → bot fills hidden field → 200 silent, nothing stored
Rate limit per IP   → 6th request / 5 min → 429
ipAddress captured  → stored read-only for manual abuse review
```

No CAPTCHA / third-party service at MVP (YAGNI; revisit if spam volume rises).

---

## 8. Responsive / Mobile

- **Public form:** block is responsive (Tailwind); single-column stack on mobile; `map-split` stacks map above form ≤768px
  > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant.
- **Admin:** Payload desktop-first; list horizontal-scrolls ≤768px (Payload default)
- Contact info chips tappable on mobile (mailto/tel/maps)

---

## 9. Accessibility

- Form labels associated via `<label for>`; required fields marked
- Honeypot `website` visually hidden but reachable only by bots (not tab-focusable ideally — verify)
- Submit button shows loading spinner with accessible state; disable during `loading`
- Error text uses color + text (not color-only); associate with field via `aria-describedby` (verify)
- Admin inherits Payload native ARIA (tablist, form labels, error `role="alert"`)

---

## 10. Future Enhancements (defer YAGNI)

| Feature | Why defer | Trigger to revisit |
|---------|-----------|--------------------|
| ⚠️ Tenant-scoped read (owners see own leads) | Current super-admin-only is the main gap | Align with F25 Customers; owner request |
| HTML email template (owner) | Inline plain-text works; F32 owns templating | F32 delivery |
| Buyer confirmation email | Nice-to-have | F32 `contact-buyer-confirmation` |
| `replyTo: buyerEmail` on owner email | Owner currently replies manually | F32 |
| Wire `footer` / `popup` sources | Schema-ready; not emitted | New entry points added |
| CSV export of leads | Low volume now | Mirror F25 Customers export |
| Locale-aware emails | No `locale` captured | F21 localization |
| CAPTCHA | Honeypot+rate-limit enough | Spam spike |
| `ipAddress` retention/anonymize | Privacy policy undefined | GDPR-style adoption |

---

## 11. Related Files (code references)

| Layer | Path |
|-------|------|
| Collection schema | `src/collections/ContactSubmissions.ts` |
| Intake endpoint | `src/app/api/contact-submit/route.ts` |
| Form block UI | `src/blocks/contact/index.tsx` |
| Block config/schema | `src/blocks/contact/config.ts` |
| Submit hook + validation | `src/blocks/contact/useContactForm.ts` |
| Rate limiter | `src/lib/rateLimit.ts` |
| Migrations | `scripts/db-setup.js` (search `contact_submissions`, ~line 2433) |
| Registration | `src/payload.config.ts` (import + collections array) |
| Tests | `src/__tests__/unit/blocks/contact-form-keys.test.tsx`, `contact-variants.test.ts`, `src/__tests__/unit/ai/contact-override.test.ts` |

---

## 12. Test Cases (cross-link to QA matrix — TBD)

Proposed TC mapping (to author in `docs/qa/F25-contact-submissions.md`, `CS` namespace):

| TC | Surface tested | Story |
|----|----------------|-------|
| TC-F25-CS-01 | Valid submission persisted (status/source/ip defaults) | US-F25-CS-01 |
| TC-F25-CS-02 | Unknown siteId → 400, no row | US-F25-CS-01 |
| TC-F25-CS-03 | zod validation rejects bad fields → 400 | US-F25-CS-02 |
| TC-F25-CS-04 | Field bounds (name/email/phone/message max) | US-F25-CS-02 |
| TC-F25-CS-05 | Honeypot non-empty → 200 silent, no persist/email | US-F25-CS-03 |
| TC-F25-CS-06 | Rate limit 6th/5min → 429 | US-F25-CS-03 |
| TC-F25-CS-07 | Fire-and-forget email; send failure keeps 200 | US-F25-CS-04 |
| TC-F25-CS-08 | No owner email → skip notify, still persist | US-F25-CS-04 |
| TC-F25-CS-09 | Admin list columns + site/status filter | US-F25-CS-05 |
| TC-F25-CS-10 | Access: non-super-admin denied; super-admin delete allowed | US-F25-CS-05 |

Full matrix: `docs/qa/F25-contact-submissions.md` *(to be authored)*.

---

**Hết design report — v1.0 (backfill). Future updates theo Figma + F32 email template khi available.**
