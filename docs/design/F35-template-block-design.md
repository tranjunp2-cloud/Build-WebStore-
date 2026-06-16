# F35 — Webstore Template Block: Design Spec (Admin UX)

> **Góc nhìn:** Product/UX Designer thiết kế **trải nghiệm nhập liệu** của CMS mới (Payload).
> **Câu hỏi duy nhất doc này trả lời:** *Mỗi Block trên V2 cần những nút bấm / ô nhập / cấu hình gì để Merchant dựng ra được UI của 9 template V1?*
> **Bộ tài liệu F35 (navigate 2 chiều):**
> - PRD (lean): [`docs/prd/F35-template-block-cms.md`](../prd/F35-template-block-cms.md)
> - Stories: [`storefront`](../stories/F35-template-block-storefront-stories.md) · [`commerce`](../stories/F35-template-block-commerce-stories.md)
> - Data map (Dev): [`v1-model-to-payload-map.md`](../../plans/260611-1131-migrate-template/research/v1-model-to-payload-map.md)
> - Migration pipeline PRD/architecture: PR #1157
>
> **KHÔNG nằm trong doc này (→ Dev):** data type (string/number/bool), luồng API v1/v2, format lưu trữ (HTML→Lexical), cơ chế map ID đa hình, các câu hỏi DB §9. Bản đồ dữ liệu kỹ thuật: xem data map ở trên (companion, dành Dev).
> **Quy ước control:** `[Toggle]` bật/tắt · `[Dropdown]` chọn 1 · `[Text]` ô chữ ngắn · `[WYSIWYG]` soạn thảo · `[Number]` số · `[Color]` bảng màu · `[Upload]` ảnh · `[Repeater]` danh sách lặp · `[Picker]` chọn entity có sẵn.

---

## A. Site / Theme settings (cấu hình 1 lần / store = "cái áo" 9 template)

| Nhóm | Control Merchant thấy | Tái tạo V1 |
|---|---|---|
| **Nhận diện** | Logo `[Upload]` · Favicon `[Upload]` · Tên store `[Text]` · Mô tả `[Text]` | CurrentStore logo/favicon/name/description |
| **Liên hệ** | Hotline `[Repeater Text]` · Social channel `[Repeater: tên + link]` · Địa chỉ `[Repeater Text]` · Email `[Text]` | hotline[] / social_channel / address[] / email |
| **Vùng bán** | Quốc gia `[Dropdown]` · Tiền tệ `[Dropdown]` | country / currency |
| **Màu sắc (Theme)** | Màu chính `[Color]` · Màu nền `[Color]` · Màu chữ tiêu đề `[Color]` · Màu chữ nền `[Color]` | theme.primary/background/header_text/background_text |
| **Typography** | Font chữ toàn site `[Dropdown]` · Mỗi cấp (H1…H6, đoạn văn): cỡ chữ `[Number]` + độ đậm `[Dropdown]` | typography.current_font + h1..paragraph font_size/weight |
| **Layout toàn site** | Hiện nút cuộn-lên-đầu (scroll-to-top) `[Toggle]` | ⊕ Diff 9-tpl: 5/9 có, 4/9 không → chuẩn hóa thành toggle |

---

## B. Header / Navigation block

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Trình dựng menu `[Repeater]` | Mỗi mục menu: nhãn + link. Mỗi mục có thể mở **menu con (mega-menu)** `[Repeater]` — link con kèm **ảnh tùy chọn** `[Upload]` + cỡ hiển thị `[Dropdown]` | Menu → SubMenu → items.N (mega-menu) |
| Hiện icon Giỏ hàng `[Toggle]` | Bật/tắt nút giỏ trên header | HeaderConfig.cart_status |
| Hiện ô Tìm kiếm `[Toggle]` | Bật/tắt search trên header | HeaderConfig.search_status |
| **Sticky Header** `[Toggle]` | Header ghim lại khi cuộn xuống | ⊕ Diff 9-tpl: c102/f102 không sticky, 7/9 còn lại sticky |

---

## C. Footer block

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Cột footer `[Repeater]` | Mỗi cột chứa danh sách dòng `[Repeater]` | ColumnFooter → FooterLine |
| Kiểu mỗi dòng `[Dropdown]` | 4 lựa chọn: **Link nội bộ** / **Link ngoài** / **Link kèm icon** / **Chữ thường** | FooterType 1/2/3/4 |
| (khi chọn "Link kèm icon") danh sách icon `[Repeater: ảnh + link]` | icon mạng xã hội / app store… | FooterLineSetting.items[] |
| Hiện dòng bản quyền `[Toggle]` + Nội dung bản quyền `[Text]` | | copyright_status / copyright_content |

---

## D. Banner block

> **🔧 DEC-A (2026-06-12 — accept-loss, đồng thuận BLOCKER):** Styling chi tiết per-slide (đậm/nghiêng/cỡ/màu, nút thường+hover) **KHÔNG migrate** — tốn build & là "ác mộng" CMS UX. Text/nút mỗi slide **ăn theo Typography + Theme Global** của Site. Storefront **tự ẩn element** (phụ đề/nút) nếu field bỏ trống (non-empty render). Bỏ luôn toggle show/hide per-slide.

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Kiểu hiển thị `[Dropdown]` | **Hero (to)** / **Small (nhỏ)** | BannerSize hero/small |
| Tự động chuyển slide `[Toggle]` | nếu bật → Thời gian chuyển `[Number] giây` | BannerAnimation auto/manual + timing_animation |
| Danh sách slide `[Repeater]` (tối đa 5) | Mỗi slide: Ảnh `[Upload]` · Link `[Text]` · Căn lề `[Dropdown: trái/giữa/phải]` | Banner[] image/url/alignment |
| — Tiêu đề slide `[Text]` (optional) | style **ăn Typography theme**; ẩn nếu để trống | Banner.header (chỉ text, bỏ styling) |
| — Phụ đề slide `[Text]` (optional) | style **ăn theme**; ẩn nếu để trống | Banner.subheader (chỉ text) |
| — Nút bấm (optional) | Nhãn `[Text]` + Link `[Text]`; style **ăn theme**; ẩn nếu để trống | Banner.button (chỉ text+url, bỏ màu thường/hover) |
| **Điều hướng slider** `[Dropdown]` | **Chấm tròn (dots)** / **Mũi tên (arrows)** / **Cả hai** | ⊕ Diff 9-tpl: fb101 chỉ arrows, c102 chỉ dots, còn lại cả hai |

> *Transformer (Dev):* V1 `show=false` → để trống field tương ứng; `display=false` → bỏ qua slide. Styling V1 (bold/italic/size/color, button default/hover) = **accepted loss**.

---

## E. Rich Text block

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Soạn thảo nội dung `[WYSIWYG]` | Gõ văn bản định dạng tự do (tiêu đề, đậm, list, ảnh, link…) | RichText.content |

---

## F. Product Listing block  ⭐ (gom sort+filter theo review)

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Tiêu đề khối `[Text]` | | ProductSetting.header |
| Nguồn sản phẩm `[Dropdown]` | **Tất cả** / **Tự chọn** / **Ngẫu nhiên**; nếu Tự chọn → `[Picker sản phẩm, Repeater]` | list_type all/fixed/random + data[] |
| Số sản phẩm / trang `[Number]` | | per_page |
| **Nhóm "Bộ lọc & Sắp xếp" (filterConfig)** | hiển thị ngay trong block, ngay trên list: | product_sort + product_filter |
| — Bật Sắp xếp `[Toggle]` + Tiêu chí mặc định `[Dropdown]` | cho phép khách đổi thứ tự | ProductSortSetting.criteria |
| — Bật lọc theo Thương hiệu `[Toggle]` | | filter brand |
| — Bật lọc theo Danh mục `[Toggle]` | | filter category |
| — Bật lọc theo Giá `[Toggle]` | | filter price |
| — Bật lọc theo Biến thể `[Toggle]` | | filter variant |
| **Kiểu CTA trên card** `[Dropdown]` | **Thêm vào giỏ** / **Chỉ Xem chi tiết** / **Thêm giỏ + Quick View** | ⊕ Diff 9-tpl: khác biệt rõ giữa template |
| **Bật Quick View** `[Toggle]` | Xem nhanh sản phẩm (modal) | ⊕ 6/9 có. **Điều kiện:** chỉ hiện toggle khi "Kiểu CTA" = option *có Quick View* (xem note ↓) |
| **Cho khách đổi Grid/List** `[Toggle]` | Nút chuyển xem dạng lưới ↔ danh sách | ⊕ f102/fb101 có |
| **Kiểu phân trang** `[Dropdown]` | **Tải thêm (Load more)** / **Số trang (Numbered)** | ⊕ trộn 2 kiểu giữa các template |

> **⚠️ Conditional logic (note cho Dev — Payload `admin.condition`):** Toggle **"Bật Quick View"** chỉ render khi **"Kiểu CTA trên card"** ∈ { *Thêm giỏ + Quick View* }. Nếu Merchant chọn "Chỉ Xem chi tiết" → ẩn/disable toggle Quick View (tránh cấu hình mâu thuẫn). Áp dụng `admin.condition: (data) => ['add_quickview'].includes(data.ctaCardStyle)`.

---

## G. Category Listing block

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Tiêu đề khối `[Text]` | | CategorySetting.header |
| Hiệu ứng `[Dropdown]` | **Thủ công** / **Tự chạy** / **Tĩnh**; nếu Tự chạy → Thời gian `[Number]` | CategoryAnimation manual/auto/static |
| Danh mục hiển thị `[Picker danh mục, Repeater]` | | data[] categories |
| **Kiểu hiển thị** `[Dropdown]` | **Lưới (Grid)** / **Băng chuyền (Carousel)** | ⊕ Diff 9-tpl: đổi grid↔carousel = đổi số phần tử hiển thị + luồng vuốt → là feature behavior |

---

## H. Article (Blog) Listing block

> Cùng khuôn với Product Listing.

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Tiêu đề khối `[Text]` | | ArticleSetting.header |
| Nguồn bài viết `[Dropdown]` | **Tất cả** / **Tự chọn** / **Ngẫu nhiên** | ArticleListType |
| Số bài / trang `[Number]` | | per_page |
| (nhóm sort/filter nếu template có — như mục F) | | article_sort/filter |
| **Layout** `[Dropdown]` | **Lưới (Grid)** / **Danh sách (List)** | ⊕ Diff 9-tpl: grid↔list đổi per_page + cách đọc → feature behavior |
| **Kiểu phân trang** `[Dropdown]` | **Tải thêm** / **Số trang** | ⊕ như product listing |
| **Hiện tóm tắt (excerpt)** `[Toggle]` | đoạn trích bài viết | ⊕ c101 ẩn, 8/9 hiện |
| **Hiện nút "Đọc thêm"** `[Toggle]` | | ⊕ c101/fn102 ẩn |
| **Hiện category badge** `[Toggle]` | nhãn danh mục trên card bài | ⊕ chỉ c101/fb101 |

### H2. Article Detail (cấu hình trang chi tiết bài viết)

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| **Hiện bài viết liên quan** `[Toggle]` + Số lượng `[Number]` | khối bài liên quan cuối trang | ⊕ Diff 9-tpl: 6/9 có; số lượng dao động 2–6 |
| **Hiện tags** `[Toggle]` | danh sách thẻ của bài | ⊕ 1–2/9 (xác nhận fn101/fn104 lúc build) | 

---

## I. Shortlist / Featured block  ⭐ (1 block đa hình theo review)

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Tiêu đề khối `[Text]` | | ShortList.name |
| Nhãn nút CTA `[Text]` | vd "Xem tất cả" | cta_button_text |
| Danh sách nổi bật `[Repeater]` | Mỗi mục: `[Picker]` chọn **1 trong**: Sản phẩm / Danh mục / Thương hiệu / Bài viết / Danh mục blog | ShortList items (model_type 5 loại) |

---

## J. Cart block  ⭐ (vách ngăn UI giữa template → thành Toggle)

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| Tiêu đề `[Text]` | | CartSetting.header |
| Hiện nút **"Xóa tất cả"** `[Toggle]` | fn102 có nút này, fn101/fb101 không → để Merchant tự bật/tắt | fn102 Cart delta (deleteAllCartItem) |
| Hiện **tồn kho khả dụng** `[Toggle]` | dòng "còn X sản phẩm" ở mỗi item | ⊕ Diff 9-tpl: ~6/9 hiện |

> *Ghi chú behavior (Dev tự lo, không phải control):* validate số lượng giỏ theo tồn kho là hành vi mặc định, không cần ô bật/tắt.

---

## K. Product Detail (cấu hình trang chi tiết SP)

> Trang chi tiết SP V1 không phải block kéo-thả; các toggle dưới đây là cấu hình hiển thị trang (page-level settings).

| Control | Mô tả Merchant | Tái tạo V1 |
|---|---|---|
| **Hiện mã SKU** `[Toggle]` | mã sản phẩm dưới tên | ⊕ Diff 9-tpl: 5/9 hiện |
| **Hiện link Danh mục** `[Toggle]` | breadcrumb/link danh mục SP | ⊕ 5/9 hiện |
| **Hiện badge % giảm** `[Toggle]` | nhãn "-X%" khi có khuyến mãi | ⊕ 3/9 (c102/fn102/pa101) |
| **Hiện tồn kho khả dụng** `[Toggle]` | "còn X sản phẩm" | ⊕ ~6/9 (dùng chung ý với Cart) |
| **Bật Quick View** `[Toggle]` | (đồng bộ với F — xem điều kiện CTA card) | ⊕ 6/9 |

---

## L. Checkout / Order Tracking

Dùng flow **native V2** — ngoài phạm vi skin 9 template. Merchant cấu hình tối thiểu (phương thức thanh toán/giao hàng) ở cấu hình store, không phải block kéo-thả. → Để Dev xác nhận theo V2 hiện có.

---

## Bàn giao Dev (không phải việc Design)

> **⚠️ Scope build (chốt 2026-06-12):** spec này mô tả **đầy đủ 20 control**, NHƯNG đối chiếu code V2 cho thấy nhiều control chưa có → migration đợt này chỉ build **Tier 0 + Tier 1**; **Tier 2 hoãn** (default BẬT ở storefront, Merchant tắt sau V2.1/V2.2). Chi tiết coverage/tier + gap: [`blocker-vs-spec-reconciliation.md`](../../plans/260611-1131-migrate-template/blocker-vs-spec-reconciliation.md) + [`dev-handover-v2-block-gaps.md`](../../plans/260611-1131-migrate-template/dev-handover-v2-block-gaps.md).

Các điểm kỹ thuật/DB tách ra cho Dev (họ có cred DB, check nhanh):
1. **Promotion.discount_type** (số 1/2/3…) → nghĩa là loại giảm giá gì? (tra DB/seed V1)
2. **Shortlist "Danh mục blog"** lưu ở collection Payload nào?
3. `order_by` (listing) vs tiêu chí sort — Dev xác nhận tham số API.
4. Convert HTML thô → Lexical RichText; map ID đa hình Shortlist; ráp mảng EAV phẳng (banner/menu/footer icon) — Dev viết transformer.
5. i18n cặp `*_ms` (tiếng Mã Lai) — Dev quyết localization Payload (en + ms).

---

## M. Toggle reference matrix — Feature × 9 Template (cho BA/QA check giao diện)

> ✅ **Hoàn tất rà 9 template** (5 agent diff song song, 2026-06-11). Đã lọc bỏ tầng skin; chỉ giữ delta chức năng. 20 control duyệt giữ (ký hiệu ⊕ trong các bảng trên). Control #20 "Filter layout (sidebar/topbar)" → BỎ, chuyển tầng skin.

| Feature (block) | c101 | c102 | f102 | fb101 | fn101 | fn102 | fn103 | fn104 | pa101 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Header: Sticky | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Layout: Scroll-to-top | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| ProductCard: CTA | Add+QV | min | Add | QV+Wish | Add+QV | Add+QV | Add+QV | Add+QV | overlay |
| Product: Quick View | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗* | ✓* |
| List: Grid/List switch | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| List: phân trang | More+page | page | page | page | More | More | More | More | page |
| Detail: SKU | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ |
| Detail: category link | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Detail: discount badge | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Cart: stock-available text | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Cart: "Xóa tất cả" | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Banner: nav (dots/arrows) | both | dots | both | arrows | both | both | both | both | both |
| Banner: CTA button | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Category: hiển thị | grid/carousel | grid/carousel | masonry | carousel | grid | grid | grid | grid | grid/carousel |
| Article: layout | grid | grid+list | list+grid | grid | grid | grid-2 | list | list | grid |
| Article: excerpt | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Article: "Đọc thêm" | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Article: category badge | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Article: bài liên quan | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Article: tags (detail) | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | ✓* | ✗ |

\* = 2 agent báo lệch (Quick View pa101/fn104, tags fn101/fn104) → QA xác nhận lúc build, không chặn.

**❌ BỎ (skin, bake vào template V2):** search/cart style · mega-menu markup · banner effect · carousel lib · sale-badge format · date format · delete-icon style · variant selector inline/dropdown · cart table/grid · category color cycling · preloader style · **filter layout sidebar/topbar (#20)**.
**⏸️ DEFER (V1 không có data):** wishlist · rating sao · buy-now · coupon/promo · order notes · author bài viết.
