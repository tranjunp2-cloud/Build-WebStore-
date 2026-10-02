# Kế hoạch đóng gap F42 field evidence theo yêu cầu QC

**Ngày rà:** 2026-10-01. **Scope nhánh này:** exporter, importer, ledger, comparator, fixture, CLI và tài liệu F42. API/trang Studio, filter và UI F40 là PR riêng sau khi F42 khóa read contract. **Trạng thái:** chưa đạt acceptance QC; local prototype đã có schema, sidecar, builder và synthetic fixture, chưa có real exporter→importer→builder proof cùng artifact, chưa deploy staging.

**Cập nhật triển khai local 2026-10-01:** Đã bổ sung kiểm count CSV theo từng bảng, snapshot/child binding rõ ràng, timestamp verify, registry/hash, toàn bộ dòng source trong bảng field evidence kể cả exporter lọc, target claims cho duplicate, synthetic absence proof, summary theo entity/disposition, sáu status và OPEN exception. SKU on_hand theo rule QC chấp nhận; money kiểm PW1/PW2 currency; Product image count/identity, Customer address count, Discount code/type/value/status, Email status/subject HMAC và Order payment method đã có rule. Local fixture không thay thế real same-artifact proof. Những dòng "Hiện tại" bên dưới là baseline trước cập nhật này; dùng phần cập nhật và runbook để đọc trạng thái mới. G4, G6, G7 và toàn tuyến real vẫn chưa đạt.

**Cập nhật 2026-10-02:** Contract local `field-evidence-v25` bổ sung Product dimension cm, weight unit, Customer email HMAC, Domain `unsupported` và phân loại Order item total snapshot `unsupported` vì PW2 không lưu field này. Fixture synthetic hiện xác nhận một Product khớp toàn bộ 12 field, các trường hợp lệch giá/stock/Order, missing Product, duplicate và exception OPEN. G4 vẫn chưa đạt đầy đủ vì Customer identity, Settings Profile/Team, Discount start/end, Order item SKU, refund/cancel và location/reserved/available chưa có bằng chứng hay rule đủ để kết luận. G6 cần deploy/revision, fixture owner và child VERIFIED trên staging; G7 là phần đọc/hiển thị của F40 ở nhánh riêng. Chưa có phép thử exporter→importer→builder trên cùng CSV artifact được duyệt. Bảng gate bên dưới giữ nguyên như baseline kế hoạch, không phải trạng thái nghiệm thu mới.

**Cập nhật phép thử real local 2026-10-02:** Đã chạy thành công exporter→validator→importer child VERIFIED→sidecar ingest→builder trên cùng CSV snapshot 93 bảng. Contract `field-evidence-v26`/sidecar v3 sửa giới hạn dòng provenance hợp lệ, HMAC email theo transform trim/lowercase và Order tax rỗng→0; generation real Store 189 có 7.940 field, 180 match, 0 mismatch, 0 missing, 0 duplicate, 7.715 unsupported, 45 unverified. Fixture synthetic v26 vẫn cover sáu status và exception OPEN. G1/G2/G3/G5 đã có bằng chứng local; G4 còn các field chưa có rule/proof được ghi `unsupported`/`unverified`. G6/G7, deploy staging, owner và TC-MIG.01–10 còn NOT_RUN. Chi tiết checksum/UUID và giới hạn nằm trong `docs/qa/F42-field-evidence-local-handoff-20261002.md`; các dòng "chưa real same-artifact" phía trên là lịch sử tại thời điểm v25, không còn là trạng thái local hiện tại.

## 0. Bảng gate: không được gọi là hoàn thành khi thiếu bằng chứng

| Gate | Bằng chứng bắt buộc | Hiện tại |
| --- | --- | --- |
| G0 — Contract | Registry phiên bản hóa cho mọi field QC; decision table status/empty/null/money/stock; owner QC/F42/F40 ký | Chưa có registry đầy đủ; comparator hiện có 18 field rule |
| G1 — Source trước lọc | Sidecar từ selected CSV, kiểm count từng bảng với CSV hash và mapping report, ingest DB an toàn kể cả row/Store không emit | Có sidecar/ingest; thiếu kiểm độc lập per-table count và handoff real artifact |
| G2 — Verified binding | Numeric Store, child UUID VERIFIED, đúng importer profile/scope, source snapshot/sidecar hash cụ thể, target/hash/manifest | Có phần lớn; builder chọn snapshot không chỉ định và không kiểm profile/scope đầy đủ |
| G3 — Field semantics | Mọi expected field có đúng một status; duplicate có tất cả target IDs; missing cần confirmed target read; unsupported/unverified có reason | Chưa đạt: Product thiếu trong fixture thành unverified; duplicate mất target IDs |
| G4 — QC field coverage | Product/SKU, Order, Customer, Discount, Settings theo checklist bên dưới, money/stock được duyệt | Chưa đạt |
| G5 — Summary/fixture | Source/export/import denominator riêng; bảy case fixture đúng expected; exception OPEN; reset/replay determinism | Chưa đạt dù sáu nhãn hiện có |
| G6 — Staging handoff | Revision/schema deploy, real child UUID, real sidecar generation, synthetic fixture có nhãn, owner/runbook/trace | Chưa chạy |
| G7 — F40 consumer | F40 đọc/hiển thị đúng Store+child+snapshot, bảo mật và browser E2E | Ngoài nhánh F42; chưa thực hiện |

Thứ tự bắt buộc: **G0 → G1/G2 → G3/G4 → G5 → local end-to-end → G6 → G7**. Không dùng `json:<uuid>` Batch ID làm child run; không tính `unsupported`/`unverified` thành pass. Importer VERIFIED, evidence COMPLETE và QC Pass là ba trạng thái độc lập.

## 1. Khóa registry và dữ liệu nguồn (G0–G1)

### Việc code

1. Thêm registry có version/hash trong `src/lib/migration/pw1-evidence/` với một entry cho **từng field QC liệt kê**. Entry gồm `source_entity/field`, target collection/path hoặc explicit unsupported, element key, transform code/version, type/unit/currency/timezone, null/empty/absent rule, privacy, scope, reason và owner. `SOURCE_EVIDENCE_FIELDS` trong `pw1-export/source-evidence.ts` lấy allowlist từ registry hoặc có test bắt hai danh sách khớp; không duy trì hai nguồn sự thật lệch nhau.
2. Phân biệt ba trục: selected source inventory, export disposition (`mapped/partial/retained-source/excluded/unresolved`, blocked/deferred Store), và import comparison status. Source row bị exporter lọc vẫn ở snapshot; không tự gán `missing` của PW2. Row không xác định Store phải được cộng vào `unattributed` riêng, không lặng lẽ bỏ khỏi Store-specific denominator.
3. Trong `source-evidence.ts`/`validate-artifact.ts` và `pw1-evidence/ingest.ts`, kiểm số row sidecar **từng selected CSV table** bằng file `rowCount` đã hash, rồi đối chiếu mapping-report; kiểm field presence, identity và disposition. Test một row bị mapper/report bỏ sót để bảo đảm kiểm kê không cùng lỗi với mapper. Sidecar thiếu/hash sai → full-source coverage `BLOCKED` dù child run VERIFIED.
4. Cố định privacy: raw password/token/credential và PII không rời CSV; Customer/Order/Discount private field chỉ HMAC có khóa + key ID, address chỉ count/masked. Review cả DB row, CLI output và error path bằng canary secret. Không fallback sang checksum không khóa khi thiếu key.

### Gate nghiệm thu

Fixture CSV gồm emitted, excluded Product, retained field, unresolved row, blocked/deferred Store và row không xác định Store. Sau export/ingest, query DB trả đúng số row/field theo **từng bảng, disposition, Store**, kể cả Store không có child; tắt quyền đọc CSV tại QC vẫn truy được safe source inventory. Tamper một byte hoặc thay sidecar bị reject trước khi publish snapshot COMPLETE.

## 2. Sửa identity, schema và lifecycle generation (G2)

### Việc code

1. `buildFieldEvidence` nhận `snapshot_id` **và expected sidecar SHA-256**; join bằng source instance/snapshot/manifest/sidecar, `provenance_kind='exporter_sidecar'` cho real run. Synthetic fixture dùng entry point rõ ràng và `provenance_kind='synthetic_fixture'`. Nếu có 0 hoặc >1 candidate, fail closed. Không chọn `rows[0]` không thứ tự. Pin registry/rule hash, source snapshot as-of, importer profile/execution scope, producer revision và target identity vào generation.
2. Mở rộng `scripts/pw1-evidence-schema.js` bằng DDL additive: per-target claim/anomaly cho duplicate, record evidence, source/export coverage summary, explicit timestamps (`source_snapshot_at`, importer `verified_at`, `target_read_at`), exception linkage và required indexes/constraints. `scripts/db-setup.js` chạy/verify schema idempotent; không DROP. Kiểm migration trên clone có ledger cũ và chạy lại hai lần.
3. Bỏ `run.updated_at` làm verified time mặc định nếu nó không phải timestamp verify bất biến. Lấy từ importer verified event/cột đã pin; nếu thiếu, ghi `unverified` time provenance thay vì nhãn sai. Generation đã COMPLETE bất biến. Concurrent builders cùng input chỉ có một generation, khác snapshot/rule/target revision tạo generation mới hoặc báo conflict typed.
4. Kiểm child `migration_runs` và `migration_import_stores` đều VERIFIED, Source Store ID số, manifest/exporter hash, target guard/hash, mapping version và run scope. Foundation/users-only run không được công bố như full Commerce coverage. Ingest/build trên remote staging áp cùng DB authorization, Store allowlist và expiry như staging importer; local dùng clone guard. CLI báo lỗi an toàn, không in DB URI/PII.

### Gate nghiệm thu

Test sai Store, Batch ID, unverified child, sai manifest, sai sidecar, synthetic thay real, hai snapshot cùng manifest, hết hạn staging authorization, users-only run, concurrent/retry/crash. Không trường hợp nào công bố COMPLETE sai; replay cùng input trả cùng digest/count.

## 3. Status semantics, target read và audit (G3)

Decision table phải được QC ký và được test trực tiếp:

| Status | Điều kiện chứng minh | Thiếu proof thì |
| --- | --- | --- |
| `match` | Một source → đúng một target, canonical values bằng nhau, cùng unit/currency/time, target identity đã xác nhận | `unverified` |
| `mismatch` | Target xác nhận tồn tại, đọc thành công, giá trị canonical khác | `unverified` |
| `missing` | Source nằm trong import scope và target/field vắng sau **bounded target read thành công** | `unverified` |
| `duplicate` | Hai target ID khác nhau có cùng **provenance source đã xác minh**; lưu cả ID/evidence ref | `unverified` nếu chỉ trùng SKU/email |
| `unsupported` | Registry ghi field không migrate/không có target tương đương; reason/owner rõ | Không được bỏ khỏi inventory |
| `unverified` | Thiếu source/target/read/rule, scope chưa xác định, HMAC key thiếu, drift chưa phân giải | Không tính pass |

Implement target reader theo tenant/Store, batch theo collection và ID, trả `present/absent/read_failed/unsupported` có `target_read_at`, checksum/revision. So với **verified projection** để kết luận tại verify time; đọc PW2 hiện tại riêng để phát hiện `TARGET_DRIFT`. Không ghi thay đổi sau verify thành lỗi migration tại verify time. `migration_entity_map` có unique source claim, nên duplicate detector phải dùng target provenance độc lập hoặc synthetic controlled claims; lưu danh sách target IDs, không chỉ một status.

**Ràng buộc importer:** Product vận hành thiếu ngay tại verify khiến child không VERIFIED. Fixture `missing Product` trên VERIFIED child chỉ hợp lệ nếu là synthetic, hoặc nếu Product bị xóa **sau verify** và được ghi là drift/current-state. Không nới `verifyStore()` để tạo status xấu. Fixture bắt buộc khẳng định reason và proof source/target tương ứng.

## 4. Hoàn thành field matrix QC (G4)

| Nhóm | Field cần evidence | Test chấp nhận |
| --- | --- | --- |
| Product/SKU | name, slug, status, SKU, sale price, cost, currency, stock theo SKU/location/on-hand/reserved/available, weight/dimension, Category identity/set, image count/identity | Từng field có rule hoặc explicit unsupported/unverified; category/image count bằng nhưng identity khác → mismatch |
| Order | code, item/SKU, quantity, currency, subtotal, discount, shipping, tax, grand total, order/payment method/status, fulfilment/shipping, refund/cancel theo migration scope | Item dùng stable ID, không index mảng; monetary components đúng unit; unknown status không match |
| Customer | identity, address count; PII masked/HMAC | Cross-Store binding bị chặn; raw PII không có trong DB/log |
| Discount | code, type, value, start/end, status | Fixed/percent, currency/timezone, null/end boundary có test |
| Settings | Profile, Team, Email template | Chỉ so target vận hành; raw archived setting không thành match |
| Payment/Delivery/Domain/Integration | Field QC yêu cầu nhưng chưa migrate | Mỗi field xuất hiện `unsupported` kèm reason/owner; không coi là pass |

Money rule theo **từng field**: source/target major/minor, ISO currency, scale, sign, decimal precision, rounding mode, null/zero; dùng integer minor string hoặc Decimal, không float/FX ngầm. Stock rule theo `(SKU, warehouse/location, metric, snapshot_at)`; `on_hand`, `reserved`, `available` là ba field, không so một số stock tổng. Nếu PW1/PW2 không có location/reserved source và QC không duyệt rule thay thế, trả `unsupported`/`unverified` rõ ràng: không thể tạo stock mismatch thật bằng cách bịa dữ liệu.

Thực hiện theo từng nhóm bằng pure normalizer tests và DB integration trên clone. Sau mỗi nhóm, xuất support matrix `field → rule/version → status khả dụng → gap/owner`. Mỗi field chưa support vẫn phải có expected instance hoặc explicit source-scope record trong summary.

## 5. Summary, fixture và phép kiểm toàn tuyến local (G5)

1. Tính riêng `sourceRowTotal/sourceFieldTotal` từ selected CSV sidecar, phân disposition; `importExpectedRecord/Field` từ emitted master + registry + importer scope; `reconciled` và sáu status; `outsideScope` theo field/reason; `openExceptionCount` từ exception ledger. Chặn COMPLETE nếu tổng expected khác tổng sáu status hoặc một expected field có 0/>1 row. Báo `match/expected` và coverage, không loại unsupported/unverified khỏi mẫu số ngầm.
2. Fixture **real**: một export artifact có sidecar → import trên clone → lấy child UUID VERIFIED → ingest → build real generation. Chạy với CSV không còn ở QC reader. Có Product đầy đủ match; export filtered Product/Order vẫn trong source coverage nhưng không thành missing. Assert provenance `exporter_sidecar`.
3. Fixture **synthetic**: bảy case có `expected status/reason/target IDs`: Product full match; Product price mismatch; SKU stock mismatch theo rule đã duyệt (hoặc BLOCKED nếu chưa có rule); Product missing có confirmed absence proof; duplicate hai target cùng source provenance; Order total/status mismatch; exception OPEN. Thêm unsupported, unverified, null/empty, drift và read failure. Không dùng synthetic tính real parity. Seed→query→reset→seed hai lần, xác nhận marker và ngoài marker không đổi.
4. Chạy fault tests: tamper sidecar/manifest, thiếu HMAC key, child/store mismatch, database timeout, concurrent build, crash/retry, target drift. Query DB xác nhận field rows, generation digest, summary và source inventory; test scan không lộ secret/PII.

## 6. Staging QC và F40 handoff (G6–G7)

Sau khi local end-to-end PASS, F42 tạo PR chỉ gồm migration/schema/scripts/docs F42, trỏ `Relates to #1905`; chạy typecheck, focused unit/integration, schema idempotence. Merge/deploy staging QC theo quy trình repo. **Chưa dùng shared staging để seed khi chưa có fixture resettable hoặc execution path staging-safe được duyệt.** Query revision/schema/constraint thật. Operator nạp real sidecar từ private artifact, import child VERIFIED, build generation; ghi numeric Store ID, child UUID, snapshot/generation ID và batch ID riêng. Chạy synthetic fixture cô lập, reset kiểm soát.

Gói bàn giao F40: contract/schema/registry/mapping version + deployed commit SHA; source snapshot/as-of/sidecar hash; Source Store ID số + child UUID VERIFIED; generation ID/digest; support matrix/rule money-stock; safe SQL/read DTO, index/pagination/order, auth/tenant constraints; seed/reset và owner; expected/actual counts; trạng thái `PASS/FAIL/NOT_RUN/BLOCKED` của từng case. F40 tạo API/trang Studio/test browser trong nhánh riêng và kiểm dữ liệu thật từ staging DB. Không đánh dấu toàn bộ F40 migration test đạt khi các TC-MIG.01–10, media/render/SSO hoặc QC Pass gate riêng còn chưa chạy.

## Work packages và ước lượng còn lại

| WP | Nội dung | Phụ thuộc | Ước lượng dev |
| --- | --- | --- | --- |
| A | Registry, source audit, privacy và sidecar count độc lập | Không | 4–7 ngày |
| B | Snapshot binding, schema/lifecycle và staging guard | A identity core | 4–6 ngày |
| C | Target reader, six-status proof, duplicate/drift | A, B | 5–8 ngày |
| D | Product/SKU/Order comparator + money/stock | A, C; QC stock rule | 6–10 ngày |
| E | Customer/Discount/Settings + explicit unsupported | A, C | 5–8 ngày |
| F | Summary, seven-case fixtures, local end-to-end/fault tests | B–E | 4–7 ngày |
| G | Staging QC run và F42 handoff | F; staging authorization/deploy | 2–4 ngày + review/deploy |

Tổng công sức F42 còn lại khoảng **30–50 dev-days**, có thể giảm nhờ làm D/E song song; đây là estimate cho gap đã thấy, chưa gồm F40 UI/API và test migration tổng thể. Chốt lại sau WP A khi có source/target field matrix thật. Bất kỳ field stock/payment/setting không có source hoặc target tương đương phải được QC xác nhận support decision; code không thể tự biến thiếu dữ liệu thành match.
