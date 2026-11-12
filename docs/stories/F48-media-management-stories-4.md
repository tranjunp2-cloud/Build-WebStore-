# User Stories: Media Management (F48) — Phần 4 (US-F48-14..16)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F48 — Media Management
> **Sprint:** S5 Media sản phẩm | **Priority:** P1/P2 | **PRD:** [F48-media-management-overview.md](../prd/F48-media-management-overview.md) | **Architecture:** [F48-media-management.md](../architecture/F48-media-management.md) | **Design:** [F48-media-management-design.md](../design/F48-media-management-design.md) | **QA:** [F48-media-management.md](../qa/F48-media-management.md) | **Mục lục + persona:** [F48-media-management-stories.md](./F48-media-management-stories.md)

> [!NOTE]
> Story phần này thay đổi hành vi F08 (Products CRUD). PRD `docs/prd/F08-products-crud.md` phải được cập nhật giới hạn ảnh và ảnh biến thể cùng đợt.

---

## US-F48-14: Gallery sản phẩm 10 ảnh, kéo sắp xếp, ảnh chính
**Sprint S5** | **P1** | **S** | **Status:** Draft — PO đồng ý 10 ảnh (D11, D88)
### Story
```
As a   chủ shop
I want thêm tối đa 10 ảnh cho mỗi sản phẩm, sắp xếp thứ tự và chọn ảnh chính
So that khách thấy sản phẩm từ nhiều góc, và ảnh đẹp nhất hiện đầu tiên trên danh sách sản phẩm
```
### Acceptance Criteria
#### AC-1: Thêm tới 10 ảnh
```gherkin
GIVEN sản phẩm đang có 7 ảnh
WHEN  mở picker đa chọn (US-F48-06) từ gallery
THEN  picker cho chọn tối đa 3 ảnh (= MAX_PRODUCT_IMAGES − 7; MAX_PRODUCT_IMAGES = 10, D11), hiện "Đã chọn 3/3"
  AND sau khi có MAX_PRODUCT_IMAGES ảnh (10, D11), nút "Thêm ảnh" bị vô hiệu với gợi ý "Tối đa 10 ảnh mỗi sản phẩm"
```
#### AC-2: Kéo sắp xếp, ảnh đầu là ảnh chính
```gherkin
GIVEN gallery có 5 ảnh
WHEN  kéo ảnh thứ 4 lên đầu (chuột, cảm ứng) hoặc dùng nút "Đưa lên/Đưa xuống" bằng bàn phím, rồi lưu
THEN  thứ tự được lưu đúng, ảnh đầu có nhãn "Ảnh chính" / "Imej utama"
  AND ảnh chính dùng cho thẻ SP storefront, trang chi tiết, giỏ hàng và OG/chia sẻ
```
#### AC-3: Đặt làm ảnh chính
```gherkin
GIVEN gallery có 5 ảnh
WHEN  chọn "Đặt làm ảnh chính" ở ảnh thứ 3
THEN  ảnh đó chuyển lên vị trí 1, các ảnh khác giữ thứ tự tương đối
```
#### AC-4: Gỡ ảnh khỏi gallery
```gherkin
GIVEN ảnh G đang là ảnh của biến thể "Merah / M" (US-F48-15)
WHEN  gỡ G khỏi gallery
THEN  cảnh báo "Ảnh đang dùng cho 1 biến thể; biến thể sẽ dùng ảnh chính"
  AND sau khi lưu, G chỉ bị gỡ tham chiếu, vẫn còn trong thư viện
```
#### AC-5: Validate ở server
```gherkin
GIVEN client bị bỏ qua
WHEN  gửi lưu sản phẩm với 11 ảnh, ảnh trùng lặp, hoặc mediaId thuộc tenant khác / là video
THEN  trả 400 "PRODUCT_IMAGES_TOO_MANY" / "PRODUCT_IMAGES_DUPLICATE" / "PRODUCT_IMAGES_INVALID", sản phẩm không đổi
  AND thêm mới media không phải JPG/PNG/WebP (gif, avif, svg) hoặc bản lưu > 3 MB → 400 "PRODUCT_IMAGES_INVALID" (D84); ảnh đã có sẵn trong gallery được giữ nguyên
```
#### AC-6: Ảnh Halal cert tách riêng
```gherkin
GIVEN sản phẩm có halalCertImage
WHEN  đếm giới hạn gallery
THEN  ảnh Halal cert không tính vào 10 ảnh và không thể đặt làm ảnh chính
  AND Halal cert chỉ nhận ảnh; video/PDF → 400 "HALAL_CERT_IMAGE_ONLY" (D30)
```

### Additional Criteria
- [ ] Kéo thả có thay thế bằng bàn phím (NFR-07), thông báo vị trí mới qua `aria-live`.
- [ ] 375px: gallery dạng lưới 3 cột, kéo bằng tay cầm (handle) để không xung đột cuộn trang.
- [ ] Hằng số giới hạn đặt ở `src/lib/products/image-limit.ts` (một nguồn), dùng chung cho collection `maxRows` và UI.
- [ ] Chính sách ảnh khớp DAM Commerce OS (D84): picker chỉ cho chọn JPG/PNG/WebP có bản lưu ≤ 3 MB; ảnh tải lên lớn được pipeline tự hạ chất lượng/kích thước xuống ≤ 3 MB, không báo lỗi.

### Market Notes
- PW1 production: 37.480 SP live; 1 ảnh 20.270, 2 ảnh 5.393, 3 ảnh 7.841, 4 ảnh 2.470, 5 ảnh 755, 6–8 ảnh 503 (max 8) → 98,7% SP ≤ 5 ảnh; 10 ảnh đủ cho mọi SP PW1 và dư cho shop thời trang chụp nhiều góc.

### Definition of Done
- [ ] TC-F48-14-01..06 ↔ AC-1..6.
- [ ] FR-34 có Story Ref US-F48-14; PRD F08 cập nhật giới hạn 5 → 10.
- [x] PO đồng ý D11 (10 ảnh, 2026-11-10, D88).

---

## US-F48-15: Ảnh cho biến thể chọn từ gallery + storefront đổi ảnh theo biến thể
**Sprint S5** | **P1** | **M** | **Status:** Draft
### Story
```
As a   chủ shop thời trang bán áo nhiều màu
I want gắn mỗi biến thể với một ảnh có trong gallery sản phẩm
So that khi khách chọn màu "Merah", ảnh sản phẩm đổi sang đúng chiếc áo màu đỏ
```
### Acceptance Criteria
#### AC-1: Chọn ảnh cho biến thể
```gherkin
GIVEN sản phẩm có gallery 4 ảnh và 6 biến thể (Màu × Size)
WHEN  ở bảng biến thể, bấm ô ảnh của "Merah / M"
THEN  hiện lựa chọn chỉ gồm 4 ảnh trong gallery (không mở toàn bộ thư viện)
  AND chọn xong, ô hiển thị thumbnail; biến thể chưa chọn hiển thị "Dùng ảnh chính"
```
#### AC-2: Storefront đổi ảnh theo biến thể
```gherkin
GIVEN "Merah / M" có ảnh G2, "Biru / M" không có ảnh
WHEN  khách chọn Màu = Merah trên trang chi tiết
THEN  ảnh lớn chuyển sang G2 và thumbnail G2 được đánh dấu
WHEN  khách chọn Màu = Biru
THEN  ảnh lớn quay về ảnh chính, không vỡ ảnh, không nhảy layout
  AND đổi ảnh khi chọn chip biến thể, kể cả biến thể hết hàng (qua `onPreview`, D50)
```
#### AC-3: Chỉ nhận ảnh thuộc gallery của chính sản phẩm
```gherkin
GIVEN client gửi variants[].image là media không nằm trong gallery của sản phẩm, thuộc tenant khác, hoặc là video
WHEN  lưu sản phẩm
THEN  trả 400 "VARIANT_IMAGE_NOT_IN_GALLERY", dữ liệu không đổi
```
#### AC-4: Ảnh biến thể bị gỡ hoặc media bị xoá
```gherkin
GIVEN biến thể trỏ ảnh G2
WHEN  G2 bị gỡ khỏi gallery (US-F48-14 AC-4) hoặc owner "Vẫn xoá" media G2 (US-F48-11 AC-4)
THEN  variants[].image thành null (FK ON DELETE SET NULL), storefront hiển thị ảnh chính
  AND "Đang dùng ở" của G2 liệt kê cả biến thể trước khi xoá
```
#### AC-5: Không đổi hành vi sản phẩm không có biến thể
```gherkin
GIVEN sản phẩm không bật biến thể, hoặc có biến thể nhưng không biến thể nào có ảnh
WHEN  khách xem trang chi tiết
THEN  hành vi gallery giữ như trước F48
```
#### AC-6: Snapshot ảnh biến thể ở giỏ hàng, đơn hàng, email (D49)
```gherkin
GIVEN "Merah / M" có ảnh G2
WHEN  khách thêm "Merah / M" vào giỏ rồi đặt hàng
THEN  giỏ hàng hiển thị G2; `orders_items.image_url` lưu URL của G2 tại thời điểm đặt; email xác nhận đơn dùng G2
  AND biến thể không có ảnh → dùng ảnh chính; đổi/xoá G2 sau đó không đổi ảnh của đơn đã đặt
```

### Additional Criteria
- [ ] Ô chọn ảnh biến thể dùng được bằng bàn phím, có `aria-label` "Ảnh cho biến thể Merah / M".
- [ ] 375px: bảng biến thể cuộn ngang hoặc dạng thẻ; ô ảnh ≥ 44×44 px.
- [ ] Đổi ảnh trên storefront không tải lại trang; ảnh biến thể preload khi hover/focus lựa chọn.
- [ ] Không backfill ảnh SKU từ PW1.

### Market Notes
- PW1 production: 8.273/43.592 SKU (19%) có ảnh, thuộc 2.267 SP, ~1,08 ảnh/SKU (max 4) → 1 ảnh/biến thể đủ cho thực tế.
- Shop baju kurung/tudung thường có 5–10 màu × nhiều size; "gán 1 ảnh cho mọi biến thể cùng màu" nằm ngoài phạm vi F48 (D31), gán từng biến thể.

### Definition of Done
- [ ] TC-F48-15-01..06 ↔ AC-1..6; screenshot storefront chọn biến thể (desktop + 375px).
- [ ] FR-35 có Story Ref US-F48-15; cột `products_variants.image_id` (FK ON DELETE SET NULL) và `orders_items.image_url` có entry MIGRATIONS.
- [ ] PRD F08 bổ sung ảnh biến thể.

---

## US-F48-16: Ảnh danh mục
**Sprint S5** | **P2** | **S** | **Status:** ⏸ Hoãn (D88) — chờ cutover Commerce OS

> [!IMPORTANT]
> **⏸ Hoãn (D88, PO 2026-11-10):** chờ câu 9 overview §12 (ngày cutover Commerce OS). US-F48-16 không làm trong S5; nội dung dưới đây giữ nguyên để mở lại khi có câu trả lời.

> [!NOTE]
> **Lịch sử #1587:** field `categories.image` từng tồn tại và đã bị **xoá** ở #1587 (commit `02a6b024be`) với lý do "stored but never rendered" — có lưu nhưng storefront không hiển thị ở đâu. Story này chỉ khôi phục field khi đi kèm **một bề mặt hiển thị cụ thể** (D74): header của block `products-grid` khi khách lọc đúng 1 `categoryId`. PO phải xác nhận đảo quyết định trước khi làm; PRD F08 (dòng "Category Image Field: REMOVED") đã ghi chú tham chiếu story này.
### Story
```
As a   chủ shop
I want gắn một ảnh đại diện cho mỗi danh mục sản phẩm
So that khi khách lọc sản phẩm theo một danh mục, phần đầu danh sách có ảnh + tên + mô tả trực quan hơn
```
### Acceptance Criteria
#### AC-1: Chọn ảnh danh mục
```gherkin
GIVEN chủ shop hoặc staff có quyền `products` sửa danh mục "Kuih Raya"
WHEN  chọn ảnh qua picker (chỉ ảnh) và lưu
THEN  categories.image lưu FK tới media, preview hiện trong form
  AND gỡ ảnh chỉ gỡ tham chiếu, không xoá media
```
#### AC-2: Hiển thị storefront
```gherkin
GIVEN danh mục "Kuih Raya" có ảnh, tên và mô tả
WHEN  khách mở trang có block `products-grid` với URL lọc đúng 1 danh mục (`?categoryId=<id>`) (D74; không tạo block danh mục mới, D50)
THEN  phía trên lưới SP có header: ảnh (tỉ lệ 4:1 desktop, 2:1 mobile ≤ 640 px, next/image, khung cố định — CLS ≈ 0) + tên + mô tả danh mục theo locale
  AND alt = alt của media, nếu trống thì dùng tên danh mục theo locale
GIVEN danh mục không có ảnh
THEN  header chỉ có chữ (tên + mô tả), không có ô ảnh vỡ
GIVEN URL không lọc danh mục hoặc lọc ≥ 2 categoryId
THEN  không hiển thị header danh mục (giữ như hiện tại)
```
#### AC-3: Tenant isolation và loại file
```gherkin
GIVEN client gửi categories.image là media tenant khác hoặc video
WHEN  lưu
THEN  trả 400 "CATEGORY_IMAGE_INVALID", danh mục không đổi
```
#### AC-4: Liên kết với vòng đời media
```gherkin
GIVEN ảnh M đang là ảnh danh mục
WHEN  mở chi tiết M hoặc xoá M
THEN  "Đang dùng ở" liệt kê danh mục; owner "Vẫn xoá" → categories.image = null, header products-grid về dạng chỉ chữ
```

### Additional Criteria
- [ ] Form danh mục dùng được 375px và bàn phím; i18n en/ms cho nhãn "Ảnh danh mục" / "Imej kategori".

### Market Notes
- PW1: chỉ 267/50.927 danh mục (0,5%) có ảnh → P2, chỉ 1 bề mặt hiển thị (header products-grid khi lọc 1 danh mục, D74), không tạo block/trang danh mục mới.

### Definition of Done
- [ ] TC-F48-16-01..04 ↔ AC-1..4; screenshot header products-grid lọc 1 danh mục (có ảnh / không ảnh, desktop + 375px).
- [ ] **Hoãn (D88); khi mở lại cần PO xác nhận D74:** PO xác nhận đảo quyết định #1587 (field từng bị xoá vì "stored but never rendered"); không merge field nếu chưa có bề mặt hiển thị header products-grid trong cùng PR.
- [ ] FR-36 có Story Ref US-F48-16; cột `categories.image_id` (FK ON DELETE SET NULL) có entry MIGRATIONS.
