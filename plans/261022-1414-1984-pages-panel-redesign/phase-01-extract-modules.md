# Phase 01 — Tách module (refactor, không đổi hành vi)

## Overview
- Priority: P1 · Status: pending
- Mục tiêu: chia `PageManagerPanel.tsx` (628 dòng) thành module nhỏ trước khi đổi UI, để diff phase 02 chỉ là UI. Test hiện tại phải pass nguyên vẹn sau phase này.

## Key insights
- Logic thuần (slugify, path, menu ids, status badge) nằm ở đầu file `:26-100` — tách được ngay.
- 3 handler async (create / toggle visibility / delete + undo) `:157-307` dùng chung `siteId`, store setters, `onPagesChanged` → gom vào 1 hook.
- Import path `@/components/editor/PageManagerPanel` được dùng ở 3 nơi → **giữ nguyên file + named export**, chỉ để nó compose.

## Related code files
Tạo (thư mục `src/components/editor/page-manager/`):
- `page-manager-helpers.ts` — `slugifyPageTitle`, `getPagePath`, `SYSTEM_PAGE_SLUGS`, `collectMenuPageIds`, `getStatusBadge`
- `use-page-manager-actions.ts` — hook trả `{ createPage, toggleVisibility, deletePage, isSubmitting, pendingPageId }`

Sửa:
- `src/components/editor/PageManagerPanel.tsx` — import từ 2 file trên, xoá code trùng

## Implementation steps
1. Move helpers sang `page-manager-helpers.ts`, export từng hàm. `getPagePath` dùng lại trong `collectMenuPageIds` (bỏ đoạn lặp `:62-65`).
2. Tạo hook `usePageManagerActions({ siteId, currentPageId, regularPages, pages, onPageSelected, onPageCreated, onPagesChanged })`:
   - `createPage(title): Promise<boolean>` (trả true khi tạo xong để form reset)
   - `toggleVisibility(page)`, `deletePage(page)` — giữ nguyên optimistic + rollback + toast Undo.
3. Panel gọi hook; JSX chưa đổi.
4. `npx tsc --noEmit` + `npx vitest run src/__tests__/unit/editor/page-manager.test.tsx` → pass.

## Todo
- [ ] helpers file
- [ ] actions hook
- [ ] panel dùng hook, JSX giữ nguyên
- [ ] typecheck + test cũ pass

## Success criteria
- Test cũ pass không sửa. Không đổi hành vi UI.

## Risks
- Closure stale trong undo toast (dùng `pages` cũ) — giữ nguyên cách gọi refetch như hiện tại, không tối ưu thêm.
