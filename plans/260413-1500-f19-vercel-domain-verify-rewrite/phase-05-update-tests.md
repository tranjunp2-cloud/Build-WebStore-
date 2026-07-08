# Phase 05 — Update test mocks

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase 03 (action signatures), phase 04 (UI state)
- Vitest docs: https://vitest.dev/api/vi.html#vi-mock

## Overview
- Date: 2026-04-13
- Description: Replace DigitalOcean API mocks with Vercel client mocks across 3 test files; add new test cases for TXT challenge state.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key insights
- Easier to mock `@/lib/vercel/domains` module-level than to mock `fetch` — keeps tests focused on action logic, not HTTP plumbing.
- Phase 01 already covers `vercelFetch` itself with HTTP-level mocks; no need to duplicate here.
- The 3 test files currently set `SERVER_IP`/`DO_API_TOKEN`/`DO_APP_ID` env vars in `beforeEach` — these must be removed and replaced with `VERCEL_TOKEN`/`VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID`.

## Requirements
- All references to `SERVER_IP` / `DO_*` purged from `__tests__/` files.
- `vi.mock('@/lib/vercel/domains', ...)` used to stub Vercel client functions.
- New test cases: `addCustomDomain` returning `verification`, `verifyCustomDomain` flipping pending → active, `verifyCustomDomain` re-fetching `verification` on 400.
- `f19-domains-client.test.tsx` asserts `TxtChallengeCard` renders when verification present.
- All test suites green.

## Architecture
```
__tests__/unit/dashboard/domains-actions.test.ts
  vi.mock('@/lib/vercel/domains', () => ({
    addProjectDomain: vi.fn(),
    verifyProjectDomain: vi.fn(),
    getProjectDomain: vi.fn(),
    removeProjectDomain: vi.fn(),
    VercelDomainsError: class extends Error { ... },
  }))

__tests__/unit/actions/domains-actions.test.ts
  ↑ same mock, lighter coverage

__tests__/unit/dashboard/f19-domains-client.test.tsx
  vi.mock('../../actions') with new return shape including verification
```

## Related code files
- Modify: `src/__tests__/unit/dashboard/domains-actions.test.ts` (268 lines per scout)
  - L44–46: drop `DO_API_TOKEN`/`DO_APP_ID`/`SERVER_IP` env stubs, add Vercel envs
  - L74–101: rewrite addCustomDomain test (mock `addProjectDomain`)
  - L105–129: rewrite removeCustomDomain test (mock `removeProjectDomain`)
  - L178–267: rewrite verifyCustomDomain tests (mock `verifyProjectDomain` + `getProjectDomain`)
- Modify: `src/__tests__/unit/dashboard/f19-domains-client.test.tsx` (~150 lines)
  - L30–32: extend mock domains with `vercelVerification` field
  - L108–118: rewrite DNS instruction expectations to use new env names + fallbacks
  - Add new test: "renders TxtChallengeCard when verification present"
- Modify: `src/__tests__/unit/actions/domains-actions.test.ts` (~100 lines)
  - Apply same mock-swap as the dashboard test

## Implementation steps
1. In each of the 3 test files, replace env-var setup blocks with Vercel envs.
2. Add top-of-file `vi.mock('@/lib/vercel/domains', ...)` factory returning vi.fn() stubs.
3. Rewrite `addCustomDomain` happy path: mock returns `{ name, apexName, verified: true, verification: undefined }`; assert Payload row written with `vercelDomainId` + `status='active'`.
4. Add `addCustomDomain` pending path: mock returns `{ verified: false, verification: [{ type, domain, value, reason }] }`; assert action returns `{ ok: true, verification: [...] }` and Payload row stores `vercelVerification`.
5. Add `addCustomDomain` 409 path: mock throws `VercelDomainsError({ status: 409, code: 'domain_already_in_use' })`; assert action returns `{ ok: false, error: <friendly> }` and Payload row rolled back.
6. Rewrite `removeCustomDomain` test: mock `removeProjectDomain` resolves; assert called with domain.
7. Add `removeCustomDomain` 404 path: mock throws 404; assert action still returns `{ ok: true }`.
8. Rewrite `verifyCustomDomain` happy: mock `verifyProjectDomain` returns `verified: true`; assert Payload status flipped to 'active'.
9. Add `verifyCustomDomain` 400 path: mock throws 400; mock `getProjectDomain` returns fresh verification; assert action returns `{ ok: false, verification: [...] }` and Payload row updated.
10. Update `f19-domains-client.test.tsx` to assert TxtChallengeCard renders the verification rows when present.
11. `pnpm test` → all suites green.

## Todo
- [ ] Purge `SERVER_IP`/`DO_*` from all 3 test files
- [ ] Add `vi.mock('@/lib/vercel/domains', ...)` to all 3 files
- [ ] addCustomDomain: happy / pending-with-txt / 409 conflict cases
- [ ] removeCustomDomain: happy / 404 swallow cases
- [ ] verifyCustomDomain: happy / 400 re-fetch verification cases
- [ ] f19-domains-client: TxtChallengeCard rendering test
- [ ] f19-domains-client: DNS instruction text uses Vercel constants
- [ ] All suites green (`pnpm test`)

## Success criteria
- `grep -r 'SERVER_IP\|DO_API_TOKEN\|DO_APP_ID' src/__tests__/` returns zero matches.
- All 3 test files pass with ≥10 new/updated assertions covering the Vercel state machine.
- Coverage on `actions.ts` ≥80% (matches existing project standard).

## Risk assessment
- Low. Tests are isolated. Failing test = fast feedback before phase 06 deploy.
- Edge: `vi.mock` hoisting can be tricky — use factory form with `vi.fn()` declared inside the factory body to avoid TDZ.

## Security considerations
- Tests must NOT use real `VERCEL_TOKEN` values, even fake ones that look real. Use `'test-token'` literal.
- `vi.mock` ensures no real network calls — verify with `--reporter=verbose` that no `fetch` warnings appear.

## Next steps
- Phase 06 deploys to staging and runs the smoke test.

## Open questions
- None — straightforward mock swap.
