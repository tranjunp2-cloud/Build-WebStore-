# Phase 03 — Rehearsal DB thật và bàn giao

- Status: in_progress
- Priority: P1
- Budget: 3h, không dùng để thêm tính năng ngoài G2.
- Depends on: phase02 writer/contract freeze và clone DB riêng.

## Công việc

- [ ] Đọc `docs/TEST_CONVENTION.md`; chạy lại test helper liên quan, chỉ mở rộng test code theo TC đã `[x] AUTO`. Không gọi MIG-SCN hoặc MAN-LOCAL là QA AUTO đã được duyệt.
- [ ] Capture clone baseline schema/index/counts/xrefs và canonical checksums của dữ liệu ngoài scope; tắt app jobs/outbound, tắt schema push, xác thực target identity.
- [ ] Chạy dry-run và kiểm chứng zero DB writes/DDL; resolve G1 conflicts theo policy, không chỉnh master để che writer bug.
- [ ] Thực thi [acceptance runbook](acceptance-runbook.md), giữ evidence từng ca. Tất cả destructive fault injection chỉ trên clone riêng.
- [ ] Với fixture lịch sử mới có205 catalog/commerce; followup-001 ngày17/09 thì205/285 chỉ có4entity foundation, phải chọn Store nghiệp vụ khác theo phase06; nếu có legacy foundation diff chưa được duyệt, kết quả expected BLOCKED; fixture synthetic có foundation compatible chỉ kiểm tra create path, không thay nghiệm thu master thật hoặc xóa claim trên DB đích.
- [x] Re-run cùng input/new run kiểm chứng verified REUSE và không duplicate; same run resume kiểm chứng checkpoint.
- [x] Kiểm tra read-back user credential bằng fixture synthetic controlled; giữ existing credential fingerprint và membership ngoài scope. Không gửi login/provider request bằng secret thật ra service ngoài.
- [ ] Kiểm tra counts/projection/refs/childIDs/zero stock/nonzero discount/timestamps và no side effects; verify dependency graph không chỉ counts.
- [x] Chạy `npm run typecheck` và kiểm tra type/lint theo scripts repo có liên quan; failure unrelated phải ghi baseline, không sửa ngoài scope.
- [ ] Lưu report sanitized với elapsed time/throughput/memory observed, selected stores/counts/dispositions/version hashes, failed/block reasons và next safe command. Không extrapolate full-source duration từ hai Store nhỏ khi chưa có size distribution.
- [x] Bàn giao CLI help, resume procedure và restore clone procedure. Không advertise rollback CLI cho business data; baseline backup không phải authorization restore DB đang live.

## Related files

- `./docs/TEST_CONVENTION.md`: read.
- `./docs/qa/F42-pw1-pw2-layer1.md`: read; cập nhật evidence đúng case nếu được chạy, không tự biến reserved TC thành approved automation.
- `./src/__tests__/unit/migration/`: run existing regression; chỉnh pure helper tests chỉ khi đã mapping AUTO hợp lệ.
- `./docs/migration/pw1-local-json-import-runbook.md`: create lúc implementation, public-safe hướng dẫn, không source secrets.
- `$PW1_ROOT/<snapshot-id>/runs/<run-id>/`: create evidence restricted ngoài Git.

## Gate G3 và định nghĩa hoàn thành

Importer local ổn định **trong phạm vi đã xác nhận** khi mọi required row có CREATE/verified REUSE và final verification; selectors/resume/replay/transaction fault/credential/media fidelity đạt, no unauthorized mutation. Không có unresolved required collection/record bị giấu trong warning.

Nếu notifications quarantine/subscribers/contact/analytics source-unverified chưa có quyết định phạm vi, chỉ report phạm vi mapped đã verify và remaining gap; không tuyên bố toàn Store complete. Nếu user chưa chấp nhận scope hẹp, task đầy đủ vẫn chưa hoàn tất.

Không live activation, publish Site, production migration, Vercel readiness, F42 whole-layer sign-off hay full historical parity trong kết quả ngày đầu. Unknown commit chưa reconcile hoặc stale fence test thất bại là NO-GO.

## Phục hồi sau sửa code

Resume không cho đổi writer/schema hash. Nếu lỗi buộc sửa code sau partial commit, archive evidence và restore disposable clone về baseline rồi tạo batch mới; không đổi hash/clear claims. Không có quyền restore DB đích thì BLOCKED, cần reconciliation riêng. [Contract](technical-contract.md) ghi rõ giới hạn này.

## Tình huống trễ giờ

Ưu tiên sửa lỗi integrity/resume; bỏ tiện ích report đẹp hoặc optional UPDATE. Không giảm assertion, bỏ fault tests, nâng trạng thái VERIFIED thủ công, xóa claim, hoặc retry mù để đạt deadline. Bàn giao code/plan trạng thái thực cùng phần việc còn lại.

## Cập nhật implementation

Đã chạy synthetic 15 collections, replay/resume/reuse và 7 DB safety checks. Actual master205/285 chưa được chứng nhận. Lost-ACK sau commit đã mô phỏng bằng wrapper và replay đạt; SIGINT sau Store1/resume Store2 đã đạt; TCP disconnect thật và SIGKILL giữa entity chưa kiểm chứng.

Final CLI evidence `/tmp/pw1-cli-rehearsal-1789555092780`, batch `json:efcccb72-ae39-44ad-bae5-a5590b4a35d8`:2Stores/17entities/15collections, SiteSEO ogImage forward pass2, SIGINT boundary exit4→resume exit0→new batch CREATE0/REUSE17.63tests/7files và typecheck PASS. Đọc fixture205/285 xác minh861/7entities không ghi DB; không thay actual-source acceptance.

## Tiếp nối ngày17/09

Phases04–06 trong [plan chính](plan.md) điều khiển đồng bộ artifact mới trước nghiệm thu nguồn thật. Không áp snapshot/hash/shape205 cũ lên followup-001. Evidence baseline bên trên vẫn giữ nguyên phạm vi.

## Cập nhật thực thi 2026-09-17

[Regression cuối](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files, typecheck và synthetic clone 2 Stores/18 entities PASS sau strict evidence/alias fixes (sau đó focused19/19 và typecheck PASS, gồm 1 path-guard case mới; tổng82 distinct tests qua các lượt, không phải full82 rerun). Không thay nghiệm thu nguồn thật. [Real prepare PASS; dry-run205 BLOCKED](reports/260917-v2-real-artifact-preflight.md): 226485 occurrences selected/global, 3 blocker codes, 0 PW1PROD runs. G5 real actor/credentials BLOCKED; G6 actual apply NOT_RUN. Checkbox mở giữ các phần nghiệm thu/fault case chưa chứng minh.
