# Phase 07 — Fixture, tests, staging execution

**Owner:** F42 + QC + DevOps/F40. **Effort:** 4–7 dev-days cộng thời gian deploy/review. **Dependency:** 02–06 cho gate cuối; chuẩn bị môi trường/seed có thể bắt đầu sau 01. **Deliverable:** hai bộ proof tách biệt, resettable, staging revision và actual test results.

## Hai loại fixture bắt buộc

| Loại | Mục đích | Điều không được claim |
| --- | --- | --- |
| **Importer real** | Bound artifact → importer `verifyStore()` → child `VERIFIED` → evidence builder → DB/API/F40; Product match và coverage thật | Không chứng minh mọi status xấu trong cùng VERIFIED run nếu importer sẽ chặn trước verify |
| **Comparator synthetic** | Controlled source/target snapshots/provenance để test sáu status, UI/read contract và seven QC cases | Không gọi synthetic run là migration production VERIFIED hoặc dùng làm parity/cutover proof |

Fixture cases: Product all-match; Product price mismatch; SKU stock mismatch; Product missing; duplicate mapping với hai target có cùng source provenance; Order total/status mismatch; exception OPEN; thêm unsupported, unverified, legitimate null, target drift, target read failure, run/store mismatch và security leak negative. Pin manifest version/hash, expected evidence rows, expected record/field counts, reason codes, source/target snapshot times và owner. Nếu QC bắt buộc mọi case trên một importer child `VERIFIED`, cần execution path staging-safe được phê duyệt riêng; không nới `verifyStore()`.

Fixture nguồn phải bắt đầu từ **selected CSV snapshot khi exporter chạy**, không chỉ master. Exporter tạo sidecar nguồn an toàn trước lọc; QC staging chỉ nhận sidecar đã kiểm hash/DB evidence, **không cần CSV**. Thêm một Product/Order/SKU bị policy lọc, một field retained-source và một Store blocked/deferred; kiểm chúng xuất hiện trong export coverage với reason nhưng không bị gắn `missing` PW2 hay child UUID giả. Test thiếu/đổi sidecar hoặc manifest hash: F40 báo source-wide field coverage BLOCKED ngay cả khi run emitted đã VERIFIED.

Thêm fixture regression F40-11: Product nhiều SKU/size/color, một record rollup match nhưng field mismatch, hai giá trị rỗng, một PW2 orphan có provenance, một entity thuộc hai storefront page, và demo `SITE-0001` tách hoàn toàn khỏi Source Store ID số. Bảy ca QC là comparator test; những ca không thể tồn tại trong importer VERIFIED phải mang nhãn synthetic trong mọi response/screenshot.

## Execution path

1. Dùng DB staging QC cô lập hoặc disposable clone. Seed/reset chỉ theo fixture marker/owner, xác nhận trước/sau mọi dữ liệu ngoài marker bất biến; không xóa global ledger/shared business data. Ghi command, owner, TTL và cách cleanup.
2. Deploy F42 revision + schema qua `scripts/db-setup.js --migrate-only`/build path của repo; verify table/column/index/constraint thực tế, source/target binding và contract versions. Operator giữ CSV snapshot/config/artifact cùng hashes ở private storage, tạo sidecar lúc export và nạp safe export coverage trước import; không đưa CSV, raw values hoặc secret vào Git/Vercel/QC browser.
3. Hỗ trợ cả **direct importer CLI** (`scripts/import-pw1-json.ts`/`runImport`) và **config workflow** (`src/lib/migration/pw1-json/workflow.ts`): evidence builder là reusable service; cung cấp CLI riêng `migrate:pw1:evidence --source-store-id --child-run-id --bound-artifact ...` (tên flag cuối chốt ở Phase 01). Trong workflow, gọi builder **sau import và trước `finalizePreparedDestination()` ghi destination vào prepared master**, hoặc đọc bản exporter gốc đã bind mà không bị mutation; kiểm manifest hash tại thời điểm build. Direct CLI gọi cùng service khi prepared artifact còn hiện diện. Cả hai path phải có cùng digest. Artifact thiếu/tampered → generation `UNAVAILABLE/PARTIAL` hoặc lỗi typed, importer child vẫn VERIFIED, builder resumable per Store. Không chỉ gắn hook vào workflow.
4. Chạy seed→import→verify→builder→API/F40 read→reset→seed lại. Lấy child UUID bằng join `migration_import_stores.run_id` → `migration_runs`, kiểm cả hai state VERIFIED; log `STORE_VERIFIED.runId` và Batch ID không dùng làm child UUID.
5. Chạy comparator fixture synthetic và đối chiếu expected rows/counts; chạy privacy scan response/DB/log; chạy typecheck, focused unit/integration và Playwright real browser. Ghi exact command, exit, artifact/revision/schema/registry hash, expected/actual, PASS/FAIL/NOT_RUN/BLOCKED. Một TC `[x] AUTO` trên giấy không là PASS.
6. Test fault/resume: kill giữa build, concurrent builders, artifact unavailable, target drift, schema mismatch, cursor pagination giữa generation switch, DB target read timeout. DB `COMPLETE` không được hiện nếu count/digest lỗi; F40 fail closed.

## Staging gate

- `sourceStoreId` numeric + `childRunId` UUID thuộc đúng Store và cả run/store VERIFIED; batch ID báo riêng.
- Importer fixture generation complete, provenance/hash đúng; comparator synthetic cho đủ sáu status và seven QC cases; summary sum invariants, replay deterministic; ngoài marker không đổi sau reset.
- Export coverage baseline từ sidecar chụp CSV đúng snapshot kiểm đủ emitted + excluded/retained/unresolved + blocked/deferred; Store không emit xem được reason nhưng không có child. Thử nghiệm staging QC chạy **sau khi bỏ CSV khỏi môi trường QC**; chỉ có master/ledger/report cũ thì gate full-source field parity không pass.
- F40 đọc evidence từ DB staging, không từ private local files/demo; no raw PII/secret; QA xác nhận nhãn real/synthetic. Nếu một field unsupported/unverified, báo count/gap/owner, không ép pass.
- Ghi TC-F40-11/13/14 và TC-MIG.01–10 vào execution matrix: kết quả PASS chỉ khi có command/log/screenshot hoặc manual sign-off trên revision staging hiện tại; các luồng ngoài Commerce/Settings giữ NOT_RUN/BLOCKED và đi qua Phase 10.
- Performance đo bằng Store nhiều Product/Order và hàng nghìn Store: bounded memory, DB query count, p95 page latency, builder duration/disk/retention. Chốt threshold có số đo ở Phase 01/QC trước khi tuyên bố scale-ready.
