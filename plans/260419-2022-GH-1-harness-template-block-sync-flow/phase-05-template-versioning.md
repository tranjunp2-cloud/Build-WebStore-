# Phase 05 — Template versioning with blockSchemaVersion [OPTIONAL]

## Context links

- Research: `plans/260419-2022-GH-1-harness-template-block-sync-flow/research/researcher-02-block-registry-template-wiring.md` (§6 no version tracking today)
- Templates collection: `src/collections/Templates.ts:20-114`
- Seed logic: `src/lib/ai/seed-templates.ts`
- Registry: `src/blocks/registry.ts` (source of variant list → hash input)
- Migration conventions: `scripts/db-setup.js`, `.claude/rules/database-schema.md`

## Overview

- **Date:** 2026-04-19
- **Description:** Add `blockSchemaVersion` field (sha256 hash of all block meta.variants + schema shape) to `Templates` collection. Stamp on every seed. Enables per-template staleness detection: compare stored version vs. current registry hash at read time.
- **Priority:** P3 (optional)
- **Implementation status:** completed
- **Review status:** approved (8.5/10 reviewer-07)

## Key Insights

- Current drift detection (Phase 02) is global — "any drift anywhere in any template". Per-template version stamp lets us say "template X seeded against hash abc123; current hash def456 → stale".
- Hash input = deterministic JSON of `registry.list().map(b => ({type, variants, schemaShape}))`. Small (< 2KB) → sha256 cheap.
- Migration: new column `block_schema_version varchar(64) nullable` — null = unknown/legacy. Must be added to `scripts/db-setup.js` MIGRATIONS array per `.claude/rules/database-schema.md`.
- Seed endpoint stamps on insert. No migration of existing rows needed (null = treat as stale).

## Requirements

**Functional**
- New field `blockSchemaVersion: string` on `Templates` collection (nullable, varchar(64)).
- Helper `computeBlockSchemaVersion()` in `src/lib/ai/block-schema-version.ts` returns stable sha256 hex.
- `seed-templates.ts` sets field on insert.
- Phase 02 validator optionally consumes field: if row hash == current hash AND in-memory scan clean → ok; if hash differs → mark `stale-version` finding.
- Phase 04 UI surfaces "seeded at version abc123 / current def456".

**Non-functional**
- Hash computation < 50ms.
- Field added via proper migration (CI `check-migrations.js` gate).

## Architecture

```
src/lib/ai/block-schema-version.ts  [NEW]
  └─ computeBlockSchemaVersion(): string

src/collections/Templates.ts  [MODIFY]
  └─ + field: blockSchemaVersion (string, maxLength: 64)

scripts/db-setup.js  [MODIFY]
  └─ + MIGRATIONS entry: ALTER TABLE templates ADD COLUMN IF NOT EXISTS block_schema_version varchar(64)

src/lib/ai/seed-templates.ts  [MODIFY]
  └─ seedTemplates() → stamp computeBlockSchemaVersion() on every row

src/lib/ai/template-drift-validator.ts  [MODIFY — Phase 02 file]
  └─ scanDbTemplates(): also compare row.blockSchemaVersion vs current hash
```

## Related code files

**To create**
- `src/lib/ai/block-schema-version.ts` (< 80 lines)

**To modify**
- `src/collections/Templates.ts`
- `scripts/db-setup.js` (MIGRATIONS array entry)
- `src/lib/ai/seed-templates.ts`
- `src/lib/ai/template-drift-validator.ts` (Phase 02)

**Tests to add**
- `src/__tests__/unit/ai/block-schema-version.test.ts` — deterministic output, changes when variant added/removed

## Implementation Steps

1. Write `computeBlockSchemaVersion()`:
   - Call `blockRegistry.list()` (or iterate registry internal map).
   - Map to `{type, variants: sorted, schemaShape: zodToJsonSchema or keys-only}`.
   - `JSON.stringify` with sorted keys → `crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)`.
2. Add field to `Templates` collection config.
3. Add `MIGRATIONS` entry in `scripts/db-setup.js`:
   ```js
   {
     name: 'templates-block-schema-version',
     sql: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS block_schema_version varchar(64);`,
   }
   ```
4. Update `seed-templates.ts` to stamp version on each row insert.
5. Update Phase 02 `scanDbTemplates` to emit `{issue: 'stale-version', rowVersion, currentVersion}` when mismatch.
6. Add unit test: snapshot `computeBlockSchemaVersion()` output; add/remove variant in test fixture → assert hash changes.
7. Manual check: run `npm run drift:check` locally; confirm no false positives on first seed.

## Todo List

- [x] Implement `computeBlockSchemaVersion` + unit test
- [x] Add field to `Templates` collection
- [x] Add migration entry to `scripts/db-setup.js`
- [x] Stamp on seed
- [x] Extend Phase 02 validator to emit stale-version finding
- [x] CI `check-migrations.js` passes
- [x] Commit: `feat(templates): stamp blockSchemaVersion on seed for drift tracking`

## Success Criteria

- After next staging deploy, every seeded template has `blockSchemaVersion` populated.
- Adding a variant to any block → `computeBlockSchemaVersion()` output changes → all rows with old hash reported as stale by `scanDbTemplates`.
- CI schema gate passes (migration entry present).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hash instability across Node versions (Map iteration order) | Low | High | Sort keys explicitly; unit test pins snapshot |
| Missing migration entry → PR blocked by `check-migrations.js` | Low | Low | Follow project rule; CI catches |
| Legacy templates with null version spam drift findings | Medium | Low | Treat null = stale but downgrade severity to warn, not error |

## Security Considerations

- None — hash computed server-side, exposed only via admin UI.

## Next Steps

- If template editing in admin lands later, combine with per-template manual-edit flag to distinguish "stale because schema changed" vs "stale because user customized".
- Consider switching seed strategy from force-replace to upsert-by-slug once versioning stable.
