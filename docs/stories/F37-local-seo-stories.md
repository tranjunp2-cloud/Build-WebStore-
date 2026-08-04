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
I want to enter my name, structured address, and phone in the Editor
So that my site has the required local business facts and earns Business Data points
```

### Acceptance Criteria

#### AC-1: Save complete business data

```gherkin
GIVEN the seller is on Editor Settings Global
WHEN they save a name, street, city, postcode, country, and phone
THEN Business Data points for those fields are earned on the next score calculation
  AND the fields persist on reload
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

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   SME seller
I want a Local SEO score and up to three next actions
So that I know what to edit in the Editor, or when F03 AI Fix All can improve page meta only, to improve the score
```

### Acceptance Criteria

#### AC-1: Show a complete score

```gherkin
GIVEN a site with all score criteria met
WHEN the seller opens Dashboard > SEO
THEN the Local SEO score is 100
  AND the checklist has zero incomplete high-priority local items
```

#### AC-2: Identify technical deductions

```gherkin
GIVEN a missing OG image and one bad slug
WHEN the score runs
THEN Technical Health reflects only the OG and slug deductions
  AND the checklist includes an item deep-linking to Editor SEO for the OG image or slug
```

#### AC-3: Handle unauthorized score requests

```gherkin
GIVEN the score API request is unauthorized
WHEN the client requests the score
THEN the API returns 401 or 403
  AND Dashboard shows an error state without inventing a score number
```

#### AC-4: Deep-link a Local Business fix

```gherkin
GIVEN a checklist item for a missing Local Business field
WHEN the seller clicks its action
THEN the Editor opens focused on the relevant Settings section
```

#### AC-5: Keep F03 AI Fix All meta-only

```gherkin
GIVEN only page metadata is missing
WHEN the seller runs F03 AI Fix All
THEN page metadata is proposed or applied
  AND Local Business fields remain unchanged
```

### Definition of Done

- [ ] FR-16 through FR-20 implement the PRD section 5 formula exactly and return score plus breakdown through the authenticated API.
- [ ] Dashboard shows no more than three Editor deep-links and distinguishes its score checklist from the Editor completion checklist.
- [ ] The corresponding acceptance criteria have automated or manual coverage.
