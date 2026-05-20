---
title: "Navigation — Sửa các lỗi còn lại sau vòng fix màu đầu tiên"
description: "Tiếp tục xử lý 4 lỗi còn lại của navigation block sau khi đã sửa 11 chỗ hardcode màu"
status: done
priority: P1
effort: 3-4h
branch: feat/F01-ai-gen-seo-guard
tags: [navigation, bugfix, quickwin]
created: 2026-04-15
completed: 2026-04-15
---

# Navigation — Sửa các lỗi còn lại

## Bối cảnh
Vòng fix trước đã xử lý xong 11 chỗ hardcode màu trong `src/blocks/navigation/index.tsx`. Navigation giờ đã đổi màu theo theme site (sáng/tối). TypeScript sạch. File vẫn còn 4 nhóm lỗi nữa cần fix để đạt mức "đẹp" thực sự.

## Phạm vi
Chỉ fix các lỗi logic + code duplicate. KHÔNG refactor file 924 dòng thành subdir `variants/` (việc đó để Phase 03 của plan chính làm sau).

## Danh sách lỗi cần fix

### Lỗi A — URL CTA hardcode `/contact` (15 phút, P1)
**File**: `src/lib/ai/template-composer.ts` dòng 157
**Code hiện tại**:
```ts
ctaButton: { show: true, label: resolveCTA(mood, category, 'primary'), url: '/contact' }
```
**Vấn đề**: nếu site gen ra không có page `/contact` (ví dụ template chỉ có Home + About + Services) → nút CTA nav click sẽ dẫn tới 404.

**Cách sửa**:
1. Thêm helper `resolveNavCtaUrl(pages: string[]): string` ngay trong template-composer.ts hoặc file shared.
2. Logic: nếu `pages.includes('contact')` → trả `/contact`. Nếu không → trả `/#contact` (anchor tới contact block trên homepage nếu có). Nếu không có cả 2 → trả page đầu tiên khác Home (ưu tiên `/services` hoặc `/about`).
3. Gọi helper: `url: resolveNavCtaUrl(pages)`.

**Kiểm tra**: gen 1 site 3-page không có `/contact` → confirm nút CTA nav dẫn đúng.

---

### Lỗi B — Composer default `variant: 'simple'` cứng (15 phút, P2)
**File**: `src/lib/ai/template-composer.ts` dòng 154
**Code hiện tại**:
```ts
return {
    blockType: 'navigation',
    variant: 'simple',
    logoText: biz.name,
    ...
}
```
**Vấn đề**: `rotateStructuralVariants` (dòng 1398-1419) ĐANG override biến thể này theo category pool, nên luồng gen chính vẫn ok. NHƯNG nếu có luồng khác gọi `buildNavigation` mà không qua rotate (ví dụ editor tạo page mới bằng tay, hoặc template preview trong dashboard) → nav luôn kẹt ở `simple`.

**Cách sửa**:
1. Xoá dòng `variant: 'simple'` khỏi return object của `buildNavigation`.
2. Để `rotateStructuralVariants` gán variant sau. Nếu không qua rotate, block vẫn valid vì `NavigationConfigSchema.variant` có default `'simple'` ở Zod layer (config.ts dòng 31).
3. Hoặc an toàn hơn: gọi `seededShufflePick(NAV_VARIANT_BY_CATEGORY[category] ?? ['simple'], seedOrFallback)` ngay trong `buildNavigation` — đồng bộ với pattern hero đang dùng.

**Kiểm tra**: grep `variant:` trong `buildNavigation` return → không còn. Grep `seededShufflePick` → có call mới.

---

### Lỗi C — Logo logic duplicate trong TransparentNav (30 phút, P2)
**File**: `src/blocks/navigation/index.tsx` dòng 446-459
**Code hiện tại**: TransparentNav render logo bằng block inline `{mergedBlock.logo?.url ? <img .../> : <span style={...}>...</span>}`, không dùng shared `NavLogo` component ở dòng 18.

**Vấn đề**: logic render logo có 3 bản (NavLogo dòng 18, TransparentNav dòng 446, Pill đã fix). Fix NavLogo không tự động áp dụng TransparentNav. Khó maintain.

**Cách sửa**:
1. Nâng cấp `NavLogo` nhận thêm prop optional `gradientMode: 'always' | 'when-scrolled' | 'never'`.
2. Default `'always'` (giữ behavior cũ cho simple/centered/mega-menu/sidebar).
3. TransparentNav truyền `gradientMode="when-scrolled"` + prop `scrolled={scrolled}` — khi `scrolled=false` logo text dùng `color: 'inherit'` (trắng trên hero), khi `scrolled=true` dùng gradient.
4. Xoá block inline trong TransparentNav, thay bằng `<NavLogo logo={...} logoText={...} gradientMode="when-scrolled" scrolled={scrolled} />`.

**Kiểm tra**: grep `WebkitBackgroundClip` trong navigation/index.tsx → chỉ còn 1 chỗ (trong NavLogo). Visual: TransparentNav khi scroll → logo có gradient primary→secondary; khi chưa scroll → logo trắng trên hero.

---

### Lỗi D — Không shrink khi scroll cho simple/centered/mega-menu (2-3h, P2)
**File**: `src/blocks/navigation/index.tsx`
**Vấn đề**: 3 variant này `sticky top-0` nhưng chiều cao `h-16` không đổi khi scroll. Wix + Framer luôn shrink nav khi user scroll xuống để nhường không gian cho content.

**Cách sửa**:
1. Tạo hook mới `useScrollShrink(threshold = 50)` trong `src/blocks/navigation/helpers/use-scroll-shrink.ts` (tạo folder helpers).
2. Hook return `scrolled: boolean`. Thêm listener với `{ passive: true }`, cleanup trong `useEffect` return.
3. Respect `prefers-reduced-motion`: nếu user prefer reduced → luôn return `false` (không animate).
4. 3 variants (simple/centered/mega-menu) call hook, gán class `transition-all duration-300` + chiều cao `h-16` (chưa scroll) / `h-14` (đã scroll) + giảm padding logo từ `text-xl` xuống `text-lg` khi scrolled + shadow tăng `shadow-sm → shadow-md`.
5. TransparentNav đã có logic scrolled riêng, KHÔNG đụng vào.

**Kiểm tra**: mở 1 site gen ra, scroll xuống 100px → nav co lại từ 64px → 56px, logo nhỏ lại. Tắt prefers-reduced-motion trong dev tools → test lại, nav phải giữ nguyên kích thước.

---

## Thứ tự làm

Làm tuần tự theo effort tăng dần:
1. **Lỗi A** (15 phút) — helper + thay hardcode URL
2. **Lỗi B** (15 phút) — xoá default variant
3. **Lỗi C** (30 phút) — refactor NavLogo nhận gradientMode prop
4. **Lỗi D** (2-3h) — hook useScrollShrink + áp vào 3 variants

Tổng: **3-4 giờ**.

## Tiêu chí hoàn thành
- [x] URL CTA nav không bao giờ dẫn tới 404 — `resolveNavCtaUrl` fallback chain contact/services/about/booking/pricing/#contact
- [x] `buildNavigation` return object không còn hardcode `variant: 'simple'` — xoá, Zod schema default tự fill
- [x] Grep `WebkitBackgroundClip` trong navigation/index.tsx chỉ còn 1 chỗ (trong NavLogo `LOGO_GRADIENT_STYLE`)
- [x] Scroll xuống 50px trên simple/centered/mega-menu → nav co từ h-16 xuống h-14 + shadow
- [x] `prefers-reduced-motion: reduce` → `useScrollShrink` early return false, nav không animate
- [x] `npx tsc --noEmit` sạch
- [x] 12/12 tests pass (navigation-variants + navigation-render)

## Kết quả thực hiện (2026-04-15)
- **File sửa**: `src/lib/ai/template-composer.ts`, `src/blocks/navigation/index.tsx`
- **File mới**: `src/blocks/navigation/use-scroll-shrink.ts`
- **DRY bonus**: TransparentNav cũng migrate sang `useScrollShrink(100)` thay cho inline useEffect cũ — xoá `useEffect` khỏi import.
- **Code review**: 8.5/10, approved.

## Rủi ro
- **Lỗi B**: nếu Zod schema không apply default khi skip field → nav render lỗi. Kiểm tra bằng cách gen 1 site và xem DB record nav block có field `variant` không.
- **Lỗi C**: TransparentNav behavior đang phức tạp, thay NavLogo có thể làm mất hiệu ứng scrolled transition. Chụp screenshot trước/sau để so sánh.
- **Lỗi D**: hook scroll listener nếu quên cleanup → memory leak khi navigate giữa page. `useEffect` return phải xoá listener.

## Câu hỏi còn bỏ ngỏ
1. Khi site chỉ có 1 page Home, nút CTA nav nên dẫn tới đâu? → đề xuất fallback `/#contact-block-id` nếu có contact block trong page, ngược lại `/#footer`.
2. Scroll threshold 50px có phù hợp mobile không? (mobile hero thường 90vh ≈ 800px, scroll 50px vẫn đang trong hero) → cân nhắc threshold 100px hoặc tính theo `window.innerHeight * 0.1`.
