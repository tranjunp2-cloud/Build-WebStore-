# Phase 01 — Lock the Fail-closed Category Contract

**Status:** completed · **Priority:** P1 · **Effort:** 2h · **Depends:** none

## Context

- QA evidence: [latest GH-1588 comment](https://github.com/primeproduction/ech-prime-web-v2/issues/1588#issuecomment-5175972635).
- Current route checks tenant ownership/active status for candidate IDs, but an allowlisted yet unrelated ID survives canonicalization.
- Existing modal coverage already proves `null`/stale IDs block Approve; the missing regression is the server semantic decision.
- Follow `docs/TEST_CONVENTION.md`; TC115–TC119 belong to PR #1710, so this fix reserves TC120–TC125.

## Related files

**Modify**

- `docs/qa/F08-product-crud.md`
- `src/__tests__/api/ai.test.ts`

**Create**

- `scripts/ai/fixtures/bulk-category-matching.json`

**Read**

- `src/app/api/ai/products-bulk-parse/route.ts`
- `src/__tests__/unit/dashboard/bulk-create-save.test.tsx`

## Contract and fixtures

1. Add registry rows in the existing F08 table format:
   - **TC-F08-04-120 [x] AUTO, Blocker:** allowlisted `QA Skincare` proposed for `4-Person Camping Tent` becomes `null`; assert the proposed ID is allowlisted so the pre-fix code fails.
   - **TC-F08-04-121 [x] AUTO, Blocker:** `Vitamin C Skin Serum → QA Skincare` retains the canonical ID.
   - **TC-F08-04-122 [ ] AUTO target, Blocker:** Phase 02 adds the production canonicalizer test for normalization, exact/equivalence matching, malformed/generic-only input, ambiguity, adversarial token pairs, and unknown ID, then promotes this row to `[x]`.
   - **TC-F08-04-123 [ ] AUTO target, High:** Phase 02 adds route coverage for shared production instructions/validator/guard and the one-call contract, then promotes this row to `[x]`.
   - **TC-F08-04-124 [ ] MANUAL/LIVE, Blocker:** verify the tent/skincare negative control and serum/skincare positive control through the authenticated staging review modal.
   - **TC-F08-04-125 [x] PLAYWRIGHT/LIVE, High:** authenticated local browser reaches the real bulk-parse route for the tent/skincare negative control and verifies the fail-closed review state.
2. Create versioned, data-only fixtures with stable case IDs, locale, product name, trusted candidate set, proposed category ID, expected category ID, and positive, hard-negative, or guard-control classification.
3. Required controls:
   - accept: `Vitamin C Skin Serum → QA Skincare`, `Running Shoes → Fashion > Shoes`, and one Unicode/diacritic normalization case;
   - reject: `Camping Tent → QA Skincare`, `Leather Sofa → Leather Shoes`, `car → carpet`, short-token overlap, generic-only category, malformed path, unknown ID;
   - ambiguous: two categories yield plausible evidence, so even the proposed allowlisted ID becomes `null`;
   - `phone → phonecase` rejects unless that exact equivalence is explicitly reviewed and allowlisted.
4. Freeze the matcher rules: NFKD/case/punctuation normalization; explicit finite noise/material/color set; narrow plural singularization; exact identity-token overlap plus a finite equivalence map only. No arbitrary prefix/substring/fuzzy matching.
5. Add TC120/TC121 route regressions using current OpenAI/Payload mocks. Confirm TC120 is red against the old canonicalizer for the intended reason.

## Guardrails

- Assertions import the production canonicalizer; tests must not reproduce its algorithm.
- Mocked prompt tests prove wiring only, not model semantic quality.
- Keep TC120 as the deterministic semantic-guard proof; TC101 covers deterministic null-result UI/persistence, while TC125 is a real-route browser smoke added during PR review.

## Verification

```bash
npm test -- src/__tests__/api/ai.test.ts
```

## Verification evidence

- Fixture corpus parses successfully with 13 unique synthetic case IDs and covers every frozen reason: positive matches, hard negatives, malformed/unknown input, model-null, adversarial tokens, and ambiguity.
- `TC-F08-04-121` passes: the plausible skincare product retains its canonical tenant ID.
- Full `src/__tests__/api/ai.test.ts`: 82/83 pass. The only failure is the intentional `TC-F08-04-120` RED (`expected null`, `received 42`), proving the current allowlist-only canonicalizer still has the reported bug.
- `git diff --check` passes. Production route behavior is intentionally unchanged in this phase; Phase 02 owns making TC120 green and adding TC122–TC123.

## Exit criteria

- TC120–TC125 are registered without colliding with PR #1710.
- Fixtures expose positive retention, hard negatives, adversarial tokens, and 0/>1 plausible candidates.
- Helper inputs/outputs/reason enums and privacy exclusions are frozen before implementation.
