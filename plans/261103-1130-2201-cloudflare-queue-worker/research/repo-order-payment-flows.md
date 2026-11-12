# Order / payment status flows vs. a CF Queue insertion (GH-2201)

> **Đính chính 2026-11-03 (đối chiếu `origin/staging`, review PR #2206):**
> - `vercel.json` có **10** cron (thêm `ai-receipts`, `ai-usage-sync`, `shop-automations`, `feedback-overdue-digest`); nội dung "6 cron" bên dưới là bản cũ.
> - `keep-alive` đã có guard `CRON_SECRET` + so sánh constant-time; mọi route cron là `GET`.
> - Logic huỷ đơn nay ở `src/lib/orders/cancel-order.ts`; tham chiếu `cancel/route.ts:…` bên dưới là cũ.
> - Xendit nuốt lỗi ở `xendit/route.ts:119-121`, Stripe ở `stripe/route.ts:94-98`.
> - Lỗi R5 (`charge.refunded` sau huỷ → hoàn kho lần 2) và `payment_failed` thiếu CAS **vẫn còn** (`webhooks/stripe/handlers/charge-refunded.ts:57`, `payment-failed.ts:78-87`).

Read-only analysis. Paths relative to worktree root. Durations = my estimates (no profiling), not measured.
Convention: `file:line`. "CAS" = `UPDATE ... WHERE status=<expected> RETURNING id`.

## 0. TL;DR

- The core is already CAS-guarded and shared: `reconcileOrderPaid()` (`src/lib/payment/reconcile-order-paid.ts:46-183`) is called by Stripe webhook, Xendit webhook, `payment-status` poll and `reconcile-orders` cron. Paid path is safe to run N times concurrently.
- NOT safe/idempotent today: refund-from-webhook (restock + email), payment_failed email, stripe cancel->charge.refunded double effect, EP out-of-order regress, reject-payment, bulk-update (see §3, §6).
- No `webhook_events`/dedupe table exists anywhere (`grep` of `scripts/db-setup.js` for webhook/event_id/stripe_event = 0 hits). Provider event id is never stored. All idempotency = row-state CAS.
- Both Stripe and Xendit handlers swallow errors and return 200 (`stripe/route.ts:94-99`, `xendit/route.ts:139-145`) => provider retry is NEVER triggered; a lost handler run = lost event (self-healed only for "paid" by cron). A queue with retries is a strict improvement ONLY IF handlers are made to throw (see §6 R1).
- Recommendation: **(a) verify-on-Vercel -> persist event row -> ack 200 -> enqueue (id only) -> Worker -> HMAC POST `/api/internal/webhook-jobs/:id` -> existing handler**, only for the slow/side-effect-heavy events (Stripe checkout-completed / charge-refunded / payment-failed, Xendit payment-updated). Leave EP tracking inline initially (already fast, row-locked, 500=retry). Leave crons, admin routes, bulk-update, upload-proof, poll/stream INLINE (synchronous UX contracts, §7).

## 1. Per-flow behaviour

### 1.1 Stripe `checkout.session.completed` -> `handleCheckoutCompleted`
Entry `src/app/api/webhooks/stripe/route.ts:23-100` -> `handlers/checkout-completed.ts:14-78`.
Steps:
1. Raw body read (`route.ts:27`), header `stripe-signature` required (:32), `JSON.parse` peek for `account` => Connect secret (:37-44), `verifyStripeWebhook` = `stripe.webhooks.constructEvent(raw, sig, secret)` (`src/lib/payment/stripe.ts:214-234`). Unknown types ACK 200 (`route.ts:51-55`).
2. Guards: connectedAccountId required (:21-24); `client_reference_id` numeric (:26-35); order `payload.find` (:38-44) + `verifyConnectedAccountOwnership` IDOR (:55-58); `payment_status==='paid'` capture gate (:63-66; async method => waits for later event; NOTE `checkout.session.async_payment_succeeded` is NOT in `typeMap` `stripe.ts:245-252` so delayed methods rely on cron).
3. `reconcileOrderPaid(source:'webhook')`:
   - CAS `UPDATE orders SET status='new', payment_status='paid' WHERE id AND status='pending' RETURNING id` (`reconcile-order-paid.ts:50-54`). 0 rows => `already_processed` (:55-88), nothing else runs.
   - Winner: `findByID depth1` (:90); discount legacy backstop `recordDiscountRedemption` (:106-124, idempotent via unique order_id row per comment :98-105); buyer email + seller email + `ORDER_NEW` notification via `sendOrderPaidEmailsAndNotify` (:129-139; `reconcile-order-paid-emails.ts:54-125`; notification deduped by `dedupeKey ORDER_NEW:<orderNumber>` :123, runs in `runAfterResponse` :115); LAST: `stripe.paymentIntents.retrieve(expand payment_method)` (`resolveActualPaymentMethod` :193-222) + `payload.update` display metadata (:144-163). Payload `afterChange` hooks fire on that update (`Orders.ts:44-72` only acts on create; `syncCustomerSnapshot`, `revalidateBadgeCounts`).
4. Stock: NOT decremented here (comment :33-34). Decremented at session creation (`stripe-checkout/route.ts:428-461`). So webhook is stock-neutral.
External calls: 1 Stripe GET (PI expand), SES x2 (buyer+seller) awaited inline (:104), FCM/in-app via notifyTenantOwners (after response). Approx 1.5-5 s total (SES + Stripe + several PG round trips). Vercel `maxDuration` 120 for `src/app/api/**` (`vercel.json`).
Idempotency: CAS on status. Same event twice => 2nd is no-op. Out-of-order: paid arrives after order became `cancelled`/`refunded`/`payment_failed` => CAS misses (status != pending) => ignored, **money was captured but order stays cancelled** (no auto-refund/alert; only log :86). Paid after `payment-expiry` cancel = same hole (expiry may cancel `payment_status IN awaiting/failed`, `payment-expiry.ts:34-44`; note for Stripe orders `payment_status` at creation - see Unresolved Q3).
Failure: handler error caught `checkout-completed.ts:75-77` and route `:94-99` -> 200 -> Stripe never retries; cron `reconcile-orders` (every 10 min, `vercel.json`) heals only orders >15 min old (`reconcile-orders.ts:23,31`).

### 1.2 Stripe `payment_intent.payment_failed` -> `handlePaymentFailed` (`handlers/payment-failed.ts:30-112`)
- Lookup by `stripePaymentIntentId` or `metadata.orderId` (:45-63), IDOR check (:74).
- Skip list for late events (:77-81): `new, confirmed, ready_to_ship, shipped, completed, refunded, payment_failed, cancelled`. So only `pending` (and legacy `paid/processing`) proceeds.
- **No CAS**: plain read-then-`payload.update` status=payment_failed/paymentStatus=failed (:83-91). Two concurrent deliveries can both pass the skip check => 2 retry emails + 2 notifications. Race vs checkout-completed: `payment_failed` can fire for a first card attempt and the buyer retries and pays in same Checkout Session -> a late/queued payment_failed that executes AFTER reconcile CAS is skipped (status 'new' in list) OK; but if payment_failed executes BEFORE paid and sets `payment_failed`, then reconcile CAS (`status='pending'`) MISSES => **paid order stuck in payment_failed**. Queue delay/reorder makes this more likely (Stripe fires failed attempts before eventual success in the same session).
- Side effects: `runAfterResponse` notify SYSTEM_ALERT (:97-106, no dedupeKey), fire-and-forget magic-link retry email (:109-111, 164 `sendEmail`). Both NOT idempotent.
~0.5-2 s.

### 1.3 Stripe `charge.refunded` -> `handleChargeRefunded` (`handlers/charge-refunded.ts:16-143`)
- Find order by PI id (:35-40), IDOR (:51).
- CAS `UPDATE orders SET status='refunded', payment_status='refunded' WHERE id AND status != 'refunded' RETURNING id` (:55-63). Comment :53-54 states purpose: dedupe under at-least-once.
- Winner: `releaseDiscountRedemption` (:74; idempotent keyed by order_id); **restock every item** (:78-99; `restockItem` is a plain `inventory + qty` increment, NOT idempotent per order — `orders/lib/stock-utils.ts:105-200`); buyer refund email (:101-142, fire and forget `sendEmail`).
- Interactions (REAL BUGS today, independent of queue):
  - ECH-initiated refund (`orders/[id]/refund/route.ts:329-347`): sets status='refunded' BEFORE calling Stripe so the webhook CAS misses and skips duplicate email/restock; route itself releases + restocks (:361-365) and sends its own email. OK. But rollback path (:380-394) documented race.
  - ECH **cancel of a paid Stripe order** (`cancel/route.ts:247-252`) sets status='cancelled', payment_status='refunded', restocks (:386-401), then `stripe.refunds.create` (:285) => Stripe fires `charge.refunded` => webhook CAS `status != 'refunded'` is TRUE (status is 'cancelled') => flips cancelled->refunded, **restocks a 2nd time** (phantom stock), sends refund email (intended per `cancel/route.ts:421`). Double restock = confirmed by reading; not covered by any guard.
  - Partial refunds: `charge.refunded` fires for partial too; handler marks full 'refunded' and restocks everything (no `amount_refunded` vs total check; email uses `amount_refunded/100` :132).
- Out-of-order: refund event for an order still `pending`/never paid -> CAS wins -> restocks stock that checkout already decremented (correct) but marks a never-paid order refunded.
~1-3 s (N items x 2-3 SQL each + SES).

### 1.4 Xendit payment/invoice events -> `handlePaymentEvent` / `handleInvoiceEvent` (`xendit/handlers/payment-updated.ts`)
- Route `xendit/route.ts:95-146`: JSON parsed first (:99), token = `X-CALLBACK-TOKEN` (:109). **Not an HMAC**: static shared token, per-tenant `tenant.xenditCallbackToken` looked up through order `reference_id` (:46-64), constant-time compare (:22-27, :63); account events use master `XENDIT_WEBHOOK_TOKEN` (:40, `account-updated.ts verifyXenditCallbackToken`). Missing tenant token => reject (:67-68). 401 on bad token (:115-118) (Xendit will retry non-2xx).
- Dispatch :122-138; ALWAYS 200 after dispatch even on error (:139-145).
- `findOrderByPayment` by reference_id then `xenditPaymentRequestId` (:10-44). Amount check abs diff 0.01 RM (:70-75, :115-120). Expiry/failure: `UPDATE orders SET payment_status='payment_failed' WHERE id AND status='pending'` (:61-64, :106-109) - CAS-ish, idempotent, but sets only payment_status (status stays pending; cron `payment-expiry` later cancels+restocks).
- Paid: `reconcileOrderPaid(source:'webhook', xenditData)`. Special branch when CAS misses and webhook source + channelCode (`reconcile-order-paid.ts:60-85`): reads order, updates channel/method, sends email ONLY if stored `xenditChannelCode` was empty (poll won earlier). Duplicate-delivery protection for email here depends on that channelCode persisted flag - two CONCURRENT webhook deliveries that both lose the CAS (poll won) both see empty channelCode => 2 emails (TOCTOU between :62-64 and :66).
- `payment_request.expiry` / invoice EXPIRED sets payment_failed only if still pending: late PAID after EXPIRED -> reconcile CAS (`status='pending'`) still succeeds because `status` untouched (only `payment_status` changed) => OK, good. Late PAID after payment-expiry cron cancel => lost (same hole as Stripe).
~1-4 s.

### 1.5 EasyParcel tracking -> `POST /api/webhooks/easyparcel` (`route.ts:72-256`) + `applyTrackingUpdate`
- Auth: `?secret=` query param, timing-safe (:28-33, :74-82); 503 if env missing (fail closed). No HMAC; EP cannot send headers (comment :19). **Secret is in the URL** => anything that logs URLs (CF Worker logs, queue payload) must not carry it.
- Tolerant parse (:40-70), invalid JSON => 200 ignored (:84-89); `ondemand*` topics skipped (:105-109); non-status events return 200 (:121-152); missing awb 200 (:154-161); no order 200 (:221-225, deliberate "no retry storm"); unknown status 200 w/o write (:233-240); **transient DB error -> 500 so EP retries** (:253-255).
- Write: `applyTrackingUpdate` (`apply-tracking-update.ts:61-160`) inside `withOrderRowLock` = PG tx + `SELECT ... FOR UPDATE` (`order-row-lock.ts:20-39`), re-reads order, then:
  - TERMINAL tracking states never regress (:31, :93). Non-terminal order IS allowed (picked_up after in_transit rewrites `shippingTrackingStatus` backwards; `eventTime = now()` (:118) not provider time => history ordering = processing order, **queue reorder/delay directly corrupts the timeline**).
  - `autoShip`: order ready_to_ship + picked_up/in_transit/out_for_delivery -> status 'shipped' (:99-101,140). `autoComplete`: delivered + order shipped/ready_to_ship -> 'completed' (:96-98,141) -> beforeChange hook sets COD paid (`update-payment-status.ts:17-23`). `reopenOnCancel` code 0 -> 'confirmed' wiping AWB/label (:105,142-152).
  - Idempotent for exact retries: `trackingChanged` false & no description change => 'unchanged' (:106-116). Same status w/ different courier text appends new history row (:110-114).
- Also AWB-backfill write outside the lock (`route.ts:206-212`).
- Out-of-order: shipped (autoShip) after completed? autoShip requires order status exactly `ready_to_ship` (:99-100) so cannot revert completed. delivered-then-in_transit blocked by TERMINAL. cancel(0) after delivered: TERMINAL has both -> `TERMINAL.has(mapped)` true => allowed to overwrite delivered with cancelled tracking status, but reopen only from REOPEN_ON_CANCEL_FROM (:44) (`completed` excluded) OK.
- Side effects: none external (no email/notification here). `echoWebhookPayload` mirrors PII-redacted payload to Sentry (:~102 `report-webhook.ts`).
~100-400 ms. Already fast; EP expects fast 2xx (docs unknown - see Unresolved Q5).

### 1.6 `reconcile-orders` cron (`src/app/api/cron/reconcile-orders/route.ts`, `*/10`; job `src/lib/jobs/reconcile-orders.ts`)
- Pending Stripe card/fpx orders >15 min old, limit 50 (:25-37); per order sequential `retrieveCheckoutSession` then `reconcileOrderPaid(source:'cron')` if `payment_status==='paid'` (:57-68). Time budget 50 s deadline (:21, :42). Then Xendit pass: `getInvoice` PAID/SETTLED -> reconcile (:102-127). Emails ARE sent for cron source (`reconcile-order-paid.ts:129`).
- Cron auth = `Authorization: Bearer CRON_SECRET` (`cron/payment-expiry/route.ts:12-15`; reconcile route same pattern).
- Idempotent via same CAS. Concurrent with queue-delayed webhook: whichever wins; both send emails only from the CAS winner. OK.
- Duration up to 50 s (cap), maxDuration 60 (route).

### 1.7 `payment-expiry` cron (`*/15`; `src/lib/jobs/payment-expiry.ts`)
- Select: methods bank_transfer/card/fpx/ewallet, `paymentStatus IN awaiting_payment|pending_verification|payment_failed|failed`, `paymentExpiresAt < now`, limit 200, depth 2 (:11-25).
- CAS cancel `status IN (pending,new,payment_failed) AND payment_status IN (...) AND payment_expires_at < now` (:34-44) -> restock each item (:51-58, plain increment, runs only for CAS winner) -> `releaseDiscountRedemption` (:64) -> buyer expired email (fire and forget :117-121).
- **Race with late payment (queued webhook)**: status 'new' is in the CAS status list; but `payment_status` after reconcile is 'paid' which is NOT in the list => paid orders are safe. Pending Stripe/Xendit order whose `payment_status` is still 'awaiting_payment'/'failed' + webhook queue backlog >expiry => cancelled+restocked, later paid event misses CAS (see 1.1). Expiry window is 24 h (comment `cancel_reason`), far larger than any realistic queue delay; risk is low unless DLQ sits >24h.
- Also runs `discountAutoInactiveJob` (single UPDATE ... RETURNING, idempotent; `cron/payment-expiry/route.ts:23-29`).
- `src/lib/jobs/discount-auto-inactive.ts:29-47`: pure SQL, ms. Not a candidate.

### 1.8 `bulk-update` (`src/app/api/orders/bulk-update/route.ts:16-95`)
- Auth `withFeatureGuard('order_management')(withAuth)`. Loop sequential: `findByID` (access-controlled) -> check `ORDER_STATUS_TRANSITIONS` (`Orders.ts:16-31`) -> `payload.update status`. **No CAS, no row lock, no hook-enforced transition** (Orders.ts hooks list :36-70 has no transition validator) => TOCTOU vs EP webhook autoShip/autoComplete and vs `/cancel`. No emails here (unlike single `[id]` PATCH which sends buyer emails `[id]/route.ts:~170-250`) => bulk "confirmed" skips buyer confirmation email (existing behaviour).
- Returns per-order results synchronously `{total,succeeded,failed,results}` (:79-87).

### 1.9 Admin approve / reject / cancel / cancel-payment / refund / self-deliver
| Route | Guard | Side effects | Note |
|---|---|---|---|
| `approve-payment` PATCH (`[id]/approve-payment/route.ts:22-197`) | CAS `payment_status='pending_verification' AND status NOT IN (cancelled,refunded)` (:60-72); loser rechecks -> 409/200/422 (:74-95) | payment-confirmed email (:119-123) + confirmation email if pending->confirmed (:128-187) | email sent only by CAS winner; sync response returns updated order |
| `reject-payment` (`reject-payment/route.ts:20-105`) | read-then-update, **no CAS** (:44-65) | rotates magicLinkSecret, new 24h expiry, email (:91-95) | double click = 2 emails, 2nd secret invalidates 1st link |
| `cancel` (`cancel/route.ts`) | CAS per branch: Xendit (:108-113), Stripe (:247-253), generic (:325-331); all require `easy_parcel_order_no IS NULL` | Xendit/Stripe real refund after CAS with rollback on failure (:151-171, :285-312; Stripe idempotencyKey `cancel-<id>` :287), `releaseDiscountRedemption` (:380), restock (:383-403), cancel + refund emails (:419-506) | sync response includes `restock[]`, `refundId` (:517-518) |
| `cancel-payment` (buyer; `cancel-payment/route.ts:60-123`) | CAS status pending/payment_failed & payment_status not paid/refunded/cancelled (:65-73) | release discount (:88), restock (:96-110) | ct_ cookie auth |
| `refund` (`refund/route.ts`) | CAS shipped/completed->refunded (:334-338); Xendit CAS (:234-238); BT/COD CAS (:185-189) | Stripe refund w/ idempotencyKey `refund-<id>` (:356-358), release+restock only after Stripe success (:361-365), rollback on failure (:386-394), email (:145-146) | returns `refundId` synchronously (:367) |
| `self-deliver` (`self-deliver/route.ts:103`) | `payload.update` after EP-label guard (:83-92), no CAS | none | - |
| `retry-payment` (`retry-payment/route.ts`) | creates new Stripe session / releases discount (:284, update :297) | buyer-facing returns checkout URL | needs sync |
These are user-initiated, return provider ids/restock info synchronously, and already carry CAS + Stripe idempotency keys. Do NOT queue.

### 1.10 `upload-proof` / `upload-proof-direct`
- `upload-proof/route.ts`: magic-link token verify (:~55-68), status in `UPLOADABLE_STATUSES`, expiry, then plain `payload.update` paymentStatus='pending_verification' (:86-101, no CAS), notify tenant owners in `runAfterResponse` with `dedupeKey PROOF_UPLOADED:<orderNumber>` (:104-118). Notification deduped; update idempotent. `-direct` same shape (:89-108). Candidate for queue = only the notify tail; not worth it.

### 1.11 `/api/webhooks/vercel` (`webhooks/vercel/route.ts`)
HMAC-SHA1 hex of raw body with `VERCEL_WEBHOOK_SECRET` (:39-41), forwards CI result to Lark. Not order/payment. Out of scope; no change.

## 2. Idempotency / ordering matrix

| Scenario | Today | Safe? |
|---|---|---|
| checkout.completed delivered 2x (or webhook + poll + cron) | CAS pending->new, only winner emails/notifies | yes |
| poll wins CAS, then webhook (Stripe) | poll skips emails (`reconcile-order-paid.ts:129`); webhook sees `already_processed`; the "email when channelCode missing" repair (:60-85) is Xendit-only => **Stripe buyer/seller confirmation email never sent** | NO (pre-existing bug; queue delay raises odds because poll fires from confirm page) |
| payment_failed then paid (same session) | failed sets status payment_failed (no CAS); reconcile CAS needs `pending` => paid order stuck | NO |
| paid then payment_failed | skipped by skip list (:77-81) | yes |
| charge.refunded 2x | CAS `status != refunded` single winner | yes (email/restock once) |
| charge.refunded after ECH cancel | winner again => 2nd restock, status cancelled->refunded | NO (pre-existing) |
| charge.refunded after ECH refund | CAS miss | yes |
| partial refund | treated as full | NO (logic) |
| EP same status 2x | 'unchanged' | yes |
| EP picked_up arrives after in_transit | regresses `shippingTrackingStatus`, appends history with now() | partial |
| EP delivered then anything non-terminal | blocked | yes |
| EP shipped(autoShip) after completed | needs order==ready_to_ship | yes |
| payment-expiry vs late paid | expiry CAS requires payment_status IN (awaiting...), paid has 'paid' => safe once reconciled; if webhook not yet applied and >24h => lost | low risk |
| Xendit EXPIRED then PAID | `status` untouched => reconcile still works | yes |
| two concurrent Xendit webhooks losing CAS to poll | both may email | edge |

## 3. Non-repeatable side effects and owners

| Effect | Owner(s) | Guard |
|---|---|---|
| Stock decrement | checkout routes only (`stripe-checkout/route.ts:428-461`, `xendit-checkout/decrement-stock.ts`, `checkout/route.ts`) | compensation on fail |
| Stock restock | `cancel` (:383-403), `cancel-payment` (:96-110), `refund` (:361-365), `payment-expiry` (:51-58), webhook `charge.refunded` (:78-99) | each behind its own CAS winner only; `restockItem` itself non-idempotent. Comments warning of phantom-restock: `reconcile-order-paid.ts:36-41` (pre-deploy Stripe orders), `cancel/route.ts:386-391` (pre-2026-06-03 BT orders) |
| Discount reserve/release | reserve at place-order; legacy backstop in reconcile (:98-124); release in cancel/refund/expiry/webhook-refund/delete-hook (`release-discount-on-delete.ts`) | keyed unique `discount_usage_history.order_id` => idempotent |
| Buyer/seller paid emails | `sendOrderPaidEmailsAndNotify` from reconcile CAS winner (source != poll) | CAS only |
| Refund email | webhook charge.refunded (Stripe), `cancel` (Xendit), `refund` route | CAS; double path on cancel (see 1.3) |
| payment_failed retry email + SYSTEM_ALERT | webhook only | none (read-then-update) |
| ORDER_NEW notification | reconcile + Orders afterChange (create, non-Stripe) + upload-proof | `dedupeKey` |
| Expired email | payment-expiry CAS winner | CAS |
| Reject email | reject-payment | none |
| SSO / FCM | notifyTenantOwners (other agent covers) | dedupeKey only on some |

## 4. Signature verification (what a Worker/queue must preserve)

| Provider | Mechanism | Over what | Retry/response visible in code |
|---|---|---|---|
| Stripe | `constructEvent(rawBody, 'stripe-signature', secret)`; secret = `STRIPE_CONNECT_WEBHOOK_SECRET`(fallback `STRIPE_WEBHOOK_SECRET`) if body has `account` else `STRIPE_WEBHOOK_SECRET` (`stripe.ts:214-234`, `route.ts:37-49`) | exact raw text (`request.text()` before any parse; must not be re-serialised); default tolerance 300 s | bad sig 400 (:59); handler error -> 200 (:94-99) => no retry. Stripe docs (not in repo): retries non-2xx up to 3 days w/ backoff; expects 2xx quickly |
| Xendit | static `X-CALLBACK-TOKEN` (not HMAC); per-tenant token from DB via order lookup (`xendit/route.ts:29-81`); master token for account events | header only; body is not signed (anyone with token can forge amounts, mitigated by amount check) | 401 on bad token, 400 invalid JSON, else 200 |
| EasyParcel | query `?secret=` shared secret, timing-safe (`easyparcel/route.ts:74-82`) | URL | 500 on DB error (retry), 200 otherwise |
| Vercel | HMAC-SHA1 | raw body | n/a |
| Cron | `Bearer CRON_SECRET` | header | n/a |

Consequences: verification must happen BEFORE enqueue and on the original raw bytes, on Vercel (secrets/DB lookup for Xendit tenant token live there). Worker must not need provider secrets. Queue message must not embed `?secret=` URL or tenant token. Stripe 300 s tolerance => the delayed job must NOT call `constructEvent` again; trust = Vercel HMAC from Worker.

## 5. Recommended insertion point

**Choose (a) persist-then-ack-then-enqueue, for 4 event kinds only.** Reasoning: (b) enqueue-only loses the event if the queue send fails after ack (and Stripe/Xendit will not retry because we ACK 200); (c) inline status quo keeps swallow-and-200 data-loss.

New table `webhook_events` (declare as `CREATE TABLE IF NOT EXISTS` entry in `scripts/db-setup.js` `MIGRATIONS` array — pattern at `generation_recovery_jobs.create_table` ~`scripts/db-setup.js:4000-4046`, unique-index entries ~:3756 — AND a Payload collection or raw-SQL-only table; rule `database-schema.md`: serial id, no DROP):
`id serial pk, provider varchar, event_id varchar, event_type varchar, order_id int null, payload jsonb (minimal), status varchar ('received'|'queued'|'processing'|'done'|'failed'|'dead'), attempts int, last_error text, created_at, processed_at; UNIQUE(provider, event_id)`.
`event_id` = Stripe `evt_...` (`stripeEvent.id`, currently discarded at `route.ts:49-56`), Xendit: invoice/`payment_request` id + status (no event id in body; derive `sha256(raw)`), EP: sha256 of raw (no id).

Flow (Stripe example), wrap existing code at the dispatch `switch` (`stripe/route.ts:66-92`):
1. Vercel route: verify sig (unchanged) -> `INSERT ... ON CONFLICT (provider,event_id) DO NOTHING` -> if conflict & status done => 200 immediately -> send `{webhookEventId}` to CF Queue (HTTP API or via Worker producer) -> 200. If enqueue fails => leave row `received`; a sweeper (reuse reconcile cron) re-enqueues `received` older than N min.
2. Worker consumer: HMAC-SHA256(secret, `ts.body`) POST `/api/internal/webhook-jobs` with `{webhookEventId}` + timestamp header (reject skew >5 min; rely on row status for dedupe).
3. Vercel internal route: auth HMAC; `UPDATE webhook_events SET status='processing' WHERE id AND status IN ('received','queued','failed') RETURNING payload`; reuse switch -> `handleCheckoutCompleted / handlePaymentFailed / handleChargeRefunded` (Stripe), `handlePaymentEvent / handleInvoiceEvent` (Xendit, same file `payment-updated.ts`); on success status='done'; on throw -> 5xx so CF retries with backoff; after max attempts -> DLQ + status 'dead' + alert.
Handlers currently `try/catch` and swallow (`checkout-completed.ts:68-77`, `route.ts:94-99`) — must rethrow when run from the queue (R1).

Job payload (ids only): `{ webhookEventId: number }` (+ optional `provider`, `eventType` for logging). Do NOT put session/charge objects, emails, addresses, tenant tokens in the queue (PII, and 128 KB limit on CF Queues). The stored `payload` jsonb should be the minimum the handler reads:
- checkout-completed: `session.id, client_reference_id, payment_status, payment_intent, payment_method_types` + `connectedAccountId` (read at `checkout-completed.ts:18-35`, `reconcile-order-paid.ts:144-163,197-206`). Alternative: store only ids and re-fetch via `retrieveCheckoutSession` (already used by cron `reconcile-orders.ts:57`), avoiding stored PII. Human decision.
- payment-failed: `paymentIntent.id`, `metadata.orderId`, `connectedAccountId` (`payment-failed.ts:42-63`).
- charge-refunded: `charge.payment_intent`, `charge.amount_refunded`, `connectedAccountId` (`charge-refunded.ts:28,132`).
- Xendit: `reference_id/external_id, payment_request_id|invoice id, channel_code|paymentChannel, amount, status/event` (`payment-updated.ts:47-52,93-99,121`).
Other Stripe types (`account.updated`, `subscription.updated`, deauthorized) — keep inline (cheap, not order-flow).

Keep inline / do not queue: EP tracking (fast, row-locked, 500 already => EP retry, query-secret auth; queueing would reorder tracking history because eventTime=now — only queue if FIFO/partition by order is solved); crons (they already ARE the async layer; but may add `payment-expiry`/`reconcile` as Worker cron triggers hitting the same Bearer routes if desired — pure scheduler swap, no logic change); admin routes; bulk-update; upload-proof; poll/stream/payment-status.

Ordering: CF Queues gives at-least-once, no strict per-key ordering. Add per-order serialisation in the job: take `SELECT ... FOR UPDATE` on the order row (reuse `withOrderRowLock`, `src/lib/payload/order-row-lock.ts:20-39`) or process events for same order via `ORDER BY created_at` check ("process only if no earlier unprocessed event for this order_id") — human decision (R4).

## 6. Risks and required code changes (small list)

| # | Risk | Change |
|---|---|---|
| R1 | Handlers swallow errors, route returns 200 (`stripe/route.ts:94-99`, `checkout-completed.ts:75-77`, `xendit/route.ts:139-145`) so queue retry never fires | extract dispatch into `processStripeEvent(payload, event)` / `processXenditEvent(...)` that throws; inline route keeps legacy swallow behaviour, queue route lets it throw |
| R2 | No event-id dedupe table | add `webhook_events` + MIGRATIONS entry (see §5); store Stripe `evt_` id (`stripe.ts` normalize drops it - pass `rawEvent.id`) |
| R3 | payment_failed has no CAS; failed-before-paid leaves paid order stuck (`payment-failed.ts:83-91` vs `reconcile-order-paid.ts:50-54`) | make payment_failed a CAS `UPDATE ... WHERE status='pending' RETURNING id` and only email/notify on winner; and/or let reconcile CAS accept `payment_failed` (`status IN ('pending','payment_failed')`) when Stripe says paid. Human decision which. |
| R4 | Ordering: paid vs failed vs refunded for same order; EP tracking history uses `now()` | per-order lock in job; for EP, only queue if event timestamp from provider is used for ordering |
| R5 | `charge.refunded` after ECH cancel double-restocks + flips cancelled->refunded (`charge-refunded.ts:55-63,78-99`, `cancel/route.ts:247-252,386-401`) | restrict CAS to `status NOT IN ('refunded','cancelled')` or skip restock when `payment_status` already 'refunded'; check `amount_refunded` vs total for partial. Queue retries make duplicates certain, so fix before enabling |
| R6 | Stripe poll-wins -> no confirmation email ever (`reconcile-order-paid.ts:129`, repair only for Xendit :60) | add a "email sent" marker (column or webhook_events flag) so webhook/queue job sends if not sent; or stop skipping email for poll. Queue lag widens the window |
| R7 | Late paid after cancel/expiry: money captured, order cancelled, only a log (`reconcile-order-paid.ts:86`) | on `already_processed` with status cancelled/payment_failed => write alert row / Sentry (needs human policy: auto-refund?) |
| R8 | Concurrent duplicate Xendit webhooks double-email via channelCode repair (`reconcile-order-paid.ts:62-79`) | claim via `UPDATE ... WHERE xendit_channel_code IS NULL RETURNING id` before emailing |
| R9 | Internal route auth | HMAC-SHA256 over `timestamp.body`, `timingSafeEqual`, 5 min window, secret in Vercel env + `.env.*.example` (rule env-vars.md); route excluded from Payload auth; not under `/api/webhooks/*` public names |
| R10 | Vercel cold start / `getPayload` per call: Worker retries may hammer | return 200 for already-done rows (idempotent); Worker backoff, max_retries, DLQ |
| R11 | `runAfterResponse` (`run-after-response.ts:15-23`) relies on `next/server after()`; inside internal route this works the same, but make sure route awaits critical work before returning so CF doesn't retry mid-flight | n/a |
| R12 | bulk-update/PATCH `[id]` TOCTOU vs EP autoShip | out of scope; optional `withOrderRowLock` |

Tests needed (scenario names; TC-IDs must be added in `docs/qa/F*.md` first per testing rule):
- stripe-queue: `enqueue_after_verified_signature_persists_row`; `duplicate_event_id_acks_without_enqueue`; `bad_signature_not_persisted_400`; `enqueue_failure_leaves_received_row_swept`; `worker_retry_after_handler_throw_is_idempotent`; `job_for_done_event_returns_200_noop`.
- checkout-completed: `queued_after_poll_won_cas_no_double_email`; `queued_paid_after_cancel_alerts`; `paid_after_payment_failed_recovers` (R3).
- charge-refunded: `after_ecH_cancel_no_second_restock`; `after_ecH_refund_noop`; `duplicate_delivery_single_restock`; `partial_refund_not_full_restock`.
- payment-failed: `concurrent_delivery_single_email`; `failed_after_paid_skipped`.
- xendit: `paid_replay_noop`; `expired_then_paid_reconciles`; `amount_mismatch_not_reconciled`; `two_concurrent_after_poll_one_email`.
- internal route: `rejects_bad_hmac`, `rejects_stale_timestamp`, `accepts_valid_hmac`.
- ep (only if queued): `out_of_order_in_transit_before_picked_up_keeps_latest`; `delivered_terminal_not_regressed`.
- cron: `reconcile_and_queued_webhook_race_single_winner`.

Human decisions: see Unresolved questions 1, 2, 4, 6, 7.

## 7. UI/client dependence on synchronous results

| Consumer | Dependency | Impact of async webhook |
|---|---|---|
| `POST /api/orders/[id]/payment-status` (`payment-status/route.ts:20-167`) | confirm page polls Stripe/Xendit directly and calls `reconcileOrderPaid(source:'poll')` itself; returns `{status,paymentStatus,reconciled}` | Independent of webhook latency: it heals by itself. Queue delay just makes poll win more often => R6 email gap |
| `GET /api/orders/stream/[orderNumber]` (`stream/[orderNumber]/route.ts:1-60`) | SSE, DB poll every 5 s (`DB_POLL_MS`), closes at 50 s, terminal statuses set | Reads DB only; tolerant to delay. Queue lag of >50 s just keeps stream reconnecting |
| `GET /api/orders/[id]/poll` (`poll/route.ts:21-55`) | merchant detail polls ~20 s on `updatedAt/status/awbNo/shippingTrackingStatus` | DB-driven; fine |
| `bulk-update` response (`bulk-update/route.ts:79-87`), `cancel` (`restock`, `refundId` :517-518), `refund` (`refundId`), `approve-payment` (returns updated order :189), `retry-payment` (checkout URL) | UI renders immediate result | MUST stay synchronous |
| EP webhook response JSON | `{received,matched,reason/result}` for debugging only | n/a |
| Stripe/Xendit webhook responses | not consumed by app | can become bare 200 |
Buyer email latency: `order-confirmation` currently sent inside the webhook request; with queue it is sent whenever job runs (seconds) - acceptable.

## Unresolved questions
1. Do provider webhook URLs keep pointing at Vercel (route verifies + enqueues) or move to the Worker (Worker would then need Stripe secrets + Xendit per-tenant tokens from DB - strongly not recommended)? Assumed: stay on Vercel.
2. Store minimal event JSON in `webhook_events` (PII: Stripe session has customer details; retention policy?) vs ids-only and re-fetch from Stripe/Xendit at job time? Re-fetch removes PII but adds API calls and Stripe `charge`/`refund` re-fetch semantics for refunds.
3. Stripe orders' `payment_status` value at creation ('awaiting_payment'?) not verified here — determines whether payment-expiry can cancel a Stripe order that is paid-but-unreconciled. Checked only the cron predicate.
4. Required behaviour when a paid event arrives for an already cancelled/expired/payment_failed order: alert only, auto-refund, or auto-reopen? (R3/R7)
5. EP retry/timeout policy is not documented in repo (only "500 asks EP to retry", `easyparcel/route.ts:254`); confirm with EP docs before deciding to queue EP at all. Recommended: leave inline.
6. Is per-order strict ordering required (single Queue consumer concurrency 1 vs DB lock)? CF Queues has no per-key FIFO.
7. Should crons move to Worker cron triggers (scheduler only) or stay on Vercel crons (`vercel.json` crons list; `maxDuration` 60)? No logic reason to move.
8. Which pre-existing bugs (R5 double restock after cancel, R6 missing Stripe email after poll win, R3 failed-before-paid) are in-scope for GH-2201 vs separate issues? Queue retries make R5/R3 materially worse, so at least R1/R2/R3/R5 should land with or before it.
9. `checkout.session.async_payment_succeeded` is not mapped (`stripe.ts:245-252`) although the handler comment (`checkout-completed.ts:61-62`) says it arrives later; confirm Dashboard subscription list.
