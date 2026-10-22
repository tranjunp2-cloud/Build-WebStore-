# Scout — Đồng bộ avatar Owner từ SSO (#1723): phương án triển khai

Repo: SSO `~/data/sso-api/main` (Laravel, Passport) · PWv2 `ech-prime-web-v2`. Scout chỉ đọc, không sửa code. Ngày 2026-10-19.

## 1. Phía SSO (đã xác minh trong code)

| Chủ đề | Kết quả | Tham chiếu |
|---|---|---|
| Lưu trữ | `sso_profiles.avatar` **chỉ chứa tên file** (`{userId}{microtime}.{ext}`). File nằm trên S3 `images/users/`, upload ở chế độ `public` | `UserService::updateImage` L1445, `S3Service::uploadImageS3` |
| URL | Public, không hết hạn: `storage_disk()->url('images/users/'.$name)` | `S3Service::getImageS3` |
| Cập nhật | Chỉ có `PUT /api/v1/me/avatar` (user tự đổi, jpeg/png ≤2MB). Mỗi lần đổi tạo tên file mới; **file S3 cũ bị xóa ngay sau commit** → URL cũ trả 404 | `UserProfileApiController::updateAvatar` |
| Xóa | **Không có endpoint xóa avatar.** ABSENT chỉ có nghĩa là chưa từng đặt avatar | routes/api/v1/user.php |
| Đọc | `/api/v1/me?include=profile` (profile không nằm trong include mặc định). `getImageUser` liệt kê toàn bộ thư mục S3, trả `null` nếu không tìm thấy file → `null` mơ hồ (không có avatar hay file bị mất) | `UserTransformer`, `UserService::getImageUser` L1812 |
| `remote_avatar` | Cột có tồn tại nhưng không có chỗ nào ghi | `UserProfile` |
| Đẩy sang product | Chỉ có luồng đẩy tên/giới tính (job `UpdateProfile*` qua `PROFILE_USER_COMMAND`). **Đổi avatar không kích hoạt gì.** Không có framework webhook gửi ra ngoài | `UserService::updateProfile` L1301, `JobBase::preparePayload` |
| Định danh | `users.id` của SSO là số nguyên (khóa chính, ổn định). Tích hợp PWv2 hiện xác định user **bằng email** | `PrimeWebV2Service` |
| Tích hợp PWv2 | `PrimeWebV2Service` + `config/product/prime_web_v2.php` (product_id=8). Gọi `/api/v1/sso/*` của PWv2 bằng **Bearer super-admin** (login qua `/users/login`, gặp 401 thì login lại rồi retry). **Chỉ có trên `hotfix/primeweb-v2-integration` / `tm-dev-deploy`, KHÔNG có trên `tm-master`/`master`** | branch diff: 18 file, +835 dòng |
| PWv2 tự pull | `GET /api/v1/users/{id}` yêu cầu `is_admin` và có lọc theo created_by → dễ lỗi. Lúc login PWv2 không có SSO user token (chỉ có Payload JWT `v2_token` của chính PWv2) | `UserApiController::single` |
| Queue | Laravel job + bảng `queue_sync` + command `RetryQueueSyncProduct` (pattern retry có sẵn) | `Jobs/Profile/*`, `Console/Commands/RetryQueueSyncProduct.php` |

## 2. Phía PWv2

- `users.avatar` là field upload trỏ tới `media`. Không có cột `ssoUserId`; email là định danh duy nhất.
- `POST /api/users/me/avatar` **không chặn Owner**. Quyền self-update của collection cũng cho phép sửa `avatar` → vi phạm PD-F23-02.
- Header: `(dashboard)/layout.tsx` đọc `avatar.url` (depth 1) rồi đưa vào `UserAvatarContext`. UI của Owner đã read-only (`owner-profile-view.tsx`).
- Các route `/api/v1/sso/*` dùng pattern Bearer super-admin (provision, ban, change-email...). Chưa có route cho avatar.
- Media lưu trên S3 (`s3Storage`). Có tiền lệ tải file từ xa: `src/lib/migration/pw1-media.ts` (`redirect:'error'`, timeout 30s). Chưa có util chung kiểu "URL → Media".
- Login `sso-session` không gọi ra SSO.

## 3. Các phương án

### A. SSO đẩy sang endpoint PWv2, PWv2 lưu bản cache vào Media (ĐỀ XUẤT)
Phía SSO:
1. Thêm `PrimeWebV2Service::syncAvatar($user)` → `POST {PW2}/v1/sso/sync-avatar` (dùng cùng cơ chế Bearer admin + retry khi 401 như ban/changeEmail).
2. Payload: `{ sso_user_id, email, state: PRESENT|ABSENT, avatar_url?, avatar_key (tên file), changed_at }`. Xác định state từ **cột trong DB** (rỗng → ABSENT). Tạo URL trực tiếp bằng `storage_disk()->url()`, không qua `getImageUser` (tránh liệt kê S3 và tránh `null` mơ hồ).
3. Job queue `SyncAvatarPrimeWebV2` được dispatch sau khi `updateImage` commit (chỉ khi user có product 8), retry qua `queue_sync`.
4. Fallback khi login: dispatch cùng job (bất đồng bộ) tại chỗ SSO tạo link redirect sang PW2 (`initTokenProduct`/`getSingleUrlLogin`) → bù cho các lần đẩy bị lỡ mà PWv2 không cần pull.
5. Artisan command `sync:prime-web-v2-avatars` để backfill một lần (dùng lại job trên).

Phía PWv2:
1. Route `src/app/api/v1/sso/sync-avatar/route.ts` (Bearer super-admin giống các route cùng nhóm; validate bằng zod).
2. Tìm user theo `ssoUserId`, nếu không có thì áp dụng quy tắc fallback do PO chốt (xem câu hỏi 2). User phải là tenant owner.
3. Idempotency/thứ tự: lưu `ssoAvatarKey` + `ssoAvatarSyncedAt`; bỏ qua nếu trùng key hoặc `changed_at` cũ hơn (phần microtime trong tên file cũng tăng dần).
4. PRESENT → tải ảnh (chỉ cho phép host S3 public của SSO, `redirect:'error'`, ≤2MB, kiểm tra magic bytes jpeg/png) → tạo Media → gán `users.avatar`, xóa Media cũ có nguồn từ SSO. ABSENT → xóa avatar + xóa Media. Tải lỗi → giữ avatar cũ (UNKNOWN), trả 5xx để SSO retry.
5. Schema: thêm `users.sso_user_id` (unique, nullable), `sso_avatar_key`, `sso_avatar_synced_at` + entry trong `MIGRATIONS` của `scripts/db-setup.js`. Từ nay provision nhận thêm `sso_user_id`.
6. Chặn Owner: thêm `blockOwner` vào `POST /api/users/me/avatar` + `access.update` cấp field cho `avatar` (Owner → false, trừ luồng nội bộ/super-admin).

Ưu điểm: dùng lại kênh SSO→PW2 sẵn có (auth, retry); thời gian đồng bộ ≈ độ trễ queue (vài giây); không cần thêm secret mới. Nhược điểm: phải sửa repo SSO (và xử lý vấn đề branch của SSO); map bằng email cho tới khi backfill xong `sso_user_id`.

### B. Cũng SSO đẩy sang, nhưng PWv2 chỉ lưu link SSO (không tải ảnh về)
Chỉ lưu chuỗi URL. Ít code hơn (không cần tải ảnh, chống SSRF, dọn file). Rủi ro: URL cũ trả 404 ngay khi Owner đổi avatar lần sau mà lần đẩy bị lỡ → cần `<img onError>` để fallback về chữ cái tắt; trái với yêu cầu "bản cache" trong PRD. Chỉ phù hợp làm bước tạm cho giai đoạn 1.

### C. PWv2 tự lấy từ SSO khi login
Loại: PWv2 không giữ SSO user token; endpoint admin `users/{id}` có bộ lọc, dễ lỗi; làm chậm login; vẫn phải sửa SSO để trả URL avatar.

## 4. Ước lượng công sức (sơ bộ, phương án A)
SSO: ~1–1.5 ngày (method service, job, gắn vào updateImage + redirect, command backfill). PWv2: ~2–3 ngày (route, util tải ảnh, schema/migration, chặn Owner, test có TC-ID). Cộng thêm E2E trên staging.

## 5. Giải quyết các câu hỏi dựa trên code `tm-dev-deploy` (cập nhật 2026-10-20)

| # | Câu hỏi | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Branch SSO | ✅ `tm-dev-deploy` (có `PrimeWebV2Service`, code PW2 tương đương `hotfix/primeweb-v2-integration`; khác nhau chỉ ở 6 file Mongo/Subscription) | `git diff --stat` |
| 2 | Định danh | ⚠️ Kỹ thuật giải được, cần PO nới PRD. Email hiện là khóa thực tế của mọi tích hợp PW2 (provision/ban/unban/change-email). `users.email` của SSO `unique` ở DB (kể cả bản ghi soft-delete). Đổi email trên SSO được đẩy sang PW2 qua job `ChangeEmailProductUser`. Đề xuất: gửi `sso_user_id` + `email`; PWv2 tìm theo `sso_user_id`, nếu chưa có thì khớp email + phải là Owner → gắn `sso_user_id` (bind lần đầu); không khớp/không phải Owner → bỏ qua + log báo cáo | migration `create_users_table` L28, `ChangeEmailProductUser.php` |
| 3 | Auth endpoint | ✅ Về kỹ thuật: dùng Bearer super-admin. Cả 9 route `/v1/sso/*` đều dùng cách này; SSO đã có `getAdminToken` + retry khi 401; SSO không có util HMAC (làm HMAC = thêm secret + code ở cả 2 bên). Security chỉ cần xác nhận chấp nhận | `PrimeWebV2Service` |
| 4 | ABSENT | ✅ Chỉ có 1 đường ghi avatar (`updateImage`, thay thế). Không có xóa, không có đường admin, `remote_avatar` không ai ghi. Quy ước: cột có giá trị → PRESENT; cột rỗng → ABSENT (chưa từng đặt); lỗi mạng/5xx/tải file lỗi/file S3 mất → UNKNOWN (giữ avatar cũ) | `git grep avatar` trên `tm-dev-deploy` |

## Câu hỏi chưa giải quyết
1. PO: đồng ý "bind `sso_user_id` lần đầu bằng email + điều kiện Owner" thay cho quy định cấm fallback email trong PRD?
2. Security: xác nhận dùng Bearer super-admin (giống các route `/v1/sso/*`) cho endpoint mới.
3. Ai review/deploy thay đổi trên repo SSO (`tm-dev-deploy`)?
4. Giao đợt đầu theo phương án A (cache Media) hay B (lưu link)? Đề xuất A.
