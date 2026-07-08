# Phân tích: Background Worker — PW cũ vs PW2 (Distribution Integration)

**Ngày:** 2026-06-09
**Liên quan:** #1149 · F34 Distribution Integration · PR #1150
**Phạm vi:** Giải thích cơ chế worker/queue của PW cũ (`prime-web-api`), cách PW2 (serverless) đáp ứng tương đương, và ước lượng chịu tải theo quy mô thực tế.
**Nguồn:** Quét source `prime-web-api` (working copy) + codebase PW2 hiện tại (`reconcile-orders`).

---

## 1. Bối cảnh & câu hỏi gốc

PW2 (Next.js 15 + Payload, serverless trên Vercel) thay PW cũ (`prime-web-api`, Laravel server thật) làm sale channel `primeweb_v2` trong Distribution (DIS). Câu hỏi xuyên suốt: **PW2 serverless có làm được "background worker" như PW cũ không, và chịu tải ra sao?**

---

## 2. Cách DIS đồng bộ với PW (2 chiều, 2 cơ chế)

```
        PW2 (serverless)                          DIS (Laravel, server thật)
 CHIỀU 1 │  GET /api/v1/distribution/orders  ◄──── DIS PULL (worker, mỗi 15')
 (PW→DIS) │  PW chỉ expose, ngồi yên chờ             → đơn MỚI đi đường này
 CHIỀU 2 │  POST /orders/confirm-for-distribution ◄── DIS PUSH callback
 (DIS→PW) │  PUT  /orders/cancel-for-distribution     khi merchant thao tác
          │  PUT  /orders/update-status-for-distribution
```

- **Đơn mới:** DIS **pull** định kỳ → PW **không** cần push.
- **Đổi trạng thái (merchant thao tác trong DIS):** DIS **push callback** HTTP ngược về PW. PW chỉ **nhận** (verify token → update DB → trả 200; email fire-and-forget). Đây là handler **stateless**, hợp serverless, **không cần worker**.

Callback `update-status` map số → chữ: `4→shipped`, `5→completed` (COD + 5 ⇒ `paymentStatus=paid`), `7→refunded`, `8→cancelled`.

---

## 3. Worker/Job Queue là gì & để làm gì

**3 khái niệm:** Job (1 việc cần làm) → Queue (hàng đợi bền chứa job) → Worker (tiến trình chạy ngầm 24/7 nhặt job ra thực thi).

**Sinh ra để giải:** đẩy việc **chậm / dễ lỗi / định kỳ** ra khỏi luồng request mà user đang chờ, xử lý ngầm một cách **bền bỉ + tự retry**.

**5 mục đích chính:**
1. **Responsiveness** — user không chờ việc chậm (trả response ngay).
2. **Reliability/Retry** — job bền, lỗi tạm thời tự thử lại, hết lần → DLQ, không mất.
3. **Decoupling** — email/DIS sập không kéo checkout chết.
4. **Load smoothing** — flash sale: queue làm hồ điều hoà, không dội chết hệ thống ngoài.
5. **Scheduling** — chạy định kỳ (vd pull đơn mỗi 15').

**Khác biệt với async Frontend:** `Promise` chết khi đóng tab; job trong queue **bền**, sống tới khi xong dù mất ngày.

---

## 4. Worker mechanism của PW cũ (`prime-web-api`)

Laravel chạy trên server thật → 3 thành phần: **Scheduler (cron)** + **Queue (Redis/DB)** + **Worker thường trực** (`queue:work` do Supervisor giữ sống). Base `app/Jobs/Job.php` `implements ShouldQueue` ⇒ mọi job chạy nền.

### Các flow dùng background worker (đã verify)

**Theo sự kiện (Event → queued Listener/Job):**
- ⭐ **Đồng bộ đơn SANG Distribution** — `OrderCreated` → `SyncOrderCreate` → `SyncOrder` job (queue `sync-orders`). PW cũ **chủ động push**, không chỉ bị pull.
- **Email đơn hàng** — Created/Delivered/Canceled/Failed → SendEmailToCustomer/StoreAdmin (queued).
- **Kho & khuyến mãi** — Canceled/Failed → UpdateStock, UpdateDiscountUsed.
- **Đồng bộ xoá sản phẩm** — ProductDeleted → SyncProductDeleted / SyncProduct.
- **Reset password email**, **Passport login → last login**, **Export file**, **ChatLog/MFA notification**, **Onboarding store** (InitialSetup + chain UploadSheetData/Image/Completed), **Domain/SSL**, **Upload image signature**, **SSO step**, **Category statistic**.

**Theo lịch (`Kernel.php` schedule):**
| Lịch | Command | Việc |
|---|---|---|
| mỗi 15' `withoutOverlapping` | `queue-sync:resync` | ⭐ Retry order sync fail (quét `queue_sync` status=retry → dispatch lại `SyncOrder`) |
| mỗi 15' | `promotion:check-discounts-expired` | Hết hạn khuyến mãi |
| daily | `service-tokens:renew-token` | Gia hạn token DIS/Payment/Shipment/UploadImage/ProxyManager |
| daily | `customer:sync-ranks` | Tính lại hạng khách |
| daily | `delivery-provider:sync-list-connected` | Đồng bộ ĐVVC |
| daily | `cache:rebuild` | Dựng lại cache |

---

## 5. Bóc tách `SyncOrder` + `QueueSync` (Outbox pattern)

### Bảng `queue_sync` = sổ ghi việc bền (outbox) trong DB
```
id, store_id, sync_name, code (orderNumber), data(json), type, status(int), error_message
```
`sync_name`: create / update / confirm / cancel / refund.

### State machine (`config/common.php`)
```
not_run_yet(0) → progress(2) → ┬→ success(1) → XOÁ dòng
                                ├→ retry(4)   → chờ cron quét lại
                                └→ fail(3)    → dừng (cần người xử lý)
```
**Success thì XOÁ row** ⇒ bảng luôn chỉ chứa việc CHƯA xong (work-list sống, không phải log).

### `SyncOrder::handle()` (rút gọn)
```
1. find row → 2. status=progress → 3. find order (không có → fail)
4. switch(sync_name) → gọi Distribution::{create|update|confirm}Order / PaymentGateway::refund
5. success → DELETE row ; else → update row (retry|fail + error_message)
```

### ⭐ Trái tim retry: `transformResponse()` — retry CÓ CHỌN LỌC
```
HTTP 200 → success (xoá row)
HTTP 401 → retry   (token DIS hết hạn = lỗi TẠM THỜI → thử lại; RenewToken daily làm mới)
khác     → fail    (lỗi THẬT → dừng, không tự retry vô ích)
```

### Hai tầng thực thi
- **Tầng 1 (ngay):** event → tạo row → `dispatch(SyncOrder)->onQueue('sync-orders')` → worker chạy ~giây.
- **Tầng 2 (lưới an toàn):** cron `queue-sync:resync` 15' `withoutOverlapping` → quét row `retry` → bơm lại.

### Cascade
`syncCancel` / `syncUpdate(failed)` tự sinh row `sync_order_refund` mới (nếu payment không thuộc `no_refund`) → mỗi bước nghiệp vụ là 1 row độc lập, retry riêng.

**Lưu ý:** Job **không** đặt `$tries`/`$backoff` ⇒ retry **do app tự lái bằng bảng `queue_sync` + cron**, KHÔNG dùng retry built-in của Laravel queue. Đây là chủ ý (kiểm soát được, audit được).

---

## 6. Tại sao PHẢI dùng worker (nếu gọi DIS thẳng trong request checkout)

Việc "đồng bộ sang DIS" mang 3 đặc tính độc hại nếu làm inline:

| Đặc tính | Hệ quả nếu inline | Worker giải quyết |
|---|---|---|
| **Chậm** (gọi hệ thống ngoài) | Buyer chờ 1–10s | Trả response ngay, làm sau (`waitUntil`/queue) |
| **Dễ lỗi tạm thời** (mạng/401/deploy) | Đơn fail oan HOẶC mất đồng bộ vĩnh viễn | Ghi outbox bền + retry chọn lọc |
| **Cần lặp theo thời gian** | Không retry được trong 1 request | Cron quét lại row `retry` (phút→giờ→ngày) |

Bản chất: tách **"đơn đã lưu chưa?"** (trả lời ngay) khỏi **"đã báo DIS chưa?"** (chậm, dễ lỗi, có thể phải thử nhiều lần). Nhập 2 cái làm 1 = phá trải nghiệm checkout + mất dữ liệu khi sự cố.

---

## 7. Cách PW2 (serverless) đáp ứng tương đương — Outbox + Hybrid

PW2 **không có worker thường trực** (function chỉ sống vài giây/request). Tái hiện đúng triết lý PW cũ bằng:

### Bản đồ chuyển đổi
| PW cũ | PW2 tương đương |
|---|---|
| Bảng `queue_sync` (outbox) | Collection Payload `distribution-syncs` (Postgres) |
| `dispatch(SyncOrder)->onQueue` ngay | `waitUntil(syncOne(row))` sau response (first-attempt tức thì) |
| Worker `queue:work` thường trực | **Không có** → Vercel Cron drain (mẫu sẵn `reconcile-orders`) |
| Cron `queue-sync:resync` 15' | Vercel Cron `/api/cron/distribution-sync` quét `pending`+`retry` |
| `transformResponse` 200/401/else | Giữ y nguyên: 200→xoá, 401→retry, else→failed |
| `RenewToken` daily | Cron daily refresh token / refresh lazy khi 401 |
| `withoutOverlapping()` | maxDuration + deadline guard + batch limit (reconcile đã làm) |

### Kiến trúc Hybrid (giống PW cũ nhất — 2 tầng)
```
Order đổi trạng thái:
  1. payload.update(order)                 ← lưu (sync, bắt buộc)
  2. tạo row distribution-syncs(pending)   ← outbox
  3. return response NGAY
  4. waitUntil(syncOne(row))               ← first-attempt, không block client (~1s)
        ↓ lỗi/transient → row ở pending/retry
Vercel Cron mỗi vài phút /api/cron/distribution-sync:
     quét status IN (pending,retry) → syncOne() từng cái   ← lưới an toàn (= resync)
```
- `waitUntil` = đồng bộ tức thì 99% trường hợp (DIS sống), latency ~1s như PW cũ.
- Cron = bắt phần rớt lại (DIS sập/401/timeout) → đảm bảo không mất.

### Các mảnh cần build
1. **Collection `distribution-syncs`** (syncName, code, tenant, data json, status, attempts, errorMessage, nextRetryAt). ⚠️ Thêm collection/cột → **bắt buộc** entry trong `scripts/db-setup.js` MIGRATIONS (CI hard-gate).
2. **`syncOne(row)`** — port `SyncOrder::handle()`: guard `processing` → gọi DIS → `transformResponse` (200 xoá / 401 retry / else fail).
3. **Cron route** `/api/cron/distribution-sync` — clone `reconcile-orders`: `CRON_SECRET` Bearer, `maxDuration=60`, deadline guard, batch limit, query `status in [pending,retry]`.
4. **Token** lưu Redis (Upstash đã có); 401 → retry + refresh.

### 2 điều BẮT BUỘC đúng
- **Idempotency** — `waitUntil` + cron có thể chạm trùng. Guard `status==='processing'` + thao tác DIS idempotent (repo đã có kỷ luật ở `reconcileOrderPaid`).
- **Time budget** — function chết 60s. `limit` batch + `deadline` guard ⇒ backlog drain dần, không cắt đuôi âm thầm.

### Khác biệt còn lại
Latency tầng retry = **cron interval** (vài phút) thay vì "vài giây" của worker thường trực. Cần gần-realtime hơn → Upstash QStash (push-queue, retry/backoff/DLQ built-in). Với đồng bộ đơn, vài phút là quá ổn → KISS, dùng cron.

---

## 8. Ước lượng chịu tải — theo quy mô THỰC TẾ

**Profile xác nhận:** <500 đơn/ngày (pilot) · peak 20–150 đơn/phút · **>500 tenant**.
⇒ Combo "ít đơn nhưng fan-out rộng". Nút thắt **không phải** số đơn.

### (A) Tải F34 hiện tại (pull + callback) — PW2 không có việc nền
**Pull fan-out** (nút thắt thật):
```
>500 tenant ÷ 15' = ~0,56 req/s trung bình
nếu DIS bắn dồn cục đầu khung 15' → ~4–8 req/s đỉnh ngắn
```
→ Nhẹ về số tuyệt đối. Canh **duy nhất**: 500 query DB dồn cục → pool Neon. Xử lý: **bật pgbouncer**, index `(tenant, updatedAt)`, lý tưởng DIS stagger pull. (Phụ: <1 đơn/tenant/ngày ⇒ đa số pull rỗng — phí nhẹ, YAGNI.)

**Callbacks:** <2.000/ngày ≈ 0,02/s. Vặt. Peak tạo đơn KHÔNG đẩy callback (confirm/ship rải nhiều ngày).

**Peak 150/phút** chỉ chạm endpoint checkout storefront (auto-scale), **không** động tới integration (vì DIS pull).

→ **F34 như thiết kế chịu tải dư sức.** Chỉ cần Neon pooler.

### (B) Nếu thêm outbound push (outbox+cron)
- Peak 150/phút = 2,5/s → `waitUntil` song song thừa sức.
- Backlog xấu nhất (DIS sập cả ngày) ≤ **~500 row**.
- Cron rẻ nhất `*/5` limit 50 tuần tự = **600 row/giờ** → drain 500 trong **<1 giờ**.
→ **Tier S.** Không cần concurrency, không cần QStash.

### Tốc độ drain các cấu hình (tham chiếu, ~0,5s/item)
| Cấu hình | Tốc độ | Ghi chú |
|---|---|---|
| `*/5` limit 50 tuần tự (= reconcile) | ~600/h | đủ cho profile này |
| `*/1` limit 50 tuần tự | ~3.000/h | |
| `*/2` limit 200 concurrency 10 | ~6.000/h | khi lên Tier M |
| `*/1` limit 500 concurrency 10 | ~30.000/h | Tier L |
| QStash | nghìn song song | Tier L+ |

---

## 9. Khuyến nghị chốt cho profile hiện tại

| Hạng mục | Khuyến nghị |
|---|---|
| F34 hiện tại | Triển khai như plan, **không thêm worker** |
| Neon pool | ✅ Bật pgbouncer + index `(tenant, updatedAt)` — nút thắt thật |
| Outbound push (nếu thêm sau) | `*/5` limit 50 tuần tự (clone `reconcile-orders`) |
| Concurrency / QStash | ❌ Chưa cần |
| Token Redis Upstash | ✅ Lưu token 500+ tenant |

**Ngưỡng nâng cấp sau:**
- >5.000 đơn/ngày *hoặc* backlog outage >3.000 → concurrency 10 + cron `*/2`.
- >50.000 đơn/ngày → QStash.

---

## 10. Kết luận

- F34 thiết kế **pull + callback** đặt toàn bộ gánh queue/worker ở **DIS (server thật)**; PW2 chỉ làm handler stateless ⇒ **chạy tốt trên serverless, không cần worker**, dù lượng đơn/tenant tăng.
- Nếu tương lai PW2 cần **chủ động push** sang DIS (như `SyncOrder` của PW cũ), dùng **Outbox (`distribution-syncs`) + Hybrid (`waitUntil` + Vercel Cron drain)** — tái hiện đúng triết lý "local-first + retry chọn lọc" của PW cũ, và repo **đã có mẫu** ở `reconcile-orders`.
- Với quy mô hiện tại (Tier S), mọi thứ dư địa lớn; điểm cần làm ngay **duy nhất** là đảm bảo **Neon pooler + index** cho pull fan-out 500+ tenant.

---

## Câu hỏi chưa giải quyết
1. Neon pooler (pgbouncer) hiện đã bật cho production chưa? Query pull có index `(tenant, updatedAt)` chưa? (cần verify trước go-live)
2. DIS có **stagger** các lần pull qua 500+ tenant, hay bắn dồn cục đầu mỗi khung 15'? (ảnh hưởng đỉnh tải pull)
3. F34 có dự kiến chiều **outbound push** PW2→DIS không, hay thuần pull+callback? (quyết định có cần build outbox hay không)
4. Open question Q4 trong PRD (auto Stripe refund khi DIS báo returned status=7) — nếu có, sẽ cần outbox cho nhánh refund giống `syncRefund` của PW cũ.
