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

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   SME seller
I want hours, category, map coordinates, price range, and FAQ content to power JSON-LD
So that search and AI systems receive complete LocalBusiness and FAQPage markup and I earn Schema points
```

### Acceptance Criteria

#### AC-1: Emit complete LocalBusiness markup

```gherkin
GIVEN name and address, at least one open-hours row, a specific category, valid latitude and longitude, and priceRange
WHEN the storefront homepage is rendered
THEN LocalBusiness JSON-LD includes PostalAddress, openingHoursSpecification, geo, priceRange, and a non-generic @type
  AND the corresponding Schema points are earned
```

#### AC-2: Emit FAQPage markup

```gherkin
GIVEN a page with FAQ block items
WHEN that page is rendered
THEN FAQPage JSON-LD is present
  AND FAQ Schema points are earned
```

#### AC-3: Omit incomplete coordinates safely

```gherkin
GIVEN only one of latitude or longitude is set
WHEN score calculation and JSON-LD emission run
THEN geo is omitted from JSON-LD
  AND Geo points are 0 without a crash
```

### Definition of Done

- [ ] FR-04 through FR-12 emit only valid, safely serialized tenant-storefront schema.
- [ ] The score maps every Schema criterion in PRD section 5 point-for-point.
- [ ] The corresponding acceptance criteria have automated or manual coverage.

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
