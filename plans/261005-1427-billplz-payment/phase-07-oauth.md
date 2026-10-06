---
phase: 7
title: "OAuth Connect (stretch — blocked on partner access)"
status: pending
priority: P2
effort: "8h + external wait"
dependencies: [2]
story: US-F43-07
branch: feat/F43-07-billplz-oauth-connect
stretch: true
blockedBy: [billplz-partner-credentials]
---

# Phase 7: OAuth Connect *(stretch — blocked)*

## Overview

Replace manual key entry with a "Connect Billplz" button: Doorkeeper `authorization_code` grant against `dashboard.billplz.com/oauth/*` (probed — see research.md §Phase 2). **Scope discipline: step 1 is outreach + contract confirmation, not speculative code.** Generic plumbing (state sign, token exchange, callback skeleton) is buildable, but the credentials-retrieval contract is unknown (3 hypotheses) — write the adapter only after Billplz answers, or it ships dark code written to be rewritten.

## Requirements

- Functional: `GET /api/billplz/connect/start` → authorize URL with signed state; `GET /api/billplz/connect/callback` → verify state → exchange code → fetch merchant credentials → store on tenant → redirect `?billplz=connected`; disconnect revokes token.
- Non-functional: **state = `tenantId:nonce:exp` — single-use nonce (stored server-side, e.g. `tenants.billplzOauthState` or a short-TTL table/cache) + ~10min expiry + HMAC**. Do NOT clone Stripe's `HMAC(tenantId)` verbatim: it is deterministic and eternal — a leaked state (dashboard server logs, browser history, Referer) lets an attacker complete OAuth against *their own* Billplz account and write *their* credentials onto the victim tenant (silent fund diversion). Tokens/keys server-only; refresh handling per discovered TTL.

## Architecture

```
POST/GET /api/billplz/connect/start   (withAuth + withFeatureGuard('payment_integration'))
  → nonce = crypto.randomUUID(); exp = now+10min
  → persist nonce on tenant (single-use — consume-and-delete at callback)
  → state = tenantId:nonce:exp + '_' + HMAC(tenantId|nonce|exp)  (new signing fn — stripe-oauth.ts pattern upgraded)
  → redirectUri = {NEXT_PUBLIC_SERVER_URL}/api/billplz/connect/callback
  → url = {BILLPLZ_OAUTH_BASE}/oauth/authorize?client_id={BILLPLZ_CLIENT_ID}
        &redirect_uri=…&response_type=code&scope={BILLPLZ_OAUTH_SCOPE}&state=…
  → {success, data:{oauthUrl}} (same contract as stripe onboard)

GET /api/billplz/connect/callback?code&state
  → verify HMAC + exp + nonce matches tenant's stored nonce → delete nonce (single-use)
    (unauthenticated route — state IS the auth; nonce makes replay impossible)
  → POST {BILLPLZ_OAUTH_BASE}/oauth/token
      grant_type=authorization_code&code&redirect_uri
      auth: client_id/secret — try Basic header first, body params fallback (Doorkeeper accepts both)
  → {access_token, refresh_token?, expires_in, ...}
  → fetchMerchantCredentials(access_token)  ← ADAPTER: only unknown piece
      hypothesis (a): Bearer on www.billplz.com/api/* → call a me/collections endpoint
      hypothesis (b): partner credentials endpoint → GET returns {api_key, x_signature_key, collections[]}
      hypothesis (c): token response embeds credentials
      → implement behind `BILLPLZ_CREDENTIALS_ENDPOINT` env + narrow adapter fn
  → if multiple collections → picker step (or first/default — decision at build time per actual response)
  → payload.update tenant {billplzApiKey, billplzCollectionId, billplzXSignatureKey, billplzOauthAccessToken?, billplzOauthRefreshToken?, billplzOauthExpiresAt?}
  → redirect /settings/payments?billplz=connected
```

### Env vars (both `.env.*.example`)

`BILLPLZ_CLIENT_ID`, `BILLPLZ_CLIENT_SECRET`, `BILLPLZ_OAUTH_BASE` (`https://dashboard.billplz.com` / sandbox equivalent), `BILLPLZ_OAUTH_SCOPE`, `BILLPLZ_CREDENTIALS_ENDPOINT` (if hypothesis b).

### UX

`BillplzConnectBlock` gains OAuth mode: if `BILLPLZ_CLIENT_ID` configured → "Connect Billplz" button (new tab + BroadcastChannel `billplz-connect-${tenantId}` + polling `/api/billplz/connect/status` — clone Stripe polling/return-param handling wholesale); manual-keys modal stays as fallback link ("or enter keys manually").

### Disconnect

`POST /oauth/revoke` best-effort + null all billplz* fields (incl. oauth tokens if stored).

### Tenant fields

- `billplzOauthState` (text, `access.read:false`, + migration) — stores the single-use nonce for the in-flight OAuth flow. Needed by the skeleton regardless of hypothesis.
- `billplzOauthAccessToken`, `billplzOauthRefreshToken`, `billplzOauthExpiresAt` — `access.read:false` + migrations — **only if hypothesis (a) confirmed**; if (b)/(c) instead → tokens may not need persisting at all (keys are enough).

## Related Code Files

- Create: `src/app/api/billplz/connect/{start,callback,status}/route.ts`, `src/lib/payment/billplz-oauth.ts`
- Modify: `BillplzConnectBlock/ConnectedBar`, `PaymentsFormClient` (billplz return params), `Tenants.ts` (oauth token fields if needed), `db-setup.js`, env examples

## Implementation Steps (sequenced to kill speculation)

1. **First — outreach (this can happen before any code):** email `team@billplz.com` with frozen `redirect_uri` (`{domain}/api/billplz/connect/callback`, registered exactly — Doorkeeper enforces exact match), requested scopes, and the question list from research.md §Phase 2. Request **two apps**: sandbox (`localhost:3000` + staging domain URIs, money-fake) and prod (prod domain only).
2. Build only the **contract-free skeleton** behind `BILLPLZ_CLIENT_ID` flag: start/callback route shells, single-use state sign/verify + storage field, token-exchange client (Basic-header + body-params fallback), disconnect → revoke. No `fetchMerchantCredentials` implementation, no oauth-token tenant fields yet.
3. **On Billplz's answer**, implement `fetchMerchantCredentials(accessToken)` for the confirmed hypothesis — P1's `BillplzAuth` union already makes hypothesis (a) a call-site change, not a rewrite. Add `billplzOauth*` tenant fields + migrations only if hypothesis (a) needs them (deferring them avoids dead schema if (b)/(c) wins).
4. Wire envs on Vercel (sandbox app → staging; prod app → production), E2E the connect flow on staging, then enable flag in prod.

## Success Criteria

- [ ] Seller clicks Connect → Billplz login → consent → returns connected with keys populated (no manual copy)
- [ ] Tampered state → rejected; missing/invalid code → clean error redirect `?billplz=error`
- [ ] Disconnect revokes + clears; re-connect works
- [ ] Feature-flagged: absent env → UI indistinguishable from Phase 2 manual flow

## Risk Assessment

- **External blocker**: whole phase ships dark until partner access granted — acceptable since it's the last-mile UX polish over the working manual flow.
- Token semantics unknown → adapter isolates; worst case rework confined to `fetchMerchantCredentials`.
- `redirect_uri` exact-match → must freeze callback path BEFORE emailing Billplz; this plan freezes it as `/api/billplz/connect/callback`.
- Refresh-token expiry could silently kill API access if hypothesis (a) — surface `billplzOauthExpiresAt` + re-auth prompt if stored token expired.
