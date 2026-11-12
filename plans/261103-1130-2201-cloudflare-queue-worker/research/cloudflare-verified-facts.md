# Cloudflare Queues/Workers/Cron — facts đã kiểm chứng (2026-11-03)

Nguồn: developers.cloudflare.com (queues/platform/{limits,pricing,changelog,javascript-apis}, queues/configuration/{batching-retries,pull-consumers,dead-letter-queues,consumer-concurrency}, workers/{configuration/cron-triggers,platform/limits,platform/pricing,ci-cd/external-cicd/github-actions}, api push message, fundamentals/api/reference/limits). UNVERIFIED = không xác nhận được từ nguồn chính.

## Đã xác nhận
| Mục | Giá trị |
|---|---|
| GA | 2024-09-26, không còn caveat beta trong changelog |
| REST publish đơn | `POST /accounts/{id}/queues/{qid}/messages`, body `{body, content_type: text\|json, delay_seconds}`; token quyền **Queues Write** (hoặc Workers Scripts Write) |
| Giới hạn message | 128 KB (gồm ~100 B metadata); 5.000 msg/s/queue; delay tối đa 86.400 s |
| Rate limit API account | 1.200 req / 5 phút / user, dùng chung dashboard + token; 429 chặn mọi call 5 phút |
| Retry | throw → cả batch retry (trừ message đã ack); `retry({delaySeconds})` theo từng message; `max_retries` mặc định 3, tối đa 100; hết lượt → xoá hoặc vào DLQ |
| DLQ | cấu hình ở consumer; không có consumer thì message bị xoá sau 4 ngày |
| Retention | 60 s–14 ngày (Paid), Free cố định 24 h |
| Batch push consumer | mặc định 10, tối đa 100; timeout 0–60 s |
| Concurrency | `max_concurrency` 1–250; throw làm giảm scale, explicit retry thì không |
| Giới hạn invocation (Paid) | wall 15 phút; CPU mặc định 30 s (tối đa 5 phút); 6 kết nối đồng thời; 10.000 subrequest |
| Pull consumer | batch_size mặc định 5 / tối đa 100; visibility 30 s mặc định / tối đa 12 h; ack/retry theo `lease_id`; **không có DLQ được ghi nhận, hết `max_retries` là xoá vĩnh viễn** |
| Cron Triggers | tối đa 250/account (Paid), 5 (Free); `* * * * *` hợp lệ; UTC; lan truyền thay đổi tới 15 phút; wall 15 phút; lưu 100 lần chạy gần nhất |
| Giá | Workers Paid $5/tháng; Queues 1M ops/tháng gồm, thêm $0,40/triệu; 1 op = 1 write/read/delete theo mỗi 64 KB; mỗi retry = +1 read |
| Wrangler CI | `cloudflare/wrangler-action` với `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; secret theo từng Worker (`wrangler secret put`) |

## Ước tính chi phí (giả định: message ≤64 KB, 1 retry/20 message, batch 10, 8 cron mỗi phút xấu nhất, 5 ms CPU/message)
| Lưu lượng | Queues ops/tháng | Tổng/tháng |
|---|---|---|
| 10k msg/ngày | 915k (trong hạn mức) | ~$5,00 |
| 50k msg/ngày | 4,575M | ~$6,43 |
| 200k msg/ngày | 18,3M | ~$11,9–12,5 |
Chi phí chủ yếu từ Queues ops, không phụ thuộc batch size.

## Xác thực Worker → Vercel
HMAC (body + timestamp + replay window) là phương án phù hợp. Cloudflare Access service token đòi Access đặt trước origin, không hợp Vercel. IP allowlist **không** dùng được: egress IP của Worker không nằm trong dải IP công bố.

## UNVERIFIED — phải đo/thử ở staging
1. REST **batch** publish (đường dẫn, giới hạn). Vercel chỉ gọi được REST nên đây là điểm có thể chặn thiết kế publish.
2. `message.id` có ổn định khi giao lại không (không dùng làm khoá idempotency cho tới khi test; dùng khoá trong body).
3. Cron: at-most/at-least-once, bù lần chạy bị lỡ, jitter.
4. Độ trễ publish và độ trễ end-to-end.
5. Công cụ xem/replay DLQ (UI/CLI/API); metrics/alert gốc (trang docs 404). Alert phải tự làm (poll `metrics()` hoặc consumer DLQ báo Lark).
6. Hành vi khi consumer vượt 15 phút wall (retry hay mất).
7. `retry_delay` mặc định; Queues trên gói Free và SLA.
8. Kế thừa binding queue/trigger giữa `[env.*]` trong wrangler; quyền token deploy ngoài Workers Edit.
9. Consumer queue có tính vào 10M request gồm sẵn không.
10. Giới hạn `maxDuration`/cron của Vercel (ngoài phạm vi Cloudflare).

## Hệ quả cho thiết kế
- Bắt buộc `max_concurrency` thấp (5–10): tối đa 250 invocation × 6 kết nối có thể dồn ~250 POST đồng thời vào Vercel/Neon.
- Chọn push consumer + HMAC; **không** chọn pull consumer (mất message vĩnh viễn khi hết retry, không DLQ).
- Mọi route cron phải idempotent và an toàn khi chạy chồng (cron có thể trễ/chạy kép/bị lỡ chưa kiểm chứng).
- Khoá idempotency lấy từ body ứng dụng, không từ `message.id`.
