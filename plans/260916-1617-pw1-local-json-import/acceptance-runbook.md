# Acceptance runbook — local clone only

Status: implementation có thật; rehearsal synthetic và subset DB safety đã chạy. Các ca không có bằng chứng tương ứng vẫn NOT_RUN/BLOCKED, không tự suy từ unit/helper pass.

## Entry checks

1. Có quyền ghi clone riêng từ DB hiện hữu và biết rõ host/database/schema; schema migration chạy riêng bằng đường `scripts/db-setup.js --migrate-only` phù hợp repo. Không dùng reset/drop hoặc restore vào DB đang hoạt động.
2. App/cron/webhook/outbound thật không kết nối clone; email/provider/SSO requests bị chặn hoặc trỏ stub local. S3 cấu hình kiểm tra read URL không được upload/xóa object thật.
3. Artifact/credential/key đúng snapshot; G1 conflicts có kết quả rõ. Snapshot/hash/code/schema pinned; manifest giữ ngoài Git.
4. Baseline ghi counts, source claims, sanitized projections của selected và ngoài scope; secret chỉ fingerprint protected nếu cần, không dump auth vào report.

## QA traceability hiện hữu

Đọc file current `docs/qa/F42-pw1-pw2-layer1.md`; `AUTO` ở L1 còn NOT_DESIGNED không phải quyền sinh test. Current approved `[x] AUTO` liên quan:

| TC hiện hữu | Nội dung dùng lại | Giới hạn |
|---|---|---|
| TC-F42-S2-003, TC-F42-S2-004 (explicit checkbox subset) | Product EAV/numeric constraints, synthetic SKU/source identity | Test helper, không chứng nhận DB writer |
| TC-F42-COMMERCE-001 | Timestamp/offset validation | Input conversion regression; JSON importer không convert lại |
| TC-F42-COMMERCE-002 | SKU/tenant/order identity và historical price | Không thay real FK/replay proof |
| TC-F42-COMMERCE-003 | Payment method/provider semantics | Không chứng minh side-effect guards |
| TC-F42-COMMERCE-004 | Major/minor validation và nonzero discount | Importer giữ mapped units, không chạy conversion lần2 |
| TC-F42.47 | Customer canonical/phone/address/source ownership | Không thay DB snapshot hook test |
| TC-F42.48 | Receipt/source hash drift | Không thay new JSON run binding test |
| TC-F42.49 | Discount source join/timestamp | Không chứng minh runtime Discount hook |

Chạy existing Product36 và worktree selected75 regression khi primitives được port; source paths/version phải thực sự khớp. Không copy suite mocked rồi gọi integration. Chỉ sinh test theo approved AUTO scope, import source thực, AAA, top-level mocks đúng convention. Các ca dưới đây manual real-DB evidence, chưa là TC-ID chính thức; muốn tự động hóa mới phải đi quy trình QA trước.

## Manual real-DB scenarios bắt buộc

| Evidence ID (không phải QA TC) | Thao tác | Kết quả phải quan sát |
|---|---|---|
| MAN-LOCAL-01 | Dry-run one/list/range/all; invalid/conflicting/missing selectors; wrong target | Zero DB/DDL writes; selection chính xác/numeric; no-match riêng; wrong target rejected |
| MAN-LOCAL-02 | Import selected supported scope205/285 sau G1; compare baseline | Projection+counts+refs đúng; outside-scope unchanged, Pages unchanged |
| MAN-LOCAL-03 | Replay same run và new run cùng snapshot | Zero duplicate top/child rows; REUSE verified, ownership run cũ giữ nguyên |
| MAN-LOCAL-04 | Kill giữa entity của Store205; resume run | Entity đã commit không ghi lại; entity chưa commit retry; Store chưa verify không complete |
| MAN-LOCAL-05 | Controlled disconnect đúng commit boundary trên clone | Outcome unknown reconcile ledger/target; không double-create hoặc xóa bù |
| MAN-LOCAL-06 | Hai CLI chọn205; expire lease/stale worker | Một writer được commit; stale fence không finalize, old transaction không write ngoài req |
| MAN-LOCAL-07 | Fail ledger insert sau business mutation trong cùng transaction | Business+children đều rollback; sequence gap được chấp nhận |
| MAN-LOCAL-08 | Change snapshot/code/schema hoặc target sau dry-run | Binding/baseline conflict; không overwrite/auto-replan silently |
| MAN-LOCAL-09 | User synthetic correct/wrong/missing credential và existing email collision | Correct recovery/hash/SSO round-trip; mismatch block; existing secret/membership unchanged |
| MAN-LOCAL-10 | Media filenameNULL under S3-enabled config, read/populate | External url/sourceUrl giữ nguyên; zero upload; tenant isolation không được suy từ cột tenant_id |
| MAN-LOCAL-11 | Order/Product fixtures0stock/nonzeroDiscount/money limits/229 missing childIDs | Values đúng; child identity stable; no email/restock/customer aggregate changes |
| MAN-LOCAL-12 | Orders với expiry/providerIDs trong isolated predicate test, pending pass2 refs | Background risk bị chứng minh/cách ly; incomplete refs block verify; no live readiness claim |

Mất ACK phải tái hiện qua controlled local connection/proxy hoặc instrumentation được review, không chỉ ném exception trước COMMIT. Nếu chưa thể chứng minh ca05/06 trong ngân sách, ghi NOT_RUN/NO-GO cho độ an toàn tương ứng, không fake evidence.

## Ca bổ sung từ phản biện

- **MAN-LOCAL-13 — Batch boundary:** selected205,285; kill sau205 VERIFIED trước khi285 APPLYING, xóa file report rồi resume batch ID. CLI vẫn chọn285. Thử resume với new selector/manifest hoặc child UUID phải reject. Không dùng Store100 trong fixture không có100.
- **MAN-LOCAL-14 — Legacy rollback consumer:** batch JSON REUSE row legacy-owned. Gọi rollback legacy trên clone phải bị command guard/consumer guard chặn; không có row/claim mất. Giữ producer claim lock để tái hiện race nếu triển khai consumer-selective guard; blanket target guard là lựa chọn ngày đầu.
- **MAN-LOCAL-15 — Bugfix recovery:** partial run rồi đổi writer hash: resume reject; không sửa ledger. Lưu evidence, restore **disposable clone** đúng baseline, chạy batch mới. Không áp dụng restore này cho DB live.
- **MAN-LOCAL-16 — Missing history replay:** create fixture thiếu technical timestamps, chạy batch mới cùng snapshot. Reuse dùng timestamp owner provenance, zero update; không conflict chỉ vì run.startedAt khác.

MAN-LOCAL-02 bắt buộc dùng master thật với conflict đã giải quyết hợp lệ; fixture synthetic chỉ chứng minh writer/failure behavior. Không đánh PASS ca02 nếu actual master còn BLOCKED. Các ca bổ sung vẫn trong ngân sách3h nếu khả thi; NOT_RUN giữ NO-GO cho bảo đảm liên quan, không bỏ qua để hoàn tất.

## Optional UPDATE chỉ khi được thêm scope

Chạy baseline guard khi target bị sửa sau dry-run; before-image/audit atomic; post-image đúng; arrays mixed-owner block. Restore chỉ trường allowlist trên clone với expected post-image, không erase edit mới. Nếu chưa làm các ca này, disable UPDATE hoàn toàn. Không yêu cầu xây rollback engine ngày đầu.

## Cách chạy/resume sau khi CLI có thật

```bash
npm run migrate:pw1:import -- --manifest /home/liam/migration-data/pw1/SNAPSHOT/import-manifest.json --store 205 --dry-run
npm run migrate:pw1:import -- --manifest /home/liam/migration-data/pw1/SNAPSHOT/import-manifest.json --store 205
npm run migrate:pw1:import -- --resume RUN_ID
```

RUN_ID có dạng json:<batch-uuid>, lấy từ ledger/CLI output, không tự tạo hoặc thay bằng UUID child run. Giữ file input immutable. Input cần sửa → snapshot mới + preflight/reconcile claims cũ; không sửa file rồi resume. Store100 chỉ minh họa khi tồn tại trong run thực, không dùng với fixture205/285.

## Evidence pack và quyết định

Mỗi ca lưu ID, expected/actual, run/source/snapshot/target fingerprint, code/schema version, start/end UTC, counts/checksums và sanitized error code; PASS/FAIL/NOT_RUN/BLOCKED riêng. Report không chứa payload/auth/PII raw hoặc DB URI. File report hỏng dựng lại từ ledger.

GO chỉ cho local isolated scope đã nghiệm thu. Chưa verified-required, credential policy chưa rõ, commit unknown, job isolation không bảo đảm hoặc Media ownership chưa có evidence → BLOCKED. Để mở Vercel/live sau này cần durable historical job gate, deployment/secret/artifact transport và execution budget review riêng.

## Evidence đã quan sát trong implementation

- Schema legacy+JSON chạy hai lần trên clone đạt; guard claim rollback đạt.
- Harness `/tmp/pw1-ledger-runtime-audit.ts`: 7 PASS — concurrent lease, stale fence, Payload parent+child rollback khi ledger fail, finalize ownership/source, durable checksum, REUSE dependency guard, active legacy-run blocker. Đây là subset ca06/07/14; ca05 có instrumentation evidence riêng bên dưới.
- CLI synthetic15collections đã đi qua dry-run/apply/resume/new-run REUSE; dữ liệu nguồn thật chưa nghiệm thu.
- MAN-LOCAL-02 còn BLOCKED tới khi master thật và policy conflicts sẵn sàng; ca15 không tự ghi PASS; ca13 xem boundary evidence bên dưới; ca05 xem instrumentation evidence bên dưới. Source DB untouched; clone có audit ledger fixtures riêng.

Benchmark parser+SHA riêng: synthetic3,221,225,475byte/49,153discardedrootitems,10.64s,peakRSS98.52MiB; không phải business migration throughput. Synthetic15collections kiểm chứng PBKDF/SSO, stock0, money10major/100minor/9total, payment state và external Media; target drift exit3. Pass2 và two-Store SIGINT/resume có final evidence bên dưới; SIGKILL giữa entity chưa chạy.

### MAN-LOCAL-05 — mô phỏng mất ACK sau commit: PASS có giới hạn

Harness `/tmp/pw1-simulated-ack-audit.ts` gọi writeEntity/Runtime thật trên clone; wrapper chỉ ném ECONNRESET **sau khi transaction đã commit**. safeError trả exit5; count tenant/operation0/0 →1/1 sau commit →1/1 sau replay cùng batch, targetID giữ nguyên. Evidence private `/tmp/pw1-simulated-ack-evidence.json`. Đây là kiểm tra reconcile post-commit bằng instrumentation, chưa phải đứt kết nối TCP thật hoặc chứng minh mọi network race.

### Final CLI rehearsal

Evidence `/tmp/pw1-cli-rehearsal-1789555092780`, batch `json:efcccb72-ae39-44ad-bae5-a5590b4a35d8`:2Stores/17entities/15collections; SiteSEO ogImage forward-reference pass2 đạt. SIGINT sau Store1 trả4, resume hoàn tất Store2 trả0, batch mới CREATE0/REUSE17. Đây là boundary graceful interruption; không chứng minh SIGKILL giữa entity hoặc xóa report file của toàn MAN-LOCAL-13.

SQL độc lập xác minh PBKDF+SSO, stock0,10major−100minor=9total, completed+unpaidCOD, Customername không đổi, external Media URL/sourceUrl/filenameNULL; Pages436 không đổi. Target drift trả3/TARGET_PROJECTION_CONFLICT.63tests/7files và typecheck PASS. Fixture205/285 read-only validation861/7entities PASS; actual master full migration vẫn NOT_RUN.

Manual harness command (secret đã được nạp từ môi trường private, harness tự override sang clone được phép): `./node_modules/.bin/tsx --require ./scripts/seed-preload.cjs /tmp/pw1-ledger-runtime-audit.ts`; simulatedACK: cùng prefix với `/tmp/pw1-simulated-ack-audit.ts`. Các harness chứa tên clone nghiệm thu cụ thể; không chuyển thành lệnh cho DB live. Không in giá trị DATABASE_URI/PAYLOAD_SECRET/PW1_APP_KEY/PW2_MIGRATION_SECRET/SSO_ENCRYPTION_KEY.
