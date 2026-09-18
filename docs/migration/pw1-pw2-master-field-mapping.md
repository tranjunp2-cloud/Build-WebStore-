# Bảng mapping field tổng thể PW1 → PW2 cho JSON tenant

> **Cập nhật 2026-09-18 / exporter 1.4:** `sites[].pw1_source` không còn nằm trong master. Các đích raw `sites.pw1_source.*` mô tả bên dưới là cấu trúc lịch sử; dữ liệu này nay giữ ở CSV nguồn có hash trong manifest. Báo cáo dùng `retained-source` và `source-csv.<table>`, không khai chúng là field đã map vào JSON. Xem quyết định cuối tài liệu.
## 1. Mục đích và trạng thái

Tài liệu này là contract mapping field dùng chung cho migration tenant/store PW1 → PW2: cấu trúc JSON, nguồn/đích, chuyển đổi và các gap. Số liệu fixture, ID và kết quả từng lần chạy được tách sang [bằng chứng snapshot](../../plans/reports/260914-1440-master-mapping-snapshot-evidence.md), không phải quy tắc mapping.

**Bộ bàn giao chỉ gồm tài liệu master này và [file JSON mẫu](./stores-205-285-pw2-current-schema-collection-only.json).** Contract cấu trúc, quan hệ PW1/PW2 và bảng disposition từng cột đã được tích hợp ngay trong master; không cần đọc thêm tài liệu mapping phụ. Report, inventory và manifest được nhắc đến chỉ là bằng chứng kỹ thuật tùy chọn, không phải file bàn giao thứ ba hoặc một contract khác.

Với mỗi giá trị, tài liệu trả lời bốn câu hỏi:

1. Dữ liệu lấy từ bảng nào, field nào của PW1?
2. Dữ liệu nằm ở đường dẫn nào trong JSON tenant?
3. Collection Payload và cột PostgreSQL vật lý nào của PW2 sẽ nhận dữ liệu?
4. Dữ liệu được sao chép trực tiếp, chuyển đổi, tính toán, lưu nguồn, cách ly hay còn vướng mắc?

Đây là **đặc tả phục vụ nghiên cứu**, chưa phải đặc tả sẵn sàng import. Manifest của từng lần chạy phải công bố mức sẵn sàng import; không suy ra thành công từ việc có JSON. Không được coi các dòng có mã `B`, `A` hoặc `Q` là đã migrate đầy đủ.

**Phiên bản quyết định 2026-09-17:** các quy tắc được duyệt đã tích hợp vào đúng mục và bảng field bên dưới. Bản `followup-001` pin tài liệu trước khi hợp nhất cấu trúc, SHA-256 `8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9`; không dùng hash đó cho tài liệu đã biên tập này. Artifact cũ giữ nguyên, `integrityStatus=valid`, `mapping.complete=false`, `importReady=false`; lần export sau phải pin hash tài liệu và config tương ứng. JSON mẫu hai Store là bằng chứng lịch sử, chưa được xuất lại theo cập nhật này. Trạng thái từng lần chạy được ghi trong báo cáo, không thay quy tắc mapping.

### Mức độ xác minh

| Mã xác minh | Ý nghĩa |
|---|---|
| `CODE` | Đã đối chiếu implementation; các cập nhật exporter ngày 2026-09-17 nằm ở worktree-2, chưa đồng nghĩa code đó đã có trên nhánh docs hoặc DB đích |
| `SCHEMA` | Đã đối chiếu với `src/collections/*.ts` và/hoặc schema PostgreSQL PW2 cục bộ |
| `OBSERVED` | Chỉ đã quan sát trong artifact/preview tại thời điểm đối soát; chưa đủ bằng chứng tái tạo hoặc xác nhận mapping từ code. Nguồn snapshot được ghi riêng trong report |
| `DECISION` | Quyết định migration đã được ghi rõ trong tài liệu trên nhánh này |
| `UNRESOLVED` | Chưa chốt được mapping an toàn hoặc đầy đủ |

### Mã trạng thái xử lý

| Mã | Ý nghĩa |
|---|---|
| `D` | Sao chép trực tiếp sau khi chuyển kiểu và kiểm tra dữ liệu |
| `T` | Chuyển đổi theo quy tắc xác định |
| `R` | Phân giải quan hệ bằng `_ref` và bảng đối chiếu ID nguồn–đích |
| `G` | Giá trị tự sinh hoặc giá trị mặc định khi migration |
| `A` | Chỉ giữ trong nguồn lưu trữ/manifest; chưa có field đích hiện tại. Xem mục 15 để phân biệt lưu giá trị với chỉ lưu tham chiếu |
| `Q` | Bản ghi hoặc nhóm bản ghi liên quan bị cách ly, không xuất vào JSON chính |
| `X` | Chủ động loại trừ; thường là dữ liệu đã xóa, không đủ điều kiện hoặc nhạy cảm về bảo mật |
| `B` | Chưa thể hoàn tất do thiếu schema, cơ chế ghi, bộ chuyển đổi hoặc quyết định nghiệp vụ |

## 2. Cấu trúc bao ngoài của file JSON

Mỗi phần tử của mảng ngoài cùng tương ứng một Store PW1. Mỗi key bên trong là một collection Payload của PW2, không phải danh sách các bảng vật lý.

| Key JSON | Slug Payload | Bảng chính PW2 | Trạng thái |
|---|---|---|---|
| `tenants` | `tenants` | `tenants` | Đã quan sát xuất |
| `users` | `users` | `users` | Đã quan sát xuất |
| `sites` | `sites` | `sites` | Đã quan sát xuất |
| `pages` | `pages` | `pages` | Chưa chuyển đổi được các block nội dung |
| `media` | `media` | `media` | Dữ liệu dự kiến dùng URL ngoài |
| `categories` | `categories` | `categories` | Đã quan sát xuất một phần |
| `products` | `products` | `products` + 7 bảng con | Dữ liệu không hợp lệ bị cách ly |
| `customers` | `customers` | `customers` + `customers_addresses` | Đã quan sát xuất một phần |
| `discounts` | `discounts` | `discounts` | Chủ động đặt không hoạt động |
| `orders` | `orders` | `orders` + `orders_items` | Đối soát/cách ly theo từng Order |
| `discount_usage_history` | `discount_usage_history` | `discount_usage_history` | Chưa tính toán dữ liệu; contract tại §7.3 |
| `blog_categories` | `blog_categories` | `blog_categories` | Đã quan sát xuất một phần |
| `blogs` | `blogs` | `blogs` | JSON mẫu đã chuyển nội dung sang Lexical; còn gap renderer storefront/preview theo §8.2 |
| `email-template-settings` | `email-template-settings` | `email_template_settings` | Hoãn theo deferEmailTemplates; contract field tại §8.3 |
| `plan-subscriptions` | `plan-subscriptions` | `plan_subscriptions` | Chỉ là dữ liệu dự kiến |
| `plan-subscription-usages` | `plan-subscription-usages` | `plan_subscription_usages` | Chỉ là dữ liệu dự kiến |
| `notifications` | `notifications` | `notifications` | Hoãn theo acceptedExclusions; không nhận là đã map |
| `subscribers` | `subscribers` | `subscribers` | Hoãn theo acceptedExclusions; mapping nguồn chưa hoàn tất |
| `contact-submissions` | `contact-submissions` | `contact_submissions` | Hoãn theo acceptedExclusions; mapping nguồn chưa hoàn tất |
| `analytics` | `analytics` | `analytics` | Hoãn theo acceptedExclusions; mapping nguồn chưa hoàn tất |

### Quy tắc chung khi xuất JSON

| Đầu vào PW1 | Quy tắc JSON/PW2 | Trạng thái | Xác minh |
|---|---|---|---|
| Khóa chính nguồn | `_ref=@{collection}:{source_table}:{source_id}` | `T/R` | `CODE` |
| `_ref` | Chỉ là khóa đối chiếu logic; không ghi vào cột PW2 | `R` | `DECISION` |
| `_ref` của quan hệ | Phân giải sau khi có bản ghi cha; ghi khóa ngoại dạng số vào PW2 | `R` | `SCHEMA` |
| Datetime SQL không có độ lệch múi giờ | Diễn giải theo timezone/offset nguồn được xác nhận và truyền tường minh cho từng lần migration, sau đó xuất ISO-8601 UTC; không mặc định một offset cho mọi DB | `T` | `CODE` |
| Giá trị tùy chọn ở nguồn là null/rỗng | Bỏ thuộc tính đích; không ép thành 0/false/mốc thời gian epoch | `T` | `CODE` |
| `deleted_at` có giá trị | Loại khỏi dữ liệu xuất chính và ghi trạng thái lưu nguồn/cách ly | `X/A/Q` | `CODE` cho nhóm dữ liệu Product; các phần khác mới xử lý một phần |
| Mảng Payload | Giữ lồng trong JSON collection; bộ import tách thành bản ghi bảng con với `_parent_id` và `_order` | `T` | `SCHEMA` |
| URL ảnh PW1 | Kiểm tra URL HTTP(S) ngoài, giữ cùng giá trị ở `media.url` và `media.sourceUrl`; không tải ảnh hoặc upload S3 | `T/B` | `CODE`; chưa có cơ chế ghi hoàn chỉnh |

### 2.1 Contract đầy đủ của một object Store

File có kiểu mảng ngoài cùng, không có root `stores` hay wrapper `collections`. Mỗi phần tử có đúng các key sau; giá trị đều là mảng, kể cả collection không có bản ghi:

```json
[
  {
    "tenants": [],
    "users": [],
    "sites": [],
    "pages": [],
    "media": [],
    "categories": [],
    "products": [],
    "customers": [],
    "discounts": [],
    "orders": [],
    "discount_usage_history": [],
    "blog_categories": [],
    "blogs": [],
    "email-template-settings": [],
    "plan-subscriptions": [],
    "plan-subscription-usages": [],
    "notifications": [],
    "subscribers": [],
    "contact-submissions": [],
    "analytics": []
  }
]
```

Đây là **khung cấu trúc**, không phải một Store hợp lệ đã điền dữ liệu: Store được map phải có một Tenant và một Site. Hai Store là hai phần tử độc lập cùng cấu trúc; thêm Store không thêm key gốc. Thứ tự key giúp đọc/đối soát ổn định, không phải thứ tự thực thi ghi DB.

`collection-only` chỉ ràng buộc **tên key gốc**, không tuyên bố mọi field lồng bên trong đã thuộc Payload: `pages[]` hiện giữ raw PW1 theo §4.2; `sites[].menus[]` và `sites[].pw1_source` là phần bảo toàn nguồn nghiên cứu theo §4.1. `_ref` cũng là metadata vận chuyển. Các phần này phải được phân biệt với field PW2 và không được gửi nguyên vào API import. Dữ liệu đã xóa có thể nằm trong vùng raw; quy tắc loại khỏi dữ liệu vận hành không được dùng để xóa lịch sử raw.

### 2.2 Phạm vi collection và phụ thuộc dùng chung

| Nhóm | Phạm vi và quy tắc |
|---|---|
| Layer 1 chính thức | 14 collection trong khung trên, không tính `pages`, `email-template-settings` và bốn collection history cuối. Không gọi toàn bộ 20 collection là Layer 1 |
| Tenant đầy đủ dự kiến | 14 collection Layer 1 cộng `pages`, `email-template-settings`; đây là phạm vi mapping, không chứng nhận có thể import ngay |
| History tùy chọn | `notifications`, `subscribers`, `contact-submissions`, `analytics`; giữ key với `[]` khi chưa map, nhưng phải phân biệt chưa xác minh nguồn, nguồn rỗng đã xác minh và đang cách ly (§10). Có dữ liệu lịch sử cần quyết định retention |
| Catalog nền tảng | `templates`, `template-versions`, `template-quality-scores`, `block-catalog-entries`, `block-variants`, `template-issues`, `content-packs`, `plan-features` không nhân bản theo Store; dùng registry phụ thuộc đã xác minh khi cần |
| Trạng thái runtime/bảo mật | `subscriptions` của Stripe, `push-subscriptions`, `seo-meta-jobs`, `sso-step-events` không migrate mặc định và không thay thế `plan-subscriptions` |
| Ngoài root đang chốt | AI history, collection QA và các collection chưa tồn tại như Brand/Review/RankRule không tự bổ sung vào JSON. Giữ nguồn/disposition nếu phát hiện dữ liệu liên quan; không tạo schema mới theo tên bảng PW1 |

Quan hệ cần resolve theo dependency: Store → Tenant/Site; Media và User → các tham chiếu ảnh/actor; Category cha → Category con → Product; Customer/Product/Discount → Order → Discount usage; User/BlogCategory/Media → Blog; Plan registry → Subscription → Usage. Đây là **đồ thị phụ thuộc**, không phải plan viết importer: cycle/forward reference cần đối soát hai lượt; thứ tự gọi API không bỏ qua hook hoặc field access. Ma trận sở hữu đủ 20 collection ở §3.5 và các bảng con ở §11.

User có identity toàn hệ thống. Email trim/lowercase chỉ là khóa tìm trùng, không đủ chứng minh hai tài khoản là cùng người; chỉ hợp membership và dùng chung logical identity sau đối chiếu theo §3.7. Mọi crosswalk phải chứa namespace DB nguồn + bảng + ID; `_ref` thiếu namespace không tự an toàn khi ghép nhiều DB.

**Policy của lần export:** `migrationPolicy` và manifest phải ghi quyết định/evidence; config thiếu policy giữ hành vi legacy, không tự coi các ngoại lệ đã được bật. `deferredStoreIds` chỉ nhận ID Store live có trong snapshot và không trùng; Store 323 (VND) được hoãn toàn Store, không đổi tỷ giá hoặc áp shipping MYR. Manifest tách `policyExcludedStores` khỏi `blockedStores` và giữ nguyên nguồn.

`acceptedExclusions` theo `MASTER-2.2-OPTIONAL-HISTORY` hoãn riêng notifications/subscribers/contact-submissions/analytics; giữ key rỗng và lý do hoãn, không nhận là nguồn rỗng đã xác minh. Không gộp Order/refund/discount history hoặc email vận hành vào quyết định này. `deferEmailTemplates` áp riêng theo §8.3.

### 2.3 Disposition, bảo toàn nguồn và an toàn artifact

**Raw của exporter hiện tại:** `rawRow` chỉ xuất field nằm trong allowlist và giá trị vượt kiểm tra cấu trúc/key/URL/settings. Field nhạy cảm bị loại với `RAW_SECRET_EXCLUDED`; field chưa được khai báo hoặc giá trị chưa xác minh bị bỏ khỏi object với `RAW_FIELD_UNVERIFIED`/`RAW_VALUE_UNVERIFIED`. Field được nhận giữ nguyên giá trị CSV, không đồng nghĩa mọi field nguồn đều có trong raw JSON. Phần không xuất còn trong CSV snapshot ngoài artifact, kèm disposition/diagnostic theo field; không đưa credential trở lại JSON để đạt đủ cột. Số cột ở các bảng bên dưới là inventory nguồn cần đối soát, không phải số field được bảo đảm emit trên mọi record.

Mỗi field/bản ghi trong phạm vi phải được phân loại rõ: đã map, đã chuyển đổi, giữ nguyên nguồn, cách ly, chủ động loại trừ có lý do, hoặc gap chưa xử lý. Phải có đích/path thực tế hoặc nguồn lưu giữ kiểm chứng được; nhãn `A`/`RAW` và `archiveRef` không chứng minh giá trị đã nằm trong JSON. Bảng 103 cột tích hợp tại §18 chỉ kiểm kê tám bảng Category–Product–EAV, không phải bằng chứng đủ mọi bảng DB.

- Khóa/cột lạ không tự trở thành field Payload. Field đích có thật nhưng khác semantics là hỗ trợ một phần; field chỉ gần nghĩa không được ghi như exact mapping đã tồn tại.
- Giữ null/rỗng nguyên dạng trong vùng raw; field đích tùy chọn theo rule từng collection, không tự tạo `0`, `false`, ngày epoch hoặc giá trị mặc định để che nguồn thiếu. Ngày sinh giữ date-only nếu có quyết định map, không đổi thành instant UTC.
- Tiền theo từng field, không theo toàn collection: Product/Order giá chính dùng major units; Discount fixed và Order discountAmount theo §7. Khối lượng Product kg, kích thước cm; Order parcelWeight gram. Không đoán đơn vị từ enum chưa xác minh.
- Timestamp nguồn phải có timezone/offset đã xác nhận. Lịch sử cha không thay timestamp con; thời điểm export/import không thay lịch sử PW1.
- Không copy password/hash, OTP/session/MFA, API key/payment secret hoặc ciphertext credential vào payload review. Raw của mẫu enrich lịch sử có thể chứa dữ liệu nội bộ như `dns_token` (§4.1); exporter hiện tại loại field nhạy cảm theo quy tắc trên. File mẫu là artifact nội bộ hạn chế truy cập, **chưa được chứng nhận sạch bí mật để chia sẻ công khai**, không gọi là portable JSON an toàn. Không in giá trị nhạy cảm vào master/log; workflow chia sẻ hoặc import phải xử lý disposition bảo mật riêng.
- Manifest/hash/archive hiện có chỉ là hồ sơ đối soát kỹ thuật ngoài bộ hai file bàn giao. Không yêu cầu người đọc ghép thêm một tài liệu contract; nếu cần chứng minh độ phủ thực tế, phải dùng đúng snapshot/hash, không lấy số liệu cũ làm quy tắc chung.

## 3. Tenant, User và quan hệ sở hữu dữ liệu

Nhóm này xác định danh tính và quyền sở hữu dùng chung cho Layer 1 và Layer 2. Các mục 3.1–3.2 phân biệt JSON hiện tại với contract đã chốt nhưng chưa đồng bộ generator; mục 3.3–3.8 đối chiếu source PW1/PW2, ghi rõ quy tắc đã xác minh và phần cần bổ sung.

### 3.1 Tenant

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `stores.id` | Định danh nguồn ổn định | `tenants[]._ref` | Chỉ dùng đối chiếu ID migration | `R` | `CODE` |
| `stores.id` | Giữ ID Store cũ | `tenants[].metaData.pw1StoreId` | `tenants.meta_data` JSONB | `T` | `CODE/SCHEMA` |
| `stores.name` | Bỏ khoảng trắng thừa và kiểm tra | `tenants[].name` | `tenants.name` | `D` | `OBSERVED/SCHEMA` |
| `store_domains.domain` qua `store_id = stores.id`, `is_default=1`, `deleted_at` rỗng | Chọn đúng một domain mặc định; xác minh hậu tố nền tảng PW1 rồi tách subdomain theo quy tắc bên dưới. Không sinh lại từ tên Store | `tenants[].slug` | `tenants.slug` | `T/B` | `DECISION/SCHEMA`; generator còn lấy tên Store |
| `stores.status` + User owner đã xác minh + subscription main | Áp dụng ma trận trạng thái bên dưới; không chỉ xét Store và không xuất enum `inactive` | `tenants[].status` | `tenants.status` | `T/B` | `DECISION/SCHEMA`; generator chưa đồng bộ |
| `stores.hotline` | Đọc JSON và lấy giá trị đầu tiên | `tenants[].whatsappNumber` | `tenants.whatsapp_number` | `T` | `CODE/SCHEMA` |
| `stores.address` | Đọc JSON/chuỗi và chuẩn hóa | `tenants[].businessAddress` | `tenants.business_address` | `T` | `OBSERVED/SCHEMA` |
| `stores.address` | Bộ chuẩn hóa theo schema hiện tại loại giá trị đơn kiểu cũ | `tenants[].address` | `tenants.address` JSONB | `A/B` | `CODE/SCHEMA` |
| `stores.id → plan_subscriptions.subscribable_id` (subscribable_type là Store), `plan_subscriptions.plan_id → plans.id` | Lấy đăng ký main thực tế từ DB PW1, kiểm tra trạng thái/thời hạn tại mốc dữ liệu nguồn và đối chiếu mã gói sang enum Tenant PW2. Thiếu, mâu thuẫn hoặc chưa có mã tương đương thì cần đối soát; không tự mặc định free. Xem mục 9.1 | `tenants[].plan` | `tenants.plan` | `R/T/B` | `DECISION/SCHEMA`; generator chưa áp dụng đầy đủ |
| Không có | Trạng thái migration | `tenants[].migrationStatus` | `tenants.migration_status` | `G` (`pending`) | `OBSERVED/SCHEMA` |
| Không có | Khởi tạo hạn mức mặc định an toàn | `tenants[].settings.*` | `tenants.settings_*` | `G` | `OBSERVED/SCHEMA` |
| Không có | Khởi tạo trạng thái hoàn tất hướng dẫn ban đầu là false | `tenants[].onboardingCompleted` | `tenants.onboarding_completed` | `G` | `OBSERVED/SCHEMA` |
| Không có nguồn lịch sử slug tương đương trong source/model/migration PW1 đã kiểm tra | Không áp dụng mapping nguồn; khởi tạo `[]`, không suy lịch sử slug/hạn redirect từ domain PW1 | `tenants[].previousSlugs[]` | `tenants_previous_slugs` (Payload array); `slug` → `slug`, `expiresAt` → `expires_at` | `G`; không phải gap migration | `DECISION/SCHEMA`; xem §11 |
| `store_domains` cùng Store, chưa xóa, đã phân loại là custom domain | Lưu hostname chuẩn hóa tương thích PW2, raw giữ riêng; khởi tạo `pending`/`isPrimary=false`; không suy custom chỉ từ `is_default=0`. Pending chưa bảo đảm chặn routing (§16) | `tenants[].customDomains` | `tenants_custom_domains` | `T/G/B` | `DECISION/SCHEMA`; generator hiện vẫn đặt `[]` |
| `stores.description`, `currency_id` | Schema Tenant hiện tại chưa có đích mapping được chốt | Không xuất | Lưu nguồn; chỉ dùng làm dữ liệu phụ thuộc cho SEO/tiền tệ của Site | `A` | `CODE/SCHEMA` |
| `stores.created_at` | Lấy CSV Store theo ID, chuyển ISO UTC theo offset snapshot; thiếu/sai định dạng thì dừng xuất. Importer phải bảo toàn thời gian nguồn | `tenants[].createdAt` | `tenants.created_at` | `T` | `CODE/SCHEMA`; chưa xác minh qua importer |
| `stores.updated_at` | Lấy CSV Store theo ID, chuyển ISO UTC theo offset snapshot; không dùng thời gian chạy generator. Importer phải tránh ghi đè | `tenants[].updatedAt` | `tenants.updated_at` | `T` | `CODE/SCHEMA`; chưa xác minh qua importer |
| `stores.created_by` | Người tạo Store, không phải owner; tạm ngoài phạm vi theo quyết định hiện tại, giữ CSV nguồn | Không xuất | Không bổ sung field PW2 | `A` | `DECISION` |
| Cấu hình và thông tin xác thực thanh toán/tích hợp | Chưa hoàn tất mapping theo provider/field; không loại toàn bộ cấu hình cùng với secret | Các nhóm thanh toán/tích hợp còn thiếu; xem mục 17 | Có đích cho một phần cấu hình; tương thích provider và cơ chế credential còn phải xử lý | `B` | `OPEN — GAP-PAYMENT-INTEGRATION-01` |

**Contract trạng thái Tenant (2026-09-15):** đọc cùng Store, User owner chưa xóa (đối chiếu `is_store_owner` với role `owner` theo §3.3–3.4) và subscription `main` theo §9 tại mốc `asOf` có timezone nguồn đã xác minh. Không dùng trạng thái của một nhân viên thay trạng thái cả Store. PW2 chỉ nhận `active`, `trialing`, `past_due`, `cancelled`, `suspended`; `inactive` không phải enum Tenant.

| Bằng chứng nguồn | Quyết định mapping / disposition |
|---|---|
| Store status=3 và owner được xác minh có status=3 cùng banned_at hợp lệ; không có bằng chứng mâu thuẫn | `tenants[].status=suspended`; giữ nguyên dấu vết ban nguồn. Đây là trạng thái đình chỉ Tenant, không phải hủy subscription |
| Store status=1, owner status=1, không có banned_at hoặc mâu thuẫn lifecycle; subscription main đã đối soát theo §9 | `tenants[].status=active` về trạng thái tài khoản. Không đồng nghĩa subscription còn hiệu lực, không gia hạn/đổi gói và không tự publish Site |
| Chỉ User không phải owner bị ban (status=3 và banned_at hợp lệ) | Membership User đó → `suspended`; không suy Tenant bị ban. Trạng thái Tenant vẫn quyết định từ Store/owner/subscription |
| Store status=0 và owner status=0, không có bằng chứng ban hoặc mâu thuẫn lifecycle; main đã đối soát | `tenants[].status=suspended` theo quyết định migration giữ tài khoản chưa hoạt động (`TENANT_INACTIVE_HOLD`). Không diễn giải thành bị ban, hủy gói hoặc nợ phí |
| Store status=2 và owner status=2; expired_at của owner hợp lệ và ≤ asOf; main thực sự ended theo §9, không có trial còn hiệu lực hay bằng chứng mâu thuẫn | `tenants[].status=suspended` theo quyết định giữ tài khoản hết hạn (`TENANT_EXPIRED_HOLD`); bảo toàn subscription và thời hạn nguồn, không gia hạn |
| Store/owner khác trạng thái (kể cả Store=2, owner=1), owner status=2 nhưng hạn còn tương lai/thiếu hạn, hoặc expired không khớp main/trial | `B — TENANT_LIFECYCLE_CONFLICT`: cách ly để đối soát, chưa xuất Tenant vận hành. Không tự chọn active hoặc sửa trạng thái nguồn chỉ vì nhận diện được nhánh unban |
| Store hoặc owner đã xóa; owner thiếu/nhiều/mâu thuẫn; status null/rỗng/ngoài miền; hoặc status và banned_at mâu thuẫn | `B`: giữ raw và lý do, không tự khôi phục hoặc nhận default active; không fallback owner đầu tiên. Lỗi của non-owner chỉ cách ly User/membership đó, không tự chặn toàn Tenant |

**Quy tắc áp dụng đã chốt:** kiểm tra đầu vào trước khi chọn dòng trong ma trận. Status chỉ nhận số nguyên hoặc chuỗi chính xác `0`, `1`, `2`, `3`; không ép null/chuỗi rỗng thành 0. Timestamp phải phân giải được theo timezone nguồn; ban phải có `banned_at ≤ asOf`, trạng thái không ban phải không còn dấu ban chưa giải thích. Dữ liệu xóa/mâu thuẫn được cách ly trước, không để một dòng active khác ghi đè. Main thiếu/nhiều hoặc chưa phân giải gói vẫn là blocker riêng của §9; không cấp gói mặc định.

`verified_at` không phải điều kiện bắt buộc chung cho owner: [luồng tạo owner](/home/liam/data/prime-web-api/app/Repositories/EloquentUserRepository.php:168) nhận status nguồn nhưng không ghi field này. Thiếu timestamp riêng lẻ không phủ định status=1; phải xác minh đúng owner và các điều kiện lifecycle bên trên. Không tạo ngày xác minh giả; có `verified_at` cũng không được ghi đè status inactive/expired/banned.

Các mã disposition ở đây là contract tài liệu, lưu trong sổ đối chiếu ngoài Payload, không phải field mới hoặc mã đã triển khai. Bản ghi cách ly vẫn được bảo toàn trong nguồn lưu trữ; chỉ đưa vào tập import vận hành sau khi có kết quả đối soát rõ ràng.

**Bằng chứng lifecycle PW1:** [ban owner](/home/liam/data/prime-web-api/app/Repositories/EloquentUserRepository.php:302) ghi Store status=3 và ban/thu hồi token mọi User chưa xóa cùng Store; ban non-owner chỉ tác động User đó. [User.ban/unBan](/home/liam/data/prime-web-api/app/Models/User.php:227) ghi/xóa banned_at và đổi status. [updateStatus](/home/liam/data/prime-web-api/app/Repositories/EloquentUserRepository.php:271) có thể đặt verified_at khi chuyển active: verified_at không tự chứng minh tài khoản hiện được phép hoạt động. [Gia hạn qua email](/home/liam/data/prime-web-api/app/Http/Controllers/Users/UserController.php:496) cập nhật expired_at cho User cùng Store và renew main; do đó phải đối chiếu cả hai nguồn, không lấy hạn User thay subscription một cách máy móc.

**GAP-TENANT-LIFECYCLE — OPEN:** [isExpired()](/home/liam/data/prime-web-api/app/Models/User.php:155) hiện trả `expired_at > now`; [unban owner](/home/liam/data/prime-web-api/app/Repositories/EloquentUserRepository.php:329) dựa vào hàm này để ghi Store status=2 hoặc 1, trong khi unban các User đưa status về active. Không sao chép predicate này thành quy tắc migration và không kết luận Store status=2 chứng minh hết hạn. So sánh instant expired_at với asOf, đối soát main/trial/cancel theo §9; chênh lệch phải giữ nguyên bằng chứng và có disposition, không tự sửa lịch sử. Trạng thái hết hạn/hủy của subscription không tự tương đương enum billing của Tenant.

Căn cứ PW2: [enum Tenant](../../src/collections/Tenants.ts:288), [SSO ban ghi suspended](../../src/app/api/v1/sso/ban-user/route.ts:50), [session-check đình chỉ](../../src/app/api/auth/session-check/route.ts:77). Không coi các điểm kiểm tra này là bằng chứng mọi route đều chặn, nhất là membership suspended (§3.7). Giữ status/banned_at/expired_at/verified_at/deleted_at nguồn trong archive/crosswalk có kiểm soát, không thêm field Payload hoặc dùng timestamp giả.

**Tracking 2026-09-15:** thay rule Tenant `1/khác → active/inactive` bằng đối soát Store–owner–subscription; phân biệt ban owner/staff và ghi GAP-TENANT-LIFECYCLE. Chỉ sửa master; JSON mẫu, generator và runtime chưa đồng bộ/kiểm chứng, không đánh dấu gap vận hành đã đóng.

**Bổ sung tracking — chốt disposition lifecycle:** đã chốt inactive/expired nhất quán → suspended theo quyết định migration; trạng thái mâu thuẫn → cách ly thay vì tự kích hoạt. Phần quyết định mapping đã có quy tắc, nhưng GAP-TENANT-LIFECYCLE vẫn mở cho việc áp dụng/kiểm chứng và đối soát bản ghi thực tế; không sửa lỗi `isExpired()` nguồn hoặc cơ chế chặn truy cập PW2 trong scope tài liệu.

**Contract tenant slug từ domain mặc định (2026-09-15):**

- Chỉ chọn dòng cùng Store, chưa xóa và `is_default=1`; thiếu hoặc nhiều dòng thì block mapping slug để đối soát, không lấy dòng đầu theo ID. `is_main` là lựa chọn địa chỉ chính, không phải căn cứ chọn slug.
- Xác minh hậu tố nền tảng PW1 theo môi trường/lịch sử nguồn; không mặc định cấu hình hiện tại đúng cho mọi domain legacy. Chuẩn hóa hostname để so khớp (trim, lowercase, bỏ dấu chấm cuối), nhưng giữ nguyên hostname nguồn và ID trong nguồn/crosswalk. Chỉ bỏ đúng hậu tố có ranh giới dấu chấm; phần còn lại phải là một DNS label, giữ hậu tố chống trùng cũ như `-2`, không slugify lại.
- Kiểm tra quy tắc PW2: 3–63 ký tự chữ thường/số/gạch ngang, không chỉ toàn số, không có gạch ngang ở hai đầu; kiểm tra reserved slug và trùng toàn hệ thống. Không hợp lệ, không khớp hậu tố, hoặc trùng thì cần quyết định đối soát; không tự thêm hậu tố, nhận Tenant đã có, hay fallback sang `stores.name`.
- `stores.name` vẫn là nguồn tên Tenant. JSON mẫu đã áp dụng tách slug từ default domain PW1; generator vẫn chưa đồng bộ. Hậu tố nguồn của mẫu là `web.dev.ecommercehub.my`, đối chiếu `FRONTEND_DOMAIN` hiện tại với CSV; không suy hậu tố này đúng cho mọi nguồn/lịch sử. Chưa xác minh collision slug toàn hệ thống hoặc routing PW2.

Căn cứ PW1: [tạo domain mặc định từ tên và chống trùng](/home/liam/data/prime-web-api/app/Repositories/EloquentUserRepository.php:119), [quan hệ domain của Store](/home/liam/data/prime-web-api/app/Models/Store.php:153), [chuyển domain legacy từ stores](/home/liam/data/prime-web-api/database/migrations/2021_11_03_065754_init_store_domains_data.php:18). Phải xác minh hostname legacy ngay cả khi có cờ default.

### 3.2 User và quan hệ thành viên tenant

Xuất tất cả User nghiệp vụ thuộc Store (`users.store_id`, chưa xóa, `users.is_frontend=0`), gồm owner và staff; không loại staff chỉ vì chưa đối chiếu permission chi tiết. Dùng bằng chứng Role/Permission để xác minh owner và phân loại staff theo chính sách §3.4, không sao chép cấu trúc phân quyền PW1. Lỗi dữ liệu bắt buộc/trạng thái mâu thuẫn vẫn phải đối soát, không tự kích hoạt hoặc bỏ âm thầm.

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `users.id` | Định danh ổn định | `users[]._ref` | Chỉ dùng đối chiếu ID | `R` | `OBSERVED` |
| `users.store_id` | Giới hạn theo Store | Object Store chứa bản ghi | `users_tenants.tenant_id` sau khi phân giải tham chiếu | `R` | `OBSERVED/SCHEMA` |
| `users.email` | Giữ giá trị, kiểm tra hợp lệ và loại trùng toàn hệ thống | `users[].email` | `users.email` | `D/B` | `OBSERVED/SCHEMA` |
| `users.name` | Trim, tách theo `/\s+/`, lấy token đầu; null/rỗng/chỉ whitespace thì chặn mapping User để đối soát, không fallback email | `users[].firstName` | `users.first_name` | `T/B` | `DECISION/SCHEMA`; JSON mẫu đã đồng bộ, preview script chưa đồng bộ |
| `users.name` | Các token còn lại nối bằng một dấu cách; tên một token → chuỗi rỗng | `users[].lastName` | `users.last_name` | `T` | `DECISION/SCHEMA`; JSON mẫu đã đồng bộ, preview script chưa đồng bộ |
| `users.phone` | Giữ giá trị/chuẩn hóa | `users[].phone` | `users.phone` | `D` | `OBSERVED/SCHEMA` |
| `users.is_store_owner` + vai trò/quyền PW1 | Xác minh owner trước → `["tenant-owner"]`; non-owner có bằng chứng chỉ đọc rõ ràng hoặc được chỉ định chỉ đọc → `["viewer"]`; non-owner còn lại mặc định `["editor"]`, kể cả chưa đối chiếu permission chi tiết. Mâu thuẫn owner không dùng fallback staff; xem thứ tự §3.4 | `users[].roles[]` | `users_roles.value` | `T/B` | `DECISION/SCHEMA` |
| `users.is_store_owner` + vai trò/quyền PW1 | Cùng thứ tự phân loại trên: owner → `owner`; non-owner có bằng chứng/chỉ định chỉ đọc → `viewer`; non-owner còn lại mặc định `editor`. Không tự cấp `admin`; không dùng fallback để bỏ qua mâu thuẫn owner | `users[].tenants[].role` | `users_tenants.role` | `T/B` | `DECISION/SCHEMA` |
| `users.status` và dữ liệu banned/expired/verified | Preview đã quan sát dùng active/suspended; enum PW2 chỉ có pending/active/suspended, không có inactive. Quy tắc đầy đủ xem mục 3.4–3.8 | `users[].tenants[].status` | `users_tenants.status` | `T/B` | `OBSERVED/SCHEMA` |
| Tham chiếu tenant của Store | Phân giải tenant | `users[].tenants[].tenant` | `users_tenants.tenant_id` | `R` | `OBSERVED/SCHEMA` |
| Quyền trực tiếp và qua vai trò PW1 | Chủ động để `[]`; dùng role chuẩn PW2, không dựng permission chi tiết hoặc role `custom` | `users[].tenants[].permissions[]` | `users_tenants_permissions.value` | `G` | `DECISION/SCHEMA` |
| `users.profile_picture` | Tạo Media dùng URL ngoài rồi phân giải | `users[].avatar` | `users.avatar_id → media.id` | `T/R/B` | `OBSERVED/SCHEMA` |
| `users.last_login_at` | Múi giờ bản export → UTC | `users[].lastLoginAt` | `users.last_login_at` | `T` | `CODE/SCHEMA` |
| `users.created_by` | Phân giải User cùng tenant hoặc actor registry đã xác minh theo §3.4; cần bind User đích | `users[].createdBy` | `users.created_by_id` | `R/B` | `OBSERVED/SCHEMA` |
| Không có | Giá trị mặc định | `prefer_lang`, `has_seen_ai_wizard`, `migrationStatus`, `otpAttempts` | Các cột `users.*` tương ứng | `G` | `OBSERVED/SCHEMA` |
| `roles`, `model_has_roles`, các bảng liên kết quyền | Bằng chứng xác minh owner/phân loại staff; non-owner mặc định editor theo quyết định migration, chỉ dùng viewer khi có bằng chứng/chỉ định chỉ đọc; không loại User vì chưa đối chiếu permission chi tiết | Kết quả ở `roles[]` và `tenants[].role`; nguồn chi tiết giữ trong archive | Không thêm bảng role/permission | `T/A` | `DECISION/SCHEMA` |
| `password`, `key_string`, token, dữ liệu MFA | Không sao chép dữ liệu xác thực PW1 | Không xuất | Đặt lại/đăng ký lại tại PW2 | `X` | `CODE/DECISION` |
| Địa chỉ, email dự phòng, ngày sinh, giới tính, tên đăng nhập, hướng dẫn sử dụng, thời gian lịch sử | Chưa chốt mapping đích hiện tại | Không xuất | Lưu nguồn | `A` | `CODE` |

**Contract tách tên (2026-09-15):** sau khi loại nguồn null/rỗng/chỉ whitespace, dùng `parts = name.trim().split(/\s+/)`, `firstName = parts[0]`, `lastName = parts.slice(1).join(' ')`. Đây là quy tắc phân chia token cho PW2, không suy luận họ/tên chính xác theo văn hóa. Giữ nguyên `users.name` raw trong archive nguồn để đối soát; không thêm field Payload. Tên một token có `lastName: ''`; không lấy email thay cho tên thiếu.

**Bằng chứng và giới hạn:** [Users.ts](/home/liam/data/ech-prime-web-v2/src/collections/Users.ts:1158) yêu cầu `firstName`, còn `lastName` tùy chọn. [SSO provision](/home/liam/data/ech-prime-web-v2/src/app/api/v1/sso/provision/route.ts:59) đã dùng quy tắc trim, tách whitespace, lấy token đầu/phần còn lại; đây không phải bằng chứng transformer migration đã triển khai. [Hiển thị profile](/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/settings/profile/_components/profile-utils.ts:10) ghép hai field bằng dấu cách; fallback email của UI không áp dụng cho mapping nguồn. Preview script hiện vẫn đặt toàn bộ tên vào `firstName` và `lastName: null`; JSON mẫu đã biểu diễn quyết định mới, không chứng minh generator đã đồng bộ.

**GAP-USER-NAME-VALIDATION — OPEN (runtime profile):** [profilePatchSchema](/home/liam/data/ech-prime-web-v2/src/lib/profile/schemas.ts:4) áp dụng `min(2).max(50)` cho từng chuỗi tên được gửi; `optional()` cho phép bỏ field, không cho phép chuỗi rỗng. [Form profile dành cho staff](/home/liam/data/ech-prime-web-v2/src/app/(dashboard)/settings/profile/_components/general-info-tab.tsx:25) dùng cùng schema, khởi tạo cả hai tên (thiếu thành `''`) và gửi các giá trị form. Vì vậy tên một token (`lastName: ''`), `firstName`/`lastName` một ký tự hoặc dài hơn 50 ký tự có thể chặn lưu form, kể cả khi chỉ muốn sửa số điện thoại; bỏ `lastName` lúc import không giải quyết mặc định `''` của form. [PATCH /api/users/me](/home/liam/data/ech-prime-web-v2/src/app/api/users/me/route.ts:99) trả 400 khi tên được gửi vi phạm schema, trước `payload.update`; request chỉ gửi phone không tự bị lỗi tên đã lưu. Owner có luồng profile chỉ đọc và bị guard của API chặn trước validation; gap form này thuộc luồng staff.

**Phân biệt import và cập nhật profile:** collection `Users` khai báo `firstName` bắt buộc, `lastName` tùy chọn và không đặt `minLength`/`maxLength` cho hai field. Đây là ràng buộc collection, khác validator của API profile; chưa xác minh schema DB đích hoặc toàn bộ đường import. Gap runtime trên không tự chứng minh tên đã mất dữ liệu hay không thể import. Tên nguồn null/rỗng/chỉ whitespace vẫn phải cách ly User để đối soát theo contract; giữ raw và định danh nguồn, không bỏ âm thầm hoặc thay bằng email. Tên hợp lệ nhưng vướng độ dài/minimum runtime giữ nguyên kết quả split, không cắt, đệm hay ghép lại để né validator.

**Đích tương thích đề xuất — chưa triển khai:** `firstName` không rỗng, chấp nhận token một ký tự; `lastName` cho phép rỗng hoặc một ký tự; giữ nguyên phần tên dài nếu schema DB đích cho phép. Cần xác minh sức chứa DB và đồng bộ validation giữa collection/import, schema profile và form/API trước khi đóng gap. Nếu DB không chứa được, giữ raw và cách ly để quyết định, không tự truncate. Bằng chứng đóng gap phải gồm đối soát round-trip tên một token, một ký tự, trên 50 ký tự và lưu profile/sửa phone với các tên đó; kiểm tra tên nguồn rỗng vẫn bị cách ly.

**Tracking 2026-09-15:** contract tách tên và JSON mẫu đã được ghi nhận ở trên. Lần rà soát gap này chỉ cập nhật tài liệu §3.2, bổ sung bằng chứng collection/form/API và tiêu chí đóng `GAP-USER-NAME-VALIDATION`; không sửa JSON, script, schema hoặc runtime PW2. Gap vẫn OPEN; không đánh dấu transformer migration hay validation tương thích đã triển khai.

### 3.3 Phạm vi định danh dùng chung cho Layer 1 và Layer 2

Đối chiếu ngày 2026-09-10 trên worktree PW1 backend `/home/liam/data/prime-web-api` (HEAD `250916d4`) và PW2 hiện tại (HEAD `69aafc685`), cùng bằng chứng snapshot được lưu riêng. Đây là bằng chứng từ source đang có, không phải xác nhận đã triển khai mọi mapping hoặc đã kiểm thử phân quyền end-to-end.

**Phải tách ba khái niệm:** Store/Tenant sở hữu dữ liệu; User là thành viên được cấp quyền; `created_by` là người tạo bản ghi. Ba quan hệ này không đồng nghĩa.

| Quan hệ nguồn đã xác minh | Quy tắc khi biểu diễn ở PW2 | Trạng thái |
|---|---|---|
| `Store.users()` ↔ `users.store_id`; mỗi User PW1 có một store_id | Một User PW2 có `tenants[]`; mỗi phần tử là membership riêng, không sao chép store_id thành khóa chính User | SCHEMA; cần bảng đối chiếu ID |
| `users.is_store_owner=1` + vai trò `owner` | Dùng cả hai bằng chứng để xác minh owner; lệch nhau phải đối soát, không tự nâng quyền | Đề xuất quy tắc B |
| `stores.created_by → users.id` qua `BelongToUser` | Người tạo Store có thể là quản trị hệ thống ngoài Store; không dùng làm owner của Tenant | CODE nguồn |
| `stores.id` | Contract chọn một Tenant và một Site cho mỗi Store; giữ hai bảng đối chiếu riêng Store→Tenant và Store→Site | Quyết định migration, không phải mô hình Site vật lý PW1 |
| `stores.frontend_template_id` | Là tham chiếu template, không phải Site ID hoặc Tenant ID PW2 | SCHEMA nguồn; chuyển đổi giao diện còn B |
| `store_domains.store_id` | Nhiều domain có thể cùng một Store; không suy ra mỗi domain là một Site mới | SCHEMA nguồn; xem mục 16 |
| `StoreScope.apply()` | Chỉ tự thêm điều kiện store_id khi có user đăng nhập; CSV/CLI phải lọc Store và kiểm tra quan hệ rõ ràng | CODE nguồn; không dựa vào scope ngầm khi export |

Nguồn: [Store.php](/home/liam/data/prime-web-api/app/Models/Store.php), [User.php](/home/liam/data/prime-web-api/app/Models/User.php), [StoreScope.php](/home/liam/data/prime-web-api/app/Scopes/StoreScope.php), [BelongToUser.php](/home/liam/data/prime-web-api/app/Models/Concerns/BelongToUser.php), [luồng tạo owner](/home/liam/data/prime-web-api/app/Repositories/EloquentUserRepository.php:165).

### 3.4 Nguồn vai trò, quyền và trạng thái User

**Scope đã chốt:** dùng mapping sang role/membership PW2 hiện có để User được migrate sử dụng hệ thống; không triển khai ma trận permission chi tiết tương đương PW1. Các mô tả quyền chi tiết tại §3.4–3.8 là bằng chứng giới hạn và rủi ro, không phải yêu cầu mở rộng phân quyền. Vẫn phải bảo toàn tenant isolation, trạng thái tài khoản và tránh tự nâng quyền; không suy rằng role cùng tên đã có quyền tương đương.

PW1 dùng Spatie với guard `api`. Vai trò nằm trong bảng dùng chung; quyền của User phải lấy cả quyền trực tiếp và quyền qua vai trò. Route còn kiểm tra vai trò/permission, policy kiểm tra Store và middleware kiểm tra gói; danh sách permission không tự biểu diễn hết quyền thực thi.

| Nguồn PW1 / quan hệ nối | Đích hoặc cách xử lý ở PW2 | Trạng thái |
|---|---|---|
| `model_has_roles.model_id → users.id`, `role_id → roles.id`; lọc `model_type=App\Models\User` và guard phù hợp | Bằng chứng vai trò nguồn; không copy role_id sang enum PW2 | R/B |
| `model_has_permissions.model_id → users.id`, `permission_id → permissions.id`; cùng discriminator User | Bằng chứng quyền trực tiếp để phân loại staff; đối chiếu cùng quyền kế thừa, không chuyển thành grant PW2; `permissions[]=[]` | R/A |
| `model_has_roles.role_id → role_has_permissions.role_id → permissions.id` | Quyền kế thừa; hợp theo ID permission, loại trùng; giữ nguồn từng grant trong sổ đối chiếu | R/B |
| `roles.name`, `permissions.name/guard_name` | Từ điển ngữ nghĩa nguồn; không tạo collection roles/permissions mới trong JSON PW2 | A/B |
| `users.is_frontend=1` | Luồng tạo Store tạo User kỹ thuật frontend và gán role member; không import thành staff và không tự map thành Customer | X cho staff; lịch sử actor cần lưu tham chiếu |
| `users.status`: 0 inactive, 1 active, 2 expired, 3 banned | PW2 membership chỉ có pending/active/suspended. Ban đã xác minh → suspended; phân biệt owner/staff theo §3.1. Không ghi enum inactive/expired/banned vào membership; các trạng thái thiếu/mâu thuẫn tiếp tục đối soát | DECISION/SCHEMA; không tự kích hoạt |
| `users.banned_at/expired_at/verified_at/deleted_at` | Đối soát trước khi kích hoạt; pending của PW2 biểu thị lời mời chưa chấp nhận, không tự tương đương inactive PW1 | B; không tự bật tài khoản |
| `users.created_by` | `users[].createdBy → users.created_by_id` qua User cùng tenant hoặc actor registry theo §3.4 và binding đích đã xác minh; không gán thay bằng owner | R/B |
| `user_has_model(user_id, model_type, model_id)` | Source repository dùng cho liên kết Campaign/Brand; không phải bảng membership Store | A/B; không suy ra quyền tenant |

**Hai cấp quyền PW2 cần ghi riêng:**

**Contract trạng thái membership (bổ sung):** áp dụng cho User nghiệp vụ đủ điều kiện import, không phải User frontend kỹ thuật. Status=0, không có dấu ban mâu thuẫn → `suspended` để giữ inactive; status=3 cùng banned_at hợp lệ → `suspended`; status=2 cùng expired_at hợp lệ ≤ asOf → `suspended`. Status=1 không có bằng chứng ban/hết hạn mâu thuẫn → `active`; thiếu verified_at riêng lẻ không đủ để tự đổi trạng thái, nhưng phải đối soát nếu có bằng chứng quy trình kích hoạt chưa hoàn tất. Status/timestamp không hợp lệ, đã xóa, hoặc bằng chứng xung đột → cách ly User/membership, không fallback active/pending. `pending` chỉ dành cho quy trình lời mời PW2 thực sự, không dùng thay inactive. Quy tắc này không khôi phục password/token PW1.

Tenant bị suspended không tự ghi đè mọi membership thành suspended: bảo toàn quyết định từng User, kiểm tra cả hai lớp khi vận hành. Ngược lại, một staff suspended không làm Tenant suspended. Membership suspended chưa chứng minh mọi route PW2 đã từ chối truy cập; gap thực thi tại §3.7 vẫn phải được xử lý trước khi cho tài khoản đó đăng nhập.

| Đường dẫn JSON | Đích vật lý | Giá trị/schema hiện tại |
|---|---|---|
| `users[].roles[]` | `users_roles.value` | Vai trò toàn nền tảng: super-admin, tenant-owner, editor, viewer |
| `users[].tenants[].tenant` | `users_tenants.tenant_id`; `_parent_id → users.id` | Tenant của membership; id bản ghi membership là varchar |
| `users[].tenants[].role` | `users_tenants.role` | owner, admin, editor, viewer, custom; không có staff |
| `users[].tenants[].status` | `users_tenants.status` | pending, active, suspended |
| `users[].tenants[].permissions[]` | `users_tenants_permissions.value` | products, orders, blog, builder, settings; UI chỉ hiện khi role=custom |
| Quan hệ/thứ tự của permission | `users_tenants_permissions.parent_id`, `order` | parent_id trỏ ID membership, không trỏ User/Tenant; khác tên cột `_parent_id/_order` của array |

Luồng mời nhân viên PW2 hiện dùng `roles: []` cho người không phải owner và đặt quyền trong membership; vì vậy platform role editor không phải yêu cầu bắt buộc của mọi luồng PW2. Riêng artifact migration này chủ động ghi cả hai cấp theo bảng bên dưới. Không tự migrate `super_admin` PW1 thành `super-admin` PW2 trong một gói tenant.

**Chính sách mapping role đơn giản đã chốt (2026-09-16):** đây là quyết định migration được chấp thuận, không phải bằng chứng quyền PW1 và PW2 tương đương từng thao tác.

**Thứ tự quyết định bắt buộc:** xác minh owner riêng trước; cờ/role owner thiếu hoặc mâu thuẫn phải đối soát theo §3.1, không đẩy xuống fallback staff. Với User đã xác định là non-owner, chỉ chọn viewer khi có bằng chứng giới hạn chỉ đọc rõ ràng hoặc có chỉ định chỉ đọc của người duyệt migration; điều kiện này ưu tiên hơn tên role nguồn, kể cả `manager`. Non-owner còn lại mặc định editor theo quyết định migration đã được người dùng chấp thuận, không yêu cầu role manager hoặc hoàn tất đối chiếu permission chi tiết. “Có bằng chứng chỉ đọc” là kết luận từ quyền trực tiếp/kế thừa và ngữ nghĩa nguồn đã đối chiếu, không suy ra chỉ vì thiếu dữ liệu quyền hoặc nhìn thấy một quyền đọc riêng lẻ. Nếu bằng chứng chỉ đọc xung đột với quyền sửa, giữ viewer trong artifact và ghi xung đột để đối soát trước kích hoạt, không tự nâng lên editor. Mặc định editor là chính sách xuất dữ liệu, không chứng minh quyền runtime tương đương PW1.

**Cách áp dụng trong exporter hiện tại:** người đối soát phải đưa ID nguồn của non-owner đã xác minh/chỉ định chỉ đọc vào `readOnlyUserIds` ở cấp gốc source config, ngoài `migrationPolicy`. Mapper so khớp chuỗi ID chính xác; danh sách mặc định `[]`. Owner đã xác minh vẫn ưu tiên owner; non-owner có ID trong danh sách thành viewer, còn lại thành editor. Exporter không tự phân tích quyền trực tiếp/kế thừa để suy viewer và không tự sinh diagnostic xung đột quyền chỉ đọc/quyền sửa. Bằng chứng phân loại và xung đột cần được giữ trong hồ sơ đối soát bên ngoài; danh sách ID/evidence phải được kiểm tra trước chạy, không suy việc parse config thành công là đã xác minh danh tính. File config được pin qua `sourceConfigSha256`; manifest không sao chép riêng danh sách `readOnlyUserIds`.

| Phân loại User nghiệp vụ PW1 | `users[].roles[]` | `users[].tenants[].role` | Quy tắc |
|---|---|---|---|
| Owner: `is_store_owner=1` và role `owner` đã xác minh đúng User/guard | `["tenant-owner"]` | `owner` | Cờ/role mâu thuẫn vẫn đối soát theo §3.1; không tự nâng quyền |
| Non-owner có bằng chứng/chỉ định chỉ đọc và ID nguồn đã ghi vào readOnlyUserIds, kể cả có role `manager` | `["viewer"]` | `viewer` | Config thực thi kết quả đối soát, ưu tiên trước mặc định editor; yêu cầu kiểm chứng runtime chặn ghi tại §3.7, không coi tên viewer tự bảo đảm chỉ đọc |
| Non-owner còn lại, kể cả chưa xác định permission chi tiết hoặc có role nguồn khác manager | `["editor"]` | `editor` | Mặc định theo chính sách migration đã chốt; vẫn xuất User, ghi giới hạn/chênh lệch quyền đã biết trong sổ đối chiếu; không cấp `admin` |

Tất cả các trường hợp dùng `tenants[].permissions: []`; không tự tạo role `custom`, không sao chép password/token/MFA. Membership giữ `active`/`suspended` theo contract trạng thái, không suy trạng thái từ role. Phải đối soát toàn bộ User nghiệp vụ chưa xóa của Store: mỗi User có bản ghi xuất hoặc lý do cách ly dữ liệu cụ thể; “chưa map permission chi tiết” không phải lý do loại staff. User frontend kỹ thuật vẫn không xuất thành staff.

**Giới hạn quyền còn lại:** PW1 nhóm `web_builder` gần builder; `content_manager` bao gồm Product/Blog/Media/email template; `sale_operation` gồm Order/Promotion/Customer/Rank; `settings` gồm User/payment/delivery/domain. PW2 chỉ có năm permission theo tính năng, không tách CRUD. Mapping role chuẩn trên có thể thu hẹp hoặc mở rộng một số thao tác so với nguồn; giữ đây là gap không bảo đảm tương đương quyền chi tiết, không chặn xuất User chỉ để chờ nghiên cứu permission. Không coi việc xuất đủ User là bằng chứng đã kiểm thử đăng nhập/phân quyền end-to-end; tenant isolation và chặn membership suspended vẫn cần kiểm tra trước vận hành (§3.7).

Nguồn: [permission tables PW1](/home/liam/data/prime-web-api/database/migrations/2019_02_20_061843_permission_tables.php), [nhóm quyền PW1](/home/liam/data/prime-web-api/config/common.php:43), [UserTransformer](/home/liam/data/prime-web-api/app/Transformers/Common/UserTransformer.php:96), [routes PW1](/home/liam/data/prime-web-api/routes/web.php), [Users PW2](../../src/collections/Users.ts:1174), [DDL membership](../../scripts/db-setup.js:73), [permission IDs PW2](../../src/lib/permissions.ts).

`preserveUserCreators`: giữ users.created_by thành users.createdBy theo source reference; không tự gán owner nếu actor nguồn là hệ thống. Actor cùng tenant phải nằm trong User đã emit. Actor global phải live, không Store, nonfrontend và có identity/status/timestamps/chain hợp lệ. created_by=0 là sentinel, không tạo User 0. Actor foreign tenant hoặc thiếu/không hợp lệ vẫn unresolved.

Tài khoản global dùng chung được ghi một lần vào **user-actors.json**, sidecar identity dependency có hash trong manifest, namespace nguồn/snapshot, không phải Payload User được cấp quyền. Sidecar giữ name/email/role nguồn/status/timestamps và creator chain nhưng không chứa credentials, memberships hoặc PW2 roles. Ngoại lệ relationship chỉ áp đúng users.createdBy trực tiếp tới registry đã validate; không cho Blog.author/Product/nested refs mượn ngoại lệ. Registry refs không được trùng document master; chain/identity/provenance phải đầy đủ.

Importer phải resolve source actor sang User ID PW2 qua crosswalk đã xác minh, giữ đúng actor 1/51 theo danh tính, không copy số PK hoặc nhân bản User theo từng Store; ghi createdBy không để hook ghi đè thành người chạy import. TARGET_USER_CREATOR_BINDING_REQUIRED giữ việc chưa resolve tài khoản đích là target gate. Offline exporter không tạo tài khoản đích, không cấp role super-admin/member theo suy đoán. Không thêm creator field trên collection khác; Blog.author giữ contract riêng.

Creator preflight chỉ lập kế hoạch source identity → User ID đích theo target instance và provenance đã xác minh; email một mình không đủ để bind. Không tự cấp role, tạo tài khoản hoặc ghi DB. Creator chain phải resolve đầy đủ; thiếu target vẫn là gate của importer.

### 3.5 Ma trận sở hữu của toàn bộ 20 collection JSON

Các field dưới đây là schema đích đã kiểm tra trong `src/collections/*.ts`. Có field đích không có nghĩa nguồn PW1 tương ứng đã được chuyển đổi. Các mảng đang rỗng vẫn phải tuân thủ quan hệ này khi được bổ sung.

| Collection JSON | Nguồn xác định Store PW1 | Quan hệ sở hữu PW2 và cột vật lý |
|---|---|---|
| `tenants` | stores.id | Bản ghi gốc; ID PW2 do hệ thống đích cấp |
| `users` | users.store_id + vai trò/quyền | users_tenants.tenant_id; User toàn hệ thống có thể có nhiều membership ở schema |
| `sites` | stores.id theo quyết định Store→Site | sites.tenant_id |
| `pages` | pages.store_id | pages.site_id → sites.tenant_id; không có field tenant gốc của Page |
| `media` | medias.store_id hoặc chủ sở hữu đối tượng chứa ảnh | Schema Media.ts chưa khai báo tenant, trong khi DB có media.tenant_id; chưa có cơ chế sở hữu thống nhất — B |
| `categories` | categories.store_id | categories.tenant_id + categories.site_id |
| `products` | products.store_id | products.tenant_id + products.site_id; Category/Media liên quan phải được kiểm tra thêm |
| `customers` | customers.store_id | customers.tenant_id; không thêm site vào Customer |
| `discounts` | promotion_codes.promotion_id → promotions.store_id | discounts.tenant_id + discounts.site_id |
| `orders` | orders.store_id | orders.tenant_id + orders.site_id; Customer/Product/Discount liên quan phải cùng phạm vi |
| `discount_usage_history` | Chưa tính; cần Order và Discount đã map | discount_usage_history.tenant_id + discount_id + order_id; không có site trực tiếp |
| `blog_categories` | blog_categories.store_id | blog_categories.tenant_id; không có site trực tiếp |
| `blogs` | blog_posts.store_id | blogs.tenant_id + blogs.site_id |
| `email-template-settings` | store_email_templates.store_id | email_template_settings.tenant_id |
| `plan-subscriptions` | subscribable_type=App\Models\Store + subscribable_id | plan_subscriptions.tenant_id; không coi mọi subscribable_id là Store |
| `plan-subscription-usages` | subscription_id → đăng ký gói của Store | plan_subscription_usages.subscription_id → plan_subscriptions.tenant_id |
| `notifications` | notifications.store_id + notifiable_type/id | notifications.tenant_id + notifications.user_id; người nhận phải phân giải đúng User |
| `subscribers` | Chưa chốt nguồn PW1 | subscribers.site_id → sites.tenant_id |
| `contact-submissions` | Chưa chốt nguồn PW1 | contact_submissions.site_id → sites.tenant_id |
| `analytics` | Chưa chốt nguồn PW1 | analytics.tenant_id + analytics.site_id |

Với field site và tenant cùng tồn tại, điều kiện cần kiểm tra là `document.tenant == document.site.tenant`. Với bảng con không có store_id như page_components hoặc order_details, phải đi qua cha đã xác minh; không dùng created_by làm đường nối thay thế. Với model_settings, phải kiểm tra đồng thời store_id, model_type và model_id; Settings của Store/Page/PageComponent/MenuLine không dùng chung một kiểu đích. Bổ sung được duyệt 2026-09-17: chỉ riêng model_type=App\Models\Store có store_id thiếu/rỗng được resolve qua model_id bằng đúng Store hiện tại còn sống; giữ nguyên raw store_id, ghi contribution MASTER_RAW_STORE_MODEL_OWNERSHIP và warning RAW_OWNERSHIP_RESOLVED_FROM_STORE_MODEL. Có store_id khác Store, model khác, cha thiếu/xóa vẫn bị chặn; không suy quyền/membership từ resolver.

### 3.6 Actor lịch sử không phải quyền sở hữu

| Nguồn hoặc dữ liệu cần có | Đích PW2 | Quy tắc |
|---|---|---|
| blog_posts.created_by → users.id | blogs.author_id | Map tác giả nếu User phân giải được và thỏa phạm vi; đây là mapping ngữ nghĩa cần giữ lịch sử |
| users.created_by → users.id | users.created_by_id | Giữ người tạo; actor ngoài tenant cần sổ đối chiếu hệ thống hoặc lưu nguồn, không tự cấp membership |
| Không có bằng chứng người sửa cuối trong CSV User | users.updated_by_id | Không thay bằng created_by; updated_at không cho biết ai sửa |
| store_email_templates.created_by | email_template_settings.updated_by_id không tương đương | Người tạo khác người sửa cuối; để chưa map nếu thiếu bằng chứng đúng vai trò |
| orders.created_by | orders.payment_verified_by_id không tương đương | Người tạo đơn khác người xác minh thanh toán; không tự gán |
| products/categories/customers/pages/stores.created_by | Không có field createdBy tương ứng trong các collection gốc đã rà | Lưu tham chiếu actor trong nguồn/manifest; không tạo field giả |
| notifications.notifiable_type/id | notifications.user_id | Người nhận thông báo, không phải người tạo/chủ Store |

Nguồn PW2: [Blog author](../../src/collections/Blogs.ts:241), [User actors](../../src/collections/Users.ts:1287), [Email updatedBy](../../src/collections/EmailTemplateSettings.ts:207), [Order paymentVerifiedBy](../../src/collections/Orders.ts:299). Field author nằm trong một block Page dạng text không phải quan hệ User gốc của Page.

### 3.7 Giới hạn thực thi PW2 và các gate cần bổ sung

- [requirePermission](../../src/lib/permission-guard.ts:5) hiện coi owner/admin/editor/viewer là quyền rộng; riêng custom mới xét permission theo tính năng. Chính sách xuất viewer tại §3.4 không chứng minh runtime đã cưỡng chế chỉ đọc; không coi tên role là biện pháp hạ quyền an toàn. Phải kiểm chứng/chặn các thao tác ghi trước khi kích hoạt tài khoản cần chỉ đọc.
- Helper này đọc `tenants[0]`, chặn pending nhưng không kiểm tra suspended tại chính helper. [Customers](../../src/collections/Customers.ts:34), [Sites](../../src/collections/Sites.ts:64) và [Orders](../../src/collections/Orders.ts:77) có nhánh lọc tenant nhưng không đồng thời kiểm tra toàn bộ status/role/permission. Đây là giới hạn của các đoạn đã rà; chưa kết luận mọi route đều bỏ qua suspended. Trước kích hoạt cần kiểm chứng xuyên suốt auth → route → collection.
- Schema User cho phép nhiều tenant nhưng helper quyền chưa xử lý chọn tenant đầy đủ. Không gộp User khác Store chỉ vì trùng email; phải chốt đối chiếu identity, membership và tenant đang chọn trước.
- Quyền User khác quyền lợi gói dịch vụ. PW1 [FeatureMiddleware](/home/liam/data/prime-web-api/app/Http/Middleware/FeatureMiddleware.php) đọc subscription main của Store; PW2 [Products access](../../src/collections/Products.ts:282) còn kiểm tra product_management. Có membership hợp lệ chưa đủ để thao tác Product.
- staff_limit phải đối soát theo quy tắc PW2: [recountStaffUsage](../../src/lib/subscriptions/plan-subscription.ts:176) đếm thành viên không phải owner, không chỉ status active. Không dùng số user PW1, số user frontend hoặc số tài khoản active để thay trực tiếp.
- Bảng đối chiếu ngoài JSON cần khóa `(sourceInstanceToken, sourceTable, sourceId)` và ID Tenant/Site/User đích. `_ref` hiện chỉ đủ trong bộ mẫu một nguồn; token SKU Product chưa làm toàn bộ _ref an toàn khi hợp nhất nhiều nguồn.
- Xác minh tối thiểu trước kích hoạt: owner không mâu thuẫn; đúng enum membership; không cấp quyền vượt role/quyết định migration đã duyệt theo §3.4; actor không bị gán sang owner; mọi quan hệ cùng tenant; miền dùng chung/template không bị chiếm thành dữ liệu tenant. Kiểm chứng xuyên suốt các luồng được sử dụng: tài khoản cần chỉ đọc không ghi được dữ liệu, trạng thái suspended thực sự bị chặn và không truy cập chéo tenant; chưa đạt thì chưa kích hoạt tài khoản chịu ảnh hưởng.
- Ghi rõ chênh lệch quyền đã biết giữa PW1 và role PW2 trong sổ đối chiếu: quyền nào bị thu hẹp/mở rộng, căn cứ chọn role và quyết định chấp thuận. Mapping đơn giản §3.4 không yêu cầu chứng minh tương đương CRUD chi tiết để xuất User, nhưng không cho phép bỏ qua hạn chế chỉ đọc đã xác minh hoặc coi JSON đúng enum là chứng nhận runtime an toàn. Trường hợp chưa kiểm chứng phải giữ trạng thái gap, không ghi là đã hoạt động tương đương PW1.

### 3.8 Kiểm tra membership và phần còn thiếu

Phải đối chiếu từng User: owner flag với role nguồn; trạng thái, frontend discriminator và tenant sở hữu; dùng bằng chứng quyền sẵn có để phân loại theo chính sách §3.4. Chưa đối chiếu permission chi tiết không chặn xuất staff: non-owner mặc định editor; chỉ dùng viewer khi có bằng chứng chỉ đọc rõ ràng hoặc chỉ định chỉ đọc. Áp dụng ma trận lifecycle §3.1: ban staff không đình chỉ cả Tenant; ban owner ảnh hưởng Store và các User cùng Store theo bằng chứng nguồn. Không suy quyền thực thi tương đương chỉ từ tên role; actor ngoài Store không tự trở thành thành viên. Permission hợp chưa bao gồm mọi bypass route/policy.

Artifact migration dùng permissions rỗng và role chuẩn theo quyết định §3.4; đây không phải mapping quyền tương đương. Các preview helper dùng trong research trước đây không phải artifact bàn giao và không được xem là generator/importer của repo. Cần thống nhất mọi luồng chuyển đổi với chính sách đã chốt, kiểm thử suspended/tenant context và quyền chỉ đọc, sổ actor ngoài tenant và hạn mức. Việc cập nhật tài liệu/JSON không chứng minh generator hoặc runtime đã hoàn tất.

## 4. Site, Page và Media

### 4.1 Site

**Bổ sung nguồn PW1 đầy đủ cho phạm vi Page/component/header/footer:** `sites[].pw1_source` là vùng raw của artifact nghiên cứu, không phải field Payload PW2. Các helper enrich dùng khi research là công cụ cục bộ, không thuộc bộ bàn giao hoặc CLI được hỗ trợ. Không bỏ dữ liệu chỉ vì chưa có collection đích.

| Đường dẫn trong pw1_source | Nguồn và phạm vi |
|---|---|
| store | Inventory 23 field stores theo ID; chỉ emit field/value qua bộ lọc raw §2.3, gồm social_channel/frontend_template_id/logo/favicon/timestamps khi hợp lệ |
| model_settings[] | Mọi setting model_type=App\\Models\\Store, model_id=Store ID; kiểm tra store_id |
| frontend_template | Bản ghi frontend_templates được Store tham chiếu, field/value qua bộ lọc raw §2.3; không có tham chiếu thì null |
| brands[] / categories[] / products[] / blog_categories[] / blog_posts[] | Bản ghi nguồn thuộc Store, kể cả deleted/status khác active; field/value qua bộ lọc raw §2.3, không chỉ record đã map vận hành |

Độ phủ raw phải đối soát theo từng bảng và Store, gồm nguồn template nếu có; raw row không chứng minh đã xuất đệ quy mọi bảng con Product hoặc toàn bộ DB PW1.

social_channel nằm ở `sites[].pw1_source.store.social_channel`, giữ chuỗi JSON nguồn; không tự map/ghi đè `sites[].socialLinks`. Đối soát shortlist phải tìm bản ghi nguồn cả trong raw catalogs/pages; tìm được raw Brand không đóng mapping collection Brand PW2.

Menu/footer vẫn ở `sites[].menus[]`; Page raw và component vẫn ở `pages[]`. Settings/default/config/HTML chỉ giữ nguyên khi vượt kiểm tra raw §2.3; phần bị loại giữ ở CSV nguồn và diagnostic, không thêm giá trị suy diễn, không tự merge default hay tạo liên kết filter-listing. Nguồn là thư mục CSV snapshot được chọn cho lần chạy; script không đọc DB live. Snapshot không có dòng thì giữ mảng rỗng; không đồng nhất với file nguồn thiếu. File đã chọn không tồn tại, CSV không hợp lệ, thiếu bảng stores hoặc lỗi toàn vẹn nguồn làm lần chạy thất bại. Bảng cần dùng chưa được chọn có thể sinh SOURCE_TABLE_NOT_SELECTED thay vì dừng ngay. Template được tham chiếu nhưng thiếu thì frontend_template=null kèm RAW_TEMPLATE_MISSING; child/setting raw sai ownership bị bỏ kèm diagnostic. Các lỗi raw này không tự dừng toàn exporter hoặc loại Store: nếu identity/schema/quan hệ vận hành vẫn hợp lệ, Store có thể được emit trong artifact needs_review. Identity không hợp lệ hoặc lỗi quan hệ vận hành xử lý ở cấp Store theo validator; có artifact không chứng minh raw đã đầy đủ.

**Phân biệt artifact:** các mô tả backup/idempotence và Store có dns_token thuộc mẫu enrich lịch sử. Exporter hiện tại tạo artifact mới với manifest/hash, loại token/field nhạy cảm khỏi raw JSON theo §2.3. Artifact vẫn có thể chứa dữ liệu riêng tư; không coi việc lọc credential là chứng nhận được chia sẻ công khai.


| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `stores.id` | Một Site cho mỗi Store trong bộ dữ liệu nghiên cứu | `sites[]._ref` | Chỉ dùng đối chiếu ID | `R/G` | `OBSERVED` |
| Tham chiếu Tenant | Phân giải chủ sở hữu | `sites[].tenant` | `sites.tenant_id` | `R` | `SCHEMA` |
| `stores.name` | Giữ nguyên | `sites[].name` | `sites.name` | `D` | `OBSERVED/SCHEMA` |
| Không có | Trạng thái khởi tạo an toàn khi migration | `status=draft`, `generationStatus=none` | `sites.status`, `generation_status` | `G` | `OBSERVED/SCHEMA` |
| Ngữ cảnh thương mại của Store | Policy được duyệt: mặc định ecommerce; override theo Store bằng enum PW2 hợp lệ, không suy từ ngành template | `siteType` | `sites.site_type` | `G/T` | `DECISION/SCHEMA`; xem quy tắc policy tại mục này |
| Quyết định ngôn ngữ khi migration | Mặc định `ms` | `locale`, `generationLocale` | `sites.locale`, `generation_locale` | `G/B` | `OBSERVED/SCHEMA` |
| `stores.name` | Giá trị thay thế cho SEO | `sites[].seo.metaTitle` | `sites.seo_meta_title` | `T` | `OBSERVED/SCHEMA` |
| `stores.description` | Mô tả SEO | `sites[].seo.metaDescription` | `sites.seo_meta_description` | `D` | `OBSERVED/SCHEMA` |
| Tham chiếu Media logo Store | Phân giải tham chiếu | `sites[].seo.ogImage` | `sites.seo_og_image_id` | `R/B` | `OBSERVED/SCHEMA` |
| `stores.logo`, `favicon` | URL PW1 đã kiểm tra, dùng trực tiếp trong JSON cuối | `sites[].branding.logo/favicon` | `sites.branding_logo`, `branding_favicon` | `T` | `CODE/SCHEMA` |
| `stores.hotline/email/address` | Chuẩn hóa | `sites[].contactInfo.*` | `sites.contact_info_*` | `T` | `OBSERVED/SCHEMA` |
| `store_deliveries` + Store mode/currency | Giữ runtime PW2; fixed self-delivery hợp lệ → rate hai vùng cùng mức, config không tương đương theo policy defaults/review; không bật provider | `sites[].shippingConfig` | `sites.shipping_config_*` | `T/G/B` | `DECISION/CODE`; xem quy tắc policy tại mục này |
| `store_payments.payment_method_id → payment_methods.id`, code=`cod`, trạng thái và deleted_at của cấu hình/provider | Áp dụng quyết định COD §17; đồng bộ với `tenants[].payments.payment_cod`, không hardcode ID provider hoặc nhận default PW2 | `sites[].paymentConfig.enableCod` | `sites.payment_config_enable_cod` | `T/B` | `OBSERVED/SCHEMA`; JSON mẫu đã đối soát nguồn; generator cũ chưa đồng bộ |
| Quyết định chưa kích hoạt provider chưa xác minh tương thích | Ghi tường minh false cho QR/thẻ/FPX; không suy PW1 vốn tắt các phương thức này | `sites[].paymentConfig.enableQrBanking/cardEnabled/fpxEnabled` | `sites.payment_config_enable_qr_banking`, `payment_config_card_enabled`, `payment_config_fpx_enabled` | `G/B` | `DECISION/OBSERVED/SCHEMA`; xem §17 |
| Domain vận hành PW2 từ Tenant và môi trường đích đã xác minh | Custom domain chính đã active, nếu không có thì hostname từ tenant slug + platform domain PW2; chưa xác định thì chưa thiết lập và ghi gap. Không copy main domain PW1 làm dữ liệu lưu trữ ở đây | `sites[].domain` | `sites.domain` | `T/G/B` | `DECISION/SCHEMA`; JSON mẫu đã áp dụng môi trường staging được chọn; generator chưa đồng bộ |
| `stores.social_channel` | Chưa chuyển đổi | `sites[].socialLinks={}` | `sites.social_links_*` | `A/B` | `OBSERVED/SCHEMA` |
| Dữ liệu template/menu/banner/component | Chưa có bộ chuyển đổi Page/block | Bị loại hoặc để rỗng | Các field block của `sites` và các bảng block của Page | `A/B` | `CODE` |
| `stores.created_at`, `updated_at` | Đã xuất nguyên chuỗi timestamp PW1 trong `pw1_source`; chưa map sang `sites[].createdAt/updatedAt` của PW2, không tự đổi múi giờ ở bản raw | `sites[].pw1_source.store.created_at`, `sites[].pw1_source.store.updated_at` | `sites.created_at`, `sites.updated_at` là đích chưa map; đường dẫn raw không phải field Payload PW2 | `D` raw / `B` mapping PW2 | `CODE/OBSERVED/SCHEMA` |

**Vai trò sites.domain — thay thế quy tắc giữ main domain PW1 trước đây:** đây là field vận hành được [API sitemap](../../src/app/api/seo/sitemap/route.ts:47) ghép thành `https://${site.domain}` và [keyword tracking](../../src/app/api/seo/keywords/route.ts:127) dùng để kiểm tra thứ hạng, đồng thời được hiển thị trong quản trị/editor. Không coi là nơi lưu nguồn vô hại: domain cũ/sai có thể tạo sitemap hoặc kiểm tra SEO cho sai website.

**Quy tắc đích:** chỉ lưu hostname chuẩn hóa, không protocol/path/port/query. Ưu tiên đúng một custom domain đã xác minh `active` và `isPrimary=true`; nếu không có, dùng `tenants.slug` đã chốt với platform domain của môi trường PW2 đã xác minh. Nhiều primary, domain chưa tương thích, slug hoặc môi trường chưa xác định thì `B`, chưa thiết lập field; không dùng hostname PW1 hoặc placeholder thay thế. URL localhost dạng `/sites/{slug}` là URL phát triển, không ghi vào field hostname này. Field chưa thiết lập không chứng minh SEO an toàn: fallback sitemap hiện dùng site.slug, keyword tracking dùng site.name; phải kiểm chứng trước khi dùng các chức năng đó.

Routing thực tế tìm Tenant bằng slug hoặc customDomains rồi tìm Site qua tenant; không tìm Tenant bằng sites.domain. [Publish](../../src/app/api/sites/[siteId]/publish/route.ts:498) tính URL trả về từ Tenant; [storefront](../../src/app/sites/[slug]/[[...path]]/page.tsx:357) tính origin rồi ghi đè domain trong dữ liệu truyền renderer. Đây không phải bằng chứng sites.domain trong DB tự được đồng bộ. **GAP-SITE-DOMAIN-SYNC — OPEN:** khi đổi slug, domain chính hoặc môi trường phải đối soát sites.domain với hostname vận hành; không giả định publish/set-primary đã cập nhật field này. Chưa sửa runtime.

**Bảo toàn domain PW1:** giữ toàn bộ dòng store_domains cùng Store (gồm lịch sử đã xóa), nguyên ID/hostname/cờ/trạng thái/timestamps trong nguồn lưu trữ có kiểm soát và crosswalk. JSON mẫu đã bổ sung `sites[].pw1_source.store_domains[]`, giữ toàn bộ 13 cột CSV dưới dạng chuỗi nguồn, gồm cả dòng đã xóa; đây là vùng raw nghiên cứu, không phải field Payload. Chọn đúng một dòng chưa xóa `is_main=1` để ghi nhận domain chính nguồn; thiếu/nhiều main thì ghi gap provenance, không fallback theo ID/default và không dùng để suy domain vận hành PW2. Default domain vẫn là nguồn tách tenant slug (§3.1). PW1 đổi main còn cập nhật callback thanh toán; lưu dữ liệu không thay kiểm chứng payment/cutover (§17). Căn cứ: [đổi main PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentStoreDomainRepository.php:217).

**Tracking 2026-09-15 — áp dụng domain vào JSON mẫu:** người dùng chọn môi trường đích staging `web-v2.dev.ecommercehub.my`; mẫu ghi `sites[].domain = tenants[].slug + '.web-v2.dev.ecommercehub.my'` khi chưa có custom primary đã active. Custom domain chưa xóa ngoài hậu tố nền tảng nguồn đã phân loại được ghi `pending`/`isPrimary=false`, toàn bộ domain nguồn giữ raw như trên. Ghi chú này thay thế hiện trạng “JSON chưa đồng bộ/chưa có raw store_domains” trong các tracking domain trước đó; không thay lịch sử quyết định. Generator chưa đồng bộ; chưa xác minh collision slug/domain với DB PW2 đích, quyền sở hữu, DNS/HTTPS, binding Vercel hoặc routing/cutover. JSON mẫu chưa được chứng nhận sẵn sàng import. Các gap runtime vẫn OPEN; chọn môi trường và cập nhật artifact không chứng nhận hostname đã phục vụ website.

`siteTypeDefault=ecommerce`; `siteTypeOverrides` chỉ nhận 11 enum Sites và ID Store còn sống có trong nguồn đã chọn. Không suy ngành template thành loại website. No-policy vẫn có SITE_TYPE_DEFAULT_REQUIRES_REVIEW.

Shipping **giữ runtime PW2**, không thêm tier PW1. Fixed self-delivery duy nhất, live/active/configured, Store chọn self và currency MYR: fee nguồn RM chuyển chính xác sang sen, không round; westRate=eastRate, freeAbove=null. Config vượt giới hạn rate PW2 hoặc không tương đương chuyển theo `shippingPolicy`: `pw2-defaults` ghi 800/1500 sen, freeAbove=null và warning thay cấu hình nguồn; `review` để unresolved, không nhận là đã cấu hình. Currency khác MYR vẫn blocker. Provider/EasyParcel không tự bật, không mang token/credential vào artifact. shippingSetupConfirmed=false vì chưa có thao tác merchant xác nhận; field này không phải checkout gate. Site/Product vẫn draft theo contract.

Phí Order lịch sử được giữ từ total_shipping sau kiểm tra tiền/tổng, không chạy lại getRates. Các khác biệt PW2 về subtotal sau discount, fallback, COD và retry-payment không được mô tả là parity PW1.

### 4.2 Page

**Contract JSON nghiên cứu hiện tại: raw PW1, không phải Page Payload PW2.** Exporter xử lý Page đúng Store (kể cả đã xóa) trong Store được emit; 19 cột sau là inventory nguồn. Chỉ field/value vượt bộ lọc raw §2.3 được giữ nguyên trong JSON; phần không xuất được ghi diagnostic và giữ CSV nguồn:

`id`, `store_id`, `name`, `name_ms`, `slug`, `content`, `parent_id`, `position`, `url`, `config`, `type`, `status`, `title`, `meta_description`, `meta_tag`, `created_by`, `created_at`, `updated_at`, `deleted_at`.

- slug/title lấy nguyên PW1, không phải URL/tên đã chuyển đổi PW2; url/name được giữ riêng.
- Chỉ `_ref` là mã đối chiếu tạo thêm. Không xuất site/layout/seo/isHomepage/isVisible hoặc default Page PW2.
- `components[]` giữ raw component, frontend_component và ba mảng con đã bổ sung. `model_settings[]` trực tiếp trên Page lấy đúng discriminator App\\Models\\Page, model_id và store_id; phải phân biệt nguồn không có dòng với chưa đọc/lỗi đọc.
- Page sắp position số, rỗng cuối, ID tăng dần khi bằng nhau; không khôi phục/publish dữ liệu lịch sử. Số lượng và coverage ghi theo lần chạy.
- Mọi dữ liệu ngoài pages giữ nguyên khi xuất raw Page. Menu/social thuộc Site; social_channel đã bổ sung riêng tại sites[].pw1_source.store.social_channel (mục 4.1).
- Generator current-schema và các script enrich cũ không phải pipeline tái tạo raw Page. Dùng script raw mới cho contract này; manifest PW2 chưa cập nhật. Script sao lưu trước khi ghi, kiểm tra component hiện có khớp nguồn và dữ liệu ngoài pages không đổi.

**Bảng dưới là mapping PW2/generator cũ để tham khảo, không còn mô tả pages[] của JSON nghiên cứu hiện tại.** Những ghi chú layout=[]/isVisible=false trong lịch sử phía dưới cũng không áp dụng cho raw Page.


| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `pages.id` | Định danh ổn định | `pages[]._ref` | Chỉ dùng đối chiếu ID | `R` | `CODE` |
| Tham chiếu Site của Store | Phân giải tham chiếu | `pages[].site` | `pages.site_id` | `R` | `CODE/SCHEMA` |
| `pages.name` | Giữ nguyên | `pages[].title` | `pages.title` | `D` | `CODE/SCHEMA` |
| `pages.url`, nếu không có thì áp dụng quy tắc trang chủ/slug | `url || ('/' for home) || '/' + slug` | `pages[].slug` | `pages.slug` | `T` | `CODE/SCHEMA` |
| `pages.url='/'` hoặc `type='1'` | Cờ đánh dấu trang chủ | `pages[].isHomepage` | `pages.is_homepage` | `T` | `CODE/SCHEMA` |
| `pages.title` | Tiêu đề SEO | `pages[].seo.title` | `pages.seo_title` | `D` | `CODE/SCHEMA` |
| `pages.meta_description` | Mô tả SEO | `pages[].seo.description` | `pages.seo_description` | `D` | `CODE/SCHEMA` |
| Không có | Giá trị mặc định thận trọng | `pages[].seo.noIndex=false` | `pages.seo_no_index` | `G` | `CODE/SCHEMA` |
| `pages.status` | Chỉ chuyển thành cờ hiển thị boolean | `pages[].isVisible` | `pages.is_visible` | `T` | `CODE/SCHEMA` |
| `page_components.*` | Cách ly toàn bộ component thuộc Page đúng Store và chưa bị xóa; không lọc `page_components.status`. Chi tiết mục 4.2.1 | `pages[].layout=[]` | Không ghi bản ghi nào vào các bảng `pages_blocks_*` | `Q/B` | `CODE` |
| `pages.content/config/name_ms/meta_tag/parent_id` | Chưa chốt phép chuyển đổi | Không xuất | Lưu nguồn | `A/B` | `CODE` |
| `pages.created_at`, `updated_at`, `deleted_at` | JSON nghiên cứu giữ nguyên chuỗi PW1, gồm cả Page đã xóa; generator current-schema vẫn lọc Page chưa xóa | `pages[].created_at/updated_at/deleted_at` (raw PW1) | Chưa chuyển thành field timestamp Payload; không tự đổi múi giờ | `D` raw / `B` mapping | `CODE/OBSERVED` |

#### 4.2.1 PageComponent — nội dung và cấu hình từng khối trong Page

**Luồng enrich lịch sử Page cũ:** script nhận `--include-deleted-pages` cùng đủ ba CSV con, bổ sung Page nguồn còn thiếu và timestamps raw. Page lịch sử từng được thêm với `isVisible=false`, `components=[]` nếu không có dòng con; giữ thứ tự cũ, append theo position/ID, không tự tạo nội dung. Đây là hành vi enrich cũ, không áp dụng default PW2 vào contract raw Page ở đầu mục 4.2. Generator/manifest current-schema chưa đồng bộ.

**Bản JSON nghiên cứu giữ dữ liệu PW1:** `pages[].components[]` chứa field/value nguồn vượt bộ lọc raw §2.3 và ba mảng con dưới đây; cột bị loại giữ CSV nguồn cùng diagnostic. Đây không phải field/block Payload PW2; mô tả cách ly/`layout=[]` bên dưới vẫn áp dụng cho generator current-schema, không phải sự vắng mặt dữ liệu thô trong JSON nghiên cứu.

| Mảng con của component | Điều kiện nối | Inventory nguồn; emit theo bộ lọc raw §2.3 |
|---|---|---|
| `model_settings[]` | `model_type=App\Models\PageComponent`, `model_id=component.id`, `store_id` đúng Store của Page | Inventory 14 cột CSV, gồm key/value, parent_id, field, signature, status; không gộp thành object key–value |
| `banners[]` | `page_component_id=component.id`, `store_id` đúng Store | Inventory 18 cột CSV, gồm ảnh/link, cấu hình header/subheader/button, position và deleted_at |
| `shortlist_items[]` | `page_component_id=component.id`; sở hữu qua Page, không dùng created_by | Inventory 14 cột CSV, giữ model_type/model_id, shortlist_id, ảnh/CTA, position, deleted_at; chưa nhúng đối tượng tham chiếu |

Giá trị qua bộ lọc raw §2.3 giữ nguyên dạng CSV, gồm chuỗi rỗng/status/soft-delete; JSON/key/URL chưa xác minh bị bỏ khỏi raw JSON và ghi diagnostic, bản gốc còn trong CSV snapshot. Settings sắp ID tăng dần; banner/item theo position số, rỗng cuối, cùng position thì ID tăng dần. Mảng rỗng xuất `[]`. Bản ghi đã xóa là lịch sử, không coi là nội dung đang hiển thị.

Script nhận ba CSV con theo thứ tự model_settings, banners, shortlist_items sau target/components/pages; hỗ trợ `--dry-run`, sao lưu trước khi ghi và kiểm tra không thay dữ liệu ngoài phần bổ sung. Generator current-schema và manifest chưa được cập nhật cho dữ liệu thô này; chạy lại generator có thể loại các mảng bổ sung. Việc xuất raw rows chưa đóng gap mapping/render block PW2.

PW1 lưu instance component tại `page_components`; PW2 lưu nội dung khối trong field `pages.layout` kiểu Payload `blocks`, **không có collection `page_components` tương đương để sao chép 1–1**. `frontend_component_id` là tham chiếu định nghĩa component PW1, không phải `blockType` PW2.

**Hiện trạng đã triển khai:** `buildPages()` chọn `pages.store_id` đúng Store và `pages.deleted_at` rỗng, rồi đưa **mọi** `page_components` có `page_id` thuộc tập Page này vào `diagnostics.quarantinedPageComponents`, không kiểm tra trạng thái component. Mỗi disposition có `sourceId`, `pageId`, `reasonCode=PAGE_COMPONENT_TRANSFORMER_MISSING` và `archiveRef` trỏ đến dòng CSV nguồn; được đưa vào manifest, không phải collection trong JSON. `archiveRef` là tham chiếu ngoài, **không chứa bản sao đầy đủ dữ liệu nguồn**. JSON vẫn xuất `pages[].layout=[]`.

Bảng `page_components` không có `store_id` hoặc `deleted_at`; phải xác minh sở hữu qua `page_components.page_id → pages.id → pages.store_id`, không dùng `created_by`. Số lượng/status theo snapshot không thay thế kiểm tra quan hệ.

Bảng dưới liệt kê đủ 12 field nguồn. Các đích ghi **dự kiến** là hướng cần xây dựng transformer, **chưa phải mapping đã triển khai**; chưa chốt loại block thì chưa thể khẳng định bảng/cột vật lý cụ thể.

| Field nguồn PW1 | Ý nghĩa/quy tắc cần xử lý | Đường dẫn JSON PW2 dự kiến | Bảng.cột PW2 dự kiến hoặc phần chưa chốt | Trạng thái hiện tại |
|---|---|---|---|---|
| `page_components.id` | Định danh instance nguồn; cần bảng đối chiếu có định danh DB nguồn, không chép trực tiếp ID số thành ID block | `pages[].layout[].id` sau khi chốt quy tắc tạo ID; hiện chỉ có `sourceId` trong disposition | ID bản ghi block tương ứng; loại block/bảng chưa chốt | `Q/B` |
| `page_components.page_id` | Phân giải Page cha và kiểm tra đúng Store trước khi gắn nội dung | Phần tử trong `pages[].layout` của Page đã phân giải; không thêm field `page_id` vào block | Quan hệ cha của bản ghi block tới `pages`; bảng cụ thể chưa chốt | `Q/B` |
| `page_components.frontend_component_id` | Join `frontend_components.id` để hiểu loại khối và cấu hình; cần ma trận chuyển từng loại PW1 sang block PW2 | `pages[].layout[].blockType` chỉ sau khi có quy tắc chuyển đổi | Chưa chốt block đích; không dùng ID/slug nguồn làm `blockType` tự động | `Q/B` |
| `page_components.label` | Nhãn instance nguồn; phải xác minh đó là nhãn quản trị hay nội dung hiển thị theo từng loại | Chưa chốt; không mặc định map vào `blockName`, headline hoặc title | Chưa có cột đích được xác minh cho ý nghĩa này | `Q/B` |
| `page_components.label_ms` | Nhãn tiếng Mã Lai; cần quy tắc ngôn ngữ, không âm thầm bỏ hoặc ghi đè `label` | Chưa chốt field/ngôn ngữ đích | Chưa chốt khả năng lưu đủ hai nhãn theo từng block | `Q/B` |
| `page_components.tag_name` | Tên tag component PW1; cần đọc renderer/định nghĩa nguồn trước khi chuyển | Chưa chốt; không mặc định coi là HTML tag, anchor hoặc `blockType` PW2 | Chưa có cột đích được xác minh | `Q/B` |
| `page_components.status` | Trạng thái component, khác với `pages.status`; cần chốt giữ khối ẩn hay cách ly, không tự xuất thành khối đang hiển thị | Chưa chốt field hoặc quy tắc ẩn khối | Chưa xác minh field trạng thái tương đương cho mọi block | `Q/B` |
| `page_components.is_default` | Cờ mặc định của instance PW1; cần giữ ngữ nghĩa theo loại component, không map thành `isHomepage` | Chưa chốt | Chưa có cột đích tương đương được xác minh | `Q/B` |
| `page_components.position` | **Đề xuất:** sắp tăng dần theo số, null cuối; cùng vị trí thì `id` tăng dần để tái tạo ổn định. Đây chưa phải logic chuyển component hiện tại | Thứ tự phần tử `pages[].layout[]` | Thứ tự bản ghi block (`_order`) sau khi chốt transformer/bảng đích; không chép nguyên position có khoảng trống | `Q/B` |
| `page_components.created_by` | Người tạo instance; không dùng để xác định Store/owner. Theo phạm vi hiện tại, chưa xử lý field người tạo | Không xuất | Không bổ sung field đích trong đợt này | `Q/B` |
| `page_components.created_at` | Thời điểm tạo instance; không thay thế thời điểm tạo Page cha | Chưa chốt; không map vào `pages[].createdAt` | Chưa xác minh cột timestamp riêng tương đương trong block đích | `Q/B` |
| `page_components.updated_at` | Thời điểm cập nhật instance; không thay thế thời điểm cập nhật Page cha | Chưa chốt; không map vào `pages[].updatedAt` | Chưa xác minh cột timestamp riêng tương đương trong block đích | `Q/B` |

**Dữ liệu liên quan phải đọc cùng component để không mất nội dung:**

| Nguồn/quan hệ PW1 | Điều kiện nối và kiểm tra | Hướng xử lý; hiện chưa triển khai |
|---|---|---|
| `frontend_components` | `page_components.frontend_component_id = frontend_components.id`; đây là định nghĩa, không phải instance Page | Đọc định nghĩa/cấu hình để xây ma trận loại block; không sao chép catalog này thành collection PW2 mới |
| `model_settings` qua `PageComponent.settings()` | `model_type = App\Models\PageComponent`, `model_id = page_components.id`, kiểm tra `store_id` khớp Store của Page | Chuyển từng cấu hình vào field block tương thích; không trộn với setting của Store/Page/MenuLine |
| `banners` qua `PageComponent.banners()` | `banners.page_component_id = page_components.id`; kiểm tra sở hữu/phạm vi bản ghi nguồn | Chuyển nội dung/ảnh/link theo block đã chọn; URL ảnh giữ nguồn PW1 theo quyết định Media, không mặc định upload S3 |
| `shortlist_items` qua `PageComponent.items()` | `shortlist_items.page_component_id = page_components.id`; phân giải đối tượng được chọn theo kiểu và ID nguồn | Chuyển danh sách/tham chiếu theo schema block; kiểm tra đối tượng đích cùng Tenant/Site khi áp dụng |

Chưa có transformer cho các quan hệ này; disposition component hiện tại không chứng minh đã lưu đầy đủ các bản ghi liên quan. Muốn đóng gap phải đối soát cả field trong `page_components` lẫn settings/banner/shortlist/định nghĩa phụ thuộc, chốt block và bảng vật lý thực tế, kiểm thử thứ tự/hiển thị/tham chiếu, rồi mới đánh dấu mapping đã triển khai. Nội dung chưa có đích tương thích phải có disposition/lưu nguồn rõ ràng, không coi Page có `layout=[]` là đã migrate đầy đủ.

Nguồn xác minh: [Model PageComponent PW1](/home/liam/data/prime-web-api/app/Models/PageComponent.php:20), [migration gốc](/home/liam/data/prime-web-api/database/migrations/2021_08_12_151840_create_page_components_table.php:16), [thêm label](/home/liam/data/prime-web-api/database/migrations/2021_08_25_042430_add_column_label_for_page_components_table.php:16), [thêm label_ms](/home/liam/data/prime-web-api/database/migrations/2022_02_21_075614_add_column_label_ms_to_page_components_table.php:16), [layout PW2](../../src/collections/Pages.ts#L1568), [buildPages hiện tại](../../scripts/data/generate-two-store-pw2-current-schema.mjs#L320).

#### 4.2.2 Định nghĩa component và header/footer PW1 trong JSON nghiên cứu

Artifact nghiên cứu bổ sung dữ liệu nguyên bản, không tạo collection PW1 ở cấp gốc và không chuyển sang Payload block PW2:

| Vị trí JSON | Nguồn | Quy tắc |
|---|---|---|
| `pages[].components[].frontend_component` | `frontend_components` | Join frontend_component_id; inventory 13 cột; config/default_config_values chỉ giữ khi qua bộ lọc raw §2.3, không merge default vào settings instance |
| `sites[].menus[]` | `menus` | store_id đúng Store; inventory 13 cột, gồm type/config/copyright_content/copyright_status; emit theo §2.3 |
| `menus[].menu_items[]` | `menu_items` | menu_id đúng menu; inventory 12 cột nguồn, gồm model_type/model_id/url; emit theo §2.3 |
| `menu_items[].menu_lines[]` | `menu_lines` | menu_item_id đúng item; inventory 7 cột nguồn; emit theo §2.3 |
| `menu_items[].menu_line_type`, `menu_lines[].menu_line_type` | `menu_line_types` | type_id trỏ định nghĩa; inventory 13 cột gồm config/default_config_values; emit theo §2.3; không có type thì null |
| `model_settings[]` tại menu/item/line | `model_settings` | model_type chính xác App\\Models\\Menu/MenuItem/MenuLine và model_id đúng; kiểm tra store_id |

Các field/value vượt bộ lọc raw §2.3 giữ nguyên dạng CSV, gồm status/deleted_at/timestamp khi được nhận; không bảo đảm mọi key cấu hình được emit. Sắp menu/item/line theo position số, rỗng cuối, ID tăng dần khi bằng nhau; settings theo ID. Không tách header/footer bằng suy đoán: giữ type gốc của menu. Giữ mảng rỗng khi không có dữ liệu.

Định nghĩa nhúng theo instance component không phải số loại component độc lập. Không thay domain, Page lịch sử hoặc dữ liệu component khi bổ sung navigation.

Đối soát shortlist phải kiểm tra cả root collection lẫn raw catalogs. Việc có raw catalog không chứng minh mọi ID/link trong config đã phân giải hoặc Brand đã có collection đích.

Đây là snapshot nghiên cứu, không phải contract import trực tiếp. Generator current-schema và manifest chưa cập nhật; bổ sung dữ liệu không đồng nghĩa đã chuyển đổi hoặc render đúng PW2.


### 4.3 Media

**Phạm vi đã chốt theo yêu cầu người dùng:** JSON giữ `media[]`, URL ngoài PW1, metadata đã map và các tham chiếu ảnh đích. Không giữ năm mảng `medias`, `product_images`, `product_sku_images`, `media_items`, `media_categories` trong `sites[].pw1_source`. Không yêu cầu bổ sung lại chúng để đóng mapping Media; các bảng CSV vẫn là bằng chứng nguồn ngoài artifact. Không xóa những nhóm raw khác của Site/Page/Product.

**Giới hạn chấp nhận:** JSON không còn là bản bảo toàn đầy đủ thư viện/thư mục/lịch sử ảnh PW1. Dữ liệu chưa map, ảnh đã xóa và quan hệ SKU nguồn chưa có đích không bắt buộc lưu trong JSON. Việc bỏ raw không xóa Media hay tham chiếu đã map, không thêm ảnh SKU vào schema PW2 và không tự chứng minh hiển thị/import đã hoạt động. Khi cần đối soát ID, metadata hoặc quan hệ nguồn, đọc CSV PW1 còn được lưu riêng.

**Mapping:** URL → url/sourceUrl; name → alt chỉ là fallback, giữ tên gốc raw. JSON mẫu đã map `created_at`/`updated_at` → `createdAt`/`updatedAt` cho Media có `_ref` phân giải tới dòng `medias`, `product_images` hoặc `product_sku_images`: chuyển instant nguồn theo offset `+08:00` đã xác minh cho snapshot trong manifest sang ISO UTC; chuỗi nguồn còn trong CSV, không còn trong năm mảng raw JSON đã loại. Offset này không mặc định áp dụng cho mọi nguồn. Ảnh nhúng từ field Store/User/Category/Blog không có dòng Media với timestamps độc lập thì giữ bằng chứng raw, chưa gán timestamps Media; không lấy ngày của đối tượng chứa ảnh để giả thành ngày tạo/cập nhật ảnh. ID → crosswalk có định danh DB nguồn, không copy PK. Tenant, creator, folder/parent, deleted_at và signature chưa có mapping đầy đủ trong Media.ts; các giá trị chưa map chỉ còn ở nguồn CSV ngoài artifact, không thêm schema. created_by là user tạo dòng theo Observer, không mặc định owner. Muốn lưu raw vào DB PW2 phải có đích được bảo vệ hoặc bổ sung schema; raw JSON không tự thành Payload field.

**URL ngoài:** medias không có MIME/dung lượng/kích thước; không suy từ URL/tên. Không map name thành filename: kiểm tra offline hook S3 cho thấy có filename gọi generateFileURL và đổi URL, không filename giữ URL đầu vào. Payload create mặc định yêu cầu file, sourceUrl chặn ghi thông thường; copy URL vào API chưa đủ. Cần kiểm thử cơ chế external Media không tải/upload; SQL trực tiếp chưa chứng minh UI hoạt động. Normalizer trim URL, raw giữ nguyên chuỗi nguồn.

**Signature/quyền:** provider PW1 gọi image/cdn hoặc image/upload; repository lưu sig, chưa có căn cứ coi là checksum/credential PW2. Token dịch vụ tách riêng. Media read công khai, update/delete helper chưa lọc tenant; không công khai raw creator/signature. sourceProvider không có pw1, không giả thành AI/stock.

**Trạng thái và căn cứ:** JSON mẫu đã bổ sung timestamps cho Media phân giải được dòng nguồn như trên; generator/exporter/importer chưa đồng bộ. Gap ghi external Media, tenant isolation và import vẫn OPEN. Cần kiểm tra DB đích, ảnh nhúng HTML và import E2E. Khả năng truy cập URL chưa được kiểm tra bằng request mạng; đối soát URL với raw không chứng minh ảnh còn tải được. URL có thể là signed/private hoặc trỏ host chưa tin cậy: chỉ kiểm chứng trong quy trình có kiểm soát, không GET hàng loạt hay làm lộ query nhạy cảm. Số liệu, ID bản ghi và kết quả kiểm tra từng Store được lưu riêng trong [report đối soát Media](../../plans/reports/260911-1520-pw1-pw2-media-field-research.md), không phải quy tắc mapping chung. Căn cứ source: Media.ts, PW1 UploadImage.php, package Payload create.js:88/generateFileData.js:85 và cloud-storage hooks/afterRead.js đang cài.

**Regenerate an toàn:** generator hiện tại chưa chứa đầy đủ các bổ sung của artifact. Khi chạy lại phải xuất sang file riêng, đối chiếu Media/URL/tham chiếu và metadata/timestamps đã được giữ, contract tên User, domain và các phần enrich khác trước khi thay artifact đã duyệt. Không ghi đè JSON mẫu bằng output generator cũ hoặc coi output thiếu enrichment là quyết định bỏ dữ liệu. Kiểm tra bảo toàn giá trị/quan hệ và diff phạm vi; giữ CSV nguồn riêng để đối soát; không tự thêm lại năm mảng đã loại theo quyết định phạm vi.


Danh sách nguồn Media trong research lịch sử gồm medias, ảnh Store/User/Category/Blog và ảnh Product/SKU. Exporter master hiện tạo Media từ product_images, ảnh nội dung Product và ảnh thumbnail/nội dung Blog; không có luồng tạo Media từ product_sku_images. Ảnh SKU giữ CSV nguồn theo scope §5.2; không suy mỗi URL trong raw đều có Media document.

**Ảnh nội dung Blog — cập nhật 2026-09-15:** JSON mẫu đã tạo Media URL ngoài cho ảnh nhúng HTML được chuyển vào Lexical. `_ref=@media:blog_posts_content:{blogId}:{imageIndex}` nhận diện lần xuất hiện ảnh theo thứ tự từ 0 trong bài; `blog_posts_content` là namespace migration, không phải bảng PW1 mới. Upload node Lexical dùng `relationTo='media'` và `value` là `_ref` tương ứng, cần resolve sang Media đích khi import. Giữ URL và alt nguồn; HTML gốc giữ nguyên để đối soát thuộc tính trình bày như width/class. Không dùng width CSS làm kích thước file, không tự tải ảnh đo kích thước hoặc tạo timestamps Media từ timestamps Blog: ảnh nhúng không có dòng Media nguồn với ngày độc lập. Các node upload còn cần renderer tương thích theo §8.2 và đường ghi external Media bên dưới.

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| Bảng nguồn + ID/vai trò | Định danh logic ổn định | `media[]._ref` | Chỉ dùng đối chiếu ID | `R` | `CODE/OBSERVED` |
| Field `url`/ảnh ở nguồn | Kiểm tra URL HTTP(S) ngoài; giữ nguyên | `media[].url` | `media.url` | `T/B` | `CODE/SCHEMA` |
| Cùng URL | Sao chép để ghi nhận nguồn gốc | `media[].sourceUrl` | `media.source_url` | `T/B` | `CODE/SCHEMA` |
| `name` ở nguồn, tên đối tượng sở hữu hoặc nhãn được tạo theo quy tắc | Nhãn thay thế dễ đọc | `media[].alt` | `media.alt` | `T` | `OBSERVED/SCHEMA` |
| Không có | Mặc định false | `media[].aiGenerated` nếu được giữ lại | `media.ai_generated` | `G` | `OBSERVED/SCHEMA` |
| Tenant của Store | Bộ chuẩn hóa hiện loại tenant; DB cục bộ có `media.tenant_id` nhưng quy định sở hữu trong `Media.ts` chưa thống nhất | Không xuất | `media.tenant_id` | `B` | `CODE/SCHEMA` |
| `signature` | Không sao chép thành checksum | Không xuất | Chỉ lưu thông tin nguồn gốc | `A` | `DECISION` |
| Thư mục `type=2`, `parent_id` | Không xuất như file Media | Không xuất | Sổ đối soát/lưu nguồn cấu trúc phân cấp | `X/A` | `DECISION` |
| `created_at`, `updated_at` của dòng medias/product_images/product_sku_images đã resolve | Offset snapshot đã xác minh → ISO UTC; không dùng timestamps đối tượng chứa ảnh nhúng | `media[].createdAt`, `media[].updatedAt` khi có dòng nguồn | `media.created_at`, `media.updated_at` | `T/B` | `OBSERVED/SCHEMA`; JSON mẫu đã map, generator chưa đồng bộ |
| Người tạo ở nguồn; ảnh nhúng không có timestamps Media độc lập | Giữ raw; không mặc định owner hoặc ngày của Store/Blog | Không xuất field vận hành tương ứng | Chưa có mapping đầy đủ | `A/B` | `OBSERVED/SCHEMA` |
| Metadata file (`filename`, MIME, dung lượng, kích thước, bản ảnh dẫn xuất) | Không tải ảnh/upload S3; chủ động không đưa vào | Không xuất | Các cột upload `media.*` cho phép null | `G/B` | `DECISION/SCHEMA` |

`media.url` là field của hệ thống upload, còn `sourceUrl` được bảo vệ. Cần cơ chế ghi riêng cho migration hoặc cơ chế SQL trực tiếp tương đương; truyền dữ liệu vào lệnh tạo Payload thông thường chưa đủ chứng minh các giá trị được lưu.

### Quyết định Media URL ngoài và bảo toàn raw

**Contract đã chốt:** dùng URL ảnh PW1, không download/re-upload lên S3 PW2. `media[].url` là địa chỉ hiển thị; `sourceUrl` giữ URL nguồn tương ứng sau kiểm tra, còn chuỗi nguyên bản giữ ở raw. Chỉ trim khoảng trắng ngoài, không tự đổi host, path, chữ hoa/thường của path hoặc bỏ query vì có thể làm hỏng đường dẫn/chữ ký. Không tạo filename, MIME, kích thước hoặc dung lượng giả; không gán sourceProvider thành AI/stock. URL có dấu hiệu credential/query nhạy cảm phải được xử lý theo §2.3 trước khi đưa vào artifact review, không công khai chỉ vì đó là URL ảnh.

| Loại dữ liệu nguồn | Quyết định mapping/bảo toàn |
|---|---|
| File chưa xóa, URL HTTP(S) hợp lệ, xác định được Store | Giữ URL ngoài và liên kết Media qua crosswalk; đủ điều kiện mapping không đồng nghĩa URL đã kiểm tra truy cập hoặc import thành công |
| Folder, URL rỗng, bản ghi đã xóa | Không yêu cầu xuất raw vào JSON; giữ nguồn CSV riêng, không tạo Media vận hành từ folder hoặc phục hồi file đã xóa |
| URL sai định dạng hoặc không rõ owner | Giữ nguồn và lý do cách ly; không tự gán Store/owner hoặc thay bằng ảnh mặc định |
| Cùng URL xuất hiện ở nhiều dòng/Store | Không gộp mất ID, thứ tự, metadata hay ownership. Mỗi quan hệ phải đối soát được về nguồn; không dùng URL làm identity toàn hệ thống |
| Ảnh SKU | Không yêu cầu giữ raw `product_sku_images` trong JSON; Media ảnh SKU của mẫu lịch sử không bị sửa; exporter mới không tạo Media từ bảng này. Không thêm field ảnh SKU hoặc thay schema Product/Order trái §5.2 |
| HTML/page có ảnh nhúng | Giữ nội dung và URL nguồn; có Media collection không tự chứng minh đã bảo toàn toàn bộ ảnh nhúng hoặc renderer PW2 hiển thị được |

**GAP-MEDIA-EXTERNAL-WRITE — OPEN:** [Media.ts](../../src/collections/Media.ts) vẫn là upload collection, `sourceUrl` bị bảo vệ khi ghi thông thường; S3 plugin có thể sinh lại URL khi có filename ([cấu hình](../../src/payload.config.ts:206)). Không coi truyền `{url, sourceUrl}` vào API create là đủ, cũng không dùng `filePath`/upload để vượt yêu cầu giữ URL. Đường import sau này phải chứng minh lưu và đọc lại đúng URL mà không tải/upload, không bị hook ghi đè. Ghi SQL trực tiếp không tự chứng minh collection/UI/relationship hoạt động; phải đối soát sau ghi. Chưa chọn hoặc triển khai đường ghi trong scope tài liệu.

**GAP-MEDIA-TENANT-ISOLATION — OPEN:** `Media.ts` không khai báo field tenant; read công khai và helper update/delete kiểm tra đăng nhập/provider, chưa lọc Tenant sở hữu. Cột `media.tenant_id` đã quan sát trong DB không tự bổ sung enforcement vào collection. Crosswalk phải xác định Store nguồn, Tenant đích và mọi consumer liên quan; chưa cho phép quản lý/sửa/xóa Media migrate như dữ liệu tenant bình thường trước khi kiểm chứng isolation. Không map creator thành owner và không coi public read là quyền sửa/xóa. Raw/signature/creator không được nhét vào collection public để lấp gap bảo toàn.

**GAP-MEDIA-RAW-COVERAGE — không còn là yêu cầu trong scope:** năm mảng raw Media đã được loại khỏi JSON theo quyết định người dùng. Không coi thiếu chúng hoặc thiếu raw SKU để truy ngược ảnh là blocker cho hiển thị ảnh đã map. Khi chưa đủ dữ liệu để map một tham chiếu vận hành cụ thể, vẫn phải đối soát nguồn; không được tạo tham chiếu giả hoặc bỏ ảnh đang sử dụng mà không có lý do.

**Điều kiện nghiệm thu:** đối soát các ảnh/tham chiếu đã chọn mapping tới consumer theo phạm vi đã chốt, không yêu cầu bảo toàn mọi dòng thư viện/lịch sử nguồn; kiểm tra URL đọc lại nguyên vẹn sau import; kiểm tra hiển thị tại các consumer nằm trong phạm vi PW2; chứng minh không upload/S3 rewrite và không sửa/xóa chéo Tenant. Kiểm tra khả dụng URL cần được thực hiện có kiểm soát trước cutover; không suy URL tồn tại lâu dài từ DB snapshot. Giữ URL PW1 đồng nghĩa vẫn phụ thuộc dịch vụ lưu ảnh PW1 — không được xóa/ngừng dịch vụ nguồn chỉ vì đã chuyển metadata sang PW2.



**Tracking 2026-09-15 — giảm phạm vi raw Media:** đã xóa đúng năm mảng raw Media khỏi JSON mẫu; giữ nguyên collection `media[]`, URL/sourceUrl, timestamps và mọi dữ liệu/tham chiếu khác. Các ghi nhận bổ sung raw trước đây được thay thế bởi quyết định này. CSV nguồn không bị xóa, có thể dùng để phục hồi nếu đổi phạm vi. Gap ghi URL ngoài, tenant isolation, khả dụng URL và đồng bộ generator vẫn còn; không upload S3, sửa schema hoặc runtime.

## 5. Danh mục và sản phẩm

### 5.1 Danh mục sản phẩm

Cấu trúc nguồn/đích, ràng buộc và bảng disposition đủ 103 cột đã tích hợp tại [§18](#18-cấu-trúc-categoryproducteav-và-disposition-từng-cột). Dùng cùng mục 5.2 để kiểm tra field, quan hệ và gap; không cần tài liệu cấu trúc riêng và không phải chứng nhận đã import.

**Trạng thái:** `categories[]` đã bổ sung timestamps/breadcrumbs. `sites[].pw1_source.categories[]` xử lý inventory 24 cột nguồn, gồm dòng đã xóa, nhưng chỉ giữ field/value qua bộ lọc raw §2.3; không đồng nghĩa đã map đầy đủ nghiệp vụ. Đã bổ sung ba mảng raw thuộc tính dưới `sites[].pw1_source` như bảng dưới. Raw không phải field Payload PW2.

Field nguồn không có đích được giữ tại `sites[].pw1_source.categories[].<field>` nếu vượt bộ lọc raw §2.3; nếu bị loại, ghi disposition/diagnostic và giữ CSV nguồn. Không đồng nhất thiếu đích vận hành với đã mất dữ liệu nguồn.

| Nguồn PW1 | Quy tắc và đường dẫn JSON | Bảng.cột PW2 / trạng thái |
|---|---|---|
| categories.id | categories[]._ref; crosswalk theo định danh DB nguồn, không copy PK | Chỉ đối chiếu ID |
| store_id | categories[].tenant/site phân giải đúng Store | categories.tenant_id/site_id |
| name | categories[].name giữ nguyên | categories.name |
| slug | categories[].slug giữ nguồn; kiểm tra trùng tenant | categories.slug |
| parent_id | categories[].parent qua crosswalk theo cây hiệu lực; policy cho phép đưa con active có cha inactive hợp lệ lên root | categories.parent_id; kiểm tra ownership/cycle/depth/collision |
| description | categories[].description giữ chuỗi khi không rỗng | categories.description textarea; chưa chứng minh render HTML tương đương |
| name + chuỗi cha | categories[].breadcrumbs nối tên cha → con bằng ` > `; đã xuất | categories.breadcrumbs |
| created_at, updated_at | categories[].createdAt/updatedAt: timezone/offset nguồn được xác nhận cho lần migration → UTC ISO-8601; raw giữ chuỗi gốc | categories.created_at/updated_at; đã xuất, chưa kiểm thử importer |
| name_ms, description_ms | Đã giữ raw | Chưa có field đa ngôn ngữ tương đương |
| image, signature | Đã giữ URL/chữ ký raw; không coi signature là checksum | Chưa có mapping ảnh Category |
| title, meta_description | Đã giữ SEO raw | Chưa có mapping SEO Category |
| status | Policy active-only: chỉ Category status=1 được emit; status=0 giữ nguồn/loại khỏi vận hành, không coi là deleted | Không cần thêm status PW2 cho scope này; xem quy tắc policy tại mục này |
| position | Đã giữ thứ tự nguồn raw | Chưa có field/thao tác sắp xếp tương đương; storefront hiện sort theo name |
| layout | Đã giữ layout nguồn raw | Chưa có mapping renderer; không chuyển layout thành dna |
| created_by | Đã giữ ID user raw | Chưa map creator, không tự suy là owner |
| deleted_at | Đã giữ raw; chưa thêm dòng deleted vào danh sách mapped | Có deletedAt/categories.deleted_at nhưng field chặn create/update thông thường; cần cơ chế import riêng |
| total_products, min_product_price, max_product_price, min_product_stock, max_product_stock | Đã giữ raw để đối soát | Không dùng làm giá/tồn kho chính thức của Product |
| category_attributes.id/category_id/attribute_id/is_required/created_by/created_at/updated_at/deleted_at | Inventory 8 cột tại sites[].pw1_source.category_attributes[], chọn theo Category cùng Store, gồm deleted; field/value emit theo §2.3 | Thiếu quan hệ Category–Attribute và kiểm tra tập attribute/option được phép; is_required là metadata nguồn, chưa xác minh backend PW1 thực thi bắt buộc |
| attributes.id/store_id/name/name_ms/code/created_by/created_at/updated_at/deleted_at | sites[].pw1_source.attributes[] lấy mọi dòng Attribute cùng Store, gồm deleted và chưa được Category/Product tham chiếu; field/value qua §2.3 | Chưa có master Attribute tương đương |
| attribute_values.id/store_id/attribute_id/name/name_ms/created_by/created_at/updated_at/deleted_at | sites[].pw1_source.attribute_values[] lấy mọi dòng option cùng Store, gồm deleted và chưa được tham chiếu; field/value qua §2.3 | Không chỉ giữ option Product dùng; nhãn là name/name_ms, không có field value nguồn |
| Không có nguồn tương đương đã chốt | Không tự xuất categories[].dna | DNA phục vụ cấu hình sinh trang, không phải layout/CategoryAttribute PW1 |

**Điều kiện chung:** Tenant/Site cùng chủ sở hữu; parent tồn tại, cùng tenant, chưa xóa, không vòng lặp, cây tối đa 3 cấp. Slug không trùng tenant đối với dòng chưa xóa theo index categories_tenant_slug_uniq. Không tự làm phẳng cây/đổi slug để qua validation mà không ghi nhận. Kiểm tra Attribute và option cùng Store; báo orphan, không bỏ âm thầm.

**Phạm vi thuộc tính:** exporter lấy attributes/attribute_values theo store_id của toàn Store, không lọc theo CategoryAttribute. Riêng category_attributes lấy qua Category ID thuộc Store. Cả dòng deleted/chưa được dùng cũng thuộc phạm vi raw; field/value vẫn qua §2.3. Các bảng Attribute/option nguồn không có position nên sourceOrder cho thứ tự ID số tăng dần. Độ phủ raw này không chứng nhận các quan hệ Attribute/option đã hợp lệ hoặc được map vận hành.

**Catalog active-only:** `activeCatalogOnly=true` chỉ emit Category status=1. `promoteActiveCategoriesToRoot=true` chỉ đưa Category active lên root khi cha nguồn live, cùng Store và status=0. Tính lại ancestry/breadcrumbs, kiểm tra collision tên theo cha hiệu lực và giữ descendants theo cây active; ghi warning `CATEGORY_INACTIVE_PARENT_PROMOTED`. Cha thiếu, đã xóa, sai tenant, status lạ, cycle/depth/collision vẫn là blocker; config không bật promotion giữ kiểm tra cha cũ.

#### Phân loại gap vận hành

Các hướng dưới đây là yêu cầu cần xử lý, **chưa triển khai**, không phải field mới đã tồn tại trong PW2.

| Nhóm | Mức cần thiết | Phần cần bổ sung/kiểm tra |
|---|---|---|
| Trạng thái active/inactive | Scope hiện tại chỉ active | Không thêm field trạng thái. Product tham chiếu Category inactive hợp lệ có category=[] và warning; khi bật promoteActiveCategoriesToRoot, con active có cha live/inactive đúng Store được đưa lên root; cha thiếu/xóa/sai tenant vẫn cách ly |
| Thứ tự position | Cần để giữ thứ tự danh mục PW1 | Field thứ tự + thao tác lưu + API/UI sắp theo nguồn; định nghĩa tie/null và phạm vi cùng cha. Chỉ đổi thứ tự JSON không thay được storefront đang sort name |
| Category–Attribute–option | Cần để giữ quy tắc nhập/sửa Product PW1 | Đích lưu định nghĩa và quan hệ; kiểm tra attribute code/option thuộc danh mục khi áp dụng và kiểm tra đổi Category. Products.attributes key/value không thay thế master Attribute/option |
| Import quan hệ và lịch sử | Cần trước khi coi import thành công | Phân giải _ref, đúng Tenant/Site/parent/Product, timestamps và cơ chế ghi deletedAt được bảo vệ. Không cần tạo field trùng những field PW2 đã có |
| Ảnh, đa ngôn ngữ, SEO, layout | Cần khi Store có sử dụng tính năng tương ứng | Bổ sung cả đích lưu và nơi đọc/render; ảnh giữ URL PW1. Có field trong DB chưa chứng minh hiển thị/SEO tương đương |
| Creator/signature và thống kê nguồn | Có thể giữ raw khi chưa cần chức năng tương đương | Giữ provenance để đối soát, không suy creator thành owner hoặc signature thành checksum; tính thống kê vận hành từ dữ liệu PW2 |
| dna | Không cần cho migration Category PW1 | Không dùng để chứa layout hoặc category_attributes |

**Đính chính is_required:** source PW1 ProductController.php:877 kiểm tra các attribute code được gửi có thuộc Category và các option name có thuộc Attribute tương ứng, khi request có category_id và attributes. Chưa tìm thấy validation backend đọc is_required; repository tạo quan hệ mặc định false, transformer có trả cờ này. Vì vậy chỉ giữ nguyên metadata, không tuyên bố PW1 đã enforce bắt buộc và không tự thêm ràng buộc mới vào PW2 dựa trên tên field.

**Phạm vi sửa khi triển khai:** cần đồng bộ schema/migration, action validation, quản trị và API/storefront; không chỉ thêm cột. CategoryServerSchema hiện chỉ nhận các field cơ bản; storefront chỉ trả name/slug/parent/breadcrumbs, lọc deletedAt và sort name. Preflight cần kiểm tra thêm tên trùng sau trim/không phân biệt hoa thường trong cùng tenant/parent theo action PW2. Dashboard hiện tải tối đa 1.000 Category; Store vượt giới hạn cần phân trang/kiểm tra overflow để tránh thiếu cây.

Căn cứ vận hành: [Category actions](../../src/app/(dashboard)/products/categories/actions.ts:231), [storefront Categories](../../src/app/api/storefront/categories/route.ts:41), PW1 `app/Http/Controllers/Products/ProductController.php:803` và `:877`. Đây là kết quả đọc source, chưa phải kiểm thử import/E2E.

**Tracking:** artifact đã được bổ sung ở lượt trước; lượt review này chỉ chỉnh tài liệu, phân loại gap và đính chính is_required. Generator/manifest/schema/importer chưa đổi. Generator cũ có thể mất enrichment khi chạy lại; helper append-site-source cũ có thể từ chối context có thêm key. Gap inactive, thứ tự, quan hệ/kiểm tra attribute-option và import vẫn OPEN. Số liệu/ID Store, backup và kiểm tra nằm trong [report đối soát Category](../../plans/reports/260911-categories-enrichment-reconciliation.md), không đưa vào quy tắc chung.

Căn cứ schema/source: [Categories.ts](../../src/collections/Categories.ts), [db-setup.js](../../scripts/db-setup.js), [sanitizer](../../scripts/data/generate-two-store-pw2-current-schema.mjs:212); PW1 app/Models/Category.php và CategoryAttribute.php. Bổ sung JSON một lần, không tuyên bố sanitizer đã hỗ trợ các mảng/field mới.

### 5.2 Product: từ JSON collection đến các bảng vật lý PW2

**Quyết định phạm vi cập nhật 2026-09-17:** chỉ thay các ràng buộc đã duyệt: slug theo tenant, bỏ giới hạn số ảnh/mô tả ngắn và liên kết Product trong Order lịch sử tùy chọn; cần SQL đích tương ứng. Không thêm ảnh SKU, bảng Brand hoặc field/bảng Product/Order cho giá vốn, lịch giá hay identity EAV. Các đề xuất mở rộng schema trong research trước không được chọn. Chỉ map vào field hiện có với đúng semantics.

Dữ liệu Product/SKU chưa có đích hoặc ngoài phạm vi đã chọn được giữ trong CSV nguồn; không bắt bổ sung raw vào JSON nghiên cứu. Source ID/selectedTuple và quan hệ đích của SKU dùng để map Product/Order hợp lệ phải có quy tắc crosswalk ngoài schema Payload. Không gửi `pw1_source` như field Product/Order, không tự gộp ảnh SKU vào gallery Product. Giá bán giữ giá base SKU; không dùng `compareAtPrice` chứa lịch giảm giá. Chấp nhận thiếu parity vận hành ở các phần ngoài phạm vi, nhưng vẫn phải đối soát identity, ownership, giá/tồn và quan hệ Order của dữ liệu được map; dữ liệu lỗi vẫn cần cách ly và ghi disposition nguồn.

**Tracking:** disposition từng cột đã gộp vào §18; [research gap Product](../../plans/reports/260914-0950-product-gap-resolution-research.md) chỉ là bằng chứng lịch sử tùy chọn. Các yêu cầu schema cho parity Category–Attribute ảnh hưởng Product ở §5.1 không thuộc hướng được chọn này.

Một object `products[]` được phân bổ vào tám bảng vật lý PW2:

| Đường dẫn JSON | Bảng vật lý PW2 |
|---|---|
| Các field đơn/nhóm của `products[]` | `products` |
| `products[].images[]` | `products_images` |
| `products[].tags[]` | `products_tags` |
| `products[].variantConfigs[]` | `products_variant_configs` |
| `products[].variantConfigs[].options[]` | `products_variant_configs_options` |
| `products[].variants[]` | `products_variants` |
| `products[].attributes[]` | `products_attributes` |
| `products[].category[]` | `products_rels` với `path='category'` |

#### Field gốc của Product

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `products.id` | Định danh ổn định | `products[]._ref` | Chỉ dùng đối chiếu ID | `R` | `CODE/OBSERVED` |
| `products.store_id` | Phân giải chủ sở hữu | `tenant`, `site` | `products.tenant_id`, `site_id` | `R` | `OBSERVED/SCHEMA` |
| `products.name` | Bỏ khoảng trắng thừa; kiểm tra độ dài 3..120 theo quy tắc migration | `name` | `products.name` | `D` | `CODE/SCHEMA` |
| `products.name_ms` | Có thể gộp nếu trùng tên chính; nếu khác thì lưu nguồn vì không có `nameBM` | Không xuất | Lưu nguồn | `T/A` | `CODE` |
| `products.slug` | Giữ/chuẩn hóa theo slug PW1; kiểm tra trùng trong cùng tenant. PW1 áp dụng unique-scope theo `store_id`; nếu PW2 vẫn unique toàn cục thì ghi GAP và không tự đổi slug | `slug` | `products.slug` | `D/T/Q/B` | `CODE/SCHEMA` |
| `products.description` | Chuyển HTML/văn bản thuần → Lexical JSON theo quy tắc xác định | `description` | `products.description` JSONB | `T/Q` | `CODE/SCHEMA` |
| `products.description_ms` | Dùng cùng bộ chuyển đổi | `descriptionBM` | `products.description_b_m` JSONB | `T/Q` | `CODE/SCHEMA` |
| `products.featured_description` | Giữ nguyên văn, không giới hạn 300 ký tự; cần SQL đích tương ứng | `shortDescription` | `products.short_description` | `D/Q` | `OBSERVED/SCHEMA` |
| `featured_description_ms` | Có thể gộp nếu trùng bản chính; nếu khác thì lưu nguồn | Không xuất | Lưu nguồn | `T/A` | `CODE` |
| `product_skus.price` đủ điều kiện | Product không biến thể: giá SKU duy nhất. Product có biến thể: giá base nhỏ nhất của tất cả SKU đủ điều kiện; không dùng giá khuyến mãi | `price` | `products.price` | `T/Q` | `CODE/SCHEMA`; Sprint 2 §7.3–7.4 |
| `stores.currency_id → currencies.code` | Không quy đổi tiền; chỉ chấp nhận MYR/USD/SGD | `currency` | `products.currency` | `R/T/Q` | `OBSERVED/SCHEMA` |
| `products.status` | Giữ trạng thái hiển thị PW1: 1 → active; 0 → draft (không hiển thị); ngoài miền phải đối soát | `status` | `products.status` | `T/B` | `DECISION 2026-09-18` |
| `stock` của một SKU đủ điều kiện | Tồn kho sản phẩm không có biến thể | `inventory` | `products.inventory` | `T/Q` | `OBSERVED/SCHEMA` |
| `stock` của tất cả SKU biến thể được xuất | Cộng tồn kho các biến thể | `inventory` | `products.inventory` | `T/Q` | `CODE/SCHEMA` |
| `products.stock` | Chỉ dùng đối soát; các bản ghi SKU là nguồn chính thức hiện tại | Không xuất | Manifest/đối soát | `A/B` | `DECISION` |
| Một `product_skus.sku` đủ điều kiện | SKU cơ sở của Product không có biến thể | `sku` | `products.sku` | `D/Q` | `OBSERVED/SCHEMA` |
| `products.id` + token DB nguồn cố định | Sinh `PW1{sourceInstanceToken}P{productId}`, chỉ chữ/số, tối đa 50 ký tự; kiểm tra trùng SKU toàn tenant | `sku` | `products.sku` | `G/T/Q` | `CODE/SCHEMA`; token bắt buộc |
| SKU đủ điều kiện + `product_attributes` + `product_variants` | `hasVariants=false` chỉ khi đúng một SKU và không có miền tùy chọn/bản ghi lựa chọn. Một SKU có EAV hợp lệ vẫn là biến thể; cấu trúc EAV lỗi bị cách ly | `hasVariants` | `products.has_variants` | `T/Q` | `CODE/SCHEMA` |
| Không có | Giá trị mặc định thận trọng | `halalCertified=false`, `aiReviewPending=false` | `products.halal_certified`, `ai_review_pending` | `G` | `OBSERVED/SCHEMA` |
| `package_weight` + `package_weight_type` | Source config/common.php xác minh type1=kg, type2=gram; type1 giữ số, type2 chia 1000; thiếu/lạ đơn vị không đoán | `weight` | `products.weight` (kg) | `T/B` | `CODE/DECISION` 2026-09-17; xem quy tắc policy tại mục này |
| `package_length/width/height` + `package_dimension_type` | Contract nguồn đã xác nhận cm → Product cm, giữ số; không chia theo enum chưa rõ. CODE legacy chia loại `2` cho 10 là gap cần đối soát, không phải quy tắc được duyệt | `dimensions.*` | `products.dimensions_length/width/height` | `T/Q/B` | `DECISION/SCHEMA`; chưa chứng nhận converter đúng nguồn cm |
| Không có/chưa xác minh chứng nhận halal từ nguồn | Không xuất | `halalCertImage` | `products.halal_cert_image_id` | `G` | `OBSERVED/SCHEMA` |
| Chưa chốt field nguồn SEO Product trong schema `products` đã export | Để rỗng/không xuất | `seo.*` | `products.seo_title`, `seo_description` | `G` | `OBSERVED/SCHEMA` |
| `brand_id` | Không tạo Brand/quan hệ mới theo quyết định 2026-09-14 | Không xuất vào Product PW2 | Giữ brand_id và bảng brands raw; không có parity Brand Product | `A/B` | `CODE/DECISION` |
| `low_stock_threshold` | PW2 dùng ngưỡng chung, không có field riêng từng Product | Không xuất | Lưu nguồn theo bản ghi | `A/B` | `CODE` |
| `products.created_at`, `products.updated_at` | Commerce reconciliation đọc đúng Product cùng Store; offset nguồn bắt buộc → ISO UTC, từ chối timestamp thiếu/sai. Raw giữ chuỗi gốc | `products[].createdAt`, `products[].updatedAt` | `products.created_at`, `products.updated_at` | `T/Q` | `CODE/SCHEMA`; chưa chứng nhận importer |
| `url`, `created_by` của Product | Chưa có mapping vận hành được xuất; không gộp với timestamps đã map | Không xuất | Giữ nguồn/chuyển hướng URL cần xử lý riêng | `A/B` | `OBSERVED` |
| `deleted_at` có giá trị | Loại Product cùng nhóm bản ghi con | Không xuất | Ghi trạng thái lưu nguồn | `X/A` | `CODE` |

#### Field con của Product

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `products.category_id` | Phân giải Category đúng Store; category nguồn live/inactive hợp lệ được bỏ liên kết theo active-only và ghi warning; thiếu/sai Store/status lạ vẫn lỗi | `category[]` | `products_rels.categories_id`, `parent_id`, `path='category'` | `R/Q` | `CODE/SCHEMA` |
| `product_images.id/url/order` | Tạo tham chiếu Media; giữ đủ ảnh theo thứ tự nguồn; bỏ giới hạn 5 ảnh ở collection/form/gallery, vẫn kiểm tra URL/ownership và giới hạn upload từng ảnh | `images[].image` | `products_images.image_id`, `_order` | `T/R/Q` | `CODE/SCHEMA` |
| Tên Product | Giá trị thay thế cho mô tả ảnh | `images[].alt` | `products_images.alt` | `G` | `OBSERVED/SCHEMA` |
| `tags` + `taggables` của Product | Cần mapping chính xác quan hệ đa hình theo Product/Store; fixture rỗng không chứng minh rule đầy đủ | `tags[].tag` | `products_tags.tag` | `R/T/B` | `UNRESOLVED/SCHEMA` |
| `product_attributes.attribute_id → attributes.id/code`; nhãn `attributes.name/name_ms` | ID Attribute là định danh tier, code lưu để đối chiếu; sắp xếp theo ID số tăng dần; nhãn lấy name, rỗng mới dùng name_ms | `variantConfigs[].name` | `products_variant_configs.name` | `R/T/Q` | `CODE/SCHEMA` |
| `product_attributes.attribute_value_id → attribute_values.id`; nhãn `attribute_values.name/name_ms` | ID AttributeValue là định danh option; sắp theo ID số tăng dần; tên hiển thị map vào value PW2. PW1 không có cột value | `variantConfigs[].options[].value` | `products_variant_configs_options.value` | `R/T/Q` | `CODE/SCHEMA` |
| `product_skus` + `product_variants.attribute_id/attribute_value_id` + bảng Attribute/Value | Mỗi SKU chọn đúng một option/tier; ghép nhãn bằng ` - ` theo thứ tự Attribute ID tăng dần. Bảng product_variants không có order/position | `variants[].name` | `products_variants.name` | `R/T/Q` | `CODE/SCHEMA` |
| `product_skus.sku` | Giữ SKU bán được | `variants[].sku` | `products_variants.sku` | `D/Q` | `OBSERVED/SCHEMA` |
| `product_skus.price` | Đọc số theo đơn vị tiền tệ chính | `variants[].price` | `products_variants.price` | `D/Q` | `OBSERVED/SCHEMA` |
| `product_skus.stock` | Chuyển kiểu số tồn kho | `variants[].stock` | `products_variants.stock` | `D/Q` | `OBSERVED/SCHEMA` |
| Dữ liệu khuyến mãi có lịch | Giữ lịch raw; giá bán lấy giá base SKU, không tái hiện lịch giảm giá | Không xuất `compareAtPrice` từ lịch | `products.compare_at_price`, `products_variants.compare_at_price` không phải đích lịch giá | `A/B` | `CODE/SCHEMA/DECISION` |
| Dữ liệu thuộc tính EAV của PW1 dùng cho biến thể | Không map nhầm thành thuộc tính mô tả | `attributes=[]` | Không có bản ghi `products_attributes` | `A` | `DECISION` |
| `product_skus.cost` | Product/biến thể PW2 không có field giá vốn | Không xuất | Lưu nguồn theo bản ghi | `A/B` | `CODE` |
| `product_sku_images.url/order` | Exporter hiện không tạo Media từ bảng này; giữ CSV nguồn theo scope ảnh SKU đã loại | Không có đường dẫn ảnh của biến thể | CSV snapshot ngoài artifact; không có Media ref được bảo đảm | `A` | `CODE/DECISION` |
| Bộ ID `product_variants.attribute_id/attribute_value_id` | Tên biến thể không thay thế định danh; đối soát selectedTuple/sourceSkuId với đích; exporter hiện chỉ xuất contributions theo source ID/targetPath, chưa xuất receipt tuple/targetId đầy đủ (§18.4) | `variants[].name` + bảng đối chiếu ngoài payload import | Không thêm cột tuple; identity nguồn giữ ngoài schema PW2 | `T/A/B` | `CODE/DECISION` |
| `product_sku_promotion_prices.*` | Không có nhóm dữ liệu/collection giá theo lịch | Không xuất | Lưu nguồn theo bản ghi | `A/B` | `CODE` |
| `created_by/created_at/updated_at/deleted_at/status` của bản ghi con | Mới lọc hoạt động/đã xóa một phần; chưa xuất lịch sử | Không xuất | Lưu nguồn/còn thiếu đối soát | `A/B/X` | `CODE` một phần |

**Policy catalog và bảo toàn nội dung:** `allowSparseVariants=true` giữ đúng tập SKU live/status=1/cùng Store thực có; không tạo tổ hợp, SKU, giá hoặc tồn kho giả. Product chỉ có SKU inactive đủ bằng chứng được loại theo scope. Product thường vẫn lấy giá từ product_skus: thiếu mã SKU khác với thiếu dòng chứa giá; không dùng giá 0 hoặc phục hồi giá SKU đã xóa để qua validator. Thiếu mã dù có dòng giá hợp lệ vẫn gặp restriction của schema exporter; xem gap SKU §18.2. `activeCatalogOnly` cho phép giữ Product với `category:[]` khi category nguồn inactive hợp lệ.

Ảnh giữ đủ số lượng/thứ tự và shortDescription giữ nguyên chuỗi nguồn. Collection/form/gallery và SQL hỗ trợ các giới hạn mới phải được xác minh ở đích trước import. Converter mô tả giữ Lexical, ảnh/link/style được hỗ trợ và ghi gap khi mất fidelity; phân biệt thay đổi serialization CSS với mất declaration. Dashboard không gửi lại description khi textarea không đổi hoặc được hoàn tác; sửa text có chủ đích vẫn dùng editor hiện hành, chưa chứng nhận roundtrip mọi rich layout.

#### Quy tắc cách ly Product

Cách ly Product khi trùng SKU giữa Product, lựa chọn ngoài miền, tên variant/tuple trùng, tồn Product/variant vượt 1.000.000 hoặc giá vượt 100.000.000. Policy được duyệt cho phép ma trận thiếu tổ hợp, chỉ giữ eligible SKU có thật; config legacy chưa bật policy vẫn báo gap. Giữ reason code, identity và nguồn trong manifest theo từng lỗi preflight; xem kiểm tra EAV tại mục 16.

Không tự ép giá/tồn về giới hạn, thêm SKU để lấp ma trận hoặc âm thầm thêm hậu tố SKU nghiệp vụ. Cần disposition và chính sách xử lý từng nhóm bị cách ly; số lượng/ID thuộc báo cáo lần chạy.

## 6. Khách hàng

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `customers.id` | Giữ mọi ID nguồn trong crosswalk; nếu dedup thì nhiều ID trỏ cùng Customer canonical | `customers[]._ref` + crosswalk ngoài payload | ID migration; không copy PK | `R/B` | `CODE`; dedup đã triển khai |
| `customers.store_id` | Phân giải Tenant; không gộp Customer khác tenant | `tenant` | `customers.tenant_id` | `R` | `OBSERVED/SCHEMA` |
| `customers.phone` | Dùng đúng normalizePhone; dedup theo tenant + phone chuẩn hóa không null | `phone` | `customers.phone` | `T/B` | `CODE/SCHEMA` |
| `customers.name/email` | Nhóm gộp chọn giá trị không rỗng mới nhất theo updated_at giảm dần, tie ID số tăng dần; email trim/lowercase và validate, giữ mọi giá trị nguồn ngoài payload | `name/email` | `customers.name/email` | `T/B` | `CODE/SCHEMA` |
| `customers.note` | Hợp notes khác nhau, không rỗng theo created_at tăng dần rồi ID số tăng dần, giữ provenance/ID; không âm thầm ghi đè note cũ | `notes` | `customers.notes` | `T/A/B` | `CODE` |
| `customers.created_at/updated_at` | Offset/timezone nguồn tường minh → UTC ISO; nếu gộp lấy min created_at/max updated_at của nhóm; thiếu/sai thời gian phải đối soát | `createdAt/updatedAt` | `customers.created_at/updated_at` | `T/B` | `CODE/SCHEMA`; chưa chứng nhận import DB |
| `customers.rank_id → ranks.id/level/name` | Quyết định: giữ rank của Customer representative có created_at cũ nhất, tie ID số nhỏ nhất; không chọn rank cao nhất. Mapping enum quan sát level 1/2/3/4 → bronze/silver/gold/vip; level chưa hỗ trợ phải báo gap | `rank` | `customers.rank` | `R/T/B` | `CODE/SCHEMA/DECISION`; không tương đương RankRule |
| `customers.id → orders.customer_id → orders.shipping_address_id/billing_address_id → addresses.id` | Thu thập địa chỉ qua Order cùng Store, không có quan hệ Customer–Address trực tiếp. Helper tính role shipping/billing và crosswalk từng địa chỉ; exporter master chưa ghi đầy đủ receipt này (giới hạn bên dưới) | `addresses[]` | `customers_addresses.id/_parent_id/_order` | `R/T/B` | `CODE/SCHEMA` |
| `addresses.address` | Giữ line1 không rỗng; không thay bằng full_address suy diễn | `addresses[].line1` | `customers_addresses.line1` | `D/B` | `SCHEMA`; cần validation |
| `addresses.city`; `district_id → districts.name` | Trim city nguồn trước khi chọn; city rỗng sau trim mới fallback district đã xác minh. Không giữ whitespace làm city để chặn fallback | `addresses[].city` | `customers_addresses.city` | `R/T/B` | `CODE` |
| `addresses.ward_id → wards.name`; `district_id → districts.name` | line2 gồm ward và district nếu district khác city đã chọn; kiểm tra quan hệ cha trước ghép | `addresses[].line2` | `customers_addresses.line2` | `R/T/B` | `CODE` |
| `addresses.province_id → provinces.name` | Kiểm tra cha/con địa lý và lấy province | `addresses[].state` | `customers_addresses.state` | `R/B` | `CODE/SCHEMA` |
| `addresses.post_code` | Giữ mã bưu chính dạng chuỗi | `addresses[].postcode` | `customers_addresses.postcode` | `D/B` | `SCHEMA` |
| `addresses.country_id → countries.name` | Country theo nguồn đã xác minh; không coi default Malaysia của schema/hook là bằng chứng nguồn | `addresses[].country` | `customers_addresses.country` | `R/B` | `SCHEMA`; thiếu nguồn cần xử lý riêng |
| Không có label/default Customer-address ở nguồn | label Shipping/Billing theo lần sử dụng đầu tiên được chọn; default là địa chỉ đã chọn đầu tiên từng được dùng shipping, nếu không có thì địa chỉ đầu tiên. Đây là giá trị tự sinh, không phải default nguồn | `addresses[].label/isDefault` | `customers_addresses.label/is_default` | `G/B` | `CODE/DECISION` |
| `addresses.full_address/phone/comment/store_id` | Giữ nguồn và ownership ngoài payload; full_address không thay quan hệ địa lý | Không có field con tương đương | Raw + crosswalk ngoài schema | `A/B` | `SCHEMA` |
| `orders.customer_id/created_at/deleted_at` | Min/max created_at của toàn bộ Order nguồn chưa xóa thuộc mọi Customer ID trong nhóm, kể cả Order không emit; UTC theo offset nguồn | `firstOrderAt/latestOrderAt` | `customers.first_order_at/latest_order_at` | `T/B` | `CODE`; không dùng runtime NOW |
| `customers/addresses/ranks.created_by/created_at/updated_at/deleted_at` nếu có trong nguồn | Giữ lịch sử/raw ngoài payload và provenance từng dòng; Customer timestamps gốc có mapping riêng ở trên. Dòng deleted không tự khôi phục | Raw/crosswalk ngoài payload | Không gộp lịch sử con vào Customer timestamps | `X/A/B` | `CODE`; raw archive ngoài payload, đối soát theo manifest |
| `ranks.condition/type/image/localization` | Enum cố định không giữ bộ xét hạng nguồn | Không xuất vào enum | Raw ngoài schema; thiếu RankRule tương đương | `A/B` | `CODE/SCHEMA` |

**Phạm vi receipt của exporter master hiện tại:** mapper dùng reconcileCustomers để dựng Customer và crosswalk nguồn → canonical. Mapping-report.json giữ contributions Customer theo sourceId/field/targetRef; Order được remap sang canonical. Helper còn trả addressDispositions (sourceOrderId/sourceAddressId/usage/targetIndex/legacyGeographyTypes/reason), profileConflicts, rankConflicts và archive, nhưng exporter không ghi đầy đủ các object này. Nó chỉ chuyển tiếp diagnostic địa chỉ invalid/overflow với Address ID và rank chưa map; không có receipt Address → Customer.addresses[index] đầy đủ trong artifact. Dữ liệu địa chỉ gộp và label/isDefault vẫn nằm trong Customer xuất ra; CSV nguồn vẫn được lưu ngoài artifact. Không coi CSV hoặc contributions Customer là receipt địa chỉ đã publish; đối soát chi tiết cần chạy helper/luồng reconciliation có lưu receipt riêng. Đây là gap bằng chứng, không tuyên bố mất dữ liệu nguồn.

**Trạng thái contract và bằng chứng CLI reconciliation cũ:** đã chốt giữ rank của representative khi gộp; không còn chờ quyết định chọn rank cho nhóm mâu thuẫn. Helper `src/lib/migration/pw2-customer-reconciliation.mjs` đã triển khai quy tắc; CLI `scripts/data/reconcile-pw2-customer-fields.mjs` đã áp dụng lên artifact và đối soát độc lập với CSV, replay không đổi. Manifest/backup/archive của CLI reconciliation riêng ghi bằng chứng lần repair, gồm diagnostics và archive mà helper trả về. Đây không phải danh sách file/receipt mà export-pw1-master.ts tự xuất; kết quả này không chứng nhận importer DB hoặc thay đổi runtime. Không đổi schema và không suy enum rank là bộ xét hạng tương đương PW1.

**Identity và hợp nhất:** normalizePhone thực hiện trim, bỏ ký tự khớp `[-\s()+.]`, lowercase; trả null khi rỗng hoặc dài hơn 20 ký tự. Đây không phải bộ xác minh E.164 hay tự thêm mã quốc gia. Canonical đã chốt là Customer có created_at cũ nhất, tie ID số nhỏ nhất; lưu đủ mọi ID nguồn và remap `orders.customer` qua crosswalk, không sửa snapshots tên/email/phone/địa chỉ/tiền trên Order. Không có phone sau chuẩn hóa thì giữ identity nguồn riêng: không tạo phone giả, không merge bằng email. Cột phone PW1 khai báo NOT NULL không chứng minh chuỗi không rỗng; schema PW2 cho phép thiếu phone và fallback runtime là vấn đề riêng. Timestamp sai cần đối soát; rank mâu thuẫn giữ rank canonical theo quyết định, các rank còn lại giữ nguồn và disposition.

**Địa chỉ và giới hạn:** kiểm tra Store qua Order và Address; kiểm tra chuỗi ward → district → province → country theo các FK nguồn có sẵn. Lookup địa lý soft-deleted được dùng cho chuỗi địa chỉ lịch sử nếu tên và quan hệ cha hợp lệ, helper tính `legacyGeographyTypes` trong addressDispositions nhưng exporter master chưa ghi trường này ra artifact; không khôi phục lookup. Bản ghi Address đã xóa vẫn không emit. Địa lý mâu thuẫn thì giữ ngoài mảng địa chỉ đích kèm lý do, không loại cả Customer chỉ vì một địa chỉ lỗi. PW2 tối đa 10 địa chỉ: helper chọn theo Order nguồn created_at giảm dần, tie Order ID số tăng dần; trong cùng Order xét shipping trước billing. Gộp địa chỉ trùng bộ line1/line2/city/state/postcode/country; helper tính disposition cho từng quan hệ nguồn; receipt chi tiết chưa được exporter master ghi ra artifact. Trước khi loại bất kỳ địa chỉ overflow khỏi mảng đích phải giữ toàn row và quan hệ nguồn trong raw/crosswalk bên ngoài; nếu chưa bảo toàn thì chưa được cắt. Nguồn shipping/billing không tự cho biết default Customer.

**Import guards còn thiếu:** hook create Order có thể ghi đè `customer` đã cung cấp bằng lookup phone hoặc null, tự tạo Customer với firstOrderAt=NOW. Hook sync còn ghi tên/email/phone và latestOrderAt khi create; import lịch sử theo thứ tự khác có thể ghi đè kết quả hợp nhất. Phải có cơ chế import được kiểm chứng để bảo toàn crosswalk/timestamps; không coi thứ tự gọi API thông thường là đủ.

**Căn cứ:** [Customer PW1](/home/liam/data/prime-web-api/app/Models/Customer.php), [Order PW1](/home/liam/data/prime-web-api/app/Models/Order.php), [Address PW1](/home/liam/data/prime-web-api/app/Models/Address.php), [migration Customer PW1](/home/liam/data/prime-web-api/database/migrations/2021_03_22_071020_create_customers_table.php), [Customers PW2](../../src/collections/Customers.ts), [normalizePhone](../../src/lib/normalize-phone.ts), [auto-link](../../src/collections/orders-hooks/auto-link-customer.ts), [sync snapshot](../../src/collections/orders-hooks/sync-customer-snapshot.ts). Không đưa số liệu fixture vào contract.

**Actor:** created_by tạm chưa xử lý theo phạm vi đã chốt; chỉ giữ raw nếu có, không dùng làm identity dedup, owner hoặc căn cứ cấp quyền. [Report findings Customer](../../plans/reports/260914-1630-customer-mapping-findings.md) chứa bằng chứng snapshot riêng.

**Replay receipt Customer của CLI repair riêng — không phải manifest exporter master:** helper `src/lib/migration/pw2-customer-receipt.mjs` tính `scopeSha256` trên toàn bộ Customer và Order `_ref/tenant/customer`, không khóa Page/Category hay snapshot Order ngoài các field này. Thứ tự key object không ảnh hưởng digest. `outputSha256` toàn file là bằng chứng lịch sử bất biến, không ghi đè để hợp thức hóa thay đổi ngoài scope.

Replay phải xác minh archive và scope. Receipt cũ chỉ được nâng cấp bằng manifest backup, thêm scopeSha256/scopeVersion khi bytes JSON còn khớp hash toàn file gốc và archive hash hợp lệ; nếu JSON legacy đã bị sửa thì dừng, không tự dựng baseline tin cậy mới. Cần nâng cấp từ bản gốc đã xác minh trước khi chấp nhận chỉnh sửa độc lập ngoài scope. Các rule này không thay import guards DB.

## 7. Giảm giá và đơn hàng

### 7.1 Giảm giá

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `promotion_codes.id` | Một Discount dự kiến cho mỗi mã đủ điều kiện | `_ref` | Chỉ dùng đối chiếu ID | `R` | `OBSERVED` |
| `promotion_codes.promotion_id → promotions.id → promotions.store_id` | Join đúng FK rồi phân giải Tenant/Site; không join promotion_codes.id = promotions.id. Từ chối nguồn thiếu/trùng ID, parent khác Store hoặc code/parent đã xóa | `tenant`, `site` | `discounts.tenant_id`, `site_id` | `R/Q` | `CODE/SCHEMA`; helper nguồn Discount |
| `promotion_codes.code` | Chuẩn hóa và kiểm tra định dạng/tính duy nhất trong tenant | `code` | `discounts.code` | `D/T/Q` | `OBSERVED/SCHEMA` |
| `promotions.description || name` | Giá trị mô tả thay thế | `description` | `discounts.description` | `T` | `OBSERVED/SCHEMA` |
| `promotions.discount_type_id → discount_types.id` | Phân giải loại nguồn: phần trăm → enum chính xác `percentage`; số tiền cố định → `fixed`. PW2 không nhận `percent`; loại thiếu/lạ phải đối soát, không chọn default | `type` | `discounts.type` | `R/T/Q` | `DECISION/SCHEMA`; `src/collections/Discounts.ts` |
| `discount_value` dạng số tiền cố định | MYR ×100 → sen | `value` | `discounts.value` | `T/Q` | `OBSERVED/SCHEMA` |
| `discount_value` dạng phần trăm | Với `type=percentage`, giữ số trong miền 0..100; không nhân 100. Kiểm tra enum và miền giá trị cho từng bản ghi JSON trước bàn giao | `value` | `discounts.value` | `D/Q` | `OBSERVED/SCHEMA` |
| `promotions.status` | 1 → active; 0 → inactive; 2 → inactive với expiresAt nguồn đã xác minh ≤ asOf, không tự bịa hạn dùng | `status`, `expiresAt` | `discounts.status`, `expires_at` | `T/B` | `DECISION 2026-09-18` |
| `is_limit`, `limit` | Chỉ xuất khi được bật | `usageLimit` | `discounts.usage_limit` | `T` | `OBSERVED/SCHEMA` |
| `promotion_codes.used` + Order | Bộ đếm nguồn để đối soát; count đích nhất quán với history giữ lượt theo §7.3, bảo toàn lượt đích hiện hữu; không sao chép rồi tăng lại khi import | `usageCount` | `discounts.usage_count` | `T/B` | `DECISION/SCHEMA`; reconciliation history chưa triển khai |
| `promotions.start_date`, `promotions.end_date` qua FK promotion_codes.promotion_id | Giữ thời điểm nguồn, offset/timezone tường minh → UTC; không dùng ngày tạo làm hạn hiệu lực. Xem gap hook dưới đây | `startsAt`, `expiresAt` | `discounts.starts_at`, `expires_at` | `T/B` | `CODE/SCHEMA`; chưa giữ nguyên qua import hook |
| `promotion_codes.created_at` | Thời điểm tạo mã; offset nguồn tường minh → ISO UTC, không lấy ngày tạo Promotion hoặc startsAt | `createdAt` | `discounts.created_at` | `T/Q` | `CODE/SCHEMA`; đã áp dụng artifact, chưa import DB |
| `promotion_codes.updated_at`, `promotions.updated_at` | Lấy max hai thời điểm cập nhật đã parse theo offset nguồn; từ chối thời gian/offset thiếu hoặc sai, không lấy expiry làm updatedAt | `updatedAt` | `discounts.updated_at` | `T/Q` | `CODE/SCHEMA`; đã áp dụng artifact, chưa import DB |
| Field đa ngôn ngữ/tên/slug/ảnh | Schema Discount hiện tại không giữ được | Không xuất | Lưu nguồn | `A/B` | `CODE/SCHEMA` |
| Giới hạn tối đa/tối thiểu/theo người dùng và phạm vi Promotion-SKU | Chưa có quy tắc đích tương đương | Không xuất; giữ không hoạt động/lưu nguồn/cách ly | Chờ quyết định schema `discounts` | `A/Q/B` | `CODE/SCHEMA` |
| deleted_at và lịch sử khác timestamps gốc | Code hoặc parent đã xóa không emit; giữ lịch sử nguồn bên ngoài. created_at/updated_at có rule riêng ở trên | Không xuất lịch sử chưa có đích | Lưu nguồn | `X/A` | `OBSERVED` |

**GAP — hook hiệu lực Discount, chưa xử lý:** `Discounts.beforeValidate` đưa startsAt về 00:00 và expiresAt về 23:59:59.999 theo Asia/Kuala_Lumpur, kể cả đầu vào ISO đã mang thời điểm chính xác. Giữ instant PW1 trong JSON không chứng minh import Payload bảo toàn instant. PW1 end exclusive khác PW2 end inclusive; cần đối soát cả điều kiện biên, không chỉ đổi múi giờ. Chỉ ghi nhận gap, chưa sửa hook/guard hoặc schema/runtime PW2; giữ Discount inactive cho đến khi giải quyết và kiểm thử.

**Theo dõi rule nguồn:** `src/lib/migration/pw2-discount-source.mjs` đã triển khai kiểm tra join và timestamps, áp dụng artifact và đối soát CSV; bằng chứng lần chạy nằm trong [report Discount](../../plans/reports/260914-1612-discount-mapping-findings-fix.md). Gap `PW2_DISCOUNT_DAY_BOUNDARIES` chỉ được ghi nhận, chưa sửa hook hiệu lực hoặc import DB.

**Contract import dữ liệu trước — bổ sung 2026-09-15:** có thể giữ bản ghi Discount đã map với `status=inactive` trong tập dữ liệu nghiên cứu, dù chưa tương đương toàn bộ điều kiện sử dụng PW1. Không coi inactive là cách bảo toàn các field chưa map: giới hạn tối thiểu/tối đa/theo người dùng và phạm vi SKU chưa có đích vẫn là phần thiếu riêng. Chưa bật mã và không sửa schema để mô phỏng các điều kiện đó trong scope hiện tại. Đường ghi phải bảo toàn timestamps theo contract chung; chưa chốt writer riêng hoặc bypass hook trong lượt này.

**Quy tắc used null/rỗng — đã xác minh PW1:** map `promotion_codes.used` null/rỗng thành `usageCount=0`. Đây là trạng thái khởi tạo hợp lệ, không phải gap dữ liệu hoặc blocker riêng. [Schema nguồn](/home/liam/data/prime-web-api/database/migrations/2022_01_03_062706_create_promotion_codes_table.php:20) khai báo used nullable, không default 0; [luồng tạo mã](/home/liam/data/prime-web-api/app/Repositories/EloquentPromotionRepository.php:41) không ghi used. [Luồng sử dụng mã](/home/liam/data/prime-web-api/app/Repositories/EloquentOrderRepository.php:255) tính `(int) used + 1`, nên lần đầu tăng từ 0 lên 1; kiểm tra giới hạn cũng ép integer. Chỉ yêu cầu đối soát ngoại lệ nếu Order cùng Store/mã hoặc bằng chứng nguồn khác mâu thuẫn với trạng thái này. Không áp dụng quy tắc null→0 một cách chung cho các field khác.

`usageCount=0` không tự chứng minh mã đang được phép sử dụng: status, thời hạn, limit và điều kiện giảm giá vẫn có quy tắc riêng. Số đếm đã về 0 sau hoàn lượt cũng không đồng nghĩa mã chưa từng được dùng. Mảng history rỗng chưa xuất vẫn phải phân biệt với không có lịch sử theo §7.3; việc xác minh used null/rỗng không đóng gap history cho các mã khác.

| Giá trị used nguồn | Quyết định |
|---|---|
| Số nguyên không âm hợp lệ | Giữ làm bằng chứng đối soát; không tự copy rồi cộng thêm số history nhập |
| Null/rỗng | `usageCount=0` theo luồng khởi tạo PW1; không phải gap riêng. Chỉ đối soát ngoại lệ khi có bằng chứng nguồn mâu thuẫn |
| Âm, không nguyên hoặc sai định dạng | Cách ly giá trị đếm để đối soát; không clamp về 0 hoặc bỏ phần thập phân |
| Không khớp số Order/history đủ điều kiện | Ghi chênh lệch và lý do; không tạo/xóa lượt giả để khớp số |

**Bằng chứng và tracking — đính chính 2026-09-15:** thay kết luận trước “used null/rỗng chưa xác định” bằng quy tắc null/rỗng→0 đã xác minh từ schema/luồng tạo và tăng lượt PW1. [Listener OrderFailed](/home/liam/data/prime-web-api/app/Listeners/Orders/OrderFailed/UpdateDiscountUsed.php:15) có logic giảm used; PW2 [releaseDiscountRedemption](../../src/lib/discounts/release-discount-redemption.ts:21) xóa history và giảm counter, nên số Order có mã không tự bằng số lượt còn giữ. Không suy listener đã chạy thành công ở mọi snapshot. Chỉ sửa master; JSON mẫu giữ nguyên usageCount=0, không tạo history giả hoặc kích hoạt mã. Các gap history/điều kiện giảm giá/hook ngày vẫn độc lập, không được coi đã đóng bởi đính chính này.

### 7.2 Đơn hàng

**Policy bảo toàn Order lịch sử:** khi `preserveHistoricalOrders=true`, giữ đủ snapshot tên/variant/số lượng/giá từ order_details, độc lập với SKU active hoặc Product được emit. Quan hệ nguồn hiện hữu phải chứng minh đúng Store; chỉ ghi items[].product khi có Product đích hợp lệ. Catalog thiếu/deleted/inactive không tự làm mất Order. Khi Product bị quarantine collision sau mapping, bỏ liên kết catalog và ghi warning, giữ snapshot.

Orders.items.product là optional; SQL đích phải bỏ NOT NULL của orders_items.product_id. Artifact thiếu liên kết chỉ hợp lệ khi có policy này; config legacy vẫn yêu cầu catalog hợp lệ. Không thêm Product/SKU giả, ảnh SKU hoặc Brand. Tên/số lượng/giá dòng hàng vẫn bắt buộc; Customer theo §6. Detail mơ hồ, quan hệ sai tenant, thiếu dòng hàng, tiền hoặc trạng thái không đủ bằng chứng vẫn cách ly toàn Order.

Phí/tổng/discount/tax/parcelWeight lịch sử không tính lại từ catalog hoặc shipping PW2. Đối soát số học chỉ kiểm tra, không sửa tổng âm thành 0, không suy refund thành công khi thiếu bằng chứng. CSV nguồn giữ các Order không được emit; mapping report là disposition/provenance, không phải archive đầy đủ lịch sử Order.

**Điều kiện vận hành sau import:** đọc/hiển thị đúng snapshot và xử lý an toàn product link trống. Importer phải tránh mail, thanh toán/refund/courier hoặc điều chỉnh tồn kho do ghi snapshot lịch sử; chưa có chứng nhận importer hoặc migration DB đích từ exporter offline. Provider chưa kết nối không cho phép thao tác giao dịch thật.

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `orders.id` | Định danh ổn định | `orders[]._ref` | Chỉ dùng đối chiếu ID | `R` | `OBSERVED` |
| `orders.store_id` | Phân giải Tenant/Site | `tenant`, `site` | `orders.tenant_id`, `site_id` | `R` | `OBSERVED/SCHEMA` |
| `orders.code` | Giữ nguyên, kiểm tra duy nhất toàn hệ thống | `orderNumber` | `orders.order_number` | `D/Q` | `OBSERVED/SCHEMA` |
| `orders.customer_id` | Phân giải mọi Customer ID nguồn qua crosswalk canonical tenant-scoped ở §6; chỉ remap FK, giữ nguyên snapshots Order. Helper/CLI đã remap artifact; vẫn cần import guard tránh hook ghi đè quan hệ | `customer` | `orders.customer_id` | `R/B` | `CODE/SCHEMA`; chưa import DB |
| Các field khách hàng tại thời điểm đặt hàng | Giữ chuỗi dữ liệu lịch sử | `customerName/Email/Phone` | Các cột `orders.customer_*` tương ứng | `D` | `OBSERVED/SCHEMA` |
| `order_details.id` | Cần định danh bản ghi con được tạo theo quy tắc xác định | Bản ghi logic `items[]` | `orders_items.id/_parent_id/_order` | `R/B` | `OBSERVED/SCHEMA` |
| `order_details.product_sku_id → product_skus.product_id` | Liên kết Product tùy chọn theo preserveHistoricalOrders; chỉ ghi khi ownership và đích hợp lệ | `items[].product` | `orders_items.product_id` | `R/Q` | `OBSERVED/SCHEMA` |
| `order_details.name` | Tên được lưu tại thời điểm đặt hàng | `items[].productName` | `orders_items.product_name` | `D/Q` | `OBSERVED/SCHEMA` |
| `order_details.product_sku_id` + crosswalk SKU nguồn → variant đích | Với preserveHistoricalOrders, giữ order_details.variant nguồn, không đổi theo catalog hiện tại; legacy dùng crosswalk SKU → variant đích. Nhãn lịch sử không dùng làm identity catalog | `items[].variant` | `orders_items.variant` | `R/T/Q` | `CODE/SCHEMA`; commerce reconciliation |
| `order_details.quantity` | Số nguyên ≥1 | `items[].quantity` | `orders_items.quantity` | `T/Q` | `OBSERVED/SCHEMA` |
| `order_details.price` | Giá đơn vị lịch sử trên dòng đơn nguồn, giữ major units; không lấy giá SKU/Product hiện tại | `items[].unitPrice` | `orders_items.unit_price` | `T/Q/B` | `OBSERVED/SCHEMA` |
| `currency_id → currencies.code` | Phân giải mã tiền tệ đã chốt | `currency` | `orders.currency` | `R/T/Q` | `OBSERVED/SCHEMA` |
| `sub_total`, `total_shipping`, `total_tax`, `total` | Giữ major units; không nhân 100. total_tax null/rỗng chỉ map 0 theo contract nguồn không tính thuế bên dưới, không áp dụng default chung cho các tổng tiền khác. Exporter chặn tax khác 0; xem giới hạn bên dưới | `subtotal/shippingFee/tax/total` | Các cột `orders.*` tương ứng | `T/Q/B` | `OBSERVED/SCHEMA` |
| `orders.total_discount` | Chuyển thập phân chính xác ×100 sang minor units: MYR → sen; USD/SGD → cents. Luôn đọc nguồn, không nhân lại giá trị JSON đã chuyển | `discountAmount` | `orders.discount_amount` | `T/Q` | `CODE/SCHEMA`; xem quy tắc kiểm tra bên dưới |
| `status → order_statuses` | Map tổ hợp trạng thái đã chốt | `status` | `orders.status` | `R/T/Q/B` | `OBSERVED/SCHEMA` |
| Tổ hợp thanh toán/mua hàng/hoàn tiền | Suy ra trạng thái thanh toán một cách thận trọng | `paymentStatus` | `orders.payment_status` | `T/Q/B` | `OBSERVED/SCHEMA` |
| `orders.payment_method_id → payment_methods.id/code` | Code `cod` → `cod`; không hardcode ID. Gateway Stripe/Billplz không chứng minh phương thức card/FPX/bank; chưa đủ căn cứ thì không xuất method và ghi gap | `paymentMethod` | `orders.payment_method` | `R/T/B` | `CODE/SCHEMA` |
| `orders.payment_method_id → payment_methods.code` | Chỉ code `stripe` → provider `stripe`. Billplz/chưa hỗ trợ không gán sang provider khác; không suy provider từ tên hiển thị | `paymentProvider` | `orders.payment_provider` | `R/T/B` | `CODE/SCHEMA`; không chứng nhận kết nối thanh toán |
| `orders.created_at`, `orders.updated_at` | Đọc đúng Order cùng Store, offset nguồn bắt buộc → ISO UTC; từ chối thiếu/sai timestamp. Không dùng thời gian export | `orders[].createdAt`, `orders[].updatedAt` | `orders.created_at`, `orders.updated_at` | `T/Q` | `CODE/SCHEMA`; chưa chứng nhận importer |
| `addresses.address` giao hàng và tra cứu địa lý | Chuẩn hóa địa chỉ lưu tại thời điểm đặt hàng | `shippingAddress.*` | `orders.shipping_address_*` | `R/T/Q` | `OBSERVED/SCHEMA` |
| `delivery_provider_id → delivery_providers.name` | Tên đơn vị vận chuyển dễ đọc | `shippingCourierName` | `orders.shipping_courier_name` | `R/T` | `OBSERVED/SCHEMA` |
| `total_weight` | PW1 kg ×1000 → PW2 gram, đã xác nhận từ mã vận chuyển đang chạy; mô tả kg trong PRD đã lỗi thời. Vẫn phải kiểm tra kiểu số/đơn vị nguồn | `parcelWeight` | `orders.parcel_weight` | `T/Q/B` | `OBSERVED/SCHEMA`; xem bằng chứng tại mục 15 |
| `comment`, `note` | Gộp theo nhãn và thứ tự cố định | `notes` | `orders.notes` | `T` | `OBSERVED/SCHEMA` |
| Không có | Mặc định cho nghiên cứu | `locale='en'`, `verificationSource='manual'` | `orders.locale`, `verification_source` | `G` | `OBSERVED/SCHEMA` |
| `orders.promotion_code` | Giữ snapshot mã độc lập FK; chỉ gán discount khi crosswalk nguồn/Store/mã resolve duy nhất theo §7.3 | `orders[].discountCode`, `orders[].discount` | `orders.discount_code`, `discount_id` | `D/R/B` | `DECISION/SCHEMA`; chưa triển khai đầy đủ |
| `tracking_code` | Sao chép giá trị không rỗng từ Order nguồn chưa xóa, cùng ID và cùng Store | `orders[].trackingNumber` | `orders.tracking_number` | `D` | `CODE/SCHEMA` |
| Nhóm nghiệp vụ vận chuyển/thanh toán/hoàn tiền/thuế/lịch sử | Chưa có phép chuyển đổi lịch sử đầy đủ; phải giữ nguồn bên ngoài | Không xuất hoặc để lịch sử rỗng | Nguồn lưu trữ bên ngoài có giới hạn truy cập | `A/B` | `CODE/SCHEMA` |
| `order_details.sku/image/tax/total snapshots` | Thiếu field đích ở dòng hàng | Không xuất | Lưu nguồn | `A/B` | `CODE/SCHEMA` |
| Địa chỉ thanh toán | PW2 không có nhóm `billingAddress` | Không xuất | Lưu nguồn | `A/B` | `CODE/SCHEMA` |
| `deleted_at` và lịch sử nghiệp vụ khác timestamps gốc | Loại Order đã xóa; lịch sử nghiệp vụ chưa map đầy đủ. Không bao gồm created_at/updated_at đã có rule riêng | Không xuất | Giữ nguồn bên ngoài | `X/A/B` | `OBSERVED` |

**Đối soát dòng hàng:** đối chiếu từng detail nguồn, ownership, snapshot và tiền; không bỏ dòng lỗi làm lệch tổng Order. Có policy lịch sử thì không yêu cầu SKU phải được emit; mọi quan hệ nguồn hiện hữu vẫn kiểm tenant. Không tạo SKU giả, lấy giá hiện tại hoặc đổi tên variant lịch sử. Giữ nguồn/crosswalk và reason cho Order bị cách ly.

**Tương thích collection và vận hành:** worktree-2 đã sửa Orders.items.product thành optional và thêm SQL bỏ NOT NULL. Phải xác minh cả collection lẫn DB đích trước import; SQL nullable một mình không đủ. Product/SKU sai crosswalk thì sửa crosswalk; dữ liệu nguồn sai tenant vẫn cách ly. Khi bật preserveHistoricalOrders, thiếu catalog không ngăn giữ snapshot. Field variant giữ nhãn lịch sử, nên đọc được snapshot không chứng minh thao tác restock/refund dùng được; importer và các thao tác vận hành phải xử lý liên kết trống an toàn.

**Ma trận trạng thái nguồn — quyết định dữ liệu, không replay luồng nghiệp vụ:**

| Bằng chứng PW1 | Đích / xử lý |
|---|---|
| orders.status=1 hoặc 2 | status=pending; paymentStatus quyết định riêng bên dưới, không suy đã trả tiền |
| status=3 / 4 / 5 / 6 | ready_to_ship / shipped / completed / cancelled; không tự gán paid hoặc refunded theo trạng thái giao hàng |
| status=8 kèm purchase_status=3 hoặc 4 | status=payment_failed; paymentStatus=failed hoặc payment_failed tương ứng |
| status=7 (returned), 9 (others), ngoài miền; status=8 không có bằng chứng lỗi thanh toán | Chưa có enum tương đương chắc chắn: cách ly/đối soát, không tự đổi returned thành refunded hoặc failed nghiệp vụ thành payment_failed |
| purchase_status=1 / 2 / 3 / 4, không có refund thành công đã xác minh | paymentStatus=paid / awaiting_payment / failed / payment_failed |
| purchase_status null/rỗng, provider code=cod, không có bằng chứng thanh toán/refund mâu thuẫn | unpaid theo luồng COD nguồn; không tự coi completed là paid |
| purchase_status null/rỗng với gateway khác/chưa phân loại | Chưa có bằng chứng unpaid; đối soát thay vì nhận default |
| refund_status=1 và bằng chứng hoàn tiền thành công nhất quán | Semantics mục tiêu: paymentStatus=refunded; status=refunded làm mất chi tiết giao hàng nên cần đối soát. Exporter hiện chưa hỗ trợ nhánh này: mọi refund_status=1 bị chặn bằng ORDER_REFUND_EVIDENCE_REQUIRED |
| refund_status=2 hoặc 4 (đang xử lý/gateway xử lý), hoặc 3 (thất bại) | Không map thành refunded; giữ trạng thái thanh toán trước đó nếu có bằng chứng, phần tiến trình refund chưa có mapping tương đương thì giữ ngoài payload/ghi gap |

Kiểm tra dữ liệu xóa, giá trị ngoài miền và bằng chứng mâu thuẫn trước khi áp dụng các dòng trên. Nguồn refund đang xử lý nhưng không có trạng thái thanh toán trước đó không được tự mặc định paid. [Tạo Order COD PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentOrderRepository.php:69) bỏ purchase_status; [callback thanh toán](/home/liam/data/prime-web-api/app/Http/Controllers/Orders/OrderController.php:436) phân biệt paid, failed và failed_payment. Các giá trị nguồn không thuộc ma trận không được chọn enum chỉ vì tên gần giống.

**Giới hạn refund của exporter:** orderState không nhận hoặc kiểm tra ledger/queue/refund_message để mở nhánh refunded; refund_status=1 luôn bị chặn. Việc có thêm bằng chứng bên ngoài không tự làm Order được emit trong lần chạy hiện tại. Giữ nguồn và hồ sơ đối soát; cần triển khai/kiểm chứng cơ chế nhận evidence trước khi áp dụng semantics mục tiêu trong bảng. Không sửa flag nguồn, bỏ refund hoặc gán paid/refunded để né điều kiện.

**GAP-ORDER-REFUND-SOURCE-CONFLICT:** [nhánh refund thất bại PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentOrderRepository.php:478) hiện ghi refund_status=success cùng refund_message='Payment return status fail'. Không sửa source trong scope này, nhưng không được kết luận hoàn tiền thành công chỉ từ refund_status=1. Có dấu lỗi này hoặc bằng chứng giao dịch/queue mâu thuẫn thì đối soát, không tự gán refunded. Không gọi provider hoặc giải mã credential để lấp dữ liệu trong bước tạo artifact.

**Field chấp nhận chưa import với schema hiện tại:** billingAddress; snapshot SKU/image/tax/total riêng từng order_detail chưa có đích tương đương; audit vận chuyển/thanh toán/refund chưa đủ bằng chứng. Giữ nguồn bên ngoài để đối soát, không thêm raw collection/field mới hoặc nhét vào notes như dữ liệu đã map. Các field PW2 sẵn có như trackingNumber vẫn phải map khi có nguồn; không loại cả nhóm chỉ vì một phần chưa có đích. Gap paymentMethod không chặn Order độc lập nếu quan hệ, trạng thái và các field bắt buộc khác đã hợp lệ.

**Gate importer:** giữ kiểm tra payment/refund theo bằng chứng nguồn; schema cho phép product link trống không giải quyết các gap tài chính. Đường ghi phải tránh hook paymentStatus thay đổi unpaid/cancelled/paid và tránh auto-link Customer, notification hoặc tồn kho làm sai lịch sử.

**Thanh toán:** gap method/provider chưa xác minh vẫn phải ghi rõ; không gán method giả để lấp dữ liệu trống. Việc map `paymentProvider='stripe'` chỉ nhận diện nguồn gateway, không xác nhận credential, trạng thái thanh toán hay tích hợp hoạt động.

**Contract tiền và thuế — bổ sung 2026-09-15:** [luồng tạo Order PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentOrderRepository.php:96) chủ động đặt total_shipping_tax/total_discount_tax/total_tax thành null và tính `total = max(sub_total + total_shipping - total_discount, 0)`. Với nguồn thuộc luồng này, total_tax null/rỗng → `tax=0` là chuyển đổi tương thích đã có căn cứ; không phải số 0 sao chép trực tiếp từ DB hoặc bằng chứng về nghĩa vụ thuế. Exporter hiện chỉ emit Order có tax=0: total_tax null/rỗng được chuyển thành 0, nhưng mọi số thuế khác 0 bị chặn bằng ORDER_TOTAL_RECONCILIATION, kể cả hợp lệ về kiểu số. Chưa có hỗ trợ bảo toàn Order có thuế khác 0; giữ nguồn và đối soát quy tắc tổng tiền trước khi mở rộng mapper. Không xóa thuế hoặc đổi thành 0 để vượt kiểm tra; nguồn khác hoặc tổng tiền mâu thuẫn vẫn phải đối soát.

Kiểm tra `subtotal` bằng tổng `quantity × unitPrice` của các dòng nguồn đủ điều kiện; tổng tiền so theo công thức nguồn, với `discountAmount` đổi từ minor units về major units trước khi tính. Phải tính bằng thập phân chính xác/đơn vị nhỏ nhất khi xây dựng bộ import, không tự sửa snapshot hoặc làm tròn chênh lệch để khớp. `subtotal`, shippingFee, total, unitPrice và parcelWeight thiếu/sai không kế thừa quy tắc null thuế; áp dụng đối soát/miền giá trị riêng. Không lấy giá Product hiện tại hoặc bỏ dòng lỗi để làm tổng tiền khớp.

**Phân biệt trạng thái đơn và thanh toán:** [enum PW1](/home/liam/data/prime-web-api/config/common.php:292) và [enum PW2](../../src/collections/Orders.ts:206) là hai lớp riêng. Đơn delivered/completed hoặc canceled không tự chứng minh paid/refunded. Giữ purchase_status và refund_status làm bằng chứng riêng; hoàn tiền đang xử lý/thất bại không đồng nghĩa hoàn thành. Tổ hợp không có quyết định rõ không nhận default pending/unpaid để che dữ liệu. Không gọi lại cancel/refund/checkout để tạo trạng thái lịch sử trong bước import dữ liệu.

**Tracking 2026-09-15 — đối soát Order mẫu:** đã kiểm tra các Order hiện được emit với CSV về subtotal/phí vận chuyển/tổng tiền/giảm giá, tổng dòng hàng, kg→gram và timestamps; chưa thấy lệch ở các phép đối chiếu này. JSON không cần thay ở lượt này. Bổ sung nguồn gốc tax=0 và giá dòng hàng lịch sử; không xác nhận toàn bộ Order nguồn đã emit, mọi tổ hợp trạng thái đã chốt hoặc import qua hook đã được kiểm chứng. Các gap FK/hook, phương thức gateway và snapshot chưa có đích vẫn giữ nguyên. Số liệu từng Store không đưa vào contract chung.

**Đơn vị giảm giá Order:** parse `total_discount` nguồn bằng thập phân chính xác, không nhân số thực hoặc làm tròn âm thầm. Chấp nhận phần dư sau hai chữ số thập phân chỉ gồm `0` (ví dụ `10.000` → `1000`); từ chối giá trị âm, thiếu, sai định dạng, vượt miền số nguyên an toàn hoặc có phần nhỏ hơn một minor unit khác `0`. Lỗi này cách ly toàn Order với lý do `ORDER_DISCOUNT_INVALID`. Chạy lại vẫn đọc nguồn nên không double conversion. Khi đối soát tổng tiền ở major units, đổi `discountAmount` về major units trước; không trừ trực tiếp số minor units.

**Nguồn giảm giá thiếu không phải 0:** không dùng default `0` của JSON cũ làm bằng chứng nguồn có giảm giá bằng 0. `total_discount` rỗng/thiếu vẫn là `ORDER_DISCOUNT_INVALID`; giữ bản gốc trong backup trước khi cách ly toàn Order và ghi lý do trong manifest. Không suy hoặc tính bù giảm giá từ các tổng tiền để vượt guard.

**Tracking 2026-09-14:** quy tắc reconciliation tại [pw2-commerce-reconciliation.mjs](../../src/lib/migration/pw2-commerce-reconciliation.mjs), CLI artifact tại [reconcile-pw2-commerce-fields.mjs](../../scripts/data/reconcile-pw2-commerce-fields.mjs): bổ sung timestamps Product/Order, sửa liên kết variant theo SKU và phân biệt payment method/provider. Số liệu từng Store và Order bị cách ly nằm trong manifest/backup của lần chạy, không phải rule master. Chỉ sửa artifact nghiên cứu, chưa import DB thực tế và không đổi schema Product/Order.

### 7.3 Lịch sử sử dụng mã giảm giá

**Contract nghiên cứu, chưa triển khai exporter/preflight/importer history tổng quát.** Giữ trạng thái `B` cho các lượt chưa phân giải/đối soát; không coi mảng rỗng tự thân là bằng chứng đã xuất đầy đủ. Ngoại lệ đã xác minh không có dữ liệu nguồn được áp dụng theo quy tắc bên dưới, không tạo blocker giả. Không thêm bảng/field PW2.

**Quy tắc mảng history rỗng đã xác minh — 2026-09-15:** đọc toàn bộ Order của Store trong snapshot, gồm cả dòng deleted còn trong CSV, không chỉ các Order được emit vào JSON; đối chiếu với toàn bộ mã thuộc Store qua Promotion, gồm mã/Promotion đã xóa. Nếu không có Order ghi promotion_code và không có counter used dương/mâu thuẫn (null/rỗng theo quy tắc §7.1 được hiểu là 0), xuất `discount_usage_history=[]` là đúng dữ liệu nguồn. Không dựng lượt giả hoặc yêu cầu thêm history chỉ vì collection có sẵn. Nếu có Order mang mã hoặc counter dương thì không áp dụng ngoại lệ này; tiếp tục phân loại theo các điều kiện bên dưới.

**Tracking đối soát mẫu:** JSON mẫu hiện đã được kiểm tra đủ điều kiện history rỗng nêu trên; giữ nguyên mảng và usageCount=0 tương ứng, không cần thêm bản ghi. Đây là xác nhận phạm vi mẫu, không phải khẳng định toàn bộ PW1 không có lịch sử hoặc exporter history đã triển khai. Số liệu/ID từng Store không đưa vào quy tắc master.

**Nguồn lịch sử đã xác định:** dựng danh sách sử dụng mã từ Order PW1 có `promotion_code`; `orders.id` xác định đơn, snapshot khách hàng/mã/số tiền cho biết dữ liệu của lần đặt đơn, `created_at` cung cấp thời gian suy dẫn và trạng thái phục vụ phân loại. `promotion_codes.used` là bộ đếm nguồn dùng đối soát danh sách này, không phải nguồn duy nhất để dựng lịch sử. Không kết luận PW1 không có lịch sử chỉ vì Order thiếu `discountType/discountValue`; không bỏ cả history hoặc chặn bước thu thập/đối soát vì hai snapshot tùy chọn này thiếu.

**Hai tập dữ liệu cần phân biệt:** (1) bằng chứng lịch sử nguồn: toàn bộ Order có mã trong phạm vi snapshot, kể cả đơn hủy/thất bại/đã xóa nếu nguồn còn bản ghi, phải được kiểm kê và giữ nguồn; (2) `discount_usage_history` đích: chỉ các lượt đủ điều kiện giữ theo hành vi PW2 và đáp ứng quan hệ/tiền tệ bên dưới. Order đã xóa vẫn theo quy tắc không emit tại §7.2; đơn hoàn lượt không tạo history đang giữ nhưng không bị mất bằng chứng nguồn. Tập (1) không phải collection PW2 mới: phần không emit được giữ trong archive/crosswalk/manifest có giới hạn truy cập, không thêm key collection hoặc bảng đích. Số Order có mã không mặc nhiên bằng `used`, vì counter còn chịu các sự kiện tăng/giảm lượt.

**Đối soát theo từng mã:** lưu giá trị `used` nguồn cùng số Order có mã đã xác minh quan hệ; phân loại đủ điều kiện giữ, đã hoàn lượt, hoặc chưa xác minh/cách ly và ghi chênh lệch/lý do. Không chọn tùy ý N Order để khớp `used=N`, không tạo lượt giả khi counter lớn hơn số Order, không loại lịch sử thật để ép số liệu bằng nhau. Chênh lệch chưa giải thích được là gap đối soát, không phải lý do xóa snapshot trên Order.

**Tracking bổ sung 2026-09-14:** chốt Order là nguồn dựng lịch sử, `used` là bộ đếm đối soát; tách bằng chứng lịch sử PW1 khỏi lượt được giữ trong collection PW2. Phần còn thiếu là snapshot loại/giá trị tại thời điểm đặt đơn, ma trận giữ/hoàn lượt và thực thi/kiểm thử exporter/importer; không phải thiếu toàn bộ lịch sử. Chưa thay JSON hoặc source runtime.

**Điều kiện xuất:** resolve mã theo source instance + Store + mã trên Order, qua crosswalk tới Tenant/Discount/Order cùng tenant. Kiểm tra mã đã xóa/tái sử dụng; không chọn mã live đầu tiên. Thiếu, mơ hồ hoặc tham chiếu bản ghi bị cách ly thì cách ly history và giữ bằng chứng nguồn, không tạo Discount giả. Snapshot mã và tiền giảm trên Order vẫn được giữ theo §7.2 độc lập với khả năng resolve FK.

**Giữ/hoàn lượt:** PW2 giữ lượt khi đặt đơn và xóa history khi hoàn lượt. Không đưa thẳng mọi Order có mã hoặc chỉ Order đã thanh toán vào collection history đích; vẫn kiểm kê tất cả Order có mã làm bằng chứng nguồn như trên. Ma trận tổ hợp trạng thái đơn/thanh toán/hoàn tiền PW1 → giữ/hoàn lượt PW2 vẫn là gap cần xác minh tại mốc snapshot; trường hợp chưa rõ không được tự coi là đủ điều kiện.

**Không suy sự kiện hoàn lượt chỉ từ trạng thái cuối:** đối soát export cho thấy có mã used dương gắn với Order thất bại, và có mã mà used khác tổng số Order mang mã. Listener giảm used là queued; sự tồn tại của code listener không chứng minh sự kiện đã được phát/hoàn tất cho mọi Order. Không tự bỏ mọi đơn failed/refunded để ép khớp counter hoặc coi mọi Order có mã là lượt còn giữ. Với Store có dữ liệu này cần xác minh quy tắc nguồn và disposition đích; chưa thêm history vào mẫu của Store khác để làm ví dụ.

**Snapshot:** discountCode/customerEmail lấy từ Order nguồn, không lấy bản hiện tại của Discount/Customer. amountApplied lấy orders.total_discount, chuyển thập phân chính xác theo §7.2, phải dương và bằng orders.discountAmount; không tính lại từ Promotion. Schema history định nghĩa sen, không có currency riêng: ngoài MYR phải ghi gap tới khi xác minh khả năng biểu diễn, không coi cents là sen. discountType/discountValue là field tùy chọn: thiếu bằng chứng lịch sử thì bỏ field và ghi gap, không dùng Promotion hiện tại thay snapshot hoặc điền giá trị giả. Việc thiếu snapshot tùy chọn không tự làm cách ly Order/history hợp lệ ở các điều kiện còn lại.

**GAP — hiển thị snapshot lịch sử (`DISCOUNT_HISTORY_SNAPSHOT_DISPLAY`, chưa xử lý):** bỏ `discountType/discountValue` là hợp lệ về schema nhưng chưa bảo đảm UI hiển thị trung thực. Khi thiếu một trong hai field và còn quan hệ Discount, cả giao diện mobile và desktop trong [UI lịch sử giảm giá](../../src/app/\(dashboard\)/discounts/_components/discounts-usage-history-layout.tsx) lấy `discount.type/value` hiện tại để hiển thị; [API history](../../src/app/api/v1/discounts/usage-history/route.ts) trả quan hệ với depth=1. Cấu hình hiện tại có thể bị hiểu nhầm là snapshot lúc đặt đơn. Tiếp tục bỏ snapshot chưa xác minh, không điền dữ liệu giả và không cách ly Order chỉ vì gap hiển thị này. Manifest cần ghi field thiếu và rủi ro hiển thị; không chứng nhận màn hình bảo toàn đúng lịch sử cho các bản ghi này cho tới khi UI bỏ fallback hoặc phân biệt rõ cấu hình hiện tại với thông tin lịch sử chưa xác minh. Điều kiện đóng gap: kiểm thử cả mobile/desktop với snapshot thiếu toàn bộ hoặc thiếu một field, xác nhận không trình bày cấu hình hiện tại như lịch sử. Tracking 2026-09-14: bổ sung cảnh báo và điều kiện nghiệm thu vào master; đây là mã gap tài liệu, chưa phải lỗi script phát ra; chưa sửa UI/API/JSON.

**Thời gian:** usedAt có thể suy dẫn từ orders.created_at với timezone nguồn đã xác minh; manifest phải ghi rõ nguồn và bản chất suy dẫn, không khẳng định là redemption timestamp riêng. Không dùng thời điểm import thay thời gian nguồn thiếu/sai. createdAt/updatedAt của history không có bản ghi PW1 tương ứng đã xác minh; nếu writer/DB tạo timestamps kỹ thuật thì phải phân biệt với lịch sử nguồn.

**Bộ đếm:** promotion_codes.used chỉ để đối soát, không dựng ngược từng history. Với Discount đích mới và coverage đầy đủ, usageCount bằng số history giữ lượt hợp lệ, duy nhất. Với Discount đích có dữ liệu, bảo toàn và đối soát cả lượt hiện hữu; không ghi đè bằng số lượng batch. Không vừa sao chép count vừa gọi checkout tăng lượt. Chưa đủ coverage, count lệch hoặc vượt usageLimit: ghi gap, giữ Discount inactive; không cắt history hoặc tự tăng limit.

**Preflight chưa triển khai:** kiểm tra Tenant–Discount–Order tồn tại/cùng tenant, FK Discount trên Order khớp history; không tham chiếu bản ghi bị cách ly. Mỗi Order tối đa một history theo unique order_id; crosswalk nguồn/Store/Order ổn định, replay không thêm dòng/tăng count, xung đột phải báo lỗi. Kiểm tra tiền/đơn vị/timestamp; manifest phải phân loại toàn bộ Order có mã thành đã emit, không giữ lượt theo rule đã xác minh, hoặc cách ly/chưa xác minh. Lưu lý do và provenance ngoài payload, không đưa số liệu Store mẫu vào master.

**Tracking 2026-09-14:** bổ sung các gap tài liệu: DISCOUNT_HISTORY_ELIGIBILITY (ma trận giữ/hoàn lượt), DISCOUNT_HISTORY_REFERENCE (resolve FK/mã), DISCOUNT_HISTORY_SNAPSHOT (snapshot thiếu/suy dẫn), DISCOUNT_HISTORY_CURRENCY (tiền tệ chưa tương thích), DISCOUNT_HISTORY_PREFLIGHT (validation/replay), DISCOUNT_USAGE_RECONCILIATION (counter/coverage). Đây chưa phải mã lỗi script phát ra. Sanitizer hiện chỉ đổi tên field; collection khóa create/update/delete qua access thông thường. Cần writer lịch sử chuyên biệt; không dùng nguyên checkout redemption vì tăng count, áp limit hiện tại và ghi NOW. Chỉ cập nhật tài liệu, chưa sửa exporter/JSON/importer/hook/schema; gap hiệu lực Discount §7.1 giữ nguyên.

Các field JSON sau thuộc `discount_usage_history[]`; tất cả quy tắc còn chờ triển khai và kiểm chứng:

| Nguồn PW1 | Quy tắc | Field JSON | Bảng.cột PW2 | Trạng thái |
|---|---|---|---|---|
| Source instance + orders.store_id | Crosswalk Store → Tenant, kiểm tra cùng tenant | `tenant` | `discount_usage_history.tenant_id` | R/B |
| orders.id | Crosswalk nguồn/Store/Order; chỉ trỏ Order hợp lệ đã emit | `order` | `discount_usage_history.order_id` | R/B |
| orders.promotion_code → promotion_codes.code → promotion_id | Xác minh Store qua promotions.store_id, mã nguồn duy nhất và Discount đủ điều kiện §7.1; không resolve bằng mã đơn lẻ | `discount` | `discount_usage_history.discount_id` | R/B |
| orders.total_discount | Minor units chính xác, dương, khớp Order và tiền tệ theo quy tắc trên | `amountApplied` | `discount_usage_history.amount_applied` | T/B |
| orders.promotion_code | Snapshot nguyên mã trên Order | `discountCode` | `discount_usage_history.discount_code` | D/B |
| orders.customer_email | Snapshot trên Order nếu có | `customerEmail` | `discount_usage_history.customer_email` | D/B |
| Chưa có snapshot loại/giá trị trong Order PW1 đã kiểm tra | Field tùy chọn; thiếu bằng chứng lịch sử thì không xuất, ghi gap | `discountType`, `discountValue` | `discount_usage_history.discount_type`, `discount_value` | A/B |
| orders.created_at | ISO UTC từ timezone đã xác minh; ghi provenance suy dẫn | `usedAt` | `discount_usage_history.used_at` | T/B |
| Không có history nguồn tương ứng đã xác minh | Timestamp kỹ thuật bản ghi đích, không nhận là lịch sử PW1 | `createdAt`, `updatedAt` | `discount_usage_history.created_at`, `updated_at` | G/B |

**Căn cứ:** [schema history](../../src/collections/DiscountUsageHistory.ts), [schema Order](../../src/collections/Orders.ts), [DDL/unique Order](../../scripts/db-setup.js), [giữ lượt](../../src/lib/discounts/record-discount-redemption.ts), [hoàn lượt](../../src/lib/discounts/release-discount-redemption.ts), [sanitizer hiện tại](../../scripts/data/generate-two-store-pw2-current-schema.mjs). Tracking cùng ngày: đồng bộ §7.1/§7.2 và sửa slug history tại §2; không bổ sung dữ liệu fixture vào master.

## 8. Nội dung blog và email

### 8.1 Danh mục blog

**Phạm vi:** research cấu trúc JSON và mapping field; Blog/BlogCategory đổi unique slug sang tenant+slug theo quyết định đã duyệt, cần xác minh migration DB đích. Đánh giá theo độ đúng/đủ của nguồn–đích và gap dữ liệu, không yêu cầu viết exporter/importer. Quy tắc mới là `DECISION/SCHEMA`, không tự nhận `CODE`. `B` ở phần này chỉ phần ánh xạ/khả năng bảo toàn chưa được xác minh đầy đủ, không phải yêu cầu triển khai công cụ. Bảng đối chiếu bao phủ 18 cột blog_categories và 22 cột blog_posts trong header DB export đã kiểm tra, không dùng số liệu Store mẫu làm contract.

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái |
|---|---|---|---|---|
| `blog_categories.id` | Định danh ổn định | `_ref` | Chỉ dùng đối chiếu ID | `R` |
| `store_id` | Phân giải Tenant | `tenant` | `blog_categories.tenant_id` | `R` |
| `name` | Giữ tên nguồn, kiểm tra field bắt buộc | `name` | `blog_categories.name` | `D/Q` |
| `slug` | Kiểm tra duy nhất theo tenant trong blog_categories; xem quy tắc slug chung bên dưới | `slug` | `blog_categories.slug` | `D/Q/B` |
| `status`, `deleted_at` | Nguồn chưa xóa và status=1 → active. Status=0 không tự map deleted/active vì PW2 không có inactive; chưa xác định/không hỗ trợ thì cách ly, giữ nguồn và ghi gap | `status` | `blog_categories.status` | `T/Q/B` |
| `blog_categories.name_ms` | Không có tên đa ngôn ngữ đích; giữ nguồn, không ghi đè name chính | Không đưa vào payload PW2 | Không có | `A/B` |
| `blog_categories.description`, `description_ms` | Không có mô tả category đích; giữ nguyên văn nguồn | Không đưa vào payload PW2 | Không có | `A/B` |
| `blog_categories.title`, `meta_description` | Đây là SEO category nguồn, không đổi thành tên category; PW2 không có SEO category | Không đưa vào payload PW2 | Không có | `A/B` |
| `blog_categories.image` | Giữ nguyên URL nguồn; không tạo field ảnh category PW2 không tồn tại | Lưu nguồn ngoài payload category | Không có quan hệ ảnh category | `A/B` |
| `blog_categories.signature` | Metadata chữ ký do luồng ảnh PW1 trả về; không phải URL/alt hay ID Media | Lưu nguồn hạn chế truy cập | Không có | `A/B` |
| `blog_categories.parent_id` | Quan hệ category cha theo Store; PW2 là danh mục phẳng, không tự nối tên để giả lập cây | Lưu quan hệ nguồn ngoài payload | Không có | `A/B` |
| `blog_categories.position` | Giữ thứ tự nguồn; không thay bằng thứ tự tạo ID đích | Lưu nguồn ngoài payload | Không có | `A/B` |
| `blog_categories.created_by` | Giữ định danh người tạo nguồn để đối chiếu; category PW2 không có author | Lưu nguồn ngoài payload | Không có | `A/B` |
| `blog_categories.created_at`, `blog_categories.updated_at` | Đọc đúng ID/Store; timezone/offset nguồn phải xác minh → ISO UTC; thiếu/sai thì cách ly, không dùng thời gian export/import thay lịch sử | `createdAt`, `updatedAt` | `blog_categories.created_at`, `blog_categories.updated_at` | `T/Q/B` |
| `blog_categories.deleted_at` | Không emit bản ghi đã xóa; giữ nguồn ngoài payload, không đồng nhất inactive với deleted | Không xuất/lưu nguồn | Không có field deletedAt tương đương | `X/A` |

**GAP trạng thái (`BLOG_CATEGORY_INACTIVE`):** enum PW2 là active/deleted, không có inactive. Danh mục PW1 ngừng hoạt động chưa có ánh xạ tương đương; không tự kích hoạt hoặc đánh dấu đã xóa. Bài viết trỏ danh mục đã xóa/cách ly/mất nguồn phải ghi gap quan hệ và giữ draft trong dữ liệu nghiên cứu; chưa chứng nhận import bài đó cho đến khi quyết định có thể bỏ category được phê duyệt hoặc quan hệ được giải quyết. Category là optional về schema nhưng không được âm thầm xóa quan hệ nguồn để vượt hook. Không cần loại nội dung nguồn khỏi archive.

**Slug chung cho §8.1–§8.2 (`BLOG_SLUG_COLLISION`), quyết định 2026-09-17:** giữ slug hợp lệ, unique theo tenant trong từng collection blog_categories và blogs; hai collection không dùng chung namespace. PW1 kiểm tra theo Store và PW2 đã bổ sung composite tenant+slug trong source/schema cùng migration SQL. Kiểm tra toàn bộ batch theo tenant và dữ liệu đích hiện hữu trước import; chạy và kiểm chứng migration DB đích trước khi sử dụng duplicate khác tenant. Collision cùng tenant chưa giải quyết phải cách ly; không tự merge, ghi đè hoặc thêm hậu tố làm đổi URL. Replay dùng crosswalk nguồn/Store/ID, không coi trùng slug là cùng bản ghi. Blog slug phải là một URL segment hợp lệ theo validateBlogSlug, không nhận điểm đơn, điểm đôi hoặc chuỗi có dấu slash. Thay đổi source không chứng minh DB vận hành đã migrate.

### 8.2 Bài viết blog

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái |
|---|---|---|---|---|
| `blog_posts.id` | Định danh ổn định | `_ref` | Chỉ dùng đối chiếu ID | `R` |
| `store_id` | Phân giải Tenant/Site | `tenant`, `site` | `blogs.tenant_id`, `site_id` | `R` |
| `name` | Tiêu đề quan sát được hiện tại | `title` | `blogs.title` | `D` |
| `slug` | Giữ khi hợp lệ và duy nhất theo tenant trong blogs; áp dụng quy tắc slug chung §8.1 | `slug` | `blogs.slug` | `D/Q/B` |
| `blog_posts.content` | HTML nguồn → cấu trúc Lexical hợp lệ của PW2; không gán chuỗi HTML vào richText. Chỉ nhận tương đương sau khi đối chiếu nội dung theo quy tắc bên dưới; phần chưa biểu diễn được giữ nguyên nguồn | `blogs[].content` | `blogs.content` JSONB | `T/A/B` |
| `status` | Giữ trạng thái PW1: 1 → published; 0 → draft; ngoài miền phải đối soát | `status` | `blogs.status` | `T/B` |
| `blog_category_id` | Resolve category cùng tenant, đã emit và status=active; thiếu/xóa/cách ly thì ghi gap, không âm thầm bỏ quan hệ | `category` | `blogs.category_id` | `R/Q/B` |
| `image` | Tạo/phân giải Media dùng URL ngoài | `thumbnail` | `blogs.thumbnail_id` | `T/R/B` |
| `created_by` | Phân giải User đủ điều kiện | `author` | `blogs.author_id` | `R/Q` |
| `title`, `meta_description` ở nguồn | Metadata SEO | `seo.metaTitle/metaDescription` | `blogs.seo_meta_title/meta_description` | `D` |
| `blog_posts.name_ms` | Không có title đa ngôn ngữ đích; không ghi đè title chính | Lưu nguồn ngoài payload | Không có | `A/B` |
| `blog_posts.content_ms` | Giữ HTML ngôn ngữ thứ hai; không gộp hai ngôn ngữ vào một content hoặc tự tạo bài thứ hai | Lưu nguồn ngoài payload | Không có content đa ngôn ngữ tương đương | `A/B` |
| `blog_posts.summary`, `summary_ms` | Không có excerpt; không tự dùng summary thay content hoặc SEO description | Lưu nguồn ngoài payload | Không có | `A/B` |
| `blog_posts.meta_tag` | Giữ cấu trúc metadata nguồn; không tự thêm seo.keywords không có trong schema | Lưu nguồn ngoài payload | Không có | `A/B` |
| `blog_posts.is_featured`, `is_pinned` | Giữ hai cờ độc lập; không đổi thành published hoặc thứ tự bài | Lưu nguồn ngoài payload | Không có | `A/B` |
| `blog_posts.signature` | Chữ ký của luồng ảnh PW1; không dùng làm thumbnail hoặc Media ID | Lưu nguồn hạn chế truy cập | Không có | `A/B` |
| Chưa có timestamp xuất bản/lên lịch riêng trong bảng blog_posts đã kiểm tra | Không suy từ created_at/updated_at hoặc cờ status; giữ unset, không tự đặt ngày hiện tại | `publishedAt`, `scheduledPublishDate` chưa thiết lập | `blogs.published_at`, `blogs.scheduled_publish_date` | `A/B` |
| `blog_posts.created_at`, `blog_posts.updated_at` | Đọc đúng ID/Store; timezone/offset nguồn phải xác minh → ISO UTC; thiếu/sai thì cách ly, không lấy thời gian import, publishedAt hoặc scheduledPublishDate thay thế | `createdAt`, `updatedAt` | `blogs.created_at`, `blogs.updated_at` | `T/Q/B` |
| `blog_posts.deleted_at` | Không emit bài viết đã xóa; giữ bằng chứng nguồn ngoài payload | Không xuất/lưu nguồn | Không có field deletedAt tương đương | `X/A` |

Blog không có `content` chỉ là bản nháp metadata, không được coi là đã migrate đầy đủ bài viết.

**Contract nội dung (`BLOG_CONTENT_FIDELITY`):** đối chiếu HTML nguồn với Lexical theo từng bài: văn bản, heading, paragraph/ngắt dòng, định dạng, danh sách, liên kết, ảnh và alt, figure/caption, bảng, embed và thứ tự. Đây là checklist kiểm kê, không khẳng định mọi cấu trúc đều có trong PW1 hoặc được editor PW2 hỗ trợ. Node không biểu diễn/render được phải ghi gap cụ thể và giữ HTML gốc; không âm thầm bỏ, chuyển tất cả thành plain text hoặc coi root rỗng là đủ content. Không mang script/event handler/URL nguy hiểm vào nội dung hiển thị; phần loại bỏ vì an toàn cũng cần ghi nhận ngoài payload. Quan hệ hoặc URL nội bộ tới bài/category/product phải đối chiếu crosswalk và quy tắc slug; không tự đổi link ngoài.

**Nội dung đã đồng bộ trong JSON mẫu (`OBSERVED`, 2026-09-15):** các bài đã có `content` Lexical từ HTML nguồn, được kiểm tra bằng các node Lexical đang cài trong PW2. Đối chiếu văn bản sau chuẩn hóa whitespace, thứ tự, heading, paragraph/ngắt dòng, danh sách, bold/italic, liên kết và ảnh; giữ text style màu nền/màu chữ/cỡ chữ cùng căn lề đoạn khi chuyển đổi. Giữ nguyên href nguồn, kể cả dạng tương đối; không tự thêm `https://` làm đổi đích liên kết. Ảnh nội dung dùng upload node v3 trỏ Media URL ngoài theo §4.3; ID node được dựng xác định từ bài nguồn và thứ tự duyệt, không lấy ID tùy ý khi chạy lại. HTML nguồn tại `sites[].pw1_source.blog_posts[].content` giữ chuỗi nguồn khi vượt bộ lọc raw §2.3; HTML bị loại khỏi raw JSON vẫn nằm trong CSV snapshot.

**Giới hạn bảo toàn trình bày:** kiểm chứng dữ liệu mẫu không chứng minh chuyển đổi mọi HTML PW1 hoặc tương đương từng pixel. CSS/layout ngoài khả năng biểu diễn của node hiện tại, chẳng hạn width của ảnh/span hoặc class nguồn, tiếp tục được bảo toàn trong HTML gốc; không suy thành kích thước ảnh thực. Bảng, figure/embed hoặc cấu trúc chưa có trong tập đã kiểm chứng phải tiếp tục đối soát riêng khi gặp nguồn mới. Đây là giới hạn `BLOG_CONTENT_FIDELITY`, không lý do loại văn bản/ảnh đã chuyển được hoặc gán HTML thẳng vào richText. Generator tổng quát và runtime chưa được sửa trong lượt đồng bộ artifact này.

**GAP-BLOG-LEXICAL-RENDER — OPEN:** schema Blog dùng richText Lexical nhưng [trang bài viết storefront](../../src/app/sites/[slug]/blog/[blogSlug]/page.tsx:258) và [trang preview](../../src/app/(preview)/preview/[siteId]/blog/[blogSlug]/page.tsx:298) hiện chỉ đưa `post.content` vào HTML khi giá trị là chuỗi; object Lexical bị thay bằng chuỗi rỗng. Vì vậy có đầy đủ Lexical trong JSON chưa làm nội dung hiển thị trên hai route này. Giữ đúng kiểu dữ liệu collection, không đổi ngược thành chuỗi HTML để né renderer. Khi triển khai hiển thị cần renderer Lexical tương thích các node đã dùng, gồm upload Media và liên kết; đây là gap runtime đã ghi nhận, không sửa code/schema trong phạm vi master và JSON mẫu.

**Ảnh và quan hệ tùy chọn:** blog_posts.image có dữ liệu → resolve Media chứa nguyên URL PW1 theo §4.3, rồi đặt thumbnail bằng tham chiếu Media, không đặt URL trực tiếp vào field upload. Không upload lại S3 PW2; giữ query/path URL, không dùng signature để thay URL. Ảnh trong HTML là nội dung riêng, không được chỉ giữ thumbnail rồi bỏ ảnh nội dung. Nguồn không có ảnh thì không cần thumbnail; có ảnh nhưng chưa resolve được phải ghi gap, không coi là nguồn trống. Tương tự, category thực sự rỗng nếu có trong nguồn phải phân biệt với FK có giá trị nhưng mất/đã xóa/cách ly; không tự tạo category giả. Không dùng defaults để che dữ liệu nguồn thiếu.

**Trạng thái bài — quyết định 2026-09-18:** giữ trạng thái nguồn: status=1 → published, status=0 → draft. Không ép mọi bài thành draft. Giá trị thiếu/ngoài miền bị chặn thay vì đoán. Không có ngày xuất bản riêng thì ghi thiếu bằng chứng, không lấy createdAt giả làm publishedAt. Author bắt buộc ở PW2: created_by phải resolve đúng người qua crosswalk User; thiếu hoặc quan hệ tenant chưa rõ thì ghi gap, không tự thay bằng owner/người chạy công cụ.

**Tương thích quan hệ với PW2 (`BLOG_IMPORT_RELATIONSHIPS`):** JSON phải thể hiện Tenant/Site/Category/Author/Media qua crosswalk đúng phạm vi nguồn: Site thuộc Tenant; Category khi có phải active cùng Tenant; Author tồn tại và quan hệ tenant phù hợp; thumbnail khi có phải resolve đúng Media. Category/thumbnail không có ở nguồn không phải lỗi, khác với tham chiếu có giá trị nhưng chưa resolve. Hook BlogCategories/Blogs có thể thay tenant bằng tenant đầu tiên của actor không phải super-admin; Blogs còn kiểm tra category, thay/bỏ site không phù hợp hoặc chọn site đầu tiên khi thiếu. Ghi nhận đây là rủi ro bảo toàn quan hệ khi dùng dữ liệu mapping với PW2; không coi overrideAccess là vô hiệu hóa hook, không coi ID trong JSON là bằng chứng dữ liệu đích đã đúng. Đây là lưu ý tương thích source/schema, không phải yêu cầu viết writer hay kế hoạch triển khai.

**Tracking 2026-09-14:** bổ sung mapping timestamps và tách deleted_at; phân rã đầy đủ field nguồn trước đây gộp chung, bổ sung signature/created_by category, checklist content, URL ảnh, trạng thái/author và thời gian xuất bản. Theo dõi BLOG_CATEGORY_INACTIVE, BLOG_SLUG_COLLISION, BLOG_IMPORT_RELATIONSHIPS, BLOG_CONTENT_FIDELITY cùng các dòng A/B không có field đích. Các mã là tracking tài liệu. Không dùng việc chưa có exporter/importer làm finding. Lượt này chỉ sửa master; không thay JSON/source/schema. Bằng chứng Store cụ thể thuộc report/manifest; phần không có đích nằm ngoài payload collection, không tự thêm bảng hoặc field PW2.

**Căn cứ:** [BlogCategories](../../src/collections/BlogCategories.ts), [Blogs và hooks](../../src/collections/Blogs.ts), [schema vật lý](../../scripts/db-setup.js), [BlogCategory PW1](/home/liam/data/prime-web-api/app/Models/BlogCategory.php), [BlogPost PW1](/home/liam/data/prime-web-api/app/Models/BlogPost.php).

**Fidelity nội dung:** navigation URL có policy riêng cho HTTP(S), relative anchor, mailto/tel hợp lệ; không dùng policy ảnh để bác link thường. Credential, scheme nguy hiểm và query nhạy cảm/chưa xác minh vẫn bị chặn. Media policy giữ riêng; không nhận là bảo toàn layout chỉ vì HTML đã chuyển thành Lexical.

### 8.3 Cấu hình mẫu email

**Phạm vi hiện tại:** `deferEmailTemplates=true` giữ email-template-settings rỗng kèm evidence hoãn; không coi nguồn rỗng hoặc đã map thành công. Không tắt email runtime PW2. Bảng field dưới đây là contract khi triển khai lại nhóm này, không phải bằng chứng đã emit trong followup-001.

**Phạm vi 2026-09-17:** khi policy `deferEmailTemplates=true`, không emit email-template-settings; giữ nguồn ngoài payload và ghi warning/provenance. Các mapping chi tiết bên dưới mô tả semantics nếu mở lại scope, không yêu cầu migrate email trong đợt này. Email runtime PW2 không bị tắt.


| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái | Xác minh |
|---|---|---|---|---|---|
| `store_email_templates.id` | Định danh ổn định | `_ref` | Chỉ dùng đối chiếu ID | `R` | `CODE` |
| `store_id` | Phân giải Tenant | `tenant` | `email_template_settings.tenant_id` | `R` | `CODE/SCHEMA` |
| `type_id=1/2/3` | Xác nhận/hủy/hoàn tất đơn hàng; loại chưa hỗ trợ bị cách ly | `templateType` | `template_type` | `T/Q` | `CODE/SCHEMA` |
| Quyết định theo loại mẫu | Recipient buyer đã quan sát theo luồng hiện tại; chưa suy rộng cho loại mẫu khác | `recipient='buyer'` | `recipient` | `G/T` | `CODE/SCHEMA` |
| `status` | Chuyển thành boolean | `enabled` | `enabled` | `T` | `CODE/SCHEMA` |
| `subject`, `subject_ms` | Giữ chuỗi từng ngôn ngữ, tối đa 200 ký tự; xem quy tắc field rỗng bên dưới | `contentEn.subject`, `contentMs.subject` | `email_template_settings.content_en_subject`, `content_ms_subject` | `D/B` | `CODE/SCHEMA`; sao chép không chứng nhận tương đương render |
| `greeting_message`, `greeting_message_ms` | Giữ chuỗi, tối đa 500 ký tự; khác vị trí/ngữ nghĩa hiển thị PW1, xem gap greeting bên dưới | `contentEn.greeting`, `contentMs.greeting` | `email_template_settings.content_en_greeting`, `content_ms_greeting` | `D/B` | `CODE/SCHEMA`; chưa bảo toàn cấu trúc email |
| `button_label`, `button_label_ms` | Giữ nhãn nút từng ngôn ngữ, tối đa 100 ký tự; không bao gồm URL đích của nút | `contentEn.ctaLabel`, `contentMs.ctaLabel` | `email_template_settings.content_en_cta_label`, `content_ms_cta_label` | `D/B` | `CODE/SCHEMA`; field rỗng chịu fallback |
| `closing_message`, `closing_message_ms` | Giữ chuỗi từng ngôn ngữ, tối đa 2000 ký tự; không tự ghép/thêm lời chào hoặc footer nguồn | `contentEn.closing`, `contentMs.closing` | `email_template_settings.content_en_closing`, `content_ms_closing` | `D/B` | `CODE/SCHEMA`; field rỗng chịu fallback |
| `preview_html`, `preview_html_ms` | Không có field đích | Không xuất/lưu nguồn | Không có | `A/B` | `CODE/SCHEMA` |
| `store_email_templates.created_at`, `store_email_templates.updated_at` | Đúng bản ghi ID/Store; timezone/offset nguồn đã xác minh → ISO UTC. Không dùng thời gian export/import thay thời gian nguồn; thiếu/sai thì giữ nguồn và ghi gap | `createdAt`, `updatedAt` | `email_template_settings.created_at`, `email_template_settings.updated_at` | `T/B` | `OBSERVED/SCHEMA`; JSON mẫu đã bổ sung và đối soát nguồn; chưa chứng nhận bảo toàn qua importer |
| `store_email_templates.deleted_at` | Loại cấu hình đã xóa; giữ bản ghi nguồn ngoài payload, không coi đây là timestamp đích | Không xuất/lưu nguồn | Không có deletedAt tương đương | `X/A` | `CODE/SCHEMA` |
| Không có người sửa cuối tương ứng trong bảng nguồn đã kiểm tra | Không suy updatedBy từ created_by, updated_at hoặc owner. Hook PW2 có thể gán actor hiện tại; đây là người sửa bản ghi đích, không phải bằng chứng người sửa PW1 | `updatedBy` chưa map lịch sử | `email_template_settings.updated_by_id` | `A/B` | `SCHEMA` |

**GAP cấu trúc lời chào (`EMAIL_GREETING_SEMANTICS`):** PW1 render lời chào tên khách riêng, rồi hiển thị greeting_message như đoạn nội dung. PW2 đưa greeting vào tiêu đề lời chào, thêm dấu phẩy và vẫn giữ đoạn body mặc định theo loại mẫu. Mapping trên bảo toàn chuỗi nhưng không bảo toàn vị trí, dấu câu hoặc toàn bộ email. Không tự thêm tên khách, ghép lời chào hay chuyển sang field body không tồn tại để che khác biệt. Cần chấp nhận rõ việc dùng bố cục PW2 hoặc có quyết định riêng nếu phải giữ bố cục PW1; chưa coi email tương đương hoàn toàn chỉ vì các field đã được map. Không sửa template runtime trong phạm vi research này.

**GAP field rỗng/ngôn ngữ (`EMAIL_EMPTY_LOCALE_FALLBACK`):** PW1 getTranslate đọc trực tiếp field EN/MS theo locale; PW2 chỉ override bằng chuỗi có độ dài >0. Thiếu/null/chuỗi rỗng vì thế dùng text mặc định, không có nghĩa là ẩn đoạn email. Nếu cả nhóm locale không có nội dung, PW2 chọn nhóm ngôn ngữ còn lại; nếu nhóm có một field không rỗng thì chọn cả nhóm đó, các field còn thiếu fallback về defaults của template, không fallback từng field sang nhóm kia. Không tự chèn khoảng trắng hoặc sao chép EN sang MS để lách fallback. Giữ trạng thái nguồn thiếu/null/rỗng trong bằng chứng đối chiếu, chỉ công nhận tương đương khi đã đối chiếu kết quả từng loại mẫu và locale hoặc chấp nhận rõ hành vi PW2. Một mẫu cụ thể đầy đủ field không có lỗi rỗng, nhưng contract dùng chung vẫn phải nêu giới hạn này.

**Tiêu chí đối chiếu dữ liệu:** kiểm tra cả EN/MS, đủ field, nhóm rỗng toàn bộ, thiếu từng field và dữ liệu vượt maxLength; không cắt chuỗi âm thầm. Đối chiếu greeting, body mặc định, nhãn nút và closing như các phần riêng; preview_html là bằng chứng bố cục nguồn, không phải payload có thể gán thẳng sang cấu hình PW2. Đối với timestamps, giữ instant nguồn qua offset đã xác minh; không suy ngày tạo/cập nhật từ preview hoặc thời điểm gửi mail.

**Tracking 2026-09-14:** tách mapping 8 field nội dung EN/MS, thêm EMAIL_GREETING_SEMANTICS và EMAIL_EMPTY_LOCALE_FALLBACK; bổ sung mapping createdAt/updatedAt, tách deleted_at và nêu rõ updatedBy không có nguồn lịch sử tương ứng. Đây là cập nhật master phục vụ research/mapping, không phải kế hoạch hay yêu cầu viết exporter/importer. Không thay JSON, schema hoặc runtime email; số liệu mẫu thuộc manifest/report, không phải rule master.

**Tracking 2026-09-15 — đồng bộ timestamps email:** JSON mẫu đã bổ sung `createdAt`/`updatedAt` từ đúng dòng `store_email_templates` theo ID/Store, chuyển ISO UTC bằng offset nguồn đã xác minh cho snapshot. Không gán `updatedBy` lịch sử hoặc thay thời gian nguồn bằng ngày export. Cập nhật này hoàn tất dữ liệu timestamps trong artifact, không sửa generator/runtime và không đóng các khác biệt bố cục, fallback locale hoặc khả năng bảo toàn timestamps khi ghi DB.

**Căn cứ:** [schema cấu hình email](../../src/collections/EmailTemplateSettings.ts), [merge field/default](../../src/lib/email/merge-template-config.ts), [chọn locale](../../src/lib/email/get-template-config.ts), [template PW2](../../src/lib/email/templates/order-confirmation.ts), [model PW1](/home/liam/data/prime-web-api/app/Models/StoreEmailTemplate.php), [template PW1](/home/liam/data/prime-web-api/resources/views/emails/orders/created_for_customer.blade.php).

## 9. Đăng ký gói dịch vụ

### 9.1 Gói dịch vụ đã đăng ký

**Nguồn xác định gói là đăng ký thực tế trong DB PW1.** User sử dụng gói của Store qua `users.store_id`; đăng ký thuộc Store, không nối trực tiếp User ID vào subscribable_id. Quy tắc này thay thế cách kế thừa gói từ preview hoặc tự mặc định free trước đây. `users.expired_at` là bằng chứng đối soát bổ sung cho lifecycle §3.1, không thay ngày subscription; Store status=2 không đủ kết luận subscription đã ended vì gap isExpired/unban nguồn.

1. Lọc `plan_subscriptions.subscribable_type = App\Models\Store` và `subscribable_id = stores.id`; xác minh đăng ký `name = main`.
2. Đối soát thời điểm bắt đầu/kết thúc, hủy ngay/hủy cuối kỳ và trạng thái đăng ký tại mốc dữ liệu nguồn. Không chỉ dựa vào một cờ trạng thái hoặc ngày hiện tại lúc chạy migration.
3. Nối `plan_subscriptions.plan_id → plans.id`, lấy mã gói nguồn để đối chiếu riêng với enum `tenants.plan` và enum `plan-subscriptions.plan` của PW2. Không giả định hai enum đích giống nhau hoặc mã PW1 có thể sao chép trực tiếp.
4. Nếu thiếu đăng ký main, có nhiều bản ghi không xác định được bản chính, thời gian/trạng thái mâu thuẫn hoặc chưa có mã gói tương đương: ghi `B` và lý do; không tự chọn bản đầu tiên, tự nâng/hạ gói hoặc mặc định `free`. Chỉ dùng free khi có bằng chứng nguồn và quy tắc đối chiếu đã chốt.
5. Giữ ID/mã gói, quan hệ và thời hạn nguồn trong dữ liệu đăng ký hoặc nguồn lưu trữ có đối chiếu. SSO không thay thế DB PW1 khi xác định gói nguồn; các field tích hợp riêng như packCode vẫn cần bằng chứng tương ứng.

**Phạm vi:** research master và JSON mapping, không yêu cầu triển khai exporter/importer. Mã plans.code nguồn đã xác minh thuộc đúng enum PW2 có thể giữ nguyên; mã khác phải ghi gap, không suy theo tên/giá hoặc tự chọn TM/non-TM. Tình trạng từng Store nằm trong manifest, không suy ra rằng mọi gói đã tương đương quyền chỉ vì code khớp.

| plans.code nguồn đã xác minh → plan-subscriptions.plan | tenants.plan |
|---|---|
| FREEMIUM | free |
| STARTER_TM_USER, STARTER_NON_TM_USER | starter |
| STANDARD_TM_USER, STANDARD_NON_TM_USER | pro |
| PROFESSIONAL_TM_USER, PROFESSIONAL_NON_TM_USER | business |

**Trạng thái và mốc đối chiếu:** PW1 status là thuộc tính tính toán, không có cột status trong bảng nguồn đã kiểm tra. Ghi asOf trong manifest, dùng timestamp nguồn có offset tường minh. PW1 active khi (chưa hết ends_at hoặc còn trial) và không hủy ngay; nếu không active thì canceled khi canceled_at có giá trị, nếu không thì ended khi hết hạn. Khi không có trial: hủy cuối kỳ còn hạn phải giữ active + canceledAt + canceledImmediately=false, không gán canceled làm PW2 khóa ngay. Hủy ngay cần cả canceled_at và cờ true. Không tự biến cờ rỗng thành bằng chứng false; giữ giá trị nguồn, ghi phần chưa rõ. PW2 kiểm tra endsAt theo thời gian hiện tại: status active tại snapshot không bảo đảm còn active về sau. Không gia hạn nguồn để giữ trạng thái snapshot.

**Trial (`SUBSCRIPTION_TRIAL_PARITY`):** trial_ends_at ảnh hưởng isActive của PW1 nhưng PW2 không có field tương đương. Giữ ngày trial ngoài payload; nếu trial làm thay đổi quyền so với endsAt đích thì ghi gap, không tự kéo endsAt hay bỏ bằng chứng trial. Ngày startsAt chưa tới cũng cần khai báo: predicate PW2 hiện không xét startsAt, không mặc nhiên coi field lưu được là gói tương lai đã được khóa đúng.

**Ma trận quyết định subscription tại `asOf` — bổ sung 2026-09-15:** chỉ áp dụng sau khi chọn đúng main, xác minh plan, timezone và kiểu dữ liệu. Đọc cờ boolean từ boolean hoặc 0/1 nguồn đã xác minh; không dùng truthiness của chuỗi `"0"`. Ngày không hợp lệ, startsAt > endsAt, canceledAt trong tương lai hoặc cờ hủy ngay không có canceledAt phải đối soát, không nhận default active. Đây là contract mapping, chưa phải logic importer đã triển khai.

| Điều kiện nguồn nhất quán | Status đích / quyết định |
|---|---|
| Có canceled_at ≤ asOf và canceled_immediately=true | `canceled`, giữ nguyên ngày/cờ hủy; không đổi Tenant thành cancelled theo subscription |
| ends_at > asOf, không hủy ngay, không có canceled_at | `active`, giữ nguyên thời hạn; không suy Tenant trialing từ gói hay tên plan |
| ends_at > asOf, canceled_at ≤ asOf và canceled_immediately=false | `active` + ngày/cờ hủy nguồn; đây là bảo toàn trạng thái tính toán, chưa tương đương mọi route PW1 — xem gap bên dưới |
| ends_at ≤ asOf, không còn trial hiệu lực, có canceled_at | `canceled`; không bỏ bằng chứng hủy để đổi thành ended |
| ends_at ≤ asOf, không còn trial hiệu lực, không có canceled_at | `ended`; giữ code/tier gói lịch sử, không hạ về free |
| ends_at ≤ asOf nhưng trial_ends_at > asOf, không hủy ngay | PW1 tính active nhưng PW2 từ chối do endsAt. Giữ nguồn và disposition `SUBSCRIPTION_TRIAL_PARITY`; chưa đưa vào tập import vận hành tương đương, không sửa endsAt hoặc giả trạng thái ended |
| starts_at > asOf | Giữ ngày và trạng thái tính toán nguồn trong đối soát; chưa cho vận hành như gói đã bắt đầu. Không suy rằng cả hai runtime đã chặn gói tương lai |

Điều kiện ngày tương lai/mâu thuẫn được kiểm tra trước các dòng active. Giữ gói có starts_at tương lai để đối soát là quyết định migration, không phải trạng thái nguồn: predicate isActive PW1 và isSubscriptionActive PW2 đều không xét startsAt. Status tại snapshot không đóng băng quyền: khi đối soát trước cutover phải tính lại tại mốc mới, không thay ngày nguồn để duy trì quyền cũ. Tenant status vẫn theo §3.1; plan code, subscription status và Tenant status là ba quyết định riêng.

**Gap chặn route (`SUBSCRIPTION_ROUTE_PARITY`):** [FeatureMiddleware PW1](/home/liam/data/prime-web-api/app/Http/Middleware/FeatureMiddleware.php:39) chặn khi `isCanceled() || isEnded()`, không dùng riêng `isActive()`. Vì vậy hủy cuối kỳ còn hạn có thể có computed status active nhưng vẫn bị middleware này chặn; trial còn hạn sau ends_at cũng không vượt qua middleware này. PW2 [isSubscriptionActive](../../src/lib/subscriptions/plan-subscription.ts:39) xử lý khác. Không tuyên bố giữ status active là giữ nguyên quyền toàn hệ thống, cũng không đổi thành canceled để giả lập mọi route. Giữ mapping dữ liệu; nhóm có chênh lệch phải ghi rõ route/tính năng ảnh hưởng và đối soát trước khi cho vận hành. Bản ghi khác không tự bị cách ly chỉ vì tồn tại gap này.

**Identity và lịch sử:** đối chiếu theo source instance + Store + subscription ID. PW2 UNIQUE(tenant_id,name): không dồn nhiều đăng ký lịch sử vào cùng main, không merge usage từ subscription khác chỉ vì cùng Store. Các đăng ký không được chọn vẫn giữ nguồn và lý do. Mã gói xác định từ DB PW1, không gọi logic SSO để suy lại lịch sử: source SSO hiện cắt ngày về biên UTC, có fallback kỳ hạn và thay đổi usage; đó không phải quy tắc mapping ngày nguồn.

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái |
|---|---|---|---|---|
| `plan_subscriptions.id` | Định danh ổn định | `_ref` | Chỉ dùng đối chiếu ID | `R` |
| `subscribable_type=App\Models\Store`, `subscribable_id → stores.id` | Phân giải Tenant qua bảng đối chiếu Store→Tenant; kiểm tra đúng loại chủ thể | `tenant` | `plan_subscriptions.tenant_id` | `R/B` |
| `name` | Chọn đăng ký main đã xác minh; không đổi tên đăng ký khác thành main để lấp dữ liệu thiếu | `name` | `name` | `D/B` |
| `plan_subscriptions.plan_id → plans.id → plans.code` | Đối chiếu mã gói PW1 sang enum đăng ký PW2; đồng thời đối chiếu riêng sang tenants.plan theo cùng đăng ký nguồn | `plan` | `plan_subscriptions.plan` | `R/T/B` |
| Trạng thái và thời gian đăng ký thực tế PW1 | Suy ra trạng thái đích theo quy tắc đã đối soát tại mốc nguồn; không thay bằng trạng thái preview/SSO hoặc coi hết hạn là gói free | `status` | `plan_subscriptions.status` | `T/B` |
| `starts_at`, `ends_at`, `canceled_at` | Giữ instant nguồn qua offset đã xác minh → ISO UTC; starts/ends bắt buộc, canceled nullable; không cắt về đầu/cuối ngày hoặc thêm 365 ngày | `startsAt`, `endsAt`, `canceledAt` | `plan_subscriptions.starts_at`, `ends_at`, `canceled_at` | `T/B` |
| `trial_ends_at` | Giữ nguồn; áp dụng gap trial bên trên, không gán vào endsAt | Ngoài payload PW2 | Không có | `A/B` |
| `created_at`, `updated_at` | Giữ timestamp nguồn qua offset đã xác minh; thiếu/sai ghi gap, không dùng ngày hiện tại | `createdAt`, `updatedAt` | `plan_subscriptions.created_at`, `updated_at` | `T/B` |
| `canceled_immediately` | Chỉ chuyển kiểu khi không rỗng | `canceledImmediately` | `canceled_immediately` | `T/B` |
| Dữ liệu xác nhận từ SSO nếu có | Có bằng chứng đúng Store/gói thì giữ; thiếu thì bỏ field tùy chọn, không tự suy từ plans.code và không chặn toàn bộ subscription chỉ vì thiếu packCode | `packCode` | `pack_code` | `D/A`; không phải blocker riêng |
| Lịch sử nguồn/gói và metadata giá gói | Giữ bằng chứng gói đã chọn và dữ liệu không có đích tương đương; không coi metadata giá là căn cứ tự quy đổi gói | Không xuất/lưu nguồn | Không có | `A/B` |

Lưu ý phạm vi `SUBSCRIPTION_ROUTE_PARITY`: hành vi FeatureMiddleware nêu trên chỉ áp dụng cho request đi qua middleware đó; super-admin được bypass. Không khái quát thành mọi request PW1 đều bị chặn.

### 9.2 Mức sử dụng gói dịch vụ

| Nguồn PW1 | Quy tắc | Đường dẫn JSON | Bảng.cột PW2 | Trạng thái |
|---|---|---|---|---|
| `plan_subscription_usages.id` | Định danh ổn định | `_ref` | Chỉ dùng đối chiếu ID | `R` |
| `subscription_id` | Resolve đúng subscription nguồn đã chọn và Tenant tương ứng; không chuyển usage lịch sử sang main khác | `subscription` | `plan_subscription_usages.subscription_id` | `R/B` |
| `code` | Kiểm tra theo tập tính năng đã chốt | `featureCode` | `feature_code` | `D/Q/B` |
| `used` | Số nguyên 0..32767 | `used` | `used` smallint | `T/Q` |
| `valid_until` | ISO UTC nếu có; null là không có thời hạn, không phải đã hết hạn. Lưu được field chưa chứng minh reset quota tương đương | `validUntil` | `plan_subscription_usages.valid_until` | `T/B` |
| `created_at`, `updated_at` | Giữ instant nguồn theo offset đã xác minh, không dùng ngày export/import | `createdAt`, `updatedAt` | `plan_subscription_usages.created_at`, `updated_at` | `T/B` |

**Usage hết hạn (`SUBSCRIPTION_USAGE_EXPIRY`):** PW1 consumed bỏ qua row khi valid_until ≤ thời điểm xét; PW2 getConsumed hiện trả used mà không xét validUntil. Ghi riêng used nguồn, thời hạn và mức consumed có hiệu lực tại asOf trong bằng chứng; không tự sửa used thành 0 hoặc xóa lịch sử để giả lập runtime. Usage hết hạn còn used>0 chưa được coi tương đương quyền/quota. Không mặc định reset theo tháng, ngày gia hạn hoặc startsAt vì mỗi feature nguồn có thể có chu kỳ khác.

**Đối soát usage:** UNIQUE(subscription_id,feature_code), used nguyên không âm ≤32767; vượt miền thì gap, không clamp. Code phải resolve tới feature nguồn của đúng plan và mã đích được xác minh; trùng/thiếu FK không chọn row đầu tiên hay cộng dồn tùy ý. Phân biệt không có row với số đếm nguồn bằng 0. Staff usage phải đối soát membership đã map (PW2 đếm người không phải owner), không mặc nhiên bằng tổng user PW1; giữ used nguồn và ghi chênh lệch, không đổi role hoặc counter để ép khớp. JSON bảo toàn số đếm không tự chứng nhận quota vận hành tương đương.

### 9.3 Quyền của gói và giới hạn tương thích PW2

plan-features là registry dùng chung, không đưa lặp trong mỗi Store. Cần đối chiếu từng feature thuộc plans.id nguồn với planCode đích; registry đích hiện hữu phải được đọc/xác minh riêng, không coi seed là bằng chứng DB đang chạy.

| Nguồn PW1 | Đích PW2 dùng chung | Quy tắc |
|---|---|---|
| plan_features.plan_id → plans.code | plan_features.plan_code | Đúng enum và phân loại TM/non-TM; không dùng ID plan nguồn làm ID đích |
| plan_features.code | plan_features.feature_code | Đối chiếu mã và ý nghĩa; mã lưu được dưới text không chứng minh tính năng đã áp dụng |
| plan_features.value | plan_features.value | Phân biệt YES/UNLIMITED, 0 và giới hạn số; không đổi tất cả sang YES |
| plan_features.settings | plan_features.settings JSONB | Giữ/đối soát whitelist và ref nội bộ; không xác nhận tương đương nếu runtime chưa áp dụng |
| plan_features.sort_order | plan_features.sort_order | Thứ tự trình bày, không phải quyền; đối chiếu miền số đích |
| plan_features.id, created_at, updated_at | Crosswalk/bằng chứng registry | Không ghi đè ID/timestamps của registry dùng chung chỉ vì một tenant được map |
| plans.id/name/description/price/currency_id/interval/interval_count/trial_period_days/sort_order/created_at/updated_at | Bằng chứng gói nguồn, ngoài payload tenant | Giữ metadata nguồn; không suy quyền, kỳ hạn cụ thể hoặc trial_ends_at từ giá/chu kỳ mặc định của plan |

**Gap quyền (`SUBSCRIPTION_FEATURE_PARITY`):** PW2 seed 7×20 feature với YES, không chứng minh registry thực tế bằng PW1. canUse kiểm tra quyền bật/tắt, canUseWithinLimit mới so mức dùng với hạn mức. Settings có hàm đọc nhưng chưa thấy consumer runtime trong lượt scout; một số mã chỉ có catalog, chưa có điểm chặn. Vì vậy cần phân biệt mã/giá trị đã map, quyền được runtime áp dụng, và phần chỉ lưu được cấu hình. Không tự sửa registry toàn hệ thống trong scope JSON tenant.

**Hành vi khi thiếu/hết gói:** một số quản trị chặn khi không có subscription active, checkout/tracking hiện cho qua bước kiểm tra plan khi không tìm thấy active sub. Đây là khác biệt runtime phải ghi nhận, không dùng free làm fallback để che subscription thiếu. Đổi/renew gói và reset quota của SSO là luồng riêng, không lấy làm quy tắc bảo toàn lịch sử migration.

**Tracking 2026-09-14:** bổ sung bảng code→tier, đủ 12 field subscription và 7 field usage nguồn đã kiểm tra, trial, timestamps, semantics canceled/expiry, uniqueness, đối soát membership và dependency registry. Theo dõi SUBSCRIPTION_TRIAL_PARITY, SUBSCRIPTION_USAGE_EXPIRY, SUBSCRIPTION_FEATURE_PARITY và các gap quan hệ/miền giá trị trong bảng. Trạng thái dữ liệu mẫu/backup/hash nằm trong manifest; không coi việc chưa có exporter/importer là finding. Không thay schema hoặc runtime PW2.

**Tracking 2026-09-15 — hoàn thiện quyết định Plan:** bổ sung ma trận status và ưu tiên kiểm tra dữ liệu; tách trạng thái tài khoản/gói/quyền route, ghi `SUBSCRIPTION_ROUTE_PARITY`, xác định thiếu packCode tùy chọn không phải blocker riêng ([schema](../../src/collections/PlanSubscriptions.ts:89)). Giữ nguyên các gap trial, usage hết hạn và registry quyền: không reset usage, gia hạn, gọi SSO upsert hoặc sửa registry dùng chung để làm dữ liệu có vẻ hợp lệ. Chỉ cập nhật master, chưa đồng bộ JSON hoặc chứng nhận import/cutover. Để đóng phần đối soát từng Tenant cần chứng minh đúng một main và code→tier, các mốc thời gian/trạng thái nhất quán, usage đúng subscription, quyền/giới hạn registry phù hợp; trường hợp chênh lệch phải có disposition và điều kiện cho phép vận hành, không chỉ đánh dấu đã lưu được field.

**Căn cứ:** [schema subscription](../../src/collections/PlanSubscriptions.ts), [usage](../../src/collections/PlanSubscriptionUsages.ts), [registry quyền](../../src/collections/PlanFeatures.ts), [runtime và code→tier](../../src/lib/subscriptions/plan-subscription.ts), [DDL/seed](../../scripts/db-setup.js), [subscription PW1](/home/liam/data/prime-web-api/app/Models/PlanSubscription.php), [consumed PW1](/home/liam/data/prime-web-api/app/Providers/PrimePlans/SubscriptionAbility.php).

## 10. Các collection rỗng hoặc có dữ liệu bị cách ly

### Thông báo

**Scope hiện tại:** acceptedExclusions hoãn collection này theo §2.2. Các yêu cầu mapping bên dưới áp dụng khi xử lý lại history; không dùng mảng rỗng để chứng nhận nguồn không có dữ liệu.

Các field PW1 gồm `id`, `store_id`, `type`, `notifiable_type`, `notifiable_id`, `data`, `read_at`, `created_at`, `updated_at`. Hiện không xuất Notification PW2 nào:

| Nguồn PW1 | Đích PW2 dự kiến | Trạng thái |
|---|---|---|
| `store_id` | `notifications.tenant_id` | `R/B` |
| `id` + định danh source instance/Store/người nhận | `_ref` và crosswalk nguồn → ID đích; không gán UUID PW1 thẳng vào ID số PW2 | `R/B` |
| Quan hệ đa hình tới User (`notifiable_type/id`) | `notifications.user_id` | `R/Q` |
| `type` | Enum `notifications.type` | `Q/B` — chưa chốt mapping |
| `data` | Tiêu đề/nội dung/hành động/metadata sau khi đọc và kiểm tra an toàn | `Q/B` |
| `read_at` | Suy ra `is_read` | `Q/B` |
| `created_at`, `updated_at` | `createdAt`, `updatedAt` → notifications.created_at/updated_at; giữ instant nguồn theo timezone/offset đã xác minh, không dùng ngày migrate | `T/B` |
| Source instance + Store + notification ID + người nhận đã resolve | `dedupeKey` → notifications.dedupe_key; xem quy tắc định danh bên dưới | `R/T/B` |
| Chưa xác minh thời hạn tương đương ở PW1 | `expiresAt` → notifications.expires_at; chưa gán thời hạn khi chưa chốt retention | `A/B` |

**Quan hệ và trạng thái đọc:** xác minh notifiable_type thực sự là User và notifiable_id resolve tới đúng User thuộc Tenant nguồn; không thay người nhận bằng owner hiện tại hoặc phát lại cho toàn bộ thành viên. read_at hợp lệ → isRead=true, null/nguồn chưa đọc đã xác minh → false; timestamp sai/thiếu bằng chứng phải ghi gap, không mặc định chưa đọc. PW2 chỉ có boolean isRead, không có timestamp readAt tương đương: giữ read_at gốc ngoài payload.

**GAP không tái gửi (`NOTIFICATION_HISTORY_PUSH`):** Notifications.afterChange hiện gọi gửi push khi tạo bản ghi, kể cả dữ liệu là lịch sử và isRead=true. Mapping lịch sử phải giữ nội dung/trạng thái đọc nhưng không tạo thông báo push mới. JSON đúng field hoặc đánh dấu đã đọc không chứng minh điều này được bảo đảm. Giữ gap mở cho đến khi có bằng chứng lịch sử được ghi nhận mà không phát push; không tự đặt isRead=true để né tác động. Đây là yêu cầu tương thích dữ liệu với runtime, không phải yêu cầu triển khai writer hoặc sửa hook trong scope hiện tại.

**Định danh chống trùng (`NOTIFICATION_HISTORY_DEDUPE`):** giữ từng notification nguồn độc lập theo source instance + Store + ID nguồn + người nhận. Khóa dedupe dự kiến dùng namespace riêng `PW1_HISTORY`, kèm các thành phần định danh được mã hóa ổn định/không mơ hồ; không dùng tiêu đề, message, URL hay model ID đơn lẻ. Đích kiểm tra duy nhất theo tenant/user/dedupeKey; crosswalk phải ổn định khi kiểm tra lại cùng nguồn, không trùng namespace sự kiện runtime như ORDER_NEW. Dữ liệu khác nhau nhưng cùng identity phải báo xung đột thay vì ghi đè/gộp. Đây là contract khóa mapping, không xác nhận cơ chế replay đã chạy.

**GAP thời hạn (`NOTIFICATION_HISTORY_RETENTION`):** expiresAt không tự được set chỉ vì field tồn tại. Các helper tạo thông báo mới PW2 thường đặt now+30 ngày; cron xóa bản ghi có expires_at < NOW(). Không dùng ngày migrate+30 ngày hoặc created_at nguồn+30 ngày cho lịch sử khi chưa có quyết định giữ dữ liệu. Tạm chưa gán expiresAt và ghi rõ retention chưa chốt; null/unset không bị cron này xóa theo điều kiện expiry nhưng không có nghĩa đã được phê duyệt giữ vô hạn. Bản nguồn phải được giữ riêng có giới hạn truy cập; nếu sau này áp retention thì ghi quy tắc, mốc thời gian và phạm vi dữ liệu có thể bị xóa, không coi hết hạn là chưa từng có dữ liệu.

**Loại/nội dung:** không tự đổi thông báo hoàn tất export thành ORDER_NEW; SYSTEM_ALERT chỉ là khả năng biểu diễn cần quyết định, không phải mapping mặc định cho mọi type lạ. Type nguồn rỗng phải đối chiếu cấu trúc data/bằng chứng nguồn trước khi phân loại. Không đưa nguyên data vào metadata một cách máy móc: file_path, url, others có thể chứa đường dẫn nội bộ hoặc link truy cập tài liệu. Chỉ giữ actionUrl an toàn, có ý nghĩa và đúng quyền trong PW2; không tự kích hoạt link export PW1 đã hết hạn hoặc chưa xác minh quyền truy cập. Không có title nguồn trực tiếp thì quy tắc suy dẫn title phải được ghi rõ, không coi message là bằng chứng của một enum sự kiện khác.

**Tracking 2026-09-14:** thêm mapping identity/dedupeKey, expiresAt, timestamps và cách giữ read_at; ghi NOTIFICATION_HISTORY_PUSH, NOTIFICATION_HISTORY_DEDUPE, NOTIFICATION_HISTORY_RETENTION. Các mã là tracking tài liệu; chưa đổi JSON, hook hoặc schema. Bản ghi chưa resolve/type chưa chốt tiếp tục giữ nguồn/cách ly; số liệu Store cụ thể thuộc manifest/report, không phải master.

**Căn cứ:** [schema/hook Notifications](../../src/collections/Notifications.ts), [helper thông báo mới](../../src/lib/notifications/notify-tenant-owners.ts), [cron expiry](../../src/app/api/cron/notifications/cleanup/route.ts), [notification export PW1](/home/liam/data/prime-web-api/app/Notifications/ModelExport/ModelExportCompletedNotification.php).

### Người đăng ký nhận tin, biểu mẫu liên hệ và phân tích

**Scope hiện tại:** ba collection được hoãn bằng acceptedExclusions có evidence theo §2.2; các gap nguồn bên dưới được giữ lại, không coi đã giải quyết.

Các mảng này giúp giữ cấu trúc JSON tenant ổn định. Chưa có mapping chính xác từ bảng/field PW1 nên tất cả vẫn rỗng. Không được tự lấy dữ liệu từ Customer, User, biểu mẫu trang, log hoặc bảng có tên giống dữ liệu phân tích chỉ dựa vào tên gọi.

**Trạng thái bằng chứng:** subscribers, contact-submissions và analytics hiện là chưa xác minh nguồn tương đương trong phạm vi source/export đã kiểm tra, không phải kết luận PW1 không có dữ liệu. Theo dõi riêng từng collection: chưa tìm được nguồn, nguồn đã kiểm tra không có bản ghi trong phạm vi Store, hay có nguồn nhưng chưa map. Chỉ trường hợp thứ hai mới được mô tả là nguồn rỗng đã xác minh. Giữ mảng rỗng không đồng nghĩa mapping đã đầy đủ; không suy đồng ý nhận newsletter từ email Customer hoặc dựng event analytics từ Order.

### Các collection dự kiến bị loại vì PW2 chưa có collection tương ứng

| Collection dự kiến trong nghiên cứu | Nguồn PW1 | Trạng thái hiện tại |
|---|---|---|
| `brands` | `brands` | Cách ly/lưu nguồn; thiếu quan hệ thương hiệu của Product |
| `customer_rank_rules` | `ranks` | Cách ly/lưu nguồn; thiếu bộ xét hạng |
| `media_categories` | Dữ liệu thư mục/danh mục Media | Cách ly/lưu nguồn |
| `reviews` | `ratings` nếu có | Cách ly/lưu nguồn |
| `business_locations` | Dữ liệu chi nhánh/địa điểm | Cách ly/lưu nguồn |

## 11. Quy tắc tách JSON thành bản ghi khi import

JSON master được tổ chức theo collection. Bộ import bằng SQL trực tiếp phải tách các đường dẫn lồng nhau sau theo quy tắc xác định:

| Đường dẫn collection | Bảng vật lý nhận bản ghi |
|---|---|
| `users[].roles[]` | `users_roles` |
| `users[].tenants[]` | `users_tenants` |
| `users[].tenants[].permissions[]` | `users_tenants_permissions` |
| `sites[].seo.trackedKeywords[]` | `sites_seo_tracked_keywords` |
| `sites[].localBusiness.openingHours[]` | `sites_local_business_opening_hours`; `_parent_id` → `sites.id` |
| `pages[].layout[]` | Một trong các bảng `pages_blocks_*`; hiện không có bản ghi |
| Các đường dẫn lồng trong Product | Mapping tám bảng ở mục 5.2 |
| `tenants[].customDomains[]` | `tenants_custom_domains`; `[]` hiện tại tạo 0 bản ghi là quan sát generator, không phải contract luôn bỏ domain nguồn; áp dụng phân loại tại §16 |
| `tenants[].previousSlugs[]` | `tenants_previous_slugs`; `_parent_id` → `tenants.id`; mảng rỗng tạo 0 bản ghi |
| `customers[].addresses[]` | `customers_addresses` |
| `orders[].items[]` | `orders_items` |
| `orders[].shippingTrackingHistory[]` | `orders_shipping_tracking_history`; `_parent_id` → `orders.id` |

Với bản ghi con, phải dùng đúng cột ID/thứ tự/cha theo từng bảng: array thường dùng `id`/`_uuid`, `_order`, `_parent_id`; bảng select-hasMany như `users_tenants_permissions` dùng `parent_id` và `order`, không áp dụng máy móc cấu trúc array. Hai array `openingHours` và `shippingTrackingHistory` dùng `id`/`_uuid` kiểu varchar (UUID), `_order` kiểu integer và `_parent_id` kiểu integer trỏ tới bản ghi cha đích; giữ thứ tự phần tử đã xác minh. Không tự tạo giờ mở cửa hoặc sự kiện vận chuyển khi chưa có nguồn tương ứng; phân biệt nguồn rỗng đã xác minh với nguồn chưa lấy/chưa map. Xem mục 3.4. Cần đặc tả bảng đối chiếu ID nguồn–đích; an toàn chạy lại khi import SQL là điều kiện thực thi riêng ở §13.2, không phải bằng chứng mức bao phủ mapping.

**Lịch sử slug Tenant:** `previousSlugs` là Payload array, mỗi dòng có `slug` và `expiresAt` bắt buộc, lần lượt lưu ở `tenants_previous_slugs.slug` và `expires_at` (timestamptz). Metadata gồm `id`/`_uuid` kiểu varchar (UUID), `_order` integer và `_parent_id` integer trỏ Tenant đích. Không ghi lịch sử vào `tenants.previous_slugs` JSONB: đây chỉ là cột fallback trong script DDL, không phải nơi lưu array mà Payload dùng để tìm redirect. PW1 không có nguồn tương đương trong source/model/migration đã kiểm tra: bỏ qua mapping và khởi tạo `[]`, không coi là gap cần xử lý. `store_domains` lưu hostname/cờ và soft-delete, không ghi quan hệ đổi slug hoặc hạn redirect; không lấy domain phụ/đã xóa để tự dựng previousSlugs. Dữ liệu domain nguồn vẫn giữ riêng theo §4.1/§16; lịch sử đổi slug phát sinh trên PW2 do luồng PW2 quản lý. Căn cứ: [StoreDomain PW1](/home/liam/data/prime-web-api/app/Models/StoreDomain.php), [schema domain PW1](/home/liam/data/prime-web-api/database/migrations/2021_11_03_064108_create_store_domains_table.php:16), [Tenants](../../src/collections/Tenants.ts:107), [DDL bảng con](../../scripts/db-setup.js:2572), [ghi chú fallback](../../scripts/db-setup.js:2590).

**Tracking 2026-09-15:** sửa đích vật lý `previousSlugs` tại §3.1 và bổ sung bảng con tại §11. Chỉ hiệu chỉnh master; không thay dữ liệu mẫu, schema hoặc runtime redirect.

**Đính chính previousSlugs 2026-09-15:** xác định không có nguồn PW1 tương đương trong phạm vi source đã kiểm tra; bỏ trạng thái “chưa chốt nguồn”/`B`, giữ `[]` là giá trị khởi tạo PW2. Không yêu cầu nghiên cứu thêm hoặc dựng lịch sử giả để hoàn tất mapping này.

## 12. Các vấn đề còn phải xử lý để bảo đảm mapping chính xác

### 12.1. Các quyết định và bằng chứng cần hoàn tất trong phạm vi research/mapping

Phạm vi hiện tại là tài liệu master và JSON mapping. Hoàn tất research không đồng nghĩa sẵn sàng chạy import; không yêu cầu triển khai exporter, converter hoặc cơ chế hook để đóng một đầu việc tài liệu. Với mỗi gap, phải ghi rõ nguồn/đích, giới hạn và quyết định xử lý, không coi việc ghi chú là đã khắc phục runtime.

1. Xác minh riêng các mapping `OBSERVED` chưa tái tạo được chỉ từ nhánh này; ghi rõ phần thiếu bằng chứng thay vì suy từ preview thành contract đã xác nhận.
2. Đối soát ở cấp field vật lý: mỗi field PW1 trong phạm vi phải có đúng một trạng thái cuối — đã xuất, đã tính toán, lưu nguồn, cách ly, loại trừ hoặc còn vướng mắc. Tự động hóa việc đối soát không phải điều kiện hoàn tất research.
3. Ghi rõ chênh lệch quyền sở hữu tenant của Media giữa `Media.ts` và cột DB hiện tại `media.tenant_id`, cùng điều kiện bảo toàn tenant khi import.
4. Đặc tả đích/phạm vi hỗ trợ, dữ liệu giữ nguồn và gap chuyển đổi PageComponent → block Page, HTML Blog → Lexical theo §4 và §8; không yêu cầu viết converter trong scope này.
5. Đối soát identity/crosswalk của SKU được dùng cho Product/Order hợp lệ, gồm SKU simple và variant, cùng ownership, quan hệ và giá/tồn. Ảnh SKU, giá vốn, lịch giá, Brand, ngưỡng tồn kho thấp riêng Product và metadata không có đích được giữ trong CSV nguồn; không bắt bổ sung raw vào JSON. Theo §5.2 và §7.2, chỉ thay ràng buộc đã duyệt: tenant slug, giới hạn ảnh/mô tả ngắn và product link Order optional; không thêm field/bảng nghiệp vụ; thiếu parity ở các phần ngoài phạm vi này là giới hạn chấp nhận.
6. Áp dụng đơn vị đã xác minh: Product PW1 weight type1=kg/type2=gram; Product PW2 dùng kg và Order PW2 `parcelWeight` dùng gram (§5.2, §7.2, §15, §5.1–§5.2). Phần dimensions không thay đổi trong scope này. Gap đơn vị đích Order đã đóng; còn đối soát giá trị nguồn, phép đổi đơn vị, làm tròn và giới hạn số.
7. Đặc tả ràng buộc Category về chủ sở hữu/Site/đã xóa/danh mục lá cùng các ràng buộc Product; không chỉ ghi có tham chiếu.
8. Chốt chính sách phân loại/xử lý Product/Order bị cách ly; số liệu của từng lần chạy nằm trong manifest, không làm quy tắc chung của master.
9. Đối soát đơn vị tiền và tính đầy đủ của quy tắc Discount trước khi kích hoạt.
10. Ghi rõ tác động hook và field được bảo vệ/tính toán của Page, Product, Order, Media; tách yêu cầu kiểm soát khi thực thi khỏi quyết định mapping.
11. Map/giữ thời gian lịch sử ở bản ghi gốc và bản ghi con khi cần bảo toàn lịch sử.
12. Thống nhất contract vận chuyển/thanh toán theo nguồn và schema đích, không phụ thuộc Store fixture hay nhánh generator.

### 12.2. Điều kiện triển khai sau research — chưa được coi là đã xử lý

Khi thực hiện migration, cần lựa chọn/hoàn thiện công cụ xuất và chuyển đổi theo contract, xử lý quyền sở hữu Media, kiểm soát hook hoặc kiểm chứng đường ghi SQL, và đối soát kết quả trên DB. Các điều kiện này vẫn là rủi ro vận hành phải giải quyết trước import thật; không phải yêu cầu triển khai trong scope tài liệu/JSON hiện tại.

## 13. Danh sách kiểm tra

### 13.1. Chấp nhận tài liệu và JSON mapping

Kiểm tra contract và dữ liệu được bàn giao; đầu ra bắt buộc chỉ gồm master và JSON mẫu, không yêu cầu manifest thực thi để hoàn tất bộ tài liệu. Gap chưa đóng phải được công bố riêng, không được đánh dấu mapping đầy đủ hoặc importable chỉ vì checklist tài liệu đạt:

- [ ] Các key gốc khớp đúng danh sách 20 collection và giữ thứ tự chuẩn.
- [ ] Mỗi object Store có đúng một Tenant và một Site.
- [ ] Mọi quan hệ `_ref` phân giải được trong bộ dữ liệu hoặc qua sổ đối chiếu toàn hệ thống đã chốt.
- [ ] Mỗi field nguồn có một trạng thái xử lý cuối và tham chiếu nguồn lưu trữ nếu không xuất.
- [ ] Bản ghi đã xóa/không đủ điều kiện không được coi là dữ liệu vận hành; vẫn giữ trong vùng raw nghiên cứu theo §2.1/§4 khi cần bảo toàn nguồn.
- [ ] Mã tiền tệ/đơn vị tiền và đơn vị khối lượng/kích thước được ghi rõ, có kiểm tra giới hạn.
- [ ] Số bản ghi lồng của Product đối soát khớp với tám bảng Product vật lý.
- [ ] Tồn kho Product có biến thể bằng tổng tồn kho các biến thể được xuất.
- [ ] Kiểm tra slug Product/Blog/BlogCategory theo tenant, namespace riêng từng collection; SKU theo tenant; Category theo tenant với dòng live. Xác minh composite indexes đã triển khai ở DB đích. Không dùng một scope uniqueness cho mọi collection.
- [ ] Domain cùng Store được phân loại default/main/custom/platform alias; slug tách từ default đã xác minh, main PW1 giữ nguồn riêng; sites.domain là hostname vận hành PW2. Custom domain lưu chuẩn hóa, raw có provenance; đối soát collision và gap routing pending tại §16, không tự kích hoạt.
- [ ] URL Media ngoài đúng định dạng, dùng HTTPS khi yêu cầu và `url === sourceUrl`; đây là kiểm tra dữ liệu URL, không chứng nhận khả năng truy cập hoặc độ bền của nguồn ảnh.
- [ ] Quan hệ Category, Media, Product, Customer, Discount và Order luôn nằm trong phạm vi tenant.
- [ ] Blog giữ nội dung/locale/author/category theo §8; Subscription, Tenant tier và quyền/quota cùng đối chiếu đúng đăng ký nguồn và registry §9, không mặc định free hoặc bỏ trial/expiry.
- [ ] Số bản ghi bị cách ly được báo riêng với lỗi dữ liệu đã xuất.
- [ ] Đường dẫn bảng con, ID cha–con, kiểu ID và thứ tự được đặc tả rõ, kể cả array hiện chưa có dữ liệu.

### 13.2. Sẵn sàng thực thi migration — ngoài phạm vi triển khai hiện tại

- [ ] Manifest của lần chạy lưu SHA-256 của JSON và các file nguồn để xác định chính xác dữ liệu được thực thi; không phải đầu ra bắt buộc của bộ tài liệu §13.1.
- [ ] Đã kiểm chứng khả năng truy cập URL Media ngoài và đánh giá độ bền của nguồn ảnh, gồm phương án khi URL mất hiệu lực; không suy khả năng truy cập từ định dạng URL hợp lệ.
- [ ] Công cụ ghi/chuyển đổi đáp ứng contract đã chốt; các gap ảnh hưởng vận hành được xử lý hoặc được chấp nhận rõ trước cutover.
- [ ] Đã kiểm chứng kiểm soát hook, tenant isolation, quan hệ và field tính toán/bảo vệ trên đường ghi thực tế.
- [ ] Nếu tách bằng SQL trực tiếp, đã kiểm chứng ID con/thứ tự, ranh giới giao dịch, cơ chế chạy lại và hoàn tác.
- [ ] Đã đối soát dữ liệu sau ghi và kiểm tra các luồng sử dụng liên quan. Checklist §13.1 không thay thế các kiểm chứng runtime này.

## 14. Nguồn đối chiếu

- `scripts/data/generate-store-205-pw2-layer2-preview.mjs`
- Preview helper lịch sử (không nằm trong repo, không phải CLI được hỗ trợ)
- `scripts/data/generate-two-store-pw2-current-schema.mjs`
- `src/lib/migration/pw2-product-migration.mjs`
- `src/lib/migration/pw2-product-dispositions.mjs`
- `src/collections/*.ts`
- `scripts/db-setup.js`
- Source exporter hiện tại được đối chiếu tại worktree-2, chưa đồng nghĩa đã merge vào nhánh docs: `scripts/data/export-pw1-master.ts`, `src/lib/migration/pw1-export/export-master.ts`, `mappers/catalog-schemas.ts`, `mappers/catalog.ts`, `mappers/content-raw.ts`, `mappers/raw.ts`, `mappers/identity-site.ts`, `mappers/commerce.ts` và `source-config.ts` (các mapper/config tính từ thư mục pw1-export).
- Receipt Customer của luồng repair riêng: `scripts/data/reconcile-pw2-customer-fields.mjs`, `src/lib/migration/pw2-customer-reconciliation.mjs`, `src/lib/migration/pw2-customer-receipt.mjs`. Không suy kết quả helper/CLI này được exporter master serialize đầy đủ.

- Contract collection/root, disposition và bảo mật đã tích hợp tại §2.1–2.3; cấu trúc Category/Product và registry từng cột tại §18.
- [Nguồn artifact và bằng chứng snapshot](../../plans/reports/260914-1440-master-mapping-snapshot-evidence.md)

Tài liệu ghi contract và trạng thái bằng chứng của mapping, không chứa số liệu kiểm thử làm quy tắc dùng chung. Việc một giá trị có mặt trong JSON chưa đủ chứng minh có thể import an toàn.

## 15. Nội dung sửa sau rà soát và mức độ bao phủ nguồn (2026-09-10)

Mục này là phụ lục theo dõi lịch sử rà soát và mức độ bao phủ nguồn, không ghi đè contract chi tiết ở các mục theo collection. Nếu mô tả tóm tắt chưa đồng bộ, áp dụng mục mapping chi tiết tương ứng và cập nhật lại phụ lục. Bộ JSON vẫn chưa phải bản xuất giữ nguyên toàn bộ dữ liệu DB PW1.

**Theo dõi cập nhật 2026-09-15:** bổ sung hai bảng con `openingHours`/`shippingTrackingHistory` ở §11; tách điều kiện hoàn tất research khỏi điều kiện thực thi ở §12–13; bỏ quyền ưu tiên của phụ lục và đồng bộ tóm tắt CTA email/ngày subscription theo §8.3/§9. Đây là cập nhật contract tài liệu, không xác nhận gap runtime đã đóng hoặc dữ liệu nguồn đã được xuất bổ sung.

**Hợp nhất bộ bàn giao 2026-09-15:** chỉ giữ master và JSON mẫu làm đầu ra chính. Gộp contract root/phạm vi/disposition từ tenant contract vào §2; gộp cấu trúc PW1/PW2 và 103 dòng Category–Product–EAV vào §18; giữ các mapping Layer 1 hiện hành tại §3–10 thay vì chép đè bằng Sprint draft cũ. Không mang census Store, backlog Brand/ảnh SKU hoặc triển khai permission chi tiết vào contract mới. Phân biệt đơn vị kg/cm đã chốt với phép chia legacy chưa xác minh. Chỉ cập nhật tài liệu; không sửa JSON, code, schema hoặc đánh dấu gap đã đóng.

**Theo dõi cập nhật domain 2026-09-15:** §3.1 chuyển nguồn tenant slug từ tên Store sang domain default PW1 đã xác minh hậu tố; §4.1 bỏ fallback main theo ID; §11/§13/§16 phân biệt custom domain với alias nền tảng, pending/non-primary và lưu nguồn hạ tầng/lịch sử. Chỉ sửa master; Sprint 1, generator và JSON mẫu chưa đồng bộ trong lượt này. Không xác nhận DNS, quyền sở hữu hay cutover đã hoàn tất.

**Đính chính domain sau research PW2 — 2026-09-15:** thay thế quyết định trước về copy main PW1 vào sites.domain. §4.1 tách hostname vận hành khỏi nguồn PW1; §3.1/§16 chuẩn hóa custom domain và ghi GAP-DOMAIN-PENDING-ROUTING, GAP-SITE-DOMAIN-SYNC; §13 cập nhật checklist. Chỉ sửa master, chưa sửa JSON/generator/Sprint/runtime, chưa thêm raw store_domains hoặc kết nối DNS/Vercel.

### Báo cáo kiểm kê và giới hạn tái tạo

Các bảng kiểm kê dưới đây là snapshot bằng chứng của lần research; không cam kết có lệnh tái tạo trong một fresh clone. Công cụ cục bộ từng dùng để tạo snapshot không thuộc bộ bàn giao và không phải CLI được hỗ trợ.

- [Bảng kiểm kê field PW1](field-inventory/pw1-source-fields.csv): liệt kê riêng từng cột CSV, số giá trị không rỗng theo phạm vi Store của lần kiểm kê và quan hệ trực tiếp và trạng thái đối soát.
- [Báo cáo nguồn và JSON](field-inventory/pw1-json-coverage.json): mã băm file nguồn, số bản ghi gốc, số bản ghi trực tiếp/chưa xóa theo Store và mọi đường dẫn field cuối hoặc mảng rỗng quan sát được trong JSON.
- `REQUIRES_FIELD_RECONCILIATION` nghĩa là công cụ kiểm kê chưa chứng minh được mapping; không có nghĩa field đã mô tả ở nơi khác chắc chắn bị thiếu.
- Bảng con không có `store_id` phải xác định Store qua bản ghi cha; dữ liệu tra cứu dùng chung phải xác định phạm vi theo nơi sử dụng. Không có bản ghi trực tiếp theo Store không chứng minh Store không có dữ liệu liên quan.
- `sourceCounts` trong manifest đếm document JSON trung gian, không phải mức bao phủ dữ liệu nguồn gốc. `coverage.complete=false` ghi rõ giới hạn này.
- Đường dẫn JSON văn bản có định dạng (node Lexical `style`, `direction`, `indent`, field danh sách/liên kết...) là thành phần lồng trong JSONB mô tả Product, không phải các cột SQL riêng. Vẫn cần rà độ chính xác khi chuyển từ HTML nguồn.

### Các field được ghi rõ thay cho mô tả gộp hoặc còn thiếu trước đây

| Nguồn PW1 / nguồn gốc giá trị | Đường dẫn JSON | Cột / bảng vật lý PW2 | Quy tắc và trạng thái |
|---|---|---|---|
| Không có; mặc định từ preview | `tenants[].settings.allowedWebsites` | `tenants.settings_allowed_websites` | G / OBSERVED; đối soát quyền lợi gói |
| Không có; mặc định từ preview | `tenants[].settings.storageUsed` | `tenants.settings_storage_used` | G / OBSERVED; đơn vị byte, không phải mức sử dụng lịch sử |
| Không có; mặc định từ preview | `tenants[].settings.storageLimitBytes` | `tenants.settings_storage_limit_bytes` | G / OBSERVED; đơn vị byte, đối soát quyền lợi gói |
| Không có; giá trị từ preview | `tenants[].settings.dashboardPreferences` | `tenants.settings_dashboard_preferences` JSONB | G / OBSERVED |
| Không có; giá trị từ preview | `sites[].pendingLocaleConfirm` | `sites.pending_locale_confirm` | G / OBSERVED |
| Không có; giá trị từ preview | `sites[].seo.autoMetaEnabled` | `sites.seo_auto_meta_enabled` | G / OBSERVED |
| Không có; giá trị từ preview | `sites[].themeCustomized` | `sites.theme_customized` | G / OBSERVED |
| Không có; mặc định tắt khi migration | `sites[].paymentConfig.enableQrBanking` | `sites.payment_config_enable_qr_banking` | G; không sao chép thông tin xác thực |
| Không có; mặc định tắt khi migration | `sites[].paymentConfig.cardEnabled` | `sites.payment_config_card_enabled` | G |
| Không có; mặc định tắt khi migration | `sites[].paymentConfig.fpxEnabled` | `sites.payment_config_fpx_enabled` | G |
| `orders.customer_name` | `orders[].customerName` | `orders.customer_name` | D / OBSERVED; dữ liệu tại thời điểm đặt hàng |
| `orders.customer_email` | `orders[].customerEmail` | `orders.customer_email` | D / OBSERVED |
| `orders.customer_phone` | `orders[].customerPhone` | `orders.customer_phone` | D / OBSERVED |
| `orders.tracking_code` | `orders[].trackingNumber` | `orders.tracking_number` | D / CODE; không rỗng, khớp ID nguồn và Store, nguồn chưa xóa |
| Không có; lịch sử preview rỗng | `orders[].shippingTrackingHistory[]` | `orders_shipping_tracking_history` | G/B; không có bản ghi con, chưa dựng lại sự kiện theo dõi vận chuyển lịch sử |
| `store_email_templates.button_label` | `email-template-settings[].contentEn.ctaLabel` | `email_template_settings.content_en_cta_label` | D/B / CODE, SCHEMA; tối đa 100 ký tự; gap fallback locale/giá trị rỗng theo §8.3, không suy tương đương hiển thị |
| `store_email_templates.button_label_ms` | `email-template-settings[].contentMs.ctaLabel` | `email_template_settings.content_ms_cta_label` | D/B / CODE, SCHEMA; tối đa 100 ký tự; gap fallback locale/giá trị rỗng theo §8.3, không suy tương đương hiển thị |
| `plan_subscriptions.starts_at` | `plan-subscriptions[].startsAt` | `plan_subscriptions.starts_at` | T/B; múi giờ nguồn → UTC; điều kiện ngày bắt đầu và giới hạn runtime theo §9 |
| `plan_subscriptions.ends_at` | `plan-subscriptions[].endsAt` | `plan_subscriptions.ends_at` | T/B; múi giờ nguồn → UTC; thời hạn, trial và điều kiện đủ dữ liệu theo §9 |
| `plan_subscriptions.canceled_at` | `plan-subscriptions[].canceledAt` | `plan_subscriptions.canceled_at` | T/B; múi giờ nguồn → UTC; đối soát cùng cờ hủy và chính sách trạng thái theo §9 |

Khối lượng kiện hàng Order: mã đang chạy lưu bằng **gram**, còn khối lượng Product dùng **kg**. Xem `src/lib/shipping/product-weight.ts` và `src/app/api/orders/checkout/route.ts` (`parcelWeight: totalWeightGrams`). Mô tả kg trong PRD vận chuyển đã lỗi thời so với mã này. Vì vậy, `orders.total_weight` PW1 tính bằng kg cần nhân 1000 để ghi vào `orders.parcel_weight` PW2; vẫn cần đối soát đơn vị nguồn và kiểm tra làm tròn/giới hạn số. Vướng mắc trước đây về đơn vị đích ở mục 7.2 đã được giải quyết bằng bằng chứng từ mã đang chạy.

### Những phần dữ liệu giao diện chưa map

Bản ghi con menu phải được xác định qua menu/item cha; phạm vi chưa xóa của luồng vận hành khác với raw bảo toàn lịch sử.

| Bảng / quan hệ PW1 | Field nguồn liên quan | Đích / trạng thái xử lý |
|---|---|---|
| `banners.store_id` | `name, header, subheader, alignment, button, strip_background, image, url, status, page_component_id, position` | B; cần chuyển đổi block Page và map quan hệ sở hữu component |
| `menus.store_id` | `name, type, status, position, copyright_content, copyright_status, config` | B; chưa chốt ý nghĩa điều hướng/header/footer của Site |
| `menu_items.menu_id → menus.id` | `name, name_ms, position, type_id, model_id, model_type, url` | B; cần đối chiếu đường dẫn/thực thể và chuyển đổi điều hướng |
| `menu_lines.menu_item_id → menu_items.id` | `type_id, position` | B; cần tra cứu component/loại và giữ thứ tự |
| `model_settings.store_id` + chủ sở hữu đa hình | `model_id, model_type, key, name, description, value, signature, field, status, parent_id` | B; đọc từng setting theo chủ sở hữu và key; chưa có đích chung an toàn |
| `frontend_templates`, `frontend_components`, danh mục template | Tra cứu cấu hình/loại ở nguồn | B; dữ liệu tra cứu phụ thuộc, không phải collection gốc tenant |
| `shortlist_items` và shortlist cha | Tham chiếu item đa hình, ảnh, nút kêu gọi hành động, thứ tự | B; cần chuyển đổi component và đối chiếu tham chiếu |

Mọi field CSV còn lại, bao gồm cột lịch sử/chủ sở hữu và các bảng chưa nêu ở đây, đều xuất hiện trong bảng kiểm kê field. Không tự coi toàn bộ template, dữ liệu tra cứu dùng chung, bản ghi vận hành hoặc bản ghi xác thực đều đủ điều kiện sao chép. Quyết định map/loại trừ cuối cùng phải được rà soát cụ thể.

### Ý nghĩa của việc giữ dữ liệu

Chỉ có mã `A` và `archiveRef` **chưa chứng minh giá trị đã được sao chép**. Cần phân biệt:

1. **Giá trị được nhúng**: giá trị thực có trong JSON collection cuối.
2. **Tham chiếu tới nguồn bên ngoài**: phải giữ CSV gốc hoặc JSON trung gian và xác minh mã băm của chúng.
3. **Chưa đối soát**: chưa có quyết định ở cấp field được xác minh về xuất/lưu nguồn/loại trừ.

Đầu ra hiện chỉ chứa collection PW2. Không được thêm cấu hình PW1 thô dưới các collection PW2 tự đặt ra. Để giữ đầy đủ lịch sử, cần lưu riêng nguồn gốc và hoàn tất bảng trạng thái xử lý. Việc thêm một dòng tài liệu chưa giải quyết được thiếu sót về bộ chuyển đổi Page/Menu/Blog.

## 16. Quy tắc Product và customDomains sau review Sprint 2

### Token DB nguồn và cách tạo lại JSON

Tham số thứ 8 của script Node (sau thư mục export, input, output, manifest, timezone, offset) là `sourceInstanceToken` bắt buộc. Token phải cố định theo DB PW1, chỉ gồm chữ/số; không lấy timestamp hoặc hash CSV vì dữ liệu có thể thay đổi. Token được ghi tại `sourceSnapshot.sourceInstanceToken`. Khi hợp nhất nhiều nguồn phải đăng ký token duy nhất cho từng DB; token thử nghiệm chưa phải bằng chứng đăng ký nguồn production.

Dạng tham số tham khảo (placeholder, không phải lệnh chạy sẵn). Chạy từ root repo sau khi cài dependencies bằng `npm ci --include=dev`; dùng `tsx` đã khai báo trong devDependencies để nạp module TypeScript dùng chung trên Node >=20, không dùng `node` thuần hoặc phụ thuộc native TypeScript stripping:

```text
./node_modules/.bin/tsx scripts/data/generate-two-store-pw2-current-schema.mjs <source-directory> <input-json> <output-json> <manifest-json> <source-timezone> <source-offset> <source-instance-token>
```

Generator này hiện gắn với fixture hai Store; tham số đường dẫn/token không làm nó trở thành CLI migration tổng quát. Phải rà phạm vi chọn Store và pipeline enrich trước khi dùng nguồn khác. Generator chưa tái tạo đầy đủ enrichment của JSON bàn giao hiện tại: chỉ ghi thử vào thư mục tạm mới, không trỏ output/manifest vào bản bàn giao hoặc bản nguồn. Report snapshot lưu ngữ cảnh fixture lịch sử và ví dụ output tạm, không phải lệnh tái tạo bản bàn giao. CLI đối soát Customer cũng chạy qua `./node_modules/.bin/tsx scripts/data/reconcile-pw2-customer-fields.mjs <source-directory> <json> <manifest>`; mặc định chỉ kiểm tra, `--write` chỉ dùng khi chủ động cho phép sửa artifact.

### EAV không phụ thuộc thứ tự CSV hoặc tên hiển thị

- Module `src/lib/migration/pw2-product-eav.mjs` dựng lại SKU, giá, tồn kho, cờ biến thể, tier, option và tên biến thể từ CSV; các phần này không còn kế thừa preview cũ.
- SKU đủ điều kiện: cùng Product và Store, chưa xóa, `status=1`. SKU inactive/deleted không cộng giá/tồn kho; dữ liệu nguồn vẫn phải giữ để đối soát lịch sử.
- Thứ tự tier = Attribute ID số tăng dần; option = AttributeValue ID số tăng dần; variant = SKU ID số tăng dần. Đây là quy tắc migration, không phải thứ tự nghiệp vụ PW1.
- Nhãn dùng `name`, chỉ khi rỗng mới lấy `name_ms`; không khẳng định name luôn là tiếng Anh. Field name_ms khác name vẫn giữ trong nguồn gốc, chưa có cột nhãn đa ngôn ngữ riêng ở tier/option PW2.
- Exporter hiện dùng skuCrosswalk trong bộ nhớ và ghi contributions trong mapping-report.json (bảng/ID/field nguồn, targetPath, rule). Manifest chưa có `productReconciliation.sourceIdentity`; receipt chứa selectedTuple/targetId đầy đủ chưa được xuất. Dữ liệu CSV cho phép đối soát lại nhưng không thay cho receipt đã publish. Không nhận targetPath là ID bản ghi DB đích.

### Bảng con customDomains đã xác minh

Nguồn là `store_domains` cùng Store, chưa xóa và đã phân loại hostname. **Contract mapping đã áp dụng vào JSON mẫu; generator chưa đồng bộ:** `is_default=0` không đủ chứng minh custom domain; dòng đó có thể là alias trên nền tảng PW1. Mẫu phân loại theo hậu tố nguồn đã xác minh ở §3.1 và ghi custom domain ngoài hậu tố với `pending`/`isPrimary=false`; raw gồm cả lịch sử đã xóa nằm ở §4.1. Generator vẫn đặt `customDomains: []`, không có nghĩa PW1 không có dữ liệu tên miền hoặc contract yêu cầu bỏ toàn bộ domain. Artifact chưa chứng minh quyền sở hữu hoặc collision với dữ liệu PW2 hiện hữu đã được kiểm tra.

- Domain thuộc hậu tố nền tảng PW1 đã xác minh: default dùng để tách slug (§3.1), main dùng để giữ địa chỉ nguồn (§4.1); toàn bộ hostname/ID/cờ vẫn giữ trong nguồn/crosswalk. Không tự thêm các hostname này vào `customDomains` PW2; redirect/cutover cần xử lý riêng.
- Custom domain đã phân loại: trim/lowercase/bỏ dấu chấm cuối, chuyển IDN thành ASCII/punycode rồi kiểm tra hostname tương thích validator PW2. Chính giá trị chuẩn hóa được lưu vào `tenants[].customDomains[].domain`; hostname nguyên bản giữ riêng trong nguồn/crosswalk theo §4.1. Không tự trích hostname từ URL có protocol/path/port/query/fragment/userinfo, không sửa dữ liệu lỗi để vượt validation. Kiểm tra trùng bằng khóa chuẩn hóa trên cả batch nguồn và domain PW2 hiện hữu; trùng hoặc xung đột Tenant thì block đối soát, không tự gộp/nhận quyền sở hữu.
- `is_main=1` chỉ ghi nhận ứng viên primary trong nguồn/crosswalk ngoài payload customDomains; không tự thêm field `is_main` vào Payload. Tất cả custom domain xuất ban đầu là `pending`, `isPrimary=false`; chỉ kích hoạt/chọn primary sau khi xác minh quyền sở hữu, DNS và điều kiện PW2. Không coi `status`/`is_supported_https` PW1 là bằng chứng xác minh PW2.
- Domain đã xóa và ID hạ tầng `host_id`, `host_id_proxy1`, `ssl_certificate_id` chỉ giữ trong nguồn có kiểm soát, không kích hoạt lại hoặc map thành ID Vercel. Không copy token/credential xác minh vào payload review; áp dụng §2.3.

Căn cứ: [proxy/SSL theo default domain](/home/liam/data/prime-web-api/app/Repositories/EloquentStoreDomainRepository.php:109), [đổi main/xóa và fallback về default](/home/liam/data/prime-web-api/app/Repositories/EloquentStoreDomainRepository.php:168), [schema store_domains](/home/liam/data/prime-web-api/database/migrations/2021_11_03_064108_create_store_domains_table.php:16).

| Đường dẫn JSON | Cột PW2 | Quy tắc |
|---|---|---|
| `tenants[].customDomains[].domain` | `tenants_custom_domains.domain` | Hostname chuẩn hóa tương thích PW2, đã phân loại custom; raw giữ riêng, không ghi raw vào field vận hành; JSON mẫu đã áp dụng, generator chưa đồng bộ; còn phải kiểm tra xung đột toàn hệ thống trước vận hành |
| `tenants[].customDomains[].status` | `tenants_custom_domains.status` | Sinh `pending`; chỉ chuyển active sau xác minh PW2, không copy trạng thái nguồn |
| `tenants[].customDomains[].isPrimary` | `tenants_custom_domains.is_primary` | Sinh `false`; main nguồn chỉ là ứng viên primary ngoài payload trước xác minh |
| `tenants[].customDomains[].vercelDomainId` | `tenants_custom_domains.vercel_domain_id` | Định danh do tích hợp Vercel PW2 quản lý, không tự copy từ PW1 |
| `tenants[].customDomains[].vercelVerification` | `tenants_custom_domains.vercel_verification` JSONB | Dữ liệu xác minh do Vercel PW2 quản lý |
| ID/thứ tự/cha của phần tử mảng | `tenants_custom_domains.id/_uuid/_order/_parent_id` | Ghi theo schema mảng; _parent_id trỏ Tenant PW2 |

Căn cứ: `src/collections/Tenants.ts` khai báo array; `scripts/db-setup.js` tạo bảng và bổ sung hai cột Vercel. Không còn blocker thiếu schema cho customDomains; phần chưa hoàn tất là đồng bộ generator, xác minh collision/dữ liệu/ownership và quy trình tên miền, không phải bổ sung bảng mới.

**Căn cứ chuẩn hóa:** PW1 [normalizeDomain](/home/liam/data/prime-web-api/app/Repositories/EloquentStoreDomainRepository.php:282) trim/lowercase/bỏ dấu chấm cuối; PW2 [addCustomDomain](../../src/app/(dashboard)/settings/domains/actions.ts:91) chuẩn hóa/IDN trước validation, còn [verify](../../src/app/(dashboard)/settings/domains/actions.ts:309) lowercase đầu vào rồi tìm domain bằng equality. Giữ raw như `Shop.Example.com` trong field đích có thể khiến verify không tìm thấy bản ghi. Mã hóa IDN hoặc hậu tố không được validator hỗ trợ phải ghi gap, không tự sửa để lách kiểm tra.

**GAP-DOMAIN-PENDING-ROUTING — OPEN:** flow quản trị thêm domain đăng ký với Vercel, giữ pending, yêu cầu Verify ownership/DNS/HTTPS trước active và chỉ chọn primary khi active. Tuy nhiên [lookup Tenant theo domain](../../src/lib/cache/tenant.ts:42) chỉ so hostname, chưa lọc active; [storefront](../../src/app/sites/[slug]/[[...path]]/page.tsx:48) dùng lookup này. Nếu DNS/hạ tầng đã đưa request tới PW2 và Site đủ điều kiện hiển thị, pending không tự ngăn phục vụ website. Chỉ tạo JSON không thay DB/DNS; nhưng ghi pending vào DB live không được coi là bảo đảm cách ly. Trước ghi/kích hoạt thực tế phải kiểm chứng gate routing và public Site hoặc cơ chế staging/cutover đã duyệt; chưa sửa resolver trong scope master. Quyền gói domain_connection, binding Vercel, DNS và HTTPS vẫn phải xác minh riêng; không suy đã kết nối chỉ từ field tồn tại. Chọn primary không đổi tenant slug; redirect non-primary custom domain không chứng minh mọi subdomain nền tảng đều redirect.

### Phân biệt mapping custom domain và kích hoạt vận hành

**Quyết định:** `tenants[].customDomains[]` với `status=pending`, `isPrimary=false` trong JSON nghiên cứu là **ứng viên kết nối**. Nó không chứng minh đã chạy Add domain, đã đăng ký Vercel hoặc đã được phép phục vụ website. Giữ nguyên các ứng viên trong artifact để không mất mapping; không import mù mảng này vào DB đang phục vụ. Toàn bộ dòng PW1, kể cả alias nền tảng và dòng đã xóa, vẫn giữ tại `sites[].pw1_source.store_domains[]`; vùng raw phải được tách khỏi payload ghi DB.

**GAP-DOMAIN-PROVIDER-BINDING — OPEN:** [addCustomDomain](../../src/app/(dashboard)/settings/domains/actions.ts:91) kiểm tra gói/unique, ghi pending và gọi đăng ký Vercel. [verifyCustomDomain](../../src/app/(dashboard)/settings/domains/actions.ts:303) chỉ gọi xác minh cho dòng đã có; không tự gọi Add để tạo binding còn thiếu. Vì vậy import trực tiếp pending khi chưa có binding có thể khiến Verify thất bại, còn Add lại bị kiểm tra trùng chặn. Không hướng dẫn người dùng chỉ bấm Verify để hoàn tất mọi domain đã migrate, cũng không tự xóa/thêm lại để né kiểm tra trùng. Cần quy trình đối soát/đăng ký xử lý được dòng pending đã tồn tại; đây là yêu cầu vận hành chưa triển khai, không phải yêu cầu thêm bảng hay field.

**Điều kiện trước import/kích hoạt thực tế:**

1. Xác minh slug và hostname chuẩn hóa không xung đột trong batch và trên PW2 đích; xác minh đúng Tenant, subscription và quyền `domain_connection`. Có xung đột thì cách ly để đối soát, không nhận domain của Tenant khác.
2. Đối soát hoặc đăng ký binding đúng Vercel project/môi trường đích. [addProjectDomain](../../src/lib/vercel/domains.ts:210) còn dùng nhánh deploy khi tạo binding; tên hostname hoặc lựa chọn domain staging trong JSON không chứng minh binding đã trỏ đúng môi trường. Không copy ID proxy/certificate hay trạng thái HTTPS PW1 làm bằng chứng Vercel.
3. Trước khi ghi các ứng viên vào DB phục vụ hoặc đưa traffic tới PW2, phải kiểm chứng cơ chế cách ly/routing pending theo `GAP-DOMAIN-PENDING-ROUTING`. Pending không phải hàng rào chặn truy cập. Nếu chưa đáp ứng, chỉ giữ trong artifact/raw, chưa ghi mảng ứng viên vào tập dữ liệu vận hành; không bỏ mất dữ liệu nguồn.
4. Chỉ chuyển active sau khi kiểm chứng ownership, DNS và HTTPS thực tế cho môi trường đích; kết quả mock không phải bằng chứng. Không tự chuyển active từ `store_domains.status` hoặc `is_supported_https` nguồn.
5. Chỉ chọn primary sau active và quyết định địa chỉ chính đã được xác nhận. [setPrimaryDomain](../../src/app/(dashboard)/settings/domains/actions.ts:471) cập nhật mảng Tenant, không đồng bộ `sites.domain`; cần đối soát/cập nhật hostname Site và cache qua đường ghi phù hợp theo §4.1. Không đổi tenant slug chỉ vì đổi primary.
6. Đối soát callback/return URL thanh toán trước cutover: [makeMain PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentStoreDomainRepository.php:246) cập nhật callback của phương thức khác COD. Không giả định chọn primary PW2 đã thực hiện side effect tương đương; áp dụng gap §17, không thay callback production bằng staging trong bước tạo JSON.

**Kiểm tra bằng subdomain staging:** có thể tiếp tục đối soát Tenant/Site bằng `{slug}.web-v2.dev.ecommercehub.my` khi môi trường, DNS nền tảng và điều kiện hiển thị Site đã sẵn sàng; custom domain chưa kết nối không tự chặn bước nghiên cứu này. Đây không phải xác nhận storefront/Page đã migrate hoạt động hoàn chỉnh. Giữ `sites.domain` theo hostname staging cho tới khi có custom primary active được chọn; không đổi sang domain PW1 chỉ để phản ánh địa chỉ nguồn.

**Tracking 2026-09-15:** bổ sung phân biệt ứng viên JSON/binding provider/kích hoạt routing; ghi `GAP-DOMAIN-PROVIDER-BINDING` và các điều kiện kiểm chứng trước vận hành. Chỉ cập nhật master; không đổi JSON, schema, code, DNS, Vercel hoặc callback thanh toán. Các gap provider binding, pending routing, Site domain sync và payment vẫn OPEN; ghi chú này không chứng nhận migration domain đã hoàn tất.

## 17. Gap thanh toán và tích hợp

**GAP-PAYMENT-INTEGRATION-01 — OPEN (2026-09-10; cập nhật dữ liệu 2026-09-15).** Đây là khoảng trống tương thích/kết nối provider cần xử lý, không phải quyết định loại bỏ vĩnh viễn dữ liệu thanh toán/tích hợp. JSON mẫu đã đồng bộ các cờ COD và quyết định chưa kích hoạt phương thức điện tử bên dưới; chưa sửa generator, runtime hoặc schema PW2, chưa xác minh kết nối gateway.

Căn cứ: [Research thanh toán và tích hợp PW1 → PW2](../../plans/reports/260910-1703-pw1-pw2-payment-integration-research.md). Kết quả dựa trên source và CSV snapshot; chưa xác minh credential, quyền kết nối hoặc môi trường thực tế tại nhà cung cấp.

### Hiện trạng và phạm vi cần xử lý

| Phần | Gap cần xử lý |
|---|---|
| COD | JSON mẫu đã dựng cả `tenants[].payments.payment_cod` và `sites[].paymentConfig.enableCod` từ nguồn đúng Store, trạng thái và `deleted_at` của cấu hình/provider. Join `store_payments.payment_method_id → payment_methods.id`, phân loại bằng `payment_methods.code`; không hardcode ID `1` và không dựa vào default PW2. Generator cũ chưa được đồng bộ; có dữ liệu JSON chưa chứng nhận checkout đã chạy |
| Stripe | PW2 dùng Stripe Connect. Cần xác minh `account_id` nguồn có phải connected account tương thích với platform PW2 và đúng môi trường trước khi mapping `stripeAccountId`; không suy ra onboarding/capability từ `status=1`, không dùng secret Store thay platform key |
| Billplz | Có dữ liệu nguồn nhưng chưa tìm thấy adapter checkout/nhóm credential tương ứng trong PW2. Cần chốt hướng hỗ trợ hoặc giữ dữ liệu chưa có đích; không đổi thành Stripe/Xendit FPX |
| Xendit, ECH/Distribution, EasyParcel | Schema đích có một số field nhưng chưa chứng minh nguồn tương đương. Không chuyển token PaymentGateway/Distribution/Shipment/SSO sang provider khác chỉ vì trùng tên field; không nhân bản token dùng chung nền tảng vào từng Store |
| Cấu hình không bí mật chưa có đích | Cần chốt cách giữ ID nguồn, trạng thái, môi trường, provider mặc định và cấu hình khác mà vẫn bảo đảm collection-only. Chưa có quyết định dùng `tenants[].metaData`; không ghi cấu hình lịch sử như cấu hình đã hoạt động |
| Credential | Cần contract chuyển/lưu riêng có kiểm soát truy cập và bảo vệ artifact. Không xuất secret vào JSON review; không coi ciphertext Laravel là API key PW2. Không giải mã hoặc in giá trị credential trong bước ghi nhận này |

Phải đối soát trạng thái, `deleted_at` và `is_production` của nguồn cho từng Store. Không tự chuyển sandbox thành production; trạng thái active PW1 không chứng minh tích hợp đã sẵn sàng tại PW2. Bằng chứng fixture được tách sang report, không phải cấu hình mặc định.

### Điều kiện hoàn tất mapping và đóng gap vận hành

**Contract dữ liệu thanh toán — bổ sung 2026-09-15:** phạm vi trước mắt là mapping/import dữ liệu, không chứng nhận gateway hoạt động. Bảng dưới phân loại đủ 17 field `store_payments` theo nguồn đã kiểm tra; không đưa raw credential vào JSON và không tự tạo collection provider mới. Dữ liệu ngoài đích đã chốt tiếp tục nằm trong nguồn được bảo vệ, không đồng nghĩa đã xuất vào JSON mẫu.

| Field PW1 | Đích hoặc disposition |
|---|---|
| `id` | Định danh dòng cấu hình nguồn trong đối soát; không copy thành PK Tenant/Site |
| `store_id` | Resolve Store→Tenant/Site, không nhận cấu hình Store khác |
| `payment_method_id` | Join `payment_methods.id`, phân loại bằng code `cod`/`stripe`/`billplz`; code lạ hoặc FK thiếu phải đối soát |
| `status`, `deleted_at` | Quyết định đủ điều kiện mapping cấu hình; deleted không được khôi phục chỉ vì status=1. Không copy status sang trạng thái connected/onboarding PW2 |
| `is_default` | Thứ tự ưu tiên/phương thức mặc định nguồn; chưa có đích tương đương đã chốt, giữ nguồn riêng. Không dùng để suy phương thức duy nhất được bật |
| `is_production` | Bằng chứng môi trường gateway; không đổi sandbox thành production. COD không gọi gateway nên không tắt COD chỉ vì cờ này bằng 0 |
| `account_id` | Chỉ là ứng viên `tenants[].stripeAccountId → tenants.stripe_account_id` khi code=stripe và xác minh đúng connected account/platform/môi trường; chưa xác minh thì chưa xuất field vận hành. Không map Billplz account sang Stripe/Xendit |
| `account_name` | Tên tài khoản provider, không tự map thành chủ tài khoản ngân hàng QR (`account_holder_name`/`bankAccountHolder`); giữ nguồn nếu chưa có bằng chứng tương đương |
| `merchant_code` | Định danh merchant theo provider; không gán thay Stripe account ID hoặc Xendit business ID, giữ nguồn riêng nếu chưa có đích xác minh |
| `secret_key` | Loại khỏi artifact review; chuyển credential là workflow bảo mật riêng. Source accessor có nhánh đọc plaintext legacy và decrypt Laravel, không coi giá trị CSV mặc nhiên là ciphertext an toàn hoặc API key PW2 dùng được |
| `callback_url`, `notify_url`, `refund_notify_url` | Giữ nguồn để đối soát provider/cutover; không gán vào sites.domain hoặc tự sửa host thành staging. Chưa có mapping chung tương đương cho ba endpoint này |
| `created_by` | Actor tạo cấu hình, không suy owner/merchant; chưa có đích audit riêng được chốt |
| `created_at`, `updated_at` | Lịch sử của chính cấu hình thanh toán, không dùng ghi đè timestamps Tenant/Site. Giữ nguồn riêng |

**Quyết định COD:** sau khi xác minh đầy đủ bảng nguồn, chọn cấu hình chưa xóa cùng Store có provider code=cod. Đúng một cấu hình hợp lệ, status active và provider còn active/chưa xóa → ghi tường minh `tenants[].payments.payment_cod=true` (`tenants.payments_payment_cod`) và `sites[].paymentConfig.enableCod=true` (`sites.payment_config_enable_cod`). Không có cấu hình đủ điều kiện hoặc cấu hình inactive/deleted rõ ràng → cả hai false; không nhận default true của PW2. Nhiều cấu hình chưa xóa, status ngoài miền hoặc provider/FK không xác định → chưa quyết định, ghi blocker thay vì đoán true/false. `is_default` không phải điều kiện bật COD. JSON mẫu đã áp dụng quy tắc sau đối soát nguồn; generator và đường ghi/checkout chưa được chứng nhận bởi cập nhật artifact này.

**Provider chưa tương thích/chưa xác minh:** không suy Stripe onboarding/capability từ status=1; không chuyển Billplz thành FPX của Stripe/Xendit. Các field bật thanh toán điện tử/QR chưa có bằng chứng tương thích phải giữ tắt rõ ràng ở các lớp cấu hình liên quan khi tạo tập import, không nhận default Site=true để giả lập nguồn. Đây là quyết định giữ chưa kích hoạt, không phải bằng chứng PW1 vốn tắt phương thức đó. Không suy QR/bank account từ `account_name`/`account_id` chung của gateway. Mapping phương thức thanh toán lịch sử Order là phần riêng §7.2, không sửa lịch sử Order thành COD chỉ vì gateway hiện chưa kết nối.

**Căn cứ và tracking:** [StorePayment](/home/liam/data/prime-web-api/app/Models/StorePayment.php), [repository PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentStorePaymentRepository.php:24), [Tenant payments](../../src/collections/Tenants.ts:340), [Site paymentConfig](../../src/collections/Sites.ts:526). Bổ sung disposition cấp field và quy tắc COD; chưa thêm dữ liệu tài khoản/credential vào JSON, chưa sửa runtime/generator, không gọi provider hoặc thay callback. Gap tương thích provider và đường ghi vẫn OPEN; các tích hợp ngoài payment như Shipment/Distribution không được coi đã hoàn tất bởi bảng này.

**Tracking 2026-09-15 — đồng bộ cờ thanh toán:** JSON mẫu đã ghi COD tường minh ở cả Tenant và Site theo nguồn đã đối soát, đồng thời ghi false cho các cờ thanh toán còn lại trong `tenants[].payments` và QR/thẻ/FPX trong `sites[].paymentConfig`. False ở nhóm chưa kết nối là quyết định không kích hoạt tại PW2, không phải mapping lịch sử PW1 thành inactive. Không xuất credential, account ID chưa xác minh, không thay phương thức thanh toán lịch sử của Order; không coi đây là đóng gap kết nối provider.

**Trong phạm vi research/mapping:**

- [ ] Hoàn tất mapping cấp field/provider: nguồn, đích collection/cột PW2, quy tắc chuyển đổi và disposition rõ cho field chưa có đích; phân biệt inactive/deleted/chưa hỗ trợ/chưa xác minh.
- [ ] Chốt cách giữ cấu hình không bí mật chưa tương thích và cơ chế credential riêng; không âm thầm bỏ dữ liệu, không đưa bí mật vào tài liệu/JSON review.

**Khi triển khai/kích hoạt thực tế — theo §12.2 và §13.2, không phải yêu cầu viết công cụ trong scope research:**

- [ ] Cập nhật generator và bộ kiểm thử theo các trường hợp nguồn, đối soát nguồn và validation; COD phải được dựng đúng ở cả Tenant và Site, không hardcode provider ID.
- [ ] Với tích hợp cần kích hoạt, xác minh credential/quyền provider/môi trường/callback và capability liên quan qua workflow được ủy quyền trước khi ghi trạng thái đã kết nối. Có field trong JSON không đồng nghĩa tích hợp hoạt động.

Gap vẫn **OPEN** cho đến khi có bằng chứng đáp ứng các điều kiện trên hoặc có quyết định phạm vi rõ ràng cho phần không triển khai. Việc thêm ghi chú này không chứng minh dữ liệu đã được bảo toàn hoặc migration thanh toán đã hoàn tất.

## 18. Cấu trúc Category–Product–EAV và disposition từng cột

Phần này hợp nhất nội dung cần thiết của các tài liệu cấu trúc PW1/PW2 và bảng mapping từng cột. Đây là một phần của master, không phải contract riêng. Không phê duyệt thêm field/bảng Product/Order, Brand hoặc ảnh SKU; dữ liệu Product/SKU chưa có đích hoặc ngoài phạm vi giữ trong CSV nguồn với disposition theo §5.2, không bắt thêm raw vào JSON. Quy tắc raw Category/Page hiện hành không thay đổi. Các bảng mô tả source/schema, không chứng nhận schema live hoặc 103 cột đã xuất đầy đủ.

### 18.1 Quan hệ nguồn PW1 và ý nghĩa nghiệp vụ

```text
stores.id
  ├─ categories.store_id
  │    ├─ categories.parent_id → categories.id
  │    └─ category_attributes.category_id
  │         └─ attribute_id → attributes.id
  │                              └─ attribute_values.attribute_id
  └─ products.store_id
       ├─ category_id → categories.id
       ├─ product_attributes.product_id
       │    ├─ attribute_id → attributes.id
       │    └─ attribute_value_id → attribute_values.id
       └─ product_skus.product_id
            └─ product_variants.product_sku_id
                 ├─ attribute_id → attributes.id
                 └─ attribute_value_id → attribute_values.id
```

Các mũi tên là quan hệ logic, không cam kết mọi snapshot có FK vật lý. Category phân loại Product; `category_attributes` là liên kết loại Attribute được gán cho Category, không phải option hoặc SKU. `attributes.id/code` xác định loại; `attribute_values.id` xác định option, nhãn là `name/name_ms`, **không có cột `value`**. `product_attributes` là miền option của Product; `product_variants` là từng lựa chọn Attribute–option của SKU. Một SKU nhiều tier có nhiều dòng product_variants, nhưng chỉ một dòng variant PW2.

Category không có FK trực tiếp tới SKU. Không dùng category_attributes.id thay attribute_id; không join định nghĩa bằng nhãn. Với bảng không có store_id, ownership đi qua Category/Product/SKU; kiểm tra option thuộc đúng Attribute và tất cả cùng Store. `created_by` là người tạo dòng theo observer khi có actor, không mặc định owner và không dùng làm đường xác định Store.

PW1 kiểm tra attribute code được gửi có thuộc Category và option name có thuộc Attribute khi request Product có category_id/attributes; luồng đổi Category còn kiểm tra tập Attribute tương thích. `is_required` là boolean metadata được API trả ra; chưa có bằng chứng backend thực thi nhập bắt buộc. Transformer EAV hiện chưa đọc category_attributes nên pass EAV không chứng minh pass quy tắc Category này. Đây là gap parity đã ghi nhận, không yêu cầu thêm master Attribute trong scope hiện tại.

Soft-delete của liên kết, định nghĩa, domain và SKU độc lập nhau. Một số luồng CategoryRepository force-delete liên kết: không thể khôi phục dòng đã xóa cứng từ snapshot. Category còn có thể được Page/menu/shortlist tham chiếu qua model_type/model_id; đổi ID phải đối soát các cạnh này, không chỉ Product.category. `sub_products` nguồn đi qua con trực tiếp, không mặc định thống kê Category bao phủ mọi cấp cháu; năm cột tổng hợp Category chỉ giữ snapshot đối soát, không thay giá/tồn SKU.

### 18.2 Cấu trúc đích PW2 và ràng buộc đối chiếu

```text
Tenant + Site → categories → parent (categories) + breadcrumbs
Tenant + Site → products
                  ├─ products_rels (path=category) → categories
                  ├─ products_images → media
                  ├─ products_tags
                  ├─ products_attributes (key/value mô tả)
                  ├─ products_variant_configs
                  │    └─ products_variant_configs_options
                  └─ products_variants (SKU/giá/tồn)
```

Category PW2 có đầy đủ field: `id`, `tenant`, `site`, `name`, `slug`, `parent`, `description`, `breadcrumbs`, `deletedAt`, `dna`, `createdAt`, `updatedAt`. Cột tương ứng là id, tenant_id, site_id, name, slug, parent_id, description, breadcrumbs, deleted_at, dna, created_at, updated_at. `description` là textarea; `dna` là JSON hướng dẫn thiết kế (signatureBlocks, recommendedBlocks, mandatoryOrder, forbiddenBlocks, typicalPersonalities, minSections, aiPromptHint), không chứa EAV/layout PW1 hoặc quyền nhập Product.

Hook Category kiểm tra tổ tiên, không duyệt toàn cây con khi reparent: phải tự đối soát toàn cây kết quả không cycle, cùng tenant/site, tối đa ba tầng. Ví dụ chuyển gốc A của A→B→C xuống D có thể làm hậu duệ thành tầng bốn dù kiểm tra tổ tiên A qua. Slug live unique theo tenant; action còn kiểm tra tên trim/case trong cùng tenant/parent. Storefront sort name và lọc deletedAt, chưa có status/position tương đương PW1.

Inventory field Product hiện có (đường dẫn gốc tính từ `products[]`; scalar/group lưu tại bảng products):

| Nhóm field PW2 | Cột/bảng và ràng buộc cần đọc cùng §5.2 |
|---|---|
| id; tenant; site | id; tenant_id; site_id. ID đích khác ID nguồn; tenant/site bắt buộc |
| name; slug | name; slug. Tên tối thiểu 3 ký tự, migration giới hạn 120; slug phải kiểm tra collision trong tenant và xác minh unique index tenant+slug ở DB đích |
| description; descriptionBM; shortDescription | description; description_b_m JSONB Lexical; short_description varchar không giới hạn độ dài; cần xác minh migration DB đích |
| price; compareAtPrice; currency | price; compare_at_price; currency. Giá 0..100.000.000; compareAtPrice khác null/undefined/0 phải lớn hơn price; MYR/USD/SGD, không quy đổi tự động |
| status; deletedAt | status draft/active/archived; deleted_at. Draft import không tương đương status nguồn; soft-delete là trạng thái độc lập |
| inventory; sku; hasVariants | inventory 0..1.000.000; sku; has_variants. Variant inventory là tổng stock; SKU cơ sở synthetic theo §16 |
| halalCertified; aiReviewPending; halalCertImage | halal_certified; ai_review_pending; halal_cert_image_id → media.id. Không bịa nguồn chứng nhận |
| weight; dimensions.length/width/height | weight kg; dimensions_length/width/height cm, không âm. Group không phải bảng riêng |
| seo.title; seo.description | seo_title; seo_description. Không tự suy nguồn SEO Product từ field không tồn tại |
| createdAt; updatedAt | created_at; updated_at. UTC theo timezone nguồn; không dùng thời điểm migrate |
| images; tags; category; variantConfigs; variants; attributes | Sáu array và relationship category ở bảng con bên dưới; không thêm collection SKU riêng |

| Bảng con PW2 | Field nghiệp vụ → path JSON | Cha và giới hạn |
|---|---|---|
| products_images | image_id → images[].image; alt → images[].alt | _parent_id → products.id; không giới hạn số ảnh; image là relationship Media bắt buộc, không chứa URL trực tiếp |
| products_tags | tag → tags[].tag | _parent_id → products.id; tag bắt buộc |
| products_variant_configs | name → variantConfigs[].name | _parent_id → products.id; ≤2 tier, tên bắt buộc ≤50 ký tự, không trùng sau trim/lowercase |
| products_variant_configs_options | value → variantConfigs[].options[].value | **_parent_id varchar → ID dòng products_variant_configs**, không trỏ Product/Attribute PW1; 1..30 option/tier, value ≤50 ký tự và không trùng trim/lowercase |
| products_variants | name, sku, price, compare_at_price, stock → variants[].name/sku/price/compareAtPrice/stock | _parent_id → products.id; ≤900 dòng; schema PW2 bắt buộc name/price/stock, SKU tùy chọn và ≤100 ký tự; exporter hiện bắt buộc SKU dài 1–50 (gap bên dưới), giá 0..100.000.000 và tồn 0..1.000.000 |
| products_attributes | key/value → attributes[].key/value | _parent_id → products.id; ≤20 dòng, key ≤100 và value ≤500 ký tự, cả hai bắt buộc |
| products_rels | categories_id → category[] | parent_id → Product, path='category'; id serial, order integer. Không dùng metadata _parent_id/_order của array |

Sáu bảng array có `id`/`_uuid` varchar UUID, `_order` integer, `_parent_id` theo kiểu cha ở bảng. ID nguồn không thay ID array đích; thứ tự JSON được giữ thành _order. `products_rels` có đúng nhóm cột id/order/parent_id/path/categories_id. Category là hasMany ở schema; exporter chọn tối đa một ref theo Product nguồn. Ngoại lệ category=[] chỉ áp khi activeCatalogOnly=true và Category nguồn tồn tại/live/status=0/cùng Store (§5.2); thiếu/xóa/sai tenant/status lạ không được miễn; khả năng lưu array không chứng nhận UI hỗ trợ nghiệp vụ multi-category đầy đủ.

**Gap SKU giữa collection, helper và artifact:** collection PW2 cho base SKU tùy chọn, không khai báo maxLength; variant SKU tùy chọn và maxLength=100. Shared validator giới hạn base 50/variant 100 và cho phép thiếu mã. Tuy nhiên catalog-schemas.ts của exporter bắt buộc cả hai là chuỗi dài 1–50; bước documentSchemas trong export-master.ts loại Product không đạt bằng DOCUMENT_SCHEMA_INVALID. Do đó nguồn có dòng SKU/giá hợp lệ nhưng mã null/rỗng, hoặc variant SKU 51–100 ký tự, vẫn có thể bị loại dù collection cho phép. Đây là giới hạn implementation chưa được nới, không thay policy bảo toàn mã nguồn hoặc cho phép cắt/sinh SKU để qua validator. Yêu cầu SKU khi publish là gate runtime riêng; không dùng nó để suy draft exporter đã tương thích đầy đủ.

**Variant vận hành:** PW2 không có selectedOptions hay FK Attribute/option trên SKU. Helper form ghép tổ hợp theo thứ tự tier/option bằng ` - `; resolver/checkout và trừ–hoàn tồn dùng Product ID + tên variant. Vì vậy cần crosswalk sourceSkuId/selectedTuple và tên đích khớp tham chiếu Order (§7.2); ID array hoặc mã SKU riêng không thay quan hệ này. Nhãn trùng/dấu phân cách/whitespace phải kiểm tra, không tự gộp tuple hoặc sinh SKU thiếu. `attributes[].key/value` chỉ là mô tả, không thay miền EAV.

DB index Variant SKU/name theo Product cha không chứng minh SKU unique toàn tenant; migration phải kiểm tra cả base và variant SKU trên tenant. Product hook chỉ cộng stock khi payload có hasVariants và variants, không tự bảo đảm mọi partial update hoặc giá min. Giá min eligible là **quyết định migration**. Publish guard còn yêu cầu base SKU và weight >0; draft hợp lệ không tự chứng minh đủ điều kiện publish hoặc ma trận đầy đủ. Không cắt vượt giới hạn hoặc sửa giá/tồn để qua validator.

### 18.3 Bảng disposition 103 cột nguồn

Baseline tám bảng: categories 24, category_attributes 8, attributes 9, attribute_values 9, products 25, product_attributes 8, product_skus 12, product_variants 8. Mỗi dòng dưới đây là một cột nguồn; không gồm ảnh, Brand, tag, lịch giá hoặc toàn bộ bảng Order. Các nhóm ngoài baseline theo §4.3, §5.2 và §7, không suy đủ toàn DB từ số 103.

**Mọi cột “Raw path mục tiêu — ĐỀ XUẤT” là vị trí bảo toàn dự kiến, không phải cột Payload, xác nhận đã xuất hoặc yêu cầu bổ sung mảng vào JSON.** Các raw arrays đã có theo §4–5 được giữ theo contract tương ứng. Riêng Product/SKU không có đích hoặc ngoài phạm vi §5.2, disposition “giữ nguồn/raw” được đáp ứng bằng CSV nguồn; raw path trong bảng chỉ là phương án lưu nhúng nếu sau này chọn mở rộng phạm vi, không phải gap cần đóng hiện tại. Khi cần giữ toàn Store, phạm vi Attribute/option phải gồm cả chưa dùng; nếu chỉ giữ graph thì phải công bố và lấy hợp tham chiếu Category + Product + SKU, không chỉ CategoryAttribute. Mọi orphan/chồng Store giữ lý do cách ly, không tự bỏ.

Nhãn chi tiết: MAP = sao chép có validation; TRANSFORM = chuyển đổi; REF = identity/quan hệ qua crosswalk; GENERATED = tự sinh; FILTER = điều kiện chọn dữ liệu vận hành nhưng vẫn giữ nguồn; RAW = chỉ giữ nguồn; GAP = thiếu semantics/schema/consumer; TARGET-OPEN = có field đích nhưng bảo toàn lịch sử chưa xác minh đầy đủ. Các nhãn này chi tiết hóa mã §1, không phải chứng nhận export/import.

#### 18.3.1 categories — 24 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| categories.id | categories[]._ref | Không phải cột Payload | REF | sites[].pw1_source.categories[].id | Ref dùng phân giải; namespace DB+bảng+ID trong đối soát. ID PW2 do importer resolve; raw giữ PK nguồn. |
| categories.store_id | categories[].tenant; categories[].site | categories.tenant_id; categories.site_id | REF | sites[].pw1_source.categories[].store_id | Resolve Store sang đúng Tenant/Site; kiểm tra ownership. |
| categories.name | categories[].name | categories.name | MAP | sites[].pw1_source.categories[].name | Giữ tên; kiểm tra trùng trim/case trong cùng tenant/parent theo action. |
| categories.name_ms | — | — | GAP | sites[].pw1_source.categories[].name_ms | Thiếu field tên đa ngôn ngữ Category. |
| categories.slug | categories[].slug | categories.slug | TRANSFORM | sites[].pw1_source.categories[].slug | Giữ nguồn nếu hợp lệ; unique theo tenant với dòng live; không đổi âm thầm. |
| categories.image | — | — | GAP | sites[].pw1_source.categories[].image | Giữ URL PW1; Category chưa có field ảnh, không upload S3. |
| categories.signature | — | — | GAP | sites[].pw1_source.categories[].signature | Giữ chữ ký nguồn; không suy là checksum. |
| categories.description | categories[].description | categories.description | MAP | sites[].pw1_source.categories[].description | Textarea nhận chuỗi; giữ HTML raw, chưa chứng minh render tương đương. |
| categories.description_ms | — | — | GAP | sites[].pw1_source.categories[].description_ms | Thiếu field mô tả đa ngôn ngữ Category. |
| categories.title | — | — | GAP | sites[].pw1_source.categories[].title | Thiếu SEO title Category. |
| categories.meta_description | — | — | GAP | sites[].pw1_source.categories[].meta_description | Thiếu SEO description Category. |
| categories.status | Bộ lọc active-only | — | FILTER | sites[].pw1_source.categories[].status | Chỉ status=1 được emit theo active-only; status=0 giữ nguồn, không đổi thành deletedAt; cha inactive xử lý theo policy §5.1. |
| categories.parent_id | categories[].parent | categories.parent_id | REF | sites[].pw1_source.categories[].parent_id | Resolve theo cây hiệu lực; promotion lên root chỉ theo §5.1 khi cha live/inactive đúng tenant. Kiểm tra cycle/collision và tối đa 3 tầng gồm hậu duệ sau reparent. |
| categories.position | — | — | GAP | sites[].pw1_source.categories[].position | Giữ thứ tự nguồn; thiếu field/consumer, storefront đang sort name. |
| categories.layout | — | — | GAP | sites[].pw1_source.categories[].layout | Giữ cấu hình nguồn; không map sang dna. |
| categories.total_products | — | — | RAW | sites[].pw1_source.categories[].total_products | Giữ snapshot tổng hợp để đối soát; thống kê PW2 phải tính lại theo semantics đã chốt, không thay giá/tồn SKU. |
| categories.min_product_price | — | — | RAW | sites[].pw1_source.categories[].min_product_price | Giữ snapshot tổng hợp để đối soát; thống kê PW2 phải tính lại theo semantics đã chốt, không thay giá/tồn SKU. |
| categories.max_product_price | — | — | RAW | sites[].pw1_source.categories[].max_product_price | Giữ snapshot tổng hợp để đối soát; thống kê PW2 phải tính lại theo semantics đã chốt, không thay giá/tồn SKU. |
| categories.min_product_stock | — | — | RAW | sites[].pw1_source.categories[].min_product_stock | Giữ snapshot tổng hợp để đối soát; thống kê PW2 phải tính lại theo semantics đã chốt, không thay giá/tồn SKU. |
| categories.max_product_stock | — | — | RAW | sites[].pw1_source.categories[].max_product_stock | Giữ snapshot tổng hợp để đối soát; thống kê PW2 phải tính lại theo semantics đã chốt, không thay giá/tồn SKU. |
| categories.created_by | — | — | RAW | sites[].pw1_source.categories[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| categories.created_at | categories[].createdAt | categories.created_at | TARGET-OPEN | sites[].pw1_source.categories[].created_at | Field đích có thật; ISO UTC theo timezone nguồn đã xác nhận (offset phải xác minh cho từng nguồn), raw giữ gốc. Không lấy thời điểm import thay lịch sử; trạng thái xuất thực tế phải đối soát đúng artifact, chưa chứng nhận importer. |
| categories.updated_at | categories[].updatedAt | categories.updated_at | TARGET-OPEN | sites[].pw1_source.categories[].updated_at | Field đích có thật; ISO UTC theo timezone nguồn đã xác nhận (offset phải xác minh cho từng nguồn), raw giữ gốc. Không lấy thời điểm import thay lịch sử; trạng thái xuất thực tế phải đối soát đúng artifact, chưa chứng nhận importer. |
| categories.deleted_at | categories[].deletedAt | categories.deleted_at | TARGET-OPEN | sites[].pw1_source.categories[].deleted_at | Có đích schema nhưng bản ghi deleted hiện bị loại khỏi mapped theo tài liệu; giữ raw. Cần đường import lịch sử có kiểm tra; Category còn chặn field access. Không đồng nhất inactive. |

#### 18.3.2 category_attributes — 8 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| category_attributes.id | — | — | RAW | sites[].pw1_source.category_attributes[].id | Giữ PK nguồn với namespace DB+bảng; không copy trực tiếp thành PK PW2. Crosswalk chỉ có đích nếu bản ghi được emit/import. |
| category_attributes.attribute_id | — | — | GAP | sites[].pw1_source.category_attributes[].attribute_id | Giữ FK attribute_id; join định nghĩa nguồn, xác minh cùng Store qua Category. Chưa có quan hệ Category–Attribute PW2. |
| category_attributes.category_id | — | — | GAP | sites[].pw1_source.category_attributes[].category_id | Giữ FK category_id; join định nghĩa nguồn, xác minh cùng Store qua Category. Chưa có quan hệ Category–Attribute PW2. |
| category_attributes.is_required | — | — | GAP | sites[].pw1_source.category_attributes[].is_required | Giữ boolean nguồn; chưa có bằng chứng PW1 enforce bắt buộc. Không tự áp required mới. |
| category_attributes.created_by | — | — | RAW | sites[].pw1_source.category_attributes[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| category_attributes.created_at | — | — | RAW | sites[].pw1_source.category_attributes[].created_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| category_attributes.updated_at | — | — | RAW | sites[].pw1_source.category_attributes[].updated_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| category_attributes.deleted_at | — | — | RAW | sites[].pw1_source.category_attributes[].deleted_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |

#### 18.3.3 attributes — 9 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| attributes.id | — | — | RAW | sites[].pw1_source.attributes[].id | Giữ PK nguồn với namespace DB+bảng; không copy trực tiếp thành PK PW2. Crosswalk chỉ có đích nếu bản ghi được emit/import. |
| attributes.store_id | — | — | REF | sites[].pw1_source.attributes[].store_id | Dùng kiểm tra ownership nguồn; PW2 không có bản ghi master tương đương. Không gán store_id vào dòng array con. |
| attributes.name | products[].variantConfigs[].name | products_variant_configs.name | TRANSFORM | sites[].pw1_source.attributes[].name | Chỉ định nghĩa được domain Product dùng mới có đích này; có thể sao thành nhiều dòng con. Chọn name hoặc fallback name_ms trước khi trim; name chỉ có khoảng trắng cho nhãn rỗng, preflight từ chối. Giữ cả hai raw. |
| attributes.name_ms | products[].variantConfigs[].name (fallback) | products_variant_configs.name | TRANSFORM | sites[].pw1_source.attributes[].name_ms | Fallback khi name falsy, trước khi trim; name chỉ có khoảng trắng không dùng fallback. Không có field nhãn thứ hai ở đích; giữ cả hai raw, không gộp identity vì trùng nhãn. |
| attributes.code | — | — | REF | sites[].pw1_source.attributes[].code | Code phục vụ validation nguồn và identity manifest; không có cột code tier. PW2 chưa giữ identity/code master tương đương; chấp nhận gap, không thêm master Attribute trong scope này. |
| attributes.created_by | — | — | RAW | sites[].pw1_source.attributes[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| attributes.created_at | — | — | RAW | sites[].pw1_source.attributes[].created_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| attributes.updated_at | — | — | RAW | sites[].pw1_source.attributes[].updated_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| attributes.deleted_at | Kiểm tra định nghĩa domain | — | FILTER | sites[].pw1_source.attributes[].deleted_at | Domain live tham chiếu Attribute deleted gây SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH; không âm thầm bỏ định nghĩa rồi coi kết quả hợp lệ. Giữ nguyên timestamp/null raw. |

#### 18.3.4 attribute_values — 9 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| attribute_values.id | — | — | RAW | sites[].pw1_source.attribute_values[].id | Giữ PK nguồn với namespace DB+bảng; không copy trực tiếp thành PK PW2. Crosswalk chỉ có đích nếu bản ghi được emit/import. |
| attribute_values.store_id | — | — | REF | sites[].pw1_source.attribute_values[].store_id | Dùng kiểm tra ownership nguồn; PW2 không có bản ghi master tương đương. Không gán store_id vào dòng array con. |
| attribute_values.attribute_id | Quan hệ tier–options được dựng | products_variant_configs_options._parent_id | REF | sites[].pw1_source.attribute_values[].attribute_id | Resolve qua tier của từng Product; _parent_id là ID dòng config varchar PW2, không phải Attribute ID nguồn. |
| attribute_values.name | products[].variantConfigs[].options[].value | products_variant_configs_options.value | TRANSFORM | sites[].pw1_source.attribute_values[].name | Chỉ định nghĩa được domain Product dùng mới có đích này; có thể sao thành nhiều dòng con. Chọn name hoặc fallback name_ms trước khi trim; name chỉ có khoảng trắng cho nhãn rỗng, preflight từ chối. Giữ cả hai raw. |
| attribute_values.name_ms | products[].variantConfigs[].options[].value (fallback) | products_variant_configs_options.value | TRANSFORM | sites[].pw1_source.attribute_values[].name_ms | Fallback khi name falsy, trước khi trim; name chỉ có khoảng trắng không dùng fallback. Không có field nhãn thứ hai ở đích; giữ cả hai raw, không gộp identity vì trùng nhãn. |
| attribute_values.created_by | — | — | RAW | sites[].pw1_source.attribute_values[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| attribute_values.created_at | — | — | RAW | sites[].pw1_source.attribute_values[].created_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| attribute_values.updated_at | — | — | RAW | sites[].pw1_source.attribute_values[].updated_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| attribute_values.deleted_at | Kiểm tra định nghĩa domain | — | FILTER | sites[].pw1_source.attribute_values[].deleted_at | Domain live tham chiếu option deleted gây SOURCE_EAV_ORPHAN_OR_OWNER_MISMATCH; không âm thầm bỏ định nghĩa rồi coi kết quả hợp lệ. Giữ nguyên timestamp/null raw. |

#### 18.3.5 products — 25 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| products.id | products[]._ref | Không phải cột Payload | REF | sites[].pw1_source.products[].id | Ref dùng phân giải; namespace DB+bảng+ID trong đối soát. ID PW2 do importer resolve; raw giữ PK nguồn. |
| products.store_id | products[].tenant; products[].site | products.tenant_id; products.site_id | REF | sites[].pw1_source.products[].store_id | Resolve Store sang đúng Tenant/Site; kiểm tra ownership. |
| products.category_id | products[].category[] | products_rels.categories_id; parent_id; path='category' | REF | sites[].pw1_source.products[].category_id | Một ref tới Category được emit; [] chỉ theo ngoại lệ active-only cho Category nguồn live/inactive cùng Store (§5.2), không áp cho quan hệ lỗi. parent_id là ID Product đích, categories_id là ID Category đích. |
| products.name | products[].name | products.name | MAP | sites[].pw1_source.products[].name | Trim; collection tối thiểu 3 ký tự, preflight migration còn giới hạn 120. Raw giữ chuỗi nguyên bản. |
| products.name_ms | — | — | GAP | sites[].pw1_source.products[].name_ms | Thiếu field localized tương đương; kể cả trùng bản chính vẫn giữ raw để đối soát. |
| products.slug | products[].slug | products.slug | TRANSFORM | sites[].pw1_source.products[].slug | Giữ/chuẩn hóa slug PW1; collision-check trong cùng tenant theo `store_id`. Worktree-2 đã đổi sang tenant+slug; DB đích chưa được xác minh vẫn là readiness gap. Không tự rewrite để né collision. |
| products.featured_description | products[].shortDescription | products.short_description | TRANSFORM | sites[].pw1_source.products[].featured_description | Giữ nguyên featured_description vào shortDescription; bỏ maxLength 300, SQL varchar không giới hạn độ dài; không cắt chuỗi. |
| products.featured_description_ms | — | — | GAP | sites[].pw1_source.products[].featured_description_ms | Thiếu field localized tương đương; kể cả trùng bản chính vẫn giữ raw để đối soát. |
| products.description | products[].description | products.description | TRANSFORM | sites[].pw1_source.products[].description | HTML/text → Lexical; raw giữ HTML khi qua bộ lọc §2.3, nếu bị loại thì CSV nguồn giữ bản gốc; báo phần không chuyển được, không tuyên bố lossless chỉ vì valid JSON. |
| products.description_ms | products[].descriptionBM | products.description_b_m | TRANSFORM | sites[].pw1_source.products[].description_ms | Chuyển Lexical như bản chính; không tự suy ngôn ngữ khác ngoài contract; raw giữ HTML gốc khi vượt kiểm tra §2.3; nếu bị loại thì CSV nguồn giữ bản gốc. |
| products.status | products[].status | products.status | TRANSFORM | sites[].pw1_source.products[].status | Theo quyết định 2026-09-18: 1 → active; 0 → draft (ẩn). Không ép active thành draft; sanitizer phải giữ trạng thái đã map. |
| products.package_length | products[].dimensions.length | products.dimensions_length | TRANSFORM | sites[].pw1_source.products[].package_length | Giữ số theo cm đã xác nhận cho nguồn này; không tự chia theo enum chưa rõ. Theo §5.2, phép chia enum kích thước legacy chưa được chứng nhận cho nguồn cm; không dùng làm quy tắc mapping. |
| products.package_weight | products[].weight | products.weight | TRANSFORM | sites[].pw1_source.products[].package_weight | Đơn vị type 1 (kg) giữ số; type 2 (gram) chia 1000 theo source đã xác minh. Không tính lại phí Order lịch sử. |
| products.package_height | products[].dimensions.height | products.dimensions_height | TRANSFORM | sites[].pw1_source.products[].package_height | Giữ số theo cm đã xác nhận cho nguồn này; không tự chia theo enum chưa rõ. Theo §5.2, phép chia enum kích thước legacy chưa được chứng nhận cho nguồn cm; không dùng làm quy tắc mapping. |
| products.package_width | products[].dimensions.width | products.dimensions_width | TRANSFORM | sites[].pw1_source.products[].package_width | Giữ số theo cm đã xác nhận cho nguồn này; không tự chia theo enum chưa rõ. Theo §5.2, phép chia enum kích thước legacy chưa được chứng nhận cho nguồn cm; không dùng làm quy tắc mapping. |
| products.package_dimension_type | — | — | RAW | sites[].pw1_source.products[].package_dimension_type | Giữ enum nguồn để đối soát. Không có field loại đơn vị đích; không tự suy enum 2 là mm/g. |
| products.package_weight_type | Bộ đổi đơn vị weight | products.weight (kg) | TRANSFORM | sites[].pw1_source.products[].package_weight_type | type1=kg/type2=gram; thiếu/khác enum báo lỗi, không đoán. |
| products.brand_id | — | — | GAP | sites[].pw1_source.products[].brand_id | Giữ Brand ID, cần raw bảng brands ngoài 103 cột; PW2 thiếu quan hệ Brand Product. |
| products.stock | — | — | RAW | sites[].pw1_source.products[].stock | Chỉ đối soát stock nguồn cấp Product; inventory đích lấy SKU đủ điều kiện, không chép đè từ cột này. |
| products.low_stock_threshold | — | — | GAP | sites[].pw1_source.products[].low_stock_threshold | Thiếu ngưỡng từng Product; PW2 dùng ngưỡng chung, không coi tương đương. |
| products.url | — | — | RAW | sites[].pw1_source.products[].url | Giữ URL gốc; chưa có mapping redirect/canonical đã chốt. Slug mới không thay thế lịch sử URL. |
| products.created_by | — | — | RAW | sites[].pw1_source.products[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| products.created_at | products[].createdAt | products.created_at | TRANSFORM | sites[].pw1_source.products[].created_at | Commerce reconciliation đã có rule đọc Product cùng Store, offset nguồn bắt buộc → ISO UTC (không mặc định offset cho DB khác); từ chối thiếu/sai timestamp, raw giữ gốc. Cần manifest lần chạy để chứng nhận artifact; chưa chứng nhận importer DB. |
| products.updated_at | products[].updatedAt | products.updated_at | TRANSFORM | sites[].pw1_source.products[].updated_at | Commerce reconciliation đã có rule đọc Product cùng Store, offset nguồn bắt buộc → ISO UTC (không mặc định offset cho DB khác); từ chối thiếu/sai timestamp, raw giữ gốc. Cần manifest lần chạy để chứng nhận artifact; chưa chứng nhận importer DB. |
| products.deleted_at | products[].deletedAt | products.deleted_at | TARGET-OPEN | sites[].pw1_source.products[].deleted_at | Có đích schema nhưng bản ghi deleted hiện bị loại khỏi mapped theo tài liệu; giữ raw. Cần đường import lịch sử có kiểm tra; Category còn chặn field access. Không đồng nhất inactive. |

#### 18.3.6 product_attributes — 8 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| product_attributes.id | — | — | RAW | sites[].pw1_source.product_attributes[].id | Giữ PK nguồn với namespace DB+bảng; không copy trực tiếp thành PK PW2. Crosswalk chỉ có đích nếu bản ghi được emit/import. |
| product_attributes.product_id | Dựng products[].variantConfigs[] theo Product | products_variant_configs._parent_id | REF | sites[].pw1_source.product_attributes[].product_id | Group theo Product nguồn rồi resolve ID Product đích; nhiều dòng domain cùng tier không tạo nhiều tier. |
| product_attributes.attribute_id | products[].variantConfigs[] (identity tier) | Không có cột Attribute ID nguồn | REF | sites[].pw1_source.product_attributes[].attribute_id | Join attributes bằng ID, sắp ID tăng dần; dùng nhãn cho name, crosswalk giữ identity; không Products.attributes. |
| product_attributes.attribute_value_id | products[].variantConfigs[].options[] | Không có cột option ID nguồn | REF | sites[].pw1_source.product_attributes[].attribute_value_id | Join attribute_values; option thuộc đúng Attribute/Store; mỗi miền option chỉ một lần, báo duplicate. |
| product_attributes.created_by | — | — | RAW | sites[].pw1_source.product_attributes[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| product_attributes.created_at | — | — | RAW | sites[].pw1_source.product_attributes[].created_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| product_attributes.updated_at | — | — | RAW | sites[].pw1_source.product_attributes[].updated_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| product_attributes.deleted_at | Bộ lọc domain Product | — | FILTER | sites[].pw1_source.product_attributes[].deleted_at | Loại dòng deleted khỏi domain vận hành; ảnh hưởng hasVariants, tier/option và kiểm tra matrix. Vẫn giữ nguyên dòng và timestamp/null raw. |

#### 18.3.7 product_skus — 12 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| product_skus.id | products[].variants[].id hoặc crosswalk SKU simple | products_variants.id khi variant; không có SKU row khi simple | REF | sites[].pw1_source.product_skus[].id | Variant ID sinh deterministic theo namespace+SKU ID, không copy PK số. Simple vẫn cần crosswalk nguồn → Product; manifest hiện chưa bao phủ đủ simple. |
| product_skus.store_id | — | — | REF | sites[].pw1_source.product_skus[].store_id | Kiểm tra trùng Store của Product; không có tenant riêng trên dòng variant, thừa hưởng qua Product. |
| product_skus.product_id | products[].variants[] hoặc Product simple | products_variants._parent_id hoặc products.id | REF | sites[].pw1_source.product_skus[].product_id | Resolve Product đích. Không tạo Product riêng cho từng SKU. |
| product_skus.sku | products[].sku (simple); products[].variants[].sku (variant) | products.sku; products_variants.sku | MAP | sites[].pw1_source.product_skus[].sku | Giữ mã eligible SKU, kiểm tra rỗng/duplicate/giới hạn. Base SKU Product variant sinh từ token+Product ID, không chọn SKU đầu tiên. |
| product_skus.stock | products[].inventory; products[].variants[].stock | products.inventory; products_variants.stock | TRANSFORM | sites[].pw1_source.product_skus[].stock | Simple lấy stock SKU duy nhất; variant giữ stock từng dòng và cộng vào inventory. Kiểm tra integer không âm/giới hạn, không cộng inactive/deleted. |
| product_skus.price | products[].price; products[].variants[].price | products.price; products_variants.price | TRANSFORM | sites[].pw1_source.product_skus[].price | Simple lấy giá SKU; variant giữ từng giá và Product lấy min base price eligible. Không đổi tiền hoặc dùng promotion thay base. |
| product_skus.cost | — | — | GAP | sites[].pw1_source.product_skus[].cost | Giữ giá vốn nguồn; Product/variant PW2 chưa có cost. |
| product_skus.status | Bộ lọc eligible, không phải field variant | — | GAP | sites[].pw1_source.product_skus[].status | Hiện eligible là status=1 cùng Store/chưa deleted; giữ status=0 và giá/tồn trong CSV nguồn là đủ theo §5.2, không bắt raw nhúng JSON. Không chuyển SKU inactive thành stock=0 để giả lập. |
| product_skus.created_by | — | — | RAW | sites[].pw1_source.product_skus[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| product_skus.created_at | — | — | RAW | sites[].pw1_source.product_skus[].created_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| product_skus.updated_at | — | — | RAW | sites[].pw1_source.product_skus[].updated_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| product_skus.deleted_at | Bộ lọc eligible SKU | — | FILTER | sites[].pw1_source.product_skus[].deleted_at | Loại SKU deleted khỏi tập eligible, giá min và tổng inventory; eligibility còn yêu cầu status=1 và cùng Store. Vẫn giữ nguyên dòng và timestamp/null raw. |

#### 18.3.8 product_variants — 8 cột

| Cột PW1 | JSON đích PW2 / vai trò | Bảng.cột PW2 | Xử lý | Raw path mục tiêu — ĐỀ XUẤT | Quy tắc / gap |
|---|---|---|---|---|---|
| product_variants.id | — | — | RAW | sites[].pw1_source.product_variants[].id | Giữ PK nguồn với namespace DB+bảng; không copy trực tiếp thành PK PW2. Crosswalk chỉ có đích nếu bản ghi được emit/import. |
| product_variants.product_sku_id | products[].variants[] được group theo SKU | Không có FK SKU nguồn | REF | sites[].pw1_source.product_variants[].product_sku_id | Join SKU→Product; một SKU có nhiều selected rows. Dùng sourceSkuId/selectedTuple khi dựng variant trong bộ nhớ; receipt tuple đầy đủ chưa được xuất (§18.4); không emit một variant cho mỗi dòng. |
| product_variants.attribute_id | products[].variants[].name (thành phần tier) | products_variants.name (không có Attribute FK) | REF | sites[].pw1_source.product_variants[].attribute_id | Chọn đúng tier theo Attribute ID, thứ tự deterministic; mỗi SKU một lựa chọn/tier. Identity giữ raw/tuple, không chỉ tên. |
| product_variants.attribute_value_id | products[].variants[].name (nhãn option) | products_variants.name (không có option FK) | REF | sites[].pw1_source.product_variants[].attribute_value_id | Join nhãn đúng option trong miền Product rồi ghép ' - '; kiểm tra tuple trùng/thiếu. Tên đích nhất quán với checkout/hoàn tồn. |
| product_variants.created_by | — | — | RAW | sites[].pw1_source.product_variants[].created_by | Giữ ID user nguồn để đối soát; tạm chưa map creator theo quyết định người dùng; không suy owner hoặc tự cấp quyền. |
| product_variants.created_at | — | — | RAW | sites[].pw1_source.product_variants[].created_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| product_variants.updated_at | — | — | RAW | sites[].pw1_source.product_variants[].updated_at | Giữ thời gian của chính dòng nguồn, kể cả null; không gộp vào lịch sử Product/Category cha. Chưa có audit tương đương cho dòng này. |
| product_variants.deleted_at | Bộ lọc selected rows | — | FILTER | sites[].pw1_source.product_variants[].deleted_at | Chỉ dùng selected rows chưa deleted của eligible SKU; ảnh hưởng hasVariants, selected tuple và kiểm tra matrix. Vẫn giữ nguyên dòng và timestamp/null raw. |

### 18.4 Kiểm tra riêng EAV và mức bảo toàn

- Nhãn EAV hiện lấy `String(row?.name || row?.name_ms || "").trim()`: fallback trước trim; name chỉ có khoảng trắng không dùng name_ms và bị từ chối nếu nhãn rỗng. Không âm thầm sửa nghĩa để coi output tương đương.
- Domain/selection đã xóa không tham gia hasVariants, tier, ma trận, giá/tồn. Domain live trỏ Attribute/option deleted là lỗi nguồn, không bỏ định nghĩa rồi coi ma trận hợp lệ.
- **Gap receipt EAV của exporter hiện tại:** cấu trúc `productReconciliation.sourceIdentity[]` từng được mô tả cho công cụ research cũ, gồm sourceRef/sourceInstanceToken/emitted/eligibleSkuCount, tiers/options, sourceSkuId/targetId/selectedTuple và errors, không có trong manifest/artifact của exporter master hiện tại. skuCrosswalk chỉ được dùng trong bộ nhớ; mapping-report.json giữ contributions theo ID/field nguồn và targetPath/rule, chưa giữ toàn bộ tuple/targetId. Đối soát tuple/ownership/giá/tồn vẫn cần CSV nguồn; nếu cần receipt tái sử dụng cho importer thì phải bổ sung và validate riêng. Không coi provenance hiện có là bằng chứng receipt này đã được xuất.

Căn cứ trực tiếp: [Categories](../../src/collections/Categories.ts), [Products](../../src/collections/Products.ts), [DDL](../../scripts/db-setup.js), [EAV transformer](../../src/lib/migration/pw2-product-eav.mjs), [Product preflight](../../src/lib/migration/pw2-product-migration.mjs), [variant resolver](../../src/lib/products/resolve-product-line.ts), [Category PW1](/home/liam/data/prime-web-api/app/Models/Category.php), [ProductController PW1](/home/liam/data/prime-web-api/app/Http/Controllers/Products/ProductController.php), [CategoryRepository PW1](/home/liam/data/prime-web-api/app/Repositories/EloquentCategoryRepository.php). Header baseline là tám bảng CSV nguồn tương ứng; không dùng bản hợp nhất này để chứng nhận DB live đã đồng bộ.


## Quyết định trạng thái nguồn — 2026-09-18

Yêu cầu chủ dữ liệu: giữ trạng thái PW1, kể cả Product; thay thế chính sách ép draft/inactive ở các bản trước. Exporter 1.3.0 áp dụng cho Product, Blog và Discount như các bảng trên. Các điều kiện sử dụng discount chưa tương đương vẫn là blocker riêng; active trong JSON không cho phép importer bỏ qua blocker. Phần “inactive cho đến đối soát” của contract 2026-09-15 chỉ mô tả artifact cũ.

Bộ lọc category/SKU active và soft-delete đã duyệt vẫn giữ nguyên. Trạng thái Order, thanh toán, subscription và membership tiếp tục theo mapping nguồn đã đối soát; không đổi thành default. PW2 không có enum inactive cho Product/Blog: draft là đích không hiển thị cho status=0, không phải giữ nguyên nhãn enum. Status expired của promotion giữ bằng inactive + ngày hết hạn nguồn hợp lệ; thiếu/mâu thuẫn ngày hết hạn phải chặn.

Sites.status là trường khởi tạo PW2 không có cột xuất bản tương đương đã xác minh trong PW1; không suy published từ stores.status (trạng thái tài khoản). Pages và nội dung raw tiếp tục giữ status nguồn. Không tự tạo publishedAt/scheduledPublishDate từ created_at hoặc thời gian chạy.

Artifact 1.0–1.2 giữ nguyên contract cũ và vẫn được validator đọc; không đổi nhãn manifest để giả thành artifact mới. Importer đang pin contract 1.2 phải được cập nhật và kiểm thử với contract 1.3 trước khi nhận artifact mới.

## Loại bỏ pw1_source khỏi master — 2026-09-18

Exporter 1.4.0 bỏ hoàn toàn sites[].pw1_source; không tạo thêm raw JSON sidecar. CSV nguồn được giữ ngoài artifact và có tên/hash trong master-manifest.json. Các field chỉ phục vụ raw archive được ghi retained-source theo MASTER-4.1-EXTERNAL-CSV-ARCHIVE; contribution metadata trỏ source-csv.<table>. Field có mapping nghiệp vụ thực tế vẫn là mapped.

Quy tắc này chỉ áp dụng cho các field raw allowlist đã kiểm tra, đúng bảng/ownership; không bỏ qua secret, unknown field, unsafe value hoặc quan hệ nguồn chưa xác minh. Diagnostic vẫn được giữ. Pages/menus và các collection nghiệp vụ không bị loại trong thay đổi này.

Schema 1.4 cấm nhúng lại pw1_source. Validator tiếp tục đọc 1.0–1.3 bằng schema lịch sử tương ứng; importer nhận đúng cặp version/hash mới và hiểu retained-source là archive CSV, không phục hồi nó vào DB.

## Export outcome contract — 2026-09-18

Exporter 1.5 reports successful publication separately from data completeness and import readiness. `status=exported`, `outcome.exportStatus=succeeded`, `outcome.dataStatus=complete|partial`, `outcome.importStatus=not_verified`. Exit 0 means artifact publication/validation succeeded, not that all source data was migrated. Invalid artifacts/runs return 1. Historical artifacts retain their original status and exit semantics.

`export-review.json` and `export-review.md` are manifest-hashed reports grouping diagnostics into data issues, importer requirements, delegated rich-text fidelity, out-of-scope Pages and warnings. Original diagnostic severity, counts, mapping.complete and report evidence remain intact for backward auditing. Importer must still verify creator binding and tenant indexes; unknown diagnostics, unsafe links, missing media, price/variant gaps and ownership failures are not silently waived. Data completeness remains partial while data issues or blocked Stores remain. No skipped data is reintroduced or silently dropped by this reporting change.

Raw diagnostics for model_settings, frontend_templates, brands, attributes, attribute_values and category_attributes may be outside scope only with verified ownership and exclusively matching external CSV contributions for that source identity and consuming Store. Operational/mixed contributions do not qualify. Field-disposition/ownership validation remains mandatory; this does not waive aggregate unresolved-field evidence.

### Outcome correction 1.5.1

Preserve the frozen 1.5.0 outcome/report contract for old artifacts. In 1.5.1, warning diagnostics ORDER_PAYMENT_METHOD_UNVERIFIED and SUBSCRIPTION_CANCEL_FLAG_ABSENT are importer requirements only for the exact table/field/reason evidence accepted by importer. Diagnostics explicitly owned by policyExcludedStores use policy_excluded and policyExcludedDiagnosticCount; they cannot make in-scope data partial. Global diagnostics and other Stores remain in scope. Per-Store outcome exportStatus agrees with emitted/blocked/excluded, with excluded dataStatus and not_applicable importStatus for excluded Stores. Top-level publication status remains succeeded. CSV-only global raw rows require matching verified consumer contributions; unproven or mixed operational contributions remain blocked.

## Product description preservation — exporter 1.6.0

Supersedes Product-description conversion/fidelity/link/media rules above for new exports. By user decision, products.description and products.description_ms are opaque source strings: retain every character, including HTML tags/attributes, embedded URLs, scripts/styles, JSON-looking text, entities, whitespace and line endings. Store respectively in products[].description and descriptionBM as Lexical root → paragraph → one text node; that node's text equals the decoded CSV value exactly. Explicit empty string yields empty text; null/missing source has no description document. This envelope preserves source markup as text for the separate rich-text workflow; it does not recreate HTML rendering.

Do not parse/sanitize/truncate these two fields or emit Product-description fidelity, link, media or raw-value blockers. Do not create media downloads/references from embedded description URLs. Product gallery/media fields and all Blog/Page validators retain their existing rules. Other Product validation can still quarantine the Product; this change does not manufacture missing price/SKU or restore blocked Stores. Old artifacts keep their original diagnostics and contract. Importer accepts the new exact version/hash but retains source/DB/policy gates outside these fields.

## Blog author fallback — exporter 1.6.1

User decision: if blog_posts.created_by cannot resolve to an exported User for the Store (including empty/missing source author), set blogs.author to the unique exported User with an owner membership for that exact tenant. Keep a source author that already resolves. Do not create a new User or use an owner from another tenant. If no unique exported tenant owner exists, retain BLOG_AUTHOR_UNRESOLVED and quarantine the Blog. Export stores a User reference; importer resolves it to the target owner User ID. Original created_by remains in immutable source CSV; fallback is the approved MASTER_8_2 mapping, not preservation of original authorship. Other Blog validation stays unchanged.

## Blog content preservation — exporter 1.6.2

By user decision, blog_posts.content is opaque source text: preserve the decoded CSV string exactly in blogs[].content as Lexical root → paragraph → one text node, without parsing/filtering HTML, links, styles, entities, scripts or embedded images. No content-derived media/downloads or BLOG_LINK_UNSAFE/BLOG_MEDIA_UNRESOLVED/fidelity diagnostics are generated for body content. The separate image/thumbnail, metadata, slug, author and status fields keep their validation. Null/missing content yields an empty text document as before; explicit empty string stays empty text. This stores source markup as text for the separate rendering workflow, not rendered HTML.

Raw source classification for content and content_ms also preserves the strings without content validation. PW2 currently has no separate Malay Blog content field; content_ms remains in the external source CSV, not silently appended to content or claimed as imported. A separate target-field decision is required to migrate that locale. Historical artifacts retain their original diagnostics and exact contract hashes.

## SKU/option reconciliation — exporter 1.7.0

PW1 product_variants records eligible SKU selections independently of product_attributes. Recover missing target option definitions from those actual live selection rows only when the referenced attribute and attribute_value exist, are live, belong to the same Store as the Product/SKU, and the value belongs to that attribute. Retain existing domain definitions too; never infer a selection from SKU code/name, fabricate a SKU or complete the Cartesian matrix. Emit definition contributions for both declared-domain and selected option definitions and preserve source SKU crosswalks.

Continue quarantining foreign/orphan/deleted definitions, incomplete or ambiguous selections, duplicate complete tuples and duplicate SKU codes. Incomplete tuples do not prove duplication and must not emit an extra duplicate-tuple error. No automatic winner selection, merging prices or stock, renaming SKU, or rewriting source rows is approved.

Product missing eligible SKU price/stock remains quarantined as agreed. Empty/null/missing/whitespace values count as missing and produce MISSING_PRICE/MISSING_STOCK metadata; actual zero is valid. This does not waive importer diagnostics or dependencies of quarantined Products.


## Approved missing-price/stock Product exclusion — exporter 1.8.0

Supersedes the 1.7.0 statement that missing price/stock Products always block import. A live Product with a recognized source status is omitted as a whole when an eligible SKU has an empty/null/missing/whitespace price or stock, or when no SKU rows / no live owned SKU remain. Zero remains valid. Unknown SKU status, foreign live SKU ownership, negative/non-numeric/out-of-range price/stock are not this exclusion and retain their blockers. Entirely inactive SKU sets keep their existing active-catalog policy.

Emit PRODUCT_MISSING_PRICE_STOCK_EXCLUDED as a warning with the exact Product ID and one of MISSING_PRICE, MISSING_STOCK, MISSING_PRICE_AND_STOCK, NO_SKU_ROWS, NO_LIVE_OWNED_SKU. Retain the Product and its unused owned catalog child rows in source CSV with productExclusion {productId, reason} and MASTER-5.2-PRODUCT-MISSING-PRICE-STOCK field evidence. Only products, product_skus, product_attributes, product_variants, product_images, product_sku_images, product_sku_promotion_prices and Product model_settings qualify. Shared attribute definitions and operational Order/discount rows do not inherit exclusion. Unknown fields and unresolved ownership stay unresolved.

Validators require the matching Product evidence, identical Store/reason, valid family parent ownership, no operational contributions and no emitted Product for the excluded identity. Importer approves this diagnostic only for the exact 1.8.0 contract and verified classification evidence. Historical artifacts keep their original gates. Other diagnostics are never waived by this rule. Historical Order line name, quantity and price remain unchanged under the previously approved order policy; no invented Product/SKU references. Genuine relationship or order-value failures remain blockers.
