---
phase: 1
title: "Schema + Billplz client library"
status: pending
priority: P1
effort: "6h"
dependencies: []
story: US-F43-01
branch: feat/F43-01-billplz-schema-client
---

# Phase 1: Schema + Billplz client library

## Overview

Foundation: tenant credential fields, order linkage fields, DB migrations, and a typed Billplz API client with X Signature verification. No user-visible surface.

## Requirements

- Functional: store per-tenant `billplzApiKey`, `billplzCollectionId`, `billplzXSignatureKey`; store `billplzBillId` + `'billplz'` in `orders.paymentProvider`; client supports createBill/getBill/deleteBill/getCollection + verifyXSignature + normalizeMobile.
- Non-functional: secrets never readable via Payload API (`access.read: () => false`); every column has an idempotent `db-setup.js` migration (CI hard gate `check-migrations.js`).

## Architecture

### Tenants collection additions (`src/collections/Tenants.ts`)

Flat fields next to `xenditSecretKey`/`xenditCallbackToken` (L272–286 pattern — `type:'text'`, `admin.readOnly`, `access:{read:()=>false}`):

- `billplzApiKey` (text)
- `billplzCollectionId` (text — not secret but keep same access pattern; display needs server action)
- `billplzXSignatureKey` (text)

**No toggles** — do NOT add `payments.payment_billplz` or `sites.paymentConfig.billplzEnabled`. `paymentConfig` has no app-code write path (admin-only dead toggles, `Sites.ts:526-577`) and a tenant toggle duplicates disconnect semantics. Connection state is derived: `billplzConnected = !!billplzApiKey` (mirrors `checkout/page.tsx:140` xendit gating). Note: no `payments.payment_xendit` exists either — "clone xendit toggle" is a phantom precedent.

### Orders collection additions (`src/collections/Orders.ts`)

- `paymentProvider` select options += `'billplz'` (L361–369)
- `billplzBillId` (text, indexed — mirrors `xenditPaymentRequestId` L350)

### Migrations (`scripts/db-setup.js` — append to `MIGRATIONS` array end)

```js
{ name: 'tenants.billplz_api_key', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billplz_api_key varchar;` },
{ name: 'tenants.billplz_collection_id', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billplz_collection_id varchar;` },
{ name: 'tenants.billplz_x_signature_key', sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billplz_x_signature_key varchar;` },
{ name: 'orders.billplz_bill_id', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS billplz_bill_id varchar;` },
{ name: 'orders.billplz_bill_id_idx', sql: `CREATE INDEX IF NOT EXISTS orders_billplz_bill_id_idx ON orders (billplz_bill_id);` },
// payment_provider is varchar → 'billplz' needs no enum migration
// payment_method IS a PG enum (db-setup.js:4643-4646) → enum migration REQUIRED, not optional:
{ name: 'orders.enum_payment_method_billplz', sql: `DO $$ BEGIN ALTER TYPE enum_orders_payment_method ADD VALUE IF NOT EXISTS 'billplz'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` },
```

### `src/lib/payment/types.ts`

- `PaymentWebhookEvent.provider` union += `'billplz'`.

### `src/lib/payment/billplz-client.ts` (new — clone `xendit-client.ts`)

```ts
const BILLPLZ_BASE_URL = process.env.BILLPLZ_API_BASE ?? 'https://www.billplz.com/api'

export class BillplzError extends Error {
  code: 'BILLPLZ_CONFIG_ERROR' | 'BILLPLZ_API_ERROR'
  status?: number; raw?: unknown
}

// Union so OAuth hypothesis (a) — Bearer token on www.billplz.com/api/* — is a
// config change at the call site, not a client rewrite (see phase-07).
export type BillplzAuth = { type: 'basic'; key: string } | { type: 'bearer'; token: string }

export async function billplzFetch<T>(path: string, opts: {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: Record<string, unknown>      // sent as form-urlencoded per Billplz convention
  auth: BillplzAuth                    // per-tenant, required (no env fallback)
}): Promise<T>
```

- Header: `basic` → `Authorization: Basic ${Buffer.from(auth.key + ':').toString('base64')}`; `bearer` → `Authorization: Bearer ${auth.token}`.
- Convenience wrapper `basicAuth(apiKey): BillplzAuth` so all Phase 1–5 call sites stay one-liners.
- Body encoding: `application/x-www-form-urlencoded` (Billplz accepts JSON too; form matches official plugins)
- On `!res.ok` throw `BillplzError` with status + parsed `error.message`.

### `src/lib/payment/billplz.ts` (new)

```ts
export interface BillplzBill { id: string; collection_id: string; paid: boolean|string; state: 'due'|'paid'|'deleted'; amount: number; url: string; /* ... */ }
export async function createBill(auth: BillplzAuth, p: CreateBillParams): Promise<BillplzBill>  // POST /v3/bills
export async function getBill(auth: BillplzAuth, id: string): Promise<BillplzBill>              // GET /v3/bills/{id}
export async function deleteBill(auth: BillplzAuth, id: string): Promise<void>                  // DELETE /v3/bills/{id}
export async function getCollection(auth: BillplzAuth, id: string): Promise<BillplzCollection>  // GET /v3/collections/{id}
export async function probeApiKey(auth: BillplzAuth): Promise<void>                             // GET /v4/webhook_rank

export function normalizeMobile(raw: string): string | null   // '012-345 6789' → '60123456789'; null if not MY mobile
```

### `verifyXSignature` (canonical algorithm from WooCommerce plugin — research.md §Webhook)

```ts
const BILL_CALLBACK_KEYS = ['amount','collection_id','due_at','email','id','mobile','name',
  'paid_amount','transaction_id','transaction_status','paid_at','paid','state','url'] as const

export function verifyBillplzSignature(
  params: Record<string, string | string[]>,   // parsed form data
  xSignatureKey: string,
): boolean
```

- For each whitelist key present in params: drop value if `''`, `'null'`, `'false'`, null/undefined.
- Build `key+value` strings → sort case-insensitive → join `'|'` → `HMAC-SHA256(key=xSignatureKey)` → `timingSafeEqual` vs `params.x_signature`.

## Related Code Files

- Create: `src/lib/payment/billplz-client.ts`, `src/lib/payment/billplz.ts`, `src/__tests__/unit/payment/billplz-signature.test.ts`, `src/__tests__/unit/payment/billplz-client.test.ts`
- Modify: `src/collections/Tenants.ts`, `src/collections/Orders.ts`, `src/lib/payment/types.ts`, `scripts/db-setup.js`, `.env.staging.example`, `.env.production.example`

## Implementation Steps

1. Add tenant/order fields + `paymentProvider`/`paymentMethod` enum options (no toggles — key-presence gating)
2. Append migrations; run `scripts/check-migrations.js` locally to confirm pass
3. Write `billplz-client.ts`, `billplz.ts`, `verifyXSignature`, `normalizeMobile`
4. Unit tests: signature (vectors derived from WooCommerce impl), mobile normalize, client error mapping
5. `payload-types` regen if the repo auto-generates types

## Success Criteria

- [ ] `check-migrations.js` passes; fields exist in Payload admin
- [ ] `verifyXSignature` passes fixtures incl. `paid='false'`-dropped and case-insensitive ordering
- [ ] `billplzFetch` produces correct Basic header + surfaces `BillplzError.status`
- [ ] `pnpm vitest` green for new unit files

## Risk Assessment

- Wrong signature whitelist → webhooks rejected in prod → unit-test against vectors copied from the official plugin source (research.md has the key list).
- `access.read:false` on keys strips them in populated queries → all consumers `findByID('tenants', overrideAccess:true)` directly (existing pattern).
- `payment_method` is confirmed a PG enum — the `ALTER TYPE` migration is required, and `paymentMethod:'billplz'` ripples into every elimination-based classifier (see plan.md §7 for the consumer list).
