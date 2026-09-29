# Contract exporter PW1 → JSON master, version 1

## Trạng thái

Contract này mô tả implementation CLI hiện tại, không chứng nhận toàn bộ mapping đã hoàn tất. Quy tắc nghiệp vụ được pin trong [master mapping](./pw1-pw2-master-field-mapping.md); hash tương ứng nằm trong [master-version.ts](../../src/lib/migration/pw1-export/master-version.ts). Thay đổi master cần review và cập nhật code/test/hash, không tự đọc nhánh khác khi chạy.

Hướng dẫn lệnh/config: [runbook](../runbooks/pw1-master-json-export.md).

## Đầu vào và identity

Một artifact ứng với một cặp `sourceInstance` + `sourceDatabase`, một snapshot và một cấu hình đã hash. `tables` chọn file CSV chính xác; UTF-8 strict, parser không tự cast hoặc trim giá trị. ID giữ chuỗi; null chỉ chuyển theo `nullTokens` đã xác nhận. Bản ghi raw giữ chuỗi/null và timestamps nguồn; timestamps field vận hành được chuyển UTC với offset/timezone config.

`sourceInstanceToken` chỉ chữ/số, ổn định theo DB, dùng dựng SKU/UUID biến thể. Không lấy snapshot/run/timestamp làm token. `asOf` cố định cho rule expiry/trial. Field config không biết bị từ chối; config không hỗ trợ selector Store/range hoặc tùy biến rule động. `acceptedExclusions` là ngoại lệ hẹp được mô tả dưới đây.

Khóa provenance là nguồn + bảng + ID; bảng không PK dùng locator record để đối soát, không dùng locator làm business identity. `_ref` là tham chiếu vận chuyển, chưa phải ID DB PW2:

```text
@tenants:stores:10
@sites:stores:10
@users:users:20
@products:products:30
@media:blog_posts_content:50:0
```

Namespace cuối biểu diễn lần xuất hiện ảnh Blog từ 0, không phải bảng CSV. Quan hệ cần resolve đúng Store và collection. Vùng raw chứa ID PW1 không được hiểu là quan hệ vận hành PW2.

## Cấu trúc master

Outer array gồm Store đã có Tenant/Site hợp lệ. Mỗi phần tử có đúng 20 root sau, giá trị là array:

```text
tenants, users, sites, pages, media, categories, products, customers,
discounts, orders, discount_usage_history, blog_categories, blogs,
email-template-settings, plan-subscriptions, plan-subscription-usages,
notifications, subscribers, contact-submissions, analytics
```

Một Store có đúng một Tenant và một Site. Store không qua validation được ghi `blockedStores`, không chèn Store object rỗng vào master. Việc collection có `[]` chưa chứng minh nguồn rỗng: phải đọc report để phân biệt verified-empty, excluded, quarantined và source-unverified.

### Field vận hành và raw

- Runtime schema strict từng collection; field ngoài contract bị từ chối.
- `pages[]` giữ raw PW1, thêm `_ref`, `components[]` và `model_settings[]`; không giả tạo `layout` hoặc default Page Payload.
- `sites[].menus[]` giữ raw cây menu; `sites[].pw1_source` giữ nguồn được allowlist. Đây không phải field có thể gửi nguyên vào Payload API.
- Năm mảng `medias`, `product_images`, `product_sku_images`, `media_items`, `media_categories` không nằm trong `sites[].pw1_source`; nguồn CSV tiếp tục được giữ ngoài artifact.
- Raw allowlist dùng tên cột cố định; JSON lồng bên trong chuỗi và setting value phải qua kiểm tra. Unknown/unsafe fields bị loại khỏi review artifact với diagnostic, không tự nhận đã bảo toàn lossless.
- Media giữ `url=sourceUrl` ngoài PW1; ảnh nhúng không được tạo filename/MIME/size/tenant hoặc mượn timestamps cha. Không download hoặc upload ảnh.
- Blog dùng Lexical; node/markup không biểu diễn được được báo fidelity gap và nguồn HTML giữ lại nếu qua raw security policy.
- User owner đã xác minh dùng `tenant-owner`/`owner`. Non-owner nghiệp vụ mặc định `editor`/`editor`; `readOnlyUserIds` đã xác nhận có ưu tiên `viewer`/`viewer`. Cả hai cấp role phải nhất quán, `permissions=[]`; lifecycle membership độc lập role. Không xuất frontend User thành staff.

### Bất biến nghiệp vụ quan trọng

- Default domain PW1 xác định slug; domain vận hành Site dùng suffix PW2 cấu hình. Không dùng tên Store để thay slug khi mất bằng chứng.
- COD đối soát provider code và trạng thái, đồng nhất Tenant/Site.
- Tenant lifecycle đối chiếu Store, owner và main subscription; xung đột chặn Store.
- Product kg/cm giữ đúng đơn vị nguồn đã chốt; Order gram có quy tắc riêng. Không round/clamp tiền để vượt schema.
- Theo master §5.2/§18 hiện tại, Product.slug unique trong từng tenant: chỉ cách ly tất cả Product trùng slug trong cùng tenant (`PRODUCT_SLUG_COLLISION`), không tự chọn bản thắng hoặc sửa slug. Cùng slug ở tenant khác được giữ nguyên; constraint global unique hiện tại của PW2 được ghi `TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP` mức blocker để xử lý trước import, không dùng nó loại record khỏi JSON. Cách ly tiếp record có quan hệ vận hành phụ thuộc (ví dụ Order), lặp đến khi đóng dependency; giữ Tenant/Site và record không liên quan. Các lỗi identity/global collision khác hoặc dangling refs còn lại vẫn chặn Store. Raw Page/menu/pw1_source không tham gia quan hệ vận hành. Mỗi record cách ly có diagnostic blocker; contributions chỉ giữ cho record thực sự được xuất.
- Discount history rỗng cần kiểm cả Order/mã đã xóa và counter nguồn; không suy từ collection Order đã emit.

## Artifact và trạng thái

`master-manifest.json` version 1 ghi contract/exporter version, nguồn và config hash, inventory, hash artifact, counts, blocker, `coverage.accounted`, `mapping.complete`, `importReady=false`.

```text
sourceStoreCount = selectedStoreCount + policyExcludedStoreCount
selectedStoreCount = emittedStoreCount + blockedStoreCount
```

`mapping-report.json` version 1 có diagnostic chỉ gồm mã/vị trí nguồn, không raw value; mỗi selected record có disposition, field status và contributions. Một field có thể góp vào nhiều output. `mapped` có thể là raw preservation; không đồng nghĩa toàn bộ record đã chuyển thành field vận hành. `retained-source` nói dữ liệu vẫn nằm trong CSV bên ngoài, không có nghĩa artifact chứa bản sao nguồn.

| Trạng thái | Artifact | Exit |
|---|---|---|
| `complete` | Hợp lệ, không blocker trong scope | 0 |
| `needs_review` | Hợp lệ để QA, còn blocker | 2 |
| Failed/invalid | Không được coi là artifact hoàn tất | 1 |

Ba nguồn `subscribers`, `contact-submissions`, `analytics` hiện chưa được xác minh nên mặc định tạo blocker, trừ ngoại lệ phạm vi đã được ghi nhận bên dưới. Khả năng xuất artifact không chứng minh full mapping `complete` cho nguồn thật. Inventory thành công trả 0 nhưng không map dữ liệu.

Validate-only kiểm hash/schema/semantic refs/counts/coverage report và trạng thái nhất quán. Nó không đọc CSV, không chứng minh field đúng nguồn và không kiểm target DB. Artifact hợp lệ `needs_review` vẫn trả 2. Manifest ghi complete trái report là invalid, trả 1.

## Publication và tính xác định

Master ổn định với cùng nguồn, config và phiên bản rule. Raw string không bị canonicalize làm mất nội dung. Serializer master escape U+2028/U+2029 thành `\u2028`/`\u2029` để editor không yêu cầu xóa ký tự; giá trị sau JSON.parse giữ nguyên. Record có position giữ thứ tự nghiệp vụ; record ID dùng comparator không mất độ chính xác ID lớn.

Giữ chỗ output bằng exclusive `mkdir`, không overwrite output có sẵn. File chuẩn bị trong staging và kiểm trước khi chuyển; manifest công bố cuối làm commit marker. Đây là thay đổi có chủ đích so với rename nguyên directory trong kế hoạch: Node rename không bảo đảm no-clobber thư mục trên mọi nền tảng, lock hợp tác không đủ chống writer không dùng lock. Directory xuất hiện nhưng thiếu manifest phải bị consumer từ chối. Chạy lại dùng output mới.

Input/config được hash và kiểm lại trước công bố. POSIX modes mặc định private. CSV reports chống công thức spreadsheet. Secrets không được đưa vào master/report/log; PII cần thiết vẫn yêu cầu lưu private. Hash là kiểm tra toàn vẹn, không phải chữ ký xác thực hoặc cơ chế phân quyền.

## Điều kiện nghiệm thu còn lại

Fixture và integration tests chỉ kiểm hành vi implementation. Nghiệm thu toàn dữ liệu cần snapshot/config do người phụ trách xác nhận, full-source export, xử lý blocker, đối soát độc lập dữ liệu đại diện và toàn bộ counters, đo tài nguyên/thời gian, rerun determinism, validate artifact cuối. Không thay điều kiện này bằng việc tạo được `master.json` hoặc test chạy xanh.

Importer, target IDs, DB transaction/replay, migration tracking, quyền/hooks, render storefront và cutover nằm ngoài contract exporter.


## Ngoại lệ phạm vi optional history

`acceptedExclusions` là array tùy chọn (mặc định rỗng), mỗi phần tử strict gồm `ruleId: "MASTER-2.2-OPTIONAL-HISTORY"`, `collection`, `reason`, `decisionEvidence`. Collection chỉ thuộc `notifications`, `subscribers`, `contact-submissions`, `analytics`, không trùng lặp. Reason/evidence bắt buộc và phải phản ánh quyết định phạm vi đã được xác nhận; config không tự tạo phê duyệt nghiệp vụ.

Chỉ diagnostic source-unverified/quarantine của các root tương ứng có thể hạ thành warning. Không miễn lỗi mapper chưa triển khai, required ref, Store thiếu Tenant/Site, unknown field hoặc bất kỳ lỗi dữ liệu khác. Manifest lưu danh sách và hash config; `complete` nếu đạt chỉ có ý nghĩa trong scope có ngoại lệ tường minh, không chứng minh đã migrate dữ liệu bị loại trừ. `importReady` vẫn false.

Khi final verification phát hiện thay đổi ở file không được chọn, `sourceWarnings` được trả qua CLI. Inventory/hash trong manifest là quan sát ban đầu và không bị sửa sau publication. Thay đổi selected source/config là fatal. Consumer tracking cần lưu kết quả CLI nếu cần bằng chứng những warning sau inventory.


## Đồng bộ master: Product.slug theo tenant

Master pin hiện tại SHA-256 `62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26`. Scope mới chỉ áp dụng Product.slug; Tenant.slug, User.email và các constraint khác giữ nguyên phạm vi của chúng. Blog slug vẫn theo master hiện tại, không mở scope theo Product. Không có migration/schema DB hoặc rewrite slug trong thay đổi exporter này.

Artifact xuất trước hash này giữ nguyên bytes và manifest cũ; số liệu trước đây là lịch sử chạy theo contract cũ. Validator pin mới sẽ từ chối contract cũ với UNSUPPORTED_MAPPING_CONTRACT; không sửa manifest để ép hợp lệ. Cần xuất lại vào thư mục mới trước khi dùng kết quả theo master mới.
