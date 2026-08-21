# Phase 02 — Implement the Conservative Category Guard

**Status:** completed · **Priority:** P1 · **Effort:** 4h · **Depends:** Phase 01

## Related files

**Create**

- `src/lib/ai/bulk-category-matching.ts`
- `src/__tests__/unit/ai/bulk-category-matching.test.ts`

**Modify**

- `src/app/api/ai/products-bulk-parse/route.ts`
- `src/__tests__/api/ai.test.ts`

## Implementation

1. Preserve the already-capped tenant categories as trusted `{ id, path }` candidates plus an O(1) canonical-ID lookup.
2. Extract import-safe production primitives into `bulk-category-matching.ts`:
   - `BulkCategoryCandidate` and privacy-safe guard reason enum;
   - shared category instruction/prompt builder and structured-response validator needed by the route;
   - bounded normalization/tokenization and the full category canonicalizer.
3. Normalize product name and candidate leaf segments using NFKD, diacritic removal, lowercase, and punctuation-to-space. Bound input/token lengths and use non-backtracking operations.
4. Remove only an explicit reviewed finite set of generic, QA, material, color, size, number, and brand-like noise tokens. Treat path parent segments as context, not automatic identity proof.
5. Derive identity using exact token-set equality, narrow plural singularization, and only finite directional contextual rules with explicit required/allowed tokens. Never apply unrestricted equivalence, `startsWith`, substring, edit-distance, or fuzzy matching.
6. Compute plausible candidates across the full capped set. Retain the model-proposed ID only when it is tenant-allowlisted, plausible, and the unique plausible candidate; 0 or >1 plausible candidates become `null`.
7. Harden the shared prompt: assignment is optional; the only candidate is not automatically valid; material/color overlap is insufficient; uncertainty returns `null`; include serum/skincare positive and tent/skincare negative examples.
8. Emit exactly one `payload.logger.info` aggregate event after canonicalization with `matched`, `modelNull`, `unknownId`, `semanticRejected`, and `ambiguous` counts. The totals must equal product count; never include names, paths, prompts, outputs, descriptions, or IDs.
9. Pass existing `tenantId` and `payload` to `logAiUsage`; keep reason counts out of that collection so no schema change is required.

## Test requirements

- TC122 table-drives the production canonicalizer, including `car/carpet`, `Leather Sofa/Leather Shoes`, short-token, malformed, generic-only, 0/>1 plausible candidates, and the bounded contextual rule.
- TC120/TC121 exercise the route with allowlisted mocked candidates; TC123 asserts shared prompt/validator/guard usage and exactly one model call.
- Retain current unknown/missing-ID, canonical numeric/string ID, locale validation, and dummy fallback behavior.
- AI description/SEO/SKU/variant fields cannot rescue a mismatch.

## Non-goals

- No confidence score, embeddings, synonym service, second LLM verifier, category creation, UI/server-action change, dependency, env flag, collection, or migration.
- Emergency rollback is revert + redeploy; a runtime bypass would restore the known unsafe behavior.

## Verification

```bash
npm test -- src/__tests__/unit/ai/bulk-category-matching.test.ts src/__tests__/api/ai.test.ts
npm run typecheck
```

## Verification evidence

- Fixture contract: 44 reviewed cases.
- Production matcher suite: 47/47 passing.
- API suite: 85/85 passing.
- Combined clean rerun: 132/132 passing.
- Typecheck passed; lint exited 0 with only existing warnings.
- Reviewer and debugger approved the implementation.
- The intentionally strict fail-closed policy can produce false-null assignments; Phase 03 validates the reviewed negative and positive controls on authenticated staging.
- No UI code changed. TC101 keeps deterministic null-category UI coverage; post-review TC125 adds a live browser smoke through the real route, while TC120 remains the deterministic guard proof and TC124 owns full staging closeout.

## Exit criteria

- TC120–TC123 and pre-existing focused tests are green.
- Unknown, unrelated, and ambiguous assignments cannot cross the API boundary.
- Positive controls retain canonical IDs with one model call and bounded in-process candidate scanning.
- Route stays within `maxDuration = 60` and its existing 45-second model timeout.
