# Phase 05 — Acceptance, staging rollout and governance

## Context

- `docs/TEST_CONVENTION.md`
- `docs/qa/F40-qa-control-center.md`
- `tests/f40-manual-runs.spec.ts`, `tests/f40-project-health.spec.ts`, `tests/f40-targeted-smoke-api.spec.ts`

## Required verification

1. Add `[x] AUTO` F40-08 TC rows before tests; every test names its TC ID and follows AAA/top-level mocks.
2. Unit: matrix completeness, admission validation, registry/workflow parity, profile separation and unsafe/duplicate rejection.
3. API: super-admin authorization, no-certified-pack recovery, exact PR/SHA context, idempotency, fixture/profile capacity and signed result mismatch rejection.
4. Playwright: Health/manual UI shows executable vs blocked truth; valid pack preflight/confirmation/history; blocked target recovery; no Run All; target-specific detail and evidence state.
5. For each added contract, run its exact allow-listed test at the deployed commit. Stateful Smoke/API contracts run against an isolated staging fixture; unit/logic contracts run on the GitHub runner. Record sanitized dispatch ID, PR/SHA, runner type, TC statuses, QA approver and proof date in the matrix/docs and PR.
6. Run workflow contract parity and artifact-policy checks: Payload never receives raw trace/video/cookie/request body; any retained CI artifact has explicit sanitization, access and retention proof.
7. Run `npm run typecheck`, focused Vitest, `git diff --check`, migration check if schema changes, and `$ck:code-review`.

## Rollout and rollback

- With `F40_TARGETED_SMOKE_ENABLED=false`: Health/preflight may display matrix/recovery; all auto/manual dispatch attempts stay blocked with `FEATURE_DISABLED`.
- With the flag true: only certified allow-listed contracts auto-dispatch. Smoke contracts retain fixture capacity; unit/API/logic contracts run only their static selector. Certified manual Regression requires an explicit independent preflight; every other row stays blocked.
- Deploy matrix/registry/workflow with the flag unchanged until QA captures the required proof for each new stateful row. Observe at least one mapped staging deploy per batch, a bounded unit/API dispatch and a blocked Smoke-capacity case.
- Roll back by removing certification/setting flag false; retain ledger/history; never delete schema or test evidence.

## Security

- Env placeholders only in `.env.staging.example` and `.env.production.example` if any new key is necessary. This plan expects none.
- Do not persist raw Playwright artifacts, credentials, cookies, request bodies or provider secrets.
