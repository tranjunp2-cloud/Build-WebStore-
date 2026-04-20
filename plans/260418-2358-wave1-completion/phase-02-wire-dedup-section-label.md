# Phase 02 — Wire `dedupSectionLabel` into Composer Builders

## Context

- Parent: [plan.md](plan.md)
- Dependencies: Phase 01 complete (staging merged into F05)
- Parent plan phase: [`260417-0817-wave1-wix-detailed-plan/phase-03-A3-quick-wins.md`](../260417-0817-wave1-wix-detailed-plan/phase-03-A3-quick-wins.md) §A3.3

## Overview

- Date: 2026-04-18
- Description: `dedupSectionLabel(eyebrow, headline)` helper exists in `src/lib/ai/dedup-section-label.ts` with full test coverage (7 cases, all pass) but is NOT imported/called anywhere in composer. This phase wires it into `buildFeatures`, `buildTestimonials`, and `buildAbout` builders in `template-composer.ts` so AI-generated sites stop emitting duplicate eyebrow + section title pairs (e.g., "Features" + "Our Features").
- Priority: P1
- Implementation status: pending
- Review status: pending

## Key Insights

- Helper signature: `dedupSectionLabel(sectionLabel: string | undefined, headline: string) → string | undefined` (returns `undefined` to signal "drop this label" when ≥2 non-stop-word tokens overlap).
- Current builders emit `headline` + `subheadline` but have no `eyebrow` field. **Two options**:
  - **A**: Add `eyebrow` field to builder output, pass through dedup helper. Downstream block components (features/index.tsx, testimonials/index.tsx, about/index.tsx) must render eyebrow when present. Wider blast radius.
  - **B**: Keep existing `headline` emission but remove redundant section heading elsewhere (e.g., category tile component) — fix at render site.
- **Recommended**: Option A (authoritative fix at data layer). Check block components render eyebrow. If not, add render + skip dedup.

## Requirements

- `buildFeatures`, `buildTestimonials`, `buildAbout` in `template-composer.ts` call `dedupSectionLabel` before emit
- If `dedupSectionLabel` returns `undefined`, omit `eyebrow` field entirely (not empty string)
- Unit tests verify integration (input has duplicate → output strips eyebrow; distinct → both retained)
- Block components render `eyebrow` above headline when present (Zod schema + TSX)

## Architecture

Data flow:
```
AI prompt output → buildFeatures/Testimonials/About →
  (eyebrow, headline) → dedupSectionLabel →
  block data { eyebrow?: string, headline, subheadline? } →
  block component renders <p>{eyebrow}</p><h2>{headline}</h2>
```

## Related code files

- `src/lib/ai/dedup-section-label.ts` — helper (no changes)
- `src/lib/ai/template-composer.ts` — wire helper in 3 builders
- `src/blocks/features/index.tsx` — ensure eyebrow render
- `src/blocks/testimonials/index.tsx` — ensure eyebrow render
- `src/blocks/about/index.tsx` — ensure eyebrow render
- `src/collections/Pages.ts` (or block Zod schemas) — confirm `eyebrow` field allowed
- `src/__tests__/unit/ai/dedup-section-label.test.ts` — existing helper tests

## Implementation Steps

1. **Read current builders** (`template-composer.ts`): locate `buildFeatures` (~L341), `buildTestimonials` (~L433), `buildAbout` (~L622). Note current output shape.

2. **Check block Zod + component** for each (features, testimonials, about):
   - Zod schema allows optional `eyebrow: z.string()`?
   - Component renders it?
   - If not → add to schema first, render in component, add migration to `scripts/db-setup.js` per project CLAUDE.md.

3. **Import helper** at top of `template-composer.ts`:
   ```ts
   import { dedupSectionLabel } from './dedup-section-label';
   ```

4. **Wire into buildFeatures** (pseudocode):
   ```ts
   const eyebrow = dedupSectionLabel(draftEyebrow, headline);
   return { headline, subheadline, eyebrow, items };  // omit eyebrow if undefined
   ```

5. **Repeat for buildTestimonials + buildAbout**.

6. **Unit test additions** in a new file `src/__tests__/unit/ai/dedup-section-label-integration.test.ts`:
   - Test features builder drops redundant eyebrow
   - Test testimonials builder keeps distinct eyebrow
   - Test about builder with all overlap

7. **Run `pnpm test`**: full suite green.

8. **Manual smoke**: run `/test-harness/ai/<category>` route (per recent wave2 commits), inspect 2-3 generated sites for eyebrow/headline duplication.

## Todo list

- [ ] Read `template-composer.ts` buildFeatures/Testimonials/About
- [ ] Confirm eyebrow field allowed in 3 block Zod schemas
- [ ] Confirm 3 block components render eyebrow
- [ ] (if needed) Add eyebrow to schemas + components + migration
- [ ] Import `dedupSectionLabel`
- [ ] Wire into 3 builders
- [ ] Add integration test file
- [ ] `pnpm test` green
- [ ] Smoke via harness

## Success Criteria

- `grep -c "dedupSectionLabel" src/lib/ai/template-composer.ts` ≥ 3 (one call per builder)
- Integration tests pass (3+ cases)
- Harness-generated site shows no "Features / Our Features" duplicate on features/testimonials/about sections
- `pnpm test` all green

## Risk Assessment

- **Medium — eyebrow field drift**: if 3 block schemas don't allow eyebrow, adding requires DB migration (per project CLAUDE.md rule). Extends effort +30m.
- **Low — render layout**: eyebrow typography may need design decision (kicker color/size). Use existing heading hierarchy.
- **Low — test flake**: deduplicator is deterministic, stable.

## Security Considerations

None. Pure string manipulation.

## Next steps

Phase 03: run all 5 Wave 1 success metric checks, write completion report, mark parent plan done.
