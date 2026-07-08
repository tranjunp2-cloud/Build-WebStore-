# Phase 07 — Cleanup + deprecation note

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: Phase 06 (must be green before deprecating anything)
- Blocks: none
- Research: `./research/researcher-03-fallback-shape-adapter.md`, `./research/researcher-04-fallback-streaming-tests.md`

## Overview
- Date: 2026-04-14
- Description: Decide and document the fate of the legacy `generate-blocks.ts` path, add deprecation notes where appropriate, and update the upstream Plan A progress tracker. This phase should NOT delete code — the legacy path is still the second-tier safety net inside `generateWithFallback`.
- Priority: P2
- Status: pending
- Review status: not reviewed

## Key Insights
- `generate-blocks.ts` still has one live caller: the try/catch safety net in `generateWithFallback` (Phase 05).
- Removing it would be a regression if the composer ever throws at runtime.
- The safer posture is "legacy safety net, do not extend". Mark the file, not remove it.
- `composeTemplate` in template-composer.ts:1212 is already `@deprecated` — verify no new callers were introduced accidentally by this PR.
- Plan A progress lives in `plans/260407-0040-template-visual-diversity/` per the project memory — update its progress table after merge.

## Requirements
- JSDoc `@deprecated` + header comment in `generate-blocks.ts` explaining it is a second-tier fallback only.
- Same deprecation wording reflected in `fallback-adapter.ts` or `openai-generator.ts` where it is called, so future devs find the explanation.
- Update Plan A phase-06 progress tracker (or create one if missing).
- Note the known pre-existing double-`done` bug (route.ts:478 vs generator done) as a follow-up task — do NOT fix here.

## Architecture
N/A — documentation phase.

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/generate-blocks.ts` (add file-level `@deprecated` JSDoc)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/openai-generator.ts` (inline comment on legacy catch branch)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/plans/260407-0040-template-visual-diversity/` (Plan A progress dir — find progress file, update)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/.claude/worktrees/template-audit/plans/260414-0840-fallback-composer-unify/plan.md` (mark status → done)

## Implementation Steps
1. Add top-of-file JSDoc to `generate-blocks.ts`:
   ```ts
   /**
    * @deprecated Second-tier safety net only. Primary fallback path is
    * composeFallbackResult() in ./fallback-adapter.ts. Do not extend this
    * file — new industry content goes in src/lib/ai/content/*.ts.
    */
   ```
2. Add inline comment in `openai-generator.ts` at the legacy catch branch:
   `// Legacy safety net — runs only if composeFallbackResult throws. See plan 260414-0840.`
3. Grep the codebase for any direct `import { generateBlocks }` other than `openai-generator.ts` and `generate-blocks.test.ts`. Document findings in the phase file. If new callers exist, leave a TODO.
4. Locate Plan A progress tracker (`plans/260407-0040-template-visual-diversity/`). Update the Phase 06 row: status → done, link to this plan.
5. Add a "Known follow-ups" section to the parent `plan.md` listing:
   - Double-`done` SSE event in route.ts:478 (pre-existing)
   - Consider multi-page fallback (variant=professional) once `GenerationResult.pages[]` is consumed downstream
   - Vietnamese keyword expansion in composer category resolver
6. Mark this plan's `status: pending` → `status: done` in frontmatter (after Phase 06 signs off, not before).

## Todo list
- [ ] Add deprecation JSDoc to `generate-blocks.ts`
- [ ] Add explanatory comment in `openai-generator.ts` catch branch
- [ ] Grep for stray `generateBlocks` callers; document
- [ ] Update Plan A progress tracker row
- [ ] Add "Known follow-ups" list to parent `plan.md`
- [ ] Flip plan status to done

## Success Criteria
- `@deprecated` tag visible in `generate-blocks.ts`.
- Plan A tracker shows this phase as done with link back to this plan dir.
- Parent `plan.md` has a "Known follow-ups" section.
- Manual verification: open `generate-blocks.ts` in IDE and confirm the deprecated warning is surfaced by the TS language service on any new import attempt.

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Accidentally deleting `generate-blocks.ts` and breaking the safety net | Low | Phase explicitly says "do not delete" |
| `@deprecated` causes noise in existing legitimate call sites | Low | Only one legitimate caller remains |
| Plan A tracker location moved — cannot find it | Low | Git log of `plans/260407*` will surface current path |

## Security Considerations
None — documentation only.

## Next steps
Merge the PR and monitor staging for 24h. Any fallback-path errors should now surface with `[Fallback] composer failed` in logs.
