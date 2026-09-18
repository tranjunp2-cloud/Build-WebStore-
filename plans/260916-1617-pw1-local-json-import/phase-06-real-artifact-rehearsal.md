# Phase 06 — Rehearsal artifact thật và nghiệm thu theo phạm vi

- Status: in_progress; Priority: P1; ngân sách tiếp tục: **3h**.
- Depends on: G4 đọc/classify đúng artifact; G5 schema+creator evidence đúng selected Store; credential/clone có sẵn.
- Gate đầu ra: G6 — selected real scope có đủ bằng chứng apply/replay/resume; phần còn lại thể hiện NOT_RUN/BLOCKED, không gọi full migration complete.

## Chuẩn bị không thay nguồn

- [x] Xác minh durable archive `/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/.migration/exports/pw1-prod-20260917-followup-001.tar.gz` bằng hash readiness. `/dev/shm/pw1-followup-review/...` chỉ workspace tạm, không durable handoff.
- [x] Extract publication đầy đủ vào thư mục private mới ngoài Git; không dùng tar path traversal/symlink entries. Đối chiếu checksum tất cả7artifact files. Không sửa archive hoặc master để làm hết blocker.
- [x] Tính dung lượng từ bytes thật: khoảng2.60GB artifact + tối thiểu2×master+64MiB spool (~2.19GB), thêm prepared copy, DB clone và margin. Prepare hiện giữ gate conservative hơn; không bypass nếu disk thiếu. Master gần3GB phải tính lại toàn publication, không lấy compressed archive168MB làm size.
- [ ] Copy exact same-snapshot full Users CSV từ `/home/liam/Documents/DB_PROD` vào private0700/file0600; đối chiếu SHA/headers/rowCount với inventory. Không chmod hoặc sửa file nguồn.
- [ ] Nạp PW1_APP_KEY và PW2_MIGRATION_SECRET qua env private; cả hai absent ở readiness trước. Verify key bằng MAC/decrypt/hash synthetic rồi actual scoped readiness, không chỉ kiểm tra presence. Giữ SSO_ENCRYPTION_KEY target hiện hữu; không đưa secret vào CLI/log/chat.
- [ ] Chọn freshclone G5; xác nhận cron/app/webhook/provider không nối vào clone và outbound thật không chạy. Freeze writer/schema/policy/actor bindings trước apply. Code/schema/binding thay đổi sau partial commit → dừng, lưu evidence, restore disposable clone từ baseline rồi new batch. Chỉ resume khi toàn bộ bindings vẫn khớp.

## Thứ tự chạy thật

1. **Structural-only:** đọc/hash/classify toàn artifact; so 2918=2799+118+1 và121859diagnostics với readiness. Hash pass không thay source status needs_review.
2. **Target preflight:** read-only schema/claims/provenance cho một foundation Store;205 hoặc285 chỉ sau creator binding resolved. Source snapshot mới mỗi Store có4foundation records, không có Product/Order/Media.
3. **Prepare:** output folder mới, private credentials và proposed creator binding sidecar. Command `--creator-bindings` chỉ dùng sau phase05 thực sự triển khai/help xác nhận; không đưa lệnh chưa tồn tại cho operator như đã chạy được.
4. **Dry-run foundation:** phải zero business/ledger/DDL writes, chốt CREATE/verified REUSE/CONFLICT. Existing plan/lifecycle/publish/domain/identity diff vẫn BLOCKED, không source-wins.
5. **Apply một foundation Store:** lưu runID/version binding, before/after evidence, verify creator FK và existing actor unchanged. `VERIFY_FAILED`/unknown commit không activate/publish.
6. **Replay/resume:** cùng batch và new batch cùng snapshot; zero duplicate/credential changes. Controlled interruption chỉ trên disposable clone. Không dùng `--from-store` để nhảy qua lỗi chưa giải quyết.
7. **Richer Store:** chọn bằng streamed summary/counts, có Product/Order/Media/arrays; trước apply phải resolve mọi non-Page blocker. Nếu chưa có Store đạt gate thì richer rehearsal BLOCKED, không thay bằng synthetic rồi tuyên bố real commerce passed.
8. **Small list/range:** chỉ sau single/richer evidence; verify numeric selection và cross-Store uniqueness/claim scope. Chưa chạy `--all` batch lớn khi mọi selected scope chưa ready; `--all` chỉ emitted artifact Stores, báo source blocked/deferred riêng.

## Mười sáu ca critical: phải có trạng thái và bằng chứng riêng

Đây là acceptance evidence checklist; không tạo TC AUTO mới tự động. Link case với QA đã duyệt; dùng manual clone evidence khi chưa có AUTO. Pass synthetic cũ không được đổi thành pass real-source.

| ID local | Trigger / bằng chứng cần thu | Expected / gate |
|---|---|---|
| REAL-01 | New/old contract, wrong hash/policy/actor checksum; archive/publication integrity | Exact supported profiles only; modified bytes rejected trước write |
| REAL-02 | >121859diagnostics, unknown global rule, Page typed/shared ownership | Bounded RSS/counters/samples; no non-Page blocker silently ignored |
| REAL-03 | Dry-run before/after catalog/schema/ledger snapshot, wrong target | Zero DB writes/DDL; wrong DB refused |
| REAL-04 | Fresh clone slug migration twice, forced DDL/index failure | Correct composite uniqueness; second run stable; partial schema cannot pass gate |
| REAL-05 | Correct actor binding vs missing/ambiguous/email-only/wrongsource binding | Only verified existing target reused; missing/ambiguous BLOCKED |
| REAL-06 | User createdBy create/pass2 + read-before-write context | Historical creator preserved; no role/membership/password change on actor |
| REAL-07 | Credential goodMAC/currenthash vs stale/missing/badkey | New User only with proved policy; existing password unchanged; no secret logs |
| REAL-08 | Entity transaction fails after business write before ledger | Both rollback; no orphan nested row; sequence gaps acceptable |
| REAL-09 | Connection lost at commit ACK | DB evidence reconciled before retry; no duplicate/compensating delete |
| REAL-10 | SIGINT/hard kill midStore, then resume earliest unfinished Store | Completed entities reused, unfinished correctly continued; no skip-to-success |
| REAL-11 | Concurrent CLI + lease expiry/stale worker | One authorized writer, final fence prevents stale commit/finalization |
| REAL-12 | Target/actor mutated after dry-run; source/binding/code/schema drift | Conflict/replan; no overwrite or edited-run binding |
| REAL-13 | Category parent topology, Site media forward refs, cross-tenant ref | Correct post-pass2 projection; invalid ownership refused; no external UPDATE leak |
| REAL-14 | Real catalog/orders: >5images, >300description, zero stock, nonzero discount, product-null historical item | No truncation/remap; money/arrayID/timestamp/customer snapshots preserved |
| REAL-15 | Media read/populate S3-enabled, hooks and background predicates | External URL preserved, zero upload/mail/provider/stock replay; live jobs remain excluded |
| REAL-16 | Same batch/new batch replay + outside-scope baseline + full disposition counts | Zero duplicates/unauthorized changes; Pages untouched; no full-source claim from selected scope |

Nếu không tái hiện REAL-09/11 trong timebox, ghi NOT_RUN và giữ corresponding stability gate mở. Một lỗi generic phải điều tra sanitized code/path trên clone; không print full payload/driver error. Test changes làm writerHash đổi thì tạo run/fixture mới đúng policy; không chỉnh DB binding của run cũ cho test pass.

## Evidence pack và output operator

Mỗi case: sourceInstance/snapshot/mapping+actor+binding hashes, code/schema fingerprint, clone identity masked, selectedStore list, runID, expected/actual, PASS/FAIL/BLOCKED/NOT_RUN, thời gian và count/projection checksums. Full PII nằm private evidence; docs/Git chỉ summary sanitized. Không ghi passwords, ciphertext, DB URI hoặc email/name raw vào report công khai.

Output phải tách ba mức:

- **Structural validation passed:** bytes/schema/coverage hợp lệ; chưa chứng minh target/semantic readiness.
- **Selected-scope verified:** đúng Store/collections và policy đã nghiệm thu; ghi danh sách scope/counts và exclusions.
- **Full source:**2799emitted,118blocked,1deferred và diagnostic disposition riêng; hiện chưa có căn cứ full-source verified.

3GiB parser benchmark trước đây10.64s/98.52MiB chỉ là streaming/hash synthetic.63tests/7files và17entities synthetic là regression baseline, không throughput real business hoặc QA full-source. Đo riêng thời gian real dry-run/apply/verify và peakRSS; không ngoại suy2918Stores từ foundation205/285.

## File map / bàn giao

| Absolute path | Action lúc implementation | Nội dung |
|---|---|---|
| `/home/liam/data/ech-prime-web-v2/src/__tests__/integration/pw1-json-clone-rehearsal.ts` | Reuse/extend theo approved QA | Clone-only failure/replay harness, source refs import thật |
| `/home/liam/data/ech-prime-web-v2/src/__tests__/unit/migration/pw1-json-*.test.ts` | Reuse/targeted extend |63core tests + newcontract/classifier/binding regressions |
| `/home/liam/data/ech-prime-web-v2/docs/TEST_CONVENTION.md` | Read | AAA/source imports/test generation rules |
| `/home/liam/data/ech-prime-web-v2/docs/qa/F42-pw1-local-json-import.md` | Update evidence | Per-case actual status, không mass-check pass |
| `/home/liam/data/ech-prime-web-v2/docs/migration/pw1-local-json-import.md` | Update | Supported contracts, prepare binding flag, error/recovery procedure |
| `/home/liam/data/ech-prime-web-v2/plans/260916-1617-pw1-local-json-import/reports/` | Create sanitized final report | G4/G5/G6 results, open blockers, measured limits |
| `/home/liam/migration-data/pw1/<snapshot-id>/runs/<run-id>/` | Private evidence only | Immutable input/binding references, detailed audit protected |

## Timebox và điều kiện kết thúc

Phase04+05+06 = **8h ngân sách công việc tiếp theo**, không cộng nhầm thành importer đã hoàn thiện trong một ngày đã qua. Nếu keys/target creator/provenance hoặc richer-source fix chưa sẵn, code integration vẫn có thể tiến nhưng real apply không đạt. Không lấy3h rehearsal để thêm generic merge/rollback/Vercel orchestration. Không sửa DB gốc, không activate/publish/cutover. Bàn giao chính xác phần đã pass và phần còn thiếu, kèm next safe action.

## Cập nhật thực thi 2026-09-17

[Regression cuối](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files, typecheck và synthetic clone 2 Stores/18 entities PASS sau strict evidence/alias fixes (sau đó focused19/19 và typecheck PASS, gồm 1 path-guard case mới; tổng82 distinct tests qua các lượt, không phải full82 rerun). Không thay nghiệm thu nguồn thật. [Real prepare PASS; dry-run205 BLOCKED](reports/260917-v2-real-artifact-preflight.md): 226485 occurrences selected/global, 3 blocker codes, 0 PW1PROD runs. G5 real actor/credentials BLOCKED; G6 actual apply NOT_RUN. Checkbox mở giữ các phần nghiệm thu/fault case chưa chứng minh.
