# Phase 03 — Tests, Localization, and Responsive QA

## Context Links

- [Overview](./plan.md)
- [Phase 01](./phase-01-form-contract-and-utilities.md)
- [Phase 02](./phase-02-layout-and-sections.md)
- `docs/TEST_CONVENTION.md`
- `docs/qa/F08-product-crud.md`

## Overview

- Priority: P1
- Status: Pending
- Effort: 3h
- Depends on: Phases 01 and 02

Add automated regression coverage, complete EN/MS copy, and validate the responsive form in a real browser.

## Requirements

Read `docs/TEST_CONVENTION.md` before generating tests and use existing AUTO-marked F08 TC IDs where applicable. This plan does not authorize edits to `docs/qa`; if coverage needs a new TC ID, report that documentation follow-up separately. Import production helpers; never reimplement scoring, URL, or Cartesian reconciliation logic in tests.

## Automated Test Scenarios

### Pure unit tests

- Content Strength returns 0 for empty input.
- Each individual criterion contributes exactly 20 points.
- All criteria produce 100.
- Description length trims leading/trailing whitespace and reads the form string directly.
- Invalid numeric shipping values do not pass.
- URL preview strips protocol/trailing slash and uses slug placeholder safely.

### Component/form tests

- New form defaults to Draft.
- Persisted Active edit form hydrates as Active.
- Archived edit covers the verified Phase 01 result: untouched status is preserved end-to-end, or the form explicitly blocks the edit/transition. Assert it is never submitted as Draft/Active through fallback/default coercion.
- Create and edit payloads contain the selected Draft/Active status.
- Active publish failure preserves values and renders actionable feedback.
- Content Strength updates as watched fields change.
- Category remains single-select after relocation.
- Name updates auto-generate slug until manual slug edit; manual slug is then preserved.
- AI slug proposal leaves the committed/manual slug unchanged before explicit acceptance; accepting applies the proposal and keeps the resulting slug in touched/manual mode.
- Description “Write with AI” and SEO “AI Optimization” still populate the correct fields.
- Variant section retains existing GH-1525 behavior.
- Save button label/state reflects Draft/Active action and pending state.
- Four anchor tabs render with the locked English labels and target the expected section IDs.
- Click-driven smooth scroll keeps the clicked tab active until the destination is reached.
- Manual scrolling activates the next tab as soon as the previous section passes the sticky boundary.
- `More Information` remains active while either Specifications or SEO Settings is in the active range.
- Category dialog supports search, three hierarchy levels, Cancel, Confirm, and a single selected leaf.
- Image ALT popover supports add, character count, save, cancel, and edit-after-save states.
- Compact slug and ALT disclosures retain values across collapse/reopen; ALT Cancel does not commit draft text.
- Compare price tooltip is available on hover and keyboard focus.
- Description character count reflects the plain textarea value.
- Variant values reactively generate the Cartesian product for one and two option groups, never expose a third group, and continue to enforce all existing production caps.
- Adding/removing/renaming/reordering option values retains user-entered fields for surviving stable-key rows, initializes only new combinations, and removes only obsolete combinations.
- Variant images are controlled and grouped only by Option 1; Option 2 renders no image control.
- Bulk Apply affects all currently generated rows for selected fields only, does not alter images/options/future rows, is overridden by later row edits, and a later confirmed bulk apply overwrites only its selected fields.
- Specification row add/remove/reorder preserves neighboring row values and focus through stable field-array keys.

### E2E/browser flow

Because this materially changes an existing primary Product workflow, add or update Playwright coverage in `tests/*.spec.ts`:

1. Open Add Product.
2. Verify responsive section order and that the sidebar contains only Content Strength and Product Status.
3. Click all four sticky tabs and verify scroll target plus active state.
4. Manually scroll across each boundary, including Specifications → SEO, and verify active navigation.
5. Exercise compact slug disclosure, Category search/hierarchy selection, and compact image ALT add/edit/cancel.
6. Create two option groups and verify reactive Cartesian rows, Option 1 image grouping, absence of Option 2 image controls, stable row retention, and bulk-apply precedence.
7. Complete Shipping, Specifications, and SEO; verify specification row retention.
8. Save Draft and verify list result.
9. Create or update an Active product and verify publish status.
10. Exercise Active failure with missing publish-required data.
11. Open an Archived fixture and verify the chosen safe preserve-or-block behavior with no silent status transition.

## Localization

Update both actual project locales:

- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`

Required copy groups:

- Product Content Strength title, score, and five checklist labels.
- Draft/Active labels and explanatory help.
- Save Draft/Publish Product action labels where missing.
- `Basic Info`, `Pricing & Stock`, `Shipping & Delivery`, `More Information`, `Specifications`, and `SEO Settings` labels.
- Singular Category placeholder.
- URL preview placeholder/accessibility label.
- Compare price tooltip copy.
- Image ALT dialog/helper copy.

No new hardcoded user-facing English strings in components.

## Manual Responsive Matrix

| Viewport | Expected layout |
|---|---|
| 375px | Single column; anchor tabs scroll horizontally if needed; no page overflow; fixed action bar usable. |
| 768px | Single column or safe intermediate layout; shipping max 2 columns. |
| 1024px | Approximately 70/30 only if sidebar remains usable; otherwise stacked. |
| 1440px+ | Approximately 70/30 main/sidebar; full-width four-tab navigation; shipping 4 columns if controls remain readable. |

Also verify light/dark mode, long EN/MS labels, keyboard-only navigation, tooltip focus, dialog focus handling, focus/error scroll, sticky navigation/sidebar versus fixed action bar, final-section scroll offset, and browser zoom at 200%.

## Related Code Files

### Modify

- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`
- Existing relevant Product form test files when extension is cleaner than duplication.

### Create as needed

- `src/__tests__/unit/products/content-strength.test.ts`
- `src/__tests__/unit/dashboard/product-form-redesign.test.tsx`
- `tests/product-form-redesign.spec.ts`

## Verification Commands

Run the repository's existing scripts after confirming their names in `package.json`:

```bash
npm run typecheck
npm run lint
npm test -- --run
npx playwright test tests/product-form-redesign.spec.ts
```

Do not assume `tsc --noEmit` is the canonical project command if `package.json` defines a wrapper.

## Todo List

- [ ] Read test convention and map coverage to existing AUTO-marked TC IDs; report any needed docs/qa follow-up without editing docs/qa in this plan.
- [ ] Add pure helper tests.
- [ ] Add shared form/status regression tests.
- [ ] Add/update Product E2E flow.
- [ ] Add sticky navigation click/manual-scroll regression coverage.
- [ ] Add Category dialog, ALT popover, and Compare price tooltip coverage.
- [ ] Add Cartesian variant, stable-row retention, Option 1 image grouping, Option 2 no-image, production-cap, and bulk-apply precedence coverage.
- [ ] Add compact slug/ALT disclosure and stable specification-row coverage.
- [ ] Update EN and MS locales.
- [ ] Run typecheck, lint, targeted unit tests, and Playwright.
- [ ] Complete responsive/accessibility matrix.

## Success Criteria

- All planned tests pass.
- No existing Product form regression.
- No missing i18n keys or hardcoded new UI copy.
- Browser verification passes across the four target viewport sizes.
- No horizontal overflow, clipped dropdown, or save-bar/sticky collision.
- All four anchor targets align below the sticky navigation and show the correct active tab.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Brittle layout tests inspect Tailwind strings only | Prefer browser-visible behavior and screenshots where appropriate. |
| Test IDs collide with existing QA documentation | Inspect current highest/free IDs before editing docs. |
| E2E data contaminates shared environment | Use established Product test fixtures and cleanup patterns. |
| MS copy expands beyond sidebar width | Include long-copy responsive QA. |

## Security Considerations

- Include a direct/server-action regression proving client status cannot bypass the Active publishing gate.
- Do not place tenant domain or product data in snapshots beyond test fixtures.
