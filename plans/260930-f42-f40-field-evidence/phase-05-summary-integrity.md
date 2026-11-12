# Phase 05 — Coverage summary, duplicate, drift và integrity

**Owner:** F42 backend/DB. **Effort:** 3–5 dev-days. **Dependency:** Phase 02; hoàn tất sau comparator 03–04. **Deliverable:** summary/digest có thể kiểm toán, sáu status đầy đủ.

## Mẫu số và công thức

Từ source inventory + registry pin version **và importer profile/execution scope**, tạo một expected instance cho mỗi `(sourceEntity, sourceId, ruleId, elementKey[, outputPath])` áp dụng. Record expected gồm source record thuộc QC scope. Giữ count `policyExcluded` và `notInRunScope` riêng; full Commerce gate phải từ chối foundation/users-only child run dù nó `VERIFIED`. Mỗi expected instance có **một** status; `sum(match,mismatch,missing,duplicate,unsupported,unverified) = expected` ở cả record và field. `outsideScope` là breakdown của `unsupported`, không trừ lần nữa. `eligible = expected - unsupported`; `reconciled = match + mismatch + missing + duplicate` có proof; `unverified` không là compared/pass. Summary phải có expected, eligible, reconciled, per-status counts, exception counts và inventory/evidence digest.

Giữ **hai tầng summary tách biệt**: `sourceRowTotal/sourceFieldTotal` từ source sidecar tạo trước lọc, đối chiếu selected CSV/report, được phân hoạch theo disposition `mapped/partial/retained-source/excluded/unresolved`; `sourceStoreTotal` được phân hoạch riêng thành emitted/blocked/policy-excluded theo manifest. Không cộng Store count vào row/field count, cũng không cộng nhiều diagnostic của một row nhiều lần. `importExpected` chỉ gồm field/record phải được nạp từ emitted master. Sáu status trên áp cho `importExpected`; export disposition nằm ở summary nguồn riêng. `missing` PW2 không áp cho record có chủ đích không emit. QC không cần CSV; nếu sidecar không tồn tại/không khớp manifest và CSV gốc cũng đã mất, không công bố full source field-value parity, hiện `unverified/BLOCKED` và giới hạn run summary là emitted-only. Không lấy `migration_entity_map` làm source denominator.

QC parity ≥99% cần **mẫu số được ký riêng** theo entity/field: mặc định `match / expected` và `unverified`/`unsupported` không được tự loại khỏi mẫu số để làm đẹp tỷ lệ. Chỉ các policy exclusions được QC duyệt trước, có count/reason/owner, mới được loại; báo song song `match/expected`, `match/eligible`, `meaningfulMatch/expected` và coverage để tránh cách hiểu mơ hồ. Không suy QC Pass từ tỷ lệ aggregate khi còn P0 blocker.

## Duplicate/anomaly detector

1. Định nghĩa target provenance nguồn được xác minh: target marker, imported source key, hoặc crosswalk độc lập có bảo đảm identity; detector lưu target IDs, source ref, detector version và evidence references an toàn. `migration_entity_map` unique active source claim nên không thể biểu diễn hai active target bằng cách đếm row ở đó.
2. Nếu hai target cùng SKU/email nhưng không có provenance same-source, không gắn `duplicate`; ghi `unverified:DUPLICATE_CHECK_UNAVAILABLE` hoặc `AMBIGUOUS_BUSINESS_KEY` đúng rule.
3. Một source có hai verified target → anomaly `duplicate` và record status theo precedence. Field status có thể `duplicate` nếu identity không xác định được target duy nhất; không gắn tất cả field `mismatch` tùy tiện.
4. Target-only/orphan ở PW2 cần bounded target inventory theo tenant/store và provenance (hoặc ghi `unverified` nếu không thể chứng minh phạm vi); lưu count/list riêng ngoài mẫu số source-scoped. Không ánh xạ orphan thành `missing`, `duplicate` hay cộng vào sáu status của F42. F40-11 giữ hiển thị `orphan_in_pw2` tương thích.

## Generation integrity và drift

- Header pin `sourceSnapshotChecksum`, registry/rule hashes, target read revision/checksum và producer SHA. Compute deterministic canonical digest theo order cố định; cùng input/rule/target read cho cùng digest. Check run/store/target binding và summary before atomic `COMPLETE`.
- Builder có thể thất bại vì artifact unavailable, target read timeout hoặc key missing; giữ importer run `VERIFIED` và publish `PARTIAL/UNAVAILABLE` với safe reason, không xóa/corrupt old generation. F40 hiển thị trạng thái này là chưa xác minh, không fallback fixture.
- So `targetReadAt` với importer `verifiedAt`; nếu target đổi sau đó, giữ historical evidence, tạo current-state generation hoặc `unverified` reason `TARGET_DRIFT` theo rule. Không âm thầm rewrite row cũ.
- Exceptions `migration_exceptions` OPEN/count/severity là summary riêng, không tự đổi status field nếu không có rule/proof. QC gate chặn exception blocker tùy policy.

## Test và acceptance

- Test whole source entity bị bỏ sót vẫn tăng `expected`/`unverified` hoặc `missing` theo proof; unsupported được tính đúng; excluded không làm tăng denominator; sum invariant bị violation thì generation không complete.
- Test source record đã bị exporter lọc: tăng export coverage denominator và disposition tương ứng, **không** tăng importExpected/missing PW2; Store bị blocked không có run vẫn hiện ở export coverage. Test master/ledger-only không thể báo full source coverage.
- Test duplicate có provenance và business-key-only negative; target read failure vs confirmed absent; drift/new generation immutability; two concurrent writers; retry/resume; summary pagination không làm đổi total.
- Expose query kiểm digest/count từ DB clone và kết quả fixture expected/actual. Ghi version của record precedence để F40 không tự tính lại.
