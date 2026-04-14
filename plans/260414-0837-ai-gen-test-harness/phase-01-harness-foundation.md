# Phase 01 — Harness Foundation & Fixture Matrix

## Context links
- Parent plan: `plans/260414-0837-ai-gen-test-harness/plan.md`
- Research gen pipeline: `plans/260414-0837-ai-gen-test-harness/research/researcher-02-gen-and-render-pipeline.md`
- PRD: `docs/prd/F01-ai-builder-variety.md`
- AI context: `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md`

## Overview
Tạo nền tảng harness: thư mục `scripts/test-harness/`, matrix fixture generator (14 cat × 3 variant × N seeds), wrapper invoke `composeFromBlueprint()` / `composeTemplate()` offline, và output chuẩn `.harness-out/matrix.json` cho các phase sau tiêu thụ.

## Key Insights
- Composer paths thuần JS, không cần DB/OpenAI → chạy Node CLI script trực tiếp (research §Option 1).
- `TEMPLATE_PRESETS` (56 blueprint) + `TEMPLATE_DEFINITIONS` (48 legacy) đã sẵn → matrix có thể enumerate trực tiếp từ chúng thay vì dựng lại từ đầu.
- `composeFromBlueprint(preset, compositionSeed)` và `composeTemplate(input)` đều trả `TemplateSeed { pages[] }` với `pages[0].layout = blocks[]` — shape đồng nhất để assert.
- `CATEGORY_DNA` (src/lib/ai/template-definitions.ts:58) là source of truth cho expected signature blocks — import trực tiếp để tránh drift.

## Requirements
- Matrix runner nhận CLI args: `--categories=restaurant,beauty`, `--variants=premium`, `--seeds=5`, `--mode=full|quick`
- Zero network calls; zero DB writes; deterministic với seed cố định
- Output JSON schema stable (versioned `schemaVersion: 1`) cho consumer phases
- Default matrix: 14 categories × 3 variants × 5 seeds = 210 fixtures
- Quick mode: 3 categories (restaurant, beauty, tech) × 1 variant × 1 seed = 3 fixtures (<1 min)
- TSX/ts-node execution — tái dùng tsconfig paths `@/lib/ai/...`

## Architecture
```
scripts/test-harness/
  matrix.ts               // defineFixture(), buildMatrix()
  compose-runner.ts       // invokeComposer(fixture) → { blocks[], theme, meta }
  cli.ts                  // entry: parse args → write matrix.json
  types.ts                // Fixture, HarnessResult, StructuralReport shared types
  fixtures/
    baseline-inputs.ts    // fixed businessInfo per category (PM can tweak)
.harness-out/             // gitignored output dir
  matrix.json             // { schemaVersion, generatedAt, fixtures: [...] }
```

### Fixture shape
```ts
type Fixture = {
  id: string                    // "restaurant-premium-seed42"
  category: string              // "restaurant"
  variant: 'starter'|'professional'|'premium'
  businessIndex: number
  compositionSeed: number
  source: 'blueprint'|'legacy'  // which composer path
  expectedSignatureBlocks: string[]   // from CATEGORY_DNA
  expectedMinBlocks: 6
  expectedMaxBlocks: 16
}

type HarnessResult = {
  fixture: Fixture
  blocks: Block[]                // composed layout
  theme: ThemeConfig
  composerError?: string         // if throws
  durationMs: number
}
```

## Related code files
- `src/lib/ai/template-composer.ts` (composeFromBlueprint:1168, composeTemplate:1213)
- `src/lib/ai/template-definitions.ts` (CATEGORY_DNA:58, TEMPLATE_PRESETS:212, TEMPLATE_DEFINITIONS:155)
- `src/lib/ai/theme-presets.ts` (per-category presets)
- `tsconfig.json` (paths `@/*`)
- `package.json` (add tsx/ts-node dep if missing)

## Implementation Steps
1. Tạo `scripts/test-harness/types.ts` với Fixture, HarnessResult, StructuralReport interfaces
2. Tạo `scripts/test-harness/matrix.ts`:
   - `buildMatrix(opts)` enumerate 14 categories × 3 variants × seeds (default 5) → Fixture[]
   - Seeds dùng hash deterministic: `seed = simpleHash(\`${category}-${variant}-${index}\`)`
   - Pull `expectedSignatureBlocks` từ `CATEGORY_DNA[category].signatureBlocks`
3. Tạo `scripts/test-harness/compose-runner.ts`:
   - `invokeComposer(fixture)` — switch theo `fixture.source`: blueprint → lookup trong TEMPLATE_PRESETS → `composeFromBlueprint(preset, seed)`; legacy → build `ComposerInput` → `composeTemplate(input)`
   - Wrap trong try/catch → record composerError
   - Return HarnessResult với `blocks = seed.pages[0].layout` (homepage only v1)
4. Tạo `scripts/test-harness/cli.ts`:
   - yargs/commander parse args `--mode`, `--categories`, `--variants`, `--seeds`, `--out`
   - Loop matrix, invoke runner, write `.harness-out/matrix.json`
   - Print progress to stdout với count PASS/FAIL
5. Thêm `.harness-out/` vào `.gitignore`
6. Thêm `fixtures/baseline-inputs.ts` với 14 businessInfo objects (tên VN-friendly, 1 per category)
7. Script dry-run: `pnpm tsx scripts/test-harness/cli.ts --mode=quick` → verify 3 fixtures generate OK

## Todo list
- [ ] Create `scripts/test-harness/` directory structure
- [ ] Implement `types.ts` shared interfaces
- [ ] Implement `matrix.ts` buildMatrix() với seed strategy
- [ ] Implement `compose-runner.ts` blueprint + legacy paths
- [ ] Implement `cli.ts` với arg parsing + output
- [ ] Add baseline-inputs fixtures
- [ ] Add `.harness-out/` to .gitignore
- [ ] Verify quick mode runs trong <10s locally
- [ ] Verify full mode (210 fixtures) runs trong <60s locally

## Success Criteria
- `pnpm tsx scripts/test-harness/cli.ts --mode=quick` tạo `.harness-out/matrix.json` với 3 fixtures
- `pnpm tsx scripts/test-harness/cli.ts --mode=full` tạo 210 fixtures trong <60s
- Mỗi fixture có `blocks[]` length >= 1 (dù là fail case)
- `composerError` field khác null khi có throw — không crash runner
- Zero network calls (verify bằng `--offline` node flag hoặc inspect trace)

## Risk Assessment
- **R1 Composer import side effects**: template-composer.ts có thể trigger DB init nếu có top-level await. Mitigation: mock `getPayload` nếu cần, hoặc chạy với env `DISABLE_DB=1`.
- **R2 ts-path resolution**: `@/*` alias có thể không resolve trong tsx CLI. Mitigation: dùng `tsx` (native alias support) hoặc relative imports.
- **R3 Seed collision**: hash same cho 2 fixture khác nhau. Mitigation: include category+variant+index trong hash input.

## Security Considerations
- Harness chạy offline → không secret leakage
- `.harness-out/` gitignored → tránh commit screenshot/PII
- Không import source trực tiếp từ `node_modules` để tránh phụ thuộc runtime lạ
- Business sample data dùng fake VN names, không PII thật

## Next steps
→ Phase 02: consume `matrix.json` để chạy structural assertions
