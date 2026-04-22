# Kiểm toán & Tối ưu 30 Block Active — ECH Prime Web v2

> **Ngày bắt đầu:** 2026-04-22
> **Tác giả:** Đội ngũ UX / Sản phẩm
> **Phạm vi:** Ghi nhận bug và đề xuất tối ưu cho từng block trong số 30 block còn lại trên Bảng Thư viện (sau kiểm toán `Audit-Block-Template.md`)
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

---

## 4.0 Header & Footer mở rộng (2 block — bổ sung biến thể)

> Ưu tiên xử lý trước. Liệt kê biến thể mới đề xuất cho Header và Footer, sau đó đánh giá và đồng bộ vào registry.

### 1. `header` (registry: `navigation`)
- **Nguồn:** `src/blocks/navigation/config.ts:50` — implement tại `src/blocks/navigation/index.tsx:347–367`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `simple` | Thanh điều hướng cơ bản (mặc định) — logo trái, links phải |
  | 2 | `centered` | Logo giữa, links chia 2 bên |
  | 3 | `mega-menu` | Menu nhiều cột với dropdown lớn |
  | 4 | `transparent` | Nền trong suốt, overlay trên hero |
  | 5 | `sidebar` | Menu dạng thanh bên (vertical) |
  | 6 | `pill` | Dạng "viên thuốc" bo tròn nổi |
- **Biến thể đề xuất bổ sung:**
  - [ ] `` — mô tả:
  - [ ] `` — mô tả:
  - [ ] `` — mô tả:
- **Bug phát hiện:**
  - [ Hiện tại trên UI chưa hiển thị đủ biến thể ]
- **Đề xuất tối ưu:**
  - [ ]
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
  | 5 | `mega-footer` | Chân trang lớn nhiều cột, có newsletter form |
  | 6 | `dark-gradient` | Nền gradient tối, chữ sáng, nổi bật |

- **Bug phát hiện:**
  - [ Hiện tại trên UI chưa hiển thị đủ biến thể nên chưa test được]
- **Đề xuất tối ưu:**
  | # | Biến thể cần bỏ vì dính Block Newsletter có thể thêm ở Body rồi
  |---|----------|------------|
  | 2 | `expanded` | Nhiều cột links + logo + tagline + social |
  | 5 | `mega-footer` | Chân trang lớn nhiều cột, có newsletter form |
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.1 Cơ bản (6 block)

### 1. `hero`
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
  - [Split-right hiện tại có trên UI nhưng không hoạt động ]
  - [Video hiện tại có trên UI nhưng không upload file lên được ]
  - [ ]

- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 2. `cta`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 3. `about`
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
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 4. `features`
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
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 5. `step-process`
- **Nguồn:** `src/blocks/step-process/config.ts:20`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `vertical` | Các bước xếp dọc, đường nối chạy từ trên xuống (mặc định) |
  | 2 | `horizontal` | Các bước xếp ngang, đường nối trái-sang-phải |
  | 3 | `alternating` | Các bước xen kẽ hai bên đường nối trung tâm |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 6. `service-cards`
- **Nguồn:** `src/blocks/service-cards/config.ts:26`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid` | Lưới card đều nhau, icon + giá + CTA (mặc định) |
  | 2 | `list` | Danh sách dọc, mỗi service một hàng dài |
  | 3 | `featured` | 1 service nổi bật lớn + các service phụ nhỏ |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.2 Nội dung (4 block)

### 7. `faq`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 8. `testimonials`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 9. `social-proof`
- **Nguồn:** `src/blocks/social-proof/config.ts:7`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `cards` | Card review có avatar, rating sao, nội dung (mặc định) |
  | 2 | `minimal` | Chỉ rating + tên, bố cục tối giản |
  | 3 | `grid` | Lưới review đều nhau, nhiều review hiển thị cùng lúc |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 10. `portfolio-grid`
- **Nguồn:** `src/blocks/portfolio-grid/config.ts:22`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid` | Lưới đều với hover overlay tiêu đề (mặc định) |
  | 2 | `masonry` | Lưới masonry chiều cao khác nhau theo ảnh |
  | 3 | `showcase` | 1 dự án lớn nổi bật + các dự án phụ xếp bên |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.3 Phương tiện (3 block)

### 11. `gallery`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 12. `video`
- **Nguồn:** `src/blocks/video/config.ts:5`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `embed` | Video nhúng (YouTube/Vimeo/MP4), có poster (mặc định) |
  | 2 | `background` | Video autoplay làm nền, text overlay ở trên |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 13. `carousel`
- **Nguồn:** `src/blocks/carousel/config.ts:22`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `images` | Carousel chỉ ảnh, có autoplay (mặc định) |
  | 2 | `cards` | Carousel các card có tiêu đề + mô tả + link |
  | 3 | `testimonials` | Carousel trích dẫn khách hàng |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.4 Kinh doanh (3 block)

### 14. `pricing`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 15. `feature-comparison`
- **Nguồn:** `src/blocks/feature-comparison/config.ts:8`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `table` | Bảng ma trận — sản phẩm cột, tính năng dòng (mặc định) |
  | 2 | `cards` | Các card sản phẩm song song, liệt kê feature dọc |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 16. `menu-food`
- **Nguồn:** `src/blocks/menu-food/config.ts:27`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `classic` | Menu truyền thống — tên món + giá, có dòng chấm nối (mặc định) |
  | 2 | `cards` | Mỗi món là 1 card có ảnh, mô tả, giá |
  | 3 | `minimal` | Tối giản — chỉ tên + giá, không ảnh |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.5 Thương mại (3 block)

### 17. `products-grid`
- **Nguồn:** `src/blocks/products-grid/config.ts:6`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `grid-3` | Lưới 3 cột sản phẩm (mặc định) |
  | 2 | `grid-4` | Lưới 4 cột — phù hợp catalog nhiều sản phẩm |
  | 3 | `list` | Danh sách dọc, mỗi sản phẩm 1 hàng rộng |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 18. `products-featured`
- **Nguồn:** `src/blocks/products-featured/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `hero-product` | 1 sản phẩm lớn nổi bật kiểu hero, ảnh lớn + CTA (mặc định) |
  | 2 | `carousel` | Trượt ngang nhiều sản phẩm nổi bật |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 19. `cartWidget`
- **Nguồn:** `src/blocks/cart-widget/config.ts:13`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `floating` | Nút giỏ hàng nổi cố định góc dưới phải (mặc định) |
  | 2 | `inline` | Nút giỏ hàng inline trong layout (thường trong header) |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.6 Biểu mẫu & Liên hệ (3 block)

### 20. `contact`
- **Nguồn:** `src/blocks/contact/config.ts:7`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `form` | Form liên hệ đầy đủ các field (mặc định) |
  | 2 | `info-only` | Chỉ hiển thị email/phone/địa chỉ, không form |
  | 3 | `split` | Form một bên, thông tin/địa chỉ một bên |
  | 4 | `card-float` | Form dạng card nổi có shadow trên nền |
  | 5 | `map-split` | Form một bên, bản đồ Google Maps một bên |
  | 6 | `minimal-inline` | Form nhỏ gọn inline — chỉ email + nút gửi |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 21. `newsletter`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 22. `whatsapp-button`
- **Nguồn:** `src/blocks/whatsapp-button/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `floating` | Nút WhatsApp nổi cố định góc màn hình (mặc định) |
  | 2 | `inline` | Nút WhatsApp inline trong layout/section |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.7 Tiện ích (4 block)

### 23. `stats`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 24. `logo-cloud`
- **Nguồn:** `src/blocks/logo-cloud/config.ts:6`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `row` | Các logo xếp 1 hàng ngang (mặc định) |
  | 2 | `grid` | Lưới logo nhiều hàng — phù hợp nhiều đối tác |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 25. `socialWidget`
- **Nguồn:** `src/blocks/social-widget/config.ts:57`
- **Biến thể hiện có (2):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `floating` | Cụm icon mạng xã hội nổi cố định cạnh màn hình (mặc định) |
  | 2 | `inline` | Icon mạng xã hội inline trong section (thường ở footer) |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 26. `team`
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
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## 4.8 Bố cục (4 block)

### 27. `navigation`
- **Nguồn:** `src/blocks/navigation/config.ts:33`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `simple` | Thanh điều hướng cơ bản (mặc định) — logo trái, links phải |
  | 2 | `centered` | Logo giữa, links chia 2 bên |
  | 3 | `mega-menu` | Menu nhiều cột với dropdown lớn |
  | 4 | `transparent` | Nền trong suốt, overlay trên hero |
  | 5 | `sidebar` | Menu dạng thanh bên (vertical) |
  | 6 | `pill` | Dạng "viên thuốc" bo tròn nổi |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 28. `footer`
- **Nguồn:** `src/blocks/footer/config.ts:7`
- **Biến thể hiện có (6):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `simple` | Chân trang cơ bản (mặc định) — 1 dòng logo + copyright |
  | 2 | `expanded` | Nhiều cột links + logo + tagline + social |
  | 3 | `minimal` | Tối giản — chỉ copyright + vài link quan trọng |
  | 4 | `centered-stack` | Logo + links + social căn giữa, xếp chồng dọc |
  | 5 | `mega-footer` | Chân trang lớn nhiều cột, có newsletter form |
  | 6 | `dark-gradient` | Nền gradient tối, chữ sáng, nổi bật |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 29. `divider`
- **Nguồn:** `src/blocks/divider/config.ts:6`
- **Biến thể hiện có (4):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `line` | Đường kẻ ngang đơn giản (mặc định) |
  | 2 | `dots` | Dấu chấm cách đều làm phân cách |
  | 3 | `wave` | Đường lượn sóng SVG |
  | 4 | `spacer` | Khoảng trắng — chỉ tạo space, không có đường |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

### 30. `announcement-bar`
- **Nguồn:** `src/blocks/announcement-bar/config.ts:6`
- **Biến thể hiện có (3):**
  | # | Biến thể | Mô tả ngắn |
  |---|----------|------------|
  | 1 | `gradient` | Dải thông báo nền gradient sặc sỡ (mặc định) |
  | 2 | `solid` | Nền màu đơn, chữ tương phản |
  | 3 | `minimal` | Tối giản — nền trắng/nhạt, viền mỏng |
- **Bug phát hiện:**
  - [ ]
- **Đề xuất tối ưu:**
  - [ ]
- **Trạng thái:** ⬜ Chưa xử lý

---

## Bảng tổng hợp tiến độ

| Danh mục | Số block | ⬜ Chưa | 🟡 Đang | ✅ Xong | ⏭️ Hoãn |
|----------|:--------:|:------:|:------:|:------:|:------:|
| 4.1 Cơ bản | 6 | 6 | 0 | 0 | 0 |
| 4.2 Nội dung | 4 | 4 | 0 | 0 | 0 |
| 4.3 Phương tiện | 3 | 3 | 0 | 0 | 0 |
| 4.4 Kinh doanh | 3 | 3 | 0 | 0 | 0 |
| 4.5 Thương mại | 3 | 3 | 0 | 0 | 0 |
| 4.6 Biểu mẫu & Liên hệ | 3 | 3 | 0 | 0 | 0 |
| 4.7 Tiện ích | 4 | 4 | 0 | 0 | 0 |
| 4.8 Bố cục | 4 | 4 | 0 | 0 | 0 |
| **Tổng** | **30** | **30** | **0** | **0** | **0** |
