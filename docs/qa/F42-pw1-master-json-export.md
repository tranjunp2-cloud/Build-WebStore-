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

Chính sách lịch sử tại checkpoint 2026-09-16: khóa lạ, URL không an toàn và thông tin bí mật trong raw bị loại; `model_settings.store_id` thiếu/mismatch bị chặn, các khóa UI chưa xác minh được giữ là unresolved. Chính sách này đã được thay thế đối với raw Page/Menu và `model_settings`: từ contract 1.10.4, giữ nguyên chuỗi `value` theo quyết định ngày 2026-09-24, kể cả HTML, `tel:` có khoảng trắng, khóa lạ và JSON chưa parse được. Không suy ownership từ created_by hoặc tự gán setting cho model khác Store. Raw được bảo toàn không đồng nghĩa đã chuyển thành block vận hành PW2.

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
| TC-F42-079 | [x] AUTO | Customer receipt preserves canonical/merged IDs, address usage/index/dedup/overflow/legacy geography and rank/profile decisions; quarantined targets become null; raw archive remains explicitly external; emitted/deduplicated Customer address contributions remain accurate when Orders are skipped; overflow requires approved flag and matching receipt, tampering is rejected |
| TC-F42-080 | [x] AUTO | Product receipt covers simple and variant source SKUs, selected tuples and target UUID/path; no live target after quarantine; missing/foreign/duplicate refs and forged tuples rejected |
| TC-F42-081 | [x] AUTO | Current export hashes and requires both strict receipts; tampered bytes/provenance/refs rejected; current mapping pin matches document; legacy followup contract validated with legacy SKU schema; unknown contract/version rejected |

- [x] AUTO **TC-F42-EXP-082**: Resolve source-row tenant through verified parent relationships; missing parents, unknown polymorphic types and tenant conflicts remain blocked. Retain only known source metadata; unknown fields and nonempty unmapped avatars stay unresolved.

- [x] AUTO **TC-F42-EXP-083**: Reject contradictory Store ownership, missing/incorrect parent, unknown ownership/retention rules, missing failure diagnostic and cyclic evidence; accept valid child chains and retained orphan evidence with global blockers. Rehashed artifact mutations must still fail classification validation.

- [x] AUTO **TC-F42-EXP-084**: Generate exact CSV selection for a new date from a reusable profile; retain explicit snapshot/asOf and attributes alias; generated config feeds actual exporter. Reject duplicate tables, mixed dates, missing/unexpected tables, invalid filename dates, symlinks, unsafe output and overwrites.

- [x] AUTO **TC-F42-EXP-085**: One-command export uses the default profile, creates unique private output/config, preserves source CSV, supports explicit snapshot/output and propagates needs-review exit status. Reject missing asOf, unsafe output/symlink ancestors, overwrites, missing tables, invalid asOf/profile; help and sanitized errors do not create output.

### One-command CLI verification — 2026-09-18

- Regression: 416 tests across 28 files passed (migration unit tests plus master-export, snapshot-config and one-command CLI integration suites); `tsc --noEmit` passed.
- Review fix: validate default output ancestors before directory creation so a symlinked `.migration` cannot create directories inside the CSV source. Regression covers this path.
- Full production snapshot: 93 CSV files, snapshot `20260916-1351-1353`, explicit `asOf=2026-09-16T00:00:00Z`; default profile/output with explicit snapshot ID for comparison. Export completed and independent artifact validation returned `integrityStatus=valid`, `mappingStatus=needs_review`, exit 2.
- Results unchanged: 2,918 source Stores, 2,799 emitted, 118 blocked, 1 policy-excluded, 107,726 blocker diagnostics. All 9 payload/report files match the prior `pw1-prod-20260917-classification-001` artifact byte-for-byte by SHA-256; manifest matches except the generated source config hash. All 93 source CSV hashes unchanged.
- This verifies CLI/export equivalence, not full migration readiness: emitted Stores can still have target prerequisites or omitted/unresolved records and fields. Creator/tenant slug prerequisites do not themselves mean records are missing. Rich-text fidelity diagnostics remain in the exporter report even where handling is delegated elsewhere.
- Private execution evidence and comparison: `.migration/review-20260918/` (ignored by Git); production CSV and generated artifacts are not committed.

- [x] AUTO **TC-F42-EXP-086**: Preserve PW1 Product and Blog active/inactive through mapper, sanitizer and artifact schemas; preserve promotion active/inactive/verified expiry. Missing/unknown status or contradictory expiry is blocked. Never invent publication timestamps. New contract/version pair is pinned; prior 1.1/1.2 pairs remain readable without accepting mismatched pins.

- [x] AUTO **TC-F42-EXP-087**: Master omits pw1_source and current schema rejects reinsertion. Archive-only fields are retained-source with bounded, ownership-checked CSV evidence, never falsely mapped. Operational mapping and unsafe/unknown-field diagnostics remain intact; 1.0–1.3 use legacy site schemas.

- [x] AUTO TC-F42-EXP-088: separate publication/data/import outcome; exact delegated scope; unknown/unsafe/price gaps retained; forged outcome/report rejected.

- [x] AUTO TC-F42-EXP-089: exact warning importer gates; approved excluded Store scope; per-Store emitted/blocked/excluded; historical 1.5.0 contract compatibility.

- [x] AUTO TC-F42-EXP-090: Handoff distinguishes per-Store source errors, global scope review, importer verification (including unknown warnings), exclusions and diagnostic-clear Stores; never certifies import readiness. One-command CLI writes a private report outside the artifact.

- [x] AUTO TC-F42-EXP-091: Product EN/MS descriptions retain exact source strings (HTML, arbitrary links/attributes, JSON-like text, Unicode, CRLF, whitespace and empty string) as Lexical text; no content/raw blockers or media extraction, other field and Blog validation unchanged.

- [x] AUTO TC-F42-EXP-092: Blog author missing/unresolved falls back to the unique emitted tenant owner; preserve resolved source author; reject missing, foreign or ambiguous owner.

- [x] AUTO TC-F42-EXP-093: Blog content is opaque source text; preserve HTML, links, embedded media URLs, entities, Unicode and whitespace without content blockers or media extraction. Raw content/content_ms classification preserves original strings; thumbnail and other Blog fields retain validation.

- [x] AUTO TC-F42-EXP-094: Skip whole Product for absent/null/empty/whitespace eligible SKU price or stock; retain real zero; no SKU rows remain quarantined with Product ID and reason.

- [x] AUTO TC-F42-EXP-095: Recover option definitions from eligible SKU selection rows with verified live same-Store attribute/value ownership; no SKU synthesis or source mutation; retain definition contributions; missing/foreign/deleted/mis-parented definitions and true duplicate tuples stay blocked; incomplete tuples are not falsely reported as duplicate.

- [x] AUTO TC-F42-EXP-096: Product thiếu price/stock bỏ có warning và evidence Product/dòng con; validator reject evidence giả, Product còn emit, sai Store/parent; số sai và ownership lỗi vẫn blocker; zero vẫn giữ.


## Kiểm tra phạm vi PR — 18/09/2026

TC-F42-069: cập nhật kỳ vọng CLI creator-sidecar từ exit 2 lịch sử sang exit 0, integrity valid nhưng data partial/import not_verified theo contract 1.8.0. Chạy riêng integration user-actors artifact + gap audit CLI: 10 tests / 2 files PASS. Đây là hai suite bổ sung cho 513 tests / 33 files đã chạy; không thay full-source acceptance.

- [x] AUTO TC-F42-EXP-097: Bỏ Blog category status=0; Blog cùng Store giữ content/status/author và bỏ category; inactive không gây slug collision với active; active-active trùng, category thiếu/deleted/foreign/status lạ vẫn báo lỗi; artifact phân loại CSV retained-source và validate được.

- [x] AUTO TC-F42-EXP-098: 21 draft policy flags absent/false preserve approved policy; true rejected before CSV read/publication and by artifact validator. Tests of dormant mapper strategies are isolated prototypes, not approved migration behavior.
- [x] AUTO TC-F42-EXP-099: Report reasons schema-valid; excluded Blog category has no emitted-target contribution; SKU receipts reject missing coverage and many-to-one even after rehashing.

## Conflict decisions implementation — 23/09/2026

- [x] AUTO TC-F42-EXP-100: Canonical tuple inventory/price, conditional aliases, partial SKU pruning and inactive eligibility; foreign ownership remains blocked. SKU suffix resolution reserves original sibling codes case-insensitively and checks every assigned target field; a generated suffix collision must not exclude an otherwise valid Product.
- [x] AUTO TC-F42-EXP-101: No arbitrary owner or author; suspended COD off; invalid domain omitted; no fake country; retain unknown Orders as blocker; refund failed/partial not fully refunded; colliding coupons all excluded.
- [x] AUTO TC-F42-EXP-102: Contract 1.9.0 accepts approved flags, rejects skipUnverifiedOrders; historical contracts cannot activate new flags; conflict audit lists IDs/values without credentials.

- [x] AUTO TC-F42-EXP-103: PROD selects oldest live backend user if owner missing, oldest owner if multiple, timestamp tie numeric ID; preserves invalid email exactly with warning; no foreign/deleted/frontend candidates; legacy artifact email schema remains strict.

- [x] AUTO TC-F42-EXP-104: Product slug trùng cùng Store giữ ID số nhỏ nhất bất kể CSV order; scope khác Store không loại. Product có biến thể nhưng không có variant hợp lệ/thiếu domain được loại theo flag; simple Product vẫn giữ; ownership/giá lỗi khác không được miễn. Exclusion receipt/classification liên kết canonical và nguồn cùng Store; thiếu flag/contract cũ/tamper bị từ chối; Order lịch sử giữ nguyên.

- [x] AUTO TC-F42-EXP-105: Explicit invalid Product/Blog/Order-status/Payment source omissions have exact retained-source root/family receipts; per-record contributions/media rollback; unknown runtime errors and unrelated ownership remain blocked; null failed ownership is preserved with verified family evidence; old/missing policy rejects; soft-deleted Store excluded without blocking.

- [x] AUTO TC-F42-EXP-106: PROD-only explicit Store43/Order112,132 negative-total exclusions preserve original amounts and exact root/child evidence; corrected total, absent policy, wrong Store/ID, DEV scope and historical contract cannot use the waiver.

- [x] AUTO TC-F42-EXP-107: Master parts max300 Stores and strictly<200000000 UTF-8 bytes including syntax/escapes; numeric ordering, Store atomic; emptyset/noaggregate; oversizedStore reports ID and never publishes. Validator rejects missing/extra/renumbered parts, wrong size/hash/store IDs/duplicates/sethash; historic master.json contracts remain supported.

- [x] AUTO TC-F42-EXP-108: Historical contracts 1.10.1–1.10.3 keep all model_settings source-only (including unknown keys/headers and failed ownership), zero mapping/contributions, secret fields excluded; classifier retains truthful ownership; earlier contract/other-table scope rule, forged contribution/duplicate ID/false ownership rejected. This is compatibility coverage, not the current export policy. Aggregate domain warning references Store ID in stores and reports actual related domain IDs.


- [x] AUTO TC-F42-EXP-109: Product có Category cùng Store, live, status0 và flag mới bị loại toàn bộ, có family proof và warning INACTIVE_CATEGORY; Category active/missing/deleted/foreign và flag-off không được miễn theo policy này. Order snapshot/tổng tiền giữ nguyên, references tới catalog đã loại không dangling. Contract cũ/flag-off/emitted Product/forged family không được nhận ngoại lệ. Secondary owners emit editor + empty permissions; readOnly không có marker editor.


- [x] AUTO TC-F42-EXP-110: social_channel chỉ xuất platform PW2 hỗ trợ, giữ URL gốc, first-entry khi trùng, không copy metadata/secret; hostname lookalike/prototype không được coi platform, malformed/unsafe entry warning và không xuất. Library medias đúng Store/live/type1 xuất URL/sourceUrl nguyên trạng, timestamps nguồn, không binary/filename/MIME/tenant giả; folder/deleted/emptyURL giữ nguồn warning, malformed URL/type/timestamp vẫn blocker. Artifact reject oldcontract retention, forged/media-emitted source-only receipt, wrongtable/field hoặc missingwarning.


- [x] AUTO TC-F42-EXP-111: metadata allowlist không miễn fields vận hành hoặc Users.created_by; technical queue_sync/model_exports ngoài scope nhưng ownership/secret/hash vẫn đúng; Order residual chỉ source-only khi Order emitted và có root contribution, foreign/missingroot/oldcontract bị chặn. Page/Menu giữ nguyên chuỗi nguồn/definitions/children, top-level secret columns không xuất, orphan không bị gán sai Store; marker và raw feature chỉ contract mới. Shipping pw2-defaults luôn dùng PW2defaults, review mode vẫn kiểm tra nguồn. Address mapped/deduplicated Customer có contribution đúng targetindex; overflow cần flag + exactwarning + receipt, sai receipt/flag bị chặn. Discount bị skip cần warning được duyệt, absenttarget, không contribution, parent chỉ source-only khi mọi code được đối soát; unexpectederrors không được miễn. Handoff không tạo global blocker từ Page/technical scope đã có bằng chứng; lịch sử không tự được miễn.

- [x] AUTO TC-F42-EXP-112: Contract 1.10.4 khôi phục model_settings với ID/key/value nguyên văn; HTML, tel có khoảng trắng, JSON lỗi, null/chuỗi rỗng và khóa lạ không làm mất value. Nested Page/PageComponent/Menu chỉ nhận quan hệ đúng Store; setting còn lại có Store nguồn hợp lệ được giữ raw ở Site, không giả quan hệ vận hành hoặc khôi phục Product đã bỏ qua. Không xác định được Store thì ghi rõ lý do trong report; auth columns riêng vẫn không replay. Classifier/manifest không dùng marker ngoài scope lịch sử cho contract mới; artifact lịch sử giữ semantics cũ; receipt giả, sai Store/contract bị từ chối. Kiểm chứng PROD phải đọc master parts và so ID/key/value với CSV, đặc biệt Store411/465, không suy đủ content từ số blocker bằng 0.


- [x] AUTO TC-F42-EXP-113: Contract 1.10.5 giữ `sites.domain` nguyên văn từ default domain còn sống của PW1, độc lập tenant slug và targetPlatformSuffix; không đổi customDomains hoặc dữ liệu khác. Scope lựa chọn chỉ default domain nguồn, không tự chọn custom/main domain khác. Binding ID phải đúng Store/live/default; sai hoặc thiếu bằng chứng khi ambiguous không được thay bằng domain PW2. Store55 giữ domain có nhãn `mk.web` dù slug xử lý riêng; domain sai grammar nhưng có giá trị như Store2330 được giữ warning theo graceful policy, không mất Store hoặc đổi chuỗi. Gate contract lịch sử không tự nhận binding mới; importer không rewrite domain. Audit PROD so mọi sites.domain với CSV, duy trì đầy đủ model_settings và xác nhận ngoài sites.domain không đổi. Receipt validation requires exactly one source-domain contribution per emitted site, rejects missing/duplicate/foreign or unemitted Store evidence and missing/duplicate/unmapped fields, while historical contracts remain exempt from the new requirement.

- [x] AUTO TC-F42-EXP-114: Source evidence sidecar lấy record/field từ selected CSV snapshot trước khi mapper lọc; giữ disposition cho record bị loại, bind hash trong manifest. Chỉ field QC allowlisted được phép có safe display; Customer/Order identity/Discount code không trả raw, fingerprint dùng HMAC với key đủ dài. Thiếu HMAC key phải khai báo `piiComparable=false`, không được coi là đã đối soát PII. Trạng thái chạy staging còn NOT_RUN.

## Delta migration (`migrate:pw1:delta`, 27/10/2026)

- [x] AUTO TC-F42-DELTA-01: Chuẩn hóa CSV chỉ gỡ dấu `'` đứng đầu giá trị khi ký tự kế là `=`, `+`, `-`, `@` (cả ô có/không ngoặc kép); giữ nguyên mọi byte khác (BOM, CRLF, xuống dòng trong ô, `""`), không đụng header; `--keep-quotes` tắt việc gỡ. Ghi nhận bảng/id/cột đã sửa, số dòng, id trùng/rỗng.
- [x] AUTO TC-F42-DELTA-02: Kiểm tra đầu vào báo đủ lỗi: tên file sai định dạng, nhiều ngày trong một bộ, bảng thiếu/lạ/trùng so với profile, header đổi, id trùng/rỗng tăng, số dòng tụt dưới 90% (bảng >100 dòng).
- [x] AUTO TC-F42-DELTA-03: So entity old/new theo ref: cùng checksum → UNCHANGED; khác checksum có claim → CHANGED kèm field đổi + target; không claim → NEW (nhãn recovered nếu evidence cũ là retained-source/excluded); chỉ có ở old → GONE; đổi store → CHANGED (không GONE+NEW); claim của lần delta trước cùng checksum → UNCHANGED. Bản ghi đã claim luôn so với checksum ledger (có hay không `--old`): bản ghi import còn dấu `'` đầu giá trị → CHANGED dù old/new dựng lại giống nhau.
- [x] AUTO TC-F42-DELTA-04: Gate tái lập: checksum entity dựng lại từ CSV đã import phải khớp ledger; lệch chỉ được chấp nhận ở bản ghi đã gỡ dấu `'`; lệch khác hoặc bản ghi đã import mà không dựng lại được → gate FAILED.
- [x] AUTO TC-F42-DELTA-06: Chế độ mặc định (không `--old`): so entity của bộ CSV mới với checksum trong ledger. Cùng checksum → UNCHANGED; khác → CHANGED (đánh dấu "quote fix" nếu dòng nguồn vừa được gỡ dấu `'`); không claim → NEW; claim không còn được dựng lại → GONE (bỏ qua claim đã RETIRED hoặc REPORTED); chặn ghi khi số thay đổi (trừ quote fix) vượt 5% hoặc số bản ghi biến mất vượt 1% số claim, trừ khi có `--allow-mass-change`.
- [x] AUTO TC-F42-DELTA-07: Có `--old`: so `key_string`/hash mật khẩu của users giữa 2 bộ CSV; user đã migrate có mật khẩu PW1 đổi → cập nhật mật khẩu PW2 (cùng định dạng lúc import); user chưa migrate/user mới không nằm trong danh sách; không có `--old` → báo "chưa kiểm tra".
- [x] AUTO TC-F42-DELTA-08: Tracking (studio/qa/migration-diff, API `/api/qa/migration-reconciliation/delta`, Super Admin): theo store PW1, liệt kê các lần delta đã ghi vào store (số tạo/cập nhật/ẩn/chỉ báo cáo) và các xung đột/lỗi cần xem tay; chỉ đọc `pw1_delta_*`, không ghi hay trộn vào `migration_*`.
- [x] MANUAL TC-F42-DELTA-10: Studio Migration diff (`/api/admin/qa/website-migrations`) chấp nhận store do delta tạo rồi generate website: tenant/site trong `pw1_migration_stores` được chứng minh bằng `pw1_delta_map` (đúng store, đúng tenant/site, lần delta dùng cùng snapshot với binding import). Site chứng minh bằng ledger import và tenant bằng ledger delta (hoặc ngược lại) → chấp nhận. Lệch site/tenant, thiếu site hoặc thiếu tenant, hoặc khác snapshot → vẫn `UNPROVEN_LEGACY_IDENTITY`; DB chưa có bảng delta → như cũ. Script tự kiểm `src/__tests__/integration/f40-catalog-scope.ts`, **chạy tay** với Postgres local (không có trong CI): `node --require ./scripts/seed-preload.cjs --import tsx src/__tests__/integration/f40-catalog-scope.ts`.
- [x] MANUAL TC-F42-DELTA-05: Chạy `--old DB_PROD --new DB_PROD` trên DB dev: gate PASSED, chỉ CHANGED ở bản ghi dính `'`. **Đã chạy 27/10/2026** trên bản sao DB dev: gate PASSED (0 lệch không giải thích được, 0 bản ghi không dựng lại được), "No changes", exit 0. Lúc đó bản ghi dính `'` chưa so với checksum ledger nên không hiện CHANGED; sau khi sửa (D1), chúng được ghi ở lần chạy CSV 27/10 (30 bản ghi, xem TC-09).
- [x] MANUAL TC-F42-DELTA-09: Trên bản sao DB đã apply delta, chạy lại cùng `--old`/`--new`: không ghi thêm bản ghi nào, mật khẩu báo `ALREADY_SYNCED`; lệnh thứ hai chạy song song bị chặn `DELTA_ALREADY_RUNNING`; Ctrl+C/kill giữa chừng xóa bản sao CSV. **Đã chạy:**
  - 27/10/2026, bản sao DB dev: lần 2 chỉ ghi 30 bản ghi dính `'` (do vừa sửa D1); mật khẩu 4 `ALREADY_SYNCED`; lệnh song song bị chặn `DELTA_ALREADY_RUNNING`; SIGTERM giữa chừng xóa bản sao CSV.
  - 28/10/2026, DB primeweb local (lần 1 ghi 1.387, 0 conflict): chạy lại `--old DB_PROD --new DB_PROD_V2` → parity PASSED; chỉ còn 6 thay đổi, đúng là 6 bản ghi lần 1 đã `report-only` (1 discount NEW, 5 plan-subscription-usages), không có bản ghi nào cần ghi.
