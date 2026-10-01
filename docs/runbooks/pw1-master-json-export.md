# Xuất JSON master từ CSV PW1

> **Trạng thái mới nhất 23/09/2026:** exporter/importer local contract 1.10.0. Xem [triển khai và kết quả kiểm chứng](../migration/pw1-conflict-implementation-20260923.md). Các checkpoint 1.8.x và số Store bên dưới là lịch sử.

## Lệnh ngắn — tạo config và export trong một lần

```sh
npm run migrate:pw1 -- /path/to/csv --as-of 2026-09-18T00:00:00Z
```

Thay đường dẫn và mốc đối soát theo snapshot thực tế. Chạy từ root repo.
Script dùng `configs/migration/pw1-prod-profile.json`, tạo snapshot ID riêng cho lần
chạy và lưu `source-config.json` cùng `artifact/` trong `.migration/runs/<run-id>/`.
Mốc asOf không được suy từ tên CSV. Profile mặc định dùng UTC, domain đích dev và
policy production đã chốt; dữ liệu nguồn khác cần `--profile <file>` phù hợp.
Có thể thêm `--snapshot-id <id>` để giữ định danh snapshot ổn định khi chạy lại,
hoặc `--output-dir <new-run-directory>` (thư mục cha có sẵn). Không ghi đè lần cũ.
Nếu export thất bại, thư mục lần chạy/config có thể còn để kiểm tra; không coi là
artifact hoàn tất. Lệnh này chỉ export offline, không nhập DB.

Lệnh cũng tạo `import-config.json` cạnh `source-config.json`. Nó đọc `DATABASE_URI`
từ môi trường hoặc `.env.local`, tự lấy tên database và, nếu là Neon, hostname để
file import dùng được ngay. Ví dụ khi `.env.local` chứa URL PW2 Neon:

```sh
npm run migrate:pw1 -- /path/to/csv --as-of 2026-09-18T00:00:00Z
```

URL và password chỉ lưu trong `.env.local`, không ghi vào `import-config.json`.
Nếu không có `DATABASE_URI`, file tự sinh mặc định cho DB local `primeweb`.
Có thể truyền `--target-database` và `--target-host` khi export offline; nếu URI
đã có thì các giá trị này phải khớp URI. URI trỏ tới host không phải local/Neon
sẽ bị từ chối trước khi export để tránh tạo config sai đích. Export chỉ đọc URI,
không thử kết nối DB; importer sẽ đối chiếu lại trước khi chạy. Kiểm tra thêm
`systemCreator.sourceRef` trong file tự sinh có đúng actor của snapshot.


## Đọc master được chia theo Store từ 1.10.0

Lệnh export giữ nguyên. Trong `artifact/`, đọc `master-manifest.json` để lấy danh sách `masterParts`; dữ liệu nằm ở `master-0001.json`, `master-0002.json`, ... theo thứ tự Store ID số. Không tạo lại file `master.json` tổng hợp.

- Mỗi file tối đa **300 Store** và **nhỏ hơn 200.000.000 byte UTF-8**, tính cả định dạng JSON. Một Store luôn nằm trọn trong một file.
- Manifest ghi `filename`, `sha256`, `bytes`, `storeIds` cho từng phần; `masterSetHash` định danh toàn bộ tập đã sắp thứ tự. Các báo cáo/receipt dùng chung vẫn nằm cùng thư mục.
- Nếu không Store nào được xuất, `masterParts=[]`; không tạo file phần rỗng. Đây không tự chứng minh mapping đã đầy đủ.
- Nếu riêng một Store quá lớn, export dừng với `MASTER_STORE_TOO_LARGE:<StoreID>` và không publish artifact dở hoặc quá giới hạn.
- Importer tương thích 1.10.0 đọc manifest và lần lượt các phần; không tự nối file bằng tay. Giữ nguyên toàn bộ thư mục artifact để import/validate, không chỉ sao chép một phần.

Validator vẫn dùng lệnh hiện tại với `--artifact-dir`, kiểm tra đủ phần, hash/byte thực tế, ID/thứ tự Store, không trùng/thiếu phần và không có `master.json` tổng hợp lẫn trong bộ mới. Artifact lịch sử đến 1.9.4 vẫn dùng `master.json` như trước.

## Phạm vi hiện tại

Lệnh `npm run migrate:pw1:export` đọc CSV trực tiếp, tạo master JSON và báo cáo để review. Chạy offline, không bootstrap Payload, không ghi DB và không tải ảnh. `npm run migrate:pw1` là lệnh gọn để tạo config và export, không nhập DB.

**Exporter 1.5 tách thành công export khỏi mức đầy đủ dữ liệu.** Lệnh thành công trả `0` và `status=exported`; đọc `outcome.dataStatus` và `export-review.md` để biết phần còn thiếu. `importStatus=not_verified` không chứng nhận sẵn sàng ghi DB. Các checkpoint 1.0–1.4 bên dưới giữ nguyên exit/status lịch sử.

Contract: [pw1-master-export-contract.md](../migration/pw1-master-export-contract.md). Quy tắc nghiệp vụ: [master đã pin](../migration/pw1-pw2-master-field-mapping.md).

## CSV của ngày khác — tạo config trước khi export

Dùng profile không gắn ngày `configs/migration/pw1-prod-profile.json`:

```sh
npm run migrate:pw1:config -- \
  --input-dir /absolute/path/to/new-snapshot \
  --profile configs/migration/pw1-prod-profile.json \
  --snapshot-id pw1-20260918-batch1 \
  --as-of 2026-09-18T00:00:00Z \
  --output /absolute/path/to/configs/pw1-20260918.json
```

Thay snapshot/asOf theo bằng chứng của lần export, không lấy mặc định ngày chạy.
Sau đó truyền file vừa tạo vào `migrate:pw1:export --source-config ...` như bình thường.
Lệnh nhận diện đủ 93 bảng từ tên CSV có hậu tố ngày (8/12/14 chữ số), giữ nguyên policy,
và dừng nếu thiếu/trùng bảng, khác ngày hoặc có file CSV không nhận diện được. Không chọn
file mới nhất. Thư mục config cha phải có sẵn và nằm ngoài input; không ghi đè file cũ.
Các file cùng ngày vẫn phải được người vận hành xác nhận cùng snapshot; kiểm tên không
thay thế đối soát nội dung. Snapshot qua nửa đêm cần config chính xác được review riêng.
Xem [hướng dẫn profile](../../configs/migration/README.md#new-csv-export-date).

## Chạy trên máy khác — config đã đưa vào Git

Dùng [configs/migration/pw1-prod-20260916.json](../../configs/migration/pw1-prod-20260916.json) để xuất snapshot `20260916-1351-1353` theo policy đã chốt. Đây là bản giữ nguyên bytes/hash config của artifact `classification-001`; không phải cấu hình tự chọn snapshot mới nhất.

Cài dependencies bằng `npm ci`, chuyển riêng 93 CSV nguồn và tạo thư mục cha output, rồi chạy từ root repo:

```sh
npm run migrate:pw1:export -- \
  --input-dir /absolute/path/to/DB_PROD \
  --source-config configs/migration/pw1-prod-20260916.json \
  --output-dir /absolute/path/to/exports/new-run
```

Không cần DB/server hoặc secret importer. Giữ nguyên UTC/+00:00, mốc `asOf` và policy của snapshot này; suffix đích hiện là domain dev. [Hướng dẫn config](../../configs/migration/README.md) ghi điều kiện RAM/ổ đĩa, validate và quy tắc tạo config cho snapshot khác. Các đường dẫn `.migration/` trong bằng chứng lịch sử bên dưới vẫn là đường dẫn private của những lần chạy trước.

## Follow-up hiện tại — export, validate-only và archive đã kiểm chứng

Contract §21 bổ sung `promoteActiveCategoriesToRoot`, `preserveHistoricalOrders` và `deferredStoreIds`; tất cả cần evidence trong config/manifest. Store 323 dùng VND hoãn toàn Store, không đổi tiền tệ. Bỏ giới hạn ảnh Product/shortDescription ở mapper, form, collection và gallery; SQL mở rộng mô tả và bỏ NOT NULL của orders_items.product_id. Apply/verify migration đích trước import; không chạy DB migration chỉ để tạo master.

Historical Order item giữ tên/variant/số lượng/giá theo order_details, không phụ thuộc SKU còn active. Product relationship có thể vắng khi catalog thiếu/quarantine; ownership nguồn hiện hữu vẫn kiểm tra, trạng thái/refund/tổng tiền vẫn đối soát. Không gọi email/payment/refund/stock side effects từ dữ liệu lịch sử. Optional history notifications/subscribers/contact-submissions/analytics được hoãn riêng qua acceptedExclusions, không gồm lịch sử Order.

252 Product cần nguồn giá hiện hành: 243 không có SKU row, 9 chỉ có deleted SKU; không phải thiếu mã SKU hoặc bị bắt biến thể. [Danh sách private](../../.migration/audits/pw1-prod-20260917-followup/products-no-current-price.csv). Creator đã có pure preflight có kiểm tra provenance/identity/collision; local actor1/51 thiếu tài khoản đích, [kết quả private](../../.migration/audits/pw1-prod-20260917-followup/creator-binding-preflight.json). Không tạo user/cấp role/gửi welcome mail; không tuyên bố creator bound.

Hồ sơ review private: [118 Store](../../.migration/reviews/260917-followup/blocked-stores.md), [70 nhóm Blog slug / 147 bản ghi](../../.migration/reviews/260917-followup/blog-slug-collisions.md), [Order/refund/payment](../../.migration/reviews/260917-followup/order-payment-reconciliation.md). Không đưa source identity/PII của các hồ sơ này vào commit công khai.

Follow-up `.migration/exports/pw1-prod-20260917-followup-001/` export hoàn tất sau 1.112,2 giây, exit 2 needs_review, sourceWarnings rỗng; audit exit 0. Code **410 tests / 29 files pass**, TypeScript pass. Counts: 2.799 emitted + 118 blocked + 1 deferred Store323; 94.929 blocker diagnostics; 28.249 Product, 29.318 Category, 615 Order, 5.528 Blog, 2.122 BlogCategory, 2.839 User.

Đối soát nguồn độc lập PASS: 95/95 Product cần khôi phục đã trở lại, 4.166 Category promote, tăng 459 Product không mất Product cũ. 364 Product có >5 ảnh, 6.848 shortDescription >300 ký tự; 28.249 danh sách ảnh và 27.303 shortDescription có nội dung đều so khớp. Giữ tiền/trạng thái toàn bộ 342 Order trước, thêm 273 Order; đối soát 956 dòng và 260 dòng snapshot không có FK catalog. Bằng chứng: `.migration/audits/pw1-prod-20260917-followup-001-verification.json` và `.migration/reviews/260917-followup/order-followup-verification.json`. Reader Python ban đầu chuẩn hóa newline gây mismatch giả; đã dùng newline='' để so nguyên văn, không đổi exporter hoặc artifact.

Archive `.migration/exports/pw1-prod-20260917-followup-001.tar.gz` kiểm chứng PASS: 168.006.118 bytes, SHA-256 `71dea1b98fe28298dfe6aa6adb906a23320407514f63bae8a421c922b945dbae`; đủ 7 artifact files và manifest khớp. Validate-only độc lập hoàn tất: integrity `valid`, mapping `needs_review`, exit 2. Logs: `.migration/logs/followup001-validate.stdout`, `.migration/logs/followup001-archive-verification.stdout`; archive evidence `.migration/audits/pw1-prod-20260917-followup-001-archive-verification.json`. Không có process runtime còn chạy; chưa ghi DB/import production.

Đối soát Store IDs: 118 blocked không đổi, deferred đúng Store323. Audit cuối còn 252 Product thiếu nguồn giá, 18 Order status, 8 refund, 2 giá âm, 3 geography và 147 Blog collision records; Order SKU unresolved/mô tả vượt cap/ảnh vượt cap đều 0. Manifest/Store summary copies tại `.migration/reviews/260917-followup/followup-master-manifest.json` và `followup-store-summary.csv`. Counts/tests approved-001 dưới đây thuộc artifact lịch sử. Mỗi lần đổi contract/policy phải export thư mục mới, giữ nguyên artifact cũ và hash manifest.

## Baseline implementation approved-001 — 2026-09-17

Phần này thay các checkpoint cũ ghi quyết định chỉ mới được ghi nhận hoặc chưa implement. **385 tests / 27 files pass**, TypeScript pass, code review pass. Export `.migration/exports/pw1-prod-20260917-approved-001` hoàn tất sau **1.026,3 giây**; validate-only độc lập integrity `valid`, mapping `needs_review`, exit 2; audit exit 0. Source files không đổi. Các checkpoint bên dưới vẫn giữ provenance của từng artifact lịch sử.

Approved-001 có 2.800 Store emitted / 118 blocked, 106.623 blocker diagnostics; 27.790 Product, 25.161 Category, 342 Order, 5.655 Blog, 2.131 BlogCategory, 0 email templates. 359 Product gram đã giữ được có weight kg đúng; cả 339 Order cũ giữ fee/totals. 2.840 User được đối soát creator, với 2 actor global dùng cho 2.800 references; 2.800 Site ecommerce. Shipping: 860 fixed, 1.939 PW2 defaults, 1 VND blocker.

**Baseline approved-001 có 95 Product bị loại vì Category active có cha inactive.** Follow-up đã implement promotion được duyệt, nhưng số khôi phục phải lấy từ artifact mới. Có thêm 20 Product nên tổng giảm 75. Riêng 166 Product được giữ với Category rỗng do chính Category nguồn inactive đã được policy loại. Không gộp hai nhóm hoặc coi 95 Product là đã xử lý xong. Creator source đã giữ nhưng target User binding/import chưa thực hiện. Audit nằm tại `.migration/audits/pw1-prod-20260917-approved-001/`; verification và record-deltas JSON cạnh thư mục audit. [Report kết quả](../../plans/reports/260917-pw1-approved-mapping-results.md).

Thêm object `migrationPolicy` vào config nguồn để áp dụng quyết định có evidence. Ví dụ dưới đây dùng Store ID giả; thay bằng ID live thực có trong snapshot và bằng chứng quyết định thực. Bỏ override nếu không có ngoại lệ được xác minh:

```json
{
  "migrationPolicy": {
    "decisionEvidence": "Quyết định migration ngày 2026-09-17: active catalog; giữ tập SKU thực; hoãn email; ecommerce và override; creator chỉ Users; shipping theo PW2",
    "activeCatalogOnly": true,
    "deferEmailTemplates": true,
    "allowSparseVariants": true,
    "preserveUserCreators": true,
    "siteTypeDefault": "ecommerce",
    "siteTypeOverrides": {
      "123": "business"
    },
    "shippingPolicy": "pw2-defaults"
  }
}
```

Policy được lưu trong manifest và ràng buộc bởi hash config. Config không có `migrationPolicy` giữ hành vi policy cũ; chuẩn hóa gram→kg là sửa lỗi đơn vị và áp dụng độc lập. Parser từ chối key sai/enum sai; override cho Store không tồn tại hoặc đã xóa bị từ chối trước mapping. `siteType` không phải trạng thái active, subscription hay công tắc thanh toán.

- `activeCatalogOnly`: chỉ Category/SKU active; giữ Product với `category: []` khi Category inactive được loại có bằng chứng đúng tenant, kèm warning. Category thiếu/sai tenant và parent không resolve vẫn diagnostic; không tự tái cấu trúc Category. Product chỉ có SKU live đúng tenant đều inactive được loại theo policy. Order không được trỏ tới SKU giả.
- `allowSparseVariants`: không yêu cầu đủ mọi tổ hợp; không sinh SKU. Ownership, tier, duplicate tuple, price/stock và giới hạn đích vẫn được kiểm tra.
- `deferEmailTemplates`: không xuất template nguồn; disposition ghi retained-source. Không tắt email runtime PW2.
- `package_weight_type=1` là kg, `2` là gram: chia 1.000 trước ghi Product.weight. Unknown unit không được tự đoán. Không sửa artifact cũ.
- Mô tả nguồn không bị cắt; rich-text editor/renderer ngoài phạm vi. Giới hạn ảnh và `shortDescription` 300 ký tự chưa đổi: overflow vẫn diagnostic và không ghi field đích tùy chọn, không truncate.

### Shipping dùng PW2

Không thay runtime PW2 hoặc port engine nhiều tier PW1. Khi Store chọn self-delivery và có đúng một cấu hình fixed active/configured với provider hợp lệ, MYR và fee trong giới hạn, exporter đổi RM→sen và ghi cùng giá vào `westRate`/`eastRate`; `freeAbove=null`.

`shippingPolicy="pw2-defaults"` dùng **800/1500 sen** cho West/East khi không map fixed tương đương: tier, dynamic, missing, unconfigured, ambiguous hoặc invalid. Ghi `SHIPPING_SOURCE_REPLACED_BY_PW2_DEFAULT` cùng reason; đây là thay bằng cấu hình PW2, không phải bảo toàn phí PW1. `shippingPolicy="review"` giữ `SITE_SHIPPING_RECONFIGURATION_REQUIRED` thay vì ghi default. Currency không phải MYR hoặc chưa xác minh vẫn blocker, không áp default.

Không sao chép credential/kích hoạt courier. `shippingSetupConfirmed=false` không chặn checkout. Mapping không tính lại shippingFee của Order cũ; checkout/retry-payment và provider sau import cần được kiểm chứng riêng theo runtime PW2.

### Creator chỉ Users và sidecar bắt buộc khi có dependency

Nếu creator là User đã emit cùng tenant, `Users.createdBy` giữ reference đó. Nếu là actor global live, nonfrontend, không thuộc Store và chuỗi creator xác minh được, exporter giữ reference và ghi actor một lần vào **`user-actors.json`**. Creator nguồn `0` là sentinel, không phải User ID cần tạo. Actor thiếu, đã xóa, sai tenant hoặc chuỗi không resolve vẫn unresolved.

Sidecar **private**, có name/email, source ID, timestamps/status và role provenance để đối soát; không có password/token/credential, không cấp role PW2 hoặc tenant membership. Root master vẫn là array Store như cũ. Manifest hash sidecar; validate-only kiểm schema/hash/provenance/uniqueness/creator chain và cấm ref trùng document master. Ngoại lệ external chỉ đúng field trực tiếp `users.createdBy`, không mở rộng author hoặc nested/collection khác.

**Sidecar là dependency danh tính nguồn, không phải tài khoản PW2 đã tạo.** Importer phải bind source identity qua crosswalk tới đúng PW2 User ID, giữ creator hệ thống hoặc owner theo nguồn, và ngăn hook ghi đè bằng tài khoản chạy import. Không copy PK số nguồn hoặc tạo membership giả. `TARGET_USER_CREATOR_BINDING_REQUIRED` vẫn chặn target readiness tới khi đối soát đích; export `valid` không xóa yêu cầu này. Giữ sidecar cùng manifest/master, không chỉ chuyển riêng master.json.

## Cập nhật remediation — 2026-09-17

Phần này ghi remediation trước vòng approved-policy ở trên; các checkpoint có ngày/lần chạy bên dưới là lịch sử. Không lấy số record của `completion-004` làm kết quả lần export hiện tại.

- Product, Blog và Blog Category đã có schema/app check unique theo tenant, kèm SQL migration trong `scripts/db-setup.js`. Migration kiểm tra thiếu ownership/slug và trùng cùng tenant, thay index trong transaction, không tự đổi slug hay xóa record. **Chưa triển khai migration trên DB đích.** Export offline vẫn giữ blocker `TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP` và `TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED` cho slug được dùng lại giữa tenant; source hợp lệ không đồng nghĩa target đã sẵn sàng import.
- Blog/Blog Category trùng khác tenant được giữ; trùng cùng tenant vẫn cách ly. Tenant slug và User email vẫn unique toàn hệ thống.
- CSS chỉ khác khoảng trắng không còn bị báo mất fidelity; link điều hướng dùng policy riêng với media URL. Scheme nguy hiểm, credential và cấu trúc chưa xác minh vẫn bị chặn.
- `model_settings` thiếu `store_id` chỉ được resolve nếu discriminator chính xác `App\Models\Store`, `model_id` bằng Store đang map và Store nguồn còn live. Giữ nguyên dữ liệu raw nguồn; ghi contribution `MASTER_RAW_STORE_MODEL_OWNERSHIP` và warning `RAW_OWNERSHIP_RESOLVED_FROM_STORE_MODEL`. `store_id` hiện hữu nhưng sai tenant hoặc quan hệ khác chưa có bằng chứng vẫn bị chặn.
- Diagnostic giữ nguyên code/severity và bổ sung `reason` cho các nhóm raw/catalog được phân rã; không giảm blocker để đạt tiến độ.
- Dashboard sửa Product bỏ field `description` khỏi request nếu nội dung textarea không đổi, nên giữ document rich text cùng link/ảnh/style khi sửa field khác hoặc gõ rồi hoàn tác. **Textarea vẫn là plain text:** nếu thực sự sửa mô tả, dữ liệu được dựng lại từ plain text; đây chưa phải rich-text editor. Xóa mô tả có chủ đích gửi `null`.

Không tự bật Category/SKU inactive, đổi giới hạn ảnh/mô tả hoặc tạo membership cho creator. Các quyết định email/shipping/siteType mới đã được áp dụng theo mục approved-policy ở trên; payment và optional history vẫn cần đối soát/quyết định riêng.

## Chuẩn bị

- Node theo `package.json`, dependencies của repository đã cài.
- Một snapshot CSV UTF-8, được giữ nguyên và lưu ngoài Git.
- Config JSON xác nhận đúng DB nguồn, timezone, domain và chính sách Store deleted.
- Thư mục cha đầu ra đã tồn tại; mỗi lần chạy dùng tên thư mục đầu ra mới, ngoài cây CSV.
- Giữ CSV, credentials và artifact trong vùng riêng tư. Config không chứa secret có thể nằm trong Git; bản production đã rà soát nằm tại `configs/migration/pw1-prod-20260916.json`. Master có dữ liệu cá nhân cần thiết; không đưa vào Git, public bucket hoặc log.

Ví dụ config dưới đây chỉ dùng dữ liệu giả, là **cấu hình inventory tối thiểu**. Export đầy đủ cần chọn đủ bảng thực tế; thiếu bảng sẽ được báo `SOURCE_TABLE_NOT_SELECTED`, không được hiểu thành bảng rỗng.

```json
{
  "version": 1,
  "sourceInstance": "example-source",
  "sourceDatabase": "example-pw1",
  "sourceInstanceToken": "ExamplePW1",
  "snapshotId": "example-snapshot-001",
  "asOf": "2026-09-16T00:00:00+08:00",
  "utcOffset": "+08:00",
  "timezone": "Asia/Kuala_Lumpur",
  "sourcePlatformSuffix": "pw1.example.test",
  "targetPlatformSuffix": "pw2.example.test",
  "deletedStores": "review",
  "readOnlyUserIds": [],
  "acceptedExclusions": [],
  "nullTokens": ["\\N"],
  "tables": {
    "stores": "stores_202609160000.csv",
    "users": "users_202609160000.csv"
  },
  "maxInputBytes": 536870912,
  "maxRecordBytes": 16777216,
  "maxRows": 5000000,
  "maxResidentBytes": 2147483648
}
```

Không sao chép timezone/nullTokens từ ví dụ nếu export PW1 thực tế dùng quy ước khác. `sourceInstanceToken` là token chữ/số ổn định của DB nguồn, giữ nguyên qua các snapshot; không dùng ngày hoặc hash file. `asOf` cố định quyết định đối soát expiry/trial. Khi có cả timezone và offset, script kiểm chúng nhất quán tại timestamp cần chuyển đổi.

`tables` ánh xạ chính xác tên bảng → đường dẫn tương đối bên trong input. Không tự chọn snapshot mới nhất. Không chọn hai file cho cùng bảng hoặc cùng file cho hai bảng. Bảng con/global cần chọn cùng snapshot: identity/roles/domains/payment/subscription; catalog/SKU/EAV/media; customer/address/geo/order/discount; page/component/settings/menu; blog/email. Xem [source registry](../../src/lib/migration/pw1-export/source-registry.ts) và báo cáo inventory để đối chiếu cột thực tế. Bảng ngoài registry vẫn được kiểm kê nhưng tạo review gap.

`deletedStores=exclude` loại Store đã xóa với danh sách riêng trong manifest; `review` giữ chúng trong phạm vi kiểm tra và không tự phục hồi Store. `readOnlyUserIds` chỉ chứa ID User có quyết định chỉ đọc đã xác nhận, không phải danh sách lấy từ email.

## 1. Xem cách dùng

```bash
npm run migrate:pw1:export -- --help
```

Help không cần CSV, config hoặc DB.

## 2. Kiểm kê trước

```bash
npm run migrate:pw1:export -- \
  --inventory-only \
  --input-dir /private/pw1/snapshot-001 \
  --source-config /private/pw1/source-selection.json \
  --output-dir /private/pw1/exports/inventory-001
```

Đầu ra `inventory.json` ghi file, hash, selection, header và số record đã xác minh. Không có `master.json` và không chứng nhận mapping. File không chọn vẫn được kiểm kê/hash; lỗi CSV của snapshot không chọn không được diễn giải là lỗi nguồn đang chọn.

## 3. Xuất toàn bộ Store

```bash
npm run migrate:pw1:export -- \
  --input-dir /private/pw1/snapshot-001 \
  --source-config /private/pw1/source-selection.json \
  --output-dir /private/pw1/exports/master-001
```

Phiên bản này xét toàn bộ Store trong bảng `stores` đã chọn. Chưa có cờ chọn Store/range, resume hay DB import. Store bị chặn không được thay bằng object giả: ID nằm trong `blockedStores`; các document bị cách ly có diagnostic/coverage.

| File | Cách sử dụng |
|---|---|
| `master.json` | Outer array; mỗi phần tử là một Store hợp lệ với đúng 20 collection roots |
| `master-manifest.json` | Hash nguồn/config/contract/artifact, trạng thái, counts, Store bị chặn/loại theo policy |
| `mapping-report.json` | Diagnostic và disposition/contribution theo record/field |
| `mapping-report.csv` | Bảng phẳng để QA lọc các field chưa xử lý; không chứa raw value |
| `README.md` | Ghi chú ngắn cho lần export |
| `user-actors.json` (khi có) | Registry private của creator global; dependency có hash, phải giữ cùng master/manifest và resolve bằng target crosswalk |

## Theo dõi tiến độ

CLI mặc định ghi tiến độ ra **stderr**: thời gian đã chạy, bảng CSV/số dòng, số Store đã xử lý, giai đoạn dựng coverage/validation, dung lượng artifact đang ghi và kiểm tra lại nguồn. Log chỉ chứa metadata, không dump nội dung record. Cùng một giai đoạn được giới hạn khoảng một dòng/giây khi có sự kiện tiến độ; các giai đoạn tính toán đồng bộ dài chỉ báo lúc bắt đầu, không bảo đảm heartbeat mỗi giây.

JSON kết quả cuối giữ trên **stdout**. Thêm `--quiet` để tắt riêng progress; lỗi vẫn ghi stderr. `--help` không phát progress.

```bash
npm run --silent migrate:pw1:export -- \
  --input-dir /home/liam/Documents/DB \
  --source-config .migration/source-selection-review.json \
  --output-dir .migration/exports/pw1-next \
  > .migration/export-result.json 2> .migration/export-progress.log
```

`npm run --silent` bỏ banner npm để file stdout chỉ có JSON kết quả của script. Giữ output directory mới và kiểm tra exit code ngay sau lệnh. Nếu muốn chỉ nhận kết quả cuối trên terminal, thêm `--quiet` vào các tham số exporter.

## 4. Kiểm tra artifact đã xuất

```bash
npm run migrate:pw1:export -- \
  --validate-only \
  --artifact-dir /private/pw1/exports/master-001
```

Validate-only kiểm hash, runtime schema, quan hệ vận hành, counts và nhất quán report/manifest. Không cần CSV hoặc DB; **không chứng nhận nội dung JSON đúng nguồn**. Trả riêng `integrityStatus` và `mappingStatus`.

| Exit | Ý nghĩa |
|---|---|
| `0` | Export/validate 1.5 thành công; dữ liệu vẫn có thể `partial`. Hoặc inventory/legacy complete thành công |
| `2` | Chỉ dành cho validation artifact lịch sử 1.0–1.4 có `needs_review` |
| `1` | CLI/config/input không hợp lệ, lỗi tài nguyên/runtime hoặc artifact kiểm tra thất bại |

Bắt exit code ngay sau lệnh nếu chạy automation. Không chạy importer chỉ vì file JSON tồn tại. Không thay report/manifest để đổi `needs_review` thành `complete`.

## 5. Tạo inventory gap và hồ sơ đối soát

Chạy sau khi có export hoàn tất. Dùng **đúng CSV và đúng config của export đó**, kể cả giới hạn tài nguyên trong config; không dùng config tương đương nhưng khác bytes/hash.

```bash
npm run --silent migrate:pw1:audit -- \
  --input-dir /private/pw1/snapshot-001 \
  --source-config /private/pw1/source-selection.json \
  --artifact-dir /private/pw1/exports/master-001 \
  --output-dir /private/pw1/audits/gaps-001
```

Thư mục cha `/private/pw1/audits` phải tồn tại; `gaps-001` phải là đường dẫn mới. `--help` không cần nguồn; `--quiet` tắt progress. Lệnh chạy offline, không ghi DB, không kích hoạt shipping và không sửa artifact gốc.

| File audit | Nội dung |
|---|---|
| `summary.json` | Số diagnostic theo code/severity/reason, thống kê shipping và disposition từng bảng/field; không chứa giá trị nguồn |
| `reconciliation-cases.csv` | Các blocker theo Store/table/source ID, nguyên nhân và bằng chứng trạng thái/quan hệ giới hạn; không chứa contact/credential |
| `shipping-inventory.json` | Delivery row còn live, provider đã phân loại, trạng thái/configured, phí số và bậc phí theo thứ tự/đơn vị nguồn; luôn `targetReady=false` |
| `report.md` | Hướng dẫn đọc và bảng tổng hợp shipping |

Audit đối chiếu hash config, inventory file nguồn và mapping-report với manifest; kiểm tra lại nguồn/config/report/manifest trước công bố. Đây **không phải full master validation**: vẫn chạy `--validate-only` riêng như bước 4. Audit thành công trả exit `0` ngay cả khi còn blocker; exit `1` là lỗi CLI/input/hash/runtime. Không diễn giải `status=audited` thành nghiệm thu mapping.

Inventory shipping dùng toàn bộ Store/delivery còn live trong nguồn, gồm cả Store bị chặn khi export; vì thế số lượng có thể khác Store emitted. Phí theo bậc giữ thứ tự nguồn: runtime PW1 lấy bậc cuối có `sub_total_from` phù hợp và không dùng upper bound. Đơn vị tiền và tương đương runtime PW2 vẫn cần đối soát. Source ID và cấu hình phí là hồ sơ riêng tư; giữ các file audit trong vùng private, chỉ chia sẻ phần tổng hợp phù hợp.

## Cách QA đọc coverage

- `mapped`: field có contribution sang JSON; có thể nằm trong vùng raw, không đồng nghĩa field vận hành PW2.
- `retained-source`/`deleted-retained-source`: dữ liệu còn trong snapshot ngoài artifact; không đồng nghĩa đã nằm trong master.
- `security-excluded`: field bí mật bị loại khỏi artifact.
- `unresolved`/row `partial`: cần quyết định hoặc bổ sung mapper.
- `coverage.accounted=true`: mọi record đã được kiểm kê, **khác** `mapping.complete=true`.
- `importReady=false`: exporter chưa chứng nhận quyền ghi DB, hooks, runtime hiển thị hoặc khả năng import.

Đối soát số Store qua cả ba tập emitted/blocked/policy-excluded. Kiểm mẫu các Store khác nhau và đối chiếu literal CSV độc lập; không dùng chính mapper để tính expected value. Giữ nguyên CSV/config và manifest để có bằng chứng nguồn.

## Xuất file an toàn và chạy lại

Output được tạo riêng tư (directory `0700`, file `0600` trên POSIX). Writer giữ vùng staging, kiểm tra nội dung/hash và nguồn trước công bố. Đích được giữ chỗ bằng `mkdir` độc quyền để tránh ghi đè; các file đã kiểm tra được chuyển vào đích, manifest ghi cuối là dấu hoàn tất.

Đây là điều chỉnh so với kế hoạch rename nguyên directory: Node không cung cấp thao tác rename thư mục `no-clobber` portable. Lock hợp tác không bảo vệ trước một process không dùng lock. Giữ chỗ đích độc quyền tránh thay một thư mục có sẵn. Trong thời gian công bố có thể nhìn thấy thư mục chưa đủ file; consumer chỉ được dùng sau khi manifest tồn tại và validate-only đạt.

Nếu bị ngắt giữa chừng, thư mục không có manifest là artifact chưa hoàn tất và bị validator từ chối. Script không tự ghi đè/chữa thư mục này. Giữ lại để điều tra và chạy lại với tên output mới. Không sửa CSV khi đang export. Vượt giới hạn tài nguyên phải điều tra/chia partition được thiết kế riêng; không truncate nguồn để vượt kiểm tra.

## Giới hạn cần giải quyết trước nghiệm thu

- Snapshot, timezone, domain và policy của nguồn thật cần người phụ trách xác nhận; chạy thử snapshot tham chiếu không thay xác nhận này.
- Chưa có nguồn xác minh cho ba collection cuối; notification được cách ly. Chỉ loại trừ trong phạm vi có quyết định được ghi rõ như mục dưới; không tự nhận nguồn rỗng.
- Rule còn thiếu, URL chưa xác minh, raw JSON/setting ngoài allowlist, HTML chưa biểu diễn được, email fallback và quan hệ lỗi tạo diagnostic.
- Bảo toàn raw Page không tạo Payload Page blocks hoặc website có thể publish; Blog Lexical chưa chứng nhận renderer storefront.
- Vai trò User theo master pin hiện tại: owner đã xác minh → tenant-owner/owner; User nghiệp vụ non-owner mặc định editor/editor; bằng chứng chỉ đọc qua `readOnlyUserIds` có ưu tiên viewer/viewer. Membership status đối soát riêng; permissions luôn `[]`.
- `acceptedExclusions` chỉ hỗ trợ phạm vi optional history được chốt bên dưới; không miễn lỗi mapper, required refs hoặc Tenant.
- Chưa có disk-backed partition; index dữ liệu vẫn trong RAM dù xuất file có thể ghi theo luồng.
- Chưa có importer, migration ledger, rollback hoặc nghiệm thu toàn nguồn/production trong phạm vi lệnh này.


## Loại trừ optional history có quyết định

Config mặc định `acceptedExclusions: []`. Nếu đã có quyết định giới hạn phạm vi theo master §2.2, có thể ghi từng collection riêng, ví dụ cấu trúc sau (thay evidence bằng tham chiếu quyết định thực):

```json
{
  "acceptedExclusions": [
    {
      "ruleId": "MASTER-2.2-OPTIONAL-HISTORY",
      "collection": "analytics",
      "reason": "Ngoài phạm vi đợt chuyển dữ liệu đã thống nhất",
      "decisionEvidence": "Tham chiếu quyết định được người phụ trách xác nhận"
    }
  ]
}
```

Chỉ chấp nhận `notifications`, `subscribers`, `contact-submissions`, `analytics`, mỗi collection tối đa một mục; `reason` và `decisionEvidence` bắt buộc. Không dùng ví dụ làm bằng chứng phê duyệt thực. Danh sách nằm trong manifest và được ràng buộc bằng hash config. Script chỉ giảm mức diagnostic nguồn chưa xác minh/cách ly tương ứng xuống warning; không miễn thiếu mapper, lỗi nguồn, field unresolved, required refs hoặc Tenant bị chặn. Còn bất kỳ blocker nào khác vẫn trả `2`.

### Cảnh báo snapshot không được chọn

Trước công bố, file input không được chọn thay đổi/biến mất có thể được báo trong `sourceWarnings` của kết quả CLI. Manifest giữ inventory/hash tại lúc kiểm kê ban đầu; không sửa manifest sau khi đã tính hashes. Lưu kết quả CLI cùng bằng chứng lần chạy nếu cần tracking cảnh báo này. File nguồn được chọn hoặc config thay đổi vẫn làm lần export thất bại.


## Checkpoint xử lý dữ liệu thật — 2026-09-16

Người dùng đã cung cấp CSV tại `/home/liam/Documents/DB`. Lần trial-002 xuất 494/1.133 Store, chặn 639 Store, mapping `needs_review`; đây là baseline trước các bản sửa, không phải kết quả phiên bản mới.

Exporter đã đổi phạm vi cách ly Product trùng slug: loại tất cả Product xung đột cùng record phụ thuộc, giữ các phần Store hợp lệ. Không tự sửa slug, chọn Product thắng hoặc bỏ validation unique. Lỗi lifecycle/identity vẫn được kiểm tra riêng. Số Store xuất được tăng không chứng minh collection trong Store đã đầy đủ: QA phải đối soát số record và diagnostic.

Đối soát 238 Store có lỗi lifecycle: 232 main subscription đã kết thúc, 4 còn active, 2 chưa rõ/mất main; 224 owner có expired_at trùng main.ends_at. Bằng chứng này cần giải quyết theo master; không tự đổi trạng thái User/Tenant để vượt kiểm tra.

Master JSON mới escape ký tự Unicode U+2028/U+2029 khi ghi file, giữ nguyên nội dung khi parse. Với artifact cũ, không dùng editor xóa ký tự rồi lưu vì checksum sẽ thay đổi; chạy lại exporter vào output directory mới.

Nguồn CSV đã có và đã chạy thử. Full-source acceptance vẫn pending: phải chạy lại sau bản sửa, validate artifact, đối soát emitted/blocked/excluded và từng collection; snapshot/asOf/timezone/domain của trial chưa phải chứng nhận migration production. Chưa có importer hoặc thay đổi DB.


## Kết quả nguồn DB tham chiếu: pw1-real-review-005

Theo xác nhận của người dùng, đầu ra cần là **JSON master**. Lệnh đã chạy:

```bash
npm run migrate:pw1:export -- \
  --input-dir /home/liam/Documents/DB \
  --source-config .migration/source-selection-review.json \
  --output-dir .migration/exports/pw1-real-review-005
```

Config review đặt `maxResidentBytes` 4 GB; hai lần trước dừng ở giới hạn 2 GB và không publish artifact hoàn tất. Config này vẫn là cấu hình review snapshot. Chạy lại cần output directory mới.

[Master mới](../../.migration/exports/pw1-real-review-005/master.json) có 889/1.133 Store, chặn 244 Store, 52.250 blocker diagnostics, dung lượng 187.297.805 bytes. Validate-only xác nhận integrity `valid`, mapping `needs_review`, exit 2. So với trial-002: Product 9 → 146, Order 4 → 192, Category 2.161 → 19.461, Page 656 → 4.023; phạm vi Store thay đổi nên đây là số tổng artifact, không chứng minh từng record đã đúng mapping.

12.702 Product còn bị cách ly vì slug collision. Diagnostic có sourceId theo Product; không so trực tiếp số này với báo cáo cũ gộp lỗi theo Store. Các Store được emit vẫn có thể thiếu collection/record đang cách ly; chưa đạt nghiệm thu toàn nguồn.


## Nguồn DB_PROD — cấu hình chạy 2026-09-16

Người dùng cung cấp snapshot tại `/home/liam/Documents/DB_PROD`, đồng ý ngày đánh giá mới và giữ target suffix. Config private `.migration/source-selection-prod.json` chọn chính xác 93 file CSV production; inventory đã kiểm kê **922.580 record / 326.894.320 bytes**. Không trộn với snapshot DB tham chiếu ở trên.

| Cấu hình | Giá trị và bằng chứng |
|---|---|
| `sourceInstanceToken` | `PW1PROD`, namespace riêng cho nguồn production |
| `sourcePlatformSuffix` | `web.ecommercehub.unifi.com.my` |
| `targetPlatformSuffix` | `web-v2.dev.ecommercehub.my`, giữ theo yêu cầu người dùng |
| `asOf` | `2026-09-16T00:00:00Z`: diễn giải ngày đã chọn thành đầu ngày UTC để đánh giá lifecycle; không phải khẳng định thời điểm snapshot được chụp |
| `timezone` / `utcOffset` | `UTC` / `+00:00`: env PW1 local được đối chiếu có `APP_TIMEZONE=UTC`; `DB_TIMEZONE` mặc định `+00:00`, không thấy override local |

Bằng chứng timezone trên là cấu hình PW1 local đã đọc, **chưa xác minh cấu hình đang chạy trên production**. Tham số `+08:00` trong nghiên cứu/lần chạy tham chiếu cũ không phải bằng chứng timezone PW1 production; không áp dụng cấu hình DB_PROD này cho mọi nguồn khác.

Lệnh export đang dùng:

```bash
npm run --silent migrate:pw1:export -- \
  --input-dir /home/liam/Documents/DB_PROD \
  --source-config .migration/source-selection-prod.json \
  --output-dir .migration/exports/pw1-prod-20260916-001
```

Export đã hoàn tất sau 1.451 giây (24 phút 11 giây), exit 2: **2.800/2.918 Store emit**, 118 Store blocked, 209.170 blocker diagnostics. Master có 564.865.274 bytes; mapping-report.json có 635.830.680 bytes. Có file được publish không đồng nghĩa đã đủ toàn bộ dữ liệu.

Lần validate-only đầu tiên dừng `ARTIFACT_READ_FAILED`: cách đọc toàn file thành một string vượt giới hạn string khoảng 512 MB của V8. Đây là giới hạn validator, chưa phải bằng chứng JSON sai hay đúng. Reader strict streaming đã được bổ sung; validate-only trên artifact production đã đạt `integrityStatus=valid`, `mappingStatus=needs_review`, exit 2. Reader không ghép toàn file thành một string; vẫn giữ object phục vụ đối soát nên không bảo đảm RAM cố định. Giữ artifact đã xuất để kiểm tra lại, không cần chạy lại mapping chỉ vì lỗi reader. Đây là thao tác xuất JSON offline, chưa nhập DB.


Đối soát Python độc lập trên artifact production: tất cả hash artifact và config khớp; không có Store ID thiếu/trùng/ngoài nguồn trong phân hoạch emitted/blocked; 922.580 record report khớp inventory. Collections hiện có 1.520 Products, 116 Orders, 47.609 Categories, 13.801 Pages, 103.595 Media, 492 Blogs và 8.358 Email templates. Evidence đối soát riêng này nhất quán với kết quả validator đầy đủ đã đạt sau bản sửa reader.


### Kiểm chứng cuối DB_PROD

[Master production](../../.migration/exports/pw1-prod-20260916-001/master.json) đã qua validate-only bằng streaming reader: integrity `valid`, mapping `needs_review`, exit 2. Counts giữ nguyên: 2.918 Store nguồn, 2.800 emit, 118 blocked, 209.170 blocker diagnostics. **198 tests / 14 files pass**, TypeScript pass. Logs kiểm chứng: `/tmp/pw1-prod-validate-final.stdout`, `/tmp/pw1-prod-complete-tests.log`, `/tmp/pw1-prod-complete-typecheck.log`.

Lỗi đọc file lớn đã được xử lý, không cần chạy lại mapping. Mapping acceptance vẫn pending: artifact hợp lệ không có nghĩa tất cả record đã được đưa vào JSON. Không thêm dependencies, không thay schema DB, chưa nhập dữ liệu DB.


## Cập nhật master sau artifact production: Product.slug scoped theo tenant

Master §5.2/§18 đã được đồng bộ, SHA-256 `62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26`:

- Product trùng slug **cùng tenant**: cách ly cả nhóm và record phụ thuộc, mã `PRODUCT_SLUG_COLLISION`.
- Product cùng slug **khác tenant**: giữ Product và Order tham chiếu; ghi blocker `TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP` vì PW2 hiện có global unique constraint cần xử lý trước import. Không rewrite slug.
- Không thay scope Tenant.slug/User.email hoặc Blog slug; không thay schema DB.

Các kết quả `pw1-real-review-005` và `pw1-prod-20260916-001` ở trên được tạo/validate bằng contract trước thay đổi này. Artifact cũ không được sửa lại. Validator pin mới có thể báo `UNSUPPORTED_MAPPING_CONTRACT` với chúng; không đổi hash manifest bằng tay. Chạy export vào thư mục mới để có artifact đúng mapping hiện tại. Chưa ghi nhận lần export toàn production sau thay đổi scope; không dùng số record lịch sử để khẳng định mức khôi phục mới.


### Lookup raw và lần chạy theo scope mới

Lookup raw children/model_settings dùng index lazy theo array nguồn bất biến và exact field/model type/ID, giữ Row references; mỗi lần lấy trả array riêng trước khi sort. Kiểm tra ownership, security allowlist, diagnostics và contributions vẫn chạy theo từng Store/path; không cache document đã map và không bỏ deleted-history theo index. Mục tiêu là giảm quét lặp lại toàn bảng, không đổi quy tắc mapping.

205 tests / 15 files pass và TypeScript pass (`/tmp/pw1-tenant-slug-all-final.log`, `/tmp/pw1-tenant-slug-tsc-final.log`). Lần export `.migration/exports/pw1-prod-20260916-tenant-slug-002` đang chạy với master mới; chưa có số record hoặc kết quả validation cuối tại checkpoint này. Không suy số record khôi phục từ dự tính hoặc artifact cũ.


## Script completion checkpoint — 2026-09-16

Sửa nằm trong script/mapper; không chỉnh CSV nguồn hay master JSON đã xuất. Registry raw mới phục hồi các cấu trúc UI có bằng chứng PW1: banner typography/button modes, menu cart/search config, page article-date config, checkout/receiver settings, theme/typography constants và `MenuLine` keys `items.N.{id,position,url,size,type,image,signature}`. Các chuỗi được giữ nguyên; scope bảng/cột và discriminator MenuLine được kiểm tra. Nguồn: `FrontendTemplate.php`, `EloquentMenuLineRepository::save`, Header/MenuController, migrations `2021_08_12_083607`, `2021_10_21_032723`, `2022_10_12_062304`, `2025_05_27_042542` của PW1.

Không chấp nhận mọi JSON tùy ý: khóa lạ, URL không an toàn và thông tin bí mật vẫn bị loại. `model_settings.store_id` thiếu/mismatch vẫn bị chặn theo master §4 ownership; không suy ownership từ created_by. Các khóa UI `items.N.idEdit/srcUpload` chưa có bằng chứng schema được giữ là unresolved. Raw được bảo toàn không đồng nghĩa đã chuyển thành block vận hành PW2.

TC-F42-EXP-012/013: 15 focused tests pass (raw/content), gồm scope cấu trúc, dotted keys, unknown/secret rejection và ownership. Full suite và export production mới đang được kiểm chứng; chưa dùng số liệu cũ để khẳng định khôi phục đầy đủ. Mapping acceptance vẫn pending cho đến khi xử lý các gap thực sự.


### Completion iteration — validation and production retry

Full **214 tests / 16 files PASS**, TypeScript PASS; review clean. Script changes preserve source-backed raw UI as described above. Product `featured_description` exceeding the optional PW2 300-character shortDescription limit now quarantines that field instead of rejecting an otherwise valid Product; safe raw source remains independently guarded, never silently truncated. `store-summary.json` and `store-summary.csv` are generated by the exporter and covered by artifact validation. They distinguish blocked/emitted/excluded Store, mapping-review codes, target-constraint codes and remaining blockers, with collection counts in JSON. Classification does not downgrade severity and `emitted` does not mean import-ready.

Production `completion-003` failed `RESOURCE_MEMORY_LIMIT` while writing master (~711 MiB written, peak RSS 4,196,236 KiB); no artifact was published. The retry uses private `.migration/source-selection-prod-completion.json`, copied from the original config with only `maxResidentBytes` increased to 6 GiB. Original config/source/master files remain unchanged. Retry artifact directory: `.migration/exports/pw1-prod-20260916-completion-004`; logs `/tmp/pw1-completion004-export.*`. At this checkpoint production counts and final artifact validation are pending; no full-source acceptance or plan phase is marked complete.


Creator provenance: khi `created_by` resolve tới User đủ điều kiện đã emit, script ghi `createdBy` và contribution nguồn `users.created_by` theo rule `MASTER-3.4-CREATOR`. Nếu không resolve được thì vẫn ghi `USER_CREATOR_UNRESOLVED`; không tự tạo actor/membership hoặc coi nguồn creator đã được map thành công.


### Production completion-004 — published và validator đạt

Export từ CSV hoàn tất trong **816,6 giây (13 phút 37 giây)**, peak RSS 4.250.412 KiB, exit 2 (`needs_review`). Artifact: `.migration/exports/pw1-prod-20260916-completion-004/master.json`, **902.507.082 bytes**. Đối soát độc lập xác nhận hash artifact/source/config đều khớp; 2.918 Store nguồn = 2.800 emitted + 118 blocked, không ID trùng/thiếu/ngoài nguồn. Report có 922.580 dòng nguồn khớp inventory. Validate-only đầy đủ đã đạt `integrityStatus=valid`, `mappingStatus=needs_review`, exit 2. Log: `/tmp/pw1-completion004-validate.stdout`.

So với tenant-slug-002: Product **21.290 → 27.865 (+6.575)**; Order **242 → 339 (+97)**. Tổng blocker **209.044 → 147.717**; RAW_VALUE_UNVERIFIED **94.934 → 27.154 (-67.780)**. Target Product slug gap tăng **19.770 → 26.316** vì thêm Product được giữ lại và phải đối soát constraint PW2; không phải Store mới bị chặn. Product SKU collision thêm 4, Order SKU unresolved giảm 97. Số diagnostic không phải số record mất.

`store-summary.json/csv` được script tạo tự động. 118 Store vẫn blocked theo quy tắc nguồn/master; Store emitted vẫn có mapping gap. Audit/comparison: `.migration/audits/pw1-prod-20260916-completion-004/{summary,comparison}.json`. Full 214 tests / 16 files và typecheck pass; full-source acceptance vẫn pending.


### Final completion-004 validation

Validate-only hoàn tất: **integrityStatus=valid**, **mappingStatus=needs_review**, exit **2**; 2.918 Store nguồn, 2.800 emitted, 118 blocked, 147.717 blocker diagnostics. Evidence: `/tmp/pw1-completion004-validate.stdout`. Kết quả này thay các checkpoint chờ export/validator completion-004 ở trên; không thay lịch sử completion-003 thất bại. Full-source mapping acceptance vẫn pending vì còn gap thực sự; không chỉnh source/master JSON hay nhập DB.


## Exporter 1.1.0 — consolidated mapping and reconciliation receipts

Contract pin: `27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567`. New exports require `customer-reconciliation.json` and `product-reconciliation.json`, hashed in the manifest. Validate-only verifies strict schemas, snapshot identity, tenant ownership and emitted target paths. Null target refs are not importable crosswalks. Customer archive values remain in external manifest-hashed CSV files; retainedSourceRows is an ID inventory, not embedded raw archive.

Missing SKU codes with an eligible source price row no longer reject draft Products. Variant codes support up to100 characters; configured base codes retain the50-character limit. Missing price rows remain blocked. The known1.0.0/followup contract retains its original validation schema. Do not edit an old manifest to upgrade an artifact.

417 tests/31files PASS and TypeScript PASS. No full production export was run for this version yet; followup-001 counts above remain historical. [Detailed handoff](../migration/pw1-exporter-alignment-tracking.md); [Store decisions](../migration/pw1-store-issues-tracking.md).

### Exporter 1.2.0 — Store-scoped source classification

New exports include `classificationVersion: source-classification-v1`. Each report row records verified Store ownership via a direct Store ID or a known parent relation. Source-field blockers are scoped to that Store; missing/ambiguous parents remain global blockers. `fieldRetentionRules` records why a known unmapped field remains in the externally retained CSV snapshot. It does not mean the value was imported into PW2.

The current master contract hash remains `27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567`. Customer/Product reconciliation receipts remain required. Exporter validation accepts the known 1.1 contract and legacy 1.0 contract as before, but new 1.2 artifacts require classification evidence.

The importer in `/home/liam/data/ech-prime-web-v2` currently pins an older exporter contract. Confirm explicit importer support before prepare/apply; do not rewrite artifact versions or hashes to make validation pass. Track remaining issues in `docs/migration/pw1-exporter-alignment-tracking.md`.

## Đọc kết quả exporter 1.5

Mở `export-review.md` trước, thay vì mở master hoặc report nhiều GB. `export-review.json` chứa cùng phân nhóm ở dạng máy đọc, có ví dụ Store/source ID. Cả hai được manifest ghi hash và validator kiểm tra lại từ diagnostics.

- `outcome.exportStatus=succeeded`: đã xuất artifact hợp lệ.
- `outcome.dataStatus=partial`: còn diagnostics dữ liệu hoặc Store chưa xuất. `complete` chỉ nói phạm vi dữ liệu, chưa chứng nhận DB đích.
- `outcome.importStatus=not_verified`: importer còn phải kiểm tra điều kiện chạy và DB đích.
- `data_issue`: mapping/record cần đối soát; xem mã, table/field, reason và ví dụ cụ thể.
- `import_requirement`: creator binding hoặc tenant index; không yêu cầu người dùng quyết định lại.
- `delegated_content`: khác biệt định dạng rich text đã giao xử lý riêng. URL unsafe/missing media không được tự miễn kiểm tra.
- `outside_scope`: Pages hoặc raw có bằng chứng chỉ nằm trong CSV; không xóa diagnostics.
- `warning`: thông tin/policy đã áp dụng.

`mapping.complete` và `counts.blockers` giữ cách tính severity thô để đối soát lịch sử; không dùng chúng thay cho outcome mới. `store-summary` dùng dataStatus complete/partial theo Store, nhưng global diagnostics vẫn phải xem trong export-review. `exportStatus` ngoài cùng của mỗi Store vẫn là emitted/blocked/excluded. Các số nhóm là diagnostics, không phải số record mất và không cộng số Store giữa nhóm vì có giao nhau.

## Outcome correction 1.5.1 — 2026-09-18

Artifact hiện tại: `.migration/runs/pw1-outcome-fix-20260918/artifact`. Master và CSV nguồn không đổi. Diagnostics thuộc Store bị loại theo policy nằm trong `policy_excluded`; warning có gate payment/subscription được tính vào `import_requirement`. Publication thành công không có nghĩa mọi Store import được: summary từng Store giữ đúng `emitted`/`blocked`/`excluded` ở cả trạng thái ngoài và outcome bên trong. Artifact 1.5.0 vẫn được kiểm tra bằng contract cũ. Xem `docs/migration/pw1-export-outcome-tracking-20260918.md` để theo dõi kết quả sửa và kiểm chứng.

## Báo cáo bàn giao theo Store

Lệnh `npm run migrate:pw1 -- <csv-dir> --as-of <timestamp>` tạo thêm `handoff.json` cạnh `source-config.json`, ngoài `artifact/`. Cuối lệnh hiển thị số Store theo nhóm và đường dẫn báo cáo. Lệnh thấp hơn `migrate:pw1:export` trả cùng dữ liệu ở trường `handoff` của JSON stdout. Không đổi manifest/contract 1.5.1 hoặc dữ liệu master; importer vẫn dùng artifact như trước.

- `source_blocked`: Store chưa xuất hoặc còn diagnostic lỗi nguồn; xem `issues` để lấy code, table, field, reason, số lượng và tối đa 5 source IDs mẫu.
- `global_review_required`: không thấy lỗi riêng Store nhưng còn diagnostic chưa xác định phạm vi; xem `globalIssues`. Không khẳng định lỗi đó thuộc mọi Store.
- `importer_verification_required`: còn yêu cầu importer hoặc warning cần xác minh theo policy. Không mặc định warning được phép bỏ qua.
- `source_diagnostics_clear`: không còn diagnostic cần xử lý trong báo cáo; chưa chứng nhận classification/coverage hoặc import-ready.
- `excluded`: Store đã loại theo policy.

Mỗi Store còn có `globalReviewRequired`, kể cả khi ưu tiên trạng thái `source_blocked`. Counts đếm Store theo trạng thái ưu tiên, không đếm diagnostics. Báo cáo phục vụ bàn giao, không là bằng chứng để bỏ gate importer; importer vẫn kiểm tra nguồn, policy, credentials/binding và DB đích. Exit 0 chỉ xác nhận xuất artifact thành công. Artifact cũ không tự có báo cáo mới; lần export tiếp theo tạo báo cáo này.

## Cập nhật xử lý description Product — 1.6.0

Đã sửa code để giữ nguyên description/description_ms trong Lexical text, không lọc nội dung hoặc trích media. Số liệu conflict của artifact 1.5.1 ở trên là lịch sử; chưa export lại để cập nhật số lượng. Xem [tracking description](../migration/pw1-product-description-preservation-20260918.md).


## Checkpoint 1.7.0 — trước policy bỏ Product 1.8.0

Các mục 1.0–1.6 phía trên là checkpoint lịch sử, không phải version hiện tại. Exporter hiện tại giữ trạng thái Product/Blog nguồn, loại sites.pw1_source khỏi master (CSV nguồn vẫn giữ), giữ nguyên description Product và content chính Blog trong Lexical text, fallback tác giả Blog về owner cùng tenant khi cần, và khôi phục định nghĩa option từ selection nguồn hợp lệ. Không tạo SKU hoặc bổ sung tổ hợp thiếu.

Product thiếu giá/stock bị cách ly, không điền mặc định. Việc này chưa miễn gate importer hoặc giải quyết quan hệ phụ thuộc. Category Blog inactive vẫn là việc chưa xử lý. Chưa chạy lại full PROD/DEV export sau toàn bộ sửa đổi; báo cáo từ artifact cũ không phải số blocker còn lại của 1.7.0.

Importer phải hỗ trợ đúng cặp exporterVersion/contractSha256. Test tương thích trên workspace importer local đã pass, nhưng commit exporter không bao gồm những thay đổi chưa commit của repository importer. Profile DEV vẫn cần được importer chấp nhận policy riêng trước khi import.

Xem [biên bản kiểm tra trước commit](../migration/pw1-exporter-verified-20260918.md).


## Product thiếu giá/stock — cập nhật 1.8.0

Product thiếu price/stock hoặc không còn dòng SKU nguồn đủ điều kiện được bỏ khỏi master theo policy đã duyệt. mapping-report ghi PRODUCT_MISSING_PRICE_STOCK_EXCLUDED và productExclusion trên Product/dòng con chỉ giữ CSV; đây không còn là blocker của Product đó. Importer 1.8.0 kiểm tra cùng Store, parent SKU→Product, reason, retained fields và Product không còn emit trước khi chấp nhận. Artifact cũ không tự thay đổi: cần export lại bằng code mới.

Giá/stock bằng 0 vẫn giữ. Giá âm, sai số, SKU khác Store hoặc status lạ vẫn có blocker. Order lịch sử giữ các giá trị line nguồn theo policy đã duyệt; các lỗi Order/quan hệ khác không được miễn. Chưa chạy full export PROD/DEV hoặc ghi DB trong đợt sửa này.

### Contract 1.9.0 — triển khai quyết định conflict ngày 23/09

Checkpoint 1.8.2 từng khóa chung 21 cờ đã được thay thế cho artifact mới. Các quyết định đã ghi trong strategy và [tài liệu bổ sung](../migration/pw1-conflict-decisions-20260923.md) được triển khai theo từng policy. `skipUnverifiedOrders=true` vẫn bị từ chối: không bỏ Order để làm Store hết blocker. Artifact lịch sử không được bật các policy mới bằng cách sửa manifest.

Export tạo thêm `conflict-details.md` và `conflict-details.json`, có hash trong manifest. Mở Markdown để xem Store ID, bảng/record ID, mã lỗi, giá trị nguồn, các ID liên quan và giá trị đích. Nhóm ID có thể gồm cả bản ghi inactive/đã lưu trữ để đối chiếu; không suy ra mọi record trong nhóm đều bị loại. Receipt Product cho biết canonical/alias, tuple, SKU bị loại; dữ liệu nguồn vẫn giữ ở CSV ngoài artifact.

Cần dùng importer hỗ trợ đúng version/hash 1.9.0 và kiểm tra policy theo bằng chứng; exporter thành công không đồng nghĩa Store sẵn sàng ghi DB. Owner chưa xác minh, trạng thái Order lạ, refund mâu thuẫn/một phần và EAV thiếu bằng chứng vẫn blocked. Không tự đặt country Malaysia khi Order thiếu country.

Xem [tracking triển khai](../migration/pw1-conflict-implementation-20260923.md) để biết kiểm thử và giới hạn nghiệm thu. Các số lượng từ report 18/09 phía trên vẫn là baseline lịch sử; chưa thay bằng số hiện tại khi chưa có kết quả đối soát mới.


### Scope model_settings từ exporter 1.10.1

Toàn bộ bảng `model_settings` không được mapping vào master JSON. Giữ CSV nguồn để đối soát; `mapping-report.json` ghi rule `MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE` và cảnh báo cấp bảng `MODEL_SETTINGS_OUTSIDE_SCOPE`. Các trường không biết, nội dung JSON/URL lỗi hoặc ownership chưa resolve của bảng này không chặn luồng. Secret-like fields vẫn được đánh dấu `security-excluded`. Điều này không miễn kiểm tra cấu trúc/identity/hash hay cho phép contribution từ bảng này.

`DEFAULT_DOMAIN_AMBIGUOUS` và `SOURCE_MAIN_DOMAIN_AMBIGUOUS` là cảnh báo cấp Store, vì vậy dùng `table=stores`, `sourceId=Store ID`; xem `relatedIds` trong conflict report để tìm những dòng `store_domains` thật gây trùng.


### Phạm vi mới từ 1.10.2

PROD profile bật `excludeProductsInInactiveCategories`: Product thuộc Category cùng Store/live/status0 bị loại toàn bộ với warning `PRODUCT_CATALOG_POLICY_EXCLUDED`, reason `INACTIVE_CATEGORY`. Order lịch sử giữ snapshot và tổng tiền, bỏ references catalog bị loại. Category thiếu/khác Store/đã xóa không thuộc ngoại lệ này.

Secondary owner được map editor, không custom permissions; importer kiểm chứng đúng marker và output editor, không miễn chung warning quyền cho mọi User. Social channel chỉ giữ sáu platform PW2 hỗ trợ, bỏ metadata và entry không dùng được có warning. Library medias dùng URL/sourceUrl gốc, không tải/upload; nguồn file chưa hợp lệ vẫn cần xử lý theo report. Các artifact đã export trước thay đổi không tự được nâng phiên bản: export lại để nhận dữ liệu mới.


### Phạm vi mới từ 1.10.3

- Page/Menu được bảo toàn dạng raw trong artifact, thêm `sites[].raw_frontend_template`; importer hiện chưa chuyển thành builder PW2. Raw không được parse/rewrite để xác nhận URL/JSON, nhưng cột auth-secret không xuất và ownership không bị gán giả. Bảng kỹ thuật queue_sync/model_exports không replay.
- Metadata nguồn ngoài schema PW2 giữ trong CSV với allowlist; Order residual chỉ miễn khi Order vận hành đã được map đủ. Địa chỉ Customer đã emitted/deduplicated có contribution riêng, overflow phải khớp receipt và policy.
- `shippingPolicy=pw2-defaults` dùng đúng defaults PW2 kể cả PW1 có fixed fee hợp lệ. `review` vẫn kiểm tra nguồn. Các ràng buộc promotion không có field PW2 chỉ giữ nguồn, không được mô tả là đã bảo toàn toàn bộ hành vi PW1.
- Artifact cũ1.10.2 không tự cập nhật. Chạy export lại để nhận1.10.3; kiểm tra source handoff và importer preflight theo artifact mới.
