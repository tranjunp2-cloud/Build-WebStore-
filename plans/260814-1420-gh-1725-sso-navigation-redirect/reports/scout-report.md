---
title: "GH-1725 SSO navigation scout report"
description: "Evidence and route mapping used to plan the PWv2-only SSO redirect fix."
created: 2026-08-14
issue: 1725
---

# GH-1725 SSO Navigation Scout Report

## Summary

Issue #1725 reports that generic Web Store entry from the SSO Hub App Switcher and Direct icon lands `/settings/shipping` instead of Dashboard. Scouting confirmed the pre-fix behavior: PWv2 dropped `redirect_url` and independently selected the first locally incomplete step. Middleware does not force Shipping. Source history also confirms both generic entry paths omit redirect intent; deployed staging behavior remains a Phase 3 verification item.

## Findings

### Pre-fix flow

1. SSO Frontend appends `redirect_url` only when a ProductCard step supplies a path.
2. `src/app/sso/authorization/page.tsx` reads only `v2_token`.
3. `SsoAuthorizationClient` posts only `{ v2_token }`.
4. `/api/auth/sso-session` queries `sso_step_events` for established tenant owners.
5. A user with Step 1 present and Step 2 absent receives `/settings/shipping`, regardless of the originating SSO click.

### Generic-entry source evidence

- SSO Frontend hotfix commit `f9819360`: App Switcher/ProductNavbar opens the raw SSO API URL, while Direct/CardHeader emits no path.
- SSO API hotfix commit `7ade6624`: the generic exchange builds `/sso/authorization?v2_token=...` without `redirect_url`.
- This establishes the source contract for missing intent. It does not replace Phase 3 runtime capture on staging.

### Current SSO Frontend contract supplied by user

| Step | Legacy path |
|---|---|
| Pick Template | `/initial-setting` |
| Setup Shipping Fee | `/initial-setting` |
| Add Product | `/content-manager/product/` |

Only the current step is clickable. Source history shows generic App Switcher/Direct entry omits `redirect_url`; runtime staging capture is retained for Phase 3. SSO Frontend is explicitly out of scope.

### Canonical PWv2 routes

| Intent | PWv2 route |
|---|---|
| Generic Web Store | `/dashboard` |
| Pick Template | `/onboarding` — explicit user decision |
| Shipping | `/settings/shipping` |
| Add Product | `/products` |

`/initial-setting` and `/content-manager/product[/]` are not native Next.js routes; they require an inbound compatibility map.

### Relevant files

- `src/app/sso/authorization/page.tsx` — pre-fix boundary that dropped inbound intent; updated in Phase 1.
- `src/app/sso/authorization/_components/SsoAuthorizationClient.tsx` — pre-fix client posted token only; Phase 1 carries optional intent and retains the output allowlist.
- `src/app/api/auth/sso-session/route.ts` — pre-fix source of the state-based Shipping redirect; Phase 1 adds server-owned intent resolution.
- `src/__tests__/unit/auth/sso-session.test.ts` — locks current state-based behavior.
- `src/__tests__/unit/auth/sso-authorization-client.test.tsx` — covers outgoing open-redirect guard, not inbound propagation.
- `docs/qa/F-SSO-PW2.md` — documents obsolete generic state-based behavior; full SSO E2E is deferred.
- `playwright.config.ts` — requires an explicit project for new `tests/*.spec.ts` coverage.

### Historical evidence

- Commit `0924c0f75` introduced state-based first-incomplete-step routing for GH-1293.
- GH-1293's deeplink comment instead called for explicit allowlisted intent and Dashboard fallback when intent is missing/invalid.
- Existing SSO client/retry infrastructure is already present; old plan statuses are stale but non-blocking.

## Recommendations

- After callback evidence confirms the generic representation, map generic/missing intent to Dashboard rather than “resume first incomplete step.”
- Interpret only the two deployed legacy path families to preserve ProductCard behavior touched by this fix.
- Reuse the existing step resolver only for exact `/initial-setting`. For an existing tenant, a completed Step 1 row takes precedence over stale onboarding flags; no tenant or no Step 1 remains onboarding.
- Keep exact server-side mapping and client defense-in-depth.
- Cover the callback boundary with deterministic page/client/session tests and verify both reported entry points in a real staging browser.

## Implementation Status

- Implementation: complete.
- Typecheck: pass.
- Phase 1 review: 9/10.
- Focused baseline: 44/50, with six targeted contract failures.
- Reviewer follow-up: 50/50 focused tests pass; typecheck, lint, and diff-check pass. Final review: 9.6/10, conditional approve pending Phase 3.
- Phase 3 browser cases: blocked/not run pending a deployed fix and verified exact-state SSO session.

## Unresolved Constraint

PWv2 cannot distinguish a generic entry from Pick Template/Shipping if both arrive as `/initial-setting`. Commits `f9819360` and `7ade6624` show that generic source paths omit intent, but staging must confirm the deployed contract in Phase 3. If either deployed generic entry emits `/initial-setting`, report the contract collision. Broader step-state and multi-tenant correctness are outside #1725.
