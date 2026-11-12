# Phase 02 — Email giao dịch + notifications

Priority: cao (đang không có retry). Status: todo. Phụ thuộc: phase 01.

## Phạm vi (hiện chạy bằng `after()` / `runAfterResponse`, không retry)
- Email: confirm page, `approve-payment`, `reject-payment`, `cancel`, `refund`, `reconcile-order-paid-emails`, `payment-failed`, `charge-refunded`, `payment-expiry` (qua `src/lib/email/send.ts`).
- Notification: `create-broadcast`, `send-push`, `notify-tenant-owners`, hook `Orders` (ORDER_NEW), `Blogs`, `Products`, `Notifications`, `notifications/mark-read`.

## Phát hiện từ nghiên cứu (`research/repo-email-notification-sso-cron-flows.md`, chưa kiểm lại độc lập)
- Chỉ có 1 wrapper `runAfterResponse` (`run-after-response.ts:15`): 9 call site + 6 chỗ gọi `after(` trực tiếp. Ngoài request scope nó chạy ngay (giữa hook/transaction).
- ~25 email là `payload.sendEmail().catch()` **không `await`, không `after()`** → không được đảm bảo hoàn tất trên serverless; đây là chỗ mất email nhiều nhất.
- Chỉ OTP, mời/gửi lại lời mời staff, forgot-password, send-test, `resend-upload-link` (**ngoài phạm vi queue**) được `await` và cần gửi **ngay** → giữ nguyên, không qua queue.
- Transport là nodemailer **SMTP tới SES** (`payload.config.ts:99`); Worker không làm SMTP → việc gửi **luôn ở handler trên Vercel**.
- Push là `web-push` (VAPID), không phải FCM; Firebase chỉ là "doorbell" RTDB qua REST. Fan-out ≤200 người/sự kiện (`notify-tenant-owners.ts:46`); broadcast tối đa 10.000 người nhận, chèn 500 dòng/lần, **không có dedupe key** → chỉ queue phần tín hiệu.
- Dedupe có sẵn cho ORDER_NEW, PROOF_UPLOADED; **chưa có** cho BLOG_PUBLISHED, PRODUCT_LOW_STOCK, PAYMENT_FAILED → redelivery sẽ gửi trùng, cần thêm khoá.
- Hook `afterChange` của Orders/Blogs/Products/Notifications/Users chạy **trong transaction Payload** → enqueue trước commit có thể làm message tới trước dữ liệu.
- `confirm/page.tsx` ghi `paymentReminderSentAt` **trước** khi gửi → gửi lỗi là mất nhắc nhở vĩnh viễn.

## Cách làm
1. Handler `email.send` và `notification.dispatch` trong registry (bọc đúng hàm hiện có, không viết lại logic).
2. Thay lời gọi `runAfterResponse(label, task)` bằng `enqueue(type, payload)` sau cờ `JOBS_VIA_QUEUE_EMAIL` / `_NOTIFICATION`; cờ tắt → đường cũ. **Enqueue bên trong callback `runAfterResponse`** (sau commit), thêm `delaySeconds` nhỏ, và handler kiểm tra lại bản ghi còn tồn tại. Các email `.catch()` không `await` chuyển sang `enqueue` luôn (đây là lợi ích chính).
2b. Message email chỉ chứa id + template + người nhận; **render ở handler** (HTML đã render có thể vượt giới hạn 128 KB của message).
2c. Bổ sung khoá dedupe còn thiếu cho BLOG_PUBLISHED, PRODUCT_LOW_STOCK, PAYMENT_FAILED; sửa thứ tự `paymentReminderSentAt` (ghi sau khi gửi thành công).
3. Dedupe key = `id` envelope, có nghĩa nghiệp vụ: `email.send:{orderId}:{template}:{recipient}` (đã có comment về lỗi email trùng ở `reconcile-order-paid`; giữ nguyên quy tắc "poll không gửi, webhook gửi").
4. Payload chỉ chứa id + tham số tối thiểu (≤128 KB, không nhét dữ liệu nhạy cảm); handler tự đọc dữ liệu mới nhất từ DB.
5. Fan-out: **1 message cho mỗi sự kiện đơn hàng** (handler gửi người mua + N chủ shop + notification) và 1 message cho mỗi broadcast; handler tự chia batch (tránh giới hạn 1.200 request/5 phút của API Cloudflare); `max_concurrency` thấp (5–10) để không dồn vào Neon.
6. `runAfterResponse` ngoài request scope (script/test) vẫn chạy ngay: giữ hành vi này cho đường cũ.

## Rủi ro
- Email gửi trùng khi retry: bắt buộc dedupe trước khi gửi, và ghi nhận sau khi SES nhận.
- Hook Payload chạy trong transaction: chỉ enqueue sau commit (tránh message đến trước dữ liệu).
- Push là `web-push` (VAPID), chạy trong Vercel nên không bị ràng buộc runtime Workers.
- **Khối lượng bị đánh giá thấp:** render ở handler nghĩa là gom dữ liệu email đang dựng inline ở ~25 route vào hàm dùng chung (refactor lớn). Rủi ro phase: Trung bình–Cao. Giảm rủi ro: chuyển từng template một, dùng lại hàm dựng dữ liệu hiện có.
- **Không có bảng outbox cho email/notification:** enqueue lỗi → **gọi handler trong registry tại chỗ** (`enqueueJob` fallback chạy handler inline). Handler claim `job_executions` bằng cùng khoá trước khi gửi, nên enqueue timeout nhưng Cloudflare đã nhận message vẫn không gửi trùng. Không gọi thẳng `sendEmail` ở đường fallback.

## Test / tiêu chí xong
- Retry khi SES lỗi tạm thời; không gửi trùng khi message giao 2 lần; cờ tắt hoạt động như cũ.
- Staging: gửi thật 1 đơn từ đầu đến cuối, xem log Worker + `job_executions`.

## Câu hỏi mở
- Danh sách template email nào có SLA gửi ngay (ảnh hưởng `delaySeconds`/concurrency)?
