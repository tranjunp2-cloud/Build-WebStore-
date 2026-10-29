# Phase 03 — Diff entity, phân loại, gate tái lập

**Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** 02

## Context
- Ledger cũ `migration_entity_map` (`scripts/pw1-migration-schema.js:255`):
  - **không có cột store**;
  - có `source_checksum` và `target_checksum = checksum(resolved data)` (`writer.ts:340`);
  - unique active trên `(source_system, source_instance_id, source_entity, source_id) WHERE claim_active`.
- `migration_source_evidence_rows.disposition`: `retained-source` / `excluded`.

## Phân loại (so map old với map new theo `ref`)
| Lớp | Điều kiện | Hành động |
|---|---|---|
| UNCHANGED | có ở cả 2, cùng `sourceChecksum` | bỏ qua |
| CHANGED | có ở cả 2, khác checksum | update |
| NEW | chỉ có ở new | create; gắn nhãn RECOVERED nếu evidence cũ là `retained-source`/`excluded` |
| GONE | chỉ có ở old | soft-delete theo collection. Lý do: dòng nguồn mất hoặc có `deleted_at` → `SOURCE_DELETED`; dòng vẫn còn → mã diagnostics hoặc store bị chặn |

Tra ledger cho CHANGED/GONE (chỉ SELECT): `pw1_delta_map` trước, sau đó `migration_entity_map` (`claim_active`, `action='CREATE'`, `state='VERIFIED'`) → lấy `target_id`, `target_checksum`.
- Không có claim (entity bị policy loại ở lần import trước) → CHANGED đổi thành NEW, GONE thì bỏ qua.
- Kiểm tra chéo: old `sourceChecksum` phải bằng ledger `source_checksum`. Khác → `LEDGER_PARITY_MISMATCH`, entity đó bị chặn.

Thứ tự ghi: tenants → users → sites → plan-subscriptions(+usages) → categories → media → products → customers → discounts → orders → blog_categories → blogs.

## Gate tái lập (luôn chạy trước khi cho apply)
- So map **old** với `migration_entity_map`: mọi entity old có claim phải cùng `source_checksum`, trừ các entity chứa ô đã gỡ `'` (đối chiếu với `normalization.json`, dự kiến 18).
- Lệch khác → in ref và field đầu tiên khác, rồi **dừng toàn bộ** (không hỏi y/N).
- Nhờ vậy chỉ cần chạy `--old DB_PROD --new DB_PROD` là kiểm được ngay hôm nay.

## File
- Tạo `src/lib/migration/pw1-delta/ledger-lookup.ts`: SELECT theo lô 500.
- Tạo `src/lib/migration/pw1-delta/classify.ts`.

## Todo
- [ ] Diff map old/new
- [ ] Tra ledger + kiểm tra chéo
- [ ] Gate + ghi `parity.json`

## Thành công
- Gate trên DB_PROD: chỉ lệch đúng các bản ghi dính `'`.
- Với file xuất mới: NEW/CHANGED/GONE khớp bậc độ lớn với scout 26/10 (3 store, ~40 user, ~100 product, 3 order…).
