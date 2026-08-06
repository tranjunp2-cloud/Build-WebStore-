# Phase 3: Contract Tests and Regression

## Context

Parent: [plan.md](./plan.md)

This change spans CMS, storefront, landing pages, emails, and help content. Exact copy changes are broad; tests must protect structure and interpolation rather than snapshot every screen.

## Automated Tests

Add `src/__tests__/unit/localization/issue-1701-approved-copy.test.ts` using real locale files and source validation utilities.

Test cases:

- `TC-GH1701-01`: both JSON files parse and retain identical recursive path/type structure.
- `TC-GH1701-02`: every CSV row is applied or has one explicit reconciliation decision.
- `TC-GH1701-03`: arrays retain expected type, item count, and nested shape.
- `TC-GH1701-04`: EN/MS placeholder multisets and HTML tag contracts remain compatible.
- `TC-GH1701-05`: documented whitespace/newline contracts and `{time}` interpolation remain intact.

Add the TC definitions to `docs/qa/F21-localization.md` before implementing the tests.

## Regression Commands

```bash
npx vitest run src/__tests__/unit/localization
npx vitest run src/__tests__/unit/dashboard/f10-orders-i18n.test.tsx
npm run typecheck
npm test
```

Also run the new deterministic check command after tests.

## Review Existing Assertions

Some component tests assert literal current copy. Update only assertions whose source value is intentionally changed by the approved CSV. Do not weaken semantic assertions to make the suite pass.

## Checklist

- [x] QA TC IDs documented
- [x] Locale shape parity test passes
- [x] CSV accounting test passes
- [x] Placeholder/HTML test passes
- [x] Array contract test passes
- [x] Focused localization tests pass
- [x] Full Vitest executed: 11,619 passed; one unchanged staging baseline
  failure documented
- [x] Typecheck passes
- [x] No E2E required: no new route/page and no runtime behavior change

## Result

- New GH-1701 contract suite: 5/5 tests passed.
- All 39 scalar holds and five preserved arrays are locked to exact EN/MS
  output hashes; red-check mutations fail both accounting and array contracts.
- Focused localization and order-copy regression: 82/82 tests passed.
- Directly affected literal-copy regression files: 379/379 tests passed.
- Full Vitest: 11,619 passed, 3 skipped, and 1 failed.
- The sole full-suite failure is
  `src/__tests__/unit/profile/api-users-me-avatar.test.ts`, where the test
  expects 400 but receives 500 for a request without a multipart content type.
  Both that test and `src/app/api/users/me/avatar/route.ts` are unchanged from
  `origin/staging`.
- TypeScript `tsc --noEmit`: passed.

## Risks

- Literal-copy assertions can fail across many unrelated suites.
- Long Malay text may expose layout issues that structural tests cannot detect; Phase 4 covers visual smoke testing.
