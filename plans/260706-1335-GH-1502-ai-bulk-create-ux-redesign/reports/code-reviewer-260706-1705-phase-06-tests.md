# Code Review — Phase 6 (Tests + QA doc), GH-1502

**Scope:** `bulk-create-utils.test.ts`, `bulk-create-save.test.tsx`, `save-product-action.test.ts`, `ai-review-indicator.test.tsx` (new), `docs/qa/F08-product-crud.md`
**Score: 9.5/10** — approve, merge-ready. One informational note only.

## Note on diff base
Local `staging` ref was stale (predates PR #1500/GH-1458 merge). Re-ran `git diff origin/staging` to get
the true Phase-6-only diff — confirmed it matches exactly the 5 changes enumerated in the task (no
GH-1458 noise). Recommend running `git fetch` before any future `git diff staging` review on this repo.

## Correctness — assertions verified against actual source

All new assertions cross-checked line-by-line against implementation, no false-negative risk found:

- `buildSavePayload` (`BulkCreateModal.tsx:129`) hardcodes `aiReviewPending: true` → TC-F08-04-34 matches.
- `saveProductAction` (`actions.ts:224-226`): `hasId` branch does `data.aiReviewPending = false` unconditionally before `payload.update` → TC-F08-04-35 matches. Create branch (`else`, line 235+) never touches `aiReviewPending`; `ProductServerSchema` is `.passthrough()` (`actions.ts:119`) so caller's `aiReviewPending:true` flows straight to `payload.create` → TC-F08-04-36 matches.
- `updateProductFieldAction` (`actions.ts:373`): `...('status' in validated && validated.status === 'active' ? { aiReviewPending: false } : {})` — spread-conditional only fires on `status:'active'`, absent otherwise → TC-F08-04-37/38/39 all match (38/39 correctly assert key *absence*, not `undefined`, which correctly distinguishes "key not in object" from "key explicitly undefined" — good use of `not.toHaveProperty`).
- `AiReviewIndicator.tsx`: `if (!pending) return null` (line 17) → TC-F08-04-40 correct for both `undefined` and `false`. Button has `aria-label`, `onClick={(e) => e.stopPropagation()}`, dot span has `aria-hidden="true"` → TC-F08-04-41 assertions all map 1:1 to real markup.

Ran the 4 touched/new files in isolation: 82/82 pass.

## TC-ID hygiene

- TC-F08-04-34 through 41: all new, no collisions (verified via grep across the whole QA doc — the only duplicate TC-IDs in the file are pre-existing ones outside this diff's scope, e.g. TC-F08-01-04, TC-F08-04-04, unrelated to Phase 6).
- QA doc rows accurately describe test behavior; TC-F08-04-27's amended row correctly reflects both the description and expected-result columns (not just one).

## Mock/test hygiene

- `ai-review-indicator.test.tsx`: `vi.mock('@/components/ui/tooltip', ...)` is top-level (before the component import, per convention), `beforeEach(vi.clearAllMocks)` present. AAA-ish structure throughout. No source logic re-implemented — assertions check real DOM output (aria attributes, role, text), not mock internals.
- No `vi.mock()` found inside `describe`/`it` blocks in any of the 4 files.
- `save-product-action.test.ts` new blocks reuse existing top-level `mockUpdate`/`mockCreate`/`getCurrentUser` mocks already set up earlier in the file (via existing `beforeEach`) — no duplicate mock setup, no stale state leakage observed.

## TC-F08-04-27 amendment (flip vs rewrite)

Flipping the assertion (rather than deleting the test) is the right call — it preserves the test's role as
a regression guard: the `next/navigation` `useRouter` mock (`bulk-create-save.test.tsx:11-13`) is still
wired into the module graph, so if a future change re-introduces a `router.refresh()` call in
`BulkCreateModal.tsx`, this mock will intercept it and the assertion will genuinely fail. Confirmed via
grep that `BulkCreateModal.tsx` no longer imports `next/navigation` at all — so the mock/assertion pair is
currently inert-but-functional, not vacuous. The inline comment explaining the GH-1502 rationale is clear
and sufficient; no stale dead weight beyond what's needed to keep the regression guard live.

## `ai-review-indicator.test.tsx` vs `missing-info-indicator.test.tsx` template

No structural drift that risks a false pass. The `TooltipTrigger` mock correctly clones the child ref via
`React.cloneElement` when `asChild` is set (matching real Radix behavior enough to preserve the button
element and its handlers), and `TooltipContent`/`Tooltip` mocks just unwrap to plain divs — none of them
swallow `onClick`, `aria-label`, or `aria-hidden`, all of which are asserted directly on the rendered
button/span rather than on mock-internal state. The stopPropagation test (`TC-F08-04-41` last case) uses a
real DOM event via `fireEvent.click`, so it validates actual bubbling behavior, not a mocked shortcut.

## Phase completeness (all 6 phases vs staging)

Traced the full chain end-to-end: `Products.ts` collection field (`aiReviewPending`, line 529) →
`buildSavePayload` sets it true on create → `saveProductAction`/`updateProductFieldAction` clear it on
edit/publish → `i18n` keys (`aiReviewTooltip`, `aiReviewAriaLabel`) present in both `en.json` and `ms.json`
→ `AiReviewIndicator` consumes them → wired into `products/page.tsx` at both list-row callsites (lines 811,
909). Nothing glaringly missing; this looks like a coherent, mergeable final phase.

## Unresolved questions
None.
