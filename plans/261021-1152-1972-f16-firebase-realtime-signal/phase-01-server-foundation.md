# Phase 01 — Server foundation (commit 1)

## Overview
- Priority: P1 · Status: ⬜ · Phụ thuộc: không (chạy với `.env.local` project test)
- Kết quả: helper Firebase server, `runAfterResponse`, token endpoint, env, rules file, smoke script. Chưa đổi hành vi app.

## Files
**Tạo**
| File | Nội dung | ~LOC |
|---|---|---|
| `src/lib/firebase/firebase-admin-app.ts` | `getFirebaseServerConfig()` đọc 5 env (null nếu thiếu); `getFirebaseAdminApp()` singleton tên `'pw2-notif'` (`getApps().find`), `privateKey.replace(/\\n/g, '\n')`, `cert()` throw → log 1 dòng + null; `getFirebaseAccessToken()` **cache promise** tới `expires − 60s`, lỗi → xoá cache | 60 |
| `src/lib/notifications/notification-signal-env.ts` | `getNotificationSignalEnv()` = `process.env.VERCEL_TARGET_ENV` lowercase lọc `[a-z0-9-]`, fallback `'development'` (nếu `process.env.VERCEL==='1'` mà thiếu → `console.warn` 1 lần); `signalUid(id)`, `userSignalPath(id)`, `broadcastSignalPath()` | 30 |
| `src/lib/notifications/signal-notification.ts` | `signalNotificationUsers(userIds)` → 1 `PATCH {db}/pw2/{env}/u.json` body `{ "<id>": { "at": {".sv":"timestamp"} } }`; `signalNotificationBroadcast()` → `PUT …/broadcast.json`. `AbortSignal.timeout(3000)`. **Không throw**: no-op khi chưa cấu hình / không có id hợp lệ (`Number.isInteger > 0`, dedupe); lỗi `console.error('[Signal] …')` | 55 |
| `src/lib/runtime/run-after-response.ts` | `runAfterResponse(label, task)`: `try { after(() => task().catch(log)) } catch { void task().catch(log) }` (pattern `easyparcel-save/route.ts:155-167`). JSDoc: task không được dùng `req` / transaction của request | 25 |
| `src/app/api/notifications/firebase-token/route.ts` | `GET`, `withAuth`, `dynamic='force-dynamic'`, rate-limit `notifications:fb-token:{id}` 10/phút (429 + `Retry-After`); chưa cấu hình → `200 {enabled:false}`; OK → `{enabled:true, token, config:{apiKey, databaseURL, projectId}, userPath, broadcastPath}`; `Cache-Control: no-store`; lỗi → 500 không lộ chi tiết | 55 |
| `firebase/pw2-database-rules.json` | `{ "rules": { "pw2": … } }` (bản phase 00) | 20 |
| `scripts/firebase-signal-smoke.mjs` | Port script smoke đã chạy trên project test (đọc env từ `--env-file`, không in secret): token admin, custom token sign-in, đọc own/other/broadcast/list/other-env, client write bị chặn, cleanup | 90 |

**Sửa**
| File | Thay đổi |
|---|---|
| `package.json` / lock | `firebase-admin@^14`; giữ `firebase@^13` |
| `.env.example`, `.env.staging.example`, `.env.production.example` | 5 biến placeholder + comment project nào. `.env.qc-test.example`: comment "để trống → poll dự phòng" |
| `scripts/check-env-vars.js` | thêm `'VERCEL_TARGET_ENV'` vào `BUILT_IN_VARS` (biến hệ thống Vercel; không thêm thì CI exit 1). **Không** đụng `REQUIRED_DEPLOYMENT_SECRETS`. Không dùng `VERCEL_ENV` trong code mới |

## Implementation steps
1. `git checkout -b feat/F16-firebase-realtime-signal` từ `staging` (mang `package.json` đang sửa), `npm i firebase-admin@^14`.
2. `.env.local`: thêm `FIREBASE_WEB_API_KEY`, xoá 4 `NEXT_PUBLIC_FIREBASE_*` (D6).
3. Viết env helper → admin app → signal helper → `runAfterResponse` → token route (`getAuth(app).createCustomToken(signalUid(user.id))`).
4. Smoke script + rules file.
5. `npm run build`: nếu bundler lỗi với `firebase-admin` → thêm `serverExternalPackages: ['firebase-admin']` vào `next.config`.
6. `npx tsc --noEmit`, lint, `node scripts/check-env-vars.js origin/staging`.
7. Kiểm tra `npm run payload generate:types` vẫn chạy (M10 — collections sẽ import helper có `next/server` ở phase 02; làm sớm để biết).

## Success criteria
- `GET /api/notifications/firebase-token` (đã login) → `enabled:true`, `userPath=pw2/development/u/{id}`
- Gọi signal helper → node xuất hiện trên project test
- Thiếu env → `enabled:false`, helper no-op, không log rác
- `check-env-vars` pass

## Risks
| Rủi ro | Giảm thiểu |
|---|---|
| firebase-admin nặng / cold start | chỉ `app` + `auth`, dynamic import |
| Private key sai format | normalize `\n`; `cert()` lỗi → `enabled:false` + log |
| `VERCEL_TARGET_ENV` thiếu ở runtime | warn log → phát hiện ngay trên staging; env khi đó = `development` (vẫn chạy, chỉ sai prefix) |

## Security
- Endpoint yêu cầu session PW2; uid do server quyết định
- Không log token / private key / access token
