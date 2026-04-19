---
name: workflow
description: Primary AI workflow for ech-prime-web-v2 — feature/bug/investigation flows, decision matrix, skill routing
---

# Workflow

Extends `~/.claude/rules/primary-workflow.md` with project-specific flows for Next.js + Payload CMS + Vercel CI context. When this file conflicts with the global rule, this wins for ech-prime-web-v2 work.

## Flows

### Feature flow (new US-FXX-YY)

```
planner → cook → tester → code-reviewer → docs-manager → git-manager
```

1. **planner** — creates `plans/{date}-{slug}/` with `plan.md` + `phase-XX.md` files
2. **cook** — executes phases (implementation)
3. **tester** — runs `npm test`, verifies 100% pass on new code
4. **code-reviewer** — reviews diff for correctness, security, performance
5. **docs-manager** — updates `docs/CODEBASE_SUMMARY.md`, `docs/CHANGELOG.md`, `docs/architecture/F*.md` if surface changed
6. **git-manager** — conventional commit, PR to `staging`

### Bug flow (BUG-FXX or staging incident)

```
debugger → fix → tester → code-reviewer → git-manager
```

1. **debugger** — root-cause analysis, proposes minimal fix
2. Implement fix (inline or via `/ck:fix --auto` for CI failures)
3. **tester** — regression test for the specific scenario
4. **code-reviewer** — confirm fix doesn't regress other paths
5. **git-manager** — `fix(scope):` commit + PR

### Investigation flow (open-ended, no immediate implementation)

```
scout → debugger OR brainstorm → plan
```

- `/ck:scout` — discover relevant files, patterns
- `/ck:debug` OR `/ck:brainstorm` — root-cause or explore options
- `/ck:plan` — document approach, stop before implementation

### Docs-only refactor

```
planner → cook (docs edits) → code-reviewer (content review) → git-manager
```

Skip tester (no runtime code).

## Decision matrix

| I want to... | Use |
|--------------|-----|
| Implement feature X per spec | `/ck:plan` → `/ck:cook` |
| Execute an existing plan | `/ck:cook <plan-path>` |
| Fix a bug with clear symptom | `/ck:fix` |
| Fix CI failure (flake or real) | `/ck:fix --auto` |
| Understand how X works | `/ck:scout` → optionally `/ck:ask` |
| Explore options before committing | `/ck:brainstorm` |
| Quick one-liner (typo, import, const) | Edit directly — no plan needed |
| Add a new Payload collection | `planner` first (DB migration required) |
| Touch Vercel deploy config | Pause — read `.claude/rules/vercel-deploy.md` first |
| Add env var | Vercel Dashboard + `.env.*.example` — see `.claude/rules/env-vars.md` |
| Write a test | Follow `.claude/rules/testing.md` — TC-ID required |
| Refactor only (no behavior change) | `/ck:simplify` or `code-simplifier` agent |

## Skip conditions

Skip planner when:
- Typo / one-liner fix
- Revert a specific commit
- Rename / move a file (no logic change)

Skip tester when:
- Docs-only change
- Comment-only change
- `.claude/rules/*.md` edit

Skip code-reviewer when:
- `--auto` mode with 0 critical findings AND score ≥ 9.5 (per cook rules)

NEVER skip git-manager (commits must be conventional).

## `/clear` protocol

Use `/clear` between:
- Unrelated bug + feature work (e.g. finish F05 bug → clear → start F09 feature)
- Different feature areas (F01 → F08 context switch)
- After long research / planning sessions before implementation
- When context usage > 80% and next task is independent

Don't `/clear` between:
- Phases of the same plan
- Tight sub-tasks within one feature
- Review → fix → re-review loop

## Skill routing (ech-prime-web-v2 stack)

| Task area | Skill |
|-----------|-------|
| Next.js App Router, RSC, Turbopack | `/ck:web-frameworks` or `/vercel:nextjs` |
| Payload CMS schema + queries | `/ck:databases` |
| Tailwind + shadcn styling | `/ck:ui-styling` |
| React components / patterns | `/ck:frontend-development` |
| Vercel deploy issues | `/vercel:deployments-cicd` |
| Vercel env vars | `/vercel:env-vars` |
| Drizzle / Postgres (Neon) | `/ck:databases` |
| Testing (unit/e2e/visual) | `/ck:web-testing` or `/ck:test` |
| AI gen / OpenAI SDK | `/ck:ai-multimodal` or provider docs |
| Stripe integration (F13) | `/ck:payment-integration` |
| Security audit | `/ck:security` or `/ck:security-scan` |
| Docs search | `/ck:docs-seeker` |

## Worked examples

**Example 1 — "Implement F15 admin dashboard":** Full feature flow. `/ck:plan` → reads `docs/prd/F15-admin.md` → creates `plans/{date}-f15-admin/` with phase files → `/ck:cook <plan>` executes → tester → code-reviewer → docs-manager updates `CODEBASE_SUMMARY.md` + `CHANGELOG.md` + `architecture/F15-*.md` → git-manager commits + PR to staging.

**Example 2 — "Staging 500 on /api/ai/generate":** Bug flow. `/ck:debug` scouts Vercel logs + code → identifies OpenAI timeout → proposes retry with exponential backoff → implement fix in `src/lib/ai/` → tester writes regression test (mock OpenAI timeout) → code-reviewer approves → git-manager `fix(ai): add retry on OpenAI timeout` → PR to staging.

**Example 3 — "Explore moving to tRPC":** Investigation flow. `/ck:scout` → maps current REST endpoints under `src/app/api/v1/*` → `/ck:brainstorm` — tRPC vs REST tradeoffs given Payload CMS's own GraphQL + REST → `/ck:plan` documents decision + migration phase plan → STOP. No code yet.
