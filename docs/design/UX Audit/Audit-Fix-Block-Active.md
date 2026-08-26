# Kiểm toán & Tối ưu 31 Block Active — ECH Prime Web v2

> **Ngày bắt đầu:** 2026-04-22
> **Tác giả:** Đội ngũ UX / Sản phẩm
> **Phạm vi:** Ghi nhận bug và đề xuất tối ưu cho 31 block active: 2 site-level (Navigation) + 29 block Library — thứ tự category khớp với UI `BlockLibraryPanel.tsx`
> **Tệp tham chiếu:**
> - `docs/design/UX Audit/Audit-Block-Template.md` — Kết quả kiểm toán gốc
> - `src/blocks/types.ts` — BLOCK_TYPES
> - `src/components/editor/BlockLibraryPanel.tsx` — categoryConfig

---

## Cách sử dụng

Mỗi block có 3 mục:
- **Bug phát hiện** — liệt kê lỗi cụ thể (UI, logic, dữ liệu, responsive, a11y...). Gắn `[P0]` (chặn), `[P1]` (cao), `[P2]` (thường).
- **Đề xuất tối ưu** — gợi ý cải thiện (biến thể mới, preset, AI prompt, content default...).
- **Trạng thái** — `⬜ Chưa xử lý` / `🟡 Đang làm` / `✅ Xong` / `⏭️ Hoãn`.

Khi xong 1 block → cập nhật trạng thái + link PR/issue.

> **Ghi chú:** `navigation` (header) và `footer` là site-level — render tự động trên mọi page, không thuộc Block Library. Audit riêng tại section **0. Navigation** ngay bên dưới.

---

## 0. Navigation (2 block — site-level)

> Header + Footer — render tự động mọi page, không kéo-thả từ Library. Ưu tiên audit trước vì ảnh hưởng toàn site.

### 1. `navigation`
- **Nguồn:** `src/blocks/navigation/config.ts` — implement tại `src/blocks/navigation/index.tsx`
**1.1 Chuẩn hoá lại variants — Số lượng đề xuất: 6 variants (tối ưu)**

| # | Variant | Mô tả | Use case |
|---|---------|-------|----------|
| 1 | `default` | Thanh điều hướng ngang tiêu chuẩn — logo trái, menu phải, dropdown cơ bản | Website / SaaS / Landing phổ biến |
| 2 | `centered` | Logo ở giữa, menu chia 2 bên cân đối | Website branding / aesthetic |
| 3 | `mega` | Thanh ngang với mega menu nhiều cột | Website có nhiều danh mục / eCommerce |
| 4 | `transparent` | Navigation nền trong suốt, overlay trên hero, thường kèm sticky | Landing page / Hero-first |
| 5 | `sidebar` | Navigation dạng thanh bên (vertical) | Dashboard / CRM / App |
| 6 | `floating` | Navigation dạng nổi (blur + bo tròn), thường sticky | Website hiện đại / UI premium |

👉 Mapping từ variant cũ → variant mới:
- `simple` → `default`
- `centered` → giữ
- `mega-menu` → `mega` (chuẩn hoá tên)
- `transparent` → giữ
- `sidebar` → giữ
- `pill` → `floating` (gộp + nâng cấp với blur effect)


#### Bug phát hiện
- **[P0]** Thiếu 4 variant: `simple` / `mega-menu` / `transparent` / `sidebar` (chưa hiển thị/áp dụng được)
- **[P0]** Apply variant chưa được trên CMS cho header (bao gồm cả edit CTA trên menu)
- **[P1]** Variant `transparent` → bị đè lên block khác (z-index / background chưa xử lý)
- **[P1]** Variant `pill` lỗi layout
- **[P1]** Chưa có sticky behavior consistent giữa các variant
- **[P2]** Responsive chưa tối ưu (menu mobile chưa rõ pattern)

#### Đề xuất tối ưu
- **[P0]** Refactor toàn bộ navigation sang config-driven (layout / style / behavior tách riêng)
- **[P0]** Cập nhật các variant lên CMS, thêm mục edit CTA trên menu
- **[P1]** Chuẩn hóa responsive:
  - Mobile menu → drawer
  - Desktop → dropdown / mega
- **[P1]** Thêm sticky + shrink on scroll
- **[P2]** Thêm support click trigger

#### Kết quả kỳ vọng sau refactor
| Trước | Sau |
|-------|-----|
| 6 variant (mix role: layout + style + behavior) | 6 variant chuẩn hoá (1 use case rõ ràng/variant) |
| Hard-coded logic | Config-driven (menu / style / behavior / density tách riêng) |
| Khó maintain | Dễ scale |
| UX inconsistent | Consistent system |

- **Trạng thái:** ⬜ Chưa xử lý

### 2. `footer`
- **Nguồn:** `src/blocks/footer/config.ts:12` — implement tại `src/blocks/footer/index.tsx:278–493`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `simple` | Chân trang cơ bản (mặc định) — 1 dòng logo + copyright |
  | 2 | `expanded` | Nhiều cột links + logo + tagline + social |
  | 3 | `minimal` | Tối giản — chỉ copyright + vài link quan trọng |
  | 4 | `centered-stack` | Logo + links + social căn giữa, xếp chồng dọc |
  | 5 | `mega-footer` | Chân trang lớn nhiều cột |
  | 6 | `dark-gradient` | Nền gradient tối, chữ sáng, nổi bật |
- **Biến thể cần bỏ vì dính Block Newsletter (có thể thêm ở Body rồi):**
  | # | Biến thể | Lý do |
  |---|----------|-------|
  | 2 | `expanded` | Nhiều cột links + logo + tagline + social |
  | 5 | `mega-footer` | Chân trang lớn nhiều cột, có newsletter form |
- **Trạng thái:** ⬜ Chưa xử lý

---

## 1. Basic (6 block)

### 1. `Hero`
- **Nguồn:** `src/blocks/hero/config.ts:26`
- **Biến thể hiện có (12):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `centered` | Headline + CTA căn giữa, nền ảnh/gradient (mặc định) |
  | 2 | `split-left` | Text bên trái, ảnh bên phải |
  | 3 | `split-right` | Ảnh bên trái, text bên phải |
  | 4 | `fullscreen` | Ảnh nền full màn hình, text overlay |
  | 5 | `video` | Video nền autoplay, text overlay |
  | 6 | `magazine` | Bố cục kiểu tạp chí — headline lớn + thumbnails |
  | 7 | `minimal` | Tối giản — chỉ headline + 1 CTA, không ảnh |
  | 8 | `cards-overlay` | Hero + cards nổi chồng lên phần dưới |
  | 9 | `gradient` | Nền gradient preset (aurora/sunset/ocean/forest) |
  | 10 | `parallax` | Ảnh nền với hiệu ứng parallax khi scroll |
  | 11 | `slideshow` | Slideshow nhiều ảnh tự chuyển |
  | 12 | `split-video` | Text một bên, video một bên |
- **Bug phát hiện:**
  - [Variant `split-right` có trên UI nhưng không hoạt động]
  - [Variant `video` không upload file lên được]
  - [Xóa hết button trong hero thì chưa có chỗ nào để thêm lại button]
  - [Variant `parallax` / `slideshow` giống nhau về layout]
- **giải pháp xử lý bug:**
  - [P0] Fix split-right không hoạt động
    - Kiểm tra mapping variant → layout component
    - Fallback về split-left nếu thiếu config
    - Thêm unit test cho 2 layout split
  - [P0] Fix upload video cho variant video
    - Bổ sung field upload (MP4 / embed URL) trong CMS
    - Validate format + size file
    - Thêm fallback poster khi chưa có video
  - [P0] Không thêm lại được button sau khi xóa
    - Thêm CTA manager (add/remove dynamic button)
    - Có preset CTA mặc định (ít nhất 1 button)
    - UI: “+ Add CTA” luôn visible
  - [P1] parallax và slideshow trùng layout
    - Gộp về 1 layout background-media
    - Tách effect thành option:
      - effect: parallax | slideshow | static
  - [P1] Chuẩn hóa cấu trúc variant
    - Tách:
      - layout: centered | split | fullscreen | minimal
      - media: image | video | slideshow
      - effect: none | parallax
    - Giảm phụ thuộc hard-code variant
  - [P2] Tối ưu CMS UX
    - Preview realtime khi đổi variant
    - Disable option không compatible (vd: slideshow + minimal)
    - Tooltip giải thích từng kiểu hero
  - [P2] Fallback & empty state
    - Thiếu media → fallback gradient/image default
    - Thiếu CTA → auto generate CTA mẫu
- **Trạng thái:** ⬜ Chưa xử lý

### 2. `CTA`
- **Nguồn:** `src/blocks/cta/config.ts:20`
- **Biến thể hiện có (8):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `banner` | Dải ngang full-width, headline + CTA (mặc định) |
  | 2 | `inline` | Gọn trong dòng, phù hợp chèn giữa nội dung |
  | 3 | `card` | Card căn giữa có shadow, nổi bật trên nền |
  | 4 | `floating-sticky` | Nút nổi cố định góc dưới phải khi scroll |
  | 5 | `image-bg` | Nền ảnh lớn, text + CTA overlay |
  | 6 | `split-testimonial` | Chia đôi: CTA một bên + testimonial một bên |
  | 7 | `dark-card` | Card nền tối, chữ sáng, tương phản mạnh |
  | 8 | `mesh-gradient-hero` | Nền mesh gradient sặc sỡ, phong cách hero |
- **Bug phát hiện:**
  - [Xóa hết button trong cta thì chưa có chỗ nào để thêm lại button]
  - [khi kéo component vào template trên CMS bị lỗi hiển thị sai, và không thấy variant nào ]
- **Đề xuất tối ưu:**
  - [P0] Fix CTA manager (add/remove dynamic button)
  - [P0] Có preset CTA mặc định (ít nhất 1 button)
  - [P0] UI: “+ Add CTA” luôn visible
  - [P0] Fix lỗi hiển thị sai khi kéo component vào template trên CMS
- **Trạng thái:** ⬜ Chưa xử lý

### 3. `About`
- **Nguồn:** `src/blocks/about/config.ts:21`
- **Biến thể hiện có (7):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `simple` | Đoạn mô tả đơn giản + ảnh tùy chọn (mặc định) |
  | 2 | `split` | Text một bên, ảnh một bên (2 cột) |
  | 3 | `story` | Timeline câu chuyện theo năm/mốc |
  | 4 | `two-column` | 2 cột text, không có ảnh chính |
  | 5 | `founder-quote` | Nổi bật câu nói của founder kèm ảnh chân dung |
  | 6 | `centered-large` | Headline lớn căn giữa, text ngắn gọn |
  | 7 | `image-overlay` | Ảnh nền lớn, text overlay phía trên |


### 4. `Features`
- **Nguồn:** `src/blocks/features/config.ts:21`
- **Biến thể hiện có (8):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid-2` | Lưới 2 cột — ít feature, mô tả dài |
  | 2 | `grid-3` | Lưới 3 cột (mặc định) — cân đối nhất |
  | 3 | `grid-4` | Lưới 4 cột — nhiều feature, mô tả ngắn |
  | 4 | `list` | Danh sách dọc, icon trái + text phải |
  | 5 | `icon-top` | Icon phía trên, text bên dưới mỗi card |
  | 6 | `icon-left` | Icon bên trái, text bên phải mỗi item |
  | 7 | `zigzag` | Text-image xen kẽ trái-phải theo hàng |
  | 8 | `carousel` | Trượt ngang khi nhiều feature |


### 5. `Step Process`
- **Nguồn:** `src/blocks/step-process/config.ts:20`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `vertical` | Các bước xếp dọc, đường nối chạy từ trên xuống (mặc định) |
  | 2 | `horizontal` | Các bước xếp ngang, đường nối trái-sang-phải |
  | 3 | `alternating` | Các bước xen kẽ hai bên đường nối trung tâm |
- **Bug phát hiện:**
  - [Chưa có tính năng thêm/bớt item]
- **Đề xuất tối ưu:**
  - [P0] Chưa có tính năng thêm/bớt item
    - Thêm Step manager (add / remove / reorder step) trong CMS
    - Luôn có nút “+ Add Step” ở cuối list  
    - Cho phép drag & drop để sắp xếp thứ tự
  - [P1] Chuẩn hóa data structure
    - Mỗi step gồm: title, description, icon/image, status
    - Validate tối thiểu ≥ 2 step để đảm bảo layout hiển thị đúng
  - [P1] Đồng bộ layout behavior
    - horizontal → auto scroll khi nhiều step
    - alternating → fallback về vertical trên mobile
  - [P2] Tối ưu CMS UX
    - Preview realtime khi thêm/xóa step
    - Highlight step đang edit
    - Empty state: hiển thị skeleton + gợi ý nội dung mẫu
  - [P2] Fallback
    - Nếu không có data → auto generate 3 step mẫu (vd: Step 1–3)
- **Trạng thái:** ⬜ Chưa xử lý

### 6. `Service Cards`
- **Nguồn:** `src/blocks/service-cards/config.ts:26`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid` | Lưới card đều nhau, icon + giá + CTA (mặc định) |
  | 2 | `list` | Danh sách dọc, mỗi service một hàng dài |
  | 3 | `featured` | 1 service nổi bật lớn + các service phụ nhỏ |
- **Bug phát hiện:**
  - [Không hiển thị giá trị lên UI, rỗng hoàn toàn]
- **Đề xuất tối ưu:**
  - [P0] Không hiển thị giá trị lên UI
    - Kiểm tra binding data (props ↔ config ↔ CMS) cho field service
    - Đảm bảo mapping đúng: title, description, price, icon/image, cta
    - Thêm fallback render (hiển thị placeholder nếu data rỗng thay vì blank)
  - [P0] Validate data từ CMS
    - Bắt buộc ít nhất title trước khi render
    - Log warning khi thiếu field quan trọng (price / CTA)
  - [P1] Đồng bộ schema giữa variant
    - Tất cả variant (grid, list, featured) dùng chung 1 data structure
    - Tránh mỗi variant đọc field khác nhau gây mất dữ liệu
  - [P1] Fix render condition
    - Tránh condition kiểu if (!data) return null → gây trắng UI
    - Thay bằng skeleton / empty state
  - [P2] Tối ưu CMS UX
    - Preview realtime khi nhập dữ liệu
    - Highlight field đang thiếu (price / CTA)
    - Có preset sample data để test nhanh UI
  - [P2] Fallback
    - Nếu thiếu data → auto render 3 service mẫu (demo content)
- **Trạng thái:** ⬜ Chưa xử lý

---

## 2. Content (5 block)

### 7. `FAQ`
- **Nguồn:** `src/blocks/faq/config.ts:37`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `accordion` | Accordion mở rộng từng item khi click (mặc định) |
  | 2 | `grid` | Lưới câu hỏi — hiện sẵn cả hỏi + đáp |
  | 3 | `simple` | Danh sách dọc tối giản, không có nút bấm |
  | 4 | `two-column-accordion` | Accordion chia 2 cột song song |
  | 5 | `chat-bubbles` | Dạng bong bóng chat — hỏi/đáp như tin nhắn |
  | 6 | `numbered` | Danh sách đánh số thứ tự 01, 02, 03... |
- **Bug phát hiện:**
  - [Chưa thêm/bớt item được]
- **Đề xuất tối ưu:**
  - [P0] Chưa có tính năng thêm/bớt item
    - Thêm FAQ manager (add / remove / reorder item)
    - Luôn có nút “+ Add FAQ” ở cuối list
    - Cho phép drag & drop để sắp xếp thứ tự
  - [P1] Chuẩn hóa data structure
    - Mỗi FAQ gồm: question, answer, icon/image, status
    - Validate tối thiểu ≥ 2 FAQ để đảm bảo layout hiển thị đúng
  - [P1] Đồng bộ layout behavior
    - horizontal → auto scroll khi nhiều FAQ
    - alternating → fallback về vertical trên mobile
  - [P2] Tối ưu CMS UX
    - Preview realtime khi thêm/xóa FAQ
    - Highlight FAQ đang edit
    - Empty state: hiển thị skeleton + gợi ý nội dung mẫu
  - [P2] Fallback
    - Nếu không có data → auto generate 3 FAQ mẫu (vd: FAQ 1–3)
- **Trạng thái:** ⬜ Chưa xử lý

### 8. `Testimonials`
- **Nguồn:** `src/blocks/testimonials/config.ts:8`
- **Biến thể hiện có (10):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `cards` | Lưới card có avatar + quote + rating (mặc định) |
  | 2 | `carousel` | Trượt ngang, tự động chuyển |
  | 3 | `simple` | Danh sách quote tối giản, không avatar |
  | 4 | `masonry` | Lưới masonry chiều cao không đều |
  | 5 | `spotlight` | 1 quote lớn nổi bật + thumbnails các quote khác |
  | 6 | `minimal-quote` | Chỉ quote và tên, tối giản |
  | 7 | `avatar-row` | Hàng ngang avatar + quote ngắn |
  | 8 | `video-text` | Video testimonial kèm trích dẫn |
  | 9 | `grid` | Lưới đều — nhiều testimonial |
  | 10 | `single` | Chỉ 1 testimonial lớn — dạng spotlight đơn |
- **Bug phát hiện:**
  - [Variant `cards` / `grid` / `masonry` / `single` giống nhau về layout]
- **Đề xuất tối ưu:**
  - [P0] Variant trùng layout (cards / grid / masonry / single)
    - Gộp về 1 layout chính: grid
    - Tách option:
      - columns: 1 | 2 | 3
      - style: default | masonry | spotlight
      - single → chỉ là grid với columns = 1
  - [P1] Chuẩn hóa cấu trúc variant
    - Tách:
      - layout: grid | carousel | list
      - content: text | video
      - highlight: none | spotlight
    - Tránh tạo variant mới chỉ vì khác presentation nhỏ
  - [P1] Đồng bộ data structure
    - Mỗi testimonial: name, avatar, quote, rating, video?
     - Variant không được phụ thuộc field khác nhau
  - [P2] Tối ưu CMS UX
    - Preview realtime khi đổi layout/style
    - Ẩn option không phù hợp (vd: video nếu chưa có link)
    - Tooltip giải thích từng kiểu hiển thị
  - [P2] Fallback
    - Nếu chỉ có 1 item → auto dùng spotlight
    - Nếu thiếu avatar → fallback initials / placeholder image
- **Trạng thái:** ⬜ Chưa xử lý

### 9. `Social Proof`
- **Nguồn:** `src/blocks/social-proof/config.ts:7`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `cards` | Card review có avatar, rating sao, nội dung (mặc định) |
  | 2 | `minimal` | Chỉ rating + tên, bố cục tối giản |
  | 3 | `grid` | Lưới review đều nhau, nhiều review hiển thị cùng lúc |
- **Bug phát hiện:**
  - [Không hiển thị giá trị lên UI, rỗng hoàn toàn]
  - [3 variant giống nhau về layout]
- **Đề xuất tối ưu:**
  - [P0] Fix không hiển thị dữ liệu
    - Đảm bảo luôn render wrapper UI (không return null khi thiếu data)
    - Hiển thị placeholder cho từng field:
      - avatar → avatar mặc định
      - name → “Customer”
      - content → text mẫu
      - rating → default 5 sao
  - [P1] Tăng khả năng phân biệt giữa các variant (UI level)
    - cards → thêm shadow + border + spacing rõ ràng
    - grid → layout phẳng, không shadow, focus vào số lượng
    - minimal → giảm padding, font nhỏ hơn, bỏ avatar
  - [P1] Chuẩn hóa spacing & typography
    - Đồng bộ khoảng cách giữa item
    - Giới hạn số dòng text (2–3 line clamp) để tránh vỡ layout
    - Scale font theo variant (cards > grid > minimal)
  - [P2] Responsive
    - Mobile: auto về 1 cột
    - Tablet: 2 cột
    - Desktop: theo config (3–4 cột)
  - [P2] Empty & loading state
    - Có skeleton loading thay vì trắng
    - Empty state: hiển thị block mẫu + hint “Add review”
  - [P2] Micro interaction
    - Hover nhẹ (scale / shadow) cho cards
    - Transition khi load list (fade-in)
- **Trạng thái:** ⬜ Chưa xử lý

### 10. `Portfolio Grid`
- **Nguồn:** `src/blocks/portfolio-grid/config.ts:22`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid` | Lưới đều với hover overlay tiêu đề (mặc định) |
  | 2 | `masonry` | Lưới masonry chiều cao khác nhau theo ảnh |
  | 3 | `showcase` | 1 dự án lớn nổi bật + các dự án phụ xếp bên |
- **Bug phát hiện:**
  - [UI của variant `masonry` và `showcase` lỗi]
- **Đề xuất tối ưu:**
  - [P0] Fix layout masonry bị lỗi
    - Chuẩn hóa aspect ratio ảnh (auto crop / object-fit: cover)
    - Dùng CSS grid + auto row height thay vì render tự do
    - Fallback về grid nếu thiếu số lượng ảnh tối thiểu
  - [P0] Fix layout showcase bị vỡ
    - Ép tỷ lệ ảnh chính (hero item) cố định (vd: 16:9 hoặc 4:3)
    - Giới hạn số item phụ (max 3–4) để tránh lệch layout
    - Nếu thiếu item → auto duplicate hoặc fill bằng placeholder  
  - [P1] Gen thêm ảnh để cân layout
    - Auto duplicate ảnh khi < required items
    - Hoặc generate placeholder image (blur/gradient) để fill slot trống
  - [P1] Kiểm soát số lượng item theo variant
    - grid → ≥ 4 item
    - masonry → ≥ 6 item
    - showcase → ≥ 3 item
    - Nếu không đủ → hiển thị warning trong CMS
  - [P2] Tối ưu hiển thị ảnh
    - Lazy load + skeleton khi loading
    - Hover overlay consistent (title + gradient overlay)
    - Giới hạn text (truncate 1–2 dòng)
  - [P2] Responsive
    - masonry → fallback về grid trên mobile
    - showcase → stack dọc (hero → items dưới)
- **Trạng thái:** ⬜ Chưa xử lý

### 11. `Blog List`
- **Nguồn:** `src/blocks/blog-list/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `cards` | Lưới card bài viết — ảnh cover + tiêu đề + mô tả (mặc định) |
  | 2 | `list` | Danh sách dọc — ảnh thumbnail nhỏ + tiêu đề + excerpt |

---

## 3. Media (3 block)

### 12. `Gallery`
- **Nguồn:** `src/blocks/gallery/config.ts:6`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid` | Lưới ô vuông đều nhau (mặc định) |
  | 2 | `masonry` | Lưới masonry chiều cao khác nhau |
  | 3 | `carousel` | Trượt ngang xem từng ảnh |
  | 4 | `lightbox` | Click ảnh mở xem full màn hình |
  | 5 | `filmstrip` | Dạng cuộn phim — hàng ngang cuộn ngang |
  | 6 | `justified` | Các hàng được căn đều 2 lề, ảnh co theo |
- **Bug phát hiện:**
  - [Do lỗi gen ảnh nên các variant hiển thị chưa đúng]
- **Đề xuất tối ưu:**
  - [P0] Fix lỗi gen ảnh gây vỡ layout
    - Chuẩn hóa image input: luôn đảm bảo aspect ratio hợp lệ (1:1, 4:3, 16:9)
    - Auto fallback image khi ảnh bị null / lỗi load
    - Preload ảnh trước khi render layout
  - [P0] Đảm bảo đủ số lượng ảnh theo variant
    - grid → ≥ 6 ảnh
    - masonry → ≥ 8 ảnh
    - carousel → ≥ 3 ảnh
    - justified → ≥ 6 ảnh
    - Nếu thiếu → auto fill placeholder image
  - [P1] Fix layout break khi thiếu/ lỗi ảnh
    - Không allow empty slot (tránh gap trong masonry / justified)
    - Replace broken image bằng skeleton + fallback asset
  - [P1] Chuẩn hóa image rendering
    - Dùng object-fit: cover cho tất cả variant
    - Lazy load + blur placeholder để tránh layout shift
  - [P2] Tối ưu UX khi hiển thị
    - Loading state riêng cho từng image
    - Smooth fade-in khi ảnh load xong
    - Lightbox chỉ trigger khi ảnh đã load hoàn toàn
  - [P2] CMS guard
    - Warning khi upload không đủ số ảnh cho variant
    - Auto suggest thêm ảnh mẫu khi thiếu data
  - [P2] Consistency hiển thị
    - Đồng nhất spacing giữa các variant
    - Giữ ratio ổn định để tránh layout nhảy khi load ảnh
- **Trạng thái:** ⬜ Chưa xử lý

### 13. `Video`
- **Nguồn:** `src/blocks/video/config.ts:5`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `embed` | Video nhúng (YouTube/Vimeo/MP4), có poster (mặc định) |
  | 2 | `background` | Video autoplay làm nền, text overlay ở trên |


### 14. `Carousel`
- **Nguồn:** `src/blocks/carousel/config.ts:22`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `images` | Carousel chỉ ảnh, có autoplay (mặc định) |
  | 2 | `cards` | Carousel các card có tiêu đề + mô tả + link |
  | 3 | `testimonials` | Carousel trích dẫn khách hàng |

---

## 4. Business (3 block)

### 15. `Pricing`
- **Nguồn:** `src/blocks/pricing/config.ts:8`
- **Biến thể hiện có (8):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `cards` | Các card gói song song, gói giữa highlight (mặc định) |
  | 2 | `table` | Bảng so sánh chi tiết dòng/cột |
  | 3 | `horizontal` | Các gói xếp ngang trong 1 card dài |
  | 4 | `toggle` | Có toggle tháng/năm chuyển đổi giá |
  | 5 | `tiered` | Dạng bậc thang — gói thấp đến cao |
  | 6 | `comparison` | Bảng so sánh feature giữa các gói |
  | 7 | `minimal` | Tối giản — chỉ giá + CTA |
  | 8 | `slider` | Slider chọn mức dùng → giá động |
- **Bug phát hiện:**
  - [Chưa thêm/bớt được item]
  - [Variant `toggle` lỗi button]
- **Đề xuất tối ưu:**
  - [P0] Chưa thêm/bớt được item (pricing plan)
    - Thêm pricing manager trong CMS (add / remove / reorder plan)
    - Bắt buộc có tối thiểu 1 plan để tránh empty state
    - Hỗ trợ drag & drop reorder giữa các gói
  - [P0] Fix lỗi button trong toggle
    - Kiểm tra state toggle (monthly / yearly) không bị reset khi re-render
    - Chuẩn hóa binding price theo key: price.monthly, price.yearly
    - Fix UI button active state (highlight đúng mode hiện tại)
  - [P1] Chuẩn hóa data structure
    - Mỗi plan thống nhất field:
    - title, price, features[], cta, badge?
    - Tránh variant nào đọc field riêng → gây mismatch UI
  - [P1] Fix render stability
    - Không hide toàn bộ block khi thiếu data → dùng fallback card
    - Giữ layout ổn định khi toggle giá (không jump layout)
  - [P2] UX cải thiện hiển thị
    - Highlight plan recommended rõ ràng hơn (badge + scale)
    - Animate price transition khi toggle
    - Clamp feature list (tránh card dài lệch nhau)
  - [P2] CMS guard
    - Warning khi plan thiếu price hoặc CTA
    - Tooltip hướng dẫn toggle setup đúng format
  - [P2] Responsive
    - Mobile: chuyển cards → swipeable carousel
    - Desktop: giữ layout grid consistent theo variant
- **Trạng thái:** ⬜ Chưa xử lý

### 16. `Feature Comparison`
- **Nguồn:** `src/blocks/feature-comparison/config.ts:8`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `table` | Bảng ma trận — sản phẩm cột, tính năng dòng (mặc định) |
  | 2 | `cards` | Các card sản phẩm song song, liệt kê feature dọc |
- **Bug phát hiện:**
  - [Hiển thị rỗng data]
- **Đề xuất tối ưu:**
  - [P0] Hiển thị rỗng data
    - Kiểm tra mapping dữ liệu giữa CMS → config → UI component
    - Đảm bảo luôn có fallback render (không return null khi thiếu data)
    - Thêm placeholder cho:
     - product name
     - feature cell (✔ / ✖ / “—”)
  - [P0] Chuẩn hóa data structure
   - Bắt buộc format:
     - products[]
     - features[]
     - matrix[product][feature]
   - Validate data trước khi render table/cards
  - [P1] Fix render cho từng variant
    - table → fallback empty cell thay vì blank
    - cards → luôn render card wrapper dù feature list rỗng
    - Không allow UI “trắng toàn bộ” khi thiếu data
  - [P1] Đồng bộ hiển thị giữa 2 variant
    - Cùng 1 nguồn data, chỉ khác cách render
    - Tránh case cards có data nhưng table bị rỗng
  - [P2] UX cải thiện hiển thị
    - Highlight feature “available / not available” rõ ràng (icon ✔ ✖)
    - Sticky header cho table khi scroll
    - Clamp text trong card để tránh vỡ layout
  - [P2] CMS guard
    - Warning khi thiếu products hoặc features
    - Suggest auto-generate sample comparison data
  - [P2] Empty state
    - Hiển thị skeleton comparison table thay vì blank screen
    - Message: “No comparison data available” + CTA add data
- **Trạng thái:** ⬜ Chưa xử lý

### 17. `Food Menu`
- **Nguồn:** `src/blocks/menu-food/config.ts:27`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `classic` | Menu truyền thống — tên món + giá, có dòng chấm nối (mặc định) |
  | 2 | `cards` | Mỗi món là 1 card có ảnh, mô tả, giá |
  | 3 | `minimal` | Tối giản — chỉ tên + giá, không ảnh |
- **Bug phát hiện:**
  - [Chưa thêm/bớt được item]
- **Đề xuất tối ưu:**
  - [P0] Chưa thêm/bớt được item (menu item)
    - Thêm menu manager trong CMS (add / remove / reorder items)
    - Bắt buộc có tối thiểu 1 item để tránh empty state
    - Hỗ trợ drag & drop reorder giữa các món
  - [P0] Fix lỗi button trong toggle
    - Kiểm tra state toggle (monthly / yearly) không bị reset khi re-render
    - Chuẩn hóa binding price theo key: price.monthly, price.yearly
    - Fix UI button active state (highlight đúng mode hiện tại)
  - [P1] Chuẩn hóa data structure
    - Mỗi plan thống nhất field:
    - title, price, features[], cta, badge?
    - Tránh variant nào đọc field riêng → gây mismatch UI
  - [P1] Fix render stability
    - Không hide toàn bộ block khi thiếu data → dùng fallback card
    - Giữ layout ổn định khi toggle giá (không jump layout)
  - [P2] UX cải thiện hiển thị
    - Highlight plan recommended rõ ràng hơn (badge + scale)
    - Animate price transition khi toggle
    - Clamp feature list (tránh card dài lệch nhau)
  - [P2] CMS guard
    - Warning khi plan thiếu price hoặc CTA
    - Tooltip hướng dẫn toggle setup đúng format
  - [P2] Responsive
    - Mobile: chuyển cards → swipeable carousel
    - Desktop: giữ layout grid consistent theo variant
- **Trạng thái:** ⬜ Chưa xử lý

---

## 5. Commerce (3 block)

### 18. `Products Grid`
- **Nguồn:** `src/blocks/products-grid/config.ts:6`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid-3` | Lưới 3 cột sản phẩm (mặc định) |
  | 2 | `grid-4` | Lưới 4 cột — phù hợp catalog nhiều sản phẩm |
  | 3 | `list` | Danh sách dọc, mỗi sản phẩm 1 hàng rộng |
- **Bug phát hiện:**
  - [Chưa thêm/bớt được item]
- **Đề xuất tối ưu:**
  - [P0] Chưa thêm/bớt được item (product list)
    - Thêm product manager trong CMS (add / remove / reorder product)
    - Luôn có nút “+ Add Product”
    - Hỗ trợ drag & drop reorder sản phẩm
  - [P0] Chuẩn hóa data structure
    - Mỗi product thống nhất:
     - name, price, image, description?, cta?, badge?
    - Validate bắt buộc name + price trước khi render
  - [P1] Fix hiển thị theo variant
    - grid-3 → đảm bảo card equal height (tránh lệch layout)
    - grid-4 → auto shrink text + image ratio chuẩn
    - list → align price + CTA consistent ở bên phải
  - [P1] Đồng bộ layout behavior
    - Giữ consistency spacing giữa card/list item
    - Clamp description (2–3 lines) để tránh vỡ grid
  - [P2] UX cải thiện hiển thị
    - Hover state cho product card (shadow + scale nhẹ)
    - Badge (sale/new) hiển thị nhất quán
    - Skeleton loading khi fetch data
  - [P2] CMS guard
    - Warning khi thiếu image hoặc price
    - Suggest auto-fill product mẫu khi list rỗng
  - [P2] Empty state
    - Hiển thị “No products yet” + CTA “Add product”
    - Không render blank grid/list khi data empty
- **Trạng thái:** ⬜ Chưa xử lý

### 19. `Featured Products`
- **Nguồn:** `src/blocks/products-featured/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `hero-product` | 1 sản phẩm lớn nổi bật kiểu hero, ảnh lớn + CTA (mặc định) |
  | 2 | `carousel` | Trượt ngang nhiều sản phẩm nổi bật |
- **Bug phát hiện:**
  - [Variant `carousel` chưa có slide]
  - [Cần optimize thêm/bớt item trong variant `carousel`]
- **Đề xuất tối ưu:**
  - [P0] Variant carousel chưa có slide
    - Kiểm tra logic render slider (map items → slide component)
    - Đảm bảo mỗi product item được wrap đúng CarouselSlide
    - Fix missing key / index gây fail render list
    - Thêm fallback: nếu chỉ 1 item → fallback sang hero-product
  - [P0] Carousel không đủ item hiển thị
    - Require tối thiểu 2–3 items để activate carousel mode
    - Nếu < min items → auto switch sang grid-like hero layout
  - [P1] Optimize thêm/bớt item trong carousel
    - Thêm CMS manager: add / remove / reorder product
    - Sync realtime khi thay đổi data (không cần reload block)
    - Hỗ trợ drag & drop reorder slides
  - [P1] Fix UX carousel behavior
    - Auto loop + infinite scroll (nếu đủ item)
    - Responsive:
      - mobile: 1 slide
      - tablet: 2 slide
      - desktop: 3–4 slide
  - [P2] Đồng bộ data structure
    - Giữ unified product schema với Products Grid
    - Không tách field riêng cho carousel
  - [P2] UX cải thiện hiển thị
    - Add skeleton loading cho slide
    - Smooth transition (fade + slide animation)
    - Disable swipe khi loading
  - [P2] CMS guard
    - Warning khi < 2 products trong carousel mode
    - Suggest switch sang hero-product nếu data ít
  - [P2] Fallback
    - Nếu render fail → fallback sang single hero product
    - Không để carousel blank UI
- **Trạng thái:** ⬜ Chưa xử lý

### 20. `Cart Button`
- **Nguồn:** `src/blocks/cart-widget/config.ts:13`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `floating` | Nút giỏ hàng nổi cố định góc dưới phải (mặc định) |
  | 2 | `inline` | Nút giỏ hàng inline trong layout (thường trong header) |
- **Bug phát hiện:**
  - [Lỗi không hiển thị data, UI hiển thị error]
- **Đề xuất tối ưu:**
  - [P0] Lỗi không hiển thị data / UI error
    - Kiểm tra state cart source (store / context / API sync)
    - Đảm bảo luôn có default state { items: [], count: 0, total: 0 }
    - Fix crash khi cart = null / undefined
    - Thêm error boundary cho cart widget (không làm crash toàn page)
  - [P0] Fix render condition
    - Không return error UI trực tiếp → thay bằng fallback UI
    - Luôn render button với state empty (0 items)
  - [P1] Đồng bộ data giữa variant
    - floating và inline dùng chung cart state
    - Không tách logic count/total theo variant
  - [P1] Fix UI badge
    - Badge count phải update realtime khi add/remove item
    - Clamp số lớn (vd: 99+)
  - [P2] UX cải thiện hiển thị
    - floating: thêm animation khi item được add (bounce / pulse)
    - inline: align icon + badge consistent trong header
    - Hover state rõ ràng hơn
  - [P2] CMS / config guard
    - Disable variant nếu cart feature chưa enable
    - Warning nếu missing cart provider
  - [P2] Fallback
    - Nếu cart error → hiển thị icon + “0” thay vì error UI
    - Không để UI crash hoặc blank state
- **Trạng thái:** ⬜ Chưa xử lý

---

## 6. Form & Contact (3 block)

### 21. `Contact`
- **Nguồn:** `src/blocks/contact/config.ts:7`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `form` | Form liên hệ đầy đủ các field (mặc định) |
  | 2 | `info-only` | Chỉ hiển thị email/phone/địa chỉ, không form |
  | 3 | `split` | Form một bên, thông tin/địa chỉ một bên |
  | 4 | `card-float` | Form dạng card nổi có shadow trên nền |
  | 5 | `map-split` | Form một bên, bản đồ Google Maps một bên |
  | | | > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant. |
  | 6 | `minimal-inline` | Form nhỏ gọn inline — chỉ email + nút gửi |
- **Bug phát hiện:**
  - [Variant `minimal-inline` / `split` / `form` lỗi layout chưa cân đối]
- **Đề xuất tối ưu:**
  - [P0] Fix layout mất cân đối (form, split, minimal-inline)
    - Chuẩn hóa grid system chung (12-column hoặc flex consistent)
    - Fix lệch chiều cao giữa form và info panel trong split
    - Đảm bảo form luôn có max-width + center alignment hợp lý
  - [P0] Fix minimal-inline bị vỡ layout
    - Ép input + button về 1 row với fallback wrap trên mobile
    - Set min-width cho input để tránh collapse
    - Disable overflow khi thiếu space
  - [P1] Đồng bộ spacing & alignment
    - Standardize padding giữa các variant
    - Align label/input thống nhất (không variant nào lệch baseline)
    - Giữ consistent height cho input fields
  - [P1] Responsive fix
    - split → auto stack (column → row) trên mobile
    - ~~map-split → map xuống dưới form trên mobile~~ (N/A — map-split removed per #1465, no map rendered)
    - minimal-inline → luôn stack dọc trên small screen
  - [P2] UX cải thiện hiển thị
    - Form focus state rõ ràng (highlight border)
    - Error message không làm vỡ layout
    - Loading state khi submit form
  - [P2] CMS guard
    - Warning khi thiếu required field (email/phone/map config)
    - ~~Validate map API key cho map-split~~ (N/A — map-split removed per #1465, no map rendered)
  - [P2] Fallback
    - Nếu map fail → fallback sang info-only
    - Nếu form error → giữ UI nhưng disable submit (không crash layout)
- **Trạng thái:** ⬜ Chưa xử lý

### 22. `Newsletter`
- **Nguồn:** `src/blocks/newsletter/config.ts:6`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `inline` | Form inline đơn giản — email + nút (mặc định) |
  | 2 | `popup` | Modal popup hiện lên giữa màn hình |
  | 3 | `banner` | Dải banner ngang full-width |
  | 4 | `stacked-card` | Card xếp chồng, headline + form, nổi bật |
  | 5 | `minimal` | Tối giản — chỉ 1 dòng email + mũi tên |
  | 6 | `incentive-grid` | Form + lưới các ưu đãi/lợi ích khi đăng ký |
- **Bug phát hiện:**
  - [Thêm component newsletter nhưng hiển thị component hero, nên chưa test được variant]
- **Đề xuất tối ưu:**
  - [Fix mapping sai component: Newsletter đang render nhầm Hero component]
  - [Ensure correct block registry mapping (newsletter → newsletter component)]
  - [Rebuild preview layer để test đủ 6 variants]
  - [Verify variant switch logic sau khi fix mapping]
  - [Thêm test case cho từng variant trước khi QA UI] 
- **Trạng thái:** ⬜ Chưa xử lý

### 23. `Whatsapp Button`
- **Nguồn:** `src/blocks/whatsapp-button/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `floating` | Nút WhatsApp nổi cố định góc màn hình (mặc định) |
  | 2 | `inline` | Nút WhatsApp inline trong layout/section |
- **Bug phát hiện:**
  - [Chưa có tính năng để user add link]
- **Đề xuất tối ưu:**
  - [Thêm field input phoneNumber / whatsappLink trong config CMS]
  - [Validate format số điện thoại (E.164 hoặc local format)]
  - [Auto-generate link https://wa.me/{number} nếu user chỉ nhập số]
  - [Thêm preview state trong CMS để user thấy link hoạt động]
  - [Fix binding data giữa CMS → component render (ensure prop mapping)]  
- **Trạng thái:** ⬜ Chưa xử lý

---

## 7. Widgets (4 block)

### 24. `Stats`
- **Nguồn:** `src/blocks/stats/config.ts:19`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `row` | Hàng ngang các số thống kê lớn (mặc định) |
  | 2 | `grid` | Lưới đều, số + nhãn |
  | 3 | `highlight` | 1 số nổi bật cực lớn + các số phụ nhỏ |
  | 4 | `cards` | Mỗi stat một card có border/shadow |
  | 5 | `inline-text` | Số lồng trong đoạn text mô tả |
  | 6 | `chart-bars` | Kèm biểu đồ thanh trực quan |
- **Bug phát hiện:**
  - [Không hiển thị đúng loại variant — chọn variant này nhưng hiển thị kiểu khác]
- **Đề xuất tối ưu:**
  - [Fix mapping variant → component render (đang mismatch config vs UI renderer)]
  - [Ensure switch-case / registry key đúng với 6 variants hiện có]
  - [Add fallback render state để tránh default overwrite sai layout]
  - [Clear cache / rebuild block registry sau khi update config]
  - [Add debug label hiển thị active variant trong dev mode để QA dễ verify]  
- **Trạng thái:** ⬜ Chưa xử lý

### 25. `Logo Cloud`
- **Nguồn:** `src/blocks/logo-cloud/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `row` | Các logo xếp 1 hàng ngang (mặc định) |
  | 2 | `grid` | Lưới logo nhiều hàng — phù hợp nhiều đối tác |
- **Bug phát hiện:**
  - [Không hiển thị hình ảnh]
- **Đề xuất tối ưu:**
  - [Fix image source binding (logo URL/asset đang undefined hoặc sai path)]
  - [Verify data schema: ensure logos[] có field src hoặc url đúng chuẩn]
  - [Add fallback image khi logo fail load]
  - [Check CMS upload pipeline (asset upload chưa map về block data)]
  - [Revalidate render loop (map/logos render đang trả empty array hoặc null)]  
- **Trạng thái:** ⬜ Chưa xử lý

### 26. `Social Media`
- **Nguồn:** `src/blocks/social-widget/config.ts:57`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `floating` | Cụm icon mạng xã hội nổi cố định cạnh màn hình (mặc định) |
  | 2 | `inline` | Icon mạng xã hội inline trong section (thường ở footer) |

### 27. `Team`
- **Nguồn:** `src/blocks/team/config.ts:14`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid` | Lưới avatar + tên + role (mặc định) |
  | 2 | `list` | Danh sách dọc, mỗi thành viên một hàng |
  | 3 | `cards-hover-reveal` | Card ẩn bio, hover mới hiện |
  | 4 | `horizontal-scroll` | Cuộn ngang các thành viên |
  | 5 | `bio-modal` | Click card mở modal xem bio chi tiết |
  | 6 | `compact-row` | Hàng gọn — avatar nhỏ + tên + role, nhiều người |
- **Bug phát hiện:**
  - [Variant `bio-modal` lỗi hiển thị popup trên góc trái màn hình]
  - [Chưa có tính năng thêm/bớt item]
- **Đề xuất tối ưu:**
  - [Fix modal positioning (bio-modal đang mount sai portal / thiếu center alignment)]
  - [Ensure modal uses global overlay layer + z-index system chuẩn]
  - [Fix click handler scope (card → modal data binding sai index/item)]
  - [Thêm CRUD item trong CMS (add / remove / reorder team members)]
  - [Persist team data sync giữa CMS → preview → published state]
  - [Add empty state UI khi team list rỗng để tránh layout vỡ]  
- **Trạng thái:** ⬜ Chưa xử lý

---

## 8. Layout (2 block)

### 28. `Divider`
- **Nguồn:** `src/blocks/divider/config.ts:6`
- **Biến thể hiện có (4):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `line` | Đường kẻ ngang đơn giản (mặc định) |
  | 2 | `dots` | Dấu chấm cách đều làm phân cách |
  | 3 | `wave` | Đường lượn sóng SVG |
  | 4 | `spacer` | Khoảng trắng — chỉ tạo space, không có đường |


### 29. `Announcement Bar`
- **Nguồn:** `src/blocks/announcement-bar/config.ts:6`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `gradient` | Dải thông báo nền gradient sặc sỡ (mặc định) |
  | 2 | `solid` | Nền màu đơn, chữ tương phản |
  | 3 | `minimal` | Tối giản — nền trắng/nhạt, viền mỏng |
- **Bug phát hiện:**
  - [Variant `gradient` lỗi hiển thị, không đúng với mô tả của biến thể]
- **Đề xuất tối ưu:**
  - [Fix gradient style (CSS/Token sai hoặc missing gradient preset mapping)]
  - [Verify design token mapping cho gradient variant (aurora/sunset/ocean…)]
  - [Check background override từ global layout (có thể bị header/theme override)]
  - [Ensure text contrast auto-adjust theo background gradient]
  - [Add visual test snapshot cho 3 variants để tránh regression UI]  
- **Trạng thái:** ⬜ Chưa xử lý

---

## Bảng tổng hợp tiến độ

| Danh mục | Số block | ⬜ Chưa | 🟡 Đang | ✅ Xong | ⏭️ Hoãn |
|----------|:--------:|:------:|:------:|:------:|:------:|
| 0. Navigation (site-level) | 2 | 2 | 0 | 0 | 0 |
| 1. Basic | 6 | 6 | 0 | 0 | 0 |
| 2. Content | 5 | 5 | 0 | 0 | 0 |
| 3. Media | 3 | 3 | 0 | 0 | 0 |
| 4. Business | 3 | 3 | 0 | 0 | 0 |
| 5. Commerce | 3 | 3 | 0 | 0 | 0 |
| 6. Form & Contact | 3 | 3 | 0 | 0 | 0 |
| 7. Widgets | 4 | 4 | 0 | 0 | 0 |
| 8. Layout | 2 | 2 | 0 | 0 | 0 |
| **Tổng** | **31** | **31** | **0** | **0** | **0** |
