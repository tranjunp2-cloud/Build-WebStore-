# Phase 04 — Post-Order Upload Page (Storefront)

## Context Links

- PRD FR-16, FR-17, FR-18, BR-Payment-05, BR-Payment-06, AC-5, AC-9, §10.4
- Existing confirm page (reference layout): `src/app/sites/[slug]/order/[id]/confirm/page.tsx`
- Existing media upload endpoint: `POST /api/media` (used by CheckoutClient line 288)
- Site collection: `src/collections/Sites.ts` — has `merchantQrCode`, `bankName`, `bankAccountNo`, `bankAccountHolder`

## Overview

- **Priority:** P0
- **Status:** pending
- **Depends on:** P01 (schema), P02 (redirectUrl format), P03 (verifyOrderToken)
- **Description:** New route `/sites/[slug]/orders/[id]?token=<JWT>` for post-order payment proof upload. Server-renders state-conditional view; client handles file upload. Add PATCH endpoint to apply proof + transition status.

## Key Insights

- Persistent (server-rendered) route — buyer must be able to bookmark/refresh. Token re-verified on every load.
- Re-upload allowed in `awaiting_payment` AND `pending_verification` per BR-Payment-06.
- File upload reuses existing `/api/media` endpoint (returns mediaId); separate PATCH `/api/orders/:id/upload-proof` attaches it (avoids exposing collection PATCH publicly).
- Public endpoint (no `withAuth`) — gated by JWT verification against `magicLinkSecret`.

## Requirements

### Functional

- **Route:** `src/app/sites/[slug]/orders/[id]/page.tsx` (server component).
  - Validates `token` query against `order.magicLinkSecret` via `verifyOrderToken`.
  - 5 render states based on `paymentStatus` + token validity:
    1. **Token invalid/missing** → error page "Link Invalid" + CTA mailto seller / browse products.
    2. **Token expired** → "Link Expired" + same CTAs.
    3. **`awaiting_payment`** (token valid) → payment instructions + upload zone.
    4. **`pending_verification`** → "Awaiting Verification" + re-upload zone.
    5. **`paid`** → "Payment Confirmed" + Track / Continue Shopping CTAs.
    6. **`cancelled`** (TTL or post-reject expiry) → "Order Cancelled" + reason if set.
  - Renders countdown timer (computed `paymentExpiresAt - now`) — client hydrates with live timer.
- **Client component:** `UploadClient.tsx`
  - File picker + drag-drop (JPG/PNG/PDF ≤2MB — validators in `src/lib/storefront`).
  - Upload to `/api/media`, then PATCH `/api/orders/[id]/upload-proof` with `{token, mediaId}`.
  - On success: refresh page (server re-renders with `pending_verification`).
  - Re-upload allowed when status ∈ {awaiting_payment, pending_verification}.
- **API:** `POST /api/orders/[id]/upload-proof`
  - Body: `{ token: string, paymentProofImage: number|string }`.
  - Verify token against order's `magicLinkSecret`.
  - Require `paymentStatus IN ('awaiting_payment', 'pending_verification')` and `paymentExpiresAt > now`.
  - Update: `paymentProofImage`, `paymentStatus='pending_verification'`, clear `paymentRejectionReason`/`paymentRejectionDetail`.
  - Fire-and-forget: notify seller (existing `notifyTenantOwners` pattern) + optional email to seller.
  - Returns: `{success, data: { paymentStatus }}`.

### Non-Functional

- IDOR safe: token is the only access gate; order ID + slug confirm tenant scope via `findByID` cross-check.
- No PII in client-side bundle (initial server render passes minimal props).

## Architecture

```
GET /sites/[slug]/orders/[id]?token=JWT  (server)
  resolve site by slug
  payload.findByID(orders, id, overrideAccess=true, depth=1)
  cross-check order.site == site.id
  verifyOrderToken(token, order.magicLinkSecret)
  render <PostOrderUploadView state={...} order={sanitized} site={...} />
  └─ <UploadClient> if state ∈ {awaiting_payment, pending_verification}

POST /api/orders/[id]/upload-proof  (public, JWT-gated)
  parse body, verify token vs DB secret
  guard paymentStatus + paymentExpiresAt
  payload.update(orders, id, {paymentProofImage, paymentStatus:'pending_verification', paymentRejectionReason:null, paymentRejectionDetail:null})
  fire-and-forget notify seller
  return success
```

## Related Code Files

- **Create:** `src/app/sites/[slug]/orders/[id]/page.tsx`
- **Create:** `src/app/sites/[slug]/orders/[id]/UploadClient.tsx`
- **Create:** `src/app/sites/[slug]/orders/[id]/order-upload-styles.ts` (extract CSS-in-JS to keep page <200 lines per dev-rules)
- **Create:** `src/app/api/orders/[id]/upload-proof/route.ts`
- **Read:** `src/lib/auth/order-token.ts` (P03), `src/collections/Sites.ts` (paymentConfig)
- **Reuse:** `validatePaymentProof`, `PROOF_ACCEPTED_TYPES`, `PROOF_MAX_SIZE_BYTES` from `src/lib/storefront`
- **Reuse:** `notifyTenantOwners` from `src/lib/notifications/notify-tenant-owners`

## Implementation Steps

1. **Server page** (`page.tsx`):
   - Resolve `params.slug` → site (existing pattern from confirm page).
   - `payload.findByID('orders', id, overrideAccess: true, depth: 1)`.
   - If order.site !== site.id → `notFound()`.
   - If no token → `state = 'invalid_token'`.
   - Else `verifyOrderToken(token, order.magicLinkSecret)` → `'expired'` | `'invalid'` | ok.
   - If ok but `order.paymentStatus === 'cancelled'` → `state = 'cancelled'`.
   - Sanitize order for client (drop `magicLinkSecret`, `customerEmail`, internal notes — pass only display fields).
   - Pass `site.paymentConfig` fields (qrUrl, bankName, account#, holder) + `paymentReference`.
2. **UploadClient** (`'use client'`):
   - Receives `{ orderId, slug, token, status, paymentReference, total, currency, expiresAtIso, bankInfo, qrUrl }`.
   - Live countdown using `useEffect` setInterval.
   - File input → validate locally → `POST /api/media` (FormData) → `POST /api/orders/[id]/upload-proof` (JSON) → `router.refresh()`.
   - Error toasts via `sonner`.
3. **API route** (`upload-proof/route.ts`):
   ```ts
   export async function POST(req, ctx) {
     const { id } = await ctx.params
     const { token, paymentProofImage } = await req.json()
     if (!token || !paymentProofImage) return 400
     const payload = await getPayload({ config })
     const order = await payload.findByID({ collection:'orders', id, depth:0, overrideAccess:true })
     if (!order || !order.magicLinkSecret) return 404
     const v = await verifyOrderToken({ token, secret: order.magicLinkSecret })
     if (!v.ok) return 401 (error: v.error)
     if (String(v.orderId) !== String(id)) return 401
     if (!['awaiting_payment','pending_verification'].includes(order.paymentStatus)) return 422
     if (new Date(order.paymentExpiresAt) < new Date()) return 422 EXPIRED
     await payload.update({ collection:'orders', id, data:{ paymentProofImage, paymentStatus:'pending_verification', paymentRejectionReason:null, paymentRejectionDetail:null }, overrideAccess:true })
     // fire-and-forget seller notification
     return { success:true }
   }
   ```
4. **Style sheet** in separate file (keep page < 200 lines).
5. Integration tests:
   - Upload with valid token + awaiting_payment → 200 + DB transition.
   - Upload with valid token + paid → 422.
   - Upload with expired JWT → 401.
   - Upload with tampered JWT → 401.
   - Upload with wrong order id in JWT vs URL → 401.
   - Page render: invalid token shows error state; awaiting shows upload zone.

## Todo List

- [ ] `page.tsx` server component with 6 state branches
- [ ] `UploadClient.tsx` with countdown + upload flow
- [ ] Extract CSS to sibling file to respect 200-line rule
- [ ] `POST /api/orders/[id]/upload-proof` route
- [ ] Integration test suite (6 cases above)
- [ ] Manual E2E: full flow from email → upload → seller sees pending
- [ ] Verify GET `/api/orders/:id` (authed) never returns `magicLinkSecret`
- [ ] Commit: `feat(orders): post-order magic-link upload page + proof api`

## Success Criteria

- AC-5 (upload happy path) passes.
- AC-9 (invalid/expired token shows error) passes.
- AC-4 redirect target works (no 404 after checkout).
- Re-upload during `pending_verification` succeeds and replaces media reference.
- `magicLinkSecret` never appears in any HTTP response body (verified via test).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Buyer uploads junk image (low quality / wrong) → seller burden | H | M | Out of scope to detect — seller Reject flow handles. Anti-fraud advisory in UI. |
| Race: cron cancels order while buyer mid-upload | L | M | Upload route checks `paymentExpiresAt > now`; if expired during upload, return 422 + UI shows "Order Expired". |
| `/api/media` returns mediaId that's not owned by site (cross-tenant write) | L | M | Media endpoint already access-controlled by Payload; mediaId attached only to this order document. |
| Token visible in browser history / referer logs | M | L | Buyer responsibility; expiry mitigates. Optional later: rotate token on first use (out of scope). |

## Security Considerations

- Public endpoint — only JWT + secret per order gates access.
- Path param `id` must match `sub` in token (defense in depth).
- Status guard prevents writes to terminal states (`paid`/`cancelled`).
- `notifyTenantOwners` must not include token in metadata.

## Next Steps

Final user-facing surface. After P05+P06 land, full v2.2 flow operational.
