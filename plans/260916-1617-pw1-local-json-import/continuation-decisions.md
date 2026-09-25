# Quyết định triển khai tiếp — 2026-09-17

## Bằng chứng, scope và ngân sách

Nguồn sự thật: [readiness](reports/260917-exporter-readiness.md), working tree exporter `<worktree-2>`, branch importer hiện tại. Không lấy HEAD worktree-2 làm inventory vì phần lớn code exporter chưa commit. Không triển khai app/DB trong lượt plan này.

Giữ nguyên phạm vi local và tối đa một ngày theo yêu cầu. Core đã có nên không xây queue/service/UI mới. Phần tiếp nối cần khoảng2h contract/report +3h schema/actor +3h rehearsal có điều kiện; đây không phải tổng thời gian từ đầu dự án. Nếu quỹ thực còn ít hơn, làm theo thứ tự này và báo mốc dừng, không bớt assertion. Missing secrets/actor identity/business decisions không có thời lượng đảm bảo.

Có trên8file cần đổi vì format mới và4collection+SQL+tests; không gom sửa vào monolith để giảm số file. Chỉ cần các module thuần cho classifier/actor bindings nếu tách giúp test; không thêm hệ thống orchestration. ck CLI không có trong môi trường, dùng plan markdown hiện hữu; không tạo một kế hoạch cha/con chặn lẫn nhau.

## Handoff và tính bất biến

Pin archiveSHA71dea1b98fe28298dfe6aa6adb906a23320407514f63bae8a421c922b945dbae và contractSHA8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9. Hash một mình không chứng minh policy được duyệt: đọc đúng contract cùng migrationPolicy/decisionEvidence. Đầu ra mới không overwrite artifact cũ. `/dev/shm` chỉ bản làm việc tạm, không locator durable cho resume.

Strict schema dispatch theo contract hash/profile: không đổi literal cũ thành wildcard, không dùng passthrough unknown keys. Nếu giữ format cũ để chạy regression, parse bằng nhánh schema cũ, không áp semantic mới mặc nhiên. Chốt version import-manifest trước code; fields binding mới có default rõ khi không có actor dependency. Export manifest version1 không có nghĩa mọi artifact version1 đều tương đương.

Writer/schema đổi → partial run cũ không resume bằng binary mới. Chỉ restore clone disposable từ baseline rồi new batch sau lưu evidence; tuyệt đối không sửa ledger hash, xóa claims hoặc đổi sourceInstance để né conflict. sourceInstanceToken không tự thay sourceInstance trong namespace shared claims.

## Phân loại diagnostics có bằng chứng

Mỗi diagnostic/report-row có đúng disposition. Source severity/count giữ nguyên; readiness là kết quả suy thêm, không sửa report.

| Nhóm | Điều kiện | Hành động |
|---|---|---|
| Page/component ngoài scope | Đúng table/field/rule đã xác định; không suy từ chữ raw | Count out-of-scope, không writer |
| Policy warning đã duyệt | Hash contract, policy value và decisionEvidence khớp rule registry; scope/record hợp lệ | Count accepted-with-evidence, không drop dữ liệu im lặng |
| Target gate | Kiểm index/constraint/actor identity thực ở đúng target, selected dependency closure | Resolve riêng cho run/target, lưu evidence |
| Required/global/unknown | Chưa có chứng cứ xác định an toàn | BLOCKED trước business write |

Không chấp nhận mọi warning. SUBSCRIPTION_CANCEL_FLAG_ABSENT hoặc raw ownership warning chỉ được xử lý khi chính rule đã được audit; không suy từ severity. Bỏ qua Pages không bỏ qua Product/Blog rich-text, ownership, payments hoặc địa chỉ. Policy deferEmailTemplates không phải phép cho phép sendEmail trong runtime.

Dùng classifier chung cho diagnostics và report-row partial/unresolved để không vừa accept warning lại sinh REPORT_ROW_UNRESOLVED vô điều kiện; vẫn phải chứng minh từng field unresolved được đóng bởi đúng decision. Target-specific resolved state không cache sang DB khác.

Streaming tổng hợp theo code/severity/scope, counter chính xác, bounded samples và private NDJSON spool nếu cần record evidence. Không array121859diagnostics và không nâng cap vô hạn. Các cap perStore64MiB/scalar16MiB/key-registry1m giữ fail-before-write cho đến khi có thiết kế/benchmark khác. Đo cả load master+report+spool+preflight, không lấy benchmark parser3GiB làm full pipeline proof.

## Creator binding: input cần cung cấp

Danh sách binding phải pin sourceInstance/token/snapshot, hash user-actors registry, target identity, sourceRef và targetUserId, kèm evidence identity có thể kiểm lại. Sidecar actor chứa PII giữ ngoài Git; binding cũng0600 trongdir0700. Không đưa email/password/token vào log. CLI prepare có thể thêm `--creator-bindings /private/bindings.json` sau khi implement/test; đây chưa phải lệnh đã có.

Chỉ chứng minh bằng email hoặc sourceID=targetID là không đủ. Actor đích không tồn tại → BLOCKED; provisioning riêng cần quyết định account identity/roles/access và hành động được phép, không tự tạo tài khoản giả chỉ để fixture thật pass. Có thể lập trình/test resolver bằng actor synthetic trên clone riêng trong lúc chờ.

Chỉ external reference `users.createdBy` và dependency creator chain đã validate mới được dùng resolver; không mở cross-tenant cho Blog.author, Product refs hoặc business User membership. Source ref vừa xuất hiện như business User vừa external registry là conflict theo exporter contract; không tạo hai identity. Existing roles/password/memberships luôn giữ nguyên.

Shared source claim vẫn là `(pw1,sourceInstance,users,sourceId)`. Không bảng/namespace claim riêng để né legacy. Xem phase05/review để implement activeSKIP non-owning external binding và consumer dependencies; parent/child row counts phải phân biệt actor-reference operations với business creates.

## Schema và dữ liệu thật

Port tối thiểu Products/Blogs/BlogCategories/Orders collection + SQL/helper phụ thuộc backend. Không copy nguyên db-setup.js hoặc ghi đè Blogs/Categories req fixes. Chạy duplicate scan read-only trước schema mutation. New tenant+slug constraint phải tồn tại đúng columns/predicate/uniqueness trước khi tháo known old global index; không drop unknown index/constraint hoặc đổi slug/dedupe dữ liệu để script pass. Nếu SQL port dùng warn-and-continue thì thêm verifier fail-closed trước importer apply.

Không đưa thay đổi UI gallery/form/pages vào scope này. Tuy nhiên backend schema ảnh dài/mô tả dài/Order FK nullable cần regression với current callers; không được coi UI/PW2 live đã tương thích chỉ từ local import.

205/285 followup-001 mỗi Store gồm Tenant/User/Site/Subscription; chọn một để smoke sau creator/baseline gate. Store nghiệp vụ chọn từ summary+classified per-record report, không hardcode Store205 từ fixture cũ. Không store nào đủ điều kiện thì deliver preflight-blocked evidence, không xóa claim/cắt records hoặc gọi synthetic là master thật.

## Dependencies với kế hoạch khác

- Plan cha hiện tại01–03: tiếp tục cùng folder, baseline còn dùng;04–06 không tạo vòng blockedBy.
- Exporter worktree-2 #1885: pin artifact đã publish và port backend cần thiết. Full-source needs_review còn đó, không chờ mọi Store được resolve mới làm importer; apply phụ thuộc selected/global readiness thật.
- F40 commerce reconciliation #1839: shared ledger là evidence producer; UI shell không chặn CLI và CLI không chứng nhận full historical parity cho UI. Sau actor extension bàn giao semantics non-owning SKIP, không coi mọi activeclaim là businessCREATE.
- Category integrity/discount plans: kiểm overlap collection/SQL, giữ logic integrity đã có. Không phụ thuộc việc đóng cả plan unrelated.
- Vercel/renderer plans: ngoài scope; không thêm dependency nhân tạo.

## Gates và stop rules

G4: artifact mới parse/hash/provenance/reportcoverage đúng, diagnostics không vượt RAM do số rows; no-schema-write dry-run. G5: schema verified + actor binding đủ evidence + password prerequisites. G6: real selected Store write/read-back/replay/resume, outside-scope/credential fingerprints unchanged, fault cases có evidence tương ứng.

Ngày làm việc kết thúc ở gate nào thì ghi đúng trạng thái: CODE_READY / PREFLIGHT_BLOCKED / REAL_STORE_VERIFIED / BUSINESS_SAMPLE_VERIFIED; đây là nhãn báo cáo, không thay state DB hiện hữu. Không suy real Store pass thành all2799Stores pass, không đóng issue1886 khi AC nguồn thật còn thiếu.
