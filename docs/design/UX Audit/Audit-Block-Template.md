# Bản mẫu Kiểm toán Block (Audit Block Template) — ECH Prime Web v2

> **Ngày:** 2026-04-15
> **Tác giả:** Đội ngũ UX / Sản phẩm
> **Phạm vi:** Kiểm toán 50 block trong registry, phân loại hiển thị/ẩn trên Bảng Thư viện (Library Panel)
> **Tệp tham chiếu:**
> - `src/blocks/types.ts` — BLOCK_TYPES (50 mục)
> - `src/components/editor/BlockLibraryPanel.tsx` — categoryConfig (Bộ lọc giao diện)
> - `src/lib/ai/system-prompt.ts` — Gợi ý tạo bằng AI (Sử dụng `getAllMeta()`)

---

## 1. Tổng quan

| Chỉ số | Số lượng |
|--------|-------|
| Tổng số block trong registry | **50** |
| Các block hiển thị trên Bảng Thư viện (trước kiểm toán) | **42** |
| Các block đã ẩn (v2.0 industry — từ trước) | **8** |
| Các block đề xuất loại bỏ khỏi Thư viện (trong lần kiểm toán này) | **12** |
| **Các block còn lại trên Bảng Thư viện (sau kiểm toán)** | **30** |

---

## 2. Danh sách 12 block đã ẩn khỏi Bảng Thư viện

### 2.1 Trùng chức năng (đã có biến thể thay thế)

| # | Block | Lý do | Block thay thế |
|---|-------|-------|----------------|
| 1 | `gallery-masonry` | Trùng biến thể `masonry` của gallery | `gallery` (variant=masonry) |
| 2 | `pricing-table` | Trùng biến thể `table` của pricing | `pricing` (variant=table) |
| 3 | `accordion` | Trùng biến thể `accordion` của faq | `faq` (variant=accordion) |
| 4 | `client-logos` | Trùng chức năng với logo-cloud | `logo-cloud` |

### 2.2 Ngoài phạm vi (theo PRD)

| # | Block | Lý do |
|---|-------|-------|
| 5 | `custom-html` | Không hỗ trợ nhúng HTML/CSS cho người dùng SME |

### 2.3 Không phù hợp mục tiêu SME / gây nhầm lẫn

| # | Block | Lý do |
|---|-------|-------|
| 6 | `breadcrumb` | Nên tự động tạo, không cần người dùng thêm thủ công |
| 7 | `video-background` | Trùng với biến thể `video`, gây nhầm lẫn |
| 8 | `before-after` | Quá chuyên biệt (niche), không phổ biến với SME |

### 2.4 Không thể sử dụng do thiếu backend / hạn chế kỹ thuật

| # | Block | Lý do |
|---|-------|-------|
| 9 | `blog-list` | Chưa có CMS backend — hiển thị trống |
| 10 | `download-cta` | Chưa có lưu trữ tệp (file hosting) — nút tải xuống không hoạt động |
| 11 | `google-maps` | Cần mã API key, người dùng không tự cấu hình được |
| 12 | `countdown-timer` | Chỉ ở phía trình duyệt (client-side), không lưu trữ bền vững — tải lại trang là mất dữ liệu |

---

## 3. Danh sách 8 block v2.0 Industry (đã ẩn từ trước)

Các block này **không nằm trong `categoryConfig`** của Bảng Thư viện kể từ khi ra mắt v2.0.

| # | Block | Mô tả | Ngành |
|---|-------|-------|-------|
| 1 | `menu-display` | Thực đơn nhà hàng nâng cao | F&B |
| 2 | `booking-widget` | Biểu mẫu đặt lịch hẹn | Dịch vụ |
| 3 | `class-schedule` | Thời khóa biểu lớp học | Giáo dục / Thể hình |
| 4 | `review-cards` | Đánh giá khách hàng có kèm điểm số | Tổng hợp |
| 5 | `video-showcase` | Trưng bày video theo danh mục | Truyền thông |
| 6 | `doctor-profile` | Thẻ bác sĩ kèm bằng cấp | Y tế |
| 7 | `property-card` | Tin rao bất động sản | Bất động sản |
| 8 | `product-quick-view` | Xem nhanh sản phẩm thương mại điện tử | TMĐT |

---

## 4. Danh sách 30 block còn lại trên Bảng Thư viện

### 4.1 Cơ bản (6 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 1 | `hero` | Mục chính kèm tiêu đề, nút kêu gọi hành động (CTA), hình ảnh | centered, split-left, split-right, fullscreen, video, magazine, minimal, cards-overlay, gradient, parallax, slideshow, split-video |
| 2 | `cta` | Mục kêu gọi hành động | banner, inline, floating |
| 3 | `about` | Giới thiệu kèm văn bản và hình ảnh | simple, split, story |
| 4 | `features` | Lưới tính năng kèm biểu tượng và mô tả | grid-2, grid-3, grid-4, list, icon-top, icon-left, zigzag, carousel |
| 5 | `step-process` | Quy trình từng bước có số thứ tự | vertical, horizontal, alternating |
| 6 | `service-cards` | Thẻ dịch vụ kèm biểu tượng, giá, nút hành động | grid, list, featured |

### 4.2 Nội dung (4 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 7 | `faq` | Các câu hỏi thường gặp | accordion, grid, simple |
| 8 | `testimonials` | Ý kiến đánh giá của khách hàng | cards, carousel, simple, masonry, spotlight, minimal-quote, avatar-row, video-text |
| 9 | `social-proof` | Đánh giá kèm số sao và ảnh đại diện | cards, minimal, grid |
| 10 | `portfolio-grid` | Lưới dự án có bộ lọc | grid, masonry, showcase |

### 4.3 Phương tiện (3 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 11 | `gallery` | Thư viện hình ảnh | grid, masonry, carousel, lightbox, filmstrip, justified |
| 12 | `video` | Nhúng video | embed, background |
| 13 | `carousel` | Trình chiếu hình ảnh/thẻ/đánh giá | images, cards, testimonials |

### 4.4 Kinh doanh (3 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 14 | `pricing` | So sánh các gói giá | cards, table, horizontal, toggle, tiered, comparison, minimal, slider |
| 15 | `feature-comparison` | Bảng so sánh tính năng | table, cards |
| 16 | `menu-food` | Thực đơn nhà hàng kèm giá | classic, cards, minimal |

### 4.5 Thương mại (3 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 17 | `products-grid` | Lưới sản phẩm tương thích (responsive) | grid-3, grid-4, list |
| 18 | `products-featured` | Sản phẩm nổi bật | hero-product, carousel |
| 19 | `cartWidget` | Nút giỏ hàng kèm nhãn số lượng | floating, inline |

### 4.6 Biểu mẫu & Liên hệ (3 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 20 | `contact` | Biểu mẫu liên hệ và thông tin | form, info-only, split, card-float, map-split, minimal-inline |
| 21 | `newsletter` | Biểu mẫu đăng ký nhận tin qua email | inline, popup, banner |
| 22 | `whatsapp-button` | Nút liên hệ qua WhatsApp | floating, inline |

### 4.7 Tiện ích (4 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 23 | `stats` | Số liệu thống kê | row, grid, highlight |
| 24 | `logo-cloud` | Logo đối tác/khách hàng | row, grid |
| 25 | `socialWidget` | Nút mạng xã hội | floating, inline |
| 26 | `team` | Các thành viên đội ngũ | grid, list |

### 4.8 Bố cục (4 block)

| # | Block | Mô tả | Biến thể (Variants) |
|---|-------|-------|----------|
| 27 | `navigation` | Thanh điều hướng | simple, centered, mega-menu, transparent, sidebar, pill |
| 28 | `footer` | Chân trang | simple, expanded, minimal, centered-stack, mega-footer, dark-gradient |
| 29 | `divider` | Đường phân cách | line, dots, wave, spacer |
| 30 | `announcement-bar` | Thanh thông báo/khuyến mãi | gradient, solid, minimal |

---

## 5. Lỗi phát hiện: AI tạo nội dung không đồng bộ với Bảng Thư viện

### Vấn đề

```
src/lib/ai/system-prompt.ts (dòng 18):
  const blockMetas = blockRegistry.getAllMeta()  // → Trả về 50 block

src/components/editor/BlockLibraryPanel.tsx (dòng 18-27):
  categoryConfig = [...]  // → Chỉ có 30 block (sau kiểm toán)
```

Việc tạo bằng AI gửi **tất cả 50 block** cho GPT-4o → GPT có thể chọn bất kỳ block nào, bao gồm cả 20 block đã ẩn → Người dùng không thể chỉnh sửa các block này trên giao diện UI.

### Ảnh hưởng

- Người dùng thấy block "lạ" trên trang — không tìm thấy trong Bảng Thư viện để chỉnh sửa.
- Các block thiếu backend (blog-list, download-cta, google-maps) hiển thị trống hoặc lỗi.
- Trải nghiệm người dùng (UX) bị rối: người dùng không hiểu tại sao có block không chỉnh sửa được.

### 5.1 Giải pháp kỹ thuật — Nguồn sự thật duy nhất (Sử dụng cờ `visibility`)

Sử dụng cờ `visibility` với 3 trạng thái thay vì kiểu đúng/sai (boolean) đơn giản, để hỗ trợ vòng đời của block rõ ràng hơn:

```
production  → Hiển thị trên Bảng Thư viện + AI được phép sử dụng
development → Chỉ hiển thị trong chế độ phát triển (xem trước nội bộ, chưa ra mắt người dùng)
hidden      → Ẩn hoàn toàn khỏi giao diện UI + AI, nhưng vẫn hiển thị được cho các trang cũ
```

#### Bước 1: Thêm trường vào kiểu BlockMeta

**Tệp:** `src/blocks/types.ts`

```typescript
// Thêm kiểu hiển thị (BlockVisibility)
export type BlockVisibility = 'production' | 'development' | 'hidden'

// Cập nhật kiểu BlockMeta (dòng ~112)
export type BlockMeta = {
    type: BlockType
    name: string
    description: string
    icon: string
    variants: string[]
    defaultVariant: string
    editableFields: string[]
    quickActions: string[]
    visibility: BlockVisibility  // ← THÊM MỚI
}
```

#### Bước 2: Cập nhật cấu hình cho 50 block trong config.ts

**30 block `production`** — thêm `visibility: 'production'`:

```typescript
// Ví dụ: src/blocks/hero/config.ts
export const heroMeta = {
    type: 'hero' as const,
    name: 'Hero',
    // ...các trường khác giữ nguyên...
    visibility: 'production',  // ← THÊM
}
```

**20 block `hidden`** — thêm `visibility: 'hidden'`:

| Nhóm | Block | Trạng thái hiển thị |
|------|--------|------------|
| Trùng chức năng (4) | `gallery-masonry`, `pricing-table`, `accordion`, `client-logos` | `hidden` |
| Ngoài phạm vi (1) | `custom-html` | `hidden` |
| Gây nhầm lẫn (3) | `breadcrumb`, `video-background`, `before-after` | `hidden` |
| Thiếu backend (4) | `blog-list`, `download-cta`, `google-maps`, `countdown-timer` | `hidden` |
| Ngành v2.0 (8) | `menu-display`, `booking-widget`, `class-schedule`, `review-cards`, `video-showcase`, `doctor-profile`, `property-card`, `product-quick-view` | `hidden` |

```typescript
// Ví dụ: src/blocks/blog-list/config.ts
export const blogListMeta = {
    type: 'blog-list' as const,
    name: 'Danh sách blog',
    // ...các trường khác giữ nguyên...
    visibility: 'hidden',  // ← ẨN KHỎI THƯ VIỆN + AI
}
```

#### Bước 3: Thêm các phương thức bổ trợ vào registry

**Tệp:** `src/blocks/registry.ts`

```typescript
// Thêm 2 phương thức mới vào đối tượng blockRegistry (sau getAllMeta)

/** Lấy thông tin các block sẵn sàng cho sản xuất (dùng cho AI prompt + Bảng Thư viện) */
getProductionMeta(): BlockMeta[] {
    return Object.values(REGISTRY)
        .map(entry => entry.meta)
        .filter(meta => meta.visibility === 'production')
},

/** Lấy thông tin các block sản xuất + phát triển (dùng cho chế độ dev/preview) */
getAvailableMeta(includeDev = false): BlockMeta[] {
    return Object.values(REGISTRY)
        .map(entry => entry.meta)
        .filter(meta =>
            meta.visibility === 'production' ||
            (includeDev && meta.visibility === 'development')
        )
},
```

#### Bước 4: Cập nhật 3 nơi sử dụng (consumers)

**Tệp 1:** `src/lib/ai/system-prompt.ts` (dòng 18)

```typescript
// TRƯỚC:
const blockMetas = blockRegistry.getAllMeta()

// SAU:
const blockMetas = blockRegistry.getProductionMeta()
```

**Tệp 2:** `src/app/api/ai/edit-block/route.ts` (dòng 70)

```typescript
// TRƯỚC:
const blockMetas = blockRegistry.getAllMeta()

// SAU:
const blockMetas = blockRegistry.getProductionMeta()
```

**Tệp 3:** `src/components/editor/BlockLibraryPanel.tsx` (dòng 18-27)

Giữ nguyên `categoryConfig` nhưng lọc động theo registry:

```typescript
// Thêm logic lọc (trong component, trước khi render)
const visibleTypes = new Set(
    blockRegistry.getProductionMeta().map(m => m.type)
)
const filteredCategories = categoryConfig.map(cat => ({
    ...cat,
    blockTypes: cat.blockTypes.filter(t => visibleTypes.has(t)),
})).filter(cat => cat.blockTypes.length > 0)
```

#### Bước 5: Cập nhật các bài kiểm tra (tests)

| Tệp | Thay đổi |
|------|----------|
| `src/__tests__/unit/blocks/block-configs.test.ts` | Thêm kiểm tra trường `visibility` tồn tại và có giá trị hợp lệ trên mỗi meta |
| `src/__tests__/unit/blocks/registry.test.ts` | Thêm kiểm tra `getProductionMeta()` trả về đúng 30 block |
| `src/__tests__/unit/lib/ai/system-prompt.test.ts` | Cập nhật mock sử dụng `getProductionMeta` |
| `src/__tests__/unit/lib/ai/openai-generator.test.ts` | Cập nhật mock sử dụng `getProductionMeta` |
| `src/__tests__/unit/lib/ai/sanitize-block-data.test.ts` | Cập nhật mock thêm `getProductionMeta` |

#### Kết quả sau khi sửa

```
blockRegistry.getAllMeta()          → 50 block (hiển thị trang cũ, công cụ nội bộ)
blockRegistry.getProductionMeta()  → 30 block (AI tạo + Bảng Thư viện)
blockRegistry.getAvailableMeta(true) → 30+ block phát triển (xem trước nội bộ)
```

- Trang cũ có block bị ẩn → vẫn hiển thị bình thường (linh kiện + sơ đồ vẫn trong registry).
- AI tạo trang mới → chỉ sử dụng 30 block dành cho sản xuất.
- Bảng Thư viện → chỉ hiển thị 30 block dành cho sản xuất.
- Muốn ẩn/hiện block → chỉ cần sửa 1 dòng `visibility` trong `config.ts` của block đó.
- Muốn thử nghiệm block mới nội bộ → đặt trạng thái là `development`, chỉ hiển thị trong chế độ dev.

---

### 5.2 Cơ chế dự phòng (Fallback Mechanism) — Tự động chuyển đổi block đã ẩn

Khi AI vô tình tạo ra block đã ẩn (từ trang cũ hoặc trường hợp ngoại lệ), hệ thống cần tự động chuyển đổi sang block tương đương thay vì để block "lạ" trên trang.

**Tệp:** `src/lib/ai/sanitize-block-data.ts` (hoặc tạo mới)

```typescript
// Bảng ánh xạ: block đã ẩn → block thay thế + biến thể
const BLOCK_FALLBACK_MAP: Record<string, { blockType: string; variant: string }> = {
    'gallery-masonry':    { blockType: 'gallery',  variant: 'masonry' },
    'pricing-table':      { blockType: 'pricing',  variant: 'table' },
    'accordion':          { blockType: 'faq',      variant: 'accordion' },
    'client-logos':       { blockType: 'logo-cloud', variant: 'grid' },
    'video-background':   { blockType: 'video',    variant: 'background' },
    'before-after':       { blockType: 'gallery',  variant: 'grid' },
    // Các block không có tương đương → loại bỏ khỏi đầu ra
    // 'custom-html', 'breadcrumb', 'blog-list', 'download-cta',
    // 'google-maps', 'countdown-timer' → bỏ qua (không thêm vào trang)
}

export function sanitizeAIBlocks(blocks: BlockData[]): BlockData[] {
    return blocks
        .map(block => {
            const fallback = BLOCK_FALLBACK_MAP[block.blockType]
            if (fallback) {
                return { ...block, blockType: fallback.blockType, variant: fallback.variant }
            }
            // Block không có trong registry HOẶC là block ẩn không có fallback → loại bỏ
            const meta = blockRegistry.getBlockMeta(block.blockType)
            if (!meta || meta.visibility === 'hidden') return null
            return block
        })
        .filter(Boolean) as BlockData[]
}
```

**Áp dụng:** Gọi `sanitizeAIBlocks()` ngay sau khi nhận phản hồi từ GPT-4o, trước khi lưu vào cơ sở dữ liệu.

---

### 5.3 Lớp xác thực (Validation Layer) — Middleware kiểm tra trước khi hiển thị

Thêm bước xác thực giữa đầu ra AI và trình chỉnh sửa (Editor) để đảm bảo **không có block nào ngoài danh sách sản xuất** lọt vào trang web của người dùng.

**Tệp:** `src/app/api/ai/generate/route.ts` (hoặc middleware tương ứng)

```typescript
// Chạy SAU khi nhận phản hồi AI, TRƯỚC khi trả về cho khách hàng
function validateGeneratedBlocks(pages: PageData[]): PageData[] {
    const productionTypes = new Set(
        blockRegistry.getProductionMeta().map(m => m.type)
    )

    return pages.map(page => ({
        ...page,
        blocks: page.blocks.filter(block => {
            if (!productionTypes.has(block.blockType)) {
                console.warn(
                    `[AI Validation] Đã loại bỏ block không thuộc sản xuất: ${block.blockType}`
                )
                return false
            }
            return true
        })
    }))
}
```

**Quy trình hoàn chỉnh:**

```
Phản hồi từ GPT-4o
  → Phân tích JSON
  → sanitizeAIBlocks()     ← Dự phòng: chuyển đổi block trùng → biến thể tương đương
  → validateGeneratedBlocks() ← Lưới bảo vệ: loại bỏ block còn sót lại
  → Lưu vào DB
  → Hiển thị trên Editor
```

---

### 5.4 Phân tích UX — Thị trường SME Malaysia

#### Tại sao giảm từ 50 → 30 block là đúng?

**Nghịch lý của sự lựa chọn (Paradox of Choice):**
Chủ sở hữu SME không phải là nhà thiết kế. Khi mở Bảng Thư viện và thấy 50 block, họ bị "liệt trong phân tích" (analysis paralysis) — không biết chọn gì, dẫn đến bỏ cuộc và rời khỏi công cụ chỉnh sửa. 30 block là con số vừa đủ để đáp ứng 95% nhu cầu sử dụng mà không gây quá tải thông tin.

#### Tại sao lại ẩn các block cụ thể này?

| Block đã ẩn | Lý do từ góc nhìn SME Malaysia |
|-------------|-------------------------------|
| `custom-html` | SME không có kỹ năng lập trình. Thay vì để họ tự nhúng HTML, nên cung cấp các block có sẵn với cấu hình đơn giản. |
| `google-maps` | Cần mã API key — SME không biết lấy ở đâu. **Hướng tới:** Tích hợp qua Store ID hoặc nhập địa chỉ, hệ thống tự động nhúng bản đồ. |
| `blog-list` | Chưa có CMS. SME thấy block trống → nghĩ rằng sản phẩm bị lỗi. Chỉ mở lại khi hệ thống CMS sẵn sàng. |
| `countdown-timer` | Chỉ chạy phía client, tải lại trang là mất dữ liệu. SME tạo đếm ngược cho khuyến mãi → tải lại → bộ đếm cài lại → mất lòng tin. |
| `breadcrumb` | SME không hiểu breadcrumb (đường dẫn phân cấp) là gì. Nên tự động tạo dựa trên cấu trúc trang. |
| `before-after` | Quá chuyên biệt. Chỉ phù hợp cho ngành làm đẹp/sửa chữa — không phải là xu hướng phổ thông của SME Malaysia. |

#### Chiến lược "Mega-block" với nhiều Biến thể (Variants)

Thay vì tạo nhiều block rời rạc có chức năng gần giống nhau:

```
TRƯỚC (3 block riêng biệt):             SAU (1 mega-block, nhiều biến thể):
├── gallery        (6 biến thể)        ├── gallery
├── gallery-masonry (3 biến thể)       │   ├── biến thể: lưới (grid)
├── carousel       (3 biến thể)        │   ├── biến thể: xếp gạch (masonry)
                                       │   ├── biến thể: trình chiếu (carousel)
                                       │   ├── biến thể: ô sáng (lightbox)
                                       │   ├── biến thể: cuộn phim (filmstrip)
                                       │   └── biến thể: căn đều (justified)
```

**Lợi ích:**
- AI dễ học hơn (ít tên block hơn → ít sai sót hơn).
- Người dùng dễ hiểu hơn (chỉ cần biết 1 block "Gallery" với nhiều kiểu hiển thị).
- Mã nguồn dễ bảo trì hơn (chia sẻ logic chung, cùng 1 sơ đồ dữ liệu).

**Các ứng dụng hợp nhất trong tương lai:**

| Mega-block | Hợp nhất từ | Các biến thể gộp lại |
|------------|----------|--------------|
| `gallery` | gallery + gallery-masonry + carousel | grid, masonry, carousel, lightbox, filmstrip, justified, cards, testimonials |
| `pricing` | pricing + pricing-table + feature-comparison | cards, table, toggle, comparison, horizontal, tiered |
| `faq` | faq + accordion | accordion, grid, simple, bordered, separated, flush |
| `testimonials` | testimonials + social-proof | cards, carousel, masonry, spotlight, minimal, grid |

> **Lưu ý:** Việc hợp nhất Mega-block là giai đoạn 2. Giai đoạn 1 (cờ hiển thị visibility) cần được thực hiện trước để sửa lỗi AI ngay lập tức.

---

## 6. Tổng kết

| Phân loại | Số lượng | Danh sách block |
|-----------|----------|--------|
| **Hiện hữu (Bảng Thư viện)** | **30** | hero, cta, about, features, step-process, service-cards, faq, testimonials, social-proof, portfolio-grid, gallery, video, carousel, pricing, feature-comparison, menu-food, products-grid, products-featured, cartWidget, contact, newsletter, whatsapp-button, stats, logo-cloud, socialWidget, team, navigation, footer, divider, announcement-bar |
| **Ẩn — Trùng chức năng** | 4 | gallery-masonry, pricing-table, accordion, client-logos |
| **Ẩn — Ngoài phạm vi** | 1 | custom-html |
| **Ẩn — Gây nhầm lẫn** | 3 | breadcrumb, video-background, before-after |
| **Ẩn — Thiếu backend** | 4 | blog-list, download-cta, google-maps, countdown-timer |
| **Ẩn — Ngành v2.0** | 8 | menu-display, booking-widget, class-schedule, review-cards, video-showcase, doctor-profile, property-card, product-quick-view |
| **Tổng cộng** | **50** | |
