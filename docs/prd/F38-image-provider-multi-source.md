# PRD: Multi-Source Image Provider — Pixabay + Unsplash (F38)

> **Version:** 1.0 | **Created:** 2026-06-24 | **Status:** Draft
> **Priority:** P2 | **Wave:** TBD | **Size:** S (impl plan estimates ~5h)
> **Depends on:** F01 AI Builder (image pipeline consumer) | **Blocks:** —
> **Impl plan:** `plans/260623-1747-pixabay-unsplash-multi-provider/` (4 phases, ready)

> [!IMPORTANT]
> **Stories-First gap:** no approved stories exist for F38 yet. FRs below are tagged
> `[NEED: story]`. Immediate next step: generate `docs/stories/F38-image-provider-stories.md`
> via `/prd:us`, get them approved, then backfill §0 + §11 from the story files.

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F38-01 | Fetch block image from primary provider with fallback | `[NEED: story]` | — |
| US-F38-02 | Switch primary provider via env config | `[NEED: story]` | — |
| US-F38-03 | Build per-site image pool across providers | `[NEED: story]` | — |

> Check: every FR in §7 references a story above (or is tagged `[NEED: story]` pending creation).

## 1. Problem Statement

The image pipeline fetches stock photos from **Unsplash only**. The app runs on the Unsplash
**Demo tier = 50 requests/hour** (Production tier = 1,000/hr, requires Unsplash approval).
Generation is already **pool-first** for site blocks, but still depends on Unsplash for the
pool, per-block deficit fill, image-library seeding, sample products, and blog thumbnails. A
single provider and single API key remains one point of failure for a core feature (generated
sites need complete imagery).

## 2. Target User & Actors

| Actor | Type | Description / state | Goal in this feature |
|-------|------|---------------------|----------------------|
| Site owner | Primary (indirect) | Authenticated user triggering site generation | Generated site has complete, relevant imagery — no missing blocks |
| Generation system | Primary (actor) | Server-side AI gen pipeline calling the provider | Fetch image pools and fallback images reliably, within rate limits |
| Pixabay API | Secondary (system) | External stock-image API, ~6,000 req/hr free | Serve search + image bytes |
| Unsplash API | Secondary (system) | External stock-image API, fallback source | Serve search + image bytes when primary fails |

## 3. Solution Overview

Add **Pixabay** as a second stock-image provider behind a thin **router**. Both providers return
one **normalized `ProviderPhoto` / `ProviderError` shape**, so callers stop coupling to
Unsplash-only mechanics. The router uses **Pixabay as primary** (highest free limit, no
attribution/ToS download-ping) and **falls back to Unsplash** on rate-limit or empty results.
Primary is switchable via env `IMAGE_PROVIDER_PRIMARY`. Existing media orchestration,
bounded concurrency, and Payload-upload logic stay intact; provider-specific retry, download,
and SSRF logic moves behind the provider boundary. No DB change.

> **Why Pixabay primary:** Pixabay free ~6,000/hr ≈ 120× Unsplash demo (50/hr), requires no
> attribution and no mandatory download tracking → safer default for high-volume generation.
> Unsplash stays as fallback for its richer search relevance.

> **Design note (drives the FRs):** a pure import-swap is **not** clean. Consumers currently use
> Unsplash-only `buildImgixUrl(photo.urls.raw, …)`, `photo.links.download_location`, and branch on
> the concrete `UnsplashError` class. The normalized shape removes these couplings; each client
> pre-bakes its own resize URL internally (Imgix for Unsplash, fixed-size pick for Pixabay).

## 4. Scope

**In scope:** normalized provider shape; `pixabay-client.ts`; router with automatic fallback;
env-driven primary selection; provider-aware alt-text; wiring of the 6 direct
`unsplash-client` consumers. `generate-site` remains the orchestration caller and only needs
provider-neutral comments/log labels if touched.
**Out of scope:** see §15-style list below —
- Applying for Unsplash **Production tier** (ops task, tracked separately).
- AI image generation (gpt-image / DALL-E) — `ENABLE_DALLE_HERO` path untouched.
- Search-result caching (none exists; YAGNI).
- New DB schema / migration.
- Multi-key routing on a single provider (violates Unsplash ToS).
- Pixabay video/illustration types — `image_type=photo` only.

## 5. Success Metrics

| Metric | Target | Guardrail | Measured By |
|--------|--------|-----------|-------------|
| Rate-limit failures during site generation | **0** | Generation wall-clock time must not regress | Server logs / gen telemetry over a generation batch |
| Block image fill rate | ≥ existing baseline | No increase in image-fetch errors | Count blocks with valid `media` vs total per site |

## 6. Use Cases

**UC-01: Fetch image for a block**
- **Primary actor:** Generation system · **Secondary:** Pixabay API, Unsplash API
- **Preconditions:** valid `PIXABAY_API_KEY` and/or `UNSPLASH_ACCESS_KEY` configured; a block needs an image with a search query + orientation.
- **Postconditions:** a `ProviderPhoto` is returned and uploaded to Payload `media`, OR the caller applies its existing hero-fallback / skip path.
- **Normal Course:**
  1. System requests an image for a block (query + orientation).
  2. Router calls the **primary** provider (Pixabay) search.
  3. Primary returns ≥1 result; router selects one and returns a normalized `ProviderPhoto`.
  4. System downloads bytes via the provider's `downloadPhotoBuffer` (SSRF-guarded) and uploads to Payload `media`.
- **Alternative Courses (still succeed):**
  - A1. Primary returns **empty** results → router calls **fallback** (Unsplash) → returns a `ProviderPhoto`.
  - A2. Primary throws a **rate-limit** `ProviderError` → router calls fallback → returns a `ProviderPhoto`.
  - A3. Count=1 caller on Pixabay → request `per_page=3` (Pixabay minimum), then slice to 1.
- **Exceptions (goal fails):**
  - E1. Both providers empty/error → caller invokes existing `heroFallbackChain` (Unsplash hardcoded URL) or skips the image. No crash.
  - E2. Download host not on SSRF allowlist → download rejected, treated as a failed fetch (caller falls back).

**UC-02: Switch primary provider via config**
- **Primary actor:** Operator (deploy-time) · **Secondary:** none
- **Preconditions:** env `IMAGE_PROVIDER_PRIMARY` set to `pixabay` or `unsplash`.
- **Postconditions:** router routes all subsequent searches to the chosen primary.
- **Normal Course:**
  1. Operator sets `IMAGE_PROVIDER_PRIMARY` in the environment.
  2. On next generation, router reads the flag and selects primary accordingly; the other becomes fallback.
- **Alternative:** A1. Flag unset/invalid → router defaults to `pixabay`.
- **Exception:** E1. Primary's API key missing → router uses the other provider as primary (degrade, log warning).

**UC-03: Build per-site image pool across providers**
- **Primary actor:** Generation system · **Secondary:** primary + fallback providers
- **Preconditions:** site generation requests a visual-cohesion pool (landscape + square).
- **Postconditions:** a pool of normalized photos is uploaded to the site's Payload `media`, idempotent per site.
- **Normal Course:**
  1. System requests the pool (1–2 searches by orientation).
  2. Router fetches via primary; on underfill, existing relaxed-query retry applies.
  3. Pool photos are uploaded once per site (existing alt-key idempotency).
- **Alternative:** A1. Primary underfills after retry → fallback provider tops up the pool.
- **Exception:** E1. Both underfill → pool ships partial; callers rotate available photos (existing behavior).

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Status | Notes |
|-------|-------------|-----------|----------|--------|-------|
| FR-01 | Define a normalized `ProviderPhoto` + `ProviderError` shape both clients return | `[NEED: story]` | P0 | planned | `src/lib/ai/image-provider-types.ts`; removes Unsplash-only coupling |
| FR-02 | Implement `pixabay-client.ts` exposing `searchPhotos` + `downloadPhotoBuffer` returning the normalized shape | `[NEED: story]` | P0 | planned | `image_type=photo`, `safesearch=true`, env `PIXABAY_API_KEY` |
| FR-03 | Pixabay client pre-bakes its resize URL (pick `largeImageURL`/`webformatURL`); no Imgix | `[NEED: story]` | P0 | planned | Pixabay ships fixed sizes; no `urls.raw` |
| FR-04 | Router `image-provider.ts` exposes the same `searchPhotos`/`downloadPhotoBuffer`; routes to primary, falls back on rate-limit/empty | `[NEED: story]` | P0 | planned | Single entry point for all consumers |
| FR-05 | Primary provider selectable via env `IMAGE_PROVIDER_PRIMARY` (default `pixabay`) | `[NEED: story]` | P0 | planned | Invalid/unset → default pixabay |
| FR-06 | Wire all 6 direct consumers to import the router instead of `unsplash-client` directly | `[NEED: story]` | P0 | planned | media-pipeline, image-pool, image-library-seeder, sample-products, blog-posts, upload-media |
| FR-07 | Alt-text reflects the actual source provider (not hardcoded "on Unsplash") | `[NEED: story]` | P1 | planned | Attribution accuracy |
| FR-08 | Count=1 callers clamp Pixabay `per_page` to its minimum (3) then slice | `[NEED: story]` | P0 | planned | sample-products, blog-posts |
| FR-09 | Extend provider download SSRF allowlist to Pixabay hosts (`pixabay.com`, `cdn.pixabay.com`) | `[NEED: story]` | P0 | planned | Do this in provider download guard; media-injector ingest allowlist is separate |
| FR-10 | Keep existing media orchestration, CONCURRENCY=3 semaphore, and Payload upload flow | `[NEED: story]` | P0 | planned | Provider-specific retry/download logic lives in clients/router |
| FR-11 | `heroFallbackChain` remains Unsplash-only (hardcoded URLs, bypasses search) | `[NEED: story]` | P2 | planned | Intentional — no change |

## 8. Business Rules

- **BR-01:** Default primary provider = Pixabay when `IMAGE_PROVIDER_PRIMARY` is unset or invalid.
- **BR-02:** A download is only performed against a host on the SSRF allowlist; otherwise rejected.
- **BR-03:** Pixabay requests use `image_type=photo` and `safesearch=true` only.
- **BR-04:** If the configured primary's API key is missing, the other provider becomes primary (degrade, do not crash).
- **BR-05:** No DB schema change — images flow to the existing Payload `media` collection unchanged.

## 9. User Flow

```
Site generation requests image for a block
  ↓
Router → primary provider (Pixabay) search
  ↓
  ├── results ≥1 → pick photo → download (SSRF-guard) → upload to Payload media → DONE
  ├── empty OR rate-limit error → fallback (Unsplash) search
  │     ├── results ≥1 → download → upload → DONE
  │     └── empty/error → heroFallbackChain (Unsplash hardcoded) OR skip image
  └── primary key missing → use fallback as primary (log warning)
```

## 10. Screen Layout

N/A — backend / pipeline feature, no UI.

## 11. Acceptance Criteria

> Copied placeholders — finalize from approved `docs/stories/F38-*-stories.md`. ≥3 per story (happy/edge/negative).

### AC-1: Primary provider happy path — Source: US-F38-01
```gherkin
GIVEN IMAGE_PROVIDER_PRIMARY=pixabay and a valid PIXABAY_API_KEY
WHEN  the generator requests an image for a block with a non-empty query
THEN  Pixabay is searched and a normalized ProviderPhoto is returned
  AND the image is downloaded and uploaded to the Payload media collection
```

### AC-2: Fallback on empty primary results — Source: US-F38-01
```gherkin
GIVEN Pixabay search returns zero results for the query
WHEN  the router handles the request
THEN  Unsplash is searched as fallback
  AND a ProviderPhoto from Unsplash is returned (if available)
```

### AC-3: Fallback on rate-limit — Source: US-F38-01
```gherkin
GIVEN the primary provider raises a rate-limit ProviderError
WHEN  the router handles the request
THEN  it retries against the fallback provider
  AND no exception propagates to the generation pipeline
```

### AC-4: Both providers fail — Source: US-F38-01
```gherkin
GIVEN both Pixabay and Unsplash return empty/error for a block
WHEN  the router exhausts both
THEN  the caller's existing heroFallbackChain or skip path runs
  AND site generation completes without crashing
```

### AC-5: Switch primary via env — Source: US-F38-02
```gherkin
GIVEN IMAGE_PROVIDER_PRIMARY=unsplash
WHEN  the generator requests an image
THEN  Unsplash is searched first and Pixabay is the fallback
```

### AC-6: Invalid/unset flag defaults to Pixabay — Source: US-F38-02
```gherkin
GIVEN IMAGE_PROVIDER_PRIMARY is unset or an unrecognized value
WHEN  the router selects a primary
THEN  Pixabay is used as primary
```

### AC-7: Missing primary key degrades — Source: US-F38-02
```gherkin
GIVEN the configured primary provider's API key is missing
WHEN  the router selects a provider
THEN  the other provider is used as primary
  AND a warning is logged (no crash)
```

### AC-8: per_page clamp for count=1 — Source: US-F38-03
```gherkin
GIVEN a caller requests exactly 1 image from Pixabay
WHEN  the search is issued
THEN  per_page is set to the Pixabay minimum (3)
  AND exactly 1 photo is returned to the caller after slicing
```

### AC-9: SSRF allowlist enforced — Source: US-F38-01
```gherkin
GIVEN a download URL whose host is not on the allowlist
WHEN  downloadPhotoBuffer is called
THEN  the download is rejected
  AND the request is treated as a failed fetch (fallback applies)
```

### AC-10: Provider-accurate alt-text — Source: US-F38-01
```gherkin
GIVEN an image sourced from Pixabay
WHEN  it is uploaded to the Payload media collection
THEN  its alt-text references Pixabay (not "on Unsplash")
```

### AC-11: No generation-time regression — Source: US-F38-03
```gherkin
GIVEN a full site generation run with Pixabay primary
WHEN  generation completes
THEN  wall-clock time is within the pre-change baseline
  AND zero rate-limit failures are recorded
```

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Site generation wall-clock time must not regress vs Unsplash-only baseline | CONCURRENCY=3 semaphore reused unchanged |
| **Reliability** | Zero rate-limit-induced image failures during a generation batch | Primary ~6,000/hr + fallback |
| **Security** | SSRF download allowlist retained and extended to Pixabay hosts | Reuse existing guard in `downloadPhotoBuffer` |
| **Maintainability** | Small surface: 2 new provider modules + 6 direct consumers + env/tests | Normalized shape is the only new abstraction |
| **Config** | New env `PIXABAY_API_KEY` + `IMAGE_PROVIDER_PRIMARY` added to `.env.staging.example`, `.env.production.example`, and Vercel Dashboard | Per `.claude/rules/env-vars.md` |
| **Data** | No DB schema change; CI schema gate (`check-migrations.js`) is a no-op | `db-setup.js` untouched |

## 13. API Contract

N/A — no new HTTP endpoint. Internal module contract:

- `src/lib/ai/image-provider-types.ts` — `ProviderPhoto`, `ProviderError`.
  - `ProviderPhoto`: `id`, `provider`, `url`, `alt`, `photographer`, `width`, `height`, `downloadLocation`.
  - `ProviderError`: `provider`, `code`, `status`, `retryable`.
- `src/lib/ai/image-provider.ts` — `searchPhotos(query, opts)`, `downloadPhotoBuffer(photo)` mirroring the existing client signatures.
- `src/lib/ai/pixabay-client.ts` — same two functions; `trackDownload` = no-op (Pixabay requires none).

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| Impl plan `plans/260623-1747-pixabay-unsplash-multi-provider/` | ✅ ready | Run via `/cook` after PRD + stories approved |
| `PIXABAY_API_KEY` | ⬜ | Provision a free Pixabay API key; add to Vercel + `.env.*.example` |
| `docs/stories/F38-image-provider-stories.md` | ⬜ | Create via `/prd:us`, get approved (Stories-First) |
| `docs/TEST_CONVENTION.md` | ✅ exists | Source TC-IDs for tests (Phase 04) |

## 15. Risks & Open Questions

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pixabay search relevance/quality lower than Unsplash for some niches | Medium | Medium | Unsplash fallback on empty; keep `IMAGE_PROVIDER_PRIMARY` switch to flip primary fast |
| Hero resolution drop — Pixabay `largeImageURL` ~1280px upscaled to 1920 | High | Low | MVP-accepted; hero can stay on Unsplash if a reviewer rejects upscaling |
| Provider response shape drift breaks the normalized `ProviderPhoto` type | Low | Medium | Type-guard at the client boundary; tests assert mapping per provider |
| Pixabay rate limit increased only for "properly integrated" apps | Low | Low | ~6,000/hr base is already ample; fallback covers spikes |

| # | Open Question | Owner | Answer |
|---|---------------|-------|--------|
| 1 | Exact `docs/qa/F38-*.md` file for new TC-IDs | QC | `[NEED]` — likely new F38 QA doc |
| 2 | Does `scripts/check-env-vars.js` need an optional-var allowlist? | Dev | No. It only checks new `process.env.*` refs against both env example files; adding placeholders is sufficient. |
| 3 | Keep hero on Unsplash for resolution, or accept Pixabay upscale? | Product/Design | Pending team review (raised) |

## 16. Done Checklist

- [ ] Normalized `ProviderPhoto`/`ProviderError` shape defined and used by both clients
- [ ] `pixabay-client.ts` returns the normalized shape; `trackDownload` no-op
- [ ] Router fallback verified (empty + rate-limit paths)
- [ ] `IMAGE_PROVIDER_PRIMARY` switch + default-to-pixabay verified
- [ ] All 6 direct consumers import the router; no direct `unsplash-client` calls remain outside provider adapter code
- [ ] SSRF allowlist extended to Pixabay hosts
- [ ] `per_page≥3` clamp on count=1 callers
- [ ] Provider-accurate alt-text
- [ ] Env vars added to both `.env.*.example` + Vercel Dashboard
- [ ] No DB migration; CI schema gate passes as no-op
- [ ] Tests pass with TC-IDs (Phase 04)
- [ ] TypeScript clean — `tsc --noEmit`

## 17. Definition of Ready / Done

**Ready:** F38 stories created & approved (§0) · AC in §11 copied from stories · every FR has a
Story Ref · provider module contract confirmed · `PIXABAY_API_KEY` provisioned · open questions
resolved.
**Done:** all FRs implemented & verified · all AC pass · Done Checklist complete · zero
rate-limit failures measured on a generation run · generation time within baseline · QA report
written.
