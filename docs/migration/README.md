# Chạy migrate PW1 trên local

## Cách chạy chính — một lệnh

DB local cần có schema hiện tại và system user `sso-service@primeweb.app`. Lệnh không tự reset DB hay cài schema. Giữ artifact exporter đầy đủ ở ngoài source; credentials CSV phải cùng snapshot. Khai báo DATABASE_URI và các key cần thiết trong `.env.local`; không đặt key/password vào config.

Đặt `PW1_ROOT` tới thư mục riêng bên ngoài source/Git, rồi tạo `$PW1_ROOT/local.json` một lần (mẫu: `configs/migration/pw1-import-local.example.json`):

```json
{
  "version": 1,
  "exportArtifact": "./artifact",
  "credentials": "./users.csv",
  "localDatabase": "primeweb",
  "systemCreator": { "sourceRef": "@users:users:51", "approvedBy": "liam" },
  "outputRoot": "./runs"
}
```

Đường dẫn bên trong config tính từ thư mục chứa config. `sourceRef` là actor PW1 đã xác minh cho snapshot, không phải ID user PW2. Có thể dùng `creatorBindings` trỏ binding hiện có thay cho `systemCreator`, giữ nguyên các file bằng chứng binding phụ thuộc.

Nếu muốn giữ artifact/run ngay trong checkout, `<checkout>/.migration/` là vị trí duy nhất trong repo được phép: thư mục phải tồn tại với mode `0700`, không được là symlink, và phải có entry trong `.gitignore` của repo đó. Mọi path khác trong repo vẫn bị `PRIVATE_ARTIFACT_INSIDE_REPOSITORY` chặn.

```bash
export PW1_ROOT="${PW1_ROOT:-$HOME/migration-data/pw1}"
# Thử users, không ghi DB
npm run migrate:pw1:users -- --config "$PW1_ROOT/local.json" --all --dry-run
# Import users/tenant/site
npm run migrate:pw1:users -- --config "$PW1_ROOT/local.json" --all
# Import toàn bộ phạm vi importer hỗ trợ (không cần chạy users trước)
npm run migrate:pw1:import -- --config "$PW1_ROOT/local.json" --all
```

Dry-run vẫn tạo thư mục run/prepared; muốn ghi DB sau dry-run thì chạy lệnh `--config` mới.

Thay `--all` bằng `--store 636`, `--stores 100,205,636` hoặc `--from-store 100 --to-store 200`. Full mặc định kiểm tra/apply từng nhóm 100 store. Users là lệnh tạm, chưa hỗ trợ resume DB; full không tự bỏ qua conflict với dữ liệu users đã có. Users và full cho phép bỏ `credentials` khi chấp nhận password reset; credential chỉ có một phần hoặc không hợp lệ vẫn chặn.

Lệnh tự binding → prepare → import → thêm `destination` trực tiếp vào từng `runs/<RUN_ID>/prepared/master-*.json` (hoặc `master.json` cũ), sau khi toàn bộ store được chọn VERIFIED. Giữ đầy đủ dữ liệu và nhóm store của mỗi file (định dạng khoảng trắng JSON có thể đổi); không tạo thêm bộ master hay destination-map. Artifact exporter gốc không đổi. Dry-run không thêm destination.

```bash
# Tiếp tục đúng full run khi bị ngắt (thay RUN_ID bằng đường dẫn terminal in ra)
npm run migrate:pw1:import -- --run "$PW1_ROOT/runs/RUN_ID" --continue
# Chỉ xuất lại destination từ ledger, không chạy import
npm run migrate:pw1:import -- --run "$PW1_ROOT/runs/RUN_ID" --export-only
npm run migrate:pw1:users -- --run "$PW1_ROOT/runs/RUN_ID" --export-only
```

`prepared/destination-manifest.json` ghi hash gốc/hash kết quả, batch và trạng thái hoàn tất. Import/export manifests cũ giữ nguyên để đối soát ledger/credentials; dùng destination-manifest để kiểm tra master sau khi thêm destination. Từ lúc bắt đầu ghi destination, prepared là kết quả bàn giao, không còn dùng trực tiếp làm input importer. `--export-only` phục hồi bước ghi file bị ngắt, không ghi business DB; nếu chưa đủ store VERIFIED thì báo lỗi và giữ master nguyên vẹn. Muốn import mới, dùng artifact exporter gốc. Khi code/artifact/DB thay đổi, resume có thể bị chặn; không reset/bind lại run cũ để ép chạy. Prepare dở dang cần tạo run mới. Lệnh hỗ trợ local Linux (cần `flock`); remote/Vercel chưa hỗ trợ.

Terminal in đường dẫn run. `run.json` lưu trạng thái/mã lỗi, `events.ndjson` lưu các bước workflow; full có thêm `logs/` để xem lỗi từng store. Prepare vẫn tạo một bản sao artifact; cần đủ dung lượng cho bản sao và file tạm.

## Nâng cao — các lệnh cũ

Các lệnh dưới giữ để xử lý run cũ hoặc đối soát; không cần chạy riêng trước lệnh `--config`. Chế độ users `--manifest` vẫn xuất annotated master riêng theo hành vi cũ; full `--manifest` không tự xuất destination.

Copy mỗi lệnh trên **một dòng**, không chèn khoảng trắng vào tên `creator-bindings.json`. Chạy lần lượt trong cùng terminal. Hướng dẫn này không reset DB.

## 1. Khai báo đường dẫn

```bash
cd "$(git rev-parse --show-toplevel)"
export PW1_ROOT="${PW1_ROOT:-$HOME/migration-data/pw1}"
export PW1_RUN=$(date +%Y%m%d-%H%M%S)
export PW1_IMPORT_MANIFEST="$PW1_ROOT/prepared-$PW1_RUN/import-manifest.json"
```

Chỉ đặt `PW1_RUN` một lần cho cả lượt bind → prepare → import. Mở terminal khác thì khai báo lại đúng giá trị cũ nếu muốn dùng lại bộ đã prepare.

`.env.local` cần có `DATABASE_URI` trỏ DB local, `PW1_APP_KEY`, `PW2_MIGRATION_SECRET`, `SSO_ENCRYPTION_KEY`. DB phải có schema migration và system user `sso-service@primeweb.app`. Bind-system chỉ tìm tài khoản theo email, không tạo user hoặc gán ID cố định.

## 2. Chuẩn bị file đầu vào

```text
<PW1_ROOT>/
├── artifact/                  # Nguyên bộ output exporter, gồm master-manifest.json
├── users.csv                  # CSV users đúng snapshot, có credential nguồn
├── system-binding-<PW1_RUN>/  # bind-system tạo
└── prepared-<PW1_RUN>/        # prepare tạo
```

Nếu đã có `artifact/` và `users.csv` đúng snapshot thì bỏ qua các lệnh copy dưới đây. Không copy chồng lên artifact cũ. Thay hai đường dẫn mẫu bằng artifact và CSV của cùng snapshot:

```bash
export PW1_EXPORT_SOURCE=/absolute/path/to/exporter-run/artifact
mkdir -p "$PW1_ROOT"
cp -R "$PW1_EXPORT_SOURCE" "$PW1_ROOT/artifact"
install -m 600 /absolute/path/to/snapshot/users.csv "$PW1_ROOT/users.csv"
chmod 700 "$PW1_ROOT/artifact"
find "$PW1_ROOT/artifact" -type f -exec chmod 600 {} +
```

Giữ đủ các file exporter tạo và không sửa master/report. CSV credential phải khớp hash của bảng users trong manifest; không dùng CSV của snapshot khác. Dữ liệu đặt ngoài source/Git.

## 3. Tạo system creator binding

```bash
npm run migrate:pw1:bind-system -- --export-artifact "$PW1_ROOT/artifact" --source-ref @users:users:51 --approved-by liam --output "$PW1_ROOT/system-binding-$PW1_RUN"
```

`@users:users:51` là actor PW1 đã được xác nhận mapping tới system user PW2 trong luồng hiện tại. Với snapshot khác phải xác nhận actor trước, không tự map mọi actor về system user. Thay `liam` bằng tên người thực sự duyệt mapping.

Output phải chưa tồn tại. Thư mục cha không bắt buộc quyền 700; thư mục binding mới có quyền 700, file có quyền 600. Kiểm tra symlink và ngoài Git vẫn áp dụng.

## 4. Prepare

```bash
npm run migrate:pw1:prepare -- --export-artifact "$PW1_ROOT/artifact" --credentials "$PW1_ROOT/users.csv" --creator-bindings "$PW1_ROOT/system-binding-$PW1_RUN/creator-bindings.json" --output "$PW1_ROOT/prepared-$PW1_RUN"
```

Đợi `PREPARED` và exit 0 rồi mới import. Prepare kiểm tra/copy artifact, mã hóa credential thành `credentials.enc` và tạo `import-manifest.json`; **không ghi DB**. Output phải chưa tồn tại và cần đủ dung lượng cho bản sao cùng dữ liệu tạm. Không chạy hai lệnh prepare cùng output.

## 5. Import User / Tenant / Site

Dry-run một store hoặc toàn bộ:

```bash
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --store 105 --local-database primeweb --dry-run
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --all --local-database primeweb --dry-run
```

Sau khi kiểm tra đạt, chạy ghi toàn bộ:

```bash
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --all --local-database primeweb
```

Nếu muốn chỉ định tên file đầu ra:

```bash
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --all --local-database primeweb --output-master "$PW1_ROOT/master-with-destination-$PW1_RUN.json" --output-file "$PW1_ROOT/migrated-users-$PW1_RUN.json"
```

Hai lệnh ghi trên là **hai lựa chọn**, không chạy cả hai liên tiếp. Mặc định xuất `master-with-destination.json` và `migrated-users.json` cạnh manifest; không ghi đè file có sẵn. Với đầu vào nhiều part, `master-with-destination.json` là index; thư mục `master-with-destination.json.parts/` chứa đúng một file destination cho mỗi master part, cùng tên và nhóm store. Giữ cả index và thư mục parts. Master gốc không đổi, dry-run không xuất file.

Thay `--all` bằng đúng một selector nếu cần:

| Phạm vi store PW1 | Tham số |
| --- | --- |
| Một store | `--store 105` |
| Danh sách | `--stores 1,31,105` |
| Khoảng ID | `--from-store 100 --to-store 200` |

Lệnh users là luồng tạm, chỉ ghi Tenant/User/Site và chưa có resume. Nếu lỗi sau khi ghi, các bản ghi đã commit vẫn còn; kiểm tra ledger trước khi chạy lại. Không dùng resume của full importer cho batch users.

User thiếu cả password hash và key_string được tạo password ngẫu nhiên nội bộ, keyString=null, ghi `passwordResetRequired` trong ledger/report. Credential chỉ có một phần hoặc không hợp lệ vẫn chặn. Không gửi email reset khi import. Email user được chuẩn hóa chữ thường/trim theo Payload, trừ email không hợp lệ được giữ nguyên khi artifact có contract và policy `preserveInvalidUserEmails` đã được chấp nhận. Xem [contract và giới hạn](pw1-users-destination.md).

## Full importer — chỉ dùng khi muốn nhập cả dữ liệu business

Các lệnh dưới đây khác với luồng users ở trên. Có master hoặc prepare thành công chưa có nghĩa mọi store vượt qua kiểm tra business.

```bash
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb --dry-run
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb
```

Chỉ chạy lệnh ghi sau khi dry-run đạt. Mỗi nhóm được kiểm tra trước khi ghi/verify từng store. `--group-size` nhận 1..100, mặc định 100. Các selector giống bảng trên.

Terminal in đường dẫn log; mặc định `$PW1_ROOT/logs/<timestamp-session>/` gồm `events-*.jsonl`, `errors.jsonl`, `summary.json`. Có thể đổi bằng `--log-dir <private-log-directory>`. Ledger là căn cứ xác nhận commit.

Resume full importer với runId từ `BATCH_READY` hoặc `summary.json`:

```bash
export PW1_BATCH_ID='json:THAY_BANG_UUID_THAT'
npm run migrate:pw1:import -- --resume "$PW1_BATCH_ID" --local-database primeweb
```

Có thể thêm `--from-store 100` nếu đó là store chưa hoàn tất đầu tiên. Không thêm manifest/group-size/dry-run khi resume. Giữ nguyên code/artifact/khóa/DB; không sửa ledger để ép chạy qua lỗi.

## Lỗi lệnh thường gặp

- `PREPARE_INPUT_OR_PARENT_NOT_FOUND`: kiểm tra đường dẫn và tên `creator-bindings.json` (không có khoảng trắng).
- `OUTPUT_ALREADY_EXISTS` / `PREPARE_OUTPUT_ALREADY_EXISTS`: chọn `PW1_RUN` mới, chạy lại bind và prepare; không ghi chồng output cũ.
- `EXACTLY_ONE_STORE_SELECTOR_REQUIRED`: chọn đúng một trong store/stores/range/all và không xuống dòng giữa đường dẫn.
- `PREPARE_DISK_FULL` / `ARTIFACT_DISK_SPACE_INSUFFICIENT`: giải phóng dung lượng trước khi thử lại; kiểm tra output dở còn tồn tại.

### Master parts — exporter 1.10.0

Importer accepts `master-0001.json`, `master-0002.json`, … directly from the manifest. Each part contains at most 300 whole Stores and strictly fewer than 200,000,000 UTF-8 bytes. Keep all parts and auxiliary artifacts together; do not concatenate them or create `master.json`. Legacy artifacts containing `master.json` remain supported.

Prepare binds `masterHash` to the manifest's deterministic `masterSetHash` and copies the parts without creating an aggregate file. Load streams every part through hash verification, including unselected Stores, and verifies global Store ordering, uniqueness, byte counts and the complete part registry. Selected Stores can be spooled separately.

In legacy users `--manifest` mode only, for chunked input, `--output-master` (default `master-with-destination.json`) contains an index; `<output-master>.parts/` contains exactly one destination file per input master part, with the same filename, Store IDs and order. Output parts are never merged or repartitioned. The index is published after all input parts pass verification. Keep both index and parts directory. Legacy master.json input produces one destination JSON array.

### Model settings scope and domain diagnostics — 1.10.1

All `model_settings` are outside importer operational scope, including settings attached to Products, Stores and unresolved source parents. Historical classified artifacts retain raw source evidence; only diagnostics matching verified source IDs, fields and ownership evidence are classified `OUT_OF_SCOPE`. Unknown diagnostic signatures, forged relationships/contributions, duplicate IDs, unsupported retention rules and artifact hash mismatches remain errors.

Exporter 1.10.1 adds `MASTER-2.2-MODEL-SETTINGS-OUTSIDE-SCOPE` and an explicit table marker. Importer accepts that retention rule only for the exact 1.10.1 mapping contract, with no target contributions or exclusion metadata and security fields excluded. Domain ambiguity warnings that identify an entire Store are checked against the Store identity; they are not looked up as unrelated `store_domains` IDs.

Read `diagnosticSummary.buckets[].disposition` when reporting remaining work: `BLOCKED` means a source/import problem; `TARGET_CHECK_REQUIRED` means the importer must verify target schema, uniqueness, creator binding or subscription evidence. The legacy `blockers` list includes both categories.

### Approved catalog/editor/social/media decisions — 1.10.2

The exact 1.10.2 contract permits `INACTIVE_CATEGORY` Product exclusion only with `excludeProductsInInactiveCategories` enabled and consistent source-only Product/family receipts. Excluded Products must not appear in master parts. Older artifacts containing `PRODUCT_INACTIVE_CATEGORY_OMITTED` and an emitted Product do not gain this approval: export again.

Only PROD User 2697 / Store 1327 and User 2701 / Store 1329 have the approved secondary-owner downgrade. The importer verifies a distinct primary owner, `roles: [editor]`, exactly one matching tenant membership with role `editor` and no custom permissions, plus the exact secondary-owner diagnostic. Other non-owner permission warnings remain blocked. This changes migration evidence acceptance, not application permission behavior.

Social output contains supported PW2 platform URLs only. Metadata or invalid source entries can remain source-only under exact classified receipts; unknown fields and unsafe emitted URLs are rejected. Library media keeps PW1 `url` and `sourceUrl` unchanged, writes no file upload (`filename: null`), and requires a same-Store source receipt. Folders, deleted rows and empty URLs require source-only receipts and must not be emitted. PW2 Media has no tenant column; the migration ledger and per-Store references retain source ownership.


### Checkpoint importer 1.10.3 — 24/09/2026

Accepts exporter contract `fe5b368a1e40d5a02b373170684a3d2b5ec3188373c69359300b8c5fc7c0507f` with existing chunked master layout. Approved metadata and technical tables remain source-only; Page/Menu/template bytes remain in the artifact and are delegated, not written into the builder. Mapped Order residual fields require actual emitted Order evidence. Address overflow additionally requires matching reconciliation receipt and policy. Shipping proof checks `sites.shippingConfig` PW2 defaults. Invalid discount exclusions require exact source evidence and no emitted discount. New markers cannot authorize old contracts; outcome counts are recomputed for 1.10.3.

Validation: 555 tests / 29 files pass; TypeScript and focused ESLint pass. Tests include artifact prepare/load, mixed historical policies, altered outcome, missing overflow receipt, unknown discount field and missing template evidence. No database writes or full PROD 1.10.3 re-export were performed in this checkpoint. Existing PROD artifact remains 1.10.2.

Orphan role record5753 is retained in source audit; existing dependency-scope proof makes it nonblocking only when its missing User is unrelated to selected master and creator dependencies. A referenced missing User remains blocked. Do not synthesize or reassign roles.


PROD follow-up 24/09/2026: artifact 1.10.3 exported all 2,913 eligible Stores. Offline prepare passed. First full-selection audit found 45 source-policy blockers (2 missing promotion header allowlists, 42 already-editor Users, historical Order1014/Store1499 coupon). Fixed importer proof gates without changing artifact bytes: exact known promotion fields; editor-only/same-tenant/empty permissions with source User contribution; emitted historical Order with preserved discountCode and no operational discount relation. Second full-selection audit: **0 BLOCKED**, **44,521 TARGET_CHECK_REQUIRED**; no DB writes. 569 tests/29 files, typecheck and focused lint pass. Orphan role5753 is OUT_OF_SCOPE after dependency proof. These results do not bypass target checks or certify DB migration.

Target diagnostics chọn entity theo collection đích và source identity. Một `blog_posts` tạo cả Media và Blog thì kiểm tra slug áp dụng cho Blog; ảnh dùng chung source ID không thay thế được entity này.

Ảnh `@media:blog_posts:ID` giữ nguyên ref trong master nhưng dùng namespace nội bộ `blog_post_thumbnail` trong registry/ledger; Blog dùng `blog_posts`. Cách tách này tránh xung đột khi một dòng nguồn tạo hai collection. Run dùng code cũ cần tạo lượt mới theo kiểm tra writerHash; không sửa ledger để ép resume.

Full `logs/<session>/summary.json` có `passwordResetRequiredCount` và `passwordResetUsers` (storeId/sourceUserId/targetUserId); event `USER_PASSWORD_RESET_REQUIRED` lấy từ evidence ledger. Đây là lịch sử tạo tài khoản cần reset, không phải trạng thái reset hiện tại. Báo cáo theo session, bao gồm claim đã đối soát; run bị ngắt sớm chỉ phản ánh phần đã đọc/ghi. Không gửi email hoặc thay password user được reuse.

### Chạy khi source đang được chỉnh sửa song song

Bản code cố định cho lượt test hiện tại nằm tại `$PW1_ROOT/runtime-20260924-full-v3`. Snapshot chứa source/scripts/config và môi trường local; dependency `node_modules` dùng chung, nên không chạy npm install/update trong lúc import hoặc trước resume. Source chính thay đổi không làm đổi code của snapshot. Không copy code mới chồng vào snapshot đang có batch.

```bash
cd "$PW1_ROOT/runtime-20260924-full-v3"
npm run migrate:pw1:import -- --config "$PW1_ROOT/local.json" --all
# Resume từ chính thư mục runtime này, thay RUN_ID bằng run đã tạo
npm run migrate:pw1:import -- --run "$PW1_ROOT/runs/RUN_ID" --continue
```

Giữ nguyên snapshot, dependencies, env/keys và DB khi resume. Không thay writerHash trong ledger. Nếu dọn DB local rồi khôi phục system user bằng SQL, cần đồng bộ sequence của cả `users` và `users_roles` với ID đã giữ lại; chỉ đồng bộ users sẽ gây trùng `users_roles_pkey`.

### Restored raw model_settings — exporter 1.10.4

Accepts exporter contract `08adfe1449160fddfbafcc305a3b2064da599035ed36dda697ba285d11f1516a`. This supersedes the exporter 1.10.1–1.10.3 whole-table omission: original model_settings fields and values are preserved in nested Page/PageComponent/Menu/MenuItem/MenuLine arrays, or `sites.raw_model_settings` when no nested destination applies. HTML with spaced `tel:` links and unparsed JSON remain opaque strings. Importer verifies setting identity, Store, nested source model, exact field names and contribution path against the actual master; it does not sanitize these strings or replay arbitrary settings into DB fields.

The raw-only Site property is excluded from operational projection and source dependency scanning only for 1.10.4. Pages and menus remain delegated content; preparing an artifact is not evidence that builder Pages have been created. Existing 1.10.3 artifacts retain their original meaning and do not receive restored content automatically.

`SOURCE_SETTING_STORE_ID` identifies a preserved source row with an explicit valid direct Store whose parent cannot establish a usable nested relationship. It does not invent a relationship to the missing/foreign parent. A setting without an emitted Store can remain in source CSV with `MASTER-MODEL-SETTINGS-UNOWNED-SOURCE` proof. An emitted Store cannot claim that rule to hide a missing setting. The old `MODEL_SETTINGS_OUTSIDE_SCOPE` marker is rejected under the restored contract.

Regression validation: 618 tests / 33 files pass, TypeScript and focused ESLint pass. Includes streamed Page content and prepared-file byte preservation, Site raw delegation, missing/duplicate/mismatched receipts, inherited business policies and historical contract boundaries. No DB writes; actual PROD master coverage is reported separately by the exporter audit.

Full import giữ nguyên status và weight đã mapping của Product lịch sử. Nếu publish gate chỉ báo thiếu weight, importer cho phép replay bằng capability nội bộ; không tự đặt weight hoặc đổi status. Các điều kiện publish khác và luồng ứng dụng vẫn giữ nguyên.

Lưu ý: exporter không có blocker và importer dry-run pass chưa chứng minh full import sẽ thành công. Preflight kiểm tra artifact, mapping, schema và các xung đột đã hỗ trợ; chưa mô phỏng toàn bộ hook/validation khi Payload ghi DB. Chỉ báo hoàn tất khi mọi store được VERIFIED và bước destination hoàn tất.

### Original PW1 Site domain — exporter 1.10.5

Accepts contract `a5f311eea68c1aef772ee0c36962c7f17b088026d6d098a206c32f6e4306b2b1`, inheriting 1.10.4 raw model_settings and all approved migration policies. `sites.domain` is independent of `tenants.slug`: importer preserves the source string through projection and relation resolution and never appends a target suffix or invents a domain from a fallback slug. This does not attach a hostname to Vercel or establish storefront routing.

A populated Site domain must have one `MASTER-4.1-SOURCE-SITE-DOMAIN` receipt from its selected `store_domains` row, with the matching Store, source ID, `sites[].domain` destination and exact available source fields (`id`, `store_id`, `domain`, `is_default`, `deleted_at`). Historical contracts cannot claim this new rule. `SOURCE_SITE_DOMAIN_FORMAT_PRESERVED` is nonblocking only with the matching selected receipt and approved graceful-resolution flag; missing/ambiguous source selection remains an exporter decision, not an importer-generated hostname. Source-to-master byte comparison is performed by the exporter artifact audit; a report receipt alone is not a CSV value comparison.

Validation: 644 tests / 36 files pass, TypeScript and focused ESLint pass. Tests cover original mixed-case/domain text independent of tenant slug, null/absent optional values without synthesis, malformed-source warning evidence, missing/duplicate/forged receipts, historical boundaries and 1.10.4 raw-content inheritance. No DB writes or runtime schema changes.
