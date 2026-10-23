# Code review: #1972 F16 Firebase RTDB doorbell (uncommitted, branch feat/F16-firebase-realtime-signal)

Read-only review. Everything below was checked against the working tree. I did not run Firebase, a build or a browser. Scope: all files listed in the task.

## Critical (must fix before commit)

None found. The earlier plan review's C1 (push inside the create transaction), C2 (toast dedupe) and C3 (first snapshot dropped) are all addressed in code (see Verified-OK).

## Important

### I-1. `denied` is not sticky: a later `.info/connected=true` flips back to "live" with dead listeners
- Location: `src/hooks/use-notification-signal.ts:74`, `:80-87`.
- Problem: `onDenied` calls `mode('fallback')`, but the `.info/connected` listener stays attached and calls `mode('live')` on every `true`.
- Scenario: the socket connects and `live` is set. The user-path listener is then cancelled (rules mismatch, for example a `VERCEL_TARGET_ENV` difference between the token route and the rules, or a rules deploy mistake). Fallback polling starts. The next network blip fires `.info/connected=true` again and the mode flips to `live`. Polling stops, and no signal can ever arrive because both listeners are cancelled. Notifications silently stop until a reload.
- Fix: add a `let denied = false` flag. Set it in `onDenied`, and skip `mode('live')` and `onReconnect` while it is set. Alternatively, call the cleanup and `retry()` on denial.

### I-2. Stale or cancelled start can sign out the shared Firebase Auth singleton used by the live mount
- Location: `src/lib/firebase/firebase-client.ts:30-39`, `src/hooks/use-notification-signal.ts:65`, `:68`, `:95`.
- Problem: every mount shares one app, `pw2-notif`, and therefore one `Auth`. A cancelled start that finishes `connectFirebaseClient` late calls `client.auth.signOut()` (lines 65 and 68). That signs out whichever sign-in is current.
- Scenarios:
  - React StrictMode in dev (mount, cleanup, mount).
  - A `(dashboard)` to `(editor)` route-group switch during the 0.5-2 s connect window, since both layouts mount the provider.
- Failure: the live mount's `signInWithCustomToken` is invalidated. Its listeners get permission-denied, `onDenied` fires, and the tab is stuck in 60 s polling. With I-1 it can later flip to a dead "live".
- Fix:
  - Do not `signOut` from a stale start. Sign-out only matters on real teardown, and in-memory persistence already clears on reload.
  - Or sign out only if `auth.currentUser?.uid` still equals the uid this start signed in with and no newer start exists. A module-level generation counter in `connectFirebaseClient` would do it.
  - Or keep one module-level client and ref-count it.

### I-3. Token fetch has no timeout, so `signalNotificationUsers` can hang and block the push stage
- Location: `src/lib/notifications/signal-notification.ts:13` (`await tokenPromise`), `src/lib/firebase/firebase-admin-app.ts:64`.
- Problem: the 3 s `AbortSignal.timeout` only covers `fetch`. The OAuth access-token request made by `credential.getAccessToken()` is not bounded by it.
- Scenario: Google's OAuth endpoint is slow or hangs. `notifyTenantOwners` awaits the signal before pushes (`notify-tenant-owners.ts:135` then `:137`), so Web Push and the toast path stall until the function's `maxDuration` (120 s). A Firebase outage then also kills push, and the plan says a Firebase outage must not do that.
- Note: the 30 s provisional cache expiry limits the damage to one hanging caller per 30 s, but each caller still hangs.
- Fix: `await Promise.race([tokenPromise, new Promise((_, rej) => setTimeout(() => rej(new Error('token timeout')), 3000))])`. Alternatively, run signal and push concurrently with `Promise.allSettled`, which keeps signal-first without making push wait on it.

### I-4. The hook has no unit tests, and neither do the token cache or `firebase-client`
- Location: `src/hooks/use-notification-signal.ts` (111 lines), `src/lib/firebase/firebase-admin-app.ts`, `src/lib/firebase/firebase-client.ts`.
- Problem: `notification-provider-signal.test.tsx:35` mocks the hook entirely. Grepping `src/__tests__` for `use-notification-signal`, `firebase-admin-app` and `getFirebaseAccessToken` finds only mocks. Specifically untested:
  - the retry/backoff table and the 401/429/5xx branches;
  - the 15 s connect timeout and the cancel guards after each `await`;
  - the denied path (I-1);
  - the token-cache logic (promise sharing, expiry, failure clearing).
- Impact: TC-F16.53 and AC-07 (fallback) are only tested at the provider level with a fake hook, so the real fallback triggers are unverified. I-1 and I-2 are exactly the bugs such a test would catch.
- Fix: add a TC-F16.5x test for the hook that mocks `firebase-client` and `firebase/database`, with fake timers. Add a small test for the token cache (two concurrent calls make one `getAccessToken`; a rejection clears the cache; an expired entry refreshes).

### I-5. Orders guard checks existence only, not `status === 'cancelled'`
- Location: `src/collections/Orders.ts:55-60`.
- Problem: the checkout CAS-failure path (`checkout/route.ts:565-573`) first marks the order `cancelled`, then deletes it. If the delete fails (the FK failure case that route comments on), the row survives as `cancelled`. `findByID` returns it and the merchant gets a "New Order" notification for an order that was rolled back and answered with a 422.
- Fix: `if (!stillExists || stillExists.status === 'cancelled') return`.
- This is cheap and was suggested as part of plan review I1.

### I-6. Manual or admin-panel creates of notifications ring no doorbell
- Location: `src/collections/Notifications.ts:57-77`.
- Problem: the afterChange hook only sends push (when `skipPush` is not set). Any row created outside `notifyTenantOwners` and the broadcast path never signals. Examples: super-admin Payload admin UI or REST `POST /api/notifications`, and any future `payload.create('notifications')`.
- Impact: the clients' only recovery path is focus, reconnect or the 60 s fallback. In live mode there is no poll, so up to STALE_MS (60 s) on the next focus and unbounded otherwise.
- Today the only code creators are `notify-tenant-owners.ts` and the raw `create-broadcast` INSERT (grep confirmed), so the impact is limited to the admin UI. Either add a signal inside the `runAfterResponse` there, when `!context.skipPush`, or document this as a non-goal.

## Minor

- M-1. `mark-read/route.ts:26-36`: the new `signalRead` function with its own JSDoc was inserted between the original POST JSDoc and `export const POST`. The POST doc block now documents `signalRead`. Move `signalRead` above the POST doc.
- M-2. Self-signal: `mark-read` rings the caller's own doorbell as well, so the device that clicked "mark read" does one redundant `GET /api/notifications` (debounce 1 s, min gap 3 s). It costs rate budget (the GET limit is 60/min) and is not harmful. Optionally skip the toast/refresh if the sync happened less than 3 s ago.
- M-3. Page-load request fan-out: the mount `sync()` plus the first snapshot of the user listener plus the first snapshot of the broadcast listener (jitter 0-5 s) can produce 2-3 `GET /api/notifications` per page load. That is intended by the C3 fix, but the broadcast first snapshot is not coalesced with the user one because the jitter timer fires separately. Suggest skipping the jitter for the first broadcast snapshot (call `requestSync` directly) so it merges with the user-listener sync.
- M-4. `use-notification-signal.ts:54`: the token `fetch` and `connectFirebaseClient` have no timeout, and `connectTimer` is only armed after the listeners attach (`:90`). If either hangs, the mode stays `unknown`: no polling, no fallback, no signals. Arm a 15-20 s fallback timer at the top of `start()`.
- M-5. `use-notification-signal.ts:51`: the 429 `Retry-After` from the token route is ignored. Retries use a fixed 30 s schedule, which is acceptable but not what the comment says ("429 retries with backoff").
- M-6. `.info/connected` going `false` does not enter fallback. During a long outage the tab has no poll. This is consistent with D-decisions (reconnect triggers a catch-up), but anything created during the outage is only seen after reconnect or focus. Fine; just be aware.
- M-7. `package.json`: an unrelated whitespace edit on the `migrate:pw1:website:qa-backfill` line. Revert it to keep the diff clean.
- M-8. `package-lock.json`: 155 lines were removed beyond firebase additions (nested `@fastify/otel/node_modules/@opentelemetry/*` entries were hoisted or dropped). That may shift transitive Sentry/OpenTelemetry versions. I could not inspect node_modules. Confirm `npm ls @opentelemetry/instrumentation` is unchanged in a semver-meaningful way, or regenerate the lock with minimal churn.
- M-9. `firebase/pw2-database-rules.json` is not wired to any deploy step. It is a manual paste (TC-F16.54 is manual). That is fine given the dedicated-project decision, but say so in the architecture doc, because a wrong or missing rules deploy means denial and fallback only, never a data leak (default deny).
- M-10. `getNotificationSignalEnv()` falls back to `development` when `VERCEL_TARGET_ENV` is missing at runtime, with a single warning. If that happens on both staging and production sharing one Firebase project, both use `pw2/development/*` and uid `pw2_development_{id}`. User 5 on staging could then read user 5 on production (a timestamp only, so low impact, but it also rings spurious syncs). With dedicated projects this is harmless. Keep the warning, and verify the var on staging (TC-F16.54).
- M-11. `docs/qa/F16-notification-center.md`: TC-F16.45..54 are present and unique, and TC-F16.43/44 were back-filled. OK. Note TC-F16.45 is used twice in `signal-notification.test.ts` (two `describe`s); that is fine.
- M-12. `payment-failed.ts` still has `sendPaymentRetryEmail(...).catch(...)` as plain fire-and-forget right after the new `runAfterResponse` block. That is the same Vercel-kill class the PR fixes for notifications. It is out of scope, but it is the lone survivor in the same function.
- M-13. PW1 migration scripts: `Orders.afterChange` now takes `after()` -> throws -> immediate-run path -> `findByID` runs on a different connection than the migration writer's transaction (`pw1-json/writer.ts` uses `transactionID`). The uncommitted order is not visible, `findByID` returns null, and the notification is skipped. Before this change the merchant got an ORDER_NEW per migrated order. That is probably desirable, but it is an undocumented behaviour change. Mention it in the changelog or comment.

## Verified-OK (with evidence)

1. Rules vs paths:
   - `notification-signal-env.ts:22-34` builds uid `pw2_{env}_{id}`, user path `pw2/{env}/u/{id}`, and broadcast path `pw2/{env}/broadcast`.
   - `pw2-database-rules.json:3-15` has `pw2/$env/u/$userId` with read when `auth.uid === 'pw2_' + $env + '_' + $userId`, plus `pw2/$env/broadcast` with read for uids starting `pw2_{env}_`. Write is false everywhere, and there is no read at `pw2`, `$env` or `u` level.
   - The client only subscribes to the paths the server returned (`firebase-token/route.ts:47-48`), and `userSignalPath(user.id)` is derived from the authenticated user, not from input.
   - `$env` sanitisation strips `_`, so `env + '_' + id` is unambiguous.
   - A user cannot read another user's node or list `u`, and cannot write. `scripts/firebase-signal-smoke.mjs` asserts exactly these cases (including list-all and other-env).
2. Token endpoint:
   - `withAuth`, then a rate limit of 10/min with `Retry-After`, and `no-store` on all responses.
   - The 500 body is generic, and logs print `error.message` only.
   - The response contains the web API key (public by design), `databaseURL` and `projectId`. No private key or client email.
   - `enabled:false` when not configured.
3. REST write semantics:
   - PATCH on `pw2/{env}/u.json` with `{ "<id>": { at: {".sv":"timestamp"} } }` replaces only the listed children (each `<id>` subtree), so other users' nodes are untouched.
   - PUT on `broadcast` is correct.
   - One request per batch, with a 3 s fetch timeout.
   - Errors are caught, and `res.ok` failures are logged by status code only.
   - Ids are deduped, filtered to positive integers, and not echoed in logs.
4. Access-token cache (`firebase-admin-app.ts:55-75`):
   - It caches the promise, so concurrent callers share one fetch. The 30 s provisional expiry is replaced on resolve with `expires_in*1000 + now - 60s`.
   - A failure clears the cache only if it is still the same promise.
   - Referencing `promise` inside its own `.then` is safe because the callback is async.
   - No stampede bug found. Residual: no timeout (I-3).
5. Plan-review items:
   - C1 (deadlock): the Notifications hook is skipped via `context.skipPush` (`Notifications.ts:61`). `notifyTenantOwners` creates with `skipPush` (`notify-tenant-owners.ts:125`), awaits `allSettled`, signals once (`:135`), then pushes (`:137-152`) after commit. The push has a 5 s timeout (`send-push.ts` diff).
   - C2 (toast dup): `NotificationProvider.tsx:284-286` checks `seenIds` before the push toast, and the test at `notification-provider-signal.test.tsx:151` covers it.
   - C3 (first snapshot): `use-notification-signal.ts:76-79` counts the first snapshot.
   - I1: `Orders.ts:55` guard (see I-5 for the gap).
   - I3: generation/cancel guards after every `await` (`:55,:59,:65,:68`), retries for 429/5xx/network, and exit from fallback on `.info/connected`. Remaining holes are I-1 and I-2.
   - I4: `VERCEL_TARGET_ENV` is added to `BUILT_IN_VARS`. `node scripts/check-env-vars.js` passes, and `process.env.VERCEL` was already built in.
   - I5: the client config is returned at runtime, so no `NEXT_PUBLIC_FIREBASE_*` and rollback is just removing the server env.
   - M1: limit 50. M2: `!i.isRead` toasts only. M3: 3 s min gap plus `Retry-After`. M4: `finally` signal in broadcast. M6: promise cache. M7: smoke script committed. M9: TC-43/44 back-filled.
6. `runAfterResponse` (`run-after-response.ts`): I executed `require('next/server').after(() => {})` outside a request in plain Node. It throws "`after` was called outside a request scope", which matches the try/catch fallback. Scripts and tsx loading `next/server` from collections is therefore fine. Every producer passes `payload` or `req.payload` and does not capture `req` in the task (`Orders.ts:51`, `Blogs.ts:115`, `Products.ts:111`, `Notifications.ts:62`).
7. Orders race: checkout creates the order without `req` (`checkout/route.ts:381`), so it is a standalone transaction committed when `payload.create` returns, long before the post-response task. The delete paths (`:449`, `:573`) also complete before the response. `findByID` with `disableErrors: true` returning null for a missing row is the Payload 3 behaviour. The guard is therefore effective for the delete case.
8. Client state:
   - StrictMode double-mount without the I-2 race is clean (cancelled flag, timers cleared, `detached` suppresses sign-out-induced denies).
   - `since` = server `createdAt` minus 5 s with `greater_than` on the route (`route.ts:63-70`). The future clamp at `route.ts:65` cannot trigger because the watermark is a server value.
   - `seenIds` eviction keeps the newest 100 (more than 2x the 50 limit), so evicted ids are older than `newest-5s` and cannot be re-returned.
   - 401 sets `stoppedRef`; 429 sets `blockedUntil` and dirty.
   - Hidden tabs only mark dirty. Fallback timer pauses when hidden.
   - The provider's cleanup clears the abort, debounce, fallback and jitter timers and removes all listeners.
   - With Firebase unconfigured, `{enabled:false}` leads to `mode('fallback')` and 60 s polling.
9. Migration: `db-setup.js` drops the trigger before the function (correct dependency order), uses `IF EXISTS` (a fresh DB is a no-op), and uses a new unique entry name. The old `notify_fn` and `notify_trigger` entries were removed. No `src/` or `scripts/` code does `LISTEN` or references `notification_channel` (grep). `check-migrations.js` only gates collection field additions, so no new gate trips.
10. Bundling: `firebase-admin` is added to `serverExternalPackages` (`next.config.ts:23`). `firebase` is only loaded via dynamic `import()` in `firebase-client.ts`, so it stays out of the first-load bundle. `firebase-admin/auth` is dynamically imported in the route. `Notifications.ts` now statically imports `send-push`, which itself dynamic-imports `web-push` and was already server-only, so no client-bundle risk. No `'use client'` file imports the touched collections (grep).
11. Tests: new tests are behavioural (URL/body/ordering assertions in TC-F16.45/48, debounce/watermark/jitter timing in TC-F16.52, fallback polling in TC-F16.53). TC-IDs 45-54 are unique, and 45-53 are used consistently between tests and the QA doc. The old TC-MIG-NP file (backoff, hidden-tab, abort) is replaced in substance by TC-F16.52/53 (hidden tab, abort on 429, 401 stop, fallback tick).
12. Secrets: no env values in logs, responses (except the intentionally public web key), tests or docs. The `.env*.example` files contain empty placeholders only.

## Unresolved questions

1. Is `VERCEL_TARGET_ENV` actually present at runtime for `vercel deploy --prebuilt` on the custom "staging" environment? If not, the `development` prefix is used silently (M-10).
2. Does `firebase-admin`'s `getAccessToken()` apply its own HTTP timeout? If it does, I-3 drops to Minor.
3. Is Orders `afterChange` ever invoked with a caller-supplied `req.transactionID` that outlives the response (Payload REST batch endpoints)? I found none in `src/app`, but I did not audit custom endpoints.
4. Should the admin-UI/manual notification creates (I-6) ring the doorbell, or is that explicitly out of scope?
5. Is the 5 s-jitter first broadcast sync acceptable at fleet scale (every page load of every tab hits `/api/notifications` once more)? Consider M-3.

**Status:** DONE_WITH_CONCERNS
**Summary:** No blocking defects. The Critical items from the plan review are implemented correctly, the rules match the paths, and the REST semantics and token cache are sound. The six Important items are I-1/I-2 (client auth/denied state machine), I-3 (token timeout), I-4 (no hook tests), I-5 (cancelled-order guard) and I-6 (manual creates), and I recommend fixing at least I-1, I-2, I-3 and I-5 before commit.
