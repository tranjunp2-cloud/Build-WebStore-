# Phase 04 — Cleanup, tests, docs (commit 4)

## Overview
- Priority: P1 · Status: ⬜ · Phụ thuộc: phase 01–03
- TC-ID mới: **TC-F16.45 → .54** (đã kiểm tra còn trống; .43/.44 đang dùng trong test nhưng chưa có trong QA doc → bổ sung luôn).

## Cleanup DB (`scripts/db-setup.js`)
- Runner lưu tên migration đã chạy (`_db_setup_state`) → DB cũ không chạy lại entry cũ; `check-migrations.js` chỉ kiểm field collection.
- **Xoá** entry `notifications.notify_fn` + `notifications.notify_trigger`.
- **Thêm** `notifications.drop_pg_notify_trigger`: `DROP TRIGGER IF EXISTS after_notification_insert ON notifications; DROP FUNCTION IF EXISTS notify_new_notification();` (trigger trước function).
- Grep: không còn `notification_channel` / `notify_new_notification` ngoài entry drop.

## Tests (Vitest, `vi.mock` top-level, import từ source)
| TC-ID | File | Nội dung |
|---|---|---|
| TC-F16.45 | `unit/notifications/signal-notification.test.ts` (mới) | 1 PATCH đúng URL/body, dedupe id, bỏ id lỗi; no-op khi thiếu env; fetch lỗi/timeout không throw; broadcast PUT |
| TC-F16.46 | `unit/notifications/notification-signal-env.test.ts` (mới) | staging/production/preview, fallback development, lọc ký tự, uid `pw2_{env}_{id}` |
| TC-F16.47 | `api/notifications-firebase-token.test.ts` (mới) | 401; `enabled:false`; token + config + path đúng user; 429; `no-store` |
| TC-F16.48 | `unit/notifications/notify-tenant-owners.test.ts` (sửa) | create có `context.skipPush`; signal 1 lần với user tạo thành công; signal gọi **trước** push; push lỗi không throw |
| TC-F16.49 | `unit/notifications/mark-read-signal.test.ts` (mới) | signal khi rowCount>0; không khi 0 |
| TC-F16.50 | `api/broadcasts.test.ts` / `unit/notifications/broadcast-notification.test.tsx` (sửa) | signal broadcast 1 lần khi notified>0, kể cả khi batch sau lỗi |
| TC-F16.51 | `unit/runtime/run-after-response.test.ts` (mới) | dùng `after`; `after` throw → chạy ngay; task reject không throw |
| TC-F16.52 | `unit/notifications/notification-provider-signal.test.tsx` (đổi tên từ `migration/vercel-notification-polling.test.tsx`, bỏ TC-MIG-NP) | không fetch định kỳ khi LIVE; signal → 1 fetch (debounce); snapshot đầu → requestSync; tab ẩn → dirty; watermark từ createdAt server; push+signal cùng id → 1 toast |
| TC-F16.53 | cùng file | FALLBACK: `enabled:false`, permission denied, 15s chưa connected → poll 60s, pause khi hidden; 5xx token → retry; LIVE lại → dừng poll |
| TC-F16.06 | `unit/notifications/live-toast.test.tsx` (sửa) | toast single/burst sau signal-sync; bỏ assertion "polls" |
| TC-F16.14 | `unit/notifications/notification-triggers.test.ts` (sửa) | mock `run-after-response` chạy task ngay; ORDER_NEW bỏ qua khi order không còn |
| TC-F16.54 | manual QA | AC-05/AC-11 (smoke script + Rules Playground trên project dev); E2E AC-01/03/04/06/08/10 trên staging |

Mock: `vi.mock('@/lib/firebase/firebase-client')` trả fake `onValue` để test logic Provider/hook; không test SDK Firebase.

## Docs
| File | Cập nhật |
|---|---|
| `docs/architecture/F16-notification-center.md` | Sơ đồ mới; bỏ pg_notify/SSE/polling; env 5 biến; rules; mapping project |
| `docs/qa/F16-notification-center.md` | Thêm TC-F16.43–.54; sửa TC-F16.17/.25 theo Firebase |
| `docs/qa/scenarios/vercel-phase2-code-changes.md` | Gỡ mô tả pg_notify/SSE lỗi thời |
| `docs/CHANGELOG.md` | 1 dòng feat F16 |

## Verify trước PR
- `npx tsc --noEmit`, `npm run lint`, `npm test`
- `node scripts/check-migrations.js origin/staging`, `node scripts/check-env-vars.js origin/staging`
- `npm run build` (firebase không vào first-load), `npm run payload generate:types`
- code-reviewer agent → sửa → **user review diff → user commit** (không auto-commit)

## PR
- Title: `feat(f16): realtime notification qua firebase rtdb signal`
- Body: `Relates to #1972`, checklist AC, nhắc phase 00 cho project dev trước merge; production chờ Blaze + rules PW1
