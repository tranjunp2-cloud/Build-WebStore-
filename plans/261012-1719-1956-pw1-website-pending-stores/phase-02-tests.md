# Phase 02: Unit test

## Context
- Test hiện có: `src/__tests__/unit/migration/pw1-product-selection.test.ts` (TC-F35.M59).
- Quy ước: `.claude/rules/testing.md` và `docs/TEST_CONVENTION.md`. Mỗi test có TC-ID, dạng AAA, import từ source, `vi.mock()` đặt top-level.
- TC-ID lớn nhất hiện tại trong F35 là M61. Phase này dùng **M62** và **M63**.

## Overview
- **Ưu tiên:** Cao.
- **Trạng thái:** ✅ Hoàn thành 13/10
- **Mô tả:** test cho R1–R5 của phase 01. Không cần DB thật: dùng stub `query` và `payload` như test M59.

## Test cases
| TC-ID | Test | Kỳ vọng |
|---|---|---|
| TC-F35.M62 | `random` + category có map VERIFIED ngoài scope | Không throw; block `selectionMode='fixed'`, `selectedProductIds=[]` (D1 mặc định); trả 1 cảnh báo chứa `outside destination scope` |
| TC-F35.M62 | `random` + category không có dòng map nào | Throw `BE_MAPPING_INVALID`, thông báo chứa `missing` |
| TC-F35.M62 | `random` + category map trong scope | Hành vi cũ: `category` = target, không cảnh báo |
| TC-F35.M63 | `fixed` ['30','10'], `10` thiếu map nhưng có bằng chứng `retained-source` | `selectedProductIds=['300']`, giữ thứ tự; cảnh báo chứa `excluded by BE export policy` |
| TC-F35.M63 | `fixed`, ID thiếu map và không có bằng chứng | Throw (giữ test M59 hiện có, không sửa) |
| TC-F35.M63 | `fixed`, mọi ID đều bị loại có bằng chứng | `selectedProductIds=[]`, cảnh báo; không throw |
| TC-F35.M63 | Query bằng chứng nhận đúng `sourceStoreId` | Stub ghi lại `params[0] === '48'` |
| TC-F35.M63 | Không truyền `sourceStoreId` (R6) | Không gọi query bằng chứng; throw như cũ |
| TC-F35.M62 | Thông báo lỗi vẫn chứa `source products 30` / `source categories 7` (R4) | Không làm gãy assertion của M59 |

Stub `query` phân nhánh theo nội dung SQL (`migration_source_evidence_rows`, hoặc `<>` cho truy vấn ngoài scope) và trả dữ liệu cố định cho từng case.

## Related code files
- **Sửa:** `src/__tests__/unit/migration/pw1-product-selection.test.ts`
- **Đã grep (12/10):** ngoài file test này, chỉ `pw1-batch.ts:185` gọi `resolveProductSelections`. Vì tham số mới là tùy chọn (R6), không file test nào khác phải sửa.

## Implementation steps
1. Thêm `describe('[TC-F35.M62] Template-owned category fallback')` và `describe('[TC-F35.M63] Excluded fixed products')`.
2. Viết từng test theo AAA. Dùng `blueprint()` hiện có, thêm biến thể `random`.
3. Chạy `npx vitest run src/__tests__/unit/migration/pw1-product-selection.test.ts`.
4. Chạy toàn bộ `npm test`. Không bỏ qua test fail.

## Todo
- [x] M62 (4 case)
- [x] M63 (5 case)
- [x] `npm test` pass 100%

## Success criteria
- Toàn bộ test mới pass. Test M59 không phải sửa và vẫn pass.

## Risks
- Stub phân nhánh theo nội dung SQL dễ gãy khi đổi câu query. Để giảm rủi ro, tách hàm truy vấn bằng chứng (`pw1-selection-evidence.ts`) và stub ở mức hàm nếu phase 01 có tách file.

## Next steps
Phase 03, tài liệu.
