# Phase 04 — Env vars + tests

**Priority:** P1 · **Status:** pending · Depends 03.
Partially parallel: env edits (A) ⟂ test writing (B) — different globs.

## A. Env vars
Per `.claude/rules/env-vars.md`: Vercel Dashboard = source of truth; `.env.*.example`
must list every var. Add TWO vars.

### Files to modify
- `.env.staging.example` — after the Unsplash block (~L67).
- `.env.production.example` — after the Unsplash block (~L58).

### Additions (both files)
```bash
# ── Pixabay (AI Gen — Primary Image Source, fallback to Unsplash) ───────────
# Register at https://pixabay.com/api/docs/ → copy API key (free).
# Free tier ~100 req/min (≈6000/hr). No attribution / no download-tracking required.
PIXABAY_API_KEY=

# Image provider order. "pixabay" (default) = Pixabay primary, Unsplash fallback.
# "unsplash" = flip. On rate-limit OR empty results, router falls back to the other.
IMAGE_PROVIDER_PRIMARY=pixabay
```

### Manual steps (note in PR, NOT code)
- [ ] Add `PIXABAY_API_KEY` real value to Vercel Dashboard → staging + production envs.
- [ ] Add `IMAGE_PROVIDER_PRIMARY=pixabay` to Vercel Dashboard (or leave unset → code default).
- [ ] Confirm `scripts/check-env-vars.js` passes. It is diff-based: any new `process.env.*`
  reference must appear in both env example files. No optional-var allowlist is needed.
- [ ] Confirm whether CI invokes `scripts/check-env-vars.js`; if not, run it manually in PR verification.

### NO schema change
Confirm: `scripts/db-setup.js` MIGRATIONS array NOT touched. CI `check-migrations.js` is a no-op for this PR. State explicitly in PR body.

## B. Tests
Per `docs/TEST_CONVENTION.md`: files in `src/__tests__/unit/{feature}/`, every test
maps to a TC-ID from `docs/qa/F*.md`, AAA structure, `vi.mock()` top-level, import
from source (never re-implement). Create the F38 stories and QA doc before adding
new TC-ID references.

### Files to create before/with tests
- `docs/stories/F38-image-provider-stories.md`
- `docs/qa/F38-image-provider-multi-source.md`

### Files to create
- `src/__tests__/unit/lib/ai/pixabay-client.test.ts`
- `src/__tests__/unit/lib/ai/image-provider.test.ts`

### Files to modify (mock target changed in Phase 03)
- `src/__tests__/unit/ai/image-pool.test.ts` — `vi.mock('@/lib/ai/image-provider')` returning `ProviderPhoto[]` instead of `vi.mock('./unsplash-client')` UnsplashPhoto.
- `src/__tests__/unit/lib/images/image-library-seeder.test.ts` — same mock retarget; assert `photo.url` used (not buildImgixUrl).
- `src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts` — retarget mock; assert `ProviderError` RATE_LIMITED branch.
- `src/__tests__/unit/lib/ai/seed-blog-posts.test.ts` — retarget mock.
- `src/__tests__/unit/lib/ai/unsplash-client.test.ts` — UNCHANGED (client not rewritten).

### New TC coverage (register IDs in `docs/qa/F38-image-provider-multi-source.md`)
**pixabay-client:**
- search maps `hits[]` → `ProviderPhoto` (id, url, alt=tags, photographer=user, w/h).
- orientation map landscape→horizontal, portrait→vertical, squarish→all.
- per_page clamps to ≥3 when count=1.
- missing `PIXABAY_API_KEY` → `[]` (no throw), warn-once.
- 429 → `ProviderError('pixabay','RATE_LIMITED')` after 1 retry.
- SSRF: download non-pixabay host → `SSRF_BLOCKED`.
- `url` picks largeImageURL for big box, webformatURL for small.

**image-provider (router):**
- default primary = pixabay (env unset).
- `IMAGE_PROVIDER_PRIMARY=unsplash` flips order.
- primary returns hits → secondary NOT called (spy assert).
- primary empty `[]` → falls back to secondary.
- primary RATE_LIMITED → falls back to secondary.
- both keys missing → `[]`.
- download host routing: unsplash url → unsplash client, pixabay url → pixabay client.
- unsplash adapter maps UnsplashPhoto → ProviderPhoto with Imgix-baked url.

### Run
`npm test` — 100% pass on new + retargeted files. Do NOT fake/mocks-to-pass.
Use real module imports; mock only the HTTP `fetch` boundary (mirror existing
`unsplash-client.test.ts` fetch-mock pattern).

## Success criteria
- [ ] Both example env files list `PIXABAY_API_KEY` + `IMAGE_PROVIDER_PRIMARY`.
- [ ] `check-env-vars.js` passes after both env example files are updated.
- [ ] `npm test` green; new TC-IDs referenced in describe titles.
- [ ] Coverage on `pixabay-client.ts` + `image-provider.ts` ≥ existing repo bar.

## Risk
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Retargeting mocks breaks unrelated assertions | Med×Med | Keep mock return shape a superset; change only import path + field names |
| `check-env-vars.js` catches missing examples | Low×Med | Add both vars to staging + production examples before referencing them |

## Unresolved (confirm at impl)
- Whether CI invokes `check-env-vars.js`; if absent from CI, run manually in PR verification.
