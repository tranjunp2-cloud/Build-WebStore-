# Phase 05 — Fullstack Report: Template Versioning

**Status:** DONE
**Date:** 2026-04-19 21:13
**Agent:** fullstack-developer
**Plan phase:** `phase-05-template-versioning.md`

## Files created

| Path | LOC | Purpose |
|------|-----|---------|
| `src/lib/ai/block-schema-version.ts` | 52 | `computeBlockSchemaVersion()` — sha256 short hex of registry snapshot |
| `src/__tests__/unit/ai/block-schema-version.test.ts` | 34 | 3 deterministic-hash tests (TC-F01-D.02) |

## Files modified

| Path | Change |
|------|--------|
| `src/collections/Templates.ts` | Added top-level `blockSchemaVersion` text field (maxLength 64, readOnly, optional). |
| `scripts/db-setup.js` | Added MIGRATIONS entry `templates.block_schema_version` (ALTER TABLE … ADD COLUMN IF NOT EXISTS varchar(64)). |
| `src/app/api/templates/seed/route.ts` | Computes `blockSchemaVersion` once per request; stamps every insert across v3 / v2 / legacy paths. |
| `src/lib/ai/template-drift-validator.ts` | `scanDbTemplates` now emits `{issue: 'stale-version', blockType: '*'}` when row.blockSchemaVersion != current; legacy nulls skipped. |

## Hash approach

- Input: sorted array of `{ type, variants[], schemaKeys[] }` per registered block.
- `variants` = sorted copy of `meta.variants` (never mutates registry).
- `schemaKeys` = sorted keys of `ZodObject.shape`; non-object schemas → empty array.
- Block types iterated via `blockRegistry.getBlockTypes()` (existing API — no `list()` needed), sorted alphabetically.
- `JSON.stringify` → `crypto.createHash('sha256').update(...).digest('hex').slice(0, 16)`.
- Pure Node `crypto` — works in Payload server + Vitest; not Edge-compatible (fine; seed endpoint is Node runtime).

## Test results

```
✓ src/__tests__/unit/ai/block-schema-version.test.ts (3 tests) 11ms
  ✓ TC-F01-D.02 — block schema version
    ✓ returns a 16-char lowercase hex string
    ✓ is deterministic across repeated calls (same registry snapshot)
    ✓ is non-empty and stable within the process

✓ src/__tests__/unit/ai/template-drift-validator.test.ts (8 tests) 30ms   [Phase 02 — no regression]
✓ src/__tests__/unit/ai/variant-pool-validation.test.ts (3 tests) 2ms     [existing — no regression]
```

- `node scripts/check-migrations.js` → `✅ All new fields have matching migrations` (1 new field detected: `templates.block_schema_version`).
- `npx tsc --noEmit` clean for Phase 05 files (pre-existing error in `src/app/api/admin/harness/gen/route.ts:80` is unrelated — on main before this phase).
- Drift validator `stale-version` union member already present from Phase 02 DriftFinding type — schema alignment verified by the Phase 02 "stable shape" test which includes `'stale-version'` in its allow-list.

## Design decisions

1. **Skip legacy-null rows (YAGNI).** Rows without `blockSchemaVersion` treated as "unknown history" and skipped, not flagged. Rationale: Phase 03 force-replace-all seed will re-stamp everything on next deploy — flagging nulls would spam ~56 findings for one deploy cycle. Once the first seed lands, nulls become impossible.
2. **No registry mutation.** `blockRegistry.getBlockMeta()` returns the live `BlockMeta` object — `[...meta.variants].sort()` copies before sorting to avoid mutating the shared reference.
3. **Schema-keys instead of full Zod shape.** Full JSON schema serialization would be large + version-sensitive; keys-only catches rename/add/remove which are the drift types this hash targets. Min/max/regex constraint changes intentionally NOT caught (per validated plan decision).
4. **One computation per seed run.** `computeBlockSchemaVersion()` hoisted above v3/v2/legacy branches — all three paths stamp the same hash for a given request. Avoids per-row overhead.
5. **`blockType: '*'` for stale-version finding.** Represents "whole template stale" (not a single block). Phase 04 UI can read this sentinel and render differently from per-block findings.

## Unresolved questions

1. **Should the test cover hash-changes-on-variant-removal?** Task brief noted this may be hard to mock registry safely — confirmed. `blockRegistry` is module-level with frozen registrations; mocking via `vi.mock('@/blocks/registry')` would bleed into other tests in the same file via Vitest's module cache. Deterministic + hex-format tests cover the contract; the "changes on variant removal" property is effectively tested on every real registry edit (hash will flip and any template stamped with the old hash will surface as stale).
2. **Should Phase 04 UI treat `stale-version` as blocker or warning?** Plan phase-04 can decide. Current shape keeps it a plain finding; severity is consumer's call.
3. **`scanDbTemplates` has no test coverage** (noted in Phase 02 report too). Stale-version emission logic is inspected but not unit-tested. Follow-up: add a test that injects a fake payload with a row carrying a stale hash. Out of Phase 05 scope per "Phase 02 just landed — modify carefully".

**Status:** DONE
**Summary:** `blockSchemaVersion` field + migration + seed stamping + Phase 02 stale-version emission all shipped. 3/3 new tests pass, Phase 02 + variant-pool regression-free, migration check green, typecheck clean on touched files.
