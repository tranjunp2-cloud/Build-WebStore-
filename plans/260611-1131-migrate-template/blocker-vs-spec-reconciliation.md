# Reconciliation: BLOCKER ↔ Design Spec ↔ Code V2 (F35)

> **Ngày:** 2026-06-12 | **Mục đích:** đối chiếu `dev-handover-v2-block-gaps.md` (2 GAP) với `docs/design/F35-template-block-design.md` (20 control) và **code V2 thực tế** (`src/blocks/**`, `src/collections/**`).
> **Nguồn ground-truth:** audit code V2 (Explore agent, file:line do agent báo — **Dev confirm lại** trước khi code).
> **Kết luận 1 dòng:** BLOCKER đúng nhưng **under-scope** — 2 GAP là *Load-blocking* (mất data + duyệt SP), nhưng để hiện thực hoá **đủ 20 control** của spec cần **~15 thay đổi block nữa**, không chỉ 2.

---

## 1. BLOCKER 2 GAP — verify vs code hiện tại: ✅ CÒN ĐÚNG

| GAP | Claim | Code thực tế | Verdict |
|---|---|---|---|
| **GAP-1** Hero per-slide | `hero` chỉ có `images[]` câm + text/CTA cấp block | `src/blocks/hero/config.ts:19-36` — images[], ctaButtons[] global; KHÔNG có slides[] per-slide; KHÔNG autoRotate/interval; KHÔNG nav dots/arrows | ✅ Confirmed MISSING |
| **GAP-2** Products filter/sort + brand | `products-grid` không filter/sort; `Products` không có `brand`; API không param filter | `src/blocks/products-grid/config.ts:1-28` (chỉ variant/headline/limit/category) · `src/collections/Products.ts` KHÔNG có `brand` · `src/app/api/storefront/products/route.ts:6,45` sort-only, where chỉ theo `site` | ✅ Confirmed MISSING (cả 3 lớp: CMS + API + data model) |

→ 2 GAP này là **đúng và nghiêm trọng nhất** (GAP-1 = mất nội dung từng slide của ~1.490 web; GAP-2 = không tái tạo được duyệt SP + thiếu data model brand).

---

## 2. ⚠️ XUNG ĐỘT Spec ↔ BLOCKER (Banner) — cần align

BLOCKER đã **chốt 2 quyết định NGƯỢC với design spec** (mục D2/D3, đánh dấu ✅ CHỐT by PM/Design):

| Điểm | Design spec (US-F35-04 / §D) | BLOCKER chốt | Hệ quả |
|---|---|---|---|
| Styling per-slide | Tiêu đề/phụ đề có bold/italic/underline/size/color; nút có màu thường+hover | **D2: KHÔNG migrate** — title/subtitle dùng **typography theme**, button dùng **style theme** (accepted loss) | Spec đang **over-specified** → phải sửa |
| Toggle show/hide per-slide | Mỗi tiêu đề/phụ đề/nút có toggle "hiện" | **D3: BỎ toggle** — V2 render nếu field non-empty; transformer: `show=false`→xoá field, `display=false`→bỏ slide | Spec đang **over-specified** → phải sửa |

**Khuyến nghị:** Spec/Stories nên **align theo BLOCKER** (accepted-loss, theme-based) — vì (a) quyết định mới hơn + grounded vào code V2, (b) giảm scope build lớn, (c) đã đánh dấu CHỐT. **TRỪ KHI** PM muốn giữ full-fidelity styling per-slide (→ build lớn hơn nhiều). → **DEC-A cần xác nhận.**

---

## 3. Coverage 20 control của Spec vs Code V2

> Trạng thái: **EXISTS** (đủ) · **PARTIAL** (có nền, thiếu field) · **MISSING** (chưa có). "BLOCKER?" = GAP đó đã được BLOCKER ghi nhận chưa.

| # | Control (spec) | Status V2 | Block/Collection | BLOCKER? |
|---|---|---|---|---|
| — | Theme màu | ✅ EXISTS | `Sites.ts:141-216` | — |
| — | Typography per cấp + font | 🟡 PARTIAL | `Sites.ts:157-179` (chỉ chọn font, thiếu size/weight per cấp) | ❌ chưa ghi |
| — | Store info (logo/favicon/...) | 🟡 PARTIAL | `Sites.ts:289-317` (thiếu hotline/country/currency) | ❌ |
| — | Rich Text WYSIWYG | ✅ EXISTS | `custom-html` / richText | — |
| 1 | Sticky Header | ✅ EXISTS | `Pages.ts:82-87` style=sticky | — |
| 2 | Scroll-to-top | 🔴 MISSING | — | ❌ |
| 3 | CTA card style | 🟡 PARTIAL | quick-view có; add-to-cart/view-detail thiếu | ❌ |
| 4 | Quick View toggle | ✅ EXISTS | `product-quick-view/config.ts:24` | — |
| 5 | Grid/List switch (runtime) | 🟡 PARTIAL | `products-grid` variant tĩnh, không toggle runtime | ❌ |
| 6 | Pagination style (load-more/numbered) | 🔴 MISSING | — | ❌ |
| 7 | Banner: per-slide content | 🔴 MISSING | hero | ✅ GAP-1 |
| 8 | Banner: animation autoRotate+interval | 🔴 MISSING | hero (carousel có nhưng hero không) | ✅ GAP-1 |
| 9 | Banner: nav dots/arrows | 🔴 MISSING | hero | ✅ GAP-1 |
| 10 | Banner: CTA per slide | 🔴 MISSING | hero (CTA chỉ global) | ✅ GAP-1 |
| 11 | Product source all/fixed/random | 🔴 MISSING | products-grid/featured | 🟡 ngụ ý GAP-2 |
| 12 | filterConfig (4 filter + sort) | 🔴 MISSING | products-grid | ✅ GAP-2 |
| 13 | Products `brand` data model | 🔴 MISSING | `Products.ts` | ✅ GAP-2 |
| 14 | Header: cart/search toggle | 🔴 MISSING | navigation | ❌ |
| 15 | Header: mega-menu ảnh+size | 🟡 PARTIAL | `navigation/config.ts:5-77` (nesting có, thiếu image/size) | ❌ |
| 16 | Footer: line-type icon + copyright toggle | 🟡 PARTIAL | `footer/config.ts` (internal/external có; thiếu icon + copyright toggle) | ❌ |
| 17 | Category Listing block (animation + grid/carousel) | 🔴 MISSING (cả block) | — | ❌ |
| 18 | Article: layout grid/list | 🟡 PARTIAL | `blog-list/config.ts:6-23` (cards/list có) | ❌ |
| 19 | Article: excerpt/read-more/badge | 🔴 MISSING | blog-list | ❌ |
| 20 | Article detail: related+count / tags | 🔴 MISSING (no detail block) | — | ❌ |
| 21 | Shortlist polymorphic picker | 🔴 MISSING | products-featured chỉ pick product-id | ❌ |
| 22 | Cart: delete-all / stock toggle | 🔴 MISSING | `cart-widget` chỉ label | ❌ |
| 23 | Product Detail toggles (SKU/cat-link/badge/stock/QV) | 🔴 MISSING (no detail block) | — | ❌ |

**Tổng:** ✅ EXISTS ~5 · 🟡 PARTIAL ~6 · 🔴 MISSING ~12. **BLOCKER mới phủ 2/18 nhóm gap.**

---

## 4. Phân tầng gap (đề xuất cho PM quyết scope)

- **TIER 0 — Load-blocking (BLOCKER đã ghi, BẮT BUỘC trước Transform/Load):**
  GAP-1 hero per-slide · GAP-2 filterConfig + brand model + API filter params.
  *(Không có = mất data + không duyệt được SP.)*

- **TIER 1 — Foundational PARTIAL (hoàn thiện field còn thiếu, rủi ro mất cấu hình store):**
  Typography per-cấp · Store info (hotline/country/currency) · Mega-menu image/size · Footer icon-line + copyright toggle · Header cart/search toggle.

- **TIER 2 — Per-block toggle/feature (MISSING, ảnh hưởng độ giống UI nhưng không mất data):**
  Scroll-to-top · CTA card style · Grid/List runtime · Pagination style · Category Listing block (cả block) · Article excerpt/read-more/badge/related/tags · Shortlist polymorphic · Cart toggles · Product-detail toggles.

→ **DEC-B ✅ CHỐT (2026-06-12): Tier 0 + Tier 1** cho đợt này. **Tier 2 → Post-Migration Backlog** (V2.1/V2.2), default BẬT (true) ở storefront khi đổ data, Merchant tắt sau.

---

## 5. Việc cập nhật tài liệu (sau khi PM chốt DEC-A/DEC-B)

1. **Align Banner** (DEC-A): sửa `docs/design/F35-template-block-design.md` §D + `US-F35-04` — bỏ styling per-slide + toggle show/hide, ghi rõ "accepted loss, theme-based".
2. **Thêm cột "V2 status"** vào design spec matrix §M (EXISTS/PARTIAL/MISSING) để Dev biết cái nào phải build.
3. **Mở rộng BLOCKER** (DEC-B nếu full): thêm GAP-3..N cho Tier 1/2, hoặc tạo build-backlog riêng.
4. PRD §7: thêm dòng "Scope tiers (Tier 0/1/2) — chờ PM chốt".

---

## 6. Quyết định — ✅ ĐÃ CHỐT (2026-06-12)
- **DEC-A ✅** Banner **accept-loss** (theo BLOCKER): bỏ styling + toggle per-slide, ăn Theme/Typography, ẩn field trống. → spec §D + US-F35-04 đã sửa.
- **DEC-B ✅** Scope = **Tier 0 + Tier 1**; Tier 2 hoãn (backlog V2.1/V2.2, default ON). → BLOCKER mở GAP-3→7.
- **DEC-C ✅** `filterConfig` đặt **TRONG `products-grid`** (không tách block).
- **DEC-D ✅** **Schema chuẩn** (Payload fields/cột), KHÔNG JSON tự do.
- ⏳ Còn lại cho Dev: D1 (`images→slides` migration), D6/`sortDefault` map `order_by` V1, entry `db-setup.js` nếu lưu cột.
- ⚠️ File:line do audit agent báo → **Dev verify** trước khi code.
