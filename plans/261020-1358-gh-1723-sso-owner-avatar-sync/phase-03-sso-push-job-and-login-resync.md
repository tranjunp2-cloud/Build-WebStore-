# Phase 03 — SSO: job đẩy avatar + gửi lại khi Owner mở PWv2

**Repo:** `~/data/sso-api/main` (Laravel) · **Base:** `origin/tm-dev-deploy` · **Trạng thái:** ⬜ · **Phụ thuộc:** [contract](./contract-sso-pw2-avatar-sync.md)
**Không thêm test phía SSO** (theo yêu cầu) — kiểm chứng ở Phase 05.

## 0. Chuẩn bị
- Branch `feat/gh-1723-pw2-avatar-sync` từ `origin/tm-dev-deploy`, checkout trong `~/data/sso-api`.
- Tạo plan ngắn `main/plans/261020-gh-1723-pw2-avatar-sync/plan.md` theo convention repo SSO: liệt kê file sửa + link về plan này và contract (không chép payload).

## 1. Config
- `config/product/prime_web_v2.php` → `api_url.sync_avatar = $baseUrl . '/v1/sso/sync-avatar'`. Không thêm env mới, không có công tắc bật/tắt (quyết định 2026-10-20).

## 2. Service — `app/Services/Products/PrimeWebV2Service.php`
- `buildAvatarPayload($user, string $trigger): array` — đọc `$user->profile` trực tiếp từ DB: `avatar` rỗng → ABSENT; có → PRESENT + `avatar_url = storage_disk()->url('images/users/'.$avatar)` (KHÔNG dùng `getImageUser`, tránh list S3 + null mơ hồ). `changed_at = profile.updated_at` ISO-8601.
- `syncAvatar($user, string $trigger, $getResponse = false)` — `Http::timeout(15)->withToken($adminToken)->post(...)`, xử lý 401 → `loginAdmin()` retry 1 lần (copy pattern `banUser`), `_log_response_message('sync-avatar', ...)`. Trả `['status','content']`.

## 3. Job — `app/Jobs/Product/SyncAvatarPrimeWebV2.php`
- `ShouldQueue`, `$tries = 3`, `$timeout = 80` (< redis `retry_after` 90), retry bằng `release()` 60s rồi 300s (Laravel 7 không có `backoff()`), constructor `($userId, $trigger)` (lưu id, load lại user trong `handle` để lấy avatar mới nhất).
- `handle`: bỏ qua nếu user không có product `PRIME_WEB_V2_TYPE`. Gọi `syncAvatar`. HTTP 0 (lỗi mạng)/5xx → `release()` để retry (tối đa 3 lần, hết lượt thì log warning); 4xx (400/409/422) → log, không retry. `dispatchSafely` bắt `\Throwable` nên lỗi queue không làm hỏng upload avatar/redirect.
- Hàm helper tĩnh `dispatchIfEligible($user, $trigger)` để các nơi gọi dùng chung.

## 4. Điểm gọi
| Nơi | Trigger | Ghi chú |
|---|---|---|
| `UserService::updateImage` sau `DB::commit()` | `update` | dispatch sau commit, không chặn response |
| `UserTokenApiController` (nhánh dùng `PrimeWebV2Service`, sau khi lấy được `$url`) | `login` | dispatch async → không làm chậm redirect; bù lần đẩy bị lỡ |
| `PrimeWebV2Service::registerUser` | — | thêm `sso_user_id => $user->id` vào `$params` provision |

## 5. Kiểm tra thủ công (thay test)
- `php -l` các file sửa; `php artisan config:clear`.
- Local/dev: đổi avatar qua `PUT /api/v1/me/avatar` → log `[V2] SyncAvatar` status 200; PWv2 nhận đúng payload.

## Hoàn thành khi
- [x] Code + config, lint PHP sạch (PHP 7.2)
- [ ] Đẩy thủ công 1 user dev thành công (PRESENT và ABSENT)
- [ ] Plan ngắn trong repo SSO đã tạo
