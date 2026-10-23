## 📋 Summary

Thay cơ chế realtime của Notification Center (F16) bằng **Firebase Realtime Database (signal-only)** và **bỏ vòng polling định kỳ** `GET /api/notifications` (15s/60s) trong `NotificationProvider`.

Postgres (Neon) vẫn là nguồn sự thật. Firebase chỉ làm "chuông báo": server ghi tín hiệu nhỏ `{lastId, at}`, client nhận tín hiệu → gọi API hiện có để lấy dữ liệu. Giữ Web Push cho trường hợp tab đã đóng.

---

## 🔍 Hiện trạng & vấn đề

| # | Vấn đề | Evidence |
|---|---|---|
| 1 | Realtime chỉ có với user **đã cấp quyền** Web Push. User chưa cấp quyền phụ thuộc polling 15s → mỗi tab mở liên tục gọi Vercel function + query Neon (giữ compute Neon thức) | `src/providers/NotificationProvider.tsx` (`POLL_FAST_MS`, `POLL_SLOW_MS`) |
| 2 | Trigger `pg_notify('notification_channel')` là **code chết** — không có listener; Neon pooler + Vercel serverless không giữ được `LISTEN` | `scripts/db-setup.js` (`notifications.notify_fn`, `notifications.notify_trigger`); comment sai trong `src/lib/notifications/create-broadcast.ts` |
| 3 | Push & các producer chạy fire-and-forget bằng `.then()/.catch()` → trên Vercel promise có thể bị kill sau khi response trả → noti/push rớt ngẫu nhiên | `src/collections/Notifications.ts` afterChange; `Orders.ts`, `Products.ts`, `Blogs.ts`, `payment-failed.ts`, `upload-proof*`, `reconcile-order-paid-emails.ts` |
| 4 | Broadcast insert bằng raw SQL → bypass hook → **không có realtime/push** cho broadcast | `src/lib/notifications/create-broadcast.ts` |
| 5 | Watermark `since` lấy theo đồng hồ client → lệch giờ có thể sót noti | `NotificationProvider.tsx` (`lastPollRef.current = new Date().toISOString()`) |
| 6 | Badge đồng bộ khác thiết bị đang dựa vào polling (cùng trình duyệt đã có `BroadcastChannel`) | `src/store/notificationStore.ts` |

Tham chiếu PW1 (`prime-web-api`): Laravel Notification → `FirebaseDatabaseChannel` ghi Firebase RTDB + MySQL. PW2 áp dụng lại mô hình "chuông báo + DB" và **dùng chung 2 Firebase project của PW1**: `primeweb-tm-development` (local + staging) và `prime-web-tm-production` (production), RTDB `asia-southeast1`, nhưng **không** dùng legacy database secret / path đoán được / đọc không cần auth như PW1.

---

## 🎯 Giải pháp

```
Producer ─► after(() => notifyTenantOwners(...))          ← producer bọc after()
              └─ payload.create(notifications)
                   └─ afterChange hook (await trực tiếp, KHÔNG lồng after())
                        ├─ signalUser → RTDB pw2/{env}/u/{userId} = {lastId, at, kind}
                        └─ sendPushToUser (giữ nguyên)
Broadcast ─► raw INSERT ─► signalBroadcast → RTDB pw2/{env}/broadcast = {at}
Mark-read ─► UPDATE ─► signalUser(kind: "read")

Client: GET /api/notifications/firebase-token → signInWithCustomToken (inMemoryPersistence)
        onValue(pw2/{env}/u/{me}) + onValue(pw2/{env}/broadcast)
        → debounce 1s → GET /api/notifications?since=<server watermark> → toast + badge
```

- **Dùng chung project PW1:** PW2 staging → `primeweb-tm-development`, PW2 production → `prime-web-tm-production` (giống cách PW1 tách `.env.tm-development` / `.env.tm-production`). Mọi dữ liệu PW2 nằm dưới prefix `pw2/{env}/` (`env` = `development` | `staging` | `production`) → không đụng node của PW1 (`{modelName}/exports/…`, `chat_logs/…`), local dev và staging (cùng project dev) không lẫn nhau dù trùng userId.
- **Signal-only:** RTDB không chứa title/message/actionUrl/tenantId (không có PII).
- **Auth:** endpoint mới cấp Firebase custom token với uid `pw2_{env}_{userId}` (ký bằng service account qua `firebase-admin`). Rules chỉ cho đọc `pw2/$env/u/$userId` khi `auth.uid === 'pw2_' + $env + '_' + $userId`; broadcast chỉ cho uid bắt đầu bằng `pw2_{env}_`; client không được ghi. Server ghi bằng `firebase-admin` (service account, bypass rules) — **không** dùng `FIREBASE_SECRET` legacy. Dùng `inMemoryPersistence` → mỗi lần tải trang lấy token mới, đổi user trên cùng trình duyệt không dính session cũ, không cần sửa các luồng logout.
- **Vercel:** producer bọc `after()` (`next/server`) theo pattern có sẵn ở `src/app/api/tenant/[id]/easyparcel-save/route.ts` (fallback chạy ngay khi ngoài request scope), tách thành helper dùng chung. Hook `Notifications` **await** signal + push trực tiếp (đã chạy sau response nhờ producer) — không lồng `after()`.
- **Lỗi signal không chặn luồng chính:** ghi Firebase lỗi → chỉ log, không fail request, không rollback insert noti.
- **Client:** bỏ interval poll + backoff; chỉ fetch khi mount / tab hiện lại / `online` / Firebase reconnect (`.info/connected`). Watermark từ `createdAt` server. Chỉ bật poll 60s dự phòng khi Firebase **lỗi cứng** (thiếu config, token lỗi, permission denied).
- **Dọn dẹp:** migration `DROP TRIGGER IF EXISTS after_notification_insert` + `DROP FUNCTION IF EXISTS notify_new_notification()`.
- **Rollback không cần revert code:** xoá env Firebase trên Vercel → client tự về poll 60s (AC-07).

### Quyết định đã chốt
- Giữ Web Push (OS notification khi tab đóng) — chỉ chuyển sang chạy trong `after()`.
- Giữ poll 60s **chỉ** ở chế độ dự phòng khi Firebase lỗi cứng; mất kết nối tạm thời thì chờ reconnect, không poll.
- Dùng chung Firebase project PW1 (`primeweb-tm-development` cho staging, `prime-web-tm-production` cho production) + Firebase Auth custom token (chốt 2026-10-21).

### Non-goals
- Không đổi schema bảng `notifications`, không đổi contract `GET /api/notifications` / `mark-read`.
- Không migrate noti từ PW1.
- Không thay Web Push bằng FCM.
- Không sửa giới hạn "chỉ tenant đầu tiên" của GET / `mark_all`.
- Không đưa Firebase Rules emulator vào CI.
- Không sửa cách PW1 / SSO đang dùng Firebase (tách issue riêng nếu cần).

---

## ✅ Acceptance Criteria

- [ ] AC-01: Tạo đơn COD → tab dashboard **chưa cấp quyền push** hiện toast + badge cập nhật trong < 2s.
- [ ] AC-02: Tab dashboard idle → DevTools Network **không** còn `GET /api/notifications` lặp theo chu kỳ.
- [ ] AC-03: Mark-read (1 noti / mark all) trên thiết bị A → badge thiết bị B cập nhật < 2s.
- [ ] AC-04: Admin gửi broadcast → owner đang online nhận toast + badge cập nhật.
- [ ] AC-05: User A **không đọc được** node RTDB của user B (verify thủ công bằng Firebase Rules Playground / trên staging).
- [ ] AC-06: Mất mạng ≥ 5 phút rồi có lại → noti phát sinh lúc offline được kéo về đủ, không toast trùng.
- [ ] AC-07: Thiếu/lỗi cấu hình Firebase → dashboard không crash, tự bật poll dự phòng 60s.
- [ ] AC-08: Web Push vẫn hoạt động như cũ (tab đóng → OS notification, click → mở `actionUrl`); không toast trùng giữa push và Firebase signal.
- [ ] AC-09: Burst 20 đơn liên tiếp → không vượt rate-limit `GET /api/notifications` (60/phút).
- [ ] AC-10: Logout user A → login user B trên cùng trình duyệt → B **không** nhận tín hiệu/toast của A.
- [ ] AC-11: Sau khi publish rules mới, luồng noti của PW1 (export / chat log) vẫn hoạt động bình thường.

---

## 🗂️ Files liên quan

**Tạo mới**
- `src/lib/firebase/firebase-admin.ts`, `src/lib/firebase/firebase-client.ts`
- `src/lib/notifications/signal-notification.ts`
- `src/lib/runtime/run-after-response.ts`
- `src/app/api/notifications/firebase-token/route.ts`
- `firebase/pw2-database-rules.json` — chỉ nhánh `pw2`, dùng để **merge tay** vào rules hiện có của project PW1 (không deploy đè)

**Sửa**
- `src/collections/Notifications.ts`, `src/lib/notifications/create-broadcast.ts`, `src/app/api/notifications/mark-read/route.ts`
- `src/providers/NotificationProvider.tsx`
- Producers: `src/collections/{Orders,Products,Blogs}.ts`, `src/app/api/webhooks/stripe/handlers/payment-failed.ts`, `src/app/api/orders/[id]/upload-proof*/route.ts`, `src/lib/payment/reconcile-order-paid-emails.ts`
- `scripts/db-setup.js`, `.env.staging.example`, `.env.production.example` (`scripts/check-env-vars.js` tự phát hiện env mới từ diff — **không** sửa, **không** thêm vào `REQUIRED_DEPLOYMENT_SECRETS`)
- Tests cần viết lại: `src/__tests__/unit/migration/vercel-notification-polling.test.tsx` (TC-MIG-NP.01–03 đang khẳng định setTimeout polling), `src/__tests__/unit/notifications/notification-triggers.test.ts`
- Docs: `docs/architecture/F16-notification-center.md`, `docs/qa/F16-notification-center.md` (TC-ID mới)

**Env mới (Vercel Dashboard)** — staging (và `.env.local`) lấy giá trị từ `primeweb-tm-development`, production lấy từ `prime-web-tm-production`
- Server: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (từ service account JSON), `FIREBASE_DATABASE_URL` (giống PW1)
- Client: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL` (từ Web app config)
- `env` của prefix suy ra **phía server** từ `VERCEL_TARGET_ENV` (custom env `staging` có `VERCEL_ENV=preview` nên không dùng `VERCEL_ENV`), fallback `development`; endpoint `firebase-token` trả kèm path cần subscribe → client không cần biến env riêng

**Package mới:** `firebase-admin` (server), `firebase` (client, modular import, lazy-load trong layout dashboard/editor)

---

## 🚀 Triển khai — 1 branch, 1 PR vào `staging`

Branch: `feat/F16-firebase-realtime-signal` · PR description: `Relates to #1972`

**Tiền điều kiện (hạ tầng trên Firebase Console, làm cho **từng project**: `primeweb-tm-development` trước khi merge vào staging, `prime-web-tm-production` trước khi lên `main` — không phải code):**
- [ ] Project settings → Service accounts → **Generate new private key** (lấy `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`)
- [ ] Project settings → Your apps → đăng ký **Web app** (nếu chưa có) → lấy web config
- [ ] Authentication → **Get started** (bật service; không cần bật provider nào — custom token tự hoạt động)
- [ ] Realtime Database → Rules: **backup rules hiện tại của PW1**, merge thêm nhánh `pw2` từ `firebase/pw2-database-rules.json`, kiểm tra bằng Rules Playground (AC-05) — **không** deploy đè
- [ ] Google Cloud Console → Credentials: giới hạn `apiKey` theo HTTP referrer (domain PW2 + domain PW1 đang dùng key đó, nếu có)
- [ ] Thêm env vào Vercel Dashboard (staging trước, production sau khi QA pass)

**Thứ tự commit trong PR** (để review dễ đọc):
1. Hạ tầng code: Firebase admin/client init, helper `after()`, signal helper, token endpoint, env examples.
2. Server: hook Notifications / broadcast / mark-read ghi signal; producers chuyển sang `after()`.
3. Client: `NotificationProvider` subscribe Firebase, bỏ interval poll, watermark server, chế độ dự phòng.
4. Cleanup + docs + test: drop pg trigger, cập nhật F16 docs + TC-ID, viết lại test polling/triggers.

Vercel deploy nguyên khối (server + client cùng lúc) + poll dự phòng khi Firebase lỗi cứng (AC-07) → không cần tách PR theo phase. Verify trên staging trước khi lên `main` theo flow staging-first.

---

## ⚠️ Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Gói Spark (free) giới hạn ~100 kết nối đồng thời — **dùng chung quota với PW1** | Xác nhận gói hiện tại; production dùng Blaze (tín hiệu vài chục byte → chi phí nhỏ) |
| Sửa rules làm hỏng luồng noti của PW1 (export / chat log) | Backup rules trước, chỉ thêm nhánh `pw2`, không đổi node PW1; verify AC-11 sau khi publish rules |
| Lộ dữ liệu qua RTDB | Signal-only + rules theo uid + verify AC-05 |
| Session Firebase dính user cũ trên cùng trình duyệt | `inMemoryPersistence` + AC-10 |
| `FIREBASE_PRIVATE_KEY` sai format xuống dòng trên Vercel | Normalize `\n` khi init admin SDK |
| Firebase sập / bị chặn mạng | Web Push vẫn chạy; fetch khi focus/reconnect; poll dự phòng khi lỗi cứng; rollback bằng cách xoá env |

---

## ❓ Open Questions
- [x] ~~Firebase project mới hay dùng chung PW1?~~ → **Dùng chung**: staging ↔ `primeweb-tm-development`, production ↔ `prime-web-tm-production`, prefix `pw2/{env}`, auth bằng custom token (chốt 2026-10-21)
- [ ] Ai có quyền Firebase Console 2 project trên để làm các bước tiền điều kiện?
- [ ] `prime-web-tm-production` đang ở gói Spark hay Blaze? Số seller online đồng thời peak dự kiến (cộng với user PW1)?

## 📎 References
| Doc | Link |
|-----|------|
| PRD | [docs/prd/F16-notification-center.md](https://github.com/primeproduction/ech-prime-web-v2/blob/staging/docs/prd/F16-notification-center.md) |
| Architecture | [docs/architecture/F16-notification-center.md](https://github.com/primeproduction/ech-prime-web-v2/blob/staging/docs/architecture/F16-notification-center.md) |
| Related | #124 (US-F16-06 Live In-app Popup), #125 (US-F16-07 Browser Push), #123 (US-F16-05 Broadcasts) |
