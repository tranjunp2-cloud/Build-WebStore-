# Phase 04 — Ledger delta, runtime, writer

**Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** 03

## Context (import, không sửa)
- `pw1-json/runtime.ts`:
  - `migrationContext()`, `guardCollection(collection)` (`:14,103`) dùng để tắt hook khi ghi;
  - `createRuntime` (`:163`) chỉ để tham khảo cách boot.
- `pw1-json/projection.ts`: `resolveData` (`:266`), `targetProjectionMatches` (`:320`), `checksum`.
- `pw1-json/credentials.ts`: `loadCredentialSidecar(artifact)` (`:28`).
- `pw1-json/user-auth.ts`: giải mật khẩu bằng `PW1_APP_KEY`. Env này đã có, không thêm env mới.
- `pw1-json/writer.ts:320-362`: tham khảo cách ghi users và media. Không import writer.
- Pattern DDL ledger: `scripts/pw1-migration-schema.js`, gọi từ `scripts/db-setup.js:22-23`.

## Schema
Tạo `scripts/pw1-delta-migration-schema.js`, theo đúng pattern của `pw1-migration-schema.js`, gọi từ `db-setup.js`. CLI gọi lại module này để bootstrap (idempotent). Trước khi chốt, kiểm `scripts/check-migrations.js` có chấp nhận cách này không; nếu không thì thêm entry vào MIGRATIONS.

```sql
CREATE TABLE IF NOT EXISTS pw1_delta_runs (run_id uuid PRIMARY KEY, as_of timestamptz NOT NULL, old_hash text NOT NULL, new_hash text NOT NULL, state text NOT NULL, summary jsonb, started_at timestamptz DEFAULT now(), finished_at timestamptz);
CREATE TABLE IF NOT EXISTS pw1_delta_map (source_entity text NOT NULL, source_id text NOT NULL, store_id text NOT NULL, target_collection text NOT NULL, target_id text NOT NULL, source_checksum text NOT NULL, target_checksum text NOT NULL, action text NOT NULL, run_id uuid NOT NULL REFERENCES pw1_delta_runs(run_id), updated_at timestamptz DEFAULT now(), PRIMARY KEY (source_entity, source_id));
```

Không ghi vào bất kỳ bảng `migration_*` nào.

## Runtime
- Boot Payload với:
  - email bị chặn;
  - `PAYLOAD_PUSH_SCHEMA=false`;
  - `guardCollection` cho mọi collection.
- DB lấy từ `DATABASE_URI`. In host/DB đích (che mật khẩu) ở bước xác nhận.
- Advisory lock `pg_try_advisory_lock(hashtext('pw1-delta'))` để không chạy song song.

## Writer (mỗi store 1 transaction; store lỗi → rollback store đó, chạy tiếp store khác)

| Lớp | Thao tác |
|---|---|
| NEW | `payload.create` với `resolveData`. Refs tra qua `pw1_delta_map` ∪ `migration_entity_map` ∪ target vừa tạo trong run. Users lấy mật khẩu từ credential sidecar + `user-auth.ts`; thiếu thì đánh dấu reset. Media ghi URL ngoài như import cũ. |
| CHANGED | Đọc target (depth 0). Nếu projection hiện tại khác `target_checksum` → `PW2_EDITED_CONFLICT`, không ghi (user xác nhận không có ai sửa, giữ để an toàn). Ngược lại `payload.update` bằng data mới. |
| GONE | product/blog → `draft`; tenant → `suspended`; user → suspended; category → inactive. Order, customer, media, discount: không đụng, chỉ báo cáo. |

- Sau mỗi lần ghi: upsert `pw1_delta_map` trong cùng transaction → chạy lại không ghi trùng.
- Site đã generate (`pw1_migration_stores.status='completed'`): CHANGED trên `sites` chỉ cập nhật tên, liên hệ, domain. Không đụng layout, pages, branding.

## MVP (bắt buộc cho 28/10)
- **Có đủ NEW/CHANGED/GONE:** tenants, users, sites, plan-subscriptions, categories, products, customers, orders, blogs, blog_categories, media.
- **Chỉ báo cáo:** discounts, discount_usage_history, plan-subscription-usages, email-template-settings.

## File
- Tạo `scripts/pw1-delta-migration-schema.js` + sửa `scripts/db-setup.js` (thêm 1 dòng gọi).
- Tạo `src/lib/migration/pw1-delta/runtime.ts`, `writer.ts`, `delta-ledger.ts`.

## Todo
- [ ] Schema module + bootstrap + kiểm `check-migrations`
- [ ] Runtime + lock
- [ ] Writer NEW/CHANGED/GONE + credential
- [ ] Bảo vệ site đã generate + `PW2_EDITED_CONFLICT`

## Thành công
- Chạy 2 lần: lần 2 toàn UNCHANGED (đọc `pw1_delta_map`).
- Store 2920/2921/2922 có đủ tenant/site/user/product/category; owner đăng nhập được hoặc ở trạng thái reset.

## Bảo mật
- Không log mật khẩu, `key_string`, `DATABASE_URI`, `PW1_APP_KEY`.
