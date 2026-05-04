# Phase 07 — QA + cleanup

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase 06 deployed to staging
- QA test cases: `docs/testcases/F19-*.md`

## Overview
- Date: 2026-04-13
- Description: Run QA on staging against TC-F19-01..06, update architecture doc, remove dead TODO, close issue #558.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key insights
- TC-F19-04 (verify with TXT challenge) is the regression case for #558 — was failing pre-fix, must pass post-fix.
- `docs/architecture/F19-store-configuration.md` references DigitalOcean app spec — needs full rewrite of provisioning section.
- Issue #558 close-out should reference both the PR and the staging screenshot proof.

## Requirements
- All TC-F19-01..06 pass on staging.
- Architecture doc reflects Vercel-based provisioning.
- No dead TODO/comments referencing DO or SERVER_IP anywhere in F19 code.
- Issue #558 closed with link to PR + verification artifacts.

## Architecture
QA matrix (run on staging):

| ID | Scenario | Expected |
|----|----------|----------|
| TC-F19-01 | Add valid apex domain (DNS pre-pointed) | status='active' immediately |
| TC-F19-02 | Add subdomain (DNS not yet pointed) | status='pending', DNS instructions visible |
| TC-F19-03 | Add invalid format `not a domain` | client validation error, no Vercel call |
| TC-F19-04 | Add domain requiring TXT challenge | TxtChallengeCard renders, after TXT set + verify → active |
| TC-F19-05 | Remove active domain | row deleted, Vercel domain removed, no error |
| TC-F19-06 | Set primary domain | isPrimary flipped, others cleared, primary reflected on tenant site |

## Related code files
- Modify: `docs/architecture/F19-store-configuration.md` — rewrite provisioning section
- Verify: `src/app/(dashboard)/settings/domains/actions.ts` — no DO/SERVER_IP refs (sanity grep)
- Verify: `src/app/(dashboard)/settings/domains/DomainsClient.tsx` — same

## Implementation steps
1. Run QA matrix on staging — capture screenshot per case.
2. File any bugs found as sub-issues; if blocker, loop back to phase 03/04.
3. Final grep for cleanup: `grep -rn 'SERVER_IP\|DO_API_TOKEN\|DO_APP_ID\|DigitalOcean' src/app/(dashboard)/settings/domains/ src/__tests__/unit/dashboard/`. Should return zero.
4. Rewrite the "Provisioning" section of `docs/architecture/F19-store-configuration.md`:
   - Remove DO app-spec flow diagram.
   - Add Vercel `addProjectDomain` → `verifyProjectDomain` state machine.
   - Reference phase 03 state machine + phase 01 client.
5. Update `docs/architecture/F19-store-configuration.md` env-var table to list Vercel vars.
6. Add a "Migration notes" section linking to this plan dir.
7. On the open PR, post the staging screenshot gallery as a comment.
8. After PR merges to main + production deploy + production smoke test passes, close issue #558 with comment: "Fixed by #<PR>. Verified on staging (screenshots: …) and production (smoke test: …). DO references purged."

## Todo
- [ ] Execute TC-F19-01 through TC-F19-06 on staging
- [ ] Capture screenshots per test case
- [ ] Final grep — no DO/SERVER_IP refs in F19 paths
- [ ] Rewrite `docs/architecture/F19-store-configuration.md` provisioning section
- [ ] Update env-var table in same doc
- [ ] Add migration-notes section linking this plan
- [ ] Post screenshots to PR
- [ ] Production deploy + smoke test
- [ ] Close issue #558 with verification artifacts

## Success criteria
- All 6 TC-F19 cases green on staging.
- Cleanup grep returns zero matches.
- Architecture doc accurate for Vercel provisioning.
- Issue #558 closed with verification proof.

## Risk assessment
- Low. This phase is verification + housekeeping.
- Edge: production smoke test reveals env mismatch — mitigation is to apply same `vercel env add` steps from phase 06 against `production` environment if not already done.

## Security considerations
- Screenshots posted to PR must NOT include `VERCEL_TOKEN` or any secret values from browser devtools / network tabs.
- Confirm Vercel team audit log shows only expected calls during the QA window.

## Next steps
- Plan complete. Track any follow-ups (SSL polling improvement, cert misconfiguration webhook) as separate issues.

## Open questions
- None.
