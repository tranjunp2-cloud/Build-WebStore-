# Phase 06 — Vận hành + dọn dẹp

Priority: trung bình. Status: todo. Phụ thuộc: các phase đã bật ở production.

## Việc cần làm
1. **Quan sát:** consumer DLQ ghi log + báo Lark (bot hiện có) khi message vào DLQ; DLQ không có consumer sẽ bị xoá sau 4 ngày nên bắt buộc có consumer.
2. **Dashboard/chỉ số:** backlog, tuổi message cũ nhất, tỉ lệ retry, `job_executions` lỗi theo `type`. Vị trí: Cloudflare dashboard + một truy vấn/admin view tối thiểu.
3. **Runbook** `docs/runbooks/cloudflare-queue-worker.md`: replay message DLQ, tắt cờ khẩn cấp (`JOBS_VIA_QUEUE_*`), xoay `JOBS_HMAC_SECRET`, xử lý backlog.
4. **Dọn code:** xoá đường cũ khi cờ đã bật ổn định ≥ 2 tuần (`runAfterResponse` các chỗ đã chuyển, cron khỏi `vercel.json`, bảng/route thừa). Mỗi lần dọn là PR riêng.
5. **Docs:** `docs/architecture/_OVERVIEW.md`, `docs/CODEBASE_SUMMARY.md`, `docs/CHANGELOG.md`, `.claude/rules/env-vars.md` (biến Cloudflare; ghi rõ `CRON_SECRET`/`JOBS_HMAC_SECRET` có thêm bản trên Cloudflare, ngoại lệ so với "Vercel Dashboard là nguồn sự thật"), `.claude/rules/vercel-deploy.md` (Worker deploy), `docs/decisions/decisions-log.md`.
6. **Chi phí:** đối chiếu hoá đơn Cloudflare thực tế sau 1 tháng với ước tính (~$5 base + ~$1,4/50k message/ngày).

## Tiêu chí xong
Mọi job trong phạm vi chạy qua Cloudflare ở production; DLQ có cảnh báo; rollback bằng cờ đã diễn tập một lần.

## Câu hỏi mở (tổng hợp)
1. Số F và issue GitHub cho hạng mục này; người sở hữu tài khoản Cloudflare.
2. Queues đã GA? Gói Vercel cho `maxDuration` 300s? Độ trễ publish thực tế? (phase 01 đo)
3. `keep-alive`: còn cần không (Neon plan)?
4. UI `bulk-update` có chờ kết quả đồng bộ không?
5. Stripe/Xendit có ràng buộc thời gian phản hồi khi ghi DB trước 2xx?
6. Giữ bảng `sso_step_events` hay chỉ dùng queue?
