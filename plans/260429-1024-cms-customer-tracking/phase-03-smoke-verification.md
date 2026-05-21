# Phase 03 — Smoke + Manual Verification


## Context links
- Plan: [plan.md](./plan.md)
- Depends on: [phase-01-tenant-access-refactor.md](./phase-01-tenant-access-refactor.md), [phase-02-audience-virtual-collection.md](./phase-02-audience-virtual-collection.md)
- TC reference: none yet — propose `TC-F24-001..005` (added by docs-manager post-merge)

## Overview
- Date: 2026-04-29
- Description: Manual smoke matrix covering tenant isolation, super-admin global view, detail-link resolution, write scope. No automated tests in this phase.
- Priority: P2
- Implementation status: pending
- Review status: pending

## Key insights
- Automated tests deferred. Rationale: virtual collection has no business logic except aggregator (which IS unit-testable — phase-02 covers that). Access control already covered by phase-01 helper unit testability. Full E2E for admin UI custom views is high cost (Payload admin not yet in E2E suite per `docs/qa/F*.md` scan). Document deferral; revisit if regression observed.
- 2 testable units WILL get unit tests (added in phase-02 implementation, not deferred): `aggregate.ts` + `tenant-scope.ts`. Phase-03 covers integration paths only.

## Requirements
**Functional verification matrix**

| # | Scenario | Actor | Expected | Pass/Fail |
|---|----------|-------|----------|-----------|
| 1 | List view loads | tenant-owner A | sees own-tenant rows only | — |
| 2 | Cross-tenant leak via UI | tenant-owner A | tenant B rows absent | — |
| 3 | Cross-tenant leak via REST | tenant-owner A | `GET /api/contact-submissions` excludes B's rows | — |
| 4 | Super-admin global | super-admin | sees A + B rows | — |
| 5 | Site filter | super-admin | `?siteId=X` narrows to site X | — |
| 6 | Aggregation accuracy | super-admin | row count = unique(email+site) across both collections | — |
| 7 | Detail tab links | tenant-owner A | clicking row → filtered ContactSubmissions list resolves | — |
| 8 | Status update allowed | tenant-owner A | PATCH `/api/contact-submissions/:id` `{status:'replied'}` → 200 | — |
| 9 | Field write blocked | tenant-owner A | PATCH `{email:'x@y.z'}` → 403 | — |
| 10 | Subscriber row visibility | tenant-owner A | own-site subscribers visible in Audience as `isSubscriber=true` | — |
| 11 | Empty state | tenant-owner with 0 sites | empty state message, no error | — |
| 12 | Truncation banner | super-admin | with seed >5k contacts → warning visible | — (skip if no large dataset) |

## Architecture
N/A — verification only.

## Related code files
**READ**
- `src/access/tenant-scope.ts`
- `src/collections/Audience.ts`
- `src/components/admin/audience-list-view.tsx`
- `scripts/db-setup.js` (verify migrations applied)

**MODIFY** — none
**CREATE** — `plans/260429-1024-cms-customer-tracking/reports/smoke-{date}-{slug}.md` (verifier's output)
**DELETE** — none

## Implementation steps
1. **Seed prep**: ensure local DB has ≥2 tenants, each with ≥1 site, ≥3 contact submissions, ≥2 subscribers per site, with at least 1 email shared between contact + subscriber for the same site.
   - Use existing seed scripts if available; else create rows via Payload admin as super-admin.
2. **Run** `npm run dev` (or local Payload), confirm Audience nav visible.
3. **Execute** matrix scenarios 1-11 in order. Capture screenshots/curl output for any failure.
4. **Cross-tenant REST check** (scenario 3):
   ```bash
   # Login as tenant-owner A → grab JWT
   curl -X POST http://localhost:3000/api/users/login -d '{"email":"a@x","password":"..."}' -H 'Content-Type: application/json'
   # GET submissions
   curl http://localhost:3000/api/contact-submissions?depth=0 -H "Authorization: JWT $TOKEN"
   # Verify: zero rows reference tenant B's site IDs.
   ```
5. **Status update check** (scenarios 8+9): PATCH with `{status:'replied'}` then with `{email:'evil@x.z'}`. Confirm 200 then 403.
6. **Document** results in `reports/smoke-260429-{slug}.md` (≤200 words). Include any blockers.
7. **If pass**: mark phase done, hand off to code-reviewer → git-manager.
8. **If fail**: open BUG entry, attach to plan, re-run after fix.

## Todo
- [ ] Seed dataset prepared
- [ ] Scenarios 1-11 executed + recorded
- [ ] Scenario 12 (large dataset) — execute or document deferral
- [ ] Smoke report saved to `reports/`
- [ ] All-pass → handoff to code-reviewer
- [ ] Failures filed as BUG-F24-NN issues

## Success criteria
- All 11 in-scope matrix rows pass.
- Smoke report committed to plan reports/.
- Zero PII leaked across tenants in any path tested.
- Super-admin retains global access.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Test data insufficient → false-positive pass | M×M | Explicit seed requirements in step 1 |
| Manual verification skipped or rushed under deadline | M×H | Matrix table forces explicit pass/fail per row |
| Production has different tenant shape than dev seed | L×H | Run smoke against staging post-deploy as final gate |
| Detail-tab link breaks on Payload locale or query escaping | L×M | Test with email containing `+` and `.` (common patterns) |

## Security considerations
- Cross-tenant leak check (scenarios 2+3) is the **must-pass** gate. Any failure = block release.
- Verify session cookie/JWT not shared between user contexts during testing.
- Test with email PII patterns; do not commit real user emails to seed scripts.

## Next steps
- code-reviewer reviews phase-01 + phase-02 diff together.
- docs-manager creates `docs/architecture/F24-audience-tracking.md` + `docs/qa/F24-audience-tracking.md` (with TC-F24-001..005 derived from this matrix) + appends `docs/CHANGELOG.md`.
- git-manager: PR title `feat(cms): per-tenant customer tracking view` → base `staging`.
