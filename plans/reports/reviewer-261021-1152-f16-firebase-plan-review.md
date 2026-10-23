# Adversarial review — Plan #1972 F16 Firebase realtime signal

Plan: `plans/261021-1152-1972-f16-firebase-realtime-signal/` · Spec: `plans/reports/issue-draft-261020-1724-f16-firebase-realtime-signal.md`
Read-only review; every claim checked against code at HEAD `3d82573d5` (staging).

## Critical (must fix in plan)

### C1. Awaiting push inside `Notifications.afterChange` holds the create transaction open and can deadlock the pool
- Plan (P02 step 2, D3): the hook does `await sendPushToUser(...)`; "chạy trong after() nên không ảnh hưởng".
- Evidence:
  - Payload 3 local `create` opens a transaction (postgres adapter, no `req` passed → new tx) and runs `afterChange` **before** commit. `notifyTenantOwners` fires up to 200 `payload.create` **concurrently** (`notify-tenant-owners.ts:102-120`).
  - `sendPushToUser` runs `payload.find('push-subscriptions')` **without `req`** (`send-push.ts:50`), so it needs a second pool connection while the tx connection is still held. Then it makes web-push HTTP calls (`send-push.ts:82`), which have no timeout.
  - Pool `max: 25` (`payload.config.ts:195`). Under Fluid compute the pool is shared by concurrent invocations. With ≥25 creates in flight (for example the reconcile cron: up to 50 orders → 50 `after()` tasks at once, `reconcile-orders.ts:16-21`), every connection is held by a tx that is waiting for a 26th connection. pg's default `connectionTimeoutMillis=0` means it waits forever, so the function hangs until maxDuration kills it. Notifications, pushes and signals are all lost.
  - Even without a deadlock, the signal is sent only after `allSettled`, so it waits for the **slowest push endpoint**. That puts AC-01 (<2 s) at risk.
- Fix: keep the push out of the transaction. In `notifyTenantOwners`, create with `context: { deferPush: true }` and collect the fulfilled docs. **After** `allSettled`: (1) `await signalNotificationUsers(ids)` first, (2) send pushes for those docs (`Promise.allSettled`, optionally capped at ~5 concurrent). The hook skips when `context.deferPush`; otherwise (a super-admin creating a row manually) it pushes through `runAfterResponse`. Add a 5 s timeout to `webpush.sendNotification` (it takes a `timeout` option).

### C2. AC-08 toast duplication between SW push and Firebase signal is not handled
- Plan (P03): "SW PUSH_NOTIFICATION → giữ nguyên (seenIds.add + toast + requestSync)".
- Evidence: `NotificationProvider.tsx:140-161` always emits a toast and never checks `seenIds`. `ToastContainer.tsx:26-30` has no dedupe by id (it also produces duplicate React keys). Today polling runs every 15–60 s, so the race is rare. With a signal (about 1 s debounce + GET), the sync often runs **before** the push `postMessage` arrives, so the same id gets toasted twice. The reverse order is already guarded.
- Fix: in `handlePushMessage`, `if (seenIds.has(id)) return /*skip toast*/; seenIds.add(id)`. Optionally dedupe by id in `ToastContainer`. Add a test case for it (signal sync first, then push with the same id → 1 toast).

### C3. "Skip first snapshot" loses events in the mount → subscribe window
- Plan (P03 hook): "Bỏ qua snapshot đầu tiên của mỗi listener".
- Evidence: the mount `sync()` runs immediately. Listeners attach only after token fetch + `signInWithCustomToken` + `onValue`, which takes about 0.5–2 s. A notification (or broadcast) created in that gap is not in the mount sync. Its signal arrives as the **first** snapshot and gets dropped, so there is no toast or badge update until the next trigger. This breaks AC-01/AC-04 for real on page load.
- Fix: on the first snapshot of each listener, call `requestSync()` once instead of ignoring it. The debounce merges it with the mount sync. That costs at most 1 extra GET per page load. Alternatively, compare `snapshot.at` against the server time of the last sync, but that needs a server timestamp in the response, so it is more work.

## Important

### I1. `after()` tasks fire for orders that were rolled back or compensating-deleted
- Plan (P02 edge cases): "giống hành vi hiện tại — không xử lý".
- Evidence: `checkout/route.ts:381` creates the order (the hook schedules ORDER_NEW). Then it **deletes** the order when discount reservation fails (`:449`) or stock CAS fails (`:573`), and returns 409. With `after()`, the notification now *deterministically* runs after the delete. Today it is a race. The same happens when a later Orders `afterChange` hook throws and Payload rolls the create back.
- Fix (cheap): inside the ORDER_NEW task, `findByID('orders', id, depth 0)` and skip if it is missing or `status === 'cancelled'`.

### I2. maxDuration claim is wrong
- Plan (P02 risks): "mặc định Vercel 300s (Fluid) — dư".
- Evidence: `vercel.json:5-14` sets `api/**` = 120 s and the Payload catch-all = 120 s. `checkout/route.ts:32` and `cron/reconcile-orders/route.ts:7` set 60 s. The reconcile job budget is 50 s (`reconcile-orders.ts:21`), which leaves about 10 s for up to 50 `after()` tasks.
- Fix: correct the claim. Together with C1, either make the reconcile job await notifications inline (it is a cron with no user waiting), or lower the job deadline to 40 s.

### I3. Signal and fallback-mode state machine is under-specified
- 429 or 5xx from `/firebase-token` (rate limit 10/min, P01) is currently treated as a "hard error" and puts the tab in 60 s polling forever. Fix: retry 429/5xx with backoff (honour `Retry-After`). Make only `enabled:false`, permission-denied and 401 terminal.
- The 15 s "not connected" timeout enters fallback, but nothing says how to **exit** it. Fix: on `.info/connected=true`, stop the fallback timer.
- StrictMode/HMR: `(dashboard)` and `(editor)` layouts both mount the provider (`(dashboard)/layout.tsx:91`, `(editor)/layout.tsx:32`). Effect A's in-flight token fetch can resolve after cleanup and leak listeners or sign-ins. Fix: add a `cancelled`/generation guard after every `await` in the hook, run cleanup order unsubscribe → `signOut`, and ignore cancel callbacks after cleanup (signOut itself triggers permission-denied cancels → spurious `onHardError`).

### I4. `check-env-vars.js`: fallback branch also fails CI; NEXT_PUBLIC access must be literal
- Confirmed: the script greps `+process.env.X` in `src/**/*.ts(x)` diff lines (`check-env-vars.js:59-71`). `VERCEL_TARGET_ENV` is not in `BUILT_IN_VARS` (`:24-35`) or in either example file, so CI fails. Adding it to `BUILT_IN_VARS` is the right fix (a Vercel system var shouldn't live in the Dashboard example files).
- Problem: the P01 fallback uses `process.env.VERCEL_ENV`, which is **also** absent from both (the existing uses at `(dashboard)/layout.tsx:75` predate the diff). Add `VERCEL_ENV` to `BUILT_IN_VARS` too, or drop the fallback.
- `isFirebaseClientConfigured()` must use literal `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` etc. A loop or `process.env[k]` is neither inlined by Next nor detected by the CI script. State this in P03.
- `.env.example` is not checked by the script; adding to it is optional but good. `.env.qc-test.example` exists and is not mentioned; add commented placeholders there or document "qc-test = no Firebase → fallback".
- Note: the issue says "không sửa check-env-vars.js". The plan contradicts it correctly, so update the issue text.

### I5. AC-07 "rollback by deleting env" needs a redeploy, and NEXT_PUBLIC vars are build-time
- Evidence: CI `vercel pull` + `vercel build` inline NEXT_PUBLIC values. Vercel env edits apply only to new deployments.
- Fix: document "remove env + re-run deploy". Simpler still (also a YAGNI win, see Y2): have `/firebase-token` return `{apiKey, databaseURL}` at runtime and drop all `NEXT_PUBLIC_FIREBASE_*`. Then removing the server env alone → `enabled:false` → fallback, with no build-time coupling.

### I6. Spark ~100 concurrent connections shared with PW1 production
- Each tab holds one RTDB socket (hidden tabs too, by D6). This is listed only as an open question.
- Fix: make "production on Blaze" a **gate** in phase 00 before the main merge. Otherwise call `goOffline()` when a tab has been hidden for more than N minutes and `goOnline()` + sync on visible.

## Minor
- M1. Watermark: `since` returns at most `limit=20` sorted `-createdAt` (`route.ts:69-80`). After a long offline period with more than 20 new items, the burst count is capped and the older items never toast (badge stays correct). AC-06 says "kéo về đủ". Use `limit=50` for signal syncs and document the cap.
- M2. Toast only `!item.isRead`. Otherwise a hidden or dirty tab toasts items another device already read.
- M3. Rate limit (AC-09): 60/min per user is shared across **devices and visible windows**. With debounce 1 s and a 2 s minimum gap, a single window does at most 30/min, so two visible windows plus dropdown and bell calls can reach 60. Suggest a 3 s minimum gap and handle 429 using `Retry-After` (not as an error).
- M4. Broadcast: if a batch throws partway (`create-broadcast.ts:56-84`), no signal is sent for the rows already inserted. Signal in `finally` when `totalNotified > 0`. Note that broadcast still has no Web Push (spec problem #4). That's fine for the ACs, but say it explicitly as a non-goal.
- M5. Never pass `req` (or anything holding `req.transactionID`) into a `runAfterResponse` task. All current producers pass `req.payload`/`payload` (correct); make it a rule in the helper's JSDoc.
- M6. `getFirebaseAccessToken()` cache: cache the **promise** to avoid a refresh stampede under Fluid concurrency.
- M7. The phase-00 smoke script lives in `<scratchpad>` and isn't reproducible by teammates. Either commit `scripts/firebase-signal-smoke.mjs` or drop the step.
- M8. Docs grep: `docs/qa/scenarios/vercel-phase2-code-changes.md` and `docs/architecture/F16-notification-center.md:9,17` still mention pg_notify/SSE/WebSocket. Add them to the P04 docs list.
- M9. TC-F16.43/.44 are used in tests but missing from `docs/qa/F16-notification-center.md` (it ends at .29). That predates this plan; add them while editing the QA doc so the testing rule ("TC-ID from docs/qa") holds.
- M10. Verify `npx payload generate:types` and `scripts/import-pw1-json.ts` still load config after collections import `next/server` (through `run-after-response`). `after` throws outside a request, so the fallback runs immediately. This is expected but should be checked once.
- M11. Out of scope but the same Vercel-kill class: `sendPaymentRetryEmail(...)` fire-and-forget at `payment-failed.ts:109`. Consider wrapping it in the same helper (one line).

## YAGNI / over-engineering
- Y1. "Chunk 500 key/PATCH" is dead code (`RECIPIENT_LIMIT = 200`, broadcast uses its own path). Cut it.
- Y2. 8 env vars → 5: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is unused for custom-token sign-in. `NEXT_PUBLIC_*_PROJECT_ID` and `*_DATABASE_URL` duplicate the server vars. Returning the client config from `/firebase-token` removes every NEXT_PUBLIC var (also fixes I5).
- Y3. `kind: 'new'|'read'`: the client treats both the same. Keep it only if it gates something (for example, skip toast logic on `read`); otherwise use `{at}` only.

## Confirmed-correct claims
- Producer line refs: `Orders.ts:49`, `Products.ts:110`, `Blogs.ts:114`, `payment-failed.ts:95`, `reconcile-order-paid-emails.ts:114`, `upload-proof/route.ts:95`, `upload-proof-direct/route.ts:106`. All are un-awaited.
- Q1 coverage: the only notification-row producers are `notifyTenantOwners` (7 call sites above) and `create-broadcast.ts:58` raw INSERT. Other mutations: mark-read raw UPDATE (`mark-read/route.ts:87,112`, covered), cron DELETE (`cron/notifications/cleanup/route.ts:30`, no signal needed), and Payload REST `PATCH /api/notifications/:id` through the catch-all (no client uses it; acceptable). PW1 migration writer creates orders/blogs through `payload.create` (`pw1-json/writer.ts:335`), but only from CLI scripts, so `after()` throws and the fallback runs immediately. Same as today.
- Q2: `after()` works in route handlers, server actions, the Payload REST catch-all, webhooks and cron routes. Nested `after()` is supported in Next 15 (the plan's fallback is harmless). Scripts and vitest throw → fallback. The existing pattern at `easyparcel-save/route.ts:155-167` matches.
- Q5: the runner skips names already in `_db_setup_state` (`db-setup.js:5627-5660`). Removing `notifications.notify_fn`/`notify_trigger` (`:2477-2497`) plus adding a drop entry is safe. `check-migrations.js` only inspects collection field additions. No test references those names. Trigger is dropped before function (correct order). There is no LISTEN consumer anywhere in `src/`.
- Q7: middleware matcher excludes `api/` (`middleware.ts:317`). No CSP exists (next.config, vercel.json, middleware). `withAuth` (`auth.ts:139-155`) is the same cookie path as `/api/notifications`. The static `notifications/firebase-token/route.ts` wins over Payload `[...slug]`.
- Q8: TC-F16.45–.54 are free (max used: .44 in tests, .29 in the QA doc).
- Logout always does a full reload (`UserAvatarMenu.tsx:50`, `TenantAccessWatcher.tsx:180`, `EditorMenuDrawer.tsx:101`), so `inMemoryPersistence` satisfies AC-10.
- `serverExternalPackages` exists (`next.config.ts:23`). Adding `firebase-admin` there if needed is correct.
- The `setUnreadCount` BroadcastChannel (`notificationStore.ts:37-40`) keeps hidden tabs' badges in sync with D6.
- The seenIds cap is still safe without the `new Date()` watermark. Evicted ids are older than `newest−5s`, so they are never re-returned, provided `SEEN_IDS_MAX/2 ≥ 2×limit`.

## AC coverage gaps
- AC-01: C1 (signal waits on push) and C3 (first-snapshot drop).
- AC-04: C3.
- AC-06: M1.
- AC-07: I5 (needs a redeploy).
- AC-08: C2.
- AC-09: M3.
- AC-02, AC-03, AC-05, AC-10, AC-11: covered (AC-05 and AC-11 manual).

## Unresolved questions
- Is `VERCEL_TARGET_ENV` actually exposed at **runtime** with `vercel deploy --prebuilt` (project setting "Automatically expose System Environment Variables")? The plan already says to verify on staging.
- Is `prime-web-tm-production` on Blaze? (Gate for I6.)
- Do PW1 rules have root `.read: true`? (Phase 00 cascade risk; it blocks AC-05.)
- Confirm Payload 3.79 `create` runs `afterChange` inside the tx (I'm confident, but couldn't read node_modules). If it doesn't, C1 drops to latency-only, but signal-before-push still applies.
