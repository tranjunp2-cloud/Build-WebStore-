# PW1 importer — kế hoạch và triển khai tiếp nối ngày 2026-09-17

## Bối cảnh

Tiếp tục cùng [plan #1886](../../plans/260916-1617-pw1-local-json-import/plan.md), giữ core local CREATE/verified REUSE/CONFLICT, transaction, ledger và resume. Baseline trước đó:63tests/7files và typecheck pass; fixture hai Store/17entity đã qua15collection, pass2, SIGINT/resume/replay; có evidence fencing/rollback và lost ACK mô phỏng. Đây là bằng chứng synthetic, chưa phải migration nguồn thật.

## Ghi nhận

[Readiness mới](../../plans/260916-1617-pw1-local-json-import/reports/260917-exporter-readiness.md) xác nhận archive cùng bảy file khớp hash. Artifact followup-001 có master khoảng1,06GB, toàn bộ publication khoảng2,60GB;2918Store nguồn gồm2799emitted,118blocked,1deferred. Tại thời điểm lập kế hoạch, importer trả EXPORT_MANIFEST_INVALID vì contract, policy và actor sidecar mới chưa được hỗ trợ; phần triển khai bên dưới cập nhật trạng thái sau đó.

Có121859diagnostics; mọi Store emitted còn creator-binding gate. Store205/285 của snapshot mới chỉ có Tenant/User/Site/Subscription, không còn là mẫu commerce trước đây. Clone cũ chứa thử nghiệm synthetic; nghiệm thu thật cần clone mới. Khóa nguồn/sidecar và danh tính actor đích vẫn là prerequisite phải cung cấp/xác minh riêng.

Lượt lập kế hoạch ban đầu chỉ ghi tài liệu. Sau đó người dùng đã cho phép triển khai; những thay đổi và kiểm chứng mới được ghi riêng bên dưới.

## Nhận xét

Điểm khó đã chuyển từ ghi từng entity sang chứng minh tương thích handoff và quyền sở hữu. Integrity đúng không làm diagnostics biến mất; nâng giới hạn mảng diagnostics hay bỏ unknown warning sẽ che gate thay vì giải quyết. Benchmark parser3GiB cũng không đại diện RAM/đĩa của cả master+report+spool+preflight.

63tests hiện hữu cần giữ làm regression, nhưng chưa chứng minh contract mới, actor binding hoặc schema mới. Test bổ sung phải gắn TC AUTO phù hợp; không tự đánh dấu16ca manual đã đạt từ số test tổng.

## Quyết định

Theo [continuation decisions](../../plans/260916-1617-pw1-local-json-import/continuation-decisions.md):

- Bổ sung phases04–06 trong cùng folder: contract/diagnostics2h, schema/actor3h, rehearsal3h; timebox có điều kiện, không cam kết migrate toàn nguồn trong8h.
- Dispatch strict theo contract/profile; giữ artifact bất biến. Classifier dùng evidence cho cả diagnostics và field disposition; required/global/unknown chưa resolve vẫn block.
- Port chọn lọc backend collection+SQL từ worktree-2, giữ transaction req fixes; xác minh constraints trước/thực hiện sau migration, không rewrite slug hoặc merge toàn worktree.
- Creator chỉ bind User đích hiện hữu đã xác minh, qua shared claims và consumer dependency; không tạo admin, sửa mật khẩu/role/membership hoặc dùng email làm chứng minh identity.
- Giữ local-only, không Page/UI/live cutover, không UPDATE tổng quát. Code/schema/binding đổi thì không sửa ledger để resume run cũ.

## Bước tiếp theo tại thời điểm lập kế hoạch

1. Hoàn thiện phase04–06 và TC mới: contract dispatch; diagnostics vượt100k với bounded samples; classifier thống nhất report-row; actor binding conflict/tamper và shared-claim lifecycle.
2. Kiểm schema duplicate read-only; thử migration hai lần trên clone mới, verify index semantics và regression caller cho slug scoped, ảnh/mô tả dài, Order Product nullable.
3. Có đủ khóa và actor evidence mới prepare→dry-run→apply một Store thật; so baseline/credentials/outside-scope, resume/replay. Chọn Store nghiệp vụ từ summary hiện tại sau khi đóng gate của chính Store đó.
4. Kết thúc timebox ghi đúng CODE_READY/PREFLIGHT_BLOCKED/REAL_STORE_VERIFIED/BUSINESS_SAMPLE_VERIFIED. Không Store nào đạt thì bàn giao blocker evidence; không đổi synthetic thành real acceptance hoặc đóng issue khi AC còn thiếu.


## Cập nhật sau triển khai được phép

Đã bổ sung strict v2 contract/policy/actor sidecar, bounded diagnostics aggregation, target gates và creator bindings. Port backend chọn lọc giữ tenant slug, bỏ Product limits300chars/5images và cho historical Order product nullable. Schema helper khóa/preflight/verify nguyên tử; root chạy hai lần trên fresh clone `pw1_import_1886_v2_20260917` PASS. Không migrate schema DB gốc.

Review creator phát hiện hai lỗi cụ thể: evidence chỉ hash arbitrary bytes và alias target chỉ kiểm trong một file. Đã sửa thành typed decision exact source+target+approval record, cùng reverse active-claim check dưới target User row lock. Re-review source không còn hai lỗi này; test v2 riêng18/18 PASS. Operator-provided binding là trust boundary, không có chữ ký/auth service và không tự tạo quyết định mapping người dùng thật. Existing actor không đổi credential/role/membership.

Tester báo full suite81tests/8files PASS; sau path guard mới, focused19tests PASS và final typecheck PASS. Tổng82distinct qua các lượt, không có full82rerun hoặc DB rerun sau path-only change. Synthetic v2 haiStore/18business entities/15collections qua prepare, dry-run, apply có SIGINT, resume và cross-run REUSE18; existing shared actor giữ nguyên, owner SKIP+consumer dependencies đúng. Có checks6ảnh,350chars, product-null historical snapshot, PBKDF/SSO, stock0 và tiền. Evidence `/tmp/pw1-cli-rehearsal-1789633701412`; clone đã chứa fixture/controlled drift, không dùng làm baseline thật.

Prepare source thật thành công tại `/dev/shm/pw1-real-v2-prepared-20260917`. Volume `/` chỉ còn khoảng2,2GB trong khi copy cần khoảng4,7GB; tmpfs là giải pháp kiểm chứng tạm, chưa phải private storage bền vững. Không đưa master/CSV/secret vào Git.

Dry-run thật Store205 kết thúc exit3 `ARTIFACT_BLOCKED`; hash/contract parse đã qua nhưng source/global unresolved còn226485 diagnostics gốc+derived row/field records. Count này không phải số Store hay raw exporter blockers. Mã gồm SUBSCRIPTION_CANCEL_FLAG_ABSENT, SOURCE_FIELDS_UNRESOLVED, REPORT_ROW_UNRESOLVED; creator decision/keys vẫn cần cung cấp hợp lệ. Evidence private `/dev/shm/pw1-real-v2-prepared-20260917/dryrun-205.private.jsonl`. Không có real apply và không công bố live-ready.

## Việc còn lại sau kiểm chứng

Worktree2 cần publication với typed dispositions/evidence giải quyết shared/global source blockers; operator cung cấp credential keys đúng snapshot và real creator decision/binding, không bỏ gate bằng blanket-ignore. Bố trí durable private storage đủ dung lượng, chuẩn bị lại baseline clone sạch, rồi dry-run/apply Store được chọn. Store205/285 hiện chỉ là foundation; commerce cần richer Store riêng. Concurrent actor race, hard kill giữa entity, full outside-scope projections và throughput toàn2918Store chưa được chứng minh bởi synthetic run.

Bài học: checksum chứng minh file không đổi, không chứng minh identity mapping đúng; một unique source claim cũng không tự ngăn nhiều source actor trỏ cùng target. Bằng chứng unit, synthetic DB, structural prepare và real business acceptance phải luôn báo riêng. Runbook đã cập nhật [v2 commands và prerequisite](../migration/pw1-local-json-import.md).
