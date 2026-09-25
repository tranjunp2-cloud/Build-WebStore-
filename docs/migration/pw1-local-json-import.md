# Import PW1 master JSON trên local

Hướng dẫn thao tác hiện tại: [README migrate local](README.md).

> **Latest verification2026-09-18:** Runner đã chia nhóm mặc định100store và tự ghi events/errors/summary.274unit tests + typecheck, clone3nhóm/ngắt/resume/reuse PASS. Full dry-run2799store vượt giới hạn bộ nhớ trước đây, dừng `GROUP_BLOCKED` ở nhóm1/28 với5986diagnostic occurrences nguồn. Chưa full apply. [Báo cáo nghiệm thu](../../plans/260916-1617-pw1-local-json-import/reports/260918-grouped-import-implementation.md).

CLI đã có cho một Store, list, range hoặc tất cả Store trong artifact. Mặc định chỉ ghi vào clone local có tên `pw1_import_1886_*`. Có thể ghi vào DB local hiện hữu bằng `--local-database NAME` khớp chính xác tên DB trong `DATABASE_URI`; host vẫn phải là loopback. Không chạy Vercel/production và không publish/activate. Chỉ CREATE, REUSE đã xác minh hoặc CONFLICT; không overwrite tổng quát, không import Pages, không upload lại Media.

## Store636 actual import — VERIFIED, 2026-09-18

Đã import **trực tiếp vào DB ứng dụng local `primeweb`, localhost:5433**, exit0. Batch `json:c7ffe7ec-b06f-411f-8e30-4887d2b6fecb`; preflight creates985/reuses0, STORE_VERIFIED985entities, final VERIFIED1Store.

Bản ghi mới: 307products, 661media, 8categories, 2customers, 2orders, 1blog_category và 4foundation entities (Tenant/User/Site/PlanSubscription). SQL độc lập: products122→429, media4126→4787, categories163→171, customers14→16, orders8→10, tenants1212→1213, users1279→1280. PW1User1307→PW2User1354, created_by_id7. Fingerprints toàn system User7 row, roles, memberships và permissions trước/sau giống nhau. Ledger có thêm claim external creator User7; đây là tài khoản được dùng lại, không phải User mới thứ hai.

Đã chạy 149tests/7files liên quan và typecheck PASS (các nhóm chạy riêng; audit12, projection27, v3contract55, v2contract19, runner14, selectors/runtime17, artifact/credentials5). Store636 thực tế đã verify; chưa chạy replay/resume trên batch thật này và chưa xác nhận toàn bộ2799Stores. Media là metadata/URL theo master, không upload lại file. Pages vẫn ngoài phạm vi.

Lần chạy trước dừng trước batch/business writes ở TARGET_DIAGNOSTIC_SOURCE_MISMATCH: tám description diagnostics thuộc product chỉ đóng góp vào sites.pw1_source, không có operational Product trong master. Đã sửa bằng bằng chứng source archive + absence from emitted products, thêm regression test; không sửa artifact để vượt lỗi.

## Import vào DB local hiện hữu

Operator đã cho phép import trực tiếp `primeweb` tại `localhost:5433` từ `.env.local`. Backup trước migration schema: `/tmp/pw1-local-before-636-20260917.dump` **bên trong container `primeweb-db`**. Ba schema helper và target schema verifier đã chạy thành công. Creator binding riêng cho DB này giữ tại `$PW1_ROOT/local-20260917/creator-bindings-local-51.json`; không dùng binding của clone.

Artifact chuẩn bị thành công: `$PW1_ROOT/local-20260917/prepared-v3-local/import-manifest.json`. Chạy từ shell dùng `.env.local` của ứng dụng, không nạp `clone.env`:

```bash
npm run migrate:pw1:import -- \
  --manifest "$PW1_ROOT/local-20260917/prepared-v3-local/import-manifest.json" \
  --store 636 --local-database primeweb
```

Resume trên DB hiện hữu cũng cần `--local-database primeweb`, cùng artifact, code và keys của batch. Không đổi source hoặc tự xóa ledger để vượt kiểm tra resume.

Importer phân biệt field đã mapping với field chỉ lưu trong source archive. Chỉ bỏ blocker về field archive đã được xét duyệt khi report chứng minh field không đóng góp vào target; field không biết hoặc còn đóng góp vào target vẫn chặn. Cảnh báo URL trong product/blog chỉ thuộc `sites.pw1_source` được loại khỏi phạm vi khi không có product/blog tương ứng được emit. Rich text operational vẫn được kiểm tra link. Online gateway chưa kích hoạt chỉ được loại khỏi scope nếu master tắt rõ ràng toàn bộ online payment flags; order có payment method chưa biết giữ `null`, không tự suy ra COD. Shipping source chỉ được thay bằng PW2 defaults khi policy hash đã được phê duyệt.

## Store205 actual import — VERIFIED, 2026-09-17

Operator xác định PW2 system user là `sso-service@primeweb.app`. Đã lookup chính xác trên clone và tạo binding PW1User51→PW2User7; không hardcode creator trong master/code và không map các actor khác tự động. Binding/evidence giữ private ngoài Git, khóa theo actor artifact, snapshot, DB identity và target User identity.

Prepare mới **exit0 PREPARED**: `$PW1_ROOT/local-20260917/prepared-v3-system/import-manifest.json`. Actual CLI `--store 205` **exit0 VERIFIED** trên clone `pw1_import_1886_real_20260917`, batch `json:2d61fef5-3689-4d03-80da-265823fd1540`. Preflightcreates4/reuses0, STORE_VERIFIEDentities4: Tenant, User, Site, PlanSubscription. Creator và subscription target checks đã qua.

SQL đối chiếu độc lập: tenants1212→1213, users1279→1280, sites1203→1204, plan_subscriptions1266→1267, importbatches0→1. PW1User432 được tạo thành PW2User1354, `created_by_id=7`. Fingerprint toàn bộ system User row không đổi; role/membership/permissions child-table fingerprints không đổi. Không có cập nhật DB gốc hoặc live deployment.

Đây là nghiệm thu một Store có4foundationentities. Chưa xác nhận dữ liệu commerce thật ở các Store khác, cũng chưa chạy replay/resume với chính snapshot thật này (synthetic evidence riêng ở dưới). Các trạng thái BLOCKED trong những phần lịch sử phía dưới đã được giải quyết cho Store205.

Lệnh đã chạy, sau khi nạp private clone.env:

```bash
npm run migrate:pw1:import -- --manifest "$PW1_ROOT/local-20260917/prepared-v3-system/import-manifest.json" --store 205
```

## Sửa phạm vi theo master — lịch sử trước creator binding 2026-09-17

Lỗi nguồn mồ côi ngoài dependency của Store được giữ trong diagnostic report với disposition `OUT_OF_SCOPE`, không chặn import. Bằng chứng gồm parent không tồn tại trong source report đã xác minh, cả source identity lẫn parent không được selected master/chuỗi creator tham chiếu, và row không đóng góp vào Store được chọn. Chỉ loại summary toàn bảng khi tất cả unresolved rows đều được chứng minh ngoài scope. Không bỏ qua hash/schema lỗi, unknown diagnostics, reference thiếu hoặc target conflict. `--all` chỉ xét Store có trong master; Store bị exporter chặn và không được emit vẫn có lỗi trong report nhưng không tham gia selection. Yêu cầu đích danh một Store không có trong master vẫn bị từ chối. Index dependency riêng có giới hạn64MiB/1triệu keys; nội dung giống reference cũng được giữ một cách bảo thủ, không dùng để ghi quan hệ mới.

**Đã chạy lại apply Store205 trên clone local:** whole artifact/receipts PASS, không còn `ARTIFACT_BLOCKED` vì role5753; dừng ở `CREATOR_BINDINGS_REQUIRED` (exit3). Master thực sự tham chiếu external creator User51 và prepared artifact chưa có creator binding. Không tự map bằng tên/email hoặc tự gán targetUser7. Cảnh báo subscription vẫn chưa được discharge vì creator resolution chạy trước.

Sau lần chạy: tenants1212, users1279, sites1203, plan_subscriptions1266 không đổi; migration_import_batches0. Chưa actual-source apply thành công.132tests/7files + typecheck PASS;55v3cases. Các kết quả3orphan blockers bên dưới là lịch sử trước bản sửa này; không còn yêu cầu một quyết định riêng để bỏ role5753 khỏi Store205.

`ARTIFACT_CHECKED.blockers` là số raw blockers do exporter ghi cho toàn snapshot, không phải số lỗi đang chặn Store được chọn. Lỗi thực sự chặn được trả qua `BLOCKED`/error code sau khi áp dụng scope.

## Exporter1.2 / profilev3 hiện tại

Exact exporter1.2 contract27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567 dùng import version3/profile`pw1-json-v3`, không nâng version trong batch cũ. Giữ v1/v2 dispatch riêng. Prepared manifest, credential AAD và batch pin classificationVersion, `customer-reconciliation.json` và `product-reconciliation.json` hashes. Receipts kiểm source ownership, customer/address coverage và Product SKU/tier paths; null/quarantined target không được biến thành record importable.

Loader xác định selected inventory trước spool. Master→report→receipts không phụ thuộc thứ tự artifacts; report diagnostics/rows đọc hai lượt cùng hash để không phụ thuộc JSON key order. Classifier được duyệt nâng estimated metadata budget lên256MiB theo đo đạc thực tế; accounting bao gồm cả diagnostic ownership checks đã được review; actual structural revalidation đã qua; semantic preflight vẫn blocked. Diagnostic collector giữ budget128MiB riêng; source-count cap1triệu không đổi. Duplicate leaf source identities vẫn bị từ chối sau compression. Đây không phải cam kết256MiB RSS cho toàn pipeline.

Publication classification-001 đã qua whole-master coverage/hash, typed classification và cả hai receipts trên fresh real clone; không còn memory/classification structural failure. Lệnh prepare ban đầu từng exit2 `CLASSIFICATION_MEMORY_LIMIT`; kết quả loader/CLI sau đó mới xác minh được bản copy tại `$PW1_ROOT/local-20260917/prepared-v3-preflight/import-manifest.json`. Không đổi exit lịch sử thành prepare exit0.

**Dry-run trước bản sửa scope: exit3 `ARTIFACT_BLOCKED`, blockerCount3**, đều thuộc một orphan `model_has_roles` sourceId`record:5753`, parent`users:5753`: `SOURCE_OWNERSHIP_UNRESOLVED`, `SOURCE_FIELDS_UNRESOLVED`, `REPORT_ROW_UNRESOLVED`. CSV5893Users đã kiểm tra không có parent5753. **5753 là ID, không phải số lỗi/Store**. Không còn Page blocker, artificial classification failure hay memory-limit error. Hai target checks vẫn pending: subscription no-cancellation warning và creator binding; chưa chạy đến target verification vì source gate dừng trước.

Fresh real clone `migration_import_batches` count0 sau dry-run; không actual-source batch/apply. Trước bản sửa scope, creator binding và orphan role từng là hai điều kiện chặn; trạng thái hiện tại xem đầu tài liệu. Không blanket-ignore, không gọi kết quả này PREFLIGHT_PASSED/live-ready.

Đo classifier riêng trên922580rows: estimated metadata245398940byte (~234MiB), peakRSS526864KiB (~515MiB). Đây không phải số đo toàn loader/prepare/import. Bounded256MiB metadata không đồng nghĩa tiến trình chỉ dùng256MiB RAM.

Fresh real-source clone hiện tại là `pw1_import_1886_real_20260917`; đã restore baseline và chạy3schemahelpers hai lần PASS. Clone này tách khỏi synthetic v3 fixture. File `$PW1_ROOT/local-20260917/clone.env` chỉ chứa DATABASE_URI, mode0600, parent0700. Nạp nó trước lệnh npm để override target từ `.env.local` mà không in URI:

```bash
set -a
. "$PW1_ROOT/local-20260917/clone.env"
set +a
```

Đây là setup clone, không phải chứng nhận actual source hoặc real apply. File env không bổ sung bằng chứng creator identity hay xác minh credential keys.

## Contract v2 — bằng chứng lịch sử

Importer dispatch theo exact contract hash: publication cũ giữ `pw1-json-v1`, publication followup mới dùng `pw1-json-v2`. V2 kiểm policy, `user-actors.json`, report-row dispositions và diagnostics bằng typed evidence; hash/schema/diagnostic chưa biết vẫn block. Không sửa master để ép tương thích. Actor registry chỉ mô tả nguồn, không cho phép tạo User global.

Ngày 2026-09-17: prepare artifact thật đã thành công; dry-run Store205 đọc/verify artifact2918Store nhưng **exit3 `ARTIFACT_BLOCKED`**, chưa apply dữ liệu thật. Blocking count226485 gồm diagnostics gốc và unresolved row/field được sinh thêm, trong selected/global scope; đây không phải số Store lỗi hay raw blocker count của exporter. Các mã gồm `SUBSCRIPTION_CANCEL_FLAG_ABSENT`, `SOURCE_FIELDS_UNRESOLVED`, `REPORT_ROW_UNRESOLVED`; creator binding vẫn là prerequisite chưa giải quyết. Global/shared-source unresolved không được bỏ qua khi chỉ chọn một Store.

## Chuẩn bị

Dùng bản sao riêng của DB hiện hữu; app/jobs/outbound thật không được nối vào clone. Đặt `DATABASE_URI` trỏ clone trong môi trường private cùng `PAYLOAD_SECRET`. Không đưa URI/secret vào command hoặc report. Credential recovery cần `PW1_APP_KEY`, `SSO_ENCRYPTION_KEY` của target và `PW2_MIGRATION_SECRET` ít nhất32byte cho sidecar. Không rotate khóa giữa các lần resume. Giữ env trong file0600 ngoài Git, thư mục0700. Preload có thể đọc `.env.local`, vì vậy phải nạp env clone đã kiểm tra trước để tránh dùng nhầm target; giá trị đã có trong process env được giữ nguyên. Ví dụ đường dẫn dưới đây là placeholder, thay bằng volume private có đủ dung lượng:

```bash
export PW1_PRIVATE_ROOT=/absolute/private/pw1
set -a
. "$PW1_PRIVATE_ROOT/import.env"
set +a
export TMPDIR="$PW1_PRIVATE_ROOT/tmp"
```

Tạo trước thư mục temp0700; không đưa master/CSV/secret/evidence vào worktree. Không in env ra terminal/log.

Artifact exporter phải có `master-manifest.json`, master và các file/report có hash khớp. Credential CSV là **full users CSV cùng snapshot exporter**, có hash/header order/row count đúng manifest; không tự rút gọn vài User. Thiếu credential cần thiết sẽ block. File private0600, thư mục0700, ngoài repository; parent output phải có sẵn, output mới chưa tồn tại.

Chỉ sau khi kiểm tra `DATABASE_URI` đúng clone, chạy schema setup riêng:

```bash
npm run db:migrate
npm run migrate:pw1:prepare -- \
  --export-artifact "$PW1_PRIVATE_ROOT/export-snapshot" \
  --credentials "$PW1_PRIVATE_ROOT/source/users.csv" \
  --creator-bindings "$PW1_PRIVATE_ROOT/creator-bindings.json" \
  --output "$PW1_PRIVATE_ROOT/import-snapshot"
```

`db:migrate` là migration repo, **không có clone guard của importer**; phải xác minh target trước lệnh này. Prepare không ghi DB; tạo `import-manifest.json`, bản sao artifact và `credentials.enc` nếu có. `--credentials` có thể bỏ chỉ khi phạm vi không cần tạo User có credential. Prepare không nhận các flag master/source-instance/mapping của bản thiết kế cũ. `--creator-bindings` cần khi selected business User tham chiếu external creator; prepare structural có thể thành công khi thiếu binding nhưng apply vẫn bị chặn. Schema v2 gồm tenant+slug unique cho Product/Blog/BlogCategory, Product description không giới hạn300; riêng importer giữ toàn bộ ảnh lịch sử, thao tác thông thường giới hạn5 ảnh và historical Order product link nullable. Importer có verifier đọc riêng, không coi `db:migrate` exit0 là đủ bằng chứng schema đúng.

## Creator binding và evidence

Target actor phải là User đã tồn tại, có quyết định identity mapping được operator có thẩm quyền cung cấp. Không dùng email/name khớp làm chứng minh, không lấy sourceID làm targetID. CLI kiểm exact identity/checksum và claim, không xác thực danh tính người ký quyết định; `approvedBy` là **operator assertion**, không phải chữ ký hay role grant. Không tạo evidence thật từ ví dụ này để vượt gate.

Binding và từng evidence file phải nằm ngoài repository, file0600 trong thư mục0700. Hai JSON dưới đây là template hoàn toàn fictitious: thay toàn bộ giá trị demo/placeholder bằng dữ liệu và quyết định đã xác minh. Các placeholder hash không hợp lệ để chạy trực tiếp.

`creator-bindings.json`:

```json
{
  "version": 1,
  "sourceInstance": "demo-source",
  "sourceDatabase": "demo-db",
  "sourceInstanceToken": "demo",
  "snapshotId": "demo-snapshot",
  "actorArtifactHash": "<sha256-exact-user-actors-json>",
  "targetIdentityHash": "<verified-local-target-identity-hash>",
  "entries": [{
    "sourceRef": "@users:users:900",
    "targetUserId": 10,
    "targetUserIdentityHash": "<verified-target-user-identity-hash>",
    "provenanceKind": "operator-approved",
    "evidenceRef": "/absolute/private/pw1/creator-decision-900.json",
    "evidenceHash": "<sha256-exact-evidence-file-bytes>"
  }]
}
```

`creator-decision-900.json` (strict schema, không thêm `version` hoặc free-text fields):

```json
{
  "sourceInstance": "demo-source",
  "sourceDatabase": "demo-db",
  "sourceInstanceToken": "demo",
  "snapshotId": "demo-snapshot",
  "actorArtifactHash": "<sha256-exact-user-actors-json>",
  "targetIdentityHash": "<verified-local-target-identity-hash>",
  "sourceRef": "@users:users:900",
  "targetUserId": 10,
  "targetUserIdentityHash": "<verified-target-user-identity-hash>",
  "decision": "approve-existing-creator-binding",
  "approvedBy": "demo-authorized-operator",
  "approvedAt": "2026-09-17T00:00:00Z"
}
```

Hash là64 ký tự hex thường. Evidence hash tính trên byte file sau khi lưu, kể cả newline; mọi provenance/identity field phải khớp binding. Target identity tính bằng `localTarget(...).identity`; User identity bằng `actorTargetIdentityHash` trên id/email đọc từ target. Không đưa email/credential vào binding. `legacy-claim` yêu cầu thêm active authoritative source claim tương thích; không chỉ đổi nhãn để bypass.

Chỉ `users.createdBy` được resolve external actor. Shared actor dùng một active owner SKIP (`ownsBusinessRow=false`) và consumer dependencies; không sửa actor password/SSO key/role/membership. Binding nhiều source actors vào cùng target User bị chặn cả trong file và qua active claims trước đó. Actor ancestor chỉ để kiểm chain không cần target account, trừ khi được selected User tham chiếu trực tiếp.

## Dry-run và import

```bash
npm run migrate:pw1:import -- --manifest "$PW1_PRIVATE_ROOT/import-snapshot/import-manifest.json" --store 205 --dry-run
npm run migrate:pw1:import -- --manifest "$PW1_PRIVATE_ROOT/import-snapshot/import-manifest.json" --store 205
npm run migrate:pw1:import -- --manifest "$PW1_PRIVATE_ROOT/import-snapshot/import-manifest.json" --stores 205,285
npm run migrate:pw1:import -- --manifest "$PW1_PRIVATE_ROOT/import-snapshot/import-manifest.json" --from-store 100 --to-store 300
npm run migrate:pw1:import -- --manifest "$PW1_PRIVATE_ROOT/import-snapshot/import-manifest.json" --all
```

Mỗi run mới chọn đúng một chế độ. Range inclusive chỉ lấy Store tồn tại trong artifact; ID được yêu cầu đích danh nhưng thiếu là lỗi. `--all` không tìm Store ngoài snapshot. Dry-run đọc DB bằng connection read-only, không tự tạo schema/ledger. Apply preflight lại toàn bộ selection rồi ghi tuần tự; dừng khi gặp lỗi.

## Resume và lỗi

```bash
npm run migrate:pw1:import -- --resume json:BATCH_UUID
npm run migrate:pw1:import -- --resume json:BATCH_UUID --from-store 205
```

Lấy ID thật từ `BATCH_READY`; không dùng UUID child run. Resume không nhận manifest/list/all/dry-run mới. Cursor không được vượt Store chưa verified đầu tiên. Giữ nguyên artifact, secret, code và schema: thay đổi binding bị chặn. Sau bugfix cần restore **disposable clone** về baseline rồi chạy batch mới; không sửa ledger/xóa claims hoặc dùng namespace mới để né conflict. Không có rollback tổng quát; guard DB chặn release/delete claims khi đã có JSON batch, nhưng không thay cách ly storage/outbound của binary cũ.

| Exit | Ý nghĩa / hành động |
|---|---|
| 0 | Dry-run passed hoặc selected scope verified; không đồng nghĩa live-ready |
| 2 | Sai arguments/selector; prepare cũng dùng2 khi chuẩn bị thất bại |
| 3 | Conflict, artifact/schema/credential blocked; xử lý nguyên nhân, không force |
| 4 | Interrupted hoặc retry transaction đã hết; giữ batch để resume |
| 5 | Outcome chưa rõ do connection; resume đối soát ledger trước retry, không xóa bù |
| 6 | Không có Store phù hợp; zero writes |

CLI xuất JSON lines đã sanitize; lưu output trong thư mục private nếu cần evidence. DB ledger là nguồn trạng thái chính, không phải file log.

## File lớn và dung lượng

- Input tối đa8GiB/file; strict streaming/hash, không đọc toàn bộ master vào một string.
- Cache/Store tối đa64MiB; scalar16MiB, depth128, registry tối đa1 triệu khóa. Vượt giới hạn dừng preflight; master3GB vẫn có thể chứa một Store quá lớn.
- Import tạo spool private ở temp directory, cần trống ít nhất `2 × master size + 64MiB`. Prepare cần thêm tổng dung lượng artifact copies và sidecar. Kiểm tra cả volume output lẫn temp trước chạy.
- Benchmark riêng parser+SHA: JSON synthetic3,221,225,475byte,49,153 root items bị discard,10.64s, peakRSS98.52MiB. Đây **không phải** thời gian import master3GB hoặc toàn bộ business data.

## Local end-to-end rehearsal

Lệnh tạo synthetic fixture, chạy prepare/dry-run/apply/SIGINT/resume/cross-run REUSE và independent SQL checks trên **disposable clone đã có schema**. Nó thực sự ghi fixture và cuối run cố ý tạo target drift; không dùng clone đã chạy làm baseline dữ liệu thật. Các flag dưới đây không phải CLI flags của importer:

```bash
PW1_TEST_DATABASE=pw1_import_1886_v3_20260917 \
PW1_TEST_ARTIFACT="$PW1_PRIVATE_ROOT/rehearsal-new" \
PW1_TEST_FULL=1 PW1_TEST_TWO=1 PW1_TEST_V3=1 PW1_TEST_INTERRUPT=1 \
npm run migrate:pw1:test:local
```

`PW1_TEST_ARTIFACT` phải là thư mục mới chưa tồn tại. Harness yêu cầu tên DB `pw1_import_1886_*`, kết nối localhost5433, lấy credential DB từ env private; `PW1_TEST_V3=1` kiểm exporter1.2/receipts và bao gồm các checks v2; bắt buộc FULL+TWO. Dùng `PW1_TEST_V2=1` thay V3 khi cần fixture contract cũ. Fixture tự sinh synthetic crypto keys riêng; không suy kết quả này thành credential recovery nguồn thật.

## Dung lượng và bằng chứng cuối

Prepare thật từng bị volume `/` chỉ còn khoảng2,2GB, trong khi copy cần khoảng4,7GB. Đã prepare thành công ở `/dev/shm/pw1-real-v2-prepared-20260917`; đây là tmpfs **ephemeral**, không phải nơi lưu lâu dài/resume bền vững. Cần volume private đủ chỗ cho publication, prepared copy, temp spool và DB clone; kiểm output lẫn TMPDIR. Không chuyển master vào Git để né giới hạn đĩa.

| Bằng chứng | Kết quả / giới hạn |
|---|---|
| Schema v2 fresh clone | Root chạy migration hai lần PASS; không rewrite source data |
| Synthetic v2 local | 2Stores/18business entities/15collections; dry-run, controlled SIGINT sau Store1, resume, REUSE18 PASS |
| Preservation | 6ảnh, description350chars, nullable historical product link; PBKDF/SSO, stock0, tiền/discount, historical payment và external Media được đối chiếu |
| Shared creator | 2business Users cùng existing actor; actor row giữ nguyên; một owner SKIP và dependency consumers |
| Real prepare | PASS; publication2918Store gồm2799emitted/118blocked/1deferred; chưa là business readiness |
| Real Store205 dry-run | exit3 ARTIFACT_BLOCKED; source/global unresolved và creator prerequisite; zero real apply |

Evidence synthetic: `/tmp/pw1-cli-rehearsal-1789633701412`; clone `pw1_import_1886_v2_20260917` có fixture/drift và không còn là baseline sạch. Real dry-run private log: `/dev/shm/pw1-real-v2-prepared-20260917/dryrun-205.private.jsonl`. Private artifacts có thể mất khi reboot/cleanup; giữ bản bền vững ngoài Git nếu cần audit.

Lượt trước có63tests/7files và fixture17entities; continuation full suite81tests/8files PASS; sau path guard mới, focused19tests PASS (82distinct qua các lượt, không phải full82rerun), final typecheck PASS và fixture18entities, xem [regression evidence](../../plans/260916-1617-pw1-local-json-import/reports/260917-v2-regression-and-clone-evidence.md) để biết exact scope/lần chạy. [Creator review](../../plans/260916-1617-pw1-local-json-import/reports/260917-v2-creator-review.md) đã đóng hai lỗi source; không suy unit tests thành concurrent-actor integration pass.

Còn cần worktree2 xuất typed dispositions/evidence cho source/global unresolved, đúng credential CSV+keys cùng snapshot và actor decision/binding thật. Sau khi thay artifact/code/binding, dùng baseline clone sạch cho batch mới; dry-run lại trước apply. Store205/285 của snapshot mới chỉ có Tenant/User/Site/Subscription, không đại diện commerce; chọn richer Store theo summary hiện tại sau khi gate của Store đó đã đóng.

Lost ACK cũ chỉ là wrapper mô phỏng sau Runtime commit thật, chưa phải TCP disconnect; SIGKILL giữa entity và concurrent actor race chưa có đầy đủ evidence. Full outside-scope projection và jobs/provider effects cũng chưa được suy từ count checks. Không claim full-source migration, live readiness hoặc bảo đảm2918Store trong1ngày. Xem [plan](../../plans/260916-1617-pw1-local-json-import/plan.md) và [acceptance runbook](../../plans/260916-1617-pw1-local-json-import/acceptance-runbook.md).


## Bằng chứng v3 mới nhất

V3 ledger/schema helpers đã chạy hai lần PASS trên clone sau restore. Final full128tests/9files và typecheck PASS;46v3cases bao gồm strict receipts, classification, report rows-first parity và duplicate leaf identities. Synthetic18entities/2Stores PASS tại `/tmp/pw1-cli-rehearsal-1789638687596` trên clone `pw1_import_1886_v3_20260917`; main `json:0310dec1-122e-4c28-8caa-048b7caa449a`, replay `json:0ae8d3aa-504b-4ec6-a87d-41f4531e9ef9`. Tracked dry-run counts không đổi; apply SIGINT exit4, resume/reuse exit0; creator/credential/schema checks đúng và target drift exit3. Customer receipt2Stores/1crosswalk/1address, Product receipt1Product/1SKU được verify.

Clone rehearsal diễn ra trước final two-pass/duplicate-reader hardening; full tests và typecheck chạy sau các sửa này, không DB rerun. Không suy synthetic outcome thành real credentials/creator approvals hoặc orphan-role row `record:5753` đã được xử lý. [Phase07](../../plans/260916-1617-pw1-local-json-import/phase-07-exporter-12-compatibility.md) giữ các gate nguồn thật còn mở; [review v3](../../plans/260916-1617-pw1-local-json-import/reports/260917-v3-classification-review.md) ghi đúng fixes và giới hạn.


Store205 credential check: STORE205_CREDENTIAL_CRYPTO_VERIFIED exit0; v3sidecarAEAD, fullmasterhash streaming, LaravelMAC/decrypt, bcryptmatch và SSOkeyshape PASS, không DB writes. Đây là kiểm chứng crypto cho Store205, không chỉ presence env và không chứng nhận mọi User/Store hoặc DB-import roundtrip.

### Giới hạn ảnh sản phẩm — xác minh 2026-09-18

Tạo sản phẩm và thêm ảnh thông thường giới hạn 5 ảnh ở cả form và Payload. Importer dùng context nội bộ để giữ toàn bộ ảnh PW1. Sản phẩm đã có hơn 5 ảnh vẫn được hiển thị đầy đủ, lưu thay đổi thông tin, sửa alt và xóa ảnh; không được thêm/thay bằng ảnh mới khi tổng vẫn vượt 5. Muốn thêm ảnh mới phải giảm gallery xuống dưới 5. Không cắt ảnh cũ trong DB.

Xác minh: 34 unit tests PASS; browser TC-F42-076 lưu gallery 8 ảnh không mất ảnh, chặn thay ảnh khi còn 8 và thêm ảnh thứ 6 sau khi giảm về 5. Rehearsal trên clone giữ đủ 6 ảnh và PASS ngắt/resume/replay, evidence `/tmp/pw1-cli-rehearsal-1789701892910`. Các blocker chạy toàn bộ store đã nêu ở trên vẫn cần xử lý riêng.

### Quy tắc creator gốc PW1 — 2026-09-18

Theo quyết định operator: riêng `users.createdBy = @users:users:1` được chiếu sang PW2 `createdBy = null`. Không tạo user ID0 và không cần creator binding cho User1. Master/actor artifact vẫn giữ nguyên để truy vết; các creator khác (bao gồm User51 → User7 theo binding hiện có) không đổi. Quy tắc áp dụng khi import mới; không tự cập nhật user đã migrate. Checksum và verifier dùng cùng projection; nếu target cũ khác projection mới, vẫn chặn conflict. Không resume batch cũ bằng code fingerprint mới.

## Exporter 1.4: raw source retained in CSV

Exporter 1.4 uses contract `367ad0adb899cfcbc59c4d44cbd735d545419ca7b0afd53491420b112b0bf43a` with the existing `pw1-json-v3` import profile. `sites[].pw1_source` is no longer embedded. Original CSV files remain external and are bound by the export manifest hashes; no extra raw JSON sidecar is required.

Report contributions use `MASTER-4.1-EXTERNAL-CSV-ARCHIVE` / `source-csv.<table>`. These fields are retained source evidence, not imported values. The importer checks the reviewed table/field allowlist and matching contribution identity/path before accepting retention. Unsupported or missing evidence remains a classification blocker. Pages and menus keep their existing scope. Existing 1.2 and 1.3 contract pairs remain supported; do not relabel an old artifact.

Validation for this change: 175 importer tests passed; TypeScript passed. This does not establish that all production Stores are ready for DB import.

## Exporter 1.5: kết quả export độc lập với import readiness

Importer nhận đúng cặp exporter 1.5/hash contract, kiểm lại outcome từ diagnostics và bằng chứng contribution CSV. `status=exported` không bỏ qua blockers hoặc kiểm tra DB. Fidelity rich text ở đúng table/field đã duyệt được chuyển sang approved policy; URL unsafe, missing media và mã lạ vẫn chặn. Target blog slug dùng được cả tên collection `blogs` và bảng nguồn `blog_posts`, cùng kiểm tra tenant index hiện có.

Bắt đầu đọc `export-review.md` của artifact: data_issue, import_requirement, delegated_content, outside_scope, warning. Prepare chỉ kiểm tra artifact, không chứng nhận đã có credentials/creator binding hoặc mọi Store importable.

## Exporter outcome 1.5.1 — 2026-09-18

Importer accepts the exact 1.5.1 mapping hash and recomputes its corrected outcome. Artifact 1.5.0 retains its frozen schema and calculation for compatibility. Diagnostics for explicitly policy-excluded Stores do not contribute to active data issues. Payment-method and absent subscription-cancellation warnings remain target requirements, not unconditional warnings.

Global `frontend_templates` CSV-only evidence is registered for the selected consuming Store before the owned-row guard. Classification still requires valid consumer ownership and allowed external fields; mixed retention, foreign or missing consumers and unverified evidence remain blocked. Successful prepare validates the artifact package, not database prerequisites or readiness of every Store.

## Product descriptions — exporter 1.6.0

Accepts the exact 1.6.0 contract/hash. Product EN/MS descriptions now carry the exact source string in one Lexical text node (root → paragraph → text), including source HTML; this is a preservation envelope for the separate rich-text workflow, not rendered HTML. No media refs are extracted from descriptions. Old contracts and their diagnostic gates remain supported. No DB schema change or automatic update of previously imported descriptions is performed.

## Blog owner fallback — exporter 1.6.1

Accepts the exact 1.6.1 version/hash. Exporter keeps a resolved Blog author; otherwise it references the unique emitted owner of that tenant. Importer resolves this ordinary User reference to the target User ID. No new User is created just for authorship, and historical artifacts retain their existing gates.

## Blog content — exporter 1.6.2

Accepts exact 1.6.2 version/hash. Primary Blog content is preserved as one Lexical text node containing the untouched source string. content_ms remains in external CSV by user decision; no new locale field or concatenation. Thumbnail and other source/target gates are unchanged.

## SKU option reconciliation — exporter 1.7.0

Accepts the exact1.7.0 version/hash. Exporter may recover missing domain definitions from existing eligible SKU selection rows with verified live same-Store attributes/values, retaining crosswalks and definition contributions. No SKU synthesis, duplicate winner selection or stock merge. Existing source/receipt and target gates remain enforced; fixture export → validator → prepare passed.


### Exporter 1.8.0: Product thiếu giá/stock

Chấp nhận đúng contract 1.8.0 và warning PRODUCT_MISSING_PRICE_STOCK_EXCLUDED sau khi kiểm tra productExclusion + field retention, Product root/warning cùng Store/reason, SKU parent, không có operational contribution và Product không còn emit. Dòng con được giữ CSV, không phát sinh REPORT_ROW_UNRESOLVED chỉ vì đã bỏ Product. Không miễn số sai, ownership/status sai hoặc Order/discount độc lập. Artifact cũ cần export lại; không sửa hash/diagnostic để vượt gate.
