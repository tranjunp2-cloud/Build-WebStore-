# .github/ Overview — ECH Prime Web v2

> Ban do nhanh cho moi file trong `.github/`. Doc file nay truoc khi doc bat ky file nao khac.

## Bat dau o dau?

| Ban la... | Doc file nay |
|-----------|-------------|
| **Dev moi** | `TEAM_ONBOARDING.md` → `CONTRIBUTING.md` |
| **QA** | `TEST_PLAN.md` → `ISSUE_TEMPLATE/bug-qa.yml` |
| **PM** | `GIT_AND_CI_RULES.md` (Section 2: Issue Lifecycle) |
| **DevOps** | `DEPLOY.md` → `workflows/ci.yml` |
| **AI Assistant** | Root `CLAUDE.md` + `AGENTS.md` |

## Files Index

### Rules & Guidelines
| File | Noi dung |
|------|---------|
| `GIT_AND_CI_RULES.md` | Git Flow, branch naming, PR lifecycle, CI pipeline |
| `CONTRIBUTING.md` | Workflow per role (PM, Dev, QA, DevOps) |
| `DEPLOY.md` | Staging vs Production deploy (App Platform vs Droplet) |
| `TEAM_ONBOARDING.md` | Checklist onboarding cho team member moi |
| `TEST_PLAN.md` | Unit test scope, coverage targets per module |
| `REVIEW_CHECKLIST.md` | PR review checklist (9-Point Done) |
| `CODEOWNERS` | Auto-assign reviewers theo file path |

### Templates
| File | Khi nao dung |
|------|-------------|
| `pull_request_template.md` | Tu dong hien khi tao PR |
| `ISSUE_TEMPLATE/bug-qa.yml` | QA bao bug |
| `ISSUE_TEMPLATE/feature-request.yml` | Yeu cau tinh nang moi |
| `ISSUE_TEMPLATE/task.yml` | Task ky thuat / chore / refactor |

### Workflows (CI/CD)
| Workflow | Trigger | Muc dich |
|----------|---------|---------|
| `ci.yml` | Push main/staging, PR | Lint → TypeCheck → Test → Build → Deploy |
| `pr-lifecycle.yml` | PR events | Auto-label, assign, size check |
| `issue-lifecycle.yml` | Issue events | Project board automation |
| `codex-review.yml` | PR review | AI code review |
| `story-sync.yml` | Manual | Sync stories → GitHub Issues |
| `staging-health.yml` | Cron | Health check staging |
| `team-rituals.yml` | Cron | Daily/weekly notifications |
| `weekly-metrics.yml` | Cron | PR/issue/coverage metrics |
| `security-alerts.yml` | Cron | Security scan |
| `doc-change-notify.yml` | Push docs/ | Notify team khi docs thay doi |
| `release-changelog.yml` | Tag release | Generate changelog |

### Scripts & Actions
| File | Muc dich |
|------|---------|
| `actions/smart-notify/` | Lark notify (Bot AI → webhook fallback) |
| `actions/lark-notify/` | Lark webhook cards |
| `scripts/sync-do-envs.py` | Sync GitHub Secrets → DigitalOcean |
| `scripts/generate-changelog.js` | Changelog tu git log |
| `scripts/collect-metrics.js` | Weekly metrics |
| `scripts/parse-stories.js` | Story → Issue parser |
| `codex/prompts/review.md` | AI review prompt |
| `codex/prompts/review-incremental.md` | AI review sau fix |
