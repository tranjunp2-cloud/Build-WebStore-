# Phase 04 — Tests + verification

**Priority:** P0 · **Status:** pending · **Risk:** Low · **Effort:** S · **Depends on:** phase-03

## Goal
Prove the three issue ACs and guard against EN regression. Follow `.claude/rules/testing.md` (TC-ID, AAA, import from source — no re-implementing logic, no fake data).

## TC mapping (add to `docs/qa/F26-*.md` when QA doc is created)
| TC-ID | AC | Scenario |
|-------|----|----------|
| TC-F26-02-01 | AC-1 | `resolveBlockContent('hero','ms',brand)` → BM strings, `needsTranslation=false` |
| TC-F26-02-02 | AC-2 | `resolveBlockContent('hero','en',brand)` → exact pre-refactor EN strings |
| TC-F26-02-03 | AC-3 | uncovered block on `ms` → EN content + `needsTranslation=true`, no throw |
| TC-F26-02-04 | AC-2 | `createAddSectionBlock` for each migrated block on `en` == golden snapshot (regression) |
| TC-F26-02-05 | AC-1 | `createAddSectionBlock` on `ms` returns BM for covered blocks |
| TC-F26-02-06 | — | `interpolate` replaces `{brand}` in nested arrays/objects, leaves other text intact |
| TC-F26-02-07 | — | `getLocaleCoverage()` reports en=true for all migrated, ms=true only for authored |

## Test files
- Create: `src/__tests__/unit/ai/add-section-content.test.ts` (resolver, interpolate, coverage, fallback)
- Create/extend: `src/__tests__/unit/ai/add-section.test.ts` (factory en/ms output; golden snapshots for EN regression)

## EN regression strategy
Capture golden snapshots of `createAddSectionBlock({...,locale:'en'})` for the covered blocks **before** the phase-02/03 refactor (or assert against the literal strings now living in `en.ts`). Any diff on the `en` path = fail.

## Manual verification (preview)
1. `ms` site → editor → drag Hero/Features/FAQ from BlockLibraryPanel → blocks render in BM, no English leftovers.
2. `en` site → same blocks → unchanged English.
3. Add an uncovered block on `ms` → renders EN, no crash, `needsTranslation` logged.
4. Confirm no `_needsTranslation` key leaked into saved page config (inspect persisted blocks).

## Commands
```bash
npm test -- src/__tests__/unit/ai/add-section-content.test.ts src/__tests__/unit/ai/add-section.test.ts
npx tsc --noEmit
```

## Todo
- [ ] Write resolver/interpolate/coverage/fallback unit tests (TC-F26-02-01..03,06,07)
- [ ] Write factory en-snapshot regression + ms-output tests (TC-F26-02-04,05)
- [ ] All green; `tsc --noEmit` clean
- [ ] Manual preview pass (en + ms), confirm no schema pollution
- [ ] Hand to `code-reviewer`

## Success criteria
- 100% of new tests pass; EN golden snapshots unchanged; no fake data/mocks-to-pass.
- Manual preview confirms AC-1/2/3 in real editor.

## Risks
- Snapshot brittleness if EN strings reflow — keep snapshots scoped to the migrated blocks only.
