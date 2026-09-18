# Review plan nhóm100store — 2026-09-18

Scope: review thiết kế [Phase08](../phase-08-bounded-store-groups.md) dựa trên runner/ledger/writer/artifact hiện tại. Không triển khai group runner trong lượt này.

## Findings đã tiếp nhận và sửa vào plan

| Mức | Finding / tình huống lỗi | Quyết định sửa |
| --- | --- | --- |
| P1 | Resume parent VERIFIED: acquireLease chuyển APPLYING, không ghi store nào, releaseLease chuyển PAUSED | completeBatch có fencing/exact selection, chạy cả khi không còn store cần ghi; test resume completed và crash sau store cuối |
| P1 | Lazy child registration chỉ có transaction chưa đủ: runner đã mất lease vẫn có thể đăng ký child | assertFence trong transaction, kiểm group membership và binding, giữ nguyên run_id/state khi retry |
| P1 | Resume tạo registry rỗng rồi bắt đầu ở nhóm pending làm mất bằng chứng chống trùng giữa nhóm | Rebuild từ toàn prefix VERIFIED và phần VERIFIED của nhóm dở dang; from-store không bypass bước này |
| P1 | Child tạo muộn khiến NOT EXISTS(non-VERIFIED child) báo parent hoàn tất sớm | Anti-join exact selected_store_ids, kiểm missing/non-VERIFIED/extra; không dùng count đơn thuần |
| P1 | Heartbeat chạy chồng nhau hoặc còn renewal khi release có thể gia hạn sai thời điểm/hide lỗi | Tối đa1promise, lịch30s, timeout<TTL, propagate failure và dừng/await heartbeat trước release |
| P1 | Hiểu nhầm sửa master/code rồi resume batch đã ghi một phần | Giữ binding bất biến; input/code thay đổi cần reconciliation/batch phù hợp, không thay hash hoặc xóa claims |
| P2 | Hash-partition chia đệ quy là thiết kế storage phức tạp, chưa có bound rõ cho data skew trong timebox1ngày | Thay bằng sorted runs8MiB/hard64MiB, merge fan-in16, file index tạm+hash+rename; registry tái tạo, không persistent job database |
| P2 | Chia100store dễ bị hiểu là đủ để full master chạy thành công | Ghi rõ global scan vẫn cần; source blockers chặn nhóm, store3 có blocker; full-ready chỉ khi mọi nhóm VERIFIED |

Bằng chứng code:

- `ledger.ts`: acquireLease/releaseLease hiện thay state; markStoreVerified chỉ kiểm child đã tồn tại; lockStore/assertFence bảo vệ business writes.
- `writer.ts`: registerSourceKeys chỉ chạy khi truyền registry; keys gồm source identity/checksum, unique indexes/natural keys và SKU, không chỉ email/slug.
- `runner.ts`: preflight toàn selection rồi clear registry; binding kiểm cả writer/schema/artifact; validateResumeCursor không cho nhảy qua store chưa VERIFIED.
- `scripts/pw1-json-migration-schema.js`: child.run_id NOT NULL, parent selected_store_ids lưu toàn selection. Lazy registration giải quyết được mà chưa cần thêm bảng/enum.

Review độc lập ledger xác nhận các finding về completed resume, fencing child registration và rebuild registry. Đã đối chiếu và chấp nhận cả3; không phát sinh yêu cầu thêm bảng group.

## Kiểm chứng đã có và chưa có

- Có: đọc source trực tiếp; đối chiếu failure sequences với ledger; sửa plan và review lại contract.
- Có từ lượt fix trước:94tests/typecheck, clone rehearsal và full real artifact2799stores vượt memory limits; dừng98675source diagnostic. Không suy thành group implementation đã pass.
- Chưa có: code group runner, test group boundaries/resume/cross-group registry, benchmark RAM theo nhóm. Đây là acceptance gate trước full apply.

## Kết luận

Plan gốc cần sửa trước triển khai; các điểm trên đã được ghi thành yêu cầu cụ thể trong Phase08. Review adversarial độc lập sau sửa không phát hiện thêm blocker thiết kế cụ thể. Có thể bắt đầu coding, ưu tiên ledger tests và registry/resume correctness. Không phát hành hoặc chạy full apply dựa trên kết quả review tài liệu.

Adjudication:8findings chính được chấp nhận và cập nhật plan; không hoãn finding correctness. Lượt adversarial báo link review chưa tồn tại tại thời điểm đọc đồng thời — đã xác nhận file được tạo, không còn lỗi link. Không có finding bảo mật/correctness bổ sung chưa xử lý ở mức thiết kế.
