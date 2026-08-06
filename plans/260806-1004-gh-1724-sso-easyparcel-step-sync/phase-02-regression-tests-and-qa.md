# Phase 02 — Regression tests and QA mapping

## Context links

- Parent: [Plan](./plan.md)
- Route under test: [tenant-easyparcel-save.test.ts](../../src/__tests__/api/tenant-easyparcel-save.test.ts)
- QA convention: [TEST_CONVENTION.md](../../docs/TEST_CONVENTION.md)
- Existing SSO QA cases: [F-SSO-PW2.md](../../docs/qa/F-SSO-PW2.md)

## Overview

- Priority: P1
- Status: Completed
- Effort: 2h
- Extend existing route tests; use mocks at module scope and AAA structure.

## Key Insights

- Existing tests cover EasyParcel validation, authorization, connection guards, and persistence.
- They do not assert the SSO trigger because the route currently has none.
- The SSO helper is intentionally fire-and-forget, so tests must assert route response and notification scheduling separately.

## Requirements

- Mock `@/lib/sso/sso-api-client` and `next/server.after` before importing the route.
- Add the fixed GH-1724 TC-IDs to `docs/qa/F-SSO-PW2.md`.
- Assert persisted data remains unchanged.
- Cover both the `after()` callback and fallback path if the test harness can exercise both safely.

## Architecture

Test matrix:

| Scenario | Expected SSO step 2 |
|---|---|
| Connected + complete warehouse + `enabled=true` | Scheduled once with `(payload, user.id, 2)` |
| `enabled=false` | Not scheduled |
| Incomplete warehouse | Not scheduled; 400 |
| Disconnected/stale tokens | Not scheduled; 409 |
| Forbidden tenant | Not scheduled; 403 |
| Payload update failure | Not scheduled; 500 |
| SSO helper rejects | Save remains 200; rejection is contained/logged |

## Related code files

### Modify

- `src/__tests__/api/tenant-easyparcel-save.test.ts` — add trigger and negative-path assertions.
- `docs/qa/F-SSO-PW2.md` — map TC-1724-SYNC-01 through TC-1724-SYNC-04.

### Create/delete

- None unless the existing QA document requires a separate issue-specific file.

## Implementation steps

1. Add top-level mocks for `notifyStepComplete` and `after`.
2. Capture the callback passed to `after` and invoke it in the happy-path test.
3. Assert the callback calls `notifyStepComplete` with the Payload instance, acting user ID, and step `2`.
4. Add negative assertions for disabled, invalid, unauthorized, disconnected, and update-failure paths.
5. Add a test proving a rejected SSO notification does not change the route’s successful response.
6. Keep existing TC IDs intact and add only the minimum new IDs.

## Todo

- [x] Add module-level mocks before route import.
- [x] Add happy-path notification assertion.
- [x] Add negative-path assertions.
- [x] Add/update QA TC mapping.
- [x] Run the targeted Vitest file.

## Success criteria

- Tests fail against the current implementation and pass after the trigger is added.
- No test depends on real SSO credentials, network, or database state.
- Existing EasyParcel test cases remain green.

## Risk assessment

- Mocking `after()` incorrectly can hide a production scheduling bug; assert callback registration and execution.
- A broad SSO mock can accidentally bypass route behavior; keep Payload update assertions in place.
- Do not add unit tests that reimplement `notifyStepComplete` internals.

## Security considerations

- Fixtures must use fake token values only.
- Assertions must not print real credentials or decrypted values.
- Keep tenant isolation cases in the existing suite.

## Next steps

Proceed to Phase 03 with targeted tests passing.
