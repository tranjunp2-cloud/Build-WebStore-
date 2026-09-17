# F42 — PW1 JSON master exporter

AUTO chỉ là chế độ kiểm thử. Evidence bên dưới ghi kết quả fixture tổng hợp; **không chứng nhận full-source acceptance**. Ngày kiểm chứng: 2026-09-16.

Các file test tham chiếu:

- **S**: [pw1-export-source.test.ts](../../src/__tests__/unit/migration/pw1-export-source.test.ts) — 18 tests.
- **I**: [pw1-identity.test.ts](../../src/__tests__/unit/migration/pw1-identity.test.ts) — 11 tests.
- **C**: [catalog-commerce.test.ts](../../src/__tests__/unit/migration/catalog-commerce.test.ts) — 11 tests.
- **P**: [pw1-content.test.ts](../../src/__tests__/unit/migration/pw1-content.test.ts) — 7 tests.
- **L**: [pw1-master-export-cli.test.ts](../../src/__tests__/integration/pw1-master-export-cli.test.ts) — 7 tests, subprocess thật.
- **X**: [csv-loader-cancellation.test.ts](../../src/__tests__/unit/migration/csv-loader-cancellation.test.ts) — 2 tests.

Kết quả kiểm chứng cuối: **132 tests pass**, gồm **56 exporter tests** trong 6 file trên và các regression helper liên quan; full TypeScript check pass. Evidence chạy: `/tmp/pw1-final-tests.log`. Số test pass không có nghĩa toàn bộ phạm vi của 21 TC đã được nghiệm thu; các giới hạn cụ thể ghi bên dưới.

| TC-ID | Mode | Scenario | Expected | Evidence |
|---|---|---|---|---|
| TC-F42-EXP-001 | [x] AUTO | BOM/CRLF/quoted comma/newline/escaped quote | Đúng ô, record count | PASS fixture (S): BOM/CRLF/UTF8/comma/newline/escaped quote và record count. |
| TC-F42-EXP-002 | [x] AUTO | Header trùng/row width/quote/encoding lỗi | Fatal, không output complete | PASS fixture (S, X): duplicate/empty header, width, quote, UTF8, oversized malformed input; producer thoát không treo. |
| TC-F42-EXP-003 | [x] AUTO | Missing/header-only/unknown/multiple snapshots, unselected malformed | Strict selected; unselected lỗi không chặn; không chọn latest | PARTIAL (S): missing, empty, header-only, unselected malformed. Chưa test toàn bộ unknown-table/multiple-snapshot policy và inventory drift. |
| TC-F42-EXP-004 | [x] AUTO | ID lớn, leading zero, null/empty/0/false, composite PK | Không mất dữ liệu/identity | PASS fixture (S): ID > MAX_SAFE_INTEGER, leading zero, explicit null token, literal NULL/0/false, duplicate/composite identity. |
| TC-F42-EXP-005 | [x] AUTO | Raw vs normalize/evaluate timestamp, invalid/offset mismatch, asOf | Raw nguyên vẹn; field normalize block/UTC đúng; không now | PARTIAL (S, I, P): UTC offset/calendar/zone mismatch, raw Page timestamp, subscription asOf. Chưa exhaustive DST ambiguous/nonexistent. |
| TC-F42-EXP-006 | [x] AUTO | ≥3 Store, shuffled unordered rows, ordered/no-PK raw, deleted/inactive | Không hardcode; shuffle chỉ bất biến khi contract cho phép | PARTIAL (L, I, P): 3 Store gồm ID lớn, inactive/expired và deleted Page. Chưa test permutation của mọi unordered table/no-PK ordering. |
| TC-F42-EXP-007 | [x] AUTO | Domain suffix boundary/default duplicate/alias/custom/IDN | Đúng slug/custom/Site theo contract | PARTIAL (I): legacy suffix slug, custom pending, duplicate default. Chưa đủ reserved/IDN/suffix-boundary truth table. |
| TC-F42-EXP-008 | [x] AUTO | COD provider ID khác1, inactive/duplicate/unknown, both flags | Truth table đúng, ambiguity block | PARTIAL (I): provider ID99, sandbox/non-default vẫn COD, duplicate blocker, hai cờ đồng bộ. Chưa đủ inactive/deleted/unknown-provider matrix. |
| TC-F42-EXP-009 | [x] AUTO | User name, hai cấp role policy §3.4, membership status, duplicate email/created_by | Owner/manager/default editor đúng; readOnlyUserIds ưu tiên viewer; staff chưa rõ quyền không bị bỏ; permissions=[]; không fallback/merge/nâng quyền sai | PARTIAL (I, L): name một token/rỗng, default editor, read-only viewer, suspended staff, duplicate email cách ly cả Store. Chưa exhaustive role/guard/creator chain. |
| TC-F42-EXP-010 | [x] AUTO | EAV sparse/duplicate tuple/SKU collision/money/inventory | Rule đúng, quarantine propagation | PARTIAL (C): simple Product, missing category, SKU collision, money exact/sub-cent, Media schema. EAV sparse/duplicate tuple cần mở rộng dedicated exporter fixtures. |
| TC-F42-EXP-011 | [x] AUTO | Customer merge/geo mismatch/Order refund-payment history | Crosswalk đúng, history không bị sửa | PARTIAL (C): phone cohort merge, historical totals, missing SKU quarantine, refund chưa chứng minh. Geo mismatch và đủ payment/refund matrix còn thiếu. |
| TC-F42-EXP-012 | [x] AUTO | Raw deleted Page/menu/polymorphic owner + Blog Lexical | Raw đúng phạm vi, content chuyển đúng | PARTIAL (P): deleted raw Page/discriminator, Lexical image/relative link, category collision, missing author, unsupported HTML, email locale. Chưa exhaustive menu/template/render fidelity. |
| TC-F42-EXP-013 | [x] AUTO | Canary secrets trong nested JSON/URL/unknown blob/error | Không có secret ở master/report/stdout/stderr | PARTIAL (P, L): nested secret/credential URL/unknown settings canary; CLI unknown flag không echo input. Chưa fuzz mọi serialized field/error path. |
| TC-F42-EXP-014 | [x] AUTO | Fatal/disk error/source changed/concurrent output | Không publish dở hoặc overwrite | PARTIAL (S, X, L): changed source, symlink, input limits, no overwrite/empty existing output, failed prepublish cleanup, tamper. Chưa inject disk-full/process kill/concurrent publisher toàn bộ window. |
| TC-F42-EXP-015 | [x] AUTO | CLI thật không DB env/network; validate-only; deterministic | Exit/status/hash đúng; chạy executable thực | PASS fixture (L): executable help/inventory/export/validate offline, exit0/2/1, deterministic master, schema/hash/status mismatch. Exit0 dùng artifact zero-row tổng hợp, không phải source thật đã complete. |
| TC-F42-EXP-016 | [x] AUTO | Full snapshot row+field coverage/20 roots/refs/exclusion policy | Store counters khớp; lỗi mapper không thể waive thành complete | PARTIAL / FULL-SOURCE PENDING (S, L): 3-Store counts, global collision closure và blocked-row disposition, ref text-vs-relationship, exclusion scope/evidence/duplicates và lifecycle không thể waive. CSV thật đã chạy trial-002; 494/1.133 Store emit, 639 blocked. Chưa đạt full-source acceptance; các bản sửa cần chạy lại và đối soát. |
| TC-F42-EXP-017 | [x] AUTO | Token thiếu/sai; cùng DB qua hai snapshot; SKU quá dài | Config sai bị từ chối; SKU/UUID của cùng source identity giữ nguyên qua snapshot; không truncate SKU | PARTIAL (S, C): invalid token/config và stable SKU/UUID across snapshots. Chưa dedicated missing-token/SKU-overlength matrix. |
| TC-F42-EXP-018 | [x] AUTO | Ma trận Store–owner–main, staff ban, lifecycle conflict | Trạng thái/disposition theo §3.1/9; không tự activate hoặc chặn Tenant vì staff | PARTIAL (I): active/inactive/expired, staff ban, conflict, trial parity, end-period cancel, usage counts/null expiry. Chưa mọi duplicate main/owner/cancel/date branch. |
| TC-F42-EXP-019 | [x] AUTO | Product kg/cm và Order gram; enum legacy loại2 | 2 kg→2 kg, 30 cm→30 cm; Order nguồn gram giữ đúng gram, không chia nhầm | PARTIAL (C): Product 2kg/30cm và legacy enum giữ đúng. Order parcelWeight gram cần dedicated assertion. |
| TC-F42-EXP-020 | [x] AUTO | CSV có đủ năm bảng raw Media bị loại; consumer ảnh | Không có năm key raw; Media/URL/timestamps/refs hợp lệ vẫn giữ; raw khác không mất | PARTIAL (P, C): loại năm raw Media keys, external Media schema. Chưa kiểm toàn bộ consumer image/timestamp crosswalk trên CSV thật. |
| TC-F42-EXP-021 | [x] AUTO | History rỗng, Order deleted có mã, mã/Promotion deleted, counter bất thường | Chỉ nguồn thực sự rỗng được verified-empty; đầy đủ evidence kể cả dữ liệu không emit | PARTIAL (C): verified-empty và deleted coded Order. Mã/Promotion deleted và counter bất thường cần mở rộng fixture. |

## Demo CLI đã chạy

Dữ liệu tổng hợp, không phải CSV production:

- Input: `/tmp/pw1-export-demo/input`
- Config: `/tmp/pw1-export-demo/source.json`
- Master: `/tmp/pw1-export-demo/output/master.json`
- Manifest/report cùng thư mục output.

Lệnh npm thực xuất 3/3 Store, blocked 0; `needs_review`, exit 2 với 32 blocker do fixture thiếu bảng/phạm vi. `--validate-only` trả integrityStatus `valid`, mappingStatus `needs_review`, exit 2. Chưa có nghiệm thu full-source hoặc DB migration.


## Regression sau trial-002 — 2026-09-16

[pw1-quarantine-records.test.ts](../../src/__tests__/unit/migration/pw1-quarantine-records.test.ts): **6 tests pass** khi chạy riêng; không cộng vào tổng cũ để suy ra aggregate mới.

- TC-F42-EXP-010/016: collision loại cả hai Product, giữ identity Store/record khác/raw refs; cascade Product → Order → usage, operationalIssues còn rỗng; không collision thì dữ liệu không thay đổi.
- TC-F42-EXP-010: thiếu SKU chỉ báo nguyên nhân gốc; thiếu domain không tạo lỗi duplicate tuple rỗng giả.
- TC-F42-EXP-001/015: exportMaster thật escape Unicode line separators trên disk, JSON.parse khôi phục chính xác tên Store nguồn.

Fixture usage kiểm dependency scanner; không chứng nhận mapper discount_usage_history đã triển khai. Kết quả nguồn thật của bản sửa còn pending; giữ trạng thái FULL-SOURCE PENDING.


### Aggregate sau sửa core

146 tests / 11 files pass; TypeScript pass. Logs: `/tmp/pw1-final-fixes-tests.log`, `/tmp/pw1-final-fixes-typecheck.log`. Phạm vi đầu ra giữ JSON theo xác nhận của người dùng; không có CLI CSV. Nguồn thật trial-003/004 dừng ở RESOURCE_MEMORY_LIMIT 2 GB; không coi lần dừng là artifact hoàn tất. Trial-005 dùng config riêng tăng giới hạn resident lên 4 GB và xuất thành công; kết quả dưới đây.


### Nguồn thật sau sửa: pw1-real-review-005

- Nguồn: 1.133 Store; emitted 889; blocked 244; policy-excluded 0. Mapping `needs_review`, 52.250 blocker diagnostics.
- `--validate-only`: integrityStatus `valid`, mappingStatus `needs_review`, exit 2.
- `master.json`: 187.297.805 bytes. Collections: Products 146, Orders 192, Categories 19.461, Pages 4.023, Users 941, Media 22.943, Blogs 67, Email templates 2.619.
- 12.702 Product records còn `GLOBAL_UNIQUE_COLLISION`; diagnostic nay có sourceId theo record nên không so trực tiếp với 395 diagnostics gộp theo Store trước đây.
- 889 Store có object trong master không đồng nghĩa dữ liệu mỗi Store đầy đủ. Coverage và record quarantine tiếp tục cần xử lý; full-source acceptance chưa đạt.

Artifact private: `.migration/exports/pw1-real-review-005/`; config `.migration/source-selection-review.json`. Không có DB import, commit hoặc push.


### Progress CLI — 2026-09-16

TC-F42-EXP-013/015: **10 tests pass** khi chạy riêng `pw1-progress.test.ts` (3) và `pw1-master-export-cli.test.ts` (7). Logger throttle 1 giây, vẫn phát stage mới/completion, neutralize control characters, format elapsed/rows/MB. CLI subprocess xác nhận progress trên stderr, stdout JSON parseable; `--quiet` giữ kết quả/master bytes, validate-only quiet giữ stdout; help không progress. Chưa dùng kết quả này để thay số aggregate core ở checkpoint trước.


### Validator artifact production lớn — strict streaming reader

TC-F42-EXP-013/015: **49 parser tests pass**: stream-json.test.ts (24), stream-json-adversarial.test.ts (25). Bao gồm JSON grammar/trailing comma/EOF, malformed UTF8, escape/Unicode chia ở nhiều kích thước chunk, prototype-looking keys không làm đổi prototype, visitor error không bị nuốt. Validator giữ schema từng Store/report record cùng hash/relationship/count/coverage; contribution chỉ bỏ khỏi RAM sau khi schema record đã được kiểm tra. Reader tránh string toàn file vượt giới hạn V8; object graph vẫn cần RAM. End-to-end production validation đã đạt integrity valid, mapping needs_review, exit 2; evidence riêng bên dưới, không suy từ parser fixtures.


### Evidence cuối production

- Full **198 tests / 14 files PASS**, TypeScript PASS: `/tmp/pw1-prod-complete-tests.log`, `/tmp/pw1-prod-complete-typecheck.log`.
- Production streaming validate-only PASS integrity: `/tmp/pw1-prod-validate-final.stdout`; mapping needs_review, exit 2.
- Source 2.918 Store; emitted 2.800; blocked 118; 209.170 blocker diagnostics. Master 564.865.274 bytes, report JSON 635.830.680 bytes.
- ARTIFACT_READ_FAILED do giới hạn full-file string đã khắc phục. Mapping/full-source acceptance tiếp tục pending; không miễn blocker hoặc thay đổi artifact để vượt validator.


### Master Product.slug scoped theo tenant

TC-F42-EXP-010/016 cập nhật: collision fixtures nay nằm cùng tenant; thêm regression giữ cùng slug khác tenant và Order refs, báo target global constraint gap; operational validator phân biệt same-tenant/cross-tenant, global Tenant.slug/User.email giữ nguyên. Master pin `62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26`. Kết quả production/checksum trước đây thuộc contract cũ; chưa có artifact production theo scope mới. Targeted suite **31 tests / 3 files PASS** và TypeScript PASS; logs `/tmp/pw1-tenant-slug-tests.log`, `/tmp/pw1-tenant-slug-typecheck.log`. Không suy nghiệm thu production mới từ fixture hoặc 198 tests lịch sử.


### Aggregate master scoped slug + raw lookup index

Full **205 tests / 15 files pass**, TypeScript pass: `/tmp/pw1-tenant-slug-all-final.log`, `/tmp/pw1-tenant-slug-tsc-final.log`. Raw lookup regression kiểm exact model/ID, missing/conflicting ownership mỗi context, deleted children/order và output mới không dùng lại mapped docs. Review helper xác nhận chỉ cache grouping của Row nguồn immutable, copy array trước sort; ownership/security còn ở mapper. Production tenant-slug-002 đang chạy, chưa có evidence artifact cuối.


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


## Gap remediation được duyệt — 2026-09-17

Các case dưới đây là scope triển khai, chưa chứng nhận production readiness.

| TC-ID | Automation | Scenario / Expected |
|---|---|---|
| TC-F42-055 | [x] AUTO | Product/Blog/Blog Category slug unique theo tenant; cùng tenant bị chặn, tenant khác được phép, DB migration preflight/idempotent và hook không đổi tenant scope |
| TC-F42-056 | [x] AUTO | Mapper/validator giữ Blog slug trùng khác tenant, vẫn quarantine trùng cùng tenant |
| TC-F42-057 | [x] AUTO | CSS chỉ khác spacing/case không sinh fidelity false positive; property không được giữ vẫn báo |
| TC-F42-058 | [x] AUTO | Navigation links hợp lệ gồm anchor/mailto/tel; dangerous/signed/credential URLs vẫn bị chặn; media policy không bị nới |
| TC-F42-059 | [x] AUTO | Edit Product không đổi description thì không ghi đè Lexical; sửa text có chủ đích và clear hoạt động |
| TC-F42-060 | [x] AUTO | Store settings thiếu store_id chỉ resolve khi Store model/id sống đúng tenant; mismatch/other model vẫn chặn và giữ provenance |
| TC-F42-061 | [x] AUTO | Raw rejection có reason an toàn; source-backed structure được giữ; unknown/sensitive value vẫn loại |
| TC-F42-062 | [x] AUTO | Category/EAV diagnostic phân biệt lỗi field/cây/duplicate và all-inactive/absent SKU mà không thay đổi policy bán hàng |
| TC-F42-063 | [x] AUTO | Shipping inventory phân loại fixed/tier/dynamic/missing, giữ thứ tự tier và source units, không xuất credential hoặc kích hoạt config |
| TC-F42-064 | [x] AUTO | Reconciliation cases phân biệt cross-tenant collision, SKU inactive/absent, contact shape; không chứa email/phone/credential values |
| TC-F42-065 | [x] AUTO | Audit CLI kiểm source/config/report hash, no-clobber output, field coverage aggregate và output không chứa source secrets |


## Remediation-003 — kết quả cuối 2026-09-17

330 tests / 23 files PASS; TypeScript/migration checker PASS; PostgreSQL tạm PASS uniqueness/idempotence/preflight rollback. Browser TC-F42-059 PASS1test31.3s trên DB local riêng, bảo toàn persisted Lexical khi không đổi/hoàn tác/ảnh-only; không chứng nhận ảnh load vì preview local MinIO404. Logs `.migration/logs/remediation-*` và hướng dẫn `docs/runbooks/f42-local-browser-regression.md`.

Production snapshot export remediation-003: 2.800/2.918 Store,118blocked;27.865Product,339Order,5.655Blog,2.131BlogCategory;143.949blocker. Validate-only integrity valid, mapping needs_review,exit2. Source/config giữ nguyên so với completion-004; thêm5.163Blog+2.029BlogCategory. Audit inventory2978delivery rows và935table/field coverage tạo thành công. Full-source acceptance vẫn pending; implementation scope đã hoàn thành. Report: `plans/reports/260917-pw1-gap-remediation-results.md`.


## Approved mapping continuation — 2026-09-17

| TC-ID | Automation | Scenario / Expected |
|---|---|---|
| TC-F42-066 | [x] AUTO | Active-only excludes inactive categories/SKUs with source evidence; Product with owned inactive category becomes uncategorized; missing/foreign source still blocked |
| TC-F42-067 | [x] AUTO | Weight converts explicit gram→kg, unknown unit rejected; approved sparse SKU tuples retained without synthesis |
| TC-F42-068 | [x] AUTO | Users creator same-tenant/global actor chain retained once without membership or runtime privilege grants |
| TC-F42-069 | [x] AUTO | Creator sidecar strict hash/schema/source identity; only direct users.createdBy can reference registry; tamper/duplicate/foreign and nested refs rejected |
| TC-F42-070 | [x] AUTO | Deferred Email source retained with decision provenance; no runtime email disablement |
| TC-F42-071 | [x] AUTO | ecommerce default with validated per-Store siteType override; invalid enum/deleted or unknown Store rejected; legacy no-policy config retains review |
| TC-F42-072 | [x] AUTO | PW2 shipping fixed RM→sen mapping respects currency/mode/ownership; incompatible config gets explicit approved default or review diagnostic; no provider activation |


## Approved-001 — kết quả cuối 2026-09-17

**385 tests / 27 files PASS; TypeScript PASS; code review PASS.** Export `.migration/exports/pw1-prod-20260917-approved-001` hoàn tất sau 1.026,3 giây. Validate-only độc lập: integrity `valid`, mapping `needs_review`, exit 2. Audit exit 0; source files giữ nguyên.

- 2.800 Store emitted / 118 blocked; 106.623 blocker diagnostics. Emitted không đồng nghĩa đủ mapping hoặc sẵn sàng import.
- 27.790 Product, 25.161 Category, 342 Order, 5.655 Blog, 2.131 BlogCategory, 0 email templates. Đối chiếu cả 339 Order cũ: shipping fee/totals không đổi; thêm 3 Order.
- 359 Product gram được giữ đã đổi đúng kg. 166 Product có Category nguồn inactive được giữ với `category: []` theo policy.
- **95 Product mất khỏi artifact vì Category active có cha inactive vẫn cần đối soát**, không phải gap đã giải quyết. Có 20 Product mới, nên tổng giảm 75 so với remediation-003.
- 2.840 User có creator được đối soát. Sidecar 2 actor global phục vụ 2.800 references; source creator preservation không chứng minh target binding/import. Chưa cấp quyền hoặc tạo membership giả.
- 2.800 Site ecommerce. Shipping: 860 fixed map đúng, 1.939 dùng PW2 defaults có warning nguồn bị thay, 1 Store VND blocker. Không tuyên bố phí mới tương đương PW1 cho nhóm defaults.

Audit: `.migration/audits/pw1-prod-20260917-approved-001/`; verification và record-deltas JSON cạnh thư mục audit. [Report cuối](../../plans/reports/260917-pw1-approved-mapping-results.md). Chưa import/deploy production; target creator binding, slug constraints và các gap còn lại vẫn phải xử lý.


| TC-ID | Automation | Scenario / Expected |
|---|---|---|
| TC-F42-073 | [x] AUTO | Explicit policy promotes active child of owned live inactive Category to root; recomputes descendants/breadcrumbs and root sibling collisions; absent policy or missing/deleted/foreign parent remains quarantined |

| TC-F42-074 | [x] AUTO | Historical Order snapshot retains name/variant/price/quantity without active SKU/catalog; existing foreign-tenant links rejected; no invented Product reference or recalculated money; legacy no-policy mapping remains strict |

### TC-F42-EXP-075 — Creator binding preflight
- [x] AUTO: deterministic source-scoped creator plan; verified unique target email resolves source 1/51 to actual target IDs and creator chain; missing accounts, duplicate emails, target-ID reuse, unverified candidates and provenance mismatch block readiness; inputs unchanged; no account creation, privileges, mail or database writes.

| TC-F42-076 | [x] AUTO | Full short-description content above300 chars and all8 source images preserved in operational Product, with media ordering and independent raw-safety rules |

| TC-F42-077 | [x] AUTO | Deferred Store IDs validated against live source, invalid/duplicate IDs rejected, manifest separates policy exclusions from blocked Stores; optional-history exclusions cannot waive identity/lifecycle errors |

## Exporter alignment with consolidated master — 2026-09-17

| TC-ID | Automation | Scenario / Expected |
|---|---|---|
| TC-F42-078 | [x] AUTO | Missing/blank SKU code with eligible price row emits draft Product; variant codes 51–100 preserved, >100 rejected; actual SKU collisions and missing price sources remain blocked |
| TC-F42-079 | [x] AUTO | Customer receipt preserves canonical/merged IDs, address usage/index/dedup/overflow/legacy geography and rank/profile decisions; quarantined targets become null; raw archive remains explicitly external |
| TC-F42-080 | [x] AUTO | Product receipt covers simple and variant source SKUs, selected tuples and target UUID/path; no live target after quarantine; missing/foreign/duplicate refs and forged tuples rejected |
| TC-F42-081 | [x] AUTO | Current export hashes and requires both strict receipts; tampered bytes/provenance/refs rejected; current mapping pin matches document; legacy followup contract validated with legacy SKU schema; unknown contract/version rejected |

- [x] AUTO **TC-F42-EXP-082**: Resolve source-row tenant through verified parent relationships; missing parents, unknown polymorphic types and tenant conflicts remain blocked. Retain only known source metadata; unknown fields and nonempty unmapped avatars stay unresolved.

- [x] AUTO **TC-F42-EXP-083**: Reject contradictory Store ownership, missing/incorrect parent, unknown ownership/retention rules, missing failure diagnostic and cyclic evidence; accept valid child chains and retained orphan evidence with global blockers. Rehashed artifact mutations must still fail classification validation.

- [x] AUTO **TC-F42-EXP-084**: Generate exact CSV selection for a new date from a reusable profile; retain explicit snapshot/asOf and attributes alias; generated config feeds actual exporter. Reject duplicate tables, mixed dates, missing/unexpected tables, invalid filename dates, symlinks, unsafe output and overwrites.
