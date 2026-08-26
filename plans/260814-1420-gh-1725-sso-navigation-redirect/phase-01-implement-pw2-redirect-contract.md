# Phase 1 — Verify Callback Shape and Implement Scoped Redirect Handling

## Context Links

- [Plan overview](./plan.md)
- [Scout report](./reports/scout-report.md)
- [Issue #1725](https://github.com/primeproduction/ech-prime-web-v2/issues/1725)
- `src/app/sso/authorization/page.tsx`
- `src/app/sso/authorization/_components/SsoAuthorizationClient.tsx`
- `src/app/api/auth/sso-session/route.ts`

## Overview

- Priority: P1
- Status: Completed
- Effort: 1.5h
- Goal: make generic SSO entry default to Dashboard while preserving the deployed ProductCard redirect contract.

## Requirements

### Evidence gate

Verified from the PWv2 integration source contracts on 2026-08-14:

- SSO Frontend `hotfix/primeweb-v2-integration` at `f9819360`: `ProductNavbar.vue` (App Switcher) opens the API URL unchanged; `CardHeader.vue` (Direct icon) emits no path and the home handler therefore opens the API URL unchanged.
- SSO API `hotfix/primeweb-v2-integration` at `7ade6624`: `PrimeWebV2Service::getSingleUrlLogin()` returns `/sso/authorization?v2_token=...` with no `redirect_url`.
- ProductCard Progress is the only examined flow that supplies the deployed legacy step path to the home handler.

Runtime staging verification remains in Phase 3; no token value was accessed or recorded during source verification.

### Functional

1. Read optional `redirect_url` beside `v2_token` on the authorization page and pass it through the client POST.
2. After authentication and suspension checks, classify the decoded value with an exact server-owned map. Generic intent resolves `/dashboard` before onboarding/progress routing.
3. For explicit ProductCard intent, preserve the owner access rule and apply the agreed route behavior:
   - absent, empty, `/`, `/dashboard`, invalid, or unknown → `/dashboard`;
   - `/initial-setting` with no tenants → `/onboarding` without a step lookup;
   - `/initial-setting` with an existing tenant → always call `getWebStoreRedirect()`: zero steps → `/onboarding`, Step 1 → `/settings/shipping`, Steps 1+2 → `/products`, all steps → `/dashboard`;
   - stale `has_seen_ai_wizard` or `onboardingCompleted` flags do not override the step resolver for an existing tenant;
   - `/content-manager/product` or `/content-manager/product/` → `/products`.
4. Do not change `getWebStoreRedirect()` query, row-status interpretation, step ordering, DB fallback, or user/tenant scoping in this issue.
5. Keep non-owner behavior on `/dashboard`; explicit ProductCard paths do not broaden their access.

### Security and non-functional

1. Treat `redirect_url` as untrusted. Accept one bounded string only; duplicate/array values are invalid.
2. Never navigate to raw input. API output remains limited to `/dashboard`, `/onboarding`, `/settings/shipping`, and `/products`.
3. Retain the client's existing output allowlist as defense-in-depth.
4. Preserve token validation, rate limiting, suspension checks, session cookie flags, last-login update, and no-store headers unchanged.

## Architecture

```text
/sso/authorization?v2_token=T[&redirect_url=R]
        │ pass T + optional R
        ▼
/api/auth/sso-session
        ├─ auth/suspension failure ────────────────────► existing error
        ├─ generic/invalid/unknown ────────────────────► /dashboard
        ├─ non-owner with explicit intent ─────────────► /dashboard
        └─ owner with explicit ProductCard intent
             ├─ /content-manager/product[/] ──────────► /products
             └─ /initial-setting
                  ├─ no tenants ──────────────────────► /onboarding
                  └─ existing tenant ─────────────────► step resolver
                       ├─ zero steps ──────────────────► /onboarding
                       ├─ Step 1 ──────────────────────► /settings/shipping
                       ├─ Steps 1+2 ───────────────────► /products
                       └─ all steps ───────────────────► /dashboard
```

## Related Code Files

| Action | File | Change |
|---|---|---|
| Modify | `/home/liam/data/ech-prime-web-v2/src/app/sso/authorization/page.tsx` | Read and pass optional intent |
| Modify | `/home/liam/data/ech-prime-web-v2/src/app/sso/authorization/_components/SsoAuthorizationClient.tsx` | Include optional intent in session POST |
| Modify | `/home/liam/data/ech-prime-web-v2/src/app/api/auth/sso-session/route.ts` | Default generic entry to Dashboard; route only known legacy intents |

No source files are created or deleted. No schema, environment, or dependency changes.

## Implementation Steps

1. Complete the evidence gate before editing source.
2. Extend page search-param typing to `redirect_url?: string | string[]`; pass only a single string.
3. Extend client props and POST body without client-side normalization.
4. Parse the optional bounded value beside `v2_token` in the existing request-body parse.
5. Add a small exact classifier or branch local to the SSO route; do not create a new service.
6. Return `/dashboard` for generic intent before owner onboarding/progress selection; generic entry must skip the step query.
7. For explicit owner intent, map the product legacy path to `/products`; for exact `/initial-setting`, return `/onboarding` only when there are no tenants, otherwise call `getWebStoreRedirect()` regardless of stale onboarding flags.
8. Preserve all unrelated authentication/session branches byte-for-byte where practical.

## Todo List

- [x] Verify both generic callback shapes and apply the collision stop.
- [x] Carry optional `redirect_url` through page and client.
- [x] Default generic/invalid intent to Dashboard.
- [x] Preserve exact legacy ProductCard paths.
- [x] Verify unrelated auth/session behavior is unchanged.

## Success Criteria

- Any successfully authenticated user entering generically receives `/dashboard`; the Step-1-complete reproducer no longer lands Shipping.
- Generic entry does not query `sso_step_events`.
- Explicit `/initial-setting` retains the existing Pick/Shipping progression.
- Product legacy path and the Steps-1+2 resolver state map to `/products`.
- Existing-tenant `/initial-setting` navigation is driven by `sso_step_events`; stale onboarding flags do not override it.
- Untrusted input cannot escape the canonical output allowlist.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Generic callback secretly uses `/initial-setting` | Evidence hard stop before implementation |
| ProductCard regression | Preserve existing resolver behind the explicit legacy path and add focused tests |
| Open redirect | Exact server-owned mapping plus existing client output allowlist |
| Unrelated SSO regression | Preserve auth/session branches; isolate the explicit ProductCard compatibility map and use step events for existing-tenant `/initial-setting` |

## Security Considerations

- Validate intent server-side and do not log tokens or raw callback URLs.
- Do not broaden accepted destinations to arbitrary relative paths.
- Pre-existing SSO trust-model concerns are outside #1725 and must not be changed implicitly.

## Next Steps

Proceed to Phase 2 after focused source review confirms only redirect selection changed.
