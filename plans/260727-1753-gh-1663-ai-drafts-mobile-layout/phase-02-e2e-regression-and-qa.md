# Phase 02 — Add Browser Regression Coverage and QA Registry

## Context Links

- Parent: [GH-1663 plan](./plan.md)
- Phase 01: [Responsive draft-card layout](./phase-01-responsive-draft-card-layout.md)
- Test rules: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/docs/TEST_CONVENTION.md`
- QA registry: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/docs/qa/F08-product-crud.md`
- Playwright config: `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/playwright.config.ts`

## Overview

- Date: 2026-07-27
- Priority: P1
- Effort: 4h
- Implementation status: Completed
- Review status: Awaiting confirmation after verification-document corrections
- Goal: add deterministic real-browser coverage for the exact 375–430px regression and register
  its TC IDs.

Phase 01 implementation and QA registry coverage are complete. The strengthened responsive oracles
passed a fresh authenticated Chromium run on 2026-07-28.

## Key Insights

- Existing BulkCreateModal tests run in jsdom and mock Dialog layout; they cannot catch geometry.
- The active Playwright structure uses `e2e/` as its discovery root, and the staging allow-list
  already selects `e2e/products.spec.ts`, so the GH-1663 cases belong in that existing suite.
- Live AI calls are slow, rate-limited, non-deterministic, and irrelevant to this CSS bug.

## Requirements

### Functional

- Exercise the real `/products` browser UI using authenticated Playwright state.
- Fulfill `/api/ai/products-bulk-parse` with deterministic products containing long names and
  multiple variants; do not mock React/component internals.
- Verify Name edit, Price/Stock access, variant visibility, remove action, and enabled footer CTA.
- Test 375×812 and 430×932; add 375×568 short-height coverage for scroll reachability.

### Non-Functional

- TC IDs registered before test implementation.
- AAA structure and descriptive test names.
- No hardcoded DB IDs or production AI usage.
- Trace/screenshot captured only under existing Playwright policy.

## Architecture

```text
e2e discovery
  └─ chromium project (depends on existing setup)
       └─ GH-1663 authenticated page
            → /products
            → intercept only bulk-parse network response
            → Generate Drafts
            → real BulkCreateModal portal + CSS
            → bounds, overflow, visibility, edit/remove assertions
```

### Test Discovery Alignment

Keep the existing `testDir: './e2e'` configuration unchanged. Place the GH-1663 cases in
`e2e/products.spec.ts`, preserve the existing Chromium auth dependency/storage state, and confirm
assignment with `npx playwright test --list`. Root `tests/*.spec.ts`, shared smoke coverage, auth
setup, and workflow trigger changes are outside this issue's final delta.

## Related Code Files

### Modify

- `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/docs/qa/F08-product-crud.md`
  — add GH-1663 responsive TC rows marked AUTO.
- `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/e2e/products.spec.ts`
  — host TC-F08-04-94 through TC-F08-04-96 in the existing staging-allow-listed suite.

## Implementation Steps

1. Allocate QA cases before writing tests: search candidate IDs across `docs/qa`, `src/__tests__`,
   `e2e`, and `tests`, then check git history before reserving:
   - `TC-F08-04-94`: 375px stacked fields and no horizontal overflow.
   - `TC-F08-04-95`: 430px layout with visible, wrapping read-only variants.
   - `TC-F08-04-96`: short-height reachability plus Name/Price/Stock edit and remove regression.
2. Add the cases to `e2e/products.spec.ts` with top-level fixtures/helpers and AAA sections.
3. Confirm the existing staging allow-list selects `products.spec.ts`; do not modify workflow
   triggers in this PR.
4. Run `npx playwright test --list`; confirm the spec maps to authenticated Chromium.
5. Reuse the existing `/products` entry flow and accessible selectors from `e2e/products.spec.ts`.
   Route-fulfill only `/api/ai/products-bulk-parse` with at least two products:
   one long product name, multiple long variants, and one non-variant product.
6. At each viewport assert:
   - modal/card `scrollWidth <= clientWidth`;
   - Name input has usable width and does not intersect Price/Stock/remove;
   - variant value is visible and wraps inside card bounds;
   - close/header and footer controls are within or reachable through the modal;
   - `document.body.style.overflow === 'hidden'` while modal is open.
7. Capture the pre-modal body overflow value. Change Name, Price, and Stock; remove one draft; after
   Cancel → Stay, reassert all three edited values plus the remaining draft count.
8. Assert `Approve All` is visible/enabled but never invoke it, observe zero POST requests to
   Next.js server actions, then Discard → Exit and assert the panel plus confirmation dialog are
   absent from the DOM and the prior body overflow value is restored.
9. Run the targeted browser spec, existing modal unit tests, and typecheck.
10. Review the PR against issue AC. No 375/430 screenshots were retained; browser assertions are
    the recorded evidence, and the PR must not claim screenshot attachments.

## Todo List

- [x] Candidate IDs checked repo-wide and against history; TC-F08-04-94..96 reserved without collision
- [x] Existing e2e-only Playwright discovery remains unchanged
- [x] GH-1663 Chromium project assignment verified with `--list`
- [x] Staging E2E selects `products.spec.ts` through its existing allow-list
- [x] Workflow-equivalent discovery selects 43 tests across 12 files, including TC-F08-04-94..96
- [x] Deterministic mobile E2E created
- [x] Fresh 375×812 and 430×932 usable-width, containment, wrapping, and desktop-order checks pass
- [x] Fresh 375×568 short-height flow passes, including edit retention, remove, Stay, Exit,
  panel/dialog unmount, body-overflow restoration, and zero observed server-action POSTs
- [x] Fresh authenticated TC-F08-04-94..96 browser rerun passes (setup + cases: 4/4)
- [x] Existing BulkCreateModal unit tests pass (56/56)
- [x] TypeScript and `git diff --check` pass
- [x] PR #1710 uses `Relates to #1663` and discloses the intentional read-only variant decision
- [x] Issue comment records the defined contract: Product Name editable; Variants visible/read-only
  ([clarification](https://github.com/primeproduction/ech-prime-web-v2/issues/1663#issuecomment-5102689051))

## Completion Evidence

- Fresh authenticated Chromium run: setup plus TC-F08-04-94..96 passed 4/4 on 2026-07-28.
- Strengthened oracles cover usable mobile widths and complete desktop horizontal geometry.
- Staging E2E explicitly selects `products.spec.ts` through its existing allow-list; the final PR
  delta does not modify workflow triggers.
- Workflow-equivalent discovery reports 43 tests across 12 files, including TC-F08-04-94..96.
- Targeted BulkCreateModal unit suites: 56/56 passed.
- TypeScript, `git diff --check`, and Playwright discovery passed.
- No responsive screenshots were retained. Geometry, overflow, wrapping, editing, removal, and
  short-height reachability are covered by browser assertions; this plan does not claim a stored
  screenshot artifact.

## Verification Commands

```bash
npx playwright test --list
npm run test:e2e -- e2e/products.spec.ts --project=chromium --grep 'TC-F08-04-9[4-6]'
npm test -- src/__tests__/unit/dashboard/bulk-create-save.test.tsx src/__tests__/unit/dashboard/bulk-create-utils.test.ts src/__tests__/unit/dashboard/bulk-create-parse.test.tsx
npm run typecheck
```

## Success Criteria

- TC-F08-04-94..96 appear under `e2e/products.spec.ts` in `--list` and pass in Chromium.
- The existing staging allow-list selects `products.spec.ts`, and its workflow-equivalent discovery
  includes TC-F08-04-94..96.
- No horizontal overflow or input overlap at required viewports.
- Variant information is visible; Name/Price/Stock editing and remove still work.
- Header Cancel, footer Discard, and Approve All are fully contained and reachable with a short
  viewport and a multi-draft list; Cancel → Stay preserves Name/Price/Stock plus the remaining
  draft count, while Discard → Exit unmounts the panel/dialog and restores body overflow.
- Approve All is never invoked and the exit flow observes zero POST requests to Next.js server
  actions.
- Existing unit behavior and TypeScript remain green.
- QA registry and PR link accurately describe the covered AC.

## Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Regression is omitted from staging E2E | High | Keep the cases in allow-listed `products.spec.ts` and audit workflow-equivalent `--list`; source-trigger coverage remains owned by workflow maintainers |
| AI/network flakiness | High | Route-fulfill bulk-parse only; keep real browser/component flow |
| Pixel assertions become brittle | Medium | Assert bounds/overlap/overflow, not screenshots alone |
| E2E invokes a product-saving server action | Medium | Never click Approve All and assert zero POST requests to Next.js server actions |
| Auth state unavailable locally | Medium | Run setup project first; document required test account |

## Security Considerations

- Use repository test credentials/storage state only; never embed credentials in the spec.
- Route interception must be local to the test and match only the bulk-parse endpoint.
- Do not log cookies, tokens, AI prompts containing real merchant data, or server-action payloads.

## Next Steps

Commit and push the verified fixes to existing PR #1710. Preserve `Relates to #1663`, the read-only
Variants disclosure, and the linked issue clarification.
