---
title: "Stats — Fix CountUp format + thêm 3 variants (icon-cards, trend-arrows, bg-image)"
description: "11 lỗi stats block 204 LOC: CountUp comma-separated fail, parseInt decimal, aria-label trên <p>, thêm 3 variants wow"
status: pending
priority: P2
effort: 7-9h
branch: chore/F01-remaining-plans
tags: [stats, bugfix, wix-rebuild]
created: 2026-04-15
---

# Stats — Sửa các lỗi còn lại

## Bối cảnh
Stats block (204 LOC, 3 variants: row/grid/highlight, polish 4/5). Có CountUp với useInView + reduce-motion, có fix "24/7" multi-digit. Nhưng CountUp chưa handle format "$1,000,000" (comma) và "4.5" (decimal). Chỉ 3 variants — quá ít cho block quan trọng này. Thiếu icon-per-stat và trend arrows.

## Phạm vi
Fix CountUp parse + a11y + thêm 3 variants mới. KHÔNG đụng CountUp algorithm chính, chỉ patch parse input.

## Danh sách lỗi cần fix

### Lỗi A — Chỉ 3 variants, thiếu icon-cards/trend-arrows/bg-image (4-5h, P2)
**File**: `src/blocks/stats/index.tsx`
**Vấn đề**: 3 variants giống nhau visual (row/grid/highlight chỉ khác layout). Không có signature wow nào.
**Cách sửa**: thêm 3 variants:
- `icon-cards`: mỗi stat là card có icon lucide + number + label + trend indicator
- `trend-arrows`: stat + arrow ↑/↓ + "+12%" so với previous period
- `bg-image`: fullwidth stat section có background image + dark overlay + text trên

**Kiểm tra**: config schema thêm 3 enum values + render đúng.

---

### Lỗi B — `key={i}` (15 phút, P2)
**File**: `src/blocks/stats/index.tsx`
**Vấn đề**: stats map dùng index key.
**Cách sửa**: `key={stat.id ?? \`${stat.label}-${i}\`}`.
**Kiểm tra**: reorder stats → không flash animation.

---

### Lỗi C — `stats.length === 0` silent (15 phút, P2)
**File**: `src/blocks/stats/index.tsx`
**Vấn đề**: empty array render section header + container rỗng.
**Cách sửa**: early return null.
**Kiểm tra**: `stats: []` → không render.

---

### Lỗi D — `aria-label` trên `<p>` element support kém (15 phút, P2)
**File**: `src/blocks/stats/index.tsx`
**Vấn đề**: dùng `<p aria-label="1000 happy customers">` để expose readable text cho screen reader — nhưng aria-label trên `<p>` không được tất cả screen reader honor.
**Cách sửa**: dùng visually hidden sr-only span: `<span className="sr-only">1000 happy customers</span>` + `<span aria-hidden="true">{displayValue}</span>`.
**Kiểm tra**: NVDA/VoiceOver → đọc "1000 happy customers" thay vì "1 0 0 0".

---

### Lỗi E — CountUp không handle "$1,000,000" comma-separated (45 phút, P2)
**File**: `src/blocks/stats/index.tsx` (helper `CountUp`)
**Vấn đề**: user nhập "1,000,000" → `parseInt("1,000,000")` = 1 → count 1 → wrong.
**Cách sửa**: strip `/[,\s]/g` trước parseInt: `parseInt(value.replace(/[,\s]/g, ''), 10)`. Format lại khi render bằng `Intl.NumberFormat`.
**Kiểm tra**: pass "$1,000,000" → CountUp runs 0 → 1000000 → format back "1,000,000".

---

### Lỗi F — HighlightVariant `parseInt` fails cho "4.5" decimal (45 phút, P2)
**File**: `src/blocks/stats/index.tsx` (variant `highlight`)
**Vấn đề**: `parseInt("4.5")` = 4 → "5 star rating" display wrong.
**Cách sửa**: dùng `parseFloat` + detect decimal → CountUp với step nhỏ (0.1). Render với `.toFixed(1)` nếu input có `.`.
**Kiểm tra**: "4.5 ★" → count 0 → 4.5, hiển thị "4.5".

---

### Lỗi G — HighlightVariant fallback 75% arbitrary (15 phút, P3)
**File**: `src/blocks/stats/index.tsx` (variant `highlight`)
**Vấn đề**: progress bar width fallback `'75%'` khi parse fail → arbitrary, misleading.
**Cách sửa**: fallback 0% hoặc hide progress bar khi không parse được number.
**Kiểm tra**: pass "24/7" → progress bar hidden hoặc 0%.

---

### Lỗi H — Không có icon per stat field (1.5h, P2)
**File**: `src/blocks/stats/index.tsx` + config schema
**Vấn đề**: stat chỉ có `value` + `label`, không có icon → không differentiate giữa "100 customers" vs "100 projects".
**Cách sửa**:
1. Schema: `stat.icon: z.enum([...LUCIDE_ICON_KEYS]).optional()`.
2. Component: nếu icon → render `<LucideIcon name={stat.icon}>` bên cạnh value.

**Kiểm tra**: stats với icon → render lucide svg.

---

### Lỗi I — RowVariant `min-w-[140px]` + 5+ stats tablet overflow (15 phút, P3)
**File**: `src/blocks/stats/index.tsx` (variant `row`)
**Vấn đề**: row variant với min-width 140px mỗi item × 5 stats = 700px → tablet 768px okish, 6+ stats overflow.
**Cách sửa**: `min-w-[120px] md:min-w-[140px]` hoặc wrap bằng `flex-wrap` + center align.
**Kiểm tra**: 6 stats trên tablet 768px → wrap 2 rows thay vì overflow.

---

### Lỗi J — HighlightVariant progress bar `h-3` 12px odd size (15 phút, P3)
**File**: `src/blocks/stats/index.tsx` (variant `highlight`)
**Vấn đề**: 12px progress bar không match design system (thường h-2 = 8px hoặc h-4 = 16px).
**Cách sửa**: đổi về `h-2` (subtle) hoặc `h-4` (prominent).
**Kiểm tra**: visual — bar có scale match với card size.

---

### Lỗi K — `fontVariantNumeric: tabular-nums` inconsistent (15 phút, P3)
**File**: `src/blocks/stats/index.tsx`
**Vấn đề**: một số variant có `tabular-nums` (fixed-width digit) → count animation smooth; vài variant không → digit jitter khi count.
**Cách sửa**: apply `tabular-nums` cho tất cả CountUp number display via shared class.
**Kiểm tra**: animation count → digit không jitter sang trái/phải.

---

## Thứ tự làm
1. **Lỗi B**, **C**, **D**, **G**, **I**, **J**, **K** (7 × 15 phút = ~1.75h) — quickwins
2. **Lỗi E** (45 phút) — comma parse
3. **Lỗi F** (45 phút) — decimal parse
4. **Lỗi H** (1.5h) — icon per stat
5. **Lỗi A** (4-5h) — 3 new variants

Tổng: **~7-9 giờ**.

## Tiêu chí hoàn thành
- [ ] 6 variants total: row, grid, highlight, icon-cards, trend-arrows, bg-image
- [ ] Stable keys
- [ ] `stats: []` → return null
- [ ] Screen reader đọc label readable ("1000 happy customers" không "1 0 0 0")
- [ ] CountUp handle "$1,000,000" + "4.5" đúng format
- [ ] HighlightVariant không show fallback 75% misleading
- [ ] Stat có icon optional, render lucide
- [ ] Row variant 6+ stats tablet wrap 2 rows
- [ ] CountUp digit không jitter (tabular-nums áp mọi variant)
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi E/F**: đổi parse logic có thể regress với input lạ ("1.5K", "1M"). Phải add test cases cho cả K, M suffix + comma + decimal.
- **Lỗi A**: 3 variants mới tăng bundle. Phải dynamic import nếu too big.
- **Lỗi H**: breaking schema change (icon optional). Data cũ parse fine vì optional.

## Câu hỏi còn bỏ ngỏ
1. CountUp có cần support "1.5K" / "1M" suffix không? (Wix hỗ trợ.)
2. Trend-arrows variant: data trend từ đâu — AI gen random hay manual input?
3. Bg-image variant: image source tự industry image fallback hay user required upload?
