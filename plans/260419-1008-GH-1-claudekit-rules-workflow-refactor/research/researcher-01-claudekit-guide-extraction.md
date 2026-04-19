# ClaudeKit Best Practices Research — Extraction & Recommendations

**Date:** 2026-04-19 | **Source:** https://claudekit.thieunv.space/posts/claudekit-beginners-guide

---

## 1. Project Rules Structure

**CLAUDE.md Format (≤200 lines)**
- Build commands (`npm run dev`, `npm test`)
- Code style (async/await, module format, strict types)
- Architectural patterns
- Dev environment setup

**When file exceeds 200 lines → split into `.claude/rules/*.md`** with YAML path-scoping:

```yaml
---
paths:
  - "src/api/**/\*.ts"
---
# API Design Rules
- Validate input via Zod
- Standard error responses
```

**Loading Order** (concatenated):
1. `~/.claude/CLAUDE.md` (global)
2. `<project>/CLAUDE.md` + `CLAUDE.local.md`
3. `~/.claude/rules/*.md` → project rules (later override)
4. Auto-memory (first 200 lines)

**Key Rule:** Context bloat kills adherence. Modular rules > monolithic docs.

---

## 2. Plan & Phase Structure

**Directory Naming:** `plans/{YYMMDD-HHMM}-{slug}/`

**Standard Layout:**
```
plans/260419-1008-gh-1-claudekit-refactor/
├── plan.md (overview <80 lines, status + phase links)
├── phase-01-audit-current-rules.md
├── phase-02-split-rules-by-domain.md
├── phase-03-implement-path-scoping.md
├── phase-04-update-memory-structure.md
├── reports/ (research outputs)
├── scout/ (codebase analysis)
└── research/ (external research)
```

**Phase File Sections:**
- Context Links (related reports, docs)
- Overview (priority, status, brief desc)
- Key Insights (important findings)
- Requirements (functional + non-functional)
- Architecture (system design, data flow)
- Related Code Files (files to modify/create/delete)
- Implementation Steps (numbered, specific)
- Todo Checklist (tracking)
- Success Criteria (definition of done)
- Risk Assessment (mitigations)
- Security Considerations
- Next Steps (dependencies)

---

## 3. Skill Routing

**Domain Routing (Conditions-based):**
- Frontend? → `/ck:frontend-design` (mockups) | `/ck:frontend-development` (React/TS) | `/ck:ui-styling` (Tailwind)
- Backend? → `/ck:backend-development` (NestJS/FastAPI) | `/ck:databases` (schema/queries)
- Infrastructure? → `/ck:deploy` (Vercel/Railway) | `/ck:devops` (Docker/K8s/CI)
- Security? → `/ck:security` (audit) | `/ck:security-scan` (secrets/OWASP)
- Testing? → `/ck:test` (runners) | `/ck:web-testing` (Playwright/k6)
- AI/LLM? → `/ck:context-engineering` (memory/agents) | `/ck:ai-multimodal` (images/audio)

**Workflow Routing (Sequential Chaining):**
```
/ck:brainstorm [explore options]
  ↓
/ck:plan [detail phases + research]
  ↓
/ck:cook [implement + review gates + test]
  ↓
/ck:code-review [final audit]
  ↓
/ck:ship [build → deploy]
  ↓
/ck:journal [document decisions]
```

**Skip conditions:**
- No brainstorm: already know approach, specific bug, PRD provided
- No plan: typo fix, one-liner → `/ck:cook --fast`

---

## 4. Subagent Orchestration

**Delegation Roles:**
| Role | Trigger | Scope |
|------|---------|-------|
| **planner** | Feature/epic → create phases + TODO tasks | plan.md + phase files |
| **researcher** | Parallel tech research (3+ independent topics) | reports/*.md |
| **tester** | After cook → verify simplified code | test results + coverage |
| **code-reviewer** | Before merge → audit clean tested code | review.md + comments |
| **debugger** | CI fail / user bug report → diagnose + fix | debug-report.md + fix |
| **docs-manager** | After features → update docs/codebase-summary.md | docs/*.md |

**Parallel vs Sequential:**
- **Parallel:** Code + Tests + Docs (independent)
- **Sequential:** Plan → Research (blocks) → Code → Test (blocks) → Review → Ship

**Context Isolation:**
- Explicit task desc, file paths, acceptance criteria
- NO session history; summarize decisions
- Scope file refs (specific paths, not "look at codebase")
- Include plan context (phase file text, not full plan)

---

## 5. Commit / PR / Git Flow

**Conventional Commits:**
```
feat(auth): add Google OAuth login
fix(api): handle null response from payment gateway
chore(deps): upgrade Next.js to 14.2
test(user): add unit tests for user service
```

**Rules:**
- Max 72 chars subject line
- Imperative mood: "add", "fix", "update"
- Reference ticket: `feat(auth): add Google OAuth (PROJ-123)`

**Branch Naming:** `type/FXX-YY-short-desc`
- `feat/F01-01-generate-site`
- `fix/F01-builder-crash`
- `hotfix/F13-payment-timeout`

**PR Template:**
```markdown
## Story
- **Relates to:** #N
- **Ticket:** US-FXX-YY
- **Description:** 1-2 sentences

## Changes
- [x] Change 1
- [x] Change 2

**Breaking Change:** No

## Checklist
- [x] 9-Point Done (Loading, Empty, Error, Mobile, TypeScript clean)
- [x] Tests added/updated
- [x] Security: no secrets, input validated

## Test Steps
1. Step verify
2. Happy path + edge case
```

---

## 6. Documentation Lifecycle

**Docs to Update (Post-Feature):**
- `docs/codebase-summary.md` → architecture changes
- `docs/code-standards.md` → new patterns introduced
- `docs/system-architecture.md` → data flow changes
- `docs/project-overview-pdr.md` → scope updates
- `docs/development-roadmap.md` → milestone progress

**Trigger Points:**
- Feature implementation → update roadmap + changelog
- Major milestone → review + adjust phases
- Bug fix → record in changelog + risk mitigation
- Security update → document version + impact
- Weekly review → update progress percentages

---

## 7. Testing / Quality Gates

**Definition of Done (Dev):**
- ✅ Feature matches PRD
- ✅ Unit tests (>80% coverage for new code)
- ✅ Integration tests for API endpoints
- ✅ TypeScript clean (`tsc --noEmit`)
- ✅ No lint errors (`eslint`)
- ✅ No secrets in code
- ✅ Reviewer assigned

**QC Acceptance Criteria:**
- ✅ Happy-path flows per PRD
- ✅ Edge cases + error states handled
- ✅ UI matches design (mobile responsive)
- ✅ Performance acceptable
- ✅ No regressions on existing features

**Command Sequence:**
```
/ck:test [path]              # Run tests + coverage
/ck:code-review --pr N       # Pre-merge audit
/ck:watzup                   # Impact analysis + git diff
/ck:git cm "message"         # Commit verified code
```

---

## 8. Anti-Patterns (What NOT to Do)

| Anti-Pattern | Risk | Fix |
|---|---|---|
| Task switch without `/clear` | Context pollution, ↓accuracy | Clear between unrelated work |
| CLAUDE.md >200 lines | Rule adherence drops | Split into rules/*.md subdirs |
| Vague prompts ("make better") | Claude guesses | State location, symptom, expected behavior |
| Skip planning for "simple" tasks | Edge cases → 3x rework | Use `/ck:plan --fast` |
| No verification step | Ship broken code | Always `/ck:test` + code review |
| Kitchen-sink sessions | Context bloat | Use `/clear` between tasks |
| Long session history | Memory pollution | Context reset when switching domains |

---

## 9. Slash Commands (Core 14)

| Command | Purpose | Output |
|---|---|---|
| `/ck:brainstorm` | Explore options, trade-offs | Document with recommendation |
| `/ck:plan` | Detail implementation phases | plan.md + phase files |
| `/ck:cook` | Main implement (8-step workflow) | Code + tests + verified |
| `/ck:fix` | Bug diagnosis + repair | Fixed code + regression tests |
| `/ck:test` | Run test suites + coverage | Test results |
| `/ck:scout` | Codebase exploration | Directory tree + architecture |
| `/ck:code-review` | Review code or PR | Feedback + suggestions |
| `/ck:debug` | Root cause analysis | Diagnosis + fix approach |
| `/ck:ask` | Senior engineer Q&A | Explanation + examples |
| `/ck:git cm` | Commit with message | Git history |
| `/ck:ship` | Full release pipeline | Build → test → deploy |
| `/ck:watzup` | Session summary | Change analysis + impact |
| `/clear` | Reset context | Clean session state |
| `/memory` | Toggle auto-memory | Enable/disable persistence |

---

## 10. Context Management (Critical)

**Preserve Token Budget:**
- Path-scoped rules (load only when needed)
- CLAUDE.md <200 lines (core adherence)
- `/clear` between unrelated tasks
- Auto-memory (first 200 lines/25KB)
- Topic files (lazy-load, no duplication)
- Symlinks for shared rules

**Coding Level** (via `/ck:coding-level [0-5]`):
- 0 = ELI5 (beginner explanation)
- 2 = Mid-level (design patterns)
- 3 = Senior (trade-offs, architecture)
- 5 = God Mode (default; assumes 15+ yrs experience)

---

## Fit for ech-prime-web-v2

**Current State:**
- Vercel CI-driven (VERCEL_TOKEN, Option B deployed)
- 400-line CLAUDE.md (near split threshold)
- 5 domain rules in `~/.claude/rules/` (global)
- 450→<10 errors/day (500 fix campaign merged 2026-04-15)

**Recommended Actions (Priority Order):**

1. **Audit Rules Split** — move `development-rules.md`, `vercel-deploy.md`, `database-schema.md` to project-level `.claude/rules/` with path-scoping
2. **Shrink CLAUDE.md** → keep only: build commands, git flow, env var rules, Vercel CI-specific (stay ≤150 lines)
3. **Implement Phase Structure** → retroactively add phase files to completed plans (260413-1126-vercel, 260415-500-fix)
4. **Activate `/clear` Protocol** → document in `CLAUDE.md` when switching between unrelated features/bugs
5. **Update Orchestration Docs** → `.github/CONTRIBUTING.md` reference `/ck:plan` → `/ck:cook` workflow (not ad-hoc)
6. **Memory Index** → expand `~/.claude/projects/.../memory/MEMORY.md` to track: Vercel secrets rotation pending, 🔐 S3 key rotation needed, Codex JWT secret mismatch, missing Stripe/Lark creds

---

## Unresolved Questions

1. **Auto-memory toggle:** Should ech-prime enable persistent memory? Risk: stale memory during active sprints. Mitigation: weekly "memory hygiene" reviews?
2. **Domain-scoped rules inheritance:** Do project-level rules in `.claude/rules/` override global `~/.claude/rules/` or merge? Clarify in project CLAUDE.md.
3. **Skill catalog update cadence:** When to run `/ck:brainstorm` vs jump straight to `/ck:plan`? Define "sufficiently researched" threshold for your team.
4. **Phase file auditing:** Retroactively add phase structure to completed plans? or only new plans? Trade-off: documentation completeness vs context budget.

---

**Status:** DONE | **Token Estimate:** ~3,200 (research + extraction)
