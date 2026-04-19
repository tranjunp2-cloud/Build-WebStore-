# CLAUDE.md — ECH Prime Web v2

> Project-specific rules for AI code assistants (Claude, Cursor, Antigravity).
> This file stays small (≤200 lines). Detailed rules live in `.claude/rules/*.md` and `docs/*.md` — loaded on demand via path-scoping.

## Stack in one line

Next.js 15 (App Router) + Payload CMS 3 + PostgreSQL (Neon) + Tailwind + shadcn/ui, deployed on Vercel via GitHub Actions (CI-driven, `VERCEL_TOKEN`).

## Rule pointers (`.claude/rules/*.md`)

| Rule file | When it auto-loads | Summary |
|-----------|-------------------|---------|
| `database-schema.md` | Editing `src/collections/**`, `scripts/db-setup.js`, `src/payload.config.ts` | Payload Drizzle naming, migration convention, CI schema gate |
| `vercel-deploy.md` | Editing `vercel.json`, `.github/workflows/**`, `.github/actions/smart-notify/**` | CI-driven deploy, webhook disabled, 3-stage `vercel pull/build/deploy --target=staging` |
| `env-vars.md` | Editing `.env*`, `process.env` references | Vercel Dashboard = source of truth; CI `vercel pull`s; GH Secrets only for CI tooling |
| `git-flow.md` | Editing `.github/**`, `commitlint.config.js` | Staging-first, 1 US = 1 branch = 1 PR, conventional commits |
| `testing.md` | Editing `**/*.test.*`, `src/__tests__/**`, `docs/qa/**` | TC-ID refs, AAA, `vi.mock()` top-level, gold-standard files |
| `email-smtp.md` | Editing `src/lib/email/**`, `src/payload.config.ts` | AWS SES via Payload, fire-and-forget pattern |
| `workflow.md` | Anywhere — defines AI workflow | Planner → cook → tester → reviewer → docs-manager flow |
| `orchestration.md` | Anywhere — subagent invocation | Context isolation, file ownership, status protocol |

## Canonical docs (`docs/`)

| Doc | Owner | Purpose |
|-----|-------|---------|
| `docs/README.md` | PM | Team hub — read first; links to everything |
| `docs/PROJECT_ALIGNMENT.md` | PM | Vision, timeline, priority, sprint plan (supersedes old "PDR" + "roadmap") |
| `docs/CODEBASE_SUMMARY.md` | Dev | `src/` directory map + key modules + entry points |
| `docs/CHANGELOG.md` | Dev | Per-release notes curated from merged PRs since v1.0 |
| `docs/architecture/_OVERVIEW.md` | Dev | Unified layer diagram + index → `architecture/F*.md` |
| `docs/standards/CODE_STANDARDS.md` | Dev (QC co-owns §QA) | Lint / TS / imports / naming / modularization / error handling |
| `docs/TEST_CONVENTION.md` | QC | Test patterns, TC-ID mapping (authoritative for tests) |
| `docs/tracking/OPEN_BLOCKERS.md` | PM | Active blockers for v1.0 stabilization + v1.1 prep |
| `docs/decisions/decisions-log.md` | PM | Product decisions log |

Per-feature detail: `docs/architecture/F*.md`, `docs/prd/F*.md`, `docs/qa/F*.md`, `docs/stories/`, `docs/design/`, `docs/standards/*`, `docs/journals/`.

## CRITICAL overrides (non-negotiable)

These facts override any contradicting information elsewhere. If you touch these areas, follow these rules first.

### Deploy (see `.claude/rules/vercel-deploy.md`)

- `vercel.json` → `git.deploymentEnabled: false` — DO NOT re-enable
- All deploys via GitHub Actions using `VERCEL_TOKEN` (owner `phuongltweb`)
- `vercel pull --environment=staging` + `vercel build --target=staging` + `vercel deploy --prebuilt --target=staging` — all 3 stages must agree on target

### Schema (see `.claude/rules/database-schema.md`)

- Every new column/table → entry in `scripts/db-setup.js` `MIGRATIONS` array
- Array tables use `varchar` id + `_parent_id` + `_order` (underscore)
- Select-hasMany tables use `serial` id + `parent_id` + `order` (no underscore)
- NEVER `DROP TABLE` — use `CREATE TABLE IF NOT EXISTS`
- CI `scripts/check-migrations.js` hard-gates PR if missing

### Env vars (see `.claude/rules/env-vars.md`)

- Source of truth: Vercel Dashboard (not GitHub Secrets)
- GitHub Secrets only for: CI tooling (`VERCEL_TOKEN`, `BOT_*`, `GH_BOT_TOKEN`), test creds (`E2E_*`), bot routing (`LARK_*`)
- Adding new env var: Vercel Dashboard + `.env.staging.example` + `.env.production.example`
- NEVER commit real secrets. `.env.local` gitignored.

### Git (see `.claude/rules/git-flow.md`)

- Staging-first: merge `feat/FXX-YY-*` → `staging` → (QA) → `main`
- PR title: `type(scope): lowercase description` (max 72 chars, commitlint gates)
- Use `Relates to #N` — NEVER `Closes #N` (issues close after QA)
- DO NOT use `--no-verify`; fix commitlint errors instead

### Testing (see `.claude/rules/testing.md`)

- Every test → TC-ID from `docs/qa/F*.md`
- Import from source — NEVER re-implement logic in tests
- DO NOT fake data, mocks, cheats to pass CI

## Key files

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel build/deploy config; `git.deploymentEnabled: false` (do not change) |
| `.vercelignore` | Excludes plans/docs/.claude from `vercel deploy --prebuilt` upload |
| `scripts/db-setup.js` | Migration executor; runs as part of `vercel build` buildCommand |
| `scripts/check-migrations.js` | CI schema validation (hard gate) |
| `scripts/check-env-vars.js` | CI env var validation (hard gate) |
| `src/payload.config.ts` | Payload + DB config |
| `src/collections/*.ts` | Collection definitions (schema source of truth) |
| `.github/workflows/ci.yml` | CI pipeline (quality + test + deploy-staging + deploy-production) |
| `.github/actions/smart-notify/action.yml` | Lark notify action (calls prime-bot-assistant API) |
| `.github/GIT_AND_CI_RULES.md` | Git rules + issue lifecycle |
| `.github/CONTRIBUTING.md` | Dev/QC workflow guide |
| `commitlint.config.js` | Conventional commit validation (husky commit-msg hook) |
| `plans/260413-1126-vercel-deploy-blocked/` | Plan + reports for Vercel CI rollout |

## When to edit what

| Change type | Edit location |
|-------------|---------------|
| New domain rule (e.g. Stripe integration) | Create `.claude/rules/{domain}.md` with YAML path-scoping |
| New rule that applies globally (not path-specific) | Add to this file IF ≤5 lines, else create rule file |
| Code standard (lint/TS/naming) | `docs/standards/CODE_STANDARDS.md` |
| Architecture decision | `docs/architecture/_OVERVIEW.md` (or per-feature `F*.md`) + `docs/journals/{date}-{slug}.md` |
| Roadmap/milestone change | `docs/PROJECT_ALIGNMENT.md` (PM) + `docs/tracking/OPEN_BLOCKERS.md` |
| Feature spec | `docs/prd/F*.md` (PM) |
| Feature architecture | `docs/architecture/F*.md` (Dev) |
| QA test plan | `docs/qa/F*.md` (QC) |

## Legacy notes

- **Docker standalone (DO)** — deprecated 2026-04-12. DigitalOcean App Platform retired. `Dockerfile` kept for local `docker-compose` dev only.
- **DO env sync** — `.github/scripts/sync-do-envs.py` defunct since 2026-04-12, removal pending.

## For detailed guidance

Read the relevant `.claude/rules/*.md` file (auto-loaded by path scope) OR `docs/*.md` canonical file. Do not duplicate content between CLAUDE.md and rule/doc files — each fact lives in exactly one place.
