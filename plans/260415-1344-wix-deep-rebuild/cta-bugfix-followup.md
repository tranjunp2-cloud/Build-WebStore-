---
title: "CTA — Fix banner text invisible, rename floating, add real floating-sticky"
description: "Fix 8 lỗi + rename floating→card (breaking) + new floating-sticky variant với scroll trigger"
status: done
priority: P1
effort: 5-6h
branch: chore/F01-remaining-plans
tags: [cta, bugfix, breaking-change, migration, a11y]
created: 2026-04-15
completed: 2026-04-15
---

# CTA — Fix + Rename + New Variant

## Bối cảnh
Audit 2 vòng tìm 14 lỗi CTA. Lỗi critical: banner text hardcode `#ffffff` → invisible trên theme light. Ngoài ra rename `floating → card` để đặt tên đúng (variant hiện tại chỉ là card float, không thực sự "floating") + thêm variant mới `floating-sticky` thật sự fixed + scroll trigger + dismissible. **Breaking change** → cần migration SQL đổi giá trị cũ trong DB.

## Phạm vi
Đụng `src/blocks/cta/index.tsx` + `src/blocks/cta/config.ts` + `scripts/db-setup.js` (migration). KHÔNG đụng template-composer cho variant mới (để rotateStructuralVariants tự pick sau).

## Danh sách lỗi cần fix

### Critical (Round 2)

#### Lỗi 9C — Banner text hardcode #ffffff invisible (45 phút, P1 CRITICAL)
**File**: `src/blocks/cta/index.tsx` BannerVariant
**Vấn đề**: Text `color: '#ffffff'` hardcode. Trên theme `light` với `--primary = #F5F5DC` (cream) → text trắng trên nền kem → **invisible**.
**Cách sửa**: CTAButton nhận prop `onInverseBg?: boolean`. Khi true → primary button `bg-white text-[var(--primary)]` (swap). Banner gradient luôn pass `onInverseBg={true}`. Text headline/sub dùng `color: 'white'` vì banner luôn gradient tối → acceptable (document lý do).

#### Lỗi 10C — ctaStyle='outline' trên banner render xấu (15 phút, P2)
**Cách sửa**: Khi `onInverseBg=true` → outline style dùng `border-white text-white hover:bg-white hover:text-[var(--primary)]`.

---

### Round 1 + Round 2 fixed (7 lỗi)

#### Lỗi A — Reduce-motion branch dùng raw string (10 phút, P1)
**Vấn đề**: `prefers-reduced-motion` branch render `{headline}` plain string, motion branch render `<RichText>` → 2 path không consistent → nếu headline Lexical thì reduced-motion render wrong.
**Cách sửa**: Cả 2 branch dùng `<RichText value={headline} />`.

#### Lỗi 3C + 7C — rel="noopener noreferrer" không có target="_blank" (15 phút, P2)
**Cách sửa**: Helper `getLinkAttrs(url)`: detect `url.startsWith('http')` → return `{ target: '_blank', rel: 'noopener noreferrer' }`, else `{}`.

#### Lỗi 5C — Inline variant headline dài vỡ layout (5 phút, P2)
**Cách sửa**: `max-w-2xl` wrap text container.

#### Lỗi 6C — Không support secondary CTA button (30 phút, P2)
**Cách sửa**: Thêm `secondaryButton` field vào config. SecondaryCTAButton ghost style render sau primary.

#### Lỗi 13C — site?.id as string unsafe cast (5 phút, P3)
**Cách sửa**: `String(site?.id ?? '')`.

#### Lỗi 14C — Banner mobile padding py-16 md:py-20 (5 phút, P2)
**Cách sửa**: `py-20 md:py-28` — Wix breathing room standard.

---

### Decision 5 — Rename + New Variant (3h, P1)

#### Step 1 — Rename `floating` → `card`
1. `config.ts`: `z.enum([...])` đổi `'floating'` thành `'card'`.
2. `index.tsx`: đổi tên function `FloatingVariant` → `CardVariant`, switch case `'floating'` → `'card'`.
3. **Migration SQL** trong `scripts/db-setup.js`:
   ```js
   {
     name: 'cta.rename_floating_to_card',
     sql: `UPDATE pages_blocks_cta SET variant = 'card' WHERE variant = 'floating';`,
   }
   ```

#### Step 2 — New `floating-sticky` variant
1. Config: add `'floating-sticky'` vào enum.
2. Component `FloatingStickyVariant`:
   - `position: fixed bottom-4 right-4` desktop, `bottom-4 left-4 right-4` mobile
   - Scroll trigger: `useEffect` watch scroll, show khi scroll > 30% viewport height
   - Dismissible: X button → `localStorage.setItem('cta-floating-dismissed-${siteId}', Date.now())` → ẩn 7 ngày
   - Check dismissed trong mount effect
   - z-index 40 (dưới modal z-50)

---

### Deferred (5 lỗi)

| Lỗi | Mô tả | Lý do |
|---|---|---|
| 8C | Gradient secondary fallback accent | Edge case, accent color luôn có |
| 11C | Icon prefix/suffix | Cần lucide integration vào config — feature mới |
| 12C | Urgency/countdown/limited-time | Feature mới Phase 05 |
| 4C | Outline style colors partial | Merged với 10C |

---

## Thứ tự làm

1. **Lỗi 9C + 10C** (1h) — banner invisible critical
2. **Decision 5** (3h) — rename + migration + floating-sticky
3. **Lỗi A + 3C/7C + 5C + 13C + 14C** (45 phút) — gom commit quick wins
4. **Lỗi 6C** (30 phút) — secondary button

Tổng: **5.25 giờ**.

## Tiêu chí hoàn thành
- [x] Banner text đọc được trên mọi theme (primary button swap khi `onInverseBg`)
- [x] Migration SQL update `variant='floating'` → `'card'` trong existing records
- [x] `FloatingStickyVariant` scroll 30% trigger + X dismiss + localStorage 7-day
- [x] `getLinkAttrs` helper, external link có target=_blank
- [x] Secondary button render ghost style
- [x] RichText consistent reduced-motion branch
- [x] `tsc --noEmit` sạch
- [x] Migration chạy trên staging DB, check `SELECT variant, count(*) FROM pages_blocks_cta GROUP BY variant`

## Kết quả thực hiện (2026-04-15)
- **PR**: #640 (merged/review)
- **Commit**: e520bdb6
- **Breaking change**: variant rename — migration SQL thêm vào `scripts/db-setup.js`
- **Deferred**: 8C, 11C, 12C, 4C (merged vào 10C)

## Rủi ro
- **Migration**: nếu UPDATE fail giữa chừng → 1 số records còn `'floating'`, 1 số đã `'card'` → frontend hit unknown variant. Mitigation: CHECK IF EXISTS trước, wrap try/catch trong db-setup, test trên staging trước.
- **localStorage dismiss**: nhiều CTA trên 1 page cùng dùng key `cta-floating-dismissed-${siteId}` → dismiss 1 cái ẩn hết. Fix: thêm block ID vào key `${siteId}-${blockId}`.
- **Scroll trigger**: scroll listener không cleanup → memory leak khi SPA navigate.

## Câu hỏi còn bỏ ngỏ
1. `floating-sticky` có nên auto-pick trong template-composer không, hay chỉ enable qua manual edit?
2. Dismiss 7 ngày có đúng UX không, hay user muốn 24h ngắn hơn?
3. Icon prefix/suffix (Lỗi 11C): Lucide vs inline SVG set riêng — cần decision Phase 05.
