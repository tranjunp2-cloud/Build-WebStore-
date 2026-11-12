# Phase 04 — Test + QA doc

## Overview
- Priority: P1 · Status: pending · Depends: phase 02, 03
- Tuân `.claude/rules/testing.md`: mỗi test có TC-ID, AAA, import từ source, không fake.

## QA doc
Thêm vào `docs/qa/F05-ai-editor-testcases.md` (sau TC-F05-02-17):

| TC | Nội dung |
|----|----------|
| TC-F05-02-18 | Card: icon eye/trash cùng hàng tên; Home disabled 2 icon |
| TC-F05-02-19 | Add page: nút cuối list, form inline, URL preview, Enter/Esc |
| TC-F05-02-20 | Duplicate tên/slug → lỗi inline + nút Create disabled |
| TC-F05-02-21 | Delete confirm inline: Cancel / Esc đóng; Confirm → soft delete + toast Undo |
| TC-F05-02-22 | Card đang chọn: badge Editing + nút Edit with AI chat gọi `onEditPage` |
| TC-F05-02-23 | Custom 404 footer: toggle, nút Edit/Editing 404 chọn đúng page |
| TC-F05-02-24 | Visibility: page ẩn → badge Hidden + icon EyeOff; toggle gọi PATCH `isVisible` |

Cập nhật TC-F05-02-15 (d): page hidden → badge **Hidden** (doc hiện ghi Draft, đã lệch với code — code đang hiện Live + sublabel Hidden).

Thêm vào TC-F05-02-20: slug rỗng (`!!!`) → lỗi inline; tên "Home" → báo trùng; tên "404" → báo trùng.
Thêm vào TC-F05-02-19: empty state vẫn có nút Add new page.

## Unit tests
- Sửa `src/__tests__/unit/editor/page-manager.test.tsx`:
  - Bỏ selector theo class (`div[class*="rounded-xl"]`, `div[class*="max-w"]`) → dùng `getByRole('button', { name: /delete page/i })` trong `within(card)` với card lấy qua `[data-page-id]`.
  - TC-F05.09 / TC-F05.10 viết lại cho confirm inline + icon button.
  - TC-F05-02-15e: đổi kỳ vọng Live + sublabel Hidden → badge `Hidden` (đổi tên test cho khớp).
  - TC-F05.07 / TC-F05.08: placeholder đổi thành "e.g. Promotions"; 08 phải dùng tên không trùng client-side để vẫn test được nhánh 409.
- Thêm test cho TC-F05-02-18..24.
- (Tuỳ chọn) `src/__tests__/unit/editor/page-manager-helpers.test.ts` cho `getStatusBadge`, `getPagePath`, duplicate check.

## Verify
```
npx tsc --noEmit
npx vitest run src/__tests__/unit/editor/page-manager.test.tsx src/__tests__/unit/editor/editor-coach-marks.test.tsx
npm run lint
```
Sau đó code-reviewer review diff → PR `feat(F05): [US-F05-02] redesign pages panel` → staging, body `Relates to #1984`.

## Todo
- [ ] QA doc TC-F05-02-18..24
- [ ] sửa test cũ
- [ ] test mới
- [ ] typecheck + lint + test pass
