# Phase 02 — Font pairing resolver

## Context links
- Parent plan: `./phase-06-fallback-composer-unify.md`
- Depends on: none (runs in parallel with Phase 01 / Phase 03)
- Blocks: Phase 04 (adapter needs it to populate `theme.fontHeading` + `theme.fontBody`)
- Research: `./research/researcher-03-fallback-shape-adapter.md` Q1, Q4

## Overview
- Date: 2026-04-14
- Description: Produce a canonical resolver from `ThemePreset.fontPairingId` (string) to concrete `{ fontHeading: string; fontBody: string }` Google Font family names. The composer only stores the pairing id; the generator's `GenerationResult.theme` needs resolved family names for the renderer.
- Priority: P1
- Status: pending
- Review status: not reviewed

## Key Insights
- Directory listing confirms there is NO existing `src/lib/ai/font-pairings.ts` — it must be created.
- `theme-presets.ts` references ~20 distinct pairing ids: `warm-friendly, modern-clean, elegant-serif, luxury-brand, pro-corporate, bold-impact, tech-forward, startup-vibe, minimal-swiss, geometric, fresh-rounded, humanist, cafe-bistro, artisan, editorial, futuristic, creative-studio, retro-modern, bold-geometric` (from researcher-03 Q4).
- Renderer elsewhere in the codebase already consumes generic `fontHeading` / `fontBody` strings from `GenerationResult.theme`, so the resolver output must match whatever format that renderer expects (likely Google Font family names like `'Playfair Display'`, `'Inter'`).
- Must also cover the case where an unknown pairing id slips through — return a sensible default (`Inter` / `Inter`) and `console.warn`.

## Requirements
- Single exported function `resolveFontPairing(id: string): { fontHeading: string; fontBody: string }`.
- Static table covering every pairing id currently referenced in `theme-presets.ts`.
- Fallback `{ fontHeading: 'Inter', fontBody: 'Inter' }` with warning on unknown id.
- Fully unit-tested against the exhaustive list of known ids.

## Architecture
```
ThemePreset.fontPairingId (string)
        │
        ▼
resolveFontPairing(id)
        │
        ▼
{ fontHeading, fontBody } ──▶ GenerationResult.theme
```

## Related code files
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/theme-presets.ts` (source of all pairing ids — scan every preset)
- `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/generate-blocks.ts` (lines 41-47 — target theme shape)
- Existing frontend font-loading code (grep `fontHeading` under `src/components/` + `src/app/` to confirm consumed format)
- NEW: `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/font-pairings.ts`
- NEW test: `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/__tests__/unit/lib/ai/font-pairings.test.ts`

## Implementation Steps
1. `grep "fontPairingId:" src/lib/ai/theme-presets.ts` to extract the exhaustive list of ids actually used. Expected ~20.
2. `grep -rn "fontHeading" src/components src/app src/blocks | head -30` to confirm the renderer expects raw Google Font family strings (not CSS variables).
3. Create `src/lib/ai/font-pairings.ts` with `const FONT_PAIRINGS: Record<string, { fontHeading: string; fontBody: string }>` containing one entry per id. Map manually using the pairing name as a hint (e.g. `elegant-serif` → `Playfair Display` + `Lora`).
4. Export `resolveFontPairing(id: string)` that returns `FONT_PAIRINGS[id] ?? DEFAULT` with a `console.warn` on miss.
5. Write unit test asserting every id in `theme-presets.ts` resolves without warning.
6. Write unit test asserting unknown id returns default + logs warn.
7. Cross-check Google Fonts loader allowlist — if the repo has a hardcoded list of permitted families, every mapped family must appear in it.

## Todo list
- [ ] Extract real list of pairing ids from `theme-presets.ts`
- [ ] Confirm renderer font-string format
- [ ] Create `font-pairings.ts` with full table
- [ ] Unit test: every known id resolves
- [ ] Unit test: unknown id → default + warn
- [ ] Verify Google Fonts allowlist (if any)

## Success Criteria
- Unit tests green.
- `tsc --noEmit` clean.
- Manual verification: pick 3 `theme-presets.ts` presets at random, run `resolveFontPairing(preset.fontPairingId)` in a scratch test, confirm fonts are distinct and match preset personality.
- Manual verification: view a rendered block in the running dev server after Phase 05 ships and confirm the heading font actually loads (no 404 on the Google Fonts CDN request).

## Risk Assessment
| Risk | Likelihood | Mitigation |
|---|---|---|
| Renderer expects CSS-var style strings instead of family names | Medium | Grep before designing, mirror exact format |
| A pairing id exists in `theme-presets.ts` we missed | Medium | Grep-based extraction, not manual reading |
| Google Font allowlist blocks a family we chose | Low | Cross-check allowlist before finalising table |
| Fonts load but pair poorly aesthetically | Low | Not shipping-blocking, can iterate |

## Security Considerations
None — static lookup table. No user input reaches this module.

## Next steps
Once landed, Phase 04 can import `resolveFontPairing` in the theme adapter.
