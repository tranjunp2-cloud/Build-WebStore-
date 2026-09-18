# Technical contract — local JSON profile v1

Status: implemented local profile; real-master acceptance còn mở. Contract này ưu tiên quyết định mới nhất của người dùng hơn đoạn enrollment/no-decrypt trong research cũ.

## Artifact và secret

Thư mục ngoài repo `/home/liam/migration-data/pw1/<snapshot-id>/`: `master.json`, `master-manifest.json`, `import-manifest.json`, `credentials.enc` nếu có; CLI xuất JSON lines sanitized; operator có thể lưu riêng trong `runs/<run-id>/`, không có report-file authority tự động. Directory0700/file0600, không đưa vào Git, public Media bucket hoặc API response. Master/raw cũng chứa PII và có thể dns_token; không coi là public.

Import manifest hiện dùng version/profile, sourceInstance/sourceDatabase, snapshotId/asOf, mappingHash/masterHash, credentialHash và exporterManifestHash. Exporter manifest/report giữ inventory/dispositions và chứng cứ nguồn. Bind authenticated metadata vào AEAD sidecar; hash không thay authenticity. Đọc/hash/validate cùng immutable snapshot bằng strict streaming hoặc cơ chế phù hợp file lớn, giới hạn per-Store/index/RAM, reject duplicate keys/symlink replacement; không ghép toàn file thành UTF8 string. Xem [handoff exporter](reports/exporter-handoff.md). Không tự tìm file mới nhất.

PW1_APP_KEY, PW2_MIGRATION_SECRET (artifact encryption key) và SSO_ENCRYPTION_KEY tách vai trò; DB/PAYLOAD secrets giữ như môi trường target. Không rotate SSO key đang dùng. Nếu thêm env mới, cập nhật cả staging/production examples bằng placeholders. Sidecar input conversion dùng primitive worktree; mất/sai secret dừng trước write phụ thuộc. Không log plaintext/ciphertext/raw driver object. Giữ artifact/key tới hết nghiệm thu và cửa sổ recovery đã thống nhất, không cleanup tự động.

### Đóng gói credential một lần

Command local `npm run migrate:pw1:prepare -- --export-artifact /absolute/export-dir --credentials /absolute/legacy-credentials.csv --output /absolute/import-snapshot-dir`. Thin wrapper xác minh master-manifest.json/report của exporter, lấy source/snapshot identity đã pin và bind export hashes; dùng parser/recovery contract worktree và AEAD hiện hữu để tạo credentials.enc+import manifest riêng; không in secret, không sửa master business, không overwrite snapshot có sẵn. Source CSV đọc từ vị trí private, không đưa password/key_string vào command arguments. Manifest/source identity phải được cung cấp/xác minh rõ; command không đoán sourceInstance khác namespace legacy. Nếu chuẩn bị sidecar không kịp thì credential-dependent create bị BLOCKED, không bắt operator tự mã hóa bằng lệnh thủ công tùy ý.

### Timestamp default ngày đầu

Record có timestamp đã map: giữ chính xác instant. Với7User/2Site và13embeddedMedia thiếu history: đề xuất dùng một run.startedAt cố định cho technical createdAt/updatedAt bắt buộc, ledger lưu SOURCE_TIMESTAMP_UNAVAILABLE theo từng field; không ghi đây là thời gian PW1, không mượn ngày cha. <!-- Review R5: repeatable technical timestamps -->
Policy này phải được thể hiện trong preflight như một phần contract được nghiệm thu. Lưu effective technical timestamp trong operation ledger của CREATE; retry cùng operation dùng lại giá trị đó. Khi run mới REUSE, đọc provenance/timestamp đã persist của owner, không so với run.startedAt mới. Record existing không có provenance thì missing-source field là unspecified: giữ timestamp target, ghi provenance unavailable; không suy ra source history và không overwrite. Trường source có timestamp vẫn phải khớp chính xác. Business historical fields Order/Product/Customer/Discount/subscription thiếu trái mapping vẫn BLOCKED; không fallback run.startedAt. Nếu người dùng yêu cầu exact source time cho User/Site thì chuyển các record đó thành BLOCKED tới khi bổ sung nguồn.

## CLI đã triển khai

```bash
npm run migrate:pw1:import -- --manifest /absolute/path/import-manifest.json --store 205 --dry-run
npm run migrate:pw1:import -- --manifest /absolute/path/import-manifest.json --store 205
npm run migrate:pw1:import -- --manifest /absolute/path/import-manifest.json --stores 205,285
npm run migrate:pw1:import -- --manifest /absolute/path/import-manifest.json --from-store 100 --to-store 200
npm run migrate:pw1:import -- --manifest /absolute/path/import-manifest.json --all
npm run migrate:pw1:import -- --resume <run-id>
npm run migrate:pw1:import -- --resume <run-id> --from-store 205
```

Exactly one selector cho run mới; inclusive range chỉ chọn Store có trong snapshot, explicit missing ID là lỗi. ID là decimal string, numeric sort không mất precision; dedupe list, reject negative/fraction/unsafe coercion. `--all` không query Store ngoài artifact. No-match exit riêng, zero writes, không full success.

Resume không đổi manifest/selector/target tùy ý: lấy binding từ DB rồi validate local artifact cùng bytes/code/schema. `--from-store` khi resume chỉ được bằng Store chưa verify sớm nhất (hoặc điểm đã verify trước đó để kiểm tra lại); không được nhảy qua Store lỗi. Store100 phải tồn tại trong selected run; mẫu205/285 dùng205 làm ví dụ fault thực tế. Không có `--force`, `--skip-errors`, automatic UPDATE hoặc rollback-all.

Dry-run không ghi DB/DDL, kể cả ledger/lease; chỉ xuất proposal JSON lines. Apply luôn preflight lại và kiểm tra baseline trong transaction, không tin proposal cũ. Exit0 chỉ khi selected required scope đã verified; đề xuất2 invalid input,3 conflict/blocked,4 interrupted/retry exhausted,5 unknown outcome cần reconcile,6 no-match. Codes cần cố định trong CLI help và runbook.

## State và tính nguyên tử

<!-- Review R1: durable batch identity -->
CLI `RUN_ID` là **ID batch JSON** (hiển thị `json:<uuid>`), khác UUID child run trong `migration_runs`. Một Store cũng tạo batch một phần tử. Tạo bảng SQL nội bộ `migration_import_batches` (không phải Payload collection): batch_id UUID PK, profile_version, binding JSONB immutable, selected_store_ids JSONB ordered, state, created_at/updated_at. Binding chứa snapshot/artifact locators và hashes, source/target, policy/writer/code/schema hashes. Thêm nullable batch_id FK vào migration_runs và unique(batch_id,source_store_id); legacy rows giữ NULL. Schema SQL qua db-setup, không tạo migration API.

Khởi tạo batch + child run IDs cho **toàn bộ** selected Stores trong một transaction sau preflight. Child chưa chạy ở PREFLIGHT_PASSED; chỉ một child được APPLYING tại một thời điểm. Batch terminal status suy từ tất cả child states, không chỉ child gần nhất. --resume json:<uuid> đọc batch từ DB, verify binding, re-verify prefix rồi bắt đầu child chưa VERIFIED sớm nhất. Hard kill sau child commit/trước batch summary không mất Store tiếp theo vì membership đã persist. Local report/checkpoint files không được quyết định membership. Legacy batch.ts chỉ reuse parser/ordering phù hợp, không reuse file checkpoint làm authority.

Flag matrix: run mới yêu cầu --manifest và đúng một trong --store / --stores / cặp --from-store+--to-store / --all; chỉ thêm --dry-run tùy chọn. Resume yêu cầu --resume và chỉ cho thêm --from-store; reject --manifest, --store, --stores, --to-store, --all, --dry-run khi resume. Cursor phải có trong selected list và không sau Store chưa verify sớm nhất. Tất cả child đã VERIFIED thì re-verify và trả kết quả toàn batch. Không nhận raw child UUID để resume batch.

Per-Store run dùng ledger profile JSON có version; States logic: planned → applying → verifying → verified; lỗi → paused/blocked/reconcile-required. Tên DB enum cụ thể phải tương thích migration schema legacy.

Mỗi entity/aggregate transaction: assert Store lease+fence → read/lock source claim và target baseline → resolve refs ownership → write entity/children → write ledger/xref/checkpoint → recheck fence/expiry → commit. Không transaction cả Store; partial Store chỉ trong môi trường cách ly. Mọi nested Payload operation dùng cùng req và awaited; transactionID session thiếu phải fail closed thay vì adapter fallback connection ngoài transaction.

Claim key giữ `(source_system, source_instance_id, source_entity, source_id)`. Map `_ref` sang namespace legacy thật, gồm stores/sites/users/media/store_favicon/store_logo và audit/deferred dispositions cần hiểu rõ. Không đổi sourceInstance/namespace để né unique claims. REUSE yêu cầu target tồn tại, ownership và canonical projection đúng; cùng email/slug/URL hoặc run cũ VERIFIED không đủ. Claim có target mất/xóa là conflict, không tự hồi sinh.

Profile JSON phải bind master/credential/mapping/writer/code/schema/target hashes và source identity. Existing `pw1_app_key_fingerprint NOT NULL` phải migrate có version/profile semantics, không bịa placeholder fingerprint. Thêm importer_profile mặc định legacy cho rows cũ; JSON v1 được đánh dấu riêng. Khi không có credential recovery, app-key fingerprint NULL là truthful; nới NOT NULL có CHECK giữ yêu cầu non-null cho legacy, JSON required khi có recovery. Tương tự source_database/source_schema_fingerprint: lấy provenance thật nếu có, nếu không có thì cho phép NULL có điều kiện JSON profile và lưu input-schema hash riêng, không gọi hash JSON là schema DB PW1. Giữ source_instance_id bắt buộc trùng namespace nguồn thật; thiếu bằng chứng identity thì block. Preserve legacy records/index. **Legacy verifier/rollback phải reject JSON-profile runs** trừ khi có dispatch verifier đúng; rollback cũ chỉ bốn collection, không được xóa output mới. Không cung cấp generic rollback trong CLI ngày đầu.

<!-- Review R3: consumers protect legacy owners too -->
REUSE ghi migration_entity_map action=SKIP, claim_active=false, canonical checksum và detail.disposition=VERIFIED_REUSE; thêm nullable depends_on_entity_map_id FK tới claim owner (ON DELETE RESTRICT). Các dependency khác của CREATE/pass2 cũng phải được lưu trong detail theo source key + producer mapping ID. Không chỉ chặn rollback JSON-profile: entrypoint rollback legacy và bước khóa/xóa phải kiểm tra active consumers thuộc mọi profile, kể cả refs trong JSON, rồi block. Serialize với cùng producer claim locks để chống reuse/rollback race. Trong ngày đầu, fallback đơn giản là disable **toàn bộ legacy rollback trên target có bất kỳ JSON batch** bằng guard trong command; không chỉ một lời nhắc runbook. Không chạy binary rollback cũ từ worktree khác trên clone. Rehearsal recovery dùng restore riêng, không nới guard.

Retry40001/40P01 toàn transaction tối đa3 với backoff+jitter. Connection loss/commit ACK unknown: chờ transaction cũ kết thúc, tra operation key+ledger+target trước retry.23505 không SKIP mù; FK/NOTNULL/CHECK sai phải resolve. Lease mất quyền thì dừng; report disk failure sau commit chỉ rebuild report, không reinsert. SIGINT ngừng nhận entity mới, hoàn tất/rollback transaction đang chạy nếu còn kiểm soát; hard kill xử lý bằng resume.

<!-- Review R2: version-change recovery -->
Nếu phải sửa code/schema/mapping sau partial commit: ngày đầu **không hỗ trợ nâng phiên bản run tại chỗ**. Giữ evidence, ngừng mọi writer, restore disposable clone từ baseline vào đúng target clone được phép rồi tạo batch mới với binding mới. Xác minh restore không trỏ DB đang hoạt động. Trên DB không được phép restore, dừng BLOCKED và lập reconciliation riêng; không clear claims, đổi hash trong ledger hoặc retry dưới namespace khác. Resume chỉ giải quyết lỗi tạm thời khi binding không đổi. Đây là giới hạn vận hành rõ ràng của bản local, không coi bugfix xong là resume luôn được.

## Collection writer matrix — toàn bộ non-Page scope

Không tự giảm matrix này để vừa thời gian. Writer nonempty chưa hoàn thiện hoặc required source-unverified phải BLOCK; muốn thu hẹp phạm vi nghiệm thu cần quyết định người dùng ghi rõ. Count dưới đây chỉ Store205/285.

| Collection | Count | Writer/order và invariant | Disposition hiện tại |
|---|---:|---|---|
| tenants | 1/1 | Foundation; Local API guarded, preserve mapped plan/lifecycle; no default free | Required; existing plan diff conflict |
| users | 6/1 | Auth-specific create; preserve existing credentials/global role/memberships; stage optional actor refs | Required; credential disposition riêng |
| sites | 1/1 | Foundation skeleton nếu schema cho phép optional refs; media refs finalize sau; no raw spread/publish/domain automation | Required; published/draft conflict |
| media | 325/0 | Metadata adapter URL/sourceUrl, filenameNULL; ownership validation và S3-enabled read-back | Required; no binary upload |
| categories | 54/0 | Topological parent order, no cycle/depth>3/deleted parent, tenant FK | Required |
| products | 209/0 | Local API guarded; refs media/categories, arrays/variants stable; no slug suffix/SEO/SSO/stock events | Required; slug contract gate |
| customers | 54/0 | Snapshot writer guarded; tenant+normalized phone, no email-only merge; addresses≤10 | Required |
| discounts | 7/0 | Guarded writer; preserve inactive, mapped units/counters/time | Required |
| orders | 190/0 | After Customer/Product/Discount; guards preserve FK/payment/money/timestamps and no replay | Required |
| discount_usage_history | 0/0 | After Order/Discount/Customer; required FK+units+idempotency | Verified-empty mẫu; nonempty cần writer+fixture proof |
| blog_categories | 2/0 | Global slug collision check | Required |
| blogs | 7/0 | Resolve Lexical media refs sâu và tenant; preserve content projection | Required; UI rendering không nghiệm thu live |
| email-template-settings | 3/3 | After Tenant; stable template identity, no send/provider | Required |
| plan-subscriptions | 1/1 | After Tenant/User as schema demands; registry/lifecycle/asOf, no renewal/default tier | Required |
| plan-subscription-usages | 1/0 | After subscription; preserve used/limit/period, no SSO reset | Required |
| notifications | 0/0 | Không sinh notification từ hook; nguồn bị quarantine | Quarantined; không gọi verified-empty |
| subscribers | 0/0 | Không đủ chứng cứ nguồn | Source-unverified; không certify toàn dữ liệu |
| contact-submissions | 0/0 | Không đủ chứng cứ nguồn | Source-unverified; không certify toàn dữ liệu |
| analytics | 0/0 | Không replay counters/events | Source-unverified; không certify toàn dữ liệu |
| pages | 186/0 | Không writer, không sửa/xóa Page target | Out-of-scope theo user |

Order thực tế là DAG từ typed refs, không dựa thuần bảng trên. Site↔Media/createdBy forward refs chỉ pass2 nếu schema/contract cho phép và cùng run có pending repair ledger; verify chưa pass2 phải fail. Required cycles không null hóa để vượt constraint.

## Data fidelity

- Allowlist từng collection; `_ref`, `pw1_source`, raw menu/page data không spread vào write. Raw nguồn giữ artifact với disposition; secret raw không đưa vào public fields.
- Local API là mặc định sau targeted guards; Media adapter cần validator bù access/default/validation. Không chuyển toàn bộ Orders sang adapter chỉ để né hooks khi chưa kiểm chứng.
- ID top-level do target cấp; xref dùng source key. Child array IDs giữ nếu hợp lệ/unique trong scope; thiếu thì generate deterministic UUID theo sourceInstance+snapshot+parent+path+source detail, persist mapping. Index vị trí chỉ fallback trên snapshot cố định. Không append khi replay; mixed-owner array UPDATE block.
- Master money đã map, không nhân/chia100 lần nữa. Validate finite/safe integer/quantity integer theo field; stock0 hợp lệ. Discount nonzero cần fixture riêng vì190 mẫu đều0.
- Preserve mapped createdAt/updatedAt; Local API update đổi updatedAt thì controlled timestamp SQL cùng transaction sau final pass. Missing7User/2Site/13Media cần provenance/disposition; import timestamp không giả lịch sử PW1.
- Canonical verifier so projection đã allowlist, relation IDs qua xref, stable arrays, normalized allowed fields, source timestamps/dispositions; không hash toàn DB row chứa auth internals hoặc volatile fields.

## Credential và live gate

Sidecar bind source/snapshot/User ID. Laravel6 MAC/decrypt recovery từ worktree; hash PW1 nếu có kiểm tra plaintext là password hiện hành, unsupported/missing hash không được gọi verified-current-password. Payload tạo hash/salt PW2, SSO keyString mã hóa bằng key hiện hữu. Existing User tuyệt đối không reset password. Thiếu credential hoặc mismatch mặc định BLOCK User phụ thuộc, trừ policy rõ cho profile chưa kích hoạt; không tự enrollment/fallback.

New User pending và suspension chỉ hữu ích nếu auth/refresh/SSO enforce; local clone phải cách ly ngay cả khi port enforcement chưa hoàn tất. Không sửa trạng thái existing global account để cách ly một Store. Local verified không đồng nghĩa account activation approval.

Import context không bảo vệ job sau commit. Local tắt cron/webhook/outbound thật và kiểm tra predicate payment-expiry/reconcile-orders/discount-auto-inactive bằng fixture có expiry/providerIDs. Durable historical provenance/job exclusion là **gate bắt buộc trước môi trường live/Vercel**, chưa triển khai trong ngày local nếu cách ly được chứng minh. Không xóa expiry/provider fields để né job.

## Giới hạn implementation và evidence

Streaming input tối đa8GiB/file; Store/cache64MiB, scalar16MiB, depth128, registry1 triệu khóa. Import spool cần ít nhất2×master+64MiB trống; prepare cần thêm dung lượng bản sao artifact và sidecar. File lớn không đồng nghĩa mỗi Store lớn đều được hỗ trợ. [Operator guide](../../docs/migration/pw1-local-json-import.md) là cú pháp chạy hiện tại. Synthetic15collection và7DBchecks đã chạy; không gọi toàn bộ16ca hoặc actual master PASS.


## Amendment — selected master scope (user correction, 2026-09-17)

The master is the mapped operational input. Source report errors outside the selected Store dependency graph must not automatically prevent import. Keep artifact hash/schema/coverage and target validation. For a proven orphan with an absent source parent, retain its diagnostics as OUT_OF_SCOPE when neither its source identity nor parent is referenced by selected master records/reachable external creator ancestry and it has no contribution to a selected Store. Unknown/unproven global errors remain blockers; this is not a blanket waiver. Aggregate unresolved summaries require proof for every underlying row. Do not fabricate a missing reference or creator identity binding.
