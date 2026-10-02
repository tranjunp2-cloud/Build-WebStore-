# Phase 09 — Staging rollout, handoff và gate QC/cutover

## Context

Ưu tiên P0; trạng thái pending; ước lượng **2–3 dev-days + thời gian QC thực thi/nghiệm thu**, phụ thuộc Phase 01–07. Phase 08 là gate riêng nếu muốn claim F40 đầy đủ cả Page/Block render. Đây là bước xác nhận đầu ra triển khai, không phải thao tác cutover tự động.

Nguồn quy tắc: [yêu cầu QC và báo cáo tổng](../reports/260930-f42-f40-evidence/00-overview.md), [kế hoạch test PW1→PW2](../../docs/qa/TEST_PLAN_MIGRATION_PW1_PW2.md), [F40 QA matrix](../../docs/qa/F40-qa-control-center.md), [F42 importer QA matrix](../../docs/qa/F42-pw1-local-json-import.md).

## Gói handoff bắt buộc

| Nhóm | Artifact/bằng chứng phải có |
| --- | --- |
| Revision | F42/F40 commit SHA, contract/schema/registry/comparator versions, migration SQL version, deployment URL/environment identifier; không đưa secret |
| Run | Numeric Source Store ID, source instance/snapshot ID/hash/as-of, **child run UUID VERIFIED** và batch ID `json:<uuid>` gắn nhãn riêng, target binding đã làm mờ |
| Evidence | Generation ID/digest/state `complete`, `targetReadAt`, summary record/field expected/status counts, outside-scope list, open exceptions, transform/reason codes |
| Export coverage | Source sidecar hash/contract + selected CSV snapshot/config/manifest hashes; source-wide counts emitted/retained/excluded/unresolved/blocked/deferred; owner giữ private CSV; QC chỉ nhận safe DB/API evidence, không cần CSV |
| Fixture | Importer fixture và comparator synthetic fixture tách riêng; owner, seed/reset lệnh, marker, expected/actual counts, kết quả 2 lần replay/reset, cleanup |
| Security | Auth/access proof, PII/secret redaction proof, tenant/store isolation, pagination limit, audit log an toàn; không có credential trong repo/API/browser |
| QC | Test matrix TC-ID với PASS/FAIL/NOT_RUN/BLOCKED, browser evidence trên staging QC, các gap còn mở với owner và next action |

## Rollout theo bước

1. Chốt revision từ PR nhỏ theo phase. Trước deploy, chạy typecheck/focused tests/SQL migration verification trên clone; ghi checksum schema và test logs an toàn. PR mô tả `Relates to #N`, không `Closes #N`; link acceptance criteria liên quan.
2. Deploy F42 schema/code vào staging QC theo build path repo (`npm run db:migrate` chạy `scripts/db-setup.js`, nơi gọi `runPw1MigrationSchema`). Kiểm table/index/constraint/strict requirements; idempotent second run. Bật read API sau khi schema verified; trước đó F40 chỉ hiện unavailable.
3. Seed/import fixture trong môi trường cô lập, query `migration_import_stores.run_id` để lấy child UUID; xác nhận `migration_runs.state` và store state đều `VERIFIED`. Không dùng `STORE_VERIFIED.runId` trong log vì đó là batch ID ở code hiện tại.
4. Operator dùng **source sidecar đã tạo từ CSV gốc trước lọc**, kiểm config/artifact/manifest hashes rồi nạp safe export coverage, gồm Store/record không emit. QC thực thi khi **không có CSV trong môi trường QC**. Sau đó chạy evidence builder cho emitted run; xác nhận generation `complete`, inventory digest, summary disjoint counts và target tenant. Test reset/replay, crash/retry và target-drift path. Nếu sidecar thiếu/đổi hash thì source-wide field coverage BLOCKED; nếu run artifact thiếu/đổi hash thì run evidence `unverified`. Artifact cũ thiếu cả sidecar và CSV chỉ có metadata coverage từ report, không đạt full field parity.
5. Deploy F40 adapter/UI; chạy Super Admin real run E2E, API unauthorized/cross-store/version failures, pagination/filter, demo isolation, stale request switch Store/run. Xác nhận UI không tự suy `match` từ mapping ID.
6. Tắt hoặc sửa đường báo giả của `/api/qa/migration-diff`: canned `scan_batch=2000`, `approve_pass` không persist và fallback catalog phải bị chặn/dán nhãn rõ trong real QC mode. Không dùng những response cũ làm bằng chứng nghiệm thu.
7. QC kiểm bảy ca yêu cầu và các ca `unsupported/unverified`, ký nhận field support matrix, money/stock/status rules, open exceptions. Kết quả fixture synthetic không được nâng thành pass của store thật. Công bố riêng tỷ lệ `match/expected`, `match/eligible`, meaningful match và approved exclusions; không dùng tỷ lệ có mẫu số thay đổi ngầm cho chuẩn ≥99%.
8. Nếu cần claim visual/render toàn diện, chạy Phase 08 và TC-F40-13-07/08; nếu chưa, báo rõ commerce/settings ready nhưng Page/Block live-render `unverified`.
9. Trước mọi tuyên bố **F40 migration test đầy đủ/cutover**, chạy [Phase 10](phase-10-full-f40-qc-traceability.md): TC-MIG.01–10, US-F40-09/10/11/12/13 và các manual sign-off trên cùng staging revision. Đây là gate ngoài phạm vi importer/evidence generation.

## Phân biệt ba gate

| Gate | Tiêu chí | Kết luận hợp lệ |
| --- | --- | --- |
| Importer | Child `migration_runs.run_id` và `migration_import_stores` đều `VERIFIED` | Projection đã emit được importer xác minh với target tại verify time |
| Evidence | Generation `complete`, inventory/registry counts accounted, target read thành công hoặc field có reason `unverified`/`unsupported` | F40 có bằng chứng để hiển thị; **không** mặc nhiên QC Pass |
| QC cutover | Quy tắc QA được duyệt: parity, P0, media, 9 theme, SSO và manual sign-off phù hợp scope | Mới có thể đề nghị cutover; `approve_pass` phải có persistence/authorization/audit và gate thật trước khi dùng |

Plan test hiện ghi parity ≥99%, P0=0, ảnh HTTP 200 đạt100%, 9/9 theme ký xác nhận. Những điều kiện này chưa được chứng minh chỉ bằng field evidence; không tự bật nút QC Pass hoặc DNS cutover trong phase này.

## Stop/rollback rules

- Schema verification, auth isolation, secret redaction hoặc run/store binding fail: dừng read API/rollout; không fallback demo/mock như thật.
- Summary counts không khớp registry/inventory, generation digest đổi khi replay cùng input, hoặc target drift không được phân biệt: giữ generation unavailable/partial, không công bố `complete`.
- Staging fixture reset chạm record ngoài marker: dừng ngay, khôi phục clone/baseline được kiểm soát; không tiếp tục trên shared staging.
- Rollback ứng dụng dùng feature/read gate để quay về `unverified`; **không DROP bảng evidence** và không sửa ledger đã commit. Giữ artifact audit và runbook phục hồi.

## Done khi

- Handoff checklist có owner F42, F40, QC và bản ghi kết quả từng gate; mọi mục chưa chạy ghi NOT_RUN/BLOCKED thay vì PASS.
- Traceability matrix Phase 10 có owner và bằng chứng cho từng TC/AC; một gate còn NOT_RUN/BLOCKED thì không phát hành kết luận F40 migration test đầy đủ.
- F40 trên staging QC xem được đúng child run/generation, summary và field evidence thật; fixture synthetic được gắn nhãn; API bảo mật và reset đã kiểm chứng.
- F40 xem riêng export coverage từ full selected CSV và import fidelity từ emitted child run; Store bị exporter lọc không biến mất khỏi coverage và không bị gán `missing` PW2 giả.
- Open gaps được gán owner và không hiển thị như match. QC/cutover chỉ được tuyên bố sau gate thứ ba; triển khai plan này tự nó không ra lệnh cutover.
