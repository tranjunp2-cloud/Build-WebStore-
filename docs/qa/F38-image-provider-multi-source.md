# QA Plan: F38 — Local-First Multi-Source Image Selection

> **Source:** `docs/prd/F38-image-provider-multi-source.md`
> **Scope:** Backend generation pipeline; no UI
> **Automation convention:** `docs/TEST_CONVENTION.md`

## 1. Test status and boundaries

- `[x] AUTO`: an automated test with this TC-ID exists in the repository.
- `[ ] AUTO`: required automated coverage is not implemented.
- `[ ] MANUAL`: staging/runtime verification is required.
- Every automated test must import production code, use Arrange/Act/Assert, and include
  its TC-ID in the test name, `describe` title, or comment header.
- Sections 3–12 cover the target path enabled by `F38_IMAGE_PIPELINE=true`.
- Section 13 preserves still-valid pre-F38 Pixabay regressions. Those tests protect the
  compatibility path when the flag is false; they do not prove the target F38 path exists.

## 2. Requirement traceability

| Requirement area | PRD coverage | QA coverage |
|---|---|---|
| Global catalog | FR-01, FR-12; AC-7; PRD 5.1, 7 | `TC-F38-CAT-*` |
| Reservoirs and final-page planning | FR-07–11; AC-3–5; PRD 3–4, 6 | `TC-F38-RES-*`, `TC-F38-REUSE-*` |
| Local relevance | FR-01; PRD 5.1 | `TC-F38-SCORE-*` |
| Pixabay budget, cache, and single-flight | FR-06; AC-6; PRD 5.3 | `TC-F38-BUDGET-*` |
| Multi-key health | FR-06; PRD 5.3 | `TC-F38-KEY-*` |
| Wikimedia and OpenAI rating | FR-02–04; AC-1; PRD 5.2 | `TC-F38-WIKI-*` |
| Persistence and provenance | FR-12; AC-7; PRD 7 | `TC-F38-PERSIST-*` |
| Runtime fallback and overflow | FR-02, FR-05, FR-10; AC-2, AC-4; PRD 5.4 | `TC-F38-FALLBACK-*` |
| Migration and security | FR-12; PRD 7 | `TC-F38-MIG-*`, `TC-F38-SEC-*` |
| Observability and rollout | FR-13; PRD 12 | `TC-F38-OBS-*`, `TC-F38-STAGE-*` |

## 3. Target contract — global catalog

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-CAT-01** | Blocker | Catalog resolves every demanded reservoir | Catalog is queried first; selected shared Media IDs are assigned; Wikimedia and Pixabay receive zero searches | [x] AUTO |
| **TC-F38-CAT-02** | Critical | Catalog hard-filter order | Filter `active=true`, complete license, category, aspect, non-null `mediaId`/`objectKey`, then validate object existence before scoring | [x] AUTO |
| **TC-F38-CAT-03** | Critical | Object existence validation | Missing/failed object checks reject the candidate and emit a redacted validation event | [x] AUTO |
| **TC-F38-CAT-04** | Critical | Bounded PostgreSQL search | OR-match normalized subject terms; return at most 200 rows in text-rank, `useCount`, null-first `lastUsedAt`, provider-ID order | [x] AUTO |
| **TC-F38-CAT-05** | Critical | Partial catalog fill | Retain distinct local winners and advance only the remaining reservoir deficit to Wikimedia | [x] AUTO |
| **TC-F38-CAT-06** | Critical | Shared catalog ownership | Catalog row requires one global system-owned Media relationship; blocks use the same Media ID and no tenant copy is created | [ ] AUTO |
| **TC-F38-CAT-07** | Critical | Catalog authorization | Catalog Media is public-read and system-write; tenant users cannot update or delete it | [ ] AUTO |
| **TC-F38-CAT-08** | Major | Organic warming only | Only selected images from approved test/production generations upsert the catalog; no bulk-harvest path is invoked | [ ] AUTO |

## 4. Target contract — five shared reservoirs

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-RES-01** | Blocker | Plan one generation | Exactly five reservoir types are planned once in fixed order: landscape, square, people, products, blogs | [x] AUTO |
| **TC-F38-RES-02** | Critical | Site landscape demand | Demand is capped at 12; request is `per_page=200`, landscape; query uses first trusted subject or category base | [x] AUTO |
| **TC-F38-RES-03** | Critical | Site square demand | Demand is capped at 6; request is `per_page=200`, all orientations; local square-compatible gate applies | [x] AUTO |
| **TC-F38-RES-04** | Critical | People demand | Demand is capped at 6; query is exactly `professional portrait`; category is `people`; no product/mood term enters | [x] AUTO |
| **TC-F38-RES-05** | Critical | Product demand | Demand is capped at 6; first trusted product or category base is used; product blocks cannot consume site-square results | [x] AUTO |
| **TC-F38-RES-06** | Critical | Blog demand | Demand is capped at 3; first blog `imageKeyword` or category base is used; blog blocks cannot consume site-landscape results | [x] AUTO |
| **TC-F38-RES-07** | Critical | Zero-demand reservoir | Reservoir is skipped with no catalog/provider request | [x] AUTO |
| **TC-F38-RES-08** | Blocker | Final planning and consumer routing | After pages are finalized, plan every supported persisted slot independent of `PIXABAY_BLOCKS`; pages, prepared products/blogs, and library use one resolver; an empty library result replaces stale assignments | [x] AUTO |
| **TC-F38-RES-09** | Critical | Deterministic request shape | Only one subject term plus mapped Pixabay category is sent; Wikimedia gets the same subject and aspect | [x] AUTO |

## 5. Target contract — deterministic local scoring

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-SCORE-01** | Critical | Normalize terms | NFC, lowercase, punctuation-to-space, trim, and collapse whitespace; retain Vietnamese diacritics; do not stem | [x] AUTO |
| **TC-F38-SCORE-02** | Critical | Synonym contract | Snapshot the complete version-controlled symmetric `IMAGE_RELEVANCE_SYNONYMS`; no runtime/LLM synonyms | [x] AUTO |
| **TC-F38-SCORE-03** | Critical | Category gate | Exact composer category is required; people accepts only `people`; category mismatch always rejects | [x] AUTO |
| **TC-F38-SCORE-04** | Critical | Aspect hard gate | Landscape accepts ratio `>=1.25`; square-compatible accepts `0.80–1.25`; boundaries are inclusive | [x] AUTO |
| **TC-F38-SCORE-05** | Critical | Exact subject score | One contiguous normalized subject phrase adds exactly 5 once | [x] AUTO |
| **TC-F38-SCORE-06** | Critical | Partial/synonym score | Explicit synonym or all subject tokens adds exactly 3 once; multiple matches do not stack with exact or each other | [x] AUTO |
| **TC-F38-SCORE-07** | Major | Exact-aspect score | Add 2 only at landscape `>=1.50` or square `0.90–1.10`; merely compatible aspect adds zero | [x] AUTO |
| **TC-F38-SCORE-08** | Critical | Threshold and forbidden relevance | Require total `>=5`; mood-only, category-only conflict, and below-threshold candidates reject | [x] AUTO |
| **TC-F38-SCORE-09** | Blocker | Generation-wide exact identity | Reject repeated provider identity, Media ID, object key, or canonical curated URL across reservoirs | [x] AUTO |
| **TC-F38-SCORE-10** | Critical | Deterministic winner tie-break | Order by score, `useCount`, null-first `lastUsedAt`, then lexical provider and provider ID | [x] AUTO |

## 6. Target contract — atomic five-attempt budget and process cache

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-BUDGET-01** | Blocker | Request-scoped cap | One atomic `PixabayAttemptBudget(limit=5)` is shared by the generation; six concurrent search callers cause at most five fetches | [x] AUTO |
| **TC-F38-BUDGET-02** | Blocker | Count actual attempt | Reserve immediately before fetch; HTTP response, abort, timeout, and connection loss each remain counted | [x] AUTO |
| **TC-F38-BUDGET-03** | Critical | Zero-cost stages | Catalog, Wikimedia, process-cache lookup/hit, and image-byte download consume zero Pixabay attempts | [x] AUTO |
| **TC-F38-BUDGET-04** | Blocker | Pass-1 fairness | Each unresolved reservoir gets at most one primary attempt in fixed order while preserving one unit for every later unresolved reservoir | [x] AUTO |
| **TC-F38-BUDGET-05** | Blocker | Pass-2 failover | Network/auth/rate failures retry in reservoir order using only leftover budget; failover cannot steal a later primary reservation | [x] AUTO |
| **TC-F38-BUDGET-06** | Blocker | Exhausted/failed reservation | A failed atomic reservation or counter at five performs no fetch; F38 direct calls without the shared budget are rejected | [x] AUTO |
| **TC-F38-BUDGET-07** | Critical | Process-local 24-hour response cache | Successful JSON, including a valid empty result, remains available for 24 hours within the same warm server instance; cold starts and other instances may miss | [x] AUTO |
| **TC-F38-BUDGET-08** | Critical | Cache exclusions | Errors, aborted responses, and invalid JSON are not cached; a cache hit performs no fetch and consumes zero attempts | [x] AUTO |
| **TC-F38-BUDGET-09** | Critical | Canonical cache identity | SHA-256 covers sorted normalized query/search parameters and excludes the API key; key rotation produces the same cache key | [x] AUTO |
| **TC-F38-BUDGET-10** | Critical | Process single-flight | Concurrent same-key misses coalesce; only owner fetches/counts and all waiters receive its result | [x] AUTO |

## 7. Target contract — Pixabay multi-key round-robin

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-KEY-01** | Critical | Parse key list | Trim comma-separated entries, remove empty/duplicate values preserving first order, and reject keys shorter than 10 characters | [x] AUTO |
| **TC-F38-KEY-02** | Critical | Legacy key fallback | Validate `PIXABAY_API_KEY` only when no valid list entry remains; no valid key returns unavailable without fetch/budget use | [x] AUTO |
| **TC-F38-KEY-03** | Critical | Warm-instance round-robin | Cursor starts at zero, selects first healthy key, and advances after selection even when its request fails | [x] AUTO |
| **TC-F38-KEY-04** | Critical | `401`/`403` isolation | Disable only selected key until process restart; another healthy key remains eligible subject to budget | [x] AUTO |
| **TC-F38-KEY-05** | Critical | `429` isolation | Cool only selected key for positive integer `X-RateLimit-Reset`; missing/invalid/non-positive values use 60 seconds | [x] AUTO |
| **TC-F38-KEY-06** | Critical | Repeated `5xx` isolation | Cool selected key for 60 seconds after three consecutive `5xx`; non-5xx resets count; network/timeout does not alter count | [x] AUTO |
| **TC-F38-KEY-07** | Critical | Injectable clock boundary | Key remains unavailable before `cooldownUntil` and becomes healthy at `now >= cooldownUntil`; 5xx count resets | [x] AUTO |
| **TC-F38-KEY-08** | Critical | All keys unhealthy | Return unavailable without fetch or budget consumption | [ ] AUTO |
| **TC-F38-KEY-09** | Blocker | Secret safety | Logs/metrics expose safe key index only and never key values; cursor/health remain process-local | [ ] AUTO |

## 8. Target contract — Wikimedia implementation and fail-fast fallback

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-WIKI-01** | Blocker | F38 source path | F38 resolves catalog → Wikimedia → Pixabay → curated → empty; runtime AI generation is unavailable | [x] AUTO |
| **TC-F38-WIKI-02** | Critical | Adapter request and mapping | Compliant User-Agent; map provider ID, URLs, creator, license, attribution, dimensions, tags/aspect, and alt seed | [x] AUTO |
| **TC-F38-WIKI-03** | Critical | License/host gate | Reject incomplete file-page URL, creator, reusable license name/URL, attribution, dimensions, or disallowed download host before OpenAI rating | [x] AUTO |
| **TC-F38-WIKI-04** | Critical | Bounded reservoir search | Search once per unresolved deficit in fixed order, return at most 20, and consume zero Pixabay attempts | [x] AUTO |
| **TC-F38-WIKI-05** | Critical | OpenAI bounded rating | Send the first five license-valid candidates to OpenAI vision, use `AI_MODEL_IMAGE_RATING` (default `gpt-5.4-mini`), enforce a 5-second timeout, and require exact JSON schema | [x] AUTO |
| **TC-F38-WIKI-06** | Critical | Iterative accepted winners | Accept only relevant input `winnerId`, remove accepted winner, repeat bounded rating until filled/exhausted, and persist winners | [x] AUTO |
| **TC-F38-WIKI-07** | Blocker | Empty result | Zero Wikimedia retries; advance only unresolved deficit directly to Pixabay; Pixabay budget remains unchanged | [x] AUTO |
| **TC-F38-WIKI-08** | Blocker | Wikimedia `429` | Zero Wikimedia retries; preserve accepted winners; direct unresolved deficit to Pixabay without budget consumption or generation failure | [x] AUTO |
| **TC-F38-WIKI-09** | Blocker | Wikimedia timeout | Zero Wikimedia retries; preserve accepted winners; direct unresolved deficit to Pixabay without budget consumption or generation failure | [ ] AUTO |
| **TC-F38-WIKI-10** | Blocker | Wikimedia `5xx` | Zero Wikimedia retries; preserve accepted winners; direct unresolved deficit to Pixabay without budget consumption or generation failure | [ ] AUTO |
| **TC-F38-WIKI-11** | Blocker | Rating cannot select | Invalid JSON/schema, timeout, missing OpenAI key, unknown winner ID, or no relevant winner stops rating with no Wikimedia retry and advances deficit | [ ] AUTO |
| **TC-F38-WIKI-12** | Critical | Partial Wikimedia fill | Retain/persist accepted winners and advance only remaining distinct demand; failures in another deficit do not discard them | [ ] AUTO |

## 9. Target contract — persistence, provenance, and reuse

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-PERSIST-01** | Critical | Common stock candidate contract | Wikimedia/Pixabay normalize all required identity, URLs, provenance, terms/category, dimensions/aspect, and active fields | [x] AUTO |
| **TC-F38-PERSIST-02** | Blocker | Deterministic identity/object | Unique `(provider, providerImageId)` maps to `stock/{provider}/{providerImageId}.{validatedExtension}` and one object | [x] AUTO |
| **TC-F38-PERSIST-03** | Critical | Validate before storage | Download bytes, validate host/type/size/magic/extension, then idempotently put; permanent assignment never hotlinks provider URL | [ ] AUTO |
| **TC-F38-PERSIST-04** | Blocker | Atomic database write | One transaction upserts global Media and catalog, links `mediaId`, and stores complete provenance | [ ] AUTO |
| **TC-F38-PERSIST-05** | Critical | Concurrent unique conflict | Losing upsert re-reads and returns the committed winning row without duplicate Media/object | [x] AUTO |
| **TC-F38-PERSIST-06** | Blocker | Assignment barrier | Assign only after transaction commit and object existence validation | [x] AUTO |
| **TC-F38-PERSIST-07** | Critical | Upload failure | Write no Media/catalog row and assign nothing | [ ] AUTO |
| **TC-F38-PERSIST-08** | Critical | Transaction failure after upload | Assign nothing; retain deterministic orphan for retry/cleanup and do not delete inline | [ ] AUTO |
| **TC-F38-PERSIST-09** | Critical | Pixabay provenance | Persist exact Pixabay license constants and creator-dependent attribution; optional missing creator is empty in candidate contract | [ ] AUTO |
| **TC-F38-PERSIST-10** | Critical | Wikimedia provenance | Creator and attribution are required and non-empty before persistence | [ ] AUTO |
| **TC-F38-PERSIST-11** | Critical | Media null semantics | Empty optional stock provenance is stored as `null`, not an empty string | [ ] AUTO |
| **TC-F38-REUSE-01** | Blocker | Cross-site reuse | Later site reuses same Media ID/object without provider download, new Media row, or new object | [x] AUTO |
| **TC-F38-REUSE-02** | Blocker | Final allocation and no-repeat | Generation-wide provider/Media/object/URL identities stay distinct; final pages allocate before canonical products/blogs and library remainder; the final first-wins page scan clears later duplicate Media IDs | [x] AUTO |
| **TC-F38-REUSE-03** | Major | Usage metadata | Successful cross-site assignment increments `useCount`/`lastUsedAt` without changing object identity | [ ] AUTO |
| **TC-F38-REUSE-04** | Critical | Inactive/missing shared asset | Inactive or missing object rejects new selection while existing site reference, Media row, and retained object are not silently replaced/deleted | [ ] AUTO |

## 10. Target contract — curated fallback, empty overflow, and graceful completion

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-FALLBACK-01** | Blocker | Per-slot order | Enforce catalog → Wikimedia → allowed Pixabay cache hit or HTTP attempt → curated category → empty | [x] AUTO |
| **TC-F38-FALLBACK-02** | Critical | Runtime AI image disable | The runtime resolver has no AI generator; every F38 route demand sets `aiEligible=false`; unresolved stock falls through to curated media | [x] AUTO |
| **TC-F38-FALLBACK-03** | Critical | Empty overflow | Assignment never recycles a prior image; unresolved page, entity, and library slots remain empty and generation completes | [x] AUTO |
| **TC-F38-FALLBACK-04** | Critical | Failure isolation | Provider, score, download, persistence, or rating failure emits stage/reason and advances only unresolved demand without discarding winners | [x] AUTO |
| **TC-F38-FALLBACK-05** | Major | Curated boundary | Curated URLs remain resilience fallback only; they are not catalog/provider search candidates and are not replaced by F38 | [ ] AUTO |

## 11. Target contract — migrations, environment, and security

| TC-ID | Severity | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-MIG-01** | Blocker | Catalog migration | Uses additive `CREATE TABLE IF NOT EXISTS` plus required unique/search indexes with `CREATE INDEX IF NOT EXISTS` | [x] AUTO |
| **TC-F38-MIG-02** | Blocker | Media provenance migration | Adds `sourceProvider`, `sourceUrl`, `licenseName`, `licenseUrl`, and `attribution` with `ADD COLUMN IF NOT EXISTS` | [x] AUTO |
| **TC-F38-MIG-03** | Blocker | No response-cache migration | Migration creates `stock_image_catalog` as the only F38 database table and does not create a `pixabay_response_cache` table or indexes | [ ] AUTO |
| **TC-F38-MIG-04** | Blocker | Existing data safety | Migration contains no `DROP`/rebuild and existing Media records remain readable with nullable new fields | [ ] AUTO |
| **TC-F38-SEC-01** | Blocker | Download SSRF allowlist | Only verified Wikimedia/Pixabay/retained curated hosts pass; arbitrary host is rejected before fetch | [x] AUTO |
| **TC-F38-SEC-02** | Blocker | Download payload validation | Reject invalid content type, oversize body, and mismatched/non-image magic bytes | [x] AUTO |
| **TC-F38-SEC-03** | Critical | License enforcement | Incomplete or non-reusable stock license metadata cannot be selected, downloaded, or persisted | [x] AUTO |
| **TC-F38-SEC-04** | Blocker | Tenant isolation | Tenant-authenticated callers cannot mutate/delete global catalog Media or catalog rows | [x] AUTO |
| **TC-F38-SEC-05** | Blocker | Environment examples | Required F38/provider variables exist in staging/production examples with placeholders only; list falls back safely to legacy key | [ ] AUTO |
| **TC-F38-SEC-06** | Blocker | Secret/prompt redaction | Structured logs and errors contain no API keys, authorization query values, secrets, or full AI prompts | [ ] AUTO |

## 12. Observability and staging acceptance

| TC-ID | Type | Scenario | Expected result | Status |
|---|---|---|---|---|
| **TC-F38-OBS-01** | AUTO | Structured events | Emit catalog outcome, reservoir, score/rejection, provider, attempt count, safe key index/state, fallback stage, and object validation reason | [x] AUTO |
| **TC-F38-OBS-02** | AUTO | Metrics are observational | Missing/low catalog coverage or metrics backend failure does not block generation or rollout logic | [ ] AUTO |
| **TC-F38-STAGE-01** | MANUAL | All-catalog generation | Shared DO Media resolve every consumer, within-site duplicates are zero, and Pixabay attempts equal zero | [ ] MANUAL |
| **TC-F38-STAGE-02** | MANUAL | Wikimedia success | Relevant licensed Wikimedia winner precedes Pixabay/curated fallback and persisted source page, creator, license, attribution, and object are auditable | [ ] MANUAL |
| **TC-F38-STAGE-03** | MANUAL | Wikimedia failure matrix | Empty, `429`, timeout, and `5xx` each fail fast once and fall directly to Pixabay without pre-consuming its budget | [ ] MANUAL |
| **TC-F38-STAGE-04** | MANUAL | Five-attempt/multi-key pressure | One generation never exceeds five actual Pixabay fetches; failed keys do not block healthy keys or leak secrets | [ ] MANUAL |
| **TC-F38-STAGE-05** | MANUAL | Persistence/reuse | Second site reuses first site's shared object/Media; no duplicate object; provenance remains complete | [ ] MANUAL |
| **TC-F38-STAGE-06** | MANUAL | Final fallback | Stock misses skip runtime AI generation, then use distinct curated media or remain empty, and generation completes | [ ] MANUAL |
| **TC-F38-STAGE-07** | MANUAL | Flag rollback | Disabling F38 restores the pre-F38 Pixabay-compatible path without catalog/Wikimedia partial mode | [ ] MANUAL |

## 13. Legacy compatibility coverage — pre-F38 path

These regressions remain relevant only while `F38_IMAGE_PIPELINE=false`. Target F38
tests must not copy their independent-call or provider-retry behavior.

### 13.1 Existing Pixabay client tests

| TC-ID | Scenario | Expected result | Status |
|---|---|---|---|
| **TC-F38-PIXABAY-01** | Map API hits | Pixabay ID/string URL, tags/creator, width, and height map correctly | [x] AUTO |
| **TC-F38-PIXABAY-02** | Orientation mapping | Landscape→horizontal, portrait→vertical, squarish→all | [x] AUTO |
| **TC-F38-PIXABAY-03** | Missing legacy key | Return empty and do not fetch | [x] AUTO |
| **TC-F38-PIXABAY-04** | `per_page` clamp/slice | Request minimum over-fetch and return requested count | [x] AUTO |
| **TC-F38-PIXABAY-05** | Size selection | Large or webformat URL selected from requested width | [x] AUTO |
| **TC-F38-PIXABAY-06** | `429` | Open legacy circuit and fail without client retry | [x] AUTO |
| **TC-F38-PIXABAY-07** | SSRF unknown host | Reject with `SSRF_BLOCKED` | [x] AUTO |
| **TC-F38-PIXABAY-08** | Retained Unsplash fallback host | Allow `images.unsplash.com` for curated compatibility assets | [x] AUTO |
| **TC-F38-PIXABAY-09** | Squarish preference | Over-fetch, rank near-square first, then fill remaining results | [x] AUTO |
| **TC-F38-PIXABAY-10** | `401` | Throw `UNAUTHORIZED` after one fetch | [x] AUTO |
| **TC-F38-PIXABAY-11** | Oversize download | Throw `TOO_LARGE` | [x] AUTO |
| **TC-F38-PIXABAY-12** | Search `TimeoutError` | Classify as `TIMEOUT`, not retry | [x] AUTO |
| **TC-F38-PIXABAY-13** | Download `TimeoutError` | Classify as `TIMEOUT`, not `DOWNLOAD_FAIL` | [x] AUTO |

### 13.2 Existing raw-keyword and legacy fallback tests

| TC-ID | Scenario | Status |
|---|---|---|
| **TC-F38-RAW-01** | Raw VN products exclude English mood/category scaffolding | [x] AUTO |
| **TC-F38-RAW-02** | No products uses category scaffolding | [x] AUTO |
| **TC-F38-RAW-03** | Relaxed multi-product query broadens to first product | [x] AUTO |
| **TC-F38-RAW-04** | Raw keyword derivation remains verbatim | [x] AUTO |
| **TC-F38-RAW-05** | Missing raw keyword uses category/modifier scaffolding | [x] AUTO |
| **TC-F38-RAW-06** | VN query remains verbatim with `lang=vi` | [x] AUTO |
| **TC-F38-RAW-07** | Latin/loanword query keeps default language | [x] AUTO |
| **TC-F38-RAW-08** | Vietnamese/Latin language detection | [x] AUTO |
| **TC-F38-RAW-09** | Thai/Japanese/Korean/Chinese/Russian/Greek detection | [x] AUTO |
| **TC-F38-RAW-10** | Detected language and raw query reach Pixabay | [x] AUTO |
| **TC-F38-RAW-11** | Optional Pixabay category filter | [x] AUTO |
| **TC-F38-RAW-12** | Composer-to-Pixabay category mapping | [x] AUTO |
| **TC-F38-RAW-13** | Testimonial images use people path | [x] AUTO |
| **TC-F38-RAW-14** | Team/doctor images use people path | [x] AUTO |
| **TC-F38-RAW-15** | Explicit language overrides auto-detection | [x] AUTO |
| **TC-F38-RAW-16** | NFC normalization preserves VN detection/relevance | [x] AUTO |
| **TC-F38-RAW-17** | VN tier-3 exception remains contained | [x] AUTO |
| **TC-F38-RAW-18** | Extract 2–4 visual keywords from business context | [x] AUTO |
| **TC-F38-RAW-19** | Missing key/timeout/malformed extraction returns empty | [x] AUTO |
| **TC-F38-RAW-20** | Products-first merge, case-insensitive dedupe, cap | [x] AUTO |
| **TC-F38-RAW-21** | `logo-cloud` emits no legacy Pixabay need | [x] AUTO |
| **TC-F38-RAW-22** | `logo-cloud` URL hydration/empty cleanup remains intact | [x] AUTO |
| **TC-F38-RAW-23** | Non-VN pool underfill uses English category fallback | [x] AUTO |
| **TC-F38-RAW-24** | Non-VN per-block zero-hit uses English category fallback | [x] AUTO |
| **TC-F38-RAW-25** | Legacy provider outage short-circuits its fallback ladder | [x] AUTO |
| **TC-F38-RAW-26** | Do not pad arrays with empty items; assign only generated items | [ ] AUTO |

`TC-F38-RAW-26` behavior has GH-1621 regression assertions, but the test does not
reference this TC-ID. It remains unchecked until the required traceability is added.

### 13.3 Existing legacy call-site suites

- `src/__tests__/unit/ai/image-pool.test.ts`
- `src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts`
- `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts`
- `src/__tests__/unit/lib/images/image-library-seeder.test.ts`
- `src/__tests__/unit/lib/ai/media-injector.test.ts`
- `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts`
- `src/__tests__/unit/lib/ai/media-pipeline-vn-fallback.test.ts`
- `src/__tests__/unit/ai/extract-image-keywords.test.ts`
- `src/__tests__/unit/lib/ai/pixabay-client.test.ts`
