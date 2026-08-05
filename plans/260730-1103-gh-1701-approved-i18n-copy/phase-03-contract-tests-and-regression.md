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

- [ ] QA TC IDs documented
- [ ] Locale shape parity test passes
- [ ] CSV accounting test passes
- [ ] Placeholder/HTML test passes
- [ ] Array contract test passes
- [ ] Focused localization tests pass
- [ ] Full Vitest passes
- [ ] Typecheck passes
- [ ] No E2E required: no new route/page and no runtime behavior change

## Risks

- Literal-copy assertions can fail across many unrelated suites.
- Long Malay text may expose layout issues that structural tests cannot detect; Phase 4 covers visual smoke testing.
