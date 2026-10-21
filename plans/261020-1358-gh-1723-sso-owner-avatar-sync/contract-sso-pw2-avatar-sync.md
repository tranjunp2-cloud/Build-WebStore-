# Contract — SSO → PWv2 avatar sync (v1)

Nguồn duy nhất cho cả 2 repo. Sửa contract = sửa file này + bump version.

## Endpoint
`POST {PRIME_WEB_V2_API_URL}/v1/sso/sync-avatar`
(`PRIME_WEB_V2_API_URL` đã có ở SSO, dạng `https://<pw2-host>/api`)

## Auth
`Authorization: Bearer <token super-admin PWv2>` — lấy bằng `PrimeWebV2Service::getAdminToken()`; gặp 401 → `loginAdmin()` rồi retry 1 lần (giống `banUser`).

## Request (JSON)
| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `sso_user_id` | int | ✔ | `users.id` của SSO |
| `email` | string | ✔ | email hiện tại trên SSO; chỉ dùng để bind lần đầu |
| `state` | `"PRESENT"` \| `"ABSENT"` | ✔ | từ cột `sso_profiles.avatar`: có giá trị → PRESENT, rỗng/null → ABSENT |
| `avatar_url` | string (https) | khi PRESENT | `storage_disk()->url('images/users/'.$avatar)` |
| `avatar_key` | string | khi PRESENT | giá trị cột `sso_profiles.avatar` (tên file, đổi mỗi lần upload) |
| `changed_at` | ISO-8601 | ✔ | `sso_profiles.updated_at` |
| `trigger` | `"update"` \| `"login"` \| `"backfill"` | ✔ | chỉ để log/báo cáo |

Ví dụ (dùng làm fixture test PWv2):
```json
{
  "sso_user_id": 1234,
  "email": "owner@example.com",
  "state": "PRESENT",
  "avatar_url": "https://<sso-bucket>.s3.<region>.amazonaws.com/images/users/12341760940800.1234.png",
  "avatar_key": "12341760940800.1234.png",
  "changed_at": "2026-10-20T06:40:00Z",
  "trigger": "update"
}
```

## Map user (PWv2)
1. Tìm `users.sso_user_id = sso_user_id` → dùng user đó (bỏ qua email).
2. Chưa có → **chỉ khi `ALLOW_EMAIL_BIND = true`** (mặc định `false` cho tới khi PO/BA xác nhận BR-23-04; tắt thì trả `409 email_bind_disabled`, chỉ Owner đã có `sso_user_id` — ví dụ provision mới — mới sync được) bind bằng email **chỉ khi tất cả** đúng:
   - email (so khớp không phân biệt hoa/thường) khớp **đúng 1** user (PWv2 cho phép trùng email khác `customerIdNumber` — AC-09 provision);
   - user là Owner (`tenants[].role === 'owner'`);
   - user chưa có `sso_user_id`;
   - `sso_user_id` chưa gắn user khác (unique index).
   → ghi `sso_user_id` bằng **một câu** `UPDATE users SET sso_user_id=$1 … WHERE id=$2 AND sso_user_id IS NULL RETURNING id` (atomic; không dùng `payload.update({where})`). 0 dòng hoặc unique violation Postgres `23505` → `409 sso_id_conflict`; lỗi DB khác **không** đổi thành 409 mà trả 500 để SSO retry. Sau đó xử lý tiếp.
3. Không thỏa → không đổi gì, trả `409` với `reason`, log `[V2][SSO SyncAvatar] skipped`.

## Xử lý trạng thái (PWv2)
| Điều kiện | Hành động |
|---|---|
| `avatar_key` == `users.sso_avatar_key` | no-op (idempotent), 200 `{ result: "unchanged" }` |
| `changed_at` < `users.sso_avatar_synced_at` | no-op (event cũ), 200 `{ result: "stale" }` |
| PRESENT | tải ảnh → Media → set `avatar`, `sso_avatar_key`, `sso_avatar_synced_at`; xóa Media cũ nếu là avatar SSO trước đó hoặc avatar local cũ của Owner → 200 `{ result: "updated" }` |
| ABSENT | `avatar = null`, `sso_avatar_key = null`, cập nhật `sso_avatar_synced_at`; xóa Media avatar cũ → 200 `{ result: "cleared" }` |
| Tải ảnh lỗi tạm (mạng, timeout, HTTP 5xx/429) | giữ avatar cũ (UNKNOWN) → `502` (SSO retry) |
| Ảnh bị từ chối cố định (URL không phải https, bị redirect 3xx, >2MB, không phải jpeg/png, HTTP 4xx) | giữ avatar cũ → `422` (không retry) |
| Hai sync cùng lúc cho 1 Owner | compare-and-set **atomic** bằng một câu `UPDATE users SET avatar_id=…, sso_avatar_key=…, sso_avatar_synced_at=… WHERE id=… AND sso_avatar_synced_at IS NOT DISTINCT FROM <giá trị đã đọc> RETURNING id`; bên thua xóa Media vừa tạo → 200 `{ result: "stale" }`. Tạo Media đi qua `withMediaCreateLock` (GH-1185) và tên file `sso-avatar-u<userId>-<ts>` để tránh Payload tự đổi số cuối tên file |

Ràng buộc tải ảnh: `https` (không user/pass, không custom port), host bất kỳ (không cần env) **nhưng phải phân giải ra IP công khai**: chặn loopback, private (10/8, 172.16/12, 192.168/16), link-local/metadata (169.254/16), CGNAT, multicast/reserved, và IPv6 tương đương (kể cả IPv4-mapped/NAT64/6to4); `localhost`, `*.localhost` bị chặn → 422 (rủi ro còn lại đã chấp nhận: DNS đổi giữa lúc kiểm tra và lúc tải — DNS rebinding — vì endpoint chỉ cho super-admin); `redirect: 'manual'` (không bao giờ theo redirect, 3xx → 422); timeout 10s; ≤ 2 MB; magic bytes JPEG/PNG; ảnh phải decode được và tổng số điểm ảnh ≤ 50 MP (chống ảnh decompression-bomb, vẫn nhận ảnh điện thoại nén tốt); DNS ENOTFOUND → 422, lỗi DNS tạm (EAI_AGAIN…) → 502.

## Response / mã lỗi
| HTTP | Ý nghĩa | SSO xử lý |
|---|---|---|
| 200 | `{ result: updated \| cleared \| unchanged \| stale }` | xong |
| 400 | payload sai | log, không retry |
| 401/403 | token sai / không phải super-admin | relogin 1 lần, sau đó log |
| 422 | ảnh bị từ chối cố định | log, không retry |
| 409 | không map được user (`reason`: `not_found` \| `ambiguous_email` \| `not_owner` \| `sso_id_conflict` \| `email_bind_disabled`) | log, không retry (vào báo cáo backfill) |
| 5xx / 502 / lỗi mạng | lỗi tạm | job thử tối đa 3 lần (retry sau 60s rồi 300s); hết lượt → log warning. Lần mở PW2 kế tiếp (`login`) sẽ gửi lại |
