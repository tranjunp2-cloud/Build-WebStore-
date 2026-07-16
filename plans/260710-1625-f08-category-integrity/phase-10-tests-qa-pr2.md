# Phase 10 — Tests + QA (PR-2)

**PR:** 2 · **Migration:** No · **Priority:** P1 · **Status:** pending · **Depends:** 08, 09

## Context

- PR-2 is storefront + AI — heavier on visual/integration than pure unit. Rule `.claude/rules/testing.md` still applies (TC-IDs, AAA, import from source).
- Existing AI tests: `src/__tests__/api/ai.test.ts`, `src/__tests__/unit/dashboard/bulk-create-utils.test.ts`.

## Overview

Unit-test the AI category-mapping + bulk consumer logic; integration/visual-QA the storefront PLP + sidebar filter (can't fully unit-test SSR route rendering — script a manual QA checklist on a seeded tenant).

## Test Matrix

| Behavior | Level | File | TC |
|----------|-------|------|----|
| bulk-parse injects tenant categories, returns valid id/null | unit (mock openai+payload) | `src/__tests__/api/ai.test.ts` | new F08 TC |
| dummy fallback returns categoryId null | unit | same | new |
| BulkCreateModal maps valid id, drops invalid → null, no auto-create | unit | `bulk-create-utils.test.ts` (+ new) | new |
| category descendant expansion for PLP filter | unit | new `storefront-category-filter.test.ts` | new |
| PLP renders products + sidebar filters | manual QA | checklist below | #8 acceptance |

## Related Code Files

**Create:**
- `src/__tests__/unit/storefront/storefront-category-filter.test.ts` (descendant expansion util).
- `src/__tests__/unit/dashboard/bulk-create-category-mapping.test.ts` (id validation, no auto-create).

**Modify:**
- `src/__tests__/api/ai.test.ts` — new prompt/shape expectations.
- `src/__tests__/unit/dashboard/bulk-create-utils.test.ts` — updated `buildSavePayload` category shape.

**Read for context:** Phase 08 + 09 implementation files.

## Manual QA Checklist (storefront #8)

- [ ] `/sites/[slug]/products` loads, shows published products only.
- [ ] Sidebar shows 3-level category tree.
- [ ] Click L1 → products from L1 + all descendants.
- [ ] Click L2 / L3 → correctly narrowed.
- [ ] `?category=` in URL persists on refresh/share.
- [ ] Empty state when category has no products.
- [ ] Soft-deleted categories/products not shown.
- [ ] No route-collision / build errors.

## Implementation Steps

1. Update AI + bulk-create unit tests to new tenant-aware shape; mock OpenAI + payload category fetch.
2. Add descendant-expansion unit test (pure function, no DB).
3. Run `npm test` — green on new/changed.
4. Execute manual QA checklist on seeded tenant; capture findings.
5. Report failures back to implementers (no faking).

## Todo

- [ ] AI bulk-parse tenant-aware unit tests
- [ ] BulkCreateModal id-mapping unit tests (no auto-create)
- [ ] Storefront descendant-filter unit test
- [ ] `npm test` green
- [ ] Manual QA checklist executed + signed off
- [ ] TC-IDs referenced from updated F08 QA doc

## Success Criteria

- All new/updated unit tests pass; no regressions.
- Manual QA checklist fully passes on seeded tenant.
- No junk categories created during a real bulk import run.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| SSR PLP hard to unit-test | High×Low | Cover logic (filter util) in unit; page-level via manual QA |
| AI mock diverges from real API shape | Med×Med | Assert against documented JSON contract; smoke-test with real key in staging |

## Security

- Verify storefront tests assert public-read scoping (published + non-deleted only).

## Next Steps

- On green + QA sign-off → code-reviewer → git-manager PR-2 to staging (`Relates to #8 #16`).
