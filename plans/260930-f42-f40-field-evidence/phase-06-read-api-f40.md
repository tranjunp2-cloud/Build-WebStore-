# Phase 06 — Read API bảo vệ và F40 inspector

**Owner:** F42 API + F40 UI. **Effort:** 5–8 dev-days tổng (có thể song song). **Dependency:** DTO Phase 01; DB generation Phase 02/05 cho real integration. **Deliverable:** QA xem đúng child run/field từ DB, phân trang/filter, nguồn rõ ràng.

## Read contract v1

Read-only server endpoints/provider (tên route do F42/F40 chốt):

1. `GET runs?source_store_id=<numeric>`: chỉ child runs của Store, state, snapshot/version, batch ID có nhãn riêng. Run selector chỉ cho VERIFIED + available evidence hoặc hiện reason chưa sẵn sàng.
2. `GET runs/<child_uuid>/summary?source_store_id=...`: evidence generation state, record/field totals và counts, outside-scope, exceptions, provenance/digest.
3. `GET runs/<child_uuid>/records?source_store_id=...&entity=...&status=...&cursor=...&limit=...`: keyset pagination, stable order `(entity,sourceId,recordKey)`, bounded limit và opaque next cursor.
4. `GET runs/<child_uuid>/records/<opaque_id>/fields?source_store_id=...&cursor=...`: `sourceField`, `targetField`, `elementKey`, status/reason, transform/unit, safe normalized display, snapshot/target read times. Không trả raw artifact/SQL/HTML/secret.
5. `GET export-coverage?source_snapshot=...&source_store_id=<numeric>`: safe totals và dispositions của **toàn bộ selected CSV source** (emitted, retained/excluded, unresolved, blocked/deferred), reason/owner và linked child UUID nếu có. Store không emit không có run selector; UI vẫn phải cho QC xem lý do không nạp. Response nêu rõ source snapshot/hash và trạng thái proof, không trả raw CSV.

Mọi read kiểm Super Admin/QC allowlist, child UUID format, numeric Store ID, run/store/source instance/target binding, `VERIFIED` + generation state/version. `404` cho Store/run không khớp; `409` incompatible contract; `503` hoặc typed not-ready cho generation đang build/unavailable; định nghĩa schema lỗi cố định. Route `dynamic='force-dynamic'`, `maxDuration<=60`, validation bounded, audit actor/run/Store không PII. Nếu env mới, thêm placeholder vào hai `.env.*.example`.

## F40 adapter và UI

- Mở `src/lib/admin/qa/migration-reconciliation.ts` provider từ `{scope,storeId}` thành `{scope,sourceStoreId,childRunId,cursor,filters}` với backward-compatible demo/unavailable behavior; thêm summary field vs record, version/provenance, reasonCode, elementKey và generation state. Không bỏ sanitizer: cập nhật allowlist từng field qua security review, giữ masked PII/opaque IDs. `ReconciliationEntity` thiếu SKU/order item; v1 dùng nested elementKey + drill-down nếu Phase 01 chốt như vậy.
- `src/app/api/qa/migration-reconciliation/route.ts` đang nhận `scope/store_id/demo` và trả toàn snapshot; chuyển real path sang child UUID + paginated read, validate store numeric cho real mode. Demo hiện được bật bằng `demo=1` cho Store bất kỳ; nếu chốt cô lập vào fixture `SITE-0001` thì sửa contract/test hiện có trong cùng PR. Dù chọn cách nào, nhãn synthetic phải rõ; real API lỗi thì không fallback demo/catalog.
- `ReconciliationInspector.tsx` hiện client-filter và slice `PAGE_SIZE=25` từ toàn snapshot; thay bằng server filter/keyset pages, cursor state và total từ DB. `MigrationDiffClient.tsx` fetch theo Store+run; thêm stale-request guards/AbortController để đổi Store/run/filter không render response cũ. Có loading, no evidence, partial, unsupported, permission error và source label.
- Giữ hành vi TC-F40-11-07–10: `Chỉ Lỗi` query/filter theo **field attention** dù record rollup là match; hai giá trị rỗng/null hiển thị `matched_empty` hoặc attention theo rule, không là `matched_value`; Product nhiều SKU giữ element key và primary SKU deterministic; demo `SITE-0001` chỉ là fixture UI. Nếu endpoint demo hiện cho Store khác, sửa route/provider và regression test theo contract fixture trước khi bàn giao QC.
- US-F40-11 AC-1/1a/2 ở bảy nhóm (Products, Variants, Banners, RichText, Menus, Categories, Shop Settings), page-scoped counts và Dev Remediation phải được giữ qua adapter hiện hữu hoặc kiểm ở Phase 10. Read-only UI chỉ hiển thị remediation được allowlist/review; không thực thi SQL/Payload script trong browser. Target-only PW2 anomaly được hiển thị riêng, không cộng vào sáu status source-scoped.
- UI: selector Store + child run; summary hai mẫu số, sáu status, field table PW1/PW2 safe values, transform/reason, stock metric+location+snapshot, money unit/currency, Order total/status, exception links, version/verifiedAt. Không hiển thị `complete` như QC Pass.
- UI trước tiên cho QC chọn Source Store ID số để xem **Export coverage** của nguồn, kể cả Store blocked/excluded. Nếu Store có emitted/imported run thì cho chọn child UUID và mở **Import fidelity** theo sáu status; hai tầng có mẫu số/nhãn riêng. Thiếu CSV snapshot khiến tầng export báo BLOCKED/unverified, dù run fidelity có thể complete.
- `/api/qa/migration-diff` hiện `scan_batch` trả count cố định, `approve_pass` success không persist, và `catalog_fixture` fallback khi PW1 lỗi. Trong real mode: triển khai backend thật có audit/persist/gate **hoặc** vô hiệu hóa actions và gắn `unavailable`; không cho chúng cấp pass/cutover. Gắn nhãn fixture source rõ và bảo đảm outage không biến thành mock data.

## Acceptance/test

- API: authz 401/403, malformed/mismatched Store-run 400/404, batch ID rejected, non-VERIFIED/not-ready fail closed, incompatible version 409, bounded cursor tamper rejected, no cross-Store leakage, no PII/secret in serialized body/log.
- Export coverage API: Store không emit trả disposition/reason an toàn và **không tự tạo child run**, manifest/report/CSV hash mismatch fail closed; cùng source snapshot và Store không bị trộn với run snapshot khác.
- Browser Playwright trong `tests/studio-migration-diff.spec.ts` hoặc file `tests/*.spec.ts` mới: Super Admin chọn fixture Store + **child UUID**, lọc mismatch Product price/SKU stock/Order total-status, mở fields, đổi run nhanh không thấy stale data, xem unsupported/unverified và source label; demo rõ, unauthorized blocked. Đây là real browser flow, không mocked unit thay thế.
- Regression E2E/query: `Chỉ Lỗi` vẫn thấy field lệch trong record rollup match; đổi page tab chỉ thấy record thuộc page và shared entity xuất hiện ở mọi page chủ sở hữu; filter/pagination trả count nhất quán; `SITE-0001` demo không bao giờ được gắn nhãn real run.
- Add TC IDs `[ ] AUTO` trước test vào `docs/qa/F40-qa-control-center.md`; AAA, import source, mocks top-level theo `docs/TEST_CONVENTION.md`. Không xem existing demo E2E là bằng chứng DB real.
