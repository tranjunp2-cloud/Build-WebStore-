---
title: "Newsletter — Fix popup fake dialog + quick wins, defer backend compliance"
description: "Fix real HTML5 dialog, rate limit handling, AbortController cleanup; defer double opt-in/GDPR/unsubscribe"
status: partial
priority: P1
effort: 3-4h
branch: chore/F01-remaining-plans
tags: [newsletter, bugfix, dialog, a11y, compliance-deferred]
created: 2026-04-15
completed: 2026-04-15
---

# Newsletter — Fix UI, defer backend compliance

## Bối cảnh
Audit tìm 13 lỗi newsletter: 1 critical (popup variant không phải real dialog), 5 quick wins UI, và 7 lỗi backend compliance (double opt-in, GDPR consent, unsubscribe, retry logic, i18n, variants mới). Session này fix UI-only (6 lỗi). Backend compliance **REVERTED khỏi scope PR #637** — cần migration + SES confirm route + consent schema, task riêng.

## Phạm vi
Chỉ đụng `src/blocks/newsletter/index.tsx` + `src/blocks/newsletter/email-form.tsx`. Không alter Subscribers collection, không thêm API route mới. Rate limit 429 retry-after handled client-side.

## Danh sách lỗi cần fix

### Round 1 — critical (1 lỗi)

#### Lỗi A — Popup variant không phải real dialog (1.5h, P1)
**File**: `src/blocks/newsletter/index.tsx` NewsletterPopup
**Vấn đề**: Dùng `<div>` fake overlay → screen reader không thấy, Escape không đóng, focus trap không có, backdrop click không handle.
**Cách sửa**: Dùng native `<dialog ref={dialogRef}>` + `dialogRef.current.showModal()`. Trigger: `setTimeout` 30s sau mount, check `localStorage.getItem('newsletter-dismissed')` < 7 ngày thì skip. Escape + backdrop click gọi `dialogRef.current.close()` + set localStorage `Date.now()`. Cleanup timer trong useEffect return.

---

### Quick wins (5 lỗi)

#### Lỗi G — site?.id != null safe cast (5 phút, P3)
**Cách sửa**: `String(site?.id ?? '')` thay `site?.id as string`.

#### Lỗi D — Native HTML5 email validation (5 phút, P3)
**Cách sửa**: Input `type="email" required` + `pattern=".+@.+\..+"` để browser validate trước submit.

#### Lỗi J — 429 rate limit handle Retry-After (20 phút, P2)
**Cách sửa**: Fetch response `.status === 429` → đọc `response.headers.get('retry-after')` → hiện toast "Quá nhiều yêu cầu, thử lại sau {n}s".

#### Lỗi L — AbortController cleanup useEffect (10 phút, P3)
**Cách sửa**: `const ac = new AbortController()` trong submit, pass `signal: ac.signal` vào fetch. useEffect return call `ac.abort()` khi unmount giữa chừng.

#### EmailForm variantColor inverse cho banner gradient (15 phút, P2)
**Vấn đề**: Input trên banner gradient tối → text đen không đọc được.
**Cách sửa**: Prop `variantColor?: 'default' | 'inverse'`. Banner pass `inverse` → input bg `bg-white/95` + text `text-foreground`. Submit button `bg-white text-primary`.

---

### Deferred — backend compliance scope riêng (7 lỗi)

| Lỗi | Mô tả | Lý do defer |
|---|---|---|
| B | Banner text `#ffffff` hardcode (partial) | Đã migrate sang `variantColor='inverse'` pattern, banner text còn white nhưng qua prop — acceptable. |
| C | i18n strings | Defer Phase 05 i18n pass gom luôn contact/cta/footer |
| F | Unsubscribe mechanism | Cần alter Subscribers + unsubscribe token + `/unsubscribe` route — PR riêng |
| H | Double opt-in | Cần confirm token + SES template + email route — PR riêng |
| I | GDPR consent checkbox | Phụ thuộc H (không có consent thì không lưu) |
| E | Fetch retry + timeout | Defer — Lỗi J handle 429 là đủ, retry full cần backoff policy thảo luận |
| K | 3 variants mới (lead-magnet/multi-step/social-proof) | Phase 05 feature add, không phải bugfix |
| M | Controlled input persist localStorage | Nice-to-have, defer |

Track các lỗi defer này trong plan riêng `plans/260415-newsletter-compliance/` (sẽ tạo sau).

---

## Thứ tự làm

1. **Lỗi A** (1.5h) — real dialog + timer + localStorage
2. **variantColor** (15 phút) — EmailForm inverse prop
3. **Lỗi J** (20 phút) — 429 handler
4. **Lỗi G + D + L** (20 phút) — gom commit quick wins

Tổng: **2.5 giờ** (UI scope).

## Tiêu chí hoàn thành
- [x] `<dialog>` native, `showModal()`, Escape đóng, backdrop close, focus trap auto
- [x] Timer 30s + localStorage 7-day dismiss
- [x] Banner gradient dùng `variantColor='inverse'`, text đọc được
- [x] 429 Retry-After parsed + hiện toast
- [x] AbortController cleanup khi unmount
- [x] `site?.id` safe String cast
- [x] `tsc --noEmit` sạch

## Kết quả thực hiện (2026-04-15)
- **PR**: #637 (merged/review)
- **Commit**: a6fbc712
- **Status**: partial — UI scope done, backend compliance (F/H/I) defer sang PR riêng
- **Decision**: Decision 7 (full compliance) REVERTED — scope quá lớn cho 1 PR

## Rủi ro
- **Lỗi A dialog**: native `<dialog>` Safari 15.4+ mới support `showModal`. Check browserslist. Nếu cần support cũ → polyfill `dialog-polyfill` (+2KB bundle).
- **localStorage dismiss**: user clear storage → popup show lại. Acceptable, đây là dismiss không phải unsubscribe.

## Câu hỏi còn bỏ ngỏ
1. Compliance defer tới sprint nào? Cần cho launch v1.0 không (15/04) hay v1.1 (30/04)?
2. Banner text hardcode `#ffffff` có đủ WCAG contrast trên mọi gradient preset không? Cần audit preset colors.
3. Variants mới (K) — PM muốn prioritize variant nào trước? lead-magnet cho SaaS, social-proof cho e-commerce?
