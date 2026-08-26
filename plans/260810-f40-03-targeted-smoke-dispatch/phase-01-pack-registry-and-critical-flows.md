# Phase 01 — Versioned Smoke-pack registry and critical-flow tests

**Status:** completed · **Migration:** no · **Depends on:** existing US-F40-02 change-impact resolver

## Objective

Create the checked-in source of truth that transforms an affected target into a small, deterministic set of meaningful browser/API tests. Each pack must name fixture, spec, Playwright project, TC IDs, and assertion intent. A pack cannot consist of status-code assertions.

## Files

- Add `qa/targeted-smoke-packs.yml`, `src/lib/admin/qa/targeted-smoke-registry.ts`.
- Add isolated specs in `tests/targeted-smoke/` and/or amend verified existing specs only where fixtures are isolated.
- Modify `playwright.config.ts` only if a dedicated project is necessary; it must not accidentally include legacy full-suite specs.
- Modify `docs/qa/F08-product-crud.md`, `docs/qa/F10-orders-management.md`, `docs/qa/F09-storefront-commerce.md` only to mark/add the exact AUTO cases actually automated.
- Add `src/__tests__/unit/qa/f40-targeted-smoke-registry.test.ts` and targeted browser tests.

## Steps

1. Audit all candidate feature docs and existing specs. Select only existing `[x] AUTO` TCs, or add a narrow test plus the exact TC row/automation marker to the owning document. Do not state a guessed TC ID in the registry.
2. Define strict registry fields: numeric `version`; stable `targetId`; `packId`; `packVersion`; `fixtureKey`; positive `fixtureCapacity`; fixed `spec`; fixed project; nonempty unique `testCaseIds`; and an assertion summary per TC. Reject duplicate target+pack version, non-repo spec paths, empty assertion text, unknown targets, path traversal, or a test case ID not in the pack.
3. Implement registry parse/resolve code without adding a YAML runtime parser if the current flat parser style can represent the needed shape. If a parser dependency is unavoidable, justify its bundle/runtime impact and parse server/CI only.
4. Build the three pilot specs against dedicated fixture data. Tests must perform the critical journey described in plan table, assert state/UI/API outcome, clean up or be fixture-idempotent, and emit their mapped TC IDs in titles. Do not call payment providers or use production accounts.
5. Ensure each spec supports a narrow `--grep`/project invocation that executes only the pack's declared TC IDs. The workflow will fail closed if discovered count/IDs do not equal registry declaration.

## Tests

- Registry parser: valid all-pilot registry; duplicate/malformed entries; missing fixture; unknown target; unsafe spec/project; duplicate TC; deterministic target ordering.
- Resolver: mapped active packs; no pack / retired pack; multiple targets; no full-suite fallback.
- Playwright: all selected TCs follow real behavior and fixture isolation; test titles include exact TC IDs.

## Done when

- Three pilot packs enumerate real critical behavior and fixture requirements.
- Every declared TC is traceable to a marked AUTO QA case and a test source.
- No generic HTTP-only or `cms.staging.e2e` sentinel is eligible for a pilot pack.
