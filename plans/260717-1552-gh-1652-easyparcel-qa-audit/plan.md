---
title: "GH-1652 EasyParcel settings QA audit fixes"
description: "Fix 16 EasyParcel settings defects across persistence, validation, localization, confirmations, and mobile layout."
status: in-progress
priority: P1
effort: 20h
issue: 1652
branch: codex/1652-easyparcel-qa-audit
tags: [bugfix, frontend, api, shipping, easyparcel, i18n]
blockedBy: []
blocks: []
created: 2026-07-17
---

# GH-1652 EasyParcel Settings QA Audit Fixes

## Overview

Close the 16-item F36 QA audit without adding schema, routes, or dependencies. Establish one canonical warehouse contract, replace mutation-level auto-save with a local draft and explicit save, localize the complete EasyParcel settings surface, and make all connection/setup/management states usable at 375px.

Scout evidence: [GH-1652 scout report](./reports/scout-report.md).

## Scope Challenge

- Existing reusable pieces: `ConfirmModal`, shadcn `Checkbox`/`Select`, `useI18n`, `splitPhone`, `hasUsablePhone`, and authenticated EasyParcel save/disconnect routes.
- Minimum change: reuse these pieces; no form library migration, new state manager, API route, schema field, or UI dependency.
- File count is necessarily above eight because VI/EN/MS locale files, route tests, component tests, and Playwright coverage are separate ownership surfaces.

## Phases

| Phase | Name | Status | Effort |
|---|---|---|---|
| 1 | [Canonical Warehouse Contract And Persistence](./phase-01-canonical-warehouse-contract.md) | Completed | 4h |
| 2 | [Settings Workflow, Localization, And Responsive UI](./phase-02-settings-workflow-and-ui.md) | Completed | 10h |
| 3 | [Regression Tests And QA Validation](./phase-03-regression-tests-and-qa.md) | In progress | 6h |

## Dependencies

```text
Phase 1 canonical helpers/API
  -> Phase 2 UI consumes canonical draft/save contract
      -> Phase 3 automated regression + sandbox UAT
```

The old `260624-1036-GH-1333-F36-easyparcel-delivery` plan overlaps by feature name but not by remaining implementation dependency: its settings/OAuth code is already present on `staging` and its status is stale.

## Key Decisions

- EasyParcel settings are localized in VI/EN/MS as required by GH-1652. VI falls back to English outside the new EasyParcel subtree until broader Vietnamese translation work is scheduled.
- Warehouse edits remain local until Save; no request per add/edit/delete/default action.
- Save is available only for a dirty, valid draft and is hidden while the address editor is open.
- Delete and disconnect always require confirmation. Removing the last active warehouse also deactivates EasyParcel in the same save.
- Server owns sanitization and canonical phone/default ordering; client validation is guidance, not trust.
- Responsive fixes change layout, not only `overflow-x-hidden`.

## Success Criteria

- OAuth success/error returns to the EasyParcel tab and the tab survives removal of the one-shot `ep` query.
- Add/edit/default/delete round-trips through Save and page reload with no stale warehouse restoration.
- Saved warehouse phones are canonical `60...`; malformed phones cannot be committed client-side or activated server-side.
- Optional `address2` stays optional and survives editing.
- Save never runs with an open nested editor and is inactive when no settings changed.
- Delete and both disconnect entry points show translated confirmation.
- VI/EN/MS contain no EasyParcel settings key drift; no user-facing EasyParcel settings copy remains hardcoded.
- Disconnected, setup, and management states have no horizontal overflow at 375/390px in light and dark themes.
- Focused Vitest, typecheck, and Playwright suites pass; connected sandbox save/reload/delete UAT is recorded.

## Out Of Scope

- Full Vietnamese translation outside the EasyParcel settings surface.
- Courier allowlist/selection, checkout rates, labels, tracking, COD, or order-management changes.
- Payload collection or SQL migration changes.
- EasyParcel OAuth provider automation in Playwright.

## Handoff

Implementation command:

`/ck:cook /Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/plans/260717-1552-gh-1652-easyparcel-qa-audit/plan.md`
