# F36 Docs Correction Brief — As-Built Source of Truth

> Purpose: single authoritative reference for correcting F36 docs drift.
> Branch: `feat/1333-F36-easyparcel-delivery`. Verified against code 2026-07-01.
> **Build status: only Phase A (Connect+Settings) + Phase B (Rate@Checkout) are implemented. Phase C (Fulfillment: label/pickup/tracking-sync) and Phase D (Returns) are NOT built.**

## Editing policy (ALL docs)

1. **Match code for Phase A+B.** Everything about connect, OAuth, settings UI, rate@checkout, COD-at-rate must reflect the as-built facts below.
2. **Keep Phase C/D as roadmap** (do NOT delete). Add a clear status marker at the top of each Phase C/D section, e.g. a blockquote: `> **⚠️ NOT BUILT (as of 2026-07-01) — Phase A+B only. This section is forward-looking design; no code exists yet.**`
3. **Fix real contradictions even inside future sections** where code already decided the contract (phone format, COD param, courier list, tracking endpoint, account API method).
4. **PRD = decisions, not logs (project rule #7).** Do NOT write "changed on DATE", "was X now Y", "removed", strikethrough, or revision narration. Just rewrite to the current truth. Git holds history.
5. **Preserve** Vietnamese prose style, tables, anchors (`<a id=...>`), and cross-doc links. Keep line count reasonable; don't bloat.
6. Currency/unit invariants (sen↔RM /100, grams↔kg /1000) remain valid — keep.

---

## AS-BUILT FACTS (authoritative)

### Auth (OAuth 2.0 — mostly matches PRD, correct these details)
- Routes: `GET /api/tenant/[id]/easyparcel-oauth-start` → sets HttpOnly cookie `ep_state_{tenantId}` (nonce), redirects to `https://api.easyparcel.com/oauth/login?client_id=…&redirect_uri=…&state={tenantId}:{nonce}`.
- Callback: `GET /api/easyparcel/oauth-callback?code=&state=` → verify nonce → `POST /oauth/token` (Basic auth `CLIENT_ID:CLIENT_SECRET`) → then `GET /account/get_account_information`. Redirects to `/settings/shipping?ep=connected`.
- Env vars: `EASYPARCEL_CLIENT_ID`, `EASYPARCEL_CLIENT_SECRET`, `EASYPARCEL_REDIRECT_URI`.
- Token refresh: `getValidToken()` auto-refreshes when <60s to expiry; throws `AUTH_EXPIRED` (needs reconnect).
- **Base URL:** `EP_API_BASE = https://api.easyparcel.com`; API path prefix `/open_api/2026-03/`. **No sandbox/prod URL switching exists** — single base URL. (Correct PRD §8 "Sandbox = same base URL" is roughly true but note no env toggle in code.)

### API routes (ACTUAL — replace any `create-label`/`cron` claims for Phase A/B context)
| Route | Method | Purpose |
|---|---|---|
| `/api/tenant/[id]/easyparcel-oauth-start` | GET | Start OAuth |
| `/api/easyparcel/oauth-callback` | GET | Token exchange + account sync |
| `/api/tenant/[id]/easyparcel-save` | POST | Save `{ enabled, warehouses[], selectedCourier }` |
| `/api/tenant/[id]/easyparcel-test` | POST | Test conn `{ syncWarehouse? }` → balance, accountName, accountEmail, pickupAddress; **rate-limited 3/60s/tenant** |
| `/api/tenant/[id]/easyparcel-couriers` | GET | Live courier list (country=MY) + wallet |
| `/api/tenant/[id]/easyparcel-disconnect` | DELETE | Clear tokens, disable, keep warehouse/courier |
| `/api/orders/calculate-shipping` | POST | Hybrid rate (EP or flat fallback) |
- **NOT built:** `/api/orders/[id]/create-label`, `/api/cron/sync-tracking`. Any doc mention → move under Phase C "NOT BUILT" marker.

### EP API client endpoints (ACTUAL)
- `POST /oauth/token`
- `POST /open_api/2026-03/shipment/quotations` — body `{ shipment: [{ sender, receiver, parcel_value(RM float), weight(kg), width?/length?/height? }] }`
- `POST /open_api/2026-03/shipment/submit_orders` — body includes `cod_amount?`(RM float) + `feature{ sms_tracking?, email_tracking?, whatsapp_tracking? }`. Response `awb_number` may be null (async).
- `GET  /open_api/2026-03/shipment/tracking?tracking_number=…` — **single GET; there is NO webhook, NO `/shipment/details`, NO `/shipment/tracking_status`, NO `/shipment/list` in code.**
- `POST /open_api/2026-03/shipment/cancel`
- `GET  /open_api/2026-03/wallet` — **wallet is an ARRAY per currency**, not single object.
- `GET  /open_api/2026-03/account/get_account_information` — **GET, not POST**; email lives per-address (`pickup_address.email`), addresses `{}` until configured in EP.
- `GET  /open_api/2026-03/courier/list?country_code=MY`
- Timeout 10s; retry only on 5xx + network errors (not 4xx).
> PRD §8 tracking description (webhooks topics 1/2/3 + POST /shipment/details + /tracking_status) is **forward-looking / not implemented**. Current code = polling `GET /shipment/tracking`. Move webhook design under Phase C "NOT BUILT" marker; correct the "primary = webhooks" claim to "planned; current impl = GET /shipment/tracking".

### Tracking status (correct PRD §8 numeric-code claim)
- Code maps EP **raw string** status → internal enum + buyerLabel via `mapTrackingStatus()` (`status-map.ts`). It does **not** use numeric codes (0,2,3,4,5…). Correct any "numeric status code" wording.
- `Orders.shippingTrackingStatus` enum (13): `order_created, pending_pickup, picked_up, in_transit, out_for_delivery, delivered, failed_delivery, returned_to_sender, lost, cancelled, exception, processing, unknown`.

### Data model — `Tenants.easyParcelIntegration` (add missing fields)
`enabled`(checkbox), `accessToken`*, `refreshToken`*, `tokenExpiresAt`*, `tokenRefreshExpiresAt`* (all server-only, `access.read=false`), `warehouse`(json, **legacy single**), `warehouses`(json, **current ARRAY**), `selectedCourier`(text), `testedAt`(readOnly), `accountName`(readOnly), `accountEmail`(readOnly).
- Warehouse object: `{ id?, label?, phone, address1, address2?, city, state, postcode, country, isDefault? }`.
- **Multi pickup addresses ARE supported** (add/edit/delete, one `isDefault`). Correct docs that say "single origin only / multi-warehouse out of scope" → now: multiple pickup addresses stored; one default is the courier pickup origin. (Still no multi-*warehouse-per-order* routing.)

### Orders fields (as-built, confirm in design)
`trackingNumber, shippingCourier, shippingServiceId, awbNo(index), easyParcelOrderNo(hidden), labelUrl(hidden), shippingTrackingStatus(13-enum), shippingTrackingLastUpdated, parcelWeight(grams), codAmount(sen), codStatus(pending/collected/settled), shippingTrackingHistory(array)`.
- **Return fields** (`return_tracking`, `return_fee_by`, `return_fee`) are **NOT present** → still deferred (design §10 open question stays open; keep under Phase D NOT BUILT).

### Products fields
`weight`(grams), `dimensions{length,width,height}`(cm). Matches design.

### Normalize/transform functions (ACTUAL — correct design §9.4)
- `normalizePhone(raw)` → **`"60XXXXXXXXX"` (60-prefix)**. `splitPhone(raw)` → `{ countryCode: "60", number }`. **Design's `"MY"` country code + leading-`0` `"0122134567"` is WRONG.** Rewrite to 60-prefix split. (Code is source of truth for shipped behavior.)
- `aggregateWeightKg(weightGrams)` → grams/1000, **min floor 0.1 kg, round UP to 1 decimal** (not 2). Signature takes already-summed grams, not an items array.
- `mapSubdivisionCode(stateName)` / `mapSubdivisionName(code)` — bidirectional ISO 3166-2 map. State table in design §9.3 is correct; function name is `mapSubdivisionCode`, not `mapToISO3166_2`.
- `earliestPickupDate(courier, nowUtc?)` → "YYYY-MM-DD" MYT, cut-off aware, skips weekends. Cut-offs: **JNT 13:50, Flash 14:00, PosLaju 12:50, default 12:00** (`normalize.ts`).

### COD (correct PRD "fully deferred" claim)
- COD is **partially implemented**: `calculate-shipping` accepts `codAmountSen`; rate response returns `codAvailable` + `codMaxSen`; `submit_orders` sends `cod_amount`(RM float); Orders schema has `codAmount`(sen)+`codStatus`. West-MY-only logic present.
- **Resolved:** COD param name = `cod_amount` (RM float in submit) — PRD §8/§9 "param unverified" is now answered by code. Update.
- Still NOT built: the create-label modal UI + full COD settlement flow (part of Phase C, keep under NOT BUILT).

### Courier picker (correct "4 couriers only" claim)
- `CourierPicker` fetches the **full live courier list** from `/courier/list?country_code=MY` — **no hardcoded 4-courier (Flash/DHL/J&T/Aramex) restriction**. Single-select `selectedCourier` (examples: "flash", "jnt", "poslaju"). Warns if wallet < RM10.
- Correct PRD §3 note + design §2.1 courier RadioGroup "4 couriers only / no See-more" → now: all live couriers listed, single select.

### Checkout (correct "no courier branding" claim)
- Recent commits show live EP rate **with courier name + logo** at checkout, plus COD fallback. Design §2.2 "KHÔNG courier branding / 1 dòng Shipping" is outdated → checkout now surfaces the courier + logo for the selected/cheapest rate. `calculate-shipping` returns a `rates[]` array (courier, serviceId, courierName, serviceName, priceSen, codAvailable, codMaxSen, estDelivery) + backward-compat `fee`.

### Constants
`SHIPPING_DEFAULTS`: west 800 / east 1500 / freeAbove 10000 (sen). `HINT_HIGHLIGHT_THRESHOLD` 5000. `RATE_MAX` 100000. `LOW_WALLET_THRESHOLD` ~RM10.
- Note: PRD §3 "recommend West 1000 / East 1600" is a **recommendation NOT applied** — code still 800/1500. Keep recommendation but mark it not-yet-applied (or drop if noise).

### Known gaps to reflect (as "NOT BUILT / pending")
Fulfillment endpoint (create-label), cron tracking-sync, webhooks, sandbox/prod URL toggle, token encryption-at-rest, return-fields DB. All Phase C/D or hardening — keep as roadmap with NOT BUILT marker.

---

## Design doc header fixes (design file only)
- Line ~7: stories link says "_(planned — chưa tạo)_" but `docs/stories/F36-easyparcel-delivery-stories.md` **exists** → remove "chưa tạo".
- Architecture doc `docs/architecture/F36-easyparcel-delivery.md` still does NOT exist → keep "(planned — chưa tạo)".
