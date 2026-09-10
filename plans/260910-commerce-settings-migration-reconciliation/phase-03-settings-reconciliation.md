# Phase 03 — Settings: cấu hình và team

## Overview

Priority P1. Đối soát cấu hình vận hành theo một tab Settings duy nhất, không thêm sidebar/menu riêng.

## PW1 schema đã xác minh (read-only, 2026-09-10)

- Profile/store: `stores`; Domain: `store_domains`; Payment: `store_payments` + `payment_methods`; Delivery: `store_deliveries` + `delivery_providers`; Email: `store_email_templates` + `email_template_types`; Team: `users`, `roles`, `model_has_roles`; configuration mở rộng: `model_settings`.
- Never expose/compare values of `password`, `token`, `token_id`, `key_string`, `secret_key` hoặc `dns_token`; trạng thái hiện diện chỉ được báo theo Security allow-list đã duyệt.

## Settings groups

| Group | Compare | Never expose |
|---|---|---|
| Account profile | business/display contact fields | password, MFA/OTP secret |
| Team members | name, masked email/phone, role, invitation/active state | password, session/token |
| Email templates | template identity, enabled state, subject/body checksum | recipient history or sensitive rendered data |
| Payments | enabled provider/method, public configuration presence | secret key, callback token, credentials |
| Delivery | methods, rates, zones, active state | carrier tokens |
| Web address | domain, primary state, publish status | DNS provider credentials |
| App integrations | integration/provider + connection state | API keys, OAuth refresh tokens |

## Related files

- Create: `src/lib/admin/qa/settings-reconciliation.ts`
- Modify: `src/app/api/qa/migration-reconciliation/route.ts`
- Reference: `src/collections/Tenants.ts`, `Sites.ts`, `Users.ts`, email/payment/shipping settings.
- Add tests: `src/__tests__/unit/qa/f40-settings-reconciliation.test.ts`
- Add E2E: `tests/f40-settings-migration-reconciliation.spec.ts`
- Add TC mappings: `docs/qa/F40-qa-control-center.md`

## Implementation steps

1. Define an allow-list of safe Settings fields; all unlisted fields are excluded by default.
2. Build one reconciler per Settings group from official mapping/snapshot data.
3. Compare template content using a server-side checksum, not raw secret-bearing configuration.
4. Return only counts, safe display values and remediation text to the client.
5. Flag missing payment/delivery/domain configuration as migration failure; invitation pending is warning per business rule.
6. Add tests proving secret fields are absent from serialized API responses.

## Todo

- [ ] Define safe field allow-list with migration team/security owner.
- [ ] Implement Settings reconcilers and safe DTO.
- [ ] Add unit/E2E/security tests.

## Success criteria

- Tester can verify all operating Settings from one tab.
- API response contains no password, API key, token, MFA/OTP secret or full PII list data.
