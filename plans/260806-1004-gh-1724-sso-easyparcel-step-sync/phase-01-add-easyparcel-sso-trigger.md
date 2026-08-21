# Phase 01 — Add EasyParcel SSO trigger

## Context links

- Parent: [Plan](./plan.md)
- Issue: [#1724](https://github.com/primeproduction/ech-prime-web-v2/issues/1724)
- Existing trigger: [shipping-config route](../../src/app/api/sites/%5BsiteId%5D/shipping-config/route.ts)
- Existing client: [sso-api-client.ts](../../src/lib/sso/sso-api-client.ts)
- Shipping architecture: [F14 shipping](../../docs/architecture/F14-shipping.md)

## Overview

- Priority: P1
- Status: Completed
- Effort: 1.5h
- Change the EasyParcel tenant save route only; no new abstraction.

## Key Insights

- OAuth callback stores tokens and optional pickup data but deliberately does not enable the integration.
- `POST /api/tenant/[id]/easyparcel-save` is the first point where authentication, connected tokens, complete default warehouse, and `enabled=true` are all established.
- Flat Rate already uses `after()` plus a fire-and-forget fallback after persistence. Reuse that pattern.

## Requirements

- Import `after` from `next/server` and `notifyStepComplete` from `@/lib/sso/sso-api-client`.
- Trigger only after `payload.update()` completes successfully and only when `enabled === true`.
- Pass the acting authenticated `user.id` and step `2`.
- Keep SSO/network errors out of the response path; log a concise error and let `notifyStepComplete` persist retry state.
- Do not trigger for validation failures, forbidden tenants, disconnected integrations, `enabled=false`, or failed DB updates.
- Export `maxDuration = 60` to comply with the Vercel Pro route limit and leave budget for the notifier's 20-second login and 25-second PATCH outbound timeouts.

## Architecture

```text
authenticated Save & Activate
  -> validate request + warehouse
  -> lock tenant and persist enabled integration
  -> schedule notifyStepComplete(payload, user.id, 2)
  -> return success without waiting for SSO
  -> sso-api-client PATCHes { step2_status: 1 }
  -> failure -> sso_step_events pending -> cron retry
```

## Related code files

### Modify

- `src/app/api/tenant/[id]/easyparcel-save/route.ts` — add post-save SSO trigger.

### Reuse/read-only reference

- `src/app/api/sites/[siteId]/shipping-config/route.ts` — `after()` pattern.
- `src/lib/sso/sso-api-client.ts` — step mapping, dedupe, retry persistence.
- `src/app/api/cron/process-sso-steps/route.ts` — retry behavior.

### Create/delete

- None.

## Implementation steps

1. Add the two imports and route duration constant if needed.
2. Keep `withTenantRowLock` as the persistence boundary.
3. After a successful `saveResult` check, define `_notifyStep2` with `.catch()` logging.
4. Schedule with `after(_notifyStep2)` and fallback to `void _notifyStep2()` when outside a request context.
5. Return the existing response unchanged.
6. Confirm no token, password, or SSO response body is logged.

## Todo

- [x] Add imports and post-save trigger.
- [x] Guard on `enabled === true`.
- [x] Verify no notification occurs before persistence succeeds.
- [x] Run typecheck/lint for the route.

## Success criteria

- A valid enabled save schedules exactly one step-2 notification.
- Response remains `200` when SSO is unavailable.
- Existing auth, validation, lock, and persistence behavior is unchanged.

## Risk assessment

- `after()` may not be available in unit-test/request-less contexts; retain the existing fallback.
- User-scoped SSO events use the acting `user.id`; this matches Flat Rate behavior but should be retained deliberately for multi-user tenants.
- Missing `keyString` must be represented as a pending/retryable notification failure; do not mark the onboarding step completed without an SSO call.

## Security considerations

- Keep the existing tenant ownership check before reading/updating hidden integration tokens.
- Do not move the trigger to the public OAuth callback.
- Do not expose `accessToken`, `refreshToken`, decrypted passwords, bearer tokens, or SSO response bodies.

## Next steps

Proceed to Phase 02 before any staging deployment.
