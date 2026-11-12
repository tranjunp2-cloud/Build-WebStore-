# Brainstorm — PW1 `stores.status=2` (expired) mapped to suspended tenant

Trigger: store #2917 `luxurious-wedding` suspended on PW2 though owner valid until 2027-07-17.

## Evidence
- PW1 `config/common.php` `users.status`: 0 in_active, 1 active, **2 expired**, 3 banned (reused for `stores.status`).
- PW1 writers of `stores.status`: create → 1; `ban()` → 3; `unBan()` → 2/1 by owner expiry (`EloquentUserRepository.php:309,336-340`). No cron sets 2.
- PW1 renew (`UserController.php:496-500`) updates users `expired_at` + subscription, **never resets `stores.status`** → status 2 goes stale.
- CSV snapshot 281026: live stores `1:2013, 3:810, 2:96`. **All 96** status=2 stores: every live user `status=1`, `expired_at > 2026-10-28`.
- Exporter `src/lib/migration/pw1-export/mappers/identity-site.ts:260`: `store.status !== '1'` → `suspended`.
- `membership()` (`identity-lifecycle.ts`) already derives user lifecycle from `status` + `expired_at` + `banned_at` vs `asOf`.
- Dev (`web-cms-v2.dev`): all 96 tenants `suspended`. #2917 = tenant 3045, site 3437 draft, 0 pages.
- PW2 `suspended` = ban semantics: force logout (`api/auth/session-check`), refresh 403, checkout blocked, COD disabled.
- Pages missing is separate: website build step `not_started` for #2917 (1,544 stores pending; 736 of them PW1-active) → not status-gated.
- Delta pipeline (`pw1-delta/source-pipeline.ts`) reuses `exportMaster` → mapper fix propagates via delta UPDATE.

## Contract
- **Outcome:** PW1 stores with stale `status=2` whose owner is active + unexpired at `asOf` migrate as `active` tenants; dev's 96 tenants corrected.
- **Constraints:** no edits to old migrate scripts' behavior beyond this rule; keep 0/3 → suspended; deterministic by `asOf`; traceable issue code; tests with TC-ID.
- **Non-goals:** running website build for 1,544 pending stores; missing pages/media for #2917; changing PW1 source.
- **Acceptance:** unit tests for status 2 × owner valid/expired/banned; re-export snapshot → 96 tenants `active` (or reported if owner expired); dev delta run → tenant 3045 `active`, owner can log in; no change for status 0/1/3 stores.

## Options
| # | Approach | Load-bearing assumption | Fails first when |
|---|---|---|---|
| A (rec.) | Exporter: `status=2` → defer to `membership(owner)`; `0/3` stay suspended; emit `STORE_STATUS_STALE_EXPIRED` warning | owner `expired_at` is PW1's real entitlement source | a store was genuinely meant to stay expired while owner expiry was extended (no evidence: 0/96 owners expired) |
| B | One-off SQL/API patch of 96 dev tenants to `active` | delta won't re-touch tenant status | next delta/full re-import recomputes from source → reverts to suspended; prod repeats bug |
| C | Ask PW1 to fix `stores.status` at source | PW1 team will patch + re-snapshot | snapshot already frozen; PW1 renew bug keeps producing stale rows |

Trade-offs: A costs a small code change + delta run, durable for prod. B fastest but drifts. C outside our control.

Better approaches: none — recommended direction is the requested one (user-status rule matches `membership()` already in code; 96/96 evidence).

## Risks
- Re-activating enables COD (`cod = sourceCod && active`) for these stores — matches PW1 intent but verify.
- 57/96 already have completed websites on dev; activation makes them reachable/loginable — expected.
- Subscription `ends_at` not checked; decide if also required (renew updates both).

## Unresolved questions
1. PM confirm: expired-but-renewed stores should be `active` on PW2?
2. Also require `plan_subscriptions.ends_at > asOf`, or owner `expired_at` enough?
3. Run delta on dev for 96 stores only, or full delta?
