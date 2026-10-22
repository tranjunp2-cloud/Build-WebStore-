# Phase 02 — Dựng UI mới theo design

## Overview
- Priority: P1 · Status: pending · Depends: phase 01
- Cover AC-01..AC-11 của #1984. Reference: `/home/liam/Downloads/Pages Panel.html` (CSS + render logic trong `<script>`).

## Layout mới (panel)
```
┌ header (không border-b): "Page library" 15px semibold + mô tả 12px muted
├ list (flex-1, overflow-y-auto, gap 10px, data-page-id trên từng card)
│   PageCard × N
│   AddPageArea (nút dashed | form inline) ← cuối list
└ footer (border-top, flex-none): Custom404Footer (chỉ khi có page404)
```
Root giữ `data-coach="page-library"`; delete modal overlay cũ bị bỏ.

**Empty state** (không có trang thường): vẫn render `AddPageArea` dưới khối "No pages found" — nếu không, chuyển nút Add xuống cuối list sẽ làm mất lối tạo trang.

**Mobile (Tools sheet):** `onPageSelected` ở host mobile đóng sheet → tạo trang xong sheet tự đóng (hành vi hiện tại, giữ). `onEditPage` → `openTools('chat')` — không cần sửa host.

## Components (thư mục `src/components/editor/page-manager/`)

| File | Nội dung |
|------|----------|
| `page-card.tsx` | Row: tên (15px, truncate) + badge Home + badge trạng thái/Editing + `ml-auto` 2 icon button 30×30 (Eye/EyeOff, Trash2). Dòng meta `path · dd-mm`. Khi `isCurrent`: nút "Edit with AI chat" nhỏ (h-[26px], viền teal, icon `Sparkles`). Khi `isConfirmingDelete`: render `DeleteConfirmInline`. Click card → `onSelect`; icon button `stopPropagation`. |
| `page-status-badge.tsx` | Badge Live (dot xanh) / Draft / Hidden (dot xám) / Editing (dot sky) + tooltip; sublabel No Link giữ nguyên. |
| `delete-confirm-inline.tsx` | Hộp đỏ nhạt trong card: câu xác nhận + grid 2 nút Cancel / Delete (spinner khi pending). |
| `add-page-form.tsx` | Trạng thái đóng: nút dashed full-width. Mở: label `PAGE NAME`, Input autoFocus, `URL: /slug`, lỗi trùng inline, grid Cancel / Create page (gradient, disabled khi rỗng/trùng/submitting). Enter submit, Esc huỷ. Mở xong scroll list xuống đáy. |
| `custom-404-footer.tsx` | Nút header h-12 (`Settings2` + label + chevron xoay 180° khi mở). Body: card nhỏ + nút Pencil "Edit 404 page" / "Editing 404 page" (khi `currentPageId === page404.id`, có ring teal). |

`PageManagerPanel.tsx` còn: lấy store, `regularPages/page404/menuPageIds`, state `isAdding`, `confirmDeleteId`, `is404Open`, auto-scroll effect, compose components. Mục tiêu < 200 dòng mỗi file.

## Hành vi
- Card đang chọn: `bg-[hsl(var(--primary)/0.06)] border-[hsl(var(--primary)/0.3)] shadow-[inset_3px_0_0_hsl(var(--primary))]`, cursor default.
- Card thường: `bg-[var(--editor-surface-elevated)] border-[var(--editor-border-subtle)]`, hover sáng hơn chút.
- Home: 2 icon disabled (`opacity-35`), title = `homeHideProtected` / `homeProtected`.
- Visibility: icon EyeOff màu `--editor-text-subtle` khi ẩn; toast khi ẩn (giữ) + khi hiện (mới: `pageShown`).
- Delete: trash → set `confirmDeleteId` (chỉ 1 card mở confirm); Cancel / chọn card khác → đóng. Khi mở, **focus nút Cancel**; `onKeyDown` Escape gắn trên chính hộp confirm (không dùng document listener — editor đã có nhiều handler Esc toàn cục: PreviewScripts, InlineEdit, CompactEditorLayout…). Confirm → `deletePage` (Undo toast giữ nguyên).
- Duplicate check (`page-manager-helpers.ts` → `findDuplicatePage(title, pages)`): so với **mọi trang chưa xoá, kể cả 404** — slug mới trùng `page.slug` (bỏ `/` đầu) hoặc `getPagePath(p)`; hoặc tên (trim, lowercase) trùng `page.title` / `getDisplayPageTitle`. Case "Home" → slug `home` phải bắt được (homepage slug là `home`, path `/`). Lỗi inline + disable Create. 409 server vẫn toast.
- Slug rỗng (tên toàn ký tự đặc biệt, vd `!!!`): hiện tại form preview `/new-page` nhưng gửi `slug: ''` lên server → bug. Mới: slug rỗng → lỗi inline `invalidPageName`, disable Create.
- Badge `Hidden`: áp khi `isVisible === false` với **mọi status** (ẩn là lựa chọn rõ ràng của user); tooltip = `tooltipLiveHidden` nếu trang live, ngược lại `tooltipDraft`. Sublabel `Hidden` vàng bỏ; `No Link` giữ.
- Tạo xong: chọn trang mới + scroll tới (auto-scroll effect sẵn có lo).
- Icon button có `aria-label` (= title).

## Token mapping (không hardcode hex)
| Design | Token |
|--------|-------|
| `#2dd4bf` teal | `hsl(var(--primary))` |
| `#172033` card | `var(--editor-surface-elevated)` |
| `#0d1526` panel | `var(--editor-surface)` |
| `#94a3b8` muted | `var(--editor-text-muted)` |
| `#64748b` subtle | `var(--editor-text-subtle)` |
| viền mờ | `var(--editor-border-subtle)` |
| đỏ | `hsl(var(--destructive))` |
| gradient primary | `hsl(var(--info))` → `hsl(var(--primary))` (đang dùng sẵn) |
| xanh Live | `hsl(var(--success))` |

## Todo
- [ ] page-status-badge
- [ ] page-card + delete-confirm-inline
- [ ] add-page-form (+ duplicate check)
- [ ] custom-404-footer
- [ ] PageManagerPanel compose, xoá modal cũ
- [ ] typecheck + chạy app kiểm tra dark + light, desktop + Tools sheet mobile

## Success criteria
- Khớp ảnh "after" trong #1984 ở dark theme; light theme đọc được, đủ tương phản.
- Mỗi file < 200 dòng.

## Risks
- Nested button (HTML invalid): `<button>` chọn trang chỉ bọc vùng tên + meta như hiện tại; icon button và nút AI nằm ngoài nó, cùng hàng nhờ flex.
