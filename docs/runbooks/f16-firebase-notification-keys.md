# Runbook — Lấy key Firebase cho F16 realtime notification (#1972)

> Dành cho dev/DevOps khi bật "chuông báo" Firebase cho một môi trường (local, staging, production).
> Kiến trúc: `docs/architecture/F16-notification-center.md` §2a. Rules: `firebase/pw2-database-rules.json`.

## 1. Cần những key nào

Code hiện tại cần **5 biến, tất cả server-only** (không có `NEXT_PUBLIC_FIREBASE_*`; client nhận config qua `GET /api/notifications/firebase-token`).

| Biến | Lấy ở đâu | Dùng để làm gì | Bí mật? |
|---|---|---|---|
| `FIREBASE_PROJECT_ID` | File JSON service account → `project_id` | Định danh project | Không |
| `FIREBASE_CLIENT_EMAIL` | File JSON service account → `client_email` | Danh tính service account | Không (nhưng đừng public) |
| `FIREBASE_PRIVATE_KEY` | File JSON service account → `private_key` | Ký custom token cho user + đổi lấy access token để server ghi RTDB | **Có — tuyệt đối không commit** |
| `FIREBASE_DATABASE_URL` | Console → Realtime Database → URL trên cùng | Địa chỉ RTDB (server ghi, client nghe) | Không |
| `FIREBASE_WEB_API_KEY` | Console → Project settings → General → Your apps → Web app → `apiKey` | Client SDK khởi tạo + đăng nhập bằng custom token | Không (key công khai, nằm trong trình duyệt) |

Thiếu bất kỳ biến nào → tính năng **tự tắt** (`enabled:false`), client quay về poll 60s. Không lỗi app.

Trên Vercel còn cần `VERCEL_TARGET_ENV` (Vercel tự cấp, **không** tạo tay) để chọn prefix `pw2/staging` / `pw2/production`. Nếu runtime không có biến này, tín hiệu cũng tự tắt (fail-closed) để staging và production không ghi chung một prefix. Local (không phải Vercel) dùng prefix `development`.

> ⚠️ **Không dùng project Firebase của PW1** (`primeweb-tm-development`, `prime-web-tm-production`): rules của PW1 mở `.read: true` ở root (đã kiểm tra cả dev và production) → rules `pw2` bị vô hiệu. Mỗi môi trường PW2 dùng project riêng.

| Môi trường | Project Firebase | Gói |
|---|---|---|
| Local | project test (ví dụ `pw2-c82c2`) | Spark (free) |
| Staging | project PW2 staging (tạo mới) | Spark được |
| Production | project PW2 production (tạo mới) | **Blaze bắt buộc** (Spark giới hạn ~100 kết nối đồng thời; mỗi tab mở = 1 kết nối) |

## 2. Tạo và cấu hình project (làm 1 lần / môi trường)

1. **Tạo project**: [console.firebase.google.com](https://console.firebase.google.com) → *Add project* → đặt tên (ví dụ `pw2-staging`). Google Analytics: tắt (không cần).
2. **Bật Realtime Database**: *Build → Realtime Database → Create database*
   - Location: **Singapore (`asia-southeast1`)** (gần người dùng Malaysia).
   - Security rules: chọn **Start in locked mode**.
3. **Bật Authentication**: *Build → Authentication → Get started*. **Không cần bật provider nào** — chỉ cần Auth được khởi tạo để custom token hoạt động.
4. **Deploy rules**: *Realtime Database → tab Rules* → dán nguyên nội dung `firebase/pw2-database-rules.json` → *Publish*.
5. **Production**: *Upgrade* lên gói **Blaze** trước khi bật trên `main`.

## 3. Lấy từng key

### 3.1 Service account → `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

1. *Project settings* (bánh răng) → tab **Service accounts** → *Firebase Admin SDK*.
2. Bấm **Generate new private key** → tải về file `*.json`.
3. Mở file, lấy 3 trường:
   ```json
   {
     "project_id": "…",        → FIREBASE_PROJECT_ID
     "client_email": "firebase-adminsdk-…@….iam.gserviceaccount.com",  → FIREBASE_CLIENT_EMAIL
     "private_key": "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"  → FIREBASE_PRIVATE_KEY
   }
   ```
4. Sau khi copy xong: **xoá file JSON khỏi máy** (hoặc cất vào password manager). Không gửi qua chat, không để trong repo.

> Không phải vào Google Cloud Console: Firebase project chính là một Google Cloud project, nút *Generate new private key* ở Firebase Console đủ dùng.

### 3.2 Web API key → `FIREBASE_WEB_API_KEY`

1. *Project settings* → tab **General** → mục *Your apps*.
2. Chưa có app → bấm biểu tượng **`</>`** (Web) → đặt tên (ví dụ `pw2-web`) → *Register app* (không cần Firebase Hosting).
3. Copy giá trị `apiKey` (dạng `AIza…`) trong đoạn `firebaseConfig`. Các trường khác trong đoạn đó **không cần**.

### 3.3 Database URL → `FIREBASE_DATABASE_URL`

*Build → Realtime Database* → tab *Data* → URL phía trên, dạng:
`https://<project-id>-default-rtdb.asia-southeast1.firebasedatabase.app`
(dấu `/` cuối có hay không đều được — code tự bỏ).

## 4. Điền key

### Local — `.env.local` (gitignored)

```bash
FIREBASE_PROJECT_ID=pw2-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@pw2-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://pw2-xxxxx-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_WEB_API_KEY=AIza...
```

`FIREBASE_PRIVATE_KEY` để **trên 1 dòng**, giữ nguyên các ký tự `\n` như trong file JSON (code tự đổi `\n` → xuống dòng).

### Staging / Production — Vercel Dashboard

`vercel.com/nguyen-phuongs-projects/ech-prime-web-v2/settings/environment-variables` (xem `.claude/rules/env-vars.md`):

1. Thêm 5 biến, chọn đúng scope:
   - Staging: **Custom Environment `staging`** (Preview **không** tự kế thừa).
   - Production: **Production**.
2. `FIREBASE_PRIVATE_KEY`: dán chuỗi có `\n` dạng chữ, **không** bọc dấu ngoặc kép.
3. `FIREBASE_PRIVATE_KEY` có quyền **admin** project → nên chọn loại *Sensitive*. Giá trị Sensitive không xem lại được trên Dashboard, nên **kiểm tra key bằng smoke script (mục 5, bước 1) trước khi dán**; sai định dạng thì dán lại giá trị mới (không cần xem giá trị cũ).
4. **Deploy lại**: env chỉ áp dụng cho deployment tạo **sau** khi thêm biến. Repo tắt Git deploy của Vercel (`git.deploymentEnabled: false`), deploy chỉ chạy qua GitHub Actions:
   - Staging: GitHub → *Actions* → run **CI** của commit mới nhất trên `staging` → *Re-run jobs* → chọn **Deploy: Vercel (staging)**. (Hoặc chờ lần merge code tiếp theo vào `staging`; push chỉ đổi `docs/**` / `*.md` **không** kích hoạt deploy.)
   - Production: tương tự với run trên `main`.

Placeholder đã có sẵn trong `.env.staging.example`, `.env.production.example`, `.env.example`.

## 5. Kiểm tra

1. **Smoke script** (không in secret; chỉ ghi rồi xoá `pw2/smoke/*`, tạo rồi xoá 1 user Auth tạm):
   ```bash
   node --env-file=.env.local scripts/firebase-signal-smoke.mjs
   ```
   Mọi dòng phải là `OK` (10 check): service account lấy được access token, server ghi được, đọc ẩn danh **bị chặn**, custom token sign-in (Auth đã bật), đọc node của mình + broadcast, **bị chặn** đọc user khác / liệt kê danh sách user / env khác, client **không ghi được**. Cuối cùng in `All checks passed`.
   Kiểm tra key staging/production: tạo file env tạm ngoài repo chứa 5 biến đó rồi trỏ `--env-file` vào, chạy xong xoá file.
2. **Token endpoint**: đăng nhập dashboard → mở `/api/notifications/firebase-token` → phải thấy `"enabled": true` và `userPath` = `pw2/<env>/u/<userId>` (`<env>` = `development` ở local, `staging`/`production` trên Vercel).
3. **End-to-end**: tạo 1 đơn COD → toast ORDER_NEW ≲1s; tab DevTools → Network không có request `/api/notifications` lặp định kỳ khi idle.

## 6. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `enabled:false`, không có log `[Signal]` | Thiếu 1 trong 5 biến ở **đúng scope**, hoặc đã thêm nhưng chưa deploy lại | Kiểm tra env theo scope → deploy lại (mục 4) |
| `enabled:false` + log `[Signal] VERCEL_TARGET_ENV is not set at runtime; Firebase signal disabled` | Runtime Vercel không có `VERCEL_TARGET_ENV` | Biến do Vercel tự cấp, không tạo tay được → báo dev |
| `enabled:false` + log `[Signal] Firebase admin init failed` | `FIREBASE_PRIVATE_KEY` sai định dạng (bị bọc ngoặc trên Vercel, mất `-----BEGIN…`, xuống dòng thật lẫn `\n`) | Dán lại đúng 1 dòng có `\n` → deploy lại |
| Log `[Signal] RTDB write failed: …invalid_grant…` hoặc `[Signal] RTDB PATCH … -> 401` | Key đã bị xoá/thu hồi, hoặc email và key thuộc 2 service account khác nhau | Generate key mới, cập nhật cả 3 biến service account |
| Log `[Signal] RTDB … -> 404` | Sai `FIREBASE_DATABASE_URL` (dùng `*.firebaseio.com` thay vì URL có region, hoặc sai tên DB) | Copy lại URL từ tab Data |
| Client `permission_denied` → poll 60s | Chưa publish rules, hoặc rules khác file repo | Dán lại `firebase/pw2-database-rules.json` → Publish |
| `auth/configuration-not-found` khi sign-in | Chưa bấm *Authentication → Get started* | Bật Authentication (bước 2.3) |
| `auth/requests-from-referer-…-are-blocked` hoặc `API key not valid` khi sign-in | Web API key bị giới hạn (HTTP referrer / API restrictions) trong Google Cloud | Thêm domain staging/production vào referrer cho phép và cho phép *Identity Toolkit API* + *Token Service API* (hoặc bỏ giới hạn) |
| Kết nối được một lúc rồi rớt hàng loạt (production) | Gói Spark hết ~100 kết nối | Lên Blaze |

## 7. Bảo mật & xoay key

- Chỉ `FIREBASE_PRIVATE_KEY` là bí mật thật; nó cho quyền **admin** project → chỉ để ở Vercel Dashboard và `.env.local`.
- Lộ key: *Google Cloud Console → IAM & Admin → Service accounts → (firebase-adminsdk) → Keys* → xoá key bị lộ → *Generate new private key* ở Firebase Console → cập nhật env → deploy lại.
- Rollback / tắt tính năng: xoá 5 biến trên Vercel → deploy lại → client tự poll 60s như cũ.
