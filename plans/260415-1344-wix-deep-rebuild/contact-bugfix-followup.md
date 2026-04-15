---
title: "Contact — Sửa 14 lỗi sau 2 vòng audit (Round 1 + Round 2 deep-dive)"
description: "Fix form submit fake, hardcode màu, thiếu validation, thiếu loading/error state, thiếu semantic interactivity"
status: done
priority: P1
effort: 6-8h
branch: chore/F01-remaining-plans
tags: [contact, bugfix, form, validation, a11y]
created: 2026-04-15
completed: 2026-04-15
---

# Contact — Sửa 14 lỗi còn lại

## Bối cảnh
Audit 2 vòng (Round 1 = 6 lỗi + Round 2 deep-dive = 8 lỗi) tìm thấy 14 issue nghiêm trọng trong `src/blocks/contact/index.tsx`. Form submit là fake (chỉ `preventDefault`), fields thiếu `name`/`autoComplete`/validation, ContactInfoCard không có link thực, UI không có loading/error state, focus handler mutate DOM style. Fix trong PR #636 — 11/14 fix, 3 defer.

## Phạm vi
Fix full-stack: UI state + validation + submit API + Payload collection để lưu submission. KHÔNG thêm reCAPTCHA, KHÔNG thêm rate limit tự build (dùng Vercel edge rate nếu cần sau).

## Danh sách lỗi cần fix

### Round 1 (6 lỗi)

#### Lỗi A — Form submit fake preventDefault (3h, P1)
**File**: `src/blocks/contact/index.tsx` ContactForm handleSubmit
**Vấn đề**: `e.preventDefault()` rồi không gọi API — user tưởng đã gửi nhưng data không đi đâu.
**Cách sửa**: Tạo `src/app/api/contact-submit/route.ts` + ContactSubmissions Payload collection + hook `useContactForm()`. Form gọi hook, hook POST JSON tới API, API validate Zod rồi `payload.create('contact-submissions', data)`.

#### Lỗi B — Fields thiếu validation client + error UI (1.5h, P1)
**Vấn đề**: Type email không check format, submit bỏ trống không báo.
**Cách sửa**: Zod schema shared client/server. Hiện error message dưới từng field + summary `role="alert"` trên form.

#### Lỗi C — handleFocus/handleBlur mutate DOM style (15 phút, P2)
**Vấn đề**: `e.target.style.borderColor = ...` trực tiếp mutate DOM → React state desync.
**Cách sửa**: Xoá handler. Dùng Tailwind `focus-visible:ring-2 focus-visible:ring-primary`.

#### Lỗi D — Map iframe không có fallback **[DEFERRED]** (M, P2)
Defer — cần decision dùng Google Maps Embed API hay Mapbox. Ghi chú trong Open issues.

#### Lỗi E — card-float bg-white dark:bg-zinc-900 hardcode (15 phút, P2)
**Cách sửa**: `background: color-mix(in srgb, var(--surface) 96%, transparent)`.

#### Lỗi F — Chip pill address dài overflow mobile (10 phút, P2)
**Cách sửa**: `max-w-full truncate` + `title={address}` để giữ tooltip.

---

### Round 2 deep-dive (8 lỗi)

#### Lỗi 7Ct — ContactHeader hardcode "Contact" label **[DEFERRED]** (S, P2)
Defer sang Phase 05 i18n pass.

#### Lỗi 8Ct — ContactInfoCard value không interactive (30 phút, P1)
**Cách sửa**: Email → `<a href="mailto:">`, Phone → `<a href="tel:">`, Address → `<a href="https://maps.google.com/?q=${encodeURIComponent(address)}">`.

#### Lỗi 9Ct — FormFieldInput không có name attribute (15 phút, P1)
**Cách sửa**: Thêm `name` + `autoComplete` theo kiểu field (`name="email" autoComplete="email"`, `name="tel" autoComplete="tel"`, `name="name" autoComplete="name"`).

#### Lỗi 10Ct — Phone pattern validation (15 phút, P2)
**Cách sửa**: Zod `.regex(/^[+\d\s()-]{6,20}$/)`. Client field `inputMode="tel"`.

#### Lỗi 11Ct — SubmitButton label hardcode **[DEFERRED]** (XS, P2)
Defer — Phase 05 i18n.

#### Lỗi 12Ct — No loading state on submit (30 phút, P1)
**Cách sửa**: `isSubmitting` state, button `disabled={isSubmitting}` + spinner Lucide `Loader2 animate-spin` + label swap "Sending...".

#### Lỗi 13Ct — No error message area (20 phút, P1)
**Cách sửa**: `<div role="alert" aria-live="polite">` render `submitError` khi API trả 4xx/5xx.

#### Lỗi 14Ct — handleFocus/Blur mutate (merge Lỗi C) — xoá trong cùng commit.

---

## Thứ tự làm

1. **Lỗi A** (3h) — API route + collection + hook (critical path)
2. **Lỗi B + 12 + 13** (2h) — validation + loading + error UI gom chung commit
3. **Lỗi 8Ct + 9Ct + 10Ct** (1h) — semantic links + name attr + phone regex
4. **Lỗi C/14 + E + F** (30 phút) — quick wins hardcode màu + overflow

Tổng: **6.5 giờ**.

## Tiêu chí hoàn thành
- [x] POST `/api/contact-submit` tạo record trong ContactSubmissions collection
- [x] Zod validation shared client/server
- [x] Email `<a mailto>`, Phone `<a tel>`, Address `<a maps>`
- [x] All inputs có `name` + `autoComplete` semantic
- [x] Loading spinner + disabled button khi submit
- [x] Error `role="alert"` div hiện khi fail
- [x] Focus Tailwind (no DOM mutate)
- [x] color-mix cho card-float bg
- [x] `tsc --noEmit` sạch
- [x] Submit thử 1 form thật → record appear trong Payload admin

## Kết quả thực hiện (2026-04-15)
- **PR**: #636 (merged/review)
- **Commit**: ed4dd8a3 (initial) + 5c29c0ac (round 2 follow-up)
- **Files mới**: `src/app/api/contact-submit/route.ts`, `src/collections/ContactSubmissions.ts`, `src/blocks/contact/use-contact-form.ts`
- **Migration**: `contact_submissions` table thêm vào `scripts/db-setup.js`
- **Deferred**: Lỗi D (map fallback), 7Ct (header i18n), 11Ct (button i18n) — track trong open issues

## Rủi ro
- **API endpoint**: phải check CSRF / rate limit mức tối thiểu. Nếu không có Vercel edge middleware → dễ bị spam flood. Mitigation: thêm `headers['origin']` check cùng domain.
- **Zod shared**: nếu import server-only Zod vào client → bundle phình. Đặt schema ở `src/lib/validations/contact.ts` pure để tree-shake.

## Câu hỏi còn bỏ ngỏ
1. Cần lark webhook notify admin khi có submission mới không? (hiện chỉ lưu DB)
2. Map fallback Lỗi D: Google Maps Embed free tier limit vs Mapbox static image?
3. Header + SubmitButton i18n defer tới đâu — Phase 05 hay gộp luôn với newsletter i18n round?
