# Phase 05 — Schema đích và creator bindings có provenance

- Status: in_progress; Priority: P1; ngân sách tiếp tục: **3h**.
- Depends on: G4 contract/typed diagnostics; schema reconnaissance và actor target lookup read-only có thể làm song song với phase04.
- Gate đầu ra: G5 — fresh clone schema verified; actor identities đã bind hợp lệ cho selected Store; target gates cụ thể được giải quyết.

## Phạm vi

Port backend tối thiểu từ worktree2: Products/Blogs/BlogCategories/Orders và SQL tương ứng. Không Page/UI/API routes mới, không đổi role/membership/credential existing User, không provisioning actor ngầm. Snapshot thật205/285 chỉ Tenant1/User1/Site1/PlanSubscription1 mỗi Store, không dùng count fixture cũ để suy coverage.

## A. Freeze và schema migration trên clone mới

- [ ] Inventory worktree2 tracked/untracked và current dirty hunks; lưu hashes backend modules. Không cherry-pick HEAD rồi cho rằng đã đủ.
- [ ] Tạo fresh disposable clone từ DB hiện hữu được phép khảo sát, tên theo guard `pw1_import_1886_*`. Clone cũ `pw1_import_1886_20260916095934` có synthetic experiments, không dùng làm acceptance baseline thật.
- [ ] Capture schema/index/constraints và baseline business counts/projections; disconnect app/cron/webhook/outbound. Xác minh DB identity thực, không log URI.
- [x] Reconcile tenant/slug null hoặc duplicate **trước** index swap; report conflict, không suffix/dedupe/delete tự động.
- [x] Port collection/index contract: Products/Blogs/BlogCategories unique `(tenant,slug)`; Product shortDescription không giới hạn300 và images không giới hạn5 theo mapping; Order.items.product optional cho historical snapshot.
- [x] Giữ product hook migration guard không auto-suffix; normal app hook query tenant-scope phải truyền `req` khi đọc. Preserve req propagation đã thêm trong Blogs/Categories; không overwrite bằng file worktree2 cũ.
- [x] SQL additive/idempotent: short_description giữ toàn text, orders_items.product_id nullable; tạo+verify đúng composite unique indexes trước bỏ legacy global slug indexes/constraints. Không DROP TABLE, không xóa/truncate row.
- [x] Slug swap ba bảng trong transaction với preflight/locks và bounded lock_timeout; phải assert `indisvalid/indisready`, key order, uniqueness và không còn legacy global uniqueness gây collision. Unknown expression/partial/custom index hoặc dependent FK phải review, không DROP mù.
- [x] Schema helper lỗi phải propagate. `db-setup` migration loop có thể catch individual error: importer phải có independent assertions cho mọi required field/index, không tin exit0 của wrapper đơn thuần.
- [x] Mở schema profile check có kiểm soát cho `pw1-json-v2`, giữ v1/legacy history và nullable fingerprint semantics; `getBatch/assertWritableProfile` đọc đúng profiles. Không rewrite run cũ hoặc dùng dummy hashes. Active SKIP claim đã hợp lệ trong schema hiện tại; chỉ thêm DDL nếu kiểm chứng thực sự cần.
- [x] Chạy migration lần2 kiểm chứng idempotence. Nếu một DDL ngoài transaction đã apply rồi bước sau lỗi, **freeze apply**, đối chiếu schema; phục hồi/recreate đúng disposable clone từ baseline khi cần. Không restore DB gốc hoặc rollback global indexes trên dữ liệu đang dùng.
- [x] Không deploy schema này trong continuation local. Script nằm đường deploy không đồng nghĩa được phép chạy production.

## B. Binding global creator tới User đã tồn tại

`user-actors.json` chỉ là source identity registry: có name/email/role provenance nhưng không phải danh sách tài khoản được phép tạo. `creator-binding-plan` exporter là pure preflight, không target provisioning.

Proposed command extension, **chưa được triển khai**:

```bash
npm run migrate:pw1:prepare -- --export-artifact /private/export --credentials /private/users.csv --creator-bindings /private/creator-bindings.json --output /private/prepared-new
```

Binding file versioned, strict, chỉ source identity/target IDs/provenance references/checksums; không password, email, role grants hoặc raw name. Dir0700/file0600, ngoài Git. Không bắt buộc mã hóa file này nếu thực sự chỉ IDs+provenance opaque; credential sidecar vẫn AEAD riêng. Nếu evidence cần PII, lưu trong private evidence riêng có bảo vệ, chỉ tham chiếu hash/reference trong binding.

Required binding fields: version, sourceInstance/sourceDatabase/sourceInstanceToken/snapshotId, actorArtifactHash, targetIdentityHash, binding entries `{sourceRef, targetUserId, provenanceKind, evidenceRef, evidenceHash}`. Target expected identity checksum/claim ID được verifier ghi sau read-only lookup; hash prepare input trong import manifest và batch binding. Không cho field `approved:true` tùy ý thay việc kiểm chứng provenance.

### Quy tắc resolver

1. Actor schema/provenance/chain phải pass; source.global actor có storeId=null, không biến thành Store giả hoặc main tenant member.
2. Lookup target bằng explicit ID và authoritative source claim/xref nếu có. Email/name chỉ hỗ trợ review, không đủ để chấp nhận identity. SourceID không phải targetID.
3. Binding không có claim cũ cần quyết định identity mapping có evidence được người có thẩm quyền cung cấp; verify exact source+target và hash evidence. Không coi arbitrary evidenceRef/file tự tạo là chứng minh mapping.
4. Missing/deleted target, duplicate/conflicting actor binding hoặc source target namespace khác → BLOCKED. Cần tạo target mới là công việc provisioning riêng phải được duyệt; không importer fallback create actor.
5. Cross-Store exemption **chỉ** `users.createdBy` trỏ actor được registry+binding xác minh. Mọi relationship khác vẫn tenant-scoped; không mở generic cross-tenant references hoặc cho `updatedBy` theo suy đoán.
6. Validate toàn bộ source registry/creator chain để bảo đảm integrity. Target-binding closure chỉ gồm actor trực tiếp được `users.createdBy` của business User thuộc selected scope tham chiếu và sẽ persist. Ancestor chỉ nằm trong provenance chain không cần target binding/provisioning, trừ khi chính nó cũng là creator trực tiếp của một selected business User. Không sửa createdBy/roles/tenant memberships/credential của target actor và không tự tạo toàn chain.
7. Build resolved external xref read-only trước User create; target recheck trong transaction (identity/claim/version, lock thích hợp) để chặn delete/reassign/drift sau dry-run.
8. Dùng shared claim namespace `(pw1, sourceInstance, users, sourceId)`, không bảng/namespace claim riêng. Source ref xuất hiện đồng thời business User và external actor là conflict; không nhập hai identity.
9. Thêm `bindExternalActor(db, lease, actualConsumerStore, sourceRef, targetID, evidence)`. Nếu đã có active claim: verify đúng target/provenance rồi tạo inactive SKIP consumer với `depends_on_entity_map_id` trỏ owner. Preserve owner, không reassignment.
10. Nếu chưa có active claim: sau verify target User đã tồn tại, tạo owner claim **action=SKIP, state=SKIPPED, claim_active=true**, `detail.scope=external_reference`, `ownsBusinessRow=false`; attach vào child run của **Store thật đầu tiên đang tiêu thụ actor**. Đây là chủ sở hữu source→target mapping, không sở hữu business User. Không tạo Store giả/membership hoặc đổi target account. Consumer sau dùng inactive SKIP dependency; cùng child/source key dedupe thay vì insert operation thứ hai.
11. Arbitration: global actor advisory lock theo source key rồi claim+target User row locks với thứ tự ổn định; shared unique active-source index là final arbiter khi race. Actor identity/existence/provenance projection tối thiểu, không checksum lastLogin/volatile fields. Mọi claim/consumer/evidence cùng transaction/fence; mất ACK reconcile operation+owner mapping trước retry, không cấp target mới.
12. Chỉ external-createdBy resolver được phép reuse owner mapping thuộc consumer Store khác. Business User writer vẫn enforce claim Store ownership; không nới toàn bộ `findClaim` hoặc disable cross-tenant check.
13. Verifier/counts phân biệt external reference operations với business creates; active SKIP không được tính như account CREATE. Rollback/cleanup không được xóa User có `ownsBusinessRow=false`. Giữ conservative legacy rollback guard và consumer dependency protection; không mở rollback engine.
14. Actor lookup chỉ scoped exceptional identity, không copy role từ source. Binding key/hash drift khi resume phải dừng. Trước business write có thể replan; sau partial commit phải lưu evidence, restore disposable clone từ baseline rồi tạo batch mới. Không thay file trong run đang dở hoặc tạo batch mới trên clone đã ghi dở.

### Giữ Users.createdBy qua cả create/pass2

Không giải quyết blocker bằng bỏ field, null hóa hoặc lấy operator đang chạy CLI làm creator. Phải có source actor target trước create; User audit hook không overwrite supplied source creator dưới private migration capability. Test read-before-write vẫn giữ Symbol brand qua Payload createLocalReq. Không bypass toàn bộ User validation/access guard bằng boolean công khai.

Forward-reference updates chỉ hoàn thiện relation thuộc CREATE của đúng batch, khóa/check expected postimage; không merge toàn User đã tồn tại hoặc thay membership/array ID. Nếu cần update actor hoặc existing User, đó là conflict ngoài scope default CREATE/REUSE.

## File map lúc triển khai

| Absolute path | Action | Nội dung |
|---|---|---|
| `./src/collections/Products.ts` | Modify selected hunks | Tenant slug, preservation limits, req-safe normal hook |
| `./src/collections/Blogs.ts` | Modify selected hunks | Tenant slug; giữ req fixes |
| `./src/collections/BlogCategories.ts` | Modify | Tenant slug contract |
| `./src/collections/Orders.ts` | Modify selected field | Optional historical catalog link; name/qty/price vẫn required |
| `./scripts/db-setup.js` | Modify selected SQL | Constraints/field DDL đúng collection changes; preserve unrelated dirty hunks |
| `./src/lib/migration/pw1-json/creator-bindings.ts` | Create | Strict binding parser, target provenance verifier, external xref |
| `./src/lib/migration/pw1-json/{artifact,types,credentials}.ts` | Modify | Binding/actor checksum vào manifest; private prepare |
| `./scripts/prepare-pw1-import.ts` | Modify | `--creator-bindings` explicit argument |
| `./src/lib/migration/pw1-json/{projection,writer,runner,ledger,runtime}.ts` | Modify targeted | Actor createdBy exception, schema gate, tx recheck, ownership evidence |
| `./scripts/pw1-json-migration-schema.js` | Modify | Profilev2 metadata check tương thíchv1/legacy; activeSKIP semantics giữ shared ledger |
| `<worktree-2>/src/lib/migration/pw1-export/user-actors.ts` | Read/selected schema reuse | Actor contract only, no whole exporter dependency |

## Kiểm chứng / G5

Run existing63tests rồi focused regression đúng QA `[x] AUTO`; chưa có TC thì manual hoặc xin duyệt testcase, không tự đánh pass. DB clone kiểm chứng cross-tenant same slug allowed, same-tenant slug conflict; null tenant/slugs block index migration; DDL failure không tạo readiness giả; historical item catalog-null giữ snapshot; >5images/>300description round-trip đầy đủ.

Actor tests: correct existing binding, wrong namespace/snapshot/hash, missing/deleted target, duplicate/cross-source ID, email-only rejected, unreferenced ancestor không chặn target readiness, target drift, forbidden field path, role/membership/secret unchanged, before-read capability retained, CREATE/pass2 createdBy correct, resume binding drift rejected; hai Store cùng actor chỉ một active ownerSKIP+consumer dependencies; race/ACK-loss không duplicate claim; rollback không xóa reused actor; business User cross-Store vẫn blocked. Chưa đủ evidence nào giữ NOT_RUN/BLOCKED.

## Rủi ro / điểm dừng

3h bao gồm port+binding+schema checks, không bao gồm provisioning global account hoặc sửa nguồn hàng nghìn Store. Nếu target actor không tồn tại hoặc identity chưa có chứng cứ, G5 không đạt cho selected Store; có thể hoàn thành code nhưng real apply vẫn BLOCKED. Không đổi source namespace hoặc nhập actor vào Store205 để vượt gate. Global rollback guard hiện hữu là deliberate conservative local limitation; đừng mở rộng rollback trong phase này.

## Cập nhật thực thi 2026-09-17

[Regression cuối](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files, typecheck và synthetic clone 2 Stores/18 entities PASS sau strict evidence/alias fixes (sau đó focused19/19 và typecheck PASS, gồm 1 path-guard case mới; tổng82 distinct tests qua các lượt, không phải full82 rerun). Không thay nghiệm thu nguồn thật. [Real prepare PASS; dry-run205 BLOCKED](reports/260917-v2-real-artifact-preflight.md): 226485 occurrences selected/global, 3 blocker codes, 0 PW1PROD runs. G5 real actor/credentials BLOCKED; G6 actual apply NOT_RUN. Checkbox mở giữ các phần nghiệm thu/fault case chưa chứng minh.
