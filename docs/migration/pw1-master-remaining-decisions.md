# PW1 master JSON — các giới hạn còn lại trước import

Thẩm quyền mapping là [master đã pin](pw1-pw2-master-field-mapping.md). Script tạo artifact mới từ snapshot CSV; không sửa JSON đã xuất hoặc ghi DB.

## Follow-up đã chốt — 2026-09-17

Code đã triển khai policy đưa Category con active lên gốc khi cha live/đúng Store/inactive; bỏ giới hạn 5 ảnh và 300 ký tự mô tả ngắn; hoãn toàn Store 323 dùng VND; hoãn notifications/subscribers/contact-submissions/analytics; giữ snapshot Order item độc lập catalog hiện tại. Không tự sửa Blog slug trùng. Contract §21 thay các giới hạn cũ tương ứng. **Export follow-up đã hoàn tất**; independent validate-only đạt integrity `valid`, mapping `needs_review`, exit 2; kiểm tra archive PASS. Counts approved-001 bên dưới là baseline lịch sử, không phải counts code mới.

Ở collection PW2, mã SKU là tùy chọn (form dashboard hiện vẫn có validation yêu cầu mã). Blocker exporter không phải thiếu mã SKU. Vấn đề của **252 Product** là giá hiện hành ở PW1 nằm trong bảng `product_skus`, không có trên bảng `products`: 243 Product không có dòng SKU, 9 chỉ có dòng đã xóa. Không tạo giá 0 hoặc lấy giá giao dịch cũ làm giá bán hiện hành. Danh sách private: [.migration/audits/pw1-prod-20260917-followup/products-no-current-price.csv](../../.migration/audits/pw1-prod-20260917-followup/products-no-current-price.csv).

Creator đã xác minh nguồn User 1/51 và kiểm tra chỉ đọc DB local: không có exact-email match hoặc crosswalk tương ứng. Helper `planCreatorBindings` thực thi preflight, trả `ready:false` và `missing-target` cho cả hai; đây không phải binding đã ghi DB. Bằng chứng private: [creator-binding-preflight.json](../../.migration/audits/pw1-prod-20260917-followup/creator-binding-preflight.json), [review/provisioning plan](../../.migration/audits/pw1-prod-20260917-followup/creator-binding-review.md). Không suy từ local sang production; không dùng admin khác thay actor. Nếu provision tài khoản hệ thống, cần roles/tenants rỗng, không copy credentials hoặc gửi welcome mail.

## Baseline approved-001 — 2026-09-17

Các quyết định active Category/SKU, tập SKU thực có, hoãn email, siteType và creator chỉ trên Users **đã được implement**. Shipping dùng cấu trúc và runtime PW2: giữ phí fixed tương đương khi đủ bằng chứng; trường hợp khác có policy dùng mặc định PW2 hoặc để review. Các checkpoint trước đây ghi “mới ghi nhận, chưa sửa exporter” đã được thay bằng trạng thái này.

Kiểm chứng code tại baseline approved-001: **385 tests / 27 files pass**, TypeScript pass, code review pass. Export `.migration/exports/pw1-prod-20260917-approved-001` hoàn tất sau **1.026,3 giây**. Validate-only độc lập: integrity `valid`, mapping `needs_review`, exit 2; audit exit 0. Source files không đổi.

Kết quả approved-001: **2.800 Store emitted / 118 blocked**, 106.623 blocker diagnostics; 27.790 Product, 25.161 Category, 342 Order, 5.655 Blog, 2.131 BlogCategory và 0 email templates. Cả 339 Order cũ giữ nguyên fee/totals; thêm 3 Order. 359 Product gram còn được giữ đã chuẩn hóa đúng kg. 2.840 User có creator được đối soát; 2 actor global trong sidecar phục vụ 2.800 references. 2.800 Site là ecommerce; shipping có 860 fixed được map, 1.939 dùng PW2 defaults, 1 Store VND vẫn blocker.

**Baseline có 95 Product bị loại vì Category active của chúng có cha inactive.** Quy tắc promote đã được user duyệt và triển khai ở follow-up; số Product thực sự khôi phục chờ artifact mới. Đây không phải Product chỉ có SKU inactive. So với remediation-003, 95 Product bị loại và 20 được thêm, tổng giảm 75. Có 166 Product được emit với `category: []` vì chính Category của chúng inactive và đã được loại theo policy. Creator target binding/import vẫn chưa thực hiện.

Artifact/audit: `.migration/exports/pw1-prod-20260917-approved-001/` và `.migration/audits/pw1-prod-20260917-approved-001/`; hồ sơ verification/record-deltas JSON nằm cạnh thư mục audit. [Report kết quả approved mapping](../../plans/reports/260917-pw1-approved-mapping-results.md).

Artifact baseline để so sánh là `pw1-prod-20260917-remediation-003`: integrity `valid`, mapping `needs_review`, exit 2; 2.800 Store emitted, 118 blocked, 143.949 blocker diagnostics. [Report remediation](../../plans/reports/260917-pw1-gap-remediation-results.md) là bằng chứng lịch sử, không phải nghiệm thu implementation mới. Contract mới có thể khiến validator hiện tại từ chối artifact cũ; không sửa hash để vượt kiểm tra.

## Quyết định đã áp dụng

| Phần | Implementation | Giới hạn còn lại |
|---|---|---|
| Category | Chỉ lấy Category active khi bật policy | Product có Category inactive đã xác minh đúng tenant được giữ với `category: []` và warning. Category thiếu/sai ownership vẫn lỗi; Follow-up promote Category con active khi cha live/owned/inactive; cha missing/deleted/foreign vẫn lỗi |
| SKU | Chỉ lấy SKU active; Product chỉ có SKU live, đúng tenant và đều inactive được loại theo policy | Không tạo SKU thay thế; Follow-up giữ snapshot Order dù SKU bị loại; chỉ ghi Product relationship có đích hợp lệ |
| Biến thể thiếu tổ hợp | Giữ đúng tập SKU thực có; không đòi đủ tích tổ hợp khi bật policy | Duplicate tuple, sai tier/ownership, price/stock và giới hạn PW2 vẫn kiểm tra |
| Trọng lượng | `package_weight_type=1`: kg; `2`: gram chia 1.000 | Unit không xác minh được vẫn lỗi; artifact cũ chứa trọng lượng sai không được sửa bằng tay |
| Mô tả Product | Không cắt chuỗi mô tả nguồn; không mở rộng editor/renderer trong đợt này | Follow-up bỏ giới hạn 300 ký tự và 5 ảnh, giữ thứ tự ảnh; fidelity/editor vẫn ở luồng khác, không xem raw preservation là chứng nhận hiển thị |
| Email templates | Hoãn migrate template nguồn bằng policy có evidence | Không đồng nghĩa tắt email vận hành PW2; template nguồn ở snapshot, không phải đã map thành template đích |
| SiteType | Mặc định `ecommerce`; override theo Store ID và enum PW2 hợp lệ | Chỉ override khi có bằng chứng; không suy ngành template PW1 thành loại site. Không cần thêm schema PW2 |
| Shipping | Fixed MYR của self-delivery active/configured, Store chọn self-delivery và trong giới hạn PW2: đổi RM→sen, dùng cùng mức East/West. Không port thuật toán tier PW1 | Tier/dynamic/missing/invalid có thể dùng PW2 800/1500 sen nếu policy `pw2-defaults`; ghi warning rằng cấu hình nguồn được thay thế, không tuyên bố tương đương. `review` giữ blocker. Currency không hỗ trợ vẫn blocker |
| Creator | Chỉ giữ `Users.createdBy`; same-tenant User như cũ, global actor đủ điều kiện qua `user-actors.json` | Sidecar là dependency danh tính nguồn, chưa phải tài khoản PW2 đã được tạo. Cần importer bind đúng ID đích, giữ chuỗi creator và tránh hook ghi đè |

Shipping không kích hoạt hãng vận chuyển, copy credential hoặc thay code checkout. `shippingSetupConfirmed=false` không phải công tắc chặn checkout. Phí Order cũ không được tính lại bởi mapping này. Các khác biệt runtime PW2 trước đây đã khảo sát vẫn tồn tại, ví dụ subtotal sau discount hoặc retry-payment; không mô tả việc xuất JSON là đã kiểm chứng checkout sau import. [Nghiên cứu source](../../plans/reports/260917-pw1-pw2-shipping-site-type-creator.md).

## Creator: việc importer phải làm

`user-actors.json` là file private có tên/email, ID nguồn, timestamps/status và role provenance; không có mật khẩu/token, runtime role được cấp hay membership. File được hash trong manifest và kiểm tra schema, provenance, identity, creator chain. Ngoại lệ reference external chỉ ở field trực tiếp `users.createdBy`; không mở quan hệ xuyên tenant cho các field khác.

Importer cần xác minh hoặc tạo đúng tài khoản hệ thống theo quy trình đích, lập crosswalk source identity → PW2 User ID, resolve `createdBy` theo crosswalk và bảo vệ giá trị đó khỏi hook tự ghi người chạy import. Không copy PK số PW1 trực tiếp, không dùng owner thay cho actor hệ thống, không cấp tenant membership giả. `TARGET_USER_CREATOR_BINDING_REQUIRED` vẫn là blocker readiness cho tới khi kiểm chứng đích; không phải gap mất creator nguồn.

## Hồ sơ cụ thể để team review

- [118 Store bị chặn](../../.migration/reviews/260917-followup/blocked-stores.md) / [CSV](../../.migration/reviews/260917-followup/blocked-stores.csv): 94 tenant lifecycle, 9 user lifecycle, 6 subscription bắt đầu tương lai, 4 owner identity, 2 Store không live và 3 lỗi đơn lẻ slug/email/domain.
- [Blog slug collisions](../../.migration/reviews/260917-followup/blog-slug-collisions.md) / [CSV](../../.migration/reviews/260917-followup/blog-slug-collisions.csv): 147 bản ghi, 70 nhóm, 17 Store; gồm 108 Blog và 39 BlogCategory. Chưa đổi slug tự động.
- [Đối soát Order/refund/payment](../../.migration/reviews/260917-followup/order-payment-reconciliation.md): 18 Order COD có trạng thái chưa đủ ngữ nghĩa; 8 Order Stripe có cờ refund success nhưng thiếu bằng chứng độc lập, cần ledger từ payment. 49 cấu hình provider chưa kích hoạt (18 Stripe/31 Billplz) không phải 49 giao dịch thất bại. Snapshot/source report không thay gateway ledger.

## Những phần vẫn cần người phụ trách xử lý

| Nhóm | Công việc cụ thể |
|---|---|
| Owner/lifecycle/subscription | Đối soát Store bị chặn với owner và main subscription tại `asOf`; không tự chọn active để xuất đủ |
| Quan hệ catalog/content | Category thiếu/sai ownership, Product thiếu nguồn giá hiện hành, duplicate EAV và Blog slug trùng cùng tenant; quy tắc cha inactive đã được chốt |
| Ảnh/mô tả | Bỏ giới hạn đã được chốt và triển khai; còn nghiệm thu nội dung/ảnh sau import và luồng rich text bên ngoài |
| Order/refund/payment | Xác minh trạng thái, refund, địa chỉ, discount, liên kết SKU; provider đích phải kết nối/kiểm chứng riêng |
| Website/raw | Unknown settings, unsafe URL, source structure chưa xác minh; raw Page không tự trở thành Payload blocks có thể publish |
| Optional history | Đã được user duyệt hoãn notifications/subscribers/contact-submissions/analytics qua `acceptedExclusions`; không gộp Order/refund/discount history |
| DB đích | Deploy và xác minh index tenant+slug cho Product/Blog/BlogCategory trước import; code/local tests không chứng minh production DB đã đổi |

Chưa chạy migration DB đích, chưa import production, chưa commit/push. Tenant slug và User email vẫn unique toàn hệ thống. Artifact `valid` hoặc tests pass không thay nghiệm thu dữ liệu và khả năng mở bán.

## Đọc report

1. `store-summary.csv/json`: Store blocked/emitted/excluded, collection counts và các nhóm blocker. Emitted không có nghĩa đủ dữ liệu con.
2. `mapping-report.json/csv`: code/reason, contribution và disposition từng field. Số diagnostic không phải số record mất.
3. `master-manifest.json`: hash, policy có evidence và counts của chính lần chạy đó; đọc cùng sidecar nếu có.
4. Audit theo [runbook](../runbooks/pw1-master-json-export.md#5-tạo-inventory-gap-và-hồ-sơ-đối-soát): hồ sơ case/coverage/shipping private, không thay validate-only và không chứng nhận import-ready.
