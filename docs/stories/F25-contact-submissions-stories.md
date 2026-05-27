# User Stories: Contact Submissions / Lead Capture (F25)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F25 — Contact Submissions (Lead Capture sub-feature)
> **Wave:** Backfill (v1.1 stabilization) | **Priority:** P1 | **Ref PRD:** [F25-contact-submissions.md](../prd/F25-contact-submissions.md)
> **ID namespace:** `CS` sub-namespace (F25 root reserved for Shop Customers). Stories `US-F25-CS-NN`, tests `TC-F25-CS-NN`.
> **Note:** Backfill documentation of as-built behavior (Plan 260415 contact-bugfix).

---

## US-F25-CS-01: Visitor submits a contact message

**Wave Backfill** | **P0** | **S** | **Status:** Done ✅ (as-built)

### Story

```
As a   website visitor (potential lead)
I want to send a message through a storefront's contact form
So that the site owner receives my inquiry and can follow up
```

### Acceptance Criteria

#### AC-1: Happy path — valid submission persisted

```gherkin
GIVEN a storefront contact form bound to a valid siteId
WHEN I submit valid name, email, message (and optional phone)
THEN POST /api/contact-submit returns 200 { success: true }
  AND one contact-submissions row is created
  AND status = 'new' and source = 'contact-block'
  AND ipAddress is captured from the x-forwarded-for header
  AND the form resets to its success state
```

#### AC-2: Error — unknown site

```gherkin
GIVEN a submission whose siteId does not exist
WHEN the endpoint resolves the site
THEN it returns 400 "Invalid site"
  AND no contact-submissions row is created
```

### Additional Criteria

- [ ] Missing siteId on the client → form shows "Configuration error: missing site ID" without calling the API
- [ ] Contact info values (email/phone/address) render as tappable mailto:/tel:/maps links on mobile

### Market Notes

- Phone accepts MY-friendly format (`PHONE_PATTERN_MY`: digits, `+`, spaces, parens, hyphens), bounded `{9,20}` to prevent ReDoS

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [x] Row persisted with site FK + defaults; verified against `src/app/api/contact-submit/route.ts`

---

## US-F25-CS-02: Server-side validation rejects bad input

**Wave Backfill** | **P0** | **XS** | **Status:** Done ✅ (as-built)

### Story

```
As a   platform operator
I want every submission validated on the server (not just the client)
So that malformed or oversized data never reaches the database
```

### Acceptance Criteria

#### AC-1: Field validation (zod)

```gherkin
GIVEN a submission payload
WHEN name is empty OR email is invalid OR message < 5 chars OR a field exceeds its max
THEN the endpoint returns 400 with the first validation message
  AND no row is created
```

#### AC-2: Bounds enforced

```gherkin
GIVEN a submission payload
WHEN name > 200 chars OR email > 254 OR phone > 30 OR message > 5000
THEN the endpoint returns 400
  AND no row is created
```

### Additional Criteria

- [ ] Client-side validation (`useContactForm`) mirrors server rules for fast feedback, but the server remains source of truth

### Definition of Done

- [ ] 9-Point Checklist pass
- [x] Rules match `contactSchema` in `route.ts` and `validate()` in `useContactForm.ts`

---

## US-F25-CS-03: Spam protection (honeypot + rate limit)

**Wave Backfill** | **P0** | **S** | **Status:** Done ✅ (as-built)

### Story

```
As a   platform operator
I want bots and floods blocked before they create rows or send emails
So that owners are not spammed and the database stays clean
```

### Acceptance Criteria

#### AC-1: Honeypot — silent rejection

```gherkin
GIVEN the contact endpoint
WHEN the hidden honeypot field `website` is non-empty
THEN the endpoint returns 200 { success: true }
  AND no row is created
  AND no email is sent
  AND the bot cannot tell it was rejected
```

#### AC-2: Per-IP rate limit

```gherkin
GIVEN an IP that has submitted 5 times within 5 minutes
WHEN a 6th request arrives from the same IP
THEN the endpoint returns 429 "Too many submissions"
  AND no row is created
```

### Additional Criteria

- [ ] Rate-limit key is `contact-submit:<ip>`; window 5 min, cap 5 (stricter than `/api/subscribe`)

### Definition of Done

- [ ] 9-Point Checklist pass
- [x] Honeypot + `checkRateLimit('contact-submit:<ip>', 5, 300000)` verified in `route.ts`

---

## US-F25-CS-04: Owner gets notified per lead (non-blocking)

**Wave Backfill** | **P1** | **S** | **Status:** Done ✅ (as-built; HTML template pending F32)

### Story

```
As a   site owner / seller
I want an email notification whenever someone contacts me
So that I can respond quickly without watching the admin panel
```

### Acceptance Criteria

#### AC-1: Fire-and-forget notification

```gherkin
GIVEN a valid submission for a site with an ownerEmail (or tenant.email)
WHEN the submission is created
THEN payload.sendEmail is invoked to the resolved owner address
  AND the email is NOT awaited on the response path
  AND a send failure does NOT change the 200 { success: true } response
```

#### AC-2: No recipient → skip

```gherkin
GIVEN a site with neither ownerEmail nor tenant.email
WHEN a submission is created
THEN no email is attempted
  AND the submission is still persisted and 200 returned
```

### Additional Criteria

- [ ] Owner resolution order: `site.ownerEmail` → `site.tenant.email` → skip
- [ ] ⚠️ Email body is currently inline plain-text; HTML template tracked in F32 (`contact-seller-notification`)
- [ ] ⚠️ No buyer confirmation email today (F32 `contact-buyer-confirmation`)

### Market Notes

- F32 will add locale-aware templates; no `locale` is captured on the form today

### Definition of Done

- [ ] 9-Point Checklist pass
- [x] `.catch()`-guarded `payload.sendEmail` verified in `route.ts`

---

## US-F25-CS-05: Admin triages leads by status

**Wave Backfill** | **P1** | **S** | **Status:** Done ✅ (as-built; ⚠️ super-admin only)

### Story

```
As a   super-admin
I want to view and triage contact submissions by site and status
So that no inquiry is missed and each lead is worked to closure
```

### Acceptance Criteria

#### AC-1: List + filter + status workflow

```gherkin
GIVEN a super-admin in the Payload admin
WHEN viewing the contact-submissions collection
THEN the list shows columns name, email, site, status, createdAt
  AND it can be filtered by site and by status
  AND status can move new → read → replied → archived
```

#### AC-2: Access control

```gherkin
GIVEN a user who is NOT super-admin
WHEN they attempt to read/update/delete contact-submissions
THEN access is denied
WHEN a super-admin deletes a submission
THEN the hard-delete is allowed (leads are triage data, not financial records)
```

### Additional Criteria

- [ ] ⚠️ Known limitation: site owners cannot view their own leads in the admin (read is super-admin only, not tenant-scoped). Deferred — align with F25 Customers tenant pattern. See PRD §15.
- [ ] `ipAddress` shown read-only for abuse review

### Definition of Done

- [ ] 9-Point Checklist pass
- [x] Access rules + admin list config verified in `src/collections/ContactSubmissions.ts`

---

<!-- 5 stories — matches "max 5 stories/file" convention. Further stories (CSV export, tenant-scoped read, buyer auto-reply) → new file when scoped. -->
