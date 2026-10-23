# Phase 03 — i18n en + ms

## Overview
- Priority: P1 · Status: pending · Depends: phase 02
- AC-12: mọi text mới có trong `src/i18n/locales/en.json` và `ms.json`, namespace `editor.pageManager`.

## Keys mới (en → ms)
| Key | en | ms |
|-----|----|----|
| `pageNameLabel` | PAGE NAME | NAMA HALAMAN |
| `urlPreview` | URL: | URL: |
| `createPage` | Create page | Cipta halaman |
| `duplicatePage` | A page with this name or URL already exists | Halaman dengan nama atau URL ini sudah wujud |
| `invalidPageName` | Use at least one letter or number | Gunakan sekurang-kurangnya satu huruf atau nombor |
| `editing404Page` | Editing 404 page | Menyunting halaman 404 |
| `deleteInlineConfirm` | Delete “{name}”? You can undo for a few seconds. | Padam “{name}”? Anda boleh buat asal dalam beberapa saat. |
| `pageShown` | Page is now visible | Halaman kini boleh dilihat |
| `hiddenBadge` | Hidden | Tersembunyi |

ms dùng "Sunting/Menyunting" cho edit (khớp `edit404Page`, `editing` sẵn có). Interpolate `{name}` theo pattern `.replace('{name}', …)` (như `EditorTemplateModal.tsx:478`).

Sửa: `pageNamePlaceholder` → "e.g. Promotions" / "cth. Promosi".

## Steps
1. Thêm keys vào cả 2 file, cùng vị trí trong object `pageManager`.
2. Kiểm tra cách interpolate `{name}` hiện có trong codebase (grep `.replace('{`) và dùng cùng pattern.
3. Keys bỏ dùng (`visible`, `hidden`, `deleteConfirmTitle`, `deleteConfirmMsg`, `deleteConfirmDesc`, `slugPreview`, `searchPlaceholder`): grep toàn `src/` — chỉ xoá nếu không còn chỗ nào dùng.
4. Typecheck (types i18n suy ra từ `en.json`).

## Todo
- [ ] keys en + ms
- [ ] dọn keys không dùng
- [ ] typecheck
