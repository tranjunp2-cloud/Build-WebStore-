# Scout — giải các câu hỏi mở cho delta PW1 → PW2

Nguồn: PW1 `/home/liam/data/prime-web-api` (HEAD `adcfd63f`, 26/10), exporter `src/lib/migration/pw1-export/**`, DB dev `primeweb`, CSV `/home/liam/Documents/DB_PROD`. Container PW1 đã dừng → không query thêm production.

## Q1. Store/User `status=3` là gì? Map sang PW2 thế nào?

**PW1** (`config/common.php:155-161`): `0` in_active, `1` active, `2` expired, `3` banned — dùng chung cho `users.status` và `stores.status`.
- `EloquentUserRepository::ban()` (`:301-323`): nếu là owner → store `status=3` + ban toàn bộ user của store + revoke token. Gọi từ `PUT users/ban-user-for-system-admin` (`routes/web.php:170`, quyền `super_admin` hoặc permission `reset-password-for-system-admin`) — tức SSO ban theo email.
- `unBan()` (`:330-350`): store về `2` hoặc `1` theo `isExpired()`; `User::isExpired()` (`app/Models/User.php:155`) **so sánh ngược** (`gt(now)`) → store unban có thể bị gán sai 1/2 (đã biết, ST-01).

**Exporter** (đã duyệt, đang chạy trên dữ liệu 16/09):
- Tenant: `identity-site.ts:260` → `suspended` khi `store.status !== '1'` hoặc lifecycle conflict hoặc owner không active; còn lại `active`.
- User: `identity-lifecycle.ts:24-63` → `active` chỉ khi `status=1`, `banned_at` rỗng, chưa hết hạn; mâu thuẫn → `suspended` (safe hold).

**PW2 runtime cùng ngữ nghĩa**: `src/app/api/v1/sso/ban-user/route.ts:50` đặt tenant `suspended`; `unban-user` → `active`; `renew` cập nhật `endsAt` subscription.

⇒ **Không cần quyết định mới.** Delta áp đúng quy tắc exporter (import hàm thuần `membership` + quy tắc tenant). Delta 16/09→26/10: store 1→3: 53, 2→3: 10, 1→2: 7 → `suspended`; 3→1: 1 → `active` (nếu owner hợp lệ); 3→2: 3 → giữ `suspended`. Subscription 162 gia hạn → cập nhật `startsAt/endsAt` như `sso/renew`.

Lưu ý: các sự kiện ban/renew sau 16/09 chỉ đi tới PW1 (SSO chưa gọi PW2 cho shop chưa cutover) → delta **phải** áp chúng.

## Q2. User giữ role `super_admin` (role đã bị xóa)

- Snapshot: `model_has_roles` → role 1 `super_admin` gán cho **user 1 "Administrator"** (global, không store). Không phải user 51 (SSO User, đã bind system creator).
- User 1 **không có trong `migration_entity_map`** → chưa từng tạo trên PW2.
- Exporter chỉ dùng role `owner` (`identity-site.ts:72`, `:124`): owner → `owner`, còn lại → `editor`/`viewer` (`readOnlyUserIds`). Không đọc `super_admin`, manager, crew, member.

⇒ **Không ảnh hưởng PW2.** Quy tắc "lookup đổi thì dừng" chỉ cần áp cho role `owner` (tên/guard/deleted). Xóa `super_admin` và +4 permissions → bỏ qua, ghi báo cáo.

## Q3. Delta đọc trực tiếp DB PW1 hay CSV?

Bằng chứng:
1. Công cụ dump CSV thêm tiền tố `'` cho giá trị bắt đầu bằng `+ - @ =`; exporter **không gỡ** (`csv-loader.ts:140`, `nullTokens: []`) → **dữ liệu PW2 hiện đang dính**: 4 `customers.phone`, 7 `orders.customer_phone`, 5 blog (slug `'-1`, `'-2`, `'-3` → URL hỏng), 1 product (slug `'-1`), 1 `sites.name`.
2. CSV ghi số `1199.0` vs DB `1199` → so thô ra hàng chục nghìn "thay đổi" giả.
3. Xóa cứng có thật (page_components, model_settings, banners, menus) → cần tập id đầy đủ, CSV hay DB đều phải đọc toàn bảng.
4. Repo đã có `src/lib/admin/qa/pw1-mysql-connector.ts` (read-only: chặn non-SELECT, `SET SESSION TRANSACTION READ ONLY`, `PW1_DATABASE_URL`, `mysql2` sẵn trong deps) — module QA, không phải script migrate.

⇒ **Khuyến nghị:** nguồn mới = **đọc trực tiếp DB PW1** qua `--source-db` (mặc định `PW1_DATABASE_URL`), một transaction `REPEATABLE READ` + `READ ONLY` để có snapshot nhất quán; mốc cũ = CSV `--old` có **chuẩn hóa** (gỡ `'` trước `=+-@`, số thập phân, CRLF). Giữ chế độ `--new <csv>` dự phòng khi môi trường không vào được RDS.

Trade-off: môi trường chạy cần mạng tới RDS + user read-only; đổi lại không phụ thuộc công cụ dump và không bị nhiễu định dạng.

## Phát hiện phụ cần quyết định

- 18 bản ghi PW2 dính `'` (mục Q3.1). Có thể thêm bước sửa trong delta (gỡ `'` khi dòng nguồn tương ứng được chuẩn hóa) hoặc xử lý riêng. Slug blog/product `'-1` cần đổi slug → ảnh hưởng URL.

## Câu hỏi còn mở

1. Môi trường chạy delta có truy cập được PW1 RDS bằng user read-only không?
2. Sửa 18 bản ghi dính `'` trong delta hay tách việc riêng?

## Quyết định 27/10 (user): nguồn = file xuất, không đọc trực tiếp PW1

- `--old` và `--new` đều là thư mục CSV xuất từ PW1; không kết nối DB PW1 trong delta.
- Chuẩn hóa bắt buộc, áp như nhau cho cả 2 bộ: gỡ `'` trước `=+-@`; số `1199.0`≡`1199`; CRLF→LF + trim; bỏ qua `updated_at`, `token`, `token_id`, `*signature` khi so.
- Giá trị ghi vào PW2 dùng bản đã chuẩn hóa.
- Kiểm tra đầu vào (dừng nếu sai): đủ bảng, header khớp mốc, id không trùng/thiếu, số dòng không tụt bất thường (vd. file cắt cụt như `stores_*.csv.orig` 540 dòng).
- Xuất đủ 93 bảng như 16/09, sau khi freeze PW1.
