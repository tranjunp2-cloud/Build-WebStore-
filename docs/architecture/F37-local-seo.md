---
owner: Dev
last_updated: 2026-08-05 (US-F37-04 Phase 3 implementation complete; external closeout pending)
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
    streetAddress?: string          // legacy fallback; not rendered in current Editor UI
    city?: string
    state?: string
    postcode?: string
    country?: string                // legacy persisted value; emitted country is implicitly MY
    latitude?: number
    longitude?: number
    businessCategory?: string     // broad seller-facing category
    schemaSubtype?: string        // compatible specific LocalBusiness subtype
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

The current Editor does not duplicate Street Address or Country inside Local Business Info. `site.contactInfo.address` is the canonical seller-edited street-address source; `localBusiness.streetAddress` remains a read-only legacy fallback for existing sites. Malaysia is the product default, so JSON-LD emits `addressCountry: "MY"` without rendering or requiring a Country control.

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
    "addressCountry": "MY"
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
- **@type selection:** Emit the validated `schemaSubtype`; when empty, emit generic `LocalBusiness`. `businessCategory` filters the subtype dropdown but never directly sets `@type`.
- **PostalAddress:** `contactInfo.address` is the canonical `streetAddress`; legacy `localBusiness.streetAddress` is used only when the canonical value is empty. City/state/postcode continue to come from `localBusiness`, blank optional sub-fields are omitted, and `addressCountry` is always the implicit Malaysia code `MY`.
- **GeoCoordinates:** Populated from seller's Maps link extraction (Phase 03 resolver) or manual lat/lng entry.
- **OpeningHoursSpecification:** Filtered array, excluding days marked `isClosed: true`. Day-of-week codes (Mo/Tu) mapped to Schema.org names (Monday/Tuesday). Empty array if no open hours provided.
- **priceRange:** Seller-entered value, or fallback heuristic per category.
- **areaServed:** Optional seller description.
- **No `aggregateRating`:** Intentionally omitted per Google 2025–26 policy (review aggregation not permitted at LocalBusiness level; only at Review/Product level).

#### `generateWebPageSchema(page, site)`
Emits `WebPage` schema (name, description, url, isPartOf) for non-homepage pages. Orthogonal to LocalBusiness. Breadcrumbs are a separate schema (`generateBreadcrumbSchema`), emitted independently for every page — not nested inside WebPage.

#### `generatePageSchemas(input)`
Orchestrator that calls the F37 generators (Organization/WebSite on homepage, WebPage on subpages, and LocalBusiness per the trigger below) and returns the aggregated schema array. Called by `SiteRenderer` at render time.

### Category Mapping: Two Separate Vocabularies

**File:** `src/lib/seo/schema-helpers.ts`

This codebase has two distinct category vocabularies — **DO NOT conflate them**:

#### AI-Gen Site Categories (F01)
Loose, human-friendly codes used by the AI site builder's composer:
- Input: `siteType` = 'restaurant', 'fnb', 'health', 'education', 'ecommerce', 'beauty', etc.
- Mapping: `schemaTypeFor(category)` → Schema.org @type
- Examples: 'restaurant' → 'Restaurant', 'health' → 'MedicalClinic', 'ecommerce' → 'Store'
- **Moved to `schema-helpers.ts`** from `json-ld-templates.ts` (Phase 04 refactor; no behavior change)

#### F37 Local Business Category → Subtype

- `businessCategory`: broad seller-facing category used to filter the next field.
- `schemaSubtype`: one primary, specific LocalBusiness type selected from the compatible dropdown.
- Source of truth: [`F37-local-business-subtype-mapping-v2.6.md`](./F37-local-business-subtype-mapping-v2.6.md), a versioned category→subtype mapping snapshot built from Google Local Business guidance and the Schema.org LocalBusiness hierarchy; never fetched at request time.
- Mapping validation is shared by Editor filtering and the save boundary. An incompatible pair is rejected server-side.
- Category change preserves a compatible subtype; otherwise clears it. Empty subtype emits `LocalBusiness` and earns no subtype points.
- `priceRangeForLocalBusinessCategory()` continues to derive only the price fallback from the broad category.

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
- `site.localBusiness` has meaningful legacy-compatible data (legacy street address OR non-closed opening hours), **OR**
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

## Phase 05: Authoritative Local SEO Score and Unified Dashboard

### Runtime scoring contract

**Files:** `src/lib/seo/local-seo-score.ts`, `src/lib/seo/local-seo-evaluation.ts`, `src/lib/seo/local-seo-score-contract.ts`

The runtime score is additive and exact: Business Data 20 + Schema 35 + AI Discoverability 15 + Technical Health 30 = 100. The authenticated response is runtime-validated and includes `score`, the four-bucket `breakdown`, every deduplicated seller-owned issue, `aiFixableItemCount`, `evaluatedAt`, and a SHA-256 `revisionToken`. Loading and error responses never invent a score.

| Bucket | Max | Composition |
|---|---:|---|
| Business Data | 20 | Name 7 + complete MY address 8 (`contactInfo.address` + city + postcode; country implicit) + phone 5 |
| Schema | 35 | LocalBusiness 10 + subtype 4 + hours 5 + geo 4 + telephone 3 + URL 3 + priceRange 3 + Organization 3 |
| AI Discoverability | 15 | Platform-allowed crawlers 9 + published/serializable sitemap 5 + published llms.txt 1 |
| Technical Health | 30 | Meta title coverage 8 + meta description coverage 8 + F03 Content Quality 8 + Technical SEO 6 |

Metadata coverage uses every eligible page, product, and blog. Technical SEO is Google verification 3 plus proportional indexability 3. Platform-managed crawler, Organization, and indexability signals affect the score but never become seller tasks.

### Stable, bounded evaluation

- The server-only evaluator uses explicit `select` projections for the site and each collection.
- Pages, products, and blogs are read deterministically by `createdAt,id`, 100 rows per page, with a 10,000-record safety ceiling per collection.
- Each evaluation accepts only a stable double-read snapshot. If the first verification differs, the verified snapshot is retried once; continued churn fails closed without a partial score.
- Tenant ownership is checked before evaluation and on every site snapshot. The route requires a matching **active** tenant membership; pending, suspended, missing, or cross-tenant membership returns 403 before collection reads.
- `TC-F37-04-19` locks a 1,001-page fixture to two site reads and exactly 28 collection queries across the two snapshots. This proves query shape and bounded pagination, not live p95 latency.

### API endpoint

`GET /api/sites/[siteId]/local-seo-score` is force-dynamic, `maxDuration = 60`, rate-limited to 30 requests per 60 seconds per user, and always returns `Cache-Control: private, no-store`. It returns 401/403/404/429/500 without leaking a stale or partial score.

Aggregate responses do not embed metadata records. `?detail=metadata&page=N&field=title|description` filters the complete metadata issue set by field **before** pagination, then returns at most the next 100 rows with the matching revision token. The Dashboard refuses a detail batch from a different revision.

### Unified Dashboard and actions

`SeoHealthClient` is the sole score owner on Dashboard > SEO. `SeoHealthCard` renders one gauge, four qualitative progress bars, and **all** deduplicated seller root causes; there is no Score History panel, second Local SEO card, Action Tools card, or max-three issue truncation. Latest-request-wins behavior prevents an older response from replacing a newer score.

Metadata title/description rows are actor `AI`; seller-owned rows are actor `You`. Action kinds are runtime-allowlisted and deep-link to the owning Editor settings field, Domains, publish flow, page content, or product image-alt destination. Search verification is emitted at the storefront metadata boundary and has a real Editor destination.

The AI strip appears only when metadata gaps exist. A run fetches one field-filtered next-100 detail page, sends only title/description records to the bounded proposal API, and keeps Local Business data out of both proposal and apply payloads. Proposal batches are capped at 100 with concurrency 4. The proposal endpoint accepts only `siteId`, `revisionToken`, and `missingSeo`; it applies user-wide limits of 20 requests per minute and 100 per hour plus per-site limits of 2 requests per minute and 10 per hour before evaluation or generation. The modal counts only fulfilled apply results by matching returned undo data. Undo uses a five-minute HMAC bound to the exact site, revision, and payload; a partial Undo returns a newly signed continuation containing only the remaining failed targets so the client can retry without reporting full success.

### Phase 3 verification boundary

The exact post-CAS state passes 701 Vitest files / 11,687 tests (one skipped file / three skipped baseline tests), typecheck, lint, `git diff --check`, and an isolated production build with 112/112 pages. Playwright discovers `f37-seo-health-regression → setup` plus four browser cases for Local Business desktop containment, score/action focus, bounded metadata proposal, and 375px touch/overflow behavior. Current-code authenticated execution remains blocked because the credential guard permits only exact `http://localhost:3000`, which is owned by another worktree. No live browser pass, fixture reset/checksum, p95 < 2 s, apply proof, canary/rollback, or Story Sync #1312 is claimed.

### Exported Types (API Surface)

**From `src/lib/seo/json-ld.ts`:** Phase 05 made 3 symbols public (previously internal to JSON-LD generators):

- **`LocalBusinessOpeningHour`:** Shape of one opening-hours array element:
  ```typescript
  { dayOfWeek?: string; opens?: string; closes?: string; isClosed?: boolean }
  ```

- **`LocalBusinessSiteData`:** Shape of entire `site.localBusiness` group field:
  ```typescript
  {
    streetAddress?: string; city?: string; state?: string; postcode?: string; country?: string; // street/country retained for legacy compatibility
    latitude?: number; longitude?: number;
    businessCategory?: string; schemaSubtype?: string; priceRange?: string; serviceAreaDescription?: string;
    openingHours?: LocalBusinessOpeningHour[];
  }
  ```

- **`hasMeaningfulLocalBusinessData(localBusiness: LocalBusinessSiteData | undefined): boolean`:** Legacy-compatible predicate used by the emission orchestrator. A legacy `localBusiness.streetAddress` can still activate output; current address generation and strict scoring prefer `contactInfo.address`, and opening hours can independently activate LocalBusiness output.

These types are imported and used by the score API route to type-check `site.localBusiness` as it extracts signals.

### Testing

`src/__tests__/unit/seo/local-seo-score.test.ts` and `src/__tests__/api/local-seo-score.test.ts` lock the active PRD §5 formula, all four bucket totals, authoritative signal extraction, root-cause deduplication, and affected-record counts.

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
- **TC-F37-01-08 (legacy):** Current direct category→`@type` mapping; replace with TC-F37-02-29..32 for the approved subtype-dropdown contract
- **TC-F37-01-09:** Homepage trigger: emits LocalBusiness from `site.localBusiness` alone (no Contact block required); dedupe when both present
- **TC-F37-01-12:** Day-of-week mapping (Mo→Monday, Tu→Tuesday, …, Su→Sunday via 7-test `it.each`)
- **Security (1 test):** XSS-safe JSON-LD serialization (escapes `</script>`, `<`, `>`, `&`)

#### Scoring Tests (`src/__tests__/unit/seo/local-seo-score.test.ts`)
- Legacy coverage only; replace with PRD §5 scorecard tests before enabling the unified Dashboard score.

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
- **US-F37-04 (Dashboard):** Implemented locally as the sole unified `SeoHealth` score surface; live fixture and release closeout remain pending.
- **F01 AI Gen:** Shares `src/lib/seo/schema-helpers.ts` mappings for AI-gen categories (read-only; no overlap with F37).

## Open Questions / Future Work

- **Phase 06 (QA):** Permanent test coverage for Phase 04 JSON-LD behaviors + Phase 05 route integration.
- **Technical Health:** Canonical 30-point contract is active locally; live latency evidence remains pending.
- **US-F37-04 (Local SEO Dashboard):** Implemented locally; pending current-code authenticated browser execution, live fixture execution, p95 evidence, Story Sync, and canary/rollback.
- **Multi-language support:** Checklist items + improvement hints (Phase 06+).
- **Structured data testing:** Google Search Console + Rich Results Test can validate emitted JSON-LD after deployment.

---

See also: `docs/CHANGELOG.md` (F37 Phase 03–05 entries), `docs/CODEBASE_SUMMARY.md` (SEO JSON-LD module summary), `docs/prd/F37-local-seo-search-performance.md` (feature spec + PRD §5 scoring formula).
