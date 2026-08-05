---
date: 2026-08-04
session: gh-1587-category-ui-rework-planning
---

# Journal: 2026-08-04 — GH-1587 Category UI Rework Planning

## Context

Plan the smallest safe fix for the four Category Management cases reviewed from GH-1587, using browser evidence and current source behavior as the baseline.

## What Happened

- Browser QA confirmed two presentation failures: dark mode overrides the intended L1/L2/L3 level colors, and row-level Add Subcategory omits its parent/current-level/new-level guidance.
- Parent deletion still promotes children to top level, and deletion with assigned products still returns the exact localized product count. Both remain regression gates rather than production fix scope.
- Existing category E2E titles do not match their QA matrix behaviors. A later user direction excluded that file from modification, so the mismatch is documented as deferred traceability debt.

## Reflection

The evidence supports a narrow frontend change. Expanding into delete logic, schema, or shared component behavior would add risk without addressing a reproduced failure.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Keep the badge correction category-local | The shared outline Badge supplies the conflicting dark text class and has unrelated consumers | Distinct level colors without a design-system-wide regression |
| Reuse `useI18n().ti` for contextual copy | The repository already provides typed interpolation | English and Malay guidance remain type-compatible |
| Leave delete/backend/schema/migrations unchanged | Both delete behaviors passed browser verification | Production work stays limited to the two confirmed UI failures |
| Document legacy TC-ID debt and add dedicated cases for badge theming and subcategory guidance | Current E2E labels map to different QA behaviors, and later user direction excluded that file | New permanent tests use canonical IDs while the legacy mismatch remains explicit |

## Next Steps

- Implement the two-phase plan at `plans/260804-1505-gh-1587-category-ui-rework/plan.md`.
- Keep delete/re-parent and assigned-product hard-block flows green while adding the UI regressions.
