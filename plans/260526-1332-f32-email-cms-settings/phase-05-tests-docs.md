# Phase 05 — Tests + Docs

## Context Links
- `.claude/rules/testing.md` (TC-ID required, AAA, vi.mock top-level, import from source)
- `docs/TEST_CONVENTION.md`
- All phases 01-04 outputs

## Overview
- **Priority:** P2
- **Status:** pending
- **Description:** Unit tests (lookup + merge), integration test (multi-tenant isolation + backward compat), QA doc + architecture doc.

## Key Insights
- Each test maps to a TC-ID from `docs/qa/F32-email-template-cms-settings.md` (create the QA doc as part of this phase — it defines the TC-IDs).
- Import logic from source; never re-implement. Mock `payload.find`/redis at top level with `vi.mock`.
- No fake data to pass CI — fixtures are legit test fixtures, not cheats.

## Requirements
**Functional (test coverage)**
- `getTemplateConfig`: cache hit (no DB), cache miss (DB query + cache set), no-row → null, no-redis fallback.
- `mergeTemplateConfig`/`applyVariables`: override present field, keep default on empty, `{var}` substitution, HTML escaping of values, unknown token left intact.
- Template default-path regression: each (or representative subset) renders identical output with `config=undefined`.
- Multi-tenant isolation: Tenant A save → Tenant B getTemplateConfig returns null/own; access control denies cross-tenant read.
- enabled=false suppresses send.

**Docs**
- `docs/qa/F32-...md`: test plan + TC-ID table.
- `docs/architecture/F32-...md`: data flow, collection schema, cache strategy, send integration.

## Related Code Files
**Create**
- `src/__tests__/unit/email/get-template-config.test.ts`
- `src/__tests__/unit/email/merge-template-config.test.ts`
- `src/__tests__/integration/email-settings/multi-tenant-isolation.test.ts`
- `docs/qa/F32-email-template-cms-settings.md`
- `docs/architecture/F32-email-template-cms-settings.md`

**Modify (docs-manager)**
- `docs/CODEBASE_SUMMARY.md` — add email-template-settings collection + email lib changes
- `docs/CHANGELOG.md` — F32 entry
- `docs/architecture/_OVERVIEW.md` — link F32 architecture doc

## Implementation Steps
1. Write `docs/qa/F32-...md` first (defines TC-IDs: e.g. F32-U-01 cache hit, F32-U-02 miss, F32-M-01 override, F32-I-01 isolation, ...).
2. `get-template-config.test.ts`: vi.mock payload + redis; assert cache-hit skips find, miss calls find + set, null path, no-redis path. Tag each `// TC: F32-U-0X`.
3. `merge-template-config.test.ts`: override/default/var-substitution/escaping/unknown-token cases.
4. `multi-tenant-isolation.test.ts`: simulate two tenants; assert getTemplateConfig scoped; access control rejects cross-tenant; backward-compat (no row → default template output unchanged).
5. Run `npm test` — 100% pass on new code. Fix failures per recommendations (no skip).
6. Write architecture doc (data flow diagram from plan.md, schema, cache, send wiring, security notes).
7. docs-manager updates CODEBASE_SUMMARY + CHANGELOG + _OVERVIEW link.

## Todo List
- [ ] docs/qa/F32 with TC-ID table
- [ ] get-template-config unit tests (cache/miss/null/no-redis)
- [ ] merge-template-config unit tests (override/default/vars/escape/unknown)
- [ ] multi-tenant isolation integration test
- [ ] backward-compat default-render assertion
- [ ] npm test green on new code
- [ ] docs/architecture/F32
- [ ] CODEBASE_SUMMARY + CHANGELOG + _OVERVIEW updated

## Success Criteria
- All new tests pass; each has a TC-ID.
- Isolation test proves Tenant A cannot read Tenant B config.
- Backward-compat test proves no-config send = unchanged output.
- Docs published + cross-linked.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mocking redis/payload incorrectly → false green | Med | High | Assert on mock call counts (find called 0× on cache hit), not just return value. |
| Integration test needs real DB | Med | Med | Per testing.md, prefer real DB for integration (no mock divergence). Confirm test DB available; else scope to access-control-fn unit test. |
| TC-IDs drift from QA doc | Low | Med | Author QA doc first (step 1), reference IDs in test comments. |

## Security Considerations
- Isolation test is the security gate — must prove tenant scoping. Include negative case (cross-tenant denied).
- Test HTML-escaping of config values (injection prevention).

## Next Steps
After green: code-reviewer → git-manager (PR to staging). docs-manager finalizes.

## Unresolved Questions
- Confirm integration test DB strategy (real test DB vs access-fn unit). Per testing.md, real DB preferred for migrations/isolation — verify CI test DB available for `email_template_settings`.
