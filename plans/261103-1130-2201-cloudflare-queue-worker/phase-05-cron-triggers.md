# Phase 05 — Cron Triggers

Priority: thấp (cron hiện chạy ổn). Status: todo. Phụ thuộc: phase 01.

## Phạm vi (chuyển 7 trong 10 cron của `vercel.json`, thêm 1 sweeper mới)
Đối chiếu `origin/staging` 2026-11-03: có 10 cron. Ba cron AI (`process-generation-recovery`, `ai-receipts`, `ai-usage-sync`) **giữ trên Vercel** theo phạm vi plan (chờ xác nhận).
| Cron hiện tại | Lịch | Ghi chú |
|---|---|---|
| `keep-alive` | */4 phút | Chỉ giữ Neon không suspend. Quyết định: giữ hay bỏ (xem câu hỏi mở). |
| `payment-expiry` | */15 | Có kèm discount auto-deactivate |
| `reconcile-orders` | */10 | Tự chữa pending→paid |
| `process-sso-steps` | */1 | Thành sweeper (phase 04) |
| `process-generation-recovery` | */1 | **Giữ trên Vercel Cron** (AI ngoài phạm vi) |
| `notifications/cleanup` | — | Xoá notification hết hạn |
| `reconcile-qa-targeted-smoke` | */10 | QA nội bộ, có lease |
| `shop-automations` | `0 1,2,3 * * *` (UTC) | Batch resumable, `maxDuration` 120 s |
| `feedback-overdue-digest` | `0 1 * * *` (UTC) | Digest Lark |
| `ai-receipts`, `ai-usage-sync` | */5 | **Giữ trên Vercel** (AI) |
| (+ sweeper `webhook_events`) | mới | Từ phase 03 |

## Phát hiện từ nghiên cứu (chưa kiểm lại độc lập)
- Mọi route cron đã xác thực `Bearer CRON_SECRET` → Cloudflare gọi được mà không đổi route.
- `payment-expiry`, `process-sso-steps`, `reconcile-qa-targeted-smoke` an toàn khi chạy chồng (atomic UPDATE, `SKIP LOCKED`, kiểm lại status trong transaction).
- `keep-alive` đã có guard thiếu `CRON_SECRET` + so sánh constant-time. Chạy mỗi 4 phút so với ngưỡng suspend 5 phút của Neon → **sát ngưỡng**, jitter của Cloudflare có thể làm lỡ. Cần đo hoặc giữ trên Vercel, hoặc bỏ nếu không dùng Neon free tier.
- `/api/cron/notifications/cleanup` **không có trong `vercel.json` nên chưa từng chạy**, và chỉ kiểm auth khi `NODE_ENV==='production'`. Cần quyết định: lên lịch thật (sửa auth) hay bỏ.
- Delivery guarantee và việc bù lần chạy lỡ của Cloudflare cron **chưa xác minh** → đo ở staging.
- Vercel Cron **có lẽ chỉ chạy trên production**: nếu đúng thì không có gì để so sánh song song trên staging. Cách làm: bật Cron Trigger trên staging, kiểm 24 h, rồi cắt sang production, giữ entry `vercel.json` thêm 1–2 ngày để rollback.

## Cách làm (đơn giản nhất)
1. Worker `scheduled()` đọc `controller.cron`, gọi `GET` route `/api/cron/*` **hiện có** với `Authorization: Bearer CRON_SECRET` (route đã kiểm tra secret). Không viết route mới, không đổi logic.
2. `wrangler.jsonc` `triggers.crons`; múi giờ UTC → đối chiếu lịch hiện tại.
3. Giai đoạn chuyển: nếu Vercel Cron chạy được trên staging thì cho cả hai chạy chồng ngắn hạn ở đó, nếu không thì chạy chồng ngắn hạn trên **production**; các job đã idempotent/lease nên chạy chồng chấp nhận được. **Ngoại lệ `feedback-overdue-digest`**: không có chống trùng (chạy chồng gửi 2 card Lark/ngày) và chỉ chạy với bảng production → **cắt hẳn** từ Vercel sang Cloudflare, không chạy chồng; kiểm thủ công 1 lần trên production. (`shop-automations` có marker theo ngày nên chạy chồng được.) Sau khi xác nhận mới xoá khỏi `vercel.json` (đọc `vercel-deploy.md` trước).
4. Worker ghi log mỗi lần gọi (cron, status, thời lượng). Không cần retry riêng (lần chạy sau sẽ bù, job đã idempotent); cảnh báo khi một cron lỗi liên tiếp. Nếu staging bật Deployment Protection thì kèm header bypass.

## Rủi ro
- Cron Triggers lan truyền thay đổi tới ~15 phút; không tin cậy tuyệt đối đến từng phút (docs chưa nêu at-most/at-least-once).
- Chạy kép trong giai đoạn chuyển → dựa vào lease/CAS hiện có.

## Test / tiêu chí xong
- Mỗi cron chạy đúng lịch trên staging ≥ 24 h (trừ `feedback-overdue-digest`, chỉ kiểm được trên production); không còn lần gọi nào từ Vercel Cron cho job đã chuyển.

## Câu hỏi mở
- Còn dùng Neon free tier không (quyết định `keep-alive`)?
- Cron nào bắt buộc đúng phút (`process-*` mỗi phút) và chấp nhận trễ bao nhiêu?
