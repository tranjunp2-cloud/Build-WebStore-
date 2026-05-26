# Phase 02 — Locale-aware content resolver + fallback engine

**Priority:** P0 · **Status:** pending · **Risk:** Med · **Effort:** M · **Depends on:** phase-01

## Goal
Decouple the localizable **strings** from the structural **assembly** in `createAddSectionBlock`. Introduce a locale-keyed content registry + a resolver with EN fallback and a "needs-translation" signal (AC-3). After this phase the engine works end-to-end even though only EN content exists yet (phase-03 adds BM).

## Design (KISS/DRY)

### New module: `src/lib/ai/add-section-content/index.ts`
```ts
import type { AddSectionLocale } from '../add-section'
import { BLOCK_CONTENT_EN } from './en'
import { BLOCK_CONTENT_MS } from './ms'

// Per-block localizable strings, brandName injected by caller via {brand} token.
export interface BlockContent { [field: string]: unknown }
type ContentMap = Record<string, BlockContent>

const MAPS: Record<AddSectionLocale, ContentMap> = { en: BLOCK_CONTENT_EN, ms: BLOCK_CONTENT_MS }

export interface ResolvedContent {
  content: BlockContent
  localeUsed: AddSectionLocale
  needsTranslation: boolean   // true when ms requested but only en available
}

export function resolveBlockContent(blockType: string, locale: AddSectionLocale, brand: string): ResolvedContent {
  const want = MAPS[locale]?.[blockType]
  if (want) return { content: interpolate(want, brand), localeUsed: locale, needsTranslation: false }
  const en = BLOCK_CONTENT_EN[blockType]
  return { content: interpolate(en ?? {}, brand), localeUsed: 'en', needsTranslation: locale !== 'en' }
}

export function hasLocaleContent(blockType: string, locale: AddSectionLocale): boolean {
  return Boolean(MAPS[locale]?.[blockType])
}

// Replace {brand} (and any future tokens) in string leaves; arrays/objects walked recursively.
function interpolate(obj: BlockContent, brand: string): BlockContent { /* deep-replace {brand} */ }
```

### Refactor `createAddSectionBlock` (incremental, not big-bang)
Keep the switch for **structure** (variant, layout, icons, urls, array shapes). Replace **inline literal strings** with values pulled from `resolveBlockContent(type, locale, brandName)`. Migrate block cases gradually — a case that hasn't been migrated keeps its inline EN literals and simply ignores `locale` (still safe). Track migrated cases in phase-03.

Pattern per migrated case (e.g. `hero`):
```ts
case 'hero': {
  const { headline, subheadline, ctaButtons } = resolved.content
  return { blockType: 'hero', variant: 'centered', headline, subheadline, ctaButtons }
}
```
where `resolved = resolveBlockContent('hero', locale, brandName)` is computed once near the top.

### Fallback + flag (AC-3)
- Missing BM ⇒ `resolveBlockContent` returns EN content + `needsTranslation: true`. No crash.
- Surface the flag WITHOUT polluting persisted block config: return it from `normalizeAddSectionBlock` as sibling metadata, e.g. `{ block, meta: { needsTranslation, localeUsed } }`, OR emit a lightweight signal (`console.debug` + optional `onNeedsTranslation?` callback). **Do not** write `_needsTranslation` into the saved `config` (keeps schema clean). This metadata is the documented hook for US-F26-04.
- Decide the return-shape change carefully: `normalizeAddSectionBlock` currently returns `BlockData | null`. Prefer an additive overload/return-object only if call sites are updated; else keep returning `BlockData` and expose `needsTranslation` via a separate `lastResolution` export or callback to avoid breaking other callers. Pick the minimal option at implementation time and document it.

### Coverage map (for US-F26-06)
Export `getLocaleCoverage(): Record<string, { en: boolean; ms: boolean }>` derived from the two maps + the migrated-case list. This is the audit artifact US-F26-06 consumes.

## Related code files
- Create: `src/lib/ai/add-section-content/index.ts`, `.../en.ts`, `.../ms.ts` (ms starts minimal; filled in phase-03)
- Modify: `src/lib/ai/add-section.ts` (call resolver in migrated cases; expose flag + coverage)

> Keep each new file < 200 lines (per dev rules); split `en.ts`/`ms.ts` by block group if they grow.

## Todo
- [ ] Create `add-section-content/` module (resolver, interpolate, coverage, en/ms stubs)
- [ ] Migrate the structural switch cases to read strings from resolver (start with hero/features/faq)
- [ ] Implement fallback + `needsTranslation` surfacing without polluting saved config
- [ ] Export `getLocaleCoverage()` for US-F26-06
- [ ] `tsc --noEmit` clean

## Success criteria
- For a migrated block on `en`: output identical to pre-refactor (regression-safe).
- For a migrated block on `ms` with BM content: BM strings returned.
- For any block lacking BM: EN returned + `needsTranslation=true`, no error.

## Risks
- **EN regression** during string extraction — mitigate: migrate case-by-case, snapshot-test each (phase-04).
- **Return-shape change** breaking callers — mitigate: prefer additive/non-breaking surfacing of the flag.
