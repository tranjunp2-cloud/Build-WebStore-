---
title: Thiết kế đối soát Commerce F40
date: 2026-10-09
status: concept-approved
scope: full-selected-pw1-source
---

# Thiết kế đối soát Commerce F40

## Tóm tắt

Phương án đã duyệt: đối soát Commerce theo ba tầng bằng chứng: **(1) độ phủ toàn bộ nguồn PW1 đã chọn trước khi exporter lọc, (2) độ đúng của phần dữ liệu cần import, (3) quyết định QC riêng**. Người dùng đã đồng ý với hướng này và phạm vi toàn bộ nguồn trước lọc ngày 2026-10-09. Đây là thiết kế, chưa phải bản triển khai hoặc quyết định cutover.

Với một Source Store ID PW1 dạng số, tester phải trả lời được: lịch sử Product/SKU, Order, Discount và Customer có những bản ghi nào; bản ghi nào được giữ lại ở nguồn, loại theo chính sách, xuất để import, map, thiếu, lệch, trùng, chưa hỗ trợ hoặc chưa xác minh; bằng chứng và quy tắc nào hỗ trợ từng kết luận; còn thiếu gì trước khi Commerce được QC chấp nhận.

## Bối cảnh và hiện trạng

- PRD F40 §10 và US-F40-11 ban đầu yêu cầu so sánh field PW1/PW2 1:1, phát hiện mất biến thể, sai giá và tồn kho. Inspector bảy nhóm theo trang khác với đối soát toàn bộ lịch sử Commerce của store.
- US-F40-14 mở rộng sang Product, Order, Discount và Customer. Thiết kế yêu cầu số liệu theo thực thể, lọc lỗi, bản ghi phân trang, chi tiết PW1/PW2 và tổng hợp tài chính. Các phase trong `plans/260910-commerce-settings-migration-reconciliation/plan.md` vẫn được đánh dấu pending.
- `FieldEvidencePanel` hiện có độ phủ field, tỷ lệ khớp trong phần đã kiểm tra, sáu trạng thái, giá trị an toàn, mã lý do và phiên bản evidence. `ReconciliationInspector` hiển thị mapping bản ghi và issue từ ledger. Mapping xác nhận định danh, chưa chứng minh giá trị nghiệp vụ khớp.
- Summary generation F42 đã lưu inventory nguồn và `sourceFieldsOutsideRunComparison`; F40 hiện chỉ đọc một phần. Reader chọn child run `VERIFIED` mới nhất và generation `field-evidence-v26` ở trạng thái `COMPLETE` trong phạm vi nguồn/đích đã chứng minh. Builder hiện ghi `targetDriftCheck: not_run`.
- Tỷ lệ field Commerce chỉ tính các dòng registry QC đã ghi; `unsupported` và `unverified` vẫn ở mẫu số. Riêng tỷ lệ này không chứng minh đã bao phủ toàn nguồn PW1 được chọn hoặc PW2 hiện tại vẫn khớp.

## Phương án đã cân nhắc

| Phương án | Lợi ích | Giới hạn | Quyết định |
| --- | --- | --- | --- |
| Chỉ cải thiện UI | Nhanh, giải thích rõ số liệu đang có | Không chứng minh được nguồn bị lọc, trạng thái PW2 hiện tại hoặc tính đầy đủ của Commerce | Không chọn làm giải pháp cuối |
| Thay toàn bộ evidence và UI một lần | Có thể bàn giao một luồng hoàn chỉnh | Rủi ro tích hợp/staging cao; khó xác minh provenance và mẫu số theo từng bước | Không chọn |
| Bàn giao lần lượt ba tầng bằng chứng | Mỗi kết luận có nguồn, mẫu số và gate rõ; kết quả từng phần vẫn dùng được | Cần F42, F40 và QC phối hợp qua nhiều đợt | **Chọn** |

## Thông tin cần hiển thị

### 1. Thanh ngữ cảnh

Hiển thị Source Store ID dạng số, định danh site PW2 an toàn, UUID child run và thời điểm `VERIFIED`, ID/thời điểm/hash snapshot nguồn, ID/digest/trạng thái generation, phiên bản contract/registry/rule, provenance và trạng thái/thời điểm kiểm tra PW2 hiện tại. Batch ID phải có nhãn riêng, không dùng thay child run ID. Chỉ cho chọn run lịch sử khi run được liên kết an toàn với snapshot; mặc định chọn child run `VERIFIED` hợp lệ mới nhất. Evidence cũ, sai version hoặc không sẵn sàng phải có trạng thái rõ.

### 2. Hai mẫu số và hai phần tổng quan

**Độ phủ nguồn PW1 đã chọn:** tổng record và field chụp trước khi exporter lọc, theo Product/SKU, Order, Discount, Customer và disposition: đã xuất, giữ lại ở nguồn, loại theo chính sách, chưa giải quyết, bị chặn/tạm hoãn. Hiển thị lý do chính sách và người phụ trách. Record nguồn không được xuất không tự động là record PW2 bị thiếu. Nếu không có CSV/sidecar chứng minh nguồn, tầng này báo `BLOCKED` hoặc chưa xác minh dù child run phần đã xuất là `VERIFIED`.

**Độ đúng phần cần import:** tổng record/field kỳ vọng từ run đã liên kết; số khớp, khác, thiếu, nhân đôi, chưa hỗ trợ, chưa xác minh; exception mở; bất thường chỉ có ở PW2 được báo riêng. Hiển thị ba tỷ lệ với tên mẫu số rõ: `đã kiểm tra / kỳ vọng`, `khớp / đã kiểm tra`, `khớp / kỳ vọng`. Không dùng 100% làm kết luận chung khi còn field chưa hỗ trợ/chưa xác minh hoặc nguồn nằm ngoài lần so sánh. Không cộng lẫn số field, record và inventory nguồn.

### 3. Khu vực điều tra theo thực thể

Các tab: **Tổng quan, Products/SKU, Orders, Discounts, Customers**. Mỗi tab có tổng nguồn PW1, tổng kỳ vọng import, tổng đã map PW2, số theo sáu trạng thái, exception mở và nguồn ngoài lần so sánh. Lọc theo trạng thái, mục cần chú ý, disposition export, thời gian/snapshot khi có nghĩa, định danh/văn bản an toàn. Phân trang có giới hạn và thứ tự ổn định ở server để chịu được dữ liệu nhiều store.

Mỗi dòng thể hiện bản ghi nguồn, định danh đích đã xác nhận hoặc việc thiếu đích đã chứng minh, trạng thái tổng hợp, lý do ngắn và độ mới của bằng chứng. Field lỗi vẫn phải tìm thấy dù trạng thái record tổng hợp là khớp. Mở dòng xem field và quan hệ: giá trị PW1/PW2 an toàn, đường dẫn field nguồn/đích, element key cho SKU/order item, kiểu/đơn vị chuẩn hóa, mã/phiên bản transform, trạng thái/lý do, thời điểm snapshot nguồn, thời điểm đọc/verify đích và exception liên quan. Không trả PII thô, secret, URL riêng tư, HTML tùy ý hoặc SQL sửa lỗi có thể thực thi.

### 4. Quy tắc so sánh Commerce

- **Product/SKU:** sự hiện diện và định danh; tập SKU/variant, thuộc tính; tên/slug/status; giá bán/currency; tồn kho `on_hand` theo SKU; định danh danh mục; định danh/thứ tự ảnh nếu thuộc scope; cân nặng/kích thước. Giá vốn, `reserved`, `available`, location ghi chưa hỗ trợ/chưa xác minh cùng lý do cho đến khi chứng minh được nguồn, đích, thời điểm và quy tắc tương đương.
- **Order:** định danh và tập line item/SKU; số lượng; currency; subtotal, discount, shipping, tax, total; trạng thái đơn hàng/thanh toán/fulfilment/refund khi thuộc scope. Hiển thị số đơn và tổng tiền theo trạng thái/khoảng thời gian được duyệt, dùng mapping trạng thái có phiên bản và quy tắc tiền Decimal/đơn vị nhỏ nhất. Không tính lại đơn lịch sử bằng giá catalog hiện tại.
- **Discount:** mã, loại/giá trị, trạng thái, giới hạn sử dụng, lịch hiệu lực/múi giờ và phạm vi áp dụng khi có bằng chứng.
- **Customer:** định danh, địa chỉ và quan hệ bằng bằng chứng đã che hoặc HMAC an toàn; API/danh sách không có dữ liệu cá nhân thô. Email trùng không chứng minh hai record là một.
- Chỉ kết luận `missing` khi phạm vi import và định danh đích được chứng minh, đồng thời đọc đích thành công nhưng vắng dữ liệu. `duplicate` cần hai target claim có provenance chung từ nguồn. Lỗi đọc hoặc thiếu rule là `unverified`, không suy thành khớp hay lệch.

### 5. Mục cần xử lý và kết luận

Gom sai lệch chặn nghiệm thu, field bắt buộc chưa hỗ trợ/chưa xác minh, nguồn ngoài lần so sánh, exception mở và drift PW2 hiện tại thành các nhóm riêng. Mỗi mục cần lý do, thực thể/field, số lượng, mức độ theo chính sách, người phụ trách và hành động tiếp theo. Trạng thái cấp màn: **Có lỗi / Chưa đủ bằng chứng / Đủ bằng chứng để QC**, kèm phạm vi. Verdict QC website thủ công hiện có vẫn độc lập. Importer `VERIFIED` và generation `COMPLETE` không tự tạo Commerce QC Pass hoặc kết luận sẵn sàng cutover.

## Hợp đồng dữ liệu và trách nhiệm

| Bên phụ trách | Đầu ra cần có |
| --- | --- |
| F42 exporter/evidence | Sidecar an toàn, có hash, kiểm kê nguồn PW1 đã chọn trước lọc; inventory/disposition theo Store, thực thể, record, field; provenance và thời điểm snapshot. |
| F42 importer/comparator | Crosswalk nguồn→đích xác nhận; child run `VERIFIED`; generation `COMPLETE` bất biến; sáu trạng thái field cùng reason/transform; summary record/field theo thực thể; rule tiền/stock/status được duyệt; drift hiện tại tách khỏi độ đúng lúc import. |
| F40 API | DTO chỉ đọc, yêu cầu Super Admin, chỉ ghép các tầng khi Store/run/source/target/snapshot/generation khớp; lọc/phân trang giới hạn ở server; allowlist hiển thị an toàn; trạng thái partial/unavailable rõ. |
| F40 UI | Ngữ cảnh, hai mẫu số, điều tra theo thực thể, chi tiết record, mục cần xử lý, provenance; live mode không fallback dữ liệu mẫu. |
| QC/Product/Finance/Security | Registry field bắt buộc, chính sách ngoại lệ/mức độ; mapping tiền/stock/status; chính sách PII; expected counts, gate P0, review bằng chứng và ký nghiệm thu. |

Ưu tiên mở rộng evidence/read model F42 có phiên bản và adapter F40 hiện có; không tạo comparator độc lập thứ hai trong browser. DTO API phải có cả trạng thái record/field và export disposition; không suy độ khớp giá trị từ `migration_entity_map`.

## Các đợt bàn giao

1. **Khóa contract và baseline:** thống nhất Store/run/snapshot binding, registry coverage và hai mẫu số với QC. Kiểm kê proof/gap F42 cho bốn nhóm; chọn Store fixture thật và cách thử an toàn trên staging.
2. **Độ phủ nguồn:** đưa inventory/disposition toàn nguồn đã chọn và trạng thái thiếu proof lên API/UI, gồm record/store bị loại hoặc chặn trước import. Xác minh sidecar và counts trên clone, sau đó staging QC.
3. **Độ đúng import:** thêm summary theo thực thể, chi tiết record/field sáu trạng thái, rule Product/SKU và Order đã duyệt, exception, giá trị an toàn, phân trang server. Giữ `unsupported`/`unverified` rõ.
4. **Thực thể còn lại và drift:** hoàn thành rule Discount/Customer, tổng hợp tài chính Order, kiểm tra drift PW2 hiện tại với thời điểm riêng và owner/hành động cho gap.
5. **Gate QC và rollout:** xác minh chính sách `đủ bằng chứng Commerce để QC` riêng; chạy browser/API/security test và ma trận TC/AC Phase 10 trên cùng revision staging. Không nối trực tiếp evidence Commerce với Website QC Pass hoặc cutover tự động.

Mỗi đợt chỉ phát hành với nhãn phạm vi đúng sự thật; thiếu evidence không biến thành số 0 hoặc lấy evidence run cũ để thay thế.

## Tiêu chí chấp nhận và kiểm chứng

- Tổng nguồn đã chọn đối chiếu với inventory sidecar/CSV có hash; mọi record có disposition, kể cả record không xuất. `nguồn = đã xuất + giữ lại/loại/chưa giải quyết/bị chặn/tạm hoãn` theo chính sách đã ký.
- Tổng field kỳ vọng import bằng tổng sáu trạng thái không chồng lấn; tổng record đối chiếu riêng. `unsupported`, `unverified`, nguồn ngoài lần so sánh hiển thị và không nâng tỷ lệ `khớp / kỳ vọng`.
- Product nhiều SKU và Order nhiều item giữ element identity ổn định. Có thể tìm và mở chi tiết sai giá, stock, total/status của Order, target thiếu/trùng. Rule tiền/stock có phiên bản, đúng đơn vị/thời điểm.
- Run `VERIFIED` mới nhất phải đúng Store/namespace. Evidence sai Store, chưa hoàn tất, synthetic, cũ hoặc thiếu phải từ chối rõ. Drift PW2 hiện tại không viết lại kết quả import tại thời điểm verify.
- Super Admin xem bằng chứng an toàn; truy cập trái quyền hoặc chéo Store bị từ chối; API/browser/log không lộ PII thô, secret, URL riêng tư hoặc SQL.
- Luồng browser thật trên một revision staging đã chốt kiểm phạm vi, summary, filter, phân trang, chi tiết, lỗi và không cấp Pass giả. Fixture synthetic chỉ kiểm comparator, có nhãn và không tính là nghiệm thu Store thật.
- Kết luận Commerce đủ bằng chứng tách khỏi cutover F40 toàn diện. Cutover vẫn cần TC-MIG.01–10, gate media/render/visual/SSO, P0 = 0, chính sách parity và ký duyệt thủ công.

## Rủi ro và quyết định còn mở

- Artifact cũ có thể không còn sidecar nguồn. Khi đó full-source proof bị chặn; không dựng lại giá trị nguồn đã lọc từ mapping report.
- Hai panel field/ledger F40 hiện có semantics và mẫu số khác nhau. Ghép counts khi chưa ràng buộc cùng run/snapshot sẽ tạo cảm giác đầy đủ sai.
- Product/Finance/QC phải chốt chính sách tiền/status/stock và ngoại lệ; code không tự quyết.
- Kiểm tra drift đích chưa chạy. Cần phép đọc PW2, thời điểm và quy tắc phân trách nhiệm riêng; không gắn nhãn importer verification.
- Cần đo số record/field theo Store và query plan trước khi chốt cursor/index. Không tải toàn bộ field về browser.
- Cần chốt record lịch sử nào đủ điều kiện import, và record giữ lại/loại nào hiển thị trong độ phủ nguồn nhưng nằm ngoài mẫu số import fidelity. Thiết kế đã duyệt giả định kiểm kê toàn bộ nguồn PW1 đã chọn.

## Tài liệu tham chiếu

- `docs/prd/F40-qa-control-center.md` §10; `docs/stories/F40-qa-control-center-stories.md` US-F40-11.
- `plans/260910-commerce-settings-migration-reconciliation/plan.md` và phase 02/04.
- `plans/260930-f42-f40-field-evidence/plan.md`, phase 03/06/09/10.
- `docs/qa/F40-field-evidence-integration.md`; `docs/qa/F42-field-evidence-local-handoff-20261002.md`.
- `src/lib/migration/pw1-evidence/build.ts`; `src/lib/admin/qa/f42-field-evidence-reader.ts`; `src/lib/admin/qa/f42-ledger-evidence-provider.ts`.
