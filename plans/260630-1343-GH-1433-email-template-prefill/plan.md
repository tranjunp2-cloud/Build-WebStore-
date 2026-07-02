---
title: "GH-1433 — Prefill email template form fields with defaults"
status: pending
priority: P2
branch: fix/GH-1433-email-templates-prefill-defaults
created: 2026-06-30
---

# GH-1433 — Prefill email template inputs with default content

## Goal (per user clarification)
Đổ nội dung default (cái Live Preview đang render) vào input tương ứng của form,
để form ↔ preview cùng một nguồn. KHÔNG đụng kiến trúc customizable (không ẩn
field theo template — giữ form 4 field như hiện tại).

## Root cause (xem report debugger-260630-1106)
Form init `draft` = `EMPTY_CONTENT` khi chưa có CMS row; preview server merge
default từ i18n/template base. → form rỗng, preview đầy.

## Approach (Core prefill)
1. **`src/lib/email/template-default-fields.ts`** (mới):
   `getDefaultContentFields(type, locale): ContentFields` — trả RAW default
   (giữ token `{var}`, KHÔNG substitute) cho subject/greeting/ctaLabel/closing,
   bằng đúng `base` + `fieldMap` mỗi template dùng. Field không map → undefined.
   - 16 template overridable: lấy default từ base i18n section (`en/ms.json email.*`)
     hoặc inline literal (payment-confirmed/rejected, staff-invitation) theo đúng template.
   - `order-waiting` (không nhận config): lấy inline `strings[locale]` (subject/greeting/cta).
2. **`page.tsx`**: precompute `defaultsByType: Record<type, {contentEn, contentMs}>`
   (server) → truyền prop xuống `EmailTemplatesClient`.
3. **`EmailTemplatesClient.tsx`**: thay 4 chỗ `EMPTY_CONTENT` (init L63, open L78-79,
   revert L111-112, reset L175) bằng merge `field = row[field] || default[field]`.
   Dirty vẫn false khi mở (prefill không gọi onFieldChange) → Save disabled đến khi edit.
4. Tests: extractor trả default đúng cho vài template tiêu biểu (welcome đủ 4,
   order-status chỉ greeting, order-waiting subject); client init prefill default khi no-row.

## AC (issue)
- Mở chưa edit → field prefill default ✓
- form ↔ preview cùng nguồn ✓
- EN + MS, switch locale refill ✓ (set cả contentEn/Ms từ default khi open)
- giữ default + Save → không dirty (Save disabled) ✓
- edit→save→reopen → giữ giá trị (row override default) ✓

## Out of scope
- Ẩn field không hỗ trợ per template (field-aware) — user chọn KHÔNG làm.
- order-waiting/payment-retry customizable hoá.
