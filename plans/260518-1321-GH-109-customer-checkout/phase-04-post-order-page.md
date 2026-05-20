# Phase 04 — Post-Order Page + Magic Link Verify + Proof Upload

**Status:** pending | **Effort:** 3h | **Owner:** fullstack-developer | **Blocks:** Phase 02

## Overview
New route `/sites/[slug]/orders/[id]` serves as post-order summary for COD (receipt) and BT (bank details + proof upload). Access gated by JWT magic-link token. Customers can re-upload while status ∈ {awaiting_payment, pending_verification}.

## Related code files
- Create: `src/app/sites/[slug]/orders/[id]/page.tsx` — server component
- Create: `src/app/sites/[slug]/orders/[id]/UploadProofClient.tsx` — client subcomponent (file picker + POST)
- Create: `src/app/api/orders/[id]/verify-magic-link/route.ts` — GET endpoint to validate token (used by client polls)
- Create: `src/app/api/orders/[id]/upload-proof/route.ts` — POST endpoint for proof upload
- Reference: `src/lib/payment/jwt-magic-link.ts` (from Phase 02)

## Data flow
```
Customer email → magic link (?token=JWT)
  → page.tsx (server) verifies JWT → fetches order → renders
  → if BT + status in (awaiting_payment|pending_verification) → render <UploadProofClient>
  → user picks file → client POSTs to /api/orders/[id]/upload-proof (Authorization: Bearer <token>)
  → server: verify JWT → save media → update order.paymentProofImage + status='pending_verification'
  → revalidate page
```

## Page (server component) logic
1. Read `searchParams.token`. If missing or `verifyOrderToken` invalid → render `<AccessDenied>` (no order data leaked).
2. Token's `orderId` MUST equal `params.id` (else reject).
3. `payload.findByID({ collection: 'orders', id, overrideAccess: true })` — bypass auth since JWT is the auth.
4. Render branches:
   - COD (status='unpaid'): receipt view — items, total, "Cash on Delivery" badge, expected delivery placeholder.
   - BT awaiting_payment: bank details panel (sourced from `site.bankAccounts` — see open Q), `paymentReference`, countdown timer, upload widget.
   - BT pending_verification: "Receipt submitted. We'll confirm within 24h." + re-upload allowed.
   - BT cancelled (auto-cancel): "Order expired" message.
   - confirmed/shipped/completed: full status timeline.

## Upload endpoint
`POST /api/orders/[id]/upload-proof`
- Auth: `Authorization: Bearer <token>` header → verify via `verifyOrderToken`; token.orderId must match URL id.
- Body: `multipart/form-data` with `file` (image, max 5MB, types: jpg/png/webp).
- Steps:
  1. Verify token.
  2. Load order; reject if status NOT IN ('awaiting_payment', 'pending_verification').
  3. Upload to media collection: `payload.create({ collection: 'media', file })`.
  4. Update order: `paymentProofImage=mediaId`, status='pending_verification'.
  5. Fire-and-forget seller notification (reuse `notifyTenantOwners` pattern from Orders.ts afterChange).
  6. Return `{ success: true, mediaId, status: 'pending_verification' }`.

## Verify-magic-link endpoint
`GET /api/orders/[id]/verify-magic-link?token=...`
- Returns `{ valid: boolean, expired?: boolean, status?: string }`.
- Used by client UI to refresh state after upload (cheap poll).

## Bank account details source
Open Q: which collection holds seller bank details? Options:
- `site.bankAccounts` array — preferred (per-site flexibility).
- `tenant.bankAccounts` — simpler (one config per merchant).
- Fallback if neither configured: show generic placeholder + warn seller via admin notification.

Tentative: read `site.bankAccounts` first, fallback to `tenant.bankAccounts`. If both empty, render error "Bank details not configured — contact seller".

## Implementation steps
1. Create `page.tsx` server component with token verify + order fetch.
2. Create `UploadProofClient.tsx` — drag-drop file input, preview, progress, POST call with Bearer token.
3. Create upload-proof route with JWT verify + media create + order update.
4. Create verify-magic-link route (thin wrapper around `verifyOrderToken`).
5. Add countdown timer client component (`<PaymentExpiryCountdown expiresAt={...}/>`) — minute-granularity.
6. Add re-upload guard: if `status='pending_verification'`, show "Replace receipt" button.
7. Tailwind responsive: stack bank-details + upload on mobile.

## Edge cases
- Token valid but order already auto-cancelled → render "expired" state, no upload UI.
- File > 5MB → client-side reject before POST + server-side validate.
- Non-image upload → reject (server: check `file.mimetype`).
- Concurrent upload (double-click) → debounce client; server idempotent (latest wins, overwrites paymentProofImage).
- Re-upload after seller rejection → status goes awaiting_payment → pending_verification again (valid loop).

## Todo list
- [ ] Create page.tsx (server component, branch by status)
- [ ] Create UploadProofClient.tsx
- [ ] Create POST /api/orders/[id]/upload-proof
- [ ] Create GET /api/orders/[id]/verify-magic-link
- [ ] Create PaymentExpiryCountdown component
- [ ] Wire bank account details source (site→tenant→fallback)
- [ ] Mobile 375px check

## Success criteria
- Visiting `/sites/{slug}/orders/{id}` without token → access denied.
- Valid token + COD → receipt rendered.
- Valid token + BT awaiting_payment → bank details + paymentReference + upload widget visible.
- Upload proof → status flips to pending_verification, page reflects new state.
- Re-upload while pending_verification works.

## Risk
- Bank details config missing → user blocked. Mitigate with fallback message + seller alert.
- Media collection storage limit per tenant — already handled by existing media upload pipeline.
