# Scenario Report — F19 Vercel Domain Migration

> Date: 2026-04-13
> Target: `plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md`
> Source PRD: `docs/prd/F19-vercel-domain-migration.md`

## Dimensions analyzed (9)
1. User Types · 2. Input Extremes · 3. Timing · 4. Scale · 5. State Transitions · 7. Error Cascades · 8. Authorization · 9. Data Integrity · 10. Integration

## Dimensions skipped (3)
- **6. Environment** — server actions là server-side, UI delta nhỏ. Mobile UX rủi ro thấp; covered by existing F19 design QA.
- **11. Compliance** — domain name không phải PII direct; audit logging hiện chưa requirement (note Q4 PRD).
- **12. Business Logic** — billing tier gate cho custom domain feature thuộc scope khác (F13/billing), không thay đổi trong PR này.

---

## Scenario Table

### 1. User Types

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 1.1 | User Types | Tenant owner add domain (happy) | High | Action succeeds, row tạo với vercelDomainId |
| 1.2 | User Types | Staff với role custom KHÔNG có 'settings' permission cố gắng add domain qua direct POST | Critical | `getCurrentTenantId()` + RBAC guard reject; trả 403, không gọi Vercel |
| 1.3 | User Types | Tenant suspended (status=banned) cố verify domain | High | Action reject ở `requireUser()`; không touch Vercel |
| 1.4 | User Types | Multi-store user switch giữa 2 tenant rồi add cùng 1 domain | Critical | Tenant B add → Payload uniqueness fail OR Vercel 409; KHÔNG cross-link |
| 1.5 | User Types | Bot/scraper hit endpoint qua server action (no UI) | Medium | Server action vẫn check `requireUser()`; rate limit theo session |

### 2. Input Extremes

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 2.1 | Input Extremes | Empty string `""` cho domain | High | Regex L36 reject + return error format |
| 2.2 | Input Extremes | Domain >253 chars (DNS max) | High | Reject với "Invalid domain format" |
| 2.3 | Input Extremes | IDN domain `xn--mnchen-3ya.de` (punycode) | Medium | psl parse OK; Vercel accept punycode form, KHÔNG re-encode |
| 2.4 | Input Extremes | Unicode domain `münchen.de` chưa convert punycode | Medium | Sanitize step convert sang punycode TRƯỚC khi gọi Vercel |
| 2.5 | Input Extremes | Domain với port `mystore.com:8080` | High | Strip port hoặc reject — port không hợp lệ trong DNS |
| 2.6 | Input Extremes | Domain với path `mystore.com/store` | High | Strip path; existing L33 đã handle `replace(/\/$/, '')` nhưng KHÔNG strip giữa path |
| 2.7 | Input Extremes | IPv4 address `192.168.1.1` thay vì domain | High | Regex reject (không match domain pattern) |
| 2.8 | Input Extremes | SSRF attempt `mystore.com#@evil.com` | Critical | Sanitize strip fragment + validate strict regex; không gọi Vercel với payload bẩn |
| 2.9 | Input Extremes | Verification value chứa `<script>` từ Vercel response | High | Render `verification.value` as text (React auto-escape), KHÔNG dangerouslySetInnerHTML |
| 2.10 | Input Extremes | Domain với leading/trailing dot `.mystore.com.` | Low | Sanitize trim dots, validate sau |

### 3. Timing

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 3.1 | Timing | Tenant click "Verify Now" 5 lần trong 2 giây | Critical | Client debounce 1s + `useTransition` lock; server early-return nếu status đã active; tránh hit rate limit 50/hr |
| 3.2 | Timing | 2 tenant đồng thời add cùng domain `mystore.com` | Critical | Payload uniqueness check race → 1 thắng, 1 fail. Vercel 409 cũng catch nốt |
| 3.3 | Timing | DNS chưa propagate đầy đủ khi tenant verify (TTL còn 30s) | Medium | Soft-warn DNS pre-flight; vẫn gọi Vercel; Vercel thường tolerant 10-30s |
| 3.4 | Timing | Vercel `verifyProjectDomain` mất 8s (slow) | Medium | Action không timeout (default Next.js 30s); show loading state |
| 3.5 | Timing | Tenant verify trong khi backfill script đang chạy cùng row | High | Backfill idempotent (409 swallow); tenant action thắng vì backfill chỉ ghi `vercelDomainId` |
| 3.6 | Timing | Backfill bị kill giữa chừng (Ctrl-C) | High | Resume safe vì idempotent; dùng marker `vercelDomainId !== null` để skip |
| 3.7 | Timing | Vercel API trả 429 với `Retry-After: 60` | High | Wrapper propagate `retryAfter`; backfill sleep đúng số giây; tenant action surface friendly error |

### 4. Scale

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 4.1 | Scale | Tenant có 0 customDomains | Low | UI render empty state; settings page không crash |
| 4.2 | Scale | Tenant có 50+ customDomains (power user) | Medium | UI list virtualization không cần (rare); pagination defer |
| 4.3 | Scale | Backfill prod 500+ tenant domains | High | Sleep 40s/call → ~5.5h total; chạy detached process, log progress, resume safe |
| 4.4 | Scale | Vercel project gần soft-cap 100k domains | Low | Pro soft-cap = 100k; orders of magnitude xa; chỉ alert khi >50k |
| 4.5 | Scale | `verification[]` trả về 10 challenges (rare) | Low | UI render tất cả; thêm scroll trong card |

### 5. State Transitions

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 5.1 | State | Add → addProjectDomain success → Payload write FAIL (DB transient) | Critical | Vercel domain orphan (added nhưng Payload không lưu). Try-catch reverse: gọi `removeProjectDomain` để cleanup. NEW edge case! |
| 5.2 | State | Add → Payload write success → Vercel addProjectDomain THROW | Critical | Rollback Payload row (LOCKED decision). Error message friendly |
| 5.3 | State | Add → Payload + Vercel both success → revalidatePath FAIL | Low | Cache stale; user F5 sẽ thấy. Non-critical |
| 5.4 | State | Verify → status 'pending' → another tab đã verify thành công → click | Medium | Server early-return nếu status đã active; idempotent |
| 5.5 | State | Remove → Payload delete success → Vercel removeProjectDomain 404 | Low | Swallow 404 (LOCKED decision); idempotent |
| 5.6 | State | Remove → Payload delete success → Vercel return 500 | High | Log error, return success vì Payload đã clean; manual cleanup script nếu nhiều |
| 5.7 | State | setPrimary trên domain status='pending' (chưa verified) | High | Check guard ở action: chỉ allow setPrimary nếu status='active' (existing logic, verify untouched) |
| 5.8 | State | clearPrimary khi tenant chỉ có 1 domain duy nhất | Medium | Clear isPrimary → fallback về platform subdomain (existing logic) |
| 5.9 | State | Tenant abort mid-flow (close tab giữa addProjectDomain) | Medium | Server hoàn thành, Payload + Vercel sync; tenant F5 thấy đầy đủ |

### 7. Error Cascades

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 7.1 | Error Cascades | Payload DB hoàn toàn down khi add | Critical | Action throw, surface "Service temporarily unavailable"; KHÔNG gọi Vercel (lazy assertVercelEnv không cứu DB) |
| 7.2 | Error Cascades | Vercel API hoàn toàn down (5xx storm) | High | Wrapper throw VercelDomainsError; rollback Payload; surface friendly error |
| 7.3 | Error Cascades | DNS resolve timeout (5s+) trong pre-flight | Medium | `dns.resolve4` reject → soft-warn, skip pre-flight, vẫn gọi Vercel |
| 7.4 | Error Cascades | Network partition giữa Next server và Vercel API | High | fetch timeout/abort → throw → rollback |
| 7.5 | Error Cascades | Vercel API trả invalid JSON (HTML error page) | Medium | Wrapper try-catch JSON parse; throw với message "Vercel API returned non-JSON" |
| 7.6 | Error Cascades | Disk full khi log backfill report | Low | Log fail silently; backfill core không bị block |
| 7.7 | Error Cascades | OOM trong backfill script với 10k+ domains | Medium | Stream qua tenants với cursor pagination, không load tất cả vào memory |

### 8. Authorization

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 8.1 | Auth | Tenant A gọi `verifyCustomDomain('tenantb-domain.com')` qua direct POST | Critical | `getCurrentTenantId()` returns A; query Payload `where customDomains.domain = X AND id = A` → not found → reject. **Verify hiện tại có check tenant ownership không?** ⚠️ Phase 03 phải audit |
| 8.2 | Auth | Expired session → click verify | High | `requireUser()` throw → middleware redirect login |
| 8.3 | Auth | CSRF: external site POST tới server action | Critical | Next.js Server Actions có built-in origin check; vẫn confirm trong Phase 03 |
| 8.4 | Auth | `vercelVerification` field exposed cross-tenant qua tenant findById query | High | Confirm Payload `access.read` trên Tenants là owner-scoped (existing); add field-level access nếu cần |
| 8.5 | Auth | Cron/script gọi Vercel API trực tiếp với token leak | Critical | `VERCEL_TOKEN` chỉ trong server env + 1Password; rotate immediately nếu phát hiện leak; audit Vercel team logs |
| 8.6 | Auth | API Token bị revoke (xóa khỏi Vercel dashboard) | High | Tất cả calls 401; surface "Provider authentication failed, contact admin"; alert DevOps |

### 9. Data Integrity

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 9.1 | Data | Domain tồn tại Payload nhưng KHÔNG có trên Vercel project (orphan Payload) | Critical | Backfill detect + add lại; tenant gặp lỗi sẽ trigger re-add |
| 9.2 | Data | Domain tồn tại Vercel nhưng KHÔNG có Payload row (orphan Vercel) | High | Manual cleanup script: list Vercel domains → diff với Payload → remove orphans |
| 9.3 | Data | Duplicate `vercelDomainId` giữa 2 tenant (race condition) | Critical | Payload uniqueness check `customDomains.domain` trên TẤT CẢ tenants (existing L46-54). Verify giữ nguyên |
| 9.4 | Data | `vercelVerification` JSON field encoding mismatch (UTF-8 vs binary) | Low | Payload JSON field handle UTF-8 native |
| 9.5 | Data | Concurrent schema migration (Payload generate:types chạy trong khi action đang xử lý) | Low | Payload v3 array fields schemaless, không lock |
| 9.6 | Data | `vercelDomainId` lưu sai format (e.g., id thay vì name) | High | Phase 02 quyết định lưu `name` (LOCKED). Test assert format |
| 9.7 | Data | Payload row `customDomains` empty array sau backfill (data loss) | Critical | Backfill chỉ UPDATE specific row, không touch others; idempotent |

### 10. Integration (Vercel API)

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|---|---|---|---|
| 10.1 | Integration | Vercel API version mismatch (v9 deprecated, v10 mới) | High | Hard-code version trong wrapper; Phase 01 dùng v10/v9 theo researcher-01; CI integration test catch sớm |
| 10.2 | Integration | Vercel response thêm field mới (forward-compat) | Low | TS type optional, không destructure unknown |
| 10.3 | Integration | Vercel response bỏ field cũ (`verified` rename) | Critical | Unit test mock fail loud; alert; ship hotfix |
| 10.4 | Integration | Vercel webhook (vercel/route.ts) replay cũ với domain đã xóa | Medium | Webhook handler idempotent; check current state trước khi action |
| 10.5 | Integration | Third-party DNS provider chậm propagate (Cloudflare 24h) | High | UI banner "DNS may take up to 48h"; tenant retry; backfill skip soft-fail |
| 10.6 | Integration | Vercel API rate limit thấp hơn document (60/min thay vì 100/hr) | High | Wrapper respect `Retry-After`; backfill sleep dynamic |
| 10.7 | Integration | psl package outdated (TLD mới chưa support) | Low | Soft-warn fallback; Vercel vẫn là source of truth |

---

## Summary

| Severity | Count |
|---|---|
| **Critical** | 14 |
| **High** | 21 |
| **Medium** | 14 |
| **Low** | 10 |
| **Total** | **59 scenarios across 9 dimensions** |

---

## Top 5 Critical scenarios cần address TRƯỚC implementation

1. **5.1 — Vercel success → Payload FAIL → orphan Vercel domain** (NEW edge case, chưa có trong plan)
   - **Action:** Phase 03 cần thêm reverse rollback: try `removeProjectDomain` nếu Payload write fail. Update phase-03-rewrite-server-actions.md.

2. **8.1 — Cross-tenant verify call** (security)
   - **Action:** Phase 03 audit `verifyCustomDomain` — confirm query Payload với `tenantId AND domain` chứ không chỉ `domain`. Hiện tại code L301-310 đã có `tenantId` scope nhưng cần explicit unit test.

3. **2.8 — SSRF attempt qua domain input**
   - **Action:** Phase 03 strict regex (existing L36) — verify pattern không cho phép `#`, `?`, `@`, `:`. Add unit test với 5 SSRF payloads.

4. **3.2 — 2 tenant đồng thời add cùng domain (race)**
   - **Action:** Phase 03 đã có Payload uniqueness check (L46-54). Confirm Vercel 409 cũng được catch + map sang user-friendly error.

5. **9.7 — Backfill ghi đè customDomains array gây data loss**
   - **Action:** Phase 06 backfill chỉ update specific element trong array, KHÔNG replace toàn bộ array. Add Payload `update` với selective field path.

---

## Recommended actions

| Action | Phase | Effort |
|---|---|---|
| Add reverse rollback (5.1) | Phase 03 | +15min |
| Add cross-tenant verify guard test (8.1) | Phase 05 | +10min |
| Add SSRF input fuzz tests (2.8) | Phase 05 | +15min |
| Add Vercel 409 → friendly error mapping (3.2) | Phase 03 | +10min |
| Selective array update in backfill (9.7) | Phase 06 | +20min |
| Add IDN/punycode normalization (2.3, 2.4) | Phase 03 | +20min |
| Stream tenants in backfill cho scale (7.7) | Phase 06 | +15min |
| Add `removeProjectDomain` 5xx handling (5.6) | Phase 03 | +5min |

**Total additional effort:** ~1.8h — cập nhật plan effort 7.5h → **9.3h**.

---

## Open questions

- **Q1**: `verifyCustomDomain` hiện đang query Payload bằng `tenantId AND customDomains.domain = X` hay chỉ `customDomains.domain = X`? Cross-tenant attack vector phụ thuộc vào điều này. → Phase 03 audit ngay đầu.
- **Q2**: Có nên thêm `audit_log` collection cho domain operations (compliance future)? → Defer follow-up issue.
- **Q3**: Backfill có nên cron schedule vs one-shot? → One-shot acceptable, idempotent. Nếu prod tenants nhiều có thể chuyển cron.
- **Q4**: Webhook handler `vercel/route.ts` hiện đang xử lý event gì? Có conflict với new flow không? → Phase 01 audit nhanh.
