# F42 → F40: báo cáo tổng quan về evidence đối soát PW1 ↔ PW2

Ngày rà soát: 2026-09-30. Phạm vi: yêu cầu bàn giao của QC trong cuộc trao đổi này, code ở checkout hiện tại `feat/F42-migration-data-pw1-to-pw2`, và contract F40 hiện có. Đây là báo cáo thiết kế/đánh giá khả thi; chưa phải xác nhận đã deploy staging hay đã chạy test dữ liệu thật.

## Kết luận

**F42 có thể hỗ trợ yêu cầu của QC, nhưng hiện chưa bàn giao được field-level reconciliation cho F40.** F42 đã có child `migration_runs.run_id`, trạng thái `VERIFIED`, `migration_entity_map` với source/target identity và checksum cấp record. F40 đã có sáu status và provider UI, nhưng provider chưa nhận child run; không có field evidence producer/read model đã đăng ký. Muốn F40 hiển thị `match/mismatch/missing/duplicate/unsupported/unverified` trung thực, F42 phải bổ sung evidence bền vững, rule registry, snapshot/target verification, summary coverage và một read contract. F40 sau đó mới tích hợp adapter và giao diện.

Không được xem `VERIFIED` của child run là “mọi field nguồn PW1 khớp”. Importer đã kiểm **các projection được emit** với PW2 tại thời điểm verify; nó chưa kiểm toàn bộ source inventory/field theo contract QC. Field evidence cần gate riêng `complete/partial/unavailable`, có số lượng và lý do. Run `VERIFIED` có thể có field `unsupported`/`unverified` và có thể phát hiện `mismatch` qua rule đối soát nguồn độc lập hoặc lần kiểm sau đó. Một target bị sửa sai **trước** `verifyStore()` sẽ làm importer thất bại, không tạo child run `VERIFIED`. Gate QC/cutover phải tách khỏi importer gate.

## Bằng chứng từ code hiện tại

| Thành phần | Hiện có | Khoảng trống |
| --- | --- | --- |
| F42 ledger | `migration_runs`, `migration_import_stores`, `migration_entity_map`; writer lưu checksum và `verifyStore()` so projection đã emit với target trước khi đánh dấu `VERIFIED` | Chưa lưu kết quả từng **field nguồn** theo rule QC hoặc thời điểm snapshot riêng của stock |
| F42 exporter | Manifest, mapping report, Product/Customer reconciliation receipts | Receipt trước import chỉ chứng minh mapping/target ref dự kiến, không tự chứng minh PW2 ID/giá trị đã ghi |
| F42 destination map | Đọc ledger và xác minh Tenant/Site/Category target | Không phải crosswalk đầy đủ Product/Order/SKU/field |
| F40 reconciliation | Status sáu loại, provider, sanitizer; UI demo | Provider chỉ nhận `scope + storeId`; thiếu child run, provenance, field rule/reason code và summary field |
| F40 render evidence | Contract riêng cho page/block/live-render | F42 commerce field evidence không thay thế block crosswalk/live render |

Code tham chiếu: [`scripts/pw1-migration-schema.js`](../../../scripts/pw1-migration-schema.js), [`ledger.ts`](../../../src/lib/migration/pw1-json/ledger.ts), [`writer.ts`](../../../src/lib/migration/pw1-json/writer.ts), [`destination-map.ts`](../../../src/lib/migration/pw1-json/destination-map.ts), [`migration-reconciliation.ts`](../../../src/lib/admin/qa/migration-reconciliation.ts), [`migration-render-evidence.ts`](../../../src/lib/admin/qa/migration-render-evidence.ts).

## Sáu gói việc theo yêu cầu QC

| Gói | Kết quả F42 cần bàn giao | Report chi tiết |
| --- | --- | --- |
| 1. Staging và run identity | Bản deploy/revision, execution QC an toàn, Source Store ID dạng số, **child run UUID VERIFIED** | [01-staging-run-identity.md](01-staging-run-identity.md) |
| 2. Field evidence bền vững | Schema/version và producer ghi evidence cho từng field; provenance, checksum/giá trị an toàn | [02-evidence-model-lifecycle.md](02-evidence-model-lifecycle.md) |
| 3. Danh mục field | Registry Product/SKU, Order, Customer/Discount/Settings; field support và ngoài scope tường minh | [03-field-coverage-rules.md](03-field-coverage-rules.md) |
| 4. Giá và stock | Rule tiền/rounding và stock theo SKU/location/snapshot; drift được phân biệt | [04-money-stock-time.md](04-money-stock-time.md) |
| 5. Coverage và fixture | Summary có mẫu số đầy đủ, bảy case QC tối thiểu, seed/reset có bằng chứng | [05-summary-fixture-verification.md](05-summary-fixture-verification.md) |
| 6. Handoff F40 | Read-only API/query, version, security, pagination, mapping rules, owner và triển khai F40 | [06-read-contract-handoff.md](06-read-contract-handoff.md) |

## Thứ tự triển khai đề nghị

1. Chốt field registry, semantics status, source snapshot và cách đọc PW2. Đây là điều kiện để thiết kế DB; không bắt đầu bằng UI hoặc bằng việc gắn nhãn cho checksum record.
2. Thêm schema evidence và migration SQL tương ứng; producer chạy trong/bám sát verify của child run. Có read model và summary an toàn, kiểm đúng `run_id`/store/source instance.
3. Triển khai Product/SKU và Order theo field QC yêu cầu; trả `unsupported`/`unverified` có lý do cho field chưa thể chứng minh. Sau đó mở Customer/Discount/Settings.
4. Chạy importer fixture trên QC isolation để chứng minh child run/evidence thật; chạy comparator fixture có nhãn synthetic để xác nhận đủ sáu trạng thái và reset/replay. Bàn giao riêng kết quả của hai loại fixture cùng revision/contract/child run cho F40.
5. F40 mở rộng provider/API theo child run và dùng read model; UI ghi rõ verified evidence vs demo. Page/block live-render theo luồng riêng.

## Gate để nói “F42 đã sẵn sàng cho F40”

- Có staging revision và schema version tương ứng; child run UUID thuộc đúng Source Store ID và ở `VERIFIED`.
- Mỗi entity/field trong registry có một disposition, kể cả field chưa support/thiếu evidence; summary không được tính chỉ trên các row đã ghi.
- Importer fixture chứng minh liên kết với child run thật; comparator fixture chứng minh đủ các ca status QC và được dán nhãn synthetic. Expected counts tái lập qua reset/replay, không trộn hai loại evidence.
- Read contract chỉ trả metadata và giá trị đã được allowlist; không trả credential, secret hoặc PII thô.
- F40 đọc được evidence của đúng child run; mọi lỗi run/store/version/snapshot trả `unverified` hoặc lỗi rõ ràng, không fallback sang catalog/demo.

## Rủi ro và quyết định còn phải chốt

- Nguồn PW1 trong exporter là snapshot; đối soát với PW1 live ở thời điểm khác có thể sinh mismatch giả. Mọi comparison phải ghi rõ snapshot nguồn và thời điểm/phiên bản target.
- Unique active claim trong `migration_entity_map` ngăn biểu diễn nhiều active target cho cùng source; `duplicate` phải do detector và anomaly evidence độc lập xác nhận **bằng provenance nguồn trên target hoặc crosswalk khác đáng tin cậy**. Nếu không có khóa để quy target thứ hai về cùng nguồn thì là `unverified`, không phải duplicate.
- Fixture thể hiện `mismatch/missing/duplicate` có thể là comparator fixture có nhãn synthetic. Không được tuyên bố một run importer `VERIFIED` rồi cố ý sửa projection target trước verify: importer sẽ chặn. Fixture hợp đồng và lần import thật cần bằng chứng riêng.

## Kết quả review và quyết định cần QC/F42 chốt

Review lại với `verifyStore()` và DTO F40 cho thấy bốn quyết định còn mở trước khi biến báo cáo thành task thực thi:

1. QC có chấp nhận **hai lớp fixture** (importer thật + comparator synthetic) hay yêu cầu cả bảy tình huống từ cùng một child run thật? Cách thứ hai cần execution path riêng và không được nới importer verify.
2. F42 sẽ lấy source provenance nào trên target/crosswalk để chứng minh `duplicate`? Nếu không có, detector chỉ có thể trả `unverified`.
3. F42 sẽ publish field evidence generation sau `VERIFIED` như một gate độc lập thế nào, và cách ghi nhận target đổi giữa importer verify và lần đọc evidence là gì?
4. F40 sẽ biểu diễn SKU/Order item như record riêng hay field có `elementKey`? DTO hiện tại chỉ có Product/Order record và summary cấp record.

Những câu hỏi này không làm thay đổi kết luận khả thi, nhưng chưa thể gắn nhãn “đã đáp ứng QC” cho đến khi contract và fixture proof được chốt.
- Một số field QC nêu có thể không có target tương đương: stock theo warehouse, reserved/available, payment/integration, Page/Block. Chúng phải được phân loại theo evidence thực tế; không tạo field hoặc status `match` giả.
- Fixture reset trên shared staging có thể chạm dữ liệu khác. Chỉ dùng DB/schema/namespace QC được cô lập và marker sở hữu; nếu không, dùng execution path staging-safe được duyệt.

## Giới hạn báo cáo

Chưa kiểm tra deployment, DB staging hay dữ liệu thật; chưa chạy test. Checkout hiện có thay đổi dở ở nhiều file F42 và không có file nào trong đó được sửa bởi bộ báo cáo này. Các đường dẫn/shape được ghi dưới dạng đề xuất triển khai khi chưa tồn tại trong code.
