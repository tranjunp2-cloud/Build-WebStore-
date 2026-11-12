# Phase 02 — Chứng minh độ phủ toàn nguồn PW1

## Bối cảnh

**Owner:** F42 exporter/evidence + DBA; F40 đọc và hiển thị. **Trạng thái:** Đang thực hiện một phần; F40 reader/API/UI có, full-source proof chưa đạt. **Gate:** Phase 01; F42 Phase 01/02/05/07 và sidecar từ selected CSV gốc. Store không emit có thể không có child run, nên tầng này đọc theo snapshot + Source Store ID, không phụ thuộc run VERIFIED.

## Đầu ra và luồng dữ liệu

`selected CSV đã hash → source sidecar an toàn trước lọc → ingest DB → sourceCoverage DTO → F40`. Khóa **hai partition không chồng lấn** trong contract:

- Mỗi source field instance thuộc đúng một disposition `emitted`, `retained-source`, `excluded-policy`, `excluded-security`, `unresolved`; `partial` chỉ là thuộc tính suy ra của record, không phải phần cộng thêm vào field total. Công thức theo Store/entity/table: `selectedFields = emitted + retained + excludedPolicy + excludedSecurity + unresolved`. `excluded-security` chỉ lưu count/proof/reason, tuyệt đối không lưu tên/value bí mật nếu policy cấm. Đếm từ schema/selected CSV trước redaction; sidecar `fields` có thể không chứa field bí mật nên `Object.keys(row.fields)` không được coi là toàn mẫu số.
- Mỗi source record thuộc đúng một bucket `emitted-full`, `emitted-partial`, `not-emitted-retained`, `not-emitted-excluded`, `not-emitted-unresolved`; nếu các field chưa emit có nhiều lý do, dùng `not-emitted-unresolved` và giữ reason chi tiết ở từng field. Công thức `selectedRecords = tổng năm bucket`; không cộng record và field total với nhau.
- `blocked/deferred` là trạng thái xử lý của Store/snapshot, hiển thị như chiều độc lập, không cộng thêm vào tổng record/field. Store blocked vẫn phải có inventory nguồn nếu sidecar tồn tại; nếu thiếu thì coverage là `BLOCKED`, không suy diễn 0.

Tổng source phải đối chiếu file/từng bảng và số dòng/field không gán Store (`unattributed`) phải được báo **ngoài** tổng của từng Store nhưng nằm trong tổng snapshot. Chứng minh `snapshotSelected = tổng StoreSelected + unattributed` ở cấp record và field; security-excluded vẫn góp count, không lọt value. Source record không emit không bị gắn `missing` PW2.

## Việc thực hiện

1. Tái sử dụng `migration_source_evidence_snapshots` và `migration_source_evidence_rows`; đo khả năng biểu diễn Store blocked/deferred, reason/owner và source-only Store. Chỉ thêm DDL additive nếu contract hiện thiếu; đặt trong `scripts/pw1-evidence-schema.js`, chạy từ `scripts/db-setup.js`, kiểm idempotent hai lần. Không `DROP TABLE`.
2. F42 exporter/ingest xác minh row/field count **theo từng selected CSV table**, hash sidecar/manifest/config và disposition, bao gồm `redactedFieldCount`/security exclusion trước khi value bị xóa. Đối chiếu `selectedFields` với comparable sidecar fields + security-excluded count + field không gán Store; chặn snapshot `COMPLETE` khi thiếu/tamper, trùng identity hoặc counts không khớp. F40 không đọc raw CSV hoặc secret; Customer display chỉ được trả cho Super Admin khi generation F42 lưu theo contract đã duyệt.
3. Tạo read query có giới hạn theo source instance, snapshot và Store; trả summary toàn nguồn, entity/disposition, số ngoài scope, reason/owner và mức proof. Bảo vệ Store/namespace, kể cả Store không có child run. Dùng chỉ mục hiện có; đo query plan với Store lớn và cursor ổn định trước khi chốt index mới.
4. F40 hiển thị tầng nguồn độc lập. Nếu artifact cũ không còn CSV/sidecar đáng tin cậy: `BLOCKED: không chứng minh được toàn bộ nguồn trước lọc`, kèm metadata còn có; không dựng field value từ mapping report.

## File dự kiến

| Thao tác | File | Mục đích |
| --- | --- | --- |
| Sửa | `src/lib/migration/pw1-export/source-evidence.ts`, `src/lib/migration/pw1-evidence/ingest.ts` | Kiểm kê/hash/disposition trước lọc và ingest an toàn |
| Sửa nếu cần | `scripts/pw1-evidence-schema.js`, `scripts/db-setup.js` | Cột/index/summary additive và schema idempotent |
| Tạo | `src/lib/admin/qa/f42-source-coverage-reader.ts` | Reader an toàn cho Store có/không có child run |
| Sửa | `src/app/api/qa/migration-reconciliation/route.ts` | View source coverage đã validate theo contract Phase 01 |

## Kiểm chứng và điều kiện ra phase

- Fixture gồm Store emitted-full/partial, retained/excluded/unresolved, blocked/deferred, row unattributed và Store không emit. Đối chiếu độc lập per-table CSV count, manifest/sidecar hash, hai partition không chồng lấn, tổng Store và tổng snapshot; cố ý tạo record partial và nhiều reason để bắt lỗi double count.
- Tamper/missing sidecar trả unavailable/BLOCKED, không số 0 thành công; chạy ingest lại không nhân đôi; schema chạy hai lần không đổi dữ liệu.
- API chỉ Super Admin, chặn truy cập chéo Store/namespace, không lộ raw CSV, PII, token hoặc private path; browser hiển thị lý do và mẫu số nguồn rõ.
- Tầng nguồn không tự tạo run, target mapping hay verdict import.
