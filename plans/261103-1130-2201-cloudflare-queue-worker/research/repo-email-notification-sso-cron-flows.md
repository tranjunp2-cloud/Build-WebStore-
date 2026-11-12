# Repo research: email / notification / SSO-step / cron background flows

> **Đính chính 2026-11-03 (đối chiếu `origin/staging`, review PR #2206):**
> - `vercel.json` có **10** cron (thêm `ai-receipts`, `ai-usage-sync`, `shop-automations`, `feedback-overdue-digest`); nội dung "6 cron" bên dưới là bản cũ.
> - `keep-alive` đã có guard `CRON_SECRET` + so sánh constant-time; mọi route cron là `GET`.
> - Logic huỷ đơn nay ở `src/lib/orders/cancel-order.ts`; tham chiếu `cancel/route.ts:…` bên dưới là cũ.
> - Xendit nuốt lỗi ở `xendit/route.ts:119-121`, Stripe ở `stripe/route.ts:94-98`.
> - Lỗi R5 (`charge.refunded` sau huỷ → hoàn kho lần 2) và `payment_failed` thiếu CAS **vẫn còn** (`webhooks/stripe/handlers/charge-refunded.ts:57`, `payment-failed.ts:78-87`).

Scope: replace `after()`/`runAfterResponse`/fire-and-forget + Vercel crons with Cloudflare Queue -> Worker -> HMAC POST to Vercel route, and CF Cron Triggers -> existing `/api/cron/*`. Read-only. AI internals + order/payment webhooks out of scope (listed only where they share a call path). All paths relative to worktree root; line numbers verified in this worktree.

## 0. Key findings (TL;DR)

1. Only ONE helper wraps `after()`: `src/lib/runtime/run-after-response.ts:15-23`. Falls back to immediate un-awaited `void run()` when `after()` throws (scripts/tests). Errors only `console.error` (line 17-18). No retry, no persistence. 9 non-test call sites (+ 6 raw `after(` sites).
2. Most emails are NOT even in `after()`: ~25 `payload.sendEmail(...).catch(...)` un-awaited calls after the response is built (checkout, refund, cancel, etc.). Not guaranteed to finish on serverless. Biggest reliability win for a queue.
3. SSO step: NO outbox row is written before the first attempt; row only appears after a failed attempt (`sso-api-client.ts:256-271`). Crash/timeout of the `after()` callback = event lost entirely. Fix = insert `pending` row first, then enqueue.
4. `/api/cron/notifications/cleanup` is NOT in `vercel.json` crons (`vercel.json:15-36`) -> never scheduled today. Its auth only enforced when `NODE_ENV==='production'` (`cleanup/route.ts:17`).
5. All cron routes already auth via `Authorization: Bearer ${CRON_SECRET}` -> a CF Cron Worker can call them unchanged (no route code change).
6. Push = `web-push` VAPID (`send-push.ts:30,87`), NOT FCM. Firebase is only an RTDB "doorbell" via REST (`signal-notification.ts:22-30`).
7. Vercel cannot bind a CF Queue. Producer from Vercel must call either CF REST API (API token) or a Worker `/enqueue` endpoint (HMAC). Decision needed (section 8).

## 1. Inventory

Legend: AFTER = `after()`/`runAfterResponse`; FF = un-awaited fire-and-forget (no after); AWAIT = awaited inline; HOOK = Payload hook; CRON.
Payload column = what the queue message needs (ids only; handler re-reads DB).

### 1a. `runAfterResponse` / `after()` call sites (non-test)

| # | file:line | mechanism | runs | payload (ids) | duration | lost on failure today | dedupe key proposal |
|---|---|---|---|---|---|---|---|
| A1 | `src/collections/Orders.ts:54` (hook `afterChange` create, skip if `stripeSessionId` :46) | HOOK+AFTER | `notifyTenantOwners` ORDER_NEW after `findByID` still-exists/!cancelled check (:57-62) | orderId | 0.5-3s (<=200 inserts + signal 3s + push 5s/sub) | merchant never gets in-app/push for COD/BT order | `ORDER_NEW:{orderNumber}` (ALREADY passed as dedupeKey :72) |
| A2 | `src/lib/payment/reconcile-order-paid-emails.ts:115` | AFTER (called from webhook/reconcile; order domain) | notifyTenantOwners ORDER_NEW | orderId | same | same | same `ORDER_NEW:{orderNumber}` (:122) |
| A3 | `src/app/api/webhooks/stripe/handlers/payment-failed.ts:97` | AFTER | notifyTenantOwners SYSTEM_ALERT | orderId | same | merchant not alerted | NONE today -> `PAYMENT_FAILED:{orderNumber}:{stripeEventId}` |
| A4 | `src/app/api/orders/[id]/upload-proof/route.ts:96` | AFTER | notifyTenantOwners ORDER_NEW "proof uploaded" | orderId | same | merchant not alerted | `PROOF_UPLOADED:{orderNumber}` (already :112) |
| A5 | `src/app/api/orders/[id]/upload-proof-direct/route.ts:107` | AFTER | same as A4 | orderId | same | same | same (already :123) |
| A6 | `src/collections/Blogs.ts:117` (hook, on status->published, skip `context.skipPublishNotify` :110) | HOOK+AFTER | notifyTenantOwners BLOG_PUBLISHED | blogId | same | no notification | NONE -> `BLOG_PUBLISHED:{blogId}` (publish is edge-triggered; re-publish after unpublish legit -> add `:{publishedAt/updatedAt}`) |
| A7 | `src/collections/Products.ts:113` (`lowStockHook`, threshold 10 downward cross :104-108) | HOOK+AFTER | notifyTenantOwners PRODUCT_LOW_STOCK | productId (+inventory) | same | no alert | NONE -> `LOW_STOCK:{productId}:{currInventory}:{previousDoc.updatedAt}` (or product version) |
| A8 | `src/collections/Notifications.ts:64` (hook create, skip `context.skipPush` :60) | HOOK+AFTER | `signalNotificationUsers([userId])` then `sendPushToUser` | notificationId | 3s + 5s/sub (<=20 subs) | manual (admin-panel) notification gets no realtime/push | `PUSH:{notificationId}` |
| A9 | `src/lib/notifications/create-broadcast.ts:91` | AFTER (in `finally`) | `signalNotificationBroadcast()` (single RTDB PUT) | none (scope=broadcast) | <=3s | clients fall back to focus-fetch/poll | coalesce key `BROADCAST_SIGNAL:{broadcastBatchId}`; idempotent anyway (doorbell) |
| A10 | `src/app/api/notifications/mark-read/route.ts:27` | AFTER | `signalNotificationUsers([userId])` | userId | <=3s | other devices' badge stale | none needed (idempotent doorbell); could drop dedupe |
| A11 | `src/app/sites/[slug]/order/[orderId]/confirm/page.tsx:131` (RSC page render, raw `after`) | AFTER | sign token, set `paymentReminderSentAt` FIRST (:150ish), then `sendEmail` order-waiting (:184) | orderId | 1-3s | **flag set before send -> if send fails, reminder lost permanently** (guard at :122-128) | `ORDER-WAITING:{orderId}` (flag already acts as guard; move flag set after send or into job_executions) |
| A12 | `src/app/api/tenant/[id]/easyparcel-save/route.ts:164` | raw AFTER (+immediate fallback :166) | `notifyStepComplete(payload,user.id,2,{login 20s,patch 25s})` | userId, step=2 | up to ~45s | row persisted `pending` only if attempt fails fast (:269); function kill = nothing persisted | `SSO:{userId}:{step}` (matches unique idx) |
| A13 | `src/app/api/sites/[siteId]/shipping-config/route.ts:143` | raw AFTER (+`void` fallback) | `notifyStepComplete(...,2)` default 30s timeouts | userId, 2 | <=60s | same | same |
| A14 | `src/collections/Products.ts:81-85` (afterChange create with `req.user`) | **FF** (dynamic import .then, NOT in after) | `notifyStepComplete(...,3)` | userId, 3 | <=60s | killed on response return = lost, no row | same |
| A15 AI (out of scope, listed) | `src/app/api/ai/apply-template/route.ts:671`; `src/lib/ai/generate-site-service.ts:2358, 2513` | raw AFTER | `notifyStepComplete(...,1)` | userId, 1 | <=60s | same | same |
| A16 AI (out of scope, listed) | `generate-site-service.ts:2175,2228,2312,2491`; `generate-site/route.ts:61` | raw AFTER | blog seed / imglib seed / slug sync / scheduleBackground | n/a | n/a | n/a | not touched |
| A17 (note) | `src/lib/ai/seo-queue.ts:10` via `Products.ts:98`, `Pages.ts` | FF | `queueSEOAutoGeneration` -> AI meta; in-process, own `seo-meta-jobs` table | | | AI domain; unmanaged background | out of scope; flag |

### 1b. Email sends (transport = Payload `sendEmail` -> nodemailer SMTP/SES, `src/payload.config.ts:99-112`)

Wrapper `src/lib/email/send.ts:21-50`: optional tenant `enabled` check (:25-31, only if templateType+recipient+tenantId passed), 3 attempts w/ 0.5s/1s backoff (:34-45), **swallows error returning false** (:46-49). Most call sites bypass the wrapper and call `payload.sendEmail` directly + do their own `getTemplateConfig(...).enabled===false` check before rendering.

| group | file:line | mechanism | immediate? | lost on failure | dedupe key proposal |
|---|---|---|---|---|---|
| OTP verification | `src/collections/Users.ts:966` | AWAIT, `emailSent` returned to UI | **YES** (user waits for code) | UI shows failure | none (user can resend) - keep sync |
| Staff invite / resend | `Users.ts:451`, `:779` (guard `MAIL_HOST` unset :440ish,:775) | AWAIT, returns `emailSent` | YES (UI feedback) | UI shows failure | keep sync |
| Forgot password | `Users.ts:159-212` Payload `forgotPassword.generateEmailHTML` | Payload-internal, awaited by op | YES | request errors | keep sync |
| Send-test template | `src/app/api/email-templates/send-test/route.ts:83` | AWAIT | YES (502 on fail) | | keep sync |
| Resend upload link | `src/app/api/orders/resend-upload-link/route.ts:110` | AWAIT | YES-ish (explicit user action) | | keep sync or queue w/ fallback |
| Welcome | `Users.ts:123` (hook `sendWelcomeEmailHook` :111) | FF via `sendEmail` | no | lost | `WELCOME:{userId}` |
| Contact form -> owner | `src/app/api/contact-submit/route.ts:150` | FF | no | lost (submission row remains) | `CONTACT:{submissionId}` |
| Password changed | `src/app/api/users/me/password/route.ts:91` | FF | no (security notice; small delay OK) | lost | `PWCHG:{userId}:{updatedAt}` |
| COD / BT / Stripe / Xendit order confirm (buyer + each owner) | `orders/checkout/route.ts:648,657,719,728`; `orders/stripe-checkout/route.ts:595,618`; `orders/xendit-checkout/route.ts:225,247` | FF | no | lost; owners loop `forEach` | `ORDER-CONFIRM:{orderId}:buyer` / `:seller:{email}` |
| Order status (confirmed/completed/cancelled) | `orders/[id]/route.ts:187,217,248`; `orders/[id]/cancel/route.ts:475,505`; `approve-payment/route.ts:119,176`; `reject-payment/route.ts:91`; `refund/route.ts:145`; `webhooks/stripe/handlers/charge-refunded.ts:141`; `payment-failed.ts:160 (+sendPaymentRetryEmail non-awaited :108)` | FF | no | lost | `ORDER-{event}:{orderId}:{statusVersion}` e.g. `ORDER-CANCELLED:{orderId}` |
| Paid confirm | `src/lib/payment/reconcile-order-paid-emails.ts:104` via `sendEmail` (awaited inside, try/catch :109-112) | AWAIT in webhook/reconcile | no | webhook agent's domain | `ORDER-PAID:{orderId}` |
| Order-expired | `src/lib/jobs/payment-expiry.ts:117-122` | FF inside cron loop (after atomic UPDATE) | no | lost; cron won't retry (row already cancelled) | `ORDER-EXPIRED:{orderId}` |
| Order-waiting | confirm page (A11) | AFTER | no | see A11 | |

Template rendering: pure TS functions in `src/lib/email/templates/*.ts` (index.ts, 20+ templates) taking data + optional tenant CMS config (`get-template-config.ts`, `template-registry.ts`, `merge-template-config.ts`). Rendered on Vercel at call site today. Rendering needs DB (tenant CMS config, order, site locale) -> must stay on Vercel; Worker must never render. Message options: (a) `email.send {to,subject,html}` generic (zero refactor of render code; html size must stay < CF Queue 128 KB message limit - unverified for these templates), or (b) typed `email.order {event, orderId}` (re-renders in handler; larger refactor because render inputs are built inline in each route, e.g. checkout route :600-650). Recommend (a) phase 1, (b) later per-template.

Volume: not derivable from code. Only hints: pool sized for 200 concurrent users beta event (`payload.config.ts:190-195`). Per order: 1 buyer + N owner emails (N = `getTenantOwnerEmails`, `src/lib/email/get-tenant-owner-emails.ts`) + status mails; notifications <=200 recipients/event (cap `notify-tenant-owners.ts:46`). Ask product/ops for orders/day. SES default rate limits apply (check account quota) - queue gives natural `max_concurrency` throttle.

### 1c. Crons (see section 3) and 1d. SSO (section 6).

## 2. Transactions and out-of-request behavior

- DB: `@payloadcms/db-postgres` with default transactions (no `transactionOptions:false`, `payload.config.ts:184-201`). Payload runs `afterChange` hooks INSIDE the op's transaction; commit happens after hooks. Repo already knows: `notify-tenant-owners.ts:100-107` comment "Notifications afterChange hook runs INSIDE the create transaction ... pool max 25 -> deadlock"; `Orders.ts:46-47` "Do not capture `req` ... outlives the request/transaction"; `run-after-response.ts:3-12` caveat.
- Hooks that would enqueue pre-commit (race: message delivered before row visible): `Orders.ts:54` (afterChange), `Blogs.ts:117`, `Products.ts:83` (step3) + `:113` (lowStock), `Notifications.ts:64`, `Users.ts:111` (welcome; Users create often via REST/SSO provisioning inside txn). Today `after()` defers until response sent, which on REST/Local API-with-own-txn is normally post-commit; a direct queue `send()` inside the hook is NOT.
- Mitigations (pick): (1) enqueue with `delaySeconds` 3-10 (CF Queues supports delay) + handler treats "doc not found" as retryable (A1 already re-reads and bails if missing, `Orders.ts:57-62`; checkout deletes order on discount/stock failure so handler MUST re-verify existence); (2) keep `runAfterResponse` as the scheduler and enqueue INSIDE its callback (post-response = post-commit in practice) - minimal change, recommended; (3) transactional outbox row (see section 6) inserted with `req` so it commits atomically, queue only a trigger.
- `runAfterResponse` outside request scope (scripts/tests): `after()` throws -> `catch` -> `void run()` immediately (`run-after-response.ts:19-21`): task starts mid-hook, mid-transaction. Bulk scripts must pass `context.skipPush` (comment :9-11; `Notifications.ts:60`). New `enqueueJob()` helper must replicate: if no request scope or no CF env configured -> either run inline (current behavior, tests keep passing) or no-op; never throw into hooks. Pw1 migration runtime forbids email entirely (`src/lib/migration/pw1-json/runtime.ts:174,189`) - enqueue helper must not bypass that (it routes through `payload.sendEmail`, so OK if handler uses it).
- Middleware excludes `/api/` (`src/middleware.ts:312-318`) -> Worker POST to a new `/api/...` route unaffected by host routing.
- Vercel `maxDuration`: all `src/app/api/**` = 120s (`vercel.json:5-8`); cron routes override 60 (`payment-expiry/route.ts:8`, `process-sso-steps/route.ts:8`, etc.). Handler timeout budget <=60-120s; CF Worker `fetch` wall time to origin fine, but Queue consumer batch timeout (default 30s CPU time is separate from wall) - set `max_batch_size` small / 1 for SSO.

## 3. Crons

`vercel.json:15-36` crons. Auth in every route = `Bearer CRON_SECRET` (env documented in `.env.*.example`: `.env.production.example:175`, `.env.staging.example:184`). Compare is plain `!==` (not constant-time) - acceptable but note. All exported as `GET`.

| cron | schedule | route (auth line) | purpose | concurrency / double-call safe? | cadence need / jitter OK? | keep-alive value | queue instead? |
|---|---|---|---|---|---|---|---|
| keep-alive | `*/4 * * * *` | `keep-alive/route.ts:17` (no `!cronSecret` guard: if unset, header `Bearer undefined` would pass - edge case) | `SELECT 1` so Neon doesn't suspend (comment :10, "free tier suspends after 5min idle") | trivially safe | 4 min vs 5 min suspend = 1 min slack. CF cron jitter (typically seconds, can be longer) is tight; real traffic also keeps DB warm. Suggest `*/3` on CF | THE purpose (keep-alive) | no, stay cron |
| payment-expiry | `*/15` | `payment-expiry/route.ts:12-14` | cancel stale unpaid orders, restock, release discount, send order-expired mail; piggybacks `discountAutoInactiveJob` (:25) | SAFE: atomic `UPDATE ... WHERE status/payment_status ... RETURNING` guard, loser `continue`s (`jobs/payment-expiry.ts:40-47`); discount sweep idempotent (`discount-auto-inactive.ts:35-44`) | 24h expiry; 15 min +-minutes fine | none | stays cron (order domain); email inside should become enqueue |
| reconcile-orders | `*/10` | `reconcile-orders/route.ts:11-14` | heal Stripe orders stuck `pending` >15 min via `reconcileOrderPaid` | uses idempotent `reconcileOrderPaid` (`jobs/reconcile-orders.ts:5,10` comment); 50s deadline loop (:19), limit 50 | fine | none | stays cron (order domain, other agent) |
| process-sso-steps | `*/1` | `process-sso-steps/route.ts:30-33` | retry `sso_step_events` pending/stuck rows | SAFE: `FOR UPDATE SKIP LOCKED` claim (:43-64), reclaims `processing` >5 min (:49), finalize guarded `WHERE status='processing'` (:97-103,:111-118), MAX_RETRIES 5 (:10), backoff `LEAST(retry_count,4)` min (:48), BATCH 2, concurrency 2, deadline 50s (:11-13) | 1/min polling; jitter fine. Becomes redundant as primary path once queue exists -> relax to sweeper (e.g. */5) | none | YES as queue msg (primary) + slow cron sweeper (section 6) |
| process-generation-recovery | `*/1` | `process-generation-recovery/route.ts:19-21` | AI recovery worker | lease token + orphan reconcile (:11-40) | out of scope (user: AI needs no job) | none | skip; just keep calling it from CF cron or leave on Vercel |
| reconcile-qa-targeted-smoke | `*/10` | `reconcile-qa-targeted-smoke/route.ts:18-20` | block/release stale QA smoke dispatches (GitHub) | per-row transaction + status re-check (:54) ; reads `limit:100` | fine | none | stays cron |
| notifications/cleanup | **not scheduled** | `notifications/cleanup/route.ts:17` (auth only when `NODE_ENV==='production'`) | `DELETE FROM notifications WHERE expires_at<NOW()` (:30); rows expire 30d (`notify-tenant-owners.ts:112`, `create-broadcast.ts:46-48`) | idempotent | daily is plenty | none | cron daily; fix: add schedule (human decision) |

Notes:
- `src/lib/jobs/payment-expiry.ts` schedule/auth: `*/15`, Bearer CRON_SECRET (above).
- Vercel Cron only fires on PRODUCTION deployments per Vercel docs (not verified in repo). Staging deploys use `--target=staging` (`.claude/rules/vercel-deploy.md`), so staging probably has NO cron today; CF cron per-env (staging worker -> staging URL) would add staging coverage. Confirm with team.
- Moving to CF: remove entries from `vercel.json` `crons` (edit allowed; only `git.deploymentEnabled:false` is frozen, `CLAUDE.md` CRITICAL overrides). Leaving both = double-calls (safe for all routes above, wasteful).
- Single CF cron expression can fan out multiple routes inside `scheduled(event)` by `event.cron` string.

## 4. Email specifics (summary)

- Transport: SMTP (587 default, 465 secure) via nodemailer adapter; SES creds in `MAIL_HOST/PORT/USERNAME/PASSWORD/FROM_*` (`payload.config.ts:99-112`; `.claude/rules/env-vars.md` table). If `MAIL_HOST` unset -> `streamTransport` logs only (`:113-122`) - silent success in dev; staff invite explicitly detects this (`Users.ts:~440`).
- Workers cannot practically do nodemailer SMTP (raw TCP/587 STARTTLS, bundle size) -> send MUST stay on Vercel handler. Confirms the HMAC-POST design.
- Rendering: on Vercel in handler (needs DB-backed tenant template config `getTemplateConfig`). Queue payload = ids or pre-rendered html.
- At-least-once delivery + SMTP non-idempotent: duplicate email possible if ack lost post-send. Use `job_executions` insert-before-send keyed by dedupe key (section 7) to make most sends effectively-once; accept rare dupes for non-critical.
- `sendEmail` wrapper returns false instead of throwing (`send.ts:46-49`) -> handler must call `payload.sendEmail` directly (or new throwing variant) so Queue retry works; wrapper's own 3x retry would multiply with queue retries - use queue retries only.
- Must stay immediate/sync: OTP, staff invite/resend, forgot-password, send-test, resend-upload-link (table 1b).

## 5. Notification fan-out and push

- Recipients per event: all active tenant members with role in ROLES_BY_TYPE (`notify-tenant-owners.ts:9-14`), hard cap 200 (`:46`, warns if more `:57-59`). Typically a handful. One `payload.create` per recipient in `Promise.allSettled` (`:97-117`, each its own txn, pool max 25), then one RTDB PATCH for all (`:127`), then `sendPushToUser` per created recipient concurrently (`:129-145`).
- Push provider: `web-push` VAPID (`send-push.ts:3-5,55,87`), up to 20 subscriptions per user+tenant (`:62`), 5s timeout each (`:87`), 404/410 deactivates subscription (`:93-100`). Dynamic import; no-op when VAPID env unset (`:28`). Never throws (swallow) -> for queue, handler should surface failures only if wanted; push is best-effort, at-most-once acceptable.
- Realtime doorbell: Firebase RTDB REST PATCH/PUT using service-account token (`signal-notification.ts:22-31`, `firebase-admin-app.ts:12-50`), 3s timeout (`:4`), env-gated by `VERCEL_TARGET_ENV` (`notification-signal-env.ts:11-18`; **fail-closed if missing on Vercel** - handler runs on Vercel so still set; do NOT move signaling into the Worker without replicating this).
- Broadcast: `src/app/api/admin/broadcasts/route.ts:98` (super-admin) -> `createBroadcastNotifications` raw `INSERT...SELECT` in batches of 500, cap 10,000 (`create-broadcast.ts:20-21,57-82`), awaited in the request; NO dedupe_key on these rows so re-running the insert duplicates -> do not make the INSERT a retryable queue job unless adding a dedupe/batch key. Only the signal (A9) is a safe queue message. If broadcasts later grow >10k, chunked queue messages (`{broadcastId, offset}`) with `ON CONFLICT` key needed.
- Dedupe exists at DB level: partial UNIQUE `(tenant_id,user_id,dedupe_key)` (`scripts/db-setup.js:2713-2720`) + app pre-check (`notify-tenant-owners.ts:73-92`). So redelivered ORDER_NEW/PROOF_UPLOADED jobs are safe (already-notified recipients skipped, incl. their push). BLOG/LOW_STOCK/PAYMENT_FAILED lack keys (A3,A6,A7) -> add before enabling queue retries, else redelivery duplicates in-app rows.

## 6. SSO outbox

Recommendation: KEEP `sso_step_events` as source of truth; queue = trigger. Evidence:
- Table already has everything an outbox needs: status machine pending/processing/completed/failed, retry_count, last_error, unique `(user_id,step)` (`scripts/db-setup.js:5414-5432, 5499-5501`).
- Idempotency already via unique idx + "skip if completed" pre-check (`sso-api-client.ts:233-254`) and finalize guard (`process-sso-steps/route.ts:97-103`).
- Gap: row written only AFTER failure (`sso-api-client.ts:269`) and after success (:260); `persistStepEvent` does `ON CONFLICT DO UPDATE ... retry_count=0` unconditionally (:124-129), which would also overwrite a `completed` row with `pending` if reached (protected only by the pre-check).
- Gap: step 3 (Products hook) is un-awaited FF, step 2 `after()`; a killed function persists nothing.
- Also SSO has a 30s default login + 30s patch (`sso-api-client.ts:7,155-156`); cron overrides 20s/25s with 50s deadline. Queue handler can use same options via `sendSSOStepNotification(payload,userId,step,{loginTimeoutMs,patchTimeoutMs,deadlineMs})` (:137-146).
- Proposed flow: call site -> `INSERT ... ON CONFLICT (user_id,step) DO NOTHING` row `pending` (new helper, no-overwrite of completed) -> enqueue `sso.step {eventId,userId,step}` -> handler claims that single id (reuse claim SQL from cron route :43-64 narrowed by `id`) -> `sendSSOStepNotification` -> finalize `completed` or retry bump (:96-121 logic extracted to a lib fn `processSsoStepEvent(payload,eventId)`) -> on error return non-2xx so queue retries OR rely on row backoff. Keep `process-sso-steps` cron at lower frequency (*/5) as sweeper that finds `pending`/stale `processing` and re-enqueues (or processes directly). Avoid double retry layers: either queue retries (and row retry_count mirrors attempts) or cron backoff, not both with different MAX (5).
- User/credential: handler reads `users.keyString` (encrypted, `access.read=false`, needs `overrideAccess:true`, `sso-api-client.ts:164-171`) and decrypts with `SSO_ENCRYPTION_KEY` (:9-17) - ONLY on Vercel; never send password/keyString in a queue message.
- `failed` rows (retry>=5) never revisited automatically (`cron :51`); needs ops path.

## 7. Proposed handler registry and call-site changes

HTTP: single route `POST /api/internal/jobs` (new) - verify HMAC (timestamp+body, `crypto.timingSafeEqual`, pattern exists `src/app/api/webhooks/vercel/route.ts:8-13`, `webhooks/xendit/route.ts`), reject skew >5 min, then `registry[type](payload, msg)`. Body: `{id, type, dedupeKey, attempt, data}`. Response 2xx = ack, 4xx = permanent (no retry/DLQ), 5xx = retry. Handler wrapper: `job_executions` claim (below) -> run -> mark.

| type | handler calls (existing fn) | data | notes |
|---|---|---|---|
| `notify.tenant` | `notifyTenantOwners(payload, tenantId, {type,title,message,actionUrl,metadata,roles?,dedupeKey})` `src/lib/notifications/notify-tenant-owners.ts:19` | all fields (small JSON) | covers A1-A7(B,L,F,proof). For A1/A2 prefix guard: `findByID orders` exists && !cancelled (move check from `Orders.ts:57-62` into handler via `guard:'order-exists',orderId`) |
| `notify.push` | `signalNotificationUsers([userId])` `signal-notification.ts:44` + `sendPushToUser(userId,tenantId,{id,title,body,tag,actionUrl},payload)` `send-push.ts:22` | notificationId -> load doc | A8 |
| `notify.signal` | `signalNotificationUsers(ids)` / `signalNotificationBroadcast()` `signal-notification.ts:44,52` | `{scope:'users',ids}` or `{scope:'broadcast'}` | A9, A10; consider dropping A10 to direct (cheap) |
| `sso.step` | new `processSsoStepEvent(payload,eventId)` wrapping `sendSSOStepNotification` (`sso-api-client.ts:137`) + finalize SQL from cron route :96-121 | eventId/userId/step | A12-A15 |
| `email.send` | `payload.sendEmail({to,subject,html})` (throwing) | to,subject,html,templateType?,tenantId? | all FF/AFTER emails; keep tenant-disabled check at enqueue site (cheaper) |
| `email.order-waiting` | existing block from `confirm/page.tsx:131-210` moved to lib | orderId | A11; move reminder flag set after success |
| cron routes | NOT in registry; CF cron `scheduled()` does `fetch(BASE+path,{headers:{Authorization:`Bearer ${CRON_SECRET}`}})` | | zero route changes |

Minimal call-site changes (describe only):
- Add `src/lib/jobs/enqueue.ts` `enqueueJob(type,data,{dedupeKey,delaySeconds})`: POST to CF (producer) with timeout 2s, never throws; if CF env missing or non-request scope -> fall back to calling the registry handler inline via `runAfterResponse` (preserves local dev/tests, mirrors `run-after-response.ts:19-21`).
- A1-A10: replace body of the `runAfterResponse(label, async()=>{...})` callback with `enqueueJob(...)` (keep wrapper so enqueue happens post-response/post-commit; hook signatures unchanged).
- A11: replace `after(async()=>...)` body with enqueue; keep the cheap `shouldSendReminder` check synchronous.
- A12/A13/A14/A15: replace `after(_notifyStep2)` with `ensureStepEvent(...)`+`enqueueJob('sso.step')`; Products hook: drop the dynamic-import FF.
- Email FF sites (~25): replace `payload.sendEmail(...).catch` with `enqueueJob('email.send',...)`; do per-file, low risk; leave OTP/invite/forgot/send-test/resend-upload-link sync.
- Crons: no route change except add auth hardening optional (`keep-alive` `!cronSecret` guard, cleanup auth unconditional).

`job_executions` table (conventions from `scripts/db-setup.js`): add entries to `MIGRATIONS` array (`{name:'job_executions.create_table', sql:`CREATE TABLE IF NOT EXISTS ...`}`), idempotent, re-run every deploy (`CLAUDE.md` Schema rules; memory note: migrations re-run each deploy), NEVER DROP, hard-gated by `scripts/check-migrations.js` (verify it accepts non-collection raw tables - `sso_step_events`/`generation_recovery_jobs` precedent at db-setup.js:4001,5414 are raw tables). Suggested columns modeled on `generation_recovery_jobs` (`:4001-4021`): `id serial PK`, `dedupe_key varchar NOT NULL`, `type varchar`, `status varchar CHECK in (processing,done,failed)`, `attempt_count int`, `lease_expires_at timestamptz`, `last_error text`, `result jsonb`, `created_at/updated_at timestamptz`; `CREATE UNIQUE INDEX IF NOT EXISTS job_executions_dedupe_key_uniq (type, dedupe_key)`; claim with `INSERT ... ON CONFLICT DO NOTHING RETURNING` (+ lease reclaim like SSO :49). Put DDL after dependent tables; array-table naming rules (varchar id, `_parent_id`) do not apply (not a Payload array).

Env constraints (`.claude/rules/env-vars.md`, `vercel-deploy.md`): any new var (e.g. `JOBS_HMAC_SECRET`, `CF_QUEUE_*`/`CF_API_TOKEN`) -> Vercel Dashboard (production + custom `staging` env explicitly) + `.env.staging.example` + `.env.production.example` (+ `.env.example`); `scripts/check-env-vars.js` blocks PR otherwise. Worker secrets (CRON_SECRET copy, HMAC secret) live in Cloudflare (wrangler secret) = a second copy, outside "Vercel Dashboard = source of truth" -> document. Worker deploy needs its own CI job + `CLOUDFLARE_API_TOKEN` as GH secret (CI tooling category allowed). Do not touch `git.deploymentEnabled` or the 3-stage `--target=staging` flow.

## 8. Risks and human decisions

Risks
1. Pre-commit enqueue race (section 2) - mitigate via enqueue inside `runAfterResponse` callback + `delaySeconds` + handler existence re-check. Orders can be deleted on checkout rollback (`Orders.ts:58-60`).
2. Duplicate side effects under at-least-once: email (SMTP), in-app rows lacking dedupe (A3,A6,A7), push. Need `job_executions` + new dedupe keys.
3. Double retry layers (Queue retries x `sendEmail` 3 attempts x SSO MAX_RETRIES 5) -> amplification; choose one.
4. New external dependency on enqueue path: if CF unreachable, notifications/emails lost -> need inline fallback or outbox row. Today's FF emails have no durability at all, so net still better.
5. Secrets sprawl: CRON_SECRET + HMAC secret in CF; rotation procedure.
6. Cron cadence: keep-alive 4 min vs Neon 5 min suspend (`keep-alive/route.ts:10`) tight under CF jitter.
7. `notifications/cleanup` unscheduled (table growth) and conditional auth; `keep-alive` missing `!cronSecret` guard.
8. Handler cold start on Vercel + 120s max; SSO up to 45-60s calls -> use Queue batch size 1 for sso.
9. Order-waiting flag set before send loses reminder on failure (A11) - fix during migration.
10. Staging cron coverage unclear (Vercel crons production-only) - behavior change when CF crons target staging (jobs start running there).

Human decisions
- Producer path: CF REST API from Vercel (token) vs Worker `/enqueue` HTTP endpoint with HMAC (extra hop)? Latency budget 2s?
- Email message shape: pre-rendered html (size limit) vs ids (refactor)? Which emails stay sync (propose OTP/invite/forgot/send-test/resend-upload-link)?
- Scope: include order-domain emails/notifications in phase 1 or only notification+SSO+welcome/contact/password?
- SSO: confirm outbox-first design and `*/5` sweeper; who handles `failed` rows?
- Schedule `notifications/cleanup` (daily)? Fix its auth?
- Cron cadences on CF; run CF crons on staging?
- Remove Vercel crons at cutover (one-by-one) vs dual-run?
- Retry policy/DLQ: max_retries, backoff, DLQ handling/alerts (Lark?).
- Add dedupe keys A3/A6/A7 (changes notification semantics slightly).

## Unresolved questions

- Volume (emails/day, notifications/day) - no data in repo; need ops numbers/SES quota.
- Does `scripts/check-migrations.js` accept raw non-collection tables like `job_executions`? (precedent suggests yes; not opened.)
- Do Vercel Crons actually run on the `staging` custom environment? (not verifiable from repo.)
- Max html size of rendered templates vs CF Queue 128 KB limit (not measured).
- Is Payload `transactionOptions` default really enabled with this adapter version for REST/admin requests (assumed from code comments, not from node_modules).
- Exact line refs for `Users.ts:440/775` MAIL_HOST guards approximate (+-5).
- Who owns order-domain emails/notification call sites (A1-A5, order status emails): this agent or the webhook agent?
- Whether AI-step SSO notifies (A15) should be moved in this change or left (user said AI needs no job, but they call `notifyStepComplete`).
