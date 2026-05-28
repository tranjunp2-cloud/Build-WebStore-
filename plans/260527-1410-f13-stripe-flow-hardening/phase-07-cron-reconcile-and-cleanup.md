# Phase 07 — Cron reconcile late webhooks + cleanup + oversell refund button

**Priority:** P2 · **Sprint:** 2 · **Status:** planned · **Depends:** 01, 02

## Goal

Backstop for dead/slow webhooks + tidy garbage pending orders + give sellers a 1-click refund on oversell-flagged orders (decision 1).

## Fix

1. **Reconcile cron** `GET /api/cron/reconcile-orders` (Vercel Cron, e.g. every 5–10 min):
   - Find orders `status='pending'` with `stripeSessionId`, older than ~15 min.
   - For each: retrieve Stripe session on the connected account.
     - Stripe `paid`/`complete` → call shared `reconcileOrderPaid` (Phase 01) — self-heals missed webhooks.
     - Stripe `expired` → mark `status='cancelled'` (or `expired`), `paymentStatus='cancelled'`.
   - Idempotent via the shared fn's atomic transition.
   - Secure with `CRON_SECRET` header check (Vercel cron sends it); reject otherwise.

2. **Garbage cleanup**: very old `pending` with no completed session → cancel/expire so they don't litter (also reduces multi-pending from retries).

3. **Oversell refund button** (admin/seller dashboard):
   - On orders with `oversellReview=true`, show "Refund customer" button wired to existing `POST /api/orders/[id]/refund` (`src/app/api/orders/[id]/refund/route.ts`).
   - After refund success → `paymentStatus='refunded'`, clear `oversellReview`.

## Files

- Create: `src/app/api/cron/reconcile-orders/route.ts`
- Modify: `vercel.json` (add `crons[]` — ⚠️ read `.claude/rules/vercel-deploy.md`; DO NOT touch `git.deploymentEnabled`)
- Modify: seller orders admin view (locate dashboard order component) — add refund button for `oversellReview`
- Env: `CRON_SECRET` → Vercel Dashboard + `.env.*.example` (per `.claude/rules/env-vars.md`)
- Read: `src/app/api/orders/[id]/refund/route.ts`, `src/lib/payment/reconcile-order.ts`

## Todo

- [ ] Cron endpoint: auth (`CRON_SECRET`), reconcile pending>15m via Stripe session lookup
- [ ] Expire/cancel stale + garbage pending
- [ ] `vercel.json` crons entry (schedule TBD) — follow deploy rule
- [ ] Add `CRON_SECRET` to Vercel + example envs + `check-env-vars.js`
- [ ] Oversell refund button → existing refund API → set refunded + clear flag
- [ ] Tests: missed-webhook self-heal, expired session cancel, cron auth reject (TC-F13.*)

## Success criteria

- Order paid at Stripe but webhook never arrived ⇒ reconciled within one cron cycle.
- Stale unpaid pending auto-expire; oversell orders refundable in one click.

## Risks

- `vercel.json` is sensitive — crons only, no deploy-toggle change.
- Cron must scope all Stripe retrieves to the connected account (`stripeAccount`).
- Avoid reconciling orders mid-retry (Phase 06) — rely on atomic single-winner + age threshold.
