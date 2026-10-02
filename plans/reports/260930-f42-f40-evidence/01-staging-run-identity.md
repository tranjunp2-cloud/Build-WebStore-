# 01 — Staging, fixture và định danh child run

## Yêu cầu QC

F42 phải có revision triển khai để F40 đọc ledger; cung cấp execution QC an toàn, Source Store ID dạng số và **child `migration_runs.run_id` UUID có state `VERIFIED`**. `json:<uuid>` là Batch ID, không thay được child run UUID.

## Hiện trạng và khoảng trống

`createBatch()` tạo batch rồi tạo child `migration_runs`/`migration_import_stores` theo Store; grouped execution tạo child khi group được xử lý. `markStoreVerified()` cập nhật cả `migration_runs` và `migration_import_stores` cùng giao dịch. Logger phát `STORE_VERIFIED` với `runId: currentBatch.id`, tức **giá trị log này là Batch ID**, không phải child run. Không lấy nó làm handoff cho F40. Cần truy vấn quan hệ child từ `migration_import_stores.run_id` và kiểm lại `migration_runs.state`. Xem [`ledger.ts`](../../../src/lib/migration/pw1-json/ledger.ts) và [`runner.ts`](../../../src/lib/migration/pw1-json/runner.ts).

## Cách triển khai

1. Merge/deploy revision F42 cùng migration schema vào đúng staging QC; ghi commit SHA, schema version, exporter/importer contract/hash. Chạy schema setup theo cơ chế repo trước import; verify lại table/column/index thực tế.
2. Chuẩn bị nguồn và target được định danh rõ: PW1 source instance/database/snapshot, PW2 target instance/hash, số Store đã chọn. Không dùng source Store ID từ tên miền hoặc owner email. Không đưa URI/credential vào report.
3. Chọn một trong hai môi trường được QC chấp thuận: DB staging QC cô lập có seed/reset, hoặc đường chạy staging-safe trên dữ liệu thử có marker sở hữu và scope reset chặt. Không reset trên shared production/staging business data.
4. Sau apply và verify, xuất handoff bằng read-only query `migration_import_stores` → `migration_runs`; báo cả `batch_id` để truy vết nhưng gắn nhãn riêng. Ví dụ kiểm chứng (dùng tham số, không nối SQL từ input):

   ```sql
   SELECT s.source_store_id, s.run_id AS child_run_id,
          r.state AS run_state, s.state AS store_state,
          r.source_instance_id, r.source_snapshot_id,
          r.mapping_version, r.batch_id
   FROM migration_import_stores s
   JOIN migration_runs r ON r.run_id = s.run_id
   WHERE s.source_store_id = $1
     AND s.run_id = $2::uuid;
   ```

5. Handoff chỉ được phát khi cả `run_state` và `store_state` là `VERIFIED`, source instance/Store/snapshot đúng fixture, target binding đúng revision. Resume hợp lệ có thể hoàn tất cùng child run; lần import với snapshot/rule/target binding khác cần run mới theo guard của ledger. Không chỉnh handoff cũ thành pass khi run còn paused hoặc có drift.
6. Nên bổ sung lệnh/report chuyên dụng in `childRunId` ngay sau verify; output phải được lấy từ DB sau commit, không dùng biến batch logger. Tránh phụ thuộc vào tên field `runId` hiện đang dễ gây nhầm.

## Điều kiện nghiệm thu

- Có proof revision/schema của staging và query trả đúng một child run cho Source Store ID số đã bàn giao.
- `childRunId` là UUID thuần, `batchId` có prefix `json:` và không bị tráo cho nhau.
- Read bằng child run của Store khác hoặc run chưa `VERIFIED` bị từ chối; không trả evidence của Store khác.
- Reset/reseed hai lần tạo fixture đúng phạm vi, không xóa dữ liệu ngoài marker QC; ghi owner và TTL/cleanup.

## Bàn giao cho F40

`sourceStoreId`, `childRunId`, `sourceInstance`, `sourceSnapshotId`, `targetInstance`/safe hash, `deployedRevision`, `schemaVersion`, `fixtureOwner`, seed/reset runbook và thời gian fixture có hiệu lực. Không bàn giao chỉ Batch ID hoặc ảnh chụp dashboard.
