# Phase 04 — Template Render Refactor (15 templates)

> Sequenced BEFORE Phase 03 because preview pane imports refactored templates + mergeTemplateConfig.

## Context Links
- `src/lib/email/templates/*.ts` (15 files) + `index.ts` barrel
- `src/lib/email/templates/welcome.ts` (canonical pattern: reads `t.subject`, `t.greeting`, `t.cta`, `t.footer` from i18n locale)
- Phase 02 `merge-template-config.ts` (`mergeTemplateConfig`, `applyVariables`)
- Phase 01 `types.ts` (`EmailTemplateConfig`, `EMAIL_TEMPLATE_VARIABLES`)

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Refactor each template fn to accept optional `config?: EmailTemplateConfig`. When config present + field non-empty → override; else keep i18n default. Zero behavior change when config absent (backward compat).

## Key Insights
- Templates currently read locale strings via `t = locales[locale].welcome` then interpolate. Refactor = wrap `t` through `mergeTemplateConfig(t, config, vars, fieldMap)` → effective `t`. Minimal diff per file.
- Field name drift: welcome uses `t.cta` + `t.footer`; others may use different keys. Per-file `fieldMap` resolves config.subject→t.subject, config.greeting→t.greeting, config.ctaLabel→t.cta, config.closing→t.footer (or closing).
- 15 files only. contact/newsletter/order-delivered/order-failed/payment-timeout do NOT exist — out of scope (enum placeholders only, no refactor).
- Keep each file < 200 lines (already are).

## Requirements
**Functional**
- Each exported template fn signature: `(data, config?: EmailTemplateConfig) => { subject, html }`.
- `config` undefined/null → identical output to today.
- `config` fields override matching locale strings; empty/missing config fields → default.
- `{var}` tokens in config values substituted with `data` values via `applyVariables`.

**Non-functional**
- No new runtime deps. Pure function refactor.

## Architecture
Per template:
```ts
export function welcomeEmail(data: WelcomeEmailData, config?: EmailTemplateConfig) {
  const { userName, dashboardUrl = '...', locale = 'en' } = data
  const base = (locales[locale] || locales.en).welcome
  const vars = { userName, dashboardUrl }            // EMAIL_TEMPLATE_VARIABLES['welcome']
  const t = mergeTemplateConfig(base, config, vars, {
    subject: 'subject', greeting: 'greeting', ctaLabel: 'cta', closing: 'footer',
  })
  return { subject: t.subject, html: `...uses t...` }
}
```

## Related Code Files
**Modify (15)**
- `welcome.ts`, `forgot-password.ts`, `otp-verification.ts`, `password-changed.ts`,
  `order-confirmation.ts`, `order-status.ts`, `order-cancelled.ts`, `order-shipped.ts`,
  `order-expired.ts`, `new-order-seller.ts`, `bank-transfer-instructions.ts`,
  `payment-confirmed.ts`, `payment-rejected.ts`, `resend-upload-link.ts`, `staff-invitation.ts`
- `src/lib/email/templates/index.ts` — re-export `EmailTemplateConfig` type for convenience (or keep importing from `../types`).

## Implementation Steps
1. Read each template, identify its locale-object key names for subject/greeting/cta/closing (build per-file fieldMap). Some templates may lack a CTA or closing — only map fields that exist; unmapped config fields are ignored.
2. Add optional `config?: EmailTemplateConfig` param. Insert `mergeTemplateConfig(base, config, vars, fieldMap)` to produce effective `t`. Reference `EMAIL_TEMPLATE_VARIABLES[type]` to know which `data` values are exposed as `{vars}`.
3. Ensure default-path output is byte-identical (config undefined → mergeTemplateConfig returns `base` unchanged).
4. Update `index.ts` if exporting the config type.
5. `npx tsc --noEmit`.
6. Spot-check 2-3 rendered outputs (welcome, order-confirmation, otp) with + without config (Phase 05 covers automated).

## Todo List
- [ ] Per-file fieldMap identified for all 15
- [ ] All 15 fns accept optional config param
- [ ] mergeTemplateConfig wired per file
- [ ] Default path byte-identical (no config)
- [ ] {var} substitution works in overridden fields
- [ ] index.ts updated
- [ ] tsc no errors

## Success Criteria
- All 15 templates compile with new signature.
- Calling any template without config produces unchanged HTML/subject (regression-safe).
- Calling with config overrides exactly the provided fields, substitutes vars.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Field-key drift breaks merge (cta vs ctaLabel vs button) | High | Med | Explicit per-file fieldMap; tester verifies override per template. |
| Accidental behavior change in default path | Med | High | mergeTemplateConfig returns base untouched when config null; snapshot test default output (Phase 05). |
| Template lacks greeting/cta field but config provides it | Med | Low | Unmapped fields ignored — no crash. |
| HTML injection via config string | Med | High | applyVariables/merge escapes values (Phase 02). Config fields rendered as text into HTML must be escaped at merge layer. |

## Security Considerations
- Rendered config strings inserted into email HTML → must be escaped (handled in Phase 02 mergeTemplateConfig). Verify subject/greeting/cta/closing are escaped, not raw.

## Next Steps
Unblocks Phase 03 preview (imports these fns + fixtures). Phase 05 snapshots default outputs.

## Unresolved Questions
- Some templates (otp, password-changed) may have no CTA/closing — confirm which 4-field subset each supports; reflect in `EMAIL_TEMPLATE_RECIPIENTS`/UI so seller isn't shown irrelevant fields.
