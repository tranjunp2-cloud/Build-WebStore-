---
owner: Dev
last_updated: 2026-07-07 (Phase 05 section added)
---

# F37 — Local Business Data Model (Local SEO)

## Overview

F37 enables sellers to enter and emit rich local business structured data to search engines, improving storefront discoverability for local searches, voice search, and AI assistant queries. The feature spans three phases:

1. **Phase 03** — UI data entry (seller accordion in AI Editor)
2. **Phase 04** — JSON-LD emission (structured data on homepage + site pages)
3. **Phase 05** — SEO scoring (performance diagnostics and improvement hints)

This document focuses on the **Phase 04 architecture** (JSON-LD emission), which is the technical core of the SEO payoff.

## Data Model

### Phase 03 Input: `Site.localBusiness`

Payload collection field (nested object) persists seller-entered data:

```typescript
type LocalBusinessSiteData = {
    streetAddress?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    latitude?: number
    longitude?: number
    businessCategory?: string     // e.g. 'foodEstablishment', 'medicalClinic'
    priceRange?: string          // e.g. '$$', '$$$'
    serviceAreaDescription?: string
    openingHours?: Array<{
        dayOfWeek?: string        // 'Mo', 'Tu', 'We', ... 'Su'
        opens?: string            // '09:00'
        closes?: string           // '17:00'
        isClosed?: boolean
    }>
}
```

Stored in `Sites` collection under the `localBusiness` group field (Payload schema, Phase 01 — `src/collections/Sites.ts`). Nested `openingHours` array persists to its own table (`sites_local_business_opening_hours`). Save-route validation via Zod (`localBusinessSchema` in `src/lib/validations/sites.ts`, Phase 02). Field is optional; existing sites without it are unaffected.

## Phase 04: JSON-LD Emission

### Core Generators

**File:** `src/lib/seo/json-ld.ts`

#### `generateOrganizationSchema(site)`
Emits base `Organization` schema with name, URL, logo, contact info, and social links (sameAs). Not dependent on local business data; applies to all sites.

#### `generateLocalBusinessSchema(contactBlock, site)`
**Extended in Phase 04** (pre-existed since F03; Phase 04 adds the structured-data fields below). Reads `site.localBusiness` internally — not a separate parameter. Emits rich `LocalBusiness` (or category-specific subtype) schema:

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",              // Category-derived, not generic LocalBusiness
  "name": "...",
  "url": "...",
  "telephone": "...",
  "email": "...",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "...",
    "addressLocality": "...",
    "addressRegion": "...",
    "postalCode": "...",
    "addressCountry": "..."
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 3.139,
    "longitude": 101.686
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Monday",
      "opens": "09:00",
      "closes": "17:00"
    },
    ...
  ],
  "priceRange": "$$",
  "areaServed": "Greater Kuala Lumpur area"
}
```

**Key behaviors:**
- **@type selection:** Derived from `businessCategory` enum (e.g. `foodEstablishment` → `Restaurant`). See category mappings below.
- **PostalAddress:** Full structure from `localBusiness` fields when `streetAddress` is set (sub-fields like `addressLocality`/`addressRegion` are omitted entirely, not emitted empty, when their source field is blank — conditional-spread pattern). Falls back to the legacy free-text `contactInfo.address` (bare `streetAddress` only) when `localBusiness.streetAddress` itself is empty — this REPLACES, not merges with, the legacy field once structured data exists (BR-02).
- **GeoCoordinates:** Populated from seller's Maps link extraction (Phase 03 resolver) or manual lat/lng entry.
- **OpeningHoursSpecification:** Filtered array, excluding days marked `isClosed: true`. Day-of-week codes (Mo/Tu) mapped to Schema.org names (Monday/Tuesday). Empty array if no open hours provided.
- **priceRange:** Seller-entered value, or fallback heuristic per category.
- **areaServed:** Optional seller description.
- **No `aggregateRating`:** Intentionally omitted per Google 2025–26 policy (review aggregation not permitted at LocalBusiness level; only at Review/Product level).

#### `generateWebPageSchema(page, site)`
Emits `WebPage` schema (name, description, url, isPartOf) for non-homepage pages. Orthogonal to LocalBusiness. Breadcrumbs are a separate schema (`generateBreadcrumbSchema`), emitted independently for every page — not nested inside WebPage.

#### `generatePageSchemas(input)`
Orchestrator that calls all generators (Breadcrumb, Organization/WebSite on homepage, WebPage on subpages, FAQPage if FAQ blocks present, LocalBusiness per the trigger below) and returns the aggregated schema array. Called by `SiteRenderer` at render time.

### Category Mapping: Two Separate Vocabularies

**File:** `src/lib/seo/schema-helpers.ts`

This codebase has two distinct category vocabularies — **DO NOT conflate them**:

#### AI-Gen Site Categories (F01)
Loose, human-friendly codes used by the AI site builder's composer:
- Input: `siteType` = 'restaurant', 'fnb', 'health', 'education', 'ecommerce', 'beauty', etc.
- Mapping: `schemaTypeFor(category)` → Schema.org @type
- Examples: 'restaurant' → 'Restaurant', 'health' → 'MedicalClinic', 'ecommerce' → 'Store'
- **Moved to `schema-helpers.ts`** from `json-ld-templates.ts` (Phase 04 refactor; no behavior change)

#### F37 Local Business Categories (Phase 03)
Pre-shaped Schema.org enum values, designed for 1:1 direct mapping:
- Input: `businessCategory` (enum in Phase 03 accordion) = 'localBusiness', 'store', 'restaurant', 'foodEstablishment', 'medicalClinic', 'professionalService', 'automotiveBusiness', 'homeAndConstructionBusiness', 'financialService', 'healthAndBeautyBusiness'
- Mapping: `schemaTypeForLocalBusiness(businessCategory)` → Schema.org @type
- Examples: 'foodEstablishment' → 'FoodEstablishment', 'medicalClinic' → 'MedicalClinic'
- Fallback: 'localBusiness' or unrecognized → 'LocalBusiness' (generic; Google accepts as valid fallback)

**Why separate?** The two paths (AI-gen and F37) use different input vocabularies designed for their respective UX contexts. Unifying them would require either:
1. Forcing AI-gen sellers to choose from Schema.org-shaped categories (poor UX), or
2. Storing F37's category as loose text and deriving it at emission time (error-prone)

The split design is intentional and correct.

### Integration: SiteRenderer

**File:** `src/components/site-renderer/SiteRenderer.tsx`

At page render time:
1. Detects blocks present on page (Contact, map, etc.)
2. Calls `generatePageSchemas()` with site + page + block data
3. Injects schema array into `<head>` via:
   ```tsx
   <script type="application/ld+json">
     {dangerouslySetInnerHTML: {__html: serializeJsonLd(schemas)}}
   </script>
   ```

**Loosened trigger (Phase 04):** LocalBusiness now emits whenever:
- `site.localBusiness` has meaningful data (street address OR non-closed opening hours), **OR**
- Contact block exists on page (pre-existing, unchanged)

Previously, LocalBusiness only appeared if a Contact block was present. This change allows standalone sites without Contact blocks to still emit LocalBusiness if sellers fill Phase 03's accordion.

## Security

### XSS Hardening: `serializeJsonLd()`

JSON-LD scripts are embedded via `dangerouslySetInnerHTML`. Tenant-controlled strings (address, hours, service area) can contain `</script>` substrings, breaking out of the script context and executing arbitrary JS (stored XSS).

**Defense:** `serializeJsonLd()` escapes dangerous characters in the JSON.stringify output:
- `<` → `<`
- `>` → `>`
- `&` → `&`
- U+2028, U+2029 (line/paragraph separators) → escaped

This is mandatory for safe embedding. Never use plain `JSON.stringify()` or template literals for JSON-LD injection.

## Phase 05: Local SEO Score Backend

### Scoring Engine

**File:** `src/lib/seo/local-seo-score.ts`

Exports `calculateLocalSeoScore(input: LocalSeoScoreInput): LocalSeoScoreResult` — a pure function implementing the points-subtraction model from PRD §13.8 (start 100, deduct for missing signals). Returns:
- `score`: integer 0–100 (clamped)
- `breakdown`: object with per-bucket scores for diagnostics

**Input:** business + structured + AI signals, plus F03 technical inputs (or precomputed `f03Technical` 0–100):
- 7 business data signals (businessName, address, phone, hours, category, website, description) — 5 pts each
- 4 structured data signals (localBusinessSchema, industrySubtype, faqSchema, orgSchema) with weighted deductions (10/5/8/7)
- 2 AI discoverability signals (allowsSearchBots, sitemapPresent) — 12/8 pts
- **Technical Health:** reuse F03 `calculateTechnicalSeoScore()` (OG image, Google verification, bad slugs, noIndex) then scale → 15 pts

**Bucket breakdown:**
| Bucket | Max | Composition |
|--------|-----|-------------|
| Business Data | 35 | 7 signals × 5 pts each |
| Structured Data | 30 | LocalBusiness schema 10 + industry subtype 5 + FAQ 8 + Organization 7 |
| AI Discoverability | 20 | allowsSearchBots 12 + sitemapPresent 8 |
| Technical Health | 15 | `floor(calculateTechnicalSeoScore(...) × 15 / 100)` — F03 signals only |
| **Total** | **100** | |

**Technical Health detail (Decision A, PM 2026-07-21):**

| F03 signal | Deduction on 0–100 scale | Cap |
|------------|--------------------------|-----|
| Missing `site.seo.ogImage` | −15 | — |
| Missing `site.seo.googleVerificationToken` | −10 | — |
| Bad page slug | −5 / slug | max −15 |
| `seo.noIndex` page | −5 / page | max −10 |

```
technicalHealth = floor(max(0, 100 − deductions) × 15 / 100)
```

**Do NOT** use CWV / mobileResponsive / httpsEnabled (removed — no real measurement; PRD previously misstated them). Same pure function as General SEO Technical pillar (`src/lib/seo/technical-score.ts`).

**Critical architectural decision (locked in code + tests):** AI Discoverability bucket is exactly `allowsSearchBots(12) + sitemapPresent(8)` with **no "blocks suspicious bots" sub-signal**. PRD §13.8 explicitly forbids this sub-signal because it contradicts BR-03 (the platform's default-allow policy for AI crawlers). A pre-implementation research proposal suggested a 10/5/5 split including that forbidden sub-signal; that approach was explicitly rejected and is NOT in shipping code. Test case TC-F37-01-11 validates this via type-level guarantee (`LocalSeoScoreInput` has no `blocksSuspiciousBots` field) + runtime assertion.

**Implementation note:** Code may still temporarily hardcode CWV/mobile/HTTPS until US-F37-04 wires F03 inputs — **target state is Decision A above**. Replace placeholders when implementing dashboard score surface.

### API Endpoint

**File:** `src/app/api/sites/[siteId]/local-seo-score/route.ts`

`GET /api/sites/[siteId]/local-seo-score` — auth-gated read-only endpoint. Returns `{ success: true, score, breakdown }`.

**Signal sourcing:**
- **businessName, address, phone, hours, category, website, description:** sourced from `site.name`, `site.localBusiness.*`, `site.contactInfo.*`, `site.seo.metaDescription`
- **localBusinessSchema:** calls `hasMeaningfulLocalBusinessData(site.localBusiness)` — true if `streetAddress` present OR has non-closed opening hours
- **industrySubtype:** true if `schemaTypeForLocalBusiness(businessCategory)` returns a specific type (not generic 'LocalBusiness')
- **faqSchema:** scans all site pages for FAQ blocks with items; true if any page has one
- **orgSchema:** always true (platform emits for all sites)
- **allowsSearchBots:** currently false (AI crawlers blocked by default until US-F37-03 ships); will become dynamic post-US-F37-03
- **sitemapPresent:** true if `site.status === 'published'` (sitemap route 404s for unpublished sites — real signal, not assumed)
- **Technical Health (Decision A):** call `calculateTechnicalSeoScore({ siteHasOgImage, siteHasGoogleVerification, pageSlugs, noIndexCount })` then `floor(score × 15 / 100)`. Source: `site.seo.ogImage`, `site.seo.googleVerificationToken`, pages `slug` + `seo.noIndex`. *(Legacy placeholder CWV/mobile/HTTPS must be removed when wiring this.)*

### Exported Types (API Surface)

**From `src/lib/seo/json-ld.ts`:** Phase 05 made 3 symbols public (previously internal to JSON-LD generators):

- **`LocalBusinessOpeningHour`:** Shape of one opening-hours array element:
  ```typescript
  { dayOfWeek?: string; opens?: string; closes?: string; isClosed?: boolean }
  ```

- **`LocalBusinessSiteData`:** Shape of entire `site.localBusiness` group field:
  ```typescript
  {
    streetAddress?: string; city?: string; state?: string; postcode?: string; country?: string;
    latitude?: number; longitude?: number;
    businessCategory?: string; priceRange?: string; serviceAreaDescription?: string;
    openingHours?: LocalBusinessOpeningHour[];
  }
  ```

- **`hasMeaningfulLocalBusinessData(localBusiness: LocalBusinessSiteData | undefined): boolean`:** Predicate used by scoring endpoint to detect when `site.localBusiness` has enough data to activate LocalBusiness JSON-LD emission (per Phase 04 loosened trigger). True if street address present OR has at least one non-closed opening hour.

These types are imported and used by the score API route to type-check `site.localBusiness` as it extracts signals.

### Testing

**File:** `src/__tests__/unit/seo/local-seo-score.test.ts`

- **TC-F37-01-10:** Acceptance Criterion AC-1 — score raises by ≥20 pts when address + hours + category + localBusinessSchema + industrySubtype are saved (tests the synergy of structured business data).
- **TC-F37-01-11:** Boundary + invariant tests:
  - Full input (all signals true) scores exactly 100
  - Empty input (all signals false) scores exactly 0
  - Score always within [0, 100]
  - Bucket breakdown sums exactly to total score
  - **Type-level + runtime validation:** AI Discoverability bucket is exactly 20 (allowsSearchBots 12 + sitemapPresent 8); no extra sub-signals present. Explicitly tests that the "blocks suspicious bots" sub-signal is NOT present (contradicts PRD §13.8 note + BR-03).

**Gap — defer to Phase 06:** The route handler's signal extraction logic (how it maps site fields to input booleans) was verified during implementation via temporary throwaway tests, deleted after use. Phase 06 (dedicated QA phase) should add permanent TC-ID-tagged integration tests for the route's end-to-end behavior.

## Phase 06: Testing

### Test Coverage Summary

**Test files:** 34 unit tests across 3 files, formalizing TC-IDs TC-F37-01-01..12. Full suite: 1301/1301 pass.

#### Validation Tests (`src/__tests__/unit/validations/sites-local-business.test.ts`)
- **TC-F37-01-01:** Latitude bounds (±90 enforcement)
- **TC-F37-01-02:** Longitude bounds (±180 enforcement)
- **TC-F37-01-03:** Malaysian postcode format (5-digit numeric)
- **TC-F37-01-04:** localBusiness-only PATCH acceptance via `.refine()`
- **Security (2 tests):** XSS sanitization in streetAddress and serviceAreaDescription

#### JSON-LD Emission Tests (`src/__tests__/unit/seo/local-business-json-ld.test.ts`)
- **TC-F37-01-05:** Full PostalAddress + GeoCoordinates + priceRange emission
- **TC-F37-01-06:** OpeningHoursSpecification excludes closed days (`isClosed: true`)
- **TC-F37-01-07:** No `aggregateRating` key (Google 2025–26 policy compliance)
- **TC-F37-01-08:** Category-mapped @type (e.g. `foodEstablishment` → `FoodEstablishment`)
- **TC-F37-01-09:** Homepage trigger: emits LocalBusiness from `site.localBusiness` alone (no Contact block required); dedupe when both present
- **TC-F37-01-12:** Day-of-week mapping (Mo→Monday, Tu→Tuesday, …, Su→Sunday via 7-test `it.each`)
- **Security (1 test):** XSS-safe JSON-LD serialization (escapes `</script>`, `<`, `>`, `&`)

#### Scoring Tests (`src/__tests__/unit/seo/local-seo-score.test.ts`)
- **TC-F37-01-10:** ≥20pt score gain when address + hours + category + localBusinessSchema + industrySubtype are saved (AC-1)
- **TC-F37-01-11:** Bounded 0..100; bucket breakdown sum validation; no "blocks suspicious bots" sub-signal (PRD §13.8 design decision locked in code + tests)

### Test Execution

```bash
npm test -- sites-local-business         # Phase 02 validation (11 tests)
npm test -- local-business-json-ld       # Phase 04 emission (17 tests)
npm test -- local-seo-score              # Phase 05 scoring (6 tests)
npm test                                 # Full suite (1301/1301)
```

### Coverage

- 100% of new functions: `saveSiteSchema.localBusiness`, `generateLocalBusinessSchema()`, `generatePageSchemas()`, `calculateLocalSeoScore()`, `dayOfWeekToSchema()`, `serializeJsonLd()`, `hasMeaningfulLocalBusinessData()`
- XSS hardening verified at both layers (Zod validation, JSON-LD serialization)
- No aggregateRating bloat
- Architectural decision ("no blocks suspicious bots") validated via type-level + runtime assertions

### QA Documentation

**File:** `docs/qa/F37-local-seo.md`

Formalizes 12 TC-IDs with Acceptance Criteria (AC) / Functional Requirement (FR) cross-references, test file locations, execution commands, and known limitations (Technical Health signal hardcoding flagged for PM review before US-F37-04 dashboard ships).

## Related Features

- **Phase 03 (Data Entry):** Seller form in `src/components/editor/SettingsPanel.tsx`. Maps resolver at `POST /api/local-seo/resolve-maps-link`.
- **Phase 04 (JSON-LD Emission):** Covered above.
- **Phase 05 (Scoring):** Covered above.
- **Phase 06 (Testing):** Covered above. 34 unit tests, permanent TC-ID-tagged coverage for all behaviors.
- **US-F37-04 (Dashboard):** Not yet implemented. Will consume `GET /api/sites/[siteId]/local-seo-score` to display score + checklist widget.
- **F01 AI Gen:** Shares `src/lib/seo/schema-helpers.ts` mappings for AI-gen categories (read-only; no overlap with F37).

## Open Questions / Future Work

- **Phase 06 (QA):** Permanent test coverage for Phase 04 JSON-LD behaviors + Phase 05 route integration.
- **Technical Health (RESOLVED Decision A):** Reuse F03 `technical-score.ts` (OG, Google verification, slugs, noIndex) scaled to 15pts. No Lighthouse/CWV. Code still needs rewiring off CWV placeholders.
- **US-F37-04 (Local SEO Dashboard):** Consumer UI for score + actionable checklist.
- **Multi-language support:** Checklist items + improvement hints (Phase 06+).
- **Structured data testing:** Google Search Console + Rich Results Test can validate emitted JSON-LD after deployment.

---

See also: `docs/CHANGELOG.md` (F37 Phase 03–05 entries), `docs/CODEBASE_SUMMARY.md` (SEO JSON-LD module summary), `docs/prd/F37-local-seo-search-performance.md` (feature spec + PRD §13.8 scoring formula).
