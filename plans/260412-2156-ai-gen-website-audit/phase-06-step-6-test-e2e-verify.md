# Phase 06 — Test suite + e2e verification

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: Phase 01-05
- Blocks: Phase 07 (cleanup)
- Research: `./research/researcher-04-fallback-streaming-tests.md` Q3 (test file impact matrix)

## Overview
- Date: 2026-04-14
- Description: Run the affected test suites, fix assertions that drift due to the new event shape / composer-backed fallback, and manually regenerate a site in each of 5 representative categories to confirm the fallback now produces rich content.
- Priority: P1
- Status: pending
- Review status: not reviewed

## Key Insights
- Research identified 10 test files touched. 4 are UNAFFECTED, 4 ADAPT, 2 ADAPT/BREAK.
- Most breakages will be assertion counts on SSE event arrays, not logic changes.
- `ai-variety-fallback.test.ts` is the single biggest risk — it literally exists to assert on the fallback event cadence.
- E2E verification MUST exercise the fallback path, not the happy path. Easiest way: set `OPENAI_API_KEY=` to an invalid value in `.env.local`, run dev server, regenerate.

## Requirements
- All affected test files green.
- No new lint / tsc errors.
- 5 manual regenerations against 5 different categories (restaurant, health, fitness, tech, creative) produce visibly distinct, rich sites.
- Restaurant regeneration must render `menu-display`, `booking-widget`, and `faq` blocks populated (this is the canonical success signal for the whole refactor).

## Architecture
N/A — verification phase.

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/unit/lib/ai/openai-generator.test.ts`
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/unit/builder/ai-variety-fallback.test.ts`
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/unit/builder/ai-variety-composer.test.ts`
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/api/ai.test.ts`
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/unit/templates/template-composer.test.ts`

## Implementation Steps
1. `pnpm vitest run src/__tests__/unit/lib/ai src/__tests__/unit/builder src/__tests__/unit/templates src/__tests__/api/ai.test.ts` — capture failures.
2. For each failing assertion:
   - If it counts events: update to the new cadence (Phase 05 arch diagram).
   - If it asserts block count: accept composer's richer output (larger count is fine, use `>=` instead of `===`).
   - If it imports `enforceMinContent` from `openai-generator.ts`: update path to `variant-validation.ts` or rely on re-export.
3. Re-run tests until green.
4. `pnpm tsc --noEmit` must pass.
5. `pnpm lint` must pass.
6. Run `pnpm dev` locally with `OPENAI_API_KEY=sk-invalid` to force the fallback path.
7. For each category, hit `/api/ai/generate-site` via the builder UI and inspect the generated site:
   - Restaurant: `"Ristorante Bella Vista, family Italian in District 1, pasta and pizza"` → verify `menu-display`, `booking-widget`, `faq` present and populated; no empty gallery.
   - Health: `"Saigon Dental Clinic with 10 years experience, implant specialist"` → verify services, team, testimonial blocks populated.
   - Fitness: `"CrossFit Box 247, 24-hour access, women-only classes"` → verify class schedule / pricing blocks populated.
   - Tech: `"TaskFlow SaaS for solo founders, $19/month"` → verify pricing tiers + feature grid populated.
   - Creative: `"Minh Nguyen, wedding photographer in Hanoi"` → verify portfolio / gallery blocks populated.
8. Screenshot each generation outcome and drop into `plans/260414-0840-fallback-composer-unify/reports/` for record.
9. Check browser console: no errors, no failed font CDN requests (validates Phase 02 resolver).
10. Confirm `network` tab SSE stream: events arrive in order without duplicates (aside from the known pre-existing double-`done`).

## Todo list
- [ ] Run full vitest scope, list failures
- [ ] Fix event-count assertions in `ai-variety-fallback.test.ts`
- [ ] Fix shape/path assertions in `openai-generator.test.ts`
- [ ] Fix composer backward-compat test in `template-composer.test.ts`
- [ ] Re-run until all green
- [ ] `tsc --noEmit` + `pnpm lint` clean
- [ ] Manual regen: restaurant (menu + booking + faq populated, no empty gallery)
- [ ] Manual regen: health
- [ ] Manual regen: fitness
- [ ] Manual regen: tech
- [ ] Manual regen: creative
- [ ] Screenshot each into reports/
- [ ] Browser console clean, fonts load

## Success Criteria
- All affected tests green.
- `tsc --noEmit` + `pnpm lint` clean.
- **Manual verification (mandatory):** Regenerate a site with the prompt `"Ristorante Bella Vista, family Italian in District 1, pasta and pizza"` while `OPENAI_API_KEY` is invalid, and confirm:
  - `menu-display` block is present with ≥3 menu items populated
  - `booking-widget` block is present with a form
  - `faq` block is present with ≥3 Q&A pairs
  - No empty gallery block (no "image placeholder" slots)
  - Theme colors are warm/restaurant-appropriate
  - Fonts load without 404 in network tab
- 4 other categories regen successfully with category-appropriate blocks (screenshots in `reports/`).

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Hidden test file not in research list that fails | Medium | Run the FULL `pnpm test` scope once to catch stragglers |
| A category has a bug in its content pack (empty `businesses[]`) | Medium | Phase 04 tests surface this; Phase 06 re-verifies against every category |
| Empty gallery bug still present — points at composer, not fallback | Medium | If reproducible on happy path too, file separate bug; don't block this refactor |
| Font 404 because Google Fonts allowlist missed a family | Low | Phase 02 covered allowlist; if it slips, patch the lookup table |
| Staging behaves differently from local (Docker vs Node dev) | Medium | Re-run step 7 once on staging after PR merges |

## Security Considerations
None new — all category content is static files, fallback does no network IO.

## Next steps
Phase 07 documents the legacy `generate-blocks.ts` fate and updates progress trackers.
