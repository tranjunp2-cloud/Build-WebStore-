# Research: Billplz Integration

**Ngày:** 2026-10-05 · **Branch:** research/billplz-payment-method

## TL;DR

Billplz = payment gateway Malaysia, chỉ nhận MYR. Flow: tạo "Bill" qua API → redirect khách tới trang thanh toán Billplz → Billplz callback về server mình. Đây là mô hình hosted-checkout — codebase có sẵn code pattern tương tự (Xendit F34, **hiện không còn dùng trong production flow** nhưng code vẫn còn để tham khảo) → **implement theo mẫu "merchant nhập keys", effort thấp**.

OAuth của Billplz chỉ dành cho partner (liên hệ `team@billplz.com`) — **nhưng endpoint đã reverse-engineer được** (Doorkeeper, `dashboard.billplz.com/oauth/*`), chỉ thiếu `client_id/secret` + contract trả credentials. Chi tiết ở section cuối.

## Billplz hoạt động thế nào

```
Buyer chọn Billplz → POST /v3/bills → nhận bill URL
→ redirect buyer tới bill URL → buyer trả (FPX/card/e-wallet)
→ Billplz POST callback_url (form data) + GET redirect_url
```

- **Collection** = nhóm bills (merchant tạo trên dashboard, lấy Collection ID)
- **Bill** = hoá đơn 1 lần trả. Mặc định sống 30 ngày, xoá được nếu chưa trả
- Tiền về: FPX/e-wallet T+1, card T+2

## Xác thực (3 thứ cần nhớ)

| Gì | Dùng khi | Cách |
|---|---|---|
| API Secret Key | Gọi API | HTTP Basic Auth: `base64(key:)` — key là username, password rỗng |
| X Signature Key | Verify webhook/redirect | HMAC-SHA256 |
| OAuth | Connect merchant tự động | Partner-only, chưa public |

## API cần dùng

```
POST   /api/v3/bills          tạo bill → trả {id, url}
GET    /api/v3/bills/{id}     check status (giới hạn 100 GET/5 phút)
DELETE /api/v3/bills/{id}     huỷ bill chưa trả (dùng cho order hết hạn)
POST   /api/v3/collections    tạo collection (optional)
```

Params tạo bill: `collection_id`, `email`, `name`, `amount` (**sen** — RM1 = 100), `callback_url` (bắt buộc), `redirect_url`, `description` (≤200), `reference_2` = order ID.

## Webhook — 3 điểm khác thường

1. **Body là form-urlencoded, không phải JSON** → parse bằng `request.formData()`
2. **X Signature**: chỉ sign một whitelist keys cố định (không phải mọi field), sort case-insensitive, join `|`, HMAC-SHA256. Bỏ field rỗng và `x_signature` khi sign.
3. `callback_url` và `redirect_url` chạy **không theo thứ tự** → xử lý phải idempotent. Billplz retry 5 lần/24h nếu không nhận được HTTP 200 → luôn trả 200 sau khi xử lý xong.

Callback params chính: `id` (bill id), `paid` (string `"true"/"false"`), `state` (`due`/`paid`/`deleted`), `paid_at`, `x_signature`.

## Fees (Basic plan — free)

| Method | Phí |
|---|---|
| FPX B2C | RM1.25 flat (Standard RM0.75) |
| Card MYR | 1.8% |
| E-wallet (DuitNow, TnG, GrabPay, ShopeePay, Boost) | 1.5% |

Flat-fee FPX = rẻ cho đơn lớn — điểm bán chính vs Xendit/Stripe (%).

## Payment methods (4 nhóm, ~10 brand)

| Nhóm | Methods |
|---|---|
| Online banking | **FPX** — 1 channel gom ~21 ngân hàng personal + ~20 corporate (Maybank2U, CIMB Clicks, Public Bank, RHB, Bank Islam, CitiDirect, BNP Paribas...) |
| E-wallet / QR | DuitNow QR, Touch 'n Go, GrabPay, ShopeePay, Boost |
| Card | Visa, Mastercard |
| Instalment (BNPL) | Atome, PayLater by Grab |

- Method nào khả dụng phụ thuộc plan + activation trên từng Collection → check `GET /v4/payment_method_index`.
- Buyer chỉ thấy 1 option "Billplz" ở checkout ECH; chọn method xảy ra trên hosted page của Billplz → Phase 1 không cần UI chọn method.
- Có thể skip trang chọn method bằng `reference_1` = bank code (buyer đi thẳng tới trang login ngân hàng) — lý do order ID phải ở `reference_2`.

## Seller kết nối Billplz với ECH

**Phase 1 — nhập keys thủ công** (không phải OAuth, không cần Billplz duyệt gì):

```
Bên Billplz Dashboard                    Bên ECH
─────────────────────                    ───────────────────────────
1. Seller đăng ký account + KYC
2. Tạo/chọn Collection
3. Copy 3 keys:
   • API Secret Key
   • Collection ID
   • X Signature Key
                            ────►     4. Settings → Payments → Billplz
                                         (clone XenditConnectBlock + modal)
                                      5. Nhập 3 keys → Save
                                      6. Server validate:
                                         • GET /v4/webhook_rank (Basic Auth)
                                           → 401 = API key sai
                                         • GET /v3/collections/{id}
                                           → 404 = Collection ID sai
                                      7. Hợp lệ → lưu 3 fields vào tenant
                                         → unlock toggle Billplz ở checkout
```

- **"Connected" ở Phase 1 nghĩa là gì**: không có API "link account" — ECH chỉ lưu credentials seller tự paste. Billplz không biết ECH tồn tại; mỗi request checkout đơn thuần dùng keys của tenant đó.
- **Keys là server-only**: lưu trên `tenant`, sau khi save chỉ hiện masked; không bao giờ trả về browser/log. Checkout route resolve tenant từ site → lấy keys → gọi Billplz.
- **Giống hệt Xendit Model C hiện có** (`XenditConnectBlock` → modal → `saveXenditKeys()` server action: format check → plan gate `payment_integration` → probe API → save tenant fields). Clone gần như 1-1.
- **Điểm khác Xendit**: X Signature Key **không validate được lúc nhập** — Billplz không có endpoint echo nó (Xendit có `callback_token` echo qua `setCallbackUrl`). Sai key chỉ lộ ra khi callback đầu tiên tới → cần log/alert khi signature mismatch liên tục.
- **Phase 2 — OAuth**: xem section "OAuth Connect" bên dưới — endpoint đã reverse-engineer được (Doorkeeper), chỉ thiếu `client_id`/`secret` từ Billplz.

## Cần build gì

Lưu ý: Xendit (F34) **không còn dùng trong flow hiện tại** — nhưng code `xendit-checkout` vẫn là reference kỹ thuật gần nhất (cùng là hosted-checkout + merchant keys). Stripe checkout (F13) là flow đang sống — Billplz nên hoạt động song song như một phương thức thanh toán thay thế cho merchant không muốn Stripe.

| Phần | Làm gì |
|---|---|
| `src/lib/payment/billplz*.ts` | client: Basic Auth + createBill/getBill/deleteBill/verifyXSignature |
| Tenants collection | thêm `billplzApiKey`, `billplzCollectionId`, `billplzXSignatureKey` + toggle → **migration db-setup.js** |
| Orders collection | `paymentProvider` += `'billplz'`, `billplzBillId` → **migration** |
| `POST /api/orders/billplz-checkout` | clone flow `xendit-checkout` (hoặc `stripe-checkout`) — reuse buildOrderItems, decrement-stock, emails |
| `POST /api/webhooks/billplz` | parse formData → verify signature → `reconcileOrderPaid` |
| `CheckoutClient.tsx` | thêm radio "Billplz" |
| Cron `payment-expiry` | DELETE bill khi order hết hạn |
| Settings > Payments | `BillplzConnectBlock` + modal 3 keys + `saveBillplzKeys()` server action (clone Xendit block, xem section trên) |
| E2E test | `tests/*.spec.ts` (bắt buộc theo rule repo) |

## Góc cạnh / rủi ro

- **Không có refund API** — FPX không reverse được. Refund = manual hoặc Payment Order API v5 (cần bank account của buyer + pre-fund). Phase 1: refund manual.
- **Không có idempotency key** → check `order.billplzBillId` trước khi tạo bill (tránh duplicate).
- **Bill sống 30 ngày, order expire 24h** → phải DELETE bill trong cron expiry; nếu khách trả trễ → quyết định xử lý sau (refund manual).
- **Order ID transport**: nhét vào `reference_2` (reference_1 dành cho chọn bank trực tiếp) + embed `?o={orderId}` vào callback_url cho chắc.
- **Số điện thoại**: normalize `012-345 6789` → `60123456789`.
- **`paid` là string**, không phải boolean.
- **Sandbox**: `billplz-sandbox.com`, account tách riêng production.

## Phase 2 — OAuth Connect (đã reverse-engineer)

OAuth của Billplz là **Doorkeeper** (OAuth provider chuẩn của Rails — lộ qua error string `en.doorkeeper.errors...`). Endpoint thật đã probe được (2026-10-05):

| Endpoint | Prod | Sandbox | Trạng thái |
|---|---|---|---|
| Authorize | `GET dashboard.billplz.com/oauth/authorize` | `dashboard.billplz-sandbox.com/oauth/authorize` | 302 → `/enterprise/login` (chưa login) — chuẩn Doorkeeper |
| Token | `POST dashboard.billplz.com/oauth/token` | cùng subdomain sandbox | Trả OAuth error chuẩn (`invalid_client`, `missing_param`) |
| Revoke | `POST …/oauth/revoke` | — | 403 (tồn tại, cần credentials) |
| Không mount | `/oauth/token/info`, `/oauth/applications`, `/oauth/userinfo`, `/api/*/me` | — | 404 |

### Flow (chuẩn Doorkeeper `authorization_code`)

```
1. ECH redirect seller →
   dashboard.billplz.com/oauth/authorize
     ?client_id={ECH_CLIENT_ID}&redirect_uri={ech}/api/billplz/connect/callback
     &response_type=code&scope={?}&state={signed-state}
2. Seller login Billplz (/enterprise/login) → trang consent → Approve
3. Billplz redirect → {ech}/api/billplz/connect/callback?code=…&state=…
4. ECH verify state → POST /oauth/token
     grant_type=authorization_code&code=…&redirect_uri=…
     + client_id/client_secret (Basic auth hoặc body)
   → {access_token, token_type:"Bearer", expires_in, created_at, refresh_token?}
5. Lấy 3 keys của merchant → lưu tenant → connected
```

### Còn thiếu (bắt buộc hỏi Billplz — `team@billplz.com`)

1. `client_id` + `client_secret` của ECH — Billplz provision per partner (UI `/oauth/applications` không public → họ tạo tay)
2. **Bước 5 — access token mở khoá gì**: 3 giả thuyết — (a) Bearer token gọi thẳng `www.billplz.com/api/*` thay Basic Auth; (b) partner endpoint trả về API Secret + X Signature + Collection ID; (c) token response kèm credentials. `Bearer fake` → 401 không phân biệt được → phải hỏi.
3. Scopes có sẵn (bills write? collections read?)
4. Token TTL + refresh token có enable không (Doorkeeper default 2h, refresh optional)
5. Sandbox có sẵn OAuth app để test không

### Ước tính implement khi có partner access

Code có thể build **trước** phần lớn (client OAuth generic, state signing như `stripe-oauth.ts`, routes `connect/start` + `connect/callback`, lưu credentials) — chỉ chờ `client_id/secret` + đáp án bước 5. Effort còn lại sau khi Billplz trả lời: ~0.5–1 ngày wiring + test.

## Nguồn

- API docs: billplz.com/api · support.billplz.com/guide/*
- Plugin tham khảo chính chủ: github.com/Billplz/Billplz-for-WooCommerce (X Signature impl, fallback re-query, reference_2 pattern)
- Codebase: `src/lib/payment/*`, `src/app/api/orders/xendit-checkout`, `src/app/api/webhooks/xendit`, `src/collections/{Tenants,Orders}.ts`

## Câu hỏi còn mở

1. Partner OAuth: tiêu chí/timeline, `client_id/secret`, access token mở khoá gì (Bearer-on-API vs endpoint trả keys), scopes, TTL/refresh → business gửi list câu hỏi ở section Phase 2 cho `team@billplz.com`
2. Sandbox có test card giả lập không? → tạo account thử
3. Khách trả sau khi order expired: refund manual hay revive order? → product quyết định
