# User Stories: Webstore Template Migration — Commerce Blocks (F35)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md -->

> **Feature:** F35 — Migrate Webstore Template V1→V2 (CMS block-config scope)
> **Wave:** TBD | **Priority:** P1 | **Ref PRD:** [F35-template-block-cms.md](../prd/F35-template-block-cms.md)
> **File này:** blocks thương mại (Product Listing, Category Listing, Article, Shortlist, Cart & Product Detail). Blocks storefront chung → file `F35-template-block-storefront-stories.md` (US-F35-01..05).

---

## US-F35-06: Cấu hình Product Listing block (gồm Filter & Sort)

**Wave TBD** | **P1** | **L** | **Status:** Draft

### Story

```
As a   Merchant
I want chọn nguồn sản phẩm, số sản phẩm/trang, bật/tắt bộ lọc & sắp xếp, chọn kiểu CTA card và kiểu phân trang ngay trong cấu hình block
So that tôi quyết định được cách trang sản phẩm hiển thị và cho khách lọc/sắp xếp hay không
```

### Acceptance Criteria

#### AC-1: Nguồn sản phẩm

```gherkin
GIVEN tôi tạo Product Listing block
WHEN  tôi chọn Nguồn = Tất cả / Tự chọn / Ngẫu nhiên
THEN  nếu Tự chọn, tôi pick được danh sách sản phẩm cụ thể (map list_type all/fixed/random)
  AND tôi đặt được Số sản phẩm/trang
```

#### AC-2: Bật/tắt Filter & Sort (filterConfig)

```gherkin
GIVEN tôi mở nhóm "Bộ lọc & Sắp xếp" trong block
WHEN  tôi bật/tắt từng toggle: Sắp xếp, Lọc Thương hiệu, Lọc Danh mục, Lọc Giá, Lọc Biến thể
THEN  storefront hiện/ẩn đúng các bộ lọc/sắp xếp tương ứng cho khách
```

#### AC-3: Kiểu CTA card + Quick View (conditional)

```gherkin
GIVEN tôi cấu hình Kiểu CTA trên card = Thêm vào giỏ / Chỉ Xem chi tiết / Thêm giỏ + Quick View
WHEN  tôi chọn option CÓ Quick View
THEN  toggle "Bật Quick View" mới hiện ra để bật/tắt
  AND khi chọn "Chỉ Xem chi tiết", toggle Quick View bị ẩn/disable (không cấu hình mâu thuẫn)
```

#### AC-4: Grid/List + phân trang

```gherkin
GIVEN tôi cấu hình block
WHEN  tôi bật "Cho khách đổi Grid/List" và chọn Kiểu phân trang = Tải thêm / Số trang
THEN  storefront cho phép đổi lưới↔danh sách (nếu bật) và phân trang đúng kiểu đã chọn
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Conditional Quick View dùng `admin.condition` (Dev)

---

## US-F35-07: Cấu hình Category Listing block

**Wave TBD** | **P1** | **M** | **Status:** Draft

### Story

```
As a   Merchant
I want chọn danh mục hiển thị, hiệu ứng và kiểu hiển thị (lưới/băng chuyền)
So that khối danh mục V2 giống template V1 của tôi
```

### Acceptance Criteria

#### AC-1: Danh mục + hiệu ứng

```gherkin
GIVEN tôi tạo Category Listing block
WHEN  tôi nhập tiêu đề, chọn danh mục hiển thị và Hiệu ứng = Thủ công / Tự chạy / Tĩnh
THEN  storefront render đúng (map CategoryAnimation manual/auto/static); nếu Tự chạy thì áp Thời gian
```

#### AC-2: Kiểu hiển thị Grid/Carousel

```gherkin
GIVEN tôi cấu hình block
WHEN  tôi chọn Kiểu hiển thị = Lưới (Grid) / Băng chuyền (Carousel)
THEN  storefront đổi cách hiển thị + số phần tử/luồng vuốt tương ứng (feature behavior, không chỉ CSS)
```

### Definition of Done

- [ ] 9-Point Checklist pass

---

## US-F35-08: Cấu hình Article (Blog) Listing & Detail

**Wave TBD** | **P1** | **L** | **Status:** Draft

### Story

```
As a   Merchant
I want cấu hình layout danh sách bài, nguồn bài, phân trang và bật/tắt các thành phần (excerpt, đọc thêm, badge, bài liên quan, tags)
So that trang blog V2 tái hiện đúng template V1 của tôi
```

### Acceptance Criteria

#### AC-1: Listing layout + nguồn

```gherkin
GIVEN tôi tạo Article Listing block
WHEN  tôi chọn Layout = Lưới / Danh sách, Nguồn = Tất cả / Tự chọn / Ngẫu nhiên, đặt Số bài/trang và Kiểu phân trang
THEN  storefront render đúng (đổi layout đổi per_page + luồng hiển thị)
```

#### AC-2: Toggle thành phần card

```gherkin
GIVEN danh sách bài viết
WHEN  tôi bật/tắt: Hiện tóm tắt (excerpt), Hiện nút "Đọc thêm", Hiện category badge
THEN  card bài viết hiện/ẩn đúng thành phần (vd c101 ẩn excerpt, c101/fn102 ẩn "Đọc thêm")
```

#### AC-3: Article Detail

```gherkin
GIVEN tôi cấu hình trang chi tiết bài
WHEN  tôi bật "Hiện bài viết liên quan" + đặt Số lượng, và bật/tắt "Hiện tags"
THEN  trang chi tiết hiện/ẩn đúng khối liên quan & tags
```

### Definition of Done

- [ ] 9-Point Checklist pass

---

## US-F35-09: Cấu hình Shortlist / Featured block

**Wave TBD** | **P1** | **M** | **Status:** Draft

### Story

```
As a   Merchant
I want tạo khối nổi bật và chọn từng mục là Sản phẩm / Danh mục / Thương hiệu / Bài viết / Danh mục blog
So that tôi tự dựng được các khối "nổi bật" như template V1
```

### Acceptance Criteria

#### AC-1: Khối nổi bật đa hình

```gherkin
GIVEN tôi tạo Shortlist block
WHEN  tôi nhập tiêu đề + nhãn nút CTA và thêm các mục, mỗi mục pick 1 entity (Sản phẩm/Danh mục/Thương hiệu/Bài viết/Danh mục blog)
THEN  storefront render đúng các mục đã chọn (map từ ShortList polymorphic model_type, 5 loại)
```

### Additional Criteria

- [ ] "Danh mục blog" (loại thứ 5) map vào collection Payload nào — Dev xác nhận lúc Load

### Definition of Done

- [ ] 9-Point Checklist pass

---

## US-F35-10: Cấu hình hiển thị Cart & Product Detail

**Wave TBD** | **P1** | **M** | **Status:** Draft

### Story

```
As a   Merchant
I want bật/tắt các thành phần hiển thị ở Giỏ hàng và trang Chi tiết sản phẩm
So that hai trang này khớp với template V1 (vì các template ẩn/hiện khác nhau)
```

### Acceptance Criteria

#### AC-1: Cart

```gherkin
GIVEN tôi cấu hình Cart block
WHEN  tôi bật/tắt "Hiện nút Xóa tất cả" và "Hiện tồn kho khả dụng"
THEN  giỏ hàng hiện/ẩn đúng (vd chỉ fn102 có nút Xóa tất cả)
```

#### AC-2: Product Detail

```gherkin
GIVEN tôi cấu hình trang chi tiết SP
WHEN  tôi bật/tắt: Hiện mã SKU, Hiện link Danh mục, Hiện badge % giảm, Hiện tồn kho, Bật Quick View
THEN  trang chi tiết hiện/ẩn đúng từng thành phần theo template gốc
```

### Definition of Done

- [ ] 9-Point Checklist pass

---

<!-- Storefront blocks: F35-template-block-storefront-stories.md (US-F35-01..05) -->
