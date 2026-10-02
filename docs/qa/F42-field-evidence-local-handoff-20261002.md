# F42 field evidence — bàn giao phép thử local 2026-10-02

## Kết luận và phạm vi

Đã chạy cùng một bộ CSV PW1 qua exporter → validator → importer → sidecar ingest → field evidence builder trên **clone PostgreSQL local**. F40 có thể đọc generation thực từ DB bằng Source Store ID số + child run UUID. Đây là bằng chứng kỹ thuật local cho contract F42; **chưa phải run staging QC, chưa phải QC Pass hoặc kết quả TC-MIG.01–10**. Không chuyển file CSV/sidecar private vào Git hoặc UI F40.

Sau khi đồng bộ commit upstream `459d089ce`, importer được nối để tự ingest/build evidence cho artifact có sidecar khi từng child trở thành VERIFIED. Run phía dưới được tạo bằng lệnh ingest/build riêng trước thay đổi này. **Một full CLI run mới trên clone `pw1_import_1886_evidenceauto_v26` đã PASS:** Store 189, child `94e5eab9-5a02-4785-b803-05a2eb02f8bc` VERIFIED, snapshot `417e10de-c6db-4949-809a-6e549bc100f6`, generation `67570725-2a66-4c5b-b0b3-9c504454afee` COMPLETE. Importer tự emit `SOURCE_EVIDENCE_INGESTED` và `EVIDENCE_COMPLETE`; 7.940 field có cùng phân bố status như bảng dưới, builder replay trả `reused=true`. Typecheck và 96 unit test migration liên quan PASS. Phép thử failure-resume và staging QC vẫn NOT_RUN.

Artifact export trên toàn snapshot có `integrityStatus=valid`, `mappingStatus=partial`: hai diagnostic global của `model_has_roles` vẫn cần xử lý/duyệt riêng. Store 189 được exporter phân loại `emitted`, `dataStatus=complete`. Không suy `partial` toàn snapshot thành Store 189 fail, cũng không suy Store 189 VERIFIED thành snapshot nguồn đã đạt QC Pass.

## Identity và checksum bắt buộc

| Thuộc tính | Giá trị local |
| --- | --- |
| Contract / registry | `field-evidence-v26` / `qc-fields-v1` |
| Registry SHA-256 | `6826817b930d4bd88269679bac2b121f1b6f66422839b6e8804a50fe6c8f5ebc` |
| Mapping version | `a5f311eea68c1aef772ee0c36962c7f17b088026d6d098a206c32f6e4306b2b1` |
| Source instance / snapshot | `PW1PROD` / `pw1-2026-10-01T08-16-57-469Z-f4453639` |
| Source snapshot as-of | `2026-09-18T00:00:00Z` |
| Export manifest SHA-256 | `2336f39ae4861fe894e4bc41b4d7241f512659d0b4bbabd353c2891ccd2ec919` |
| Sidecar SHA-256 / header | `a6ce2e294fc08893f5f169f7142e93e36430f5622ba1d9f19ccdb22c10686a92` / version 3 |
| Import manifest SHA-256 | `05e076d0efa00e272aad1485219acd07c1fdfd3788cca4e1d521580209effa32` |
| Source Store ID | **`189`** (số, không phải Batch ID) |
| VERIFIED child run UUID | `02f6e4f1-43d4-40f4-a786-0e6d096051d4` |
| Source evidence snapshot UUID | `bd8fedcf-fc29-4413-8367-04bb6a7cac71` (`exporter_sidecar`) |
| COMPLETE generation UUID | `6b4104f3-6f4d-4713-a63a-87ea9004aa88` |
| Generation digest | `5cb650a873887f779a41a5c2945a985cae8d895122d604da344aa08eb7d67ac1` |
| Importer verified_at | `2026-10-02T05:09:13.258Z` |
| Target | clone local `pw1_import_1886_evidencefull`, guard `local-evidence-full` |

Batch ID của workflow là khóa riêng trong importer, **không được đưa vào tham số `child_run_id` của F40**. Revision triển khai staging chưa có; worktree hiện ở upstream commit `459d089ce9b5b1dbade6ce28ae8d6f3fea4375e8` cộng thay đổi F42 evidence chưa commit, nên hash này **không phải deployed revision**.

## Coverage và kết quả thực

Toàn selected CSV: **93 bảng, 922.580 source record, 11.750.037 source field** được ingest vào DB theo snapshot bền vững. Store 189 có 525 source record / 7.719 source field trong inventory; 7.940 dòng field evidence gồm các field dẫn xuất bắt buộc. Store có 5 Product, 5 Order, 4 Customer, 1 Discount ở PW2. Summary trả 672 field key ngoài scope, 0 OPEN exception và `targetDriftCheck=not_run` (đối soát projection lúc verify).

| Trạng thái field trên Store 189 | Số dòng |
| --- | ---: |
| match | 180 |
| mismatch | 0 |
| missing | 0 |
| duplicate | 0 |
| unsupported | 7.715 |
| unverified | 45 |

Số `unsupported` lớn vì sidecar kiểm kê cả field PW1 ngoài scope và record exporter không emit. Ví dụ 27 Product/SKU nguồn bị lọc có `SOURCE_NOT_EMITTED`, không được gọi là PW2 `missing` hay `match`. F40 cần hiển thị disposition và lọc theo QC registry trước khi diễn giải parity; `recordCounts` không thay thế bảng field. Trên các record được emit của Store này: Product name/slug/status/category/weight/dimensions/image count và identity/currency, SKU/price/on_hand stock, Order code/currency/amount/status/payment method, Customer address count và normalized-email HMAC, Discount code/type/value/status đều có các trường hợp `match`. Order `total_tax` rỗng được so với PW2 0 theo `ORDER_TAX_EMPTY_AS_ZERO_EQUAL` (5 dòng). Bốn Customer email được đối soát bằng HMAC trim/lowercase, không trả địa chỉ thô.

Customer identity tổng thể, Discount start/end timezone, Settings Profile/Team, Order item SKU, refund/cancel và stock reserved/available/location vẫn `unverified` khi chưa đủ rule/bằng chứng. Order item total snapshot, Payment/Delivery/Domain/Integration chưa migrate trả `unsupported`. Stock hiện chỉ so `on_hand` theo SKU trên verified projection; không có kiểm live target drift sau verify.

Kiểm đọc DB theo `(source_store_id=189, run_id=<child UUID>, state=VERIFIED, contract=field-evidence-v26, provenance=exporter_sidecar)` trả đúng một generation trên. Cả 4 dòng Customer email có `source_display`, `target_display`, `source_normalized`, `target_normalized` đều null; hai fingerprint có giá trị. Chạy lại builder cùng input trả `reused=true` và cùng generation UUID / 7.940 field.

## Fixture synthetic riêng cho sáu trạng thái

Store `91886001`, child UUID `3b8776d7-dca3-481e-b431-eb16edac0aa8`, snapshot `83dd330f-14b1-4823-ad0e-b7435ab84c9a`, generation `e9a1cc2b-6f75-441c-b01f-8a2d6473cd3f`, `provenance_kind=synthetic_fixture`. Fixture có 99 field: match 22, mismatch 6, missing 5, duplicate 1, unsupported 22, unverified 43; một exception OPEN. Seed xác nhận Product khớp đủ 12 field, Product lệch giá, SKU lệch stock, Product thiếu có absence proof, duplicate target claims và Order lệch total/status. Lệnh reset/seed và điều kiện guard nằm trong [runbook](../runbooks/pw1-field-evidence-qc.md). Fixture này chỉ kiểm contract, không chứng minh lỗi tương ứng tồn tại trong dữ liệu PW1 thực.

## Gate đã chạy và gate còn lại

| Gate | Kết quả |
| --- | --- |
| TypeScript typecheck; comparator/source-sidecar unit; DB builder/ingest integration; `git diff --check` | PASS local |
| Export CSV thực, validator hash/coverage, importer child VERIFIED, ingest và builder trên **cùng artifact v26** | PASS local |
| Sidecar version 3, privacy Customer email, replay cùng generation, F40 SQL read theo Store + child | PASS local |
| F42 PR merge/deploy, migration schema trên staging QC, revision/target guard và Store-scoped authorization | NOT_RUN |
| Staging child VERIFIED + source snapshot DB + resettable fixture, owner có tên | NOT_RUN |
| F40 protected API/Studio UI/browser E2E và TC-MIG.01–10 | Thuộc deliverable riêng, NOT_RUN ở gói này |

`DATABASE_URI` trong `.env` của worktree hiện trỏ `localhost/primeweb`; workspace chưa có staging QC URI/secret reference và chưa có `.vercel` link. Vì vậy các UUID ở trên chỉ tồn tại trên clone local; **không dùng chúng như staging handoff**. Sau khi F42 được review/merge/deploy, operator staging phải chạy lại luồng theo runbook trên target staging được ủy quyền và ghi một bộ Store ID + child UUID + snapshot/generation + deployed revision + owner mới cho F40/QC. Contract/fixture local không tự chuyển trạng thái staging thành PASS.
