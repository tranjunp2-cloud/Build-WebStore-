# QA Test Plan — F37 Local SEO & Search Performance (Phase 1)

> **Version:** 3.4 | **Updated:** 2026-08-04 | **Owner:** QA Team
> **PRD ref:** [`docs/prd/F37-local-seo-search-performance.md`](../prd/F37-local-seo-search-performance.md) v2.6
> **Stories ref:** [`docs/stories/F37-local-seo-stories.md`](../stories/F37-local-seo-stories.md) (target scope US-F37-01..04)
> **Architecture ref:** [`docs/architecture/F37-local-seo.md`](../architecture/F37-local-seo.md)

### Changelog
- **v3.4 (2026-08-04)** — Registered `TC-F37-02-48` for response-loss resilience. LocalBusiness snapshots now use the same text canonicalization at the client queue, reconciliation comparator, and server validation boundary; Payload array-row metadata is ignored during semantic comparison. Reconciliation aborts after 5 seconds. An unresolved outcome resolves callers `false`, locks every LocalBusiness Settings mount until reload with EN/MS guidance, and removes a never-sent queued revision from visible state while retaining only the ambiguous in-flight snapshot. The targeted gate passes 65/65; typecheck and lint pass. A broader related run has 245 passing assertions, with only 3 PostgreSQL schema-drift checks blocked by the unavailable local port.
- **v3.3 (2026-08-03)** — Synced with current staging after PR #1708 landed. Retained the per-site revisioned/coalescing LocalBusiness serializer and reconciled US02 rollback against the last persisted snapshot: the failed latest batch rolls back, while an older failed batch preserves and drains a newer optimistic revision. Focused verification passes 10 files/210 tests, including database schema drift against local PostgreSQL; typecheck, diff check, Playwright discovery, and the 2-test no-credential skip pass. US02 remains independent; live staging fixture execution and manual Rich Results evidence remain pending.
- **v3.2 (2026-07-30)** — Phase 03 automation is wired but acceptance remains open. TC-F37-02-45 discovers the authenticated account sole site (no `E2E_SITE_ID`), derives the canonical storefront URL from the tenant route/hostname, and requires `TEST_EMAIL`, `TEST_PASSWORD`, and `E2E_TEST_OTP_CODE`; live fixture execution and manual Google Rich Results evidence remain pending. TC-F37-02-47 covers rejected settings-save rollback in `publish-flow.test.tsx` (10/10 local). Prior focused evidence remains 8 files/179 tests; the combined Phase regression is 9 files/189 tests, with typecheck, diff check, and Playwright discovery passing. PR #1708 is not a dependency or blocker; reconcile it only if it lands first.

- **v2.18 (2026-07-31)** — Registered `TC-F37-01-30` for the PR #1708 review regression: rapid `localBusiness` edits must be serialized and coalesced so a slower, older PATCH cannot overwrite newer address fields. The component sends sparse field patches to the Editor owner; the owner maintains revisioned snapshots and one queue per site, preserves queued site A work while site B saves independently, and prevents a same-site page refetch from replacing pending optimistic data with an older DB snapshot. Successful analytics now fire once per persisted batch from that batch's full snapshot. Deterministic regressions cover all of these ordering cases.
- **v2.17 (2026-07-30)** — Hardened the F37 target allowlist at the shared authenticated Playwright setup boundary. The previous suite-level skip ran after the `chromium` project's `setup` dependency, so credentials could be submitted before a disallowed target was rejected. `TC-F37-01-29` now covers exact local/live-staging origins plus malformed, production, and lookalike targets; a direct setup regression confirms the guard throws before navigation or credential entry.
- **v2.16 (2026-07-30)** — Ran the guarded browser regression against the reserved local one-site account: auth setup, TC-F37-01-26, and TC-F37-01-27 pass **3/3**. The run proves valid PATCH→reload persistence, invalid-phone rollback without PATCH, sequential name/address/phone persistence at 375px, `country: 'MY'`, persisted `minimalBusinessData` = 20 (`7/8/5`), no horizontal overflow, and exact fixture restoration/raw verification. The test marks the first-use editor coach marks as already seen so they do not redirect the Tools sheet during this settings-specific scenario. No staging result is claimed.
- **v2.15 (2026-07-29)** — Added `TC-F37-01-28`, a focused API regression proving a complete Minimal Business Data payload cannot update a site owned by another tenant. The save route returns 403 before subscription lookup or persistence. Both single-tier and two-tier rate limiters are mocked, preventing configured Upstash or in-memory shared state from affecting the assertion. The targeted assertion failed before the mock and passed after; the full scoped gate passes **33/33**. This closes the local tenant-isolation evidence gap without changing production behavior or expanding into CI/E2E infrastructure.
- **v2.14 (2026-07-29)** — The existing score GET now adds persisted `minimalBusinessData { score, maxScore: 20, breakdown }` using `Sites.name` (7), complete structured address (8), and `contactInfo.phone` (5), while preserving the legacy top-level score/breakdown. `src/__tests__/api/local-seo-score.test.ts` covers 20, partial 12, 401, 403, and legacy Business = 35. TC-F37-01-27 asserts 20 after the persisted editor flow. The manual one-site fixture must have empty `openingHours` so F37-01 does not rewrite F37-02 row metadata. #1312 still owns the top-level `20/35/15/30` cutover and dashboard/checklist; no live staging E2E pass is claimed.
- **v2.13 (2026-07-29)** — Added the scoped Playwright spec `e2e/f37-minimal-business-data.spec.ts`. It resolves the authenticated account's sole tenant-owned site and fails closed on zero/multiple results. Teardown restores and raw-verifies every touched value, explicitly writing `null` for fields that were originally absent. The spec supports the exact local and live-staging origins and remains excluded from the default `e2e-staging` workflow. Local discovery lists TC-F37-01-26 and TC-F37-01-27; live staging execution remains pending. The additive persisted `minimalBusinessData` API is active; #1312 retains the top-level formula and dashboard/checklist cutover.
- **v2.12 (2026-07-28)** — Closed the follow-up review findings for contact canonicalization and compact-layout coverage. Email blur now applies the same strip-HTML/trim canonicalization as `saveSiteSchema` before validation and save, so the request, input, parent state, and persisted value agree. All compact editor fixtures now supply the required parent pending flag, and a direct compact regression verifies that the flag reaches the mounted `SettingsPanel`. The expanded eight-file regression gate passes **131/131** (`misc-validations` 50 + `SettingsPanel` 30 + `publish-flow` 13 + score 15 + compact layout 23). Typecheck, lint, production build, and diff-check pass. Phase 3 browser persistence proof and #1312 runtime activation remain deferred.
- **v2.11 (2026-07-28)** — Closed the final Phase 2 contact-save review findings. Address blur now applies the same strip-HTML/trim canonicalization as `saveSiteSchema`, so the request, parent state, input, and persisted value cannot diverge. The parent pending flag is passed to desktop, compact Tools, and compact block-sheet mounts, keeping all contact inputs disabled across an actual panel remount; an owner token prevents rejected overlap from releasing the active request's mutex. Contact updates are required to be standalone patches, avoiding partial optimistic side effects from mixed `{ name, contactInfo }` requests, and the mutex now releases even when fetch setup throws synchronously. Four new regression expectations failed before these fixes and the expanded gate now passes **107/107** (`misc-validations` 50 + `SettingsPanel` 29 + `publish-flow` 13 + score 15), with typecheck, lint, production build, and diff-check passing. A client AbortController timeout remains intentionally deferred: after a mutation reaches the server, timeout is an unknown outcome and cannot safely be treated as rollback without operation-status/CAS reconciliation. Phase 3 browser proof and #1312 runtime activation remain deferred.
- **v2.10 (2026-07-28)** — Closed the Phase 2 contact-save review findings. Phone, email, and address now use one transactional component lifecycle: each blur sends only the edited field, locks sibling inputs within the mounted panel, and restores the server-confirmed value when the save is rejected. Sparse payloads keep legacy-invalid sibling values (for example, a previously stored phone containing a tab) out of unrelated email/address validation. The editor parent now owns a contact-wide mutex that survives `SettingsPanel` rerenders/remounts, rejects overlapping contact writes, and commits every contact field only after `response.ok`; the caller-controlled `commitAfterSave` exception was removed. Four new regression cases plus tightened expectations in two existing cases produced six red test failures before the implementation, then the expanded Phase 2 gate passed **103/103** (`misc-validations` 50 + `SettingsPanel` 27 + `publish-flow` 11 + score 15), with typecheck, lint, production build, and diff-check passing. Cross-tab/multi-user conflict resolution remains outside #1309; Phase 3 browser proof and #1312 runtime score activation remain deferred as documented.
- **v2.9 (2026-07-27)** — Implemented issue #1309 Phase 2 validation/editor prerequisites and transactional phone-save regression fix. Added client-safe `isValidBusinessPhone()` as the single predicate reused by the Editor and `saveSiteSchema`: optional empty values remain valid; non-empty values require a digit, allow `+` only at the start, allow only digits/ASCII spaces/`-`/`()`/`.`, and reject letters, misplaced/multiple pluses, punctuation-only input, tabs/newlines, and raw HTML/script markup before sanitization. Invalid Editor blur shows feedback, restores the server-confirmed prop value, and returns before `onSiteSettingsChange`. A valid phone now enters parent state only after a successful PATCH; while it is pending, phone/email/address contact saves are guarded, and a failed PATCH restores the confirmed value so a later email save cannot persist the failed phone. Structured-address edits backfill `country: 'MY'` for missing or whitespace-only legacy country values. Phase 2 targeted verification passed **99/99** (`misc-validations` 50 + `SettingsPanel` 25 + `publish-flow` 9 + score 15), with typecheck, lint, build, and diff-check passing. This is component/integration regression evidence, **not** browser E2E: TC-F37-01-26 still needs the real successful PATCH→reload→invalid/no-PATCH/restore proof in Phase 3; TC-F37-01-27 has a component regression for country backfill, while persistence/reload and 375px browser proof remain Phase 3. Runtime score/API activation remains deferred to #1312.
- **v2.8 (2026-07-27)** — Re-mapped US-F37-01 to the Story Sync v2 Minimal Business Data contract from issue #1309. `TC-F37-01-10` now locks the exact pure Business score: `Sites.name` 7 + complete street/city/postcode/country 8 + `contactInfo.phone` 5; incomplete address earns 0 and old hours/category/website/description signals do not contribute. Registered `[x] AUTO` follow-up coverage `TC-F37-01-26` (phone rejection/revert) and `TC-F37-01-27` (Editor persistence + 375px). Runtime score API activation remains deferred to #1312 so staging never ships a partial 85-point formula.
- **v3.1 (2026-07-30)** — US-F37-02 v2.6 Phase 00–02 complete. TC-F37-02-29..44/46 are `[BUILT]`: 8 focused files/179 tests passed; typecheck and diff checks passed; review approved at 9.6/10. Full suite: 11,174 passed plus 4 environment-only failures from the unavailable local DB port. TC-F37-02-45 live fixture and Phase 03 Rich Results acceptance remained pending.
- **v2.7 (2026-07-13)** — Pre-merge code review pass on PR #1591 (US-F37-02 + Opening Hours + Geo-cascade) found and fixed 3 bugs via `/code-review --auto` + `/fix` autonomous modes, all verified red→green: (1) **CONFIRMED, Important** — Zod `.refine()` insufficient for opening-hours required-when-open check — some paths left uncovered, allowing invalid rows through. Fixed by switching to `.superRefine()` (allows per-error granularity) + added cross-field validate at field level in `src/collections/Sites.ts` using `siblingData`. Test: **TC-F37-02-25** (3 new test cases in `sites-local-business.test.ts`, verify closed-but-no-time rejected, opens-no-closes rejected, closes-le-opens rejected). (2) **CONFIRMED, Important** — Geo-cascade `bootstrap()` (reverse-resolve pre-fill on mount) race condition: async lookup completes after user has manually selected a value, overwriting the user's choice. Fixed by adding `userInteractedRef` guard in `geo-cascade-fields.tsx` — bootstrap only writes if user hasn't interacted yet. Test: **TC-F37-01-25** (added to `geo-cascade-fields.test.tsx`, verifies manual selection beats slow mount-time resolve). (3) **CONFIRMED, Minor** — `check-migrations.js::getArrayNestedFieldNames()` false-negative risk + compact-form bug: (a) Caller was skipping names-in-diff that happened to be array-nested somewhere else in file (poor intersection logic), now fixed by explicit intersect with diff-only names — prevents false-negative when field is both array-nested AND newly top-level; (b) Missed compact single-line field form (`{ name, type }` on one line, style used in `Products.ts`) — added regex branch to detect both inline + multi-line forms, parity with diff-scanning logic. Also refactored for testability: added `module.exports` + `require.main === module` guard. Tests: **TC-F37-03-CHECK-01..03** (3 new cases in new `check-migrations.test.ts` file, verify compact form detected, array-nested + top-level handling, false-negative prevention). All 3 fixes verified via fail-without-fix / pass-with-fix cycle. Tổng **64 TC-ID** (61 + 3 new).
- **v2.6 (2026-07-10)** — Post-implementation visual QA pass on the Opening Hours modal (screenshot comparison against real Google Maps reference) surfaced 1 real functional bug + several visual gaps, all fixed: (1) **CONFIRMED, Important** — `applyBatchSave`'s `closed` encoding (`opening-hours-utils.ts`) produces rows without `opens`/`closes` keys, but `saveSiteSchema.localBusiness.openingHours` required both fields non-optional — **saving any "Closed" day was silently rejected by the save API**. Fixed by making `opens`/`closes` `.optional()` in the Zod schema (matches the pre-existing `OpeningHourRow` TS type, which already declared them optional — a schema/type drift bug). (2) Added a `closes > opens` order validation (user-requested; overnight ranges explicitly out of scope) — new pure `isRangeOrderValid()` helper, inline modal error + disabled Save, and a matching Zod `.refine()` at the save-route boundary. (3) Visual-only fixes: checkbox/border contrast on dark theme, day-toggle row spacing, added missing 3rd quick-action ("Edit Sat–Sun"), scroll/wrap layout, clock-icon contrast — no new TC-IDs (styling only). Added **TC-F37-02-23** (`isRangeOrderValid` unit tests) and **TC-F37-02-24** (Zod refine + closed-row-without-times regression). Tổng **61 TC-ID**.
- **v2.5 (2026-07-10)** — Opening Hours redesign to Google Maps-style list + edit-modal UX (`plans/260710-1455-opening-hours-google-style/`): multi-day batch select, split-shift support (N time ranges/day), quick-actions ("Edit all hours", "Edit Mon–Fri"), relaxed `maxRows`/Zod cap 7→21 (7 days × up to 3 shifts). New pure-logic module `opening-hours-utils.ts` (overwrite-not-merge batch save, grouping, mode encoding, round-trip). Added **§3.12** (10 TC: TC-F37-02-13..22) across `sites-local-business.test.ts` (+2), `local-business-json-ld.test.ts` (+1 split-shift spec), new `opening-hours-utils.test.ts` (7 TC, 19 tests), new `opening-hours-editor.test.tsx` (1 TC, 4 tests, RTL). No DB migration needed (no unique constraint on `day_of_week`); `json-ld.ts` + `llms.txt` route already split-shift-compatible (1:1 row mapping, no per-day dedup). Tổng **59 TC-ID**.
- **v2.4 (2026-07-10)** — `/code-review` ultrathink adversarial pass (4 parallel lenses: holistic, security, race-condition, data-integrity) on the full v2.3 geo-cascade diff found 2 real issues via `/fix` autonomous mode: (1) **CONFIRMED, Important** — `scripts/data/malaysia-geo.json` seeded 4/16 state names ('W.P. Kuala Lumpur', 'Pulau Pinang', 'W.P. Labuan', 'W.P. Putrajaya') that don't match the `z.enum(MY_STATES)` used to validate `localBusiness.state`; fixed at the seed source (now byte-exact match, verified against live checkout order-validation schema using the same enum+table). (2) **CONFIRMED, Minor** — `handleStateSelect`/`handleDistrictSelect` had no stale-response guard, so an out-of-order `/api/geo/districts` response could silently persist a district belonging to the wrong state; added a ref-based guard (same class of bug already present, unfixed, in the reference `CheckoutClient.tsx` this was ported from — out of scope here). Both fixes have regression tests independently verified fail-without-fix/pass-with-fix (TC-F37-01-23, TC-F37-01-24). Security/injection and i18n/TC-ID-consistency lenses found zero issues. Tổng **49 TC-ID**.
- **v2.3 (2026-07-10)** — US-F37-01 geo-cascade data-quality follow-up (`plans/260710-1032-f37-local-business-geo-cascade/`): replaced freetext city/postcode with DB-backed State→District→Postcode cascade (ported from checkout `/api/geo/*`). Added **§3.11** (8 TC: TC-F37-01-15..22) covering forward cascade, reverse-resolve pre-fill (postcode-lookup + name-match), non-destructive legacy degradation, API-failure resilience, and a JSON-LD string-compat regression guard. New test file `geo-cascade-fields.test.tsx` (8 tests). Also corrected `local-seo-score.test.ts` count 6→7 (1 test under-counted since v1.0). Tổng **46 TC-ID** across the 4 F37 unit test files (11 + 20 + 7 + 8).
- **v2.2 (2026-07-10)** — US-F37-02 gap-close (issue #1310): implemented `hasMap` Additional Criteria (was missing, no GBP/Waze yet) as a Google Maps URL fallback derived from `localBusiness` lat/lng; omits gracefully when coordinates absent. Added **TC-F37-02-12** (§3.10), 2 tests in `local-business-json-ld.test.ts`. Upgrade to GBP/Waze URL deferred to US-F37-05/09 (unchanged scope). Tổng **90 TC-ID**.
- **v2.1 (2026-07-09)** — `/qa-full:check` verify + gap-fill. Đọc code thật (`map-links.ts`, `resolve-maps-link/route.ts`, `local-seo-score/route.ts`, `json-ld.ts`) + ck:scenario 12-dimension. Thêm §3.10 (16 TC: TC-F37-02-10/11, 04-15/16, 08-12/13/14, 09-17..25) phủ branch bỏ sót ở surface built-nhưng-chưa-test: `parseMapLink` pin-out-of-range fallthrough + boundary, `resolve-maps-link` SSRF (relative Location re-check, 3xx-no-Location, url+address precedence, neither→400), score API 403-null-tenant + faq-empty-not-earned, `serializeJsonLd` U+2028/2029, incomplete-hours drop, `parseAddress` part-count, metadata length boundary. Baseline F37 tests: 6 files / 80 pass. Tổng **89 TC-ID**.
- **v2.0 (2026-07-09)** — Mở rộng scope từ chỉ US-F37-01 → **toàn bộ Phase 1** (US-01,02,03,04,08,09). Thêm §3.5–§3.9 (TC-F37-02/03/04/08/09-NN). Dựa trên 2 vòng review song song (requirements + code-reality scan). Đánh dấu trạng thái implementation: **US-02/US-08 FULLY BUILT** (bổ sung TC generator/branch chưa test), **US-04/US-09 PARTIAL** (ưu tiên API route + parser **built-nhưng-chưa-test**: `local-seo-score` API, `resolve-maps-link` SSRF, `parseMapLink`), **US-03 NOT-BUILT** (llms.txt + per-site toggle chưa có; robots.txt đang chặn AI bot NGƯỢC spec — TC spec-based + flag §9 #2). Waze/Halal (US-09) + checklist one-click (US-04) đánh `[NOT-BUILT]`. hreflang (AC-20) DEFERRED, không viết TC.
- **v1.1 (2026-07-07)** — Pre-commit `/code-review` adversarial pass (2 cycles) found `local_business_data_saved` polluting seller-facing traffic dashboards. Cycle 1 fixed the (later found to be orphaned) `analytics/summary/route.ts`. Cycle 2's re-review caught that the actual LIVE dashboard path (`src/lib/dashboard/traffic-data.ts`) was still exposed via its ungated Top Referrers aggregation — fixed there too, with defense-in-depth. Added **TC-F37-01-13/14** (§3.4). 14 TC-IDs, 38 tests total.
- **v1.0 (2026-07-07)** — Phase 06 complete. Formalized 12 TC-IDs (TC-F37-01-01..12) from unit tests across 3 test files: `src/__tests__/unit/validations/sites-local-business.test.ts` (4 TCs + 2 security), `src/__tests__/unit/seo/local-business-json-ld.test.ts` (6 TCs + 1 security), `src/__tests__/unit/seo/local-seo-score.test.ts` (2 TCs). All 34 tests passing (1301/1301 in full suite). XSS hardening verified; no aggregateRating bloat; Tech Health signals flagged for PM review before US-F37-04 dashboard ships.

---

## 1. Objective

Test coverage cho **F37 Local SEO — Phase 1**: US-F37-01, 02, 03, 04, 09.

| Story | Nội dung | Trạng thái code |
|---|---|---|
| **US-F37-01** | Local Business Data Model (Zod validation + geo/postcode) | 🟡 BUILT + unit/regression tested; local Playwright passed, live staging pending (§3.1–3.4) |
| **US-F37-02** | Enhanced LocalBusiness JSON-LD (PostalAddress, geo, hours, @type, priceRange, no aggregateRating) | 🟡 PHASE 00–03 AUTOMATION WIRED — live staging fixture/Rich Results acceptance pending (§3.5) |
| **US-F37-03** | Platform-managed AI Discoverability | 🔴 TARGET REWIRE — remove toggle UI/state, keep crawler allow + llms.txt (§3.6) |
| **US-F37-04** | Unified SEO Health Score + Actions | 🔴 TARGET NOT BUILT — legacy engine/API require rewire (§3.7) |
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
| **TC-F37-01-08** | Legacy | Func | Legacy category-mapped `@type` | `local-business-json-ld.test.ts` lines 74–85 | Existing behavior maps `businessCategory` directly to `@type`; replace with the approved `schemaSubtype` contract in TC-F37-02-29..32. | Regression evidence only; not target acceptance |
| **TC-F37-01-09** | AC-1 | Func | Homepage trigger: emits LocalBusiness from localBusiness data alone (no Contact block) | `local-business-json-ld.test.ts` lines 89–119 | Homepage emits FoodEstablishment when `site.localBusiness` present, even without Contact block. Non-homepage rejects LocalBusiness (no Contact, no localBusiness). Exactly ONE LocalBusiness when both present (dedupe). | Loosened trigger: sellers can emit LocalBusiness without Contact block |
| **TC-F37-01-12** | AC-2 | Edge | Day-of-week mapping: Mo→Monday, Tu→Tuesday, … Su→Sunday (7 variants) | `local-business-json-ld.test.ts` lines 124–135 | Tests all 7 day codes via `it.each`. Unrecognized codes ('XX', undefined) return null, not fabricated strings. | Opening hours day names match Schema.org spec |
| *Security* | — | Sec | XSS: </script> escaped in JSON-LD serialization | `local-business-json-ld.test.ts` lines 139–146 | Serialized JSON escapes `</script>` as `\\u003c/script\\u003e`. Prevents breakout from dangerouslySetInnerHTML. | Safe embedding of tenant-controlled strings in <script> tag |

---

### 3.3 Legacy Phase 05 Score Tests (replacement required)

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-10** | AC-1, AC-2 / FR-01..03 | Func/Edge | **[x] AUTO — Exact Minimal Business Data 7/8/5 contract** | `unit/seo/local-seo-score.test.ts`, `api/local-seo-score.test.ts` | Pure cases cover 20/12/8/0 boundaries and excluded legacy signals. The score GET maps persisted name/address/phone into additive `minimalBusinessData`; API regressions cover 20, 12, 401, 403, and unchanged legacy Business = 35. | Exposes the rewritten Business bucket without changing the top-level formula before #1312 |
| **TC-F37-01-11** | FR-10 | Edge | Score bounded 0..100; bucket breakdown sum correct | `local-seo-score.test.ts` lines 168–202 | Full input scores exactly 100. Empty input scores exactly 0 (never negative). Arbitrary partial input within [0, 100]. Bucket sum (businessData + structuredData + aiDiscoverability + technicalHealth) = total score. NO "blocks suspicious bots" sub-signal present (type-level + runtime check on aiDiscoverability = 20 = allowsSearchBots(12) + sitemapPresent(8)). | Score accurately reflects completion; prevents overflow; validates PRD §13.8 architecture decision |

---

### 3.3a US-F37-01 v2 Editor Follow-up (Phase 2 implemented; Phase 3 passed locally, live staging run pending)

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-26** | AC-3 / FR-03 | Edge | **[PARTIAL AUTO — local Playwright passed; live run pending]** | `misc-validations.test.ts`, `settings-panel.test.tsx`, `publish-flow.test.tsx`, `compact-editor-layout-nav-footer-menu.test.tsx`, `e2e/f37-minimal-business-data.spec.ts` | Existing regressions cover validation, sparse saves, rollback, pending-state serialization, authoritative reconciliation after a lost PATCH response, and a locked reload-required state when persistence remains unknown. The local Playwright run performs valid PATCH→reload, then verifies invalid blur restores the confirmed phone and emits no matching PATCH. A live staging run is still required before claiming staging browser acceptance. | Failed or invalid contact input cannot replace server-confirmed data; ambiguous transport outcomes cannot silently rollback or admit another contact write; local browser evidence passes |
| **TC-F37-01-27** | AC-1 / DoD | Func | **[PARTIAL AUTO — local Playwright passed; live run pending]** | `settings-panel.test.tsx`, `e2e/f37-minimal-business-data.spec.ts` | The local one-site scenario with empty `openingHours` saves and reloads name/address/phone at 375px, checks `country: 'MY'`, asserts persisted `minimalBusinessData` = 20 with `7/8/5`, then restores and raw-verifies touched values. | Covers persistence/mobile/runtime Business without rewriting F37-02 row metadata; local browser evidence passes and live staging remains pending |
| **TC-F37-01-28** | DoD tenant isolation | Sec | **[x] AUTO — Minimal Business Data save rejects a cross-tenant site** | `src/__tests__/api/sites.test.ts` | With both single-tier and two-tier rate limiters mocked to avoid Upstash or in-memory shared state, a complete F37 name/address/phone payload targeting a tenant-2 site returns 403 for a tenant-1 user; `payload.update` and subscription lookup remain uncalled. The targeted assertion failed before the mock and passed after; the full scoped gate passes 33/33. | Prevents IDOR writes without expanding the story scope |
| **TC-F37-01-29** | Security / test safety | Sec | **[x] AUTO — Authenticated E2E target allowlist runs before login** | `e2e/authenticated-target.smoke.spec.ts`, `e2e/auth.setup.ts` | Allows only exact localhost and live-staging origins, rejects malformed/production/lookalike targets, and asserts the shared setup guard before navigation or credential access. | Prevents a misconfigured manual F37 run from submitting credentials to an unapproved origin |
| **TC-F37-01-30** | AC-1 / data integrity | Regression | **[x] AUTO — Overlapping Local Business saves serialize and coalesce newest fields** | `settings-panel.test.tsx`, `publish-flow.test.tsx` | `SettingsPanel` sends only edited fields (plus required country backfill). Deferred-response tests prove later edits coalesce into the newest full snapshot, site A's queued batch survives navigation while site B saves independently, a same-site page refetch cannot restore stale DB data over pending edits, and analytics fire once per successful persisted batch with that batch's completion count. | Prevents out-of-order or lifecycle-driven loss of state/city/postcode data and stale/duplicate save analytics |

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

## 3.5 US-F37-02: Enhanced LocalBusiness JSON-LD **[PHASE 00–02 BUILT + TESTED; PHASE 03 AUTOMATION WIRED — LIVE EVIDENCE PENDING]**

> The approved `businessCategory` → `schemaSubtype` dropdown, persistence, validation, JSON-LD, and Schema score are automated. TC-F37-02-45 is implemented and discoverable, but the owned staging fixture and manual Google Rich Results evidence are still pending. #1708 is not a dependency; its overlapping serializer semantics have been reconciled from staging.
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
| **TC-F37-02-29** | FR-05 | Func | Category filters subtype dropdown | `local-business-constants.test.ts`; `settings-panel.test.tsx` `[PASS]` | Subtype disabled before category; options come only from the versioned compatible mapping; exactly one option auto-selects, multiple options require explicit selection. | Prevents invalid or vague subtype selection |
| **TC-F37-02-30** | FR-05 | Edge | Category change preserves or clears subtype | `local-business-constants.test.ts`; `settings-panel.test.tsx` `[PASS]` | Preserve the selected subtype only when compatible with the new category; otherwise clear it and require a new selection. | Prevents stale category/subtype pairs |
| **TC-F37-02-31** | AC-04 / FR-05 | Sec/Data | Server rejects an invalid category/subtype pair | `sites-local-business.test.ts`; `sites.test.ts`; `sites-opening-hours-sanitize-hook.test.ts` `[PASS]` | Direct invalid payload is rejected; the previous valid pair remains saved; invalid `@type` is never emitted. | Save boundary enforces the contract |
| **TC-F37-02-32** | FR-05 / §5 | Func | Subtype controls JSON-LD and score | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Empty subtype emits generic `LocalBusiness` and earns 0/4; a compatible specific subtype emits the exact `@type` and earns 4/4. | Schema and score use one source of truth |
| **TC-F37-02-33** | AC-01 / FR-04 | Func | Strict LocalBusiness parent and complete PostalAddress | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Trimmed name plus street/city/postcode/country emits one strict parent worth 10; incomplete identity emits no strict artifact. | Parent gate for every child score |
| **TC-F37-02-34** | AC-02 / FR-06 | Edge | Opening hours emit and score only complete open rows | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | At least one valid open row earns 5; closed-only, incomplete, or invalid rows earn 0 without suppressing siblings. | Safe hours signal |
| **TC-F37-02-35** | AC-03 / FR-07 | Edge | Geo requires two finite in-range coordinates | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Both values must be finite and within latitude `[-90,90]` / longitude `[-180,180]`; half, non-finite, or out-of-range coordinates omit geo and earn 0. | Safe geo signal |
| **TC-F37-02-36** | FR-08 | Func | Telephone derives from canonical strict node | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Trimmed phone on the strict node earns 3; missing or child-without-parent earns 0. | NAP signal |
| **TC-F37-02-37** | FR-09 | Sec/Func | Canonical HTTP(S) URL emission and scoring | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Absolute normalized HTTP(S) URL earns 3; relative, credential-bearing, control-character, malformed logo, or malformed social-link values are omitted. | Safe URL signal |
| **TC-F37-02-38** | FR-10 | Func | Explicit then category-derived price range | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Emitted explicit or fallback priceRange earns 3; unavailable value earns 0. | Price signal |
| **TC-F37-02-39** | FR-11 | Func | Separate valid Organization | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | One Organization with trimmed name and canonical URL earns 3; malformed or duplicate candidates cannot inflate the score. | Platform schema signal |
| **TC-F37-02-40** | §5 | Func | Exact Schema score total and zero state | `schema-score.test.ts` `[PASS]` | Eight signals total exactly 35; empty artifact totals 0; child properties without a strict parent earn 0. | No score drift |
| **TC-F37-02-41** | NFR/Security | Edge | Malformed and duplicate generated-node resistance | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Unknown values and legacy duplicates do not throw, combine child signals, or inflate points. | Trusted artifact boundary |
| **TC-F37-02-42** | AC-01 / §5 | Integration | Generation and score use one immutable snapshot | `schema-score.test.ts` `[PASS]` | Production generation returns a canonical artifact that the pure scorer consumes directly; FAQ changes do not affect Schema points. | Proves “points earned” in US02 |
| **TC-F37-02-43** | NFR/Security | Sec | Raw JSON-LD script serialization blocks breakout | `local-business-json-ld.test.ts` `[PASS]` | Rendered script HTML escapes `<`, `>`, `&`, `</script>`, U+2028, and U+2029; no sentinel element/global is injected. | Stored-XSS prevention |
| **TC-F37-02-44** | AC-01..03 / FR-04..11 | Edge | Generator resilience and forbidden rating | `local-business-json-ld.test.ts` `[PASS]` | One optional generator failure cannot crash unrelated schemas; LocalBusiness never emits `aggregateRating`. | Storefront resilience |
| **TC-F37-02-45** | AC-01..04 | E2E | Published storefront JSON-LD acceptance | `tests/f37-schema-rich-local-markup.spec.ts` `[WIRED — LIVE EVIDENCE PENDING]` | Requires email, password, and OTP to discover the account sole site; parses real JSON-LD, rejects invalid/duplicate nodes, requires a homepage canonical with no subpath/query/fragment, and matches both non-empty schema URLs to its origin. | Real storefront evidence |
| **TC-F37-02-46** | Compatibility | Regression | Weak Contact fallback excluded from canonical score | `local-business-json-ld.test.ts`; `schema-score.test.ts` `[PASS]` | Legacy fallback may render without duplicating a strict node but cannot contribute strict parent/child points or emit an incompatible subtype. | Prevents Frankenstein scoring |
| **TC-F37-02-47** | AC-04 | Regression | Rejected settings save restores the previous valid pair | `src/app/(editor)/editor/[siteId]/page.tsx`; `publish-flow.test.tsx` `[PASS]` | LocalBusiness saves are serialized; direct rejection restores the confirmed snapshot, a newer revision waits for the older request, and a late failure from site A cannot roll back active site B. Focused file: 21/21 local. | Prevents invalid optimistic state after failed save |
| **TC-F37-02-48** | AC-04 / Resilience | Regression | Response-loss reconciliation and unknown-outcome lock | `src/app/(editor)/editor/[siteId]/page.tsx`; `SettingsPanel.tsx`; `publish-flow.test.tsx`; `settings-panel.test.tsx` `[PASS]` | A semantically committed save reconciles after server normalization and Payload row metadata. Stalled reconciliation times out after 5 seconds. An unresolved save returns `false`, locks every LocalBusiness form until reload, and removes any later never-sent revision from visible state without rolling back the ambiguous in-flight snapshot. Targeted files: 65/65 local. | Prevents false rollback, phantom saves, and overwrite after an ambiguous commit |

---

## 3.6 US-F37-03: Platform-managed AI Discoverability **[TARGET REWIRE]**

> Target contract: approved AI assistant crawlers are always allowed and always earn 9 points. The seller sees no crawler toggle, sitemap resubmit, auto-meta toggle, or SEO Action Tools section. Current toggle-based code must be removed or made non-authoritative during implementation.

| ID | AC/FR | Type | Title | Status | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-03-01** | AC-01 / FR-12 | Func | robots.txt always allows approved AI assistant bots | target `[NOT-BUILT]` | GPTBot/ClaudeBot/Google-Extended/PerplexityBot/CCBot are not blocked for any tenant. | Platform invariant |
| **TC-F37-03-02** | AC-02 / FR-12 | UI | No seller-facing discoverability controls | target `[NOT-BUILT]` | Dashboard and Site Settings contain no crawler toggle, sitemap resubmit, auto-meta toggle, or SEO Action Tools section. | KISS UI |
| **TC-F37-03-03** | AC-01 / FR-12 | Regression | Persisted legacy `false` cannot block approved AI bots | target `[NOT-BUILT]` | A legacy site record cannot change robots behavior or reduce the 9 crawler points. | Migration safety |
| **TC-F37-03-04** | AC-01 | Func | Googlebot/Bingbot remain allowed | target `[NOT-BUILT]` | Normal search crawlers remain crawlable. | SEO safety |
| **TC-F37-03-05** | AC-6 | Func | `GET /llms.txt` → 200 `text/plain` | `[NOT-BUILT]` | Route tồn tại, status 200, MIME text/plain. | AEO signal |
| **TC-F37-03-06** | AC-6 | Func | llms.txt content: tên, mô tả, ≥5 URL, contact, giờ, markdown | `[NOT-BUILT]` | Đủ element cấu trúc markdown. | llms.txt hợp lệ |
| **TC-F37-03-07** | BR-09 | Func | llms.txt runtime-generated, cache ngắn | `[NOT-BUILT]` | Không long-cache; phản ánh data mới. | Freshness |
| **TC-F37-03-08** | NFR-3 | Sec | Platform crawler invariant is tenant-safe | target `[NOT-BUILT]` | Every tenant receives the same approved allow policy without cross-tenant state. | Isolation |
| **TC-F37-03-09** | §5 / FR-12 | Func | Score always awards crawler baseline | target engine `[NOT-BUILT]` | AI Discoverability always includes 9 crawler points; unpublished sites earn no sitemap/llms points. | Score integrity |

---

## 3.7 US-F37-04: Unified SEO Health Score & Actions **[TARGET NOT BUILT]**

> Existing `local-seo-score.ts` and its API still use the legacy top-level contract. #1309 added the pure 7/8/5 Minimal Business helper, an additive persisted `minimalBusinessData` response, and 401/403 API coverage without partially changing the top-level score. Target behavior remains the single F37 §5 score rendered by the existing F03 `SeoHealth` surface; #1312 owns that atomic cutover and the unified dashboard/checklist.

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-04-01** | FR-19 | Sec | Score API — unauth → 401 | `api/local-seo-score.test.ts` `[BUILT]` | GET không session → 401 trước khi đọc site. | Auth gate |
| **TC-F37-04-02** | FR-19 | Sec | Score API — cross-tenant → 403 | `api/local-seo-score.test.ts` `[BUILT]` | Site ngoài tenant → 403 và không query pages. | IDOR guard |
| **TC-F37-04-03** | FR-19 | Edge | Score API — rate-limit 30/60s → 429 | `route.ts` `[UNTESTED]` | Request thứ 31 trong 60s → 429. | Abuse guard |
| **TC-F37-04-04** | FR-19 | Edge | Score API — site không tồn tại → 404 | `route.ts` `[UNTESTED]` | siteId sai → 404. | Error handling |
| **TC-F37-04-05** | FR-19 | Func | Score API — derive every signal in F37 §5 | target engine `[NOT-BUILT]` | Metadata/content/schema/AI/technical inputs map to the authoritative scorecard. | Điểm phản ánh data thật |
| **TC-F37-04-06** | FR-19 | Edge | Score API — lỗi nội bộ → 500 handler | `route.ts` `[UNTESTED]` | Exception → 500 sạch, không leak. | Resilience |
| **TC-F37-04-07** | §5 | Func | Engine — Business Data 7/8/5 | `local-seo-score.test.ts` `[PARTIAL]` | Pure helper proves name + address + phone total exactly 20; top-level engine cutover remains #1312. | Bucket contract guarded without partial runtime drift |
| **TC-F37-04-08** | §5 | Func | Engine — Schema totals 35 | target engine `[NOT-BUILT]` | Eight approved schema signals total exactly 35. | Bucket đúng |
| **TC-F37-04-09** | §5 | Func | Engine — four buckets sum exactly 100 | target engine `[NOT-BUILT]` | Business 20 + Schema 35 + AI 15 + Technical 30 = total. | No-drift rule |
| **TC-F37-04-10** | AC-1 / FR-20 | Func | **[NOT-BUILT]** Unified KISS layout | pending unified widget | One gauge; no Score History; four bucket bars in a 2×2 desktop grid without bucket point values; SEO Issues uses the existing two-column row pattern. | US-04 core UI |
| **TC-F37-04-11** | AC-2 / FR-12 | Func | **[NOT-BUILT]** AI crawler signal stays hidden | pending unified widget | Crawler access earns 9 points but never renders an issue, toggle, CTA, or Action Tools card. | KISS platform invariant |
| **TC-F37-04-12** | FR-20 / FR-21 | Func | **[NOT-BUILT]** Actor, CTA, and destination contract | pending unified widget | Every unresolved seller issue uses `AI` or `You` and the matching Fix/Edit/Set up/Publish behavior from PRD §12.3; completed issues are hidden. | Action clarity |
| **TC-F37-04-13** | FR-19 | Func | Score recalc khi seller thay đổi signal thuộc §5 | integration | Save → recompute; PostHog analytics không ảnh hưởng score. | Freshness |
| **TC-F37-04-14** | AC-1 | Func | `completion-checklist.tsx` — addressDone cần đủ 4 field, hoursDone predicate | component `[UNTESTED]` | addressDone chỉ khi street+city+state+postcode; hoursDone khi có ≥1 ngày mở. | US-01 indicator đúng |
| **TC-F37-04-16** | AC-05 / AC-07 | Func | **[NOT-BUILT]** Conditional AI Fix strip | pending unified widget | Strip and Fix All show only when at least one title/description issue is AI-fixable; Fix opens the existing modal filtered to the affected field; Local Business data is unchanged. | Prevents false AI capability |
| **TC-F37-04-17** | AC-06 | Func | **[NOT-BUILT]** Root-cause deduplication | target issue derivation | Missing address creates one Address issue, not separate Address + LocalBusiness rows; missing phone creates one Phone issue, not Phone + schema telephone rows; unpublished creates one Publish issue, not Sitemap + llms.txt rows. | KISS issue list |
| **TC-F37-04-18** | FR-21 | Func | **[NOT-BUILT]** Platform-managed metrics create no seller task | target issue derivation | Organization and indexability never render AI/You issue rows; Google verification renders Set up only after its Editor SEO destination exists. | No dead-end CTA |

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
| **TC-F37-09-16** | AC-14 | Func | Mobile 375px — SEO issues one column, CTA ≥44px, no overflow | responsive | Gauge → four bars → conditional AI strip → one-column issues; no horizontal overflow; action targets are full-width and ≥44px. | Mobile UX |

---

## 3.10 Gap-Fill v2.1 — Edge/Branch Scenarios (from ck:scenario cycle)

> 15 scenario chưa cover, grounded vào **code thật** (đọc `map-links.ts`, `resolve-maps-link/route.ts`, `local-seo-score/route.ts`, `json-ld.ts`). Ưu tiên branch ở surface built-nhưng-chưa-test → giá trị QA cao nhất.

### US-F37-02 JSON-LD — branch chưa cover

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-02-10** | AC-3 | Sec | `serializeJsonLd` escape **U+2028/U+2029 + `<>&`** (không chỉ `</script>`) | `json-ld.ts` `[UNTESTED branch]` | Line-separator (U+2028) và paragraph-separator (U+2029) bị escape; `<`,`>`,`&` escape. Chống breakout `dangerouslySetInnerHTML` ngoài case </script>. | XSS defense đầy đủ |
| **TC-F37-02-11** | AC-2 | Edge | openingHours drop row `isClosed=false` nhưng **thiếu opens/closes** | `json-ld.ts` | Row mở-nhưng-không-giờ bị loại khỏi `openingHoursSpecification` (không emit spec nửa vời). | Hours schema hợp lệ |
| **TC-F37-02-12** | Additional Criteria | Func | `hasMap` — Google Maps URL fallback từ lat/lng khi GBP/Waze chưa connect | `local-business-json-ld.test.ts` (`[TC-F37-02-12]` describe) | Có lat/lng hợp lệ → `hasMap = https://www.google.com/maps?q={lat},{lng}`. Thiếu toạ độ → `hasMap` omit (không emit link hỏng). | Local Pack map link tạm thời, nâng cấp lên GBP/Waze URL khi US-F37-05/09 xong |

### US-F37-04 Score API/engine — branch chưa cover

| ID | AC/FR | Type | Title | Code Ref | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-04-15** | FR-19 | Sec | Score API **403 khi `site.tenant` null/thiếu** (không chỉ cross-tenant) | `local-seo-score/route.ts` dòng 56 `[UNTESTED]` | `siteTenantId` null → 403 (không lọt score cho site không gắn tenant). | IDOR guard đầy đủ |

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

## 3.11 Geo Cascade Data-Quality Follow-up (US-F37-01) **[FULLY BUILT]**

> Not a new US — a data-quality improvement to the already-merged US-F37-01 (PR #1527), replacing freetext `city`/`postcode` with a DB-backed **State → District → Postcode** cascade ported from checkout's `/api/geo/*` pattern. Plan: `plans/260710-1032-f37-local-business-geo-cascade/`.

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-01-15** | Additional Criteria | Func | Forward cascade: state→district→postcode writes plain string names via `onChange` | `geo-cascade-fields.test.tsx` | Each level fires exactly one `onChange` patch with resolved DB names, not ids. | Cascade UX matches checkout |
| **TC-F37-01-16** | Additional Criteria | Func | Selecting a new state clears downstream city+postcode in ONE combined patch | `geo-cascade-fields.test.tsx` | Single `onChange` call per level (not 3 separate calls); district select re-disables. | No stale downstream selection |
| **TC-F37-01-17** | Additional Criteria | Func | Reverse-resolve via `/api/geo/lookup/{postcode}` pre-selects state+district+postcode on mount | `geo-cascade-fields.test.tsx` | Valid saved postcode → all 3 selects pre-filled; `onChange` never fired (read-only pre-fill). | Existing sites keep working data quality |
| **TC-F37-01-18** | Additional Criteria | Func | Reverse-resolve by exact name match when postcode blank | `geo-cascade-fields.test.tsx` | Saved state+city name-matched against DB list; postcode select stays empty. | Handles pre-lookup-API legacy saves |
| **TC-F37-01-19** | Additional Criteria | Edge | Legacy city (freetext, no DB match) degrades non-destructively | `geo-cascade-fields.test.tsx` | State pre-selected; district shows placeholder + amber hint with raw saved string; `onChange` never fired (string never cleared). | Seller's existing SEO data never silently lost |
| **TC-F37-01-20** | Additional Criteria | Edge | Legacy state (no DB match) + postcode-not-in-DB (lookup 404) both degrade non-destructively | `geo-cascade-fields.test.tsx` | (1) Unmatched state name → legacy hints on both state+city rows. (2) 404 lookup falls through to name-match without throwing; resolves fine when names DO match. | Graceful degradation, no crash |
| **TC-F37-01-21** | NFR | Edge | All `/api/geo/*` calls rejecting (network/500) never throws; saved strings surface via legacy hint | `geo-cascade-fields.test.tsx` | Render doesn't throw; selects stay usable; legacy hint shows original saved value. | Resilience — page never breaks on geo API outage |
| **TC-F37-01-22** | AC-1 | Func | Cascade string output (city/state/postcode) still maps unchanged to `addressLocality`/`addressRegion`/`postalCode` | `local-business-json-ld.test.ts` | `generateLocalBusinessSchema()` contract untouched — reads plain strings regardless of cascade vs legacy freetext origin. | Regression guard: JSON-LD never needs to change for this follow-up |
| **TC-F37-01-23** | Data integrity | Regression | `scripts/data/malaysia-geo.json` state names match `MY_STATES` enum exactly (all 16) | `malaysia-geo-seed-data.test.ts` | Seed `name` field for every state equals a `MY_STATES` member; no duplicates. Found via `/code-review` ultrathink adversarial pass: 4/16 states (KL, Labuan, Penang, Putrajaya) previously seeded with official long-form names ('W.P. Kuala Lumpur' etc.) that fail `z.enum(MY_STATES)` validation on save — fixed at the seed source. | Prevents silent save failures for sellers in 4 major MY regions on any freshly-seeded environment |
| **TC-F37-01-24** | NFR | Edge | Out-of-order `/api/geo/districts` response is discarded via stale-response guard | `geo-cascade-fields.test.tsx` | Selecting state A then B before A's districts fetch resolves, then resolving A's response AFTER B's, must NOT overwrite B's district list with A's (verified: fails without the ref-based guard, passes with it). Same pattern found in reference checkout implementation, not previously guarded. | Prevents wrong city/state data being silently persisted on rapid re-selection |
| **TC-F37-01-25** | Additional Criteria | Regression | Manual selection beats async mount-time pre-fill (race condition guard) | `geo-cascade-fields.test.tsx` | **Fix from PR #1591 code review:** `bootstrap()` function (reverse-resolve pre-fill on component mount) was running async lookup of saved postcode/state-name after user had already manually selected a new value, silently overwriting the user's choice. Fixed by adding `userInteractedRef` guard — if user has interacted with any cascade level, `bootstrap()` skips writing to preserve user's manual selection. Tests: (1) Mount with saved postcode → pre-fill works (user hasn't interacted), (2) User selects state manually, then bootstrap completes → user's selection preserved (not overwritten). | Fixes race condition: pre-fill could clobber user's manual selection during edit |

---

## 3.12 Opening Hours — Google Maps-style Editor (US-F37-01 follow-up) **[FULLY BUILT]**

> Not a new US — redesigns the Local Business opening-hours editor from a fixed 7-row inline table into a Google Maps-style **list view + edit modal** flow: multi-day batch select, split-shift (N time ranges/day), quick-actions. Plan: `plans/260710-1455-opening-hours-google-style/`.

| ID | AC/FR | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|---|
| **TC-F37-02-13** | AC-2 | Func | `openingHours` cap raised 7→21 (split-shift support) | `sites-local-business.test.ts` | 21-row payload passes `saveSiteSchema.localBusiness`; 22-row payload fails (`.max(21)`). | Zod cap stays in sync with Payload `maxRows` and modal's 3-ranges/day cap |
| **TC-F37-02-14** | AC-2 | Func | `groupRowsByDay` — Mo→Su order, handles gaps and out-of-order input | `opening-hours-utils.test.ts` | 7 groups always returned in fixed day order regardless of input order; missing days yield empty arrays, not undefined. | List view renders deterministically regardless of DB row order |
| **TC-F37-02-15** | AC-2 | Func | `rangesFromDay` — mode inference + split-shift round-trip | `opening-hours-utils.test.ts` | Infers closed/open24h/custom correctly; split-shift ranges round-trip through `groupRowsByDay` in opens-time order. | Modal pre-fill shows the correct mode and ranges for any saved day |
| **TC-F37-02-16** | AC-2 | Func | `applyBatchSave` — OVERWRITE semantics, not merge | `opening-hours-utils.test.ts` | Saving a day replaces ALL its existing rows (no duplicate accumulation across repeated split-shift saves); untouched days are never altered; one call can batch-apply to multiple selected days. | Highest-risk logic in the whole feature — prevents duplicate/ghost hour rows on repeated edits |
| **TC-F37-02-17** | AC-2 | Func | `applyBatchSave` — closed / open24h / custom encodings | `opening-hours-utils.test.ts` | closed → 1 `isClosed:true` row; open24h → 1 `00:00`–`23:59` row; custom → 1 row per range (split-shift); incomplete ranges (missing opens/closes) are skipped. | Encodings match the schema.org `OpeningHoursSpecification` contract with no half-written rows |
| **TC-F37-02-18** | AC-2 | Edge | `describeDay` — list-view display strings | `opening-hours-utils.test.ts` | Empty day → `[]`; fully-closed day → `[closedLabel]`; split-shift day → one line per range. | List view text matches underlying data exactly, incl. split-shift |
| **TC-F37-02-19** | AC-2 | Func | `defaultWeek` — brand-new-site empty-state suggestion unchanged | `opening-hours-utils.test.ts` | Mon–Fri 09:00–18:00 open, Sat/Sun closed (matches pre-redesign default). | Empty-state UX parity preserved across the redesign |
| **TC-F37-02-20** | AC-2 | Edge | `applyBatchSave` — rows with no `dayOfWeek` are kept untouched | `opening-hours-utils.test.ts` | A malformed row (no `dayOfWeek`) is never dropped or matched by `selectedDays`, regardless of selection. | Defensive: legacy/malformed rows never silently disappear on save |
| **TC-F37-02-21** | AC-2 | Func | Split-shift `openingHours` produces N separate `OpeningHoursSpecification` entries | `local-business-json-ld.test.ts` | A day with 2 time ranges (e.g. 07:00–11:00, 13:00–18:00) yields 2 separate spec entries with the same `dayOfWeek`, in range order. | Confirms `json-ld.ts`'s existing 1:1 row mapping needs zero changes for split-shift (regression guard from cap-raise) |
| **TC-F37-02-22** | AC-2 | Func | `OpeningHoursEditor` list view renders 7 days incl. split-shift + quick-actions | `opening-hours-editor.test.tsx` | All 7 day labels render; a split-shift day shows both time-range lines; a closed day shows the closed label; all 3 quick-action buttons ("Edit all hours", "Edit Mon–Fri", "Edit Sat–Sun") render. | Light integration guard — real component render, not just pure-util coverage |
| **TC-F37-02-23** | AC-2 | Func | `isRangeOrderValid` — closes must be strictly after opens (no overnight support) | `opening-hours-utils.test.ts` | Valid when closes > opens; invalid when closes == opens or closes < opens; treated as not-yet-invalid while either field is empty (mid-entry). | User-requested guard against nonsensical/mistyped ranges; overnight explicitly out of scope |
| **TC-F37-02-24** | AC-2 | Func + Regression | `openingHours` closes-after-opens Zod refine + closed-row-without-times fix | `sites-local-business.test.ts` | Rejects closes==opens and closes<opens rows; accepts closes>opens; **accepts an `isClosed:true` row with no `opens`/`closes` keys at all** — regression guard for a real bug found in this pass (save API was silently rejecting every "Closed" day before `opens`/`closes` were made `.optional()` in the Zod schema to match the pre-existing `OpeningHourRow` TS type). | Fixes a functional bug: marking a day Closed previously failed to save |
| **TC-F37-02-25** | AC-2 | Regression | Zod `.superRefine()` refactor (required-when-open check via cross-field validate) | `sites-local-business.test.ts` | **Fix from PR #1591 code review:** Zod `.refine()` left some paths uncovered (only validates at schema level, not per-field). Switched to `.superRefine()` for granular error handling + added field-level cross-field validate in `Sites.ts` collection using `siblingData` to access `isClosed` state when validating `opens`/`closes` fields. Tests reject: (1) opens without closes, (2) closes without opens, (3) closes ≤ opens. Accepts: (4) valid closed row with both missing, (5) valid open row with both present and closes > opens. | Fixes edge case: opening-hours validation was incomplete, could pass invalid rows upstream |
| **TC-F37-02-26** | AC-2 | Regression | `sanitizeLegacyOpeningHours` — normalizes rows saved before TC-F37-02-25's strict validation | `opening-hours-utils.test.ts` | **Fix from PR #1591 code review (C2):** TC-F37-02-25 made `opens`/`closes` required-when-open, but a row saved under the OLD lenient rule (isClosed false/omitted, opens/closes missing) still exists in stored data and now fails validation on re-send. `handleLocalBusinessChange` calls this **unconditionally** on every save (not just when `openingHours` is untouched) because `applyBatchSave` only re-encodes the edited day(s) and passes every other day through as-is — a legacy-invalid row on an UNTOUCHED day would otherwise 400 an edit to a different day. No-op for `encodeDay`'s output. | Fixes a live-data hazard: sites saved before this PR could get permanently blocked from saving ANY local-business field |
| **TC-F37-02-27** | AC-2 | Edge | `sanitizeLegacyOpeningHours` — drops orphan rows with no `dayOfWeek` | `opening-hours-utils.test.ts` | **Fix from PR #1591 code review (C2, same class as TC-F37-02-26):** `applyBatchSave` intentionally keeps a no-`dayOfWeek` row on any local batch edit (TC-F37-02-20, unchanged), but `groupRowsByDay` never matches it to a day, so it's invisible in the UI and unfixable by the user — it would silently accumulate toward `.max(21)` if resent to the server forever. Dropped at the save boundary instead of normalized. | Prevents an invisible/unfixable row from exhausting the 21-row split-shift cap |
| **TC-F37-02-28** | AC-2 | Regression | `sanitizeOpeningHoursOnValidate` — `Sites.ts` `beforeValidate` hook, direct coverage | `sites-opening-hours-sanitize-hook.test.ts` | **Fix from PR #1591 code review (Q2 + Stage 3 adversarial finding #7):** the hook added to answer the reviewer's Q2 (admin-panel write path parity) had zero direct test coverage — only the pure `sanitizeLegacyOpeningHours` it delegates to was tested, so the guard logic, the merge/spread, and the fact the hook is actually wired into `hooks.beforeValidate` were all unverified. Tests cover: undefined data, no `localBusiness`, no `openingHours`, non-array `openingHours`, legacy-invalid + orphan rows sanitized, already-valid no-op, and — the highest-value case — sibling `localBusiness` fields and other top-level `data` fields are never dropped by the hook's spread/merge. | Closes a real Medium gap found by adversarial review: an accidental future edit to the hook (guard, spread, or removal from the `hooks` array) would previously go undetected by CI |

---

## 3.13 CI Migration Guard — `check-migrations.js` new-field detection redesign

> Not an F37 feature — a CI hard-gate script (blocks PRs missing a DB migration for a new Payload field) that this PR's own field additions (`Sites.ts localBusiness`, `openingHours` cap) exercised heavily during review, triggering a full redesign. Tracked here per the project's single-doc-map convention (no dedicated doc owns CI scripts). See `docs/journals/260713-pr1591-f37-02-three-bug-fixes.md` and `plans/reports/code-review-260713-1139-GH-02-check-migrations-4-rounds-final.md` for the full adversarial-review trail.

| ID | Type | Title | Test File | Key Assertions | Impact |
|---|---|---|---|---|---|
| **TC-check-migrations-01** | Func | `getFieldRoles` — classifies nested vs top-level vs container fields | `check-migrations.test.ts` | Array-child field → `nested:true`; field with no array ancestor → `nested:false`; the array/group field itself → `isContainer:true`, not counted as its own child. | Foundation for all new-field detection below |
| **TC-check-migrations-02** | Edge | `getFieldRoles` — same bare name nested under two different arrays | `check-migrations.test.ts` | Both occurrences of a colliding name (e.g. `value` in `Products.ts`) correctly report `nested:true`. | Confirms depth-independence of the nested scope-stack |
| **TC-check-migrations-03** | Regression | bare-name collision no longer false-negatives | `check-migrations.test.ts` | A brand-new top-level field is flagged even when its name collides with an unrelated nested field; a purely-nested edit is never flagged. | Closes round-1/2 false-negative (diff-line bare-name matching) |
| **TC-check-migrations-04** | Regression | multi-line vs multi-line collision | `check-migrations.test.ts` | Multi-line-style new top-level field flagged despite colliding bare name with a multi-line nested field. | Closes round-2/3 false-negative (single-line `name:` matching) |
| **TC-check-migrations-05** | Regression | rename to a colliding name | `check-migrations.test.ts` | A renamed top-level field is flagged even when the rename target collides with an unrelated nested field. | Closes round-3 false-negative (cross-hunk diff-line stitching) |
| **TC-check-migrations-06** | Regression | cosmetic edits never false-flag | `check-migrations.test.ts` | Admin-text/validation-only edits to an existing field are never flagged; a genuinely new field added alongside a cosmetic edit still is. | Confirms `(name, nested)` identity (not full content) avoids false-positives |
| **TC-check-migrations-07** | Regression | `isPathMissingAtRef` — distinguishes "file is new" from "git show genuinely failed" | `check-migrations.test.ts` | Recognizes `does not exist in` as legitimate empty baseline; does NOT recognize a bad-ref error or empty/unrelated message as one (fail-closed). | Prevents a false-positive storm if `BASE_BRANCH` itself is misconfigured |
| **TC-check-migrations-08** | Regression | `isPathMissingAtRef` — recognizes the real message for a file new on disk | `check-migrations.test.ts` | Recognizes `exists on disk, but not in '<ref>'` (the actual message for the realistic code path — file passed `existsSync()`, absent at base) as a legitimate empty baseline. | **Fix from PR #1591 code review (C3):** TC-07 alone only covered a message variant that never fires given the `existsSync` guard; a brand-new tracked collection file was silently skipped instead of getting the new-field check |

---

## 4. Test File Locations & Execution

### 4.1 Validation Tests (Phase 02)

**File:** `src/__tests__/unit/validations/sites-local-business.test.ts`

**Test count:** 17 tests (4 functional + 2 security + 5 refine-check variants + 2 opening-hours cap + 4 closes-after-opens)

**Command:** `npm test -- sites-local-business`

**TC-IDs covered:** TC-F37-01-01 through TC-F37-01-04, TC-F37-02-13, TC-F37-02-24, plus 2 security

---

### 4.2 JSON-LD Tests (Phase 04)

**File:** `src/__tests__/unit/seo/local-business-json-ld.test.ts`

**Test count:** 21 tests (7 functional + 1 security + 8 day-mapping variants via `it.each` + 2 `hasMap` + 2 cascade-compat/other + 1 split-shift)

**Command:** `npm test -- local-business-json-ld`

**TC-IDs covered:** TC-F37-01-05, TC-F37-01-06, TC-F37-01-07, TC-F37-01-08, TC-F37-01-09, TC-F37-01-12, TC-F37-01-22, TC-F37-02-12, TC-F37-02-21, plus 1 security

---

### 4.3 Score Tests (Phase 05)

**File:** `src/__tests__/unit/seo/local-seo-score.test.ts`

**Test count:** 15 tests (9 exact Business contract + 6 legacy-engine edge/validation)

**Command:** `npm test -- local-seo-score`

**TC-IDs covered:** TC-F37-01-10, TC-F37-01-11

---

### 4.3a Minimal Business Data Score API Regression

**File:** `src/__tests__/api/local-seo-score.test.ts`

**Coverage:** persisted complete = 20, partial = 12, unauthenticated = 401, cross-tenant = 403, while legacy top-level Business remains 35.

**Command:** `npm test -- src/__tests__/api/local-seo-score.test.ts`

---

### 4.3b Minimal Business Data Phase 2 Verification

**Files:** `src/__tests__/unit/lib/validations/misc-validations.test.ts`, `src/__tests__/unit/editor/settings-panel.test.tsx`, `src/__tests__/unit/editor/publish-flow.test.tsx`, `src/__tests__/unit/seo/local-seo-score.test.ts`, `src/__tests__/unit/editor/compact-editor-layout-pr1485-round2.test.tsx`, `src/__tests__/unit/editor/pr1485-round2-regression.test.tsx`, `src/__tests__/unit/editor/compact-editor-layout-nav-footer-menu.test.tsx`, and `src/__tests__/unit/editor/compact-editor-layout-scroll-lock.test.tsx`

**Test count:** 136 tests (50 validation; 30 `SettingsPanel` regressions, including sparse contact and `localBusiness` payloads, canonical email/address handling, remount-safe pending guards, and phone/email/address restoration; 18 `publish-flow` integration regressions, including failed-contact parent-state isolation, standalone contact patches, owner-safe mutex behavior, serialized/coalesced per-site `localBusiness` saves, same-site refetch protection, cross-site queue isolation, and stale-load cancellation; 15 score regressions; 23 compact-layout regressions, including direct parent-pending propagation)

**Command:** `npm test -- src/__tests__/unit/lib/validations/misc-validations.test.ts src/__tests__/unit/editor/settings-panel.test.tsx src/__tests__/unit/editor/publish-flow.test.tsx src/__tests__/unit/seo/local-seo-score.test.ts src/__tests__/unit/editor/compact-editor-layout-pr1485-round2.test.tsx src/__tests__/unit/editor/pr1485-round2-regression.test.tsx src/__tests__/unit/editor/compact-editor-layout-nav-footer-menu.test.tsx src/__tests__/unit/editor/compact-editor-layout-scroll-lock.test.tsx`

**Result:** 136/136 pass. The review cycles reproduced raw email/address divergence, remount-unlocked inputs, missing desktop/compact parent-pending propagation, a mutex stranded by synchronous setup failure, out-of-order Local Business PATCHes, same-site refetch rollback, cross-site queue loss/blocking, and late previous-site loads; all pass after the fixes. The standalone-patch regression prevents mixed optimistic side effects. `SettingsPanel`, `CompactEditorLayout`, and `publish-flow` provide component/parent-integration guards for canonical sparse contact saves and serialized/coalesced Local Business persistence; they are not direct browser proof of successful PATCH, reload persistence, invalid-phone no-PATCH behavior, or 375px layout. That proof remains assigned to Phase 3.

---

### 4.4 Geo Cascade Component Tests (US-F37-01 data-quality follow-up)

**File:** `src/__tests__/unit/editor/geo-cascade-fields.test.tsx`

**Test count:** 9 tests (RTL + mocked `/api/geo/*` fetch)

**Command:** `npm test -- geo-cascade-fields`

**TC-IDs covered:** TC-F37-01-15 through TC-F37-01-21, TC-F37-01-24

---

### 4.5 Seed Data Regression Guard (US-F37-01 data-quality follow-up)

**File:** `src/__tests__/unit/scripts/malaysia-geo-seed-data.test.ts`

**Test count:** 2 tests

**Command:** `npm test -- malaysia-geo-seed-data`

**TC-IDs covered:** TC-F37-01-23

---

### 4.6 Opening Hours Utils Tests (Opening Hours Google-style redesign)

**File:** `src/__tests__/unit/seo/opening-hours-utils.test.ts`

**Test count:** 30 tests (grouping, mode inference/round-trip, overwrite semantics, encodings, display strings, default week, defensive handling, closes-after-opens validator, legacy-row sanitize)

**Command:** `npm test -- opening-hours-utils`

**TC-IDs covered:** TC-F37-02-14 through TC-F37-02-20, TC-F37-02-23, TC-F37-02-26, TC-F37-02-27

---

### 4.7 Opening Hours Editor Component Tests (Opening Hours Google-style redesign)

**File:** `src/__tests__/unit/editor/opening-hours-editor.test.tsx`

**Test count:** 4 tests (RTL render — 7-day list, split-shift display, closed display, quick-actions)

**Command:** `npm test -- opening-hours-editor`

**TC-IDs covered:** TC-F37-02-22

---

### 4.8 CI Migration Guard Tests

**File:** `src/__tests__/unit/scripts/check-migrations.test.ts`

**Test count:** 14 tests (field-role classification, 4 collision-regression scenarios, cosmetic-edit false-positive guard, 2 git-error-message classification variants)

**Command:** `npm test -- check-migrations`

**TC-IDs covered:** TC-check-migrations-01 through TC-check-migrations-08

---

### 4.9 Sites Collection Hook Tests (`beforeValidate` opening-hours sanitize)

**File:** `src/__tests__/unit/collections/sites-opening-hours-sanitize-hook.test.ts`

**Test count:** 8 tests (guard branches, sanitize + orphan-drop behavior, no-op on valid data, sibling-field/top-level-field non-mutation)

**Command:** `npm test -- sites-opening-hours-sanitize-hook`

**TC-IDs covered:** TC-F37-02-28

---

## 5. Known Limitations & PM Review Items

### Technical Health Signals

Technical Health follows the canonical F37 PRD §5:
- Meta title coverage → 8 points
- Meta description coverage → 8 points
- F03 Content Quality → 8 points
- Google verification + indexable eligible pages → 6 points

The current F37 engine still uses legacy CWV/mobile/HTTPS placeholders. Rewire it to these four approved signals before the unified Dashboard score ships.

### `check-migrations.js` — `getFieldRoles` parser edge cases (Low, not blocking)

**Status:** flagged during PR #1591's second code review (M2, non-blocking). The regex/window-based field parser has known theoretical edge cases: (1) `name:` isn't anchored to an actual field-declaration context, so a `name:` appearing inside a comment or template literal could false-flag (fails safe — over-detection, not under-detection); (2) the forward/backward window used to find a field's own `type:` (±2/+8 lines) is heuristic, not a real parser; (3) Payload's `blocks` field type isn't modeled as a container (currently sidestepped because `Pages.ts`, the only file using `blocks`, is excluded from this check entirely).

**Impact:** none observed — no current `TRACKED_COLLECTIONS` file triggers any of these. Noted for future hardening if a collection's formatting ever hits one of these shapes.

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

## 7. Related Documentation

- **Architecture:** `docs/architecture/F37-local-seo.md` (full technical design, Phase 04/05 details, security analysis)
- **PRD:** `docs/prd/F37-local-seo-search-performance.md` (feature spec, scoring formula §5, acceptance criteria)
- **Changelog:** `docs/CHANGELOG.md` (Phase 03–05 releases, US-F37-01 entry)
- **Code Standards:** `docs/standards/CODE_STANDARDS.md` (Zod schema patterns, JSON-LD best practices)

---

## 8. Test Execution Status

| File | Tests | Status | Coverage | Notes |
|---|---|---|---|---|
| `sites-local-business.test.ts` | 17 | ✅ PASS | 100% of saveSiteSchema.localBusiness | Zod schema + security + opening-hours cap + closes-after-opens |
| `local-business-json-ld.test.ts` | 21 | ✅ PASS | 100% of generateLocalBusinessSchema, generatePageSchemas, dayOfWeekToSchema, serializeJsonLd | JSON-LD + trigger logic + XSS + hasMap + cascade-string regression + split-shift |
| `local-seo-score.test.ts` | 15 | ✅ PASS | `calculateBusinessDataScore` 7/8/5 branches + `calculateLocalSeoScore` regression | 9 exact Business contract tests + 6 legacy-engine bounds/validation tests |
| `geo-cascade-fields.test.tsx` | 9 | ✅ PASS | 100% of GeoCascadeFields forward cascade + reverse-resolve + legacy degradation + stale-response guard | RTL + mocked `/api/geo/*` |
| `malaysia-geo-seed-data.test.ts` | 2 | ✅ PASS | Seed data consistency (`malaysia_states.name` vs `MY_STATES`) | Regression guard, `/code-review` finding |
| `opening-hours-utils.test.ts` | 30 | ✅ PASS | 100% of groupRowsByDay, rangesFromDay, applyBatchSave, defaultWeek, describeDay, isRangeOrderValid, sanitizeLegacyOpeningHours | Pure logic — overwrite semantics, encodings, round-trip, range validation, legacy-row sanitize |
| `opening-hours-editor.test.tsx` | 4 | ✅ PASS | List view render (7 days, split-shift, closed, quick-actions) | RTL — light integration guard |
| `check-migrations.test.ts` | 14 | ✅ PASS | 100% of getFieldRoles, diffNewTopLevelFieldNames, isPathMissingAtRef | CI hard-gate script (not F37 feature code) — new-field detection redesign + git-error classification |
| `sites-opening-hours-sanitize-hook.test.ts` | 8 | ✅ PASS | 100% of sanitizeOpeningHoursOnValidate | `Sites.ts` `beforeValidate` hook — direct coverage added by Stage 3 adversarial finding #7 |
| **Total** | **120** | ✅ **PASS** | **100%** | Includes the 8 additional parameter-expanded Minimal Business contract cases from #1309; Opening Hours Google-style redesign + PR #1591 round-2 fixes remain green |

> **Phase 2 targeted gate (2026-07-27):** the four-file command in §4.3a passed **99/99**, with typecheck, lint, build, and `git diff --check` also passing. This targeted count is not added to the 120-test F37 baseline above: the 15 score tests overlap that baseline, while the full validation, `SettingsPanel`, and `publish-flow` files also contain non-F37 regressions. No Playwright E2E was run or claimed.

---

## 9. Unresolved Questions & Implementation Gaps (Phase 1)

> Cần PM/Dev chốt trước khi các TC `[NOT-BUILT]` chạy được. Đánh dấu để QA không nhầm "chưa test" với "fail".

1. **🔴 Platform crawler rewire (US-03, BLOCKER):** Code currently persists and honors a seller crawler toggle. Target behavior ignores/removes that setting, always allows approved AI assistant crawlers, always awards 9 points, and removes the entire SEO Action Tools UI.
2. **US-04 unified SEO Issues chưa build:** Engine + GET API đã có; #1309 covers the additive 7/8/5 Minimal Business response plus TC-04-01/02 (401/403), while TC-04-03..06 remain untested. The KISS card, actor/CTA/destination mapping, AI-strip gating, and root-cause dedupe remain spec-based in TC-04-10..12/16..18. #1312 owns the atomic F37 §5 top-level cutover (20/35/15/30) and unified dashboard/checklist; TC-04-11 verifies the crawler signal stays platform-managed and hidden.
3. **US-09 Waze/Halal chưa build:** MY geo/state/postcode đã có + test; Waze link (AC-18) + Halal cert schema (AC-19) chưa implement → TC-09-12..15 spec-based. **`resolve-maps-link` route (SSRF-critical) + `parseMapLink` parser đã build nhưng CHƯA có test** — TC-09-01..09 là ưu tiên viết automated test cao nhất.
4. **Technical Health rewire (US-04):** Code còn placeholder CWV/mobile/HTTPS → phải thay bằng metadata coverage + F03 Content Quality + verification/indexability trước khi surface score cho seller.
5. **CF-5 metadata fallback cho checkout/orders routes:** Chưa rõ route checkout/orders có nằm dưới `/sites/[slug]/*` và cần `generateMetadata` fallback không → TC-08 boundary chờ confirm implementation.
6. **hreflang (AC-20/FR-26) DEFERRED P2:** blocked bởi i18n client-side, chờ F21 URL-based locale routing. KHÔNG viết TC.
7. **Issue #1309 Phase 3 local browser run passed; live staging pending:** `e2e/f37-minimal-business-data.spec.ts` contains TC-F37-01-26 and TC-F37-01-27. The reserved local one-site run passed auth setup plus both scenarios **3/3**, covering valid PATCH→reload, invalid-phone no-PATCH/restore, sequential name/address/phone persistence, persisted `minimalBusinessData` = 20, restoration/raw verification, and 375px overflow checks. Empty hours prevent this F37-01 flow from rewriting F37-02 row metadata. The spec remains outside the default `e2e-staging` workflow and has not run on staging, so no staging result is claimed. #1312 owns the top-level formula/dashboard/checklist cutover.

---

**Last Verified:** 2026-08-04. US-F37-02 remains synced to `origin/staging`. The new TC-F37-02-48 gate passes 65/65; TypeScript typecheck and repository lint pass. A broader related run has 245 passing assertions; its only 3 failures are PostgreSQL schema-drift checks blocked by the unavailable `127.0.0.1:5432` port, while the migration suite passes 24/24. TC-F37-02-45 live fixture/manual Rich Results evidence remains pending. #1312 retains the atomic 20/35/15/30 and dashboard/checklist cutover.
