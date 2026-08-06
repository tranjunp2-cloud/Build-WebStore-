# Phase 03 — Browser acceptance and verification

> Dependency satisfied: [Phase 04 — Harden cron retry worker](./phase-04-harden-cron-retry-worker.md) is complete; proceed with staging/browser acceptance.

## Context links

- Parent: [Plan](./plan.md)
- Issue: [#1724](https://github.com/primeproduction/ech-prime-web-v2/issues/1724)
- Existing F14 Playwright suite: [f14-shipping.spec.ts](../../e2e/f14-shipping.spec.ts)
- Retry route: [process-sso-steps](../../src/app/api/cron/process-sso-steps/route.ts)
- Events collection: [SsoStepEvents](../../src/collections/SsoStepEvents.ts)

## Overview

- Priority: P1
- Status: Completed locally (Docker fixture); staging OAuth/SSO verification pending
- Effort: 1.5h
- Validate the real browser flow where test fixtures and SSO observability permit it.

## Key Insights

- The user-reported bug is an integration-flow regression, so route tests alone do not prove the dashboard action reaches SSO.
- EasyParcel OAuth and SSO Hub may not be safely automatable in CI; use the strongest available fixture without introducing real credentials.
- Existing retry/event infrastructure gives a local verification point when direct Hub assertions are unavailable.

## Requirements

- Read `docs/TEST_CONVENTION.md` before modifying Playwright tests.
- Prefer `tests/*.spec.ts` if adding a new issue-specific browser test; extend the existing F14 suite only when its fixture supports this flow.
- Use a seeded/authenticated merchant and mocked/staging-safe EasyParcel/SSO boundaries.
- Do not make CI depend on a live external OAuth account or production SSO.

## Architecture

```text
Playwright merchant flow
  -> Shipping settings / EasyParcel tab
  -> complete pickup address
  -> Save & Activate
  -> local success + enabled state
  -> observable step-2 request/event
  -> optional SSO Hub progress assertion
```

Fallback verification when Hub cannot be asserted:

- Assert the outbound SSO helper was reached through a test boundary, or
- Inspect a staging `sso_step_events` row for `(user_id, step=2, status=completed|pending)` and verify retry behavior.

## Related code files

### Modify/create

- `e2e/f14-shipping.spec.ts` or `tests/<issue-1724>.spec.ts` — browser acceptance, only if a safe fixture exists.

### Read-only verification

- `vercel.json` — cron schedule.
- `src/app/api/cron/process-sso-steps/route.ts` — pending-event retry.
- `scripts/db-setup.js` — existing table/index; no migration expected.

## Implementation steps

1. Confirm available authenticated merchant, EasyParcel, and SSO fixtures.
2. Add the smallest real browser scenario covering Save & Activate.
3. Assert success state and step-2 completion through Hub or the approved observable boundary.
4. Verify invalid/incomplete pickup address remains blocked.
5. Run targeted Vitest, Playwright, `npm run typecheck`, and `npm run lint`.
6. If staging is used, inspect `sso_step_events.last_error` for failures and confirm cron retry behavior.

## Todo

- [x] Confirm fixture feasibility before adding E2E code.
- [x] Add the blocked/incomplete-address assertion.
- [x] Record that external OAuth/SSO is not configured locally; the full Save & Activate happy path was nevertheless exercised with a temporary Docker EasyParcel fixture, while deterministic route/cron tests remain the required gate.
- [x] Run targeted Playwright acceptance in the branch Docker container (`http://localhost:3005`); authenticated setup passed and the incomplete pickup-address test passed with a temporary tested EasyParcel fixture. The Save & Activate happy path passed with the temporary local fixture; external OAuth/SSO completion remains pending.
- [x] Record the external SSO/OAuth and account-state limitation in the handoff.

## Success criteria

- Browser flow reproduces the reported action and demonstrates step 2 completion or a documented equivalent observable.
- No live secret or production account is required.
- TypeScript, lint, targeted tests, and relevant E2E checks pass.
- No schema/env files changed.

## Risk assessment

- OAuth/SSO external dependencies may make full E2E nondeterministic; retain deterministic route tests as the required gate.
- A local `completed` event does not alone prove Hub UI changed; prefer direct Hub/API assertion when the fixture supports it.
- Dashboard’s local `shippingSetupConfirmed` is site-scoped while EasyParcel config is tenant-scoped; do not expand this issue without product confirmation.

## Security considerations

- Never commit EasyParcel, SSO, or cron secrets.
- Redact bearer tokens and response bodies in CI logs.
- Use tenant-owned test data and preserve auth checks.

## Next steps

After a configured staging/authenticated OAuth fixture is available, run the Save & Activate browser acceptance and hand off to review with PR description containing `Relates to #1724` (not `Closes #1724`).
