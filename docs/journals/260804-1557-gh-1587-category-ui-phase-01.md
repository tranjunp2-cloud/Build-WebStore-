---
date: 2026-08-04
session: gh-1587-category-ui-phase-01
---

# Journal: 2026-08-04 — GH-1587 Category UI Phase 01

## Context

Implement the two browser-confirmed presentation fixes from the GH-1587 rework comment: distinct category-level badge colors and contextual guidance in the row-level Add Subcategory flow. Backend deletion behavior, schema, and the shared Badge component remain outside this phase.

## What Happened

- Made the category-local L1/L2/L3 text utilities authoritative with Tailwind `!text-*`, preventing the shared outline Badge's dark-mode gray class from overriding teal, blue, and violet.
- Derived Add Subcategory context from the resolved parent and its actual ancestry, covering L1 → L2 and L2 → L3 without hardcoded row assumptions.
- Added EN/MS `ti` templates for the context banner and locked-parent helper, and connected the helper to the disabled Parent Select with `aria-describedby`.
- A focused review caught a substring-collision risk in parent-name emphasis. The renderer now interpolates a private-use sentinel and replaces only that boundary with the emphasized real parent name.
- Updated the F08 PRD to document when the contextual banner/helper must appear and when they must remain hidden.
- Targeted tests passed 10/10, typecheck passed, and the focused implementation review scored 9.8/10.

## Reflection

The narrow, category-local fix preserved shared component behavior and avoided backend risk. The review finding was valuable: visually emphasizing a translated dynamic value requires a stable placeholder boundary, not a search for user-controlled display text.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Override text color only in Category Manager | The conflicting dark class comes from a shared Badge used elsewhere | Fixes all three levels without a design-system regression |
| Derive context from the loaded hierarchy | The displayed level must reflect the actual parent relationship | Correct guidance for both supported subcategory depths |
| Use EN/MS `ti` templates | Existing interpolation keeps locale shapes and placeholders aligned | No duplicate formatter or fragmented translation copy |
| Use a sentinel for parent-name emphasis | Parent names can collide with other translated substrings | Only the intended placeholder is rendered as emphasized text |
| Record guidance in the F08 PRD | The rework behavior is now part of the product contract | Phase 02 tests can map directly to documented expectations |

## Next Steps

- Complete Phase 02 authenticated browser coverage for light/dark badge colors and Add Subcategory context.
- Reconcile QA TC IDs and keep parent-promotion plus assigned-product deletion regressions green.
