# Phase 01 — Đổi `<a>` → `<Link>` cho link nội bộ trong blocks

## Overview
- **Priority:** High (UX storefront)
- **Status:** Pending (chưa code — chờ duyệt)
- **Mục tiêu:** Chuyển link điều hướng nội bộ từ hard navigation (`<a>`) sang soft navigation (`next/link <Link>`).

## Key Insights
- `<Link>` render thành `<a>` trong DOM → editor interceptor (`PreviewScripts.tsx:567` dùng `target.closest('a')`) vẫn hoạt động.
- `useLocalHref()` resolver giữ nguyên — chỉ đổi element bao ngoài.
- Logo đã dùng `<Link>` thành công trong cùng context → pattern đã được chứng minh.

## Phương án triển khai (chọn 1)

**Phương án A — Sửa inline từng chỗ (KISS, ít abstraction):**
Đổi trực tiếp `<a href={resolveHref(x)}>...</a>` → `<Link href={resolveHref(x)}>...</Link>`, thêm `import Link from 'next/link'`.
- Ưu: rõ ràng, dễ review từng diff. Nhược: lặp lại, dễ sót case external.

**Phương án B — Helper `<SmartLink>` dùng chung (DRY):**
Tạo `src/blocks/_shared/smart-link.tsx`: nhận `href`, tự quyết định:
- external / mailto / tel / sms / whatsapp / `#` / `target=_blank` → render `<a>`
- còn lại (nội bộ) → render `<Link>`
Thay thế các block dùng `<SmartLink>`.
- Ưu: 1 chỗ kiểm soát logic, tránh sót. Nhược: thêm 1 component, cần test kỹ lần đầu.

> Khuyến nghị: **Phương án B** — vì có ~22 điểm rải rác, logic "khi nào dùng Link vs a" cần tập trung 1 nơi
> (đúng tinh thần `useLocalHref` đã phân loại external/internal sẵn). Tái dùng đúng danh sách prefix đó.

## Related Code Files (cần sửa — link NỘI BỘ)

| File | Dòng | Ghi chú |
|------|------|---------|
| `src/blocks/navigation/nav-desktop-links.tsx` | 29, 79 | menu desktop + dropdown con |
| `src/blocks/navigation/nav-dropdown-link.tsx` | 26, 66 | dropdown |
| `src/blocks/navigation/index.tsx` | 120, 159, 1004, 1063 | mobile/sidebar nav items |
| `src/blocks/footer/index.tsx` | 180, 247, 352 | footer links |
| `src/blocks/breadcrumb/index.tsx` | 62 | breadcrumb |
| `src/blocks/service-cards/index.tsx` | 19, 116 | card CTA nội bộ |
| `src/blocks/hero/variants/fullscreen.tsx` | 35 | hero CTA (motion.a → cân nhắc) |
| `src/blocks/hero/variants/minimal.tsx` | 57 | hero CTA |
| `src/blocks/video-background/index.tsx` | 42 | CTA |
| `src/blocks/announcement-bar/index.tsx` | 64 | announcement link |
| `src/blocks/blog-list/index.tsx` | 141, 171 | dùng `blogBasePath` (không qua resolveHref — verify nội bộ) |

## Cần REVIEW kỹ từng case (KHÔNG đổi máy móc)

| File | Dòng | Lý do |
|------|------|-------|
| `src/blocks/cta/index.tsx` | 107, 147 | có `onClick={handleClick}` + `linkAttrs` — kiểm tra handleClick làm gì (analytics? external?) |
| `src/blocks/client-logos/index.tsx` | 51 | `target="_blank"` external → GIỮ `<a>` |
| `navigation/index.tsx` | 691, 1139, 1190 | CTA button trong nav — verify nội bộ hay external |
| `hero/variants/fullscreen.tsx` | 35 | `motion.a` (framer-motion) — cần `motion(Link)` hoặc bọc, test animation |

## Implementation Steps
1. Tạo `src/blocks/_shared/smart-link.tsx` (nếu chọn B): copy danh sách prefix external từ `useLocalHref`.
2. Với `motion.a`: dùng `motion.create(Link)` (framer v11) hoặc bọc `<Link legacyBehavior>` — **test animation không vỡ**.
3. Thay thế theo bảng "cần sửa", bỏ qua bảng external.
4. Với mỗi block: thêm import, đổi element, giữ nguyên className/style/onClick.
5. `npm run build` (hoặc `tsc --noEmit`) kiểm tra compile.
6. Test thủ công: (a) storefront click menu → URL đổi, **không** full reload (Network tab: chỉ có RSC fetch, không tải lại document); (b) editor → click block vẫn select được, không điều hướng; (c) external link vẫn mở tab mới.

## Todo List
- [ ] Quyết định Phương án A vs B
- [ ] (B) Tạo `smart-link.tsx`
- [ ] Đổi navigation block (nav-desktop-links, nav-dropdown-link, index)
- [ ] Đổi footer, breadcrumb, service-cards, announcement-bar, video-background, hero, blog-list
- [ ] Review riêng cta, client-logos, motion.a
- [ ] Build pass
- [ ] Test thủ công 3 context (storefront / editor / external)
- [ ] code-reviewer

## Success Criteria
- Click link nội bộ storefront → soft nav (Network: không reload document, chỉ RSC payload).
- Editor: chọn block vẫn hoạt động, không bị điều hướng.
- External / mailto / tel / `target=_blank` giữ nguyên hành vi.
- Build + lint pass, không regression visual.

## Risk Assessment
- **Editor navigation:** Thấp — interceptor dựa `closest('a')`, `<Link>`→`<a>`. Vẫn phải test thực tế.
- **framer-motion `motion.a`:** Trung bình — cần `motion(Link)`, dễ vỡ animation nếu làm sai.
- **CTA onClick:** Trung bình — `cta/index.tsx` có handleClick, đổi sai có thể mất analytics/logic.
- **Sót external:** Thấp nếu dùng Phương án B (logic tập trung).

## Next Steps
- Sau khi merge: cân nhắc phase-02 (caching/ISR storefront) — plan riêng, đánh giá ảnh hưởng multi-tenant/custom-domain/pricing động.
