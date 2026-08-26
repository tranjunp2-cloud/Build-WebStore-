# V1 Model → Payload Mapping (Data Layer)

> **Mục đích:** Kim chỉ nam tầng dữ liệu cho migration 9 template PrimeWeb V1 (Vue3/Laravel/MySQL) → ECH Prime Web v2 (Next15/Payload/PostgreSQL).
> **Phạm vi:** CHỈ Data Layer (model → Payload field). Presentation Layer (markup/CSS per template) ở doc Diff riêng (§7, append sau).
> **Nguồn:** đọc trực tiếp `~/Desktop/primeweb-v1-source/src/core/models/**` + cross-ref PR #1157 (`data-inventory`, `component-mapping`, `value-mapping`).
> **Trạng thái:** Data Layer FROZEN 2026-06-11. Bổ sung từ Diff → append §7.

---

## 1. Khung quan hệ model (V1)

```
Config (store-level)
├── template: string            → mã 1 trong 9 (fb101/pa101/f102/c101/fn101..104/c102)
├── common: ConfigCommon
└── pages[]: Page ──────────────────────────────────────────────┐
                                                                 │
Page (1 trang)                                                   │
├── name/slug/url/title/meta_description/meta_tag/content        │
├── type (PageType enum) / parent_id / position / status         │
└── components[]: Component<S,D>   ◄── ORDER theo `position`, phân loại theo type
        ├── frontend_component_id / label / page_id / position / status / tag_name
        ├── settings: S | S[]   ◄── EAV "đã đóng hộp" (typed theo loại component)
        └── data:     D | D[]   ◄── nội dung thật

Store-level RIÊNG (KHÔNG nằm trong Page):
├── CurrentStore   → logo, favicon, hotline[], social_channel, address[], country/currency, email, description, frontend_template_id
├── Menu (header)  → lines[]: SubMenu → SubMenuSetting{name,url,model_type,model_id}   ◄── mega-menu EAV (items.N)
├── Footer         → FooterLine[] → FooterLineSetting (4 kiểu FooterType, có items[] icon)
└── Theme/Typography (Store EAV: theme.* + typography.*)   → skin của 9 template
```

**Domain entities** (component `data` trỏ tới / shortlist tham chiếu):
- **Product** → `skus[]` → `variants[]` (→ `attribute` + `attribute_value`); `images[]`; `category{data}`; `current_promotion`; `brand_id`
- **Category** (cây `parent_id` / `childrenCat`), **Article** (blog), **Brand**
- **ShortList<T>** — polymorphic `model_type`/`model_id` → 5 loại: Product / Category / Brand / BlogPost / BlogCategory

---

## 2. Sự thật EAV (chỗ dễ mất data nhất)

**DB** `model_settings` = EAV thuần: cột `key / name / value(text) / signature / field / parent_id`, polymorphic qua `(model_type, model_id)`. Mỗi component = **nhiều row, mỗi row 1 key**.
Volume prod (PR #1157): `PageComponent 33.676 row · MenuLine 24.761 · Store 7.488 (theme)`.

**Phát hiện cốt lõi (đọc từ `page.service.ts`):** API `GET /pages/{id}/components?include=settings` trả về `settings` **đã được Laravel transformer ráp sẵn từ EAV rows** → khớp đúng các interface TS `*Setting`. 
→ **Các interface `*Setting` CHÍNH LÀ hình EAV-đã-giải-mã.** Map Payload field vào shape typed này, **KHÔNG** map vào key/value tự do.

⚠️ **Bẫy "flat-array EAV"** — 3 chỗ lưu mảng bằng key phẳng `items.<i>.<field>`; transform PHẢI ráp lại thành mảng:
1. **Banner** array (nhiều slide / 1 component)
2. **MenuLine** mega-menu (`items.0.url/image/size` … items.3)
3. **Footer** hyperlink-icon (`FooterLineSetting.items[]`)

---

## 3. Mapping component → Payload block

> Quy ước: `select`/`number`/`text`/`array`/`group`/`relationship`/`richText` = Payload field type.

| V1 component | settings (EAV-boxed) | data | → Payload block | Field đề xuất |
|---|---|---|---|---|
| **banner** | `animation`(manual/auto), `size`(hero/small), `timing_animation` | Banner[]{name,content,image,url,alignment,display,type,header,subheader,button.mode.default/hover} | `bannerBlock` | `select` animation/size · `number` timing · `array` slides · `group` header/subheader/button(default+hover) cho text-style |
| **rich_text** | — | `{content: html}` | `richTextBlock` | `richText` (lexical) — convert từ HTML |
| **product_listing** | `header`, `list_type`(all/fixed/random), `order_by`, `per_page` | Product[] (khi fixed) | **`productListingBlock`** | `text` header · `number` per_page · `relationship`→products (khi fixed) · **`group filterConfig`** (xem §4) |
| **product_sort** | `criteria`, `header`, `per_page` | — | → gộp vào `filterConfig.sort` | `select` sortBy · `number` per_page |
| **product_filter** | brand/category/price/variant toggles | — | → gộp vào `filterConfig.filters` | `checkbox` group bật/tắt từng filter |
| **category_listing** | `animation`(manual/auto/**static**), `header`, `timing_animation` | Category[] | `categoryListingBlock` | `select` animation · `relationship`→categories |
| **article_listing** | `header`, `list_type`(all/fixed/random), `order_by`, `per_page` | Article[] | `articleListingBlock` | giống product listing (sort/filter nếu có → group tương tự) |
| **cart** | `header` | — | `cartWidget` (global → `Sites.globalBlocks`) | `text` |
| **checkout / order_tracking** | (model v2) | — | native V2 | dùng sẵn collection/flow V2 |
| **shortlist** | — | items polymorphic (`model_type` 5 loại) | **`shortlistBlock`** (1 block) | `array` of `relationship` đa hình (xem §5) |

---

## 4. `productListingBlock.filterConfig` (chỉnh theo review)

Gom **product_sort + product_filter** thành 1 **group field** `filterConfig` ngay trong `productListingBlock` (sort+filter luôn đi kèm & tác động list bên dưới → query API gọn).

```ts
{
  name: 'filterConfig',
  type: 'group',
  fields: [
    // từ product_sort (ProductSortSetting)
    { name: 'sortCriteria', type: 'select', options: [...] },   // V1 criteria
    { name: 'sortPerPage',  type: 'number' },                   // V1 per_page
    // từ product_filter
    { name: 'filterBrand',    type: 'checkbox' },
    { name: 'filterCategory', type: 'checkbox' },
    { name: 'filterPrice',    type: 'checkbox' },
    { name: 'filterVariant',  type: 'checkbox' },
  ],
}
```
*(Áp dụng tương tự cho `articleListingBlock` nếu V1 có article_sort/article_filter.)*

---

## 5. `shortlistBlock` polymorphic (chỉnh theo review)

V1 ShortList polymorphic (`model_type` + `model_id`, 5 loại) → **1 block duy nhất** chứa `array` các **relationship đa hình** (Payload chuẩn):

```ts
{
  slug: 'shortlistBlock',
  fields: [
    { name: 'header', type: 'text' },           // V1 name
    { name: 'ctaButtonText', type: 'text' },     // V1 cta_button_text
    {
      name: 'items',
      type: 'array',
      fields: [{
        name: 'ref',
        type: 'relationship',
        relationTo: ['products', 'categories', 'posts', 'brands'],  // BlogCategory → map vào taxonomy posts hoặc collection riêng (xác nhận khi load)
      }],
    },
  ],
}
// Payload tự sinh: { relationTo: 'products', value: '<payload_id>' }
```
**Lưu ý load:** V1 `model_type` (Product/Category/Brand/BlogPost/**BlogCategory**) → resolve sang Payload collection + ID-map. BlogCategory cần chốt collection đích lúc Load (Phase Load).

---

## 6. Store-level mapping (chạy 1 lần / store)

| V1 | → Payload |
|---|---|
| `theme.*` (primary_color / background_color / header_text / background_text) + `typography.*` (h1..paragraph: font_size/weight, current_font) | `Sites.theme` (group: colors + typography) |
| Menu header (mega-menu MenuLine EAV `items.N`) | `Sites.headerBlock` — **ráp lại mảng items** |
| Footer (FooterLine; FooterType 1=internal / 2=external / 3=icon / 4=plaintext; `items[]` cho icon) | `Sites.footerBlock` — `blocks` theo 4 type |
| CurrentStore (logo / favicon / hotline[] / social_channel / address[] / email / country / currency / description) | `Sites` fields trực tiếp |

---

## 7. Enum → Payload `select` (value-mapping)

| V1 enum | Values | Payload select options |
|---|---|---|
| BannerAnimation | `manual` / `auto` | giữ nguyên |
| BannerSize | `hero` / `small` | giữ nguyên |
| CategoryAnimation | `manual` / `auto` / `static` | giữ nguyên (**static** chỉ có ở category) |
| ProductListType / ArticleListType | `all` / `fixed` / `random` | giữ nguyên |
| FooterType | `1` / `2` / `3` / `4` | `internal_hyperlink_text` / `external_hyperlink_text` / `hyperlink_icon` / `plain_text` |
| PageType | home/product/article/cart/checkout/order_tracking/new_page | map sang Pages.type V2 |
| Promotion.discount_type | number | cần bảng map số→loại (chốt lúc đọc seed/DB) |

---

## 8. Gap / cần xử lý ở tầng Payload

1. **2 lớp model song song**: `v1` (storefront render: banner/product/category/article) + `v2` (checkout/page/component/administrative-unit — đang dùng thật, 21 importer). Extract phải biết entity nào lấy API v1 vs v2. Đặc biệt **Page** dùng `models/v2/page.model.ts`, nhưng **Component** vẫn dùng `models/pages/component.model.ts` (v1) → settings EAV theo v1.
2. **`settings: S | S[]`** và **`data: D | D[]`** — vừa object vừa array tùy component → transform PHẢI normalize về array.
3. **flat-array EAV** (§2) — banner / mega-menu / footer-icon: ráp `items.<i>.<field>` → array. Sai = mất slide / mất menu con.
4. **`product.model.ts`** có block lạc `{active:number}` (dòng 37-39) — chỉ nhiễu đọc hiểu, không phải field thật.
5. **i18n**: hầu hết entity có cặp `*` + `*_ms` (name/name_ms, content/content_ms…) → Payload cần localization (en + ms) hoặc 2 field.
6. **`signature`** đi kèm mọi field ảnh (image + signature) → V1 lưu CDN signature; Load phải re-upload media → `media.id`, bỏ signature.
7. **Promotion.discount_type** (number) chưa rõ bảng map — chốt khi đọc DB/seed.

---

## 7b. Template Diff — xác thực "chỉ khác skin" (append 2026-06-11)

> Mẫu kiểm: `fn101` (blueprint) vs `fn102` vs `fb101`, trên ProductListing + Cart + ProductItem (so `<script>` riêng).

**Kết luận: giả thuyết ĐÚNG ở tầng data — logic bóc dữ liệu đồng nhất.**
- Mọi component `.vue` per-template chỉ `extends` base class chung ở `src/core/components/**/Base*Component.ts` (BaseProductListingComponent, BaseCartComponent, BaseBannerComponent, BaseCategoryListingComponent, BaseFilterComponent, BaseProductSortComponent, BaseRichTextComponent…). → **cách map model→view giống hệt 9 template** ⇒ data mapping ở doc này dùng chung, KHÔNG cần biến thể per-template.
- ProductListing script fn101≈fn102≈fb101: chỉ khác đăng ký `EmptyComponent` + từ khóa `override` cho `defaultPageSize = 8` (giá trị y nhau). 0 khác biệt logic.

**⚠️ Logic ẩn cấp template (note cho Presentation Layer, KHÔNG ảnh hưởng data mapping):**
- `fn102/Cart.vue` thêm 2 method riêng KHÔNG có ở fn101/fb101:
  - `deleteAllCartItem()` — xoá sạch giỏ + backup store.
  - `validateNumberCart(index, min)` — clamp quantity theo `min` và `product_sku.stock`.
  → Là tương tác UI/UX cấp template (không đổi shape dữ liệu). Khi dựng lại storefront V2 phải rà từng template xem có method thêm tương tự (không gom hết vào base).
- Markup/Tailwind khác đáng kể (vd `ProductItem.vue`: fn101=129 / fn102=74 / fb101=66 dòng) — thuần skin.

**Hệ quả migration:** Data extract/transform **uniform cho cả 9 template**. Việc cần rà per-template chỉ là (a) UI-interaction method thêm, (b) markup/skin → thuộc Presentation Layer, không chạm pipeline data.

### Verdict cuối (rà đủ 9 template — 5 agent diff song song, 2026-06-11)

✅ **Giả thuyết "chỉ khác skin" được CHỨNG MINH HOÀN TOÀN ở cả Data Layer lẫn Presentation Layer.** Không template nào bóc/định hình dữ liệu khác kiểu (logic ở base class, đồng nhất). Khác biệt Presentation = **bật/tắt element + vài method UI** → quy hết về 20 toggle/dropdown cấu hình (chi tiết: `docs/design/F35-template-block-design.md`). ⇒ Pipeline ETL data dùng chung 1 lần cho 9 template.

**Bảng Feature × Template (delta chức năng, đã lọc skin):**

| Feature | c101 | c102 | f102 | fb101 | fn101 | fn102 | fn103 | fn104 | pa101 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Header: Sticky | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Layout: Scroll-to-top | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| ProductCard CTA | Add+QV | min | Add | QV+Wish | Add+QV | Add+QV | Add+QV | Add+QV | overlay |
| Product Quick View | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗* | ✓* |
| List Grid/List switch | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| List phân trang | More+page | page | page | page | More | More | More | More | page |
| Detail SKU | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ |
| Detail category link | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Detail discount badge | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Cart stock-available | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Cart "Xóa tất cả" | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Banner nav | both | dots | both | arrows | both | both | both | both | both |
| Banner CTA button | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Category hiển thị | grid/car | grid/car | masonry | carousel | grid | grid | grid | grid | grid/car |
| Article layout | grid | grid+list | list+grid | grid | grid | grid-2 | list | list | grid |
| Article excerpt | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Article "Đọc thêm" | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| Article category badge | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Article bài liên quan | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Article tags (detail) | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | ✓* | ✗ |

\* = 2 agent báo lệch → xác nhận lúc build.

---

## 9. Câu hỏi mở
- BlogCategory (loại thứ 5 của shortlist) map vào collection Payload nào? (posts-taxonomy hay collection riêng?)
- `order_by` (product/article listing) vs `sortCriteria` (sort component) — trùng hay khác chiều? cần đọc render logic (§7 Diff).
- `Promotion.discount_type` number → enum loại giảm giá: lấy map ở đâu (seed migration V1)?
