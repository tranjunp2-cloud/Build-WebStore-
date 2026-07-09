# QA Test Plan — F37 Local Business Data Model (Local SEO)

> **Version:** 1.1 | **Updated:** 2026-07-07 (pre-commit adversarial review, cycle 2 — added TC-F37-01-13/14 regression tests) | **Owner:** QA Team
> **PRD ref:** [`docs/prd/F37-local-seo-search-performance.md`](../prd/F37-local-seo-search-performance.md) v2.0
> **Stories ref:** [`docs/stories/F37-local-seo-stories.md`](../stories/F37-local-seo-stories.md) (US-F37-01)
> **Architecture ref:** [`docs/architecture/F37-local-seo.md`](../architecture/F37-local-seo.md)

### Changelog

- **v1.1 (2026-07-07)** — Pre-commit `/code-review` adversarial pass (2 cycles) found `local_business_data_saved` polluting seller-facing traffic dashboards. Cycle 1 fixed the (later found to be orphaned) `analytics/summary/route.ts`. Cycle 2's re-review caught that the actual LIVE dashboard path (`src/lib/dashboard/traffic-data.ts`) was still exposed via its ungated Top Referrers aggregation — fixed there too, with defense-in-depth. Added **TC-F37-01-13/14** (§3.4). 14 TC-IDs, 38 tests total.
- **v1.0 (2026-07-07)** — Phase 06 complete. Formalized 12 TC-IDs (TC-F37-01-01..12) from unit tests across 3 test files: `src/__tests__/unit/validations/sites-local-business.test.ts` (4 TCs + 2 security), `src/__tests__/unit/seo/local-business-json-ld.test.ts` (6 TCs + 1 security), `src/__tests__/unit/seo/local-seo-score.test.ts` (2 TCs). All 34 tests passing (1301/1301 in full suite). XSS hardening verified; no aggregateRating bloat; Tech Health signals flagged for PM review before US-F37-04 dashboard ships.

---

## 1. Objective

Comprehensive test coverage for **F37 Local Business Data Model**, spanning:

- **Phase 02 (Data Validation):** Zod schema validation for seller-entered local business fields (lat/lng range, postcode format, structured address)
- **Phase 04 (JSON-LD Emission):** Structured data output on homepage + subpages (PostalAddress, GeoCoordinates, OpeningHoursSpecification, category-mapped @type, priceRange, no aggregateRating)
- **Phase 05 (Local SEO Score Backend):** Points-subtraction scoring engine (100 baseline, 4 buckets: Business Data 35pts, Structured Data 30pts, AI Discoverability 20pts, Technical Health 15pts)

**12 TC-IDs** cover:
- Zod schema boundary cases (AC-3 geolocation/postcode validation)
- JSON-LD richness (AC-1 PostalAddress, AC-2 opening-hours filtering, AC-1 homepage trigger)
- Category-specific schema types (FR-04 @type mapping)
- Security hardening (XSS sanitization, safe JSON-LD serialization)
- Score bounds and bucket correctness (AC-1 ≥20pt gain, FR-10 0..100 bounds)

**Out of scope:** US-F37-04 (Local SEO Score Dashboard UI), US-F37-02 (GBP OAuth), US-F37-03 (AI Crawler Allowlist), multi-language improvement hints.

---

## 2. Test Environment

| Item | Spec |
|---|---|
| Framework | Vitest (unit tests only — no E2E) |
| Test files | 3 files in `src/__tests__/unit/` |
| Execution | `npm test` (full suite 1301/1301 tests pass) |
| Coverage | 100% on new functions/branches (saveSiteSchema, generateLocalBusinessSchema, generatePageSchemas, calculateLocalSeoScore, dayOfWeekToSchema, serializeJsonLd, hasMeaningfulLocalBusinessData) |
| Test data | Fixtures with real Malaysia geolocation (Petaling Jaya), opening hours, and business categories |
| Security | XSS payloads (</script>, <img onerror>, <script>alert) tested; sanitization verified |

---

## 3. Test Cases (Traceability Matrix)

Format: `TC-F37-01-NN | AC/FR | Type | Title | Test File | Assertions`

Legend: **AC** = Acceptance Criterion | **FR** = Functional Requirement | **Type** = `Func` (functional) / `Sec` (security) / `Edge` (boundary) | **Impact** = User-facing or backend-only

---

### 3.1 Phase 02: Zod Validation (saveSiteSchema.localBusiness)

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-01** | AC-3 | Edge | Latitude out of range (±90 bounds) | `sites-local-business.test.ts` lines 10–20 | Rejects latitude=200 (>90). Accepts latitude=3.1469 (in range). | Input validation; blocks invalid geo data |
| **TC-F37-01-02** | AC-3 | Edge | Longitude out of range (±180 bounds) | `sites-local-business.test.ts` lines 24–34 | Rejects longitude=-181 (<-180). Accepts longitude=101.6955 (in range). | Input validation; blocks invalid geo data |
| **TC-F37-01-03** | AC-3 | Func | Malaysian postcode format (5-digit numeric) | `sites-local-business.test.ts` lines 38–53 | Rejects 'ABZ' (non-numeric). Accepts '50000' (5-digit). Rejects '5000' (4-digit). | Postcode format enforcement (Malaysia-specific) |
| **TC-F37-01-04** | AC-1 | Func | localBusiness-only PATCH passes validation | `sites-local-business.test.ts` lines 57–69 | Accepts `{ localBusiness: { streetAddress, city } }` (partial update). Rejects `{}` (empty body). | Allows incremental data entry without full payload |
| *Security* | — | Sec | XSS: </script> in streetAddress | `sites-local-business.test.ts` lines 73–83 | Strips `<script>` tags from `streetAddress` before save. Retains safe content ('123 Main St'). | Prevents stored XSS in address field |
| *Security* | — | Sec | XSS: <img onerror> in serviceAreaDescription | `sites-local-business.test.ts` lines 85–93 | Strips `<img src=x onerror=...>` from service area. No tag fragments remain. | Prevents stored XSS in description field |

---

### 3.2 Phase 04: JSON-LD Emission (generateLocalBusinessSchema, generatePageSchemas, dayOfWeekToSchema)

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-05** | AC-1 | Func | Full PostalAddress + geo + priceRange emission | `local-business-json-ld.test.ts` lines 33–48 | Emits complete PostalAddress (street/city/state/postcode/country). Includes GeoCoordinates (lat/lng). Includes priceRange ('$$'). Includes areaServed (service description). | Homepage now emits rich, search-engine-discoverable structured data |
| **TC-F37-01-06** | AC-2 | Func | Closed days filtered from openingHoursSpecification | `local-business-json-ld.test.ts` lines 52–60 | Array excludes Sat/Sun when `isClosed: true`. Only Monday entry remains in example. No Saturday/Sunday keys. | Prevents misleading opening hours for closed days |
| **TC-F37-01-07** | FR-06 | Edge | NO aggregateRating at LocalBusiness level | `local-business-json-ld.test.ts` lines 64–70 | `aggregateRating` key never present. Object keys don't include 'aggregateRating'. | Compliance with Google 2025–26 policy; prevents bloat |
| **TC-F37-01-08** | FR-04 | Func | Category-mapped @type (e.g. foodEstablishment → FoodEstablishment) | `local-business-json-ld.test.ts` lines 74–85 | Maps 'foodEstablishment' → @type 'FoodEstablishment' (not generic 'LocalBusiness'). Falls back to generic 'LocalBusiness' when category absent. | Schema.org sub-type improves search engine understanding |
| **TC-F37-01-09** | AC-1 | Func | Homepage trigger: emits LocalBusiness from localBusiness data alone (no Contact block) | `local-business-json-ld.test.ts` lines 89–119 | Homepage emits FoodEstablishment when `site.localBusiness` present, even without Contact block. Non-homepage rejects LocalBusiness (no Contact, no localBusiness). Exactly ONE LocalBusiness when both present (dedupe). | Loosened trigger: sellers can emit LocalBusiness without Contact block |
| **TC-F37-01-12** | AC-2 | Edge | Day-of-week mapping: Mo→Monday, Tu→Tuesday, … Su→Sunday (7 variants) | `local-business-json-ld.test.ts` lines 124–135 | Tests all 7 day codes via `it.each`. Unrecognized codes ('XX', undefined) return null, not fabricated strings. | Opening hours day names match Schema.org spec |
| *Security* | — | Sec | XSS: </script> escaped in JSON-LD serialization | `local-business-json-ld.test.ts` lines 139–146 | Serialized JSON escapes `</script>` as `\\u003c/script\\u003e`. Prevents breakout from dangerouslySetInnerHTML. | Safe embedding of tenant-controlled strings in <script> tag |

---

### 3.3 Phase 05: Local SEO Score Calculation (calculateLocalSeoScore)

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-10** | AC-1 | Func | Score raises ≥20 pts when business data saved | `local-seo-score.test.ts` lines 31–44 | Compares a bare-site score to the same input with address+hours+category+localBusinessSchema+industrySubtype added. Asserts `(after.score - before.score) >= 20` — delta only, not coupled to exact baseline/after values (deliberate, per plan's own risk mitigation against weight-coupling). | Incentivizes sellers to complete local business profile |
| **TC-F37-01-11** | FR-10 | Edge | Score bounded 0..100; bucket breakdown sum correct | `local-seo-score.test.ts` lines 48–74 | Full input scores exactly 100. Empty input scores exactly 0 (never negative). Arbitrary partial input within [0, 100]. Bucket sum (businessData + structuredData + aiDiscoverability + technicalHealth) = total score. NO "blocks suspicious bots" sub-signal present (type-level + runtime check on aiDiscoverability = 20 = allowsSearchBots(12) + sitemapPresent(8)). | Score accurately reflects completion; prevents overflow; validates PRD §13.8 architecture decision |

---

### 3.4 Cross-feature regression: analytics dashboard pollution (found during pre-commit adversarial review)

`local_business_data_saved` (Phase 03's analytics event) was found to pollute seller-facing traffic dashboards — counted as a "view"/pageview and its editor referrer leaking into "Top Referrers". An earlier fix attempt using `isOwner: true` on the `trackEvent()` call was reverted — it silently killed the event's delivery entirely instead of just hiding it from dashboards, defeating F37's own feature-adoption tracking purpose.

Two dashboard code paths read the shared `analytics` collection:
- `src/app/api/analytics/summary/route.ts` — confirmed **orphaned** (no live caller found anywhere in `src`; superseded by the dashboard revamp below, left behind after that refactor). Fixed anyway as a defensive measure in case of an undiscovered external consumer — harmless either way.
- `src/lib/dashboard/traffic-data.ts` — the **actual live path**, called directly by `src/app/(dashboard)/dashboard/page.tsx`. Its views/pageview counts and Top Pages were already safe (allow-list `event: { equals: 'pageview' }` matching), but its **Top Referrers aggregation ran on every doc regardless of event type** — the real, live exposure. Fixed at both the query level (`where.event.not_in`) and with a defense-in-depth per-doc loop guard (`if (internalEvents.includes(doc.event)) continue`), so a single weakened filter layer can't reintroduce the leak.

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-13** | Regression | Sec/Data | `local_business_data_saved` excluded from orphaned `analytics/summary` route aggregation | `src/__tests__/unit/dashboard/api-summary.test.ts` (`GET /api/analytics/summary` describe block) | Both current- AND previous-period views-count queries (`payload.count`) exclude `local_business_data_saved` from their `where.event.not_in` filter; the doc-list query (`payload.find`) also excludes it. Manually verified red→green. | Defensive fix on a route with no confirmed live caller — see §3.4 note |
| **TC-F37-01-14** | Regression | Sec/Data | `local_business_data_saved` excluded from the LIVE `getTrafficData()` dashboard path (query + defense-in-depth loop guard) | `src/__tests__/unit/dashboard/traffic-data.test.ts` | (1) `payload.find`'s `where.event.not_in` includes `local_business_data_saved`. (2) Even if a misbehaving/mocked query still returned such a doc, the loop-level guard prevents its referrer from reaching `top.referrers`. Both assertions manually verified red→green. | Prevents the seller's own editor activity from polluting the real, user-facing Top Referrers widget |

---

## 4. Test File Locations & Execution

### 4.1 Validation Tests (Phase 02)

**File:** `src/__tests__/unit/validations/sites-local-business.test.ts`

**Test count:** 11 tests (4 functional + 2 security + 5 refine-check variants)

**Command:** `npm test -- sites-local-business`

**TC-IDs covered:** TC-F37-01-01 through TC-F37-01-04, plus 2 security

---

### 4.2 JSON-LD Tests (Phase 04)

**File:** `src/__tests__/unit/seo/local-business-json-ld.test.ts`

**Test count:** 17 tests (6 functional + 1 security + 10 day-mapping variants via `it.each`)

**Command:** `npm test -- local-business-json-ld`

**TC-IDs covered:** TC-F37-01-05, TC-F37-01-06, TC-F37-01-07, TC-F37-01-08, TC-F37-01-09, TC-F37-01-12, plus 1 security

---

### 4.3 Score Tests (Phase 05)

**File:** `src/__tests__/unit/seo/local-seo-score.test.ts`

**Test count:** 6 tests (1 functional + 5 edge/validation)

**Command:** `npm test -- local-seo-score`

**TC-IDs covered:** TC-F37-01-10, TC-F37-01-11

---

## 5. Known Limitations & PM Review Items

### Technical Health Signals (Hardcoded Placeholders)

**Status:** Phase 05 implementation used assume-passing values for 3 Technical Health signals:
- `coreWebVitals` → hardcoded 80 (no real Lighthouse measurement)
- `mobileResponsive` → hardcoded true (no real mobile audit)
- `httpsEnabled` → hardcoded true (no real verification)

**Impact:** Score calculation is correct per PRD §13.8 formula, but accuracy is overstated (every site gets +15 free Technical Health points). 

**Flagged for:** Before US-F37-04 dashboard surfaces this score to sellers, PM should decide:
1. Keep assume-passing (current; no infrastructure cost, but overstates accuracy)
2. Implement real Lighthouse/CWV measurement (adds dependency, more accurate)
3. Apply PRD §13.8's "earned/applicable" normalization pattern (reweight buckets based on what's measurable per-site)

See `docs/architecture/F37-local-seo.md` § "Known limitation — flagged for Phase 06 PM review" for full context.

---

## 6. Security & Compliance

### XSS Hardening

- **Zod schema:** Strips HTML/script tags from seller-entered strings (streetAddress, serviceAreaDescription) before persistence
- **JSON-LD serialization:** `serializeJsonLd()` escapes dangerous characters (`<`, `>`, `&`, line/paragraph separators) before `dangerouslySetInnerHTML` injection
- **Test coverage:** TC-Security tests verify both layers (validation sanitization, serialization escaping)

### No aggregateRating

- Per Google 2025–26 policy, LocalBusiness schemas must not include `aggregateRating` (review aggregation only at Review/Product level)
- TC-F37-01-07 explicitly asserts this key never appears
- Prevents non-compliance with search engine guidelines

### AI Crawler Policy Compliance

- AI Discoverability bucket designed per PRD §13.8 without "blocks suspicious bots" sub-signal (contradicts BR-03 default-ALLOW policy)
- TC-F37-01-11 validates this design via type-level guarantee + runtime assertion
- Prevents accidental reversion when Phase 2 (GBP OAuth) lands

---

## 7. Related Documentation

- **Architecture:** `docs/architecture/F37-local-seo.md` (full technical design, Phase 04/05 details, security analysis)
- **PRD:** `docs/prd/F37-local-seo-search-performance.md` (feature spec, scoring formula §13.8, acceptance criteria)
- **Changelog:** `docs/CHANGELOG.md` (Phase 03–05 releases, US-F37-01 entry)
- **Code Standards:** `docs/standards/CODE_STANDARDS.md` (Zod schema patterns, JSON-LD best practices)

---

## 8. Test Execution Status

| File | Tests | Status | Coverage | Notes |
|---|---|---|---|---|
| `sites-local-business.test.ts` | 11 | ✅ PASS | 100% of saveSiteSchema.localBusiness | Zod schema + security |
| `local-business-json-ld.test.ts` | 17 | ✅ PASS | 100% of generateLocalBusinessSchema, generatePageSchemas, dayOfWeekToSchema, serializeJsonLd | JSON-LD + trigger logic + XSS |
| `local-seo-score.test.ts` | 6 | ✅ PASS | 100% of calculateLocalSeoScore | Scoring logic + bounds |
| **Total** | **34** | ✅ **PASS** | **100%** | Phase 06 complete; full suite 1301/1301 pass |

---

**Last Verified:** 2026-07-07 (all source code + test files read; field names, function signatures, and TC-ID mappings verified against actual code)
