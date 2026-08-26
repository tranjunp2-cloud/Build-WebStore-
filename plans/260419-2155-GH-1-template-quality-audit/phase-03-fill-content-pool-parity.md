# Phase 03 — Fill content pool parity (blog, events, travel)

**Priority:** P2 (OPTIONAL — polish, user decides ship v1.0 or defer) | **Effort:** 1h | **Status:** pending

## Context Links

- Research: `research/researcher-02-quality-issues-and-levers.md` §3 (Content Pack Audit)
- Previous fix attempt: `plans/260417-0837-all-cate-full-and-strong/` (PR #686)

## Overview

11/14 categories co 9 business samples moi cat; blog, events, travel chi co 8. Gap -1 sample moi cat. Anh huong: variant hero/testimonial/feature card thieu diversity o 3 cats nay khi gen 5 seeds. Tone: polish, khong block ship.

Optional boi vi:
- Harness van pass 390/390.
- Visual impact nho; PR #686 da fix phan lon.
- User co the accept 8 samples cho v1.0, bo sung v1.1.

## Key Insights

- Researcher-02 §3 table: "blog, events, travel = 8 samples; -1 each"
- Seed variety (researcher-01 §4): seed hash -> pick business -> same pool nho = stale across 5 seeds
- Sources goi y: business competitors, MY local brand, public registry SSM

## Requirements

**Functional:**
- Moi content file `blog.ts`, `events.ts`, `travel.ts` co 9 entries trong `businesses[]`
- Entry shape khop `BusinessSample` type (name, tagline, products, testimonial, about text...)

**Non-functional:**
- Content culturally accurate cho MY market (anh PM review)
- Khong dung fake brand name de tranh legal issue; dung generic plausible name

## Architecture

```
src/lib/ai/content/blog.ts     { businesses: [...8] }  -> add 1
src/lib/ai/content/events.ts   { businesses: [...8] }  -> add 1
src/lib/ai/content/travel.ts   { businesses: [...8] }  -> add 1
```

Cau truc entry da co — copy pattern tu entry cuoi roi doi noi dung.

## Related Code Files

**Modify:**
- `src/lib/ai/content/blog.ts`
- `src/lib/ai/content/events.ts`
- `src/lib/ai/content/travel.ts`

**Read for context:**
- `src/lib/ai/content/types.ts` — BusinessSample shape
- `src/lib/ai/content/beauty.ts` — reference co 9 samples (full example)

**Create/Delete:** None.

## Implementation Steps

1. Read `content/types.ts` verify BusinessSample shape
2. Read `content/beauty.ts` de xem full template (9 entries)
3. Cho moi file blog/events/travel:
   - Doc entries hien co, identify gap (industry niche chua co)
   - Them 1 entry moi: name, tagline, products, testimonial, brandStory
   - Verify `businesses.length === 9`
4. Chay `npm run harness:gen` — verify khong break (390 van OK)
5. Spot-check fixture cua 3 cats thay 9 variants khac nhau
6. Commit: `feat(content): add 1 business sample each to blog/events/travel`

## Todo List

- [ ] Read BusinessSample type
- [ ] Add entry to blog.ts (niche: e.g. tech blogger)
- [ ] Add entry to events.ts (niche: e.g. corporate gala)
- [ ] Add entry to travel.ts (niche: e.g. halal family tour)
- [ ] Run harness
- [ ] Commit + PR

## Success Criteria

- `content/{blog,events,travel}.ts` moi file co 9 entries businesses
- Harness 390/390 pass
- Variety metric (heroVariants per category) khong giam

## Risk Assessment

- **Risk:** Entry sai shape -> TS error. Mitigation: copy tu beauty.ts va chi doi content value.
- **Risk:** Content dung thuong hieu thuc te -> legal. Mitigation: generic plausible name (e.g. "TechTalk MY" thay vi "CodeSaya").

## Security Considerations

N/A — static content data.

## Next Steps

- Optional; user quyet dinh ship v1.0 hay defer v1.1.
- Neu ship v1.0: chay sau phase 01 + 02 cho don gian.
