# Phase 06 — Tests, QA doc, CI, PR, release order

**Priority:** High · **Status:** in-progress · **Depends:** 02–04

## TC (F09, bắt đầu TC-F09.277)
| TC | Nội dung |
|---|---|
| 277 | `isStoreUnavailable`: suspended / sub hết hạn / ended / canceled immediately → true; active+sub active, không sub, trialing/past_due/cancelled tenant + sub active → false |
| 278 | `buildStoreUnavailableHtml`: ms/ms-MY → BM; en/vi/rỗng → EN; noindex; không tên store |
| 279 | `/api/slug/redirect` + `/api/domain-primary`: `unavailable` + locale; shape cũ giữ nguyên khi khả dụng |
| 280 | Middleware subdomain + custom domain: 503 + headers; ưu tiên hơn maintenance và redirect primary; fail-open |
| 281 | Page `[[...path]]` + product + blog: unavailable fallback, metadata noindex không lộ tên |
| 282 | sitemap/robots/llms → 503 |
| 283 | API public (bảng phase 04) |
| 284 | Checkout COD/QR, Stripe, Xendit, retry-payment: sub hết hạn → 403 `STORE_UNAVAILABLE` |
| 285 | Cache: `PlanSubscriptions` afterChange bust tag `plan-subscription:<tenant>` |
| 286 | Manual dev sau rollout: store bị ban (483) 503; store hết hạn 503; 2917 200; gia hạn qua SSO → mở lại ≤5 phút |

Mutation-check: bỏ điều kiện subscription / suspended → test tương ứng fail.

## Steps
1. Test + QA doc rows F09 (TC-F09.277–286). ✅
2. ✅ Local CI đủ bước (check-migrations, check-env-vars, lint, typecheck, `npm test`, drift, harness).
3. ✅ Code review (3 vòng) → sửa.
4. User duyệt diff → commit → 1 PR vào staging (`Relates to #2179`), PR body ghi thứ tự release.
5. Điều kiện trước (rollout #2182 phải xong trước, nếu không 96 store bị suspend nhầm sẽ mất web):
   - Merge vào `staging`: rollout #2182 đã chạy đủ trên dev ✅ (kiểm 04/11 qua REST: 96 tenant active + COD, 1327 suspended, slug 1329/1327 đúng, 0 site tắt COD, 2917 published; `store-1329`/`store-1327` 404).
   - Promote lên `main`: delta PW1 của #2182 đã chạy trên prod (đã xong, xác nhận 03/11); kiểm `migrate:pw1:site-cod` đã chạy (chỉ ảnh hưởng COD).
   - Đếm trên prod (chỉ đọc) số store active có sub `main` hết hạn và site đã publish.
   - BA chốt 3 câu hỏi mở (`plan.md`).
6. Prod: deploy #6 → sửa tay 5 store (`docs/migration/pw1-expired-owner-manual-reactivation-2179.md`) → TC-F09.286.
