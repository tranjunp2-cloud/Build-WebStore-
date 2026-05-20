# Phase 04 — Tests

## Context
- Issue: GH-1023
- Convention: `docs/TEST_CONVENTION.md` (TC-ID required)
- QA plan: `docs/qa/F09-*.md` and `docs/qa/F10-*.md` (TC-IDs to reference)
- Rule: `.claude/rules/testing.md` (no mocks beyond `vi.mock`, no fake data, import from source)

## Overview
- Priority: P1 (gates merge)
- Status: completed
- Add unit + integration tests for Phases 02 + 03 + 04. Phase 01 covered by `check-migrations.js` CI gate (no separate test).

## Key Insights
- File ownership: **tester owns test files only**, never edits implementation (per orchestration rules).
- Each test MUST cite a TC-ID. If QA doc doesn't have a matching TC for new logic, request QC to add one first.
- `vi.mock()` allowed for OUT-OF-MODULE dependencies (e.g. `next/navigation`); never mock the module under test.
- Pure functions (detector, hasHeaderCart) → unit. SiteRenderer extension → integration with React Testing Library. Cart drawer interactions → integration.

## Requirements
**Test files**
1. `src/__tests__/unit/site-renderer/detect-commerce-presence.test.ts`
2. `src/__tests__/unit/site-renderer/has-header-cart.test.ts`
3. `src/__tests__/unit/site-renderer/apply-global-system-blocks.test.tsx` (or integration if SiteRenderer not exported)
4. `src/__tests__/integration/cart/cart-drawer-entry-points.test.tsx`
5. `src/__tests__/integration/cart/checkout-route-link.test.tsx`
6. `src/__tests__/unit/blocks/block-meta-scope.test.ts`

**Coverage targets**
- 100% on new functions
- All happy + edge branches per test matrix below

## Test Matrix
| TC-ID | Surface | Scenario | Expected |
|-------|---------|----------|----------|
| (assign) | detectCommercePresence | empty pages | false |
| (assign) | detectCommercePresence | pages with no commerce blocks | false |
| (assign) | detectCommercePresence | one page has products-grid | true |
| (assign) | detectCommercePresence | malformed layout (non-array) | false (no crash) |
| (assign) | hasHeaderCart | no headerBlock | false |
| (assign) | hasHeaderCart | headerBlock with cart enabled | true |
| (assign) | hasHeaderCart | headerBlock with cart disabled | false |
| (assign) | applyGlobalSystemBlocks | commerce + floatingCartBlock + no header cart | injects cart |
| (assign) | applyGlobalSystemBlocks | commerce + floatingCartBlock + header cart present | NO inject |
| (assign) | applyGlobalSystemBlocks | no commerce + floatingCartBlock | NO inject |
| (assign) | applyGlobalSystemBlocks | whatsAppBlock set, commerce irrelevant | injects whatsapp |
| (assign) | applyGlobalSystemBlocks | socialBlock set | injects social |
| (assign) | applyGlobalSystemBlocks | page already has same floating block | NO dupe inject |
| (assign) | CartDrawer | empty cart | checkout button disabled |
| (assign) | CartDrawer | items present + siteSlug | router.push to `/sites/{slug}/checkout` |
| (assign) | CartWidget click | floating variant | calls openCart() |
| (assign) | header cart icon | click | calls openCart(), no `href="#"` |
| (assign) | BlockMeta scope | cartWidget meta | scope === 'global' |
| (assign) | BlockMeta scope | hero meta | scope undefined or 'page' |

## Related Code Files (test-only)
**Create**
- All 6 test files listed above

**Read for context**
- Implementation files from P2, P3, P4 (no edits)
- `docs/qa/F09-*.md`, `docs/qa/F10-*.md` (TC-IDs)
- Existing test patterns: `src/__tests__/unit/blocks/*` for style reference

## Implementation Steps
1. Read `docs/qa/F09-*.md` + `docs/qa/F10-*.md`. Identify which existing TCs cover the new scenarios; flag missing ones to QC (block until assigned).
2. For each test file, follow AAA pattern (Arrange/Act/Assert).
3. Use real Zustand store import for cart tests (no mock of store under test).
4. Mock only `next/navigation` (router.push spy) for routing assertions.
5. SiteRenderer tests: render with minimal `site` + `pages` props; assert via DOM query for floating block container OR exported `applyGlobalSystemBlocks` if refactored to named export.
6. Run `npm test -- --run` → 100% pass on new files.
7. Run full `npm test` → no regressions.
8. If any test fails on real code, STOP — surface to lead (per orchestration), do NOT modify implementation.

## Todo List
- [x] Assign TC-IDs (work with QC if missing)
- [x] Write detect-commerce-presence.test.ts
- [x] Write has-header-cart.test.ts
- [x] Write apply-global-system-blocks.test.tsx
- [x] Write cart-drawer-entry-points.test.tsx
- [x] Write checkout-route-link.test.tsx
- [x] Write block-meta-scope.test.ts
- [x] All new tests pass
- [x] Full suite passes (no regression)

## Success Criteria
- 100% of new functions covered
- All 18+ test cases pass
- TC-IDs present on every test (via `describe` or test name)
- No mocking of module under test
- CI green on PR

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing TC-IDs in QA doc | High | Med | Request additions BEFORE writing tests; don't invent IDs |
| Implementation untestable (tight coupling) | Med | High | Refactor request back to P2 author; tester does NOT edit implementation |
| Flaky drawer animation timing | Med | Low | Use `findBy*` async queries; never `setTimeout` waits |
| Zustand store leak across tests | Med | Med | Reset store in `beforeEach` via store action |

## Security Considerations
- Tests must not commit real credentials, real product IDs, real checkout secrets.
- localStorage tests: clear in `beforeEach`.

## Next Steps
- Hand off to code-reviewer (read-only pass)
- Then git-manager for commit + PR to staging
