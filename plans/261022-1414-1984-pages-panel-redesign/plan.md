---
title: Redesign Pages panel (Page library) in editor
issue: "#1984"
story: US-F05-02
branch: fix/F05-1984-pages-panel-redesign
status: pending
created: 2026-10-22
---

# Pages panel redesign — #1984

Redesign tab **Pages** trong editor theo prototype `Pages Panel.html` (UIUX). Frontend only — không đổi API, store, schema.

## Context

- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1984 (AC-01..AC-12)
- Design: `/home/liam/Downloads/Pages Panel.html` + ảnh before/after trong issue
- File chính: `src/components/editor/PageManagerPanel.tsx` (628 dòng, vượt rule 200 dòng)
- Hosts: `src/app/(editor)/editor/[siteId]/page.tsx:2838` (desktop), `src/components/editor/EditorToolsSheet.tsx:101` (mobile)
- Test: `src/__tests__/unit/editor/page-manager.test.tsx`; QA doc: `docs/qa/F05-ai-editor-testcases.md`

## Phases

| # | Phase | Status |
|---|-------|--------|
| 01 | [Tách module, không đổi hành vi](phase-01-extract-modules.md) | pending |
| 02 | [Dựng UI mới theo design](phase-02-new-ui-components.md) | pending |
| 03 | [i18n en + ms](phase-03-i18n.md) | pending |
| 04 | [Test + QA doc](phase-04-tests-and-qa.md) | pending |

Thứ tự tuần tự: 01 → 02 → 03 → 04 (02 và 03 sửa chung text keys → 1 agent).

## Quyết định (user đã duyệt 2026-10-22)

1. **Badge:** giữ logic Live / Draft + sublabel No Link (tooltip). Trang `isVisible=false` (mọi status) → badge `Hidden` xám (thay vì Live + sublabel Hidden vàng). Card đang chọn → `Editing` thay badge trạng thái (như hiện tại).
2. **Xoá:** confirm inline trong card; giữ soft-delete + toast Undo 5s. Copy: "Delete “{name}”? You can undo for a few seconds." (không dùng "can't be undone").
3. **Trùng tên:** check client-side (tên lowercase hoặc slug trùng trang chưa xoá, kể cả 404) + giữ 409 fallback. Slug rỗng → lỗi inline (sửa bug cũ gửi `slug: ''`).

## Review notes (trước khi code)

- Empty state phải còn nút Add (nút chuyển xuống cuối list).
- Esc: gắn trên phần tử confirm/input, không document listener (tránh đụng handler Esc toàn cục của editor).
- Duplicate: "Home" → slug `home` khớp homepage; "404" khớp system page.
- Test 15e / 07 / 08 / 09 / 10 phải sửa; QA doc TC-F05-02-15(d) đang lệch code.
- Không có commit mới trên staging đụng vào panel (base `c0b6bb08e`).

## Không làm (YAGNI)

- Không đổi API/endpoint, editorStore, sidebar tabs.
- Không thêm drag-reorder, search, rename trang.

## Rủi ro chính

- Test hiện bắt DOM theo class (`rounded-xl`, `max-w`) → sẽ vỡ; phase 04 chuyển sang `aria-label` / role.
- Coach marks bám `data-coach="page-library"` — phải giữ trên root.
- Light theme: design chỉ có dark → map sang token, kiểm tra cả 2 theme.
