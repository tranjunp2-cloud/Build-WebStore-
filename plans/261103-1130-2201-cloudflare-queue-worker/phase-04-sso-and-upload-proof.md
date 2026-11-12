# Phase 04 — SSO step notification (`upload-proof*` ngoài phạm vi, giữ inline)

Priority: trung bình. Status: todo. Phụ thuộc: phase 01 (và phase 05 cho sweeper).

## Phạm vi
- SSO step 2: `easyparcel-save`, `shipping-config`. Qua `notifyStepComplete` (`src/lib/sso/sso-api-client.ts`).
- SSO step 1 gọi từ `apply-template` và `generate-site-service` thuộc luồng AI (ngoài phạm vi): giữ nguyên `after()`. Cron `process-sso-steps` vẫn nhặt lại các event step 1 lỗi.
- Retry hiện tại: cron `process-sso-steps` mỗi phút + bảng `sso_step_events` (`FOR UPDATE SKIP LOCKED`, reclaim 5 phút).
- `upload-proof`, `upload-proof-direct`: **ngoài phạm vi queue** (giữ inline); chỉ notification đi kèm qua phase 02.

## Phát hiện từ nghiên cứu (chưa kiểm lại độc lập)
- `sso_step_events` đã có state machine, unique index `(user_id, step)` và `SKIP LOCKED`. **Nhưng chưa có dòng nào được ghi cho đến sau một lần gọi thất bại** (`sso-api-client.ts:256-271`) → function bị kill giữa chừng là mất event. Sửa: **ghi dòng `pending` trước, rồi enqueue**.
- Step 3 là fire-and-forget trần ở `Products.ts:81`; cần đưa vào cùng cơ chế.
- `upload-proof*` giữ **inline** (UI cần kết quả đồng bộ); chỉ phần notification đi kèm qua phase 02.

## Quyết định cần chốt
- **Giữ `sso_step_events` làm nguồn sự thật**, queue chỉ là cò kích hoạt (message = `eventId`). Cron cũ chuyển thành sweeper. An toàn nhất, ít sửa; trade-off: vẫn còn bảng outbox.
- Phương án thay thế: bỏ bảng, dùng queue làm nơi retry duy nhất. Ít code hơn nhưng mất audit trail → chỉ làm nếu không cần lịch sử.
Đề xuất: phương án giữ bảng.

## Việc cần làm
1. Handler `sso.step.notify` gọi lại logic hiện tại bằng `eventId`; giữ CAS/lease của bảng để không xử lý 2 lần.
2. Ở `easyparcel-save` và `shipping-config`, thay `after(_notifyStep2)` bằng `enqueue` sau cờ `JOBS_VIA_QUEUE_SSO`; `after()` hiện có (kèm fallback chạy ngay) giữ làm đường cũ.
3. Step 3 (`Products.ts:81`, fire-and-forget trần): ghi dòng `pending` vào `sso_step_events` rồi enqueue `sso.step.notify`, cùng cơ chế với step 2, sau cờ `JOBS_VIA_QUEUE_SSO`.
4. Không tạo handler `order.proof.process`: `upload-proof*` giữ inline.
5. Giữ cron `process-sso-steps` chạy chậm lại (ví dụ 5 phút) làm sweeper cho event kẹt.

## Rủi ro
- Hai cơ chế cùng chạy trong giai đoạn chuyển → xử lý trùng; CAS hiện có phải chặn (kiểm tra bằng test).
- `sso-api-client` được thiết kế "await được" cho `after()`; giữ nguyên hợp đồng này.

## Test / tiêu chí xong
- SSO lỗi tạm thời → retry thành công; event kẹt được sweeper nhặt; không gửi trùng step.

## Câu hỏi mở
- Đối tác SSO có yêu cầu thứ tự step 1 → step 2 không?
