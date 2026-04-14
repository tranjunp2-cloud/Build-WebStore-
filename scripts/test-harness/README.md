# AI Gen Test Harness

Visual + structural coverage for the F01V AI website builder. Catches "empty hole" bugs that 3000+ unit tests miss because they never render DOM.

## What it does

```
matrix.ts        → enumerate 14 categories × 3 variants × 5 seeds = 210 fixtures
compose-runner   → invoke composeFromBlueprint() / composeTemplate() per fixture
check.ts         → run 6 structural guards (block count, signature blocks, ordering, ...)
render/*         → Playwright renders each fixture → screenshot → empty-hole detector  (Phase 03)
report/generate  → HTML gallery for PM eyeball review                                   (Phase 04)
```

Output lands in `.harness-out/` (gitignored).

## Quick reference

| Command | What | Time | Output |
|---|---|---|---|
| `npm run harness:quick` | 3 fixtures, premium variant only | <60s | `.harness-out/matrix.json` |
| `npm run harness:gen`   | full matrix 210 fixtures        | ~90ms | `.harness-out/matrix.json` |
| `npm run harness:check` | run structural guards on matrix | <1s   | `.harness-out/structural-report.json` |
| `npm run harness:render`| Playwright screenshots          | ~10m  | `.harness-out/screenshots/` *(Phase 03)* |
| `npm run harness:report`| HTML gallery                    | ~5s   | `.harness-out/report.html` *(Phase 04)* |
| `npm run harness:all`   | gen → check → render → report   | ~12m  | full pipeline |

`pnpm` users: replace `npm run` with `pnpm`.

## Daily dev loop

```bash
# Fastest iteration — 3 fixtures, structural only
npm run harness:quick && npm run harness:check
```

If a guard fails, `check.ts` prints the first 30 failures with reasons. Full details in `.harness-out/structural-report.json`.

## How to read a structural failure

```
[check] failure details:
  restaurant-premium-seed42
    → signature-blocks: missing menu-grid | block-count: 4 < min 6
```

- **Fixture id**: `{category}-{variant}-seed{N}`
- **Guard name**: see `assertions/` (`block-count`, `signature-blocks`, `ordering`, `no-empty-data`, `variant-whitelist`, `variety-metrics`)
- **Reason**: short human description of the violation

To reproduce locally, look up the fixture in `matrix.json` → re-run only that cell:

```bash
npx tsx scripts/test-harness/cli.ts --categories=restaurant --variants=premium --seeds=1
```

## How to add a new fixture / category

Don't edit fixtures directly — they are generated. Instead:

1. Add the category to `CATEGORY_DNA` in `src/lib/ai/template-definitions.ts`
2. Make sure `signatureBlocks[]` lists the must-have blocks
3. Run `npm run harness:gen` — the matrix will pick up the new category automatically

## How to add a new structural guard

1. Create `scripts/test-harness/assertions/your-guard.ts` exporting `runGuard(result): GuardReport`
2. Wire it in `assertions/index.ts` `runAllGuards()`
3. Re-run `npm run harness:check` — new guard runs against existing matrix

Look at `signature-blocks.ts` for the simplest reference implementation.

## CI

Workflow `.github/workflows/ai-harness.yml` runs the full pipeline when a PR is labelled **`run-harness`** (opt-in, ~12 min). Artifacts upload as `ai-harness-<pr>` for 14 days. Add the label from the PR sidebar; remove + re-add to re-trigger.

Render and report steps are `continue-on-error` until Phase 03 + 04 land — the structural-only run still ships its artifact.

## Files

| File | Purpose |
|---|---|
| `cli.ts` | Phase 01 — matrix runner, writes `matrix.json` |
| `matrix.ts` | Cartesian product builder (category × variant × seed) |
| `compose-runner.ts` | Invokes composer, captures blocks + duration + errors |
| `check.ts` | Phase 02 — structural guards, writes `structural-report.json` |
| `assertions/` | 6 guards + variety metrics |
| `types.ts` | Shared TypeScript types for matrix / report shapes |
| `render/` | Phase 03 — Playwright config + empty-hole detector *(pending)* |
| `report/` | Phase 04 — HTML gallery generator *(pending)* |

## Background

- **Plan**: `plans/260414-0837-ai-gen-test-harness/plan.md`
- **PRD**: `docs/prd/F01-ai-builder-variety.md`
- **QA**: `docs/qa/F01-ai-builder-variety.md`
- **Why**: 3694 unit tests pass but Ben Ben restaurant site shipped with hero + footer only — middle blocks vanished. Unit tests verify `blocks[]` JSON, never DOM. Harness closes that gap.
