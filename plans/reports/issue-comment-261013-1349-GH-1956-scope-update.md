## Cập nhật scope: nguyên nhân thật của 58 shop `pending`

Đã kiểm tra lại trên DB local (cùng snapshot PW1 16/09, cùng policy export với lần chạy Neon), mô phỏng đúng luồng `npm run migrate:pw1:website` trong runbook (không cờ phụ) cho cả 58 shop, chạy tới bước chọn sản phẩm. Đối chiếu thêm với source PW1 (`prime-web-api`) và snapshot CSV.

### Tóm tắt
| Nhóm | Số shop | Nguyên nhân | Trạng thái |
|---|---|---|---|
| B-cat | 18 | Khối danh sách sản phẩm trỏ tới category của **store mẫu** (lỗi clone template của PW1) | Đã xác định, có code fix |
| B-prod | 26 | Khối sản phẩm **chọn tay** chứa 1 sản phẩm mà export BE đã **cố ý loại** | Đã xác định, có code fix |
| A | 14 | Chưa xác định | Cần log Neon |

- ID bị chặn của 44 shop B-cat + B-prod **khớp 100%** với bảng trong issue.
- **Không phải do BE thiếu mapping.** Hai việc BE trong checklist ("cung cấp mapping ID", "kích hoạt sản phẩm") không cần làm.

### B-cat: category của store mẫu (18 shop)
71, 73, 82, 90, 93, 94, 106, 187, 197, 271, 301, 332, 344, 408, 509, 836, 2646, 2676

- Mỗi template PW1 (f009-3, f009-4, f009-6, T010-5…) có một **store mẫu** (`is_template_owner = 1`) chứa dữ liệu demo: trang, category, sản phẩm.
- Khi shop chọn template, PW1 (`EloquentStoreRepository::useTemplateV2` → `cloneCategories`, `clonePages`) tạo **bản sao category riêng cho shop** (ID mới). Menu và shortlist được đổi sang ID bản sao, nhưng **settings của component** (gồm `product_category` của khối danh sách sản phẩm) bị chép nguyên giá trị → khối vẫn trỏ ID category của store mẫu.
- Ví dụ store 71 (USSOP), component 723 trỏ category **606 "Men"** của store mẫu `f009-3` (store 24), trong khi shop có bản sao riêng **2059 "Men"**.
- Category của store mẫu được tham chiếu: 138, 140, 192, 242, 514, 515, 606, 652, 653, 2042, 2046, 2052, 2053, 2055. Tất cả **đã có mapping VERIFIED** nhưng thuộc tenant của store mẫu, nên CLI (chỉ nhận category trong phạm vi shop) báo nhầm là "thiếu mapping".
- Trên PW1 các khối này **đang hiển thị rỗng**, vì PW1 lọc sản phẩm theo store (`StoreScope`).
- 271 và 509 trước đây xếp nhóm A, thực chất thuộc nhóm này.

### B-prod: sản phẩm chọn tay bị BE loại (26 shop)
48, 2392, 2399, 2409, 2418, 2426, 2436, 2445, 2454, 2463, 2472, 2481, 2490, 2499, 2508, 2517, 2526, 2535, 2544, 2553, 2562, 2571, 2580, 2589, 2591, 2850

- Khối Product Listing ở chế độ `fixed`: chủ shop tự chọn từng sản phẩm (lưu ở `shortlist_items`). Khi migrate, từng ID phải có mapping sang PW2; thiếu 1 ID là cả shop bị dừng.
- Mỗi shop có 1 sản phẩm trong danh sách bị export BE loại vì **dữ liệu biến thể hỏng** (nhiều SKU nhưng không phân biệt được):
  - 50955 (store 2392): 2 SKU, khai báo thuộc tính "Color" nhưng không SKU nào có giá trị → `SOURCE_NO_VALID_VARIANT`.
  - 3312 (store 48): 3 SKU, không khai báo thuộc tính nào → `SOURCE_VARIANT_DOMAIN_MISSING`.
- 25 shop là shop test ARY-QC-COM / TECH-SUPPORT-COM tạo từ cùng bộ dữ liệu mẫu, nên cùng dính; store 48 là trường hợp riêng.
- Sản phẩm bị loại được ghi bằng chứng trong `migration_source_evidence_rows` (`disposition='retained-source'`).

### A: 14 shop chưa rõ nguyên nhân
40, 60, 186, 489, 501, 664, 912, 935, 1141, 1152, 1329, 2735, 2787, 2896

- Các shop này ít/không có sản phẩm active hoặc blog published, nhưng `BE_DATA_MISSING` **chỉ phát sinh khi bật `--require-be-data`**, mà runbook không dùng cờ này. Không bật cờ thì đây chỉ là cảnh báo, khối danh sách hiện trạng thái rỗng.
- Mô phỏng cho thấy cả 14 shop **qua được bước chọn sản phẩm** kể cả với code cũ; ở local 40, 60, 186 đã `completed_with_warnings`.
- Vậy lý do chúng còn `pending` trên Neon là lỗi khác (ví dụ batch dừng giữa chừng do hết quota OpenAI ngày 10/10, hoặc lỗi trước bước sinh website). Cần xem `pw1_migration_batches.results` của 14 shop trên `pw1-migrated-261010`:

```sql
SELECT b.started_at, r->>'sourceStoreId' AS store, r->>'status' AS status, r->>'code' AS code, left(r->>'error', 200) AS error
FROM pw1_migration_batches b, jsonb_array_elements(b.results) r
WHERE r->>'sourceStoreId' IN ('40','60','186','489','501','664','912','935','1141','1152','1329','2735','2787','2896')
ORDER BY store, b.started_at;
```

### Hướng xử lý
1. **Code fix** (PR sẽ mở, `Relates to #1956`), không đổi dữ liệu BE:
   - Category của store mẫu: khối danh sách để rỗng (giống PW1 hiện tại), ghi cảnh báo vào report của shop; chủ shop có thể chọn lại sản phẩm trong editor.
   - Sản phẩm chọn tay bị BE loại: chỉ bỏ sản phẩm có bằng chứng `retained-source` đúng shop, giữ các sản phẩm còn lại theo thứ tự, ghi cảnh báo.
   - Thiếu mapping **không có bằng chứng** vẫn báo `BE_MAPPING_INVALID` như cũ.
2. **Chạy lại trên Neon** với BE run cũ (không export/import lại, giữ nguyên 1310 shop đã xong): `npm run migrate:pw1:website -- retry`.
3. Shop nhóm A còn lỗi sau `retry`: xem `npm run migrate:pw1:website -- logs --store <ID>` và xử lý riêng.

### Đã kiểm chứng (local)
- Unit test mới TC-F35.M62/M63, toàn bộ test suite pass.
- Mô phỏng 58 shop: code cũ chặn đúng 44 shop như issue; code mới cho cả 58 qua bước chọn sản phẩm.
- Chạy thật 3 shop 71, 48, 271: cả 3 `completed`.

### Ngoài scope (đề xuất tách issue riêng)
- Lỗi clone template của PW1 (không đổi `product_category` trong settings sang category bản sao).
- Policy export BE: khôi phục sản phẩm lỗi biến thể, `INACTIVE_CATEGORY`, thứ tự xử lý slug trùng.
- Cân nhắc map category store mẫu sang bản sao cùng tên của shop (hiện chưa làm vì phải đoán theo tên).
