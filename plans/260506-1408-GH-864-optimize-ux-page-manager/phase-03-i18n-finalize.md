# Phase 03 — i18n finalize (en + ms)

**Status:** pending
**Effort:** 0.25h
**Owns:** `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`

## Overview

Consolidate all new i18n keys introduced by phases 01, 02, 04 into both locale files. Avoid drift between en/ms by adding all keys in a single sweep at the end.

## Files to modify

- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`

## Keys to ensure exist

Under `editor.pageManagerPanel`:
| Key | en value | ms value (placeholder = en until L10n) |
|-----|----------|-----------------------------------------|
| `title` | `"Page Library"` | `"Page Library"` |
| `microcopy` | `"Các trang ở đây dùng để biên tập nội bộ. Để đưa lên website, hãy add chúng vào Menu Settings bên phải."` | same (vi-as-default) |
| `tooltipLive` | `"Trang đã được add vào Menu và đã publish."` | same |
| `tooltipDraft` | `"Trang mới tạo, chưa được add vào menu hoặc đã bị xóa khỏi menu."` | same |

NEW namespace `editor.coachMarks`:
| Key | Value |
|-----|-------|
| `step1Title` | `"Bước 1: Tạo trang tại đây"` |
| `step1Body` | `"Tạo và biên tập các trang nội bộ trong Page Library."` |
| `step2Title` | `"Bước 2: Quản lý hiển thị menu tại đây"` |
| `step2Body` | `"Add các trang vào Menu Settings để đưa chúng lên website."` |
| `next` | `"Tiếp theo"` |
| `finish` | `"Hoàn tất"` |
| `skip` | `"Bỏ qua"` |
| `stepLabel` | `"Bước {current}/{total}"` |

## Implementation

1. Open both `en.json` and `ms.json`.
2. Find `editor.pageManagerPanel` block (line ~2768 in en).
3. Insert new keys preserving alphabetical-ish current order.
4. Add new top-level (under `editor`) `coachMarks` block — alongside `aiChat`, `pageManagerPanel`, etc.
5. Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))"` for both.
6. Run `npm run typecheck` — i18n type generator (if any) should pass.

## Acceptance criteria

- [ ] Both locale files parse as valid JSON
- [ ] Keys present in both files with identical structure
- [ ] No `t.editor.X` reference in code lacks a corresponding key
- [ ] `npm run typecheck` clean

## Risk

| Risk | Mitigation |
|------|-----------|
| Project ships `vi.json` we missed | Verified via `find src/i18n/locales` → only `en.json`, `ms.json`. Plan §Unresolved Q1 flags this. |
| Trailing comma JSON syntax error | Use jq or `node -e "JSON.parse(...)"` validation step. |
