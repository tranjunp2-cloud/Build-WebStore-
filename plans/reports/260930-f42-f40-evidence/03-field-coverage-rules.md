# 03 — Registry field và phạm vi Product, Order, Customer, Settings

## Mục tiêu

QC cần nhìn thấy kết quả từng field, kể cả field chưa migrate. Danh sách field nguồn phải là **inventory có version**; tập row evidence được ghi không thể tự làm mẫu số coverage. Registry là nguồn để producer F42 tạo evidence và F40 giải thích kết quả.

## Shape registry đề nghị

Mỗi rule có: `rule_id/version`, `source_entity`, `source_table.column`, `target_collection.path` hoặc `null`, `element_identity`, `source_disposition` (`operational`, `archive_only`, `excluded`, `not_present`), `support_state`, `canonical_type/unit`, `transform_code`, `null/absent rule`, `comparison_method`, `sensitivity`, `display_policy`, `effective_mapping_version`, `owner` và `reason_code` khi chưa support. Pin hash registry trong evidence header để code, artifact và F40 cùng hiểu một bản contract.

Một field có thể fan-out hoặc được tổng hợp từ nhiều nguồn; rule cần ghi input set và output path, không giả 1:1. Quan hệ phải so **identity/set** ngoài count. Field generated/default phải ghi `transform_code` rõ; giá trị khác raw source có thể `match` sau transform hợp lệ, nhưng F40 phải hiện lý do transform.

## Lô 1: Product/SKU

| QC yêu cầu | Hướng triển khai | Điều kiện chưa chứng minh phải trả |
| --- | --- | --- |
| Product name, slug, status | So source snapshot với Product target theo rule tên/slug/status đã duyệt; slug transform phải version hóa | `unverified` nếu chưa có source snapshot/rule; `mismatch` nếu target khác canonical |
| SKU | So từng source SKU bằng key nguồn và target variant ID/identity; kiểm uniqueness và tập SKU | `missing` cho SKU nguồn đã xác minh không có target; `duplicate` chỉ khi hai target cùng source có provenance, không chỉ cùng SKU string |
| Giá bán, giá vốn, currency | So Decimal/currency sau transform; Product và Variant price phải có rule riêng | `unsupported` nếu cost không có target được phép; không suy từ giá Product sang mọi SKU |
| Stock theo SKU/location | So từng SKU/location tại snapshot đã chốt; tách `on_hand`, `reserved`, `available` | `unsupported` cho chiều không có schema/source tương đương; `unverified` nếu thiếu snapshot/time |
| Weight/dimension | So đúng kg/cm hay đơn vị nguồn có proof; null/zero riêng | `unverified` nếu không biết đơn vị nguồn |
| Category | So tập category qua crosswalk và tenant guard, không chỉ count | `mismatch` nếu count bằng nhưng identity khác |
| Image | So tập identity/URL an toàn, thứ tự nếu UX yêu cầu, count và media target tồn tại | `mismatch` khi count bằng nhưng ảnh khác; không lộ URL có token/query nhạy cảm |

PW2 hiện có `products.price/currency`, `variants[].price/stock`, weight/dimensions; master mapping hiện nói SKU stock là nguồn chính và Product.inventory có thể bằng tổng SKU. Đây **không** phải bằng chứng có warehouse/reserved/available theo SKU. Cần kiểm schema/source và chốt support state, không thêm “stock khớp” từ một số tổng. Tham chiếu [`Products.ts`](../../../src/collections/Products.ts) và [`pw1-pw2-master-field-mapping.md`](../../../docs/migration/pw1-pw2-master-field-mapping.md).

## Lô 2: Order

| Nhóm | Evidence cần có |
| --- | --- |
| Order code và item/SKU | Crosswalk Order và item; item key từ source identity, SKU/PW2 Product/Variant ref cùng tenant; kiểm tập, thứ tự nếu có nghĩa nghiệp vụ |
| Quantity và currency | Số lượng Decimal hợp lệ, currency theo Order snapshot; không áp currency Store hiện tại lên Order lịch sử |
| Subtotal, discount, shipping, tax, grand total | So từng khoản và công thức tổng theo rule tiền; giữ số gốc, canonical minor unit và transform code; không tính lại từ catalog hiện tại |
| Order, payment, fulfilment/shipping status | Bảng enum mapping theo version; phân biệt status nguồn và trạng thái kỹ thuật PW2; unknown là `unverified`/`unsupported`, không ép COD/paid |
| Refund/cancel state | Chỉ `match` nếu dữ liệu/sự kiện trong scope migration và được xác minh; không suy lịch sử từ status cuối |

PW2 Orders có `subtotal`, `shippingFee`, `tax`, `total`, `currency`, `status`, `paymentStatus`, `paymentMethod`, `shippingTrackingStatus`, `discountAmount`; cần khảo sát từng source field và mapping thực thi trước khi chốt path. Mapping master có các gap về Discount history/refund và payment; không tự đóng chúng bằng evidence UI. Tham chiếu [`Orders.ts`](../../../src/collections/Orders.ts) và master mapping §7.

## Lô 3: Customer, Discount, Settings

| Nhóm | Evidence cần có và giới hạn |
| --- | --- |
| Customer identity | Dùng source ID/target ID server-side; tên/email/phone/address chỉ dùng HMAC có khóa hoặc masked DTO; không gửi PII thô/unsalted checksum. So address **identity + count + role** khi source có proof. |
| Discount | Code, type, value, start/end, status với timezone, unit, snapshot; Order discount snapshot không tự đồng nghĩa cấu hình Discount hiện tại. |
| Profile | Từng setting source/target có mapping; generated defaults có transform code. Email, phone, address vẫn theo policy PII. |
| Team | User identity và membership/role là hai evidence khác; “User được tạo” không chứng minh quyền tương đương. Không lấy email/name để suy target ID. |
| Email template | Subject/status/content dùng fingerprint canonical hoặc bản xem trước đã được duyệt; không phát tán HTML có PII/secret. |
| Payment, Delivery, Domain, Integration | Field chưa migrate/support hoặc chỉ giữ raw archive phải ghi `unsupported` với reason/owner. Field có target cấu hình nhưng chưa test provider/cutover chỉ được nói “data comparison”, không nói “runtime works”. |

Settings scope có thể có source `model_settings` raw archive; `retained-source` không phải là bản ghi PW2 vận hành. Master mapping đang ghi một số gap payment/integration/domain; giữ trạng thái thật. Tham chiếu [`pw1-pw2-master-field-mapping.md`](../../../docs/migration/pw1-pw2-master-field-mapping.md).

## Output của gói việc này

1. File registry versioned được review bởi F42 + QC + F40, có danh sách **mọi field QC nêu** và support state cụ thể.
2. Mỗi rule có ít nhất một test canonicalizer/normalizer phù hợp; field `unsupported` có reason code cố định.
3. Báo cáo coverage cho một child run chỉ ra số field source kỳ vọng, số field operational, archive/excluded, số đã compare và số chưa chứng minh.
4. Danh sách gap có owner; không chờ hoàn thành các module chưa migrate mới bàn giao các field Product/Order đã có evidence.

F40 `ReconciliationEntity` hiện chưa có `product_skus`/`order_items` như record riêng; demo đang đưa SKU vào fields/relations của Product. Nếu QC cần lọc một SKU hoặc line item như record độc lập, F40 phải mở entity type và DTO; nếu giữ dưới Product/Order, producer cần `elementKey` ổn định và UI drill-down. Không được gộp các SKU vào một field `stock` duy nhất. Xem [`migration-reconciliation.ts`](../../../src/lib/admin/qa/migration-reconciliation.ts).
