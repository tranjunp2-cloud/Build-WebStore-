---
title: "GH-1725 — Fix generic Web Store SSO entry destination"
description: "Make App Switcher and Direct-icon entry land on PWv2 Dashboard while preserving the existing ProductCard step behavior in PWv2."
status: in-progress
priority: P1
effort: 3.5h
issue: 1725
branch: fix/gh-1725-sso-navigation-redirect
tags: [bugfix, auth, sso, navigation, testing]
blockedBy: []
blocks: []
created: 2026-08-14
---

# GH-1725 — Fix Generic Web Store SSO Entry Destination

## Issue Scope

Issue #1725 has one acceptance outcome: entering Web Store from either SSO Hub App Switcher or the Web Store card's Direct icon must land on `/dashboard`, not `/settings/shipping`. Implement entirely in PWv2; do not modify SSO Frontend.

PWv2 currently drops `redirect_url`, then sends established owners to the first incomplete Web Store step. The minimum safe fix is to make generic/missing intent default to Dashboard and use the existing SSO ProductCard legacy paths only to preserve current-step navigation.

## In Scope

- Carry optional `redirect_url` through the existing PWv2 authorization page, client, and session API.
- Treat absent, empty, generic, unknown, or unsafe intent as `/dashboard` after successful authentication, regardless of local onboarding/step progress.
- Preserve current ProductCard behavior through a small exact compatibility map:
  - `/initial-setting` with no tenants → `/onboarding`; with an existing tenant, always use `sso_step_events`: zero steps → `/onboarding`, Step 1 → `/settings/shipping`, Steps 1+2 → `/products`, all steps → `/dashboard`.
  - `/content-manager/product` and its trailing-slash form → `/products`.
- Preserve token, role, suspension, cookie, rate-limit, and step-state semantics; stale `has_seen_ai_wizard` or `onboardingCompleted` flags must not override explicit `/initial-setting` progress for an existing tenant.
- Add focused regression coverage and staging acceptance for the two entry points reported in the issue.

## Out of Scope

- SSO Frontend URL/config changes.
- Redesigning `sso_step_events`, changing pending/completed semantics, or introducing tenant-scoped progress.
- Changing multi-tenant selection, stored onboarding flags, MFA/token provenance, login-CSRF, or the SSO trust model.
- New navigation pages, telemetry, schema, migrations, dependencies, or environment variables.
- Expanding ProductCard UX; its paths are handled only to avoid regression from this fix.

## Acceptance Contract

| Scenario | Expected PWv2 destination |
|---|---|
| App Switcher → Web Store, any successfully authenticated user | `/dashboard` |
| Direct icon → Web Store, any successfully authenticated user | `/dashboard` |
| Generic/missing/empty/`/`/`/dashboard` intent | `/dashboard`; no step lookup |
| Unknown, external, protocol-relative, or duplicate intent | `/dashboard`; never navigate raw input |
| `/initial-setting`, no tenants | `/onboarding`; no step lookup |
| `/initial-setting`, existing tenant | Always resolve `sso_step_events`: zero steps → `/onboarding`, Step 1 → `/settings/shipping`, Steps 1+2 → `/products`, all steps → `/dashboard` |
| `/content-manager/product[/]` | `/products` |
| Explicit `/initial-setting` with stale onboarding flags | Step state wins; stale `has_seen_ai_wizard` or `onboardingCompleted` values do not override the resolver |

## Pre-Implementation Evidence Gate

Capture the redacted final `/sso/authorization` callback shape from App Switcher and Direct icon. If either generic entry sends `/initial-setting`, stop: under the no-SSO-change constraint PWv2 cannot distinguish that click from Pick Template/Shipping. Otherwise record the observed representation in the QA cases and proceed.

## Phases

| Phase | Name | Status | Effort |
|---|---|---|---:|
| 1 | [Verify callback shape and implement scoped redirect handling](./phase-01-implement-pw2-redirect-contract.md) | Completed | 1.5h |
| 2 | [Add focused GH-1725 regression coverage](./phase-02-add-contract-regression-coverage.md) | Completed | 1.5h |
| 3 | [Run issue acceptance on staging](./phase-03-run-browser-acceptance-and-verification.md) | Blocked | 0.5h |

## Cross-Plan Dependencies

Existing SSO session and step-sync plans are non-blocking predecessors. The GH-1700 Dashboard work is unrelated. Implement this issue on `fix/gh-1725-sso-navigation-redirect` from `staging`.

## Success Criteria

- Both reported SSO Hub entry points land on `/dashboard` after successful authentication, including the exact reproducer state that currently lands Shipping.
- Explicit legacy ProductCard paths retain the agreed PWv2 destinations, including Pick Template → `/onboarding` and Add Product → `/products`.
- Raw `redirect_url` can never cause an open redirect or arbitrary internal navigation.
- Focused tests and typecheck pass; staging evidence covers both issue reproduction paths.

## Scope Review — 2026-08-14

The original plan exceeded issue scope. This revision removes step-status semantic changes, exact-set/multi-tenant redesign, full ProductCard QA, and unrelated MFA/login-CSRF release gates. Those concerns may be tracked separately but are not implementation requirements for #1725.

## Delivery

PR title: `fix(sso): [GH-1725] default generic Web Store entry to Dashboard`. PR body must use `Relates to #1725`.
