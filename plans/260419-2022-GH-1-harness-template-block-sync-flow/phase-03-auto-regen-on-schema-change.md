# Phase 03 — Auto regen on schema change (CI + deploy)

## Context links

- Research: `plans/260419-2022-GH-1-harness-template-block-sync-flow/research/researcher-02-block-registry-template-wiring.md` (§7 manual regenerate flow)
- Seed endpoint: `POST /api/templates/seed?v3=true&force=true` (source: `src/app/api/templates/seed/route.ts` — read to confirm)
- Seed logic: `src/lib/ai/seed-templates.ts`
- Harness workflow: `.github/workflows/ai-harness.yml:14-60`
- Main CI: `.github/workflows/ci.yml`
- Phase 02 output: `npm run drift:check` + `template-drift-validator`

## Overview

- **Date:** 2026-04-19
- **Description:** Automate the manual "dev sửa block → harness:gen → seed" loop. On PR: run drift check + `harness:gen` dry-run; fail if drift. On deploy to staging: after migrations, run `harness:gen` and conditionally trigger template re-seed if drift detected.
- **Priority:** P1
- **Implementation status:** completed
- **Review status:** approved (8.5/10 reviewer-07)

## Key Insights

- Seed endpoint already exists with `force=true` mode → xóa + reseed toàn bộ. Idempotent-replace pattern simplest. Alternative upsert-by-slug an toàn hơn nhưng cần thêm logic — chọn replace-all theo YAGNI.
- Phase 02 drift check + harness:gen chạy song song được (khác input). PR path có thể parallelize.
- Deploy path: re-seed on EVERY deploy = an toàn nhất (templates idempotent). Tradeoff: overrides any admin manual edit of templates. Per researcher-02, admin UI không edit templates hiện tại → OK.
- Preflight DB check đã exist trong CI (`.github/workflows/ci.yml` deploy-staging step 2) → có thể thêm step seed sau migration.

## Requirements

**Functional**
- **PR CI (blocking):**
  - `npm run drift:check` → fail job if TS-source drift.
  - `npm run harness:gen -- --mode=quick` → fail if composer errors spike beyond baseline.
- **Staging deploy (post-build):**
  - After `scripts/db-setup.js` migrations run in `vercel build`, trigger template re-seed via HTTP call `POST $DEPLOY_URL/api/templates/seed?v3=true&force=true` with bearer admin token.
  - If seed fails → deployment alias rollover SKIPPED + notify.
- **Production deploy:** same as staging but only if staging drift-check passed within last 24h (guardrail against surprise prod reseed).

**Non-functional**
- PR CI drift-check adds < 30s to pipeline.
- Harness gen quick mode < 2m.
- Seed call idempotent-safe; retry-able.

## Architecture

```
PR (pull_request)
  └─ ci.yml / test job
     ├─ npm run drift:check            (Phase 02 validator)
     └─ npm run harness:gen --mode=quick  (3 fixtures, composerError threshold)

Push → staging
  └─ ci.yml / deploy-staging job
     ├─ vercel pull --env=staging
     ├─ preflight pg probe
     ├─ vercel build --target=staging    (runs scripts/db-setup.js)
     ├─ vercel deploy --prebuilt --target=staging
     ├─ NEW: await deploy ready → POST /api/templates/seed?v3=true&force=true
     ├─ NEW: verify seed response 200 + sample template count
     └─ alias rollover + smart-notify

Push → main
  └─ ci.yml / deploy-production job
     └─ same as staging but with 24h freshness gate
```

Decision recorded here (Phase-level ADR): **Seed strategy = force replace-all (idempotent delete+insert)**. Rationale: simpler, researcher confirmed no admin-side template edits today, zero data loss risk (templates are content snapshot not user data). Revisit when admin editing lands (Phase 04+).

## Related code files

**To modify**
- `.github/workflows/ci.yml` — add drift-check + harness-gen steps to test job; add seed step to deploy jobs
- `scripts/test-harness/cli.ts` — confirm `--mode=quick` flag exists (per matrix.ts docstring)
- `src/app/api/templates/seed/route.ts` — confirm response shape (count of templates seeded); add optional `dry=true` query for PR dry-run mode if not present

**To create**
- `.github/scripts/seed-templates-post-deploy.sh` (or `.ts`) — thin wrapper that waits for deploy URL health, calls seed endpoint with timeout + retries, fails job if error
- `scripts/drift-check-ci.ts` (optional if `npm run drift:check` needs CI-friendly JSON output)

**To read for context**
- `src/lib/ai/seed-templates.ts` — confirm `force=true` path truncates then reseeds
- `.github/actions/smart-notify/action.yml` — for failure notification hook

## Implementation Steps

1. Verify seed endpoint (`src/app/api/templates/seed/route.ts`):
   - Auth method (bearer / admin cookie). Add if missing — CI needs bearer with `PAYLOAD_SECRET` or dedicated `SEED_TOKEN`.
   - Response includes `{ seededCount, durationMs }`.
2. Add `.github/scripts/seed-templates-post-deploy.sh`:
   - Input: `DEPLOY_URL`, `SEED_TOKEN` (new GH Secret).
   - Polls `GET $DEPLOY_URL/api/health` until 200 (timeout 120s).
   - `curl -X POST -H "Authorization: Bearer $SEED_TOKEN" $DEPLOY_URL/api/templates/seed?v3=true&force=true` (timeout 60s, 2 retries).
   - Exit non-zero on non-200 or body `error` field present.
3. Update `ci.yml` test job:
   ```yaml
   - name: Drift check (block registry ↔ templates)
     run: npm run drift:check
   - name: Harness quick gen
     run: npm run harness:gen -- --mode=quick
   ```
4. Update `ci.yml` deploy-staging job, after alias verify step:
   ```yaml
   - name: Seed templates
     env:
       DEPLOY_URL: https://web-v2.dev.ecommercehub.my
       SEED_TOKEN: ${{ secrets.SEED_TOKEN }}
     run: .github/scripts/seed-templates-post-deploy.sh
   ```
5. Add `SEED_TOKEN` GH Secret (generate once: `openssl rand -hex 32`); matching env var in Vercel Dashboard (staging + production scopes); endpoint validates.
6. Repeat step 4 for deploy-production job, adding freshness gate:
   ```yaml
   - name: Check staging drift freshness
     run: .github/scripts/check-staging-drift-fresh.sh   # fails if staging drift-check older than 24h
   ```
7. Smart-notify on seed failure via existing smart-notify action with `stage=seed` label.
8. Update `docs/CHANGELOG.md` + `docs/architecture/F01*.md` with new auto-seed flow.

## Todo List

- [x] Confirm + harden seed endpoint auth + response shape
- [x] Write `seed-templates-post-deploy.sh` (wait + POST + verify)
- [x] Add drift-check + harness-quick to PR CI test job
- [x] Add seed step to deploy-staging job
- [x] Add seed step + freshness gate to deploy-production job
- [ ] Generate + configure `SEED_TOKEN` (GH Secret + Vercel env var) — *manual op, see plan.md "Setup required before merge"*
- [x] Smart-notify on seed failure
- [x] Docs: CHANGELOG + architecture update
- [x] Commit: `ci(templates): auto-seed templates after staging/production deploys`

## Success Criteria

- PR with renamed variant in block config → PR CI FAILS with drift-check output; cannot merge without fixing template refs.
- Push to staging with valid block change → deploy succeeds, templates re-seeded, `GET /api/templates` returns fresh blockType/variant combos.
- Force-seed call timeouts → deploy job fails + Lark notification; alias NOT rolled over.
- Production deploy with stale staging drift-check (>24h) → production job fails with freshness-gate error.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Seed endpoint auth misconfig → silent no-op or 401 | Medium | High | Step 2 wrapper asserts 200 + `seededCount > 0`; fail job on any other state |
| Force replace wipes a template admins manually customized | Low today | Medium | Documented decision (ADR above); revisit when admin editing ships (Phase 04) |
| Seed takes > 60s on prod DB | Low | Medium | Bump timeout + add retry with exponential backoff; monitor durationMs |
| Drift-check flake breaks PR velocity | Medium | Medium | Phase 02 keeps validator pure (no network); flake = bug, not accepted |
| Deploy race: new code deployed but old seed endpoint cached | Low | Low | Health-check polling ensures fresh deploy responds before seed call |

## Security Considerations

- `SEED_TOKEN` must be server-only (Vercel + GH Secret scoped). Never expose to browser / client build.
- Seed endpoint must validate token via constant-time compare.
- Rate limit seed endpoint (1 req/min) to prevent accidental DoS via repeated CI retries.
- Log seed events to audit trail (who, when, count) — reuse Payload admin log or structured console log.

## Next Steps

- Phase 04 (optional): surface seed history + drift badge in admin UI → reuses audit log.
- Phase 05 (optional): stamp `blockSchemaVersion` on each seeded row → enables per-template drift detection in UI.
- Post-Phase-03 retro: measure false-positive rate of drift-check over 2 weeks; tune Zod classification if noisy.
