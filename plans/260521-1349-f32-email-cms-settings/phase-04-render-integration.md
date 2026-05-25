# Phase 04 — Template Render Integration

> Refactor 16+ template render files để accept optional custom config từ DB lookup. Wire `sendEmail()` callers ở 16+ trigger points để pass `templateType`, `recipient`, `tenantId`.

## Context Links

- Phase 02 `getTemplateConfig()` returns config
- Phase 01 `sendEmail()` accepts lookup params
- Existing templates: `src/lib/email/templates/*.ts` (7 + 9 commerce planned + order-shipped = 17 total)

## Overview

- **Priority:** P0
- **Status:** Pending
- **Depends on:** Phase 02, 03

## Key Insights

- Refactor scope LỚN — 17 template files + 17+ caller sites. Cần helper để tránh repeat
- Helper `mergeTemplateConfig()` — input template default + custom config → merged result
- 4 fields override scheme (subject/greeting/CTA/closing) — KHÔNG override entire HTML body
- Variable substitution: simple regex replace `{varName}` → value, no escape needed (template strings already escaped)
- Caller sites need access to `tenantId` — most callers đã có `site.id` hoặc `tenant.id` in scope

## Requirements

### Functional

- Each template function accept optional `customContent?: TemplateConfig['content']` param
- Render logic: nếu custom field present → use custom; else use default từ i18n
- Variable substitution: `{varName}` → actual value (orderNumber, customerName, etc.)
- 17+ caller sites pass `tenantId` + `templateType` + `recipient` vào `sendEmail()`
- Backward compat: existing tests/usage không pass lookup params → behaves như cũ

### Non-functional

- KHÔNG break existing 7 production templates
- Refactor pattern consistent across all 17 files
- Type safety: TS infer custom content shape từ template type

## Related Code Files

**Create:**
- `src/lib/email/merge-template-config.ts` — helper merge default + custom + variables

**Modify (17 template files):**
- `src/lib/email/templates/welcome.ts`
- `src/lib/email/templates/otp-verification.ts`
- `src/lib/email/templates/forgot-password.ts`
- `src/lib/email/templates/password-changed.ts`
- `src/lib/email/templates/staff-invitation.ts`
- `src/lib/email/templates/order-confirmation.ts`
- `src/lib/email/templates/order-status.ts` (variants: cancelled/delivered/failed/shipped)
- `src/lib/email/templates/order-shipped.ts` (NEW, vừa add ở staging)
- `src/lib/email/templates/contact-buyer-confirmation.ts` (sau commerce plan)
- `src/lib/email/templates/contact-seller-notification.ts` (sau commerce plan)
- `src/lib/email/templates/newsletter-buyer-confirmation.ts` (sau commerce plan)
- `src/lib/email/templates/newsletter-seller-notification.ts` (sau commerce plan)
- `src/lib/email/templates/new-order-seller.ts` (sau commerce plan)
- `src/lib/email/templates/payment-timeout-cancelled-buyer.ts` (sau commerce plan)

**Modify (caller sites — 10+ files):**
- `src/collections/Users.ts` (welcome, OTP, forgot-password, staff-invitation, password-changed callers)
- `src/app/api/webhooks/stripe/route.ts` (order-confirmation, new-order-seller)
- `src/collections/Orders.ts` (order-status variants, new-order-seller)
- `src/app/api/orders/[id]/cancel/route.ts` (order-status cancelled)
- `src/app/api/contact-submit/route.ts` (contact buyer/seller)
- `src/app/api/subscribe/route.ts` (newsletter buyer/seller)
- + cron job cho payment-timeout (Phase from F10)

## Implementation Steps

1. Create `merge-template-config.ts`:
   ```ts
   export function mergeTemplateConfig<T>(opts: {
       defaultContent: T,       // từ i18n hoặc hardcoded
       customContent: Partial<T> | null,
       variables: Record<string, string | number>,
   }): T {
       const merged = { ...opts.defaultContent, ...(opts.customContent ?? {}) }
       return substituteVariables(merged, opts.variables) as T
   }

   function substituteVariables(obj, vars) {
       // Recursively walk obj, replace {varName} with vars[varName]
       // For arrays/strings only — preserve structure
   }
   ```
2. Refactor 1 template làm reference (vd `welcome.ts`):
   ```ts
   export function welcomeEmail(data: WelcomeEmailData & { customContent?: ... }): { subject, html } {
       const { customContent, ...vars } = data
       const t = locales[locale].welcome
       const merged = mergeTemplateConfig({
           defaultContent: t,
           customContent,
           variables: vars,
       })
       return {
           subject: merged.subject,
           html: `... ${merged.greeting} ... ${merged.body} ... ${merged.cta} ...`
       }
   }
   ```
3. Apply pattern cho 16 templates còn lại (tester có thể parallelize đọc + refactor)
4. Update 1 caller site reference (vd `Users.ts` welcomeEmail call):
   ```ts
   const config = await getTemplateConfig({ tenantId, templateType: 'welcome', recipient: 'buyer' })
   if (config && !config.enabled) return  // skipped by tenant
   const emailData = welcomeEmail({ userName, customContent: config?.content })
   await payload.sendEmail({ to, ...emailData })
   ```
5. Apply pattern cho 9+ caller sites còn lại
6. Run full test suite — verify no regression
7. Manual E2E:
   - Default behavior (no customization) → email matches old output exact
   - Customize subject → email arrives with new subject
   - Toggle off → email không gửi
   - Multi-tenant: 2 sellers → 2 emails khác content

## Todo List

- [ ] Create `merge-template-config.ts` helper
- [ ] Refactor `welcome.ts` as reference pattern
- [ ] Refactor 16 remaining templates apply same pattern
- [ ] Update 10+ caller sites pass tenantId + templateType + recipient
- [ ] Variable substitution unit tests
- [ ] Regression: existing email snapshots pass
- [ ] Manual E2E: 4 scenarios above
- [ ] TypeScript compile clean

## Success Criteria

- Tất cả 17 templates accept custom config
- Tất cả callers pass lookup params
- Existing tests pass (no regression)
- Custom subject/greeting/CTA/closing actually applied trong production email
- Disabled template → email skipped (verify by log + inbox)
- Multi-tenant isolation: 2 tenants → 2 different emails

## Risk Assessment

- **Risk:** 17 templates refactor — easy to miss a file or break a variant
  - **Mitigation:** Checklist in todo + code review focus on template diff; snapshot tests catch unintended HTML changes
- **Risk:** Variable substitution edge cases — `{customerName}` chứa special chars (regex chars, HTML entities)
  - **Mitigation:** Escape variable values trước khi substitute; unit test với edge case inputs
- **Risk:** Caller site missing tenantId → lookup fails silently → default behavior (acceptable but unintended)
  - **Mitigation:** Lint rule hoặc TS strict: nếu pass templateType phải pass tenantId
- **Risk:** Performance — every email send = 1 lookup. Cache helps nhưng cold tenant = miss
  - **Mitigation:** Phase 02 cache acceptable; monitor p99 latency post-launch
- **Risk:** Breaking change cho external consumers nếu có (vd Storybook stories sử dụng templates)
  - **Mitigation:** customContent optional → existing callers unaffected

## Security Considerations

- Variable substitution KHÔNG eval — pure string replace, không inject HTML
- Custom content escape HTML khi insert vào template (template strings already use literal escaping)
- KHÔNG allow `{` `}` chars trong variable values (would break substitution)

## Next Steps

- Unlocks Phase 05 (tests + docs sync)
