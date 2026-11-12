# 05 — Summary coverage, test data và bằng chứng nghiệm thu

## Summary phải đếm cái gì

QC yêu cầu summary theo child run. Mẫu số phải lấy từ **source inventory + field registry đã pin version**, không lấy từ số row evidence đã ghi. Nếu thiếu cả một source entity, report vẫn phải đếm nó là `missing` hoặc `unverified` theo proof, không biến mất khỏi denominator.

Payload summary đề nghị gồm:

```text
childRunId, sourceStoreId, contractVersion, registryVersion,
sourceSnapshotId, targetVerifiedAt, evidenceState,
records: { expected, eligible, reconciled, match, mismatch, missing,
           duplicate, unsupported, unverified },
fields:  { expected, eligible, reconciled, match, mismatch, missing,
           duplicate, unsupported, unverified },
outsideScope: [{ entity, field, reasonCode, count }],
exceptions: { open, blocker, warning },
integrity: { inventoryDigest, evidenceDigest, complete }
```

Quy định `expected =` số field instances **thuộc registry QC và áp dụng cho source record trong snapshot** (có element key cho SKU/item/location), kể cả field `unsupported`. Mỗi expected instance có đúng một trong sáu status, nên `sum(sáu status) = expected`. `outsideScope` là breakdown của `unsupported`, **không trừ lần nữa khỏi expected**. Policy-excluded source records/fields cần một inventory count riêng ngoài expected và có lý do; không biến chúng thành `missing`. Nếu giữ `eligible`, định nghĩa nó là số expected không `unsupported`, không dùng nó làm mẫu số thay expected. Không gộp record và field counts. `reconciled` là match/mismatch/missing/duplicate có proof; `unsupported` được accounted nhưng không tính là match, `unverified` không được coi là đã đối soát.

## Fixture QC tối thiểu

Tách hai lớp bằng chứng, đều có namespace/marker và owner riêng. **Importer fixture** chạy exporter/importer/verify thật, chứng minh child run UUID và generation gắn với dữ liệu đã ghi. **Comparator contract fixture** tạo source/target/evidence test có kiểm soát để chứng minh đầy đủ sáu trạng thái; gắn nhãn synthetic và không dùng nó làm chứng nhận migration production. Nếu QC yêu cầu cả bảy tình huống trên **cùng một child run VERIFIED từ importer thật**, F42 và QC phải chốt một execution path staging-safe riêng: `verifyStore()` hiện chặn target projection sai hoặc thiếu trước khi run được `VERIFIED`. Mọi expected result được pin bằng fixture manifest version/checksum; không chỉ insert row evidence rồi coi như importer đã đối soát thật.

| Case QC | Cách dựng có kiểm soát | Expected evidence |
| --- | --- | --- |
| Product khớp hoàn toàn | Importer fixture với source snapshot và target Product/Variant đúng registry | Record/fields trong scope `match` |
| Product lệch giá | Comparator fixture có source/target canonical khác; hoặc rule nguồn độc lập phát hiện importer transform sai dù projection đã verify | Chỉ price `mismatch`; nếu sửa target trước importer verify thì run phải fail |
| SKU lệch stock | Comparator fixture cùng SKU/snapshot với target stock khác | SKU stock `mismatch`, có snapshot time và metric; không gọi post-verify drift là lỗi migration ban đầu |
| Product thiếu PW2 | Comparator fixture có source inventory eligible và target read thành công, xác nhận vắng | Product `missing`; importer fixture thiếu emitted Product sẽ không thể VERIFIED theo đường verify hiện tại |
| Duplicate mapping | Comparator fixture tạo hai target có **provenance cùng source** theo detector; không insert hai active claim trái unique ledger | `duplicate`, hai target identity server-side và reason code; cùng SKU/email đơn thuần chưa đủ proof |
| Order lệch total/status | Comparator fixture có Order target nhưng canonical total/status khác | Hai field `mismatch`; các field khác giữ status độc lập |
| Exception mở | Có `migration_exceptions` OPEN gắn run/Store | Summary exceptions đúng; không tự biến exception thành field mismatch nếu không có rule |

Nên bổ sung case `unsupported` và `unverified`, `null` hợp lệ, source empty đã xác minh, target read failure, drift sau verify, run/store không khớp và PII/secret không lọt ra API. Đây là điều kiện để chứng minh sáu trạng thái QC yêu cầu, vì bảy case ban đầu chưa có ví dụ riêng cho hai trạng thái cuối.

## Seed/reset và phạm vi an toàn

- Có lệnh seed/reset idempotent với marker sở hữu, chỉ chạy ở QC isolation được cấu hình; reset chỉ xóa dữ liệu do fixture tạo, theo thứ tự FK, và xác nhận ngoài phạm vi trước/sau không đổi.
- Không xóa toàn bộ `migration_runs`/`migration_entity_map` của staging chung. Nếu không cô lập được, dùng disposable clone hoặc execution path staging-safe khác được duyệt.
- Pin exporter artifact hash, importer revision, registry version, target schema fingerprint. Nếu đổi bất kỳ phần nào, tạo fixture generation mới; không tái sử dụng expected counts cũ.
- Bàn giao `sourceStoreId`, child UUID, batch ID chỉ để truy vết, trạng thái run/store, thời điểm verify, owner và seed/reset command. Không commit credential hoặc private artifact.

## Cấp độ test và exit criteria

1. Unit: canonicalizer/status/summary, sáu status, null/empty, aggregation, duplicate detector, privacy serializer.
2. Integration trên DB cô lập: importer fixture đi qua seed → import → verify → read evidence → reset → seed lại; comparator fixture kiểm anomaly/status trên read model riêng. Không trộn kết quả synthetic vào coverage của run thật. Kiểm child run, field counts, exception và hash deterministic; interrupt/resume không làm mất/nhân đôi evidence.
3. F40 API/E2E sau handoff: Super Admin chọn Store + child run và thấy đúng giá/stock/Order mismatch, trạng thái unknown và source label; không dùng demo để chứng minh kết quả thật.
4. Báo cáo kết quả thực thi: command, commit, schema/contract version, target identity đã làm mờ, fixture hash, child UUID, expected/actual counts, PASS/FAIL/NOT_RUN/BLOCKED. `[x] AUTO` trong tài liệu test design không đồng nghĩa đã PASS.

Exit: cả hai loại fixture chạy lại được, summary khớp expected counts và mọi trường nguồn trong registry được accounted; không có leak PII/credential; người sở hữu fixture và QC ký nhận **rõ loại evidence nào chứng minh UI contract, loại nào chứng minh run migration thật**.
