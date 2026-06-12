# User Stories: Webstore Template Migration — Storefront Blocks (F35)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md -->

> **Feature:** F35 — Migrate Webstore Template V1→V2 (CMS block-config scope)
> **Wave:** TBD | **Priority:** P1 | **Ref PRD:** [F35-template-block-cms.md](../prd/F35-template-block-cms.md)
> **Scope note:** Phần CMS admin-UX để Merchant tái tạo UI 9 template V1. KHÔNG bao ETL pipeline (xem PRD migration ở PR #1157). Nguồn: design spec [`docs/design/F35-template-block-design.md`](../design/F35-template-block-design.md).
> **File này:** blocks tầng storefront chung (Theme/Layout, Header, Footer, Banner, Rich Text). Blocks thương mại → file `F35-template-block-commerce-stories.md`.

---

## US-F35-01: Cấu hình Theme & Layout toàn site

**Wave TBD** | **P1** | **M** | **Status:** Draft

### Story

```
As a   Merchant
I want cấu hình màu sắc, typography, logo/favicon và bật/tắt nút cuộn-lên-đầu cho toàn site
So that storefront V2 giữ đúng nhận diện của template V1 mà tôi đang dùng
```

### Acceptance Criteria

#### AC-1: Áp theme màu + typography

```gherkin
GIVEN tôi mở Site Settings trên CMS
WHEN  tôi đặt Màu chính / Màu nền / Màu chữ tiêu đề / Màu chữ nền và cỡ+độ đậm cho từng cấp (H1..H6, đoạn văn) + font toàn site
THEN  storefront render đúng màu & typography đã đặt cho mọi trang của store
```

#### AC-2: Nhận diện store

```gherkin
GIVEN tôi upload Logo + Favicon, nhập tên/mô tả/hotline/email/social/địa chỉ, chọn quốc gia + tiền tệ
WHEN  lưu cấu hình
THEN  header/footer/storefront hiển thị đúng các thông tin này
```

#### AC-3: Toggle scroll-to-top

```gherkin
GIVEN template gốc của tôi không có nút cuộn-lên-đầu (vd fn103/fn104/pa101)
WHEN  tôi tắt toggle "Hiện nút cuộn-lên-đầu"
THEN  storefront không render nút đó; khi bật thì có
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Theme/typography map đúng từ V1 `theme.*`/`typography.*` (xem data map)

---

## US-F35-02: Cấu hình Header / Navigation

**Wave TBD** | **P1** | **M** | **Status:** Draft

### Story

```
As a   Merchant
I want dựng menu (kèm mega-menu có ảnh), bật/tắt icon Giỏ hàng & ô Tìm kiếm, bật/tắt Sticky header
So that thanh điều hướng V2 giống template V1 của tôi
```

### Acceptance Criteria

#### AC-1: Trình dựng menu + mega-menu

```gherkin
GIVEN tôi thêm mục menu trong Header block
WHEN  tôi thêm menu con (mega-menu) kèm ảnh tùy chọn + cỡ hiển thị cho từng link con
THEN  storefront render menu nhiều cấp đúng cấu trúc (ráp lại từ mảng items V1)
```

#### AC-2: Toggle Cart / Search

```gherkin
GIVEN template V1 của tôi ẩn ô tìm kiếm hoặc icon giỏ
WHEN  tôi tắt toggle "Hiện ô Tìm kiếm" hoặc "Hiện icon Giỏ hàng"
THEN  header storefront ẩn đúng thành phần tương ứng (map từ HeaderConfig.search_status/cart_status)
```

#### AC-3: Sticky header

```gherkin
GIVEN template gốc không ghim header (vd c102, f102)
WHEN  tôi tắt toggle "Sticky Header"
THEN  header cuộn theo trang; khi bật thì ghim lại khi cuộn
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Mega-menu items ráp đúng từ EAV `items.<i>.<field>` (V1)

---

## US-F35-03: Cấu hình Footer

**Wave TBD** | **P1** | **M** | **Status:** Draft

### Story

```
As a   Merchant
I want dựng footer nhiều cột với từng dòng chọn được kiểu (link nội bộ / link ngoài / link icon / chữ thường) và bật/tắt bản quyền
So that footer V2 phủ được mọi bố cục footer của 9 template V1
```

### Acceptance Criteria

#### AC-1: Cột + kiểu dòng

```gherkin
GIVEN tôi thêm cột footer và các dòng trong cột
WHEN  tôi chọn kiểu mỗi dòng = Link nội bộ / Link ngoài / Link kèm icon / Chữ thường
THEN  storefront render đúng kiểu (map FooterType 1/2/3/4)
  AND khi chọn "Link kèm icon" tôi thêm được danh sách icon (ảnh + link)
```

#### AC-2: Bản quyền

```gherkin
GIVEN tôi nhập nội dung bản quyền
WHEN  tôi bật/tắt toggle "Hiện dòng bản quyền"
THEN  storefront hiện/ẩn dòng copyright tương ứng
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Footer block phủ cả bố cục 4-cột-text lẫn 1-dòng-copyright+social (đã xác nhận flexible)

---

## US-F35-04: Cấu hình Banner block

**Wave TBD** | **P1** | **L** | **Status:** Draft

### Story

```
As a   Merchant
I want thêm nhiều slide banner với ảnh, tiêu đề/phụ đề/nút riêng từng slide (style ăn theo theme), kích thước và kiểu điều hướng
So that banner V2 tái hiện banner template V1 của tôi mà không phải chỉnh style thủ công từng slide
```

> **DEC-A (accept-loss):** Styling per-slide (đậm/nghiêng/cỡ/màu, nút thường+hover) KHÔNG cấu hình trên CMS — text/nút ăn theo Typography + Theme Global; storefront tự ẩn element nếu field trống.

### Acceptance Criteria

#### AC-1: Kích thước + tự chạy (mặc định Static)

```gherkin
GIVEN tôi tạo Banner block
WHEN  tôi chọn Kiểu hiển thị = Hero / Small và bật/tắt "Tự động chuyển slide"
THEN  storefront render đúng; nếu bật Tự động thì áp Thời gian chuyển slide
  AND nếu KHÔNG bật Tự động, banner ở trạng thái Static (đứng yên)
```

#### AC-2: Slide + nội dung từng phần (style theo theme)

```gherkin
GIVEN tôi thêm slide (ảnh, link, căn lề) — tối đa 5 slide
WHEN  tôi nhập Tiêu đề / Phụ đề / Nút (nhãn + link) cho slide đó
THEN  storefront render text & nút theo Typography + Theme Global của Site
  AND nếu tôi để trống Phụ đề hoặc Nút, storefront tự ẩn element đó (non-empty render)
```

#### AC-3: Điều hướng slider

```gherkin
GIVEN banner nhiều slide
WHEN  tôi chọn Điều hướng = Chấm tròn / Mũi tên / Cả hai
THEN  storefront hiển thị đúng kiểu điều hướng (fb101 arrows, c102 dots...)
```

### Additional Criteria

- [ ] Repeater giới hạn **tối đa 5 slide** (DEC-D4 — Dev tra DB V1 xem có store >5 slide không → truncate có thể mất slide)
- [ ] Styling per-slide V1 (bold/italic/size/color, button hover) = **accepted loss**, không build

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Slide ráp đúng từ EAV mảng phẳng V1 (`items.N`)

---

## US-F35-05: Cấu hình Rich Text block

**Wave TBD** | **P1** | **S** | **Status:** Draft

### Story

```
As a   Merchant
I want soạn nội dung định dạng tự do bằng trình soạn thảo
So that các khối nội dung tự viết của template V1 được giữ nguyên trên V2
```

### Acceptance Criteria

#### AC-1: Soạn thảo & render

```gherkin
GIVEN tôi mở Rich Text block
WHEN  tôi nhập nội dung (tiêu đề, đậm, list, ảnh, link) bằng WYSIWYG
THEN  storefront render đúng nội dung đã soạn
```

### Additional Criteria

- [ ] Nội dung HTML thô từ V1 convert sang định dạng editor V2 không mất format (cơ chế convert → Dev)

### Definition of Done

- [ ] 9-Point Checklist pass

---

<!-- Tiếp theo: blocks thương mại ở F35-template-block-commerce-stories.md (US-F35-06..10) -->
