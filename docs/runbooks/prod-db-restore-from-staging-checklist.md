# Checklist: copy staging DB sang production (prod-seed)

> F42 cutover. Luồng: Neon branch `prod-seed` (từ staging) -> dọn QC bằng `scripts/prod-seed-clean-qc-data.ts` -> `pg_dump` -> `pg_restore` vào `neondb` production trống.
> Không có secret trong file này. Connection string lấy bằng `neonctl`, để trong biến shell, không ghi vào file/log.
> **TUYỆT ĐỐI KHÔNG** chạy script dọn trên staging main hoặc production (project `dark-glitter-99257254`). Script tự từ chối, nhưng đừng thử.

Quy ước biến (đặt trong terminal, không commit):

```sh
export STAGING_PROJECT_ID=<id project staging>
export PROD_PROJECT_ID=<id project production>   # dark-glitter-99257254
```

## 0. Điều kiện trước

- [ ] Staging đã import/delta PW1 xong, `migration_import_stores` không còn dòng khác `VERIFIED`.
- [ ] Đóng băng staging: không ai tạo đơn/merchant mới trong lúc dump (báo kênh Lark).
- [ ] `pg_dump`/`pg_restore` (psql client) phiên bản >= server Neon: `pg_dump --version`.
- [ ] `neonctl auth` đã đăng nhập đúng org.
- [ ] Prod `neondb` thật sự trống: `psql "$PROD_URI" -c '\dt'` không có bảng (nếu có, DỪNG, hỏi owner).

## 1. Tạo branch `prod-seed` từ staging

```sh
neonctl branches create --project-id "$STAGING_PROJECT_ID" --name prod-seed --parent staging
export PROD_SEED_URI=$(neonctl connection-string prod-seed --project-id "$STAGING_PROJECT_ID" \
  --database-name neondb --role-name <role> )   # direct, KHÔNG dùng --pooled
echo "$PROD_SEED_URI" | sed -E 's#//[^@]*@#//***@#'   # kiểm host: phải là endpoint MỚI, khác staging main
```

Tên branch cha (`staging`) và `<role>` lấy từ Neon console. Host của `prod-seed` phải khác endpoint của staging main.

## 2. Dry run (không đổi gì)

```sh
DATABASE_URI="$PROD_SEED_URI" npx tsx scripts/prod-seed-clean-qc-data.ts --target-label prod-seed | tee prod-seed-dryrun.txt
```

Script chạy trong 1 transaction rồi ROLLBACK. Đọc từng khối:

- [ ] **DELETE**: tenants/users/sites/orders... thuộc QC. Số tenant xoá khớp kỳ vọng (QC `qc-shop-*`, `QC Tenant N`, `kedai-demo`, `test-store`).
- [ ] **TRUNCATE**: `qa_*`, `users_sessions`, `payload_preferences*`, `payload_locked_documents*`, `generation_recovery_jobs`, `sso_step_events`, `push_subscriptions`, bảng `*outbox*`/`*queue*` nếu có.
- [ ] **KEEP**: số tenants/users/sites/products/orders/media còn lại ≈ số store PW1 đã migrate (đối chiếu `migration_import_stores`).
- [ ] **REVIEW**: mỗi tenant/user trong danh sách được owner quyết (xoá tay bằng SQL riêng hoặc giữ). Script KHÔNG xoá các dòng này. Có dòng `pending orders` thì cron `payment-expiry`/`reconcile-orders` sẽ chạm vào chúng (xem bước 9).
- [ ] **SUPER-ADMINS REMAINING**: owner duyệt từng email. Không còn ai thì prod sẽ không đăng nhập admin được.
- [ ] Không có `WARNINGS` chưa giải thích (vd. QC user bị demote vì FK RESTRICT, import store chưa VERIFIED).
- [ ] Script từ chối khi sai (thử không có `--target-label`): xác nhận guard hoạt động.

Lỗi `Provenance violated` hoặc `Required table missing`: DỪNG, đừng `--apply`, báo dev.

## 3. Apply trên branch `prod-seed`

```sh
DATABASE_URI="$PROD_SEED_URI" npx tsx scripts/prod-seed-clean-qc-data.ts --target-label prod-seed --apply | tee prod-seed-apply.txt
```

- [ ] Số liệu giống dry run (`diff` hai file, trừ dòng tiêu đề). Chạy lại dry run lần nữa: DELETE/TRUNCATE phải rỗng (idempotent).
- [ ] Giải quyết các mục REVIEW còn lại (nếu owner chốt xoá), rồi chạy lại dry run tới khi sạch.

## 4. Dump

```sh
pg_dump -Fc --no-owner --no-privileges -d "$PROD_SEED_URI" -f prod-seed.dump
pg_restore --list prod-seed.dump | grep -i -E 'EXTENSION|payload_migrations' | head   # citext, payload_migrations phải có
ls -lh prod-seed.dump
```

## 5. Snapshot prod trước khi restore

```sh
neonctl branches create --project-id "$PROD_PROJECT_ID" --name pre-restore-$(date +%Y%m%d-%H%M) --parent <branch-prod-mac-dinh>
```

Hoặc tạo Snapshot trong Neon console (Backup & Restore). Ghi lại mốc thời gian để rollback.

## 6. Restore vào prod

```sh
export PROD_URI=$(neonctl connection-string <branch-prod-mac-dinh> --project-id "$PROD_PROJECT_ID" \
  --database-name neondb --role-name <role>)
pg_restore --no-owner --no-privileges --exit-on-error -j 4 -d "$PROD_URI" prod-seed.dump
```

- [ ] Có lỗi: DỪNG (`--exit-on-error`). Xoá sạch `neondb` prod hoặc restore branch `pre-restore-*`, sửa nguyên nhân rồi làm lại từ bước 6.
- [ ] Extension `citext` có sẵn: `psql "$PROD_URI" -c '\dx'` (nếu restore báo thiếu quyền tạo extension, tạo trước bằng `CREATE EXTENSION IF NOT EXISTS citext;`).

## 7. Kiểm sau restore

Đếm hàng các bảng chính, so prod với branch `prod-seed` (hai số phải bằng nhau):

```sh
COUNTS_SQL="SELECT 'tenants',count(*) FROM tenants UNION ALL SELECT 'users',count(*) FROM users UNION ALL SELECT 'sites',count(*) FROM sites UNION ALL SELECT 'pages',count(*) FROM pages UNION ALL SELECT 'products',count(*) FROM products UNION ALL SELECT 'orders',count(*) FROM orders UNION ALL SELECT 'customers',count(*) FROM customers UNION ALL SELECT 'media',count(*) FROM media UNION ALL SELECT 'migration_entity_map',count(*) FROM migration_entity_map UNION ALL SELECT 'pw1_delta_map',count(*) FROM pw1_delta_map UNION ALL SELECT 'payload_migrations',count(*) FROM payload_migrations"
psql "$PROD_SEED_URI" -At -c "$COUNTS_SQL" > counts-seed.txt
psql "$PROD_URI" -At -c "$COUNTS_SQL" > counts-prod.txt
diff counts-seed.txt counts-prod.txt && echo OK
```

Sequence phải >= `max(id)` của cột sở hữu (kết quả mong đợi: 0 dòng):

```sql
SELECT tbl, col, seq, last_value, max_id
FROM (
  SELECT n.nspname || '.' || t.relname AS tbl, a.attname AS col, s.relname AS seq, ps.last_value,
         (xpath('/row/m/text()', query_to_xml(
            format('SELECT max(%I) AS m FROM %I.%I', a.attname, n.nspname, t.relname), false, true, '')))[1]::text::bigint AS max_id
  FROM pg_class s
  JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass
                  AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
  JOIN pg_class t ON t.oid = d.refobjid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
  JOIN pg_sequences ps ON ps.schemaname = n.nspname AND ps.sequencename = s.relname
  WHERE s.relkind = 'S'
) x
WHERE max_id IS NOT NULL AND COALESCE(last_value, 0) < max_id
ORDER BY tbl;
```

Có dòng nào: `SELECT setval('<seq>', (SELECT max(<col>) FROM <tbl>));` cho từng dòng, rồi chạy lại truy vấn.

- [ ] Không còn QC: `SELECT count(*) FROM users WHERE email LIKE '%@primeweb.local';` = 0 (trừ mục REVIEW owner đã giữ).
- [ ] Super-admin đúng danh sách đã duyệt: `SELECT u.email FROM users u JOIN users_roles r ON r.parent_id=u.id WHERE r.value='super-admin';`
- [ ] Bảng ephemeral rỗng: `SELECT count(*) FROM users_sessions;` và `sso_step_events` = 0.
- [ ] `payload_migrations` có đủ bản ghi (đã nằm trong bảng đếm ở trên). Build đầu tiên (`scripts/db-setup.js`) phải chạy idempotent không lỗi.
- [ ] Đăng nhập thử 1 merchant PW1 (OTP/SSO prod) và 1 super-admin sau khi deploy.

## 8. Biến môi trường prod (trước deploy đầu tiên)

- [ ] Env prod trong Vercel Dashboard trỏ `DATABASE_URI` vào `neondb` prod (direct cho migrate, pooled cho runtime theo `env-vars.md`).
- [ ] Không dùng key SSO/SMTP/payment của staging; kiểm `SSO_*`, `SMTP_*`, cổng thanh toán là key prod.

## 9. Tắt cron trước deploy đầu tiên

`vercel.json` có 9 cron: `keep-alive`, `payment-expiry`, `reconcile-orders`, `process-sso-steps`, `process-generation-recovery`, `reconcile-qa-targeted-smoke`, `ai-receipts`, `shop-automations`, `feedback-overdue-digest`.

- [ ] Vercel Dashboard -> project prod -> Settings -> Cron Jobs -> **Disable** TRƯỚC khi deploy lần đầu (hoặc chưa đặt `CRON_SECRET`: các route trả 401).
- [ ] Sau khi bước 7 xong và owner đồng ý: bật lại từng cron. `payment-expiry` và `reconcile-orders` bật sau cùng, sau khi xử lý các `pending orders` ở mục REVIEW.
- [ ] `process-sso-steps` chỉ bật khi SSO prod sẵn sàng (bảng `sso_step_events` đã rỗng nên không bắn sự kiện staging).

## 10. Dọn dẹp

- [ ] Xoá file dump/log cục bộ (`prod-seed.dump`, `counts-*.txt`, `prod-seed-*.txt`): chứa PII merchant.
- [ ] Giữ branch `prod-seed` và `pre-restore-*` ít nhất 7 ngày rồi xoá: `neonctl branches delete prod-seed --project-id "$STAGING_PROJECT_ID"`.

## Rollback

Restore thất bại hoặc sai dữ liệu: dừng mọi traffic, khôi phục prod từ branch/snapshot `pre-restore-*` (Neon console -> Restore), sửa `prod-seed`, lặp lại từ bước 3. Staging main không bị ảnh hưởng ở mọi bước.
