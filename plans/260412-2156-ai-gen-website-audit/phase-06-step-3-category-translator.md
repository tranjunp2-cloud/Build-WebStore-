# Phase 03 — Category translator (5 → 14)

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: none
- Blocks: Phase 04 (adapter must know which composer category to request)
- Research: `./research/researcher-03-fallback-shape-adapter.md` Q2

## Overview
- Date: 2026-04-14
- Description: Extend the prompt→category resolver so it can emit one of the 14 composer categories (`restaurant, ecommerce, beauty, tech, health, education, realestate, fitness, creative, business, fnb, events, travel, blog`) instead of the 5 currently supported by `parseIntent()`.
- Priority: P1
- Status: pending
- Review status: not reviewed

## Key Insights
- `parseIntent()` in `generate-blocks.ts:83-116` scores the prompt against `TYPE_KEYWORDS` (lines 75-81). Only 5 buckets. Many real-world categories (spa, gym, clinic, dental) currently fall through to `business` because no bucket claims them.
- Composer throws if `category` is unknown (`template-composer.ts:1216`), so the resolver must ALWAYS return one of the 14 valid values.
- We do NOT want to break `parseIntent`'s existing callers (happy path still uses `generate-blocks`). Add a NEW function instead of mutating the existing one.
- Portfolio → `creative` is the only non-1:1 mapping.

## Requirements
- New pure function `resolveComposerCategory(prompt: string): ComposerCategory`.
- Keyword-based scoring with tie-break fallback to `business`.
- Covers all 14 categories with ≥5 keywords each.
- Unit tests for every category + ambiguous + empty prompt.
- No mutation of `parseIntent` / `TYPE_KEYWORDS` — duplicate the table if necessary.

## Architecture
```
prompt: string
    │
    ▼
tokenize → score against COMPOSER_TYPE_KEYWORDS (14 buckets)
    │
    ▼
highest score wins, ties → bias order [ecommerce, restaurant, fnb, beauty, health, fitness, realestate, education, tech, events, travel, creative, blog, business]
    │
    ▼
ComposerCategory
```

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/generate-blocks.ts` (lines 75-116 reference implementation)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/content/index.ts` (lines 42-57 canonical category list)
- Consumer (created Phase 04): `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/fallback-adapter.ts`

## Implementation Steps
1. Read `content/index.ts:42-57` and copy the 14 category strings as a TS union type `ComposerCategory`.
2. In a new file `src/lib/ai/composer-category-resolver.ts` (or append to `fallback-adapter.ts` depending on Phase 04 layout) define:
   ```ts
   const COMPOSER_TYPE_KEYWORDS: Record<ComposerCategory, string[]> = { ... }
   ```
   Seeds per Research Q2 plus additions:
   - `beauty`: spa, salon, beauty, skincare, cosmetic, nail, hair, makeup, lash
   - `tech`: saas, software, app, platform, startup, ai, dev, cloud, api
   - `health`: clinic, dental, doctor, medical, hospital, pharmacy, wellness
   - `education`: school, academy, tuition, course, training, kindergarten, bootcamp
   - `realestate`: real estate, property, agent, condo, apartment, listing, realty
   - `fitness`: gym, fitness, yoga, pilates, crossfit, personal trainer, workout
   - `fnb`: cafe, coffee, bakery, bubble tea, kopitiam, dessert, juice bar
   - `events`: wedding, event, party, photography, venue, ceremony, planner
   - `travel`: travel, tour, hotel, resort, homestay, agency, trip, vacation
   - `creative`: portfolio, photographer, designer, artist, freelance, studio, illustrator
   - keep existing `restaurant`, `ecommerce`, `blog`, `business` keyword sets
3. Implement scoring: `+1` per literal match (case-insensitive, word boundary). Return `business` on zero matches.
4. Add a deterministic tie-break: iterate a fixed priority array so output is stable.
5. Unit test: one canonical prompt per category (14 tests) expecting correct bucket.
6. Unit test: empty prompt → `business`.
7. Unit test: ambiguous prompt (`"coffee shop and restaurant"`) — document expected (likely `fnb` if it wins tie-break vs `restaurant`).

## Todo list
- [ ] Define `ComposerCategory` type + keyword table
- [ ] Implement `resolveComposerCategory`
- [ ] Deterministic tie-break order
- [ ] 14 happy-path tests
- [ ] Empty + ambiguous tests
- [ ] Export from phase-04 adapter module

## Success Criteria
- Every composer category has ≥1 test proving a natural prompt resolves to it.
- `tsc --noEmit` clean.
- Manual verification: run the resolver against these exact prompts and confirm expected category:
  - `"I want a site for my dental clinic in District 1"` → `health`
  - `"Yoga studio membership signup"` → `fitness`
  - `"AI photo editing SaaS"` → `tech`
  - `"Vietnamese coffee brand online"` → `fnb`
  - `"Real estate listings for condos"` → `realestate`

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Keyword overlap between `restaurant` and `fnb` causes flapping | Medium | Deterministic tie-break array, explicit test case |
| `business` sink absorbs too many prompts | Medium | Rich keyword seeds per category; test against a dozen real prompts |
| Vietnamese keywords missed | Medium (local market) | Add VN tokens (`tiệm`, `quán`, `phòng khám`, `spa`) where relevant |
| Category drift if composer adds a 15th category later | Low | Derive the union type from `content/index.ts` not a hardcoded copy |

## Security Considerations
Prompt is user input but only read for keyword matches — no injection surface, no regex DoS (word-boundary only, fixed tokens).

## Next steps
Phase 04 adapter imports this resolver as the first transform in the pipeline.
