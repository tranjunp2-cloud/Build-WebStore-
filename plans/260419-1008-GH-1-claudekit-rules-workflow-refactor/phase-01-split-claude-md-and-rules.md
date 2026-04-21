# Phase 01 — Split CLAUDE.md + create `.claude/rules/`

## Context Links

- Parent: [plan.md](plan.md)
- Research: `research/researcher-01-claudekit-guide-extraction.md` (§1, §10), `research/researcher-02-current-state-audit.md` (§1, §2)
- Current file: `CLAUDE.md` (~400 lines)

## Overview

- **Date:** 2026-04-19
- **Priority:** P1 (keystone for 02/03/04)
- **Status:** pending
- **Review status:** —
- **Description:** Shrink project `CLAUDE.md` to ≤200 lines; extract domain rules to `.claude/rules/*.md` with YAML path-scoping. Preserves every current fact — just relocates.

## Key Insights

- ClaudeKit: context bloat >200 lines → rule adherence drops. Split by domain, load on demand via path scoping.
- Current `CLAUDE.md` mixes 8+ domains: Payload schema, Vercel deploy, email, env vars, git, PR, commit, testing, key files.
- Rich content, zero duplication across sections — safe to split without content loss.

## Requirements

**Functional**
- Every fact in current `CLAUDE.md` lands in exactly one destination (rule file OR canonical doc).
- New `CLAUDE.md` contains: role, tech stack one-liner, pointer index to rules + docs, project-specific overrides only.
- Path scoping matches actual file locations (e.g. `src/collections/**/*.ts` for schema rule).

**Non-functional**
- Claude Code still auto-loads relevant rule when editing matching path.
- Rules readable standalone (no "see CLAUDE.md §3" dangling refs).

## Architecture

```
CLAUDE.md (≤200 lines)
  ├─ pointer → .claude/rules/vercel-deploy.md
  ├─ pointer → .claude/rules/database-schema.md
  ├─ pointer → .claude/rules/env-vars.md
  ├─ pointer → .claude/rules/git-flow.md
  ├─ pointer → .claude/rules/testing.md
  ├─ pointer → .claude/rules/email-smtp.md        (new split target)
  └─ pointer → docs/* canonical (phase-02 output)
```

Loading order (per ClaudeKit): global `~/.claude/CLAUDE.md` → project `CLAUDE.md` → path-matched `.claude/rules/*.md` → auto-memory.

## Related Code Files

**Modify**
- `CLAUDE.md` (shrink to ≤200 lines)

**Create**
- `.claude/rules/vercel-deploy.md` (paths: `vercel.json`, `.github/workflows/ci.yml`, `.github/actions/smart-notify/**`, `scripts/db-setup.js`)
- `.claude/rules/database-schema.md` (paths: `src/collections/**/*.ts`, `scripts/db-setup.js`, `scripts/check-migrations.js`, `src/payload.config.ts`)
- `.claude/rules/env-vars.md` (paths: `.env*`, `scripts/check-env-vars.js`, `src/**/*.ts` for `process.env`)
- `.claude/rules/git-flow.md` (paths: `.github/**`, `commitlint.config.js`)
- `.claude/rules/testing.md` (paths: `src/__tests__/**`, `**/*.test.ts`, `**/*.test.tsx`, `tests/**`)
- `.claude/rules/email-smtp.md` (paths: `src/lib/email/**`, `src/payload.config.ts`)

**Delete:** none (CLAUDE.md rewritten in place)

## Implementation Steps

1. `grep -n` existing `CLAUDE.md` → map each section to target rule file (build mapping table first, commit as comment in PR description).
2. Create `.claude/rules/` dir. For each rule file:
   - Add YAML frontmatter `---\npaths:\n  - "glob"\n---`
   - Copy verbatim the relevant CLAUDE.md section.
   - Add "Source:" line linking back to CLAUDE.md commit SHA (pre-split).
3. Rewrite `CLAUDE.md`:
   - Keep: project 1-line pitch, stack 3-bullet list, pointer index, and 5–10 line "critical overrides" callout (e.g. `vercel.json git.deploymentEnabled: false` — non-negotiable).
   - Remove: expanded details now in rules.
   - Add: `docs/` canonical file pointers (stubs in phase-02, but point at paths now).
4. Verify line count: `wc -l CLAUDE.md` ≤ 200 (strict — decision 2026-04-19). If splitting leaves overflow, push to rules/ or docs/ rather than relaxing cap.
5. Manual test: ask Claude (in sub-session) "how do I add a new Payload array field?" → confirm rule file is pulled in and answer references Drizzle naming convention.

## Todo List

- [ ] Build section→destination mapping table
- [ ] Create `.claude/rules/` dir
- [ ] Write `vercel-deploy.md` with frontmatter + content
- [ ] Write `database-schema.md`
- [ ] Write `env-vars.md`
- [ ] Write `git-flow.md`
- [ ] Write `testing.md`
- [ ] Write `email-smtp.md`
- [ ] Rewrite `CLAUDE.md` (≤200 lines)
- [ ] `wc -l` verify
- [ ] Manual Claude Q&A smoke test (3 queries: schema, deploy, env)
- [ ] Open PR to `staging` with mapping table in description

## Success Criteria

- `wc -l CLAUDE.md` ≤ 200.
- 6 new rule files exist under `.claude/rules/`, each with `paths:` frontmatter.
- Diff shows zero lost facts (every CLAUDE.md section → 1 destination).
- Claude Q&A smoke test: 3/3 queries answered correctly using rule files.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Fact loss during split | Medium | High | Mapping table in PR desc; reviewer checks 1:1 |
| Path glob mismatch → rule not loaded | Medium | Medium | Test with sample edits on each target path |
| Rule files drift from CLAUDE.md overrides | Low | Medium | Pre-PR grep audit for duplicate facts |
| Devs edit only CLAUDE.md, miss rule file | Medium | Medium | Add "When to edit here vs rules/" section to CLAUDE.md |

## Security Considerations

- No secrets in rule files (they will commit to git). Env var rule names values by variable name only.
- Vercel token references stay pointer-only ("see GitHub Secrets"), no values.

## Next Steps

Unblocks phase-02 (docs can reference rule paths) and phase-03 (workflow doc uses same `.claude/rules/` pattern).
