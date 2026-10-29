# Brainstorm — Delta migration PW1 → PW2 (từ snapshot 16/09 tới ngày release)

- Ngày: 26/10/2026 (sửa lần 2). Release: thứ 4 28/10/2026.
- Baseline đích: DB dev `primeweb` (localhost:5433), import từ run `pw1-2026-10-07T07-54-49-494Z-93540442` (worktree-3), 2.913 store VERIFIED, ledger `migration_entity_map` 160.321 dòng (`PW1PROD`).
- Baseline nguồn: `/home/liam/Documents/DB_PROD` — 93 CSV, **93/93 khớp SHA-256** với `master-manifest.json` của run trên.

## Ràng buộc đã chốt

| Mục | Chốt |
|---|---|
| Script cũ | **Không chạy, không sửa** bất kỳ script/module migrate cũ (exporter, importer, website) |
| Ledger cũ | Được **SELECT** `migration_entity_map` để tra source → target. Không ghi |
| Code cũ | Được import **hàm thuần** (normalize, chuyển đơn vị…) như thư viện |
| Release | Dump DB dev → prod, chạy delta trên prod sau dump |
| Cutover | Freeze PW1 lúc release → delta chạy 1 lần cuối |
| Phạm vi | Mới / sửa / xóa |
| Conflict | Dữ liệu PW2 không bị đụng tới trước release (ngoại lệ: R3) |

## Chốt giao diện: 1 lệnh (26/10, sửa lần 3 — thay cho 3 lệnh diff/resolve/apply bên dưới)

```bash
npm run migrate:pw1:delta -- --old <csv-moc> --new <csv-moi> [--out <bao-cao>] [--yes]
```

**Mọi đường dẫn là tham số, không hardcode** — lệnh sẽ chạy trên môi trường khác máy dev. `--old`/`--new` bắt buộc; DB đích lấy từ `DATABASE_URI`; `--out` mặc định cạnh `--new`, không ghi vào repo; không đọc `.migration/` hay worktree khác. Trước khi diff, kiểm hash CSV `--old` với snapshot đã import (mốc hiện tại trên máy dev: `/home/liam/Documents/DB_PROD`, 93/93 khớp) — lệch thì dừng.

Diff → tóm tắt → hỏi `Apply? (y/N)` → ghi → báo cáo. `--yes` bỏ bước hỏi. Chạy lại idempotent qua `pw1_delta_map`. Bảng đổi chưa có mapper → dừng trước khi ghi, báo tên bảng. Xóa ở PW1 → chỉ báo cáo (không tự soft-delete) trừ khi số lượng đáng kể. File dự kiến: `scripts/pw1-delta.ts`, `src/lib/migration/pw1-delta/csv-diff.ts`, `mappers/<loại>.ts` (chỉ loại có thay đổi) → 4–8 file.

## Phương án loại

- Chạy lại exporter/importer cũ với snapshot mới → vi phạm ràng buộc; importer cũ còn fail cả store khi gặp bản ghi sửa (`TARGET_PROJECTION_CONFLICT`, `writer.ts:228-238`) và không biết bản ghi xóa.
- Query PW1 theo `updated_at` → không bắt hard-delete, `updated_at` không tin cậy mọi bảng.

## Phương án chọn: bộ script delta độc lập, diff CSV

```
DB_PROD (16/09)  ┐
                 ├─► ① delta:diff ─► ② delta:resolve ─► ③ delta:apply ─► PW2
CSV mới (T0)     ┘   (row-level)     (root entity)       (mapper mới + ledger mới)
                                         ▲ SELECT migration_entity_map
```

### ① `migrate:pw1-delta:diff` (offline, chỉ đọc)
- Stream 2 thư mục CSV, khóa = `id` (5 bảng không có `id` dùng khóa ghép toàn cột).
- Hash từng dòng theo header đã chuẩn hóa. Header đổi/thêm bảng → dừng, báo cáo.
- Output: mỗi bảng → danh sách `NEW / CHANGED (cột đổi) / DELETED` + thống kê.
- **Chạy được ngay khi có CSV mới** → biết kích thước delta thật để chốt phạm vi mapper.

### ② `migrate:pw1-delta:resolve` (chỉ đọc DB)
- Gom dòng đổi về root entity PW2 theo FK: `product_skus / attribute_values / product_images` → product; `order_details / order_status_histories / addresses` → order (+ customer); `stores / users / subscriptions` → tenant/user/site/subscription; `blog_posts`, `categories`, `customers`, `promotion_codes`…
- Tra `migration_entity_map` (SELECT) để phân loại root:

| Lớp | Điều kiện |
|---|---|
| NEW_STORE | Store mới, chưa có tenant |
| NEW | Root mới, chưa có claim |
| CHANGED | Có claim, dòng nguồn đổi |
| DELETED | Có claim, nguồn bị xóa/soft-delete |
| WAS_EXCLUDED | Root cũ không có claim (bị policy loại 16/09) → giữ loại, chỉ báo cáo |

- Output: `delta-plan.json/md` — số lượng theo collection × lớp × store; duyệt trước khi apply.

### ③ `migrate:pw1-delta:apply` (dry-run mặc định, `--apply` mới ghi)
- Mapper **mới** cho từng collection trong phạm vi, viết theo `docs/migration/pw1-pw2-master-field-mapping.md`; tái dùng hàm thuần cũ khi có.
- Ghi qua Payload Local API, context tắt hook tự sinh (Order → Customer).
- CREATE: refs resolve qua `migration_entity_map` + ledger delta.
- CHANGED: update field-level; guard target chưa bị PW2 sửa (so `target_checksum/target_updated_at` ledger cũ).
- DELETED: soft — product/blog → draft; user/tenant → suspended; order/customer → giữ + báo cáo. Không xóa cứng.
- Ledger riêng `pw1_delta_runs`, `pw1_delta_entities` (khai báo trong `scripts/db-setup.js` MIGRATIONS theo rule schema + bootstrap idempotent trong script) → chạy lại an toàn.

### Vị trí code (mới hoàn toàn)
- `src/lib/migration/pw1-delta/` — `csv-diff.ts`, `root-resolver.ts`, `ledger-lookup.ts`, `mappers/*.ts`, `apply.ts`, `report.ts`
- `scripts/pw1-delta.ts`; npm `migrate:pw1-delta:diff|resolve|apply`
- Không sửa file nào trong `src/lib/migration/pw1-*`, `scripts/*pw1*` cũ.

## Đánh đổi chính

Mapper mới **không tự có** policy đã duyệt của exporter (inactive category, slug trùng, safe-hold, sparse variants…). Phải tái hiện tối thiểu cho collection trong phạm vi, nếu không dữ liệu delta sẽ lệch quy tắc với dữ liệu 16/09. Giới hạn phạm vi theo kết quả diff thật.

## Ưu tiên cho thứ 4

1. Lấy CSV PW1 mới **hôm nay** (dump thử) → chạy ① → biết bảng nào thực sự đổi.
2. ① + ② + report (không ghi DB).
3. Mapper ③ theo thứ tự giá trị nghiệp vụ: orders (+customers) → products/SKU → tenants/users/subscriptions mới → blogs/categories.
4. Diễn tập ③ trên bản copy DB dev; chạy 2 lần, lần 2 phải toàn bỏ qua.

## Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R1 | Mapper mới lệch quy tắc mapping/policy cũ | So output mapper mới với master cũ trên cùng entity 16/09 (golden test) trước khi apply |
| R2 | Delta lớn hơn dự kiến (nhiều store mới, đơn mới) | Có số thật từ ① trước khi cam kết phạm vi |
| R3 | 75 site đã generate + 628 media `localhost:9000` đã bị PW2 sửa | Không update field PW2-owned của `sites`; chuyển media localhost lên S3 prod khi dump |
| R4 | Dump dev→prod: `migration_target_guard` bind `pw1-local-primeweb` / MinIO local | Bộ mới không phụ thuộc guard cũ; cấu hình target riêng cho prod |
| R5 | User mới cần credential (CSV users riêng như lần 16/09) | Export users.csv cùng lúc dump CSV mới |
| R6 | Header CSV mới khác (PW1 thêm cột/migration) | ① dừng và báo cáo |
| R7 | 2 ngày | Cắt phạm vi theo ①; DELETED tối thiểu là báo cáo nếu không kịp soft-delete |

## Tiêu chí thành công

- ① trên 2 thư mục giống nhau (DB_PROD vs chính nó) → 0 thay đổi.
- Golden test mapper mới khớp master cũ với entity mẫu.
- ③ chạy 2 lần liên tiếp: lần 2 không ghi gì.
- Sau apply: mỗi root NEW/CHANGED có dòng ledger delta VERIFIED; DELETED có báo cáo.

## Câu hỏi còn mở

1. Ai dump CSV PW1 mới, có lặp lại đúng 93 bảng/cột như 16/09 không? Có dump thử được hôm nay không?
2. Ai duyệt `delta-plan` trước khi apply trên prod?
3. Bucket S3 prod và cách chuyển 628 media localhost.
