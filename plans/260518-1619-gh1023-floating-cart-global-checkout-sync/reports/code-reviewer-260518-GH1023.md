# Code Review — GH-1023: Floating Cart Global Injection + Commerce Detection + Scope Tags

**Branch:** `feat/F09-F10-1023-floating-cart-global-checkout-sync`
**Reviewer:** code-reviewer
**Date:** 2026-05-18

---

## Scope

| Area | Files |
|------|-------|
| New lib | `detect-commerce-presence.ts`, `extract-first-global-block.ts`, `has-header-cart.ts` |
| Modified | `SiteRenderer.tsx` (lines 82–169), `CartDrawer.tsx`, `types.ts`, 5x block `config.ts`, `block-registry-reader.ts`, `BlockLibraryPanel.tsx` |
| New tests | 5 test files (TC-F09.205–222) |

---

## Overall Assessment

The implementation is **correct and well-structured**. The three new helper functions are pure, SSR-safe, and properly guarded against malformed input. The `applyGlobalSystemBlocks` extension is clean — it runs synchronously, produces no side effects, and the deduplication guards work. The `scope` / `scopeTooltip` metadata additions are additive and backwards-compatible.

Two issues require attention before merge: one medium and one low. No critical blockers.

---

## Critical Issues

None.

---

## High Priority

None.

---

## Medium Priority

### M1 — Type gap: `NavPage` excludes `layout`, cast silently hides it

**File:** `SiteRenderer.tsx` line 72, 195

`SiteRendererProps.pages` is typed as `NavPage[]`, but `NavPage` has no `layout` field:
```ts
export type NavPage = { id: string | number; slug: string; isVisible?: boolean; deletedAt?: string | null; status?: string }
```

At line 195, the workaround is:
```ts
pages as unknown as Array<{ layout?: unknown[] }>
```

This compiles and works at runtime (Payload `blocks` fields serialize inline regardless of depth), but the double-cast via `unknown` bypasses the type system entirely. If a future caller passes a partial `NavPage[]` that genuinely has no `layout` (e.g., a shallow query result, a test fixture, or the AI Builder which constructs pages in-memory), `detectCommercePresence` will silently see no commerce blocks and skip cart injection — a silent miss with no TS warning.

**Fix:** Extend `NavPage` to include the optional field, making the contract explicit:
```ts
export type NavPage = {
    id: string | number
    slug: string
    isVisible?: boolean
    deletedAt?: string | null
    status?: string
    layout?: unknown[]         // add this
    isHomepage?: boolean       // also used at line 233 via cast
}
```
Then remove the `as unknown as` cast at line 195. This also eliminates the `isHomepage` cast at line 233 which has the same pattern.

**Impact:** No runtime breakage today, but a future shallow-query caller silently disables cart injection without any compile-time warning.

---

### M2 — `cart-drawer-checkout.test.tsx` does not render `CartDrawer`; tests verify mock logic, not the component

**File:** `src/__tests__/unit/storefront/cart-drawer-checkout.test.tsx`

The test file defines `MockCartDrawer` and tests variables directly (e.g., `mockCartItems.length === 0`), never importing or rendering the real `CartDrawer` component. This means:

1. The `i18n` mock at line 29–41 is incomplete — it provides `checkout` but the real component uses `proceedToCheckout`, `checkoutUnavailable`, and `subtotal`. If the real component were rendered, it would access `t.storefront.cart.proceedToCheckout` on `undefined` and throw.
2. `sonner` (`toast`) is never mocked — importing the real `CartDrawer` would fail without it.
3. The tests pass CI but would silently miss a regression in the real component's disabled-state logic (the `disabled={items.length === 0}` button branch vs the `<a href=...>` link branch).

**Implication:** These tests exercise the mental model of the feature, not the component's actual code paths. Per project testing rules ("Import from source — NEVER re-implement logic in tests"), TC-F09.219 and TC-F09.220 should render the real `CartDrawer` or at least exercise it through the hook mock + RTL render.

**Fix (non-blocking for this PR if time-constrained):** Convert to a real component test using `@testing-library/react`:
```ts
vi.mock('sonner', () => ({ toast: { info: vi.fn() } }))
// Fix i18n mock to include proceedToCheckout, checkoutUnavailable, subtotal
// Then: render(<CartDrawer siteSlug="test" />) and query for button state
```

This is marked medium (not critical) because the feature logic is covered elsewhere by the helper-function tests (TC-F09.205–218), and the `CartDrawer` change is visually simple. However, the test file violates the project test convention.

---

## Low Priority

### L1 — `hasHeaderCart` always returns false; dead-code comment is misleading

**File:** `has-header-cart.ts`

The comment states: "Navigation config currently has no cart button field — always returns false." The function is correctly future-proofed, but the comment implies the function is effectively a no-op today. Given that `showCart` and `cartButton.show` are not in `NavigationConfigSchema` (confirmed from `navigation/config.ts`), the guard condition `detectCommercePresence && !hasHeaderCart(...)` is always `detectCommercePresence && !false` = `detectCommercePresence`.

This is not a bug, but the comment should state clearly that the guard is for future activation, not current behavior, so reviewers don't expect it to suppress injection today.

### L2 — `applyGlobalSystemBlocks` scans all pages on every render (hot path)

**File:** `SiteRenderer.tsx` line 137–165

`detectCommercePresence(pages)`, `extractFirstGlobalBlock(pages, 'whatsapp-button')`, and `extractFirstGlobalBlock(pages, 'socialWidget')` all iterate over all pages × all blocks on every render. For a site with 100 pages and 20 blocks each, that's 2,000 block checks × 3 calls = 6,000 iterations per render.

`SiteRenderer` is a server component (no `'use client'`), so it only renders on request, not on every client interaction. This is acceptable for server-side rendering. No memoization needed.

If `SiteRenderer` is ever moved to a client component, this would become a perf concern. Document the assumption.

### L3 — `breadcrumbCfg` null treated differently from `undefined` (pre-existing, not GH-1023)

**File:** `SiteRenderer.tsx` line 114

If Payload stores `breadcrumbConfig: null` (field explicitly set to null in DB), `breadcrumbCfg !== undefined` evaluates to `true` (since `null !== undefined`), and `showBreadcrumb` becomes `true`. The intent is "only inject when user explicitly configured it," but a `null` value passes this gate.

Spreading `null` is safe in JS (`{ ...null } = {}`), and optional chaining on null returns `undefined` (which falls back to defaults), so there is no crash. The visible effect is an unintended breadcrumb being shown with default values when `breadcrumbConfig` was explicitly nulled out in the DB.

This is pre-existing behavior, not introduced by GH-1023, but worth documenting.

**Fix:**
```ts
const showBreadcrumb = breadcrumbCfg != null &&   // null == undefined, catches both
    breadcrumbCfg.showOnAllPages !== false &&
    breadcrumbCfg.showOnAllPages !== null
```

### L4 — TC-F09.217 deduplication test validates wrong mechanism

**File:** `apply-global-system-blocks.test.ts` lines 294–338

TC-F09.217 tests deduplication by calling `extractFirstGlobalBlock(pages, 'cartWidget')` to detect an existing cart in page layouts. However, `applyGlobalSystemBlocks` actually checks `nextBlocks.some(b => b.blockType === 'cartWidget' && b.variant !== 'inline')` — it checks the *current page's blocks array*, not `pages`. The test validates the correct intent but the wrong mechanism. The test comment "Implies: no duplicate injection needed" is correct in outcome but wrong in mechanism.

Not a production bug, but the test gives a false sense of coverage for the actual deduplication branch in `applyGlobalSystemBlocks`.

---

## Edge Cases Found by Scout

- **`pages` with no `layout` field at all:** `detect-commerce-presence.ts` correctly handles this via `Array.isArray(p.layout)` check. Confirmed safe.
- **`extractFirstGlobalBlock` returns a reference to the DB object, not a clone.** The spread at `SiteRenderer.tsx:153` (`{ ...whatsappBlock, ... }`) creates a shallow copy before pushing, so mutation of `nextBlocks` does not modify the original page data. Safe.
- **Cart injection when `pages` prop is empty `[]`:** `detectCommercePresence([])` returns `false` immediately via `.some()`. No injection. Correct.
- **Cart injection on 404 page:** `not-found.tsx` passes `navigationPages` (no explicit depth) to `SiteRenderer`. Since `layout` is a `blocks` field (inline serialization), it is included in the response at any depth setting. Commerce detection will work correctly on 404 pages.
- **Multiple commerce blocks on same page:** `detectCommercePresence` uses `.some()` and short-circuits at first match. Correct and performant.

---

## Positive Observations

- The three helper functions (`detectCommercePresence`, `extractFirstGlobalBlock`, `hasHeaderCart`) are pure, side-effect-free, and trivially testable. Good decomposition.
- `COMMERCE_BLOCK_TYPES` as a `Set` for O(1) lookup — correct.
- The whatsapp/social injection uses `extractFirstGlobalBlock` which returns the full config from the source page, so user-configured phone numbers and links carry over globally. This is exactly the right behavior.
- The `scope: 'global'` badge in `BlockLibraryPanel` is correctly opt-in (only shown when `item.scope === 'global'`). Page-level blocks are unaffected.
- `CartDrawer` always-visible footer footer with disabled state is a good UX improvement. The `disabled` attribute + `cursor: not-allowed` + grey styling is accessible.
- `block-registry-reader.ts` passes through `scope` and `scopeTooltip` cleanly, and the module-level cache remains intact — no regressions.
- All test files correctly use `vi.mock()` at module level (not inside `describe`/`it`).
- TC-ID references (TC-F09.205–222) are consistently applied.
- AAA pattern is correctly followed in all test files.

---

## Recommended Actions

1. **[Medium — recommended before merge]** Add `layout?: unknown[]` and `isHomepage?: boolean` to the `NavPage` type and remove the `as unknown as` cast on line 195.
2. **[Medium — can be follow-up ticket]** Rewrite `cart-drawer-checkout.test.tsx` to render the actual `CartDrawer` with proper `sonner` mock and complete `i18n` mock.
3. **[Low]** Fix `breadcrumbCfg` null check: use `!= null` (loose equality) instead of `!== undefined`.
4. **[Low]** Update `hasHeaderCart` comment to clarify: "This function always returns false today because NavigationConfig has no cart fields. The guard is a forward-compatibility hook for when cart fields are added."

---

## Metrics

- Type Coverage: Functionally correct; one type cast via `unknown` hides a contract gap (M1)
- Test Coverage: 18 new TCs across 5 files; TC-F09.219/220 do not render the actual component (M2)
- Linting: No obvious issues; code follows project style
- Security: No new XSS surfaces — `siteSlug` in `<a href>` is server-sourced and React-escaped; no `dangerouslySetInnerHTML` added
- Performance: O(pages × blocks) per render, acceptable for SSR context at ≤100 pages

---

## Unresolved Questions

- Should `menu-food`, `booking-widget`, or `product-quick-view` be in `COMMERCE_BLOCK_TYPES`? `product-quick-view` is already included. `menu-food` and `booking-widget` are hospitality blocks — intentionally excluded or oversight?
- Is there a plan to add `showCart` / `cartButton` to `NavigationConfig`? If yes, `hasHeaderCart` will activate automatically, which is good — but the team should know the suppression will kick in silently.
