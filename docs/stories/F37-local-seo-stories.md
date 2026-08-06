# User Stories: Local SEO Score & Storefront Discoverability (F37)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F37 — Local SEO Score & Storefront Discoverability
> **Wave:** 4 | **Priority:** P0 | **Ref PRD:** [F37-local-seo-search-performance.md](../prd/F37-local-seo-search-performance.md)

---

## US-F37-01: Minimal Business Data

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   SME seller
I want to enter my name, contact address, local area details, and phone in the Editor
So that my site has the required local business facts and earns Business Data points
```

### Acceptance Criteria

#### AC-1: Save complete business data

```gherkin
GIVEN the seller is on Editor Settings Global
WHEN they save a name, Contact Info address, city, state, postcode, and phone
THEN Business Data points for those fields are earned on the next score calculation
  AND the fields persist on reload
  AND Local Business Info does not duplicate Street Address or Country
  AND schema country is implicitly Malaysia (`MY`)
```

#### AC-2: Score partial business data

```gherkin
GIVEN only a name and phone are set
WHEN the score runs
THEN Address points are 0
  AND Name and Phone points are earned
```

#### AC-3: Reject an invalid phone

```gherkin
GIVEN invalid phone characters are entered
WHEN the seller blurs the phone field
THEN save is rejected with validation feedback
  AND the previous valid phone remains
```

### Definition of Done

- [ ] FR-01 through FR-03 are implemented and score exactly 20 Business Data points when complete.
- [ ] The Editor form is usable at 375px width and preserves tenant isolation.
- [ ] The corresponding acceptance criteria have automated or manual coverage.

---

## US-F37-02: Schema-Rich Local Markup

**Wave 4** | **P0** | **M** | **Status:** In progress — Phase 00–02 built/tested; Phase 03 acceptance pending

### Story

```
As a   SME seller
I want hours, business category, a compatible schema subtype, map coordinates, and price range to power JSON-LD
So that search and AI systems receive complete LocalBusiness and Organization markup and I earn Schema points
```

### Acceptance Criteria

#### AC-1: Emit complete LocalBusiness markup

```gherkin
GIVEN name and address, business category, a compatible specific schema subtype, at least one open-hours row, valid latitude and longitude, and priceRange
WHEN the storefront homepage is rendered
THEN LocalBusiness JSON-LD includes PostalAddress, openingHoursSpecification, geo, priceRange, and the selected @type
  AND the corresponding Schema points are earned
```

#### AC-2: Omit unusable opening hours

```gherkin
GIVEN all opening-hours rows are closed or incomplete
WHEN score calculation and JSON-LD emission run
THEN openingHoursSpecification is omitted
  AND opening-hours points are 0 while other valid Schema points remain earned
```

#### AC-3: Omit incomplete coordinates safely

```gherkin
GIVEN only one of latitude or longitude is set
WHEN score calculation and JSON-LD emission run
THEN geo is omitted from JSON-LD
  AND Geo points are 0 without a crash
```

#### AC-4: Reject an incompatible subtype

```gherkin
GIVEN a schema subtype is incompatible with the selected business category
WHEN the seller saves
THEN the save is rejected and the previous valid pair remains
  AND the invalid @type is not emitted
```

### Definition of Done

- [x] FR-04 through FR-11 emit only valid, safely serialized tenant-storefront schema.
- [x] Schema score maps the eight approved criteria to exactly 35 points; FAQ is not scored.
- [x] Category/subtype persistence, filtering, atomic save, server validation, and generic fallback match the `@dominvopc`-approved versioned mapping.
- [x] TC-F37-02-29..48 automated coverage passes locally. The TC-F37-02-48 targeted gate passes 65/65; a broader related run has 245 passing assertions, while 3 DB-backed schema-drift checks are environment-blocked because PostgreSQL is not running. The migration suite passes 24/24.
- [x] TC-F37-02-45 automation discovers the authenticated account sole site, derives the canonical storefront URL from the tenant route/hostname, and asserts emitted schema URLs are non-empty and equal that canonical URL; it uses the existing email, password, and OTP credentials and does not require `E2E_SITE_ID`.
- [x] TC-F37-02-47 covers rejected settings-save rollback, newer-revision preservation, and late cross-site failure isolation in `publish-flow.test.tsx` (21/21 local).
- [x] TC-F37-02-48 covers normalized response-loss reconciliation, a bounded 5-second reconciliation timeout, unknown-outcome caller failure and cross-mount UI lock, queued-revision removal, and combined subtype a11y descriptions.
- [ ] Execute TC-F37-02-45 against the owned staging fixture and capture manual Google Rich Results evidence. PR #1708 is not a dependency or blocker; reconcile it only if it lands first.

---

## US-F37-03: Crawlers, Publish, and llms.txt

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   SME seller
I want the platform to maintain AI crawler access automatically and publish to expose sitemap and llms.txt
So that discoverability does not require technical settings
```

### Acceptance Criteria

#### AC-01: Published storefront exposes every discovery signal

```gherkin
GIVEN a published storefront
WHEN robots.txt, sitemap.xml, and llms.txt are requested
THEN approved AI assistant crawlers are allowed
  AND sitemap returns current URLs
  AND llms.txt returns Markdown
```

#### AC-02: Unpublished storefront hides publish-only discovery files

```gherkin
GIVEN a storefront is not published
WHEN robots.txt, sitemap.xml, and llms.txt are requested
THEN approved AI assistant crawler access remains allowed
  AND sitemap returns 404
  AND llms.txt returns 404
```

#### AC-03: Discovery endpoint failures are independent

```gherkin
GIVEN a published storefront cannot serve sitemap.xml or llms.txt
WHEN the discovery endpoints are requested
THEN the other available discovery endpoints keep their normal behavior
  AND no seller-facing resubmit control is shown
```

> **Score ownership: #1312** — US-F37-04 consumes these route facts, awards crawler/sitemap/llms exactly 9/5/1, and integrates the approved 100-point scorecard. Score-engine changes are not part of #1311.

### Definition of Done

- [ ] FR-12 through FR-14 expose platform-managed robots, sitemap, and llms.txt below `/sites/[slug]/*` and through supported storefront host rewrites.
- [ ] Approved AI assistant crawlers are always allowed; no seller toggle, resubmit action, or SEO Action Tools section remains.
- [ ] Published, unpublished, legacy-value, and independent endpoint-failure states have automated coverage.
- [ ] The route/UI acceptance criteria above have automated or manual coverage; the score handoff is documented for #1312.

---

## US-F37-04: Score, Checklist, and Fix Loop

**Wave 4** | **P0** | **M** | **Status:** Implemented; Phase 3 local gates pass — live release closeout pending

> **Phase 3 local verification (2026-08-06):** The production Dashboard consumes the authenticated authoritative 20/35/15/30 score, renders every deduplicated seller action without truncation, loads one field-filtered next-100 metadata-only AI batch, and deep-links to allowlisted Editor settings. Proposal/apply is active-membership, exact-site, revision, per-target-CAS, strict-request, user-wide 20/minute and 100/hour plus per-site 2/minute and 10/hour rate-limit guarded; partial Undo remains retryable through a newly signed continuation. The exact post-CAS state passes full local Vitest (701 files / 11,687 tests; one file / three tests skipped), typecheck, lint, an isolated 112/112-page build, the 1,001-record/28-query scale regression, and Playwright discovery. Current-code authenticated browser execution, fixture reset/checksum, p95, canary/rollback, and Story Sync #1312 remain pending.

### Story

```
As a   SME seller
I want one SEO Health score and a compact list of unresolved root causes
So that I can use AI only for metadata and reach the exact destination for every seller-owned fix
```

### Acceptance Criteria

#### AC-01: Show a complete score

```gherkin
GIVEN a site with all score criteria met
WHEN seller opens Dashboard > SEO
THEN the single SEO Health score is 100
  AND SEO Issues shows All clear
```

#### AC-02: Show every unresolved seller root cause

```gherkin
GIVEN unresolved metadata and seller-owned issues
WHEN the score runs
THEN each root cause appears once with an AI or You badge
  AND each row uses its approved CTA and destination
```

#### AC-03: Handle unauthorized score requests

```gherkin
GIVEN the score API request is unauthorized
WHEN the client requests the score
THEN the API returns 401 or 403
  AND Dashboard shows an error state without inventing a score number
```

#### AC-04: Deep-link a Local Business fix

```gherkin
GIVEN an issue for a missing business address
WHEN the seller clicks Edit
THEN the Editor opens focused on Contact Info Address
  AND Local Business Info does not render duplicate Street Address or Country controls
```

#### AC-05: Keep F03 AI Fix All metadata-only

```gherkin
GIVEN at least one title or description is missing
WHEN the seller runs F03 AI Fix All
THEN only those metadata records are proposed or applied
  AND Local Business fields remain unchanged
```

#### AC-06: Deduplicate derived metrics

```gherkin
GIVEN multiple score metrics depend on one missing source field
WHEN issues render
THEN the seller sees one root-cause row
  AND no duplicate row is created for derived schema metrics
```

#### AC-07: Hide unavailable AI actions

```gherkin
GIVEN no AI-fixable metadata issue remains
WHEN issues render
THEN the AI Fix All strip is hidden
```

### Definition of Done

- [x] FR-15 through FR-21 implement the PRD section 5 formula exactly and return score plus four-bucket breakdown through the authenticated API.
- [x] Dashboard shows one score, four qualitative bucket bars, and every deduplicated unresolved seller root cause without per-issue point values or a max-three cap.
- [x] Every issue uses the actor, CTA, and destination contract in PRD section 12.3; AI Fix is conditional, metadata-only, revision-bound, and capped to the next 100 records.
- [x] AC-01 through AC-07 have local automated coverage and a discovered three-case authenticated Playwright spec.
- [ ] Current-code authenticated and live score-100, more-than-seven-issues, API-error/race/apply, 375px, and fixture restoration evidence remain pending.
