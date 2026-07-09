# QA Test Plan — F37 Local SEO & Search Performance (Phase 1)

> **Version:** 2.1 | **Updated:** 2026-07-09 | **Owner:** QA Team
> **PRD ref:** [`docs/prd/F37-local-seo-search-performance.md`](../prd/F37-local-seo-search-performance.md) v2.0
> **Stories ref:** [`docs/stories/F37-local-seo-stories.md`](../stories/F37-local-seo-stories.md) (US-F37-01..09)
> **Architecture ref:** [`docs/architecture/F37-local-seo.md`](../architecture/F37-local-seo.md)

### Changelog

- **v2.1 (2026-07-09)** — `/qa-full:check` verify + gap-fill. Đọc code thật (`map-links.ts`, `resolve-maps-link/route.ts`, `local-seo-score/route.ts`, `json-ld.ts`) + ck:scenario 12-dimension. Thêm §3.10 (16 TC: TC-F37-02-10/11, 04-15/16, 08-12/13/14, 09-17..25) phủ branch bỏ sót ở surface built-nhưng-chưa-test: `parseMapLink` pin-out-of-range fallthrough + boundary, `resolve-maps-link` SSRF (relative Location re-check, 3xx-no-Location, url+address precedence, neither→400), score API 403-null-tenant + faq-empty-not-earned, `serializeJsonLd` U+2028/2029, incomplete-hours drop, `parseAddress` part-count, metadata length boundary. Baseline F37 tests: 6 files / 80 pass. Tổng **89 TC-ID**.
- **v2.0 (2026-07-09)** — Mở rộng scope từ chỉ US-F37-01 → **toàn bộ Phase 1** (US-01,02,03,04,08,09). Thêm §3.5–§3.9 (TC-F37-02/03/04/08/09-NN). Dựa trên 2 vòng review song song (requirements + code-reality scan). Đánh dấu trạng thái implementation: **US-02/US-08 FULLY BUILT** (bổ sung TC generator/branch chưa test), **US-04/US-09 PARTIAL** (ưu tiên API route + parser **built-nhưng-chưa-test**: `local-seo-score` API, `resolve-maps-link` SSRF, `parseMapLink`), **US-03 NOT-BUILT** (llms.txt + per-site toggle chưa có; robots.txt đang chặn AI bot NGƯỢC spec — TC spec-based + flag §9 #2). Waze/Halal (US-09) + checklist one-click (US-04) đánh `[NOT-BUILT]`. hreflang (AC-20) DEFERRED, không viết TC.
- **v1.1 (2026-07-07)** — Pre-commit `/code-review` adversarial pass (2 cycles) found `local_business_data_saved` polluting seller-facing traffic dashboards. Cycle 1 fixed the (later found to be orphaned) `analytics/summary/route.ts`. Cycle 2's re-review caught that the actual LIVE dashboard path (`src/lib/dashboard/traffic-data.ts`) was still exposed via its ungated Top Referrers aggregation — fixed there too, with defense-in-depth. Added **TC-F37-01-13/14** (§3.4). 14 TC-IDs, 38 tests total.
- **v1.0 (2026-07-07)** — Phase 06 complete. Formalized 12 TC-IDs (TC-F37-01-01..12) from unit tests across 3 test files: `src/__tests__/unit/validations/sites-local-business.test.ts` (4 TCs + 2 security), `src/__tests__/unit/seo/local-business-json-ld.test.ts` (6 TCs + 1 security), `src/__tests__/unit/seo/local-seo-score.test.ts` (2 TCs). All 34 tests passing (1301/1301 in full suite). XSS hardening verified; no aggregateRating bloat; Tech Health signals flagged for PM review before US-F37-04 dashboard ships.

---

## 1. Objective

Test coverage cho **F37 Local SEO — Phase 1** (6 story không phụ thuộc Google connection): US-F37-01, 02, 03, 04, 08, 09.

| Story | Nội dung | Trạng thái code |
|---|---|---|
| **US-F37-01** | Local Business Data Model (Zod validation + geo/postcode) | ✅ BUILT + tested (§3.1–3.4) |
| **US-F37-02** | Enhanced LocalBusiness JSON-LD (PostalAddress, geo, hours, @type, priceRange, no aggregateRating) | ✅ BUILT (§3.5) |
| **US-F37-03** | AI Crawler permissions + llms.txt | 🔴 NOT BUILT (§3.6) |
| **US-F37-04** | Local SEO Score + Actionable Checklist | 🟡 PARTIAL — engine+API built, checklist chưa (§3.7) |
| **US-F37-08** | Auto SEO/AEO Generation (metadata fallback + FAQPage + scope isolation) | ✅ BUILT (§3.8) |
| **US-F37-09** | Malaysia opt (MY geo/state, Waze, Halal) | 🟡 PARTIAL — geo built; Waze/Halal chưa (§3.9) |

### Legend — Implementation status marker

- `[BUILT]` — code có + đã có test (chỉ cần regression/verify)
- `[UNTESTED]` — code **đã có nhưng chưa có test** → **ưu tiên QA cao nhất** (API route, parser, component)
- `[NOT-BUILT]` — chưa implement → TC spec-based, dùng làm acceptance khi build
- **Type** = `Func` / `Sec` (security/auth) / `Edge` (boundary) · **Impact** = user-facing / backend

**Out of scope:** Phase 2 (US-F37-05 GBP Connect, US-06 Google Activity, US-07 Info Diff — cần GBP OAuth chưa build) · hreflang (AC-20, DEFERRED P2) · SERP-impact assertions (không kiểm thứ hạng thật).

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

## 3.5 US-F37-02: Enhanced LocalBusiness JSON-LD **[FULLY BUILT]**

> Code: `src/lib/seo/json-ld.ts` + `src/lib/seo/schema-helpers.ts`. Core generators đã test (TC-F37-01-05..12). TC dưới nhắm **surface chưa test** (breadcrumb/website/webpage generators, geo edge, aggregator resilience). `[UNTESTED]` = code có nhưng chưa có test.

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-02-01** | AC-3 | Func | `generateBreadcrumbSchema` — slug `encodeURIComponent`, home-slug skip | `json-ld.ts` `[UNTESTED]` | BreadcrumbList itemListElement đúng thứ tự; slug có ký tự đặc biệt được encode; trang home KHÔNG tự thêm crumb trùng. | Breadcrumb rich result |
| **TC-F37-02-02** | AC-3 | Func | `generateWebSiteSchema` chỉ emit ở homepage | `json-ld.ts` `[UNTESTED]` | WebSite schema có ở homepage, vắng ở subpage; url = site root. | Sitelinks searchbox eligibility |
| **TC-F37-02-03** | AC-3 | Func | `generateWebPageSchema` fallback `seo.title`→`page.name` + home URL | `json-ld.ts` `[UNTESTED]` | WebPage.name lấy seo.title, thiếu thì page.name; home-slug ra URL gốc (không `/home`). | Per-page schema đúng |
| **TC-F37-02-04** | AC-3 / NFR | Edge | `generatePageSchemas` resilience — 1 block throw KHÔNG crash trang | `json-ld.ts` `[UNTESTED]` | try/catch: 1 generator ném lỗi thì các schema khác vẫn emit, trang không 500. | Robustness storefront |
| **TC-F37-02-05** | FR-04 | Edge | `priceRangeForLocalBusinessCategory` per-category branch | `schema-helpers.ts` `[UNTESTED]` | Mỗi businessCategory ra priceRange đúng (vd food `$$`); category lạ → default. | priceRange chính xác |
| **TC-F37-02-06** | AC-3 | Edge | geo omit khi chỉ có 1 trong lat/lng finite | `json-ld.ts` `[UNTESTED]` | Chỉ lat (thiếu lng) → KHÔNG emit GeoCoordinates (không phần tử null/nửa vời). | Invalid geo không lọt schema |
| **TC-F37-02-07** | BR-02 | Edge | Address precedence: `localBusiness.streetAddress` ưu tiên, fallback `contactInfo.address` | `json-ld.ts` | streetAddress có → dùng; rỗng → fallback contact block. | Address đúng nguồn |
| **TC-F37-02-08** | BR-11 | Func | telephone format `+60 12 345 6789` trong schema | `json-ld.ts` | telephone chuẩn hoá E.164-ish MY trong JSON-LD. | NAP consistency |
| **TC-F37-02-09** | AC-3 | Func | Full LocalBusiness schema — Rich Results validator 0 error | manual/validator | @context/@type hợp lệ, đủ address+geo+hours+priceRange+areaServed, 0 error trên Google Rich Results Test. | Search discoverability (E2E validate) |

---

## 3.6 US-F37-03: AI Crawler Permissions & llms.txt **[NOT BUILT — spec-based]**

> **🔴 BLOCKER / SPEC CONFLICT** — TC section này **chưa chạy được**, code chưa build đúng spec:
> - `src/app/sites/[slug]/robots.txt/route.ts` hiện **hardcode `Disallow: /`** cho 9 AI bot (GPTBot, ClaudeBot, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended, meta-externalagent, CloudflareBrowserRenderingCrawler) — **NGƯỢC** với US-03 "default ALLOW" (BR-03).
> - **KHÔNG có** route `llms.txt`. **KHÔNG có** field per-site toggle (`ai_crawlers_enabled`). Score engine hardcode `allowsSearchBots: false` "until US-F37-03 ships".
> - TC spec-based, đánh dấu `[NOT-BUILT]` — dùng làm acceptance spec khi implement. **Xem §9 câu hỏi #2.**

| ID | AC/FR | Type | Title | Status | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-03-01** | AC-4 | Func | Default robots.txt **ALLOW** AI bot (no `Disallow: /` cho GPTBot/ClaudeBot/Google-Extended/CCBot) | `[NOT-BUILT]` | Tenant mới → robots.txt KHÔNG chặn AI bot chính. | BR-03 default open |
| **TC-F37-03-02** | FR-07 | Func | Field `ai_crawlers_enabled` boolean default `true` trên Sites | `[NOT-BUILT]` | Schema default true; migration entry (NFR-9). | Toggle backend |
| **TC-F37-03-03** | AC-5 | Func | Seller opt-out OFF → robots.txt inject `Disallow: /` cho AI UA | `[NOT-BUILT]` | Toggle off → Disallow xuất hiện cho GPTBot/ClaudeBot/Google-Extended/PerplexityBot/CCBot. | Opt-out hoạt động |
| **TC-F37-03-04** | AC-5 | Func | Opt-out KHÔNG chặn Googlebot/Bingbot | `[NOT-BUILT]` | Search bot thường vẫn crawl bình thường. | SEO không vỡ |
| **TC-F37-03-05** | AC-6 | Func | `GET /llms.txt` → 200 `text/plain` | `[NOT-BUILT]` | Route tồn tại, status 200, MIME text/plain. | AEO signal |
| **TC-F37-03-06** | AC-6 | Func | llms.txt content: tên, mô tả, ≥5 URL, contact, giờ, markdown | `[NOT-BUILT]` | Đủ element cấu trúc markdown. | llms.txt hợp lệ |
| **TC-F37-03-07** | BR-09 | Func | llms.txt runtime-generated, cache ngắn | `[NOT-BUILT]` | Không long-cache; phản ánh data mới. | Freshness |
| **TC-F37-03-08** | NFR-3 | Sec | Toggle per-site isolated (site A opt-out ≠ site B) | `[NOT-BUILT]` | robots.txt site B không đổi khi site A toggle. | Cross-tenant isolation |
| **TC-F37-03-09** | Conflict | Sec | **Current robots.txt chặn 9 AI bot (ngược spec)** — confirm interim vs bug | `robots.txt/route.ts` | Ghi nhận hành vi hiện tại; PM chốt default-allow vs block trước implement. | **Spec conflict flag** |

---

## 3.7 US-F37-04: Local SEO Score & Checklist **[PARTIAL — engine+API built, checklist NOT built]**

> Code: engine `src/lib/seo/local-seo-score.ts` (đã test TC-F37-01-10/11), API `src/app/api/sites/[siteId]/local-seo-score/route.ts` (**chưa test** — giá trị QA cao). Widget checklist one-click-fix (US-04 core) **chưa build** (chỉ có `completion-checklist.tsx` tối giản của US-01).

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-04-01** | FR-10 | Sec | Score API — unauth → 401 | `route.ts` `[UNTESTED]` | GET không session → 401. | Auth gate |
| **TC-F37-04-02** | FR-10 | Sec | Score API — cross-tenant → 403 | `route.ts` `[UNTESTED]` | User khác tenant xin score siteId khác → 403 (ownership check). | IDOR guard |
| **TC-F37-04-03** | FR-10 | Edge | Score API — rate-limit 30/60s → 429 | `route.ts` `[UNTESTED]` | Request thứ 31 trong 60s → 429. | Abuse guard |
| **TC-F37-04-04** | FR-10 | Edge | Score API — site không tồn tại → 404 | `route.ts` `[UNTESTED]` | siteId sai → 404. | Error handling |
| **TC-F37-04-05** | FR-10 | Func | Score API — signal derivation (faqBlock, hours predicate, sitemapPresent từ published) | `route.ts` `[UNTESTED]` | faq detect across pages; hours khớp `hasMeaningful`; sitemapPresent = status published. | Điểm phản ánh data thật |
| **TC-F37-04-06** | FR-10 | Edge | Score API — lỗi nội bộ → 500 handler | `route.ts` `[UNTESTED]` | Exception → 500 sạch, không leak. | Resilience |
| **TC-F37-04-07** | AC-7 | Func | Engine — Business Data bucket 7×5 trừ điểm per field thiếu | `local-seo-score.ts` | Mỗi field thiếu −5 (tối đa 35). | Bucket đúng |
| **TC-F37-04-08** | AC-7 | Func | Engine — Structured Data: localBusinessSchema 10 / faq 8 / org 7 / subtype 5 | `local-seo-score.ts` | Weight từng signal đúng (tổng 30). | Bucket đúng |
| **TC-F37-04-09** | §13.8 | Func | Engine — score normalize earned/applicable ×100; Phase-2 bucket KHÔNG vào mẫu số | `local-seo-score.ts` | Phase-1 hoàn thành đạt 100; Phase-2 locked không kéo điểm xuống. | No-drop rule |
| **TC-F37-04-10** | AC-1 | Func | **[NOT-BUILT]** Empty site → score ≤30, checklist ≤3 item High | pending widget | Điểm ≤30 + tối đa 3 việc cần làm. | US-04 core UI |
| **TC-F37-04-11** | AC-2 | Func | **[NOT-BUILT]** One-click "Bật ngay" AI crawler → toggle + robots.txt + item Done + score↑ | pending (phụ thuộc US-03) | Full chain 1-click fix. | US-04 core UI |
| **TC-F37-04-12** | BR-10 | Func | **[NOT-BUILT]** Checklist tối đa 3 item, ẩn item done | pending widget | ≤3; done bị ẩn. | UX checklist |
| **TC-F37-04-13** | BR-07 | Func | Score recalc khi save site settings (GBP refresh max 1×/24h) | integration | Save → recompute; PostHog analytics KHÔNG ảnh hưởng score. | Freshness |
| **TC-F37-04-14** | AC-1 | Func | `completion-checklist.tsx` — addressDone cần đủ 4 field, hoursDone predicate | component `[UNTESTED]` | addressDone chỉ khi street+city+state+postcode; hoursDone khi có ≥1 ngày mở. | US-01 indicator đúng |

---

## 3.8 US-F37-08: Auto SEO/AEO Generation **[FULLY BUILT]**

> Code: `src/lib/ai/seo-generator.ts` + `src/lib/ai/json-ld-templates.ts` + `src/app/api/seo/analyze/route.ts`. Đã test (TC-F01-W.27..35). TC dưới nhắm branch chưa test + **scope isolation** (ranh giới bảo mật platform↔tenant). FAQPage sở hữu ở story này (dedup theo agent).

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-08-01** | AC-15 | Func | Empty SEO fields → `<head>` đủ title(50–60), desc(150–160), og:*, canonical | `seo-generator.ts` | Không tag thiếu; length trong bound. | Fallback metadata |
| **TC-F37-08-02** | AC-15 | Func | Auto-title KHÔNG "undefined"/rỗng, từ product+business name | `seo-generator.ts` | Không chuỗi "undefined", non-empty. | Không title rác |
| **TC-F37-08-03** | AC-15 | Edge | Không tag nào `content=""` hoặc vắng | `seo-generator.ts` | Mọi meta có content thực. | Chất lượng head |
| **TC-F37-08-04** | FR-24 | Edge | `parseAddress()` branch 1/2/3-phần, country default 'MY' | `json-ld-templates.ts` `[UNTESTED]` | Split đúng street/city/state; thiếu country → 'MY'. | Address parse đúng |
| **TC-F37-08-05** | AC-16 | Func | `generateFAQSchema` dedup Q trùng qua nhiều faq block + empty→null (SiteRenderer path) | `json-ld.ts` `[UNTESTED]` | Merge nhiều block, bỏ Q trùng; 0 item → null (không emit FAQPage rỗng). | FAQPage đúng |
| **TC-F37-08-06** | AC-16 | Func | Mỗi FAQ Q → `Question` + `acceptedAnswer`, validator 0 error | `seo-generator.ts` | Mapping đúng, schema hợp lệ. | AEO rich result |
| **TC-F37-08-07** | AC-17 | Sec | **Scope isolation** — platform route (`/`, `/dashboard`, `/admin`, `/api/v1/*`) KHÔNG dính F37 fallback/llms/crawler | integration | Platform head/robots không bị F37 chèn. | **Ranh giới bảo mật** |
| **TC-F37-08-08** | AC-17 | Sec | Platform `/llms.txt` → 404 (chỉ tenant storefront) | integration | Fetch domain platform /llms.txt → 404. | Isolation (llms chưa build) |
| **TC-F37-08-09** | AC-17 | Sec | Platform robots.txt KHÔNG bị F37 sửa | integration | Platform robots giữ nguyên. | Isolation |
| **TC-F37-08-10** | FR-22 | Func | `analysePage()` scoring branch (image-alt, word-count, no-contact-section) | `analyze/route.ts` | Mỗi issue type trừ điểm đúng + autoFixable flag. | SEO analyze chính xác |
| **TC-F37-08-11** | BR-14 | Func | auto-meta fallback pure, KHÔNG gọi AI, nhanh | `seo-generator.ts` | Non-async, no OpenAI call ở fallback path. | Perf/cost |

---

## 3.9 US-F37-09: Malaysia Market Optimization **[PARTIAL — geo built, Waze/Halal NOT built]**

> Code built: `src/lib/seo/map-links.ts` `parseMapLink()` (**chưa test**), `src/app/api/local-seo/resolve-maps-link/route.ts` (**chưa test — SSRF-critical**), `state-select.tsx` + editor components (chưa test), Sites.ts MY fields. **Chưa build:** Waze link, Halal cert schema, hreflang. `hreflang (FR-26/AC-20)` **DEFERRED P2** — KHÔNG viết TC.

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-09-01** | FR-25 | Func | `parseMapLink` ưu tiên pin `!3d!4d` hơn viewport `@` | `map-links.ts` `[UNTESTED]` | Link có cả pin+viewport → lấy pin. | Toạ độ chính xác |
| **TC-F37-09-02** | FR-25 | Edge | `parseMapLink` reject lat/lng ngoài range | `map-links.ts` `[UNTESTED]` | lat>90/lng>180 → null. | Không nhận geo rác |
| **TC-F37-09-03** | FR-25 | Edge | `parseMapLink` link rút gọn / malformed → null | `map-links.ts` `[UNTESTED]` | goo.gl/maps short + chuỗi lỗi → null (chờ layer-2 resolve). | Graceful |
| **TC-F37-09-04** | NFR-3 | Sec | `resolve-maps-link` unauth → 401 | `route.ts` `[UNTESTED]` | POST không session → 401. | Auth gate |
| **TC-F37-09-05** | NFR-3 | Sec | **SSRF host-allowlist** → host lạ → 400 | `route.ts` `[UNTESTED]` | Host không thuộc allowlist (google/goo.gl) → 400, không fetch. | **SSRF guard (blocker)** |
| **TC-F37-09-06** | NFR-3 | Sec | Redirect chain — allowlist enforce mỗi hop, cap 5 hop, HEAD-only, timeout 4s | `route.ts` `[UNTESTED]` | Mỗi redirect re-check host; >5 hop → dừng; không GET body. | **SSRF guard (blocker)** |
| **TC-F37-09-07** | NFR | Edge | `resolve-maps-link` rate-limit → 429 | `route.ts` `[UNTESTED]` | Vượt ngưỡng → 429. | Abuse guard |
| **TC-F37-09-08** | FR-25 | Edge | All layer fail → 422 | `route.ts` `[UNTESTED]` | Regex + redirect + geocode đều fail → 422. | Error contract |
| **TC-F37-09-09** | FR-25 | Edge | Geocode layer no-op khi thiếu `GOOGLE_MAPS_GEOCODING_API_KEY` | `route.ts` `[UNTESTED]` | Không key → bỏ qua layer-3, không throw. | Config-safe |
| **TC-F37-09-10** | FR-28 | Func | `state-select` 13 bang + 3 lãnh thổ LB, label EN+BM, no free-text | `state-select.tsx` `[UNTESTED]` | 16 option, bilingual, dropdown (reuse `MY_STATES`). | MY địa chỉ chuẩn |
| **TC-F37-09-11** | FR-27 | Func | Schema Offer `priceCurrency="MYR"`, UI hiển thị "RM 25.50" | integration | Currency MYR + formatPrice reuse. | MY commerce |
| **TC-F37-09-12** | AC-18 | Func | **[NOT-BUILT]** Waze button URL `https://waze.com/ul?ll={lat},{lng}&navigate=yes` | pending | URL đúng format khi có lat+lng. | Waze deep-link |
| **TC-F37-09-13** | AC-18 | Edge | **[NOT-BUILT]** Thiếu lat HOẶC lng → KHÔNG render Waze button (BR-16) | pending | Không href rỗng. | Không link vỡ |
| **TC-F37-09-14** | AC-19 | Func | **[NOT-BUILT]** Halal ON → badge + JSON-LD `additionalProperty` PropertyValue "Halal Certified" + JAKIM `sameAs` | pending | Badge render + schema property + cert/sameAs khi có số cert. | Halal signal |
| **TC-F37-09-15** | AC-19 | Func | **[NOT-BUILT]** Halal OFF → KHÔNG badge, KHÔNG additionalProperty | pending | Vắng cả 2. | Toggle sạch |
| **TC-F37-09-16** | AC-14 | Func | Mobile 375px — checklist ≤3 full-width, touch ≥44px, no overflow | responsive | Không tràn ngang, target đủ lớn. | Mobile UX |

---

## 3.10 Gap-Fill v2.1 — Edge/Branch Scenarios (from ck:scenario cycle)

> 15 scenario chưa cover, grounded vào **code thật** (đọc `map-links.ts`, `resolve-maps-link/route.ts`, `local-seo-score/route.ts`, `json-ld.ts`). Ưu tiên branch ở surface built-nhưng-chưa-test → giá trị QA cao nhất.

### US-F37-02 JSON-LD — branch chưa cover

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-02-10** | AC-3 | Sec | `serializeJsonLd` escape **U+2028/U+2029 + `<>&`** (không chỉ `</script>`) | `json-ld.ts` `[UNTESTED branch]` | Line-separator (U+2028) và paragraph-separator (U+2029) bị escape; `<`,`>`,`&` escape. Chống breakout `dangerouslySetInnerHTML` ngoài case </script>. | XSS defense đầy đủ |
| **TC-F37-02-11** | AC-2 | Edge | openingHours drop row `isClosed=false` nhưng **thiếu opens/closes** | `json-ld.ts` | Row mở-nhưng-không-giờ bị loại khỏi `openingHoursSpecification` (không emit spec nửa vời). | Hours schema hợp lệ |

### US-F37-04 Score API/engine — branch chưa cover

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-04-15** | FR-10 | Sec | Score API **403 khi `site.tenant` null/thiếu** (không chỉ cross-tenant) | `local-seo-score/route.ts` dòng 56 `[UNTESTED]` | `siteTenantId` null → 403 (không lọt score cho site không gắn tenant). | IDOR guard đầy đủ |
| **TC-F37-04-16** | AC-7 | Edge | faqSchema signal: faq block có nhưng **items rỗng → KHÔNG earned** | `local-seo-score/route.ts` dòng 72-75 `[UNTESTED]` | `items.length>0` mới tính; block rỗng không +8 (parity `generateFAQSchema` empty→null). | Điểm không thổi phồng |

### US-F37-08 Auto SEO/AEO — branch chưa cover

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-08-12** | FR-24 | Edge | `parseAddress` boundary: split 1/2/3/>3-part, country default 'MY' per part-count | `json-ld-templates.ts` `[UNTESTED]` | 1-part→street; 2-part→street+city; 3-part→street+city+state; >3 gộp đúng; thiếu country→'MY'. | Address parse chính xác |
| **TC-F37-08-13** | AC-15 | Edge | Metadata boundary: title=50/60, desc=150/160 (truncate đúng, không cắt giữa entity) | `seo-generator.ts` | Đúng biên length, không vượt, không cắt cụt ký tự đặc biệt. | Meta length compliant |
| **TC-F37-08-14** | FR-04 | Func | Industry variant: Restaurant `servesCuisine` từ products; MedicalClinic `medicalSpecialty` | `json-ld-templates.ts` `[UNTESTED]` | @type Restaurant → servesCuisine từ product list; MedicalClinic → specialty field. | Schema sub-type richness |

### US-F37-09 Map parser + resolve-maps-link (SSRF) — branch chưa cover

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-09-17** | FR-25 | Edge | `parseMapLink`: pin `!3d!4d` **out-of-range** + viewport `@` hợp lệ → **fallback viewport** (không null) | `map-links.ts` dòng 42-54 `[UNTESTED]` | Pin fail range check → KHÔNG return, rơi xuống viewport → trả viewport coords. | Không mất geo hợp lệ |
| **TC-F37-09-18** | FR-25 | Edge | `parseMapLink` boundary lat=±90/lng=±180 **inclusive**; negative coords hợp lệ | `map-links.ts` `isValidLatLng` `[UNTESTED]` | ±90/±180 accepted; -3.14/-101.6 (nam/tây bán cầu) hợp lệ. | Boundary đúng |
| **TC-F37-09-19** | FR-25 | Edge | `parseMapLink` null/non-string/whitespace → null | `map-links.ts` dòng 38-40 `[UNTESTED]` | `null`/số/`"  "` → null (guard, không throw). | Defensive |
| **TC-F37-09-20** | NFR-3 | Sec | resolve: **neither url nor address** → 400 (schema `.refine`) | `resolve-maps-link/route.ts` dòng 49 `[UNTESTED]` | Body rỗng cả 2 → 400 "url or address is required". | Contract |
| **TC-F37-09-21** | NFR | Edge | resolve: url>2048 / address>500 → 400 (schema `.max`) | `route.ts` dòng 47-48 `[UNTESTED]` | Vượt max → 400 (chống payload lớn). | Input bound |
| **TC-F37-09-22** | NFR-3 | Sec | resolve: 3xx **thiếu Location** → null→422; **relative Location** resolved + re-check allowlist mỗi hop | `route.ts` `resolveRedirect` dòng 80-91 `[UNTESTED]` | 3xx không Location → null; relative `/x` resolve qua `new URL(loc,current)` rồi `isAllowedHost(next)`; host lạ sau redirect → null. | SSRF guard đầy đủ |
| **TC-F37-09-23** | FR-25 | Edge | resolve: redirect OK nhưng **final URL không coords** → fallthrough address/422 | `route.ts` dòng 142-148 `[UNTESTED]` | `parseMapLink(finalUrl)` null → không return, thử address rồi 422. | Layer fallthrough |
| **TC-F37-09-24** | FR-25 | Func | resolve: **url+address cùng gửi** — url OK → `source:'redirect'` (bỏ address); url fail → address geocode | `route.ts` dòng 137-156 `[UNTESTED]` | url resolve được → trả redirect, KHÔNG chạy geocode; url fail → mới geocode address. | Layer precedence |
| **TC-F37-09-25** | NFR | Edge | resolve: HEAD **timeout/abort 4s** → null; geocode key có nhưng API !ok/empty/non-finite → null→422 | `route.ts` `fetchWithTimeout`/`geocodeAddress` `[UNTESTED]` | AbortController 4s → fetch null → unresolvable; geocode results rỗng/lat-lng NaN → null. | Error cascade |

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

## 9. Unresolved Questions & Implementation Gaps (Phase 1)

> Cần PM/Dev chốt trước khi các TC `[NOT-BUILT]` chạy được. Đánh dấu để QA không nhầm "chưa test" với "fail".

1. **🔴 robots.txt spec conflict (US-03, BLOCKER):** `src/app/sites/[slug]/robots.txt/route.ts` hiện **hardcode `Disallow: /`** cho 9 AI bot (GPTBot, ClaudeBot, Google-Extended, CCBot, Bytespider, Amazonbot, Applebot-Extended, meta-externalagent, CloudflareBrowserRenderingCrawler) — **NGƯỢC** với US-03/BR-03 "default ALLOW". Score engine cũng hardcode `allowsSearchBots: false`. **PM chốt:** default-allow (theo spec) hay giữ block-list? → quyết TC-F37-03-01/09. Toàn US-03 (llms.txt + per-site toggle) chưa build.
2. **US-04 checklist widget chưa build:** Engine + GET API đã có (API **chưa test** — TC-04-01..06 giá trị cao), nhưng widget checklist one-click-fix (US-04 core, AC-1/AC-2) chưa implement → TC-04-10/11/12 spec-based. TC-04-11 (one-click enable AI crawler) **phụ thuộc US-03** build xong.
3. **US-09 Waze/Halal chưa build:** MY geo/state/postcode đã có + test; Waze link (AC-18) + Halal cert schema (AC-19) chưa implement → TC-09-12..15 spec-based. **`resolve-maps-link` route (SSRF-critical) + `parseMapLink` parser đã build nhưng CHƯA có test** — TC-09-01..09 là ưu tiên viết automated test cao nhất.
4. **Technical Health hardcoded (US-04):** `coreWebVitals=80`, `mobileResponsive=true`, `httpsEnabled=true` là placeholder assume-pass (chưa đo Lighthouse thật) → mọi site được +15 free. PM chốt: giữ, đo thật, hay normalize "earned/applicable" (§13.8) trước khi surface score cho seller.
5. **CF-5 metadata fallback cho checkout/orders routes:** Chưa rõ route checkout/orders có nằm dưới `/sites/[slug]/*` và cần `generateMetadata` fallback không → TC-08 boundary chờ confirm implementation.
6. **hreflang (AC-20/FR-26) DEFERRED P2:** blocked bởi i18n client-side, chờ F21 URL-based locale routing. KHÔNG viết TC.

---

**Last Verified:** 2026-07-09 (Phase-1 scope; TC-F37-02/03/04/08/09 mapped vào code thật qua 2 vòng review requirements + code-reality scan; trạng thái BUILT/UNTESTED/NOT-BUILT verified against actual `src/`)
