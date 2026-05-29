---
title: "F32 — Email Template CMS Settings"
description: "Per-tenant transactional email customization (subject/greeting/CTA/closing + toggle + realtime preview) in dashboard settings"
status: pending
priority: P2
effort: 16h
branch: feat/F32-email-cms-settings
tags: [f32, email, cms, multi-tenant, settings]
created: 2026-05-26
---

# F32 — Email Template CMS Settings

Let sellers customize transactional emails (4 fields: subject, greeting, ctaLabel, closing) + toggle on/off + server-side realtime preview, scoped per-tenant, per-template-type, per-recipient (buyer/seller). EN required, MS optional (fallback EN). Backward compatible: no config row → hardcoded defaults unchanged.

## Context Links

- PRD: `docs/prd/F32-email-template-cms-settings.md`
- Design: `docs/design/F32-email-template-settings-design.md`
- Old plan (reference, superseded): `plans/260521-1349-f32-email-cms-settings/plan.md`
- Rules: `.claude/rules/database-schema.md`, `.claude/rules/email-smtp.md`

## Locked Decisions (corrections vs context)

| Decision | Value | Note |
|----------|-------|------|
| Tenant FK | `tenant_id integer REFERENCES tenants(id)` | **CORRECTION**: context said `sites(id)`. Codebase tenant scope = `tenants`, accessed via `getCurrentTenantId()`. |
| Permission | reuse `'settings'` | **YAGNI**: `PermissionId` is a closed union (`products\|orders\|blog\|builder\|settings`). New `email_settings` perm would force editing type + role-assignment UI. MVP reuses `settings`. Note as future Phase-2 split. |
| Cache | Upstash Redis (reuse `@upstash/redis` client from `src/lib/rateLimit.ts`) + in-memory fallback | TTL 300s. `src/lib/cache.ts` is in-memory only — do NOT use for distributed. |
| Variable syntax | `{varName}` single brace | Hint text Phase 1 (no dropdown). |
| Preview | server-side API route + 300ms debounce, fake fixtures | No real-data pull. |
| Template scope | 15 existing files | contact/newsletter/order-delivered/order-failed/payment-timeout do NOT exist as files — enum-only/deferred, not implemented Phase 1. |
| Migration table | `serial` id, `timestamptz`, UNIQUE index | Top-level table convention (see `categories`/`seo_meta_jobs`). |

## Data Flow

```
Seller edits form → server action validates + payload.update(email-template-settings)
                  → afterChange hook → cacheDelete(redis key)
Email send path:  sendEmail({templateType, recipient, tenantId, ...})
                  → getTemplateConfig(tenant,type,recipient) [redis 5min → DB → null]
                  → template(data, config?) → mergeTemplateConfig(t, config) → {subject, html}
                  → payload.sendEmail()
Preview:          client (debounced) → POST /api/email-preview {templateType, recipient, locale, draftConfig}
                  → render template(fixture, draftConfig) → return html (NO db write, NO send)
```

## Phases

| # | Phase | Status | Effort | Blocks |
|---|-------|--------|--------|--------|
| 01 | [Foundation: Collection + DB Migration](phase-01-foundation-collection-migration.md) | pending | 3h | — |
| 02 | [Lookup Helper + Send Integration](phase-02-lookup-helper-send-integration.md) | pending | 3h | 01 |
| 03 | [Admin UI: List + Form + Preview](phase-03-admin-ui-form-preview.md) | pending | 5h | 01, 02 |
| 04 | [Template Render Refactor (15 templates)](phase-04-template-render-refactor.md) | pending | 3h | 02 |
| 05 | [Tests + Docs](phase-05-tests-docs.md) | pending | 2h | 01-04 |

## Dependency Graph

```
01 ──┬──> 02 ──┬──> 03
     │         └──> 04
     └──────────────────> (03 also needs 04's mergeTemplateConfig for preview)
01,02,03,04 ──> 05
```

03 preview pane depends on 04's `mergeTemplateConfig` + refactored templates. Run 02 → 04 → 03 sequentially, OR build 03 UI shell first then wire preview after 04. Recommended order: 01 → 02 → 04 → 03 → 05.

## File Ownership (no parallel collision)

- Phase 01: `src/collections/*`, `src/payload.config.ts`, `scripts/db-setup.js`, `src/lib/email/types.ts`
- Phase 02: `src/lib/email/{get-template-config,merge-template-config,send}.ts`
- Phase 04: `src/lib/email/templates/*.ts`
- Phase 03: `src/app/(dashboard)/settings/email-templates/**`, `src/app/api/email-preview/route.ts`, `src/components/dashboard/Sidebar.tsx`, `src/components/editor/EditorMenuDrawer.tsx`
- Phase 05: `src/__tests__/**`, `docs/{qa,architecture}/F32-*.md`

02 and 04 both touch `src/lib/email/` but disjoint files — safe. 03 imports from 02/04 (read-only).

## Success Criteria (plan-level)

- Seller can edit + save + toggle email config; reload persists.
- Email send uses custom config when present, hardcoded default when absent (verified backward compat).
- Tenant A cannot read/write Tenant B config (multi-tenant isolation test passes).
- Preview renders without DB write or actual email send.
- `node scripts/check-migrations.js origin/staging` passes.
- All new tests pass (`npm test`), no fake data/mocks-to-pass.

## Unresolved Questions

See each phase. Top-level: confirm whether contact/newsletter templates are in F32 scope (currently deferred — no files exist).
