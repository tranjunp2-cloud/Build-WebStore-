# Phase 01 — CLI, chuẩn hóa CSV, kiểm tra đầu vào

**Ưu tiên:** P0 · **Trạng thái:** ⬜

## Context
- Nhiễu định dạng CSV: `plans/reports/scout-261026-1827-pw1-prod-delta-vs-snapshot-0916.md` §1.
- Exporter cũ đọc nguyên văn, không gỡ `'` (`csv-loader.ts:140`). Muốn sửa dấu `'` thì phải đưa cho exporter một **bản sao đã chuẩn hóa**.
- Không cần thư mục run cũ: `snapshotId` đọc từ `migration_runs.source_snapshot_id` (DB đích, đi theo bản dump); policy lấy từ profile trong repo; `users.csv` có sẵn trong bộ CSV.

## Tham số
| Cờ | Bắt buộc | Ý nghĩa |
|---|---|---|
| `--old` | ✔ | thư mục CSV 16/09 |
| `--new` | ✔ | thư mục CSV xuất lúc freeze |
| `--as-of` | | mặc định `2026-09-18T00:00:00Z` = mốc lần import trước (D3) |
| `--profile` | | mặc định `configs/migration/pw1-prod-profile.json` (giống run cũ) |
| `--out` | | mặc định `<repo>/.migration/delta-runs/<UTC>-<uuid8>/` (mode 0700) |
| `--yes` | | bỏ bước hỏi |
| `--store` | | chỉ dùng khi diễn tập (lọc kết quả, không lọc export) |

Không có path nào được hardcode.

## Chuẩn hóa → `--out/source-old/`, `--out/source-new/`
- Gỡ `'` đứng đầu khi ký tự tiếp theo là `=` `+` `-` `@`.
- Không đổi gì khác: giữ CRLF, khoảng trắng, `1199.0`. Mapper đã chấp nhận `1199.0` (`numberValue`).
- Giữ nguyên tên file. Bỏ `*.orig`.
- Ghi `normalization.json`: số ô đã sửa theo bảng/cột (dùng để đối chiếu với 18 bản ghi ở D1).

## Kiểm tra đầu vào (dừng trước mọi bước nặng)
- Thiếu bảng có trong profile → `INPUT_TABLE_MISSING`.
- Header `--new` khác `--old` → `INPUT_HEADER_CHANGED`.
- `id` rỗng hoặc trùng → `INPUT_ID_INVALID`.
- Bảng >100 dòng mà `--new` < 90% `--old` → `INPUT_ROWCOUNT_DROP`.
- Tên file phải đúng `<bang>_<YYYYMMDD[HHMM[SS]]>.csv` và **cùng một ngày** trong mỗi bộ; không có bảng lạ ngoài profile (`createSnapshotConfig` sẽ báo `UNRECOGNIZED_SNAPSHOT_FILENAME` / `MIXED_SNAPSHOT_DATES` / `UNEXPECTED_SNAPSHOT_TABLE`). Kiểm tra sớm để báo lỗi dễ hiểu cho người xuất file.
- `--out` nằm trong repo thì phải dưới `.migration/` (mode 0700, có trong `.gitignore`; `repo-workspace.ts:7`), nếu không `prepareImportArtifact` từ chối.
- Ổ đĩa trống ≥ 20 GB (mỗi bên: CSV ~0,3 GB + artifact export ~3,9 GB + artifact prepare) → `DISK_SPACE_LOW`.
- `--old` phải là bộ CSV đã import: gate tái lập ở phase 03 sẽ fail nếu sai bộ.
- `migration_runs` có đúng 1 `source_snapshot_id` cho `PW1PROD` → nếu không, `SNAPSHOT_ID_AMBIGUOUS`.

## File
- Tạo `scripts/pw1-delta.ts`: CLI, chỉ điều phối.
- Tạo `src/lib/migration/pw1-delta/csv-normalize.ts`: stream copy, gỡ `'`.
- Tạo `src/lib/migration/pw1-delta/input-guards.ts`.
- Sửa `package.json`: `"migrate:pw1:delta": "node --max-old-space-size=8192 --no-network-family-autoselection --dns-result-order=ipv4first --require ./scripts/seed-preload.cjs --import tsx scripts/pw1-delta.ts"`.

## Todo
- [ ] CLI + help
- [ ] Chuẩn hóa ra bản sao + `normalization.json`
- [ ] Các bước kiểm tra
- [ ] Unit test chuẩn hóa: `'+6011`→`+6011`, `'-1`→`-1`, `'@x`→`@x`, `'abc` giữ nguyên, ô có xuống dòng trong ngoặc kép giữ nguyên

## Thành công
- `--old DB_PROD --new DB_PROD`: 0 lỗi kiểm tra; `normalization.json` ra đúng nhóm cột của 18 bản ghi.
