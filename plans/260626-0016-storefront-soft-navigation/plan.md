# Plan: Storefront Soft Navigation (fix hard-reload khi chuyển trang)

> Status: **DRAFT — chờ review, chưa code**
> Created: 2026-06-26 | Branch: `staging` | Slug: `storefront-soft-navigation`

## Vấn đề

Khi visitor click menu/link trên storefront, trang bị **full HTML reload** (hard navigation)
thay vì soft navigation của Next.js App Router → trải nghiệm giật, không mượt.

## Root cause

Các block render storefront dùng thẻ `<a href={resolveHref(...)}>` thô cho link **nội bộ**.
Thẻ `<a>` khiến trình duyệt bỏ React app, tải lại full HTML + hydrate lại từ đầu.
Bằng chứng tương phản: logo (`navigation/index.tsx:95`) dùng `<Link>` → mượt; menu items dùng `<a>` → reload.

Yếu tố phụ: trang storefront `force-dynamic` (`sites/[slug]/[[...path]]/page.tsx:19`) → kể cả sau
khi sửa, mỗi soft-nav vẫn gọi server render RSC (không cache). Nhẹ hơn full HTML nhiều, nhưng vẫn có round-trip.

## Phát hiện an toàn (cho phép fix yên tâm)

1. Editor preview (`(preview)/preview/[siteId]/page.tsx`) **là Next route** → có router context → `<Link>` chạy được.
2. Editor chặn click qua `target.closest('a')` (`PreviewScripts.tsx:567`). `<Link>` render ra `<a>` trong DOM
   → interceptor vẫn bắt → **đổi `<a>`→`<Link>` không phá việc chọn block trong editor**.
3. `useLocalHref` (resolver href) là hook client thuần, không phụ thuộc thẻ — tái dùng nguyên vẹn với `<Link>`.

## Phạm vi

~22 link nội bộ `href={resolveHref(...)}` qua nhiều block. **Chỉ đổi link nội bộ** —
GIỮ NGUYÊN `<a>` cho: external (`https://`, `//`), `mailto:`/`tel:`/`sms:`/`whatsapp:`,
anchor `#`, `target="_blank"` (vd client-logos), và CTA có `onClick`/`linkAttrs` đặc thù (cần review từng case).

## Phases

| Phase | Mô tả | Status |
|-------|-------|--------|
| [phase-01](phase-01-convert-links-to-next-link.md) | Đổi `<a>`→`<Link>` cho link nội bộ trong blocks | ⬜ Pending |
| phase-02 (tùy chọn) | Cân nhắc ISR/caching thay `force-dynamic` storefront | ⬜ Chưa lập (cần plan riêng, rủi ro cao) |

## Quyết định cần xác nhận trước khi code

- Có gộp toàn bộ block hay chỉ navigation block trước (giảm rủi ro, fix dần)?
- Helper dùng chung (`<SmartLink>`) hay sửa inline từng chỗ? (xem phase-01 §Phương án)
- Phase-02 (caching) làm sau, plan riêng — không gộp vào lần này.

## Out of scope

- Không động `force-dynamic` trong phase này.
- Không đổi link external / `target=_blank` / mailto-tel.
- Không refactor logic `useLocalHref`.
