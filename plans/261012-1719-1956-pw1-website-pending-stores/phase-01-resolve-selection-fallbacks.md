# Phase 01: Nới lỏng có kiểm soát trong `resolveProductSelections`

## Context
- File chính: `src/lib/migration/pw1-product-selection.ts`. Hàm `resolveProductSelections` ở L30-51 và `resolveIds` ở L33-43.
- Nơi gọi: `src/lib/migration/pw1-batch.ts:185`. Cảnh báo được gom ở `:186-189` và lưu vào `warning_count`.
- Bằng chứng nghiên cứu:
  - `plans/reports/scout-261012-1613-issue-1956-bao-cao-nguyen-nhan.md`
  - `plans/reports/scout-261012-1545-issue-1956-pw1-mapping-root-cause.md`

## Overview
- **Ưu tiên:** Cao. Phase này gỡ chặn 44/58 shop (18 B-cat + 26 B-prod).
- **Trạng thái:** ✅ Hoàn thành 13/10.
- **Mô tả:** thêm 2 nhánh xử lý có bằng chứng, thay cho việc ném lỗi `BE_MAPPING_INVALID`. Mọi trường hợp khác giữ nguyên hành vi báo lỗi.

## Key insights
1. **Category của store mẫu.** `migration_entity_map` có dòng VERIFIED (606 → 475), nhưng target thuộc tenant/site khác (24/24). Query hiện tại lọc theo `site_id/tenant_id` nên trả 0 dòng, và lỗi báo nhầm là "thiếu mapping".
2. **Sản phẩm `fixed` bị loại.**
   - Mỗi shop chọn 4 SP, trong đó 1 SP bị loại với lý do `NO_VALID_VARIANTS` (25 shop) hoặc `MISSING_VARIANT_DOMAIN` (store 48).
   - SP bị loại có dòng `migration_source_evidence_rows` với `disposition='retained-source'`.
   - Renderer cũng đã tự bỏ ID không khả dụng: `orderListingIds` trong `src/lib/products/listing-selection.ts`, test `TC-F35.M59`.
3. Test hiện có "refuses missing BE mapping rather than falling back to all products" **phải tiếp tục pass**.

## Requirements
**Chức năng**
- **R1.** `random` + `sourceCategoryId`:
  - Nếu không có mapping trong scope **nhưng** có mapping VERIFIED tới category thuộc tenant/site khác: không ném lỗi.
  - Áp dụng D1 (mặc định: `selectionMode='fixed'`, `selectedProductIds=[]`, `category=''`).
  - Trả cảnh báo `Component {id}: source category {sid} maps outside destination scope (template-owned); listing left empty`.
- **R2.** `fixed`:
  - ID thiếu mapping trong scope **và** có bằng chứng `retained-source` cho đúng store nguồn: bỏ ID đó, giữ thứ tự các ID còn lại.
  - Trả cảnh báo `Component {id}: source products {ids} were not emitted by BE export (retained-source evidence, snapshot {snapshotId}); removed from fixed selection`.
  - Bảng bằng chứng **không lưu lý do loại**. Vì vậy cảnh báo không nêu `NO_VALID_VARIANTS` hay các lý do khác. Muốn tra lý do thì dùng `mapping-report.json`.
- **R3.** Ngoài 2 trường hợp trên vẫn ném `BE_MAPPING_INVALID`:
  - không có dòng mapping nào;
  - có nhiều target;
  - category ngoài scope mà không có mapping VERIFIED;
  - SP thiếu mapping mà không có bằng chứng.
- **R4.** Thông báo lỗi phân biệt `missing` và `out-of-scope`. Phải **giữ chuỗi con** `source {collection} {id}`, vì test M59 đang assert `'source products 30'`.
- **R5.** `resolveProductSelections` trả về `string[]` cảnh báo. `pw1-batch.ts` gộp chúng vào `warnings`.
- **R6.** Tham số mới `sourceStoreId?: string` là **tùy chọn**. Không truyền thì không tra bằng chứng và giữ hành vi throw cũ. Nhờ vậy test M59 và các nơi gọi khác không phải sửa.
- **R7.** `pw1-apply.ts:110` gọi `verifyProductSelectionScope` lúc apply. Không đổi hàm này: block đã lọc (danh sách rỗng hoặc chỉ ID hợp lệ) vẫn qua được.

**Phi chức năng**
- Không thêm bảng hay migration. Chỉ đọc `migration_entity_map` và `migration_source_evidence_rows`.
- Tối đa 1 query bổ sung cho mỗi component, và chỉ chạy ở nhánh lỗi.
- File giữ dưới 200 dòng. Nếu vượt, tách `pw1-selection-evidence.ts`.

## Architecture / data flow
```
resolveIds(collection, ids)
  ├─ scoped query (như cũ)                    → đủ 1 target/ID → OK
  └─ ID thiếu → explainMissing(collection, missingIds)
        ├─ categories: map VERIFIED ngoài scope?   → R1 (fallback D1 + warning)
        ├─ products:  evidence retained-source?    → R2 (drop + warning)
        └─ còn lại                                 → throw BE_MAPPING_INVALID (R3/R4)
```

Query bằng chứng (D2):
```sql
SELECT DISTINCT r.source_id FROM migration_source_evidence_rows r
WHERE r.source_entity='products' AND r.disposition='retained-source'
  AND r.source_store_id=$1 AND r.source_id = ANY($2::text[])
  AND r.snapshot_id = (SELECT s.snapshot_id FROM migration_source_evidence_snapshots s
        JOIN migration_runs run ON run.source_instance_id=s.source_instance_id AND run.source_snapshot_id=s.source_snapshot_id
        WHERE run.source_store_id=$1 AND run.state='VERIFIED' AND s.state='COMPLETE' AND s.provenance_kind='exporter_sidecar'
        ORDER BY s.completed_at DESC NULLS LAST LIMIT 1)
```
(Bản đầu lấy snapshot COMPLETE mới nhất toàn bảng; đã ghim theo run của store sau review PR #1963 để snapshot fixture/instance khác không đổi kết quả.)
- **Đã xác minh ở DB local:** các cột `snapshot_id`, `state='COMPLETE'`, `completed_at`, `provenance_kind='exporter_sidecar'`. Local có 1 snapshot.
- **Ngữ nghĩa `retained-source`:** nghĩa là "nguồn có, nhưng BE không emit", **với mọi lý do**.
  - Ví dụ: store bị hoãn 323 có 51 dòng `retained-source`.
  - Vì vậy bắt buộc lọc đúng `source_store_id` của store đang migrate. Store nằm trong `deferredStoreIds` không bao giờ vào batch website, nên không bị ảnh hưởng.
- `source_store_id` lấy từ `entry.sourceStoreId` (R6).

Query category ngoài scope:
```sql
SELECT m.source_id FROM migration_entity_map m JOIN categories d ON d.id::text=m.target_id
WHERE m.source_entity='categories' AND m.target_collection='categories' AND m.state='VERIFIED'
  AND m.source_id=ANY($1::text[]) AND (d.site_id<>$2 OR d.tenant_id<>$3)
```

## Bằng chứng xác minh giả định (review 12/10)
- **Quét toàn bộ 58 shop** (CSV snapshot): chỉ có 2 dạng tham chiếu lỗi.
  - 34 component `random` trỏ category của store khác (`cat-cross-store`).
  - 26 SP `fixed` bị BE loại (`prod-excluded`).
  - Không có ID nào thiếu hẳn, đã xóa, trỏ store khác (SP), hay trỏ category của chính shop đang tắt.
  - ⇒ Sau phase này không còn lỗi ẩn nào trong component danh sách sản phẩm.
- **14 category của store mẫu** được tham chiếu (138, 140, 192, 242, 514, 515, 606, 652, 653, 2042, 2046, 2052, 2053, 2055) đều có mapping VERIFIED ở DB local. Target thuộc tenant 7, 10, 16, 17, 20, 21, 24, 25, 27.
- **D1 render rỗng thật:** `src/app/api/storefront/products/route.ts:88-89`: `fixed` với `ids=[]` trả `docs: []`. Hook client gửi `selectionMode=fixed` (`use-products-grid-data.ts:106-109`).
- **Quality audit** (`pw1-quality-audit.ts`) không kiểm tra khối SP rỗng, nên D1 không làm audit fail.
- **Tác dụng phụ D1:** trong editor, chủ shop thấy khối ở chế độ "fixed, 0 sản phẩm" và có thể tự chọn lại. Ghi điều này vào cảnh báo và tài liệu.

## Related code files
- **Sửa:**
  - `src/lib/migration/pw1-product-selection.ts`
  - `src/lib/migration/pw1-batch.ts`: truyền `entry.sourceStoreId`, gộp cảnh báo.
- **Tạo (nếu cần tách):** `src/lib/migration/pw1-selection-evidence.ts`
- **Xóa:** không.

## Implementation steps
1. Đổi chữ ký thành `resolveProductSelections(query, payload, blueprint, siteId, tenantId, sourceStoreId?): Promise<string[]>` (R6).
2. Trong `resolveIds`, gom ID thiếu thay vì throw ngay. Gọi `explainMissing`.
3. Cài R1: nếu toàn bộ category thiếu đều ngoài scope thì áp D1 cho component và push cảnh báo.
4. Cài R2: lọc ID có bằng chứng, giữ thứ tự nguồn. Nếu còn ID không có bằng chứng thì throw như cũ.
5. Cài R4: thông báo lỗi dạng `... source categories 606 maps outside destination scope` hoặc `... needs exactly one verified destination mapping (missing)`.
6. `verifyProductSelectionScope` giữ nguyên: nó kiểm tra danh sách sau khi đã lọc.
7. `pw1-batch.ts:185`: `const selectionWarnings = await resolveProductSelections(..., entry.sourceStoreId)`, rồi gộp vào mảng `warnings` ở `:186`.
8. Chạy `npx tsc --noEmit` và `npm run lint` cho file đã sửa.

## Todo
- [x] Đổi chữ ký và cập nhật nơi gọi
- [x] `explainMissing` cho categories (R1)
- [x] Bằng chứng `retained-source` cho products (R2)
- [x] Thông báo lỗi rõ ràng (R4)
- [x] Gộp cảnh báo vào report và `warning_count`
- [x] Typecheck và lint

## Success criteria
Xác minh trên DB local `primeweb-db` trước, rồi mới chạy Neon. Local có sẵn 12 store pending cùng loại lỗi: 48, 71, 73, 82, 90, 93, 94, 106, 187, 197, 271, 301.
- Chạy `retry` 12 store local: cả 12 ra `completed`.
- Store 71 (local): `completed`, có cảnh báo template category.
- Store 48 (local): `completed`, khối `fixed` còn 3 SP (3309, …), có cảnh báo excluded products.
- Input giả lập thiếu mapping mà không có bằng chứng: vẫn `BE_MAPPING_INVALID`.

## Risk assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Neon chưa có `migration_source_evidence_rows` | Không có bằng chứng thì giữ throw. Phase 04 có bước preflight đếm dòng |
| Nhiều snapshot bằng chứng lệch nhau | Chỉ lấy snapshot mới nhất. Ghi `snapshot_id` vào cảnh báo |
| D1 đổi thành "hiện toàn bộ SP" | Chỉ đổi 1 nhánh: `category=''` và giữ `selectionMode='random'` |
| Nới lỏng che lỗi BE thật | Chỉ nới khi có bằng chứng cụ thể: map VERIFIED ngoài scope, hoặc `retained-source` |

## Security considerations
- Query dùng tham số, không nối chuỗi. Tên bảng là hằng số.
- Không lộ dữ liệu tenant khác: chỉ đọc `source_id`, không đưa target ngoài scope vào blueprint.

## Next steps
Phase 02, test.
