# Phase 04 — Customer, Discount và Settings

**Owner:** F42 migration + security reviewer. **Effort:** 4–7 dev-days. **Dependency:** Phase 01 registry/privacy, Phase 02 repository; chạy song song Phase 03. **Deliverable:** disposition đủ cho mọi field QC trong ba nhóm, không lộ PII/secret.

## Field matrix phải triển khai

| Nhóm | Evidence và rule | Khi không có proof |
| --- | --- | --- |
| Customer identity | Ledger source ID → target ID; name/email/phone chỉ equality qua HMAC có khóa riêng hoặc masked/aggregate; identity không dựa vào email string | `unverified` nếu không xác nhận được binding; không trả raw PII |
| Customer address | Address identity nếu nguồn/đích có stable key; count, role/default, vùng sau normalize; count bằng chưa đủ nếu identity khác | Nếu chỉ có count thì ghi rõ count-only; identity field `unsupported`/`unverified` |
| Discount | Code, type, value, starts/ends, status; timezone, currency/major-minor, status enum và inclusive/exclusive date rule versioned | Không suy Discount config từ Order discount snapshot |
| Profile | Từng setting vận hành ở Site/Tenant/User target, defaults/generated có transform code; PII masked | Raw `model_settings` archive không là target vận hành |
| Team | User identity và team membership/role/permission là evidence riêng; tenant/site isolation | User tồn tại không chứng minh membership khớp |
| Email template | Subject/status/content fingerprint canonical và safe metadata; không gửi HTML chứa secret/PII | Rule không có target tương đương: `unsupported`; rule có target nhưng thiếu mapping/read: `unverified` hoặc `missing` khi vắng mặt được xác nhận |
| Payment/Delivery/Domain/Integration | Registry row cho từng field QC, target path khi thật sự migrate; cấu hình vận hành chỉ compare data, provider readiness kiểm riêng | Chưa support `unsupported` có owner/reason, thiếu đọc/rule `unverified` |

## Steps

1. Audit source field thực tế trong bound artifact, receipt và mapper; xác nhận `source_only`, `archive_only`, excluded và operational. Phân biệt absence ở source với field không được export. Không dùng raw retained setting để báo `match` PW2.
2. Cài comparator theo registry và reusable reader; source/target IDs chỉ dùng server-side. HMAC cần key từ secret manager/env, domain separation theo field + key version; tránh unsalted checksum email/phone. UI DTO chỉ được masked hoặc thống kê theo allowlist.
3. Làm rõ transform enum/timezone/payment method/role; bất kỳ fallback/default nào phải ghi `transformCode`, source/target canonical và reason. Provider hoạt động, DNS, email sending, gateway credentials không được suy từ value equality.
4. Unit test pure normalizers: timezone boundary, null/empty, Discount fixed/percentage, membership source identity, address count vs identity, PII redaction. Integration: Store A không lấy Customer/User/Settings Store B; raw HTML/token không xuất hiện DB evidence, log hoặc API.
5. Ký support matrix với QC; mỗi field QC có exactly one disposition trong source inventory và summary. Bất kỳ field chưa triển khai vì product capability khác vẫn hiện `unsupported` có reason/owner, không biến mất.

## Acceptance

- Customer identity và address count có proof nhưng không raw PII; Discount code/type/value/dates/status được normalize theo đúng currency/timezone; Profile/Team/Email template có từng field rule.
- Payment/Delivery/Domain/Integration chưa support hiện rõ `unsupported`; dữ liệu có nhưng chưa thể đọc/compare hiện `unverified`; không báo pass runtime.
- Security review xác nhận DB rows, read DTO, logs, fixtures không có password/token/credential/PII thô. Key rotation/missing key xử lý fail closed; missing key không tạo `match`.
