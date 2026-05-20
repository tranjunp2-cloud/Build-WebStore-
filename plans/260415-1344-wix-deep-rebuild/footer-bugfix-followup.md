---
title: "Footer — Sửa 16 lỗi sau 2 vòng audit"
description: "Fix newsletter inert, TikTok icon sai, zero animations, legal links, WCAG touch target, JSON-LD"
status: done
priority: P1
effort: 5-6h
branch: chore/F01-remaining-plans
tags: [footer, bugfix, a11y, wcag, animation, social-icons]
created: 2026-04-15
completed: 2026-04-15
---

# Footer — Sửa 16 lỗi còn lại

## Bối cảnh
Audit 2 vòng tìm 16 lỗi: newsletter form inert không submit được, TikTok icon fallback sai (Globe), zero animation, responsive break tablet, Privacy/Terms hardcode `href="#"`, social icon < 44px fail WCAG, JSON-LD thiếu. Fix 14/16 trong PR #638. 2 defer (i18n strings + JSON-LD structured data).

## Phạm vi
Đụng `src/blocks/footer/index.tsx` + tạo mới `src/blocks/footer/footer-newsletter-form.tsx` + `src/blocks/shared/social-icons.tsx` (reuse cho team block sau). KHÔNG thêm cookie consent banner (scope riêng).

## Danh sách lỗi cần fix

### Round 1 (6 lỗi)

#### Lỗi A — Newsletter inputs hoàn toàn inert (2h, P1)
**Vấn đề**: Input + button render nhưng không có onChange/onSubmit → user nhập email rồi click nothing happens.
**Cách sửa**: Tạo `FooterNewsletterForm` component với `useState` email + POST `/api/subscribe` + loading/success/error state.

#### Lỗi B — TikTok icon Globe fallback sai (30 phút, P2)
**Vấn đề**: `lucide-react` không có TikTok icon → code fallback Globe → user confused.
**Cách sửa**: Tạo `src/blocks/shared/social-icons.tsx` export inline SVG cho TikTok + các platform không có trong lucide. Component `<SocialIcon platform="tiktok" />` pick từ map.

#### Lỗi C — Footer zero animations (45 phút, P2)
**Cách sửa**: `motion.footer` với `whileInView={{ opacity: 1, y: 0 }}` + `viewport={{ once: true, margin: '-100px' }}`. Respect reduced-motion.

#### Lỗi D — Simple variant grid md:grid-cols-2 tablet break (5 phút, P2)
**Cách sửa**: `sm:grid-cols-2 md:grid-cols-4`.

#### Lỗi E — Mega-footer gap-8 mobile squish (5 phút, P2)
**Cách sửa**: `gap-6 sm:gap-8`.

#### Lỗi F — Privacy/Terms hardcode href="#" (30 phút, P1)
**Cách sửa**: Thêm prop `legalLinks: { privacy?: string; terms?: string }` trong FooterConfigSchema. Default `/privacy` + `/terms`. Nếu không có value → link vẫn render nhưng `opacity-60 cursor-not-allowed` + `aria-disabled`.

---

### Round 2 (10 lỗi)

#### Lỗi 7F — SocialIcon fallback letter (10 phút, P2)
**Cách sửa**: Fallback dùng `Link` icon Lucide thay letter ugly.

#### Lỗi 8F — BrandLogo alt='' (5 phút, P2)
**Cách sửa**: `alt={\`${logoText} logo\`}`.

#### Lỗi 9F — Mega-footer hardcode "Stay Connected" **[DEFERRED]** (S, P2)
Defer — Phase 05 i18n.

#### Lỗi 10F — expanded silently drop columns>3 **[DEFERRED]** (XS, P3)
Defer — dev-only warning đủ, không user-facing.

#### Lỗi 11F — minimal silently drop links>6 **[DEFERRED]** (XS, P3)
Defer — dev-only warning.

#### Lỗi 12F — LinkColumn opacity-40 WCAG fail (5 phút, P1)
**Cách sửa**: `opacity-70` (3:1 → 4.5:1 contrast ratio).

#### Lỗi 13F — Organization JSON-LD **[DEFERRED]** (M, P2)
Defer sang SEO sprint — cần schema.org/Organization + logo + sameAs social links.

#### Lỗi 14F — GradientLine always show (10 phút, P3)
**Cách sửa**: Minimal variant pass `showGradientLine={false}`.

#### Lỗi 15F — Social icon w-8/w-9 < 44px WCAG (10 phút, P1)
**Cách sửa**: `w-11 h-11` (44px) min touch target theo WCAG 2.5.5.

#### Lỗi 16F — dark-gradient hardcode rgba(0,0,0,0.08) (10 phút, P2)
**Cách sửa**: `color-mix(in srgb, var(--background) 92%, transparent)`.

---

## Thứ tự làm

1. **Lỗi A** (2h) — FooterNewsletterForm component — critical path
2. **Lỗi B + 7F** (40 phút) — shared social-icons.tsx
3. **Lỗi C** (45 phút) — motion animation
4. **Lỗi F** (30 phút) — legalLinks config
5. **Lỗi 12F + 15F** (15 phút) — WCAG fixes (P1)
6. **Lỗi D + E + 8F + 14F + 16F** (30 phút) — quick wins gom 1 commit

Tổng: **5 giờ**.

## Tiêu chí hoàn thành
- [x] FooterNewsletterForm POST `/api/subscribe` + loading + toast
- [x] `src/blocks/shared/social-icons.tsx` có TikTok inline SVG, team block sẽ reuse
- [x] `motion.footer` scroll reveal, respect reduced-motion
- [x] Simple variant responsive `sm → md`
- [x] legalLinks default `/privacy` + `/terms`
- [x] Social icon `w-11 h-11` (44px WCAG)
- [x] LinkColumn `opacity-70` WCAG contrast
- [x] BrandLogo alt semantic
- [x] Minimal variant ẩn gradient line
- [x] `tsc --noEmit` sạch

## Kết quả thực hiện (2026-04-15)
- **PR**: #638 (merged/review)
- **Commit**: 46d43b69
- **Files mới**: `src/blocks/footer/footer-newsletter-form.tsx`, `src/blocks/shared/social-icons.tsx`
- **Reuse**: social-icons.tsx sau đó được team block (PR #641) dùng chung — confirm Decision 3
- **Deferred**: 9F (i18n), 10F/11F (dev warnings), 13F (JSON-LD SEO sprint)

## Rủi ro
- **Newsletter form**: nếu backend `/api/subscribe` chưa deploy → footer submit fail. Đảm bảo PR #637 merge trước hoặc cùng lúc.
- **motion bundle**: `framer-motion` đã có trong bundle từ hero/cta. Không thêm dep mới.
- **Social SVG**: inline SVG path dài làm JSX file to. Cân nhắc extract ra file `.svg.tsx` riêng nếu > 10 icons.

## Câu hỏi còn bỏ ngỏ
1. JSON-LD Organization cần fields gì: logo URL, sameAs (social links), contactPoint? Coordinate với SEO sprint.
2. Cookie consent banner có cần ngay không? GDPR/PDPA Việt Nam tác động launch 15/04 không?
3. legalLinks: nếu site không có page `/privacy` thực → render disabled link vs ẩn hoàn toàn, bản nào tốt hơn UX?
