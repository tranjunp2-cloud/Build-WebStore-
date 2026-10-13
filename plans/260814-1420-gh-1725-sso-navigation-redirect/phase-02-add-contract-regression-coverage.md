# Phase 2 — Add Focused GH-1725 Regression Coverage

## Context Links

- [Plan overview](./plan.md)
- [Phase 1](./phase-01-implement-pw2-redirect-contract.md)
- `docs/TEST_CONVENTION.md`
- `docs/qa/F-SSO-PW2.md`
- `src/__tests__/unit/auth/sso-session.test.ts`
- `src/__tests__/unit/auth/sso-authorization-client.test.tsx`

## Overview

- Priority: P1
- Status: Completed
- Effort: 1.5h
- Goal: reproduce the reported generic-entry bug and protect only the compatibility behavior touched by the fix.

## Requirements

1. Add GH-1725 cases to `docs/qa/F-SSO-PW2.md` before or with automation.
2. Replace the obsolete assertion that a generic established-owner login always resumes the first incomplete step.
3. Prove generic entry resolves `/dashboard` regardless of onboarding/step progress, including the exact defect state: owner with Step 1 present and Step 2 absent.
4. Prove `/initial-setting` routing: no tenants → `/onboarding`; an existing tenant always uses `sso_step_events`, with no rows → `/onboarding`, Step 1 → `/settings/shipping`, and Steps 1+2 → `/products`; stale onboarding flags do not override these results.
5. Prove `/content-manager/product[/]` → `/products`.
6. Prove page → client → session POST propagation for one valid legacy intent and invalid duplicate values.
7. Retain existing auth, suspension, onboarding, cookie, rate-limit, and client output-allowlist tests.

## Related Code Files

| Action | File | Change |
|---|---|---|
| Modify | `./docs/qa/F-SSO-PW2.md` | Add scoped GH-1725 TC rows and correct generic-entry wording |
| Modify | `./src/__tests__/unit/auth/sso-session.test.ts` | Generic regression and legacy-path compatibility cases |
| Modify | `./src/__tests__/unit/auth/sso-authorization-client.test.tsx` | Optional intent POST and output fallback |
| Create | `./src/__tests__/unit/auth/sso-authorization-page.test.tsx` | Query-to-client boundary coverage |

## Acceptance Test Matrix

| Proposed TC-ID | Scenario | Expected |
|---|---|---|
| TC-1725-NAV-01 | Distinct observed generic representation(s), Step 1 exists/Step 2 missing | `/dashboard`; no step query |
| TC-1725-NAV-02 | Generic intent for a user matching the current onboarding predicate | `/dashboard` |
| TC-SSOPW2-05 | `/initial-setting`, no tenants | `/onboarding`; no step lookup |
| TC-1725-NAV-03 | `/initial-setting`, existing tenant, no step rows | `/onboarding` |
| TC-1725-NAV-04 | `/initial-setting`, existing tenant, Step 1 row | `/settings/shipping` |
| TC-SSOPW2-16 | `/initial-setting`, existing tenant, Steps 1+2 | `/products` |
| TC-1725-NAV-05 | `/content-manager/product[/]` | `/products` |
| TC-1725-NAV-06 | Unknown/external/protocol-relative/duplicate intent | `/dashboard` |
| TC-1725-NAV-07 | Explicit `/initial-setting`, Step 1 row, stale onboarding flags | `/settings/shipping`; step state wins |
| TC-1725-CLIENT-01 | Client receives legacy intent | Session POST contains the same value |
| TC-1725-CLIENT-02 | API returns disallowed destination | Client falls back `/dashboard` |
| TC-1725-CLIENT-03 | API returns canonical product-list destination | Client navigates to `/products` |
| TC-1725-PAGE-01 | Page receives one intent | Client receives exact prop |
| TC-1725-PAGE-02 | Page receives repeated intent values | Prop omitted/invalid; downstream fallback is Dashboard |

Use the callback representations observed in Phase 1 for TC-1725-NAV-01; if both entry points produce the same representation, one contract test is sufficient. Phase 3 still verifies both user journeys. Do not invent callback values.

## Implementation Steps

1. Add TC rows following `docs/TEST_CONVENTION.md`; reference TC-IDs in all new tests and use Arrange/Act/Assert.
2. Update state-based tests whose request represents generic entry; retain current onboarding/step-state expectations behind explicit `/initial-setting`.
3. Assert generic requests do not execute the step query.
4. Add the minimum session-route cases for the two known ProductCard path families.
5. Add client POST-body and page-prop boundary assertions.
6. Keep a compact unsafe-input case plus the existing malicious server-output guard; avoid a broad URL-parser test suite.

## Todo List

- [x] Define scoped TC-1725 QA rows.
- [x] Add exact generic-entry reproducer tests.
- [x] Preserve initial-setting and product-path behavior in tests.
- [x] Add client and page propagation coverage.
- [x] Retain unrelated SSO tests unchanged.

## Success Criteria

- The generic-entry regression fails against the current implementation and passes after Phase 1.
- Both issue entry-point representations are covered once captured.
- ProductCard compatibility is protected for no-tenant, step-event, stale-flag, and product-list destinations without redefining stored step semantics.
- Tests import source behavior and follow TC-ID plus AAA conventions.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Test fixture already has all steps and masks the bug | Explicitly arrange Step 1 present and Step 2 absent |
| Tests accidentally redesign step semantics | Reuse current row interpretation and expected sequence |
| External entry representation is guessed | Populate cases only from Phase 1 evidence |

## Security Considerations

- Cover exact fallback for a small representative set of unsafe inputs.
- Never place a real SSO token in tests or fixtures.

## Next Steps

Proceed to staging acceptance after focused tests and typecheck pass.
