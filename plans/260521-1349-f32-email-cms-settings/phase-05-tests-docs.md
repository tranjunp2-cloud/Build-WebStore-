# Phase 05 — Tests + Docs Sync

> Comprehensive test coverage cho lookup/cache/render flow + multi-tenant ACL. Sync docs để reflect production state F32.

## Context Links

- Test convention: `docs/TEST_CONVENTION.md`
- QA template pattern: `docs/qa/F19-store-configuration.md`
- Docs to update: `docs/architecture/email-templates.md`, `docs/CHANGELOG.md`

## Overview

- **Priority:** P1
- **Status:** Pending
- **Depends on:** Phase 02, 03, 04

## Key Insights

- TC-ID format theo `F32-XX-YY` convention (per F19 pattern)
- Multi-tenant ACL tests CRITICAL — security smoke test
- Snapshot tests cho merged HTML output để catch unintended changes
- Cache invalidation tests — easy to forget edge case (race condition)
- Need new architecture doc `docs/architecture/F32-email-template-cms-settings.md` (per CLAUDE.md docs map)

## Requirements

### Tests

- Unit tests:
  - `mergeTemplateConfig()` — default fallback, custom override, variable substitution
  - `getTemplateConfig()` — cache hit/miss/invalidate, Redis error fallback
  - Each refactored template — snapshot test với + without customContent
- Integration tests:
  - End-to-end: tenant config → trigger event → email content reflects custom
  - Disabled toggle → email không gửi (verify via mock sendEmail spy)
  - Multi-tenant: 2 tenants, 2 configs → 2 emails khác
  - Cache invalidation: save → next lookup re-fetches
- QA acceptance tests trong `docs/qa/F32-*.md` (TC-ID mapped)

### Docs

- New: `docs/architecture/F32-email-template-cms-settings.md` (data model + render flow diagram)
- New: `docs/qa/F32-email-template-cms-settings.md` (TC-IDs với mapped tests)
- Update: `docs/architecture/email-templates.md` — note F32 lookup layer
- Update: `docs/architecture/_OVERVIEW.md` — link F32 architecture
- Update: `docs/CHANGELOG.md` — entry cho F32 release
- Update: `docs/PROJECT_ALIGNMENT.md` — F32 status sang "Done"

## Related Code Files

**Create:**
- `src/__tests__/unit/lib/email/merge-template-config.test.ts`
- `src/__tests__/unit/lib/email/get-template-config.test.ts`
- `src/__tests__/integration/email-settings/multi-tenant-ACL.test.ts`
- `src/__tests__/integration/email-settings/disabled-toggle.test.ts`
- `src/__tests__/integration/email-settings/custom-content-flow.test.ts`
- `docs/architecture/F32-email-template-cms-settings.md`
- `docs/qa/F32-email-template-cms-settings.md`

**Modify:**
- `src/__tests__/unit/email/*.test.ts` (existing template snapshots — extend with customContent test cases)
- `docs/architecture/email-templates.md`
- `docs/architecture/_OVERVIEW.md`
- `docs/CHANGELOG.md`
- `docs/PROJECT_ALIGNMENT.md`

## Implementation Steps

1. Unit test `merge-template-config.test.ts`:
   - Test 1: empty customContent → returns default
   - Test 2: partial customContent (only subject) → merged with default rest
   - Test 3: variable substitution `{customerName}` → "John"
   - Test 4: variable không exist → render literal `{unknown}` (no error)
   - Test 5: special chars trong variable value → escaped correctly
2. Unit test `get-template-config.test.ts`:
   - Test 1: cache miss → DB query → cache set
   - Test 2: cache hit → no DB query
   - Test 3: invalidation hook → cache cleared
   - Test 4: Redis error → fallback DB query, no crash
3. Integration tests:
   - `multi-tenant-ACL.test.ts`: tenant A creates config; tenant B query → no result
   - `disabled-toggle.test.ts`: disable template → sendEmail spy called 0 times
   - `custom-content-flow.test.ts`: customize subject → trigger order event → mock sendEmail receives custom subject
4. Extend existing snapshot tests:
   - Cho mỗi template: thêm test case "with customContent" → snapshot
5. Create `docs/architecture/F32-email-template-cms-settings.md`:
   - Data model section (ref PRD §8)
   - Render flow diagram (sendEmail → getTemplateConfig → merge → render → SES)
   - Cache architecture (Upstash Redis key pattern + TTL + invalidation)
   - Admin UI architecture (custom Payload views)
6. Create `docs/qa/F32-email-template-cms-settings.md`:
   - Format like `docs/qa/F19-store-configuration.md`
   - TC-IDs mapped to integration tests
   - Manual smoke test scenarios
7. Update `docs/architecture/email-templates.md`:
   - Add section: "Per-tenant customization (F32)"
   - Note default behavior + override mechanism
8. Update `docs/architecture/_OVERVIEW.md`:
   - Feature index: add F32 row
9. Update `docs/CHANGELOG.md`:
   - Add release notes cho F32
10. Run full test suite — verify 100% pass + coverage ≥ 80% cho new code

## Todo List

- [ ] Unit tests merge-template-config (5 cases)
- [ ] Unit tests get-template-config (4 cases)
- [ ] Integration test multi-tenant ACL
- [ ] Integration test disabled toggle
- [ ] Integration test custom content flow
- [ ] Extend existing template snapshots (17 templates × 2 cases each)
- [ ] Create `docs/architecture/F32-*.md`
- [ ] Create `docs/qa/F32-*.md`
- [ ] Update `docs/architecture/email-templates.md`
- [ ] Update `_OVERVIEW.md` + CHANGELOG.md + PROJECT_ALIGNMENT.md
- [ ] Full test suite pass 100%
- [ ] Coverage ≥ 80% cho new files

## Success Criteria

- `npm test` 100% pass
- Coverage ≥ 80% cho:
  - `src/lib/email/get-template-config.ts`
  - `src/lib/email/merge-template-config.ts`
  - `src/collections/EmailTemplateSettings.ts`
- TC-IDs trong `docs/qa/F32-*.md` mapped 1:1 với integration tests
- Architecture doc với render flow diagram + cache architecture
- CHANGELOG entry approved
- PROJECT_ALIGNMENT status updated → Done

## Risk Assessment

- **Risk:** Snapshot tests update lớn (17 templates × multiple cases) → noisy diff
  - **Mitigation:** Test mỗi template trong file riêng; snapshot small + targeted (just key strings, not full HTML)
- **Risk:** Integration tests slow (DB + Redis fixtures setup)
  - **Mitigation:** Use test database isolation; mock Redis cho speed nếu cần
- **Risk:** Doc drift sau release (template list change → F32 enum không sync)
  - **Mitigation:** Single source of truth: enum constant exported từ `templates/index.ts`, used in cả collection + architecture doc reference
- **Risk:** TC-IDs không stable nếu rename test files
  - **Mitigation:** Use comment block `// TC-F32-XX` trong test code → grep-able

## Security Considerations

- Multi-tenant ACL test phải pass trước khi release (P0 security gate)
- KHÔNG include real PII trong test fixtures
- Test data cleanup sau mỗi run (avoid pollution)

## Next Steps

- Merge PR → staging → QA verify
- Monitor cache hit rate + email delivery success post-launch
- Phase 2 plan: branding (logo, color, font) — separate PRD update + plan
