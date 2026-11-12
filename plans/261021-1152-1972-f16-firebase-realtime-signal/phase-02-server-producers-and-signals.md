# Phase 02 — Producers & ghi tín hiệu (commit 2)

## Overview
- Priority: P1 · Status: ⬜ · Phụ thuộc: phase 01
- Kết quả: mọi luồng tạo/đọc noti ghi signal trước, push sau; không còn fire-and-forget trần.

## Key insights
- Mọi noti (trừ broadcast) đi qua `notifyTenantOwners` (7 call site) → `payload.create` × N (≤200, song song) → hook `Notifications.afterChange` (push).
- `afterChange` chạy **trong transaction** của create; `sendPushToUser` gọi `payload.find` **không truyền `req`** (`send-push.ts:50`) → cần connection thứ 2. Pool `max: 25` (`payload.config.ts:195`). Nếu hook await push: 25 create đang giữ connection chờ connection thứ 26 → treo. → **Không await push trong hook.**
- Checkout xoá order khi giữ discount/tồn kho thất bại (`orders/checkout/route.ts:449,573`, `xendit-checkout`, `stripe-checkout`). Khi ORDER_NEW chạy chắc chắn sau response, noti cho đơn đã xoá sẽ xảy ra thường xuyên hơn hiện tại.
- `maxDuration`: `src/app/api/**` 120s (`vercel.json`), cron `reconcile-orders` 60s (budget nội bộ 50s, tối đa 50 đơn) → task `after()` chia ~10s còn lại.

## Files & thay đổi
| File | Thay đổi |
|---|---|
| `src/lib/notifications/notify-tenant-owners.ts` | `payload.create({ …, context: { skipPush: true } })`. Sau `allSettled`: `created` = user fulfilled → `await signalNotificationUsers(createdIds)` → `await Promise.allSettled(created.map(push))` (dùng doc trả về để có `id`) |
| `src/lib/notifications/send-push.ts` | thêm `timeout: 5000` vào option `webpush.sendNotification` |
| `src/collections/Notifications.ts` | Hook: `if (context?.skipPush) return doc`; còn lại (create tay) → `runAfterResponse('push', () => sendPushToUser(...))` — chạy sau commit, không giữ transaction |
| `src/lib/notifications/create-broadcast.ts` | Bọc vòng INSERT `try { … } finally { if (totalNotified > 0) await signalNotificationBroadcast() }`; sửa comment sai (pg NOTIFY/SSE) |
| `src/app/api/notifications/mark-read/route.ts` | `rowCount > 0` → `runAfterResponse('mark-read-signal', () => signalNotificationUsers([uid]))` (cả 2 nhánh) |
| `src/collections/Orders.ts` | `runAfterResponse('ORDER_NEW', async () => { const exists = await payload.findByID({ collection:'orders', id, depth:0, overrideAccess:true, disableErrors:true }); if (!exists) return; await notifyTenantOwners(…) })` — dùng `req.payload` gán ra biến trước, **không** truyền `req` |
| `src/collections/Products.ts`, `Blogs.ts` | `runAfterResponse(label, async () => { const { notifyTenantOwners } = await import(…); await notifyTenantOwners(…) })` |
| `payment-failed.ts`, `reconcile-order-paid-emails.ts`, `upload-proof/route.ts`, `upload-proof-direct/route.ts` | Tương tự, giữ nguyên data + `dedupeKey` + log label cũ |

## Implementation steps
1. send-push timeout → notifyTenantOwners (signal → push) → hook skipPush.
2. Broadcast finally, mark-read.
3. Producers (7 chỗ). Mỗi task chỉ đóng gói giá trị thuần (ids, strings) + `payload`.
4. Sửa test bị ảnh hưởng **trong commit này** (trigger test mock `run-after-response` chạy task ngay; notify-tenant-owners test thêm assert signal/push).
5. `tsc`, lint, `npm test -- notifications broadcasts`.

## Edge cases
- Ngoài request scope (script PW1 migrate, seed): `after()` throw → chạy ngay (giống hiện tại).
- `after()` lồng trong `after()` (reconcile được gọi từ webhook/cron): Next 15 hỗ trợ; nếu throw → fallback chạy ngay.
- Dedupe conflict → create rejected → user đó không signal/push (row cũ đã có) ✅.
- Request rollback sau khi schedule `after()` → Orders đã có guard `findByID`; Products/Blogs giữ như hiện tại (ghi nhận).
- Cron reconcile 50 đơn: mỗi task = 1 find + ≤200 create + 1 PATCH + push 5s timeout. Theo dõi log staging; nếu vượt budget → chuyển cron sang gọi trực tiếp (await) thay vì `after()` (follow-up, không làm trước).

## Success criteria
- Tạo đơn COD local → `pw2/development/u/{ownerId}.at` cập nhật trước khi push tới
- Checkout lỗi tồn kho (order bị xoá) → **không** có noti ORDER_NEW
- Mark-read / broadcast → node tương ứng cập nhật
- Push vẫn tới (tab đóng, đã cấp quyền) — AC-08

## Risks
| Rủi ro | Giảm thiểu |
|---|---|
| 200 create song song chiếm pool (đã có từ trước) | Không đổi trong issue này; push đã tách khỏi transaction nên không làm tệ hơn |
| Super-admin tạo noti tay → không signal | Chấp nhận; client fetch khi focus |
