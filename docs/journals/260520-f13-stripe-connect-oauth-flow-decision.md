---
title: "F13 Stripe Connect — OAuth Flow (Chuẩn) & Quyết định"
date: 2026-05-20
branch: feat/F13-963-payment-settings-stripe-fpx
scope: F13 Payment Gateway — Stripe Connect Onboarding
status: decision-locked / implemented
---

# F13 Stripe Connect — OAuth Flow (Chuẩn)

---

## Tại sao OAuth, không phải Account Links

| | Account Links | OAuth (đang dùng) |
|---|---|---|
| Merchant đã có Stripe account | ❌ Tạo account MỚI (duplicate, mất lịch sử) | ✅ Đăng nhập account cũ |
| Merchant chưa có account | ✅ | ✅ Signup ngay trên Stripe |
| Detect email tồn tại | ❌ Không — phải tự track | ✅ Stripe tự detect khi merchant nhập email |
| Malaysia Standard support | deprecated | deprecated (same, vẫn hoạt động) |

**Kết luận:** OAuth là lựa chọn duy nhất đúng khi cần support cả 2 loại merchant.

---

## PrimeWeb có cần biết merchant có account Stripe chưa không?

**Không cần và không nên.** Stripe tự detect khi merchant nhập email trên trang OAuth:

```
Merchant nhập email trên connect.stripe.com
    ├── Email đã có account Stripe → Stripe show login form
    └── Email chưa có             → Stripe show signup + KYC form
```

PrimeWeb chỉ biết kết quả SAU khi callback về — qua `accounts.retrieve()`.

---

## Flow hoàn chỉnh

```
[Settings > Payments — chưa connect]
            │
            ▼
    Click "Connect Stripe"
            │
            ▼
POST /api/stripe/connect/onboard
    └─ getStripeOAuthUrl(tenantId)
    └─ build: connect.stripe.com/oauth/authorize
              ?client_id=STRIPE_CLIENT_ID
              &scope=read_write
              &state=tenantId
              &prompt=login     ← luôn show login screen, không skip
            │
            ▼ redirect sang Stripe
┌─────────────────────────────────────────────┐
│  connect.stripe.com  (Stripe lo hoàn toàn)  │
│                                             │
│  Merchant nhập email                        │
│    ├── Có account → login → Authorize       │
│    └── Chưa có → signup + KYC → Authorize  │
└─────────────────────────────────────────────┘
            │
            ▼ Stripe redirect về
GET /api/stripe/connect/callback?code=xxx&state=tenantId
            │
            ├─ error param hoặc thiếu code/state
            │       └─ redirect ?stripe=refresh  (merchant thử lại)
            │
            └─ code + state hợp lệ
                    │
                    ▼
            exchangeOAuthCode(code)
            └─ stripe.oauth.token({ code })
            └─ stripe_user_id = "acct_xxx"   ← Account ID thực của merchant
                    │
                    ▼
            getConnectedAccountStatus("acct_xxx")   ← gọi ngay, non-fatal
            └─ stripe.accounts.retrieve("acct_xxx")
            └─ { chargesEnabled, detailsSubmitted }
                    │
                    ├─ chargesEnabled=true AND detailsSubmitted=true
                    │       └─ onboardingComplete = true
                    │       └─ redirect ?stripe=verified
                    │
                    └─ chargesEnabled=false (KYC pending / mới tạo)
                            └─ onboardingComplete = false
                            └─ redirect ?stripe=complete
            │
            ▼
payload.update(tenant, {
    stripeAccountId: "acct_xxx",
    stripeOnboardingComplete: <true | false>
})

─────────────────────────────────────────────────────────

[UI — PaymentsFormClient — sau redirect]

?stripe=verified
    → setIsVerified(true) + setHasAccount(true)
    → StripeConnectedBar hiện ngay
    → Card / FPX toggles unlock  ✅
    (không cần bấm Verify)

?stripe=complete
    → setHasAccount(true)
    → Show "Verify Connection" button
    → Merchant đợi Stripe approve KYC, rồi bấm Verify:
          GET /api/stripe/connect/status?tenantId
          → accounts.retrieve() → charges_enabled=true
          → update DB onboardingComplete=true
          → Toast "Connected!" + toggles unlock  ✅

?stripe=refresh
    → setHasAccount(true)
    → Toast warning — merchant thử connect lại

─────────────────────────────────────────────────────────

[Song song — Webhook async]
Stripe gửi account.updated (charges_enabled=true)
    → sync DB onboardingComplete=true  (backup path)
```

---

## Key values

| Item | Value |
|------|-------|
| Stripe Account ID | `acct_xxxxxxxxxxxxxxxxx` |
| Env — OAuth client | `STRIPE_CLIENT_ID` |
| Env — API calls | `STRIPE_SECRET_KEY` |
| Callback URL | `{NEXT_PUBLIC_SERVER_URL}/api/stripe/connect/callback` |
| OAuth scope | `read_write` |
| Account type | Standard (Malaysia — Express không support) |
| Redirect verified | `?stripe=verified` → connected bar ngay |
| Redirect pending | `?stripe=complete` → Verify button |
| Redirect error | `?stripe=refresh` → thử lại |

---

## Fix GH-963 — Callback auto-detect (plan `260520-1607`)

Bug cũ: `stripeOnboardingComplete` hardcode `false` sau mỗi connect, dù account đã fully verified.

Fix: gọi `getConnectedAccountStatus` ngay trong callback, set giá trị thực trước khi save DB.

Files thay đổi:
- `src/app/api/stripe/connect/callback/route.ts` — thêm status check
- `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx` — handle `?stripe=verified`
- `src/__tests__/api/stripe-connect-callback.test.ts` — rewrite theo real OAuth flow
