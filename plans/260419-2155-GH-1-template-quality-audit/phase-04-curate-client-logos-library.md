# Phase 04 — Curate client-logos library (84 logos)

**Priority:** P2 (OPTIONAL — polish, user decides ship v1.0 or defer) | **Effort:** 3h | **Status:** pending

## Context Links

- Research: `research/researcher-02-quality-issues-and-levers.md` §3 (Client Logos Library table)
- Research code refs: `content-injection.ts:569-575`, `template-composer.ts:1175`, `category-recipes.ts:237,417`

## Overview

Client-logos block hien render placeholder "Partner 1..6" tren moi category. Business + tech recipes **require** client-logos -> van luon render synthetic. Muc tieu: 6 logo cho moi cat x 14 cat = **84 logos** co typography/branding dac trung.

Optional boi vi:
- Harness van pass.
- Fall-back "Partner N" co text cho text, khong break visual.
- Unsplash khong co logo asset -> phai text-based SVG hoac brand name + font.

## Key Insights

- Researcher-02 §3 "Client Logos Library": "No `logos: string[]` field in `CategoryContent` type"; "buildClientLogos always renders synthetic"
- Chien luoc kha thi: brand name + distinct Google Font + optional icon (low-budget, no Figma/designer needed)
- 84 logos = 14 cat x 6 logos; moi cat dung cung font family khac nhau de dac trung

## Requirements

**Functional:**
- Them field `logos: LogoEntry[]` vao `CategoryContent` type
- Moi cat `content/*.ts` co 6 logo (name + optional SVG path + font recommendation)
- `buildClientLogos()` doc tu library thay vi `Partner N`
- Fallback ve `Partner N` neu cat thieu logos (defensive)

**Non-functional:**
- Logo text-based, khong vi pham brand copyright
- Font pair khop design personality cua cat (vd tech -> monospace; beauty -> serif)

## Architecture

```
CategoryContent.logos (new field)
  │
  └─> buildClientLogos(biz, content, seed) ── doc 6 logos ──> render <ClientLogos items=[...6] />
                                                              (text + font; no image required)
```

**Logo entry shape (proposal):**
```ts
interface LogoEntry {
  name: string;         // "TechSaya"
  fontFamily?: string;  // e.g. 'IBM Plex Mono' — overrides default
  accentColor?: string; // hex — optional brand color hint
  style?: 'bold' | 'light' | 'serif';
}
```

## Related Code Files

**Modify:**
- `src/lib/ai/content/types.ts` — them `logos?: LogoEntry[]` vao `CategoryContent`
- `src/lib/ai/content/*.ts` (14 files) — them `logos: [...6 entries]`
- `src/lib/ai/content-injection.ts:569-575` — xoa placeholder builder
- `src/lib/ai/template-composer.ts:1175` — read from content library

**Read for context:**
- `src/blocks/client-logos/index.tsx` — render logic
- `src/blocks/client-logos/config.ts` — variant support (marquee, grid)
- `src/lib/ai/category-recipes.ts:237,417` — business/tech require logos

**Create/Delete:** None.

## Implementation Steps

1. Read `content/types.ts` CategoryContent shape
2. Define `LogoEntry` + extend type
3. Cho moi 14 content file, them 6 logo entries:
   - Generate plausible brand names (vd restaurant: "Warung Nuansa", "Selera Lima"...)
   - Map font theme cat (tech=mono, beauty=serif, fitness=bold sans...)
4. Update `buildClientLogos()` de uu tien `content.logos`, fallback `Partner N`
5. Verify render component ho tro `fontFamily` prop (neu khong -> accept default render)
6. Chay harness; spot check client-logos block render 6 brand names
7. Commit: `feat(content): curate client-logos library 6/cat`

## Todo List

- [ ] Extend CategoryContent type
- [ ] Add 6 logos to restaurant.ts
- [ ] ... repeat 14 files
- [ ] Update buildClientLogos composer logic
- [ ] Render test (visual spot-check)
- [ ] Commit + PR

## Success Criteria

- 14 content files moi co `logos.length === 6`
- Harness 390/390 pass
- Spot-check: business/tech fixtures render 6 real-feeling brand names (khong "Partner N")

## Risk Assessment

- **Risk:** Font family list lan tran vao theme resolver; break font pairing whitelist. Mitigation: fontFamily optional; default to theme nav font.
- **Risk:** Brand name vo tinh trung thuc te brand MY. Mitigation: search google "brand name malaysia" truoc khi merge; avoid known big brands.
- **Risk:** Component khong ho tro custom font -> se fall back to default render; van OK.

## Security Considerations

N/A — static text content.

## Next Steps

- Optional; user quyet dinh ship v1.0 hay defer v1.1.
- Dep hon: hire designer lam SVG logo set -> v1.1 polish.
