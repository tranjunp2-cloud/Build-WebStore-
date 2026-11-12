# Phase 03 — Comparator Product/SKU, Order, money và stock

**Owner:** F42 migration/domain. **Effort:** 5–8 dev-days. **Dependency:** Phase 01 registry/rules, Phase 02 repository/generation. **Deliverable:** field evidence thật cho Product/SKU và Order; những chiều không có proof được disposition rõ.

## Product/SKU field checklist

| Nhóm | Comparison cụ thể | Negative/gap |
| --- | --- | --- |
| Product name/slug/status | source snapshot → mapped Product; normalize Unicode/trim/status enum theo mapping version; generated slug có transform code | Unknown rule `unverified`, target khác `mismatch` |
| SKU identity/attributes | source SKU ID → Variant element key; kiểm identity/set, không chỉ count; SKU text, size, color, capacity/option values là field riêng theo source contract | Source SKU không có target sau read thành công `missing`; hai variant cùng source provenance `duplicate`; không gộp nhiều SKU thành primary SKU duy nhất |
| Sale price/cost/currency | Product và Variant riêng; Decimal → canonical minor integer theo currency, unit/rounding pin version | Cost thiếu target `unsupported`; currency unknown không match |
| Stock | per source SKU + warehouse/location + snapshot time; `on_hand`, `reserved`, `available` là ba rule/field riêng; Product inventory aggregate là check phụ | Không suy reserved=0; không lấy Product total thay SKU/location; thiếu target location `unsupported` |
| Weight/dimensions | kg/cm hay rule chuyển đổi có version; `null`, 0, absent phân biệt | Đơn vị không chứng minh `unverified` |
| Categories | so tập target category ID qua crosswalk cùng Store, count + identity | Count bằng nhưng ID khác `mismatch` |
| Images | so count, identity/association, thứ tự nếu có nghĩa, media target tồn tại; URL phải bỏ token/query nhạy cảm | Count bằng nhưng ảnh khác `mismatch`; remote HTTP availability là QC gate riêng |

## Order field checklist

Order code; line item identity + Product/Variant/SKU; quantity; currency; subtotal, discount, shipping, tax, grand total; Order status; payment status/method; fulfilment/shipping status; refund/cancel state nếu thuộc migration scope. Order item key phải là source line ID hoặc composite đã được chứng minh unique; không dựa vào vị trí mảng nếu order có thể đổi. Không tính lại Order lịch sử từ Product price hiện tại. `discountAmount`/shipping default phải có transform code. Unknown status mapping là `unverified` hoặc `unsupported` theo registry, không ép thành status gần giống.

## Money rule bắt buộc

Định nghĩa riêng cho Product sale price, Variant price/cost, Discount fixed amount, Order từng component: source/target unit major/minor, ISO currency, scale, sign, decimal precision, rounding mode (per line hay total), overflow, null/zero. Dùng Decimal hoặc integer string, **không float**. Không chuyển FX ngầm. Với mỗi money field lưu canonical minor string + currency chỉ khi display được duyệt; rule checksum và transform code đi theo evidence. Một amount khớp số nhưng khác currency không `match`.

## Stock và thời điểm

Ghi `stockSnapshotAt` nguồn và `targetReadAt`; đối chiếu `(SKU, location, metric)` cùng mapping. `available = on_hand - reserved` chỉ khi rule cả hai hệ thống định nghĩa như vậy, không tự suy. Nếu PW2 chỉ có `variants[].stock`, comparator chỉ claim chiều được chứng minh (ví dụ on-hand SKU), còn warehouse/reserved/available trả `unsupported` hoặc `unverified` với reason. Nếu target thay stock sau importer verify, generation mới ghi `TARGET_DRIFT`/thời điểm, không biến generation cũ thành lỗi import. Sửa target **trước** `verifyStore()` sẽ làm importer fail; test comparator mismatch phải chạy trên synthetic fixture hoặc independent source rule thật.

## Steps và acceptance

1. Viết canonicalizer pure functions dùng registry từ Phase 01; mỗi rule có test null/absent/zero, conversion, overflow và mapping. Import logic từ source vào test, không viết bản reimplementation.
2. Viết bounded target readers theo Store/tenant; so source canonical với **verified projection đã lưu trong ledger** cho kết luận tại import time, rồi đọc target hiện tại để kiểm drift và ownership. N+1 không chấp nhận: đọc batch theo entity/target IDs, index evidence lookup. Reader trả typed result phân biệt **target schema/field không support**, read failure và confirmed absent. Không lấy target current sau nhiều giờ rồi gắn nhãn là target ở thời điểm importer verify.
3. Tạo field rows + element keys + record status theo precedence; source inventory đã có nhưng target vắng được `missing` chỉ sau successful target read **và proof target identity/scope**, không suy từ thiếu ledger claim. Target schema thiếu là `unsupported`; read failure hoặc identity không đủ là `unverified`.
4. Test fixture: Product all-match, Product price mismatch, SKU stock mismatch, Product missing, Order total/status mismatch; test đúng policy importer không thể VERIFIED khi emitted projection đã sửa trước verify.
   Đối chiếu thêm TC-MIG.03: variant count + identity + size/color/capacity, Brand ID và sale price per SKU; bảng Product có nhiều SKU vẫn là một Product record với các element key ổn định và primary SKU chỉ dùng nhãn hiển thị.
5. Đối chiếu source artifact với target schema thực tế trên clone; chốt support matrix per field với QC. Không claim cost/reserved/refund match nếu nguồn/target không support.

**Done:** mỗi Product/SKU/Order field QC có status/reason/version/provenance hoặc explicit unsupported/unverified; summary field của Store test cộng đúng mẫu số; no secret/PII leak; target read bounded và đủ nhanh trong budget Phase 07.
