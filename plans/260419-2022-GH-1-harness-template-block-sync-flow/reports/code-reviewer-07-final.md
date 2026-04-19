# Code Review — plan 260419-2022 harness-template-block-sync-flow

Review of 5-phase implementation (drift validator, CI auto-seed, admin UI, schema-version stamp, harness rename).

## Overall score: 8.5/10

Solid, production-shaped work. Good separation of concerns, defensive auth path, careful "baseline gate" strategy, and test coverage of the classification logic. A few real gaps around the admin harness route (spawning tsx from serverless) and a couple of minor leaks (error body echoed through `::error::`).

## Strengths

- **Tri-auth ordering is correct** in `seed/route.ts`: internal → Bearer → JWT. Bearer branch rejects on mismatch instead of falling through to JWT (good — prevents token-guess attack using cookie).
- **`safeTokenEquals`** uses `timingSafeEqual` with pre-length check (length leakage explicitly acknowledged in comment). Well-reasoned.
- **Baseline=800 pattern** is sensible: `scanTsTemplates` returns a deterministic count, test fails if `length > BASELINE`, and helpful first-20-sample error message enables diagnosis. This catches NEW drift while letting existing known issues ride.
- **`computeBlockSchemaVersion`** — deterministic (sorted types, sorted variants, sorted schema keys), copies arrays before sort (no registry mutation), uses sha256/16-char slice (adequate entropy).
- **`scanDbTemplates`** correctly handles both legacy `defaultBlocks` and new `templatePages[].layout`, and skips null-stamp rows to avoid legacy noise.
- **Bash script** uses `set -euo pipefail`, health-gate retry loop with deadline, `:?` default expansion for required vars, 3-attempt POST retry, `mktemp`+trap cleanup.
- **Sidebar super-admin gate** is role-derived (not tenant-role confused), defaults to `false`, filter runs before `.map()` so nav filter is clean.
- **Tests** have AAA, TC-ID refs, happy + sad paths, fixture-level validation.

## Findings

### P0 — must fix before merge
None.

### P1 — should fix in same PR
- **[P1] `.github/scripts/seed-templates-post-deploy.sh:53-55, 64`** — `cat "$tmp"` after `::error::` echoes the full response body into GH Actions logs. If upstream ever returns an error including the token or DB URI (Payload stack traces can), it leaks. Fix: pipe through `head -c 2000` and/or `tr -d` filter known secret patterns. At minimum, mask `SEED_TOKEN` via `::add-mask::` at script top.
- **[P1] `src/app/api/admin/harness/gen/route.ts:36-39`** — `spawn('npx', ['tsx', ...])` on Vercel serverless will almost certainly fail: npx + tsx are dev deps not in the serverless runtime, and `/var/task` is read-only (cannot write `.harness-out/matrix.json`). The file comment acknowledges "may not be available in all deploy envs" but the route returns 500 with cryptic error. Either (a) gate with `if (process.env.VERCEL) return 501` + friendlier error, or (b) mark it dev-only in route body. As-is, the "Run harness" button on production/staging admin will always be broken.
- **[P1] `src/app/api/admin/harness/gen/route.ts:38`** — `env: process.env` passes the full env including `PAYLOAD_SECRET`, `SEED_TOKEN`, `DATABASE_URI` to the spawned CLI. CLI doesn't need them. Filter to only what harness needs (`NODE_ENV`, `PATH`, maybe `PAYLOAD_SECRET` for `getPayload`). YAGNI-safe: harness CLI today reads zero envs.
- **[P1] `src/lib/ai/template-drift-validator.ts:82`** — `if (!schema) return null` silently passes blocks that have no schema registered. If a block is in registry but its schema was deleted/broken, drift validator will miss it. Log a warning or surface as a finding with `issue: 'schema-drift'` + note `no-schema`.

### P2 — nice to fix later
- **[P2] `src/app/(dashboard)/templates-health/page.tsx:48`** — Layout already sets `isSuperAdmin`; page re-derives from `user.roles`. Minor duplication. Could pass `isSuperAdmin` down or trust layout gate. Not wrong, just DRY-nit.
- **[P2] `src/app/(dashboard)/templates-health/page.tsx:57,51`** — Two `payload.find` round-trips: `scanDbTemplates` internally does its own `find({limit:500})`; page also does one. Call `scanDbTemplates` once, derive docs from its internal scan (would require returning docs from scanner) or pass docs in. Current code scans templates twice per page load.
- **[P2] `src/lib/ai/block-schema-version.ts:35`** — `(schema as { shape?: ... }).shape` works for `ZodObject` but breaks silently for `.passthrough()`, `.catchall()`, `.strict()`, `ZodEffects` wrappers. If any block uses these, schema-keys snapshot returns `[]` → hash stable across real changes. Low risk today (grep shows standard ZodObject usage) but document the assumption.
- **[P2] `seed-templates-post-deploy.sh:19`** — 120s health gate is tight for cold-start Neon + Payload boot. Staging typically warm, but a cold `vercel deploy` → seed within 2 min can race. Consider 180s or make configurable.
- **[P2] `src/__tests__/unit/ai/template-drift-validator.test.ts:89`** — `BASELINE_DRIFT_COUNT = 800` is a massive known-drift debt. Test does not fail LOUDLY if count is, say, 799 (still passes). Add a second assertion: `expect(findings.length).toBeGreaterThan(0)` so removing the scanner entirely fails, and print current count via `console.log` each run so PRs see the trend.
- **[P2] `src/app/api/admin/harness/gen/route.ts:55-77`** — `child.on('close')` callback is async but not awaited; if `fs.readFile` throws synchronously before the Promise body yields, timer may leak. Minor.

### P3 — nits
- **[P3] CI yml `.github/workflows/ci.yml:147,152`** — Drift-check and harness-quick steps are in `test` job but have no `if: always()` guard. If earlier step (e.g. coverage upload) fails, these skip — probably OK since failed coverage isn't blocking.
- **[P3] `src/collections/Templates.ts:112`** — `maxLength: 64` on text field matches DB `varchar(64)` — good. `required: false` is correct for legacy rows. Could add `index: true` if staleness query gets pattern `WHERE block_schema_version != ?` frequent. YAGNI for now.
- **[P3] `src/components/dashboard/Sidebar.tsx` label ms**: "Status Templat" should arguably be "Kesihatan Templat" for symmetry with "Templates Health". Nit — localize PR-worthy separately.
- **[P3] `drift-actions.client.tsx:30`** — `data?.error?.message ?? HTTP ${res.status}` — consider `res.statusText` fallback for clearer UX.

## Specific checklist answers

1. **Correctness** — 9/10. Null handling in `scanDbTemplates` safe (Array.isArray guards). `validateBlockRef` correctly short-circuits on unknown-block before schema lookup. One miss: `schema==null` silently passes (P1 above).
2. **Security** — 8/10. Constant-time compare present. Admin route correctly uses `withAuth` + role check. Bearer path correctly rejects non-match instead of falling through. Concerns: `::error::` body echo (P1), full env passed to spawned tsx (P1).
3. **Baseline=800 pattern** — 9/10. Correct semantics: new drift fails (count > 800), existing drift passes. Monotonically ratchetable. Missing: no lower-bound assertion (could silently bypass with scanner bug returning 0).
4. **Performance** — 8/10. `scanTsTemplates` is O(presets × pages × blocks) — acceptable. Double-scan in templates-health page (P2). No `Promise.all` needed; all work is sync or single query.
5. **CI / YAML** — 9/10. Steps in correct jobs. `SEED_TOKEN` properly referenced. Would fail closed on missing secret (`:?` guard in bash).
6. **Bash script** — 8/10. Solid structure. Lose points on body echo leak risk (P1) + no `::add-mask::` (P1) + tight 120s gate (P2).
7. **Payload + migration** — 10/10. Idempotent `ADD COLUMN IF NOT EXISTS`, matching `varchar(64)` ↔ `maxLength: 64`, `required: false`, field position after existing fields.
8. **React / RSC** — 10/10. Page has `force-dynamic`, client island is `'use client'`, no hooks in RSC.
9. **YAGNI / KISS / DRY** — 8/10. Slight over-engineering in admin harness route (spawn+timeout+stderrTail) given it's broken on serverless. Double-fetch in templates-health page is DRY violation.
10. **Regression risk** — 9/10. Existing `withAuth` and `x-db-setup-key` paths preserved and tested implicitly (tri-auth order correct). Sidebar change is additive — non-admin filters the item out. New DB column `required: false` — old rows unaffected.

## Score per area
- Correctness: 9/10
- Security: 8/10
- Performance: 8/10
- CI / bash: 8/10
- YAGNI: 8/10

## Decision: SHIP_WITH_FIXES

Fix the 4 P1 items in this PR (body-echo masking, spawn-on-vercel gate, env filter, schema=null handling). P0 is clean. P2/P3 can land as follow-ups.

## Unresolved questions

- Is `/api/admin/harness/gen` meant for staging only, or was Vercel serverless tested? (P1 above.)
- What's the plan to pay down the 800-finding drift baseline — incremental per-template fixes, or a bulk composer patch?
- Should `blockSchemaVersion` also be stamped on AI-generated sites (not just templates), so users get warned when regenerating against stale blueprints?
