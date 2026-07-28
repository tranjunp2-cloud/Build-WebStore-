---
title: "GH-1663 — Responsive Review AI Drafts modal"
description: "Fix the mobile AI-draft review cards so product names and variants remain readable without changing bulk-create business behavior."
status: verification_pending
priority: P1
effort: 6h
issue: 1663
branch: fix/f08-1663-ai-drafts-mobile-layout
tags: [bugfix, frontend, responsive, testing, f08]
blockedBy: []
blocks: []
created: 2026-07-27
---

# GH-1663 — Responsive Review AI Drafts Modal

## Overview

Fix the confirmed 375–430px layout regression in `BulkCreateModal`: Product name currently
shrinks to ~15px and Variants is hidden. Use one responsive field grid: full-width Name,
two-column Price/Stock, full-width wrapping Variants on mobile; preserve the current desktop row.

Implementation runs on dedicated branch `fix/f08-1663-ai-drafts-mobile-layout`, created from
the current local `staging` base before any source changes.

## Scope Decision

- Variants becomes visible and wrapping on mobile, but remains read-only.
- Per-variant matrix editing remains owned by Product Form, matching current component comments
  and the issue's layout-only Suggested Technical Fix.
- Inline variant editing is explicitly rejected for GH-1663; it is neither an implementation
  requirement nor a deferred TODO from this plan.
- The PR description must explicitly disclose that this read-only decision differs from the
  issue AC's literal variant-editability wording.
- No API, schema, migration, environment variable, category mapping, or save-flow change.

## Acceptance Mapping

| Issue requirement | Planned result |
|---|---|
| Product name readable/editable | Full-width labeled input on 375–430px |
| Variant details visible | Full-width wrapping value; no `hidden md:block` on mobile |
| Mobile stacked layout | Name → Price/Stock → Variants |
| Desktop behavior preserved | Existing four-column row retained from `md` |

## Cross-Plan Dependencies

| Relationship | Plan | Handling |
|---|---|---|
| Coordination only | [F08 Category Integrity](../260710-1625-f08-category-integrity/plan.md) | Pending Phase 09 also edits `BulkCreateModal` category logic; rebase first and avoid its parse/save region |
| Coordination only | [F09 Product Detail/List UX](../260708-1525-product-detail-list-ux/plan.md) | Both append `docs/qa/F08-product-crud.md`; allocate distinct TC IDs |

No logical blocker in either direction; `blockedBy` and `blocks` stay empty.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Implement responsive draft-card layout](./phase-01-responsive-draft-card-layout.md) | Completed |
| 2 | [Add browser regression coverage and QA registry](./phase-02-e2e-regression-and-qa.md) | Verification pending |

Both phases are implemented. The browser regression passed all three GH-1663 cases before the
latest TC-F08-04-94 oracle strengthening; a fresh browser run and final approval remain pending
because the unchanged local auth setup rejects the currently configured test credentials.

## Dependencies

- Existing `Input`, `Button`, Tailwind breakpoints, and modal portal only.
- Authenticated Playwright state from `e2e/auth.setup.ts`.
- `docs/TEST_CONVENTION.md` and AGENTS.md test-location rules.

## Success Criteria

- No horizontal overflow at 375×812 or 430×932.
- Name input has usable width; Price/Stock never overlap it or the remove control.
- Variant text is visible and wraps on mobile.
- Header, scrollable list, footer, remove/edit actions remain reachable.
- Existing parse/save/stock semantics and desktop layout remain unchanged.
- New Playwright TC is discovered and passes; targeted Vitest and TypeScript checks pass.
- The GH-1663 spec lives in the existing `e2e/` discovery tree; unrelated root specs remain
  untouched.

## Resolved Decisions

- Variants is visible and wrapping but read-only.
- The GH-1663 regression spec lives under `e2e/`; existing discovery, smoke, auth setup, and root
  specs are unchanged.
