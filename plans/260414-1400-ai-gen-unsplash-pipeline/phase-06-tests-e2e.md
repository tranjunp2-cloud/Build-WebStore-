# Phase 06 — Unit + e2e test matrix

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01, phase-02, phase-03, phase-04, phase-05 (this tests the combined system)
- Related: sibling plan `plans/260414-0837-ai-gen-test-harness/` (structural assertion harness — reuse)
- Research: [researcher-02 §6](./research/researcher-02-payload-media-pipeline.md)

## Overview
- Date: 2026-04-14
- Description: Landing checks — unit tests from phase-01/02/03/05 + new e2e matrix exercising `/api/ai/generate-site` across 5 canonical inputs (beauty, restaurant, tech, fnb, fitness) × 3 runs each. Assert: ≥10 blocks, ≥8 Media IDs, mandatory blocks present, variety. Add real-API integration smoke test (1 real Unsplash call, tagged `@integration`, skipped in CI unless env key present).
- Priority: P1 — gate for merge
- Implementation: pending
- Review: pending

## Key insights
- **Mocking strategy:**
  - unit tests → mock `fetch` + fake `payload`
  - integration tests → real Unsplash (demo tier) + real Payload dev instance
  - CI → only unit tests run; integration behind `RUN_INTEGRATION=1` env
- **Existing harness** at `plans/260414-0837-ai-gen-test-harness/` provides structural assertion helpers (block-count, mandatory-presence) — reuse.
- **5 canonical inputs** match eval patterns from sibling plan `0914-ai-model-optimization`.
- **Variety metric:** same input run 3× must produce ≥2 distinct block-combo hashes (AI randomness + composition-hint).
- **Don't assert on image URLs** — Payload Media IDs are numeric, opaque. Assert on existence + count only.

## Requirements
- All new phase-01..05 unit tests pass
- 367 existing AI tests stay green
- New e2e test file `src/__tests__/e2e/ai-gen-full-pipeline.test.ts` or `scripts/ai/e2e-full-pipeline.ts`
- Real-API smoke test (opt-in)

## Architecture

### Test layers
```
Layer 1: Unit (mocked)     — phase-01..05 individual tests
Layer 2: Integration       — generate-site route + real Payload + mocked Unsplash
Layer 3: E2E smoke (opt-in)— real Unsplash + real Payload
```

### Canonical inputs
```ts
const CANONICAL_INPUTS = [
  { category: 'beauty',     businessName: 'Serenity Spa Sài Gòn', industry: 'spa wellness', shortDescription: '...', products: 'facial massage skincare' },
  { category: 'restaurant', businessName: 'Phở Hồng',             industry: 'vietnamese restaurant', products: 'pho bun cha' },
  { category: 'tech',       businessName: 'CloudBase Labs',        industry: 'SaaS platform', products: 'API hosting monitoring' },
  { category: 'fnb',        businessName: 'Ngõ Coffee',            industry: 'specialty coffee', products: 'espresso pour-over pastries' },
  { category: 'fitness',    businessName: 'Iron District Gym',     industry: 'strength training', products: 'personal training classes' },
]
```

### Assertion helpers
```ts
function assertBlockCount(blocks, min) { expect(blocks.length).toBeGreaterThanOrEqual(min) }
function assertHasBlockTypes(blocks, required) {
  const types = new Set(blocks.map(b => b.blockType))
  for (const r of required) expect(types.has(r)).toBe(true)
}
function assertMediaIdsInjected(blocks, min) {
  const count = countMediaIds(blocks)  // walks upload fields
  expect(count).toBeGreaterThanOrEqual(min)
}
function assertMinItems(blocks, requirements) {
  for (const [type, min] of Object.entries(requirements)) {
    const block = blocks.find(b => b.blockType === type)
    if (block) {
      const items = block[ITEM_FIELD_BY_BLOCK[type]] ?? []
      expect(items.length).toBeGreaterThanOrEqual(min)
    }
  }
}
function assertNoBannedCta(blocks) {
  const BANNED = ['learn more', 'click here', 'submit', 'read more']
  const str = JSON.stringify(blocks).toLowerCase()
  for (const bad of BANNED) expect(str).not.toContain(bad)
}
```

## Related code files
- `src/__tests__/unit/lib/ai/unsplash-client.test.ts` (phase-01)
- `src/__tests__/unit/lib/ai/media-pipeline.test.ts` (phase-02)
- `src/__tests__/unit/lib/ai/image-keywords.test.ts` (phase-03)
- `src/__tests__/unit/lib/ai/structure-enforcer.test.ts` (phase-05)
- `src/__tests__/unit/lib/ai/content-injection.test.ts` (phase-05)
- `src/__tests__/e2e/ai-gen-full-pipeline.test.ts` (NEW, this phase)
- `scripts/ai/e2e-full-pipeline.ts` (NEW — runnable manually for anh's eyeball check)

## Implementation steps
1. Verify phase-01..05 unit tests individually green.
2. Create `src/__tests__/e2e/ai-gen-full-pipeline.test.ts`. Mock `openai` (deterministic block output per input) + mock `fetch` for unsplash (returns canned 20-photo response). Real Payload via test fixture.
3. For each of 5 canonical inputs, run `generateSiteWithAI` → assert block count ≥10, mandatory blocks present, Media IDs ≥8, no banned CTAs, min items per block.
4. Variety test: same input run 3× → block combo Jaccard <0.9 (not identical).
5. Fallback test: force Unsplash mock to 429 → assert fallback chain reaches hardcoded URL → hero still has Media ID.
6. Flag test: set `ENABLE_DALLE_HERO=true` → assert `generateAndUploadHeroImage` called, no Unsplash search for hero.
7. Create `scripts/ai/e2e-full-pipeline.ts` — runs generate-site against real services, dumps result to `reports/e2e-{date}.json`, prints summary.
8. Run suite: `pnpm test`. Fix flaky/broken tests. Target zero regressions.

## Todo
- [ ] Phase-01..05 unit tests all green individually
- [ ] E2E matrix test file created
- [ ] 5 categories × 3 runs = 15 e2e assertions pass
- [ ] Variety assertion passes (no 3-in-a-row identical)
- [ ] Fallback chain asserted
- [ ] DALL-E flag path still works
- [ ] Manual script runnable: `pnpm tsx scripts/ai/e2e-full-pipeline.ts`
- [ ] `reports/e2e-260414.json` committed for reference baseline
- [ ] 367 existing AI tests stay green
- [ ] Zero new warnings in test output

## Success criteria
- [ ] `pnpm test` exits 0
- [ ] `pnpm test:e2e` (if exists) exits 0
- [ ] E2E report shows avg 11 blocks, avg 12 Media IDs across 15 runs
- [ ] Zero banned CTAs detected
- [ ] Manual visual check: 5 gens look like production sites (anh eyeball)

## Risk assessment
- **R1 — OpenAI mock drift from real API shape:** mitigation = snapshot real response once, use as fixture.
- **R2 — Real Unsplash integration test burns demo quota:** mitigation = tag `@integration`, skip in CI, dev runs max 5×/day.
- **R3 — Test Payload fixture slow to spin up:** mitigation = shared `beforeAll` instance, clean between tests.
- **R4 — Variety metric too strict → flaky:** mitigation = run locally 10× before committing threshold.
- **R5 — Banned CTA assertion false positive on legitimate content (e.g. "read more about us"):** mitigation = word-boundary regex, not substring.

## Security considerations
- No `OPENAI_API_KEY` or `UNSPLASH_ACCESS_KEY` in test code — use env + skip.
- Test-generated Payload docs are cleaned up in `afterEach`.
- Reports in `reports/e2e-*.json` do NOT contain secrets or full AI outputs (only metrics + hashes).

## Next steps
→ phase-07 (deploy config — env var wiring + Unsplash account registration)
