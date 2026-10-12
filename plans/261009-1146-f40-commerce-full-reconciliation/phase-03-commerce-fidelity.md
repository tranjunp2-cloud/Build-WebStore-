# Phase 03 — Hoàn thiện độ đúng Commerce và drift

## Bối cảnh

**Owner:** F42 migration/domain + Product/Finance/QC. **Trạng thái:** Pending. **Gate:** Phase 01; F42 child run VERIFIED, sidecar/snapshot hợp lệ; Phase 02 cho kết luận toàn nguồn. Kết quả importer lúc verify và trạng thái PW2 hiện tại là hai phép kiểm khác nhau.

## Đầu ra bắt buộc

- Summary **record và field riêng** theo Product/SKU, Order, Discount, Customer; mẫu số importExpected, sáu status cộng đúng mẫu số; disposition nguồn, ngoài comparison, ngoài QC registry, exception OPEN và target-only anomaly riêng.
- Field evidence gồm source/target identity, element key, path, status, reason, transform/version, value hiển thị an toàn, unit/currency/timezone, snapshot/verified/target-read time và provenance.
- Money rule và Order aggregates theo status/date window; stock theo SKU, location/metric/time nếu có proof. Field không có source/target/rule tương đương giữ `unsupported/unverified` cùng owner; không “đóng” gap bằng default.
- Phép đọc PW2 **hiện tại** có timestamp/revision để phát hiện drift; generation import-time bất biến. Nếu chưa chạy, UI trả `Chưa kiểm tra PW2 hiện tại`.

## Việc thực hiện

1. Mở rộng registry và comparator dựa trên **ma trận từng source table.column → target path/disposition/rule/test** của Phase 01, bao gồm cả field chưa có PW2 tương đương. Checklist tối thiểu từ F40-14 cũ:
   - Product: localized name/description, status, category/brand, package dimensions/weight, stock threshold; từng SKU/variant có price/cost/stock/status; image identity/order và attribute values.
   - Order: order/customer snapshot, từng detail item/SKU/quantity/unit price; status history, shipping/billing address, provider/tracking, currency, invoice/delivery date, promotion, subtotal/discount/shipping/tax/prepaid/balance/total, payment/purchase/refund status và notes.
   - Discount: promotion/voucher code/type/value/status, schedule với timezone, max/min/limit rule, usage và SKU applicability qua bảng join.
   - Customer: identity/name/email/phone/note/rank, address fields, first/latest order, order count/spend nếu nguồn có; fingerprint HMAC không trả browser, Customer display chỉ cho Super Admin khi evidence F42 đã lưu theo contract được duyệt.
   - `id`, foreign key và audit timestamps có section Audit có thể thu gọn; credentials bị loại theo policy bảo mật có reason. Mỗi gap trong checklist phải có TC-ID, owner và trạng thái `unsupported/unverified` hoặc exclusion được ký; không bỏ field khỏi mẫu số chỉ vì comparator chưa hỗ trợ.
2. Chỉ `missing` sau target read thành công trong phạm vi import đã xác nhận; `duplicate` khi hai target claim có cùng provenance source; read failure/unknown rule là `unverified`. Không suy từ cùng SKU, email, mã đơn hoặc hai giá trị rỗng. Record exporter loại/giữ lại không bị tính missing PW2.
3. Dùng Decimal hoặc chuỗi integer minor unit cho tiền; chốt major/minor, currency, rounding, null/zero, overflow, tax/shipping/refund theo từng field. Order tổng hợp count/amount theo status và cửa sổ thời gian đã ký; không tính từ catalog giá hiện tại. Stock tách `on_hand/reserved/available/location` và snapshot time; không lấy stock tổng Product thay SKU.
4. Builder chứng minh mỗi expected field instance có đúng một status; `fieldCounts` và `recordCounts` nhất quán với source/import inventory, digest/replay ổn định. Bổ sung batch target reader/drift riêng, có tenant guard, bounded query, target read state `present/absent/read_failed/unsupported`. Không sửa `verifyStore()` để tạo lỗi giả trên real run.
5. Ghi support matrix từng field và gap owner. Chạy synthetic fixture đủ sáu status, absence, duplicate, price/stock/Order mismatch; chạy một artifact thật exporter→importer→builder trên clone với cùng snapshot; hai loại fixture luôn dán nhãn riêng.

## File dự kiến

| Thao tác | File | Mục đích |
| --- | --- | --- |
| Sửa | `src/lib/migration/pw1-evidence/qc-field-registry.ts`, `comparator.ts`, `build.ts` | Rule, summary, proof và generation |
| Tạo nếu cần | `src/lib/migration/pw1-evidence/target-drift.ts` | Đọc PW2 hiện tại, không sửa generation lịch sử |
| Sửa nếu cần | `scripts/pw1-evidence-schema.js`, `scripts/db-setup.js` | Lưu target-read/drift proof bằng DDL additive |
| Sửa | `docs/qa/F42-field-evidence-local-handoff-20261002.md` hoặc tài liệu handoff mới | Expected/actual, registry/version, gap và fixture provenance |

## Kiểm chứng và điều kiện ra phase

- Mỗi field trong inventory source có target/disposition/rule/TC-ID/owner; mọi exclusion phải được QC/Product/Finance ký với reason. Mỗi field QC bắt buộc có kết quả có proof hoặc explicit `unsupported/unverified`; tổng sáu status bằng importExpected, không loại gap khỏi mẫu số. Aggregate Order đối chiếu độc lập với snapshot/target.
- Ca Product nhiều SKU, Order nhiều item, giá sai, stock sai, status sai, missing, duplicate, target read failure, tamper snapshot, cùng currency khác value và cùng amount khác currency có expected status/reason rõ.
- Drift sau verify hiện riêng, không biến importer VERIFIED lịch sử thành sai hoặc tự refresh generation cũ.
- Privacy scan DB/API/log với canary; chỉ Customer display theo contract đã duyệt mới được hiện cho Super Admin, không trả secret hoặc PII ngoài allowlist. Chưa có rule Product/Finance/QC ký thì giữ trạng thái chưa chứng minh và chặn gate tương ứng.
