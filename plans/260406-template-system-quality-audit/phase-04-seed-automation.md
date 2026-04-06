---
parent: plan.md
phase: 4
---

# Phase 4: Template Seed Automation + Smoke Test

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 1, 2, 3
- Docs: seed endpoint, db-setup.js

## Overview
- **Date:** 2026-04-06
- **Description:** Auto-seed templates on fresh DB + smoke test all 11 categories render correctly
- **Priority:** P1
- **Implementation status:** pending
- **Review status:** not started

## Key Insights
- Currently seed requires manual `POST /api/templates/seed?v2=true`
- Fresh DB → template picker shows empty → bad UX
- Best hook: db-setup.js already runs before Next.js starts (Docker CMD)

## Requirements
1. Auto-seed templates if templates table is empty (on server startup)
2. Smoke test: each category template renders without broken blocks
3. Don't re-seed if templates already exist (idempotent)

## Architecture

### Auto-Seed Options
**Option A: db-setup.js** (preferred)
- Already runs as Docker CMD before Next.js
- Add: after migrations, check templates count, if 0 → call seed logic
- Pro: guaranteed to run; Con: need to import composer logic into Node script

**Option B: API middleware / startup hook**
- Next.js instrumentation.ts or first-request middleware
- Pro: has full Next.js context; Con: race condition on first request

**Recommendation:** Option A (db-setup.js) — most reliable

### Smoke Test
- Vitest integration test: for each of 11 categories, compose template → verify all blocks exist in registry → verify theme resolves
- Not visual test (no browser needed), just data integrity

## Related Code Files
| File | Purpose | Action |
|------|---------|--------|
| `scripts/db-setup.js` | Startup script | ADD auto-seed logic |
| `src/lib/ai/template-composer.ts` | Composer | READ (seed source) |
| `src/lib/ai/template-definitions.ts` | 48 templates | READ |
| `src/__tests__/integration/` | Test dir | ADD smoke test |

## Implementation Steps

### Auto-Seed via Raw SQL (3h)
**Approach**: Pre-generate seed data from template-composer → hardcode as SQL INSERTs in db-setup.js. No TypeScript import needed.

1. **One-time script** (dev tool): `scripts/generate-seed-sql.ts` — runs composeTemplate() for all 48 templates → outputs SQL INSERT statements to `scripts/seed-templates.sql`
2. In db-setup.js, after migrations complete, query `SELECT COUNT(*) FROM templates`
3. If count = 0, run SQL from seed-templates.sql (or inline the INSERTs)
4. Also INSERT into `templates_template_pages` for multi-page templates
5. Log: "Seeded 48 templates" or "Templates already exist, skipping"
6. Must be idempotent — safe to run multiple times
7. **Re-run generate script** whenever template definitions change

### Smoke Test (2h)
1. Create `src/__tests__/integration/template-smoke.test.ts`
2. For each of 11 categories:
   - Call composeTemplate() with category
   - Verify output has correct number of pages per tier
   - Verify all block types in output exist in registry
   - Verify theme resolves without errors
3. Verify total: 48 templates composable without errors

## Todo List
- [ ] Add auto-seed logic to db-setup.js
- [ ] Test idempotency (run twice, no duplicates)
- [ ] Create template smoke test
- [ ] Run full test suite — 0 regressions

## Success Criteria
- [ ] Fresh DB → templates auto-seeded on startup
- [ ] Existing DB → seed skipped (idempotent)
- [ ] Smoke test: 48/48 templates compose without errors
- [ ] Smoke test: all block types in templates exist in registry
- [ ] Full test suite passes (3211+ tests)

## Risk Assessment
- **Low**: db-setup.js is well-established pattern
- **Medium**: Seed SQL needs to match Templates collection schema exactly
- **Low**: Smoke test is read-only, no side effects

## Security Considerations
- Seed data is static (from code) — no user input
- DB connection already established in db-setup.js

## Next Steps
→ Plan complete after Phase 4
→ Update Master Template System v2 plan status to DONE
