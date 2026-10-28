# PRD: Landing page v2 (F45)

> **Owner:** PM · **Status:** Ready · **Wave:** 8 · **Priority:** P0 · **Date:** 28/10/2026
> **Stories:** [F45-landing-v2-stories.md](../stories/F45-landing-v2-stories.md) · **QA:** [docs/qa/F45-landing-v2.md](../qa/F45-landing-v2.md)
> **Design source:** Claude Design handoff `design_handoff_landing_v2` (prototype + spec) đã được PO duyệt qua prototype HTML ngày 28/10/2026.

## 1. Mục tiêu

Thay trang chủ marketing `/` hiện tại bằng landing mới, đúng với sản phẩm Web Store 2.0:

- Trang hiện tại nội dung cũ (chỉ nói AI builder + editor), có claim sai/không kiểm chứng ("900+ templates", "Leading in Vietnam", số khách hàng), link Pricing/Watch demo chết, tông màu sáng khác app.
- Landing v2 cho thấy sản phẩm thật (video intro, UI mock), một CTA chính, mobile-first, theme tối khớp với app.

## 2. Phạm vi

| Trong phạm vi | Ngoài phạm vi (làm sau) |
|---|---|
| Thay `src/app/(frontend)/page.tsx` bằng landing v2 | Testimonials (ẩn tới khi có quote thật) |
| EN + BM (dùng `I18nProvider` / `prefer_lang`) | Bảng giá, nút Contact sales, WhatsApp |
| Theme tối mặc định + nút đổi sang sáng (để review, chốt 1 theme sau) | Footer pháp lý (Privacy/Terms/SSM) — chờ legal |
| Video intro dùng lại `V2_INTRO_MEDIA` (đã có trên staging) | Route `/en` `/ms` + hreflang, analytics events |
| Template preview dùng `/api/templates/list` + `/api/templates/preview` | Logo đối tác thanh toán (chờ phép dùng brand) |

## 3. Cấu trúc trang (trên → dưới)

| # | Section | Anchor | Nội dung chính |
|---|---|---|---|
| 1 | Nav (sticky) | — | Logo "Web Store" (chữ "Store" `#06B6D4` như CMS) · How it works · Features · Templates · FAQ · đổi theme · EN/BM · Sign in · Get started free. Dưới 1100px: menu hamburger |
| 2 | Hero | `top` | Eyebrow "AI-powered website & online store builder" · H1 2 dòng ("Describe your business." / "AI builds your online store.") · 1 câu overview · CTA chính + "See how it works" · 3 dòng tick · video intro |
| 3 | How it works | `how` | 3 bước, mỗi bước có UI mock |
| 4 | Features (bento) | `features` | 10 thẻ: AI builder, Visual editor, ECH Agent, Local payment methods, EasyParcel, Orders/customers/discounts, SEO health, 56 templates, EN & BM, Notifications |
| 5 | Product tour | `tour` | 1 section có 4 tab: AI editor · ECH Agent · Sell & ship · Get found. Desktop: tab dọc trái + visual phải, tự chuyển 7 s; mobile: chip ngang |
| 6 | Templates | `templates` | Chip 14 ngành + All, băng chuyền 1 hàng (4/2/1 card), nút trái/phải, "Browse all templates" → `/templates` |
| 7 | FAQ | `faq` | 2 cột: nhóm (Getting started · Selling & orders · Domain & growth) + accordion. Nội dung lấy từ Help Center Q&A (`help.qna`) + câu hỏi bán hàng |
| 8 | Final CTA | `contact` | Mascot + "Ready to open your online store?" + 1 nút Get started free |
| 9 | Footer | — | Logo + tagline · 4 link · EN/BM · Sign in · Get started free · © 2026 |

## 4. Quy tắc nội dung (PO chốt 28/10/2026)

- Không gắn riêng thị trường Malaysia ở hero/tagline (để mở rộng thị trường sau). Chi tiết FPX / DuitNow QR / EasyParcel chỉ nằm ở bento, tour, FAQ.
- Không nhắc **Xendit** và **e-wallets**. Thanh toán: Card + FPX (Stripe), DuitNow QR, COD.
- Không có nhãn "Pro" trên template, không có "Contact sales".
- Không số liệu chưa kiểm chứng (số khách hàng, rating, uptime). Chỉ dùng claim đã kiểm chứng trong code: 56 template / 14 ngành, AI dựng site ~30–60 s (Help Center), ECH Agent đề xuất → merchant duyệt → hoàn tác 7 ngày.
- BM là bản nháp, cần người bản ngữ duyệt trước khi lên production.

## 5. UX / chuyển động

- Nội dung rộng tối đa 1320px; section padding 96/32 (≥960px), 72/20 (mobile).
- Hero xuất hiện theo nhịp; khung video nghiêng → phẳng khi cuộn; thanh tiến trình đọc trên nav; scrollspy; reveal khi cuộn (lên/trái/phải/phóng); spotlight theo con trỏ trên card.
- `prefers-reduced-motion`: tắt toàn bộ chuyển động, nội dung hiện ngay.
- Không tràn ngang từ 320px đến 1920px (EN và BM). Vùng bấm ≥ 44px trên mobile.

## 6. Kỹ thuật

- `page.tsx` (server) export metadata; UI là client component trong `src/components/landing-v2/` (mỗi file < 200 dòng).
- CSS scoped dưới `.lv` để không ảnh hưởng dashboard sau khi điều hướng.
- Copy: namespace `landingV2` trong `src/i18n/locales/en.json` + `ms.json`.
- Không thêm env var, không đổi schema DB, không thêm file video mới.
- "Get started free" → `/register`; "Sign in" → `/login`.

## 7. Câu hỏi mở

1. Dark hay light làm theme chính thức (sau khi review trên staging)?
2. Số WhatsApp / link Contact sales khi bật lại kênh liên hệ.
3. Privacy / Terms / thông tin pháp nhân cho footer.
4. Người duyệt bản BM.
