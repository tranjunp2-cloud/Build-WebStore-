---
title: "Phase 1 — User Activity Logs"
phase: 1
status: pending
effort: M (~4–5 days)
branch: feat/F15-01-activity-logs
created: 2026-04-15
---

# Phase 1 — User Activity Logs

## Context links

- Plan index: [plan.md](./plan.md)
- Reference collection: `src/collections/AiUsageLogs.ts`
- Migration reference: `scripts/db-setup.js` → `ai_usage_logs.create_table` block
- Auth helper: `src/lib/auth.ts` (`withAuth` wrapper)
- Broadcast API (super-admin route pattern): `src/app/api/admin/broadcasts/route.ts`

## Overview

There is currently no audit trail in the system. When something goes wrong
(unauthorized access, data corruption, suspicious activity), there is no way to
reconstruct what happened. This phase introduces a lightweight, append-only
`activity_logs` table tracked via Payload `afterChange` hooks and a dedicated
Payload collection for admin inspection.

## Key Insights

- `AiUsageLogs` is the closest existing pattern — fire-and-forget writes, no
  write access via API, super-admin read only. Follow the same pattern.
- Payload hooks fire server-side, giving us actor identity (`req.user`) and the
  document state before/after. We do NOT need a separate middleware layer.
- The table must be `serial` id (not UUID) because it is NOT a Payload array
  sub-table — it is a standalone collection with integer PK, matching the
  `ai_usage_logs` pattern.
- IP address and userAgent must be read from `req.headers` at hook time
  (not available later).
- `metadata` stored as JSONB — avoids schema migrations for new action types.
- We do NOT log read operations (too noisy, no security value here). Log only
  mutations + auth events.

## Requirements

### Functional
- FR1: System records an entry whenever a user logs in, logs out, fails login, or resets password.
- FR2: System records afterChange mutations on Users, Tenants, Products, Orders,
  Sites, Pages collections (create / update / delete operations).
- FR2a: System records AI events: ai_generate_site (success), ai_generate_site_failed
  (with detailed error_code in metadata), ai_edit_block, ai_rewrite_text,
  ai_generate_seo, ai_generate_blog, ai_product_description, ai_bulk_parse,
  ai_extract_from_url, ai_apply_template.
- FR2b: System records website events: site_publish, site_unpublish, site_save.
- FR2c: System records staff & account events: invite_staff, remove_staff,
  account_reset, plan_change.
- FR3: Super-admin can query logs via `GET /api/admin/activity-logs` with filters:
  `userId`, `action`, `tenantId`, `dateFrom`, `dateTo`, `page`, `limit`.
- FR4: Admin UI data table shows: timestamp, actor (name + email), action,
  resource, resourceId, tenantId, IP, with pagination and column filters.
- FR5: Logs are append-only — no update or delete via the public API.

### Non-functional
- NFR1: Log writes are fire-and-forget — a failed log write MUST NOT break the
  originating request (same pattern as `logAiUsage()`).
- NFR2: The `GET` endpoint must respond in < 500 ms at p95 for up to 1 M rows
  (covered by indexes on `created_at`, `user_id`, `action`, `tenant_id`).
- NFR3: No PII beyond what is already in the Users collection (no passwords,
  no OTP codes, no raw request bodies).

## Architecture

### DB table: `activity_logs`

```sql
CREATE TABLE IF NOT EXISTS activity_logs (
  id          serial PRIMARY KEY,
  actor_id    integer,                        -- users.id (nullable: system actions)
  action      varchar NOT NULL,               -- see enum below
  resource    varchar,                        -- collection slug e.g. 'products'
  resource_id varchar,                        -- document id (varchar covers both int & uuid)
  tenant_id   integer,                        -- tenants.id (nullable)
  metadata    jsonb DEFAULT '{}',             -- arbitrary context (old value, diff, reason)
  ip_address  varchar(45),                    -- IPv4 or IPv6
  user_agent  text,
  created_at  timestamptz DEFAULT now() NOT NULL
);
```

Action enum (stored as varchar, extensible without migration):

Auth events:
`login` | `logout` | `login_failed` | `password_reset`

Mutation events (trên Users, Tenants, Products, Orders, Sites, Pages, Blogs, BlogCategories):
`create` | `update` | `delete`

AI events:
`ai_generate_site` | `ai_generate_site_failed` | `ai_edit_block` |
`ai_rewrite_text` | `ai_generate_seo` | `ai_generate_blog` |
`ai_product_description` | `ai_bulk_parse` | `ai_extract_from_url` |
`ai_apply_template`

ai_generate_site_failed metadata.error_code values:
- `VALIDATION_ERROR` (400) — form input không hợp lệ
- `UNAUTHORIZED` (401) — chưa đăng nhập / token hết hạn
- `PAYMENT_REQUIRED` (402) — đã gen 1 lần, không cho gen lại
- `CONTENT_UNSAFE` (400) — nội dung nhạy cảm / NSFW
- `RATE_LIMIT` (429) — gửi request quá nhanh
- `TIMEOUT` (500) — OpenAI API quá chậm (>300s)
- `AI_API_ERROR` (500) — OpenAI trả lỗi (overloaded, maintenance)
- `AI_PARSE_ERROR` (500) — AI trả JSON không hợp lệ
- `AI_API_KEY_INVALID` (500) — API key sai hoặc hết quota
- `DB_SAVE_FAILED` (500) — lưu site/pages vào DB thất bại
- `TENANT_CREATE_FAILED` (500) — tạo tenant tự động thất bại
- `SSE_DISCONNECT` (0) — mất kết nối giữa chừng streaming
- `PARTIAL_SUCCESS` — tạo được >=1 page nhưng lỗi giữa chừng

Website editor events:
`site_publish` | `site_unpublish` | `site_save` | `page_update` | `page_delete` |
`seo_fix` | `seo_fix_all` | `seo_auto_meta_toggle`

site_save metadata.changes_summary (diff trước/sau khi save):
- blocks_reordered: boolean — kéo thả đổi vị trí block
- blocks_added: string[] — blockType mới thêm
- blocks_removed: string[] — blockType bị xóa
- blocks_modified: string[] — blockType có nội dung thay đổi (text, images, links)
- theme_changed: boolean — đổi màu, font, style
- header_changed: boolean — sửa navigation header
- footer_changed: boolean — sửa footer
- site_name_changed: boolean — đổi tên website
- contact_info_changed: boolean — sửa thông tin liên hệ
- social_links_changed: boolean — sửa social media links
- branding_changed: boolean — sửa logo/branding
- seo_changed: boolean — sửa SEO metadata

Kỹ thuật: PATCH /api/sites/[siteId]/save nhận toàn bộ blocks array.
Trước khi update, đọc state hiện tại → diff → ghi changes_summary vào metadata.
Nếu diff quá nặng, fallback ghi: blocks_count_before, blocks_count_after, fields_changed[].

Domain & slug events:
`slug_change` | `domain_add` | `domain_remove`

Staff & account events:
`invite_staff` | `remove_staff` | `account_reset` | `plan_change` | `sso_status_change`

sso_status_change metadata:
- old_status: 'activated' | 'inactivated' | 'terminated'
- new_status: 'activated' | 'inactivated' | 'terminated'
- impact: affected_staff_count, website_unpublished (boolean)

Deferred (chưa implement):
~~`suspend`~~ | ~~`unsuspend`~~ | ~~`impersonate`~~

### Payload Collection: `ActivityLogs`

File: `src/collections/ActivityLogs.ts`

```
access:
  read:   super-admin only
  create: false  (written via logActivity() helper, never via Payload API)
  update: false
  delete: super-admin only (for GDPR erasure only)

fields:
  actor          relationship → users
  action         select (enum above)
  resource       text
  resourceId     text
  tenant         relationship → tenants
  metadata       json
  ipAddress      text
  userAgent      text
  timestamps:    true (createdAt only; no updatedAt needed)
```

### Helper: `src/lib/audit/log-activity.ts`

```typescript
export async function logActivity(params: {
  payload: Payload
  actorId?: number
  action: ActivityAction
  resource?: string
  resourceId?: string | number
  tenantId?: number
  metadata?: Record<string, unknown>
  req?: PayloadRequest  // used to extract ip + userAgent
}): Promise<void>
```

Fire-and-forget — always wraps the `payload.create()` in `.catch(() => {})`.
Extracts IP from `x-forwarded-for` → `x-real-ip` → `req.socket.remoteAddress`.

### Payload hooks (afterChange)

Add to: `Users`, `Tenants`, `Products`, `Orders`, `Sites`, `Pages`, `Blogs`, `BlogCategories` collections.

```typescript
// Example — Users afterChange
afterChange: [
  async ({ doc, operation, req }) => {
    logActivity({
      payload: req.payload,
      actorId: req.user?.id,
      action: operation === 'create' ? 'create' : 'update',
      resource: 'users',
      resourceId: doc.id,
      tenantId: req.user?.tenants?.[0]?.tenant?.id,
      req,
    }).catch(() => {})
    return doc
  }
]
```

For delete operations, use `afterDelete` hook (same pattern).

### Login/logout hooks

Payload exposes `afterLogin` and `afterLogout` collection-level hooks on the
`users` collection. Add entries there — no separate middleware needed.

```typescript
afterLogin:  [logLoginHook]   // action: 'login'
afterLogout: [logLogoutHook]  // action: 'logout'
// Failed login: use afterError on auth endpoint or afterOperation hook
```

### API: `GET /api/admin/activity-logs`

File: `src/app/api/admin/activity-logs/route.ts`

Auth: `withAuth` → super-admin role guard (same as broadcasts route).

Query params:
- `userId` (number)
- `action` (string)
- `tenantId` (number)
- `dateFrom` / `dateTo` (ISO 8601)
- `page` (default 1) / `limit` (default 50, max 200)

Response:
```json
{
  "docs": [...],
  "totalDocs": 4200,
  "page": 1,
  "totalPages": 84
}
```

Uses `payload.find()` with `where` clause — no raw SQL needed.

### Admin UI

File: `src/app/(dashboard)/admin/activity-logs/page.tsx`

- Shadcn `DataTable` (reuse existing pattern from products/orders list pages)
- Column filters: action (multi-select), date range picker, user search
- Pagination: server-side (calls the API route above)
- Row detail: expand to show `metadata` JSON tree

## Related code files

- `src/collections/AiUsageLogs.ts` — structural template
- `src/lib/ai/log-usage.ts` — fire-and-forget helper pattern
- `src/app/api/admin/broadcasts/route.ts` — super-admin route guard pattern
- `src/lib/auth.ts` — `withAuth` wrapper
- `src/collections/Users.ts` — hooks target (afterChange, afterLogin, afterLogout)
- `src/collections/Tenants.ts` — hooks target
- `src/collections/Orders.ts` — hooks target
- `src/collections/Products.ts` — hooks target
- `src/collections/Sites.ts` — hooks target
- `src/collections/Pages.ts` — hooks target
- `src/app/api/ai/generate-site/route.ts` — AI log target (ai_generate_site + ai_generate_site_failed)
- `src/app/api/ai/edit-block/route.ts` — AI log target
- `src/app/api/ai/rewrite-text/route.ts` — AI log target
- `src/app/api/ai/seo-generate/route.ts` — AI log target
- `src/app/api/ai/generate-blog/route.ts` — AI log target
- `src/app/api/ai/product-description/route.ts` — AI log target
- `src/app/api/ai/products-bulk-parse/route.ts` — AI log target
- `src/app/api/ai/extract-from-url/route.ts` — AI log target
- `src/app/api/ai/apply-template/route.ts` — AI log target
- `src/app/api/sites/[siteId]/publish/route.ts` — website log target (site_publish + site_unpublish)
- `src/app/api/sites/[siteId]/save/route.ts` — website log target (site_save with changes_summary diff)
- `src/app/api/sites/[siteId]/pages/[pageId]/route.ts` — page management log target (page_update, page_delete)
- `src/app/api/seo/fix/route.ts` — SEO log target (seo_fix)
- `src/app/api/seo/fix-all/route.ts` — SEO log target (seo_fix_all)
- `src/app/api/seo/apply-fixes/route.ts` — SEO log target (seo_fix)
- `src/app/api/seo/auto-meta-toggle/route.ts` — SEO log target (seo_auto_meta_toggle)
- `src/app/api/tenant/slug/route.ts` — domain log target (slug_change)
- `src/collections/Blogs.ts` — hooks target (blog create/update/delete)
- `src/collections/BlogCategories.ts` — hooks target (blog category create/update/delete)
- `src/app/(dashboard)/dashboard/settings/ResetAccountCard.tsx` — account_reset log target
- `scripts/db-setup.js` — migration executor (MIGRATIONS array)

## Implementation Steps

1. **Migration** — add `activity_logs.create_table` + 4 index entries to
   `scripts/db-setup.js` MIGRATIONS array (see SQL above).
2. **Collection** — create `src/collections/ActivityLogs.ts`.
3. **Register** — add `ActivityLogs` to `src/payload.config.ts` collections array.
4. **Helper** — create `src/lib/audit/log-activity.ts`.
5. **Hooks (collections)** — add `afterChange` + `afterDelete` to Users, Tenants, Products, Orders, Sites, Pages.
6. **Auth hooks** — add `afterLogin` / `afterLogout` to Users collection.
7. **AI hooks** — add `logActivity()` calls to:
   - `src/app/api/ai/generate-site/route.ts` (ai_generate_site + ai_generate_site_failed with error_code)
   - `src/app/api/ai/edit-block/route.ts` (ai_edit_block)
   - `src/app/api/ai/rewrite-text/route.ts` (ai_rewrite_text)
   - `src/app/api/ai/seo-generate/route.ts` (ai_generate_seo)
   - `src/app/api/ai/generate-blog/route.ts` (ai_generate_blog)
   - `src/app/api/ai/product-description/route.ts` (ai_product_description)
   - `src/app/api/ai/products-bulk-parse/route.ts` (ai_bulk_parse)
   - `src/app/api/ai/extract-from-url/route.ts` (ai_extract_from_url)
   - `src/app/api/ai/apply-template/route.ts` (ai_apply_template)
8. **Website hooks** — add `logActivity()` calls to:
   - `src/app/api/sites/[siteId]/publish/route.ts` (site_publish + site_unpublish)
   - `src/app/api/sites/[siteId]/save/route.ts` (site_save)
9. **Staff & account hooks** — add `logActivity()` calls to:
   - Staff invite API (invite_staff)
   - Staff remove API (remove_staff)
   - `src/app/api/account/reset` (account_reset)
10. **API route** — create `src/app/api/admin/activity-logs/route.ts`.
11. **UI page** — create `src/app/(admin-panel)/activity-logs/page.tsx`.
12. **Navigation** — add link in admin sidebar under admin section.
13. **Tests** — unit tests for `logActivity()` helper + API route integration test.
14. **Validation** — run `node scripts/check-migrations.js origin/staging`.

## Todo list

- [ ] Add migration block to `scripts/db-setup.js`
- [ ] Create `src/collections/ActivityLogs.ts`
- [ ] Register in `src/payload.config.ts`
- [ ] Create `src/lib/audit/log-activity.ts` helper
- [ ] Add hooks to `src/collections/Users.ts` (afterChange, afterDelete, afterLogin, afterLogout)
- [ ] Add hooks to `src/collections/Tenants.ts`
- [ ] Add hooks to `src/collections/Products.ts`
- [ ] Add hooks to `src/collections/Orders.ts`
- [ ] Add hooks to `src/collections/Sites.ts`
- [ ] Add hooks to `src/collections/Pages.ts`
- [ ] Add hooks to `src/collections/Blogs.ts`
- [ ] Add hooks to `src/collections/BlogCategories.ts`
- [ ] Add logActivity() to AI API routes (9 files: generate-site, edit-block, rewrite-text, seo-generate, generate-blog, product-description, products-bulk-parse, extract-from-url, apply-template)
- [ ] Add logActivity() to website editor API routes (publish, unpublish, save with changes_summary diff)
- [ ] Add logActivity() to page management API (sites/[siteId]/pages/[pageId] → page_update, page_delete)
- [ ] Add logActivity() to SEO API routes (seo/fix, seo/fix-all, seo/apply-fixes, seo/auto-meta-toggle)
- [ ] Add logActivity() to domain/slug APIs (tenant/slug → slug_change, Tenants hook → domain_add/remove)
- [ ] Add logActivity() to staff & account APIs (invite-staff, remove-staff, account-reset)
- [ ] Create `src/app/api/admin/activity-logs/route.ts`
- [ ] Create `src/app/(admin-panel)/activity-logs/page.tsx`
- [ ] Write unit tests (TC-F15-01-xx)
- [ ] Run `node scripts/check-migrations.js origin/staging`
- [ ] PR: `feat/F15-01-activity-logs` → staging

## Success Criteria

- SC1: Every login/logout/mutation on Users, Tenants, Products, Orders creates a row
  in `activity_logs` within the same request cycle.
- SC2: A failing log write does not cause a 5xx on the originating request.
- SC3: `GET /api/admin/activity-logs` returns paginated results in < 500 ms for
  a dataset of 100 k rows with userId + dateRange filters.
- SC4: Non-super-admin users receive 403 from the API endpoint.
- SC5: Admin UI data table renders, filters, and paginates correctly.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hook performance degrades request latency | Low | Medium | Fire-and-forget with `.catch()` — DB write is async |
| Log table grows unbounded | Medium | Low | Add created_at index; plan retention cron in Phase 3 |
| IP spoofing via X-Forwarded-For | Medium | Low | Log as-is; not used for access control, only audit trail |
| Missing hooks on new collections added later | Medium | Medium | Document pattern in CLAUDE.md; add lint rule in future |

## Security Considerations

- Log writes use internal `payload.create()` — not exposed as a public write endpoint.
- `metadata` JSON must never contain passwords, OTP codes, or Stripe secrets.
  Helper validates against a blocklist of sensitive field names before writing.
- IP is stored for audit purposes only, not for rate limiting or access control.
- Super-admin read access to logs follows the existing RBAC pattern
  (`req.user?.roles?.includes('super-admin')`).

## Next steps

After Phase 1 merges to staging:
- Phase 2 (User Management) can start immediately — it consumes the activity log
  API for the inline timeline view on the user detail page.
- Consider adding a `retention_days` config per action type in a follow-up PR.
