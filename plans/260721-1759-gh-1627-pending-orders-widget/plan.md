---
title: "GH-1627 — Wire Pending Orders dashboard widget to real data"
description: "Replace the locked Pending Orders mock with a tenant-scoped, permission-gated, responsive real-data widget."
status: completed
priority: P1
effort: 9h
issue: 1627
branch: feature/gh-1627-pending-orders-widget
tags: [feature, frontend, backend, auth, dashboard, orders, i18n]
blockedBy: []
blocks: []
created: 2026-07-21
---

# GH-1627 — Pending Orders dashboard widget

## Overview

Implement all AC01–AC08 from [GitHub issue #1627](https://github.com/primeproduction/ech-prime-web-v2/issues/1627): exact `pending` order data, count, empty state, order-detail navigation, responsive interaction states, EN/MS copy, and unit coverage. Preserve Orders as default OFF while removing only its Soon/locked treatment.

## Scope Challenge

- **Existing code:** reuse `SectionHead.right`, Payload Local API, `tenantIdForQuery`, `requirePermission`, dashboard block preferences, `tp`/`ti`, and the existing `/orders/[id]` route. Do not consume the unused summary API from the Server Component.
- **Minimum changes:** extend the existing dashboard DTO file, add one secure server loader, wire the page, replace the mock UI/CSS/i18n, then add focused tests and repair directly conflicting TC-IDs.
- **Complexity:** about 17 touched files, but only 8 production files total (including 1 new source module); the remaining files are tests/QA traceability. Three sequential phases.
- **Selected mode:** SCOPE REDUCTION after engineering re-review. Cross-cutting permission/action hardening is deferred.

## Locked Decisions

- Query raw `status = 'pending'`, `sort = '-createdAt'`, `limit = 5`; badge uses `totalDocs`.
- `itemCount` is the sum of line-item quantities; `total` is already in major currency units.
- Links use Payload document ID: `/orders/{id}`.
- Orders remains absent from `DEFAULT_DASHBOARD_BLOCKS`; remove only `soon: true` for Orders.
- No query and no render for users lacking `orders` permission. A widget-local predicate and the loader both enforce this without changing global `requirePermission`.
- Keep existing tenant-wide Customize behavior unchanged. Unauthorized users may still see/toggle the shared Orders block preference, but the server loader never returns data to them.
- Isolate loader/mapping failures from the rest of the dashboard. Render a localized unavailable state that is distinct from authorized empty data.
- Keep the four load gates explicit and inline in `DashboardRoot`; prove the real wiring with a focused page orchestration test instead of adding a trivial boolean helper.

## Cross-Plan Dependencies

| Relationship | Plan | Status | Decision |
|---|---|---|---|
| Related, not blocking | [US-F10-02 Customer Checkout](../260518-1321-GH-109-customer-checkout/plan.md) | pending | It proposes future statuses but explicitly preserves legacy `pending`; #1627 targets the current exact status contract. |
| Historical, complete | [Dashboard failed-generation empty state](../260414-fix-dashboard-empty-state/plan.md) | done | Keep its `hasUsableSites` gate; pending-order query runs only after a usable site exists. |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Secure data contract and loader](./phase-01-secure-data-contract-and-loader.md) | Completed |
| 2 | [Dashboard integration and production UI](./phase-02-dashboard-integration-and-ui.md) | Completed |
| 3 | [QA traceability and regression validation](./phase-03-qa-and-validation.md) | Completed |

## AC Traceability

| AC | Primary phase |
|---|---|
| AC01–AC03 | Phase 1 loader/DTO; Phase 2 render |
| AC04–AC07 | Phase 2 empty/link/responsive/default-off behavior |
| AC08 | Phase 2 EN/MS; Phase 3 automated tests |

## Out of Scope

- Hardening existing `/api/orders`, `/api/orders/[id]`, dashboard summary, or badge-count paths.
- Changing global `requirePermission`, `PlatformUser` membership semantics, or `updateDashboardPreferences`; track those as a separate security task.
- Refactoring the dormant summary pending-order query into a shared service.
- Schema, SQL migration, environment variables, caching, new route/page, or mandatory E2E.
- Changing the Orders page's grouped “Pending” filter or cleaning unrelated stale F03 TC mappings.

## Red Team Review

### Session — 2026-07-22

**Findings:** 14 deduplicated (11 accepted, 3 rejected). **Severity:** 7 High, 7 Medium.

| # | Finding | Severity | Disposition | Applied to |
|---|---|---|---|---|
| 1 | Loader trusts caller permission and tenant | High | Accept | Phase 01 |
| 2 | Suspended/malformed membership can fail open | High | Superseded: defer global guard change; use strict widget-local predicate | Phase 01 / follow-up |
| 3 | Customize restriction is client-only and stale | High | Superseded: keep existing Customize behavior; defer action hardening | Follow-up |
| 4 | Existing Orders APIs lack equivalent custom RBAC | High | Reject: pre-existing systemic gap; record as separate security follow-up | Out of scope |
| 5 | Isolated helper tests do not prove page wiring | High | Accept | Phase 03 |
| 6 | Nullable/invalid runtime currency can crash formatting | High | Accept | Phase 01/02 |
| 7 | QA case count ignores `.41b` | High | Accept | Phase 03 |
| 8 | Full line-item select overfetches data | Medium | Accept | Phase 01 |
| 9 | Restricted preference merge order is undefined | Medium | Accept | Phase 02/03 |
| 10 | Optional widget error can fail the dashboard | Medium | Accept after engineering re-review | Phase 02/03 |
| 11 | AC06 lacks automated responsive browser coverage | Medium | Reject: no new route and E2E is not required; retain mandatory manual matrix | Phase 03 |
| 12 | TC-F03.03 incorrectly implies a three-row minimum | Medium | Accept | Phase 03 |
| 13 | Loader test cannot claim HTTP TC-F03.17 | Medium | Accept | Phase 03 |
| 14 | Typecheck baseline comparison is not reproducible | Medium | Accept | Phase 03 |

## Validation Review

- **Method:** source-backed automatic validation after adversarial review; no unresolved product decision blocks implementation.
- **Confirmed:** real locale files are `src/i18n/locales/en.json` and `ms.json`; `tp` accepts nested `{ one, other }`; Payload accepts `select.id`; Orders total is stored in major units; membership status includes `suspended`.
- **Confirmed scope:** reduced implementation scope. Widget data boundary is secured now; global guard/action/API hardening remains a separately tracked security task.
- **Recommendation:** proceed sequentially only after Phase 01 security tests pass.

## Engineering Re-review

### Session — 2026-07-22

- **1A applied:** remove global permission-guard and membership-type changes from #1627.
- **2A applied:** add explicit unavailable state so an optional Orders failure does not take down the dashboard.
- **3A applied:** reuse existing `dashboard-types.ts`, inline the load condition, and remove Customize server-action work.
- **4A applied:** repair directly conflicting TC-ID mappings and run `npm ci` before all validation commands.
- Existing duplicate Pending Orders queries remain documented technical debt; this PR adds no third public API and does not refactor dormant/legacy flows.

## Completion Evidence and QA Handoff

- All three implementation phases are complete; Phase 03 focused tests passed 48/48, the follow-up Pending Orders suite passed 34/34, the dashboard suite passed 1064/1064 across 75 files, and typecheck passed.
- Follow-up code review scored 10/10 with 0 blocking findings; lint completed with 0 errors and 137 pre-existing repo-wide warnings.
- Production build verification remains blocked before compilation by root-owned `.next/diagnostics` (`EACCES`); repair cache ownership and rerun before release.
- The targeted dashboard E2E suite was discovered but 4 tests skipped because `TEST_EMAIL` and `TEST_PASSWORD` were unavailable. Run it with staging credentials before release.
- The manual 375/768/1280 viewport, keyboard, role, and cross-tenant matrix remains a staging QA handoff and is not recorded as passed.
- Preserve the current unrelated dirty-worktree changes in `docker-compose.yml`, `scripts/db-migrate-dev.js`, and `docker-compose.worktree.yml`.
