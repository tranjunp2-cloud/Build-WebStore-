# Phase 03 — Fullstack Report: CI Auto-Seed + Drift/Harness Gate

**Status:** DONE
**Date:** 2026-04-19 21:15
**Agent:** fullstack-developer
**Plan phase:** `phase-03-auto-regen-on-schema-change.md`

## Files created

| Path | LOC | Purpose |
|------|-----|---------|
| `.github/scripts/seed-templates-post-deploy.sh` | 70 | Post-deploy health-wait + Bearer POST + parse body (chmod +x). |

## Files modified

- `src/app/api/templates/seed/route.ts` — added `Authorization: Bearer $SEED_TOKEN` auth path with `timingSafeEqual` constant-time compare. Internal `x-db-setup-key` + `withAuth` JWT paths preserved.
- `.github/workflows/ci.yml` — added `drift:check` + `harness:quick` steps to `test` job; added post-deploy seed step to `deploy-staging` (after alias verify) and `deploy-production` (after deploy).
- `docs/CHANGELOG.md` — added `feat(ci): auto re-seed templates + drift/harness gate on CI` under [Unreleased].
- `docs/decisions/decisions-log.md` — appended **PD-017 — Post-deploy Template Seed Strategy** (force replace-all; revisit when admin editing UI ships).
- `plans/260419-2022-GH-1-harness-template-block-sync-flow/plan.md` — ticked action items (token instructions + cli.ts verification + ADR), added "Setup required before merge" checklist.

## CI YAML diff summary

| Job | Change |
|-----|--------|
| `test` (PR path) | +2 steps: `Drift check (block registry ↔ templates)` → `npm run drift:check`; `Harness quick gen` → `npm run harness:quick`. Runs after existing test step. |
| `deploy-staging` | +1 step between `Verify alias rollover` and `Notify deploy success`: `Seed templates (post-deploy)` with `DEPLOY_URL=https://web-v2.dev.ecommercehub.my` + `SEED_TOKEN=${{ secrets.SEED_TOKEN }}` → runs the bash script. |
| `deploy-production` | +1 mirrored step between `Deploy --prebuilt --prod` and `Notify deploy success`: same script, `DEPLOY_URL=https://web-v2.ecommercehub.my`. |

YAML validated with `python3 -c yaml.safe_load` → parses clean.

## Auth strategy

Seed endpoint now supports 3 paths, first match wins:

1. `x-db-setup-key == PAYLOAD_SECRET` → internal (db-setup.js on same container). Unchanged.
2. `Authorization: Bearer <SEED_TOKEN>` → CI post-deploy. Constant-time compare via `crypto.timingSafeEqual` on equal-length Buffers; length mismatch short-circuits to `false`. Present-but-wrong Bearer returns 401 immediately (does NOT fall through to JWT — avoids silent acceptance by session cookie).
3. `withAuth` JWT → dashboard / manual. Unchanged.

## Script behavior (`.github/scripts/seed-templates-post-deploy.sh`)

- Polls `GET $DEPLOY_URL/api/health` with 10s per-request timeout; if it never returns 200, falls back to `GET $DEPLOY_URL/` (accepts 200/301/302). Total deadline 120s.
- POSTs `$DEPLOY_URL/api/templates/seed?v3=true&force=true` with `Authorization: Bearer $SEED_TOKEN`, `--max-time 180`, up to 3 tries with 15s sleeps.
- Parses body with `jq` if available (`.success`, `.data.created`, `.data.total`); falls back to `grep '"success":true'` if `jq` absent. Non-true → exit 1.
- Uses `set -euo pipefail` + `trap rm -f "$tmp"`. 70 LOC.

## Local validation

- `npx tsc --noEmit` — seed/route.ts clean (one unrelated pre-existing error in `src/app/api/admin/harness/gen/route.ts:80` confirmed via `git stash` — not introduced by this phase).
- `npm run drift:check` — 8/8 pass (1.88s).
- `npm run harness:quick` — 12/12 composed, 0 errors (7ms gen).
- `bash -n seed-templates-post-deploy.sh` — syntax ok; `chmod +x` confirmed.

## Manual setup needed (before PR can merge safely)

Documented in `plan.md` → "Setup required before merge":

1. `openssl rand -hex 32` → copy 64-char hex.
2. Add as `SEED_TOKEN` GitHub repo secret.
3. Add identical value to Vercel Dashboard env vars, scoped to BOTH `staging` custom env AND `production`.
4. Verify production DEPLOY_URL matches real prod alias (currently `https://web-v2.ecommercehub.my` — if wrong, update the env block in `ci.yml` `deploy-production → Seed templates` step).

Without these steps, the CI seed step will fail with 401 — and the deploy job fails as a result, gating broken releases.

## Decisions / deviations

1. **Freshness gate skipped.** Task allowed skipping `check-staging-drift-fresh.sh`; plan labeled it "nice-to-have". Prod seed uses the same script as staging. Noted in plan.md.
2. **401 on wrong Bearer instead of fall-through.** If Bearer header is present but doesn't match, we return 401 directly. Prevents a stale CI token from silently falling through to cookie-based JWT auth.
3. **Script fits in 70 LOC, < 80 target.** Initial draft was 90; consolidated to single-line case block for health check and inline jq fallback.
4. **Prod DEPLOY_URL inferred.** Existing prod job does NOT assert an alias (unlike staging). Picked `https://web-v2.ecommercehub.my` per task instruction; flagged as "verify" in plan setup steps.

## Unresolved questions

1. **Does production actually use `https://web-v2.ecommercehub.my` as its public alias?** Staging alias-verify step targets `web-v2.dev.ecommercehub.my`; prod job has no equivalent assertion, so no single source of truth in the repo. Needs confirmation by maintainer before first prod deploy after this lands.
2. **Should we also emit smart-notify on seed failure (separate from deploy_fail)?** Phase plan step 7 called for `stage=seed` label; current impl relies on the job-level `notify deploy fail` which fires because `set -e` propagates. Works, but doesn't distinguish "deploy ok, seed failed" from "deploy failed". Low-effort future polish.
3. **Rate limit on seed endpoint** (Phase plan §Security). Not added — seed logic runs under `withAuth`-equivalent trust, and CI calls it at most once per push. If needed later, gate with Upstash rate limit (`@upstash/ratelimit` already a dep).

**Status:** DONE
**Summary:** CI now runs `drift:check` + `harness:quick` on every PR; staging + prod deploys force-reseed `Templates` via Bearer-authed endpoint after the deploy lands. Route accepts Bearer `SEED_TOKEN` with constant-time compare; existing auth paths preserved. Drift + harness + typecheck all green locally. SEED_TOKEN generation + Vercel scoping remain manual maintainer steps (documented in plan.md).
