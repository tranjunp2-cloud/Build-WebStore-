# 06 — Read contract, bảo mật và handoff sang F40

## Đường đọc cần cung cấp

F42 nên xuất một read-only contract versioned trên staging QC, trực tiếp từ DB evidence hoặc qua API được bảo vệ. F40 không nên tự join ngẫu nhiên ledger, Payload records và exporter reports trong request UI. Tối thiểu cần:

- `GET runs?source_store_id=<numeric>`: child runs và trạng thái, snapshot/version; chỉ trả run thuộc Store. `json:<uuid>` chỉ là batch reference.
- `GET runs/<child_uuid>/summary?source_store_id=...`: coverage, status counts, outside scope, exception counts và evidence generation/state.
- `GET runs/<child_uuid>/records?source_store_id=...&entity=...&status=...&cursor=...`: phân trang/keyset, stable order; record có source identity opaque, target identity opaque, status/reason, field count.
- `GET runs/<child_uuid>/records/<opaque_id>/fields?cursor=...`: field key/label, status/reason, transform code, masked/canonical value được duyệt, snapshot/verified time.

Có thể thay REST bằng read-only SQL view/provider nội bộ nếu cùng mức kiểm tra auth/tenant/scope và version. Query phải filter theo **child UUID + Source Store ID + source instance/target binding**; không chấp nhận chỉ một trong hai khi lấy evidence. Run chưa `VERIFIED` hoặc generation chưa `complete` phải trả trạng thái không sẵn sàng, không rơi về catalog mock/demo. `404` cho run không thuộc Store, `409`/trạng thái riêng cho version không tương thích, `503`/unavailable cho evidence build chưa hoàn tất — chốt status code trong OpenAPI/schema để F40 xử lý ổn định.

## DTO và mapping sang F40

DTO nên phân biệt `recordStatus` và `fieldStatus`, `reasonCode`, `transformCode`, `sourceField`, `targetField`, `elementKey`, `snapshotAt`, `verifiedAt`, `evidenceGeneration`, `contractVersion`, `registryVersion`. `sourceValue/targetValue` chỉ có khi field được allowlist và đã normalize an toàn. Không đưa raw JSON, SQL sửa lỗi hoặc encrypted secret vào API.

F40 hiện có `MigrationEvidenceProvider.getSnapshot({scope, storeId})` và `ReconciliationSnapshot` với `records[]`; API `GET /api/qa/migration-reconciliation` nhận `scope`, `store_id`, `demo`. Cần mở provider/API để nhận **child run UUID**, phân trang, provenance và **summary cấp field**: summary hiện tại được sanitizer tính từ records, chỉ có counts cấp record. F40 `ReconciliationEntity` cũng chưa có SKU/order-item như record riêng; chọn mở entity type hoặc thêm `elementKey`/drill-down theo Product/Order. Sanitizer hiện chỉ cho một tập source field key hẹp, che source/target IDs và PII cho browser; F40 phải cập nhật allowlist có review để các field mới hiển thị, đồng thời giữ bí mật khi gọi adapter. Không nên tắt sanitizer để “thấy đủ field”. Tham chiếu [`migration-reconciliation.ts`](../../../src/lib/admin/qa/migration-reconciliation.ts), [`route.ts`](../../../src/app/api/qa/migration-reconciliation/route.ts).

F40 cần hiển thị rõ `evidenceState`: `demo`, `verified`, `partial`, `unavailable`; `verified` chỉ nghĩa evidence generation có provenance hợp lệ, không có nghĩa mọi field match. Summary phải cho phép QA lọc mismatch/missing/duplicate/unsupported/unverified. Tình trạng từ F42 phải qua DTO, không được UI suy từ thiếu target ID hoặc hai `null`.

## Bảo mật và vận hành

- Chỉ Super Admin/QC role được duyệt có quyền đọc; API chỉ GET, bounded pagination, rate limit/timeout, audit query theo actor/run/Store, không ghi PII vào access log.
- Registry `sensitivity` theo allowlist. Secret/credential/token/password không được persist trong field evidence. Với PII cần HMAC có khóa riêng được quản lý ngoài artifact (nếu cần equality), hoặc chỉ masked display/aggregate; unsalted hash email/phone không đủ bảo mật. Không trả HMAC key hoặc giá trị raw.
- Field chứa URL/query, HTML/email template, payment/domain/integration config cần explicit review trước khi hiện nội dung. `reasonCode` là enum ổn định, không đưa raw exception message.
- Không cho F40 query trực tiếp Payload production DB từ browser. Read provider phải phân trang và bound số field/record; cache theo child run + evidence generation, invalidate khi generation mới.
- Nếu thêm env vars cho endpoint/key, bổ sung placeholder trong `.env.staging.example` và `.env.production.example`; không commit giá trị thật.

## Gói handoff bắt buộc từ F42

1. Commit/revision đã deploy, contract/schema/registry version và changelog tương thích.
2. Source Store ID số + **child run UUID VERIFIED**, source snapshot hash/as-of, target identity đã làm mờ và `verified_at`.
3. Ma trận entity/field: support, outside scope, transform rule, null/empty/array rule, privacy classification, reason codes.
4. API/schema mẫu có response cho đủ sáu status và error states; query/pagination limits; summary expected counts.
5. Importer fixture và comparator fixture được phân biệt; seed/reset hoặc execution path staging-safe, fixture owner, expected results, runbook, kết quả chạy thực tế. Không gọi synthetic comparator fixture là migration run production VERIFIED.
6. Known gaps riêng cho Product/SKU, Order, Customer/Discount/Settings và Page/Block. F40-13 render evidence vẫn cần block crosswalk + live-render runner riêng; field-level commerce evidence không thay thế chứng minh render.

## Điều kiện F40 có thể bắt đầu tích hợp

F40 có thể phát triển adapter/UI song song khi contract và fixture mẫu được pin version. Chỉ gắn nhãn “đối soát thật” sau khi read API trả dữ liệu từ child run `VERIFIED` và evidence generation `complete` **dựa trên source/target thật của run đó**, fixture importer đạt expected counts, sanitizer được review, và QC xác nhận không còn nhầm batch ID với child UUID. Comparator fixture synthetic chỉ chứng minh cách hiển thị và logic status. Khi chưa đạt, F40 giữ `unverified` và demo được dán nhãn rõ.
