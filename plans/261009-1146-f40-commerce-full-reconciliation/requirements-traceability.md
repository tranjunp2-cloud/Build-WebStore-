# Ma trận truy vết yêu cầu Commerce

## Cách dùng

Mỗi hàng là một điều kiện phải được giải quyết, không tự đánh dấu PASS vì có code, unit test hoặc synthetic fixture. Người phụ trách **tạo một dòng kết quả cho từng ID và Store/fixture** theo [mẫu thực thi](execution-evidence-template.md): expected/actual, revision staging, Source Store ID, child run UUID (nếu có), snapshot/generation/digest, thời điểm, owner và link bằng chứng an toàn. Kết quả hợp lệ: `PASS`, `FAIL`, `NOT_RUN`, `BLOCKED`.

| ID / nguồn | Yêu cầu và output nhìn thấy | Phase | Phép kiểm/gate |
| --- | --- | --- | --- |
| DES-01; thiết kế đã duyệt | Thanh ngữ cảnh Store PW1, PW2, child UUID VERIFIED, snapshot/hash/as-of, generation/digest, version/provenance, target drift time; Batch ID riêng | 01, 04, 05 | Sai Store/run/namespace/version fail closed; đổi run nhanh không hiển thị response cũ |
| DES-02; F42 Phase 01/02/06 | Inventory toàn selected CSV trước lọc theo Store/entity/record/field; field disposition và record bucket là hai partition không chồng lấn, partial chỉ suy ra; security-excluded vẫn có count; unattributed tách riêng; blocked/deferred là chiều Store; Store không emit vẫn xem được; thiếu sidecar báo BLOCKED | 02, 04, 05 | Đối chiếu hash/counts từng bảng; `selected = tổng bucket` ở cả hai cấp và snapshot = tổng Store + unattributed; record lọc không bị gọi PW2 missing |
| DES-03; F42 Phase 05 | Mẫu số importExpected riêng; sáu status cộng đúng total ở cấp field và record; `unsupported/unverified` vẫn ở mẫu số; target-only riêng | 03–05 | SQL/assert độc lập trên fixture thật và synthetic; không làm tròn partial thành 100% |
| US-F40-14; #1839 | Toàn bộ lịch sử Product/SKU, Order, Discount, Customer; tổng PW1/PW2, từng status, lọc, tìm kiếm, phân trang, chi tiết PW1/PW2 theo record | 03–05 | E2E Super Admin chọn Store thật, đi từ tổng quan tới một record/field lỗi |
| US-F40-14 Commerce Phase 02 | Ma trận field-by-field cho toàn checklist PW1 Product/SKU, Order, Discount, Customer ở Phase 03 (kể cả localized content, brand/threshold, full Order finance/logistics, promotion applicability, customer spend); aggregate count/tổng tiền; PII an toàn | 01, 03–05 | Từng source table.column có target/disposition/rule/TC-ID/owner; support matrix được QC/Product/Finance duyệt; gap vẫn hiện `unsupported/unverified` |
| US-F40-11 AC-1/1a | Bảy nhóm page-scoped hiện có và lọc theo trang không bị thay bằng Commerce store-wide; SKU/field lỗi vẫn tìm thấy | 05–06 | Regression E2E `Soi CSDL 1-to-1`, page owner/shared entity, `Chỉ Lỗi` |
| US-F40-11 AC-2 | Remediation cho Dev theo bản ghi/field; **không đưa SQL thực thi tùy ý vào Commerce UI** | 01, 05–06 | `BLOCKED` đến khi artifact SQL/Payload chính xác đã review đáp ứng AC gốc, hoặc Product/QC phê duyệt đổi AC; hướng dẫn chung không được PASS hoặc đóng F40-11 |
| TC-F40-14-01–04 | Không đoán match từ SKU/email/order code; adapter versioned; Super Admin, run đúng Store; staging manual TC-14-04 | 04–06 | API/E2E và manual staging với child UUID VERIFIED; `[ ] MANUAL` chỉ chuyển khi có bằng chứng |
| TC-F40-MIG-LIVE-08 | Không fallback synthetic/run cũ; coverage tính cả unsupported/unverified; browser lọc field; không lộ dữ liệu riêng tư | 04–06 | Chạy browser thật với DB fixture đúng contract; test skip không tính PASS |
| DES-04; F42 Phase 03/05 | `missing` cần target absence proof; `duplicate` cần hai claim cùng provenance; read failure là unverified; drift hiện tại khác import-time | 03–06 | Fixture negative và target drift sau verify; importer VERIFIED không bị viết lại |
| DES-05; bảo mật | API chỉ Super Admin, Store/tenant/run/snapshot binding; limit/cursor; allowlist giá trị. Customer name/email/phone/address chỉ hiện nếu generation F42 đã lưu display theo contract được duyệt; không trả fingerprint, secret, URL riêng tư, SQL/HTML | 04–06 | 401/403, sai Store 404, version 409, source thiếu 503; kiểm response/log với canary và quyền Customer |
| DES-06; quyết định QC | Nhóm lỗi/gap/exception/drift có reason, owner, next action; trạng thái `Có lỗi / Chưa đủ bằng chứng / Đủ bằng chứng để QC` | 01, 05–06 | Dữ liệu partial không Pass; Website QC thủ công không đổi kết quả Commerce |
| TC-MIG.03 | Product/Variant/SKU, giá, stock, category không mất/sai trong scope ký; không miễn P0 bằng aggregate ≥99% | 03, 06 | Sample thật và coverage toàn scope; QC ký expected/actual |
| TC-MIG.01–02, 04–10; Phase 10 | Read-only PW1, batch inventory, content/media, visual/theme/mobile, SSO/SEO, chặn P0/cutover là gate **ngoài** Commerce | 06 và các plan liên quan | Matrix full F40 riêng trên cùng staging revision; không gọi Commerce ready là cutover ready |
| US-F40-14 Settings | Settings vẫn có plan/owner riêng; Commerce không hoàn tất toàn bộ US-F40-14 | Kế hoạch F40-14 | Theo dõi độc lập Profile/Team/Email/Payment/Delivery/Domain/Integration |

## Quyết định cần ký ở Phase 01

1. Danh sách field/record lịch sử **bắt buộc import**, được phép giữ lại/loại và severity P0/P1 theo chính sách; mẫu số nguồn và importExpected.
2. Rule tiền, currency, rounding, tax/shipping/refund; status Order/payment; stock theo SKU/location/metric/time; timezone Discount.
3. Cách xử lý US-F40-11 AC-2: hướng dẫn khắc phục đã review và link artifact script an toàn, hoặc ghi thay đổi AC được Product/QC phê duyệt. Không render hoặc thực thi SQL tùy ý trong browser.
4. Một fixture Store thật và staging revision/owner; chính sách kết luận Commerce khi field bắt buộc còn `unsupported/unverified`.
