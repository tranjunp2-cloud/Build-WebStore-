# Phase 04 — Hợp đồng exporter và diagnostics có giới hạn RAM

- Status: in_progress; Priority: P1; ngân sách tiếp tục: **2h**.
- Depends on: importer core hiện có; không viết lại phase02 hoặc xóa evidence synthetic.
- Gate đầu ra: G4 — artifact thật được đọc/kiểm chứng và mọi diagnostic được phân loại có bằng chứng; chưa cấp quyền apply.

## Bối cảnh đã xác minh

[Readiness 2026-09-17](reports/260917-exporter-readiness.md) là baseline. Artifact thật `pw1-prod-20260917-followup-001`: master1,061,192,036bytes; reportJSON641,772,688bytes; reportCSV885,735,832bytes. Tổng publication khoảng2.60GB. 2918Store=2799emitted+118blocked+1deferred. Có121859diagnostics:94929blocker,26930warning;63global;32150có reason. Baseline trước implementation trả `EXPORT_MANIFEST_INVALID`; loader v2 hiện parse/prepare đầy đủ publication thành công, nhưng semantic blockers vẫn giữ fail-closed.

Hash mapping mới chính xác: `8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9`.
Hash cũ cần giữ explicit compatibility: `62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26`.
Hai hash cùng exporterVersion1.0.0; không chọn schema chỉ theo version hoặc nhận bất kỳ digest64ký tự.

## Thiết kế cần triển khai

### Hợp đồng có phiên bản

- Registry exact mapping hash → manifest/report/actor/policy schema + classifierVersion. Contract cũ giữ strict shape hiện hành; contract mới nhận đúng `migrationPolicy`, artifact `user-actors.json` và `reason` dạng CODE. Unknown property/hash vẫn bị chặn.
- Tái sử dụng shape đã review ở worktree2; không import cả exporter runtime/generators vào importer. Đối chiếu working tree chưa commit, lưu hashes các file được tham chiếu.
- Giữ sourceInstance/sourceDatabase/sourceInstanceToken/snapshotId/asOf nguyên vẹn. Không chỉnh source namespace để né claim legacy, không sửa manifest/master để làm hết diagnostics.
- Chốt import envelope mới: `version: 2`, `profile: pw1-json-v2`; exact new mapping hash dùng nhánh này. Thêm sourceInstanceToken, `migrationPolicyHash`, `actorArtifactHash`, `creatorBindingsHash` (null khi thực sự không có input tương ứng), `classifierVersion: diagnostic-policy-v1`. Hash policy từ canonical typed value; không bịa hash cho absent input. Actor dependency có mà binding null chỉ cho structural prepare, runtime vẫn BLOCKED. Contract cũ giữ `version:1/profile:pw1-json-v1`, không tự nâng profile/default semantic. Reader mới vẫn nhận artifact cũ, batch đang dở vẫn phải qua writer/schema hash guard. **Không sửa binding của batch cũ để resume bằng writer mới.** Trước business write có thể replan/new batch. Sau partial commit, thay code/contract/schema/binding → lưu evidence, restore disposable clone từ baseline rồi tạo batch mới; không tạo batch mới trên clone đã ghi dở. Resume chỉ khi toàn bộ writer/schema/source/bindings vẫn khớp, không dùng binary cũ sau schema migration.
- Hash toàn publication, gồm actor sidecar, cả reportJSON/CSV/summary/README; hash và parse cùng bytes. Actor/source có PII, toàn bộ input/private spool ngoài Git, dir0700/file0600.

### Diagnostics streaming, không giữ121859records trong RAM

Đổi `artifact.diagnostics/blockers` mảng không giới hạn thành summary/counts + spool evidence. Reader luôn duyệt hết report và kiểm chứng hash/coverage/partition trước trả handle dùng để ghi DB.

- Tổng theo code/severity/reason/classification; per-Store counters + global counters. Giữ mẫu tối đa5records mỗi bucket và giới hạn số bucket cấu hình rõ (unknown bucket overflow fail closed).
- Chi tiết cần audit ghi private NDJSON spool theo luồng; report trả path+hash, không log raw reason/name/email. Reason của exporter là CODE, không free-text decision authority.
- Nếu giữ per-Store state2799entries, đặt cap/đo RAM rõ; không giữ mỗi source row. Actor lookup có budget riêng; master vẫn spool từng Store≤64MiB, file≤8GiB như core hiện hữu.
- Report row dispositions và diagnostic là hai lớp evidence: không cộng generated row blockers vào exporter severity count. Giữ total raw count94929/26930 đúng manifest; readiness counts theo classifier riêng, không sửa lịch sử source.
- Classifier dùng chung cho diagnostic và row-field evidence: không accept diagnostic rồi sinh REPORT_ROW_UNRESOLVED vô điều kiện cho đúng field đã được đóng bằng evidence. Row `partial/unresolved` phải truy được field/disposition/contribution; approved exclusion không xóa dòng khỏi coverage. Không cần full graph trong memory; dùng per-table counters/typed checks và private spool cho unresolved detail.
- Update runner consumer cùng API summary; dùng actual selected Store set khi đánh readiness. Global blocker luôn áp dụng selected scope, không bị loại vì thiếu storeId.

### Classifier có evidence, không blanket-ignore

| Class | Điều kiện chứng minh | Hành vi |
|---|---|---|
| PAGE_OUT_OF_SCOPE | Typed source/contribution xác định Page/component theo scope user đã chốt; không dùng substring hoặc severity | Giữ counts/disposition, không chặn chỉ vì Page |
| APPROVED_POLICY_WARNING | Exact code+reason+field/table phù hợp migrationPolicy/acceptedExclusions đã được duyệt và decisionEvidence tồn tại; rule mapping đã kiểm chứng | Không chặn scope tương ứng, vẫn audit policy hash |
| TARGET_GATE_PENDING | Exact requirement như creator binding, tenant slug/schema | Chặn tới khi phase05 cung cấp verifier evidence; parser không tự đổi thành pass |
| SOURCE_BLOCKER | Product/Blog content fidelity, missingprice, Order status/refund ambiguity, negative totals, address conflict, same-tenant collision | Chặn affected Store/aggregate; không tự drop required record |
| UNKNOWN | Code/reason/policy mới hoặc không đủ provenance | Chặn; xuất masked samples để review |

Các bảng raw dùng chung như model_settings chỉ Page-out-of-scope khi có typed owner/path chứng minh. Product/Blog rich text không phải Page. Trường `decisionEvidence` không tự tạo quyền business: tham chiếu phải được đối chiếu quyết định đã duyệt, không coi chuỗi bất kỳ là approval. Với policy làm bỏ toàn collection/Store, báo rõ accepted deferred/excluded, không gọi source-empty hay full-source verified.

## Checklist triển khai

- [x] Inventory/archive checksum và exact contract; giữ archive SHA256 `71dea1b98fe28298dfe6aa6adb906a23320407514f63bae8a421c922b945dbae`.
- [x] Thêm strict contract registry và regression old/new/unknown profile; không overwrite constant làm hỏng artifact cũ.
- [x] Port typed policy+actor schemas tối thiểu; actor provenance/chain/duplicate checks, không account provisioning.
- [x] Thay full diagnostic arrays bằng bounded summaries/spool; update runner/report/API cùng lúc.
- [x] Build rule table từ121859diagnostics thực, mỗi allow rule ghi căn cứ; mọi chưa hiểu giữ BLOCKED.
- [ ] Giữ exact row/header/record coverage và Store partition tests hiện hữu; thêm actor contributions đúng source row.
- [x] Pure classification chưa chứng minh target gate: creator/schema evidence chỉ được thêm sau phase05.
- [x] Đọc artifact thật read-only, tái lập totals và selected readiness report; không DB connection/write trong structural validation.

## File map lúc triển khai

| Absolute path | Action | Nội dung |
|---|---|---|
| `./src/lib/migration/pw1-json/artifact.ts` | Modify | Registry schemas, streamed diagnostics, actor file hashing |
| `./src/lib/migration/pw1-json/types.ts` | Modify | Versioned manifest, summary/readiness types |
| `./src/lib/migration/pw1-json/diagnostics.ts` | Create | Pure evidence-backed classifier, bounded counters/samples |
| `./src/lib/migration/pw1-json/runner.ts` | Modify | Selected/global readiness; không pass trước target gates |
| `./src/lib/migration/pw1-json/credentials.ts` | Modify | Prepare full publication/version binding, giữ sourceCSV provenance |
| `<worktree-2>/src/lib/migration/pw1-export/{artifact-schemas,source-config,user-actors,master-version}.ts` | Read/port selected schema | Upstream evidence, không chỉnh exporter ở phase này |
| `./src/__tests__/unit/migration/pw1-json-artifact-credentials.test.ts` | Modify sau QA mapping | Contract compatibility, hash/coverage, diagnostic budgets |
| `./docs/qa/F42-pw1-local-json-import.md` | Update traceability | Testcases cần duyệt AUTO trước sinh test mới |

## Kiểm chứng / G4

Chạy lại63tests core; đọc TEST_CONVENTION trước sinh test. Cases mới phải map TC `[x] AUTO` đã được duyệt; còn thiếu là manual evidence/TBD, không tự đặt TC rồi gọi approved. Thử >121859diagnostics với bounded memory, unknown global warning, Page/shared-table ambiguity, forged policy evidence, wrong hash/version/reason. Artifact thật phải parse+hash thành công và vẫn hiển thị blockers còn lại. Không yêu cầu tất cả Store trở thành READY để G4 đạt.

## Rủi ro và điểm dừng

2h là timebox cho integration contract, không bảo đảm mọi policy được giải nghĩa. Nếu thiếu căn cứ cho warning, dừng rule đó; không tăng allowlist tùy tiện. Structural hash pass không bằng mapping complete; `needs_review/importReady=false` của exporter giữ nguyên. Không dùng RAM benchmark3GiB trước đây làm bằng chứng classifier mới đã bounded.

## Cập nhật thực thi 2026-09-17

[Regression cuối](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files, typecheck và synthetic clone 2 Stores/18 entities PASS sau strict evidence/alias fixes (sau đó focused19/19 và typecheck PASS, gồm 1 path-guard case mới; tổng82 distinct tests qua các lượt, không phải full82 rerun). Không thay nghiệm thu nguồn thật. [Real prepare PASS; dry-run205 BLOCKED](reports/260917-v2-real-artifact-preflight.md): 226485 occurrences selected/global, 3 blocker codes, 0 PW1PROD runs. G5 real actor/credentials BLOCKED; G6 actual apply NOT_RUN. Checkbox mở giữ các phần nghiệm thu/fault case chưa chứng minh.
