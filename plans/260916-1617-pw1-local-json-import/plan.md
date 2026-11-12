---
title: "PW1 JSON importer — đồng bộ exporter và nghiệm thu dữ liệu thật"
description: "Core local và exporter1.2/profilev3 đã kiểm thử synthetic; real-source validation và authoritative creator/global decisions còn mở."
status: in_progress
priority: P1
issue: 1886
effort: "Continuation: timebox tối đa 8h có điều kiện; không gồm công đã thực hiện"
branch: feat/F42-07-pw1-local-json-import
tags: [backend, database, auth]
blockedBy: []
blocks: []
created: 2026-09-16
updated: 2026-09-18
---

# PW1 local JSON import — kế hoạch tiếp nối

## Kết quả mới nhất — 2026-09-18

Store636 đã import trực tiếp vào DB local hiện hữu `primeweb` theo yêu cầu operator: **exit0 VERIFIED, 985entities**, batch `json:c7ffe7ec-b06f-411f-8e30-4887d2b6fecb`. SQL đối soát số lượng thực tế PASS; system User7 và roles/membership/permissions không đổi. Store205 trên clone cũng đã VERIFIED trước đó. Xem [runbook](../../docs/migration/pw1-local-json-import.md) cho lệnh, artifact, backup và kết quả chi tiết. Các trạng thái blocked/not-run bên dưới là lịch sử; full-inventory và real-batch resume/replay vẫn chưa nghiệm thu.

149tests liên quan/7files (chạy theo nhóm) và typecheck PASS. Bổ sung exact-name local DB opt-in, source archive scope có bằng chứng, unknown order payment method null và kiểm tra link rich text. Không triển khai Vercel.

## Mục tiêu và điểm xuất phát

Giữ core CREATE/verified REUSE/CONFLICT, transaction/ledger/resume đã có; bổ sung tương thích artifact followup-001 và exporter1.2 `pw1-prod-20260917-classification-001` rồi nghiệm thu nguồn thật trên clone mới của DB hiện hữu. Code tiếp nối đã triển khai; nghiệm thu nguồn thật còn bị chặn và chưa apply.

Baseline ngày16/09: 63 tests/7files và typecheck pass; fixture 2Store/17entity/15collection đã qua pass2, SIGINT boundary/resume/replay; có bằng chứng fencing/atomic rollback và mô phỏng lost ACK. Parser đã thử3GiB. Những kết quả này không chứng minh master thật đã migrate.

[Readiness ban đầu](reports/260917-exporter-readiness.md) đã được tiếp nối bằng [prepare/dry-run artifact thật](reports/260917-v2-real-artifact-preflight.md): prepare toàn publication PASS; Store205 dry-run exit3 với 226485 occurrences selected/global thuộc 3 blocker codes. Không có PW1PROD run trên clone. Creator binding và credentials thật chưa đủ; không có actual-source apply.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 01 | [Contract/môi trường ban đầu](phase-01-contract-and-preflight.md) | in_progress — giữ gate nguồn thật |
| 02 | [Core CLI/writer đã triển khai](phase-02-cli-and-writers.md) | in_progress — giữ giới hạn nghiệm thu |
| 03 | [Rehearsal baseline](phase-03-rehearsal-and-handoff.md) | in_progress — synthetic đã có, nguồn thật còn mở |
| 04 | [Contract mới và diagnostics](phase-04-export-contract-and-diagnostics.md) | in_progress — loader/prepare PASS; semantic blockers còn mở |
| 05 | [Schema đích và creator binding](phase-05-target-schema-and-creator-bindings.md) | in_progress — code/schema synthetic PASS; real gate chưa đạt |
| 06 | [Nghiệm thu artifact thật](phase-06-real-artifact-rehearsal.md) | in_progress — real dry-run BLOCKED; actual apply NOT_RUN |
| 07 | [Exporter1.2/profilev3 compatibility](phase-07-exporter-12-compatibility.md) | in_progress — code/synthetic PASS; real structural validation PASS; semantic dry-run BLOCKED |

04–06 là delta tiếp nối, không làm lại01–03. Mốc2+3+3h là phân bổ tối đa nếu còn đủ quỹ một ngày; không cộng thành cam kết hoàn thành toàn nguồn. Không lấy giờ test để mở rộng tính năng. Hết timebox báo đúng gate còn chặn.

## Phạm vi và quyết định

- Local-only; giữ CLI selectors/dry-run/resume, không UPDATE tổng quát hoặc rollback business tự động.
- Port chọn lọc backend collection/SQL từ worktree-2; giữ req transaction fixes và các thay đổi người dùng. Không merge cả worktree.
- Không Page/component/UI, không API/Vercel/production, không activate/publish/provider calls.
- Không sửa bytes/hash artifact để chạy được; policy/blocker chỉ được resolve bằng bằng chứng source/target theo từng rule.
- Creator chỉ binding tài khoản đích hiện hữu đã chứng minh identity; không tạo admin, đặt password hay giả membership. Thiếu actor đích là gate thật.
- Master/credential/binding/evidence private ngoài Git; secret không gửi qua chat, issue hoặc arguments.
- Không dùng danh tính Store205/285 của snapshot cũ: followup mới mỗi Store chỉ có4entity foundation, không có catalog/commerce.

## Dependencies và gate

Không tạo plan mới hay dependency vòng với plan này. Worktree-2 đã có artifact publish; dùng handoff đã pin, không chờ toàn bộ exporter đạt complete. #1885 và #1886 vẫn tách scope.

F40 reconciliation/renderer là consumer evidence tương lai, không là điều kiện để CLI chạy. Discount/Category plans có overlap schema nhưng không yêu cầu chờ toàn bộ kế hoạch; xem [quyết định tiếp nối](continuation-decisions.md).

Implementation04–05 đã có; schema helper chạy hai lần trên clone, actor fixture synthetic đã kiểm chứng; xem [regression report](reports/260917-v2-regression-and-clone-evidence.md). Apply06 cần: contract/diagnostics/schema tests đạt; clone mới; đầy đủ khóa; creator binding được xác minh; selected Store không còn required/global unresolved blocker và baseline conflict. Các prerequisite bên ngoài không được giả thành PASS.

## Kết quả bàn giao bắt buộc

- Loader nhận đúng artifact mới và phân loại đầy đủ nguồn/emitted/blocked/deferred/selected, không giữ toàn bộ report trong RAM.
- Target schema đã chạy hai lần/verify; creator refs có shared-ledger evidence, zero sửa credentials/roles/memberships.
- Prepare→dry-run→apply→verify→resume/replay đạt trên ít nhất một Store thật; một Store có nghiệp vụ chỉ được chứng nhận khi gate của chính Store đó đã đóng.
- Schema/code/input/binding drift bị chặn; fault evidence giữ loại synthetic/simulated/real rõ ràng. Master bị block vẫn giữ issue mở; không gọi full-source/live-ready.
- Bàn giao manifest/hash/selected counts, blocked codes/next actions và report riêng ngoài Git. Giữ63regressions + mở rộng theo QA convention; không tự tick16manualcases.

## Tài liệu thực thi

[Quyết định và stop rules](continuation-decisions.md) · [Contract baseline](technical-contract.md) · [Runbook baseline](acceptance-runbook.md) · [Guide CLI hiện tại](../../docs/migration/pw1-local-json-import.md) · [Review tiếp nối](reports/260917-continuation-review.md).

Plan files/checklists là trạng thái bền vững; session không có TaskCreate/TaskUpdate. Không commit/push; implementation/schema/synthetic writes chỉ trên disposable clone. DB gốc không bị ghi.

## Gate hiện tại

[Final regression evidence](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files và typecheck PASS; synthetic clone 2 Stores/18 entities PASS sau strict approval/alias fixes. Sau đó focused19/19 và typecheck PASS, gồm1 path-guard case mới: tổng82 distinct tests được kiểm chứng qua các lượt, không phải full82/8 rerun. Clone PASS trước thay đổi chỉ về path guard; không rerun DB cho thay đổi này. Số63 ở trên chỉ là baseline lịch sử.

G4 structural contract/streaming/prepare đạt; diagnostic semantic blockers vẫn được giữ. G5 schema và actor synthetic có evidence, real actor/credential readiness **BLOCKED**. G6 actual-source apply/verify/replay/resume **NOT_RUN**. Timebox 8h có điều kiện không là cam kết hoàn tất 2799 Stores; không đánh dấu toàn bộ 16 manual cases PASS.


## Continuation exporter1.2 / profilev3

Phase07 implements exact contract27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567, streaming receipt semantics and hash-bound manifest/AAD/batch metadata. Metadata ownership, Page-only scope and subscription cancellation-warning gates remain fail-closed. Selector scope is determined before spool retention. Report diagnostics/rows use two hash-verified passes to avoid JSON property-order dependency; compact leaf identity checks retain duplicate rejection.

Final measured regressions: **128tests/9files PASS, typecheck PASS**, including46v3 cases. Synthetic clone `pw1_import_1886_v3_20260917` / `/tmp/pw1-cli-rehearsal-1789638687596` verified18business entities/2Stores, profile3 receipts, SIGINT/resume/REUSE, actor/credential/schema preservation and drift rejection. DB run preceded final reader/index hardening; final tests passed afterward, without DB rerun for those reader-only changes.

Current classification-001 whole-master coverage/hash/classification/receipt validation completes after historical memory failures; original prepare exit2 remains historical. **Final Store205 dry-run exit3 ARTIFACT_BLOCKED, blockerCount3**, all for orphan model_has_roles source row`record:5753`→missing users5753: SOURCE_OWNERSHIP_UNRESOLVED, SOURCE_FIELDS_UNRESOLVED, REPORT_ROW_UNRESOLVED. No Page/structural-classification/memory blocker remains.5753 is an ID, not a count.

Two target checks remain pending (subscription no-cancellation warning, creator binding); source gating stops before they run. Fresh real clone has0migration_import_batches, no actual-source apply. Two data decisions still required: authoritative creator51 mapping and orphan-role disposition. V3 schema helpers ran twice on fresh clones. See [phase07](phase-07-exporter-12-compatibility.md) and [v3 review](reports/260917-v3-classification-review.md).


Latest resource evidence: standalone classifier922580rows = estimated245398940B (~234MiB), measured peakRSS526864KiB (~515MiB). Bounded256MiB metadata cap approved;1Mrow cap unchanged, diagnostics accounting reviewed; actual structural revalidation completed; final semantic preflight BLOCKED on3orphan-role diagnostics. Five artificial global-invalid tables resolved through narrow exporter conventions. Fresh real-source clone `pw1_import_1886_real_20260917` has baseline restore and3schemahelpers twice PASS; this is infrastructure readiness, not actual-source readiness.


Store205 credential check: STORE205_CREDENTIAL_CRYPTO_VERIFIED exit0; v3sidecarAEAD, fullmasterhash streaming, LaravelMAC/decrypt, bcryptmatch và SSOkeyshape PASS, không DB writes. Đây là kiểm chứng crypto cho Store205, không chỉ presence env và không chứng nhận mọi User/Store hoặc DB-import roundtrip.


## Latest correction — selected master dependencies, 2026-09-17

Supersedes source-blocker status above: selected-scope proof now classifies unrelated source orphans as OUT_OF_SCOPE while preserving diagnostics and dependency/target validation. Real Store205 apply clears source gates and stops at CREATOR_BINDINGS_REQUIRED, not ARTIFACT_BLOCKED. Only creator identity binding remains the next prerequisite; subscription validation and later preflight have not yet run. No extra orphan5753 approval required for Store205.132tests/7files + typecheck PASS; clone counts unchanged and0import batches. See runbook's latest status and phase07 amendment.


## Latest actual-source result — Store205 VERIFIED

2026-09-17: operator identified sso-service@primeweb.app as PW2 system user; clone exactlookup7 enabled creator51 binding. New prepared-v3-system artifact PREPARED exit0; actual Store205 apply VERIFIED exit0,4creates, batch json:2d61fef5-3689-4d03-80da-265823fd1540. Independent SQL confirms User432→1354 with created_by_id7 and unchanged system User/role/membership/permission fingerprints. Counts increased by one each for Tenant/User/Site/Subscription. All earlier source/creator blockers are resolved for Store205. No source DB changes, no live claim; real commerce and other Stores remain unverified.

## Tiếp nối: nhóm100store

[Phase08 — preflight/apply theo nhóm, bounded memory và resume](phase-08-bounded-store-groups.md) — implemented; xem [nghiệm thu](reports/260918-grouped-import-implementation.md). Full dry-run2799stores đã vượt giới hạn diagnostic/source scope; còn98675occurrences source diagnostic, không đồng nghĩa full-ready.

[Phase09 — durable migration logs](phase-09-migration-run-logs.md) — implemented và verified trên clone cùng nhóm100store; events/errors/summary theo invocation, ledger vẫn là nguồn xác nhận commit.
