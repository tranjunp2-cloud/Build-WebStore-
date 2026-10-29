# Phase 05 — Tóm tắt, xác nhận, báo cáo, `website-input.json`

**Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** 03 (song song 04)

## Context
- Website CLI nhận file master tường minh: `npm run migrate:pw1:website -- <file>.json` (`docs/migration/pw1-website-cli.md`)
- Đầu vào website cần: `tenants, users, sites, media, store_domains, pages` + `destination {tenantId, siteId, productCategories}` (`src/lib/migration/pw1-collection-input.ts`, `pw1-batch-validation.ts`); thiếu `destination` → tạo tenant trùng

## Tóm tắt trước khi ghi (stdout)
- DB đích (host/DB, che mật khẩu), `--old`/`--new`, asOf, số store affected.
- Bảng: collection × NEW/CHANGED/GONE/RECOVERED/UNCHANGED.
- Cảnh báo: bảng global đổi, store bị policy loại, conflict site đã generate.
- `Apply? (y/N)`; `--yes` bỏ hỏi; không TTY và không `--yes` → dừng không ghi.

## Đầu ra trong `--out`
- `summary.md` — như trên + kết quả apply (ghi/lỗi theo store).
- `changes.jsonl` — mỗi entity: store, collection, source ref, target id, lớp, field đổi, lý do.
- `conflicts.json` — store lỗi, entity bị loại kèm mã diagnostics, site đã generate có trang đổi.
- `website-input.json` — mảng store bundle (định dạng master) cho: store NEW và store có `pages/page_components/menus*/banners/model_settings` đổi mà site **chưa publish**; kèm `destination` lấy từ `pw1_delta_map`/ledger. Lưu ý: `pages` không phải entity của `buildEntities` → phát hiện trang đổi bằng cách so trực tiếp `stores[].pages` (+ settings/menus) trong master JSON old vs new của phase 02. Chỉ ghi sau khi apply thành công.
- `run.json` — trạng thái run (khớp `pw1_delta_runs`).

## File
- Tạo `src/lib/migration/pw1-delta/report.ts`, `website-input.ts`

## Todo
- [ ] Tóm tắt + prompt
- [ ] 4 file báo cáo
- [ ] `website-input.json` + kiểm tra bằng `parseBatchInput` (import, không sửa)

## Thành công
- `website-input.json` qua `parseBatchInput` không lỗi; 3 store mới có `destination` đúng tenant/site vừa tạo.
