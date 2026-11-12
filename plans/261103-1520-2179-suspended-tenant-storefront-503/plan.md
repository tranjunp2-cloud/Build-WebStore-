---
title: "Store unavailable (suspended or expired) → storefront 503 + checkout block"
issue: 2179 (mục 6)
branch: fix/F09-suspended-tenant-storefront-503 (từ origin/staging 4d06ca56d)
status: in-review
created: 2026-11-03
updated: 2026-11-03 (bỏ Rule C; delta prod đã chạy xong → sửa tay 5 store sau #6)
---

# Plan — chặn store không khả dụng (#2179 mục 6)

## Định nghĩa "store không khả dụng"
`tenant.status === 'suspended'` (bị ban, qua SSO `ban-user`) **hoặc** subscription `main` mới nhất tồn tại và
`isSubscriptionActive(sub) === false` (hết hạn / ended / canceled immediately). Không có subscription `main` → khả dụng.
Đây đúng mô hình PW2 gốc: ban → tenant suspended; hết hạn → `endsAt` (giống `session-check`).

## Vì sao (scout 03/11)
- SSO: terminate/suspend → `ban-user`; reconnect/restore/thanh toán → `unban-user`; gia hạn → `renew` (chỉ `endsAt`). Gói trả phí hết hạn: SSO không gọi gì.
- PW2 không suspend tenant khi hết hạn → chỉ kiểm `tenant.status` sẽ không chặn store hết hạn.
- Migration map owner hết hạn (không ban) → tenant + membership `suspended` → 5 store thật gia hạn xong vẫn bị khoá.
  - Delta prod đã chạy xong, không chạy lại → không sửa bằng code (Rule C bỏ). Sửa tay trên admin sau khi #6 lên prod: `docs/migration/pw1-expired-owner-manual-reactivation-2179.md` (PD-027).

## Spec hiển thị (BA `issuecomment-6598690518`)
503 + noindex, không nêu lý do, không sản phẩm, không checkout; EN/BM theo ngôn ngữ chính của site (`ms*` → BM, còn lại EN).
Bật bằng thứ tự release, không env flag. API public chặn trong cùng PR.

## Phases
| # | Phase | Status |
|---|---|---|
| 01 | [Helpers: availability, cache sub, copy + 503 HTML](phase-01-shared-unavailable-helper.md) | done |
| 02 | [Middleware 503 (subdomain + custom domain)](phase-02-middleware-503.md) | done |
| 03 | [Page fallback + SEO routes](phase-03-page-fallback-and-public-api.md) | done |
| 04 | [Public API + checkout block](phase-04-public-api-and-checkout.md) | done |
| 05 | ~~Rule C exporter~~ — bỏ, thay bằng sửa tay 5 store (PD-027) | dropped |
| 06 | [Tests, QA, CI, PR, release order](phase-06-tests-qa-and-rollout.md) | in-progress (chờ commit + PR) |

## Thứ tự release (prod)
0. Điều kiện: rollout #2182 (delta PW1) đã chạy trên môi trường đó — dev trước khi merge `staging` (đã xong, kiểm 04/11), prod trước khi promote `main` (delta prod đã xong 03/11). Chưa xong thì 96 store bị suspend nhầm sẽ mất web.
1. Trước khi merge: đếm trên prod số store active có gói main hết hạn (và site đã publish) sẽ bị đóng. Local: 26, hết hạn 28/10–02/11, 0 site published.
2. Merge + deploy #6 lên prod.
3. Sau đó sửa tay 5 store theo hướng dẫn. Làm trước #6 thì 5 store hết hạn mở web và nhận đơn COD → không chọn.
4. Dev/staging làm cùng thứ tự trước.

## Rủi ro chính
- Hết hạn → 503 cho mọi store hết hạn (không chỉ migrate). BA nói "chung cho expired và banned" → khớp; cần BA xác nhận lại + ân hạn (mặc định: không).
- Cache tối đa 5 phút; `endsAt` hết hạn tự có hiệu lực (tính lúc request, không cache boolean). SSO renew/upgrade/downgrade/ban/unban bust cache ngay.

## Câu hỏi mở
1. BA xác nhận chặn store hết hạn (subscription) và không có ân hạn?
2. Trang tra cứu đơn (`/orders`, `/order/*/confirm`) có cần mở riêng cho người mua? (mặc định: chặn như bảo trì)
3. BM copy cần native review.
