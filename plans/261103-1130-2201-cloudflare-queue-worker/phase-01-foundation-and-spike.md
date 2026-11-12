# Phase 01 — Nền tảng + spike (go/no-go)

Priority: cao nhất, chặn mọi phase sau. Status: todo.

## Mục tiêu
Dựng hạ tầng tối thiểu và **đo** các điểm chưa kiểm chứng trước khi cam kết các phase sau.

## Việc cần làm
1. Cloudflare: tạo account/zone cần thiết, bật Workers Paid (Free không đủ: 10k ops/ngày ≈ 3.300 message/ngày), tạo `jobs-fast` và DLQ của nó.
2. Worker scaffold `workers/queue-consumer/` (`wrangler.jsonc`, TS): `queue()` handler, ký HMAC-SHA256 trên `timestamp.rawBody`, header `X-Timestamp`/`X-Signature`/`X-Message-Id`; 2xx → `ack()`, 429/5xx → `retry({delaySeconds})` backoff, 4xx vĩnh viễn → ack + log (tránh retry vô ích).
3. Vercel: `src/lib/jobs/queue/enqueue.ts` (REST publish, timeout ngắn, trả lỗi rõ), `src/app/api/internal/jobs/[type]/route.ts` (verify HMAC + chống replay ±300s, timing-safe, dedupe `job_executions`, dispatch theo registry `type → handler`).
4. Bảng `job_executions` (`job_id` unique = `id` envelope = khoá nghiệp vụ, không phải `message.id`; `type`, `status`, `attempts`, timestamps) → `scripts/db-setup.js` + `check-migrations`.
5. CI: workflow deploy Worker (staging trước), `CLOUDFLARE_API_TOKEN` trong GitHub Secrets.
6. Env: `JOBS_HMAC_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_QUEUE_JOBS_FAST_ID`, `CLOUDFLARE_QUEUES_API_TOKEN` (Vercel Dashboard + `.env.*.example`).

## Đã xác nhận (xem `research/cloudflare-verified-facts.md`)
Queues GA từ 2024-09-26; retry/DLQ/`retry({delaySeconds})` đúng như thiết kế; pull consumer **không có DLQ** (loại); Vercel chỉ publish được qua REST (không có binding); không dùng `message.id` làm khoá idempotency, khoá nằm trong body; HMAC là cách xác thực duy nhất hợp lý (không allowlist IP).
`max_concurrency` **bắt buộc đặt thấp (5–10)** vì mặc định có thể tới 250.

## Spike cần đo (cổng go/no-go)
- Độ trễ publish Vercel→Cloudflare p50/p95 từ region `sin1`.
- **REST batch publish** có tồn tại không (docs chưa ghi); nếu không, gửi từng message (ở 50k/ngày vẫn nằm trong rate limit 1.200 req/5 phút nhưng cần theo dõi).
- Hành vi retry/backoff/DLQ thật: cố ý ném lỗi, xác nhận redelivery + DLQ; `message.id` có ổn định khi giao lại không.
- Hành vi khi consumer vượt wall time; `retry_delay` mặc định.
- Jitter/độ tin cậy của Cron Trigger, có chạy kép/lỡ không.
- Công cụ xem/replay DLQ; cách gửi cảnh báo (tự làm: consumer DLQ báo Lark).
- **Deployment Protection** của Vercel trên staging có chặn Worker không; nếu có, thêm header bypass vào Worker (`x-vercel-protection-bypass`) + env tương ứng.
- Gói Vercel hiện tại có cho `maxDuration` 300s không; Neon chịu được `max_concurrency` đã chọn.
- **Chọn đường publish:** gọi thẳng REST API từ Vercel (token Queues Write) hay qua Worker `/enqueue` (thêm 1 hop + bề mặt xác thực nhưng cho phép batch). Quyết định sau khi đo.

**Tiêu chí go:** publish p95 < 500 ms; retry + DLQ hoạt động đúng; route nội bộ chịu được replay/duplicate; chi phí ước tính khớp.
**No-go:** quay lại giữ Vercel Cron + outbox, ghi quyết định vào `docs/decisions/decisions-log.md`.

## Test
TC-ID cần tạo trong `docs/qa/` (xem câu hỏi mở): HMAC hợp lệ/sai/hết hạn, dedupe message trùng, enqueue lỗi.

## Câu hỏi mở
- Số F (feature id) và issue GitHub cho hạng mục này là gì để đặt tên branch/TC-ID?
- Ai sở hữu tài khoản Cloudflare và token (production)?
