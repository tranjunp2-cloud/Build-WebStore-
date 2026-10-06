# F40–F42 — Staging UAT readiness

> Mục tiêu: chuẩn bị đúng điều kiện để QA chạy F40 Migration Inspector với evidence F42 thật. Đây không phải hướng dẫn chạy migration production.

## Trạng thái hiện tại — 2026-09-30

| Hạng mục | Trạng thái | Ý nghĩa |
|---|---|---|
| F40 ledger adapter | Chờ merge PR #1904 | UI/API đã đọc ledger trực tiếp khi có Store + child run hợp lệ. |
| F42 schema/runner | Chỉ có trên branch `feat/F42-migration-data-pw1-to-pw2` | Branch này chưa có PR mở vào `staging`. |
| F42 schema hook | Sẵn sàng trong code F42 | `scripts/db-setup.js` gọi schema migration F42 khi branch F42 được deploy. |
| Child run staging `VERIFIED` | Chưa có | Đây là dữ liệu bắt buộc để F40 có kết quả thật. |

## Blocker phải quyết định trước

F42 importer hiện được thiết kế **chỉ chạy trên isolated local clone**. Runtime chặn remote/Vercel target bằng `LOCAL_DATABASE_REQUIRED` và chặn apply ngoài DB clone bằng `ISOLATED_CLONE_REQUIRED`.

Vì vậy không được tự chạy importer F42 vào staging chỉ để tạo dữ liệu QA. Các batch local đã `VERIFIED` cũng không thể dùng cho F40 staging vì ledger nằm ở DB local khác.

Migration owner/tech lead cần chọn một trong hai đường:

1. **UAT F40 integration (khuyến nghị trước):** dev tạo fixture ledger F42 có guard + reset trên DB staging QC. Fixture phải được gắn nhãn test, không được dùng làm bằng chứng migration dữ liệu thật.
2. **E2E migration thật:** team F42 thiết kế và review một execution path staging-safe riêng. Không nới local-target guard, không copy ledger local, và không chạy lên production.

## Handoff tối thiểu từ team F42

| Cần bàn giao | Tiêu chí cho F40 | Không chấp nhận |
|---|---|---|
| F42 revision/PR deploy | Commit/PR đã merge vào staging, deploy đã chạy schema | Chỉ gửi branch local hoặc log cũ |
| Source Store ID | Chuỗi số PW1, ví dụ `205` | Mã F40 dạng `SITE-xxxx` |
| Child run ID | UUID trong `migration_runs.run_id` | Batch ID `json:<uuid>` |
| Run/store state | Cả `migration_runs.state` và `migration_import_stores.state` là `VERIFIED` | `PLANNED`, `APPLYING`, `FAILED`, `PREFLIGHT_PASSED` |
| Commerce evidence | Có ít nhất một `products` và một `orders` mapping hợp lệ để QA thấy dữ liệu Commerce | Chỉ foundation entities như Tenant/User/Site |
| Settings evidence | Nếu test Settings: `sites`, `users` hoặc `store_email_templates` mapping hợp lệ | Kết luận Payment/Delivery/Domain/Integration đã cover |
| Issue evidence (tuỳ chọn) | Một exception test đã được sanitize, để kiểm tra panel Issue | `detail`, PII, source ID hoặc credential |

F40 chỉ coi mapping là đã xác nhận khi target collection/target ID khớp binding F42. Đối soát hiện tại là **identity mapping**, chưa là đối soát giá trị từng field.

## Xác nhận read-only trước khi bàn giao

Migration owner chạy các truy vấn read-only trên đúng DB staging QC và chỉ gửi kết quả đã che dữ liệu:

```sql
SELECT r.run_id, r.source_store_id, r.state AS run_state, s.state AS store_state
FROM migration_runs r
JOIN migration_import_stores s ON s.run_id = r.run_id
WHERE r.source_store_id = :source_store_id;
```

```sql
SELECT m.source_entity, m.target_collection, m.action, m.state, COUNT(*) AS total
FROM migration_entity_map m
WHERE m.run_id = :child_run_id
GROUP BY m.source_entity, m.target_collection, m.action, m.state
ORDER BY m.source_entity, m.target_collection, m.action, m.state;
```

Không gửi `source_id`, `target_id`, `detail`, checksum, export artifact, DB URI hay credential trong ticket/chat QA.

## Trình tự rollout và UAT

1. Khắc phục billing GitHub Actions, CI xanh và merge PR F40 #1904 vào `staging`.
2. Team F42 tạo/merge PR riêng vào `staging`; deployment chạy F42 schema migration. Không chạy `db:migrate` thủ công trên staging nếu chưa có owner phê duyệt.
3. Team F42 bàn giao Store ID số và child run UUID theo bảng trên.
4. Super Admin mở **Studio QA → Migration Inspector** → **Đối soát Commerce**.
5. Nhập Source Store ID PW1, chọn đúng child run `VERIFIED`; xác nhận summary/mapping và Issue panel.
6. Đổi Store/run hoặc nhập ID sai; snapshot/issue cũ phải biến mất và không có false-pass.
7. Mở **Đối soát Settings**; Profile/Team/Email có thể có evidence. Payment/Delivery/Domain/Integrations phải tiếp tục hiển thị cảnh báo chưa có F42 evidence.
8. Ghi TC-F40-14-04 là PASS chỉ khi evidence lấy từ staging DB đúng revision. Fixture chỉ chứng minh integration F40, không chứng minh migration production.

## Quyết định cần phản hồi từ migration owner

- Chọn fixture UAT hay thiết kế staging-safe E2E migration.
- Chỉ định Store giàu dữ liệu Commerce (Product + Order), không dùng Store foundation-only.
- Chỉ định owner tạo/reset fixture hoặc owner vận hành migration staging-safe.
