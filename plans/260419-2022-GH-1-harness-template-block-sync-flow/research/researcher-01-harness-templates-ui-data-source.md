# Research: Admin Harness Template Surfacing & Block Sync Flow

**Date**: 2026-04-19  
**Researcher**: Claude Code (Explore subagent)  
**Query**: When block variants/schemas change, does admin harness template preview automatically refresh?  
**Status**: Complete

---

## Executive Summary

**No admin harness UI exists yet.** The test harness is CLI-only (`npm run harness:gen` + render via `.harness.tsx` route). Templates surface from **Payload CMS database** (not static files), seeded via `/api/templates/seed` by running `composeFromBlueprint()` at seed-time. **Block changes do NOT auto-sync** — templates are static snapshots until manual re-seed.

---

## 1. Admin Harness UI — Does NOT Exist

**Finding**: No page in `src/app/(dashboard)/**` or `src/app/(payload)/admin/**` currently exposes a "run harness" button.

- `src/app/test-harness/[fixtureId]/page.harness.tsx` — render route for Playwright screenshots (Phase 03)
- `src/app/(payload)/admin/[[...segments]]/page.tsx` — Payload admin panel (no harness widget)
- `src/app/(dashboard)/` — user dashboard (templates, domains, payments, staff) — no harness access

**Implication**: Only devs with CLI access (`npm run harness:gen`) can trigger template gen. No PM/admin UI.

---

## 2. Template Data Source: Payload `templates` Collection (DB)

**Primary source**: Payload CMS collection at `src/collections/Templates.ts`

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `name` | text | DB | Matches `TemplateSeed.name` from composer |
| `category` | select (hasMany) | DB | 14 categories (restaurant, beauty, tech, health, etc.) |
| `isPremium` | checkbox | DB | All v3 blueprints = true |
| `defaultTheme` | group | DB | primaryColor, secondaryColor, fontHeading, fontBody |
| `templatePages` | array | DB | Multi-page structure (Phase 03 addition, v3 only) |
| `defaultBlocks` | json | DB | Legacy fallback (pre-v3) |

**API endpoints**:
- **`GET /api/templates/list`** → paginated list from DB (no auth)
- **`GET /api/templates/preview?id=X&page=home`** → renders template homepage via `SiteRenderer`
- **`POST /api/templates/seed?v3=true&dry=true`** → seeds templates from composer (admin-only)

**Example seed flow** (line 36–76 in `/api/templates/seed/route.ts`):
```ts
const seedPairs = TEMPLATE_PRESETS.map(preset => ({
  preset,
  seed: composeFromBlueprint(preset)  // invokes composer NOW
}))
// Filter nulls, batch persist to DB
```

---

## 3. Data Shape: Templates Reference Blocks by `blockType` + `variant`

**Structure** (from `compose-runner.ts:normalise()`):
```ts
blocks: HarnessBlock[] = [
  { blockType: 'hero', variant: 'split-left', data: {...} },
  { blockType: 'features', variant: 'grid-3', data: {features: [...]} },
  { blockType: 'stats', variant: 'cards', data: {stats: [...]} }
]
```

**No block ID/slug reference** — templates are **early-bound** to block shape at seed time. Changes to block schema (e.g., adding a required `stats.format` field) are **NOT reflected** in existing DB templates.

---

## 4. Refresh Mechanism: Manual Re-Seed Only (No Auto-Sync)

**Current flow**:
1. Dev updates block variant in `src/blocks/{BlockType}/variants/` (schema, props)
2. Dev runs `npm run harness:gen` → CLI calls `buildMatrix()` → `composeFromBlueprint()` → writes `.harness-out/matrix.json`
3. Dev runs `npm run harness:render` → Playwright screenshots `.harness-out/matrix.json`
4. **Templates in DB unchanged** — still old snapshot

**To update DB templates**:
```bash
# Manual step required
curl -X POST http://localhost:3000/api/templates/seed?v3=true&force=true
```

**No versioning/hashing**: Templates have `createdAt`/`updatedAt` timestamps but no content hash. No detection of "blocks changed since last seed."

---

## 5. Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/test-harness/matrix.ts` | 6–20, 46–124 | Builds fixture matrix from `TEMPLATE_PRESETS` + `TEMPLATE_DEFINITIONS` |
| `scripts/test-harness/compose-runner.ts` | 17–88 | Invokes `composeFromBlueprint()` per fixture |
| `src/app/test-harness/[fixtureId]/page.harness.tsx` | 31–44 | Loads `.harness-out/matrix.json`, renders via `SiteRenderer` |
| `src/lib/ai/template-definitions.ts` | 22–127 | Exports `TEMPLATE_PRESETS` (56 blueprints, 4 per category) |
| `src/lib/ai/template-composer.ts` | 1–100 | `composeFromBlueprint()` entry + block builders |
| `src/app/api/templates/seed/route.ts` | 36–76 | Seeds DB from presets via composer |
| `src/collections/Templates.ts` | 20–114 | Payload schema + DB structure |

---

## 6. Recent Decisions (Plans 260415–260418)

**Plan 260415-0845** ("AI Gen Template-First Rebuild"):
- Flip pipeline: composer primary (0.5s), GPT personalize only (8s) → 63s → 10s
- `composeFromBlueprint()` now serves both harness AND production AI gen

**Plan 260416-1450** ("Template-First Gen"):
- Confirmed: template-composer builders now shipped + wired
- `buildFeatures()`, `buildStats()`, `buildPricing()`, `buildTeam()`, `buildServiceCards()` exported

**Plan 260418-1740** ("Wave 2 harness cleanup"):
- 182 visual-hole failures in harness render (layout blanks, not sync issues)
- Content backfill (stats arrays for 9 categories) ← manual edit, NOT auto-sync
- **No auto-refresh mechanism planned**

---

## 7. Block Change Sync: NOT Implemented

**When block schema changes** (e.g., hero.variant adds `'split-centered'`):

| Step | What happens |
|------|---|
| Update block schema | Only affects *future* harness runs (`npm run harness:gen`) |
| Update block variant list | `selectVariant()` in template-composer uses new list |
| Re-seed harness matrix | `.harness-out/matrix.json` now includes new variant |
| Re-render harness | Screenshots show new variant |
| **Prod templates in DB** | **UNCHANGED** — still have old variant list snapshot |
| **Admin harness UI** | **DOESN'T EXIST** — no "sync" button to click |

---

## Unresolved Questions

1. **Should admin harness UI be built?** PM asked if templates auto-update. Answer: they don't because no UI exists. Is blocking PM workflow?
2. **Is manual re-seed acceptable?** Or should POST `/api/templates/seed` auto-run on deployment (CI job)?
3. **Block versioning**: Should template schema include block schema version (e.g., `blocksVersion: "2026-04-19"`)? For audit trail?
4. **CATEGORY_DNA deletion**: matrix.ts still imports `CATEGORY_DNA` from template-definitions.ts, but export was removed (per code comments). Will matrix.ts fail?

---

**Evidence**: Git logs, file reads, no .pen files modified. Ready for follow-up: how to wire admin UI + auto-sync if needed.

---

## CRITICAL BUG FOUND: matrix.ts Runtime Error

**Issue**: `scripts/test-harness/matrix.ts` line 20 imports `CATEGORY_DNA` but it no longer exists.

```ts
// template-definitions.ts line 49 (DELETED):
// Removed: `CategoryDna` interface + `CATEGORY_DNA` record. 0 code consumers

// matrix.ts line 20 (BROKEN):
const ALL_CATEGORIES = Object.keys(CATEGORY_DNA)  // ← ERROR
```

**Error**:
```
TypeError: Cannot convert undefined or null to object
  at Function.keys (<anonymous>)
  at /scripts/test-harness/matrix.ts:20:31
```

**Impact**: `npm run harness:gen` is currently broken. Cannot regenerate harness matrix until this is fixed.

**Fix**: Replace `CATEGORY_DNA` with direct category list or reconstruct from `TEMPLATE_PRESETS.map(p => p.category)`.
