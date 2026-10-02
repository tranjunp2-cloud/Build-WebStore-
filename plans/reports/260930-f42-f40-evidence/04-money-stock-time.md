# 04 — Rule giá, stock và thời điểm snapshot

## Vì sao tách riêng

Giá và stock là dữ liệu biến động, có đơn vị và công thức nghiệp vụ. So hai con số ở hai thời điểm khác nhau sẽ tạo kết luận sai. F42 cần cung cấp evidence để F40 hiểu “khớp tại snapshot nào, theo rule nào”.

## Rule tiền

Mỗi price/amount rule cần ghi source unit (`major`/`minor`), target unit, ISO currency, decimal scale, phép nhân/chia, rounding mode, giới hạn overflow, field generated hay copied và rule version. Normalize bằng decimal/integer chính xác; không so float hoặc chuỗi format UI. Chốt rõ các loại tiền:

- Product price và SKU price/cost: field nào là giá chính thức, field nào chỉ được giữ để đối soát.
- Order subtotal, discount, shipping, tax, grand total: lấy từ snapshot Order, giữ dấu/zero, xác định công thức kiểm tra và rounding theo item hay toàn đơn.
- Discount fixed amount và Order discount amount: xác minh đơn vị riêng; không dùng một rule chung chỉ vì cùng tên `discount`.
- Multi-currency: không chuyển tỷ giá ngầm; field khác currency hoặc currency chưa support là gap có reason code.

Ví dụ schema evidence cho field tiền được duyệt hiển thị: `sourceCanonicalMinor='4900'`, `targetCanonicalMinor='4900'`, `currency='MYR'`, `transformCode='PW1_MAJOR_TO_PW2_MINOR_V1'`; F40 có thể hiện `RM 49.00` sau allowlist. Fingerprint của source raw/canonical chỉ lưu nếu phân loại dữ liệu cho phép; field nhạy cảm cần HMAC có khóa hoặc chỉ metadata, không dùng hash thường dễ dò ngược. Không trả raw source cho browser mặc định.

Master mapping hiện xác nhận Product/Order giá chính có thể là major unit, một số Discount/Order discount là minor unit và shipping có policy default; xem [`pw1-pw2-master-field-mapping.md`](../../../docs/migration/pw1-pw2-master-field-mapping.md). Không áp một rule cho tất cả money fields.

## Rule stock

Khóa so sánh đề nghị: `(source_store_id, source_sku_id, source_location_id, snapshot_at)` → `(target_variant_id, target_location_id, verified_at)`. Registry phải nói rõ nguồn và đích có hay không có location/warehouse tương ứng. Mỗi metric là field riêng:

| Metric | Ý nghĩa cần xác nhận | Cách xử lý nếu thiếu nguồn/đích |
| --- | --- | --- |
| `on_hand` | Hàng vật lý tại SKU/location | `unsupported` nếu hệ thống không biểu diễn location; `unverified` nếu không đọc được snapshot |
| `reserved` | Hàng giữ cho Order/chưa xuất | Không tự lấy `0` khi không có evidence |
| `available` | Khả dụng để bán | Chỉ dùng `on_hand - reserved` nếu rule nguồn/đích xác nhận công thức và cùng snapshot |

PW2 hiện có `variants[].stock` và Product inventory; master mapping nói Product inventory có thể tổng hợp từ SKU. Chưa có bằng chứng ở code đã rà rằng PW2 có reserved/available theo warehouse. Vì vậy mức tối thiểu khả thi là so **SKU stock theo snapshot** nơi có target tương ứng; phần warehouse/reserved/available phải `unsupported` hoặc `unverified` có lý do cho tới khi schema và nguồn xác minh. Không được gọi tổng Product.inventory là stock theo SKU/location.

## Quy tắc thời gian và drift

1. Ghi `source_snapshot_at` từ manifest; nếu tồn kho có thời điểm đo riêng, ghi `stock_snapshot_at` và timezone.
2. Importer đọc PW2 trong `verifyStore()` để đối chiếu projection đã emit. Field evidence generation cần ghi **thời điểm đọc target riêng** (`target_read_at`) và checksum/revision; nếu builder chạy sau importer, không được gọi thời điểm này là cùng snapshot với transaction verify. Sau đó checkout/admin thay stock hoặc giá, evidence cũ vẫn nói “match tại thời điểm evidence generation”; F40 dùng status `unverified` với `reasonCode=TARGET_DRIFT` cho current-state check hoặc tạo generation mới. `target_drift` không phải status thứ bảy.
3. Không so PW1 live hiện tại với PW2 snapshot cũ mà gắn `mismatch` của migration.
4. Nếu source cho phép giao dịch giữa export và cutover, định nghĩa delta/catch-up riêng; field evidence F42 chỉ chứng minh snapshot/import mà nó bind.

## Bộ test tối thiểu

- `0` stock khác `null` và khác missing; nhiều SKU cộng đúng Product inventory nhưng SKU đơn vẫn phải khớp.
- Major/minor conversion chính xác, không double-convert; negative/overflow/fractional quantity bị chặn hoặc phân loại rõ.
- Một SKU stock lệch theo cùng rule/snapshot trả `mismatch` ở comparator; nếu sửa target **trước** importer `verifyStore()` thì importer phải fail, không tạo child run `VERIFIED`. Stock đổi sau verify cần reason drift/generation mới, không sửa evidence gốc.
- Hai location cùng tổng nhưng phân bổ khác trả `mismatch` nếu location được support.
- Currency khác/unknown và reserved thiếu proof không trả `match`.
