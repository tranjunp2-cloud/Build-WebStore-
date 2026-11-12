# Phase 01 — Khóa contract, inventory và chính sách QC

## Bối cảnh

**Owner:** F42 migration + F40 + QC/Product/Finance/Security. **Trạng thái:** Đang thực hiện, chưa đạt điều kiện ra phase. **Có thể bắt đầu ngay.** Đầu vào: [thiết kế đã duyệt](../reports/261009-1052-f40-commerce-reconciliation-design.md), [F42 field evidence](../260930-f42-f40-field-evidence/plan.md), [F40-14](../260910-commerce-settings-migration-reconciliation/plan.md).

## Đầu ra bắt buộc

1. **Contract vNext có version** cho hai tầng: `sourceCoverage` theo `(sourceInstance, snapshotId, sourceStoreId)` và `importFidelity` theo `(sourceStoreId, childRunUuid, generationId, snapshotId, targetInstance)`. Batch ID chỉ là tham chiếu. Mọi payload nêu `state`, `reason`, `asOf`, `provenance`, `contractVersion`, `registryHash` và mẫu số.
2. **Inventory/ma trận field Commerce** theo Product/SKU, Order, Discount, Customer: source table.field, target path hoặc không có, element identity, disposition, support, rule/transform/version, null/empty/array semantics, currency/unit/timezone, privacy, reason code, owner, mức bắt buộc và severity. Ghi cả field chưa migrate, không chỉ field đã có evidence.
3. **Chính sách mẫu số và kết luận:** toàn selected source trước lọc, importExpected của phần phải nạp, sáu status, outsideComparison/outsideScope/target-only, ngoại lệ được duyệt. Chốt `match/checked`, `match/importExpected` và meaningful match; không tái dùng tỷ lệ website 87% cho Commerce.
4. **Hợp đồng lỗi và bảo mật:** 400 input sai, 401/403 auth, 404 Store/run không thuộc nhau, 409 contract/version conflict, 503 source/generation unavailable; không fallback demo. Value allowlist, fingerprint HMAC không trả browser; Customer display chỉ cho Super Admin nếu verified F42 generation đã lưu theo contract được duyệt; secret không persist hoặc trả browser, giới hạn phân trang.
5. **Baseline staging và fixture:** một Source Store ID thật có child VERIFIED/generation COMPLETE/sidecar đã hash; một Store bị loại hoặc chưa emit; một synthetic comparator fixture được dán nhãn riêng. Ghi owner, target DB, revision, expected counts và cách reset an toàn. Không nạp dữ liệu vào shared staging khi chưa có đường chạy được duyệt.

## Việc thực hiện

1. Kiểm code F42 hiện có: `src/lib/migration/pw1-evidence/qc-field-registry.ts`, `comparator.ts`, `build.ts`, `ingest.ts`, `scripts/pw1-evidence-schema.js`; so registry với danh sách source fields được exporter ghi trước lọc. Liệt kê gap rule (cost, stock reserved/available/location, Order item SKU/refund, Customer identity, Discount time, v.v.) với owner và quyết định tạm thời `unsupported/unverified`.
2. QC/Product/Finance ký rule tiền/status/stock và danh sách required/exclusion. Không ép một field chưa có target tương đương thành match để đạt tỷ lệ. Chốt kỳ vọng Order aggregate theo status và cửa sổ thời gian.
3. F40 xác định DTO/endpoint dùng lại `GET /api/qa/migration-reconciliation` với `view=source_coverage|commerce_summary|commerce_records|commerce_fields` hoặc cơ chế tương đương có version. Khóa một phương án trong contract trước code; không duy trì hai nguồn tính summary ở client và server.
4. Chốt xử lý US-F40-11 AC-2 về remediation: Commerce chỉ hiển thị hướng dẫn đã review/link artifact. AC-2 giữ `BLOCKED` cho tới khi artifact SQL/Payload chính xác đã review đáp ứng AC gốc hoặc Product/QC ký thay đổi AC; giao cho inspector F40-11 riêng vẫn phải có owner, PR và test. Không thực thi SQL từ browser và không đóng F40-11 bằng hướng dẫn chung.
5. Cập nhật `docs/qa/F40-qa-control-center.md` và QA matrix F42 bằng TC-ID mới **trước khi tạo test**; đọc `docs/TEST_CONVENTION.md`. Khóa sample size/baseline thực, giải thích vì sao PRD 2.000 khác inventory F42 hiện tại nếu có.

## File dự kiến

| Thao tác | File | Mục đích |
| --- | --- | --- |
| Sửa | `src/lib/migration/pw1-evidence/qc-field-registry.ts` | Bổ sung metadata/rule sau khi được duyệt, version/hash mới nếu contract đổi |
| Sửa | `src/lib/admin/qa/f42-reader-contract.ts` | Pin version và DTO tương thích |
| Sửa | `docs/qa/F40-qa-control-center.md` | TC-ID/AC Commerce mới, tách website/Commerce/Settings |
| Tạo/cập nhật | Tài liệu contract trong `docs/migration/` | Baseline, policy, sample DTO, mã lỗi và owner |

## Điều kiện ra phase

- Có bảng field đầy đủ với support/rule hoặc lý do gap; QC ký mẫu số, policy và P0.
- Có fixture/provenance cụ thể hoặc ghi `BLOCKED` với owner/điều kiện tháo chặn; không giả định local proof là staging proof.
- Contract phân biệt source coverage, import fidelity, website QC và full cutover; bảo mật và lỗi đã review.
- Ước lượng lại Phase 02–06 theo số record/field và gap thực tế; không dùng estimate cũ làm cam kết lịch.

## Rủi ro

Thiếu source CSV/sidecar lịch sử hoặc chưa thống nhất policy importExpected là **blocker cho kết luận đầy đủ**, nhưng không chặn việc xây UI trạng thái thiếu evidence. Không thay đổi dữ liệu PW1/PW2 trong phase này.
