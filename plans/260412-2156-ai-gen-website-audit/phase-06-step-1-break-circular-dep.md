# Phase 01 — Break circular dep

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: none (this is the blocker for every other phase)
- Research: `./research/researcher-04-fallback-streaming-tests.md` Q4

## Overview
- Date: 2026-04-14
- Description: Move `enforceMinContent` + `VARIANT_MIN_CONTENT` out of `openai-generator.ts` into a neutral module so that `openai-generator.ts` can safely import from `template-composer.ts` (and vice versa) without creating an import cycle.
- Priority: P1 (blocker for Phase 04 + 05)
- Status: pending
- Review status: not reviewed

## Key Insights
- `enforceMinContent` is a pure function — zero Payload, zero AI, zero network deps.
- It is currently the ONLY symbol composer pulls from `openai-generator.ts` (`template-composer.ts:5`).
- As soon as Phase 05 adds `import { composeFromBlueprint } from './template-composer'` to `openai-generator.ts`, we get a cycle. Must land first.
- Moving the constant table `VARIANT_MIN_CONTENT` along with the function keeps it as a single source of truth.

## Requirements
- New file has no imports from `openai-generator.ts` or `template-composer.ts`.
- Behavior bit-identical to current.
- Both consumers updated in the same commit.
- TypeScript clean, existing tests still pass without modification.

## Architecture
```
before:
  template-composer.ts ─▶ openai-generator.ts (enforceMinContent)

after:
  template-composer.ts ─┐
                        ├─▶ variant-validation.ts (enforceMinContent, VARIANT_MIN_CONTENT)
  openai-generator.ts  ─┘
```

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/openai-generator.ts` (lines 607-626 source of truth for function + table)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/template-composer.ts` (line 5 import, line 920 call site)
- NEW: `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/variant-validation.ts`

## Implementation Steps
1. Create `src/lib/ai/variant-validation.ts`.
2. Copy `VARIANT_MIN_CONTENT` object literal verbatim from openai-generator.ts (lines ~607-620).
3. Copy `enforceMinContent` function body verbatim (lines ~620-626). Keep the `console.warn` call as-is.
4. Export both as named exports.
5. In `openai-generator.ts`: delete the original block and replace with `export { enforceMinContent, VARIANT_MIN_CONTENT } from './variant-validation'` so existing external callers (if any) stay source-compatible.
6. In `template-composer.ts:5`: change import path from `'./openai-generator'` to `'./variant-validation'`.
7. Run `pnpm tsc --noEmit`.
8. Run `pnpm vitest run src/__tests__/unit/lib/ai` to smoke the two modules.

## Todo list
- [ ] Create `variant-validation.ts`
- [ ] Delete duplicate in `openai-generator.ts`, add re-export for compat
- [ ] Update `template-composer.ts` import
- [ ] `tsc --noEmit` passes
- [ ] Affected unit tests still green
- [ ] Grep for other importers of `enforceMinContent` / `VARIANT_MIN_CONTENT` and confirm they resolve

## Success Criteria
- `tsc --noEmit` exits 0.
- `pnpm vitest run src/__tests__/unit/lib/ai/openai-generator.test.ts src/__tests__/unit/templates/template-composer.test.ts` green.
- `grep -rn "enforceMinContent" src/` shows: 1 definition in `variant-validation.ts`, 1 re-export in `openai-generator.ts`, 1 import in `template-composer.ts` (and whatever legacy callers exist).
- Manual verification: open `variant-validation.ts` and confirm no import of either sibling file. Open `template-composer.ts` and confirm line 5 points to `./variant-validation`.

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| External code imports `VARIANT_MIN_CONTENT` directly from openai-generator | Low | Keep re-export for source-compat, don't change public surface |
| Console warn behavior subtly differs if module load order changes | Very low | Function is pure; module evaluation order irrelevant |
| Missed some call site and tests break | Low | Grep before commit |

## Security Considerations
None. Pure refactor, no IO, no user input.

## Next steps
Phase 02 (font pairing resolver) can start in parallel after this lands — it does not depend on Phase 01 but should be on the same branch to avoid rebase churn.
