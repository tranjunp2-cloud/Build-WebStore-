# Phase 03 — Client: nghe tín hiệu, bỏ polling (commit 3)

## Overview
- Priority: P1 · Status: ⬜ · Phụ thuộc: phase 01–02
- `NotificationProvider` mount ở `src/app/(dashboard)/layout.tsx:91` và `src/app/(editor)/layout.tsx:32` — không đổi layout.

## Files
**Tạo**
| File | Nội dung | ~LOC |
|---|---|---|
| `src/lib/firebase/firebase-client.ts` | `connectFirebaseClient(config, token)`: dynamic import `firebase/app`, `firebase/auth`, `firebase/database`; app `'pw2-notif'` (reuse nếu có); `initializeAuth(app,{persistence: inMemoryPersistence})` chỉ 1 lần (reuse `getAuth` khi HMR/StrictMode); `signInWithCustomToken` → trả `{ db, auth }` | 50 |
| `src/hooks/use-notification-signal.ts` | State machine (dưới). Callback qua ref: `onSignal`, `onBroadcast`, `onReconnect`, `onModeChange('live' \| 'fallback')` | 120 |

**Sửa**: `src/providers/NotificationProvider.tsx` (viết lại, < 200 dòng)

## State machine `useNotificationSignal`
```
start (generation g):
  GET /api/notifications/firebase-token
    401 / enabled:false            → FALLBACK (final)
    429 / 5xx / network            → FALLBACK tạm + retry backoff 30s→60s→120s (max 5 lần)
    ok → connectFirebaseClient → lỗi sign-in → FALLBACK + retry như trên
  sau mỗi await: nếu g đã bị huỷ → dọn dẹp & return       (StrictMode / đổi layout)
  attach onValue(userPath), onValue(broadcastPath), onValue('.info/connected')
    snapshot ĐẦU của user/broadcast → onSignal() 1 lần (bắt event lọt giữa mount-sync và attach)
    snapshot sau → onSignal() / onBroadcast()
    cancel callback (permission denied) → FALLBACK (final)
  .info/connected: true → mode LIVE (tắt fallback poll); false→true (sau lần đầu) → onReconnect()
  chưa connected sau 15s → FALLBACK (vẫn giữ listener; khi connected → LIVE)
cleanup: g bị huỷ → unsubscribe 3 listener → signOut(auth); bỏ qua cancel callback phát sinh sau đó
```

## Logic NotificationProvider
```
sync()   (đổi tên từ poll; giữ abort, burst toast)
  GET /api/notifications?limit=50[&since=newestCreatedAt − 5s]
  newestCreatedAt = max(createdAt) server trả            (không dùng new Date())
  lần đầu: seed seenIds, không toast
  toast item chưa có trong seenIds VÀ isRead=false; add seenIds
  401 → dừng mọi trigger; 429 → tôn trọng Retry-After
requestSync()
  document.hidden → dirty = true
  else debounce trailing 1s, cách lần trước ≥ 3s
Triggers: mount → sync() · onSignal → requestSync · onBroadcast → setTimeout(requestSync, rand 0–5s)
  onReconnect → requestSync · visible → sync() nếu dirty hoặc >60s từ lần cuối · online → sync()
  mode FALLBACK → setTimeout loop 60s (pause khi hidden); mode LIVE → huỷ loop
SW PUSH_NOTIFICATION → nếu id ∈ seenIds: bỏ toast; else add + toast; requestSync        (D9, AC-08)
```
Bỏ: `POLL_FAST_MS`, `getBasePollInterval`, backoff nhân đôi, dòng `lastPollRef = new Date()`.

## Implementation steps
1. `firebase-client.ts`; build → xác nhận firebase **không** vào first-load JS route dashboard.
2. Hook state machine + generation guard.
3. Viết lại Provider; sửa `live-toast.test.tsx` + viết lại `vercel-notification-polling.test.tsx` trong commit này.
4. Test tay local (project test): 2 trình duyệt 2 user; idle 5 phút không có request định kỳ (AC-02); tắt mạng 5 phút (AC-06); bỏ `FIREBASE_WEB_API_KEY` + restart → poll 60s (AC-07); tạo 20 đơn liên tục (AC-09); push + signal cùng noti → 1 toast (AC-08).

## Edge cases
- Đổi user cùng trình duyệt: logout = full reload (`UserAvatarMenu.tsx:50`) + in-memory → AC-10.
- Custom token 1h chỉ dùng lúc sign-in; SDK tự refresh ID token; refresh lỗi → cancel → fallback.
- Mạng chặn Firebase (proxy công ty): 15s chưa connected → fallback poll.

## Risks
| Rủi ro | Giảm thiểu |
|---|---|
| Mỗi tab = 1 kết nối RTDB | Production Blaze (gate phase 00). Không disconnect tab ẩn (YAGNI, xem lại nếu đo thấy cần) |
| Bundle tăng | dynamic import sau mount |
| Rate-limit 60/phút chia nhiều thiết bị | chỉ tab hiển thị fetch, gap ≥3s, Retry-After |
