# Phase09 — Log migration và báo cáo lỗi

Status: implemented, nghiệm thu cùng [Phase08 nhóm100store](phase-08-bounded-store-groups.md). Runtime đã tự tạo session logs.

## 1. Kết quả cần đạt

Mỗi lần chạy có thư mục log riêng để biết: đang xử lý nhóm/store nào, những entity đã tạo/dùng lại, lỗi gì, đã commit đến đâu và cần dùng runId nào để resume. Ledger DB là nguồn xác nhận commit; log không được dùng thay ledger để quyết định skip/replay.

Không thêm UI, API, dịch vụ logging hoặc bảng DB mới trong phạm vi này.

## 2. Vị trí và cấu trúc

Mặc định `<homedir>/migration-data/pw1/logs/`; trên máy hiện tại là `$PW1_ROOT/logs/`. Thêm tùy chọn `--log-dir /absolute/private/path`, dùng được cả import/dry-run/resume. Log directory không nằm trong artifact immutable hoặc spool bị cleanup và không tham gia batch binding.

```text
logs/20260918T043000Z-<session-uuid>/
  events-0001.jsonl
  errors.jsonl
  summary.json
```

- Session UUID riêng cho từng invocation, gồm dry-run và resume; batch runId chỉ có khi ledger đã tạo/đọc được.
- Resume tạo thư mục session mới, ghi cùng batch runId; không ghi đè log session trước.
- Thư mục0700, file0600, tạo exclusive; từ chối đường dẫn trong Git worktree, symlink hoặc parent không an toàn. Không chmod/xóa đệ quy thư mục của người dùng.
- Khởi tạo logger trước kết nối DB sau khi validate CLI. `--help` không tạo file; lỗi parse CLI xuất stderr vì logger chưa được khởi tạo.
- In đường dẫn session ngay khi bắt đầu. `summary.json` ghi trạng thái RUNNING từ đầu; nếu process bị kill sẽ không bị hiểu nhầm là đã hoàn thành.

## 3. Contract event

Schema metadata theo allowlist, có version1. Các field tùy event:

- `timestamp` UTC, `sessionId`, `sequence`, `mode` (dry-run/apply/resume).
- `runId` khi có, `event`, `phase`, `groupIndex`, `groupCount`, `storeId`.
- `collection`, `sourceEntity`, `sourceId`, `targetId`, `action` (CREATE/REUSE) khi biết.
- Counts: stores selected/preflighted/verified/failed/unprocessed; entities created/reused/verified theo collection.
- Error: `code`, `exitCode`, safe detail từ template cố định; source field/path đã validate nếu có.
- `durationMs`, bytes read cho tiến độ, không log file CSV/JSON contents.

Events bắt buộc:

| Event | Khi ghi |
| --- | --- |
| SESSION_STARTED | Logger sẵn sàng, chưa kết nối DB |
| ARTIFACT_CHECKED | Hash/coverage/receipts đã đạt |
| BATCH_READY / BATCH_RESUMED | Có batch ID hợp lệ |
| GROUP_PREFLIGHT_STARTED/PASSED/BLOCKED | Tình trạng preflight nhóm |
| STORE_STARTED | Bắt đầu xử lý store |
| ENTITY_COMMITTED | writeEntity trả kết quả sau transaction commit; có source→target/action |
| STORE_VERIFIED | DB đã commit bằng chứng verify store |
| GROUP_VERIFIED | Tất cả store nhóm đã verified |
| SESSION_FINISHED/FAILED/INTERRUPTED | Kết thúc invocation có kiểm soát |

ENTITY_COMMITTED không có nghĩa đã hoàn tất quan hệ hay verify toàn entity/store. Phải phân biệt created/reused và verified; không biến callback trước transaction thành bằng chứng commit. Duplicate callbacks/retry phải có operation identity để đọc log không đếm nhầm.

Giữ stdout JSON và stderr progress hiện tại. File log lấy từ event object đã kiểm schema, không thu toàn bộ console/stdout/stderr của Payload hoặc driver vì có thể chứa dữ liệu nhạy cảm. Không ghi heartbeat mỗi chunk; progress tối đa1lần/giây, heartbeat khoảng5giây.

## 4. Log lỗi và summary

`errors.jsonl` chứa subset error events; ghi rõ giai đoạn và group/store/entity nếu biết. Không tự suy ra sourceId nếu lỗi ở cấp file/global. Dùng safeError cho mã lỗi nhưng không serialize nguyên Error/cause/stack/query/params.

Group preflight fail: log đủ các nhóm lỗi và count; mỗi nhóm tối đa5source ID mẫu, có `samplesTruncated` khi cắt. Tham chiếu report nguồn qua artifact hash + tên artifact cho điều tra đầy đủ; không tuyên bố sample là toàn bộ bản ghi lỗi. Nếu lỗi runtime DB thì nêu source/target/context hiện tại nếu có.

Summary gồm:

- sessionId, batch runId, mode, startedAt/endedAt, outcome, exitCode.
- Selection/groupSize; tổng store, số store verified trước session và trong session, failed/unprocessed.
- Entity count theo collection/action; phân biệt confirmed và unknown khi mất ACK.
- Nhóm/store đầu tiên chưa xong, mã lỗi chính và `nextAction`.
- Chỉ đề xuất command resume khi có runId và lỗi có thể resume với cùng binding; lỗi artifact/code thay đổi ghi NEEDS_RECONCILIATION, không hứa chạy resume là giải quyết.
- Với dry-run chỉ báo planned creates/reuses, không báo đã migrate/verified business writes.

Cập nhật summary bằng write temp+atomic rename khi kết thúc nhóm và khi kết thúc session. DB mất kết nối thì giữ trạng thái cuối đã xác nhận, không suy ra mọi write cuối là thất bại hoặc thành công.

## 5. Logging I/O và crash

- Dùng writer tuần tự với backpressure, queue có giới hạn1MiB. Khi đầy, chờ drain trước bắt đầu operation kế tiếp; không tăng RAM vô hạn.
- Rotate events file ở32MiB, không tự xóa log cũ hoặc nén đồng bộ trong quá trình migrate. errors file cũng rotate theo cùng quy tắc nếu đạt ngưỡng.
- Kiểm writable trước business writes. Không mở được log thì dừng rõ LOG_INIT_FAILED.
- Log I/O fail sau một DB commit: dừng nhận business operation mới, đưa mã LOG_WRITE_FAILED ra stderr, không rollback commit và không retry write chỉ vì thiếu log. Ledger cho biết kết quả khi resume.
- Lỗi DB và lỗi log cùng lúc: giữ original error code và loggingFailure riêng trên stderr nếu còn ghi được; không để lỗi cleanup che lỗi chính.
- Flush sau group checkpoint và lúc kết thúc; fsync checkpoint log khi cần bảo đảm sau crash. Không fsync từng entity trong transaction DB.
- SIGINT/SIGTERM: dừng công việc theo runner, hoàn tất operation đang xử lý theo cơ chế hiện có, flush log/summary rồi thoát. SIGKILL/power loss không bảo đảm log cuối; summary RUNNING/stale không có nghĩa DB chưa commit.
- Nếu kết quả commit không xác định do mất ACK, không emit ENTITY_COMMITTED; ghi OUTCOME_UNKNOWN và dùng ledger để reconcile.
- Cleanup spool không xóa logs. Logger close không được throw làm che lỗi import gốc; ghi secondary failure và bảo toàn exit code thích hợp.

## 6. Bảo mật

Không log password/hash/salt/key_string/PW1_APP_KEY/PW2_MIGRATION_SECRET/SSO key/PAYLOAD_SECRET, credential ciphertext, email/phone/address, tên khách hàng, token, connection URI, SQL params hoặc raw document/projection.

Cho phép collection/source table/id/targetId đã validate, enum code, counts, hashes artifact/binding không chứa raw secret. Cấm log fingerprint của secret trong báo cáo người dùng. Chuỗi source ID/path cần giới hạn độ dài và chặn control characters; dùng JSON.stringify cho mỗi record, không nối raw input thành dòng log.

Không thay đổi `MigrationError` thành nơi chứa raw input. Context safe truyền từ runner/writer dưới dạng typed metadata; `safeError` vẫn là ranh giới cuối.

## 7. Điểm tích hợp và thứ tự triển khai

1. Tạo `run-logger.ts`: schema event, private session directory, bounded writer/rotation, summary atomic; injection clock/writer cho unit test.
2. Bọc lifecycle trong `scripts/import-pw1-json.ts`: parse args→logger→runImport→safe error→close. Truyền logger theo dependency thay vì monkey-patch process streams.
3. `runner.ts`: context session/run/group/store, sự kiện preflight/start/verify/fail và summary; nối progress callback có throttle.
4. `writer.ts`: trả metadata action/source/target sau commit hoặc callback sau commit ở runner. Phải phân biệt reuse transaction đã được ghi ledger với việc chỉ đọc claim; không đếm claim lookup là migrate thành công.
5. Artifact/classification: forward counters và metadata lỗi đã sanitized; không đẩy diagnostics gốc không kiểm soát vào logger.
6. Khi lỗi nhóm, report store-local diagnostics từ dữ liệu đã phân loại; không sửa disposition/blocker chỉ để log đẹp.
7. README thêm3dòng: logs nằm ở đâu, mở summary/errors, runId để resume. Không biến README thành tài liệu kỹ thuật dài.

Triển khai logger scaffold trước group runner integration để dùng chung event contract; ghép fault tests cùng test resume/lease. `--log-dir` chỉ ảnh hưởng output, không đổi selection hoặc batch fingerprints.

## 8. Test bắt buộc

- File/dir private, reject repo/symlink, session độc lập khi resume, không overwrite log cũ.
- Injection newline/control chars, error cause chứa fake password/URI/email không xuất hiện ở mọi file và output capture.
- Logger init fail: business writer chưa được gọi.
- Lost ACK: không ghi confirmed success; reconcile dựa DB, không replay từ log.
- Commit xong rồi disk full: đúng1business commit, báo logging failure, resume không tạo duplicate.
- Queue chậm/rotate lớn: backpressure giữ RAM giới hạn, JSONL từng dòng hợp lệ và sequence có thứ tự.
- Lỗi import + lỗi flush: giữ mã lỗi gốc, ghi nhận secondary logging failure.
- Dry-run: có logs nhưng DB business/ledger không đổi; counts là planned.
- Group2 fail: summary group1verified, group2failed và group3unprocessed; không gán mọi store trong group2 là lỗi nếu chỉ1store thực sự fail.
- Resume: log session mới cùng batch; counts không cộng trùng completed trước session; summary final khớp SQL ledger.
- SIGINT và SIGKILL tại boundary; file log có thể thiếu đuôi khi kill nhưng không ảnh hưởng quyết định resume.
- Regression gallery, credential và creator vẫn dựa test cũ; logger không được log dữ liệu của chúng.

## 9. Scope/timebox và nghiệm thu

Thay hạng mục progress1h của Phase08 bằng hạng mục logging+integration cần khoảng2–3h tùy fault tests. Toàn bộ group runner + durable logs có thể vượt timebox8h ban đầu; không giảm correctness tests để giữ cam kết giờ.

Ưu tiên tối thiểu bắt buộc: events/errors/summary, privacy, after-commit semantics, bounded queue và logging failure handling. Không làm log viewer, search index, retention daemon hoặc gửi log lên dịch vụ ngoài.

Definition of done: chạy một lệnh tạo session log; người vận hành đọc summary biết store nào xong, lỗi tại đâu và bước tiếp theo; tra source→target trong event/ledger; rehearsal clone kiểm counts và crash/resume; dry-run không ghi DB. Chưa gọi full-ready khi source diagnostic vẫn chặn các nhóm.

## Implementation notes

Logger await từng event, queue0 thay vì queue1MiB; tạo backpressure trực tiếp. Registry merge tối đa2reader với4096keys/buffer thay vì fan-in16/8MiB; vẫn trong ngân sách plan. Source metadata/ledger giữ nguyên; không thêm schema DB. File logs có sequence và events sau commit; primary error luôn được giữ khi logging lỗi.

Nghiệm thu: [grouped implementation report](reports/260918-grouped-import-implementation.md). Unit faults và clone3nhóm PASS; master thật dừng đúng source blocker nhóm1, chưa full apply.
