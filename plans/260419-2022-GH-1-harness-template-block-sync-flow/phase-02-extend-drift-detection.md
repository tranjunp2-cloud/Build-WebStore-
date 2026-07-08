# Phase 02 — Extend drift detection to all blocks + DB templates

## Context links

- Research: `plans/260419-2022-GH-1-harness-template-block-sync-flow/research/researcher-02-block-registry-template-wiring.md` (§6 drift gaps)
- Existing validator: `src/lib/ai/variant-pool-validator.ts:51-82` (11 blocks only)
- Existing test: `src/__tests__/unit/ai/variant-pool-validation.test.ts:14-46`
- Registry: `src/blocks/registry.ts:112-224` (getBlockMeta, getSchema)
- Template TS sources: `src/lib/ai/seed-templates.ts`, `src/lib/ai/template-definitions.ts`, `src/lib/ai/template-presets-batch{1,2,3}.ts`
- DB collection: `src/collections/Templates.ts:20-114` (templatePages[].layout JSON)

## Overview

- **Date:** 2026-04-19
- **Description:** Expand drift coverage from 11 blocks → ALL registered blocks. Add a check that scans every template reference (both TS definition sources and optionally seeded DB rows) and flags any `{blockType, variant, ...props}` that no longer matches current registry (missing block, unknown variant, missing required prop). Output: CI fails with actionable diff.
- **Priority:** P1
- **Implementation status:** completed
- **Review status:** approved (8.5/10 reviewer-07)

## Key Insights

- Hiện tại pool validator chỉ check 11/N blocks (per researcher-02 §6) → rename variant ở footer/carousel/gallery-style blocks không có pool → drift silent. Mở rộng phải tự động theo registry — không được hardcode list.
- Có 2 lớp drift:
  - **TS source drift** — `TEMPLATE_DEFINITIONS`, `TEMPLATE_PRESETS`, `template-presets-batch*.ts` reference variants/props in code. Cheap to check (import + iterate).
  - **DB drift** — Payload `Templates` rows (previously seeded) may be stale. Check requires DB connection; run as optional CI job or in deploy pre-check.
- `registry.ts:178-224` provides `getBlockMeta(type)` (variants) + `getSchema(type)` (Zod) → can validate any `{blockType, variant, ...props}` pair fully.
- Zod `.safeParse` on block schema gives precise diff for prop drift (missing required / wrong type).

## Requirements

**Functional**
- A script/test that iterates every template definition in TS source and every block ref within, then for each ref asserts:
  1. `registry.has(blockType)` — block still exists.
  2. `meta.variants.includes(variant)` — variant still valid.
  3. `schema.safeParse(props).success` — all required props present & typed (skip if schema opts content).
- DB drift check: same assertions against `Templates` rows via Payload Local API. Optional, behind env flag (skip in PR CI, run in deploy preflight).
- Runs as a Vitest unit test so failure blocks PR.
- Report format: list of `{templateId, blockType, variant, issue}` so dev sees exactly what to fix.

**Non-functional**
- Runtime < 5s (TS source check) — pure in-memory.
- No new runtime deps; reuse Vitest + Payload.
- DRY with existing `variant-pool-validator.ts` — prefer extending, not duplicating.

## Architecture

```
src/lib/ai/
  template-drift-validator.ts        [NEW]
    ├─ scanTsTemplates(): DriftFinding[]      // reads TEMPLATE_DEFINITIONS + TEMPLATE_PRESETS
    ├─ scanDbTemplates(payload): DriftFinding[]  // reads collection via Local API
    └─ validateBlockRef(ref): DriftFinding | null  // core: registry + zod check

src/__tests__/unit/ai/
  template-drift-validator.test.ts   [NEW]
    └─ asserts scanTsTemplates() returns [] on clean main

src/lib/ai/
  variant-pool-validator.ts          [MODIFY]
    └─ use same validateBlockRef internals for consistency (optional refactor)
```

Data flow:

```
registry (live)  ──▶  validateBlockRef(ref)
   ▲                         ▲
   │                         │
TS sources ──▶ scanTsTemplates ──▶ DriftFinding[] ──▶ Vitest assertion
DB rows    ──▶ scanDbTemplates ──▶ DriftFinding[] ──▶ Deploy preflight (Phase 03)
```

## Related code files

**To create**
- `src/lib/ai/template-drift-validator.ts` (< 200 lines)
- `src/__tests__/unit/ai/template-drift-validator.test.ts`

**To modify**
- `src/__tests__/unit/ai/variant-pool-validation.test.ts` — extend or keep as focused check; decide after drafting new validator
- Optionally `src/lib/ai/variant-pool-validator.ts` — share `validateBlockRef` helper if clean

**To read for context**
- `src/blocks/registry.ts`
- `src/lib/ai/template-definitions.ts`
- `src/lib/ai/template-presets-batch1.ts` (+ batch2, batch3)
- `src/lib/ai/seed-templates.ts` (understand how TS → DB mapping works)

## Implementation Steps

1. Draft `validateBlockRef(ref: {blockType, variant, ...props}): DriftFinding | null`:
   - If `!registry.has(blockType)` → `{issue: 'unknown-block'}`.
   - Else get `meta = getBlockMeta(blockType)`; if variant provided and `!meta.variants.includes(variant)` → `{issue: 'unknown-variant', expected: meta.variants}`.
   - Run `getSchema(blockType).safeParse(props)`; if fail, extract Zod issues with required/type errors only → `{issue: 'schema-drift', zodIssues}`.
2. Walk template refs:
   - Import `TEMPLATE_DEFINITIONS`, `TEMPLATE_PRESETS`, and preset batches.
   - For each preset/def, flatten `templatePages[].layout[]` (and legacy `defaultBlocks`).
   - Call `validateBlockRef` on each.
3. Write `template-drift-validator.test.ts`:
   - `expect(scanTsTemplates()).toEqual([])` — clean baseline.
   - Dynamic snapshot of per-template finding count for easier triage.
4. Add DB scanner (behind `DRIFT_CHECK_DB=1` env) using `getPayload()` + `find({collection: 'templates', limit: 500})`.
5. Optional: refactor `variant-pool-validator.ts` to reuse `validateBlockRef` (YAGNI: skip if churn > 30 lines).
6. Add `npm run drift:check` script in `package.json` that runs `vitest run template-drift-validator` — used by Phase 03 CI hook.
7. Document usage + expected output in `docs/qa/F01-template-first-gen.md` (existing F01 QA doc).

## Todo List

- [x] Create `template-drift-validator.ts` with `validateBlockRef` + `scanTsTemplates`
- [x] Create matching Vitest test; assert empty findings on main
- [x] Wire DB scanner behind env flag
- [x] Add `npm run drift:check` script
- [x] Confirm CI (`ci.yml` test job) picks up new test automatically
- [x] Update F01 QA doc with drift-check usage section
- [x] Commit: `feat(ai): add full block-registry ↔ template drift validator`

## Success Criteria

- Test covers 100% of blocks in `registry.ts` (not just 11).
- Introducing a local rename of a variant in any block config → drift test FAILS with clear finding.
- Removing a template's required prop → drift test FAILS with Zod issue path.
- `npm run drift:check` returns non-zero exit on drift, zero on clean.
- DB scanner, when enabled, succeeds against staging DB (`vercel env pull` → connect → scan).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Zod schemas include content validators (min length etc.) that false-positive on structural check | Medium | Medium | Classify Zod issues: only fail on `invalid_type`, `required`, `unrecognized_keys` — NOT on `too_small`/`too_big` string content |
| Preset batches lazy-loaded via dynamic import — scanner misses them | Low | High | Explicit static imports in validator; fail loudly if batch modules export shape changes |
| Legacy `defaultBlocks` field still used by some templates → extra code path | Low | Low | Include both `defaultBlocks` and `templatePages[].layout` in walk |
| DB scan slow / flaky on CI | Medium | Low | Keep DB scan out of PR CI; run only in deploy preflight (Phase 03) |

## Security Considerations

- DB scanner reads templates only (no writes). Uses existing Payload auth context. No PII in templates.
- Ensure findings output does not leak env vars if drift message includes source paths.

## Next Steps

- Phase 03 consumes `npm run drift:check` as deploy gate and auto-regen trigger.
- Phase 04 (optional) surfaces findings in admin UI dashboard.
- Phase 05 adds version stamp so drift check can also report "template vs. current schema version".
