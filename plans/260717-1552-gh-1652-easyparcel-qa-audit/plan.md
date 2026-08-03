---
title: "GH-1652 EasyParcel QA audit fixes"
description: "Fix the original EasyParcel settings audit and the July 22 follow-up UI/responsive findings in settings and order details."
status: in-progress
priority: P1
effort: 28h
issue: 1652
branch: codex/issue-1652-latest-comments
tags: [bugfix, frontend, api, shipping, easyparcel, i18n]
blockedBy: []
blocks: []
created: 2026-07-17
---

# GH-1652 EasyParcel Settings QA Audit Fixes

## Overview

Close the 16-item F36 QA audit and the nine actionable follow-up findings reported on July 22 without adding schema, routes, or dependencies. The original persistence, validation, localization, and mobile workflow fixes remain intact. The follow-up is presentation-only: six EasyParcel settings corrections and three order-detail composition/responsive corrections.

Scout evidence: [GH-1652 scout report](./reports/scout-report.md).

## Scope Challenge

- Existing reusable pieces: `ConfirmModal`, shadcn `Checkbox`/`Select`, `useI18n`, `splitPhone`, `hasUsablePhone`, and authenticated EasyParcel save/disconnect routes.
- Minimum change: reuse these pieces; no form library migration, new state manager, API route, schema field, or UI dependency.
- File count is necessarily above eight because EN/MS locale files, route tests, component tests, and Playwright coverage are separate ownership surfaces.

## Phases

| Phase | Name | Status | Effort |
|---|---|---|---|
| 1 | [Canonical Warehouse Contract And Persistence](./phase-01-canonical-warehouse-contract.md) | Completed | 4h |
| 2 | [Settings Workflow, Localization, And Responsive UI](./phase-02-settings-workflow-and-ui.md) | Completed | 10h |
| 3 | [Regression Tests And QA Validation](./phase-03-regression-tests-and-qa.md) | In progress | 6h |
| 4 | [July 22 QA Follow-up UI And Responsive Fixes](./phase-04-july-22-qa-follow-up.md) | Completed | 8h |

## Dependencies

```text
Phase 1 canonical helpers/API
  -> Phase 2 UI consumes canonical draft/save contract
      -> Phase 3 automated regression + sandbox UAT
      -> Phase 4 follow-up UI fixes + focused browser regression
```

The old `260624-1036-GH-1333-F36-easyparcel-delivery` plan overlaps by feature name but not by remaining implementation dependency: its settings/OAuth code is already present on `staging` and its status is stale.

## Key Decisions

- EasyParcel settings are localized in the ECH-supported EN/MS locales.
- Warehouse edits remain local until Save; no request per add/edit/delete/default action.
- Save is available only for a dirty, valid draft and is hidden while the address editor is open.
- Delete and disconnect always require confirmation. Removing the last active warehouse also deactivates EasyParcel in the same save.
- Server owns sanitization and canonical phone/default ordering; client validation is guidance, not trust.
- Responsive fixes change layout, not only `overflow-x-hidden`.
- Follow-up checkbox styling is scoped to EasyParcel; the shared checkbox theme is not changed.
- `OrderProgress` keeps its standalone drawer presentation and gains an embedded presentation for the full order page, preventing duplicate shells/headings.
- Mid-width fulfillment fields wrap inside Shipping Fulfillment; the 65/35 order-detail desktop grid is preserved.

## Success Criteria

- OAuth success/error returns to the EasyParcel tab and the tab survives removal of the one-shot `ep` query.
- Add/edit/default/delete round-trips through Save and page reload with no stale warehouse restoration.
- Saved warehouse phones are canonical `60...`; malformed phones cannot be committed client-side or activated server-side.
- Optional `address2` stays optional and survives editing.
- Save never runs with an open nested editor and is inactive when no settings changed.
- Delete and both disconnect entry points show translated confirmation.
- EN/MS contain no EasyParcel settings key drift; no user-facing EasyParcel settings copy remains hardcoded.
- Disconnected, setup, and management states have no horizontal overflow at 375/390px in light and dark themes.
- EasyParcel mobile logos are 42x42 in disconnected state and top-aligned in connected state.
- Setup steps have no circular outline; completed ticks remain white in light and dark themes.
- Required warehouse labels display `*`; Back/Next use the dashboard-standard button size.
- The full order page renders one Order Progress heading and a usable stepper at 390/481px.
- Courier and Tracking AWB remain inside Shipping Fulfillment at 1167-1270px by wrapping to separate rows when space is insufficient.
- Focused Vitest, typecheck, and Playwright suites pass; connected sandbox save/reload/delete UAT is recorded.

## Out Of Scope

- Courier allowlist/selection, checkout rates, label creation, tracking state, COD, or order-management business-logic changes.
- Payload collection or SQL migration changes.
- EasyParcel OAuth provider automation in Playwright.
- Shared design-system checkbox/button behavior outside the affected EasyParcel views.

## Handoff

Implementation command:

`/ck:cook /Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/plans/260717-1552-gh-1652-easyparcel-qa-audit/plan.md`
