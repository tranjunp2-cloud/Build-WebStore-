# Phase 03 — Env vars + tests

**Status:** pending · Needs 02.

## Env
- `.env.staging.example` + `.env.production.example`: remove `UNSPLASH_ACCESS_KEY`, add `PIXABAY_API_KEY=` (+ comment: free tier 100/min, get key at pixabay.com/api/docs). Add `PIXABAY_FALLBACK_ONLY` if `UNSPLASH_FALLBACK_ONLY` existed.
- `scripts/check-env-vars.js`: if it lists `UNSPLASH_ACCESS_KEY`, swap to `PIXABAY_API_KEY`.
- **Vercel Dashboard** (user action): add `PIXABAY_API_KEY` to staging + production. NEVER commit the key.

## Tests
- **Create** `src/__tests__/unit/lib/ai/pixabay-client.test.ts`: search maps hits→PixabayPhoto; orientation mapping (landscape→horizontal etc.); missing key→[]; per_page clamp≥3 + slice to count; 429→`PixabayError` code RATE_LIMITED; SSRF block non-allowlisted host; allowlist permits `images.unsplash.com` (static fallback path); size pick (width≥900→largeImageURL else webformatURL).
- **Update** mocks `unsplash-client`→`pixabay-client` in: `image-pool.test.ts`, `sample-products-image-fallback.test.ts`, `seed-blog-posts.test.ts`, `image-library-seeder.test.ts`. Adjust mocked return shape to `PixabayPhoto` (`url` not `urls.raw`, `alt`, `photographer`).
- **Delete** `src/__tests__/unit/lib/ai/unsplash-client.test.ts`.
- TC-IDs → `docs/qa/F38-image-provider-multi-source.md` (create QA section if absent).

## Success
- [ ] `npm test` 100% pass on touched files.
- [ ] `node scripts/check-env-vars.js` passes.
- [ ] `node scripts/check-migrations.js` no-op (no schema change).
- [ ] No fake data / cheats to pass.
