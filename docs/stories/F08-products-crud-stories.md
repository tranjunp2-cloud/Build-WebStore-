# User Stories: Products CRUD (F08)

> **Feature:** F08 — Products CRUD (Dashboard)
> **Wave:** 4 | **Priority:** P0 | **Ref PRD:** [F08-products-crud.md](../prd/F08-products-crud.md)

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## US-F08-01: Products CRUD + Trạng thái Sản phẩm (Active/Draft)

**Wave 4** | **P0** | **L** | **Status:** Ready

### Story

```
As a   site owner
I want thêm, sửa, xóa sản phẩm và để AI viết description
So that sản phẩm có mô tả đẹp mà không mất thời gian tự viết
```

### Acceptance Criteria

#### AC-1: Happy Path — Mở Form Thêm Sản Phẩm

```gherkin
GIVEN user ở /products
WHEN  click "Thêm sản phẩm"
THEN  form hiện: tên, giá thực bán (Price), giá khuyến mãi (Compare at Price), category, thông số đóng gói (Cân nặng, DxCxh), mô tả, ảnh (max 5, chuẩn <=5MB), tồn kho (Stock) và SKU.
```

#### AC-1.1: View Product List Empty State (Shared Component)

```gherkin
GIVEN user ở /products
  AND chưa có sản phẩm nào
WHEN  xem danh sách sản phẩm
THEN  hiển thị shared "No Data" Empty State component
  AND có illustration, câu thông báo "Chưa có sản phẩm nào", và nút "Tạo Sản Phẩm"
```

#### AC-1.5: Validation Bắt Buộc Khi Lưu

```gherkin
GIVEN user đang điền form Tạo Sản Phẩm mới
WHEN  bấm "Save" nhưng bỏ trống một trong các trường: Tên, Mô tả, Category, Giá bán, Stock, hoặc SKU
THEN  hệ thống chặn lưu
  AND highlight khung đỏ quanh các trường bị thiếu kèm text báo lỗi "Vui lòng nhập thông tin".
```

#### AC-1.6: Lưu Sản Phẩm Mới (Draft by Default)

```gherkin
GIVEN user đang điền form Tạo Sản Phẩm mới
WHEN  điền hợp lệ các field bắt buộc và click "Save"
THEN  sản phẩm được tạo thành công vào Database
  AND trạng thái mặc định của sản phẩm mới là **"📝 Draft"** (Bản Nháp)
  AND có toast thông báo "Đã lưu nháp. Hãy chuyển sang Active để hiển thị trên web."
```

#### AC-2: AI Description Generation

```gherkin
GIVEN user điền tên sản phẩm
WHEN  click "✨ AI Viết Description"
THEN  AI generate description dựa trên tên + ngành
  AND user có thể Accept hoặc chỉnh sửa trước khi save
```

#### AC-3: Delete Product — Soft Delete

```gherkin
GIVEN user click Delete trên sản phẩm
WHEN  confirm xóa
THEN  soft delete (deletedAt set)
  AND toast "Đã xóa. Hoàn tác?" 5s
```

### Market Notes

- Price format: `RM XX.XX`
- Support Halal cert upload per product (P2)
- Category suggestions include MY-specific types (Baju Kurung, Kuih, etc.)

#### AC-4: Filter, Sort và Cảnh Báo Kho (Low Stock/Out of Stock)
```gherkin
GIVEN user đang xem danh sách sản phẩm trên Dashboard
WHEN  nhìn vào cột Stock
THEN  nếu Stock = 0, hiển thị icon 🔴 "Hết hàng" nổi bật.
  AND có thanh Search tìm nhanh theo Tên hoặc SKU.
  AND user có thể dùng bộ lọc "Sort by: Giá, Tên, Cũ/Mới, Số lượng kho"
  AND user có thể tick filter "Lọc Khuyến mãi (Đang Sale)" hoặc "Lọc Hết hàng" để gom nhanh nhóm cần xử lý.
```

#### AC-5: Behavior khi Stock = 0 (Bảo vệ UX Khách Hàng)
```gherkin
GIVEN sản phẩm X có tồn kho (Stock) hiện tại là 0
WHEN  khách hàng truy cập trang F09 Storefront (PLP / PDP)
THEN  sản phẩm VẪN HIỂN THỊ (không bị ẩn/xóa để giữ Link SEO cho Google)
  AND ảnh sản phẩm có thể bị làm mờ (Grayscale) hoặc gắn tem [Hết Hàng]
  AND nút "Thêm Vào Giỏ Hàng" bị vô hiệu hóa (disabled).
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Product xuất hiện trên storefront sau khi create (nếu Active)
- [ ] AI description hoạt động đúng với cả BM và EN
- [ ] Tính năng Soft Delete hiển thị Toast Undo trong vòng 5 giây hoàn tác.
- [ ] Form chặn API Submit khi validation UI fail (Thiếu Required Fields).
- [ ] Có UI gạch ngang (Strikethrough) cho thẻ Compare At Price khi hiển thị ngoài PLP/PDP F09.

---

## US-F08-02: Quản lý Biến thể (Variants) & SKU Tồn kho

**Wave 4** | **P0** | **XL** | **Status:** Ready

### Story

```
As a   site owner / merchant
I want tạo phân loại hàng hóa (tối đa 2 tầng, ví dụ Màu sắc và Kích cỡ) và quản lý tồn kho theo từng mã SKU riêng biệt
So that khách hàng có thể chọn đúng mẫu mã mong muốn, và hệ thống tự động trừ kho/đồng bộ đơn một cách chính xác.
```

### Acceptance Criteria

#### AC-1: Bật Phân loại Sản phẩm (Create Variants)
```gherkin
GIVEN user đang ở trang Tạo Sản Phẩm
WHEN  gạt cờ "Sản phẩm có cấu hình Variants (Phân loại)"
THEN  giao diện thêm/ẩn mục Giá và Tồn kho mặc định (Default Price/Stock) chung
  AND hiển thị box cấu hình Tầng 1 (Level 1 Tier) yêu cầu Nhập Tên Phân Loại (VD: Màu sắc) và các Giá trị (Option: Đỏ, Xanh).
```

#### AC-2: Ma trận SKU (Two-Tier Matrix Generator)
```gherkin
GIVEN user đã điền Level 1 (VD: Màu sắc: Trắng, Đen)
WHEN  user click "Thêm phân nhóm nhỏ hơn (Level 2)" và điền Level 2 (VD: Kích cỡ: M, L)
THEN  một bảng (Matrix) tự động sinh ra hiển thị 4 dòng liên đới: "Trắng - M", "Trắng - L", "Đen - M", "Đen - L".
  AND ở mỗi dòng con hiển thị các ô Input trống để nhập: [SKU Hàng hoá], [Giá Bán], [Tồn kho hiện tại].
```

#### AC-3: Quản lý Out-Of-Stock cho riêng từng SKU
```gherkin
GIVEN một sản phẩm có nhiều cấu hình (Variants) đang được mở bán ngoài Storefront
WHEN  có khách hàng mua hết số lượng "Trắng - M" (Stock = 0)
THEN  nút ấn mua tùy chọn "Trắng - M" bị disable (chìm đi) hiển thị Hết hàng (Out of Stock).
  AND tùy chọn "Trắng - L" (vẫn còn Stock) vẫn click mua hình thường.
```

### Definition of Done
- [ ] Giao diện (UX) mượt mà cho việc thêm/bớt option, bảng matrix tự động tính toán sinh ra đủ tổ hợp.
- [ ] Có validation bắt buộc nhập Price cho mỗi dòng Variant nếu đã chọn.
- [ ] Schema Backend có hỗ trợ mảng Variants liên kết 1-nhiều với Product gốc, mỗi Variant có id riêng biệt.

---

## US-F08-03: Tự động Tối ưu Tìm kiếm (AI SEO Generation)

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want AI tự động trích xuất thông tin Sản Phẩm (Tên, ngành hàng) ra thành các đoạn Description, Tiêu đề SEO, Slug
So that tôi tối ưu SEO dễ dàng và chuyên nghiệp, nhưng không cần phải học kĩ thuật hay viết tay mất thời gian.
```

### Acceptance Criteria

#### AC-1: AI Tự động sinh Thông Tin SEO
```gherkin
GIVEN user đã điền "Tên sản phẩm" (VD: Váy công sở nữ mùa hè)
WHEN  user cuộn xuống mục SEO và click "✨ Tối ưu Tìm Kiếm Tự Động"
THEN  hệ thống chờ 1 chút (trạng thái Loading)
  AND tự động đổ Data trả về điền đầy vào các ô Input:
      - [Meta Title SEO]: "Váy công sở nữ mùa hè - Kiểu dáng Hàn Quốc hiện đại | (Tên Store)"
      - [Meta Description]: "Mua ngay Váy công sở nữ..." (khoảng 150 ký tự)
      - [Friendly URL Slug]: "vay-cong-so-nu-mua-he"
```

#### AC-2: Tùy biến chỉnh sửa thủ công
```gherkin
GIVEN đoạn Meta Description đã được AI điền tự động
WHEN  user click vào input và gõ thay thế 1 đoạn nhỏ
THEN  nội dung mới được ghi đè và lưu lại khi người dùng ấn "Save Product"
  AND nội dung thủ công sẽ không bị reset trừ khi user ấn lại nút "✨ Tối ưu Tìm Kiếm Tự Động".
```

### Definition of Done
- [ ] Endpoint gán với AI GPT Prompting (`/api/ai/seo-generate`) trả payload JSON hợp lệ (Title, Description, Slug).
- [ ] Text đầu ra của Search Engine Optimization Meta Title không quá 70 characters, Description xoay quanh 150 - 160 characters.

---

## US-F08-04: Tạo sản phẩm Hàng Loạt (Bulk Create) bằng AI & Hình ảnh mặc định

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want paste/gõ một danh sách các sản phẩm (mỗi cái 1 dòng hoặc 1 câu) vào AI Chat
So that AI bóc tách toàn bộ thành một bảng danh sách (Preview Grid), cho phép tôi tick chọn và tạo nhanh hàng loạt sản phẩm ở trạng thái Nháp mà không cần điền Form từng cái một.
```

### Acceptance Criteria

#### AC-1: AI bóc tách danh sách tạo Preview Grid
```gherkin
GIVEN user đang ở thanh chat tạo Product trên Dashboard
WHEN  user nhập: "Tạo 2 món: Móc khóa vô tri Capybara màu nâu 45k, Dép tổ ong xanh đỏ 20k" và Enter
THEN  AI phân tích NLP và trả về giao diện một Bảng Data Grid (Preview):
      | [x] | Móc khóa vô tri Capybara | 45000 | Màu: Nâu      | Draft |
      | [x] | Dép tổ ong               | 20000 | Màu: Xanh, Đỏ | Draft |
  AND user có thể sửa nhanh Tên hoặc Giá trực tiếp trên các ô của bảng này
  AND hình ảnh (Images) bị TRỐNG (Mặc định sẽ là hình Thùng carton khi lưu).
```

#### AC-2: Xác nhận Lưu hàng loạt
```gherkin
GIVEN user đang xem Bảng Data Grid do AI trả về
WHEN  user click "Lưu 2 Sản Phẩm"
THEN  hệ thống ghi nhận 2 sản phẩm vào Database
  AND cả 2 sản phẩm đều mang trạng thái "📝 Draft" (Chưa bán)
  AND đóng bảng Grid, hiện báo cáo "Đã tạo 2 sản phẩm nháp. Vui lòng thêm hình ảnh trước khi mở bán."
```

#### AC-3: Hiển thị Thùng Carton Mặc Định (Fallback Image)
```gherkin
GIVEN một sản phẩm (tạo tay hay tạo hàng loạt lằng AI) mà user chưa tải lên hình ảnh nào
WHEN  xuất hiện trên Table báo cáo Dashboard / Mở xem trang chi tiết
THEN  hiển thị hình ảnh Placeholder mặc định là "📦 Thùng Hàng Carton Dễ Thương" (Cute Crate Box).
```

### Definition of Done
- [ ] Layout Dashboard hiển thị khung AI Chat Prompt phía trên hoặc lồng trong modal Add Product.
- [ ] Parser AI phải phân tích được cơ chế 2-Tier Variant nếu user nhắc tới >2 biến số (Ví dụ Màu - Size).
- [ ] Ảnh "Thùng hàng carton" phải được render đồng nhất qua 1 UI component chung (`<ProductImageFallback />`) để dễ thay đổi asset sau này.

---

## US-F08-05: Quản lý Danh mục Phân cấp (Category 3-Level)

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want tạo và quản lý thư mục sản phẩm phân cấp tối đa 3 tầng (Cha - Con - Cháu)
So that tôi có thể tổ chức sơ đồ sản phẩm gọn gàng, khách hàng vào Storefront tìm kiếm dễ dàng qua Menu và Bộ Lọc.
```

### Acceptance Criteria

#### AC-1: Tạo cây danh mục tối đa 3 Level
```gherkin
GIVEN user đang ở trang Quản lý Danh mục (`/products/categories`)
WHEN  user click "Thêm Mới"
THEN  form yêu cầu nhập Tên Danh mục (Name), Slug, Ảnh đại diện (nếu có)
  AND có một dropdown "Chọn Danh mục Cha" (Parent Category).
WHEN  user chọn "Thời Trang" (Level 1) làm cha
THEN  danh mục mới trở thành Level 2 "Nam".
WHEN  Level 2 "Nam" làm cha, tạo "Áo Sơ Mi"
THEN  hệ thống chấp nhận "Áo Sơ Mi" là Level 3. 
  AND nếu cố lấy Level 3 "Áo Sơ Mi" làm cha, hệ thống cảnh báo "Chỉ hỗ trợ tối đa 3 cấp độ danh mục".
```

#### AC-2: Gán danh mục cho Sản phẩm
```gherkin
GIVEN user đang ở trang Thêm/Sửa Sản Phẩm
WHEN  user mở phần Tổ chức (Organization)
THEN  có dropdown Tree-select hiển thị cây danh mục
  AND user có thể tick chọn 1 hoặc nhiều danh mục giao nhau cho sản phẩm đó.
```

### Definition of Done
- [ ] Dùng `Nested Set Model` hoặc trường `parentId` trong Payload CMS để query được cây (Tree) ra Frontend (Storefront Category Menu).

---

## US-F08-06: Thuộc tính Mở rộng (Attributes) & Giao diện Storefront

**Wave 4** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want thêm các thuộc tính tuỳ biến tự do cho mỗi sản phẩm (Thương hiệu, Chất liệu, Xuất xứ)
So that trang chi tiết sản phẩm cung cấp đủ thông tin hữu ích cho khách mua, đồng thời Googlebot có thể trích xuất làm Rich Snippets (SEO).
```

### Acceptance Criteria

#### AC-1: Thêm/Xóa Đặc tính Sản phẩm (Dynamic Attributes)
```gherkin
GIVEN user đang ở trang Tạo Sản Phẩm (Form Edit)
WHEN  kéo xuống khu vực "Thông tin Mở rộng (Attributes)"
THEN  có nút "+ Thêm thông tin"
WHEN  bấm thêm, hệ thống hiện 2 input box: [ Tên thuộc tính ] : [ Giá trị ]
  AND user có thể nhập ví dụ -> [ Chất liệu ] : [ Vải Cotton 100% ]
  AND [ Xuất xứ ] : [ Việt Nam ]
  AND user có thể xóa dòng nào không cần thiết.
```

#### AC-2: Hiển thị ngoài Storefront Product Detail Page (PDP)
```gherkin
GIVEN khách hàng đang xem chi tiết sản phẩm ngoài Frontend (PDP)
WHEN  kéo xuống qua khối Chọn mua (Add to Cart)
THEN  các Attributes (Thuộc tính) đã nhập xuất hiện thành Grid hoặc Table dạng: 
      | Thương hiệu | OEM |
      | Chất liệu   | Gốm sứ |
  AND thông tin này bọc trong logic `JSON-LD Schema` Product để SEO.
```

### Definition of Done
- [ ] Bản thiết kế Storefront Layout (PLP & PDP) đã được mô tả tại PRD.

---

## US-F08-07: Mobile Web UX — Product Management on Small Screens

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   mobile user (Store Owner)
I want the complex product list and variant forms to be optimized for my small screen
So that I can quickly check inventory or update prices while away from my computer
```

### Acceptance Criteria

#### AC-1: List to Cards Transformation

```gherkin
GIVEN the user is on the /products view on a mobile device (< 768px)
WHEN  the product list renders
THEN  it does NOT use a scrollable horizontal table
  AND instead renders each product as a stacked Card (Thumbnail left, Details right)
  AND Low Stock/Out of Stock alerts are displayed as a prominent red badge on the card
```

#### AC-2: Variant Matrix Accordion

```gherkin
GIVEN the user is adding/editing variants on mobile
WHEN  the SKU matrix is generated
THEN  the wide matrix table is transformed into a vertical Accordion list
  AND each accordion item represents one SKU combination (e.g., "Red - M")
  AND tapping the item reveals the Price, SKU, and Stock inputs vertically stacked
```

### Definition of Done

- [ ] 9-Point Checklist pass.
- [ ] Ensure that deeply nested inputs (like 3-level categories or variant inputs) do not cause horizontal scrolling on 320px screens.
