---
title: F16 realtime notification qua Firebase RTDB (signal-only), bỏ polling
issue: 1972
branch: feat/F16-firebase-realtime-signal (từ staging)
status: implemented-pending-user-review (code xong, chưa commit)
created: 2026-10-21
review: plans/reports/reviewer-261021-1152-f16-firebase-plan-review.md
---

# Plan — #1972 F16 Firebase realtime signal

Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1972 (AC-01…AC-11)
Brainstorm: `plans/reports/brainstorm-261020-1714-firebase-rtdb-notification-signal.md`

## Mục tiêu
Postgres vẫn là nguồn sự thật. Server ghi tín hiệu `{at}` lên RTDB `pw2/{env}/u/{userId}` / `pw2/{env}/broadcast`; client nghe → gọi `GET /api/notifications` sẵn có. Bỏ vòng poll 15s/60s; chỉ poll 60s khi Firebase lỗi cứng.

## Quyết định kỹ thuật
| # | Quyết định | Lý do |
|---|---|---|
| D1 | Auth = custom token `pw2_{env}_{userId}` (firebase-admin/auth), client `inMemoryPersistence` | Cách A; rules đã verify trên project test `pw2-c82c2` |
| D2 | Ghi tín hiệu bằng **REST** (`PATCH {db}/pw2/{env}/u.json`, Bearer token từ credential firebase-admin); không dùng `firebase-admin/database` | Serverless: stateless, 1 HTTP call/batch, không websocket |
| D3 | Trong `notifyTenantOwners`: tạo rows với `context.skipPush` → **signal trước** (1 PATCH) → **push sau** (allSettled, timeout 5s). Hook Notifications chỉ push cho create tay (super-admin) | Tránh await push trong transaction của create (pool 25 conn → deadlock); signal không phải chờ push chậm (AC-01) |
| D4 | Producer bọc `runAfterResponse()` (helper quanh `after()` + fallback chạy ngay); task không giữ `req` | Hết rủi ro Vercel kill promise |
| D5 | `env` = `VERCEL_TARGET_ENV` (staging/production/preview) fallback `development`; chỉ tính ở server | Custom env staging có `VERCEL_ENV=preview` |
| D6 | **Client config lấy từ token endpoint** (`apiKey`, `databaseURL`, `projectId`) → **5 env server-only**, không có `NEXT_PUBLIC_FIREBASE_*` | Một nguồn cấu hình; không bake vào bundle; bớt 3 biến |
| D7 | Client chỉ fetch ở tab đang hiển thị; tab ẩn đánh dấu dirty | Không nhân request theo số tab (rate-limit 60/phút) |
| D8 | Watermark `since` = `createdAt` server mới nhất − 5s, dedupe `seenIds`; sync `limit=50` | Bỏ đồng hồ client; offline lâu vẫn đủ toast |
| D9 | Push handler và signal-sync dùng chung `seenIds` → mỗi id toast **1 lần** | AC-08 |
| D10 | Broadcast: jitter 0–5s trước khi fetch | Tránh mọi seller cùng gọi API |

## Phases
| Phase | Nội dung | Commit | Status |
|---|---|---|---|
| [00](phase-00-infra-prerequisites.md) | Hạ tầng Firebase + env (không phải code) | — | ⏳ project test xong; PW1 dev/prod chờ quyền |
| [01](phase-01-server-foundation.md) | firebase-admin, signal helper, `runAfterResponse`, token endpoint, env, smoke script | 1 | ✅ |
| [02](phase-02-server-producers-and-signals.md) | notifyTenantOwners (signal→push), hook, broadcast, mark-read, producers → `after()` | 2 | ✅ |
| [03](phase-03-client-signal-subscription.md) | Firebase client lazy, `useNotificationSignal`, viết lại `NotificationProvider` | 3 | ✅ |
| [04](phase-04-cleanup-tests-docs.md) | Drop pg trigger, tests TC-F16.45→.54, docs | 4 | ✅ |

Tuần tự 01 → 02 → 03 → 04. Mỗi commit phải xanh test (sửa test bị ảnh hưởng ngay trong commit đó).

## Env (5 biến, server-only — Vercel Dashboard + `.env.staging.example` + `.env.production.example`)
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL`, `FIREBASE_WEB_API_KEY`
⚠️ `.env.local` hiện có 8 biến kiểu cũ → đổi: thêm `FIREBASE_WEB_API_KEY` (= giá trị `NEXT_PUBLIC_FIREBASE_API_KEY`), xoá 4 biến `NEXT_PUBLIC_FIREBASE_*`.

## Phụ thuộc mới
- `firebase-admin@^14` (server; chỉ `firebase-admin/app` + `firebase-admin/auth`)
- `firebase@^13` — đã có trong `package.json` **uncommitted trên staging** → mang sang branch feature

## Rủi ro chính
1. Rules PW1 có `.read: true` ở root → cascade, vô hiệu rules `pw2` (phase 00).
2. Quota Spark ~100 kết nối dùng chung PW1 → **production phải Blaze trước khi lên main** (gate phase 00).
3. `maxDuration`: `api/**` 120s, cron 60s → task `after()` của cron reconcile chia budget còn lại (phase 02).

## Cập nhật issue #1972 sau khi duyệt plan
- Env: 8 → 5 biến (D6); rollback = xoá env **+ redeploy** (env Vercel gắn theo deployment)
- `check-env-vars.js`: **có** sửa — thêm `VERCEL_TARGET_ENV` vào `BUILT_IN_VARS`
- Production Blaze là điều kiện bắt buộc

## Open questions
- Quyền Console `primeweb-tm-development` / `prime-web-tm-production`?
- Rules hiện tại của 2 project PW1 (root `.read`?)
- Production Spark hay Blaze?
- `VERCEL_TARGET_ENV` có ở runtime với `vercel deploy --prebuilt` không? (verify khi lên staging; có log cảnh báo nếu thiếu)

## Kết quả triển khai (2026-10-21)
- Code + tests xong, chưa commit. tsc/lint/`check-env-vars`/`check-migrations` pass; full suite 953 file / 14.535 test pass; smoke Firebase pass trên project test.
- Review code: `plans/reports/code-reviewer-261021-1152-f16-firebase-implementation.md` — 0 Critical; đã sửa I-1/2/3/5/6, M-1/4/7 + thêm TC-F16.55–.57.
- Thay đổi so với plan: rules/project PW1 dùng chung **không** làm nữa (rules PW1 `.read/.write: true` ở root) → dùng project Firebase riêng cho PW2 (staging/production), phase 00 chỉ còn cho project riêng.
- Chưa làm: build thật (`scripts/build.sh` chạy db-setup trên DB), test trình duyệt thủ công AC-01/02/03/04/06/08/10, key + rules cho project staging/production.
