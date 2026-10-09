# Phase08 — Import theo nhóm tối đa100 store

Status: implemented and verified on clone; real master blocked by source diagnostics. [Kết quả nghiệm thu](reports/260918-grouped-import-implementation.md). Review và các điều kiện bắt buộc: [báo cáo review](reports/260918-store-groups-plan-review.md). Ngày: 2026-09-18.

## 1. Mục tiêu và phạm vi

Theo yêu cầu operator: kiểm tra100 store → tất cả pass → import/verify nhóm đó → giải phóng bộ nhớ → nhóm kế tiếp. Giữ CLI một store/list/range/all và một runId để resume toàn lượt chạy. Chỉ local, DB hiện hữu; không thay UI, không Vercel và không tự bỏ qua diagnostic.

100 là số store thực tế có trong selection đã sort theo ID số, không phải khoảng100 ID. Nhóm cuối có thể ít hơn100. Mỗi thời điểm chỉ hydrate một store, không nạp100 store cùng lúc.

## 2. Bằng chứng hiện tại và giới hạn

- `runner.ts` preflight toàn selection trước khi ghi; `PreflightRegistry` tích lũy khóa toàn selection.
- `artifact.ts` đã stream master ra spool theo store, nhưng vẫn cần kiểm tính toàn vẹn toàn publication trước ghi.
- Đã sửa collector tổng hợp sau classification, lưu target-check theo store; source-scope bỏ chỉ mục contribution dư thừa.
- 94tests liên quan và typecheck PASS; clone rehearsal prepare/dry-run/apply/SIGINT/resume/reuse PASS. Evidence `/tmp/pw1-cli-rehearsal-1789705354891`.
- Full dry-run thật đã qua artifact2799Stores trong khoảng187s, không còn DIAGNOSTIC_BUCKET_LIMIT/SOURCE_SCOPE_MEMORY_LIMIT, sau đó dừng ARTIFACT_BLOCKED với98675 occurrences. Log `/tmp/pw1-full-diagnostic-fix-2.{stdout,stderr}.log`.
- Occurrences không phải số store lỗi. Có lỗi description/blog fidelity, media/link, permission parity, SKU/EAV, order/customer và coverage. Chia nhóm không tự sửa các lỗi dữ liệu này.
- Store636 cũ còn projection conflict; batch cũ có code fingerprint khác. Không xóa claim hay đổi fingerprint để vượt gate.

## 3. Các quyết định chốt

1. Mặc định100store/nhóm; thêm `--group-size N`, số nguyên1..100. Không chạy song song store trong phiên bản này.
2. Một parent batch/runId cho toàn selection; ranh giới nhóm cố định từ selection gốc + groupSize. Resume không được thay selection/groupSize.
3. Kiểm toàn vẹn publication một lần mỗi invocation; nhiều lượt streaming report để chứng minh classification vẫn được phép. Không load lại toàn publication cho mỗi nhóm.
4. Global corruption/blocker chặn trước mọi business write. Diagnostic thuộc store chỉ chặn nhóm chứa store đó.
5. Một nhóm có bất kỳ store fail thì không bắt đầu business write của nhóm đó. Không tự skip lỗi rồi nhập nhóm sau.
6. Khi apply đã bắt đầu, checkpoint theo entity/store hiện tại; không hứa transaction rollback cả100store.
7. Giữ quy tắc creator1→null, creator51 binding, password sidecar và historical gallery.

## 4. Luồng chạy đề xuất

### A. Xác nhận artifact và chuẩn bị spool

- Kiểm URI local/schema sẵn có, manifest/hash/profile, report coverage, source ownership, receipts và các global integrity checks.
- Stream master vào file từng store có hash, quyền0600 trong thư mục0700 ngoài repo.
- Hoàn tất classification trước khi tổng hợp disposition; chi tiết target-check lưu theo store, đọc tối đa một store.
- Phân biệt global blockers với store blockers; giữ số đếm toàn bộ và tối đa vài mẫu mỗi nhóm lỗi. Không giữ hàng trăm nghìn source identities trong summary.
- Artifact input không đổi; spool chỉ là dữ liệu tạm. Đủ dung lượng trước khi đọc, ENOSPC báo rõ và không đẩy sang nhóm kế tiếp.
- Lỗi hash/schema/duplicate ownership thật vẫn fail, không chuyển thành warning vì grouping.

### B. Lập selection và nhóm

- Sort ID bằng BigInt như selectors hiện tại, deduplicate theo contract.
- Chunk selection thành danh sách cố định tối đa100. Persist `executionVersion` và `groupSize` trong batch.binding.
- Giữ metadata nhóm: index/count/store IDs, trạng thái được suy ra từ ledger; không cần bảng group riêng trong phiên bản đầu.
- Với apply: sau global validation tạo parent batch và lấy lease trước group preflight. Có runId ngay cả khi nhóm đầu fail.
- Với dry-run: không tạo parent/child run/claim và không cập nhật DB.

### C. Preflight nhóm hiện tại

- Kiểm store-scoped diagnostics của toàn nhóm, báo group/store/code/count và mẫu source ID.
- Đọc tuần tự từng store, buildEntities, validate creator/credential, target checks và target conflict.
- Chỉ sau khi tất cả store chưa hoàn thành của nhóm pass mới cấp child runs rồi bắt đầu apply.
- Tách cross-group uniqueness khỏi RAM registry. Không đơn giản clear map rồi quên collision ở các nhóm trước.
- Registry trên spool dùng sorted runs, không tự xây hash-partition đệ quy. Tách hàm sinh khóa từ `registerSourceKeys` để RAM registry và disk registry dùng cùng semantics (source ownership/checksum, unique fields/indexes/natural keys, product/variant SKU).
- Ghi key/owner/checksum thành run sắp xếp với buffer mục tiêu8MiB, accounting gồm overhead và hard cap64MiB; merge streaming tối đa16readers cùng lúc, nhiều lượt nếu cần. Phát hiện conflict cả trong nhóm lẫn với index các nhóm trước; không Map toàn partition vào RAM.
- Index mới ghi vào file tạm riêng, xác minh record count/hash rồi rename thay phiên bản cũ sau preflight pass. Không để log/ledger hiểu index tạm là checkpoint DB. Cùng source chỉ tương thích khi collection/storeId/sourceChecksum đều giống; khác owner/checksum là conflict.
- Registry là cache tái tạo, không phải dữ liệu cần tin cậy qua restart. Mỗi invocation xây mới bằng source đã kiểm hash; ghi vào dir0700/file0600, kiểm hash trước khi đọc lại. SIGKILL có thể để lại spool không hoàn chỉnh; lần sau không dùng spool đó.
- Apply vẫn kiểm DB unique/claim trong transaction ngay lúc ghi để xử lý TOCTOU. Registry spool bảo đảm full dry-run cũng phát hiện collision giữa hai nhóm mà không ghi DB.
- Chỉ commit khóa nhóm vào registry sau group preflight thành công. Nhóm bị chặn không tạo bằng chứng pass.

### D. Apply và verify nhóm

- Giữ `writeEntity`, `finalizeEntity`, `verifyStore` và fencing/transaction hiện có.
- Ghi một store tại một thời điểm; thành công thì markStoreVerified.
- Revalidate store ngay trước write, vì DB có thể đổi sau group preflight. Nếu đổi, dừng; không overwrite.
- Sau toàn nhóm VERIFIED, báo GROUP_VERIFIED rồi bỏ references/proposal/map của nhóm khỏi RAM.
- Xóa spool nội dung nhóm đã xong chỉ sau group verify và commit registry; mọi read/verify/rebuild consumer trong invocation phải đã kết thúc. Giữ registry/checkpoint cần thiết. Không gọi global.gc hoặc tăng heap để che giữ tham chiếu.
- Parent chỉ VERIFIED khi mọi ID trong selection gốc đều có store ledger VERIFIED.

## 5. Ledger và resume — thay đổi bắt buộc

`createBatch` hiện tạo migration_runs=PREFLIGHT_PASSED cho mọi store. Không được giữ cách này khi mới kiểm tra một nhóm.

Phương án ít thay schema:

- Tách `createBatch` thành tạo parent với selected_store_ids và hàm `registerPreflightedStores` idempotent cho nhóm đã pass.
- Chưa tạo migration_import_stores/child run cho store chưa preflight; tránh cần sửa enum migration_runs hoặc nullable run_id.
- Store chưa có child được hiểu là chưa bắt đầu; selected_store_ids ở parent là danh sách chuẩn.
- Sửa mọi phép tính complete/lease release/markStoreVerified: không được chỉ nhìn các child đã tạo. So đủ selection để tránh parent VERIFIED ngay sau nhóm1.
- Tạo child runs+store rows nhóm đã pass trong một transaction có assertFence trước/sau, chứng minh từng store thuộc selection và đúng nhóm cố định. Retry kiểm binding, giữ run_id/state đã có, không reset store VERIFIED; không chỉ ON CONFLICT DO NOTHING rồi giả định thành công.
- `completeBatch` dùng anti-join từ toàn selected_store_ids sang child rows, kiểm thiếu row/non-VERIFIED/extra child; không chỉ đếm rows vì một missing và một extra có thể triệt tiêu. Test selection nằm đúng DB batch, không lấy mảng caller làm bằng chứng.
- Resume: xác minh binding như cũ; tạo lại spool từ artifact, giữ ranh giới nhóm ban đầu. Kiểm tra lại các store VERIFIED theo nhóm với bộ nhớ giới hạn; đồng thời xây lại registry từ khóa nguồn của những store này trước preflight phần còn lại. `--from-store` không bỏ qua bước dựng bằng chứng chống trùng.
- Với nhóm dở dang, merge khóa của toàn nhóm (kể cả store đã VERIFIED) vào registry một lần; duplicate cùng owner/checksum là idempotent, collision khác vẫn chặn. Resume phải cho cùng kết quả conflict với lần chạy không ngắt.
- Resume batch đã VERIFIED không gọi `acquireLease` làm downgrade trạng thái rồi thoát mà không hoàn tất. Chốt hàm `completeBatch` dưới fencing: kiểm exact selection và mọi store VERIFIED; gọi ở cuối loop cả khi không có store cần ghi. Trường hợp kill ngay sau store cuối vẫn resume được về VERIFIED.
- Nhóm dở dang: verify store đã xong, preflight lại phần chưa xong, đối chiếu entity claims rồi tiếp tục. Không ghi lại store VERIFIED, không tạo bản sao.
- `--from-store` chỉ là cursor hợp lệ, không cấp quyền bỏ qua store chưa xong hoặc thay ranh giới nhóm.
- Lease phải được gia hạn trong group preflight kéo dài, không chỉ trong write loop. Heartbeat async mỗi30s, tối đa một renewal in-flight, timeout ngắn hơnTTL300s, chỉ nối lịch sau khi promise hoàn tất. Lỗi renewal được lưu và throw tại await boundary trước mọi registration/write/group transition; không unhandled rejection.
- Không gia hạn đua với release: dừng schedule, chờ renewal đang chạy kết thúc rồi release trong finally. Sort/merge có yield định kỳ để không chặn event loop lâu hơnTTL. Batch fence vẫn là điều kiện transaction; mất lease thì không ghi tiếp.
- Lease parent chỉ khóa cùng batch. Với hai batch khác nhau có selection chồng nhau, giữ advisory store lock/active-run check/claim uniqueness; fail trước business write store nếu batch khác đã active. Không tự chiếm store đang PAUSED.
- Batch mới có executionVersion=grouped-v1 và groupSize bắt buộc trong binding. Batch cũ không có executionVersion: báo GROUPED_RESUME_UNSUPPORTED trước mutation; không triển khai hai runner trong timebox này. Operator muốn resume batch cũ phải dùng đúng code cũ và binding cũ.
- Resume không nhận `--group-size`; đọc size từ binding. Đọc metadata để chọn parser trước, rồi xác minh toàn binding/writer/schema hash như cũ; không nới guard để resume code khác.
- Nếu nhóm sau fail do input/code cần sửa: thay artifact/export hoặc code làm binding đổi nên không thể resume batch cũ. Phải có báo cáo reconciliation và batch mới cho phạm vi chưa hoàn thành; các store/entity đã ghi chỉ được reuse sau đối chiếu. Batch đang partial/PAUSED phải được giải quyết bằng quy trình quản lý hiện có; không tự release claim, đổi namespace hoặc xóa ledger. Lỗi transient/DB availability đã phục hồi với cùng input/code mới phù hợp resume trực tiếp.

## 6. Memory/disk và lỗi lớn

- Một hydrated store giới hạn64MiB serialized như hiện tại. Store vượt ngưỡng dừng với storeId/size/limit; giảm groupSize không giải quyết một store quá lớn.
- Giới hạn RAM registry theo bytes, không chỉ số entries; giữ cap riêng cho diagnostic/classification/credential đã có.
- Sorted-run registry tối đa16reader đồng thời, budget bao gồm buffer parse/sort/merge và index cũ+mới trên đĩa; test data skew/duplicate và cleanup lỗi. Chưa đạt test bounded memory thì chưa bật full apply.
- File credential hiện đọc trong ngân sách64MiB; không nhân bản Map credentials cho từng nhóm; không log credential.
- Spool/hash/report mỗi invocation có thể cần đọc nguồn vài lượt. Resume được phép scan lại sau khi process khởi động lại; không cam kết không đọc lại master qua các invocation.
- ENOSPC/I/O failure: dừng, release lease nếu có, không bỏ checkpoint đã commit; dọn đúng spool riêng của invocation. Không xóa thư mục người dùng.
- Cleanup chỉ xóa cache tạm; reports lỗi cần giữ ngoài spool và chỉ gồm metadata không bí mật.

## 7. Diagnostic và log

Logging durable triển khai cùng phase này theo [Phase09 — logs và summary](phase-09-migration-run-logs.md). Logger scaffold/event contract cần có trước khi nối group runner.

Global fatal: hash/profile/schema/coverage sai, corrupt receipts, ownership/index không đủ bằng chứng, global diagnostic chưa được giải quyết.

Store fatal: source diagnostic gắn store, thiếu creator binding/credential của store, target projection conflict, SKU/slug/relationship invalid. Chặn trước apply của nhóm chứa store. Nếu liên quan nhiều store, phải giữ dependency evidence; không chuyển lỗi global sang store tùy ý.

Log ví dụ:

```text
GROUP_PREFLIGHT group=2/28 stores=100 completed=17/100
GROUP_PREFLIGHT_PASSED group=2/28
STORE_APPLY group=2/28 store=205 completed=3/100
STORE_VERIFIED store=205
GROUP_VERIFIED group=2/28
GROUP_BLOCKED group=3/28 store=636 code=TARGET_PROJECTION_CONFLICT
```

Giữ stdout JSON và stderr progress. Lỗi phải kèm runId/group/store khi đã biết. Report đủ blocker của nhóm, không chỉ dòng chung ARTIFACT_BLOCKED.

## 8. CLI hiện tại

```bash
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb --dry-run
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb
npm run migrate:pw1:import -- --resume "$PW1_BATCH_ID" --local-database primeweb
```

Dry-run chạy group preflight tuần tự, không apply. Dừng ở nhóm lỗi đầu tiên; chỉ báo PREFLIGHT_PASSED cuối khi tất cả nhóm pass. Chạy apply là invocation mới, phải kiểm tra lại; không dùng kết quả dry-run cũ làm giấy phép ghi.

## 9. Test và acceptance gate

- Selector:0/1/99/100/101/201store, ID rời rạc, list trùng, ID lớn, range, invalid groupSize.
- Group1 pass→ghi/verify, group2 preflight fail→không business write group2/3; group1 giữ nguyên.
- Full dry-run không thay bất kỳ business/ledger row; collision giữa store ở hai nhóm vẫn bị phát hiện.
- Lỗi store cuối preflight không tạo business data cho99store trước đó trong cùng nhóm.
- SIGINT/process kill sau entity, sau store, giữa hai nhóm; resume chỉ tiếp tục phần chưa xong.
- Store100 fail trong group1; store101 fail trong group2; from-store không skip store chưa xong.
- Parent không VERIFIED khi các nhóm sau chưa được đăng ký; child registration retry idempotent; extra child không che missing child; resume batch đã VERIFIED và kill sau child cuối không downgrade trạng thái.
- Lease hết hạn/mất lease trong preflight; renewal timeout, overlap và cleanup khi còn promise; hai process cùng batch và hai batch khác nhau cùng store; lost commit ACK.
- Diagnostic >120000identities, contribution >500000rows, spool bị sửa/thiếu, disk full và source hash đổi.
- Cross-group registry được dựng lại trên resume; conflict chỉ xuất hiện giữa nhóm1 và nhóm3 vẫn bị phát hiện sau crash/--from-store; duplicate source khác collection/store/checksum bị chặn.
- Nhiều nhóm có products/orders/images lớn: đo RSS qua group boundary để chứng minh không tăng theo tổng entity, không chỉ dựa trên kích thước master.
- Rehearsal >=3nhóm trên DB clone (groupSize2 để test nhanh), kiểm tra independent SQL và credentials/creator/gallery.
- Real dry-run trên phạm vi đã biết sạch, rồi full2799stores. Ghi rõ nhóm/store bị chặn do source; không gọi full-ready khi còn blocker.

## 10. Thứ tự triển khai và timebox một ngày

1. 1h: chốt contract groups/binding, phân loại global/store blockers, unit tests selector.
2. 2h: runner theo nhóm + register child lazily + completion predicate + lease/resume.
3. 2h: disk registry cho cross-group checks, giới hạn RAM/disk, fault cases.
4. 2–3h: events/errors/summary bền vững, privacy/backpressure/fault tests và README ngắn (chi tiết Phase09).
5. 2h: regression, clone rehearsal, real dry-run và đo bộ nhớ.

Timebox8h ban đầu chưa bao gồm yêu cầu durable logs đầy đủ; sau bổ sung Phase09 ước lượng tổng9–10h. Đây không phải cam kết sửa98675source diagnostic trong ngày. Nếu cross-group registry hoặc checkpoint chưa đạt test thì chưa bật full apply; không bỏ kiểm tra để kịp giờ.

Files chính: `runner.ts`, `ledger.ts`, `artifact.ts`, `diagnostics.ts`, `writer.ts`, `types.ts`; thêm group planner và disk registry nhỏ, tests tương ứng. Ưu tiên không đổi DB schema; nếu phát sinh field/constraint mới phải cập nhật schema helper/db-setup và verifier đồng bộ.

## 11. Definition of done

Có thể chạy một lệnh, thấy preflight→apply→verify của từng nhóm; RAM không tích lũy entity/diagnostic theo toàn master; resume đúng checkpoint; không bỏ lỗi source hoặc uniqueness xuyên nhóm; dry-run không ghi DB; README đủ lệnh và giới hạn hiện tại. Full migration dữ liệu thật chỉ được xác nhận khi mọi nhóm thực sự VERIFIED.

## 12. Kết luận review trước triển khai

Plan sau sửa có thể bắt đầu triển khai theo thứ tự ledger tests → group runner → disk registry → integration. Đây là kết luận về thiết kế, không phải nghiệm thu runtime. Không deploy/full apply trước acceptance gate.

Store3 đã xuất hiện blocker trong kết quả full dry-run nên có thể chặn ngay nhóm đầu của `--all`. Demo luồng3nhóm phải dùng fixture/selection đã kiểm tra; không tự skip lỗi hoặc gọi việc chia nhóm là đã migrate được toàn bộ master.

Timebox8h cần ưu tiên correctness: không bổ sung scheduler, bảng job/group, parallel writers hoặc cache persistent. Nếu registry/checkpoint vượt thời gian, báo rõ phần chưa đạt; không loại bỏ uniqueness/resume test. Không cam kết hoàn tất làm sạch dữ liệu nguồn trong timebox này.
