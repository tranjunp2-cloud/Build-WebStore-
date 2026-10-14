# Plan: Gỡ chặn 58 shop PW1 chưa tạo được website (Issue #1956)

- **Issue:** https://github.com/primeproduction/ech-prime-web-v2/issues/1956 (F35)
- **Nhánh:** `fix/F35-1956-pw1-pending-store-selection` → PR vào `staging` (`Relates to #1956`)
- **Trạng thái:** Đã duyệt (D1/D2 chốt ngày 12/10/2026)

## Mục tiêu
- Giữ **toàn bộ 58 shop**, không loại shop nào. Đưa ledger `pw1_migration_stores` về **0 `pending`** trên Neon branch `pw1-migrated-261010`.
- Không thay đổi dữ liệu BE, không chạy lại export/import BE.

## Ràng buộc
- Giữ nguyên tắc "verified-only, không đoán theo tên" (`pw1-product-selection.ts:29`).
- Thiếu mapping mà **không có bằng chứng BE** thì vẫn phải báo lỗi (test hiện có `TC-F35.M59`).
- Mọi chỗ nới lỏng phải để lại cảnh báo trong report của store.

## Ngoài phạm vi
- Sửa policy export BE: `NO_VALID_VARIANTS`, `INACTIVE_CATEGORY`, trùng slug. Tách thành issue riêng, xem `plans/reports/scout-261012-1658-danh-gia-policy-chon-loai-data-pw1.md`.
- Dựng lại biến thể SKU từ template.
- Sửa lỗi clone của PW1.

## Nguyên nhân (đã xác minh)
Chi tiết: `plans/reports/scout-261012-1613-issue-1956-bao-cao-nguyen-nhan.md`

| Nhóm | Shop | Nguyên nhân | Xử lý |
|---|---|---|---|
| A | 14 | Chưa xác định: qua được bước chọn sản phẩm kể cả code cũ (đính chính 13/10, không có `--require-be-data`) | `retry`, xem `logs` từng store; cần log batch Neon |
| B-cat | 18 (gồm 271, 509) | `product_category` trỏ tới category của store mẫu (lỗi clone PW1) | Phase 01, case 1 |
| B-prod | 26 | Danh sách `fixed` 4 SP, trong đó 1 SP bị BE loại có bằng chứng | Phase 01, case 2 |

## Quyết định đã chốt (12/10/2026)
- **D1 = A: để rỗng.**
  - Khối trỏ category của store mẫu được chuyển sang `selectionMode='fixed'` + `selectedProductIds=[]`, kèm cảnh báo trong report.
  - Lý do: giống PW1 hiện tại (PW1 trả 0 SP do `StoreScope`), không đoán theo tên, không fallback sang toàn bộ SP.
  - Chủ shop có thể tự chọn lại sản phẩm trong editor.
  - Phương án bị loại: hiện toàn bộ SP của shop; map theo tên category.
- **D2 = Phương án 1: bằng chứng lấy từ `migration_source_evidence_rows`.**
  - Điều kiện lọc: `source_entity='products'`, `disposition='retained-source'`, đúng `source_store_id`, snapshot `COMPLETE` + `provenance_kind='exporter_sidecar'` của chính run `VERIFIED` của store (cùng `source_instance_id` + `source_snapshot_id`; sửa theo review PR #1963, trước đó lấy snapshot mới nhất toàn bảng).
  - Không có bằng chứng thì giữ hành vi báo lỗi như cũ.
  - Điều kiện tiên quyết: Neon đã chạy `migrate:pw1:evidence:ingest` (preflight ở phase 04).
  - Phương án bị loại: đọc `mapping-report.json` (phụ thuộc file artifact lớn); bỏ qua không cần bằng chứng (che lỗi thật).

## Các phase
| # | Phase | File | Trạng thái |
|---|---|---|---|
| 01 | Nới lỏng có kiểm soát trong `resolveProductSelections` | [phase-01](phase-01-resolve-selection-fallbacks.md) | ✅ |
| 02 | Unit test (TC-F35.M62, M63) | [phase-02](phase-02-tests.md) | ✅ |
| 03 | Cập nhật tài liệu | [phase-03](phase-03-docs.md) | ✅ |
| 04 | Chạy lại trên Neon và xác minh | [phase-04](phase-04-rerun-and-verify.md) | ⬜ |

## Review 12/10: thay đổi so với bản đầu
- **Đã xác minh:**
  - Quét đủ 58 shop: chỉ có 2 dạng lỗi, 34 component dùng category của store mẫu và 26 SP bị loại. Không có lỗi ẩn khác.
  - D1 render rỗng thật (`storefront/products/route.ts:88-89`). Quality audit không fail vì khối SP rỗng.
  - 14 category của store mẫu đều có mapping VERIFIED ở local.
- **Đã sửa trong plan:**
  - SQL dùng `state='COMPLETE'`, không phải `'COMPLETED'`.
  - `sourceStoreId` là tham số tùy chọn, để test M59 không phải sửa.
  - Thông báo lỗi giữ chuỗi `source {collection} {id}`.
  - Cảnh báo R2 không nêu lý do loại, vì bảng bằng chứng không lưu lý do.
  - Phase 04 không export lại. Thêm preflight mapping category + snapshot, và chạy local trước Neon.
- **Rủi ro còn lại:** dữ liệu Neon chưa đối chiếu trực tiếp (bằng chứng, mapping). Preflight ở phase 04 sẽ chặn trước khi chạy.

## Phụ thuộc
- Phase 01 → 02 → 03 có thể chạy liền nhau.
- Phase 04 cần PR đã merge và deploy lên `staging`, hoặc chạy CLI từ nhánh.
- Phase 04 cần quyền vào Neon branch `pw1-migrated-261010`.

## Tiêu chí hoàn thành
- `npm test` pass. Có test mới cho cả 2 case và cho hành vi báo lỗi khi thiếu bằng chứng.
- Neon: `SELECT count(*) FROM pw1_migration_stores WHERE status='pending'` = 0.
- Quality audit pass cho 58 shop.
- Report của mỗi shop ghi cảnh báo rõ: stale template category, hoặc excluded fixed products.
- Issue #1956 cập nhật số liệu và nguyên nhân thật.
