# Phase 02 — Unit tests for URL normalization

## Context links

- Plan: [plan.md](plan.md) · Depends on: [phase-01](phase-01-add-tracking-to-blog-pages.md)
- Test file: `src/__tests__/unit/storefront/tracking-manager.test.tsx` (gold-standard pattern)
- Convention: `docs/TEST_CONVENTION.md`, `.claude/rules/testing.md` — TC-ID required, AAA,
  `vi.mock()` top-level, `beforeEach`/`afterEach` cleanup.

## Overview

- **Priority:** P1
- **Status:** completed
- **Description:** Add unit cases proving `pageUrl` is stripped of the `/sites/{slug}` prefix
  before POST; confirm existing 8 cases still pass.

## Key insights

- Existing `beforeEach` sets `window.location = { pathname: '/test-page' }`. New tests redefine
  `window.location.pathname` **before `render(...)`** to exercise each path shape.
- `TC-F09-TRACK-03` asserts `pageUrl: '/test-page'`. `/test-page` has no `/sites/` prefix →
  normalization is a no-op → **existing assertion unchanged, no regression**.
- Continue the existing `TC-F09-TRACK-NN` numbering (file already uses 01–08).

## Requirements

- Cover: prefixed blog path, prefixed product path, root-with-slash, root-without-slash,
  already-clean path (idempotency).
- No fake data / no logic re-implementation — assert against the real `TrackingManager` fetch body.

## Related code files

**Modify:** `src/__tests__/unit/storefront/tracking-manager.test.tsx` (test-owner only; never edit source here).

## Implementation steps

1. Add a small helper to set the pathname per test (or inline `Object.defineProperty`), e.g.:
   ```ts
   const setPath = (p: string) => Object.defineProperty(window, 'location', {
       value: { pathname: p }, writable: true, configurable: true,
   })
   ```
2. Add cases (AAA; await `vi.waitFor` for the fetch, then parse `mockFetch.mock.calls[0][1].body`):

   | TC-ID | Input `pathname` | Expected `pageUrl` |
   |-------|------------------|--------------------|
   | TC-F09-TRACK-09 | `/sites/mystore/blog/my-post` | `/blog/my-post` |
   | TC-F09-TRACK-10 | `/sites/mystore/products/abc` | `/products/abc` |
   | TC-F09-TRACK-11 | `/sites/mystore/` | `/` |
   | TC-F09-TRACK-12 | `/sites/mystore` | `/` |
   | TC-F09-TRACK-13 | `/blog/already-clean` (subdomain, idempotency) | `/blog/already-clean` |

3. Run `npm test -- tracking-manager` → all (08 existing + 5 new) green.
4. Run full `npm test` to confirm no cross-file regression.

## Todo list

- [x] Add `setPath` helper / inline pathname override
- [x] TC-F09-TRACK-09 — prefixed blog path stripped
- [x] TC-F09-TRACK-10 — prefixed product path stripped
- [x] TC-F09-TRACK-11 — `/sites/{slug}/` → `/`
- [x] TC-F09-TRACK-12 — `/sites/{slug}` → `/`
- [x] TC-F09-TRACK-13 — already-clean path unchanged (idempotency)
- [x] `npm test` fully green (existing 01–08 included)

## Success criteria

- 5 new cases pass; existing `TC-F09-TRACK-01..08` unchanged and passing.
- Coverage for `TrackingManager` does not drop below repo thresholds (70/70/70).

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `window.location` redefinition leaks across tests | Low | Med | Existing `afterEach(vi.restoreAllMocks)` + per-test `defineProperty` (configurable) resets cleanly |
| useRef `tracked` guard blocks second render in same test | Low | Low | Each case is a fresh `render()` (new component instance) — guard is per-mount |

## Rollback

Revert the test file. No runtime impact.

## Next steps

- Hand to `tester` agent to run `npm test`; then `code-reviewer`.
- **Follow-up (docs-manager, out of code scope):** add TC-F09-TRACK-09..13 rows + Top Blogs fix
  note to a QA doc (`docs/qa/F22-tracking-analytics.md` or `F03-dashboard.md`) — existing tracking
  TC-IDs are not yet catalogued there.
