---
title: "GH-1663 — Responsive Review AI Drafts modal"
description: "Fix the mobile AI-draft review cards so product names and variants remain readable without changing bulk-create business behavior."
status: in_progress
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
- PR #1710 discloses that this read-only decision differs from the issue AC's literal
  variant-editability wording.
- The issue clarification records the intended contract: Product Name is editable; Variants is
  visible, wrapping, and read-only.
- No API, schema, migration, environment variable, category mapping, or save-flow change.

## Acceptance Mapping

| Issue requirement | Planned result |
|---|---|
| Product name readable/editable | Full-width auto-growing textarea that wraps the complete value on 375–430px |
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
| 2 | [Add browser regression coverage and QA registry](./phase-02-e2e-regression-and-qa.md) | In progress — credentialed rerun pending |

Both phases are implemented. On 2026-07-28, the prior authenticated Chromium run passed setup plus
all three GH-1663 cases (4/4) using the designated dev test account. That run covered the outer
geometry but predates the newer internal-clipping oracle and border-box hook fix. The cases now live
in `e2e/products.spec.ts`; workflow-equivalent discovery reports 46 tests across 13 files. A fresh
credentialed rerun remains pending.

## Dependencies

- Existing `Input`, `Textarea`, `Button`, auto-resize hook, Tailwind breakpoints, and modal portal only.
- Authenticated Playwright state from `e2e/auth.setup.ts`.
- `docs/TEST_CONVENTION.md` and AGENTS.md test-location rules.

## Success Criteria

- No horizontal overflow at 375×812 or 430×932.
- Name textarea auto-grows to show its complete wrapped value; Price/Stock never overlap it or the remove control.
- Variant text is visible and wraps on mobile.
- Header, scrollable list, footer, remove/edit actions remain reachable.
- Existing save/category/stock semantics and desktop layout remain unchanged; Product Name edit and
  successful parse paths intentionally normalize CR/LF characters to spaces and enforce the existing
  120-character product-name contract.
- New Playwright TC is discovered; its prior outer-geometry run passed, while a fresh authenticated
  run of the internal-clipping oracle remains pending. Targeted Vitest and TypeScript checks pass.
- The GH-1663 cases live in `e2e/products.spec.ts` within the existing `e2e/` discovery tree;
  unrelated root specs remain untouched.

## Resolved Decisions

- Variants is visible and wrapping but read-only.
- The GH-1663 regression cases live in `e2e/products.spec.ts`; existing discovery, smoke, auth
  setup, and root specs are unchanged.
