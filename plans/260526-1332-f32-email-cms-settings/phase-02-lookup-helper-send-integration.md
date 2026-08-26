# Phase 02 — Lookup Helper + Send Integration

## Context Links
- `src/lib/email/send.ts` (current minimal: `{to, subject, html}`)
- `src/lib/rateLimit.ts` (Upstash Redis client pattern — REUSE, do not re-instantiate blindly)
- `.claude/rules/email-smtp.md` (fire-and-forget pattern, no PII logging)
- Phase 01 `src/lib/email/types.ts` (EmailTemplateConfig, EmailTemplateType, EmailRecipient)

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Build config lookup (Redis-cached) + merge helper + extend `sendEmail()` to wire config into the send path. Add cache invalidation via afterChange hook.

## Key Insights
- Upstash client already exists in `rateLimit.ts` (`@upstash/redis`, env `UPSTASH_REDIS_REST_URL`/`_TOKEN`). Extract a tiny shared accessor or import — avoid a 2nd `new Redis()` (DRY). If extraction is risky, create `src/lib/redis.ts` exporting the singleton and have both consumers use it (small refactor, note in concerns).
- **No Redis env → fallback to null (no cache), still functional.** Same graceful-degradation as rateLimit.
- `mergeTemplateConfig` operates on the i18n `t` object (templates read `t.subject`, `t.greeting`, `t.cta`, `t.footer`/closing) — NOT on raw hardcoded strings. So merge = override specific keys on the resolved locale object.

## Requirements
**Functional**
- `getTemplateConfig(tenantId, templateType, recipient): Promise<EmailTemplateConfig | null>` — Redis 5min → DB query → null.
- `mergeTemplateConfig(localeStrings, config, vars)` — return effective strings; substitute `{var}` tokens; if config null or field empty → use default.
- `sendEmail()` extended: optional `templateType`, `recipient`, `tenantId`. When all present → lookup config; if `config.enabled === false` → SKIP send, return false (suppressed). Caller still passes pre-rendered `subject`/`html` (backward compat) OR template path passes config to template fn (see Phase 04 wiring).
- Cache invalidation on EmailTemplateSettings change.

**Non-functional**
- Lookup adds ≤1 Redis round-trip on cache hit; ≤1 DB query on miss.
- No email body / PII logged.

## Architecture

```
getTemplateConfig(tenant, type, recipient)
  key = `email_config:${tenant}:${type}:${recipient}`
  → redis.get(key)  (hit → parse → return)
  → payload.find({collection:'email-template-settings', where:{tenant,templateType,recipient}, limit:1})
  → map row → EmailTemplateConfig | null
  → redis.set(key, json, {ex: 300})
  → return
```

Invalidation: `EmailTemplateSettings` afterChange + afterDelete hook → `cacheDelete(email_config:${tenantId}:${type}:${recipient})`. Hook lives in the collection (Phase 01 owns the file) — **coordinate: Phase 01 adds hook skeleton calling a `invalidateTemplateConfigCache()` exported from this phase's helper.** To avoid cross-phase file coupling, export the invalidator here and have Phase 01 import it.

## Related Code Files
**Create**
- `src/lib/email/get-template-config.ts` — `getTemplateConfig()` + `invalidateTemplateConfigCache()` + cache key builder.
- `src/lib/email/merge-template-config.ts` — `mergeTemplateConfig()` + `{var}` substitution (`applyVariables(str, vars)`).
- `src/lib/redis.ts` (NEW, optional) — shared Upstash singleton if extracting from rateLimit.

**Modify**
- `src/lib/email/send.ts` — extend `SendEmailOptions` with optional `templateType`, `recipient`, `tenantId`; add enabled-check short-circuit. Keep `{to, subject, html}` path 100% backward compatible.
- `src/lib/rateLimit.ts` — only if extracting Redis singleton to `redis.ts` (import instead of inline new).

## Helper contracts
```ts
// get-template-config.ts
export function templateConfigCacheKey(tenantId: string|number, type: EmailTemplateType, recipient: EmailRecipient): string
export async function getTemplateConfig(tenantId, type, recipient): Promise<EmailTemplateConfig | null>
export async function invalidateTemplateConfigCache(tenantId, type, recipient): Promise<void>

// merge-template-config.ts
export function applyVariables(input: string | undefined, vars: Record<string,string|number>): string | undefined
// returns effective locale strings: config field (with vars applied) ?? default
export function mergeTemplateConfig<T extends Record<string,any>>(
  defaults: T, config: EmailTemplateConfig | null, vars: Record<string,string|number>,
  fieldMap: { subject?: keyof T; greeting?: keyof T; ctaLabel?: keyof T; closing?: keyof T }
): T
```
> `fieldMap` maps generic config keys → each template's locale-object key names (e.g. cta vs ctaLabel, footer vs closing) since templates differ. Keeps merge DRY across 15 templates.

## Implementation Steps
1. (Optional refactor) Extract Upstash singleton to `src/lib/redis.ts`; update `rateLimit.ts` import. If skipped, import redis instance pattern directly.
2. Create `get-template-config.ts`: cache key builder, getTemplateConfig (redis → payload.find → map → cache set ex 300), invalidateTemplateConfigCache. Handle no-redis fallback (skip cache, go straight to DB).
3. Create `merge-template-config.ts`: `applyVariables` (regex `/\{(\w+)\}/g` → vars lookup, leave unknown tokens as-is), `mergeTemplateConfig` using fieldMap.
4. Extend `send.ts`: add optional fields; if `tenantId && templateType && recipient` → `getTemplateConfig`; if returned `config.enabled === false` → log suppression (no body) + return false; else proceed. (Subject/html composition stays caller-side — Phase 04 wires templates.)
5. Coordinate hook: export `invalidateTemplateConfigCache`; Phase 01 collection afterChange/afterDelete calls it with `doc.tenant`, `doc.templateType`, `doc.recipient`.
6. `npx tsc --noEmit`.

## Todo List
- [ ] (opt) redis singleton extracted to src/lib/redis.ts
- [ ] get-template-config.ts: lookup + cache + invalidate
- [ ] no-redis fallback path works
- [ ] merge-template-config.ts: applyVariables + mergeTemplateConfig
- [ ] send.ts extended, backward-compat preserved
- [ ] enabled=false short-circuits send
- [ ] invalidateTemplateConfigCache exported + wired to Phase 01 hook
- [ ] tsc no errors

## Success Criteria
- Lookup returns null when no row (default path); returns config when row exists.
- Cache hit avoids DB query (verify via unit test mocking payload.find).
- `enabled=false` suppresses send.
- Existing `sendEmail({to,subject,html})` callers unchanged (no required new args).
- Cache invalidated within one save (afterChange).

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Two Redis clients (rateLimit + here) | Med | Low | Extract singleton (step 1) or document acceptable dup. |
| Stale cache after edit | Med | Med | afterChange invalidation + 300s TTL ceiling. |
| `{var}` injection (config text contains user HTML) | Med | High | applyVariables escapes values OR templates already wrap in HTML-safe context; escape `<>&` in substituted values to prevent injection into email HTML. |
| enabled=false silently drops critical email (e.g. password reset) | Low | High | Phase 03 should warn / disallow toggling-off critical security templates (otp, forgot-password, password-changed). Enforce allowlist of toggleable types. |

## Security Considerations
- Escape variable substitution values to prevent HTML/script injection into email body.
- Never log email body or config field contents (may contain PII).
- Critical security emails (otp-verification, forgot-password, password-changed) should NOT be disableable — enforce in Phase 03 + optionally guard in send path.

## Next Steps
Unblocks Phase 04 (templates call mergeTemplateConfig) and Phase 03 (preview reuses mergeTemplateConfig + applyVariables).

## Unresolved Questions
- Confirm whether to extract shared Redis singleton now or accept duplicate client (lean: extract — small, DRY).
- Confirm critical-template allowlist (which types are non-disableable).
