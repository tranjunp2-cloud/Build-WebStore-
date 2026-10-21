# Phase 02 — PWv2: schema + endpoint `POST /api/v1/sso/sync-avatar`

**Repo:** PWv2 · **Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** [contract](./contract-sso-pw2-avatar-sync.md)

## 1. Schema (atomic: collection + db-setup cùng lúc)
`src/collections/Users.ts` thêm (hidden, `access.update: () => false` — chỉ ghi qua Local API `overrideAccess`):
| Field | Kiểu | Cột |
|---|---|---|
| `ssoUserId` | number, `unique: true` (create/update access = false) | `sso_user_id integer` + partial unique index `users_sso_user_id_uniq` |
| `ssoAvatarKey` | text | `sso_avatar_key varchar` |
| `ssoAvatarSyncedAt` | date | `sso_avatar_synced_at timestamp(3) with time zone` |

`scripts/db-setup.js` `MIGRATIONS` (cuối mảng):
- `users.sso_user_id` → `ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_user_id integer;`
- `users.sso_user_id_unique_idx` → `CREATE UNIQUE INDEX IF NOT EXISTS users_sso_user_id_uniq ON users (sso_user_id) WHERE sso_user_id IS NOT NULL;`
- `users.sso_avatar_key`, `users.sso_avatar_synced_at`.
Kiểm tra `node scripts/check-migrations.js` pass.

## 2. Module (tách nhỏ, mỗi file < 200 dòng) — `src/lib/sso/avatar-sync/`
| File | Trách nhiệm |
|---|---|
| `sync-avatar-schema.ts` | zod schema payload contract (PRESENT bắt buộc `avatar_url` + `avatar_key`) |
| `download-sso-avatar.ts` | tải ảnh theo link SSO gửi: https, `redirect:'manual'` (không bao giờ theo redirect; 3xx → 422), timeout 10s, stream ≤ 2MB (`AVATAR_MAX_BYTES`), magic bytes JPEG/PNG (`hasValidImageSignature` + chỉ chấp nhận jpeg/png) |
| `resolve-sso-owner.ts` | map user theo contract (sso_user_id → bind email có điều kiện); trả `{ user }` hoặc `{ reason }`. Hằng `ALLOW_EMAIL_BIND = false` (bật cùng PR cập nhật PRD khi PO đồng ý BR-23-04; tắt → `email_bind_disabled`). Bind bằng 1 câu `UPDATE … WHERE sso_user_id IS NULL` (`sso-user-sql.ts`) |
| `apply-avatar-state.ts` | idempotent/stale check, PRESENT/ABSENT, tạo Media (qua `withMediaCreateLock`, `alt: 'User avatar'`), ghi user bằng compare-and-set atomic (`sso-user-sql.ts`), xóa Media cũ sau khi ghi thành công (chỉ xóa nếu do luồng avatar tạo và không user nào khác dùng) |
| `sso-user-sql.ts` | `bindSsoUserId` và `casSetAvatarState`: mỗi hàm đúng 1 câu `UPDATE … WHERE … RETURNING id` qua `payload.db.pool` (cùng pattern `register-media.ts`); `23505` → conflict, lỗi khác throw lại |
| `is-public-ip.ts` | kiểm tra IPv4/IPv6 công khai cho SSRF guard (không cần cấu hình) |

Tái dùng: `AVATAR_MAX_BYTES` (`src/lib/profile/schemas.ts`), `hasValidImageSignature` (`src/lib/media/image-signature.ts`), `isOwner` (`src/lib/profile/role-utils.ts`).

## 3. Route — `src/app/api/v1/sso/sync-avatar/route.ts`
Auth giống `ban-user/route.ts` (Bearer → `getCurrentUser(req)` → `roles.includes('super-admin')`). Parse zod → resolve → apply → response theo bảng mã lỗi contract. Log prefix `[V2][SSO SyncAvatar]` (không log URL đầy đủ có query, không log token).

## 4. Provision nhận `sso_user_id`
`src/app/api/v1/sso/provision/route.ts`: nếu body có `sso_user_id` (số nguyên dương) → lưu `ssoUserId` khi tạo user. Không bắt buộc (SSO cũ chưa gửi vẫn chạy).

## 5. Env
Không thêm env mới (bỏ allow-list host theo quyết định 2026-10-20: tải thẳng link ảnh SSO gửi).

## Test (vitest, mock top-level, AAA)
| TC | Nội dung |
|---|---|
| TC-F23-SSO-07 | trùng `avatar_key` → unchanged; `changed_at` cũ → stale |
| TC-F23-SSO-08 | http / >2MB / GIF / HTTP 3xx-4xx → 422; 5xx, 429, timeout, lỗi mạng → 502; không đổi avatar |
| TC-F23-SSO-09 | map theo `sso_user_id`; bind email **chỉ khi `ALLOW_EMAIL_BIND`** (mặc định tắt → 409 `email_bind_disabled`) và đủ điều kiện; email trùng 2 user → 409 `ambiguous_email`; staff → 409 `not_owner`; sso_id đã gắn user khác → 409 |
| TC-F23-SSO-05/11 | ABSENT → avatar null + xóa Media cũ; PRESENT → Media mới + xóa cũ |
| TC-F23-SSO-06 | tải lỗi → giữ avatar cũ, 502 |
| auth | thiếu Bearer 401, không phải super-admin 403, payload sai 400 |
| provision | lưu `ssoUserId` khi có |

Fixture payload lấy từ ví dụ trong contract.

## Hoàn thành khi
- [ ] Test pass, `tsc` sạch, `check-migrations.js` pass
- [ ] Gọi thử endpoint local bằng curl với token super-admin (PRESENT/ABSENT/409)
