# QA Test Cases — GH-1599: AI bulk-parse rate-limit toast + shared-bucket fix

> **Scope:** Issue #1599 (branch `fix/1599-ai-bulk-rate-limit`, PR #1608).
> Registry cho toàn bộ TC-ID `TC-GH1599-*`.

---

## 1. Context

AI Chat bulk product creation ("Quickly create multiple products") trả 429 sau 5 request/giờ, frontend hiện sai toast ("Failed to parse products summary") thay vì thông báo rate-limit. Fix: nâng limit 5→10/giờ, 429 body trả `{error:'rateLimitExceeded', resetAt}`, frontend hiện toast countdown đúng. PR review phát hiện thêm: rate-limit key dùng `String(user.id)` trần (không namespace) khiến bulk-parse **share chung 1 bucket** với 10 route AI khác (8 route dưới `src/app/api/ai/*` + 2 route nằm ngoài path `/ai/` nên dễ bỏ sót — `src/app/api/products/generate-description` và `src/app/api/seo/fix`, cùng dùng OpenAI) — limit "10/h" không có ý nghĩa thực tế cho tới khi namespace key thành `` `ai-bulk-parse:${user.id}` ``.

## 2. Test Cases (automated)

| ID | Test file | Tiêu đề | Mức độ |
|:---|:---|:---|:---:|
| TC-GH1599-01 | `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | 429 `rateLimitExceeded` → toast dùng real i18n string, tính đúng số phút còn lại (resetAt tương lai) | Blocker |
| TC-GH1599-02 | `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | 429 `rateLimitExceeded` với `resetAt` đã quá khứ → clamp về 1 phút (không âm/0) | High |
| TC-GH1599-03 | `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | 429 `rateLimitExceeded` với `resetAt` không phải số (malformed) → clamp về 1 phút, không hiện "NaN min" | High |
| TC-GH1599-04 | `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | 500 `aiQuotaExceeded` → regression guard sau khi đổi throw sang JSON.stringify(data) | High |
| TC-GH1599-05 | `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | 500 `aiTimeout` → regression guard tương tự | High |
| TC-GH1599-06 | `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx` | Error code không nhận diện được → fallback toast `parseError` chung | Medium |

**Route test** dùng TC-ID có sẵn (không tạo mới, xem `ai.test.ts`):

| ID | Test file | Tiêu đề | Mức độ |
|:---|:---|:---|:---:|
| TC-F08-04-01 | `src/__tests__/api/ai.test.ts` | 429 trả đúng `{error:'rateLimitExceeded', resetAt:number}`; `checkRateLimit` gọi với key namespaced `` `ai-bulk-parse:${userId}` `` + limit 10 | Blocker |

## 3. Manual Verification Checklist (QC re-test trên staging)

- [ ] Gọi `POST /api/ai/products-bulk-parse` ≥ 11 lần trong 1 giờ (cùng user) → request thứ 11 trả 429, toast hiện "Try again in X min." (không phải "Failed to parse products summary").
- [ ] Gọi 1 route AI khác (vd. `edit-block`) nhiều lần trước, sau đó gọi `bulk-parse` → xác nhận bulk-parse **không** bị 429 sớm do dùng chung bucket với route khác (key đã namespace `ai-bulk-parse:${user.id}`).
- [ ] Bản dịch `ms.json` — chờ native speaker sign-off trước khi merge (đã note trong PR).

## 4. Follow-up (ngoài scope PR này)

- 10 route AI còn lại vẫn dùng key trần `String(user.id)` — cùng share bucket với nhau (dù đã tách khỏi bulk-parse): 8 route dưới `src/app/api/ai/*` (`apply-template`, `edit-block`, `extract-from-url`, `generate-blog`, `product-description`, `rewrite-text`, `seo-generate`, `translate`) + 2 route nằm ngoài `/ai/` nên dễ bị bỏ sót khi audit theo path prefix: `src/app/api/products/generate-description` và `src/app/api/seo/fix` (dùng GPT-4o-mini). Cần issue riêng để namespace toàn bộ + quyết định sản phẩm: quota AI tổng theo user, hay theo từng feature.
- Root cause kỹ hơn (không phải chỉ "share counter" đơn thuần): `getUpstashLimiter` (`src/lib/rateLimit.ts`) cache `Ratelimit` instance theo `` `${limit}:${windowMs}` `` nhưng mọi instance dùng chung `prefix: 'rl'` — nên 2 route cùng truyền key trần giống nhau nhưng limit khác nhau (vd. bulk-parse cũ `limit=10` vs `generate-blog` `limit=20`) vẫn đọc/ghi chung 1 Redis sorted set, chỉ diễn giải theo ngưỡng riêng của từng route. Vẫn tồn tại cho 10 route chưa namespace ở trên.
