# Phase 02 — Gọi phía đọc của luồng cũ như thư viện

**Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** 01

## Context (hàm có sẵn, chỉ import, không sửa)
| Bước | Hàm | File |
|---|---|---|
| 1 | `createSnapshotConfig({inputDir, profile, snapshotId, asOf, output})` | `pw1-export/snapshot-config.ts:15` |
| 2 | `exportMaster(inputDir, configPath, outputDir)` | `pw1-export/export-master.ts:63` |
| 3 | `prepareImportArtifact({exportArtifact, credentials, creatorBindings, output})` | `pw1-json/credentials.ts:126` |
| 4 | `loadImportArtifact(manifestPath, …)`, `readImportStore(artifact, storeId)` | `pw1-json/artifact.ts:173,433` |
| 5 | `buildEntities(store, configs, namespace, actorRefs, preserveInvalidUserEmails, delegateRawPageContent, delegateRawModelSettings)` | `pw1-json/projection.ts:71` |

Trình tự gọi bước 1–3 giống `scripts/data/run-pw1-export.ts:102-122` và `scripts/prepare-pw1-import.ts:8`. Hai script này chỉ để tham khảo, không gọi.

## Thiết kế
Chạy 2 lần độc lập, cho `old` và `new`:
1. `createSnapshotConfig`:
   - `inputDir = --out/source-<side>`;
   - profile như run cũ;
   - **`snapshotId` = `migration_runs.source_snapshot_id` trong DB đích** (hiện `pw1-2026-10-07T07-54-49-494Z-93540442`) (giữ `namespace = PW1PROD:<snapshotId>`, vì `stableChildId` phụ thuộc vào nó);
   - `asOf`: old = asOf gốc; new = `--as-of` (D3).
2. `exportMaster` → `--out/<side>/artifact/`.
3. `prepareImportArtifact`:
   - `credentials` = `users.csv` của bên đó (bản đã chuẩn hóa);
   - `creatorBindings`: tự suy ra từ dữ liệu như run cũ (1 external creator); nhiều hơn 1 → dừng, báo rõ.
4. `loadImportArtifact` → với mỗi store: `readImportStore` → `buildEntities`. Namespace, actorRefs và 3 cờ lấy y như `runner.ts:214-249`.
5. Kết quả: `Map<ref, {storeId, collection, sourceEntity, sourceId, sourceChecksum, entity}>` cho từng bên. Kèm danh sách store bị chặn hoặc loại, lấy từ `export-review.json`.

`configs` (collection config của Payload) lấy từ Payload config đã nạp ở phase 04 runtime. Bước này không ghi DB.

## D3 — `--as-of`
- 18/09 **không phải ngày dữ liệu**. CSV được dump 16/09 13:53. `2026-09-18T00:00:00Z` chỉ là giá trị `--as-of` gõ lúc chạy export ngày 07/10 (lấy theo ví dụ trong runbook/help). Đây là mốc exporter dùng để xét hạn/ban: user `status=1` mà `expired_at ≤ asOf` → suspended (`identity-lifecycle.ts:27-63`).
- Với hướng A, mọi store đều được export lại, nên dùng asOf mới không còn gây lệch giữa các store.
- Theo CSV 16/09: 308 user đang active (154 store) có `expired_at` trong khoảng 18/09–28/10. Nếu dùng asOf = lúc freeze, những user này (nếu chưa gia hạn) và tenant tương ứng sẽ chuyển sang suspended.
- Lựa chọn:
  - (a) giữ 18/09: delta chỉ phản ánh dữ liệu thật sự đổi;
  - (b) asOf = lúc freeze: phản ánh cả việc hết hạn.

## File
- Tạo `src/lib/migration/pw1-delta/source-pipeline.ts`: gọi bước 1–5 cho một bên, trả map entity.

## Todo
- [ ] Đọc `snapshotId` từ `migration_runs` (SELECT)
- [ ] Gọi 1→5 cho old và new (tuần tự, giải phóng bộ nhớ giữa 2 lần)
- [ ] Ghi thời gian và RSS từng bước vào `run.json`

## Thành công
- Chạy với `old` trên DB_PROD: số store emitted, số store bị chặn và số entity theo collection khớp run 07/10.

## Rủi ro
- `prepareImportArtifact` gọi `assertOutsideRepository`. `.migration/` là vùng private được phép (run 07/10 đã nằm ở đó). Nếu `--out` nằm trong repo nhưng ngoài vùng này thì lỗi `PRIVATE_ARTIFACT_INSIDE_REPOSITORY` → báo rõ.
- Bộ nhớ: run cũ cần ≥ 4 GB heap. Dùng 8 GB, chạy tuần tự.
