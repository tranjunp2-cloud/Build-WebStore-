# 02 — Schema, semantics và lifecycle của field evidence

## Vấn đề hiện tại

`migration_entity_map` ghi một row/record: source/target identity, `source_checksum`, `target_checksum`, action/state và detail. `verifyStore()` so toàn bộ projection đã emit và expected entity với target; sai projection sẽ làm run thất bại trước `markStoreVerified()`. Nó không chứng minh những field nguồn không emit, các rule nghiệp vụ độc lập hoặc target ở thời điểm khác. Không có row `source_field` ↔ `target_field` với kết quả QC. [`ledger.ts`](../../../src/lib/migration/pw1-json/ledger.ts), [`writer.ts`](../../../src/lib/migration/pw1-json/writer.ts).

## Contract dữ liệu đề nghị

Tên bảng do F42 quyết định. Tách **run evidence header**, **record evidence**, **field evidence**, **anomaly evidence** và **coverage summary** (có thể là các bảng/view riêng). Tránh nhồi JSON không kiểm index/unique vào `migration_entity_map.detail`.

| Cấp | Thuộc tính tối thiểu |
| --- | --- |
| Header | `contract_version`, `child_run_id`, `source_store_id`, `source_instance_id`, `source_snapshot_id/checksum/as_of`, `target_instance_hash`, `mapping_version`, `rule_registry_version`, `producer_revision`, `verification_state`, `verified_at`, `evidence_digest` |
| Record | `source_entity`, `source_id`, `target_collection`, `target_ids[]` hoặc liên kết 1-n, `record_status`, `reason_code`, `source_disposition`, `target_read_state` |
| Field | `source_field`, `target_field`, `element_key` (SKU/item/location nếu là array), `comparison_status`, `reason_code`, `transform_code/version`, canonical type/unit, source/target fingerprint hoặc giá trị đã phân loại an toàn, `verified_at` |
| Anomaly | loại (`duplicate`, target drift, conflict...), các source/target ID liên quan, detector version, evidence reference; không dùng raw PII làm khóa công khai |
| Summary | expected/compared counts cấp record và field, status counts, out-of-scope list, coverage state và digest của registry |

Khóa idempotency đề nghị: `(child_run_id, source_entity, source_id, source_field, element_key, rule_registry_version)` cho field. Một target mapping có thể tạo nhiều row khi source field fan-out; cần thêm `target_field` vào khóa nếu quy tắc là một nguồn → nhiều target, và quy định rõ cách tổng hợp về một status UI. Mọi ID liên quan Store phải được kiểm tenant/site trong lúc đọc target.

## Semantics sáu status

| Status | Bằng chứng đủ | Không được làm |
| --- | --- | --- |
| `match` | Một target xác minh; canonical source/target cùng rule và bằng nhau | Suy từ target ID tồn tại hoặc hai giá trị đều rỗng khi source chưa được kiểm |
| `mismatch` | Một target; canonical values khác nhau tại cùng snapshot/verify context | So raw format khác đơn vị hoặc thời điểm |
| `missing` | Source được snapshot/kiểm scope; target read thành công và xác nhận vắng mặt sau verify | Suy từ không có row evidence, timeout hoặc query thất bại |
| `duplicate` | Detector thấy >1 target thật gắn cùng source identity qua marker/provenance hoặc crosswalk được xác minh; ghi tất cả ID an toàn và detector version | Đếm active claims trong ledger hoặc suy từ hai bản ghi có cùng SKU/email: unique constraint không biểu diễn trường hợp này và business key không chứng minh cùng nguồn |
| `unsupported` | Rule registry tuyên bố field ngoài phạm vi/chưa có target tương đương | Biến thành match vì source được giữ raw/archive |
| `unverified` | Thiếu source snapshot, target read, rule hoặc proof; reason cụ thể | Biến thành missing hoặc pass |

`null` hợp lệ, absent, `0`, empty string, empty verified collection và nguồn chưa đọc là các trạng thái riêng trong canonicalizer. Record có nhiều field được tổng hợp theo precedence đã version hóa: duplicate/missing identity trước, sau đó mismatch, unverified, unsupported, match. Nếu detector không có marker nguồn đáng tin cậy để quy target thứ hai về source, trả `unverified` với reason `DUPLICATE_CHECK_UNAVAILABLE`. F40 hiện chỉ chấp nhận sáu status, nên không thêm `mixed` nếu chưa đổi contract; summary phải luôn giữ counts từng field độc lập với record status.

## Điểm ghi và công bố

1. Đọc **nguồn từ artifact snapshot đã bind với child run**, không query PW1 live rồi gọi đó là snapshot cùng run. Kiểm manifest hash và disposition theo source entity/field.
2. Sau write và finalize references, importer tiếp tục `verifyStore()` như hiện tại. Không nới điều kiện verify để tạo ca lỗi QC. Evidence builder đọc lại PW2 theo snapshot/transaction nhất quán với tenant guard, normalize theo registry và tạo record/field/anomaly evidence; field không đọc được là `unverified`.
3. **Ưu tiên generation riêng sau khi child run `VERIFIED`**, có state `building` → `complete` và atomic publication. Việc scan toàn bộ source inventory/field trong transaction verify hiện tại có thể kéo dài lock và làm chậm importer; chỉ đưa vào cùng transaction sau khi đo và chứng minh bound thời gian/lock. F40 chỉ đọc generation `complete`, còn lại hiển thị `unverified`.
4. Replay cùng child run/generation và cùng input cho cùng digest; khác snapshot/rule/target revision phải tạo generation mới hoặc báo drift, không overwrite evidence đã được QC xem.
5. Sau sửa ETL phải tạo run mới hoặc cơ chế replay được ledger cho phép; không viết lại snapshot/field evidence của child run cũ. Target đổi sau `VERIFIED` cần generation mới có `reason_code=TARGET_DRIFT` và status trong sáu loại (`unverified` nếu không thể xác định nguyên nhân/đúng snapshot); `target_drift` **không** phải status thứ bảy. Không cập nhật lặng lẽ kết quả cũ.

## Test cần có

- Unit: null/absent/zero, transform version, key array ổn định, status precedence, identity/tenant guard, checksum canonical deterministic.
- DB integration trên clone/QC: crash giữa build không để generation `complete`; replay idempotent; commit evidence và header đồng bộ; Store khác không đọc chéo; target drift tạo trạng thái rõ.
- Negative: missing source inventory/failed PW2 read → `unverified`; target xác minh vắng mặt → `missing`; hai target thực **có source provenance** → anomaly `duplicate`; hai target chỉ trùng business key → `unverified`; unsupported vẫn được tính vào mẫu số.

## Ghi chú schema repo

Nếu thêm bảng/cột, cập nhật migration SQL theo cơ chế repo và kiểm lại schema fingerprint của importer. Không chỉnh riêng Payload collection để lưu evidence rồi bỏ quên `scripts/db-setup.js`; schema migration F42 hiện còn ở [`scripts/pw1-migration-schema.js`](../../../scripts/pw1-migration-schema.js), nên cần chọn một nguồn DDL chính và ghi rõ build/deploy áp dụng nó thế nào.
