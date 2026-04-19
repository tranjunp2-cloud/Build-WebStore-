# Phase 01 — Sync F05 Branch with Staging + Post-Merge Audit

## Context

- Parent: [plan.md](plan.md)
- Parent plan: [`260417-0817-wave1-wix-detailed-plan/plan.md`](../260417-0817-wave1-wix-detailed-plan/plan.md)
- Research: [researcher-01-a1-a2-audit](research/researcher-01-a1-a2-audit.md), [researcher-02-a3-c2-audit](research/researcher-02-a3-c2-audit.md)

## Overview

- Date: 2026-04-18
- Description: `fix/F05-ai-editor-improvements` branch is 19 commits behind `origin/staging`. Merge staging to pull wave1 (PR #690) + wave2 (PR #697) + related fixes. Then audit resulting HEAD against Wave 1 success metrics to surface residual gaps.
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights

- F05 has 0 unique commits vs staging (`origin/staging..HEAD` empty). Merge is safe — no conflicts expected from F05 side.
- Staging brings: `fb9579e7` (wave1), `87ed256b` (PR #690 merge), `d4c0b059` (wave2 a5 complete), `71ae153a` (PR #697 merge), plus F01 rubric + harness work.
- Untracked helper files in F05 workspace (`src/lib/ai/dedup-section-label.ts`, `fallback-svg.ts`, `variant-pool-validator.ts`, plus 4 test files) — these are identical to staging versions. **Decision**: delete untracked copies before merge to avoid "already exists" errors.

## Requirements

- Clean merge of `origin/staging` into `fix/F05-ai-editor-improvements`
- All 4 A-phase success metrics observable on resulting HEAD
- Audit report identifying any residual gap

## Architecture

No code changes this phase — git sync + inspection only.

## Related code files

- `src/lib/theme/resolve.ts` — verify `FALLBACK_COLOR_MODE === 'light'`
- `src/lib/ai/template-composer.ts` — verify `rotateStructuralVariants` exported + `placehold.co` count = 0
- `src/lib/ai/media-injector.ts` — count `BLOCK_IMAGE_SPEC` keys
- `src/lib/ai/fallback-svg.ts` — confirm present
- `src/lib/ai/variant-pool-validator.ts` — note scope (11 vs 14 blocks)
- `src/blocks/hero/variants/*.tsx` — grep overlay coverage
- `src/blocks/hero/_overlay.tsx` — exists?

## Implementation Steps

1. **Pre-merge cleanup**: stash or delete untracked files listed in `git status` that conflict with staging-shipped versions:
   ```
   src/lib/ai/dedup-section-label.ts
   src/lib/ai/fallback-svg.ts
   src/lib/ai/variant-pool-validator.ts
   src/__tests__/unit/ai/dedup-section-label.test.ts
   src/__tests__/unit/ai/variant-pool-validation.test.ts
   src/__tests__/unit/ai/variant-rotation.test.ts
   src/__tests__/unit/theme/a2-fallback-hardening.test.ts
   ```
   Recommend `git stash -u` so we can restore if merge misses a file.

2. **Fetch + merge**: `git fetch origin && git merge origin/staging` (no-ff OK). If conflicts → document + resolve favoring staging for wave1 scope.

3. **Run `pnpm test`**: confirm baseline green.

4. **Run checks** (bash snippets):
   ```bash
   grep -c "placehold.co" src/lib/ai/template-composer.ts        # want 0
   grep "FALLBACK_COLOR_MODE =" src/lib/theme/resolve.ts          # want 'light'
   grep -c "^export function rotateStructuralVariants" src/lib/ai/template-composer.ts  # want 1
   grep -c "dedupSectionLabel" src/lib/ai/template-composer.ts    # will be 0 → A3.3 gap
   wc -l src/lib/ai/fallback-svg.ts                                # confirm ~27 lines
   ```

5. **Hero overlay audit**: `grep -l "from-black" src/blocks/hero/variants/*.tsx | wc -l` (want 11 if A3.1 shipped; otherwise flag as gap).

6. **BROKEN_VARIANTS audit**: read L41-50 of `template-composer.ts`, count entries. Flag if only `hero` tracked.

7. **Write audit report** to `reports/post-merge-audit-YYYYMMDD-HHMM.md` listing: shipped ✅, gap ❌, verify-needed ❓.

## Todo list

- [ ] Stash untracked files
- [ ] `git fetch origin`
- [ ] `git merge origin/staging` (commit message: `chore: merge staging to pull wave1+wave2`)
- [ ] `pnpm install` (in case staging added deps)
- [ ] `pnpm test` → baseline pass
- [ ] Run 6 grep checks from step 4
- [ ] Hero overlay audit (step 5)
- [ ] BROKEN_VARIANTS audit (step 6)
- [ ] Write audit report

## Success Criteria

- F05 HEAD = staging + 0 F05-unique diff (or merge commit only)
- `pnpm test` green
- Audit report lists each of 5 Wave 1 success metrics with ✅/❌/❓
- Gap list feeds Phase 02 scope

## Risk Assessment

- **Low — merge conflict**: F05 has no unique commits, so conflict probability low. If conflict arises in `payload-schema` or AI files, favor staging.
- **Medium — test regression from wave2**: wave2 expanded several variant counts; existing tests may need update. Document + propagate.
- **Low — missing deps**: `pnpm install` handles.

## Security Considerations

None. Pure git operation.

## Next steps

Phase 02: wire `dedupSectionLabel` into composer builders based on audit findings.
