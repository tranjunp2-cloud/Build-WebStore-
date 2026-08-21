# GH-1725 SSO Navigation Plan

## Context

Issue #1725 reports that generic Web Store entry from the SSO Hub App Switcher and Direct icon lands on `/settings/shipping` instead of `/dashboard`. Planning artifacts live at `plans/260814-1420-gh-1725-sso-navigation-redirect/`.

## What Happened

Before Phase 1, PWv2 dropped `redirect_url` at the authorization page. The session API then queried `sso_step_events` and redirected established owners to the first incomplete setup step, causing generic entry to land on Shipping.

A three-phase PWv2-only plan was created for the redirect contract, deterministic coverage, and real-SSO acceptance. A later issue-scope review removed step-state, multi-tenant, and SSO trust-model redesign from #1725.

Phase 1 is complete. PWv2 now carries the optional intent through the authorization boundary and resolves it server-side without navigating raw input.

Phase 2 is complete. The QA contract now includes TC-1725, and page/client/API regression coverage is complete. The focused baseline was 44/50 with six targeted contract failures; after the reviewer follow-up, all 50/50 pass. Typecheck and diff-check also pass. The P0 `any` finding was fixed with a typed helper. Final review scored 9.7/10 and approved the implementation.

## Phase 3 Execution Record — 2026-08-14

- PWv2 and SSO staging were reachable.
- The local fix was not committed, deployed, or present upstream.
- No verified exact-state SSO session was available.
- `TC-1725-E2E-01` and `TC-1725-E2E-02`: **BLOCKED / NOT RUN**, not PASS.
- Local gates remain green: 50/50 focused tests, typecheck, lint, and diff-check pass. Lint reports 147 baseline warnings; none are attributable to GH-1725.
- Final review: 9.6/10, conditional approve pending real staging execution.

## Source Evidence

- SSO Frontend hotfix commit `f9819360`: generic App Switcher/ProductNavbar entry opens the raw SSO API URL; Direct/CardHeader emits no path.
- SSO API hotfix commit `7ade6624`: the API builds `/sso/authorization?v2_token=...` without `redirect_url` for generic entry.
- These commits support the missing-intent contract used by Phase 1. Runtime staging behavior is still unverified and remains the Phase 3 acceptance gate.

## Decisions

- Do not modify SSO Frontend.
- Generic/missing/empty/invalid intent resolves `/dashboard` after successful authentication, before onboarding/progress routing.
- Preserve ProductCard compatibility only because the new intent plumbing touches it: exact `/initial-setting` reuses the current step resolver, and `/content-manager/product[/]` resolves `/products`.
- For an existing tenant using `/initial-setting`, completed step events are authoritative: a Step 1 row routes to `/settings/shipping` even when onboarding flags are stale. No tenant or no Step 1 row remains `/onboarding`.
- Preserve existing row-status, tenant, role, and client output-allowlist semantics.
- Never navigate raw redirect input.

## Risks and Lessons

- Shared `/initial-setting` cannot perfectly distinguish Template from Shipping when SSO Hub and PW progress diverge.
- Source history shows both generic entries omit intent. Runtime staging must still confirm that deployed behavior; a deployed collision with `/initial-setting` would make the requirement unsatisfiable under the PWv2-only constraint.
- An all-steps-complete browser account would falsely pass the current bug. Acceptance needs the exact Step-1-complete/Step-2-current reproducer.
- Pre-existing token provenance, MFA, login-CSRF, and tenant-progress concerns are not changed or release-gated by #1725; track them separately if required.

## Next

Unblock Phase 3 by committing and deploying the exact fix to PWv2 staging, then provide a secure SSO session for an account in the exact Step-1-complete/Step-2-current state. Run both manual entry flows without recording credentials, tokens, or full callback paths; retain only redacted evidence and final pathname. Do not substitute a locally minted application token for an SSO-issued token.

## PR Review Follow-up — 2026-08-17

- PR #1777 now uses the exact required issue relation text: `Relates to #1725`.
- Added `TC-1725-E2E-03`, a real Playwright browser test for the PWv2-owned generic callback boundary. It provisions deterministic Step-1-only progress through the existing guarded E2E endpoint, exchanges a real Payload token through `/sso/authorization`, and verifies the session cookie and final `/dashboard` pathname.
- Token-bearing traces, screenshots, and videos are disabled for the dedicated Playwright project; assertion failures avoid exposing token values or full callback URLs.
- No `.github/workflows` file is changed. The project remains explicitly runnable with `npx playwright test tests/gh-1725-sso-navigation.spec.ts --project=gh-1725-sso-navigation` against an authorized target.
- External SSO Hub App Switcher and Direct-icon clicks remain manual cross-application acceptance (`TC-1725-E2E-01/02`) because that frontend is outside this repository.
