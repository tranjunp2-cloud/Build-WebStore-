# Phase 03: Cập nhật tài liệu

## Overview
- **Ưu tiên:** Trung bình.
- **Trạng thái:** ✅ Hoàn thành 13/10
- **Mô tả:** ghi lại quy tắc mới, TC-ID và nguyên nhân gốc để người sau không chẩn đoán sai.

## File cần sửa
| File | Nội dung |
|---|---|
| `docs/migration/pw1-website-cli.md` | Thêm mục mới sau "Explicit BE destination and category mapping" (~L234): **"Product selection fallbacks (Issue #1956)"** |
| `docs/qa/F35-pw1-migration.md` | Thêm `TC-F35.M62` và `TC-F35.M63` (AUTO), trỏ tới file test |
| `docs/CHANGELOG.md` | Thêm 1 dòng dưới bản chưa phát hành: `fix(F35): resolve template-owned categories and BE-excluded fixed products without blocking website migration` |
| `docs/architecture/F35*.md` (nếu có mục ID resolution) | Thêm 2 nhánh mới vào sơ đồ resolve |

## Nội dung chính cho `pw1-website-cli.md`
1. **Category của store mẫu.**
   - PW1 `clonePages` chép `product_category` nguyên giá trị (`prime-web-api/app/Repositories/EloquentStoreRepository.php:1713`), nên shop clone giữ ID category của template.
   - PW1 lọc sản phẩm theo `store_id` của user, nên khối này hiển thị rỗng trên PW1.
   - CLI phát hiện mapping VERIFIED nằm ngoài scope, áp D1, và ghi cảnh báo.
2. **Sản phẩm `fixed` bị BE loại.**
   - Nếu `migration_source_evidence_rows` ghi `retained-source` cho đúng store, CLI bỏ ID đó và ghi cảnh báo.
   - Không có bằng chứng thì vẫn báo `BE_MAPPING_INVALID`.
3. **Điều kiện tiên quyết:** đã chạy `migrate:pw1:evidence:ingest` trên DB đích.
4. **`--require-be-data`:** ghi rõ cờ này là tùy chọn. Với shop có nguồn PW1 rỗng (sản phẩm `status=0`, đã xóa, hoặc category tắt), chạy không bật cờ thì khối danh sách sẽ hiện trạng thái rỗng.

## Todo
- [x] `pw1-website-cli.md`
- [x] `F35-pw1-migration.md` (M62, M63)
- [x] `CHANGELOG.md`
- [x] Kiểm tra `docs/architecture/F35*.md`

## Success criteria
- Mọi file dưới `docs.maxLoc` (800 dòng).
- Không lặp nội dung giữa các file. Mỗi sự kiện chỉ nằm ở một nơi.
