# Phase 03 — Webhook thanh toán (Stripe, Xendit)

Priority: cao, rủi ro cao nhất (tiền + kho). Status: todo. Phụ thuộc: phase 01, 02 và **sweeper `webhook_events` của phase 05**.
Nguồn: `research/repo-order-payment-flows.md` (agent đọc code, kèm file:line; chưa được kiểm lại độc lập).

## Phạm vi đã thu hẹp sau nghiên cứu
| Flow | Quyết định | Lý do |
|---|---|---|
| Stripe webhook: `checkout-completed`, `payment-failed`, `charge-refunded` | **Queue hoá** | Hiện nuốt lỗi + trả 200 (`stripe/route.ts:94-98`) → handler lỗi là mất event |
| Xendit webhook: `payment-updated` (`handlePaymentEvent`, `handleInvoiceEvent`) | **Queue hoá** | Như trên (`xendit/route.ts:119-121`) |
| EasyParcel tracking | **Giữ inline** | Nhanh, có row lock; `eventTime=now()` nên đảo thứ tự làm sai lịch sử |
| Admin `approve/reject/cancel/refund`, `bulk-update`, `self-deliver`, `[id]` PATCH | **Giữ inline** | UI dùng kết quả đồng bộ (`refundId`, `restock[]`, kết quả từng đơn) |
| `upload-proof*`, `poll`, `stream`, `payment-status` | **Giữ inline** | Cần phản hồi tức thì |
| Cron `reconcile-orders`, `payment-expiry` | Chỉ đổi bộ lập lịch (phase 05) | Đã idempotent (CAS / atomic UPDATE) |
| Email + notification đi kèm đổi status | Qua phase 02 | |

Điều kiện nền: luồng "paid" đã idempotent (`reconcileOrderPaid()`, `reconcile-order-paid.ts:46-183`, CAS `WHERE status='pending'`, chỉ bên thắng CAS gửi email/notification, không đụng kho).

## Mẫu "verify → ghi → ack → enqueue"
1. Route webhook **vẫn verify chữ ký trên Vercel** (Stripe `constructEvent` trên raw body, tolerance 300s; Xendit `X-CALLBACK-TOKEN` tra theo tenant). Job trễ **không** verify lại chữ ký Stripe.
2. Insert `webhook_events` (`provider`, `event_id` UNIQUE cùng provider, trạng thái, payload tối thiểu).
3. Trả 2xx, enqueue `{webhookEventId}` (chỉ id).
4. Route nội bộ (HMAC) đọc event, gọi **đúng các handler hiện có**, đánh dấu `processed`. Dispatcher trên đường queue phải **ném lỗi** (hiện đường inline nuốt lỗi) để Cloudflare retry.
5. Sweeper (cron phase 05) enqueue lại event `pending` quá N phút → enqueue lỗi không làm mất event.
6. Event trùng → bị chặn bởi UNIQUE.

## Tiên quyết: lỗi có sẵn mà queue làm nặng hơn (chờ bạn quyết định phạm vi)
| # | Lỗi | Vị trí | Đề xuất |
|---|---|---|---|
| 1 | `charge.refunded` sau khi huỷ đơn Stripe đã trả → hoàn kho lần 2, `cancelled` thành `refunded` | `webhooks/stripe/handlers/charge-refunded.ts:55-99` (CAS `status != 'refunded'` ở :57), huỷ đơn Stripe ở `src/lib/orders/cancel-order.ts:246-250` (CAS Stripe; đoạn `:107-110` là Xendit, Xendit không gửi `charge.refunded` nên không dính lỗi này) | **Sửa trước khi bật queue** |
| 2 | `payment_failed` không có CAS → đơn đã trả có thể kẹt `payment_failed` nếu event thất bại tới trước | `webhooks/stripe/handlers/payment-failed.ts:78-87` (đọc rồi ghi, không CAS) | **Sửa trước khi bật queue** |
| 3 | Poll thắng CAS với đơn Stripe thì không có email xác nhận | `reconcile-order-paid.ts:129` | Issue riêng |
| 4 | Event `paid` đến sau huỷ/hết hạn chỉ ghi log dù đã thu tiền | — | Cần quyết định chính sách |
| 5 | Xendit gửi trùng đồng thời có thể gửi 2 email | — | Issue riêng |
| 6 | `bulk-update` / PATCH đơn có race đọc-rồi-ghi (TOCTOU) | — | Issue riêng (không thuộc queue) |

## Việc cần làm
1. Bảng `webhook_events` → `scripts/db-setup.js` `MIGRATIONS` (kiểm `check-migrations.js`).
2. Sửa lỗi #1, #2 (nếu được chốt trong phạm vi).
3. Tách handler thành hàm gọi được từ route inline (đường cũ) và từ job (đường mới); thêm dispatcher ném lỗi.
4. Cờ `JOBS_VIA_QUEUE_WEBHOOK_<PROVIDER>`; bật Xendit trước, Stripe sau cùng.
5. Test thứ tự đảo: `paid`→`refunded`, `refunded`→`paid`, `payment_failed` trước `paid`, event trùng, enqueue lỗi sau khi đã ghi, handler lỗi giữa chừng rồi retry.

## Rủi ro
- Độ trễ cập nhật status tăng; poll/`payment-status` hiện có phải chịu được.
- Thứ tự không đảm bảo (Queues chỉ best-effort) → CAS và ma trận chuyển trạng thái phải đúng.
- Lưu JSON event có thể chứa PII → ưu tiên lưu id và gọi lại API provider khi cần.

## Chưa xác minh
- `payment_status` của đơn Stripe lúc tạo; `checkout.session.async_payment_succeeded` có được đăng ký không (hiện không có trong event map).
- Chính sách retry/timeout của EasyParcel (repo không ghi) — chỉ cần nếu sau này đổi EP.

## Câu hỏi mở
1. Chính sách khi `paid` đến sau huỷ/hết hạn (hoàn tiền tự động / cảnh báo / bỏ qua)?
2. Lưu JSON event hay chỉ id?
3. Có cần thứ tự theo từng đơn không?
4. Lỗi #1–#6 nằm trong #2201 hay tách issue?
