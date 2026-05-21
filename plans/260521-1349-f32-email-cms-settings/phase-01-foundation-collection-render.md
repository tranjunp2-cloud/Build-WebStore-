# Phase 01 — Foundation: Collection + Render Flow Hook

> Atomic foundation: create Payload collection + extend sendEmail() wrapper với config lookup hook (lookup logic chi tiết ở Phase 02).

## Context Links

- PRD: `docs/prd/F32-email-template-cms-settings.md` §8 (Data Model)
- Rule: `.claude/rules/database-schema.md` (migration convention)
- Existing pattern: `src/collections/Sites.ts`, `src/lib/email/send.ts`

## Overview

- **Priority:** P0 (blocker)
- **Status:** Pending
- **Depends on:** Commerce email rollout plan merged (16+ templates exist)

## Key Insights

- Collection `email-template-settings` cần unique index `(tenant, templateType, recipient)` — Payload không native support, dùng DB-level constraint via migration
- `sendEmail()` wrapper interface mở rộng để accept `templateType` + `recipient` + `tenantId` (cho lookup) — backward compat: nếu không pass, skip lookup (default behavior)
- Migration phải follow database-schema.md convention chính xác (serial id, parent_id no underscore)

## Requirements

### Functional

- Payload collection `EmailTemplateSettings` với fields theo PRD §8
- Migration entry trong `scripts/db-setup.js` MIGRATIONS array
- DB constraint: UNIQUE `(tenant_id, template_type, recipient)`
- `sendEmail()` accept optional `templateType?`, `recipient?`, `tenantId?` params
- Access control: `read` + `update` filtered by tenant (per multi-tenant pattern hiện có ở `Sites.ts`)

### Non-functional

- TypeScript strict types cho enum values (`templateType`, `recipient`)
- Validation Zod schemas cho input length limits (subject ≤ 200, body ≤ 2000)
- Migration idempotent (`CREATE TABLE IF NOT EXISTS`)

## Related Code Files

**Create:**
- `src/collections/EmailTemplateSettings.ts` — Payload collection definition
- `src/lib/validations/email-template-settings.ts` — Zod schemas (optional, tách logic)

**Modify:**
- `src/payload.config.ts` — register new collection
- `scripts/db-setup.js` — add migration entry
- `src/lib/email/send.ts` — extend interface với optional lookup params
- `src/collections/index.ts` (nếu có barrel)

## Implementation Steps

1. Đọc `src/collections/Sites.ts` để hiểu multi-tenant access pattern
2. Đọc `scripts/db-setup.js` MIGRATIONS array format
3. Create `EmailTemplateSettings.ts` với fields:
   - `tenant: relationship → sites`
   - `templateType: select` (enum 16+ values, future-extensible)
   - `recipient: select ['buyer', 'seller']`
   - `enabled: checkbox (default true)`
   - `contentEn: group { subject, greeting, ctaLabel, closing }`
   - `contentMs: group { ...same }`
   - `updatedBy: relationship → users`
4. Access control:
   ```ts
   access: {
       read: ({ req }) => filterByTenant(req.user),
       create: ({ req }) => isOwnerOrStaffWithPermission(req.user, 'email_settings'),
       update: ({ req }) => filterByTenant(req.user),
       delete: ({ req }) => false,  // soft-delete via disabled toggle
   }
   ```
5. Add migration entry với UNIQUE constraint:
   ```js
   {
       name: 'email_template_settings.create_table',
       sql: `CREATE TABLE IF NOT EXISTS email_template_settings (
           id serial PRIMARY KEY,
           tenant_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
           template_type varchar NOT NULL,
           recipient varchar NOT NULL,
           enabled boolean NOT NULL DEFAULT true,
           content_en_subject varchar,
           content_en_greeting text,
           content_en_cta_label varchar,
           content_en_closing text,
           content_ms_subject varchar,
           content_ms_greeting text,
           content_ms_cta_label varchar,
           content_ms_closing text,
           updated_by_id integer REFERENCES users(id),
           created_at timestamp NOT NULL DEFAULT now(),
           updated_at timestamp NOT NULL DEFAULT now(),
           UNIQUE (tenant_id, template_type, recipient)
       );`
   }
   ```
6. Register collection trong `payload.config.ts`
7. Extend `sendEmail()` interface (KHÔNG implement lookup logic ở phase này — chỉ accept params):
   ```ts
   interface SendEmailOptions {
       to: string
       subject: string
       html: string
       replyTo?: string
       templateType?: string   // NEW — for lookup ở Phase 02
       recipient?: 'buyer' | 'seller'   // NEW
       tenantId?: number   // NEW
   }
   ```
8. Run `node scripts/check-migrations.js origin/staging` → verify CI gate pass
9. Run `tsc --noEmit` → verify types clean
10. Manual: load Payload admin → verify new collection appears

## Todo List

- [ ] Read Sites.ts + db-setup.js patterns
- [ ] Create `EmailTemplateSettings.ts` collection
- [ ] Add migration entry với UNIQUE constraint
- [ ] Register collection trong payload.config.ts
- [ ] Extend sendEmail() interface (optional params, no logic change)
- [ ] CI migration check pass
- [ ] TypeScript compile clean
- [ ] Manual: collection visible trong Payload admin
- [ ] (No tests this phase — defer to Phase 02 cho lookup logic + Phase 05 cho integration)

## Success Criteria

- Collection visible trong Payload admin với 16+ template type options
- Migration runs clean trên fresh DB + idempotent trên existing DB
- `tsc --noEmit` pass
- CI `check-migrations.js` pass
- Sample manual create record qua admin → DB row inserted với UNIQUE constraint enforced

## Risk Assessment

- **Risk:** UNIQUE constraint conflict với existing seed data (nếu Phase 01 seed data trùng)
  - **Mitigation:** Phase 02 seeder dùng `INSERT ... ON CONFLICT DO NOTHING` idempotent
- **Risk:** Enum templateType phải khớp chính xác với template file names → typo causes runtime mismatch
  - **Mitigation:** Export enum constant từ `src/lib/email/templates/index.ts`, import vào cả collection + render code
- **Risk:** Tenant ondelete CASCADE — xoá site → mất hết email settings (intentional)
  - **Mitigation:** Document trong PRD; safe default

## Security Considerations

- Access control hooks tested với multi-tenant fixtures
- Tenant_id NOT NULL — không allow orphan rows
- No PII trong này (chỉ template content, không có customer data)

## Next Steps

- Unlocks Phase 02 (default config seeder + lookup cache) + Phase 03 (admin UI)
