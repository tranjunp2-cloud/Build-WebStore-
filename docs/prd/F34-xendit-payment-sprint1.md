# PRD: F34 — Xendit Sprint 1 — Merchant Onboarding (MANAGED sub-account) + KYB

> **Version:** 2.0 (Draft) | **Updated:** 2026-06-10 | **Owner:** Domin (Product)
> **Priority:** P1 | **Wave:** 7 | **Size:** M | **Effort:** ~1 tuần
> **Overview:** [F34 Overview](./F34-xendit-payment-overview.md)
> **Depends on:** Phase 0 (Xendit sales + DPA) ✅ MUST
> **Spec source (authoritative):** `docs/business/accounts.yaml` (XenPlatform OpenAPI) + docs.xendit.co
> **Reuse:** `src/app/(dashboard)/settings/payments/*` (mirror Stripe block UI)

---

> [!IMPORTANT]
> **v2.0 correction (theo spec thật):** XenPlatform MANAGED ở **Malaysia KHÔNG có hosted-redirect KYB và KHÔNG dùng in-app Verification API** (Verification API chỉ hỗ trợ OWNED ở PH/TH/ID). KYB của MANAGED ở MY **bắt buộc qua email-invite + Xendit Dashboard**. Sprint 1 vì vậy **đơn giản hơn**: ta chỉ tạo account + theo dõi status qua webhook; merchant tự verify trên Xendit. Bỏ state-HMAC + return route (không còn redirect).

---

## 1. Problem Statement

- Merchant chưa có Xendit account → không nhận tiền ví MY.
- Mô hình **MANAGED sub-account**: platform tạo account qua API; transaction route bằng header `for-user-id`; tiền vào balance sub-account.
- Xendit yêu cầu KYB trước khi merchant `LIVE` (nhận tiền). MY: merchant **nhận email mời → accept (`REGISTERED`) → nộp doc trên Xendit Dashboard → `LIVE`**.
- Cần lưu + theo dõi account status để Sprint 2 (checkout) biết merchant đã `LIVE` chưa.

## 2. Target User

- **SME Owner (Persona A):** bấm "Connect Xendit" trong dashboard, biết rõ đang ở bước nào (chưa connect / chờ nhận email / chờ duyệt / sẵn sàng).
- **Platform:** tạo account qua API, nhận webhook status, gate checkout theo `LIVE`.

## 3. Solution Overview (theo spec thật)

1. Merchant bấm "Connect Xendit" → backend `POST /v2/accounts` (`type=MANAGED`, `public_profile.business_name`).
2. Lưu `id` trả về thành `xenditAccountId`. **Chờ webhook `account.created`** trước khi cho transact.
3. Xendit **tự gửi email mời** tới email merchant → merchant accept → status `REGISTERED`.
4. Merchant **nộp business docs trên Xendit Dashboard** (MY: toàn bộ trên dashboard) → `AWAITING_DOCS` → `PENDING_VERIFICATION`.
5. Duyệt xong → webhook **`account.activated`** → status `LIVE` → set `xenditOnboardingComplete=true`.
6. Settings UI hiển thị status realtime (map từ Xendit) + hướng dẫn "kiểm tra email để verify".

> **Routing:** mọi API call cho merchant đính header **`for-user-id: {xenditAccountId}`** → tiền vào sub-account (không cần API key riêng từng merchant).
> **Bỏ so với v1:** state-HMAC + `/onboard/return` redirect route (không có redirect trong flow thật).

## 4. Functional Requirements

| FR | Mô tả | Story Ref |
|----|-------|-----------|
| **FR-1** | "Connect Xendit" button trong `settings/payments` cho tenant chưa có `xenditAccountId`. | US-F34-01 |
| **FR-2** | `POST /api/xendit/connect` gọi `POST /v2/accounts` (MANAGED, business_name từ tenant); lưu `xenditAccountId`, `xenditAccountStatus='INVITED'`. | US-F34-01 |
| **FR-3** | Idempotent: tenant đã có `xenditAccountId` → KHÔNG tạo account mới; chỉ refresh status. | US-F34-01 |
| **FR-4** | Set Xendit callback URL (qua `/callback_urls/{type}` hoặc Dashboard config) trỏ về `/api/webhooks/xendit`. | US-F34-03 |
| **FR-5** | Webhook `account.created` → xác nhận account sẵn sàng transact (lưu cờ). | US-F34-03 |
| **FR-6** | Webhook `account.activated` → `xenditAccountStatus='LIVE'`, `xenditOnboardingComplete=true`. | US-F34-03 |
| **FR-7** | Webhook account status update (REGISTERED/AWAITING_DOCS/PENDING_VERIFICATION/SUSPENDED) → cập nhật `xenditAccountStatus`. | US-F34-03 |
| **FR-8** | Settings UI map status → 4 trạng thái user-facing: chưa connect / chờ verify (check email) / đang duyệt / sẵn sàng (LIVE); SUSPENDED → cảnh báo đỏ. | US-F34-02 |
| **FR-9** | `GET /api/xendit/connect/status?tenantId=` đọc status (cached) cho settings; refresh on-demand gọi `GET /v2/accounts/{id}`. | US-F34-02 |
| **FR-10** | Xendit API lỗi → log + error code rõ (`XENDIT_CONNECT_FAILED`), không lộ secret, tenant không kẹt trạng thái sai. | US-F34-01 |

## 5. Non-Functional Requirements

| NFR | Yêu cầu | Mức |
|-----|---------|-----|
| **NFR-1** | Webhook verify `x-callback-token` (timing-safe) trước khi xử lý — token Xendit cấp/ business. | P0 |
| **NFR-2** | Secrets ở Vercel Dashboard: `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`. Thêm `.env.staging.example` + `.env.production.example`. | P0 |
| **NFR-3** | Rate limit `/v2/accounts` ≤ 5 write/s (spec) → không tạo account hàng loạt vượt ngưỡng. | P1 |
| **NFR-4** | KYB data **không qua server ta** (merchant nộp trên Xendit Dashboard) → PDPA nhẹ. | P0 |
| **NFR-5** | Settings load < 1s dùng cached status; refresh là hành động riêng. | P1 |

## 6. Acceptance Criteria (GIVEN/WHEN/THEN)

1. **AC-1** GIVEN tenant chưa có `xenditAccountId` WHEN mở settings/payments THEN thấy "Connect Xendit".
2. **AC-2** GIVEN bấm Connect WHEN `POST /v2/accounts` thành công THEN `xenditAccountId` lưu, status `INVITED`, UI báo "Đã gửi email mời — kiểm tra hộp thư để verify".
3. **AC-3** GIVEN đã có `xenditAccountId` WHEN bấm Connect lần nữa THEN KHÔNG tạo account mới (idempotent).
4. **AC-4** GIVEN webhook `account.created` WHEN nhận THEN account đánh dấu sẵn sàng transact (nhưng chưa LIVE).
5. **AC-5** GIVEN merchant accept email WHEN webhook status đổi THEN `xenditAccountStatus='REGISTERED'`, UI báo "Đang chờ nộp/duyệt hồ sơ".
6. **AC-6** GIVEN merchant nộp doc xong Xendit duyệt WHEN webhook `account.activated` THEN `xenditAccountStatus='LIVE'`, `xenditOnboardingComplete=true`, badge xanh.
7. **AC-7** GIVEN status `AWAITING_DOCS`/`PENDING_VERIFICATION` WHEN xem settings THEN banner vàng tương ứng + link Xendit Dashboard.
8. **AC-8** GIVEN webhook `x-callback-token` sai WHEN gọi THEN 401, KHÔNG cập nhật tenant nào.
9. **AC-9** GIVEN `account.suspended` WHEN nhận THEN `xenditAccountStatus='SUSPENDED'`, cảnh báo đỏ, Sprint 2 chặn checkout.
10. **AC-10** GIVEN Xendit API timeout WHEN connect THEN `XENDIT_CONNECT_FAILED`, tenant không bị set sai.
11. **AC-11** GIVEN status ≠ `LIVE` WHEN Sprint 2 checkout THEN bị chặn `XENDIT_NOT_READY` (hook Sprint 2).
12. **AC-12** GIVEN `XENDIT_SECRET_KEY` chưa set WHEN connect THEN throw config error rõ, không 500 mơ hồ.

## 7. Architecture & Code

### 7.1 Schema (migrations — `scripts/db-setup.js` MIGRATIONS array)

> Pattern: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (xem `tenants.stripe_account_id`). NEVER `DROP`.

```js
{ name: 'tenants.xendit_account_id',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_account_id varchar;` },
{ name: 'tenants.xendit_account_id_idx',
  sql: `CREATE INDEX IF NOT EXISTS tenants_xendit_account_id_idx ON tenants (xendit_account_id);` },
{ name: 'tenants.xendit_account_status',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_account_status varchar DEFAULT 'NOT_CONNECTED';` },
{ name: 'tenants.xendit_onboarding_complete',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS xendit_onboarding_complete boolean DEFAULT false;` },
```

### 7.2 Collection fields (`src/collections/Tenants.ts`) — mirror `stripeAccountId`

```ts
{
    name: 'xenditAccountId',
    type: 'text',
    index: true,
    admin: { readOnly: true, description: 'Xendit MANAGED account id (dùng làm for-user-id header)' },
},
{
    name: 'xenditAccountStatus',
    type: 'select',
    defaultValue: 'NOT_CONNECTED',
    options: [
        // Xendit status thật (accounts.yaml) + NOT_CONNECTED nội bộ
        { label: 'Not Connected', value: 'NOT_CONNECTED' },
        { label: 'Invited', value: 'INVITED' },
        { label: 'Registered', value: 'REGISTERED' },
        { label: 'Awaiting Docs', value: 'AWAITING_DOCS' },
        { label: 'Pending Verification', value: 'PENDING_VERIFICATION' },
        { label: 'Live', value: 'LIVE' },
        { label: 'Suspended', value: 'SUSPENDED' },
    ],
    admin: { readOnly: true, description: 'Xendit account lifecycle status' },
},
{
    name: 'xenditOnboardingComplete',
    type: 'checkbox',
    defaultValue: false,
    admin: { readOnly: true, description: 'true khi status = LIVE (nhận tiền được)' },
},
```

### 7.3 xendit.ts — create account + status (mirror stripe-client singleton)

```ts
// src/lib/payment/xendit.ts (file mới — 0 sửa Stripe)
const XENDIT_BASE = 'https://api.xendit.co'

function authHeader(): string {
    const key = process.env.XENDIT_SECRET_KEY
    if (!key) throw new Error('XENDIT_SECRET_KEY is not set')
    return 'Basic ' + Buffer.from(`${key}:`).toString('base64') // BasicAuth, key + empty password
}

/** POST /v2/accounts — tạo MANAGED sub-account. Trả id để dùng làm for-user-id. */
export async function createManagedAccount(businessName: string, email: string): Promise<{ id: string; status: string }> {
    const res = await fetch(`${XENDIT_BASE}/v2/accounts`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'MANAGED', public_profile: { business_name: businessName } }),
    })
    if (!res.ok) throw new Error(`XENDIT_CONNECT_FAILED: ${res.status}`)
    const d = await res.json()
    return { id: d.id, status: d.status } // status: INVITED
}

/** GET /v2/accounts/{id} — refresh status. */
export async function getAccountStatus(accountId: string): Promise<string> {
    const res = await fetch(`${XENDIT_BASE}/v2/accounts/${accountId}`, { headers: { Authorization: authHeader() } })
    if (!res.ok) return 'NOT_CONNECTED'
    return (await res.json()).status
}

/** Header cho mọi transaction call cho merchant này (checkout/refund/payout — Sprint 2/3). */
export function forUserId(accountId: string): Record<string, string> {
    return { 'for-user-id': accountId }
}
```

### 7.4 Webhook verify (dùng chung Sprint 2) — `x-callback-token`

```ts
import { timingSafeEqual } from 'crypto'
export function verifyXenditWebhook(request: Request): boolean {
    const token = request.headers.get('x-callback-token') ?? ''
    const secret = process.env.XENDIT_WEBHOOK_TOKEN
    if (!secret) throw new Error('XENDIT_WEBHOOK_TOKEN is not set')
    const a = Buffer.from(token), b = Buffer.from(secret)
    return a.length === b.length && timingSafeEqual(a, b)
}
```

### 7.5 Files

**Create:**
- `src/lib/payment/xendit.ts` — `createManagedAccount`, `getAccountStatus`, `forUserId`, `verifyXenditWebhook`.
- `src/app/api/xendit/connect/route.ts` — `POST` tạo account (idempotent).
- `src/app/api/xendit/connect/status/route.ts` — `GET` status (cached + refresh).
- `src/app/api/webhooks/xendit/route.ts` — verify token + xử lý `account.created`/`account.activated`/status/suspended (extend ở Sprint 2 cho payment events).
- `src/app/(dashboard)/settings/payments/XenditConnectBlock.tsx` — UI (mirror `StripeConnectBlock.tsx`).

**Modify:**
- `src/collections/Tenants.ts` — 3 fields trên.
- `scripts/db-setup.js` — 4 migrations.
- `src/app/(dashboard)/settings/payments/page.tsx` + `actions.ts` — render Xendit block.
- `.env.staging.example` + `.env.production.example` — `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`.

> **Bỏ:** `xendit-client.ts` riêng (dùng fetch + BasicAuth đủ, KISS), state-HMAC, `/onboard/return` route.

## 8. Implementation Steps

1. Migrations + Tenants fields (atomic commit). → verify: `node scripts/check-migrations.js` pass.
2. `xendit.ts` (createManagedAccount + getAccountStatus + verify). → verify: unit test BasicAuth header, verify token đúng/sai.
3. `api/xendit/connect` + `connect/status` (idempotent). → verify: integration test tạo account (mock fetch), không tạo 2 lần.
4. `webhooks/xendit` xử lý account.* events. → verify: `account.activated` → onboardingComplete; token sai → 401.
5. `XenditConnectBlock.tsx` + wire settings (4 trạng thái). → verify: render đúng theo status.

## 9. Todo

- [ ] Migrations + Tenants fields (account_id, account_status, onboarding_complete)
- [ ] xendit.ts (createManagedAccount, getAccountStatus, forUserId, verifyXenditWebhook)
- [ ] api/xendit/connect + connect/status
- [ ] webhooks/xendit account.* handling
- [ ] XenditConnectBlock.tsx + settings wiring
- [ ] env examples + Vercel Dashboard vars + Xendit callback URL config
- [ ] Tests (TC-F34.1xx)

## 10. Success Criteria

- Connect → `POST /v2/accounts` → email mời gửi → status track qua webhook → `LIVE` hiển thị đúng.
- Webhook spoof bị chặn (AC-8).
- `check-migrations.js` + `check-env-vars.js` pass.
- 0 sửa file Stripe.

## 11. Risks

| Risk | Mức | Mitigation |
|------|-----|------------|
| Merchant không nhận/không accept email mời → kẹt INVITED | Trung bình | UI nhắc rõ + nút "Gửi lại email" (gọi lại Xendit); poll status |
| Webhook callback URL cấu hình sai → không cập nhật status | Cao | Fallback `GET /v2/accounts/{id}` refresh on settings load |
| `account.created` chưa về mà đã transact (Sprint 2) | Cao | Gate Sprint 2 bằng `xenditAccountStatus='LIVE'`, không chỉ có id |
| Webhook event names khác giả định | Trung bình | Xác nhận với accounts.yaml: `account.created`, `account.activated`, suspension (đã có trong spec) |

## 12. Security

- Webhook `x-callback-token` timing-safe (NFR-1).
- BasicAuth secret chỉ ở Vercel env; CI `check-env-vars.js` gate.
- KYB data không qua server ta (NFR-4, PDPA).

## 13. [NEED] (đã giảm nhờ accounts.yaml)

- `[NEED]` Xác nhận event name webhook cho từng status transition (REGISTERED/AWAITING_DOCS/PENDING_VERIFICATION) — spec có `account.created`, `account.activated`, suspension; các bước giữa cần xác nhận field `status` trong `account.updated` callback.
- `[NEED]` Cách set callback URL: qua API `/callback_urls/{type}` hay chỉ Dashboard config (spec có cả 2).
- `[NEED]` MY: business_name/email gửi đi có cần khớp pháp nhân SSM không (ảnh hưởng KYB pass).
- ✅ ~~hosted KYB redirect~~ — ĐÃ GIẢI QUYẾT: MY MANAGED dùng email-invite + Dashboard (không redirect, không Verification API).
