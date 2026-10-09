# Phase 01 — Khóa contract, status và kiểm kê nguồn

**Owner:** F42 tech lead; QC và F40 ký phần semantics/UI. **Effort:** 3–5 dev-days. **Dependency:** không. **Deliverable:** registry/DTO v1, quyết định fixture, bảng gap có owner và ước lượng lại.

## Việc làm theo thứ tự

1. Freeze revision code, artifact exporter contract, mapping version, source schema fingerprint và target schema tại thời điểm thiết kế. Kiểm **selected CSV snapshot gốc đã hash và config**, master JSON/parts, manifest, Product/Customer receipts, mapping report, source-only/raw archive và `src/lib/migration/pw1-json/{projection,writer,runner}.ts`. Lập bảng từng field QC: **giá trị nguồn thật nằm ở đâu, độ đầy đủ/thời điểm snapshot, target hiện có path nào, rule nào đã tồn tại**. `mapping-report` có ID/disposition/field status, không có raw value; receipt cũng không thay CSV gốc. Kiểm source row/field counts trước và sau exporter, cho Store emitted, blocked và policy-excluded. Không phỏng đoán từ master mapping tài liệu.
2. Viết registry có version/hash: `ruleId`, `sourceEntity/table/path/inputSet`, `targetCollection/path`, `elementKey`, source disposition (`operational/archive_only/excluded/not_present`), support state, canonical type/unit, transform code/version, null/absent/empty rule, sensitivity/display policy, owner/reason. `product_skus`, order items, stock locations và addresses phải có key ổn định; tập/identity được so riêng count. Field fan-in/fan-out ghi input set và rollup.
3. Chốt sáu status bằng decision table: `match` chỉ khi one-to-one target + canonical equality cùng rule; `mismatch` khi one target đọc thành công và khác; `missing` khi nguồn có proof + target absent đã đọc thành công; `duplicate` khi >1 target có cùng source provenance; `unsupported` khi registry nói ngoài scope/chưa có target; `unverified` khi thiếu proof/read/rule. Chốt `reasonCode` enum, record precedence, exception severity độc lập, `TARGET_DRIFT` là reason, không là status mới.
4. Định nghĩa event/binding: `sourceInstanceId`, numeric Source Store ID, child UUID, source snapshot ID/hash/as-of, stock snapshot time, target binding, mapping/registry/comparison version, producer revision, **importer profile/execution scope và selected source inventory**. `batchId=json:<uuid>` chỉ là trace. Foundation/users-only child run có thể VERIFIED nhưng không chứng minh Product/Order đã import; contract phải biểu diễn `not_in_run_scope` bằng reason/disposition và cấm full Commerce coverage pass. Định nghĩa `VERIFIED` importer khác generation `complete` và QC Pass.
5. Chốt source/target equivalence cho money (major/minor, currency, Decimal precision, rounding, null/zero) và stock (`on_hand/reserved/available`, SKU/location/as-of); Order item/status/total; Customer identity/PII; Discount timezone; settings operational versus archive. Ghi rule còn thiếu thành `unsupported` hoặc `unverified`, không để rỗng.
6. Chốt hai fixture: importer thật trên QC isolation để chứng minh child `VERIFIED` + generation; comparator synthetic để tạo `mismatch/missing/duplicate` có kiểm soát. Nếu QC yêu cầu cả bảy case trên cùng importer child run thật, ghi quyết định và execution path staging-safe được duyệt; không đổi `verifyStore()` chỉ để pass fixture.
7. Chốt API v1 với F40: run list, summary, records, fields, keyset cursor, filter/status/entity, error codes và safe DTO; chọn SKU/item là nested field có `elementKey` (đề nghị cho v1) hay record type mới. Ghi versioning/backward compatibility; không để F40 tự suy kết quả từ crosswalk ID.
   Ghi adapter mapping rõ giữa sáu status mới và các status/visual state cũ của US-F40-11 (`error/warning`, `missing_in_pw2`, `orphan_in_pw2`, `matched_empty`); target-only là anomaly riêng ngoài source denominator. Chốt page ownership/page-scoped query cho bảy nhóm US-F40-11, hoặc ghi explicit gap và owner Phase 10.
8. Thêm TC-ID mới `[ ] AUTO` vào QA docs F42/F40 trước khi viết test, giữ trạng thái `NOT_RUN` cho tới khi có log thực thi. Review bảo mật registry với owner phù hợp.
9. Khóa **hai mẫu số**: toàn bộ selected CSV theo source snapshot/Store (export coverage) và chỉ các record/field dự kiến import từ emitted master (import fidelity). Phân loại `mapped`, `retained-source`, `excluded`, `unresolved`, blocked/deferred Store trước khi áp sáu comparison status. QC không cần CSV: chốt collector chạy **trước lọc tại exporter**, sidecar nguồn an toàn có hash trong manifest, và operator nạp safe evidence vào DB staging. Source collector phải độc lập với mapper để lỗi mapper không cùng lúc làm mất cả expected inventory. Artifact cũ thiếu CSV lẫn sidecar chỉ chứng minh được metadata/report, không được tuyên bố full source field parity.

## Bảng quyết định cần ký

| Quyết định | Default đề nghị | Nếu chưa chốt |
| --- | --- | --- |
| Source source-of-truth | Bound exporter snapshot, không PW1 live | Builder trả `unverified` |
| SKU/Order item UI | Nested `elementKey` + drill-down/filter | Không aggregate stock/item thành một số |
| Duplicate detector | Provenance/crosswalk verified; lưu anomaly riêng | `unverified:DUPLICATE_CHECK_UNAVAILABLE` |
| Stock per location | Chỉ support nơi cả hai bên có location proof | `unsupported`/`unverified` theo nguyên nhân |
| Sensitive equality | HMAC managed key hoặc masked/aggregate | Không persist raw/unsalted hash |
| Fixture | Real importer + synthetic comparator có nhãn | Chưa claim đủ bảy case từ run thật |

## Acceptance / handoff

- Registry có một dòng cho **mọi field QC liệt kê**, support/gap/owner rõ; artifact audit dẫn tới giá trị thật hoặc chứng minh không có. QC/F40 phê duyệt reason/status meanings.
- Quy tắc `match` phân biệt meaningful value với cả hai bên rỗng/null; null/absent/empty/zero là bốn trường hợp có proof và display khác nhau. Cả hai rỗng chỉ được tính match nếu registry xác nhận field optional và hai phía cùng trạng thái theo contract; F40 vẫn hiển thị `matched_empty` riêng, không tăng tỷ lệ meaningful match ngầm.
- JSON schema/API example có đủ sáu status, `sourceStoreId + childRunId`, version/provenance, field-level summary, pagination và lỗi 404/409/503. Không có raw PII/secret.
- Có fixture decision, môi trường staging QC và owner; backlog chia PR nhỏ với estimates cập nhật. Phase 02 có thể bắt đầu sau khi khóa identity/schema core, trong khi rule field chi tiết tiếp tục được rà.
- Có source-wide inventory baseline được chụp từ selected CSV **lúc export**, sidecar/manifest/report/master đối chiếu hash, gồm cả Store không emit; thiết kế F40 export-coverage view cho Store không có child run. QC chỉ cần safe DB/API output. Ước lượng lại do scope này chưa nằm trong mốc effort cũ.

## Rủi ro

Artifact hiện có có thể chỉ giữ nguồn dưới dạng archive/raw receipt, thiếu field snapshot để so trực tiếp. Đánh dấu `unsupported` nếu migration contract loại field, `unverified` nếu dữ liệu/rule có thể support nhưng proof hiện chưa đủ. Không tự lấy PW1 live để vá chỗ trống của snapshot.
