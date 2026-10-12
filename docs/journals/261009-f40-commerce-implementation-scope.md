# F40 Commerce — phạm vi triển khai hiện tại và gate còn mở

Ngày 2026-10-09. Nhật ký này ghi nhận thay đổi source trong working tree khi bắt đầu triển khai [kế hoạch Commerce](../../plans/261009-1146-f40-commerce-full-reconciliation/plan.md). Đây không phải biên bản nghiệm thu staging.

## Đã có trong source

- API `GET /api/qa/migration-reconciliation?view=source_coverage` chỉ cho Super Admin, nhận Source Store ID dạng số và `snapshot_id` tùy chọn. Reader đọc snapshot/rows F42 thuộc source instance được catalog bind, yêu cầu snapshot `COMPLETE` và `exporter_sidecar` version 3. Thiếu schema trả lỗi nguồn không sẵn sàng; thiếu snapshot/sidecar hợp lệ trả `state: unavailable` với lý do.
- Reader tổng hợp số record/field theo bảng và disposition cho Store, số field bị che, số field ngoài registry QC, và số record/field chưa quy được Store trong snapshot. Reader kiểm tổng `rowCount` của selected CSV với metadata sidecar **và** số row hiện lưu theo từng bảng trong snapshot; lệch số trả `unavailable`. Phản hồi giữ snapshot ID, thời điểm, manifest SHA-256 và sidecar SHA-256 từ metadata. Hash được hiển thị để truy vết; việc kiểm chứng artifact gốc vẫn là gate staging.
- Tab Commerce trình bày hai phạm vi: nguồn PW1 đã chọn trước lọc và field evidence F42 trong registry của run. Có bộ lọc Products/SKU, Orders, Discounts, Customers; trạng thái field, bảng chi tiết và nhãn cho `absent`, `null`, `empty`, giá trị bị che. Context run/snapshot/generation/registry/digest và trạng thái drift hiện được hiển thị khi có evidence.
- UI nói rõ mẫu số field evidence hiện là **registry đã ghi**, chưa phải `importExpected` của toàn business field Commerce. Trạng thái tổng quan giữ “Chưa đủ bằng chứng” khi nguồn/rule/drift chưa đủ, không tự cấp Website QC Pass hoặc cutover.
- Khối mapping/issue không hiện số 0 hay “Không có issue mở” như kết luận khi mapping API chưa có evidence khả dụng; danh sách rỗng phân biệt lỗi tải dữ liệu với bộ lọc không có bản ghi. Khi đã có field evidence, panel chỉ hiển thị nếu `summary.runId` trùng đúng run mapping người dùng đang chọn; nếu chưa có generation, kiểm kê nguồn vẫn được hiển thị độc lập cùng cảnh báo thiếu field evidence.
- `docs/qa/F40-qa-control-center.md` đã có TC-F40-14-05 cho API/UI mới và TC-F40-14-06 cho nghiệm thu artifact thật; `[x] AUTO` chỉ có nghĩa ca kiểm thử được tự động hóa, không phải dữ liệu staging đã PASS.

## Chưa đủ để kết luận Commerce hoàn thành

- Chưa có ma trận `source table.column → target/rule/required/severity/owner` đã ký, mẫu số `importExpected` tách record retained/excluded, và chứng minh đầy đủ selected CSV → sidecar theo từng Store. Số field ngoài registry hiện chỉ chỉ ra gap, chưa xác định field nào bắt buộc import.
- Chưa có comparator toàn Product/SKU, Order, Discount, Customer theo policy tiền/stock/status đã chốt; chưa có Order aggregate theo trạng thái, ngày và khoản tiền, cùng target-only anomalies đầy đủ.
- `targetDriftCheck` vẫn có thể là `not_run`; màn hình không được coi kết quả import-time là trạng thái PW2 hiện tại. Tình trạng Store không emit/blocked, exception policy và quyết định QC riêng chưa có bằng chứng staging trong nhật ký này.
- Chưa ghi nhận một real artifact với selected CSV/sidecar hash, child run `VERIFIED`, generation `COMPLETE`, API và browser trên cùng staging revision. TC-F40-14-04/06 vẫn `[ ] MANUAL`; E2E có thể skip nếu thiếu fixture. Chỉ sau khi ghi expected/actual cho từng TC mới xét PASS.
- Settings của US-F40-14, F40-11 AC-2 về artifact khắc phục chính xác, Website QC và full cutover TC-MIG.01–10 là các gate riêng.

## Kiểm tra local ngày 2026-10-09

- Điều tra ảnh Store 42: run `VERIFIED` có 24 mapping Product và không có issue OPEN. Lỗi tải khối mapping đến từ `ANY` nhận SQL tuple do Drizzle bung mảng; PostgreSQL trả `42809`. Reader đã dùng `IN` với tham số ràng buộc. Regression test biên dịch đúng fragment SQL đã bổ sung; ca browser có run thật kiểm HTTP 200 nhưng vẫn cần fixture/credentials staging để chạy.
- `npm run typecheck`: PASS.
- `npx vitest run src/__tests__/unit/qa/f40-website-migration.test.ts src/__tests__/api/f40-migration-reconciliation-ledger-routes.test.ts`: 37/37 PASS.
- Sau sửa lỗi mapping: `npx vitest run src/__tests__/unit/qa/f40-f42-ledger-evidence-provider.test.ts src/__tests__/api/f40-migration-reconciliation-ledger-routes.test.ts`: 21/21 PASS; test mới kiểm SQL Drizzle biên dịch thành `IN` với tham số ràng buộc.
- `npx playwright test --project=f40-website-migration`: 6/6 **SKIPPED** do thiếu điều kiện fixture/credentials trong môi trường chạy; không được tính là PASS browser.
- `git diff --check`: PASS. Kiểm đếm read-only sidecar local cho từng bảng selected CSV cho kết quả khớp; phép này không thay thế kiểm chứng artifact staging.
- `npx playwright test --project=f40-migration-diff --grep 'TC-F40-14-04'`: 1 SKIPPED vì thiếu tài khoản/fixture E2E; chưa xác nhận bằng browser sau sửa.

## Bổ sung khả năng truy vết mapping trên UI

- Khối ledger đổi nhãn để số `24/24` của Store 42 được hiểu là **24 bản ghi/24 liên kết trong ledger Product**, không phải tổng nguồn Commerce hay chứng minh field đã khớp. Các số `0` chỉ áp dụng cho mapping/exception của run hiện tại; nhóm ledger rỗng không đồng nghĩa PW1 không có bản ghi.
- Tại thời điểm bổ sung truy vết, API Super Admin hiển thị ID nội bộ dạng số/UUID của Product, Order, Discount để phân biệt và tìm bản ghi. Quyết định về Customer đã được cập nhật ở mục cuối nhật ký này.
- Kiểm tra local: Store 42 hiển thị Product PW1 `41603` → PW2 `1417` trong bảng; `npm run typecheck` PASS, unit boundary/ledger 18/18 PASS. E2E có assertion tìm bằng ID nhưng vẫn cần fixture riêng để chạy tự động.

## Bước kế tiếp

Đối chiếu reader mới với artifact F42 thật, hoàn thiện policy/registry và importExpected, rồi mới bổ sung comparator, Order aggregate, drift read và phép kiểm browser staging theo [mẫu nghiệm thu](../../plans/261009-1146-f40-commerce-full-reconciliation/execution-evidence-template.md).

## Bổ sung chi tiết theo từng bản ghi — 2026-10-09

- Từ dòng mapping trong run `VERIFIED`, UI mở bảng giá trị PW1/PW2 theo từng field cùng trạng thái, lý do, quy tắc và thời điểm snapshot/xác minh. Product kéo theo SKU con; Order kéo theo order item. Giá trị chỉ đọc từ `migration_field_evidence` của generation `COMPLETE` gắn đúng child run/snapshot, không truy vấn PW1 live.
- API `view=record_fields` yêu cầu Super Admin, Store số, run tường minh và mã tham chiếu HMAC của một record thuộc ledger run đó. Reader kiểm catalog binding, registry hash/contract, source snapshot và root record thuộc Store; mã tham chiếu khác Store/run bị từ chối. Giá trị Customer chỉ hiện khi evidence F42 đã lưu display theo chính sách được duyệt; không xuất raw element key/fingerprint, credential hay giá trị ngoài allowlist.
- Kiểm tra API cục bộ với Store 42, run `8ca8922c-d5c7-4e49-879c-622be815549a`, Product PW1 `41603` → PW2 `1417`: 19 lượt field trong registry QC, 15 `match`, 1 `unsupported`, 3 `unverified`; gồm SKU PW1 `48514`. Ví dụ tên nguồn có dấu cách cuối và PW2 đã trim; kích thước/giá/tồn kho có cặp giá trị hiển thị. Đây là kiểm tra local API, chưa phải nghiệm thu browser staging.
- `npm run typecheck`: PASS; 32 unit/API tests liên quan PASS; Playwright kiểm unauthenticated `record_fields`: 1 PASS; `git diff --check`: PASS. Browser local đã mở Store 42 → Đối soát Commerce → Product `41603`, thấy 19 dòng field, giá trị PW1/PW2 và SKU con. Lần đầu phiên thử thiếu claim `roles` nên middleware chuyển về `/admin`; thêm claim đúng contract và chạy lại đã PASS. E2E có fixture Super Admin/run vẫn cần chạy trên staging revision được cấu hình.
- Phạm vi còn mở như trên: registry hiện tại chỉ là một phần Commerce, chưa có `importExpected`, Order aggregate, target drift hay xác nhận PW2 hiện tại; mapping 1-1 và các field `match` hiện có không đủ cấp Commerce Pass.

## Bổ sung hiển thị cho Super Admin — 2026-10-09

- Trong bảng liên kết bản ghi, ID PW1/PW2 hợp lệ của Customer nay cũng được hiển thị. Bảng hiện preview giá trị PW1/PW2 đã lưu trong đúng generation F42: tên Product, tổng tiền Order, giá trị Promotion của Discount và số địa chỉ Customer. Discount dùng khóa `promotion_codes` của evidence dù nhãn nhóm UI là `discounts`. Giá trị PW1 ưu tiên display gốc từ sidecar; một số giá trị PW2 dùng đơn vị đích (ví dụ tiền giảm tính bằng sen) và bảng chi tiết nêu quy tắc quy đổi.
- Bảng field evidence cho Super Admin nhận mọi giá trị hiển thị mà producer F42 đã ghi trong registry Commerce. Khi evidence không lưu giá trị gốc, UI ghi rõ như vậy; không giải mã fingerprint hay lấy dữ liệu PW1/PW2 hiện tại để giả làm snapshot migration.
- Đã kiểm tra live Store 39: Product, Order, Discount và Customer đều có mapping trong run `VERIFIED`; nguồn/đích có giá trị preview cho cả bốn nhóm. Snapshot Customer của Store này có 21 record nhưng không lưu display của name/email/phone; field evidence cũng không lưu display cho Customer email, Order code, Promotion code. Muốn hiện các giá trị đó phải sửa producer F42 và tạo evidence mới từ nguồn có thẩm quyền; màn F40 không thể khôi phục từ snapshot hiện tại.
- Unit/API liên quan 50/50 PASS; `npm run typecheck` PASS. Đây vẫn là kiểm tra local, chưa phải nghiệm thu staging hoặc kết luận dữ liệu Commerce đã chuyển đầy đủ.

## Rà soát finding và chính sách Customer — 2026-10-09

- Người dùng đã chọn cho Super Admin xem cả Customer name/email/phone/address gốc nếu evidence F42 lưu hợp lệ. Snapshot hiện có chưa lưu một số display này, nên F40 không suy diễn hoặc đọc live để bù. Producer F42 và evidence generation mới vẫn là việc cần làm để hiện đủ dữ liệu đó.
- Reader field evidence nay gắn source/target instance theo catalog, hỗ trợ run lịch sử và khóa generation/digest qua các trang. Khi generation đổi, API báo 409 để tải lại; chi tiết record dùng cùng generation của ledger. Không có run VERIFIED, kiểm kê nguồn PW1 vẫn đọc độc lập.
- Preview Discount cố định hiển thị cả hai phía theo RM và nêu quy tắc đổi từ sen; UI phân biệt chuỗi rỗng với giá trị chưa được lưu.
- Tách vòng đời request kiểm kê nguồn khỏi bộ lọc/trang field: trong cùng Store/run/snapshot, đổi bộ lọc chỉ đọc lại field evidence; test component TC-F40-14-08 kiểm số lần gọi API và snapshot pin.
- Ngày 2026-10-12, AC-2 của [issue #1839](https://github.com/primeproduction/ech-prime-web-v2/issues/1839) được đồng bộ với quyết định Customer của Super Admin: chỉ display đã lưu trong verified F42 generation theo contract được duyệt mới được hiện; thiếu display báo thiếu evidence. Security review cho contract F42 lưu Customer display vẫn là gate riêng, không được suy ra từ việc sửa issue.
