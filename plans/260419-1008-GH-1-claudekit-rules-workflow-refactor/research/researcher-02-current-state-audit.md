# Current State Audit — Rules, Workflows & Docs
**Date:** 2026-04-19  
**Project:** ECH Prime Web v2  
**Status:** Complete

---

## 1. Project-Level CLAUDE.md — What Exists ✓ What's Missing ✗

### Exists ✓
- **DB Schema Rules:** Payload Drizzle naming convention (array/select/group/relationship) — DETAILED, clear examples
- **Vercel CI Architecture:** CI-driven deploy via VERCEL_TOKEN, webhook disabled, 3-stage validation, rollover checks
- **Legacy Docker notes:** Deprecated DO App Platform (2026-04-12), retained for `db-setup.js` pattern reference
- **Email/SMTP:** AWS SES configured, Payload + custom utility patterns
- **Environment Variables:** Vercel Dashboard as source of truth, GitHub Secrets split (CI-only vs app vars), 22 secrets cataloged
- **Git Flow:** GitHub Flow (staging-first), branch naming convention (`feat/FXX-YY-*`), PR rules, Conventional Commits
- **Testing:** Refs to `docs/TEST_CONVENTION.md`, gold-standard test files listed
- **Key Files:** 14 critical files documented (vercel.json, ci.yml, db-setup.js, etc.)

### Missing ✗
- NO section on project structure (where src/app/components/lib live) — blank gap
- NO CODE QUALITY section (linting rules, TypeScript strictness, error handling patterns)
- NO MODULE SIZE / MODULARIZATION guidance (file should stay <200 lines per workspace CLAUDE.md)
- NO IMPORT conventions (relative vs absolute, from `@/` alias, co-location rules)
- NO SECURITY checklist (OWASP, input validation, auth/authz guards specific to Payload/Next.js)
- NO TESTING pyramid or coverage targets
- NO API design rules (RESTful routes, response shape, pagination, status codes)
- NO DATABASE performance guidance (N+1 queries, index hints, query optimization)
- NO BREAKING CHANGE protocol

**⚠️ CONFLICT:** Workspace CLAUDE.md §4 defines Next.js structure + naming. Project CLAUDE.md assumes same but doesn't repeat — could confuse new devs who read project-level only.

---

## 2. Workspace-Level CLAUDE.md vs Project-Level

| Domain | Workspace | Project | Status |
|--------|-----------|---------|--------|
| **Tech Stack** | Comprehensive (NestJS, FastAPI, Expo, Postgres, Redis, BullMQ) | Missing — assumes inherited | ⚠️ Partial |
| **Project Structure** | Next.js, NestJS, FastAPI layouts (§4) | Assumes inherited, no repeat | ⚠️ Needs callout |
| **Naming Conventions** | Complete (variables, files, DB, API, env) | Assumes inherited | ⚠️ Unclear if inherited |
| **Code Quality** | SOLID, security-first, error handling | NONE | ✗ Gap |
| **Git Workflow** | Generic (not specific to ECH) | **ECH-specific + detailed** | ✓ Project overrides |
| **Conventional Commits** | Basic format | Detailed + enforced by Commitlint | ✓ Project extends |
| **Testing** | Vitest + RTL + Playwright (framework names only) | TEST_CONVENTION.md ref + gold files | ✓ Project specifies |
| **Database** | Migrations, no edit schema directly | **Payload Drizzle specifics** | ✓ Project details |
| **Env Vars** | Generic config strategy | **Vercel + GitHub split** | ✓ Project specifies |

**⚠️ Key Issue:** Project CLAUDE.md is **implementation-heavy** (DB, Deploy, Env) but **lacks foundational rules** (code structure, linting, modularization, imports, API design). Assumes dev read workspace CLAUDE.md first.

---

## 3. `.claude/` Directory Structure

```
.claude/
├── agents/         ← 160 subdirs (team agents: planner, cook, etc.)
├── commands/       ← 25 slash commands (workflows)
├── hooks/          ← Subagent hooks (naming, memory)
├── skills/         ← 10 skill modules (.venv/, scripts/)
├── settings.json   ← [NOT READ — privacy rule]
├── settings.local.json ← [NOT READ]
└── launch.json     ← VSCode debug config
```

**Status:** ✓ Workspace infrastructure active. No project-specific overrides in ech-prime-web-v2/.

---

## 4. Existing Docs/ Structure — Against ClaudeKit Canonical

| ClaudeKit Expected | Project Has | Status | Notes |
|---|---|---|---|
| `codebase-summary.md` | ✗ | Missing | NO overview of what's in src/ |
| `code-standards.md` | ✗ | Missing | NO linting/formatting/import rules |
| `system-architecture.md` | ✗ | Missing | NO architecture diagram/layers |
| `project-overview-pdr.md` | ✗ | Missing | NO PRD/vision/business context |
| `development-roadmap.md` | ✗ | Missing | NO phase timeline |
| `project-changelog.md` | ✗ | Missing | NO detailed change log |
| `design-guidelines.md` | ✗ | Missing | NO UI/component design rules |
| `deployment-guide.md` | ✓ Partial | `.github/DEPLOY.md` | Deploy-specific but no infra setup |
| **INSTEAD — Project has** |
| `PROJECT_ALIGNMENT.md` | Exists | High-level biz alignment (PRD summary) |
| `TEST_CONVENTION.md` | Exists | Test patterns + TC-ID requirement |
| `TEST_ACCOUNTS.md` | Exists | QA credentials |
| `SPRINT0_DETAIL.md` | Exists | Sprint planning detail |
| `README.md` | Exists | Quick start (dev/setup) |
| `DB-LIFECYCLE.md` | Exists | Schema/migration workflow |
| `UNSPLASH_OPTIMIZATION.md` | Exists | Media optimization notes |
| `architecture/` | Dir with feature-specific PDRs (F01-F22) |
| `design/` | 27 subdirs (component specs, design tokens) |
| `prd/` | 37 PRD files (feature breakdowns) |
| `qa/` | 45 QA test cases (F01-F22) |
| `standards/` | Design + CSS standard snippets |
| `stories/` | 26 GitHub issue templates (story sync) |
| `tracking/` | Sprint/milestone CSVs |
| `testcases/` | QA test matrix (deprecated, moved to qa/) |
| `ui-specs/` | UI component specs (Figma refs) |

**Assessment:**  
✓ **Rich domain-specific docs** (PRD, QA, design standards)  
✗ **Missing foundational ClaudeKit docs** (architecture overview, code standards, modularization guide)  
⚠️ **Organizational debt:** Per-feature architecture PDRs scattered, no unified architecture map

---

## 5. Existing Plans/ Structure — Naming + Convention Check

### Sample Plan Directories (5 recent)

| Plan | Structure | Status |
|------|-----------|--------|
| `260419-1008-GH-1-claudekit-rules-workflow-refactor/` | `reports/`, `research/`, `scout/` dirs only. NO `plan.md` yet. | ⚠️ Scaffolded |
| `260418-2358-wave1-completion/` | `plan.md` + `phase-01/02/03.md` + `reports/`, `research/`, `scout/` | ✓ Correct |
| `260417-0817-wave1-wix-detailed-plan/` | `phase-01/02/03/04.md` + `plan.md` + `reports/`, `research/`, `scout/` | ✓ Correct |
| `260415-1344-wix-deep-rebuild/` | 27 files, `phase-*.md` + `plan.md` + reports | ✓ Correct |
| `260405-0524-url-to-website/` | `plan.md` + `phase-*.md` + `reports/`, `research/` | ✓ Correct |

**Naming Convention:** `YYMMDD-HHMM-{slug}` — **CONSISTENT** ✓

**Plan File Org:** Latest plans follow **plan.md + phase-XX.md + reports/ + research/** — **CONSISTENT** ✓  
Older plans (~260405-0524) have same structure → **established convention held for 2 weeks** ✓

**Phase Files Quality:**
- Include: overview, context links, key insights, requirements, architecture, implementation steps, todos, success criteria, risk assessment, next steps
- Missing (per ClaudeKit template): Security considerations section not in all (some have, some skip)
- **ACCEPTABLE** — pragmatic variation, not strict template adherence

---

## 6. Git/PR Rules — Enforcement Level

| Rule | File(s) | Enforced by | Status |
|------|---------|------------|--------|
| **Branch naming** `feat/FXX-YY-*` | `.github/GIT_AND_CI_RULES.md` (§2) | Lint warning (non-blocking) | ⚠️ Soft |
| **Conventional Commits** `type(scope): msg` | `commitlint.config.js` (committed) | Husky commit-msg hook (hard-block) | ✓ Hard |
| **PR title format** | `.github/pull_request_template.md` | Template suggestion only | ⚠️ Soft |
| **Relates to #N** not `Closes #N` | `.github/GIT_AND_CI_RULES.md` (§4.3) | Bot auto-fixes, narrative rule | ⚠️ Soft |
| **9-Point Done checklist** | PR template | Checkbox — not verified | ⚠️ Soft |
| **Test before push** | `.github/GIT_AND_CI_RULES.md` (§10) | Narrative only | ⚠️ Soft |
| **Database migrations** (Drizzle rules) | `scripts/check-migrations.js` (CI job) | Blocks PR merge if schema mismatch | ✓ Hard |
| **Env var naming** | `scripts/check-env-vars.js` (CI job) | Blocks PR if missing keys | ✓ Hard |

**Summary:** 2 hard gates (Commitlint, migrations, env-vars), 6 soft (templates, naming, practices).

---

## 7. Package.json Scripts — Quality Gates Available

```
dev, build, start, lint, prepare, generate:types, payload, db:push, db:seed,
db:seed-sso, db:reset, test, test:watch, test:coverage, test:e2e, test:e2e:ui,
test:all, typecheck, harness:gen, harness:quick, harness:check, harness:render,
harness:merge, harness:report, measure:variety, harness:all
```

**CI Gates in Use:**
1. `lint` (ESLint via next lint) — **warnings don't fail** ⚠️
2. `typecheck` (tsc --noEmit) — **hard check** ✓
3. `test` (vitest run) — **hard check** ✓
4. `build` (Next.js) — **hard check** ✓

**Plus custom checks:**
- `db:push` — schema push (manual, pre-commit)
- `db:seed` / `db:reset` — data reset (testing)
- `test:coverage` — coverage report (manual, not CI-gated)

**Coverage targets:** TEST_CONVENTION.md refs 15/04 deadline: Lines 60%, Branches 50%, Functions 50% ⚠️ **DEADLINE PASSED**

---

## 8. Journals Overview — Capture Frequency & Quality

```
docs/journals/
├── 260414-ai-gen-flow-overview.md       ← Deep dive on AI gen pipeline
├── 260414-session-ai-gen-deep-dive.md   ← ~25KB session log
├── 260414-ai-model-optimization.md      ← Model prompt tuning
├── 260415-500-fix-campaign.md           ← 8 bugs, mitigation plan
├── 260415-wix-deep-research.md          ← ~27KB competitor analysis
├── 260415-ai-gen-vs-template.md         ← Architectural decision doc
├── ... (10 total)
```

**Pattern:** Journals capture **strategic decisions, root-cause analyses, research, session context**. Not daily standup logs.  
**Frequency:** Ad-hoc, triggered by complex decisions or incidents.  
**Quality:** High — reads like architectural decision records, not chatter.

✓ **Effective use of journals for institutional knowledge.**

---

## Gap Analysis Matrix — Current vs ClaudeKit Expected

| Category | Current State | ClaudeKit Expected | Delta | Priority |
|----------|---------------|-------------------|-------|----------|
| **Foundational Rules** | Workspace CLAUDE.md (generic) + Project CLAUDE.md (deploy-heavy) | Unified, inheritance-aware project CLAUDE.md with code standards section | Add code-standards, modularization, imports, API design to project CLAUDE.md | HIGH |
| **Architecture Docs** | Feature-specific PDRs in `docs/architecture/F*.md` | `docs/system-architecture.md` (unified, with layer diagram) | Create unified arch overview; link to feature PDRs | HIGH |
| **Codebase Summary** | README.md (setup only) | `docs/codebase-summary.md` (src/ structure, key modules, entry points) | Create codebase-summary.md | HIGH |
| **Code Standards** | Assumed from workspace CLAUDE.md, scattered in TEST_CONVENTION.md | `docs/code-standards.md` (linting, formatting, imports, naming) | Consolidate lint rules, TypeScript config, import rules to code-standards.md | MEDIUM |
| **Roadmap** | SPRINT0_DETAIL.md (v1.0 detail), no timeline | `docs/development-roadmap.md` (v1.0 → v1.1 → v2.0 phases, dates) | Create roadmap.md with milestones, dates, dependencies | MEDIUM |
| **Changelog** | Git log (automated) + per-journal notes | `docs/project-changelog.md` (curated, per-release, impact notes) | Create changelog.md, curate per-PR | LOW |
| **Deployment Guide** | `.github/DEPLOY.md` (specific) + CLAUDE.md (scattered) | `docs/deployment-guide.md` (dev setup, staging, production, rollback) | Extract from CLAUDE.md + DEPLOY.md → standalone deployment-guide.md | MEDIUM |
| **Design Guidelines** | `docs/design/` + `docs/standards/` (component snippets) | `docs/design-guidelines.md` (Figma links, color, typography, accessibility) | Create design-guidelines.md linking to Figma + design/ dir | LOW |
| **Plan Structure** | Correct for 2+ weeks | Consistent (plan.md + phase-XX.md + reports/ + research/) | Continue current pattern (no change needed) | — |
| **Git/PR Enforcement** | 2 hard gates (Commitlint, migrations), 6 soft (templates, naming) | 4+ hard gates recommended | Harden PR title validation, test requirement, "no secrets" check via pre-commit | MEDIUM |

---

## Unresolved Questions

1. **Code linting strictness:** ESLint warnings don't fail CI. Should they? (Workspace CLAUDE.md doesn't specify)
2. **TypeScript strict mode:** Is `tsconfig.json` set to `strict: true`? Document assumption.
3. **Test coverage targets:** 260415 deadline passed (60% Lines, 50% Branches/Functions). Current coverage? Is deadline moved?
4. **Feature vs Chore PR naming:** Both `feat(F01): ...` and `chore(deps): ...` use same commit prefix. Is scope required in chore?
5. **Security checklist:** Who enforces input validation, OWASP rules? Narrative only, or code review checklist?
6. **Node polyfill necessity:** Why `--require ./node-polyfill.js` in dev/build? Document reason in CLAUDE.md.

---

## Summary

**Strengths:**
- Deployment architecture well-documented (Vercel CI-driven, webhook disabled, token strategy clear)
- Database schema rules detailed + enforced (CI gate)
- Git flow + PR workflow comprehensive (GitHub Flow, issue lifecycle, labels)
- Plans follow established convention (date-based naming, phase structure)
- Journals capture strategic knowledge effectively

**Weaknesses:**
- Code standards fragmented (workspace generic, project specific, TEST_CONVENTION scattered)
- No unified architecture overview (features in docs/architecture/F*.md, no map)
- Missing ClaudeKit canonical docs (codebase-summary, development-roadmap, deployment-guide, design-guidelines)
- Soft enforcement on PR/branch naming (template suggestion, not gated)
- Module size guidance absent (file under 200 lines rule in workspace, not in project)

**Recommended Next Steps (Priority Order):**
1. Create `docs/code-standards.md` (consolidate linting, imports, naming, TypeScript rules)
2. Create `docs/system-architecture.md` (unified layer diagram, link to F*.md PDRs)
3. Create `docs/codebase-summary.md` (src/ directory map, module entry points)
4. Harden PR validation (GitHub Actions check PR title format, test requirement)
5. Create `docs/development-roadmap.md` (v1.0→v1.1→v2.0, dates, blockers)
