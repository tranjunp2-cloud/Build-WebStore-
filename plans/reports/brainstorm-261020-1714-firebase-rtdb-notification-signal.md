# Brainstorm — Realtime notification qua Firebase RTDB, bỏ polling định kỳ (F16)

> Ngày: 2026-10-20 · Branch: staging · Phạm vi: ech-prime-web-v2 (PW2) · Tham chiếu: prime-web-api (PW1)

## 1. Kết luận ngắn

**Làm được và nên làm.** Hướng tốt nhất: dùng **Firebase Realtime Database làm "chuông báo" (signal-only)**, Postgres vẫn là nguồn sự thật. Server ghi một tín hiệu nhỏ `{lastId, at}` lên RTDB khi có noti; client subscribe node của chính mình (xác thực bằng Firebase custom token), nhận tín hiệu → gọi API hiện có `GET /api/notifications?since=`. **Bỏ hẳn vòng poll 15s/60s**, chỉ fetch theo sự kiện (mount, tab hiện lại, Firebase reconnect). **Giữ Web Push** cho trường hợp tab đã đóng.

## 2. Hiện trạng (đã xác minh trong code)

| Thành phần | File | Ghi chú |
|---|---|---|
| Producer | `src/lib/notifications/notify-tenant-owners.ts` (gọi từ Orders/Products/Blogs hooks, Stripe webhook, upload-proof, reconcile) | Insert từng dòng qua `payload.create` → kích hoạt hook |
| Broadcast | `src/lib/notifications/create-broadcast.ts` | Raw SQL `INSERT…SELECT` → **bypass hook** → không push |
| Push | `Notifications.ts` afterChange → `send-push.ts` → `public/sw.js` | Chạy được trên Vercel, cần user cấp quyền |
| Polling | `src/providers/NotificationProvider.tsx` | 15s (chưa cấp quyền push) / 60s (đã cấp), backoff tới 120s |
| pg trigger | `scripts/db-setup.js:2477-2497` `pg_notify('notification_channel')` | **Code chết** — không có ai `LISTEN` (Neon pooler + serverless không giữ được LISTEN) |
| Cross-tab badge | `src/store/notificationStore.ts:39` `BroadcastChannel` | Cùng trình duyệt OK; **khác thiết bị** hiện dựa vào polling |

Vấn đề thật:
1. Realtime chỉ có với user đã cấp quyền push; số còn lại phụ thuộc poll 15s → tốn invocation Vercel + query Neon (giữ compute Neon thức) liên tục cho mỗi tab mở.
2. Fire-and-forget bằng `.then()/.catch()` (hook push, các producer) — trên Vercel promise có thể bị kill sau khi response trả → push/noti rớt ngẫu nhiên.
3. Watermark `since` = đồng hồ client (`NotificationProvider.tsx:105`) → lệch giờ có thể sót noti; polling hiện che bớt lỗi này.

PW1 (prime-web-api): Laravel Notification → `FirebaseDatabaseChannel` `set(path, json)` bằng `FIREBASE_SECRET` (legacy), path theo userId (`chat_logs/{userId}`, `{model}/exports/{userId}`). Mô hình "chuông báo + MySQL" là đúng, **nhưng không nên chép cơ chế auth** (legacy secret + path đoán được).

## 3. Contract

- **Outcome:** Seller đang mở dashboard nhận noti mới < 2s mà không cần cấp quyền push; không còn request poll định kỳ; badge đồng bộ giữa các thiết bị.
- **Constraints:** Vercel serverless + Neon (không LISTEN lâu dài); Postgres giữ nguyên là source of truth, API hiện tại giữ nguyên contract; multi-tenant isolation; env theo `.claude/rules/env-vars.md`; migration theo `database-schema.md`; không lộ nội dung noti ra RTDB.
- **Non-goals:** Đổi schema bảng `notifications`; migrate noti PW1; thay Web Push bằng FCM; sửa giới hạn "chỉ tenant đầu tiên" của GET/mark_all; thêm loại noti mới.
- **Acceptance criteria:**
  1. Tạo đơn COD → tab dashboard (chưa cấp quyền push) hiện toast + badge trong < 2s.
  2. DevTools Network: không còn `GET /api/notifications` lặp theo chu kỳ khi tab idle.
  3. Mark-read trên thiết bị A → badge thiết bị B cập nhật < 2s.
  4. Broadcast admin → owner đang online nhận được toast.
  5. User A **không đọc được** node RTDB của user B (test bằng Rules simulator/emulator).
  6. Rớt mạng 5 phút rồi có lại → noti phát sinh trong lúc offline được kéo về đủ.
  7. Thiếu/lỗi cấu hình Firebase → dashboard không crash, tự rơi về chế độ dự phòng (mục 5.6).

## 4. Các hướng đã cân nhắc

| # | Hướng | Giả định chịu lực | Gãy đầu tiên khi |
|---|---|---|---|
| **A** ✅ | **Firebase RTDB signal-only** + custom token + giữ Web Push | Firebase RTDB sẵn sàng; số kết nối đồng thời trong hạn mức gói | Vượt 100 kết nối đồng thời trên gói Spark (free) → phải lên Blaze |
| B | SSE tự host trên Vercel (route stream, đọc pg) | Function giữ được lâu + có nguồn pub/sub | Ngay từ đầu: Vercel giới hạn thời lượng function, mỗi tab = 1 function chạy liên tục (tốn tiền); Neon pooler không hỗ trợ LISTEN, direct connection thì cạn connection |
| C | Dịch vụ pub/sub khác (Pusher/Ably) | Thêm vendor mới chấp nhận được | Thêm vendor/billing mới trong khi team đã quen Firebase từ PW1; mô hình kỹ thuật giống A, không có lợi thế rõ |
| D | Firestore `onSnapshot` thay RTDB | Như A | Tính tiền theo read/write mỗi document; với tín hiệu nhỏ, ghi đè liên tục thì RTDB rẻ và đơn giản hơn |
| E | Chỉ Web Push, bỏ polling | User cấp quyền push | User từ chối/không phản hồi prompt → không bao giờ nhận noti realtime |

### Trade-offs
- **A** đổi lấy realtime cho mọi user bằng 1 phụ thuộc ngoài (Firebase) + 1 endpoint cấp token. Worst case (Firebase sập): user vẫn nhận Web Push và nhận đủ noti khi focus tab — không mất dữ liệu vì DB là nguồn sự thật. Rẻ để gỡ bỏ: xoá listener, bật lại poll.
- **B** worst case: hoá đơn Vercel tăng theo số tab mở + rủi ro cạn connection Neon — tệ hơn hiện trạng.
- **E** worst case: phần lớn user mất realtime — đúng vấn đề đang muốn giải.

### Better approaches (so với đề xuất ban đầu "dùng Firebase giống PW1")
1. **Custom token + Security Rules theo uid** thay vì legacy database secret. Bằng chứng: PW1 `FireBaseService.php` dùng `FIREBASE_SECRET` server-side, path `chat_logs/{userId}` đoán được. Lợi ích: chặn đọc chéo user/tenant. Chi phí: 1 endpoint + 1 file rules.
2. **Signal-only, không ghi nội dung lên RTDB** (PW1 ghi cả message/url). Lợi ích: RTDB không chứa PII (tên khách, số tiền); quyền và read-state chỉ ở 1 nơi. Chi phí: thêm 1 request GET sau mỗi tín hiệu (đã có sẵn API).
3. **Broadcast dùng 1 node chung** `broadcast-signal` thay vì fan-out 10k path. Lợi ích: 1 lần ghi, không phụ thuộc số người nhận. Chi phí: user không phải owner cũng nhận tín hiệu → fetch không ra gì (vô hại, 1 request).
4. **Ghi tín hiệu cả khi mark-read** → thay thế đúng vai trò "đồng bộ badge đa thiết bị" mà polling đang gánh.

## 5. Thiết kế đề xuất (hướng A)

### 5.1 Luồng
```
Producer ─► notifyTenantOwners ─► payload.create(notifications)
                                    └─ afterChange hook
                                         ├─ signalUser(userId, {lastId, at})   → RTDB notif-signal/u_{id}
                                         └─ sendPushToUser(...)                 → Web Push (giữ nguyên)
Broadcast ─► raw INSERT ─► signalBroadcast({at})                                → RTDB broadcast-signal
Mark-read ─► UPDATE ─► signalUser(userId, {readAt})                             → RTDB notif-signal/u_{id}

Client: signInWithCustomToken(token) → onValue(notif-signal/u_{me}) + onValue(broadcast-signal)
        → debounce 1s → GET /api/notifications?since=<server watermark> → toast + setUnreadCount
```

### 5.2 Data contract trên RTDB
```
notif-signal/
  u_{userId}: { lastId: "123", at: 1760954098123, kind: "new" | "read" }   // ghi đè (set)
broadcast-signal: { at: 1760954098123 }
```
Không chứa title/message/actionUrl/tenantId.

### 5.3 Security Rules
```json
{
  "rules": {
    ".read": false, ".write": false,
    "notif-signal": { "$uid": { ".read": "auth != null && auth.uid === $uid" } },
    "broadcast-signal": { ".read": "auth != null" }
  }
}
```
Server ghi bằng Admin SDK (service account) → bỏ qua rules. Client không bao giờ ghi.

### 5.4 Xác thực
`GET /api/notifications/firebase-token` (`withAuth`, rate-limit) → `admin.auth().createCustomToken('u_' + user.id)`. Client SDK tự refresh ID token; khi logout → `signOut()` Firebase.

### 5.5 Độ bền trên Vercel
- Dùng `after()` của `next/server` theo đúng pattern `src/app/api/tenant/[id]/easyparcel-save/route.ts:164` (try `after`, lỗi ngoài request scope thì chạy ngay). Tách thành helper dùng chung (ví dụ `src/lib/runtime/run-after-response.ts`) và áp cho: các producer gọi `notifyTenantOwners`, hook push, ghi signal.
- Bên trong job `after`: **await** đủ insert → signal → push (không lồng fire-and-forget nữa).

### 5.6 Client (`NotificationProvider`)
- Bỏ `scheduleNext`/interval/backoff. Giữ: fetch khi mount, `visibilitychange` (hiện lại), `online`, và khi `.info/connected` chuyển `true` (reconnect) → bù noti lỡ trong lúc mất kết nối.
- Watermark `since` = `createdAt` lớn nhất nhận từ server (không dùng `new Date()` client).
- Debounce 1s cho tín hiệu dồn dập (burst đơn) → tôn trọng rate-limit 60/phút của GET.
- **Chế độ dự phòng duy nhất:** nếu Firebase lỗi cứng (thiếu config, token endpoint lỗi, permission denied) → bật poll 60s. Mất kết nối tạm thời thì **không** poll, chỉ chờ reconnect. Bình thường: 0 request định kỳ.
- Toast từ Service Worker (Web Push) vẫn ghi vào `seenIds` để không toast trùng với tín hiệu Firebase.

### 5.7 Dọn dẹp
- `scripts/db-setup.js`: thêm migration `DROP TRIGGER IF EXISTS after_notification_insert ON notifications;` + `DROP FUNCTION IF EXISTS notify_new_notification();` (bỏ chi phí pg_notify mỗi dòng; không phải DROP TABLE).
- Sửa comment sai trong `create-broadcast.ts` (nói về SSE không tồn tại).

### 5.8 File dự kiến đụng tới
| Tạo mới | Sửa |
|---|---|
| `src/lib/firebase/firebase-admin.ts` (init singleton, Node runtime) | `src/collections/Notifications.ts` (hook: signal + push trong after) |
| `src/lib/notifications/signal-notification.ts` (`signalUser`, `signalBroadcast`) | `src/lib/notifications/create-broadcast.ts` |
| `src/lib/runtime/run-after-response.ts` | `src/app/api/notifications/mark-read/route.ts` |
| `src/app/api/notifications/firebase-token/route.ts` | `src/providers/NotificationProvider.tsx` |
| `src/lib/firebase/firebase-client.ts` (lazy, chỉ load ở dashboard) | Producers: `Orders.ts`, `Products.ts`, `Blogs.ts`, `payment-failed.ts`, `upload-proof*`, `reconcile-order-paid-emails.ts` |
| `firebase/database.rules.json` | `scripts/db-setup.js`, `scripts/check-env-vars.js`, `.env.staging.example`, `.env.production.example` |
| | Docs: `docs/architecture/F16-notification-center.md`, `docs/qa/F16-notification-center.md` (TC-ID mới) |

Package: `firebase-admin` (server), `firebase` (client, import modular `firebase/app` + `firebase/auth` + `firebase/database` để giữ bundle nhỏ).

Env (Vercel Dashboard là nguồn sự thật):
- Server: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`
- Client: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`

## 6. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Gói Spark giới hạn 100 kết nối đồng thời | Cao khi scale | Dùng Blaze cho production (tín hiệu vài chục byte → chi phí băng thông rất nhỏ); staging có thể dùng Spark |
| Lộ dữ liệu qua RTDB | Cao nếu làm sai | Signal-only + rules theo uid + test rules trong CI bằng emulator |
| `FIREBASE_PRIVATE_KEY` xuống dòng sai trên Vercel | Trung bình | `.replace(/\\n/g, '\n')` khi init; check trong `check-env-vars.js` |
| Firebase sập / chặn mạng (firewall công ty) | Thấp–TB | Web Push vẫn chạy; fetch khi focus; poll dự phòng khi lỗi cứng |
| Tín hiệu dồn dập → vượt rate-limit GET | Thấp | Debounce 1s phía client |
| `after()` không có ngoài request (script/seed) | Thấp | Helper fallback chạy ngay (pattern đã có) |
| Bundle client tăng | Thấp | Lazy import Firebase chỉ trong layout dashboard/editor |

## 7. Triển khai theo thứ tự

1. **Phase 1 — Hạ tầng:** Firebase project + rules + env; `firebase-admin.ts`, `run-after-response.ts`, `signal-notification.ts`, endpoint token. Chưa đổi client.
2. **Phase 2 — Server signal:** hook Notifications, broadcast, mark-read ghi signal; producer chuyển sang `after()`. Polling vẫn chạy → an toàn để kiểm tra trên staging.
3. **Phase 3 — Client:** `NotificationProvider` subscribe Firebase, bỏ interval poll, watermark từ server, chế độ dự phòng.
4. **Phase 4 — Dọn dẹp + docs + test:** drop pg trigger, cập nhật F16 docs, TC-ID mới, test rules.

**Cập nhật (2026-10-20):** gộp thành **1 branch / 1 PR** (issue #1972). Các phase trên chỉ là thứ tự commit trong PR. Lý do: Vercel deploy nguyên khối, có poll dự phòng khi Firebase lỗi cứng, flow staging-first đã cho phép verify trước production, và rule repo "1 US = 1 branch = 1 PR". Tiền điều kiện hạ tầng (Firebase project, rules, env Vercel) phải xong trước khi merge.

## 8. Bước tiếp theo
`/ck:plan` với báo cáo này làm đầu vào → `plans/{date}-f16-firebase-realtime-signal/` → `/ck:cook`.

## Câu hỏi chưa giải quyết
1. Dùng **Firebase project mới** cho PW2 (khuyến nghị) hay dùng chung project/database instance của PW1?
2. Production có chấp nhận lên **gói Blaze** không? Số seller online đồng thời lúc cao điểm dự kiến khoảng bao nhiêu?
3. Xác nhận **giữ Web Push** (khuyến nghị) — hay bỏ luôn `PushOptInPrompt` để đơn giản hoá?
4. Chế độ poll dự phòng 60s khi Firebase lỗi cứng: giữ (khuyến nghị) hay bỏ hoàn toàn?
