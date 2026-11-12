---
title: Cloudflare Queues + Worker điều phối job, logic vẫn chạy trên Vercel
status: draft
branch: chore/2201-cloudflare-queue-worker
created: 2026-11-03
---

# Plan: đưa toàn bộ job nền sang Cloudflare (Queues + Cron Triggers), handler vẫn ở Vercel

## Mục tiêu
Thay `after()` / `runAfterResponse` / Vercel Cron / outbox tự viết bằng Cloudflare Queues + Worker mỏng.
Worker **chỉ** nhận message, ký HMAC, gọi route Vercel, ack/retry theo status code. Không có logic nghiệp vụ, không import Payload.

## Ngoài phạm vi
- Chuyển app/Payload sang Workers (đã đánh giá: chưa khả thi, xem research).
- **AI** (generate-site, apply-template, generation recovery, tác vụ nền trong `generate-site-service.ts`): người dùng chờ kết quả/stream nên không cần job. Giữ nguyên code và các cron AI trên Vercel: `process-generation-recovery`, `ai-receipts`, `ai-usage-sync`.
- Migration PW1→PW2 (batch CLI chạy riêng, RSS ~4 GB, không hợp Workers).
- Nâng giới hạn `maxDuration` Vercel: Worker không làm được việc này.

## Kiến trúc
```
Vercel enqueue() ─REST─▶ CF Queue ─▶ Worker consumer ─POST+HMAC─▶ Vercel /api/internal/jobs/:type
CF Cron Trigger ─▶ Worker scheduled() ─GET (Bearer CRON_SECRET)─▶ Vercel /api/cron/* (route hiện có)
Webhook (Stripe/Xendit): verify chữ ký → ghi webhook_events → 2xx → enqueue; sweeper enqueue lại event chưa xử lý
```
Quyết định thiết kế:
- 1 queue + DLQ: `jobs-fast` (email, notification, order events, SSO; batch 10, concurrency giới hạn). Không cần queue job dài vì AI nằm ngoài phạm vi.
- Envelope: `{id, type, payload, createdAt}`. **Khoá chống trùng duy nhất = `id` của envelope** = khoá nghiệp vụ do nơi enqueue đặt, dạng `{type}:{khoá-nghiệp-vụ}` (ví dụ `email.send:{orderId}:{template}:{recipient}`), lưu ở `job_executions.job_id` (unique). Không dùng `message.id` của Cloudflare. Mọi đường gửi lại (sweeper, fallback, retry) **bắt buộc truyền cùng khoá**; chỉ job không có nghĩa nghiệp vụ mới để UUID ngẫu nhiên.
- Route Vercel trả 2xx **sau khi làm xong** (đồng bộ) để retry của queue còn tác dụng.
- Mỗi loại job có cờ `JOBS_VIA_QUEUE_<TYPE>` để bật/tắt và rollback về đường cũ.
- Enqueue lỗi (không mất im lặng): webhook → đã có `webhook_events` + sweeper; SSO → đã có `sso_step_events` + sweeper; email/notification (không có bảng outbox) → **gọi chính handler trong registry ngay tại chỗ** (handler claim `job_executions` bằng cùng khoá trước khi gửi, nên nếu enqueue timeout mà Cloudflare đã nhận message thì chỉ một bên gửi); không gọi thẳng `sendEmail`; log lỗi enqueue có cấu trúc.
- Giới hạn API Cloudflare 1.200 request/5 phút/account (chung với deploy/dashboard): **1 message cho mỗi sự kiện nghiệp vụ**, handler tự fan-out (người mua + N chủ shop + notification), không enqueue từng người nhận.

## Cập nhật sau nghiên cứu (2026-11-03)
Chi tiết: `research/cloudflare-verified-facts.md`, `research/repo-order-payment-flows.md`, `research/repo-email-notification-sso-cron-flows.md` (hai báo cáo repo do agent đọc code, chưa kiểm lại độc lập).
- Phase 03 thu hẹp: chỉ webhook **Stripe/Xendit** (không gồm EasyParcel/`bulk-update`/hook ORDER_NEW). EasyParcel, admin approve/reject/cancel/refund, `bulk-update`, `upload-proof`, poll/stream giữ inline (UI cần kết quả đồng bộ).
- Gửi email luôn ở Vercel (nodemailer SMTP→SES, Worker không làm SMTP). ~25 email hiện không `await` là nơi mất việc nhiều nhất.
- SSO: ghi dòng `pending` trước rồi enqueue (hiện chỉ ghi sau lần thất bại đầu).
- Hook Payload chạy trong transaction → enqueue **trong callback `runAfterResponse`** (sau commit).
- Phát hiện lỗi có sẵn cần quyết định phạm vi (phase 03); `notifications/cleanup` chưa từng được lên lịch.

## Cron (đối chiếu `origin/staging`, 2026-11-03): 10 cron trong `vercel.json`
- Chuyển sang Cloudflare (7): `keep-alive`, `payment-expiry`, `reconcile-orders`, `process-sso-steps` (thành sweeper), `reconcile-qa-targeted-smoke`, `shop-automations`, `feedback-overdue-digest`.
- Giữ trên Vercel (3, AI ngoài phạm vi, **mặc định, chờ xác nhận**): `process-generation-recovery`, `ai-receipts`, `ai-usage-sync`.
- Thêm mới: sweeper `webhook_events` (phase 03); `notifications/cleanup` chưa từng được lên lịch (quyết định riêng).

## Phases
| # | Phase | Nội dung | Rủi ro |
|---|-------|----------|--------|
| 01 | [Nền tảng + spike](phase-01-foundation-and-spike.md) | CF account/queue, Worker scaffold, `enqueue()`, route nội bộ HMAC, `job_executions`, CI deploy, đo spike | Thấp |
| 02 | [Email + notification](phase-02-email-and-notifications.md) | Email giao dịch, broadcast/push/notify; ~25 chỗ dựng dữ liệu email inline cần gom lại | **Trung bình–Cao** |
| 03 | [Order status](phase-03-order-status-flows.md) | Webhook Stripe/Xendit qua `webhook_events` | **Cao** |
| 04 | [SSO + upload proof](phase-04-sso-and-upload-proof.md) | SSO step 2/3, outbox `sso_step_events` (step 1 và `upload-proof*` ngoài phạm vi) | Trung bình |
| 05 | [Cron](phase-05-cron-triggers.md) | Chuyển 7 trong 10 cron sang Cron Triggers, thêm sweeper | Thấp |
| 06 | [Vận hành + dọn dẹp](phase-06-ops-and-cleanup.md) | DLQ alert, runbook, gỡ code cũ, docs | Thấp |

Thứ tự bắt buộc: 01 → (02, 05 song song được) → 03 (cần sweeper `webhook_events` của 05) → 04 (sweeper SSO của 05) → 06.
Phase → US: theo bảng US trong issue #2201 (cập nhật khi tạo issue con). Phase 01 có cổng quyết định (go/no-go).

## Ràng buộc dự án phải tuân thủ
- Bảng mới → entry trong `scripts/db-setup.js` `MIGRATIONS`, đủ điều kiện `scripts/check-migrations.js`; không `DROP TABLE`.
- Hạ tầng: staging có thể bật Vercel Deployment Protection → Worker/cron từ Cloudflare cần header bypass; `workers/` có `tsconfig` riêng và nằm trong `.vercelignore`; `CRON_SECRET`/`JOBS_HMAC_SECRET` có thêm bản trên Cloudflare (ghi vào `env-vars.md` ở phase 06).
- Env mới → Vercel Dashboard + `.env.staging.example` + `.env.production.example`; token deploy Worker → GitHub Secrets (nhóm CI tooling).
- Xoá cron khỏi `vercel.json` cần đọc `.claude/rules/vercel-deploy.md` trước; **không** đụng `git.deploymentEnabled`.
- Test: mỗi test cần TC-ID trong `docs/qa/F*.md`; import từ source, không tái cài logic.
- Git: staging-first, 1 US = 1 branch = 1 PR, `Relates to #N`.

## Câu hỏi mở
Xem cuối từng phase; tổng hợp ở [phase-06](phase-06-ops-and-cleanup.md#câu-hỏi-mở-tổng-hợp).
