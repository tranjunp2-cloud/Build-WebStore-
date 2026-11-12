# Phase 04 — Backfill + báo cáo map user

**Repo:** SSO (command) + PWv2 (endpoint Phase 02 đã đủ) · **Trạng thái:** ⬜ · **Phụ thuộc:** Phase 02, 03 đã deploy

## SSO — `app/Console/Commands/SyncPrimeWebV2Avatars.php`
- Signature: `sync:prime-web-v2-avatars {--user-id=*} {--dry-run} {--chunk=100}`.
- Lấy user có product `PRIME_WEB_V2_TYPE` (chunk), gọi **đồng bộ** `PrimeWebV2Service::syncAvatar($user, 'backfill', true)` (không qua queue để có kết quả ngay), sleep nhẹ giữa chunk.
- `--dry-run`: chỉ in payload sẽ gửi (không gọi PWv2).
- Kết quả: in bảng tổng (`updated/cleared/unchanged/stale/409 theo reason/lỗi`) + ghi CSV `storage/app/reports/pw2-avatar-backfill-{date}.csv` (`sso_user_id, email, state, http, result, reason`).
- Chạy lại an toàn (idempotent nhờ `avatar_key`).

## Trình tự chạy
1. Staging: `--dry-run` → chạy thật → xem CSV.
2. Xử lý từng dòng 409:
   - `not_found`: Owner có PW2 product ở SSO nhưng không có user ở PWv2 → kiểm tra provision.
   - `ambiguous_email`: nhiều user PWv2 cùng email → gắn `sso_user_id` thủ công cho đúng user (SQL có review) rồi chạy lại `--user-id`.
   - `not_owner` / `sso_id_conflict`: điều tra, không tự sửa.
3. Production: lặp lại, đính kèm tổng hợp CSV (không có email đầy đủ) vào issue #1723.

## Hoàn thành khi
- [ ] Command chạy được trên staging, CSV hợp lệ
- [ ] 409 đã được phân loại/xử lý; tổng hợp đăng lên issue
- [ ] TC-F23-SSO-01/02 (backfill PRESENT/ABSENT) xác nhận trên staging
