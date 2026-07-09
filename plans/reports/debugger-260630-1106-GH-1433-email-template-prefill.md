# Debugger Report — GH-1433 Email Template fields rỗng (prefill defaults)

**Date:** 2026-06-30 · **Branch:** `fix/GH-1433-email-templates-prefill-defaults` · **Status:** root-caused, chưa implement

## Triệu chứng
Mở `Settings → Email Templates → [template]` chưa edit → 4 field (Subject/Greeting/CTA/Closing) **rỗng** (0/N), nhưng Live Preview render đúng nội dung default. User không map được field ↔ preview.

## Root cause
Form và preview lấy default từ **2 nguồn khác nhau**:

1. **Form (client)** init `draft.contentEn/Ms` = `EMPTY_CONTENT` (4 chuỗi rỗng) khi không có CMS row.
   - `EmailTemplatesClient.tsx:43` `EMPTY_CONTENT`, dùng ở init `:63`, `openTemplate :78-79`, `revert :111-112`.
2. **Preview (server)** POST `draftConfig` → `/api/email-preview` → `templateRegistry[type](fixture, config)` → mỗi template gọi `mergeTemplateConfig(defaults, config, vars, fieldMap)`:
   - `merge-template-config.ts:74-77` — field nào config rỗng thì **lấy default** từ `defaults` (= `i18n/locales/{en,ms}.json` → `email.<template>.<key>`).
   - → preview luôn đầy đủ, form thì rỗng. **Mismatch.**

## Phát hiện kiến trúc quan trọng (mở rộng scope)
**Mỗi template overridable một SUBSET field khác nhau** (qua `fieldMap` riêng), nhưng form **luôn render cứng 4 field** (`email-template-form-card.tsx:167-203`, `LIMITS` 4 field).

| Template | Field overridable (fieldMap) |
|---|---|
| `order-status` | **chỉ greeting** |
| `order-confirmation/completed/shipped` | greeting, ctaLabel, closing (subject computed, KHÔNG override) |
| `welcome/payment-*/staff-invitation` | subject, greeting, ctaLabel, closing |
| `contact-from-seller/new-order-seller/newsletter` | subject, greeting, ctaLabel (closing: undefined) |
| `otp/password-changed` | subject, greeting, closing |
| `bank-transfer` | greeting, ctaLabel(uploadCta), closing(farewell) |

→ Với `order-status`, các field Subject/CTA/Closing trên form **không có tác dụng** (không nằm fieldMap) → kể cả prefill cũng vô nghĩa / không có default để prefill. i18n key map cũng khác nhau (`cta`/`ctaLabel`/`uploadCta`, `footer`/`farewell`).

## Files liên quan
- `src/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient.tsx` — state owner, init draft (EMPTY_CONTENT)
- `…/_components/email-template-form-card.tsx` — render cứng 4 field
- `…/_components/EmailPreviewPane.tsx` — POST /api/email-preview
- `src/lib/email/merge-template-config.ts` — merge default ↔ config (server source of truth)
- `src/lib/email/templates/*.ts` — fieldMap + default i18n key per template
- `src/lib/email/types.ts` — `EmailTemplateConfig`, `ContentFields`
- `src/i18n/locales/{en,ms}.json` → `email.*` — nguồn default thật

## Fix đề xuất

### Core (đúng bug report) — prefill defaults
Tạo `src/lib/email/get-default-content-fields.ts`: `getDefaultContentFields(type, locale): ContentFields` — centralize fieldMap (config key → i18n key) per template, đọc en/ms.json trả raw default (GIỮ token `{var}`, không substitute). Server page truyền `defaultsByType` xuống `EmailTemplatesClient`. Client init `draft = { ...defaults, ...row.content }` thay vì EMPTY_CONTENT; đổi locale → refill default locale đó. Dirty vẫn false khi giữ default (prefill không trigger change) → Save disabled đến khi edit thật. ✅ khớp AC.

### Đúng hơn (khuyến nghị kèm) — chỉ show field template hỗ trợ
Expose fieldMap per template cho client → form chỉ render field nằm trong fieldMap (vd order-status chỉ hiện Greeting). Tránh user edit field "ma" (Subject order-status) không có tác dụng. Mở rộng `email-template-form-card.tsx` + cần một `SUPPORTED_FIELDS_BY_TYPE`.

## Trade-off / quyết định cần user
1. Chỉ làm **Core prefill** (4 field cứng, field không có default vẫn rỗng) — nhanh, nhưng order-status vẫn còn 3 field rỗng "ma".
2. **Core + show-supported-fields** — đúng & sạch, nhưng đụng form layout + cần export fieldMap (centralize), nhiều code + i18n label hơn.

## Unresolved
- `fieldMap` hiện duplicate trong từng template module → nên centralize thành 1 map dùng chung cho cả render lẫn form (DRY). Cần xác nhận hướng trước khi code.
- AC "switch locale → refill default locale đó" + "edit→save→reopen giữ giá trị": cần test kỹ revert/dirty logic.
