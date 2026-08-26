# QA Test Cases — GH-1535: k6 smoke — 4 server bugs + minor findByID

> **Scope:** Issue #1535 (branch `fix/1535-smoke-server-bugs`, PR #1597).
> Registry cho toàn bộ TC-ID `TC-GH1535-*`. Bug phát hiện qua k6 smoke test (2026-07-08) trên staging.

---

## 1. Context

Smoke test k6 (18 màn / 153 endpoint) phát hiện 4 bug server P0 + 1 minor: endpoint trả sai HTTP status (500 do lỗi client/data) hoặc mark-read timeout do per-row update. Fix: trả đúng status (400/404/409), batch UPDATE, harden input.

**Root cause chung:** lỗi client/data (id sai kiểu, role ngoài enum, field required trống, int overflow) rơi vào catch chung → 500 thay vì 4xx; và per-row `payload.update` loop gây nghẽn Neon pool.

## 2. Test Cases (automated)

| ID | Test file | Tiêu đề | Mức độ |
|:---|:---|:---|:---:|
| TC-GH1535-01a | `src/__tests__/api/users-role-filter.test.ts` | `roles` filter value ngoài enum (buyer/staff/numeric) → APIError 400 (không 500 enum crash); phủ `in/not_in/equals`, nested and/or, mixed valid+invalid | Blocker |
| TC-GH1535-01b | `src/__tests__/api/users-role-filter.test.ts` | `roles` filter hợp lệ pass-through (in/equals/exists, không roles filter, where-less) — không 400 nhầm | Blocker |
| TC-GH1535-01c | `src/__tests__/api/users-role-filter.test.ts` | Operator không hỗ trợ trên cột enum (like/contains) → 400 (không để Postgres 42883 → 500) | High |
| TC-GH1535-02a | `src/__tests__/api/notifications.test.ts` | mark_all: 1 batched UPDATE scope `user_id + tenant_id` (no IDOR) — assert bound params qua PgDialect | Blocker |
| TC-GH1535-02b | `src/__tests__/api/notifications.test.ts` | notificationIds: UPDATE scope `user_id + tenant_id = ANY(all user tenants)` — assert bound params | Blocker |
| TC-GH1535-02c | `src/__tests__/api/notifications.test.ts` | notificationIds ngoài int4 range (2147483648) bị loại → không overflow 500; id hợp lệ vẫn chạy | High |
| TC-GH1535-04a | `src/__tests__/integration/customers-export.test.ts` | Tenant ids bind dạng pg array literal `'{1,2}'` (không JS array → malformed array literal 500) — assert bound param thật | Blocker |
| TC-GH1535-04b..d | `src/__tests__/integration/customers-export.test.ts` | Multi-tenant / single-tenant / super-admin no-filter export — không 500 | High |
| TC-GH1535-05a | `src/__tests__/api/admin-templates-get.test.ts` | GET id thiếu (numeric) → 404 (disableErrors); id non-numeric → 404 **không chạm DB** (numeric guard chặn 22P02 cast → 500) | Blocker |
| TC-GH1535-05b | `src/__tests__/api/admin-templates-get.test.ts` | GET id hợp lệ → 200 + `disableErrors:true` | High |
| TC-GH1535-05d | `src/__tests__/api/admin-templates-get.test.ts` | PATCH id non-numeric → 404 không chạm DB | High |
| TC-GH1535-05e | `src/__tests__/api/admin-templates-get.test.ts` | PATCH id thiếu (numeric) → NotFound map 404 (không 500) | High |

**Bug 3 (sites publish)** dùng test có sẵn `src/__tests__/api/publish.test.ts`:

| ID | Tiêu đề | Mức độ |
|:---|:---|:---:|
| TC-F01-pub-10 | Partial publish do ValidationError (field nested required trống) → **409** + `failures[].validationErrors` | Blocker |
| TC-F01-pub-11 | Partial publish do server fault (TypeError, không validationErrors) → giữ **500** (không mù 5xx monitoring) | Blocker |

## 3. Manual Verification Checklist (QC re-test trên staging)

- [ ] `GET /api/users?where[roles][in][]=buyer` (auth tenant-owner) → **400** (không 500); `where[roles][in][]=tenant-owner` → 200; `where[roles][exists]=true` → 200; `where[roles][like]=editor` → 400.
- [ ] `POST /api/notifications/mark-read {mark_all:true}` → trả nhanh (<1s), `updated` = số unread thật; user/tenant khác không bị đụng.
- [ ] `PATCH /api/sites/{id}/publish` site có page thiếu field required → **409** + `failures[].validationErrors` chỉ rõ field; site sạch → 200.
- [ ] `GET /api/v1/customers/export` header `Authorization: JWT <token>` → **200** CSV (không 500).
- [ ] `GET /api/admin/templates/999999` → **404**; `/api/admin/templates/abc` → **404** (không 500); `PATCH` tương tự.

## 4. Ops follow-up (ngoài scope PR — không phải code)

- Bug 4 **cookie-401** `/customers/export`: align `PAYLOAD_SECRET`/`SSO_SHARED_SECRET` giữa service mint & serve (secret mismatch, không phải bug route).
- Bug 3: để page rác publish được = sửa DATA (điền field required trống) + hygiene orphan `_pages_v` (`parent_id IS NULL`).
- `discounts/[id]` cùng family findByID → **#1572**.
