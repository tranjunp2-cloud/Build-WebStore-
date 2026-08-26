# Phase 01 — Foundation: Collection + DB Migration

## Context Links
- `.claude/rules/database-schema.md` (migration convention, CI gate)
- `src/collections/Sites.ts` (multi-tenant access pattern — relationship to `tenants`)
- `scripts/db-setup.js` MIGRATIONS array (lines 65+), top-level table example: `categories` (line 342), `seo_meta_jobs` (line 357)

## Overview
- **Priority:** P2 — blocker for all other phases
- **Status:** pending
- **Description:** Create `email-template-settings` Payload collection + DB migration + shared types. Establishes the data model: one row per (tenant, templateType, recipient).

## Key Insights
- **Tenant FK = `tenants`, NOT `sites`.** Access filter mirrors `Sites.ts` but on `tenant` relationship. `getCurrentTenantId()` returns the tenant id.
- Top-level table → `serial` id + `timestamptz` (NOT array/select-table convention).
- Collection slug `email-template-settings` MUST be added to `COLLECTION_SLUGS[]` in db-setup.js.
- ALTER TABLE ADD COLUMN IF NOT EXISTS fallbacks required per column (pushDevSchema may create skeleton table first — see database-schema.md "Why this exists").

## Requirements
**Functional**
- Store per-tenant config: enabled flag + 4 EN fields + 4 MS fields, keyed by templateType + recipient.
- Enforce UNIQUE (tenant_id, template_type, recipient).
- `updated_by` tracks last editor.

**Non-functional**
- Multi-tenant read/write isolation enforced at collection access layer.
- CI migration gate passes.

## Architecture

Collection `email-template-settings` fields:
- `tenant` relationship → `tenants` (required, index)
- `templateType` select (enum, see types.ts) (required)
- `recipient` select: `buyer` | `seller` (required)
- `enabled` checkbox (default true)
- `contentEn` group: `subject` (text, max 200), `greeting` (textarea), `ctaLabel` (text, max 100), `closing` (textarea)
- `contentMs` group: same 4 fields
- `updatedBy` relationship → `users` (readOnly, sidebar)
- timestamps: true

Access control (copy `Sites.ts` shape, swap field name to `tenant`):
- create/read/update/delete: super-admin → true; else `{ tenant: { in: tenantIds } }`; no tenants → false.

## Related Code Files
**Create**
- `src/collections/EmailTemplateSettings.ts`
- `src/lib/email/types.ts` — `EmailTemplateType` union/enum, `EmailRecipient`, `EmailTemplateConfig` type, `EMAIL_TEMPLATE_TYPES[]` array (drives select options + UI list), `EMAIL_TEMPLATE_VARIABLES` map (templateType → allowed `{var}` names, for hint text).

**Modify**
- `src/payload.config.ts` — import + register `EmailTemplateSettings` in `collections[]`
- `scripts/db-setup.js` — add migration(s) + add `'email-template-settings'` to `COLLECTION_SLUGS[]`

## types.ts contract (drives Phases 02/03/04)
```ts
export type EmailRecipient = 'buyer' | 'seller'

// 15 implemented + deferred placeholders (enum-only, no file yet)
export const EMAIL_TEMPLATE_TYPES = [
  'welcome', 'otp-verification', 'forgot-password', 'password-changed',
  'order-confirmation', 'order-status', 'order-cancelled', 'order-shipped',
  'order-expired', 'new-order-seller', 'bank-transfer-instructions',
  'payment-confirmed', 'payment-rejected', 'resend-upload-link', 'staff-invitation',
] as const
export type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[number]

export interface EmailTemplateConfig {
  enabled: boolean
  subject?: string
  greeting?: string
  ctaLabel?: string
  closing?: string
}

// templateType → recipient(s) it applies to (UI tab gating)
export const EMAIL_TEMPLATE_RECIPIENTS: Record<EmailTemplateType, EmailRecipient[]>
// templateType → available variable names for hint text, e.g. ['userName','dashboardUrl']
export const EMAIL_TEMPLATE_VARIABLES: Record<EmailTemplateType, string[]>
```
> Keep `types.ts` < 200 lines. If variable maps grow, split to `email-template-variables.ts`.

## Migration SQL (CORRECTED — references tenants, not sites)
```sql
CREATE TABLE IF NOT EXISTS email_template_settings (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_type varchar NOT NULL,
  recipient varchar NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  content_en_subject varchar(200),
  content_en_greeting text,
  content_en_cta_label varchar(100),
  content_en_closing text,
  content_ms_subject varchar(200),
  content_ms_greeting text,
  content_ms_cta_label varchar(100),
  content_ms_closing text,
  updated_by_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Separate migration entries (each its own MIGRATIONS object):
1. `email_template_settings.create_table` — above CREATE TABLE.
2. `email_template_settings.unique_idx` — `CREATE UNIQUE INDEX IF NOT EXISTS email_template_settings_tenant_type_recipient_uniq ON email_template_settings (tenant_id, template_type, recipient);`
3. `email_template_settings.tenant_idx` — `CREATE INDEX IF NOT EXISTS email_template_settings_tenant_idx ON email_template_settings (tenant_id);`
4. `email_template_settings.alter_columns` — ALTER TABLE ADD COLUMN IF NOT EXISTS for every column above (skeleton-table fallback).

## Implementation Steps
1. Create `src/lib/email/types.ts` with the contract above.
2. Create `src/collections/EmailTemplateSettings.ts` (slug `email-template-settings`). Use `useAsTitle: 'templateType'`. Access blocks copied from `Sites.ts` (swap to `tenant`). Group fields `contentEn`/`contentMs` → Payload generates `content_en_*`/`content_ms_*` columns (group convention). `updatedBy` field set via `beforeChange` hook = `req.user.id`.
3. Register in `src/payload.config.ts` collections array.
4. Add migration entries to `scripts/db-setup.js` MIGRATIONS (4 objects above) + add slug to `COLLECTION_SLUGS[]`.
5. Run `node scripts/db-setup.js` locally (against dev DB) to verify migration executes clean.
6. Run `node scripts/check-migrations.js origin/staging` — must pass.
7. `npx tsc --noEmit` (or project compile script) — no type errors.

## Todo List
- [ ] `src/lib/email/types.ts` created with enums + EmailTemplateConfig + variable map
- [ ] `EmailTemplateSettings.ts` collection with tenant access control
- [ ] `updatedBy` set via beforeChange hook
- [ ] Registered in payload.config.ts
- [ ] 4 migration entries in db-setup.js
- [ ] Slug added to COLLECTION_SLUGS[]
- [ ] Migration runs clean locally
- [ ] check-migrations.js passes
- [ ] tsc no errors

## Success Criteria
- `email_template_settings` table exists with correct columns + UNIQUE index.
- Can create a row via Payload local API scoped to a tenant; second insert with same (tenant,type,recipient) fails on UNIQUE.
- Tenant access control verified (Phase 05 integration test).
- CI migration gate green.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Group field → column name mismatch (Payload Drizzle) | Med | High | Verify generated column names match migration (`content_en_subject` etc.) via local push diff; add ALTER fallbacks. |
| Skeleton table created by pushDevSchema missing columns | Med | High | ALTER TABLE ADD COLUMN IF NOT EXISTS for each column (entry #4). |
| CI gate rejects new table | Low | High | Run check-migrations.js before PR. |
| FK to tenants ON DELETE CASCADE wipes config on tenant delete | Low | Low | Acceptable — config meaningless without tenant. |

## Security Considerations
- Access control filters by `tenant.in(userTenantIds)` — prevents IDOR. Mirror `Sites.ts` exactly (proven pattern, recently IDOR-hardened per commit `ca48da19`).
- `updatedBy` server-set only (beforeChange), never client-supplied.

## Next Steps
Unblocks Phase 02 (lookup) + Phase 04 (templates can import types). Phase 03 needs the collection slug for server actions.

## Unresolved Questions
- Confirm Payload group field generates flat `content_en_subject` columns vs nested JSON. If Payload stores group as separate columns (expected), migration matches. Verify at step 5.
