# Phase 3 — Run Issue Acceptance on Staging

## Context Links

- [Plan overview](./plan.md)
- [Phase 2](./phase-02-add-contract-regression-coverage.md)
- [Issue #1725](https://github.com/primeproduction/ech-prime-web-v2/issues/1725)
- `docs/qa/F-SSO-PW2.md`

## Overview

- Priority: P1
- Status: Blocked
- Effort: 0.5h
- Goal: verify the two user journeys explicitly reported in #1725 using the real SSO Hub on staging.

## Requirements

1. Use an SSO account in the exact bug state: Step 1 complete and Step 2 incomplete, so the pre-fix behavior would land Shipping.
2. From SSO Hub, click App Switcher → Web Store and verify final pathname `/dashboard`.
3. From SSO Hub, click the Web Store card Direct icon and verify final pathname `/dashboard`.
4. Record environment, commit, non-secret account identifier, redacted callback shape, final pathname, timestamp, and pass/fail.
5. Never store or expose `v2_token` in screenshots, traces, logs, or PR text.

The repository has no secure automated real-SSO fixture. Per AGENTS.md, this user-reported bug should have browser coverage; for this external authenticated flow the scoped substitute is real-browser staging acceptance plus deterministic page/client/API tests. Do not add a mocked browser test and label it E2E.

## Acceptance Matrix

| Entry | Precondition | Expected |
|---|---|---|
| App Switcher → Web Store | Owner; Step 1 complete, Step 2 incomplete | `/dashboard` |
| Web Store Direct icon | Same account/state | `/dashboard` |

## Verification Commands

```bash
npm test -- --run src/__tests__/unit/auth/sso-session.test.ts src/__tests__/unit/auth/sso-authorization-client.test.tsx src/__tests__/unit/auth/sso-authorization-page.test.tsx
npm run typecheck
```

Run the repository lint command if available; report baseline-only failures separately.

## Local Gate Evidence

- Focused authentication tests: 50/50 passed.
- Typecheck, lint, and diff-check passed.
- Final code review: 9.6/10.

## Blocker Evidence

- The GH-1725 fix exists only as uncommitted working-tree changes and has not been deployed.
- The current branch has no upstream branch.
- Staging is reachable, but it does not contain the working-tree fix under acceptance.
- No verified SSO owner account/session is available in the exact reproducer state: Step 1 complete and Step 2 incomplete.

## Unblock Conditions

1. Commit the reviewed GH-1725 changes and push the branch with an upstream.
2. Deploy that exact commit to staging and record the deployed commit SHA/environment.
3. Securely provide or verify an authenticated SSO owner account/session with Step 1 complete and Step 2 incomplete.
4. Run both App Switcher and Direct-icon journeys against that deployment, then attach redacted evidence without exposing `v2_token`.

## Todo List

- [ ] Verify the reproducer account state.
- [x] Run focused tests and typecheck.
- [ ] Verify App Switcher entry on staging.
- [ ] Verify Direct-icon entry on staging.
- [ ] Attach redacted QA evidence to the PR handoff.

## Success Criteria

- Both issue reproduction paths land exact `/dashboard`.
- Evidence uses a state that would fail before the fix.
- No token-bearing artifact is retained.
- No unrelated ProductCard, security-model, or multi-tenant acceptance is claimed under #1725.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Account has all steps complete and masks the defect | Verify Step 1 complete/Step 2 incomplete before testing |
| Token leaks in evidence | Redact callback and disable token-bearing artifacts |
| Generic callback collides with `/initial-setting` | Stop and report the PWv2-only contract blocker |

## Rollback and Delivery

- No migration or coordinated SSO release.
- Rollback is a code revert of Phase 1 plus matching test/doc changes.
- Open one PR into `staging` with `Relates to #1725` and the two redacted acceptance results.
