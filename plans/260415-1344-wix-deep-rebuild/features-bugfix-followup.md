---
title: "Features — Fix icon system, variant diversity và carousel UX"
description: "8 lỗi features block: decorative monotonous, emoji icons, carousel hardcode, empty state, JSON-LD"
status: pending
priority: P1
effort: 9-11h
branch: chore/F01-remaining-plans
tags: [features, bugfix, wix-rebuild]
created: 2026-04-15
---

# Features — Sửa các lỗi còn lại

## Bối cảnh
Features block có 8 variants (grid-2/3/4/list/icon-top/icon-left/zigzag/carousel) với polish 4/5. Researcher-01 chỉ ra: tất cả 8 variants dùng chung `linear-gradient rgba(brand-primary) → transparent` card bg → trông như 8 shades cùng một look. Icon là emoji string, không lucide lib. Carousel có bugs về mobile UX + keyboard a11y.

## Phạm vi
Diversify card style per variant, migrate icon sang lucide, fix carousel UX, thêm empty state và JSON-LD. KHÔNG thêm variants mới.

## Danh sách lỗi cần fix

### Lỗi A — 8 variants cùng decorative (4-5h, P1)
**File**: `src/blocks/features/index.tsx`
**Vấn đề**: tất cả 8 variants render card với `background: linear-gradient(135deg, rgba(brand-primary, 0.08), transparent)`. Mỗi variant chỉ khác layout, không khác visual treatment.
**Cách sửa**:
1. Tạo `CARD_STYLE_BY_VARIANT` map: `grid-2 → bordered`, `grid-3 → filled-soft`, `grid-4 → glass`, `list → minimal-divider`, `icon-top → elevated-shadow`, `icon-left → neumorphic`, `zigzag → outline-gradient`, `carousel → solid-dark`.
2. Tạo `FeatureCardShell` component nhận prop `cardStyle` + render theo style key.
3. Thay inline `style={{ background: ... }}` ở mỗi variant bằng `<FeatureCardShell cardStyle={CARD_STYLE_BY_VARIANT[variant]}>`.

**Kiểm tra**: render 8 variants side-by-side → card visual treatment khác rõ.

---

### Lỗi B — `feature.icon` là emoji string (2h, P1)
**File**: `src/blocks/features/index.tsx` + `src/lib/ai/template-composer.ts`
**Vấn đề**: schema `feature.icon = z.string()` cho phép AI gen ra emoji ("⚡", "🎯"). Emoji font khác nhau giữa OS → inconsistent.
**Cách sửa**:
1. Đổi schema sang `z.enum([...LUCIDE_ICON_KEYS])`.
2. Composer: `SERVICE_ICON_BY_CATEGORY` → pick ngẫu nhiên key theo seed.
3. Render bằng `<LucideIcon name={feature.icon} className="h-6 w-6" />`.
4. Migration cho DB data cũ: nếu parse fail → fallback sang `Sparkles`.

**Kiểm tra**: icon render ra lucide svg, không còn emoji text.

---

### Lỗi C — Carousel card `w-[300px]` hardcode, mobile single card awkward (45 phút, P2)
**File**: `src/blocks/features/index.tsx` (variant `carousel`)
**Vấn đề**: card width cứng 300px → mobile 375px chỉ hiện 1 card lệch mép trái, không có peek của card kế tiếp → không signaling scrollable.
**Cách sửa**: đổi width thành responsive: `w-[85vw] sm:w-[340px] md:w-[300px]`. Thêm `snap-x snap-mandatory` cho container + `snap-center` cho từng card.
**Kiểm tra**: 375px → thấy card chính + peek ~15% của card kế tiếp bên phải.

---

### Lỗi D — Carousel arrows `hidden md:flex`, mobile không keyboard control (45 phút, P2)
**File**: `src/blocks/features/index.tsx` (variant `carousel`)
**Vấn đề**: arrow prev/next ẩn ở mobile. Keyboard user không có cách điều hướng (không phải ai cũng có touch).
**Cách sửa**:
1. Bỏ `hidden md:flex`, đổi thành `flex` cho cả mobile (size nhỏ hơn: `h-8 w-8 md:h-10 md:w-10`).
2. Thêm `onKeyDown` handler trên container nghe ArrowLeft/ArrowRight.
3. `tabIndex={0}` + `role="region"` + `aria-label="Features carousel"`.

**Kiểm tra**: tab vào carousel → arrow key chạy; mobile thấy button prev/next.

---

### Lỗi E — Không có empty state (15 phút, P2)
**File**: `src/blocks/features/index.tsx`
**Vấn đề**: `features.length === 0` render grid rỗng.
**Cách sửa**: early return null. Copy pattern của testimonials.
**Kiểm tra**: pass `features: []` → không render.

---

### Lỗi F — Header `text-center max-w-2xl` hardcode (45 phút, P3)
**File**: `src/blocks/features/index.tsx`
**Vấn đề**: section header luôn center + max-width 2xl. Nếu variant là `zigzag` hoặc `icon-left` → header vẫn center, không khớp với body layout left-align.
**Cách sửa**: thêm prop `headerAlign: 'left' | 'center'` vào config (default center). Zigzag + list + icon-left → `left`. Sửa classname condition.
**Kiểm tra**: zigzag variant → header + body cùng left-aligned.

---

### Lỗi G — Carousel scroll state update on every scroll event, no debounce (15 phút, P3)
**File**: `src/blocks/features/index.tsx` (variant `carousel`)
**Vấn đề**: `onScroll={(e) => setActiveIndex(...)}` firing mỗi pixel scroll → re-render rất nhiều.
**Cách sửa**: dùng `requestAnimationFrame` throttle hoặc `useCallback` + `debounce(16ms)`.
**Kiểm tra**: React Profiler → scroll carousel → re-render count ≤ 60 per second.

---

### Lỗi H — Không có Feature / ItemList JSON-LD (1.5h, P2)
**File**: `src/blocks/features/index.tsx` + `src/lib/seo/json-ld.ts`
**Vấn đề**: features block không emit schema → mất cơ hội list markup.
**Cách sửa**: build `ItemList` schema với `itemListElement` map qua features. Render script tag.
**Kiểm tra**: Rich Results Test → detect ItemList.

---

## Thứ tự làm
1. **Lỗi E** (15 phút) — empty state
2. **Lỗi G** (15 phút) — debounce scroll
3. **Lỗi C** (45 phút) — carousel width responsive
4. **Lỗi D** (45 phút) — arrows mobile + keyboard
5. **Lỗi F** (45 phút) — headerAlign prop
6. **Lỗi H** (1.5h) — ItemList JSON-LD
7. **Lỗi B** (2h) — lucide icon migration
8. **Lỗi A** (4-5h) — diversify card styles

Tổng: **~9-11 giờ**.

## Tiêu chí hoàn thành
- [ ] 8 variants có 8 card style khác biệt visual
- [ ] Icon render lucide, không emoji
- [ ] Carousel mobile: card 85vw + peek 15% + snap-center
- [ ] Tab vào carousel + ArrowLeft/Right → navigate
- [ ] `features: []` → return null
- [ ] Zigzag variant header left-aligned
- [ ] View source có `"@type": "ItemList"`
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi A**: thêm 8 card style → CSS bundle to hơn. Phải extract vào `@layer components` hoặc CSS-in-JS theme.
- **Lỗi B**: breaking schema change → cần migration cho data cũ (DB query tìm feature.icon emoji → map default).

## Câu hỏi còn bỏ ngỏ
1. Card style nào cho variant nào — có nên poll design team hay AI tự pick?
2. Carousel có cần dot indicator dưới ngoài arrows không? (Wix thường có cả 2.)
