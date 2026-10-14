# Phase 04: Chạy lại trên Neon và xác minh

## Context
- Đích: Neon branch `pw1-migrated-261010`. Ledger `pw1_migration_stores` hiện có 58 store `pending`.
- CLI: `npm run migrate:pw1:website -- retry FILE --store <ID>` (`docs/migration/pw1-website-cli.md:125-135`).
- Input: **không cần export lại.** Dùng đúng gói prepared handoff đã chạy lần trước (snapshot 16/09).
  - Lý do: input hash không đổi, và `retry` chọn store `pending`/`failed` (`pw1-batch.ts:129`).
  - Truyền file cụ thể để ghim đúng handoff. Không để CLI tự chọn bản mới nhất.

## Overview
- **Ưu tiên:** Cao.
- **Trạng thái:** ⬜
- **Điều kiện:** phase 01–03 đã merge, hoặc chạy từ nhánh fix. Người chạy có quyền vào Neon.

## Danh sách shop
| Nhóm | Store | Cách chạy |
|---|---|---|
| A (14) | 40, 60, 186, 489, 501, 664, 912, 935, 1141, 1152, 1329, 2735, 2787, 2896 | `retry`; nguyên nhân `pending` chưa rõ, xem `logs --store` |
| B-cat (18) | 71, 73, 82, 90, 93, 94, 106, 187, 197, 271, 301, 332, 344, 408, 509, 836, 2646, 2676 | `retry` (cần code phase 01) |
| B-prod (26) | 48, 2392, 2399, 2409, 2418, 2426, 2436, 2445, 2454, 2463, 2472, 2481, 2490, 2499, 2508, 2517, 2526, 2535, 2544, 2553, 2562, 2571, 2580, 2589, 2591, 2850 | `retry` (cần code phase 01) |

Đính chính 13/10: 271 (category 653) và 509 (category 515) thuộc B-cat, không phải nhóm A. Lần chạy Neon không bật `--require-be-data`; nhóm A qua được bước chọn sản phẩm, lý do `pending` cần đọc `pw1_migration_batches.results` trên Neon.

## Implementation steps
1. **Preflight bằng chứng (D2):**
   ```sql
   SELECT count(*) FROM migration_source_evidence_rows WHERE source_entity='products' AND disposition='retained-source';
   SELECT source_store_id, source_id FROM migration_source_evidence_rows
    WHERE source_entity='products' AND disposition='retained-source'
      AND source_id IN ('3312','50955','54782','55091');
   ```
   Nếu kết quả là 0, chạy `npm run migrate:pw1:evidence:ingest` cho đúng snapshot trước, rồi kiểm tra lại.

   **Preflight mapping category của store mẫu.** Kỳ vọng 14 dòng, target thuộc tenant 7/10/16/17/20/21/24/25/27:
   ```sql
   SELECT m.source_id, c.tenant_id FROM migration_entity_map m JOIN categories c ON c.id::text=m.target_id
    WHERE m.source_entity='categories' AND m.state='VERIFIED'
      AND m.source_id IN ('138','140','192','242','514','515','606','652','653','2042','2046','2052','2053','2055');
   ```
   Nếu thiếu dòng nào, store dùng category đó vẫn sẽ fail (R3). Khi đó dừng lại và báo BE, không tự sửa.

   **Snapshot bằng chứng:** `SELECT snapshot_id, state, completed_at FROM migration_source_evidence_snapshots;`. Phải có ít nhất 1 dòng `COMPLETE` + `provenance_kind='exporter_sidecar'`, và store có run `VERIFIED` (`migration_runs`) cùng `source_instance_id` + `source_snapshot_id`; thiếu thì bằng chứng không được dùng và store báo `BE_MAPPING_INVALID` như cũ.

   **Chạy thử trên local trước Neon:** dùng `primeweb-db`, 12 store pending. Xem tiêu chí ở phase 01.
2. **Dry-run:** `npm run migrate:pw1:website -- retry FILE --dry-run` để xác nhận 58 store được chọn và không có lỗi validate.
3. **Pilot 3 store:** 71 (B-cat), 48 (B-prod), 40 (A). Kiểm tra từng store:
   - `status --store <ID>` là `completed`.
   - Report có cảnh báo đúng loại.
   - Mở site: khối danh sách đúng D1, khối `fixed` của store 48 còn 3 SP.
4. **Chạy toàn bộ:** `npm run migrate:pw1:website -- retry FILE`, không bật `--require-be-data`.
5. **Xác minh:**
   ```sql
   SELECT status, count(*) FROM pw1_migration_stores GROUP BY 1;  -- pending = 0
   ```
   Kiểm tra quality audit pass (`INPUT.json.migration-audit.json`).
6. Store nào còn fail: chạy `logs --store <ID>`, ghi lại nguyên nhân, xử lý riêng. Không lặp lại cách cũ quá 3 lần.

## Todo
- [x] Preflight bằng chứng (local, 13/10: 4754 retained-source, 14/14 category mẫu, snapshot COMPLETE; 12 store pending local resolve ok, 83/83 ledger ok)
- [ ] Dry-run
- [x] Pilot 3 store (local 13/10: 71, 48, 271 completed; 40 đã completed sẵn ở local)
- [ ] Chạy toàn bộ 58 store
- [ ] `pending = 0` + audit pass
- [ ] Soạn comment cập nhật issue #1956 (chờ người dùng duyệt trước khi đăng)

## Nội dung comment cho issue #1956
1. Bảng nguyên nhân thật (3 nhóm), link 2 báo cáo.
2. Hai việc BE trong checklist ("cung cấp mapping", "kích hoạt sản phẩm") **không cần làm**, kèm lý do.
3. Kết quả cuối: 58 → 0 `pending`, kèm số shop có cảnh báo.
4. Follow-up: issue riêng cho policy export BE và lỗi clone PW1.

## Success criteria
- `pending = 0` trên Neon. Audit pass.
- Comment issue được người dùng duyệt rồi mới đăng.

## Risks
| Rủi ro | Giảm thiểu |
|---|---|
| Lần retry làm lộ lỗi khác (component khác cũng sai) | Pilot trước; `logs` cho từng store |
| Giới hạn AI/budget khi chạy 58 store | Dùng `--concurrency` và giới hạn mặc định; resume bằng `retry` |
| Nhóm A lỗi lại sau `retry` vì nguyên nhân chưa rõ | Đọc `logs --store <ID>`, xử lý riêng |
