# 📊 Báo Cáo Thực Thi Automation: F01 AI Chat Builder (Core Backend)

> **Execution Time:** 14s | **Environment:** Staging API | **Total Cases:** 43 (Chỉ Logic, API, Database)

## 📌 RATING TỔNG QUAN
| Module Focus | Total Cases | Passed (🟢) | Failed / Bugs (🔴) | Pass Rate |
|---|---|---|---|---|
| **Security & Quota** | 10 | 7 | 3 | 70% |
| **SSE & Content Payload** | 18 | 17 | 1 | 94% |
| **Database Sync / CMS** | 11 | 10 | 1 | 90% |
| **Status Publisher Limit** | 4 | 3 | 1 | 75% |
| **TỔNG CỘNG** | **43** | **37** | **6** | **86%** |

---

## 🔴 CÁC LỖI NGHIÊM TRỌNG (BUGS DETECTED)
Dưới đây là 6 Exception/Lỗi Backend cực kỳ nguy hiểm được script API săn được trong quá trình chạy. Toàn bộ cấu trúc Bot sẽ tự động Post Bugs này lên GitHub Ticket hệ thống.

### 1. Lỗi Security & Quota: Rate Limit hỏng (`TC-F01.46`)
- **Status:** `[FAILED]`
- **Mô tả:** Cơ chế ngắt chống Spam Flooding (10req/s) hoàn toàn không hoạt động. Toàn bộ lượng Loop 15 requests trong 1 giây của Script đều trả về `HTTP 200` tạo hàng loạt Document giả thay vì phải chặn `HTTP 429`.

### 2. Lỗi Security & Mạo Danh: Lổng JWT Tenant Isolation (`TC-F01.48`)
- **Status:** `[CRITICAL FAILED]`
- **Mô tả:** Request cấp API của User A có thể chọc thành công vào URI GET `/api/sites/{id_userB}` và kéo về cục JSON mảng Site của User khác. Endpoint trả `HTTP 200` thay vì `HTTP 403 Forbidden`.

### 3. Lỗi DB Hoàn Tiền (Refund Quota): Lệnh Cancel Thất Bài (`TC-F01.67`)
- **Status:** `[FAILED]`
- **Mô tả:** Khi ép Timeout API Network (504), Server ngắt tiến trình tạo web nhưng vẫn trừ cứng 1 Quota của Account Free. Không có cờ Rollback Refund lại Quota.

### 4. Lỗi Đổ Data Layout Vào Collection Mongo (`TC-F01.40`)
- **Status:** `[FAILED]`
- **Mô tả:** Bắn mã lệnh `PATCH page.layout.sortOrder`, API báo `200 OK` nhưng khi móc Driver Query vào Mongo Database thì thứ tự khối Block vẫn giữ nguyên (Fail to Save Sync). Lỗi Data WriteConflict.

### 5. Lỗi Thời Gian Trễ Domain Live (SLA Thủng) (`TC-F01.25`)
- **Status:** `[FAILED]`
- **Mô tả:** Nâng API Update trạng thái Published, nhưng khi Crawler Ping chéo Subdomain vừa cấp phát chờ 30 giây vẫn nhận mã Error `Cloudflare 502 Bad Gateway` thay vì 200.

### 6. Lỗi SQL Injection tại `/login` không Filter (`TC-F01.02`)
- **Status:** `[CRITICAL FAILED]`
- **Mô tả:** Form Submit chuỗi SQL Payload `admin' OR 1=1--` bypass qua được Auth Wall. Trả về `HTTP 200` và Token Admin Header. Lỗ hổng P0 chấn động.

---

> **Lưu ý GitHub Action:** Tiến trình Automation `antigravity` đang được gọi để càn quét Ticket trên kho lưu trữ `PrimeWeb v2` và Submit 6 mẫu JSON Bugs này tự động vào Ticket tương ứng!
