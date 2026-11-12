# Báo cáo: Nguyên nhân 58 shop PW1 chưa tạo được website (Issue #1956)

- **Ngày:** 12/10/2026
- **Phạm vi:** phân tích nguyên nhân gốc. Báo cáo chưa chốt hướng xử lý.
- **Nguồn dữ liệu đối chiếu:**
  - Source code `src/lib/migration/**` (nhánh `staging`)
  - Snapshot PW1 gốc ngày 16/09 (bộ CSV dump prod)
  - DB local `primeweb-db` (83 store, lần import ngày 07/10)
  - Artifact `mapping-report.json` của lần import ngày 07/10
  - Tài liệu `docs/migration/*`

> **Đính chính 13/10/2026:** giả thuyết "lần chạy Neon bật `--require-be-data`" là **sai**. Runbook Sandbox không có cờ này và người chạy không thêm. Mô phỏng lại 58 shop theo đúng runbook cho thấy:
> - B-cat là **18 shop** (thêm 271 và 509: 509 trỏ category 515 của store mẫu).
> - 14 shop nhóm A còn lại (40, 60, 186, 489, 501, 664, 912, 935, 1141, 1152, 1329, 2735, 2787, 2896) **qua được bước chọn sản phẩm** kể cả với code cũ. Nguyên nhân `pending` trên Neon chưa xác định, cần `pw1_migration_batches.results` của `pw1-migrated-261010`.
> - Quan sát dữ liệu PW1 rỗng ở mục 4.3 vẫn đúng, nhưng không phải lý do chặn.

---

## 1. Tóm tắt

Phần lớn 58 shop bị chặn **không phải do lỗi code**, và **không phải do BE thiếu mapping** như issue mô tả. Nguyên nhân nằm ở **dữ liệu gốc PW1**. Các quy tắc import BE đã loại dữ liệu này đúng như thiết kế, sau đó CLI website bị chặn.

| Nhóm | Issue mô tả | Nguyên nhân thực tế |
|---|---|---|
| A: `BE_DATA_MISSING` (16) | BE chưa import/kích hoạt sản phẩm, chưa publish blog | Dữ liệu PW1 thật sự rỗng: sản phẩm `status=0` hoặc đã xóa, blog đã xóa. Riêng store 664: category đang tắt nên SP bị loại theo chính sách. ~~Lần chạy bật cờ `--require-be-data` nên bị chặn.~~ Sai, xem đính chính đầu báo cáo. |
| B: `BE_MAPPING_INVALID`, category | Chưa có bảng đối chiếu ID | Bảng đối chiếu **đã có và đúng**. Cấu hình website của shop trỏ tới **category của store mẫu**, do lỗi clone template của PW1 không đổi ID `product_category`. Trên PW1 các khối này nhiều khả năng đang hiển thị trống. |
| B: `BE_MAPPING_INVALID`, product | Chưa có bảng đối chiếu ID | Sản phẩm có **dữ liệu biến thể lỗi trong PW1**, nên bị BE loại có chủ ý. Website vẫn chọn đích danh các sản phẩm đó. |

Hai việc BE trong checklist của issue ("cung cấp mapping", "kích hoạt sản phẩm") đang chỉ sai hướng.

---

## 2. Pipeline migrate hiện tại

| Bước | Lệnh | Code chính | Kết quả |
|---|---|---|---|
| Export | `migrate:pw1:export` | `pw1-export/**`, `pw1-export/mappers/catalog.ts`, `pw2-product-eav.mjs` | Master part theo store, kèm danh sách dữ liệu bị loại |
| Prepare | `migrate:pw1:prepare` | `pw1-json/prepared-destination.ts`, `destination-map.ts` | Gói handoff `prepared/` |
| Import BE | `migrate:pw1:import` | `pw1-json/writer.ts`, `ledger.ts` | Dữ liệu PW2 và bảng đối chiếu `migration_entity_map` |
| Website | `migrate:pw1:website` | `pw1-collection-input.ts` → `pw1-batch.ts` → `pw1-product-selection.ts` | Site/page PW2, ledger `pw1_migration_stores` |

---

## 3. Các quy tắc mapping dữ liệu

### 3.1. Bảng đối chiếu `migration_entity_map`
- Khóa là `(source_system, source_instance_id, source_entity, source_id)`, unique khi `claim_active` (`scripts/pw1-migration-schema.js:144`).
- **Không có cột store/tenant**, nên mỗi ID PW1 chỉ map tới đúng một ID PW2.
- Chỉ dòng có `state='VERIFIED'` mới được dùng.

### 3.2. Phía import BE
- **Category** được import vào tenant/site của store **sở hữu** category đó (`categories.store_id`). Code không xử lý riêng store mẫu: `is_template_owner` chỉ xuất hiện trong danh sách cột.
- **Trạng thái sản phẩm:** PW1 `status=1` thành `active`, giá trị khác thành `draft` (`catalog.ts:340`).
- **Sản phẩm bị loại** (`catalog.ts` khoảng L230–345, `pw2-product-eav.mjs`) trong các trường hợp:
  - đã xóa, trùng slug, hoặc status không hợp lệ;
  - không có SKU, hoặc thiếu giá/tồn kho;
  - dữ liệu biến thể lỗi: `SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH`, `SOURCE_VARIANT_DOMAIN_MISSING`, `SOURCE_SELECTED_OPTION_INVALID`, …
- Sản phẩm bị loại **không có dòng** trong `migration_entity_map`. Lý do loại được ghi trong `mapping-report.json` và `docs/migration/pw1-export-outcome-tracking-20260918.md`.

### 3.3. Phía website
- Khối danh sách sản phẩm (`pw1-collection-input.ts:200-209`) lấy dữ liệu từ cấu hình component PW1:
  - `list_type` → chế độ chọn: `all` / `fixed` / `random`
  - `product_category` → `sourceCategoryId`
  - danh sách chọn tay → `sourceProductIds`
- `resolveIds` (`pw1-product-selection.ts:33-43`) chỉ nhận mapping thỏa cả ba điều kiện:
  - `VERIFIED`;
  - **thuộc đúng site và tenant của shop**;
  - chưa xóa.
- Nếu số kết quả khác 1, hàm báo lỗi `BE_MAPPING_INVALID`.
- Đây là **chỗ duy nhất chặn cứng**. Các khối khác chỉ ghi cảnh báo hoặc giữ link gốc: danh sách category, link, menu, danh sách blog.
- Nguyên tắc thiết kế: chỉ dùng mapping đã xác minh, **không bao giờ đoán ID theo tên** (`pw1-product-selection.ts:29`, `pw1-destination.ts`, `docs/migration/pw1-website-cli.md:248-252`).
- Cờ `--require-be-data` là **tùy chọn**. Nó chặn ở hai chỗ: `pw1-batch.ts:150` và `:176`. Khi tắt cờ, danh sách không có dữ liệu sẽ hiện trạng thái rỗng (`emptyBehavior: native-empty-state`).

---

## 4. Nguyên nhân chi tiết từng nhóm

### 4.1. Nhóm B: category của store mẫu

**Các shop liên quan:** 71, 73, 82, 90, 93, 94, 106, 187, 197, 301, 332, 344, 408, 836, 2646, 2676. Store 271 cũng gặp lỗi này, xem mục 4.3.

**Bằng chứng:**
- **Cấu hình component PW1** (`model_settings`): component của chính shop có `list_type=random` và `product_category` trỏ tới category của **store mẫu**.

  | Store | Component | `product_category` | Store sở hữu category |
  |---|---|---|---|
  | 71 | 723 | 606 | 24 (f009-3, store mẫu) |
  | 73 | 742 | 2052 | 27 (f009-6, store mẫu) |
  | 90 | 861 | 2042 | 20 (T010-5, store mẫu) |
  | 197 | 5542 | 2046 | 21 (T006-6, store mẫu) |

- **DB local, BE map đúng:** 606 → 475 nằm ở tenant/site 24, tức store sở hữu.
- **Shop không dùng category đó:** mỗi shop có **0 sản phẩm** thuộc category được trỏ tới.
- **15/17 shop có category cùng tên của riêng mình.** Ví dụ store 71 có `Men` = 2059. Store 82 có 2 category trùng tên. Store 332 và 2676 không có.
- **Log lỗi local khớp issue:** `Component 723: source categories 606 needs exactly one verified destination mapping`.

**Kết luận:** lỗi nằm ở **dữ liệu nguồn PW1**. Khi shop clone template, ID category của store mẫu được giữ nguyên trong cấu hình. BE map đúng, và code website từ chối đúng thiết kế. Riêng thông báo lỗi gây hiểu nhầm: nó không phân biệt "không có mapping" với "mapping nằm ngoài shop".

### 4.2. Nhóm B: sản phẩm (store 48)

**Bằng chứng** (`mapping-report.json` + CSV):

| Sản phẩm | Mã loại trừ | Chi tiết |
|---|---|---|
| 3312 | `PRODUCT_CATALOG_POLICY_EXCLUDED` / `MISSING_VARIANT_DOMAIN` | 3 SKU còn sống, active, có giá, nhưng **không khai báo thuộc tính biến thể nào** |
| 3316 | `SOURCE_ENTITY_EXCLUDED` / `SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH` | SKU tham chiếu thuộc tính 67/68, **đã bị xóa mềm** trong PW1 |
| 3317 | như 3316 | như 3316 |
| 3308 | như 3316 | như 3316 |

- Store 48: PW1 có 110 sản phẩm còn sống, PW2 có 102.
- Component 503 (`list_type=fixed`) chọn đích danh các sản phẩm đã bị loại, nên bị chặn.

**Kết luận:** dữ liệu biến thể (EAV) của PW1 bị lỗi. BE loại có chủ ý, đúng quy tắc.

### 4.3. Nhóm A: thiếu dữ liệu BE (16 shop)

Đối chiếu snapshot PW1 (SP = sản phẩm):

| Store | Dữ liệu PW1 | Kết luận |
|---|---|---|
| 40, 489, 912, 1329, 2787 | SP còn sống nhưng **tất cả `status=0`** | Import thành `draft`, 0 active, đúng quy tắc |
| 1141 | 15 SP đã xóa, 1 SP inactive | Đúng |
| 60, 509, 935, 1152 | Blog **đã bị xóa hết** | Đúng |
| 186, 271, 501, 2735 | SP **đã bị xóa hết** | Đúng |
| 2896 | Blog chưa publish | Đúng |
| 664 | 15 SP active, nhưng **cả 4 category chứa SP đều `status=0`** | Đúng quy tắc: cả 20 SP bị loại `INACTIVE_CATEGORY` (xem mục 6) |

- ~~Shop bị chặn vì lần chạy bật `--require-be-data`.~~ Sai: không có cờ này, 14 shop qua được bước chọn sản phẩm; nguyên nhân thật chưa rõ.
- Trên DB local (chạy không bật cờ), store 40, 60, 186 đều `completed`.
- **Store 271** còn bị lỗi category ẩn: component 5466 trỏ tới category 653, thuộc store mẫu 25. Lỗi này sẽ lộ ra khi gỡ chặn nhóm A.

---

## 5. Điểm phụ trong code (không gây ra issue)
- Thông báo lỗi của `resolveIds` không phân biệt mapping **thiếu** với mapping **nằm ngoài site/tenant**, nên dễ chẩn đoán sai.
- `resolveDeclaredCategories` (`pw1-destination.ts:76-78`) tra `migration_entity_map` mà **không lọc theo site/tenant**. Về lý thuyết có thể sinh link `?categoryId=` trỏ sang tenant khác.

---

## 6. Kết quả xử lý các câu hỏi tồn đọng

Nguồn bổ sung:
- Source code PW1: repo `prime-web-api` (Laravel, commit `250916d4`)
- Artifact export/import ngày 07/10: `source-config.json`, `mapping-report.json`

### 6.1. Vì sao cấu hình website trỏ tới category của store mẫu, và PW1 hiển thị gì?

**Nguyên nhân gốc là lỗi clone template của PW1** (đã xác nhận trong code).
- `EloquentStoreRepository::useTemplateV2` (L230) clone category, sản phẩm, page và menu của store mẫu sang shop mới.
- `clonePages` (L1571) chép setting của component **nguyên giá trị**: `'value' => $item->value` (L1713). Không có bước đổi ID.
- Chỉ một số loại tham chiếu được đổi sang bản sao của shop:
  - shortlist item: đổi theo `slug`;
  - menu item: đổi theo `name` (`findSimilarModelFromTemplate`, L2362-2377).
- Setting `product_category` của component **không bao giờ được đổi**, nên shop giữ ID category của store mẫu. Ví dụ store 71 vẫn giữ 606 (thuộc store 24), dù đã có bản sao riêng là 2059 `Men`.

**PW1 hiển thị danh sách trống** (rất có khả năng).
- `ProductController@index` (L91-118) lọc `category_id IN (...)` hoặc category con trực tiếp (`parent_id`).
- Model `Product` có global scope `StoreScope` (`app/Scopes/StoreScope.php`), luôn thêm điều kiện `store_id = user()->store_id`.
- Mọi route sản phẩm đều nằm trong `auth:api` và yêu cầu quyền `read products` (`routes/web.php` L84, L684+). Không có route public nào bỏ qua scope.
- Kết quả: `store_id=71 AND category_id=606` trả về **0 sản phẩm**.
- Phía admin, rule validate `product_category` là `exists:categories,id,store_id,{store của user}` (`EloquentFrontendComponentRepository.php` L73-75). Nếu chủ shop lưu lại component, ID cũ sẽ bị từ chối.
- Chưa xác minh 100%: code storefront (Nuxt) không nằm trong repo này, nên cách client xử lý kết quả rỗng là suy luận.

⇒ **Kết luận:** trên PW1, các khối danh sách này nhiều khả năng **đang hiển thị trống** do lỗi clone. Migrate sang PW2 dạng "danh sách trống" hoặc "bỏ filter category" đều không làm mất dữ liệu đang hiển thị.

### 6.2. Store 664: vì sao PW2 có 0 sản phẩm active?
- Theo `mapping-report.json`, **cả 20 SP** bị loại `PRODUCT_CATALOG_POLICY_EXCLUDED / INACTIVE_CATEGORY`.
- Theo snapshot, 4 category chứa SP đều `status=0` (chưa xóa):
  - 23601 WALL PLANTERS
  - 23606 INDOOR PLANTERS
  - 23607 OUTDOOR PLANTERS
  - 23608 HANGING PLANTERS
- Cấu hình export có `activeCatalogOnly=true` và `excludeProductsInInactiveCategories=true`, theo quyết định ngày 17/09 "active Category/SKU only".

⇒ **Không phải lỗi BE.** Đây là kết quả đúng của chính sách export đã duyệt.

### 6.3. Danh sách sản phẩm bị loại (nhóm B, sản phẩm)

Toàn bộ **26/26** ID bị chặn trong issue đều có lý do trong `mapping-report.json`.

| Shop | ID bị chặn | Lý do loại | Chi tiết dữ liệu PW1 |
|---|---|---|---|
| 48 (Hallo) | 3312 | `MISSING_VARIANT_DOMAIN` | 3 SKU, không khai báo thuộc tính nào |
| 25 shop ARY-QC / TECH-SUPPORT | 50955, 51229, … (ID đầu tiên mỗi shop) | `NO_VALID_VARIANTS` | Ví dụ 50955, 54782: 2 SKU, 2 dòng thuộc tính, nhưng **0 dòng chọn biến thể cho SKU**. Không phân biệt được SKU nên toàn bộ SKU bị loại |

- **Store 48 bị loại tổng cộng 8 SP:**
  - 3312: `MISSING_VARIANT_DOMAIN`
  - 3308, 3316, 3317, 3322, 3339, 5575, 6133: `SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH`, vì thuộc tính 67/68 đã bị xóa mềm.
- **Mỗi shop ARY-QC / TECH-SUPPORT** có đúng 5 SP bị loại `NO_VALID_VARIANTS`, cùng tên ("High-collar T-shirt with ribbed fabric", …). Đây là bộ dữ liệu QA tạo tự động bị lỗi giống nhau.
- **Phía code PW1** (giải thích vì sao dữ liệu lỗi tồn tại):
  - Lưu sản phẩm không bắt buộc khai báo thuộc tính cho sản phẩm nhiều SKU (`EloquentProductRepository.php` L96-118, L184-215).
  - `Attribute` và `ProductAttribute` dùng SoftDeletes. Xóa mềm thuộc tính không dọn các dòng tham chiếu, nên sinh dòng mồ côi.

### 6.4. Prod có dùng cùng cấu hình export với local không?
- Lần chạy local (`snapshotId pw1-2026-10-07T07-54-49-494Z-93540442`) đọc đúng bộ CSV snapshot 16/09, với `sourceInstance=PW1PROD` và `asOf=2026-09-18`.
- 11 shop có mặt cả ở local lẫn trên issue (48, 71, 73, 82, 90, 93, 94, 106, 187, 197, 301) báo **lỗi giống hệt**, cùng component và cùng ID.
- ~~Khác biệt duy nhất là lần chạy Neon bật `--require-be-data`.~~ Sai (xem đính chính). Lý do store 40, 60, 186 `completed` ở local nhưng `pending` trên Neon, và 271/509 báo `BE_DATA_MISSING` trên Neon, chưa xác định.

⇒ **Gần như chắc cùng cấu hình export.** Chưa đọc trực tiếp được `source-config.json` của lần chạy prod.

### 6.5. Có loại shop test không?
Đây là quyết định của PM, code không trả lời được.

Bằng chứng hỗ trợ quyết định:
- 25 shop ARY-QC / TECH-SUPPORT chỉ chứa bộ dữ liệu QA tạo tự động, giống nhau và đều lỗi biến thể.
- Các shop `lnl006`, `Linh006`, `Linhtmprod 2`, `vitmohonvitmohon`, `PC Test 02` thuộc nhóm lỗi category giống shop thật.

---

## 7. Kết luận cập nhật

44/58 shop đã có nguyên nhân rõ, **không có lỗi nào do BE import sai**. 14 shop còn lại chưa rõ (cập nhật 13/10):

| Nguyên nhân | Số shop | Nguồn gốc |
|---|---|---|
| Lỗi clone template PW1: `product_category` không được đổi ID | 18 (gồm 271, 509) | Code PW1 `clonePages` L1713 |
| Dữ liệu biến thể PW1 lỗi, SP bị loại theo chính sách | 26 (48 + 25 shop test) | Dữ liệu PW1 + chính sách export |
| Chưa xác định (qua được bước chọn sản phẩm; cần log batch Neon) | 14 | Chưa rõ |

## 8. Câu hỏi còn mở
1. **Storefront PW1 (Nuxt):** xử lý kết quả rỗng thế nào (ẩn khối, hay hiện "không có sản phẩm")? Cần repo storefront để xác nhận 100%.
2. **PM:** chốt có loại các shop test khỏi phạm vi không.
