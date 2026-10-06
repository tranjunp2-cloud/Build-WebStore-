---
phase: 2
title: "Seller connect — manual keys"
status: pending
priority: P1
effort: "8h"
dependencies: [1]
story: US-F43-02
branch: feat/F43-02-billplz-seller-connect
---

# Phase 2: Seller connect — manual keys

## Overview

Seller pastes API Secret Key + Collection ID + X Signature Key in Settings → Payments; server validates against Billplz and stores on tenant; key presence = connected (no toggle, plan.md §8).

## Requirements

- Functional: connect modal (3 fields), server-side probes, masked connected state, disconnect, error i18n keys, plan gate `payment_integration`.
- Non-functional: keys are server-only (never returned to client after save — display masked tail only); server action returns i18n-key errors matching `handleSaveXenditKeys` lookup pattern.

## Architecture

Clone Xendit Model C surface (`XenditConnectBlock`/`Modal`/`ConnectedBar` + `saveXenditKeys`/`disconnectXendit`):

```
Settings > Payments
  billplzIsConnected ? <BillplzConnectedBar collectionIdMasked onDisconnect/>
                     : <BillplzConnectBlock tenantId onSaveKeys/>
onSaveKeys(apiKey, collectionId, xSigKey) → saveBillplzKeys() server action
```

### `saveBillplzKeys(apiKey, collectionId, xSignatureKey)` — `settings/payments/actions.ts`

1. `getCurrentTenantId()` → `'Unauthorized'`
2. Field checks: all 3 non-empty, ≤512 chars, API key is UUID-ish format (Billplz keys are UUIDs — enforce `^[0-9a-f-]{36}$` loosely or skip strict format and rely on probe)
3. Plan gate: `getActivePlanSubscription` + `canUse('payment_integration')` → `'FEATURE_LOCKED'`-style i18n key
4. Probe key: `probeApiKey` (`GET /v4/webhook_rank`) → 401 → `'billplzInvalidApiKey'`; network error → proceed (do not hard-fail on Billplz outage, mirror Xendit)
5. Probe collection: `getCollection(basicAuth(apiKey), collectionId)` → 404 → `'billplzCollectionNotFound'`; 401 → `'billplzInvalidApiKey'`; **network error → proceed-with-warn (consistent with step 4 — do not propagate `BillplzError` to the generic catch, or a Billplz blip blocks connecting entirely)**
6. **X Signature key cannot be probed** — store as provided; surface hint in modal ("sai key chỉ phát hiện khi callback đầu tiên")
7. `payload.update` tenant `{billplzApiKey, billplzCollectionId, billplzXSignatureKey}` `overrideAccess:true` → `{success:true}`

### `disconnectBillplz()` — nulls the 3 fields in one `payload.update`. No toggle to reset (connection = key presence).

### UI components (`settings/payments/`)

- `BillplzConnectBlock.tsx` — clone `XenditConnectBlock` (hero + 3 steps + CTA), opens modal
- `BillplzConnectModal.tsx` — clone `XenditConnectModal`: 3 `SecretField`s (API key, Collection ID, X Signature Key), numbered dashboard instructions (Settings → Keys & Integration → copy), **drop the second webhook-confirm modal** (Billplz webhook URL is per-bill, nothing registered account-level)
- `BillplzConnectedBar.tsx` — clone `XenditConnectedBar`; shows masked collection ID (e.g. `inb…epb`), "Manage in Billplz" link to `dashboard.billplz.com`, Disconnect + inline confirm. No status fetch (Phase 1 has no status API worth polling)
- `PaymentsFormClient.tsx`: new sibling `<section>` after the Xendit block (L763–785 pattern), `handleSaveBillplzKeys`/`handleBillplzDisconnect` clones, `billplzIsConnected` state
- `page.tsx`: `billplzConnected = !!tenant.billplzApiKey` prop + read masked collection tail via a small getter in actions.ts (e.g. `getBillplzConnectInfo()` returning `{connected, collectionTail}` — keys never leave server)
- `xendit-brand-icons.tsx` sibling: `BillplzIcon` asset under `/images/payment/`
- **No `updatePaymentSettings` change** — there is no `payment_billplz` toggle (key-presence gating, see plan.md §8). `PaymentUpdates`/`editablePaymentSettings`/`effective`-map/`at-least-one-method` check (actions.ts L213) all untouched.
- i18n `billplz*` keys in `en.json` + `ms.json` under `dashboard.settings.payments` (both required — type-checked)

## Related Code Files

- Create: `BillplzConnectBlock.tsx`, `BillplzConnectModal.tsx`, `BillplzConnectedBar.tsx` (settings/payments/)
- Modify: `settings/payments/{page.tsx,PaymentsFormClient.tsx,actions.ts}`, `src/i18n/locales/{en,ms}.json`

## Implementation Steps

1. Server actions `saveBillplzKeys`/`disconnectBillplz`/`getBillplzConnectInfo`
2. Components cloned + wired into `PaymentsFormClient` + `page.tsx` prop
3. i18n keys (en + ms)
4. Unit tests: `payment-actions.test.ts`-style cases for save/disconnect (mock `billplzFetch`), incl. network-error-on-getCollection → proceed

## Success Criteria

- [ ] Wrong key → `billplzInvalidApiKey` toast; wrong collection → `billplzCollectionNotFound`; Billplz network outage → keys still saveable (warn logged)
- [ ] Valid keys → tenant updated, bar shows masked collection, storefront shows Billplz (key-presence gate)
- [ ] Disconnect → fields nulled, storefront stops showing Billplz
- [ ] `access.read:false` respected — keys never appear in any client payload

## Risk Assessment

- X Signature key typo → silent webhook rejections later → P4 adds a signature-mismatch counter + alert log; modal copy warns seller.
- Plan gate bypass via direct action call → `canUse` runs server-side in action.
- Concurrent save races → follow `withTenantRowLock` if the xendit save doesn't use it keep parity (saveXenditKeys doesn't lock — plain `payload.update`; keep same).
