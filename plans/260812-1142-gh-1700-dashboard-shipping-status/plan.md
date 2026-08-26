---
title: "GH-1700 — Dashboard shipping setup status"
description: "Count Dashboard shipping onboarding as complete when either Self Delivery or EasyParcel is configured."
status: in-progress
priority: P1
effort: 2h
issue: 1700
branch: fix/gh-1700-dashboard-shipping-status
tags: [bugfix, frontend, dashboard, shipping, testing]
blockedBy: []
blocks: []
created: 2026-08-12
---

# GH-1700 — Dashboard Shipping Setup Status

## Overview

Fix the Dashboard onboarding Shipping step so it is complete when
`site.shippingConfig.shippingSetupConfirmed === true` OR
`tenant.easyParcelIntegration.enabled === true`.

Reuse the tenant and site documents already fetched by the server page. Add deterministic
server-component coverage for all three issue acceptance criteria and a real-browser regression for
the user-reported EasyParcel-only state. The browser test uses a guarded, idempotent preparation step for a production-valid dedicated staging tenant and is attached to the existing governed
shipping lane without changing GitHub workflows.

`docs/development-rules.md` is absent. This plan uses `AGENTS.md`,
`docs/standards/CODE_STANDARDS.md`, and `docs/TEST_CONVENTION.md` as the governing rules.

## Acceptance Criteria

| State | Expected Dashboard result | Coverage |
|---|---|---|
| EasyParcel enabled; Self Delivery unconfirmed | Shipping complete | TC-F03.78 |
| Self Delivery confirmed; EasyParcel disabled/missing | Shipping complete | TC-F03.79 |
| Both disabled, false, or missing | Shipping incomplete | TC-F03.80 |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Correct status logic and deterministic coverage](./phase-01-correct-status-and-unit-coverage.md) | In Progress (6/7; staging browser run pending) |

## Cross-Plan Dependencies

| Relationship | Plan | Result |
|---|---|---|
| Related | `260717-1552-gh-1652-easyparcel-qa-audit` | Non-blocking; different files and persistence scope |
| Related | `260806-1004-gh-1724-sso-easyparcel-step-sync` | Non-blocking; SSO trigger already separate from local Dashboard status |

No existing unfinished plan owns the Dashboard predicate, F03 source-selection tests, or the
GH-1700 browser regression. Therefore `blockedBy` and `blocks` remain empty.

## Scope Boundaries

In scope: Dashboard predicate, server-page tests, F03 QA traceability, and an authenticated
Playwright regression for the EasyParcel-only state using the dedicated staging E2E account.

Out of scope: EasyParcel activation rules, warehouse revalidation on Dashboard, legacy
`DashboardOnboarding` cleanup, multi-site selection changes, schema/migrations, SSO behavior,
production data mutation, staging EasyParcel credential/activation mutation, and GitHub workflow changes. AC-2 and AC-3 remain deterministic
server-page coverage because AC-1 is the reported browser regression.

## Delivery

- Start implementation on `fix/gh-1700-dashboard-shipping-status` from current `staging`.
- PR title: `fix(F03): [GH-1700] count EasyParcel shipping setup`.
- PR body must use `Relates to #1700`, never `Closes #1700`.

## Success Criteria

- All three issue ACs pass deterministically.
- The authenticated Playwright regression confirms the EasyParcel-only UI tick, and the existing
  governed shipping lane discovers it without workflow edits.
- Server-page tests confirm all three acceptance-criteria states.
- Focused Vitest, typecheck, and lint checks pass or any baseline-only failure is recorded.
- The production Dashboard render path adds no query, external request, schema change, or logging;
  test-only staging fixture preparation remains isolated to authenticated E2E setup.
