---
title: "Phương án migration PW1 → PW2 trong hai ngày"
date: 2026-09-15
status: proposed
revision: 2
type: brainstorm-report
scope: "CSV → JSON master → QA → CLI import → đối soát"
---

# Phương án migration PW1 → PW2 trong hai ngày

## 1. Tóm tắt và khuyến nghị

**Đề xuất dùng một JSON master làm dữ liệu đầu vào nghiệp vụ duy nhất cho migration.** JSON được tạo từ toàn bộ CSV theo master mapping, được team QA kiểm tra trước, sau đó mới được importer dùng để nạp vào DB PW2.

Luồng chính:

```text
Snapshot CSV PW1
  → Kiểm kê và kiểm tra nguồn
  → Mapping theo từng Store
  → master.json + manifest + báo cáo mapping
  → Validate + QA nghiệm thu dữ liệu G1
  → Viết importer theo contract đã khóa
  → Plan chọn Store / danh sách / range / all + preview + preflight
  → Kiểm duyệt plan cho DB rehearsal cô lập
  → Apply: ghi DB + ledger + checkpoint
  → Đối soát DB + kiểm thử chức năng
```

**Mốc hai ngày có điều kiện, chưa phải cam kết production toàn bộ.** Master hiện vẫn có các gap về chuyển đổi nội dung, Media, quyền User và gói dịch vụ. Giữ được dữ liệu trong JSON chưa đồng nghĩa dữ liệu đó đã sẵn sàng ghi DB hoặc hoạt động đúng trên PW2.

Report này là thiết kế đề xuất, chưa phải kế hoạch đã được phê duyệt hay bằng chứng triển khai. Các câu lệnh trong report là giao diện dự kiến, chưa được tạo bởi công việc này.

### Điều chỉnh sau review — revision 2

Mục tiêu lập lịch: **G1 — JSON toàn bộ nguồn được nghiệm thu trước; G2 — importer trong phạm vi đã khóa đạt rehearsal trên DB cô lập.** Production là cửa sổ riêng sau các gate, không xếp mặc định vào giờ cuối ngày 2. Scope đề xuất dưới đây chưa thay thế quyết định nghiệp vụ của người dùng.

| Phát hiện | Cách xử lý |
|---|---|
| Source thay đổi sau lần import | Ma trận hash và vòng đời crosswalk tại §9.3 |
| Apply không bị ràng buộc bản QA | Plan bất biến và receipt kiểm duyệt tại §5.5, §8 |
| Chưa đủ ma trận scope | Đủ 20 collection, owner, điều kiện chặn tại §7 |
| Store dở có thể bị truy cập | DB cô lập cho rehearsal; gate production tại §9.4 |
| Thiếu lịch snapshot cuối | Gate artifact cuối và ngân sách cutover tại §14 |
| Importer làm trước nghiệm thu JSON | Lịch tuần tự và gate G1 tại §13 |

### Giả định lập lịch

| Nội dung | Giả định hiện tại | Cần xác nhận |
|---|---|---|
| Nhân lực | Hai dev và một QA, hai ngày làm việc, tám giờ/ngày | Số người thực tế |
| Môi trường | DB thử nghiệm cô lập có sẵn | Local/staging và khả năng reset/restore |
| Nguồn | Có đủ CSV và biết múi giờ nguồn | Tính nhất quán của snapshot, số Store, dung lượng |
| Mapping | Chốt phạm vi và gap trong buổi đầu | Gap nào được hoãn, gap nào bắt buộc hoàn tất |
| Đích hai ngày | G1: JSON đã QA; G2: importer đạt rehearsal trong scope | Nếu bắt buộc production, lập lại lịch sau đo |
| Cutover | Có thể dừng ghi PW1 trong phạm vi chuyển | Khoảng bảo trì được chấp nhận |

## 2. Yêu cầu và định nghĩa hoàn thành

### 2.1. Yêu cầu của người dùng

- Đọc toàn bộ CSV để tạo một JSON master chứa dữ liệu các Store theo cấu trúc mẫu trên nhánh hiện tại.
- Team kiểm tra được toàn bộ dữ liệu dự kiến nạp DB trước khi chạy migration.
- Importer dùng JSON đó làm đầu vào, không phụ thuộc các bước sửa tay.
- Có lệnh dạng `npm run migrate:pw1`.
- Chọn được một Store, danh sách Store, khoảng ID hoặc toàn bộ.
- Tracking bền vững: Store đã chạy, trạng thái, bước hiện tại, lỗi, số lượng và lịch sử.
- Có thể chạy lại, tiếp tục sau lỗi và đối soát kết quả.
- Lập phương án trước; chưa triển khai code.

### 2.2. Ba đầu ra riêng biệt

| Đầu ra | Điều kiện hoàn thành |
|---|---|
| JSON master | Tạo trực tiếp từ CSV; đúng cấu trúc mẫu; mọi Store và phần dữ liệu không xuất đều được kiểm kê |
| Bộ lệnh migration | Chọn phạm vi chính xác; ghi dữ liệu theo contract; có ledger, chống trùng, checkpoint và verify |
| Kết quả migration | DB khớp dữ liệu dự kiến; chức năng trong phạm vi chuyển hoạt động; các gap được công bố |

**Phân biệt ba trạng thái:** đã có trong JSON; được phép ghi DB; đã ghi đúng và dùng được trên PW2.

Raw Page/component hoặc `sites[].pw1_source` có thể nằm trong JSON để bảo toàn nguồn nhưng chưa phải dữ liệu Payload có thể ghi nguyên object.

## 3. Cơ sở khảo sát và giới hạn bằng chứng

### 3.1. Tài liệu và code trên nhánh hiện tại

- [Master field mapping](../../docs/migration/pw1-pw2-master-field-mapping.md).
- [JSON mẫu](../../docs/migration/stores-205-285-pw2-current-schema-collection-only.json).
- [Generator current schema](../../scripts/data/generate-two-store-pw2-current-schema.mjs).
- [Generator preview hai Store](../../scripts/data/generate-two-store-pw2-preview.mjs).
- [QA F42 Layer 1](../../docs/qa/F42-pw1-pw2-layer1.md).
- Các module `src/lib/migration/pw2-product-*.mjs`, `pw2-customer-reconciliation.mjs`, `pw2-commerce-reconciliation.mjs`, `pw2-discount-source.mjs`.

Generator hiện có phụ thuộc JSON trung gian và Store cố định. Có thể tái sử dụng mapper sau khi đối chiếu, nhưng cần thay phần điều phối để đọc trực tiếp CSV và xử lý mọi Store.

### 3.2. Runner tại worktree tham khảo

Đường dẫn thực tế: `<worktree-1>`.

Các phần đã đọc cho thấy runner Sprint 1 có preflight, kiểm tra target baseline, lease/fencing, bảng đối chiếu ID, checksum, các lệnh resume/verify/rollback và batch. Đây là nền tảng để đánh giá tái sử dụng, chưa chứng minh đủ cho 20 collection.

**Phát hiện cần đưa vào thiết kế:** phần `recordMap` đã đọc chống trùng theo `run_id`; tra cứu `mappedTarget` cũng theo run. Vì vậy không được suy ra chạy một run mới đã tự chống tạo bản ghi trùng xuyên các run. Cần khóa đối chiếu ổn định theo nguồn và đích.

Runner cũ còn phụ thuộc contract Sprint 1, credential recovery và media upload. Những phần này không thể áp dụng nguyên trạng cho master mới. Chưa xác minh đầy đủ rollback hoặc ranh giới transaction của toàn bộ runner; phải kiểm chứng trước khi tái sử dụng.

### 3.3. Tác động runtime đã thấy

- `Orders` có hook tạo thông báo khi tạo đơn.
- `Products` có thể kích hoạt SEO, SSO hoặc thông báo tùy thao tác.
- `Media` có upload pipeline; URL ngoài và quyền sở hữu cần đường ghi đã kiểm chứng.
- Các nơi dùng `migrationStatus` đã tìm thấy chưa chứng minh có cơ chế chặn đọc toàn bộ Store đang import. Không coi nhãn `pending` là biện pháp cô lập.

## 4. Các phương án được cân nhắc

| Phương án | Ưu điểm | Hạn chế | Kết luận |
|---|---|---|---|
| CSV → DB trực tiếp | Ít bước ban đầu | Khó QA trước; mapping có thể thay đổi giữa các lần chạy | Không phù hợp yêu cầu |
| CSV → master JSON → runner | Kiểm duyệt được; tái chạy; đối soát; chọn Store | Cần contract và các bộ ghi theo collection | **Chọn** |
| JSON → SQL toàn bộ | Chủ động field hệ thống, tốc độ | Phải tự xử lý schema vật lý, mảng con, validation, quan hệ | Không chọn mặc định trong hai ngày |

Tái sử dụng runner và mapper đã có sau khi kiểm tra. Dùng Payload Local API cho phần phù hợp; chỉ thêm đường ghi SQL/adapter chuyên biệt khi có lý do cụ thể và kiểm thử đối soát.

Không xây framework migration tổng quát, dashboard riêng hoặc đồng bộ hai chiều trong đợt đầu.

## 5. Contract artifact

### 5.1. JSON master

Giữ đúng mẫu: mảng ngoài cùng; mỗi phần tử là một Store; đúng 20 key collection; giá trị luôn là mảng.

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

Khung trên minh họa cấu trúc, không phải Store hợp lệ: Store được xuất phải có đúng một Tenant và một Site.

- Không cố định ID 205/285.
- `_ref` là định danh logic, không phải cột DB.
- Namespace nguồn được ghi trong manifest và crosswalk để tránh va chạm khi ghép nguồn.
- Store inactive/deleted được xử lý theo chính sách chốt trước; mọi Store bị loại vẫn có báo cáo.
- Root collection giữ nguyên; không tự thêm collection theo tên bảng CSV.

### 5.2. Bộ file bàn giao kỹ thuật

| File | Vai trò |
|---|---|
| `master.json` | Dữ liệu nghiệp vụ và raw theo contract mẫu |
| `master-manifest.json` | Phiên bản mapping, nguồn, hash, số lượng, mức độ hoàn chỉnh |
| `mapping-report.csv` | QA lọc theo Store/collection/field/disposition/lỗi |
| `import-preview.json` | Dữ liệu logic sẽ ghi; còn `_ref` ở những vị trí chưa có ID đích |
| Snapshot/archive nguồn được giữ lại | Bảo toàn dữ liệu không nằm trong master theo disposition |

Một master là nguồn dữ liệu nghiệp vụ chính. Manifest cung cấp metadata kiểm chứng. Preview được sinh tự động bằng cùng phép chiếu field mà importer dùng; không chỉnh sửa tay thành nguồn thứ hai. Importer không đọc lại CSV hoặc archive để âm thầm bổ sung dữ liệu.

### 5.3. Phân loại độ phủ

Mỗi field/bản ghi trong phạm vi cần trạng thái và lý do theo master:

- Đã map trực tiếp hoặc chuyển đổi.
- Quan hệ cần phân giải.
- Giá trị tự sinh theo quy tắc đã chốt.
- Chỉ giữ nguồn.
- Cách ly.
- Chủ động loại trừ.
- Chưa thể xử lý.

Không dùng `[]` để đánh đồng nguồn thực sự rỗng, file thiếu, chưa có mapper hoặc toàn bộ dữ liệu bị cách ly.

Disposition phải trỏ được tới nguồn lưu giữ thực tế. Chỉ có nhãn `archiveRef` chưa chứng minh giá trị được lưu. Credential, token và dữ liệu nhạy cảm không được đưa vào payload review hoặc log; raw trong mẫu hiện không được mặc định là an toàn để chia sẻ công khai.

### 5.4. Nội dung manifest

- `artifactId`, `mappingVersion`, phiên bản exporter.
- Định danh instance/database PW1; múi giờ nguồn.
- File CSV, bảng tương ứng, số dòng, SHA-256.
- SHA-256 master và contract mapping.
- Danh sách Store: xuất, loại trừ, bị chặn.
- Số lượng theo Store/collection/disposition.
- Dependency và gap chưa xử lý.
- Mức sẵn sàng import theo phạm vi.

### 5.5. Khóa artifact và ràng buộc plan → apply

**G1 — dữ liệu:** QA chấp nhận master, manifest, mapping report và danh sách field dự kiến ghi. Đây là điều kiện bắt đầu viết importer; chưa chứng minh DB đã nhận đúng dữ liệu.

**G2 — thực thi:** sau khi có importer, `plan` sinh preview bằng cùng phép chiếu field dùng khi ghi. QA kiểm tra preview và rehearsal. Nếu khác dữ liệu nghiệp vụ đã duyệt ở G1, sửa master và nghiệm thu lại phần ảnh hưởng trước khi tiếp tục.

Importer không đọc lại CSV hay remap giá, tồn kho, trạng thái, tiền tệ hoặc ngày giờ. Chỉ validate, resolve quan hệ và chuyển cấu trúc vận chuyển sang thao tác ghi.

`plan.json` bất biến phải chứa:

- `planId`; hash master, manifest, scope policy và preview.
- Phiên bản contract, commit/build importer.
- Định danh nguồn; target fingerprint; phiên bản schema và registry đích.
- Selector được phân giải thành danh sách Store cụ thể, thứ tự chạy và chính sách dừng lỗi.
- Các hành động create/skip/block, baseline của dữ liệu đích liên quan và gap được chấp nhận.
- Đường dẫn artifact phục vụ tìm file; hash mới là căn cứ kiểm tra nội dung. Không lưu secret kết nối.

Receipt kiểm duyệt lưu `planId`, hash plan, người kiểm duyệt và thời điểm trong kho tracking được kiểm soát. Thao tác ghi nhận receipt cần danh tính vận hành được phân quyền và event audit. Không tin một field `approved: true` tự sửa trong file; hash không tự xác thực người phê duyệt. Nếu xuất receipt ra file, apply vẫn phải đối chiếu bản đã ghi nhận.

Apply chỉ nhận plan đã kiểm duyệt. Trước khi ghi phải kiểm tra lại toàn bộ hash, receipt, target thực tế, phiên bản importer/schema/registry và baseline liên quan. Sai lệch → `PLAN_STALE`, không ghi. Tạo plan mới và kiểm duyệt lại; không có tùy chọn bỏ qua kiểm tra trong bản đầu.

Resume dùng cùng plan và receipt; đối chiếu ledger cho những thay đổi do chính run đã commit. Không coi thay đổi hợp lệ do run tạo là target drift, cũng không bỏ kiểm tra thay đổi từ bên ngoài.

Không có bảng dữ liệu nghiệp vụ nào được ghi bởi `plan` hoặc thao tác ghi receipt. Kho tracking có thể lưu metadata/audit; dữ liệu nghiệp vụ chỉ được ghi bởi `apply`.

## 6. Pipeline CSV → master

### Bước 1 — Kiểm kê snapshot

- Nhận diện bảng từ tên file; hỗ trợ định dạng tên snapshot đã chốt.
- Phát hiện nhiều snapshot cùng bảng; không tự chọn file mới nhất.
- Kiểm tra bảng bắt buộc, header thiếu/trùng, ID trùng, dòng lỗi.
- Hỗ trợ BOM, ô chứa dấu phẩy, dấu ngoặc kép, CRLF và xuống dòng trong ô.
- Đọc toàn bộ file; bảng chưa map phải có trạng thái rõ.
- Xác nhận snapshot nhất quán giữa các bảng. File có cùng thư mục không chứng minh cùng thời điểm dữ liệu.

### Bước 2 — Lập index và dependency

- Store → Tenant/Site.
- Category cha → con.
- Product → SKU → Variant/Attribute/Image.
- Order → OrderDetail.
- PromotionCode → Promotion → Store.
- Page → Component → Banner/Shortlist.
- Subscription → Store/Plan/Usage.
- User/actor/membership theo định danh nguồn đã xác minh.

Không quét lại tất cả CSV cho mỗi bản ghi. Đo bộ nhớ trước khi quyết định giữ toàn bộ index trong RAM; có thể xử lý lần lượt Store mà vẫn tạo một file JSON cuối.

### Bước 3 — Mapping theo Store

Mỗi mapper trả về dữ liệu đích, crosswalk, disposition và lỗi. Tái sử dụng Product/EAV, Customer, Commerce, Discount sau khi kiểm tra đầu vào và quy tắc với master.

Gộp các bước raw Page, component, navigation và Site source vào pipeline; không cần script vá thủ công sau export.

### Bước 4 — Validate liên collection

- Đúng Tenant/Site và quyền sở hữu.
- Không có quan hệ ngoài Store ngoài các dependency dùng chung đã chốt.
- `_ref` duy nhất và có thể phân giải hoặc được ghi nhận là blocker.
- Kiểm tra slug/SKU/email theo đúng scope unique từng collection.
- Đối soát tiền, đơn vị, tồn kho, ngày giờ và giới hạn mảng.
- Kiểm tra toàn artifact, không chỉ từng Store riêng lẻ.

### Bước 5 — Xuất ổn định

- Cùng snapshot và cấu hình sinh cùng dữ liệu master.
- Sắp xếp Store/bản ghi/mảng con theo contract.
- Không thay ngày lịch sử bằng thời gian chạy.
- Không tạo ID ngẫu nhiên cho khóa cần tái tạo.
- Ghi tạm, kiểm tra hoàn chỉnh rồi công bố artifact; không để file dở được hiểu là thành công.

## 7. Ma trận phạm vi 20 collection

### 7.1. Quy ước phạm vi đề xuất

- **Nạp:** nằm trong scope rehearsal đề xuất; vẫn phải qua validation, có writer và test đạt.
- **Có điều kiện:** dependency bắt buộc phải đóng trước khi chọn Store vào apply; không tự bỏ qua.
- **Giữ nguồn:** chưa ghi DB trong đợt đầu; cần chấp nhận phạm vi này trước G1.
- **Ngoài scope:** giữ key và disposition đúng master; không tính là chuyển hoàn tất.

A = dev phụ trách mapping, B = dev phụ trách importer, QA = người đối soát, N = người chốt nghiệp vụ. Đây là phân vai đề xuất; tên người cụ thể phải được điền trước khi khóa scope.

Không có writer 20 collection nào được chứng nhận sẵn dùng qua khảo sát này. “Tận dụng” nghĩa là có module nguồn để đánh giá, không đồng nghĩa import-ready.

| Collection | JSON master | Ghi DB đợt đầu đề xuất | Writer/công việc | Điều kiện chặn hoặc giới hạn | Nghiệm thu | Owner |
|---|---|---|---|---|---|---|
| `tenants` | Map một Tenant/Store | Nạp | Sửa Sprint 1 | Tier nguồn, slug, timestamp; không tự free | Field, unique, thời gian | A/B/QA |
| `users` | Map user đủ điều kiện | Có điều kiện | Sửa Sprint 1, bỏ credential recovery | Identity/role/login chưa chốt → chặn Store cần user | Membership, trùng email, không nâng quyền | B/N/QA |
| `sites` | Map và raw `pw1_source`/menu | Nạp phần field PW2 | Sửa Sprint 1, allowlist raw | Quan hệ tenant, cấu hình; raw không gửi Payload | Field, ownership, raw giữ nguyên | A/B/QA |
| `pages` | Raw Page/component theo master | Giữ nguồn | Không viết converter trong baseline | Không tuyên bố website hoàn chỉnh | Đủ raw và quan hệ nguồn | A/N/QA |
| `media` | URL ngoài và ref | Có điều kiện | Thay đường upload cũ | Ownership/URL writer chưa đạt → chặn bản ghi và Store phụ thuộc | URL đọc được, quyền tenant | B/QA |
| `categories` | Map | Nạp | Viết writer, tận dụng quy tắc | Cha/con, site, danh mục lá, unique | Ref và scope category | A/B/QA |
| `products` | Map/EAV, quarantine | Nạp | Tận dụng mapper, viết writer | SKU, giá, tồn kho, media/category và mảng con | Field, EAV, bảng con, không SEO | A/B/QA |
| `customers` | Map và gộp theo contract | Nạp | Tận dụng reconciliation, viết writer | Phone cohort, địa chỉ, quan hệ | Crosswalk gộp, field, địa chỉ | A/B/QA |
| `discounts` | Map, inactive | Nạp | Tận dụng mapper, viết writer | Đơn vị tiền, giới hạn và dependency | Giá trị, scope, inactive | A/B/N/QA |
| `orders` | Map đơn đạt đối soát | Nạp | Tận dụng reconciliation, viết writer | Items/Product/Customer, tiền, trạng thái, hook | Snapshot lịch sử, không notification | A/B/QA |
| `discount_usage_history` | Theo master, hiện chưa tính đủ | Ngoài scope | Chưa viết writer | Không bật discount khi usage chưa đối soát | Disposition, không tự sinh history | A/N/QA |
| `blog_categories` | Map phần xác minh | Nạp | Viết writer | Slug/tenant và field hợp lệ | Field, unique đúng scope | A/B/QA |
| `blogs` | Map phần xác minh, giữ nguồn phần thiếu | Giữ nguồn | Converter chưa nằm baseline | Chưa bảo đảm Lexical/locale/author → không nạp một phần giả hoàn tất | Nội dung nguồn được lưu, gap rõ | A/N/QA |
| `email-template-settings` | Map loại hỗ trợ | Nạp | Viết writer | Loại template, locale; loại không hỗ trợ có disposition | Field, không gửi email | A/B/QA |
| `plan-subscriptions` | Theo contract registry nguồn | Có điều kiện | Viết writer sau chốt registry | Plan, expiry, trial, tenant tier phải nhất quán | Đối soát quyền lợi/thời hạn | A/B/N/QA |
| `plan-subscription-usages` | Theo contract usage | Có điều kiện | Viết writer | Subscription, metric, range/semantics chưa chốt → chặn dependency | Quan hệ, quota, range | A/B/N/QA |
| `notifications` | Key và disposition quarantine | Ngoài scope | Không viết writer | Không đánh đồng quarantine với nguồn rỗng | Count/disposition | A/QA |
| `subscribers` | Key, nguồn chưa chốt | Ngoài scope | Không viết writer | Chưa xác minh nguồn | Báo unknown/empty riêng | A/N/QA |
| `contact-submissions` | Key, nguồn chưa chốt | Ngoài scope | Không viết writer | Chưa xác minh nguồn | Báo unknown/empty riêng | A/N/QA |
| `analytics` | Key, nguồn chưa chốt | Ngoài scope | Không viết writer | Chưa xác minh nguồn | Báo unknown/empty riêng | A/N/QA |

### 7.2. Điều kiện khóa scope trước G1

Tạo `scope-policy.json` dự kiến: mỗi collection có chế độ export/write, field allowlist, rule version, dependency bắt buộc, gap được chấp nhận theo mã, owner và test nghiệm thu. Hash policy nằm trong manifest và plan.

- N phải chấp nhận rõ các hàng giữ nguồn/ngoài scope. Chưa có quyết định thì G1 chưa đạt; không coi bảng đề xuất là đã được chấp thuận.
- Collection có điều kiện chưa đạt mà Store cần nó → `BLOCKED_SCOPE_DEPENDENCY`.
- Collection “Nạp” chưa có writer/test ở G2 → block; không đổi thành skip để giữ deadline.
- Quarantine được phép chỉ theo mã và phạm vi đã chốt; số liệu/gap luôn nằm trong report.
- Nếu mục tiêu là website PW2 hoạt động tương đương PW1, phải đưa Page, Blog, login, quyền và entitlement vào scope bổ sung, ước lượng lại lịch. Baseline này không bao gồm kích hoạt website đầy đủ.
- Trước ngày 2, B điền trạng thái từng writer: chưa có/cần sửa/đã test và số giờ dự kiến. Nếu tổng công việc vượt năng lực còn lại, điều chỉnh lịch; chỉ giảm scope khi N đồng ý và artifact/policy được nghiệm thu lại.

Danh sách Store eligible phải được tính theo dependency và policy; `--all` vẫn báo mọi Store bị chặn, không âm thầm giảm danh sách.

## 8. Giao diện CLI dự kiến

### 8.1. Export

```bash
npm run migrate:pw1:export -- \
  --input-dir /path/to/csv \
  --output-dir /path/to/artifact \
  --source-instance pw1-main \
  --source-timezone Asia/Kuala_Lumpur
```

Múi giờ chỉ là ví dụ; phải dùng giá trị nguồn đã xác nhận. Export mặc định kiểm kê toàn bộ Store; selector export nếu bổ sung phải dùng cùng quy tắc định danh với importer.

### 8.2. Validate và lập plan theo phạm vi

```bash
npm run migrate:pw1 -- validate --input /path/to/master.json
npm run migrate:pw1 -- plan --input master.json --store 205 --target staging --output plan-205.json
npm run migrate:pw1 -- plan --input master.json --stores 205,285 --target staging --output plan-list.json
npm run migrate:pw1 -- plan --input master.json --store-range 200:300 --target staging --output plan-range.json
npm run migrate:pw1 -- plan --input master.json --all --target staging --output plan-all.json
```

- `validate`: offline, kiểm tra master/manifest/policy; không ghi DB.
- `plan`: đọc DB đích, phát hiện conflict, tạo preview và plan bất biến. Không ghi dữ liệu nghiệp vụ.
- ID là Store ID PW1. Range bao gồm hai đầu và chọn ID trong artifact, không phải vị trí mảng.
- Selector loại trừ lẫn nhau; thiếu selector, ID không có hoặc range rỗng → lỗi rõ ràng.
- `--all` có Store bị chặn → plan chưa thực thi được. Muốn chạy subset phải tạo và kiểm duyệt plan subset, không tự bỏ qua.
- Chạy tuần tự; mặc định dừng lỗi. Chính sách tiếp tục lỗi cô lập nếu được hỗ trợ phải được khóa trong plan. Lỗi hệ thống/contract/target luôn dừng batch.

### 8.3. Kiểm duyệt và apply plan

```bash
npm run migrate:pw1 -- approve-plan --plan plan-205.json
npm run migrate:pw1 -- apply --plan plan-205.json
```

`approve-plan` là lệnh dự kiến ghi receipt sau QA bởi người vận hành được phân quyền, theo §5.5. Không tự approve khi chạy plan/apply. Đây là bước kiểm duyệt dữ liệu trong quy trình tương lai, không phải yêu cầu xin phép bổ sung để sửa report này.

Apply không nhận `--input`, `--store`, `--stores`, `--store-range`, `--all`, `--target` hay policy override: tất cả đã được khóa trong plan. Có thể cấu hình credential ngoài plan nhưng phải khớp target fingerprint. Không lộ credential trong file hoặc log.

Plan thiếu receipt, bị sửa hoặc stale → từ chối trước business write. Kiểm tra lại baseline dưới khóa Store và dựa vào constraint DB cho xung đột concurrent; không chỉ kiểm tra một lần ở đầu batch.

Không định nghĩa dry-run bằng ghi rồi rollback; tác động bên ngoài DB không bảo đảm hoàn tác.

### 8.4. Vận hành

```bash
npm run migrate:pw1 -- status --run-id <run-id>
npm run migrate:pw1 -- status --store 205 --target staging
npm run migrate:pw1 -- resume --run-id <run-id>
npm run migrate:pw1 -- verify --run-id <run-id>
npm run migrate:pw1 -- rollback --run-id <run-id> --store 205
```

Resume lấy lại artifact, selector và checkpoint của run cũ. Không cho đổi nguồn hoặc target âm thầm. CLI chạy trong tiến trình Node độc lập với vòng đời HTTP request.

## 9. Thiết kế ghi DB

### 9.1. Bộ ghi theo collection

Mỗi bộ ghi khai báo field được ghi, field raw/metadata không ghi, quan hệ cần resolve, mảng con, field hệ thống và hook cần kiểm soát.

Không duyệt key rồi gửi nguyên object vào `payload.create`. Không tắt toàn bộ validation để làm dữ liệu đi qua.

Payload hỗ trợ hook context và transaction; mỗi hook cần chủ động xử lý context migration. Phải kiểm thử với phiên bản trong repository và truyền request/transaction đúng cho thao tác liên quan. Xem [Payload hook context](https://payloadcms.com/docs/hooks/context) và [Payload transactions](https://payloadcms.com/docs/database/transactions).

### 9.2. Thứ tự dependency dự kiến

1. Registry dùng chung và xung đột identity.
2. Tenant.
3. Site/User/Media theo dependency cụ thể.
4. Category cha → con.
5. Product và mảng con.
6. Customer/Discount.
7. Order/items.
8. Discount usage nếu mapping đã hoàn tất.
9. BlogCategory → Blog; Page khi converter đủ điều kiện.
10. Subscription → Usage theo registry.
11. Resolve tham chiếu còn lại và verify.

Đây là thứ tự khái quát. Quan hệ vòng cần hai lượt hoặc đường ghi chuyên biệt; không dùng ID giả. Các trường hợp bắt buộc tham chiếu ngay khi tạo cần chốt trước khi viết importer.

### 9.3. Crosswalk và chống trùng xuyên run

Khóa ổn định: target instance + source instance/database + source table + source ID + target collection. Namespace/version/run mới không được tạo danh tính nghiệp vụ mới.

Crosswalk lưu ID đích, Store nguồn, run tạo, phiên bản mapper, `sourceHash` của document logic đã duyệt, `targetHash` của dữ liệu đọc lại sau ghi và trạng thái vòng đời. Hash source và target dùng hai phép chuẩn hóa công bố rõ; không so byte JSON với bản ghi chứa ID hệ thống.

| Crosswalk/nguồn/đích | Kết quả bản đầu create-only |
|---|---|
| Chưa có crosswalk, không có xung đột đích | CREATE + crosswalk trong cùng transaction |
| ACTIVE; sourceHash không đổi; target khớp targetHash đã ghi | SKIP_VERIFIED |
| ACTIVE; sourceHash đổi; target vẫn khớp bản cũ | SOURCE_CHANGED, block; không skip và không update |
| ACTIVE; target khác targetHash đã ghi | TARGET_CHANGED, block; nếu source cũng đổi, báo cả hai |
| ACTIVE nhưng ID đích biến mất | TARGET_MISSING, block; không tự tạo lại |
| Chưa có crosswalk nhưng trùng khóa unique | IDENTITY_CONFLICT, block; không nhận ownership tự động |
| User trùng email | Block để xác minh identity; không tự merge |
| ROLLED_BACK có bằng chứng xóa hợp lệ; đích cũ đã vắng | Plan mới có thể đề xuất RECREATE sau kiểm tra toàn dependency/unique |
| Rollback đang dở/thất bại | Block plan mới; hoàn tất phục hồi trước |

Run đang dở chỉ resume cùng artifact/plan. Không đưa snapshot mới vào resume. Nếu source thay đổi, lựa chọn bản đầu là dùng target rehearsal mới, hoặc rollback toàn phạm vi liên quan khi còn đủ điều kiện rồi lập plan mới; không lách block bằng cách đổi source namespace.

Rollback giữ lịch sử crosswalk dưới dạng tombstone `ROLLED_BACK`, ID cũ và event xóa; không xóa lịch sử. Xóa bản ghi đích và chuyển trạng thái mapping phải atomic. RECREATE tạo generation/attempt mới dưới cùng khóa logic, lưu ID mới và giữ audit ID cũ. Không resume run cũ sau rollback để tránh skip theo checkpoint cũ.

Rehearsal dùng DB riêng; production dùng artifact cuối từ lần ghi đầu. Nếu production đã có dữ liệu từ artifact trước hoặc run cũ chưa có crosswalk tương thích, block để đối chiếu; không cam kết cập nhật/delta trong scope create-only.

### 9.4. Transaction và checkpoint

Đề xuất transaction theo một đơn vị dữ liệu hoàn chỉnh, ví dụ Product cùng mảng con hoặc Order cùng items. Thao tác ghi và ledger phải commit cùng transaction. Nếu tái sử dụng runner cũ, cần kiểm chứng cơ chế này, không suy ra từ tên module.

- Đã commit: ledger xác nhận để resume không ghi lại.
- Chưa commit: rollback đơn vị đang xử lý.
- Store có thể dở dang giữa các transaction; áp dụng cơ chế cô lập bắt buộc bên dưới.
- Không chỉ gán `migrationStatus=pending` rồi coi Store đã được cô lập.
- Không tạo một transaction cho toàn bộ Store/all Store trước khi đo kích thước và thời gian khóa.

#### Quyết định cô lập và mở Store

**Trong hai ngày: chỉ apply vào DB rehearsal riêng**, không dùng chung DB phục vụ người dùng, không có traffic public, worker nghiệp vụ hoặc integration thật. Mỗi DB rehearsal có target identity riêng; không copy receipt/ledger sang production để tái sử dụng trạng thái verified. Quyền truy cập chỉ cấp cho nhóm triển khai/QA.

**Production chưa được phép chạy chỉ nhờ có field pending.** Trước cửa sổ production phải hoàn thành gate G3:

1. Có cơ chế chặn cả đọc và ghi Store đang migrate ở admin, storefront, REST/GraphQL, auth/SSO, cache và background job liên quan.
2. Store mới được tạo ở trạng thái bị chặn ngay từ transaction đầu; không có khoảng trống trước khi bật gate.
3. Hook migration chỉ được bật từ runner nội bộ; request ngoài không được tự yêu cầu bypass.
4. Test cố ý dừng sau Tenant/Site và sau Product commit: mọi đường người dùng vẫn bị chặn; worker không tạo tác động mới.
5. `verify` đạt không tự mở Store. Mở truy cập là bước riêng sau kiểm tra login, quyền, entitlement và nội dung cần thiết trong scope activation.

Chưa có G3 → `BLOCKED_TARGET_ISOLATION`, dừng ở rehearsal. Không chọn chuyển sang DB mới/đổi traffic như một fallback ngầm; nếu muốn phương án đó phải có thiết kế đồng bộ dữ liệu đích hiện hữu riêng.

### 9.5. Bảo toàn dữ liệu lịch sử

- Giữ timestamp nguồn theo contract; không để hook tự đổi mà không đối soát.
- ID DB tự cấp và `_ref` được resolve là khác biệt kỹ thuật được phép.
- Preview khai báo field nào do DB sinh; verify chuẩn hóa các khác biệt đó.
- Không tự repricing Order, thay tên variant lịch sử hoặc tạo Customer ngoài dữ liệu đã duyệt.
- Tắt có chọn lọc thông báo, SEO, email, webhook và các tác động nghiệp vụ của import lịch sử; vẫn giữ kiểm tra cấu trúc/quan hệ cần thiết.

## 10. Logging và tracking

**DB ledger là nguồn trạng thái chính.** Console và file log hỗ trợ vận hành; mất terminal không làm mất lịch sử.

### 10.1. Ba cấp tracking

| Cấp | Thông tin |
|---|---|
| Run | Run ID, hash artifact, code version, target fingerprint, selector, người/tiến trình chạy, thời gian, kết quả |
| Store | Store nguồn, Tenant/Site đích, bước, checkpoint, attempt, lỗi, số lượng, thời gian |
| Record | Collection, nguồn, `_ref`, ID đích, action, hash, trạng thái ghi |

Ưu tiên mở rộng ledger đã có nếu phù hợp. Nếu cần schema tracking mới, bổ sung migration theo quy ước `scripts/db-setup.js`; không dùng schema push làm đường triển khai chính.

### 10.2. Trạng thái thực thi

```text
PENDING → VALIDATING → READY → APPLYING → VERIFYING → VERIFIED
                ↓                 ↓           ↓
             BLOCKED           FAILED    VERIFY_FAILED

FAILED → RESUMING → APPLYING
Dữ liệu đã commit → ROLLING_BACK → ROLLED_BACK / ROLLBACK_FAILED
```

Lưu độ phủ độc lập: đầy đủ trong scope; có loại trừ đã công bố; còn gap chưa được chấp nhận. `VERIFIED` phải đi kèm scope, không đồng nghĩa mọi dữ liệu PW1 đã chuyển.

### 10.3. Event log tối thiểu

- Timestamp UTC, level, event code, sequence.
- Run ID, Store ID, collection, phase.
- Source identity và target ID khi có.
- Attempt, duration, checkpoint.
- Mã lỗi đã phân loại, retryable hay không.

Không ghi credential, token, URL kết nối hoặc toàn bộ payload chứa dữ liệu khách hàng. Lỗi phải được làm sạch trước khi ra console/file.

### 10.4. Tổng kết batch

- Tổng Store chọn, verified, blocked, failed, chưa chạy.
- Số bản ghi create/skip/conflict/quarantine.
- Sai lệch verify và gap theo Store.
- Vị trí report, run ID và cách resume.
- Exit code khác 0 nếu có Store trong phạm vi chưa đạt; không in success chỉ vì vòng lặp đã hết.

## 11. Retry, resume, rollback

### Retry

- Chỉ retry lỗi tạm thời với số lần giới hạn và backoff.
- Không retry tự động lỗi mapping, tenant, dữ liệu, unique hay quan hệ.
- Nếu mất kết nối khiến không rõ commit, tra ledger trước khi lặp thao tác.

### Resume

- Kiểm tra đúng target, artifact, phiên bản importer và checkpoint.
- Kiểm tra dữ liệu đích chưa đổi ngoài dự kiến.
- Khóa theo Store, heartbeat/lease và fencing để tiến trình cũ không tiếp tục ghi sau khi mất quyền.
- Không coi checkpoint ở file log là đủ bằng chứng commit.

### Rollback

- Chỉ hoàn tác bản ghi do run tạo và vẫn đủ điều kiện hoàn tác.
- Theo thứ tự ngược dependency.
- Không xóa bản ghi dùng chung, dữ liệu có trước hoặc đã được người dùng sửa.
- Kiểm tra checksum/quan hệ mới trước khi xóa.
- Nếu bị chặn, ghi `ROLLBACK_FAILED` cùng lý do và hướng xử lý.
- Không xóa hàng loạt theo tenant một cách bao quát.
- Không tuyên bố rollback DB thu hồi được email/thông báo đã gửi.

Backup trước production và diễn tập restore là phương án phục hồi môi trường; không thay thế rollback có chọn lọc trên DB đã có dữ liệu thật.

## 12. Kế hoạch kiểm thử và đối soát

### 12.1. Artifact: tự động trên toàn bộ nguồn

- Cấu trúc root và một Tenant/Site mỗi Store.
- Đủ danh sách Store và disposition cho Store bị loại.
- CSV quoting, multiline, BOM, null/rỗng, lỗi cột, duplicate.
- `_ref`, quan hệ, tenant isolation và unique đúng scope.
- Tiền, đơn vị, số lượng, timestamp và tồn kho.
- Mảng con và đối chiếu nguồn–đích.
- Không lẫn credential; raw giữ đúng phạm vi được phép.
- Export ổn định khi đổi thứ tự dòng CSV.
- Báo riêng nguồn rỗng, thiếu bảng, chưa map và quarantine.

Không dùng tổng số dòng CSV = tổng số document làm tiêu chí duy nhất: Customer có thể được gộp; một bản ghi nguồn có thể tạo nhiều bản ghi đích. Đối soát theo quy tắc từng bảng/quan hệ/field.

### 12.2. Integration trên DB thật, cô lập

1. Một Store đi hết export → plan → apply → verify.
2. Chạy lại cùng artifact không tạo duplicate.
3. Một/danh sách/range/all chọn đúng nguồn.
4. Dừng giữa chừng và resume.
5. Lỗi sau commit nhưng trước khi terminal nhận kết quả.
6. Hai runner cùng Store bị khóa đúng.
7. Trùng email/slug/SKU trên target có dữ liệu.
8. Artifact đổi sau preflight bị từ chối.
9. Target đổi sau preflight được phát hiện.
10. Rollback không ảnh hưởng dữ liệu không thuộc run.
11. Không phát sinh notification/SEO/payment ngoài dự kiến.
12. Đọc lại DB và so với preview, bao gồm quan hệ/mảng con/timestamp.
13. Source đổi nhưng target chưa đổi → SOURCE_CHANGED; tuyệt đối không skip.
14. Target bị xóa ngoài runner → TARGET_MISSING; rollback hợp lệ rồi reimport dùng generation mới.
15. Sửa manifest/policy/selector/importer hoặc dùng receipt của plan khác → từ chối apply.
16. Resume sau commit nhận đúng tiến độ do run tạo, vẫn phát hiện sửa ngoài run.
17. Với production gate G3: dừng sau commit một phần và thử admin/storefront/API/worker; Store chưa được sử dụng.
18. Artifact cuối có blocker mới → dừng trước production apply, không tái dùng receipt rehearsal.

Test mới phải theo `docs/TEST_CONVENTION.md` và QA TC-ID của F42; cập nhật test matrix cần thiết trước khi triển khai. CLI được kiểm thử bằng integration; browser test dành cho hành vi nhìn thấy trên admin/storefront.

### 12.3. QA chức năng trên Store đại diện

- Store đơn giản.
- Store nhiều SKU/variant.
- Store nhiều Order/Customer.
- Store có staff và quyền khác owner.
- Store có dữ liệu lỗi/quarantine.
- Store lớn nhất.

Kiểm tra admin/storefront, giá/tồn kho, lịch sử đơn, địa chỉ, media, tenant isolation, đăng nhập và entitlement trong scope. Không coi JSON parse thành công là ứng dụng hoạt động đúng.

### 12.4. Hiệu năng

Ngày 1 đo dung lượng artifact, RAM, số bản ghi mỗi Store và thời gian export/validate. Sau G1, ngày 2 mới đo thời gian ghi từng collection, latency DB, retry và verify. Ước tính tổng thời gian từ các Store đại diện, đặc biệt Store lớn nhất; dành thời gian dự phòng cho verify và sửa lỗi.

## 13. Lịch hai ngày với gate tuần tự

### Ngày 1 — Chỉ exporter, dữ liệu và nghiệm thu G1

| Giờ | Dev A | Dev B | QA/N |
|---|---|---|---|
| 09:00–10:00 | Kiểm kê CSV/snapshot/quy mô | Rà runner và lập inventory writer, chưa viết importer | Chốt scope đề xuất §7, owner và gap |
| 10:00–12:00 | Loader, Store discovery | Hỗ trợ mapper/export và raw preservation | Chuẩn bị đối soát field và Store đại diện |
| 13:00–15:00 | Mapping toàn Store | Validate artifact, report; chuẩn bị DB cô lập/test case | So nguồn → master, ghi lỗi |
| 15:00–17:00 | Sửa lỗi, xuất toàn bộ | Kiểm tra tính ổn định, hash, manifest và dependencies | Nghiệm thu G1 hoặc liệt kê blocker |

**G1 đạt khi:** master toàn bộ phạm vi tái tạo từ CSV; đủ disposition; chính sách 20 collection và field ghi được chốt; blocker dữ liệu trong scope đã xử lý; QA lưu hash/version và người nghiệm thu. Chấp nhận artifact có gap ngoài scope chỉ khi N đã chấp nhận rõ các gap đó.

Trước G1 chỉ khảo sát runner, chuẩn bị môi trường/test case và làm exporter/validator. Không viết bộ nạp DB mới hoặc migrate thử bằng importer mới. G1 chưa đạt → ngày 2 tiếp tục sửa artifact; không nén phần QA hoặc âm thầm viết importer song song để giữ lịch.

### Ngày 2 — Importer sau G1 và nghiệm thu G2

| Giờ | Dev A | Dev B | QA/N |
|---|---|---|---|
| 09:00–11:00 | Writer các collection đã phân công | Plan/receipt, crosswalk, writer nền tảng và tracking | Kiểm tra preview so với dữ liệu G1 |
| 11:00–12:00 | Một Store end-to-end, sửa lỗi | Verify, đo thời gian và checkpoint | Đối soát master → preview → DB |
| 13:00–15:00 | Hoàn thiện writer trong scope | Replay/resume/rollback/lock và failure tests | Test integration bắt buộc §12.2 |
| 15:00–17:00 | Rehearsal phạm vi đủ điều kiện | Report kết quả và dự báo cutover | QA chức năng, nghiệm thu G2 hoặc báo chưa đạt |

**G2 đạt khi:** tất cả writer trong scope được test; plan/receipt hoạt động; replay/resume/rollback đạt; toàn bộ Store được chọn đã có kết quả verified hoặc blocker minh bạch; chỉ gọi rehearsal hoàn tất nếu mọi Store thuộc scope đã đạt. Store lớn nhất phải có số đo.

Lịch này là timebox có điều kiện, không bảo đảm hoàn thành mọi writer trong tám giờ. Trước bắt đầu ngày 2, đối chiếu inventory writer với năng lực hai dev. Nếu vượt: kéo dài lịch hoặc đề xuất scope mới cho N, cập nhật policy/master và nghiệm thu lại G1. Không tự bỏ test bắt buộc.

Không có canary production mặc định trong lịch này. Nếu cần hoàn tất production trong hai ngày, chỉ lập lại lịch sau khi biết thời gian G1/G2, đóng G3 và có ngân sách cutover §14.

### Phân công quyết định

| Quyết định | Người phải được chỉ định |
|---|---|
| Scope 20 collection và gap | N — người phụ trách dữ liệu/nghiệp vụ |
| Contract/writer/transaction | Tech lead hoặc B |
| Nghiệm thu G1 và G2 | QA, cùng N cho các ngoại lệ dữ liệu |
| DB cô lập, target, backup/restore | Người vận hành |
| G3 và mở Store production | Người phụ trách vận hành/sản phẩm |

Một người có thể kiêm vai trò nhưng cần ghi tên trước khi khóa scope. Nếu một dev, ưu tiên G1; ước lượng lại ngày 2 thay vì cam kết nguyên lịch hai dev.

## 14. Cửa sổ snapshot cuối và cutover production

### 14.1. Điều kiện trước khi bắt đầu bảo trì

- G1/G2 đạt, G3 cô lập production đã test; đóng các gap cần cho activation, kể cả gap ngoài baseline rehearsal.
- Chọn danh sách Store; xác định mọi đường ghi PW1 cần dừng, gồm UI/API/job/webhook trong phạm vi.
- Có backup đích và restore rehearsal, người trực, thời điểm phải hủy cutover.
- Production chưa có dữ liệu từ artifact rehearsal; nếu có, xử lý theo §9.3 trước.
- Đã đo export/validate/plan/apply/verify và thời gian mở lại PW1 khi hủy. Không điền số giờ giả khi chưa đo.

### 14.2. Ngân sách thời gian phải ghi trong runbook

```text
T_bảo_trì = T_dừng_ghi + T_export_cuối + T_map_validate
+ T_QA_diff + T_plan_duyệt + T_apply + T_verify_UI
+ T_mở_traffic + T_dự_phòng_phục_hồi
```

Mỗi thành phần phải có số đo hoặc ước lượng dựa trên rehearsal, owner và hạn chót. Người vận hành chỉ bắt đầu nếu toàn bộ ngân sách nằm trong cửa sổ được chấp nhận. Hết thời gian dự phòng không được tiếp tục apply với hy vọng kịp.

### 14.3. Các bước và gate artifact cuối

| Bước | Công việc | Điều kiện đi tiếp |
|---|---|---|
| 1 | Dừng ghi PW1 và xác minh job/webhook | Không còn đường tạo dữ liệu mới trong scope |
| 2 | Xuất snapshot cuối nhất quán | Manifest nguồn đầy đủ, không trộn snapshot |
| 3 | Export master cuối bằng mapper đã khóa | Hash mới, validation toàn bộ đạt |
| 4 — G4 | QA diff so với rehearsal, kiểm tra blocker/quarantine mới | Artifact cuối và scope được nghiệm thu; receipt rehearsal không có hiệu lực cho hash mới |
| 5 | Plan với DB production, kiểm tra baseline dưới scope đã chọn | Plan/preview cuối được kiểm duyệt đúng target |
| 6 | Apply canary từ chính plan cuối, verify | Store tiếp tục bị gate; đạt mới chạy phần còn lại theo policy |
| 7 | Apply phần còn lại, verify dữ liệu và chức năng | Tất cả Store dự kiến mở đã đạt, đủ login/quyền/nội dung |
| 8 | Mở Store/traffic từng phạm vi đã đạt | Ghi thời điểm mở; giữ PW1 chỉ đọc để đối soát |

Canary phải là bước đầu được khai báo trong plan cuối, cùng artifact và target; tiến độ đi qua ledger/resume. Không import canary bằng snapshot cũ rồi kỳ vọng create-only tự cập nhật khi master cuối đổi.

Blocker mới tại G4 → dừng trước business write. Nếu còn đủ cửa sổ thì sửa, sinh artifact mới và QA/plan lại; nếu không, hủy cutover, xác minh PW2 chưa mở rồi mở lại PW1. Nếu đã ghi một phần PW2 nhưng chưa mở, giữ gate, xác định rollback hoặc bảo lưu để xử lý; snapshot PW1 tiếp theo sẽ làm plan cũ stale.

Sau khi PW2 nhận ghi mới, không tự restore DB hoặc mở lại PW1: cần đối soát thay đổi mới để tránh mất dữ liệu. Delta migration/CDC chưa nằm trong bản đầu; nếu không thể dừng ghi PW1 phải mở scope và ước lượng lại.

## 15. Rủi ro và cách xử lý

| Rủi ro | Dấu hiệu | Cách xử lý |
|---|---|---|
| Mapping nghiên cứu bị coi là import-ready | Raw/field chưa có schema được gửi vào Payload | Preview allowlist, blocker theo field/collection |
| CSV không cùng snapshot | Quan hệ thiếu, số lượng lệch | Chốt bộ snapshot nhất quán |
| Mất dữ liệu sau snapshot | PW1 còn ghi mới | Maintenance/final export hoặc mở scope delta |
| Trùng xuyên run | Run mới tạo Tenant/Product mới | Crosswalk ổn định, unique xuyên run |
| Hook làm đổi dữ liệu lịch sử | Notification, SEO, snapshot tự sửa | Context nội bộ và test tác động phụ |
| Store dở bị truy cập | Chỉ có nhãn pending | Rehearsal bắt buộc DB riêng; production bắt buộc G3 |
| User/role gộp sai | Email trùng, actor bị coi là owner | Chặn conflict, quyết định identity/membership |
| Media không hoạt động | URL bị đổi, không có ownership | Thử đường ghi/đọc thực tế, đóng gap trước mở Store |
| Deadline vượt | Store lớn, mapper thiếu | Đo ngày 1, giảm scope có công bố hoặc dời cutover |
| Rollback xóa dữ liệu live | Xóa theo tenant, không kiểm hash | Ledger ownership, kiểm thay đổi và reverse dependency |
| QA không khớp bản đã chạy | Artifact/importer đổi | Hash + version + selector + target binding |

## 16. Những phần hoãn và những phần bắt buộc

### Hoãn trong đợt đầu

- Dashboard tracking riêng.
- Chạy nhiều worker.
- Đồng bộ hai chiều hoặc CDC.
- Tự merge User theo email.
- Tự sửa mọi dữ liệu lỗi.
- Importer tổng quát cho mọi schema.
- Tải/chuyển media khi contract đang chọn URL ngoài.
- Converter toàn bộ Page/component khi chưa có mapping.
- Overwrite dữ liệu production theo mặc định.

### Không cắt để chạy nhanh

- Validate artifact và target.
- Đối soát tenant/quan hệ/đơn vị tiền.
- Chống duplicate xuyên run.
- Kiểm soát hook.
- Ledger bền vững, checkpoint và resume.
- Kiểm thử phục hồi.
- Verify DB và công bố gap.

## 17. Checklist nghiệm thu

- [ ] Một lệnh tạo master từ CSV, không vá tay.
- [ ] Toàn bộ Store được kiểm kê; Store không xuất có lý do.
- [ ] Root JSON đúng mẫu, không hardcode 205/285.
- [ ] Mọi phần không map có disposition và nguồn lưu giữ kiểm chứng được.
- [ ] Team thấy chính xác dữ liệu logic sẽ ghi DB.
- [ ] Artifact đã QA được xác định bằng hash/version/scope.
- [ ] CLI chọn đúng một/danh sách/range/all.
- [ ] Chạy lại không tạo duplicate xuyên run.
- [ ] Resume đúng khi process dừng giữa chừng.
- [ ] Mất terminal không mất tracking.
- [ ] Không có tác động nghiệp vụ ngoài dự kiến.
- [ ] DB khớp preview sau chuẩn hóa ID/field hệ thống đã khai báo.
- [ ] Quyền và chức năng trong scope đã kiểm tra.
- [ ] Có báo cáo phần chưa chuyển; không gộp vào thành công đầy đủ.
- [ ] Có backup/rehearsal phục hồi trước production.
- [ ] Có phương án dữ liệu phát sinh sau snapshot.
- [ ] Có đủ thời gian vận hành dựa trên số đo thực tế.
- [ ] Source đổi/target đổi/target mất được xử lý theo §9.3, không skip sai.
- [ ] Rollback giữ tombstone và reimport có generation mới.
- [ ] Apply chỉ dùng plan đã có receipt đúng hash, scope và target.
- [ ] Scope 20 collection có người chốt; không tự hoãn dependency bắt buộc.
- [ ] G1 đạt trước khi viết importer; G2 chỉ xác nhận rehearsal.
- [ ] G3 đạt trước production; G4 kiểm duyệt artifact cuối trước ghi.
- [ ] Cửa sổ cutover gồm export, QA lại, apply, verify và dự phòng.

## 18. Câu hỏi còn mở và bước tiếp theo

### Cần chốt

1. Có chấp nhận mục tiêu lập lịch G1 + G2 trong hai ngày? Nếu bắt buộc production, cần mở lại ước lượng sau đo và đóng G3/G4.
2. Có bao nhiêu dev/QA; bao nhiêu Store; tổng CSV và Store lớn nhất bao nhiêu dữ liệu?
3. DB PW2 đích đã có dữ liệu thật không? Có Store từng migrate trước đó không?
4. Các phần chưa chốt như Page/block, Blog, Media, quyền User và entitlement có được hoãn không?
5. Có thể dừng ghi PW1 bao lâu; chuyển theo Store hay toàn hệ thống?
6. Ai chốt gap, artifact QA và thời điểm mở traffic?

### Thứ tự thực hiện sau khi thiết kế được chấp nhận

1. Khóa phạm vi và giả định; chọn nhánh/worktree triển khai cụ thể.
2. Chuyển report thành task/phase có owner và tiêu chí nghiệm thu.
3. Làm CSV → master + report trước.
4. Chỉ sau G1 mới viết importer; QA preview/rehearsal để đạt G2. Nếu master đổi, quay lại nghiệm thu dữ liệu bị ảnh hưởng.
5. Rehearsal toàn bộ, đo thời gian và kiểm thử phục hồi.
6. Quyết định production dựa trên evidence, không chỉ theo thời hạn.

**Khuyến nghị cuối:** chọn pipeline hai bước, một master đã kiểm duyệt, importer theo collection, chạy tuần tự theo Store và tracking trong DB. Mục tiêu hai ngày cần được ràng buộc bằng scope, nhân lực và kết quả đo ngày đầu; không dùng việc JSON đã xuất được để thay cho bằng chứng migration thành công.
