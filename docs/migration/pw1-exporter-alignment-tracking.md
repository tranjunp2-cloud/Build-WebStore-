# PW1 exporter — các mục đã sửa để cập nhật master mapping

Cập nhật: 2026-09-17. Implementation: worktree-2. Đây là note bàn giao; chưa xóa/đánh dấu đóng các đoạn gap trong master f08-935, để người phụ trách tài liệu cập nhật sau.

## Phiên bản

- Contract được port nguyên văn từ `ech-prime-web-v2-f08-935/docs/migration/pw1-pw2-master-field-mapping.md`; hash `27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567`.
- Exporter mới: **1.2.0** (bao gồm reconciliation của 1.1.0 và classification bên dưới). Export mới luôn ghi hai sidecar reconciliation và hash trong manifest.
- Cho phép validate đúng cặp legacy **1.0.0 / 8aacb261…** bằng schema SKU cũ. Không chấp nhận hash/version tùy ý, không nâng artifact cũ bằng cách thay hash.
- Artifact production mới: `.migration/exports/pw1-prod-20260917-classification-001` (kết quả và giới hạn bên dưới). Artifact `followup-001` cũ không bị sửa. Chưa import DB.

## Đã xử lý trong code — có thể cập nhật mô tả gap implementation

| Mã | Mục master | Trước | Sau / nội dung nên ghi lại | Kiểm chứng |
|---|---|---|---|---|
| EXP-01 | §18.2; đoạn gap SKU | Exporter bắt buộc mã SKU 1–50 cho cả Product và variant. | Product có dòng giá hợp lệ nhưng mã null/rỗng/whitespace được emit với field sku bỏ trống; không sinh mã thay thế. Variant giữ mã đến 100 ký tự. Base SKU có mã vẫn giữ giới hạn 50 theo shared validator. Bỏ qua mã rỗng khi kiểm collision; mã thực trùng vẫn bị chặn. Base tổng hợp của Product có variants là hành vi cũ không thay đổi. | TC-F42-078; pipeline thật export 2 Products thiếu mã, validate valid; legacy schema vẫn từ chối artifact không có mã. |
| EXP-02 | §6; receipt Customer | Helper có diagnostics đầy đủ nhưng master exporter không serialize. | `customer-reconciliation.json` giữ customerCrosswalk, addressDispositions (Order/Address ID, usage, targetIndex, legacyGeographyTypes/reason), rankDispositions/rankConflicts/profileConflicts. Có namespace/snapshot, hash, schema và kiểm ownership/target/coverage. Target bị cách ly trở thành null; quarantinedCustomerRefs ghi dấu vết. Cohort thất bại được ghi cohort-failed. | TC-F42-079/081; canonical/merge, Shipping/Billing dedup, địa lý soft-deleted, overflow 11→10, target quarantine, tamper và source mismatch. |
| EXP-03 | §18.4; §16 và các dòng tham chiếu SKU identity | skuCrosswalk chỉ trong bộ nhớ; không có receipt selectedTuple/targetId đầy đủ. | `product-reconciliation.json` giữ Store/Product/SKU nguồn, eligibleSkuCount, tier/option IDs, selectedTuple, targetRef/path/variant UUID và errors. Bao phủ simple SKU và variant của Products live trong Stores được emit. Product không emit giữ source evidence và target=null; Stores bị block/exclude vẫn xem mapping report/CSV nguồn, không tuyên bố receipt phủ toàn DB. | TC-F42-080/081; simple/variant, tuple, duplicate/foreign SKU, target quarantine, target UUID/path và coverage Product emitted. |
| EXP-04 | Ghi chú phiên bản đầu master; §2.3 | Pin bản master cũ, không có hai sidecar mới. | Pin đúng bản master hợp nhất; exporter 1.1.0 bắt buộc hai receipt. Validate-only kiểm hash/schema/provenance và quan hệ; artifact mới thiếu receipt bị từ chối. Hỗ trợ cặp legacy đã biết với ràng buộc cũ. | TC-F42-081; pin file thực, receipt thiếu/tamper/unknown field, sai source snapshot, sai version, legacy compatibility. |

## Những giới hạn phải giữ lại trong master

- **Customer archive raw vẫn ở CSV nguồn bên ngoài artifact**, được pin bằng manifest files. retainedSourceRows chỉ liệt kê table/ID để tìm nguồn, không nhúng archive của helper. Có thể bỏ câu “diagnostics chưa xuất”, nhưng không đổi thành “toàn bộ raw archive đã có trong JSON”.
- Receipt kiểm schema, identity, tenant, coverage và target paths. Validate-only không đọc lại CSV để xác nhận từng giá trị nguồn; hash/evidence không thay đối soát nguồn độc lập.
- Product không có dòng giá hiện hành (nhóm 252 trước đây) vẫn bị chặn; không đồng nhất với thiếu mã SKU. Chưa đo số Product được khôi phục trên production sau EXP-01.
- Refund status=1 vẫn cần bằng chứng và cơ chế nhận evidence; tax khác 0 vẫn chưa được mapper hỗ trợ. Không đổi status/thuế để vượt kiểm tra.
- Các mục Store ST-01…ST-10 vẫn chưa đóng: [file tracking Store](pw1-store-issues-tracking.md). Store 323 vẫn hoãn theo ST-11. Không đổi asOf, lifecycle, owner hoặc domain trong lượt này.
- Creator binding sang User ID đích, schema/index DB, timestamps/hooks và side effects là gate của importer. Không ghi DB hay cấp quyền ở exporter.
- Không mở lại rich text/email/history đã hoãn.

## File code chính

- [SKU schema](../../src/lib/migration/pw1-export/mappers/catalog-schemas.ts), [mapper Product](../../src/lib/migration/pw1-export/mappers/catalog.ts), [operational validator](../../src/lib/migration/pw1-export/validate-master.ts).
- [Reconciliation receipts](../../src/lib/migration/pw1-export/reconciliation-receipts.ts), [Customer mapper](../../src/lib/migration/pw1-export/mappers/commerce.ts).
- [Export pipeline](../../src/lib/migration/pw1-export/export-master.ts), [artifact validator](../../src/lib/migration/pw1-export/validate-artifact.ts), [artifact schemas](../../src/lib/migration/pw1-export/artifact-schemas.ts), [version pin](../../src/lib/migration/pw1-export/master-version.ts).

## Kết quả kiểm tra và việc tiếp theo

- **417 tests / 31 files PASS**; **TypeScript PASS**. QA cases TC-F42-078…081 đã ghi trong docs/qa/F42-pw1-master-json-export.md.
- Logs local: `.migration/logs/alignment-regression.log`, `.migration/logs/alignment-typecheck.log` (ignored, không tự có trên PR).
- [ ] Người phụ trách cập nhật các đoạn gap trong master theo bảng trên, giữ các giới hạn còn lại.
- [ ] Nếu master đổi nội dung sau khi biên tập: cập nhật pin/version policy tương ứng trước export; không sửa manifest artifact cũ.
- [x] Export lại toàn snapshot production vào `pw1-prod-20260917-classification-001`; schema/provenance receipt được kiểm tra. Chưa tuyên bố đối soát nghiệp vụ đầy đủ từng Customer/Order hoặc đo toàn bộ SKU được phục hồi.
- [ ] Kiểm chứng importer và database đích trước migration thật.

## Bổ sung 2026-09-17 — exporter 1.2.0: classification theo Store

Phần này thay trạng thái phiên bản 1.1.0 phía trên; các receipt và contract hash 27fbef7e… được giữ nguyên.

| Mã | Đã sửa | Ràng buộc còn giữ |
|---|---|---|
| EXP-05 | Bảng con như product_images, product_variants, order_details, plan_subscriptions có Store qua FK cha hoặc quan hệ polymorphic đã biết. `SOURCE_FIELDS_UNRESOLVED` được phát theo Store thay vì một diagnostic global cho toàn bảng. Report ghi `ownership` (Store, rule, bảng/ID cha). | Parent thiếu, model type chưa hỗ trợ hoặc Store trực tiếp khác Store của parent sinh `SOURCE_OWNERSHIP_UNRESOLVED` global. Không đoán tenant theo creator. |
| EXP-06 | Các field nguồn đã biết nhưng ngoài payload có `fieldRetentionRules` theo rule cụ thể: auth/session không replay, metadata User, lookup/history, ảnh SKU giữ CSV, trial ngoài payload, cấu hình shipping đã có quyết định PW2 và metadata COD. | Field lạ không tự chuyển thành retained; avatar User có dữ liệu nhưng chưa map vẫn unresolved. Retained-source nghĩa là CSV ngoài artifact, không phải đã migrate vào DB. |
| EXP-07 | `SUBSCRIPTION_CANCEL_FLAG_ABSENT` bổ sung reason `NO_CANCELLATION_DATE`: PW1 chỉ coi hủy ngay khi có cả canceled_at và flag=true. | Không tự ghi canceledImmediately=false; canceled_at có giá trị nhưng flag thiếu/không hợp lệ vẫn bị chặn. |
| EXP-08 | Manifest exporter 1.2.0 bắt buộc `classificationVersion=source-classification-v1`; validator kiểm ownership Store trùng row Store và field có retention rule phải thật sự retained-source. | Không sửa manifest của artifact cũ để giả thành bản mới. Importer phải hỗ trợ contract/version mới trước khi sử dụng. |

### Đối soát trực tiếp CSV về parent thiếu

Nguồn: snapshot production đang được chọn trong `.migration/source-selection-prod-followup.json`, chỉ đọc CSV.

- `model_has_roles`: **1** dòng trỏ `model_id=5753`, `model_type=App\\Models\\User`, nhưng không có User 5753 trong Users CSV.
- `model_settings`: **26** dòng loại PageComponent trỏ component không có trong snapshot; ví dụ ID 28/29/30 → component 6, ID 40/41/42 → component 10.
- `shortlist_items`: **4.749** dòng có page_component_id không tìm được parent; ví dụ ID 1159 → 1091, ID 1228 → 1181.
- `page_components.page_id`: không phát hiện FK có giá trị mà thiếu Page trong phép đối soát này.
- Không kết luận đây là lỗi DB production chỉ từ CSV; có thể là orphan hoặc snapshot không đầy đủ. Cần đối soát nguồn để phân biệt. Không tự xóa hoặc gán Store.

Bằng chứng local (ID/count, không nội dung/secret): `.migration/reviews/260917-classifier-source-parent-check.json`.

### Tương thích importer

Source `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-json/artifact.ts` hiện chỉ nhận exporter 1.0.0 với các hash 62cd… / 8aac…. Chưa nhận exporter 1.2.0/hash 27fb… hoặc metadata classification và hai reconciliation receipt. Không được nới schema tùy ý hoặc bỏ tất cả warning để chạy. Đây là đầu việc importer riêng; lượt sửa exporter này chưa thay đổi importer hay ghi DB.

### Kết quả chạy production 1.2.0

- Export hoàn tất sau khoảng 960 giây, exit 2 (`needs_review`), không phải lỗi script: 2.918 Stores nguồn, 2.799 emit, 118 block, 1 hoãn theo policy.
- Artifact 10 file, tổng 2.815.406.966 bytes. Có customer/product reconciliation và classification evidence.
- Toàn bộ 93 file trong manifest bằng bản trước; đối chiếu hash cả 186 CSV prod/dev với inventory trước đó: không file nào thay đổi. Hash user-actors.json giữ nguyên.
- Riêng Store 205: không còn source field unresolved có ownership=205; report có 1 blocker creator binding và 4 warning (cancel thiếu flag nhưng không có ngày hủy, site type theo policy, shipping PW2, loại secret DNS khỏi raw). Đây không phải kết luận Store 205 import-ready: còn diagnostic global và importer chưa tương thích.
- Global: 4.776 `SOURCE_OWNERSHIP_UNRESOLVED` (1 role + 26 settings + 4.749 shortlist), thêm 2 `SOURCE_FIELDS_UNRESOLVED` cho role/settings. Các quan hệ này không tự được miễn kiểm tra.
- Kiểm tra trực tiếp `inspectExportArtifact` của importer hiện tại trên artifact mới: **EXPORT_MANIFEST_INVALID**. Chưa chạy prepare/apply, không ghi DB.
- Regression 407 tests pass; bổ sung 6 test classification và 3 test artifact evidence pass. Test identity sửa helper để giữ reason và chạy lại pass. Tổng 416 test cases khác nhau; TypeScript pass. Logs: `.migration/logs/classification-{regression,focused-tests,artifact-tests,typecheck}.log`.
- Kết quả chi tiết local: `.migration/reviews/260917-classification-export-results.json`.
- **Validate-only trên artifact production hoàn tất:** `integrityStatus=valid`, `mappingStatus=needs_review`, exit 2; hash/schema/receipt checks pass. Log: `.migration/logs/classification-production-validation.log`. Exit 2 giữ nguyên vì còn blocker nghiệp vụ và nguồn, không phải artifact hỏng.

### RV-01 — đã sửa và review lại trước commit

Validator nay kiểm parent tồn tại/đúng Store, shape và danh sách rule, diagnostic global khi ownership lỗi, cycle và retention rule theo bảng/field; cả export lẫn validate-only dùng chung kiểm tra. Fixture đổi subscription sang Store khác nhưng giữ parent cũ bị từ chối, kể cả cập nhật hash report.

Snapshot commit: 429 tests / 29 files và TypeScript pass; review độc lập + 17 ca adversarial không còn finding. Artifact production hiện có validate lại **valid / needs_review**, không thay bytes hoặc số liệu. Chi tiết: [review trước commit](../../plans/reports/260917-pw1-exporter-precommit-review.md). Các gate importer/nguồn/business phía trên vẫn còn.
