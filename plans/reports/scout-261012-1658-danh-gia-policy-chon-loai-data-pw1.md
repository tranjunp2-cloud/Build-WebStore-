# Đánh giá policy chọn/loại dữ liệu PW1 → PW2

- **Ngày:** 12/10/2026
- **Liên quan:** Issue #1956, báo cáo `scout-261012-1613-issue-1956-bao-cao-nguyen-nhan.md`
- **Cách đánh giá:** mỗi policy được xét theo 3 câu hỏi:
  1. Code export làm gì?
  2. Ảnh hưởng bao nhiêu bản ghi?
  3. Có khớp với cách PW1 thật sự hiển thị và bán hàng không?
- **Nguồn:**
  - Code export `src/lib/migration/pw1-export/**`
  - Config `configs/migration/pw1-prod-20260916.json`
  - Docs `docs/migration/pw1-pw2-master-field-mapping.md`
  - Code PW1: repo `prime-web-api` (commit `250916d4`)
  - Snapshot CSV 16/09
  - `mapping-report.json` (lần chạy 07/10)

---

## 1. Tóm tắt

| Mức | Policy / hành vi | Bản ghi bị ảnh hưởng | Nhận định |
|---|---|---|---|
| 🔴 Cao | `excludeProductsWithoutValidVariants` → `NO_VALID_VARIANTS` | **583 SP** (580 đang active, còn hàng) ở 171 store; ~252 SP ở shop thật | Nguyên nhân là **lỗi clone template của PW1 từ 02/2026**. Dữ liệu **khôi phục được** từ SP gốc của template theo mã SKU |
| 🟠 Trung bình | `excludeProductsInInactiveCategories` → `INACTIVE_CATEGORY` | **3.467 SP** ở 545 store (165 SP active, 9 SP từng có đơn) | Đã duyệt, nhưng **PW1 API không ẩn SP theo trạng thái category**. Chính sách loại SP draft cũng không nhất quán |
| 🟠 Trung bình | `excludeDuplicateProductSlugs`: giữ ID nhỏ nhất, kiểm tra **trước** các bước loại khác | 434 SP; **48 SP active bị mất cả nhóm** | Đã duyệt (Contract 1.9.2), nhưng bản giữ lại có thể bị loại sau đó, nên mất luôn bản hợp lệ |
| 🟡 Thấp | `activeCatalogOnly` + `allowInactiveSkusForInactiveProduct` | không có đếm riêng | SP draft giữ SKU inactive, SP active có toàn SKU inactive thì bị loại. Không nhất quán, nhưng hợp lý về nghiệp vụ |
| 🟡 Thấp | Blog category inactive / `flattenBlogCategoriesToRoot` | ~17 bài mất category, **không có diagnostic** | Mất ít, nhưng thiếu dấu vết |
| 🟢 OK | `MISSING_VARIANT_DOMAIN`, `SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH`, `NO_LIVE_OWNED_SKU`, `promoteActiveCategoriesToRoot`, các policy `resolveDuplicate*` | 151 / 13 / 9 / 4.383 / ~400 | Hợp lý: dữ liệu nguồn hỏng thật, hoặc chỉ đổi tên hay cấu trúc mà không mất dữ liệu |

---

## 2. Chi tiết từng policy

### 2.1. 🔴 `NO_VALID_VARIANTS`: lỗi clone của PW1, khôi phục được

**Code export:** `catalog.ts:277-280` loại SP có biến thể khi mảng variants rỗng và lỗi chỉ là `SOURCE_NO_VALID_VARIANT` hoặc `SOURCE_VARIANT_DOMAIN_MISSING`. Contract 1.9.2 (23/09) ghi rõ: "No missing SKU combinations are synthesized".

**Dữ liệu:**
- 583 SP. Hình dạng chung: SP có dòng thuộc tính (domain) nhưng **0 SKU có dòng chọn biến thể**. Phân bố: 282 SP có 2 SKU, 153 SP có 3 SKU, 110 SP có 6 SKU.
- SP trùng tên ở rất nhiều store, ví dụ "New York Croptop T-Shirt" ×56, "Ladies Fresis Cotton Voile Dress" ×56. Đây là SP mẫu của template.
- 534/583 SP được tạo năm 2026.
- So sánh theo thời gian clone, lấy ví dụ "New York Croptop T-Shirt":

  | SP | Store | Ngày tạo | Lựa chọn biến thể của SKU |
  |---|---|---|---|
  | 7076 (gốc, template f102) | 132 | 2022-10 | SHBHB-1607=Yellow, 1603=White, 1605=Red |
  | 22589 / 28916 / 45798 (clone) | 1046 / 1501 / 1690 | 06–10/2025 | **giống gốc** |
  | 53391 (clone) | 2544 | 02/2026 | **trống**, dù mã SKU và domain vẫn giống gốc |

- Trong 200 bản clone: 141 bản có lựa chọn biến thể (clone năm 2025), 56 bản không có (clone từ 02/2026).
- Phân bố: 331 SP ở shop ARY-QC/TECH-SUPPORT, **252 SP ở ~50 shop thật**, mỗi shop 5 SP. Ví dụ: NE NE COOKIES & CAFÉ, FashionEase, LINDA BEAUTY SPA ANDAMAN, SHIRBA AUTO WORLD…

**PW1:**
- Đặt hàng chỉ kiểm tra `products.*.sku` tồn tại, active và đúng store (`OrderController.php:703`). Không kiểm tra biến thể.
- Vì vậy trên PW1 các SKU này **vẫn đặt hàng được**: SP hiển thị và bán được, chỉ thiếu nhãn biến thể.

**Nhận định:**
- Policy loại đúng về kỹ thuật, nhưng làm **mất ~250 SP đang bán của shop thật**.
- Dữ liệu khôi phục được một cách **xác định**, không phải đoán theo tên: SP clone có **cùng mã SKU** và **cùng domain** với SP gốc trong template. Có thể dựng lại lựa chọn biến thể theo cặp (mã SKU → giá trị biến thể của SKU gốc).
- Cần xác định thêm dòng dõi clone. Ví dụ: shop có `frontend_template_id` trỏ tới template chứa SP gốc cùng tên, cùng tập mã SKU.

### 2.2. 🟠 `INACTIVE_CATEGORY`: đã duyệt nhưng không khớp hành vi PW1

**Code export:**
- `catalog.ts:258-267`: SP thuộc category **cùng store, chưa xóa, `status=0`** bị loại toàn bộ.
- Chỉ xét trạng thái của chính category đó, không xét category cha.
- Nếu tắt cờ, SP được giữ lại với `category: []` (`PRODUCT_INACTIVE_CATEGORY_OMITTED`).

**Phê duyệt:**
- Contract 1.10.2 (`pw1-pw2-master-field-mapping.md:1957-1959`): "Theo quyết định đã duyệt…", không ghi ngày.
- `decisionEvidence` 17/09: "active Category/SKU only".

**Dữ liệu:**
- 3.467 SP ở 545 store. Trong đó 3.302 SP là draft (`status=0`), **165 SP active và còn hàng**, 50 SP ở shop thật, **9 SP từng có đơn hàng**.
- Ví dụ store 664: 15 SP active, nhưng cả 4 category của shop đều `status=0`, nên toàn bộ SP bị loại.

**PW1:**
- `ProductController@index`, `search`, `show` **không lọc theo trạng thái category** (category chỉ dùng để lọc theo ID).
- `EloquentCategoryRepository::updateStatus` không lan trạng thái xuống SP.
- Đặt hàng không kiểm tra trạng thái category.
- ⇒ Trên PW1, SP trong category tắt **vẫn hiện (nếu client không lọc) và vẫn bán được**.
- Chưa xác minh: storefront Nuxt có tự lọc hay không (repo storefront không có ở đây).

**Không nhất quán trong chính bộ policy:**
- SP draft ở category đang active: **giữ** dưới dạng draft.
- SP draft ở category tắt: **loại**.
- Hai trường hợp cùng là "không hiển thị" nhưng bị xử lý khác nhau.
- Lựa chọn thay thế ít mất dữ liệu hơn đã có sẵn trong code: tắt `excludeProductsInInactiveCategories`, giữ SP với `category: []` (và có thể chuyển SP thành draft).

### 2.3. 🟠 `DUPLICATE_PRODUCT_SLUG`: thứ tự kiểm tra làm mất SP hợp lệ

**Code export:** `catalog.ts:222-234`. SP được duyệt theo ID tăng dần. Slug được **đăng ký ngay khi gặp lần đầu**, trước mọi bước kiểm tra khác: status, SKU, giá/tồn kho, category, biến thể.

**Phê duyệt:**
- Contract 1.9.2 (23/09) ghi rõ: "retain the numerically lowest Product ID … never substitute a later Product if it fails".
- Đây là quyết định **có chủ ý**.

**Dữ liệu:**

| Trường hợp | Số SP |
|---|---|
| SP bị loại là draft, bản giữ lại cũng bị loại | 250 |
| SP active bị loại, bản giữ lại active và cùng tên (đúng là trùng) | 120 |
| **SP active bị loại, bản giữ lại cũng bị loại vì lý do khác** | **48** |
| Cả hai bản đều draft | 16 |

- Ví dụ nhóm (59477, 59807): 59477 bị `MISSING_VARIANT_DOMAIN`, nên 59807 (hợp lệ) cũng mất theo `DUPLICATE_PRODUCT_SLUG`.

**PW1:**
- Slug là duy nhất theo store, chỉ tính SP chưa xóa (migration `2026_09_08_000000_harden_core_database_integrity`).
- API tra SP theo `id`, không theo slug.

**Nhận định:**
- Giữ ID nhỏ nhất là hợp lý.
- Nhưng việc "giữ chỗ slug" cho bản ghi sẽ bị loại làm mất 48 SP active mà không có lý do nghiệp vụ.
- Có thể đổi sang: chỉ đăng ký slug sau khi SP qua hết các bước kiểm tra, hoặc dùng `resolveDuplicate*` thêm hậu tố như category và blog đang làm.

### 2.4. 🟡 `activeCatalogOnly` + `allowInactiveSkusForInactiveProduct`
- SP `status=0` giữ được SKU inactive (`catalog.ts:241`, `:517`).
- SP `status=1` có toàn bộ SKU inactive thì bị loại (`PRODUCT_INACTIVE_SKUS_EXCLUDED`). Mã này không có `reason` và không nằm trong danh mục exclusion của `product-exclusions.ts`.
- PW1 tự chuyển SP về `status=0` khi SKU cuối cùng bị tắt qua endpoint (`EloquentProductSkuRepository::updateStatus`). Nên trường hợp này hiếm, và chỉ xảy ra khi dữ liệu bị sửa trực tiếp.
- `allowInactiveSkusForInactiveProduct` **không tìm thấy văn bản phê duyệt**, chỉ có trong config.

### 2.5. 🟡 Blog
- Blog category `status=0` hoặc đã xóa bị bỏ qua **im lặng** (`content.ts:70`).
- Bài viết thuộc category tắt mất category và không có diagnostic (`content.ts:284-294`).
- Snapshot: 15 bài thuộc category tắt (3 bài đã publish), 2 bài published có category tắt nhưng category gốc vẫn active.
- PW1 không ẩn bài viết theo trạng thái category.
- `flattenBlogCategoriesToRoot` chuyển 460 bài lên category gốc và bỏ 154 category con. **Không tìm thấy văn bản phê duyệt.**

### 2.6. 🟢 Các policy hợp lý

| Policy / lý do | Số | Lý do hợp lý |
|---|---|---|
| `MISSING_VARIANT_DOMAIN` | 151 (58 active) | SP nhiều SKU nhưng không khai báo thuộc tính. Khác 2.1: không có domain để dựng lại. Cần xem nguồn gốc riêng (2/58 có đơn) |
| `SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH` | 13 | SKU tham chiếu thuộc tính đã xóa mềm, dữ liệu hỏng thật |
| `NO_LIVE_OWNED_SKU`, `MISSING_STOCK` | 10 | Không có giá hoặc tồn kho, không tự đặt giá 0 |
| `promoteActiveCategoriesToRoot` | 4.383 category | Giữ category con active khi cha tắt. Đã duyệt 17/09 |
| `resolveDuplicateSkus / CategorySlugs / BlogSlugs…` | ~400 | Thêm hậu tố, không mất dữ liệu |
| `resolveDuplicateCategoryNames` | 62 | Tên "resolved" gây hiểu nhầm (chỉ cảnh báo, không đổi tên); không mất dữ liệu |

---

## 3. Liên hệ với Issue #1956
- Store **664** (`INACTIVE_CATEGORY`): phụ thuộc mục 2.2. Nếu đổi policy, shop sẽ có 15 SP.
- **25 shop ARY-QC/TECH-SUPPORT** (`NO_VALID_VARIANTS`): phụ thuộc mục 2.1. Nếu khôi phục biến thể từ template, các SP bị chặn sẽ có mapping.
- Store **48**: `SOURCE_EAV_ORPHAN` và `MISSING_VARIANT_DOMAIN` thuộc mục 2.6. Dữ liệu hỏng thật, không đổi.

## 4. Câu hỏi còn mở
1. Storefront Nuxt của PW1 có gửi `filter[status]=1`, hoặc lọc category tắt, không? Đây là căn cứ cuối để chốt mục 2.2.
2. Ai duyệt `allowInactiveSkusForInactiveProduct` và `flattenBlogCategoriesToRoot`? Không tìm thấy văn bản.
3. Contract 1.10.2 không ghi ngày duyệt, và không nói rõ việc loại cả SP draft. Có cần xác nhận lại với PO không?
4. Với mục 2.1, có chấp nhận dựng lại lựa chọn biến thể theo dòng dõi template + mã SKU không? Đây không phải suy luận theo tên, nhưng là dữ liệu tổng hợp lại, cần PO duyệt.
5. Migration `harden_core_database_integrity` đã chạy trên DB prod PW1 chưa? Câu trả lời ảnh hưởng tới việc có thể tồn tại slug trùng.
