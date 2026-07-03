# Branch Protection Rules

> GitHub → Settings → Branches → Add rule. This file documents the intended
> protection so we can rebuild the rules from scratch if the GitHub UI state
> is lost.

## `main`

- Require PR before merging: **Yes**
- Require approvals: **1**
- Dismiss stale reviews on new commit: **Yes**
- Require status checks to pass:
  - `Quality: Lint + Typecheck`
  - `Test`
- Require branches to be up to date: **Yes**
- Restrict who can push: team members only
- Allow force pushes: **No**

## `staging`

- Require PR before merging: **Yes**
- Require approvals: **1**
- Require status checks to pass:
  - `Quality: Lint + Typecheck`
  - `Test`
- Restrict who can push: team members only
- Allow force pushes: **No**

## `qc-test` (added 2026-07-02)

Isolated environment for QC load / functional / E2E tests. Restricted push so
QC can't accidentally overwrite the branch with staging drift, and so devs
can't push untested code into the QC lane.

- Require PR before merging: **No** (QC lead + dev owner push directly)
- Restrict who can push:
  - `@<qc-lead-username>` — primary
  - `@<dev-owner-username>` — backup
- Require status checks to pass: **Optional**
  - `Deploy: Vercel (qc-test)` — do NOT gate; QC pushes should always deploy
- Allow force pushes: **No**
- Allow deletions: **No** — branch permanent

**Sync workflow (QC lead runs when picking up new code):**

```bash
git checkout qc-test
git fetch origin
git merge origin/staging   # or cherry-pick specific commits
git push origin qc-test
# CI runs deploy-qc-test → Lark notify [PrimeWeb - V2] — CI/CD
```

## Related

- CI workflow: `.github/workflows/ci.yml` (jobs `deploy-staging`, `deploy-production`, `deploy-qc-test`)
- Vercel deploy rule: `.claude/rules/vercel-deploy.md`
- QC plan: `plans/260702-1719-qc-test-env-setup/`
