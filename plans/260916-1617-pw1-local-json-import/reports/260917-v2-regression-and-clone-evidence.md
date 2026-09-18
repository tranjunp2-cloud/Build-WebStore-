# V2 regression và disposable-clone evidence — 2026-09-17

## Phạm vi và kết quả

Tester chỉ thêm `src/__tests__/unit/migration/pw1-json-v2-contract.test.ts`, mở rộng harness `src/__tests__/integration/pw1-json-clone-rehearsal.ts` theo ủy quyền bổ sung, và report này. Không sửa importer implementation; chỉ seed actor synthetic và chạy harness trên clone `pw1_import_1886_v2_20260917` localhost5433 đã được root chuẩn bị. Không provisioning actor nguồn thật, không DB gốc/live/Vercel.

- **PASS:** 81 tests / 8 files: baseline63tests + 18 v2 regressions (49 importer core +14 tenant/category regressions +18 mới). Command: `npm test -- --run src/__tests__/unit/migration/pw1-json-artifact-credentials.test.ts src/__tests__/unit/migration/pw1-json-selectors-runtime.test.ts src/__tests__/unit/migration/pw1-json-projection.test.ts src/__tests__/unit/migration/pw1-json-runner.test.ts src/__tests__/unit/migration/pw1-json-v2-contract.test.ts src/__tests__/unit/payload/category-row-lock.test.ts src/__tests__/security/tenant-product-isolation.test.ts src/__tests__/integration/category-delete-breadcrumbs.test.ts`.
- **PASS cuối:** sau path hardening, focused v2 **19/19 tests** và `npm run typecheck` đều exit0. Full run trước đó81/8, focused19 có1test mới: tổng82distinct tests được kiểm chứng qua hai lượt; không ghi thành full82/8 rerun.
- **PASS synthetic clone:** 18 business entities / 2 Stores, v2 shared creator, controlled SIGINT/resume, new-batch reuse, schema preservation và independent SQL verification.
- Không gọi đây là full real-source migration hoặc 16 fault cases đều PASS.

## V2 unit coverage

Map về TC `[x] AUTO` sẵn có IMP003/004/005/008/011 trong `docs/qa/F42-pw1-local-json-import.md`; không tạo TC mới để tự cấp approval.

1. Exact old hash giữ version1/profilev1; exact new hash tạo version2/profilev2, actor digest và null hashes khi input absent.
2. Unknown hash, forged v2 envelope với publication v1, v1 diagnostic reason mới bị từ chối.
3. Actor snapshot mismatch và actor file sửa sau prepare bị từ chối.
4. 121860 diagnostic records cùng bucket: count/severity/blocking totals đúng, samples tối đa5 và bounded representatives. Case ~1.5s; đây **không phải RSS benchmark** của pipeline artifact thật.
5. Global unknown warning vẫn BLOCKED khi chọn Store khác; Product/shared model_settings không được coi Page-out-of-scope.
6. Creator requirement chưa verifier vẫn nằm pending blocking evidence; reason free-text không hợp lệ.
7. Actor registry chain hợp lệ, cycles/dangling/duplicate/ref-source spoof/provenance drift bị từ chối.
8. Target checksum không phụ thuộc lastLogin/roles; khác target ID tạo checksum khác.
9. Private binding/evidence exact-byte hashes, duplicate source binding và evidence drift bị từ chối. Strict identity decision JSON phải match source/target/hash metadata; opaque evidence hoặc valid-hash decision sai target bị từ chối. Supplied empty binding vẫn hash-bound và sai source metadata bị từ chối.

10. Path guard cuối: binding hoặc evidence dưới own disposable repository child `..private-v2-test-*` bị từ chối `CREATOR_BINDINGS_OUTSIDE_REPOSITORY_REQUIRED`; cleanup xóa đúng thư mục test. Valid private outside-Git fixture vẫn PASS.

Lần chạy đầu phát hiện TARGET_CHECK_REQUIRED không tính trong structural blockingCount; root đã sửa collector giữ pending blockers và thêm runner discharge verification. Sau đó18/18tests PASS, gồm bổ sung binding hash/unused source metadata. Typecheck trung gian phát hiện union sourceId trong diagnostics; root đã sửa; lần cuối PASS.

## Clone rehearsal

Invocation:

```bash
PW1_TEST_DATABASE=pw1_import_1886_v2_20260917 PW1_TEST_FULL=1 PW1_TEST_TWO=1 PW1_TEST_V2=1 PW1_TEST_INTERRUPT=1 npm run migrate:pw1:test:local
```

Harness giờ throw nếu dryrun/apply/resume/replay thất bại hoặc batch ID thiếu, thay cho early return khiến shell exit0 giả. Synthetic secrets chỉ env/private files, không in secret. Final run dùng reviewed strict decision evidence `approve-existing-creator-binding` với exact source/target fingerprints, approvedBy/approvedAt và reverse claim guard. Actor identity mapping fixture là synthetic test evidence, không quyết định identity mapping nguồn thật.

### Run cuối có schema preservation, strict decision evidence và alias guard

Clone run này trước thay đổi path guard cuối; path-only hardening được kiểm chứng bằng focused19tests/typecheck, không rerun DB theo chỉ đạo root.

- Private evidence: `/tmp/pw1-cli-rehearsal-1789633701412`.
- Main batch: `json:f8c5a37f-b437-4bff-9213-53f34a58c985`.
- Cross-run batch: `json:4e9df4f6-df2d-41d7-87cb-189f6b5ae06b`.
- Dryrun exit0: Store91886001 CREATE15; Store91886002 CREATE3; tenant/site/page/run counts trước/sau dryrun không đổi.
- Apply exit4 sau Store đầu VERIFIED; SIGINT controlled.
- Resume cùng batch exit0: firstStore REUSE15, secondStore CREATE3, cả hai VERIFIED.
- Cross-run exit0: REUSE18, CREATE0; không đổi password existing Users.
- Independent SQL: PBKDF password và SSO roundtrip true; subtotal10/total9/discount100minor đúng; completed+unpaid historical status; zero inventory; customer snapshot và external media preserved.
- V2 schema: six Product images persisted, shortDescription350chars nguyên vẹn, historical order item product_id=NULL và productName/quantity/unitPrice giữ nguyên.
- Actor: cả2 User.createdBy trỏ existing synthetic actor; full actor row JSON trước/sau bằng nhau; đúng1 active owner SKIP; mọi actor mapping actionSKIP/stateSKIPPED/ownsBusinessRow=false; inactive consumers có dependency owner.
- Read-only actual ledger check: source actor khác cố alias cùng target existing đã claim trong cùng source namespace bị `CREATOR_TARGET_IDENTITY_ALIAS`; không ghi thêm claim/row.
- Pages count436 trước/sau; tenant1216→1218, site1207→1209, run1200→1204 (2batch×2child). Đây là count evidence, không full checksum mọi outside-scope row.
- Sau verification, harness cố ý đổi tenant name của fixture: dryrun exit3 `TARGET_PROJECTION_CONFLICT`. Clone giữ controlled drift này; không dùng clone đó làm baseline real-source.

Runs trước `/tmp/pw1-cli-rehearsal-1789633261786` và `/tmp/pw1-cli-rehearsal-1789633348209` PASS các revision trước. Report ưu tiên run cuối sau strict evidence/reverse-claim review fixes.

## Chưa được chứng minh bởi test run này

- Real artifact apply / real creator identity authority / actual credential keys: **NOT_RUN bởi tester này**; root ghi evidence riêng.
- Hard kill giữa entity, lost COMMIT ACK, concurrent writers/lease expiry, active claim race, actor deletion/reassignment sau dryrun: **NOT_RUN real DB**.
- Real richer Store readiness và throughput2918Stores: **NOT_RUN**.
- Broad job/provider effects, full outside-scope projection snapshots: không được suy từ synthetic counts.
- Null/duplicate tenant-slug migration fault và DDL partial failure: schema helper root đã chạy; không phải test run của file này.

Không mark các gate trên PASS chỉ từ81tests hoặc2Store synthetic. Private evidence chứa synthetic credential sidecars và phải giữ ngoài Git.
