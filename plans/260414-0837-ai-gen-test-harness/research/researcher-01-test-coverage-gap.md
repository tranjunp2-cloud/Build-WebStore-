# Researcher 01 — Test Coverage Gap

## Existing unit tests (PR 555)

- **ai-variety-composer.test.ts (TC-F01-V.22–28)**: Seed-based variety (different seeds produce variant diversity); reproducibility (same seed = same output); backward compat (no seed); all blocks have variant field; businessIndex bounds; structure invariants (nav first, footer last); ordering constraints (features before stats).

- **ai-variety-fallback.test.ts (TC-F01-V.16–21)**: Variety without seed (≥5 distinct compositions per 10 calls); theme variety (≥2 primaryColors per 100 calls); seeded reproducibility; large seed handling (Date.now() no overflow); backward compat without seed; block structure integrity (nav/hero/contact positions, features before stats).

- **ai-variety-sanitizer.test.ts (TC-F01-V.08–15)**: Fuzzy match case-insensitive ("Grid-3" → "grid-3"); invalid variant fallback + log warn; fallback diversity (≥2 variants per 20 bad inputs); valid variant preserved; numeric variant coercion; empty variant string; unknown blockType no crash; getBlockMeta returns undefined no crash; enforceMinContent carousel fallback when <3 items.

- **ai-variety-system-prompt.test.ts (TC-F01-V.01–07)**: Design personality auto-inject; NO personality in reference mode; language 'vi' instruction; system prompt includes block registry; referencePrompt appended + IMPORTANT flag; language 'ms' Malay instruction; extraInstructions appended; VARIETY RULES & PROFESSIONAL DESIGN RULES sections; anti-pattern blocklist present.

## QA plan TC-IDs NOT yet covered

- TC-F01-V.29: Sanitizer handles old single-page format (no `pages` field) without crash
- TC-F01-V.30: generateSiteWithAI() parses legacy `blocks[]` format (backward compat)
- TC-F01-V.31: composeTemplate() works without `compositionSeed` field
- TC-F01-V.32: generateSiteWithAI() fallback when OPENAI_API_KEY missing
- TC-F01-V.33: JSON repair handles truncated JSON (missing final `}`)
- TC-F01-V.34: Handles truncated page 4 — keeps pages 1–3, doesn't crash
- TC-F01-V.35: sanitizeBlockData() strips upload fields (URL strings) safely
- TC-F01-V.36–38: (uncovered TCs — descriptions in QA doc)

## Render-level tests (integration/E2E)

**NOT FOUND.** Codebase has:
- `src/__tests__/integration/template-smoke.test.ts`: Calls `composeTemplate()`, validates block registry existence & theme resolution (structure checks only). **NO rendered HTML inspection.**
- NO Playwright tests found (`src/__tests__/e2e/` empty).
- NO React Testing Library / DOM snapshot tests in unit suite.
- NO SiteRenderer component instantiation in tests.

**Critical gap:** Tests assert block structure but never instantiate SiteRenderer or inspect rendered DOM. The "Ben Ben restaurant" bug (huge black empty space, sections missing) would NOT be caught.

## Gap Summary (key insight)

- **Structure vs. Render mismatch**: Unit & integration tests verify `blocks[]` is valid JSON with correct types/fields. They do NOT verify that blocks, when rendered with SiteRenderer + CSS, actually produce visible content and proper spacing. Ben Ben bug example: `composeTemplate()` returns correct `blocks[]`, sanitizer accepts all variants, but SiteRenderer may have a CSS rendering bug or a conditional that hides Menu/About/Gallery blocks in specific theme/variant combinations.

- **Variant-to-Render mapping uncovered**: Tests assert variants exist in registry and have correct names. They do NOT test that each variant actually renders differently (Layout, spacing, alignment all correct). A variant could be registered but have a CSS bug making it identical or broken.

- **No seed → variant diversity in render**: Tests count distinct block type sequences; they don't verify visual diversity. Two compositions could have same block order but different variant combos, yet render identically due to CSS issues.

- **Theme + variant interactions**: sanitizeBlockData() and composeTemplate() enforce constraints independently. No integration test verifies that a specific (theme, blockType, variant) triple actually renders without layout breakage (overflow, missing content, wrong spacing).

- **SSE/streaming edge case render**: No test for how incomplete AI responses (truncated mid-block or mid-array) render when fallback generators pick defaults. Real bug may surface only when default variant + theme combo has CSS regression.

## Unresolved Questions

- Does SiteRenderer have render-level tests covering all (blockType, variant) pairs?
- Are there CSS regression tests or visual snapshot tests elsewhere in repo?
- Does the "Ben Ben" bug reproduce consistently with a specific `compositionSeed` or theme preset?
- Are there playwright tests run pre-deploy against staging templates?

