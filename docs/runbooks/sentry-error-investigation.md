# Điều tra lỗi bằng Sentry (staging + production)

Dành cho cả team (Dev, QC, PM). Đọc 5 phút là dùng được.

## 1. Lỗi nằm ở đâu

| Môi trường | Web | Sentry project | Lọc `environment` |
|---|---|---|---|
| Staging | https://web-v2.dev.ecommercehub.my | `web-store-v2-staging` | `staging` |
| Production | https://web-cms.ecommercehub.unifi.com.my | project prod của web-store-v2 | `production` |

Org Sentry: https://prime-production-service-co-0t.sentry.io — xin anh Phương mời vào org nếu chưa có tài khoản.

Sentry tự bắt:
- lỗi server (API route, server component, streaming) — qua `onRequestError`
- lỗi trình duyệt của người dùng
- mọi `console.error(...)` ở server và client (kể cả lỗi đã `catch` rồi log)

Sentry **không** gửi: lỗi 4xx (400/401/404…), `ResponseAborted` (người dùng tắt trang giữa chừng), `ResizeObserver loop`. Cookie đăng nhập và body upload media bị xoá trước khi gửi.

## 2. Có lỗi thì làm gì — 6 bước

1. **Mở Issues** → chọn đúng project → lọc `environment:production` (hoặc `staging`) → sắp xếp theo *Last Seen*.
2. **Tìm đúng lỗi**: gõ một phần message, hoặc lọc theo URL: `url:*checkout*`. Lỗi của 1 shop: `url:*<domain-shop>*`.
3. **Đọc 3 chỗ trong trang issue**:
   - *Stack trace*: dòng đầu tiên thuộc `src/...` là chỗ code mình gây lỗi (bỏ qua dòng `node_modules`).
   - *Breadcrumbs*: các bước ngay trước lỗi (request, query, console).
   - *Tags*: `environment`, `release`, `url`, `browser` — biết lỗi ở bản deploy nào, trang nào.
4. **Xem mức độ**: cột *Events* (bao nhiêu lần) và *Users* (bao nhiêu người). Lỗi mới sau deploy → xem tag `release` khớp commit nào.
5. **Đối chiếu log Vercel** nếu cần chi tiết hơn: Vercel → project `ech-prime-web-v2` → Logs → lọc theo thời gian + URL của event.
6. **Tạo issue GitHub**: nút *Create GitHub Issue* trong Sentry, hoặc dán link Sentry issue vào bug report (`/bug-report`). Ghi rõ môi trường, URL, số event.

Xong thì **Resolve** issue trong Sentry khi bản sửa đã deploy — nếu lỗi quay lại, Sentry tự mở lại và báo *Regression*.

## 3. Xem nhanh trong Studio

`/studio/issues` → tab lỗi trực tiếp hiển thị 25 lỗi Sentry mới nhất của môi trường đó, không cần tài khoản Sentry (tài khoản Studio Viewer xem được). Cần biến `SENTRY_READ_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` trên Vercel — nếu tab báo *configuration* là thiếu biến.

## 4. Mẹo

- Lỗi chỉ thấy *minified* (`a.b is not a function` ở file `chunk-xxx.js`): source map của bản đó chưa lên Sentry → báo DevOps kiểm biến `SENTRY_PROJECT_STAGING` / `SENTRY_PROJECT_PRODUCTION` trong GitHub.
- Staging lấy mẫu trace 50 %, production 10 % — nhưng **lỗi luôn được gửi 100 %**, chỉ performance trace bị lấy mẫu.
- Không dán token, mật khẩu, dữ liệu khách hàng vào comment Sentry hay issue GitHub.
- Thử Sentry có nhận không: gọi `/api/sentry-test` trên staging (chỉ dùng ở staging).

## 5. Cấu hình (cho DevOps)

Biến Vercel (mỗi môi trường): `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, và cho tab Studio: `SENTRY_READ_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Mẫu ở `.env.staging.example` / `.env.production.example`.

GitHub (build upload source map): secret `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`; repo variable `SENTRY_PROJECT_STAGING`, `SENTRY_PROJECT_PRODUCTION`.
