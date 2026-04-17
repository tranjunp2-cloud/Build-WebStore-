# Design & Wireframes: Blog Management (F17)

> **Feature:** F17 — Blog Management
> **Ref PRD:** [F17-blog-management.md](../prd/F17-blog-management.md)
> **Link figma:** https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30963-11909&t=uZzasU8b0pQAt0lH-4
> **Link figma prototype:**


Tài liệu này cung cấp wireframe thô (ASCII / cấu trúc text) để minh họa cho các tính năng quản lý Blog và xuất bản nội dung của tính năng F17, phục vụ việc xây dựng UI/UX cho frontend.

---

## 1. Màn hình chính (Blog List Dashboard)

### 1.1 Desktop View (Màn hình lớn)

> **[Global CMS Constraint]:** Toàn bộ giao diện Blog Management được render bên trong khu vực `Main Content Area` (giữ nguyên Global Sidebar Navigation và Top Header).

```text
[ Global Sidebar Navigation ] | [ Global Top Header: Breadcrumbs, Store Selector, User Profile ]
                              |
[ Blogs ]                     | [ + Create Post ]
                              |
[ Search posts by title... ]  | [ Filter: All Status v ] [ Filter: Categories v ] [ Sort: Newest v ]
                              |
---------------------------------------------------------------------------------------------------
| [ ] | Thumbnail | Title                | Category      | Status      | Author     | Date        | Action      |
---------------------------------------------------------------------------------------------------
| [ ] | [ Image ] | Khuyến mãi mùa Hè... | Promotions    | [Published] | John Doe   | 24/05/2026  | [Edit][Del] |
| [ ] | [ Image ] | Top 5 sản phẩm...    | Tips & Tricks | [Published] | Jane Smith | 22/05/2026  | [Edit][Del] |
| [ ] | [ Image ] | Thông báo ra mắt...  | News          | [Draft]     | John Doe   | 20/05/2026  | [Edit][Del] |
| [ ] | [ Image ] | Bản nháp chưa có tên | Uncategorized | [Draft]     | John Doe   | 18/05/2026  | [Edit][Del] |
---------------------------------------------------------------------------------------------------
[ Bulk Actions: Delete, Publish, Unpublish ] (Hiện khi checkbox được chọn)
                                                     < Previous | 1 | 2 | 3 | Next >
```

### 1.2 Empty State (Dùng chung component với Products/Orders)

```text
                              |
                              |               [ (Illustration: Người cầm bút viết) ]
                              |
                              |                      Chưa có bài viết nào
                              |     Hãy tạo bài đăng đầu tiên để thu hút khách hàng đến cửa hàng.
                              |
                              |                       [ + Create First Post ]
                              |
```

### 1.3 Mobile View (Màn hình nhỏ)

```text
[ Hamburger Icon ] [ Logo ] [ Profile ]
---------------------------------------
Blogs                 [ + Create Post ]

[ Search by title...                  ]
[ Filter / Sort Options               ]
---------------------------------------
[ Image ]
Khuyến mãi mùa Hè cực hot!
Promotions | [Published] | 24/05/2026
[Edit] [Delete]
---------------------------------------
[ Image ]
Top 5 sản phẩm bán chạy nhất tháng
Tips & Tricks | [Draft] | 22/05/2026
[Edit] [Delete]
---------------------------------------
[ Load More ]
```

---

## 2. Màn hình Chi tiết (Blog Editor)

### 2.1 Desktop View

```text
[ < Back to Blogs ]
                              | [ Save Draft ] [ Publish / Unpublish Toggle ]
                              |
---------------------------------------------------------------------------------------------------
|                            Main Content (2/3 width)                     |      Settings (1/3 width)     |
---------------------------------------------------------------------------------------------------
| [ Bài viết: Khuyến mãi mùa Hè cực hot! ] (Input siêu lớn)               | [ Thumbnail ]                   |
| Slug: /khuyen-mai-mua-he-cuc-hot  [Edit]                                | [ Upload Image ]                |
|                                                                         | (Image preview here)            |
| ----------------------------------------------------------------------  |                                 |
| [ B ] [ I ] [ U ] [ Link ] [ Image/Video ] | [ ✨ Generate with AI ]    | [ Publish Info ]                |
| ----------------------------------------------------------------------  | Status: Published               |
|                                                                         | Author: John Doe                |
| Mùa hè này cửa hàng chúng tôi mang đến cho bạn chương trình siêu...     | Date: 24/05/2026                |
|                                                                         |                                 |
| - Ưu đãi giảm giá 50% tất cả các mặt hàng đồ bơi                        | [ Category ]                    |
| - Tặng kèm áo phông in logo giới hạn                                    | [ Promotions        v ]         |
|                                                                         | [ + Manage Categories ]         |
| Hãy nhanh chân đến cửa hàng ngay hôm nay!                               |                                 |
|                                                                         | [ SEO Metadata ]                |
|                                                                         | Meta Title:                     |
|                                                                         | [ Cửa hàng giảm giá mùa hè! ]   |
|                                                                         | Meta Description:               |
|                                                                         | [ Mô tả bài viết để hiển thị ]  |
|                                                                         |                                 |
|                                                                         | [ ✨ Tối ưu SEO bằng AI ]        |
---------------------------------------------------------------------------------------------------
```

### 2.2 Mobile View (On-the-go Blog Editor)

```text
[ < Back ]  [ Edit Blog ]  [ Save ]
---------------------------------------
Title:
[ Khuyến mãi mùa Hè cực hot!          ]
Slug: /khuyen-mai-mua-he-cuc-hot

Category: [ Promotions v ]

[ ✨ Generate with AI ]

Content:
[ Mùa hè này cửa hàng chúng tôi mang
  đến cho bạn chương trình siêu...
  - Ưu đãi giảm giá 50%...          ]

=======================================
[ B ] [ I ] [ U ] [ Link ] [ List ]   (Sticky Toolbar ngay sát bàn phím)
=======================================
[      Khung Bàn Phím Ảo (Keyboard)   ]
[                                     ]
```

---

## 3. AI Generative Assistant (Modals & Drawers)

### 3.1 Giao diện tạo nội dung (Desktop Modal)

Khi nhấn vào nút `[ ✨ Generate with AI ]`:

```text
+-------------------------------------------------------------+
| ✨ Lên ý tưởng bài viết với AI                        [ X ] |
|-------------------------------------------------------------|
| Bạn muốn viết về chủ đề gì?                                 |
| [ Ví dụ: Viết một bài ngắn giới thiệu áo phông mới...     ] |
|                                                             |
| Tone giọng (Optional):                                      |
| ( ) Trang trọng   (x) Gần gũi   ( ) Thuyết phục             |
|                                                             |
|                                     [ Hủy ] [ Generate ]    |
|-------------------------------------------------------------|
| Result:                                                     |
| [ Đây là một bản nháp tuyệt vời được tạo bởi AI...          |
|   ... (Text preview) ...                                    |
|   ...                                                     ] |
|                                                             |
| [ Regenerate ]                             [ Insert Text ]  |
+-------------------------------------------------------------+
```

### 3.2 Giao diện gợi ý chỉnh sửa text (Select text context menu)

Khi bôi đen một đoạn text trong Editor, sẽ hiện một Popup nhỏ (Tooltip Toolbars) phía trên vị trí bôi đen:

```text
[ B ] [ I ] [ U ] | [ ✨ Improve ] [ ✂️ Make Shorter ] [ 📝 Rewrite ]
```

### 3.3 Giao diện AI trên Mobile (Bottom Sheet)

```text
+---------------------------------------+
|                                       |
|                                       |
|=======================================|
| [ - ] (Swipe to close)                |
| ✨ AI Writer                          |
|                                       |
| Nhập chủ đề:                          |
| [ Viết bài sale cuối tuần...        ] |
|                                       |
| [ Generate ] (Nút full-width)         |
|                                       |
| Kết quả:                              |
| [ Văn bản AI sinh ra... ]             |
|                                       |
| [ Insert ]  [ Regenerate ]            |
|=======================================|
```

---

## 4. Quản lý Danh mục (Category Management Modal)

Khi người dùng nhấn `[ + Manage Categories ]` trong khu vực Settings bên Sidebar của màn hình chỉnh sửa hoặc từ Navigation Settings.

```text
+-------------------------------------------------------------+
| Quản lý Danh mục (Categories)                         [ X ] |
|-------------------------------------------------------------|
| [+ Thêm danh mục mới]                                       |
|                                                             |
| 1. Promotions                         [ Edit ] [ Delete ]   |
| 2. Tips & Tricks                      [ Edit ] [ Delete ]   |
| 3. News                               [ Edit ] [ Delete ]   |
| ---------------------------------------------------------   |
|                                                             |
| [ Thêm danh mục mới (Input xuất hiện khi nhấn +) ]          |
| Tên danh mục: [ Product Reviews               ] [ Save ]    |
|                                                             |
+-------------------------------------------------------------+
```

---

## 5. Màn hình Public Blog (Storefront)

Phần giao diện hiển thị ra public dành cho khách ghé thăm cửa hàng (End-user).

### 5.1 Public Blog List - Máy tính (Desktop view)

```text
[ Header của Storefront: Logo, Navigation, Cart, Profile... ]
---------------------------------------------------------------------
[ < Home / Blogs (Breadcrumbs) ]

============================ TIN TỨC & BÀI VIẾT =====================

[ Danh mục:   [X] Tất cả    [ ] Promotions    [ ] Tips & Tricks ]

+------------------------+  +------------------------+  +------------------------+
| [ Image Thumbnail ]    |  | [ Image Thumbnail ]    |  | [ Image Thumbnail ]    |
|                        |  |                        |  |                        |
| CATEGORY TAG           |  | CATEGORY TAG           |  | CATEGORY TAG           |
| Khuyến mãi cực sốc     |  | 5 Mẹo chọn đồ thể thao |  | Mẫu mới vừa về!        |
| 24/05/2026             |  | 22/05/2026             |  | 20/05/2026             |
| Mô tả ngắn gọn của...  |  | Mô tả ngắn gọn của...  |  | Mô tả ngắn gọn của...  |
| [ Read more -> ]       |  | [ Read more -> ]       |  | [ Read more -> ]       |
+------------------------+  +------------------------+  +------------------------+

+------------------------+  +------------------------+  +------------------------+
| ...                    |  | ...                    |  | ...                    |
+------------------------+  +------------------------+  +------------------------+

                             < Previous | 1 | 2 | 3 | Next >

---------------------------------------------------------------------
[ Footer của Storefront... ]
```

*(Phiên bản Mobile sẽ chuyển Grid thành danh sách dọc 1 cột).*

### 5.2 Public Blog Detail - Máy tính (Desktop view)

```text
[ Header của Storefront: Logo, Navigation, Cart, Profile... ]
---------------------------------------------------------------------
                             [ < Quay lại danh sách ]

                          CATEGORY TAG (Ví dụ: Promotions)
                     KHUYẾN MÃI MÙA HÈ CỰC HOT TẠI CỬA HÀNG!
                             Ngày xuất bản: 24/05/2026

             +---------------------------------------------------+
             |                                                   |
             |           (Hero Image / Thumbnail siêu lớn)       |
             |                                                   |
             +---------------------------------------------------+

             Mùa hè này cửa hàng chúng tôi mang đến cho bạn chương
             trình siêu ưu đãi lớn nhất trong năm!

             - Ưu đãi giảm giá 50% tất cả các mặt hàng đồ bơi
             - Tặng kèm áo phông in logo giới hạn cho đơn từ 500k

             (Hình ảnh trong bài viết)
             +---------------------------------------------------+
             | [ Ảnh chi tiết ]                                  |
             +---------------------------------------------------+

             Hãy nhanh chân đến cửa hàng ngay hôm nay để không bỏ 
             lỡ cơ hội này.

             [ Nút chia sẻ: Facebook ] [ Twitter ] [ Copy Link ]

---------------------------------------------------------------------
[ Footer của Storefront... ]
```

*(Phiên bản Mobile sẽ tối ưu padding và full-width cho hình ảnh, cỡ chữ dễ đọc phù hợp kích thước màn hình).*

---

### Các trạng thái cảnh báo / Toast Notification
- Xóa bài viết (Delete Confirmation): *Popup cảnh báo việc xóa không thể hoàn tác.*
- Chuyển Publish sang Draft (Unpublish Confirmation): *Popup cảnh báo bài viết sẽ biến mất khỏi cửa hàng.*
- Thay đổi thành công (Toasts màu xanh): *"Đã xuất bản bài viết thành công", "Đã lưu bản nháp".*
- Thay đổi thất bại (Toasts màu đỏ): *"Chưa có tiêu đề, vui lòng nhập tiêu đề bài viết".*
- AI Error (Toasts màu cam / đỏ): *"Không thể tạo ảnh. Trợ lý AI hiện tại chỉ hỗ trợ viết văn bản."*
