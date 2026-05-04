# Phase 02 — Register unknown blocks (`contact-form`, `map`, `timeline`, `content-block`)

**Priority:** P1 (ship-blocker) | **Effort:** 2h | **Status:** pending

## Context Links

- Research: `research/researcher-02-quality-issues-and-levers.md` §1 (Unknown blocks 140 findings)
- Research: `research/researcher-01-generation-pipeline-390.md` §6 (variant-whitelist guard)
- Phase 01 (footer fix) — independent, can parallel

## Overview

140/800 drift findings do presets reference 6 unique unknown blocks khong ton tai trong registry: `contact-form` (56), `map` + `content-block` + `timeline` (~64), `content` (~14), `map-embed`. Cac section nay skip silently tai render -> /contact page trong, /about thieu timeline.

Giai phap "simplest": alias unknown blocks -> existing registered blocks thay vi tao moi 6 components. Ship co ket qua visual + tracked debt cho v1.1.

## Key Insights

- Researcher-02 §1: "contact-form 56 BLOCKER /contact page empty"; "map, content-block, timeline 64 BLOCKER sections skip"
- Researcher-02 §8 Lever #5: "Register contact-form: Add to WHITELIST + schema, OR map to existing contact block via alias (2h)"
- Grep `src/blocks/contact/` tim variants hien co; `contact-form` co the map -> `contact` variant mac dinh
- `PAGES_BLOCK_WHITELIST` o `src/lib/ai/pages-schema.ts:16-28` la chot chan; sanitizeBlocksForPayload() drop silently neu khong co trong whitelist

## Requirements

**Functional:**
- 6 unknown blocks khong con xuat hien trong drift report
- /contact page render form thay vi empty
- /about render timeline-like section (steps/process block)

**Non-functional:**
- Khong tao component Payload moi (tiet kiem 1-2 ngay dev); chi alias o composer + whitelist
- Khong thay doi visual nhu v1.1 decide ship component rieng

## Architecture

**Aliasing strategy (KISS, 2h):**

```
Preset uses ──────> template-composer buildBlockFromSpec() detects alias
  contact-form              ──alias──> contact (default variant)
  map / map-embed           ──alias──> contact (with embedded map section)
  timeline                  ──alias──> steps (or features-vertical)
  content-block / content   ──alias──> rich-text / content-section
```

Hoac register moi neu block da ton tai register trong Payload nhung chua trong WHITELIST.

## Related Code Files

**Modify:**
- `src/lib/ai/template-composer.ts` — buildBlockFromSpec() them alias resolution early return
- `src/lib/ai/pages-schema.ts:16-28` — WHITELIST chi them slug da co component thuc
- `src/lib/ai/template-presets-batch{1,2,3}.ts` — OPTIONAL rename `contact-form` -> `contact` (preferred: de composer alias lam thay)

**Read for context:**
- `src/blocks/contact/config.ts` — current variants
- `src/blocks/steps/config.ts` OR `src/blocks/process/config.ts` — timeline replacement
- `scripts/test-harness/assertions/variant-whitelist.ts` — guard logic

**Create:** None (YAGNI — alias only).

## Implementation Steps

1. Grep `blockType: 'contact-form'` va cac unknown block khac -> danh sach chinh xac
2. Quyet dinh map:
   - `contact-form` -> `contact` (default variant)
   - `map` + `map-embed` -> `contact` variant `with-map` (neu co) hoac bo qua trong alias warn
   - `timeline` -> `steps` variant `vertical`
   - `content-block` + `content` -> `content-section` (neu co) hoac `rich-text`
3. Them alias table trong `template-composer.ts` dau `buildBlockFromSpec()`:
   ```ts
   const BLOCK_ALIASES: Record<string,{block:string,variant?:string}> = {
     'contact-form': { block: 'contact' },
     'timeline':     { block: 'steps', variant: 'vertical' },
     // ...
   }
   const alias = BLOCK_ALIASES[spec.blockType];
   if (alias) spec = { ...spec, blockType: alias.block, variant: spec.variant ?? alias.variant };
   ```
4. Neu co block nao thuc su can render standalone (e.g. map co API key): thuc don rieng, otherwise v1.1.
5. Chay `npm run harness:gen` + `drift:check` — verify findings giam ~140
6. Spot-check fixture contact page render form
7. Commit: `fix(template): alias unknown blocks to registered fallbacks`

## Todo List

- [ ] Grep unknown blocks -> count per type
- [ ] Document alias mapping trong composer
- [ ] Add BLOCK_ALIASES table
- [ ] Verify `contact` variants phu hop
- [ ] Run harness -> drift check
- [ ] Commit + PR

## Success Criteria

- Drift report `unknown-block` findings giam tu 140 -> < 20 (chap nhan con `content` neu khong map duoc)
- /contact fixture render form (not empty)
- 390/390 fixtures compose OK

## Risk Assessment

- **Risk:** Alias tao visual mismatch (timeline tro thanh steps khac nhau). Mitigation: chap nhan v1.0, document trong debt log de v1.1 build proper components.
- **Risk:** Alias logic chay sau `selectVariant` nen variant pool khac. Mitigation: set alias truoc variant selection.
- **Risk:** Component `contact` yeu cau field khong co trong preset override. Mitigation: composer da co default builder `buildContact()` — dung default content.

## Security Considerations

- Neu enable `map-embed` standalone, can whitelist Google Maps embed URL — out of scope phase nay.

## Next Steps

- Phase 05 cho gate cac unknown block khong quay lai.
- v1.1: build proper `contact-form` + `timeline` + `map-embed` component voi schema rieng (track trong `docs/tracking/OPEN_BLOCKERS.md`).
