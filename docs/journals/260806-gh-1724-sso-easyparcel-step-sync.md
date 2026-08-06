# Issue #1724 — EasyParcel SSO shipping-step sync

## Context

Issue #1724 reports that completing EasyParcel setup does not advance SSO Hub onboarding. PWv2 shows EasyParcel connected/enabled, but SSO remains at `1 of 3` instead of completing “Setup Shipping”.

## What happened

Code scouting confirmed that “Save & Activate” uses `POST /api/tenant/[id]/easyparcel-save`. The route validates access, credentials, and pickup address, persists `tenant.easyParcelIntegration`, and returns success without calling the SSO step notifier.

The OAuth callback only stores connection data and intentionally does not activate EasyParcel. Flat Rate already invokes `notifyStepComplete(..., user.id, 2)` after persistence through `after()`, PATCHing SSO product 8 with `{ step2_status: 1 }` and using `sso_step_events` for retries.

## Decisions

- Trigger SSO step 2 only after successful EasyParcel activation with `enabled === true`.
- Reuse the existing notifier, `after()` pattern, and retry infrastructure.
- Add no new API contract, schema, migration, or environment variable.
- Do not trigger from OAuth callback.
- Add route regression coverage and a Playwright regression flow where safe fixtures exist.

## Impact

The missing trigger explains the SSO progress discrepancy; existing PWv2 persistence remains intact. A separate dashboard concern remains because local completion is site-scoped while EasyParcel state is tenant-scoped.

## Implementation update

On branch `fix/gh-1724-sso-step-sync`, the EasyParcel save route now schedules SSO step 2 after successful activation, exports `maxDuration = 60`, and preserves non-blocking error handling. Missing `keyString` now becomes a pending retry event instead of a false completed event. Route and SSO client regression tests were added, and the QA document now maps TC-1724-SYNC-01 through TC-1724-SYNC-04.

Targeted tests (35 total), typecheck, and lint completed successfully; lint only reported pre-existing repository warnings. Local Docker browser verification completed; staging SSO completion remains.

## Next steps

1. Verify staging behavior through SSO progress or `sso_step_events`.
2. Confirm the affected staging SSO user has `keyString` so the event can reach `completed`.
