# Phase 01 — Locale plumbing

**Priority:** P0 · **Status:** pending · **Risk:** Low · **Effort:** S

## Goal
Thread the site locale from the editor down into the default-content factory. **No content change** — `'en'` path stays byte-identical. This isolates the risky control-flow edit from the data work.

## Context links
- Factory: `src/lib/ai/add-section.ts` (`AddSectionContext` :58-63, `createAddSectionBlock` :216-803, `normalizeAddSectionBlock` :832-962)
- Call sites: `src/app/(editor)/editor/[siteId]/page.tsx` (`handleBlockDrop` :725-733, `handleAIAction` :785-793)
- Locale source: `page.tsx:104` `site` state, `SiteData.locale?: string`

## Changes

### 1. Extend the context type
`src/lib/ai/add-section.ts` — add to `AddSectionContext`:
```ts
export type AddSectionLocale = 'en' | 'ms'
interface AddSectionContext {
  // ...existing
  locale?: AddSectionLocale   // defaults to 'en' when absent (back-compat)
}
```

### 2. Resolve a safe locale once
At the top of `createAddSectionBlock` / `normalizeAddSectionBlock`:
```ts
const locale: AddSectionLocale = ctx.locale === 'ms' ? 'ms' : 'en'
```
Pass `locale` into the (phase-02) resolver. In phase-01 it is computed but unused beyond a guard — switch still returns EN.

### 3. Pass `site.locale` at both call sites
`page.tsx` `handleBlockDrop` (:725-733) and `handleAIAction` (:785-793) — add to the `normalizeAddSectionBlock` context object:
```ts
locale: site?.locale === 'ms' ? 'ms' : 'en',
```
(Mirror exactly how `theme` is already passed.)

### 4. Verify no other callers break
`grep -rn "normalizeAddSectionBlock\|createAddSectionBlock" src` — confirm every caller still type-checks with the new optional field (optional ⇒ no break). Note any non-editor caller (e.g. AI generate path) — leave them defaulting to `'en'` for now (out of scope; their locale handling lives in `fix/ai-gen-locale-ms`).

## Related code files
- Modify: `src/lib/ai/add-section.ts`, `src/app/(editor)/editor/[siteId]/page.tsx`

## Todo
- [ ] Add `AddSectionLocale` + optional `locale` to `AddSectionContext`
- [ ] Compute safe `locale` in factory entry points
- [ ] Thread `site?.locale` at both `page.tsx` call sites
- [ ] Grep all callers; confirm `tsc --noEmit` clean
- [ ] Manual: add a block on an `en` site → output identical to before

## Success criteria
- `tsc --noEmit` clean. EN behavior unchanged (diff of inserted block config = empty for en sites).

## Risks
- Other callers of the factory (AI gen) — mitigated by optional field defaulting to `'en'`.
