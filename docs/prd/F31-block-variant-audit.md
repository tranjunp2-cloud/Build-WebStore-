# PRD: Block Variant Audit & Fix (F31-BVA)
> **Version:** 1.0 | **Created:** 2026-04-07 | **Agent:** `documentation-engineer`
> **Priority:** P1 | **Sprint:** Wave 4 — Sprint hien tai | **Size:** XL
> **Depends on:** F04 Block Renderer (infrastructure), F31 Template Blueprints (consumer)
> **Blocks:** F30 Template System v2, QA Template smoke tests

---

> **Ghi chu:** PRD nay la infrastructure quality PRD — target user la AI engine, editor UI, va published site.
> Scope duoc validate tu `plans/260407-1021-block-variant-audit/plan.md` (2026-04-07).
> Day la F31-BVA (Block Variant Audit), tach biet voi F31 Template Blueprints.

---

## 0. Story Traceability

| Story ID | Title | Notes |
|----------|-------|-------|
| US-F04-05 | Block Variants Render Uniquely | F04 AC-5 — variant routing |
| US-F31-01 | Templates hien thi dung DNA theo nganh | Requires variants dung |
| US-F31-03 | Seed 56 premium blueprints | Blueprints dung CSS_VARS va variant dung |

> **Ghi chu:** F31-BVA la prerequisite cho F31 Template Blueprints. Khong co User Story file rieng
> vi day la technical quality gate — scope duoc gated boi usage tu F04, F31.

---

## 1. Problem Statement

He thong 51 blocks hien tai da duoc xay dung tu F04 Block Renderer, nhung qua trinh phat trien
nhanh (Sprint 1-4) de lai nhieu loi chat luong o lop variant rendering:

- **Dead variants lam sai UX editor:** 6 blocks co it nhat 1 variant la "dead" — khi user chon
  variant trong SettingsPanel.tsx, UI render y het default variant ma khong co bat ky visual
  difference nao. Confirmed dead: `hero/video`, `gallery/masonry`, `gallery/carousel`,
  `navigation/centered`, `navigation/mega-menu`, `testimonials/carousel`, `testimonials/simple`,
  `pricing/table`, `footer/expanded`, `footer/minimal`. User chon "table" nhung thay "cards" —
  day la UX bug nghiem trong, khong phai chi cosmetic.

- **Design token inconsistency phu ve toan bo 51 blocks:** 6 trong 14 blocks tier-1/tier-2
  (about, faq, newsletter, stats, team, cta) khong import `CSS_VARS` tu `src/lib/theme/resolve.ts`.
  Thay vao do, blocks nay hardcode gia tri mau (`#0ea5e9`, `#f59e0b`) hoac dung Tailwind class
  co dinh. Hau qua: khi user thay doi brand color trong editor, 6 blocks nay khong re-render,
  tao ra website co hai nua follow theme, hai nua hardcode — phan pha vo trust vao AI builder.

- **Hero block 856 LOC — khong maintain duoc:** `src/blocks/hero/index.tsx` co 856 dong code,
  12 variants nam trong 1 file duy nhat voi switch/case phan tang. Them 1 variant moi = rui ro
  break tat ca 11 variants con lai. Khong co isolated testing. Day la tech debt cap do P1 can
  refactor truoc khi team tiep tuc them features.

- **0 automated test cho variant rendering:** Toan bo 51 blocks x ~175 variants khong co 1
  Vitest test nao kiem tra variant routing. QA phai test tay 175 paths moi sprint — khong scalable.

---

## 2. Target User

- **AI engine (primary)** — generate site JSON voi `variant` field, can biet variant se render
  dung nhu mo ta de AI chon variant phu hop voi nghanh/personality cua template
- **Editor UI / SettingsPanel** — hien thi variant buttons, can biet variant nao co visual diff
  thuc su (de khong show button cho dead variants)
- **Published site (storefront)** — render block voi variant duoc user chon, can consistent
  visual output giua editor preview va live site
- **Internal dev/QA** — can verification script chay local de xac nhan 100% variants dung

---

## 3. Solution Overview

**Audit va fix toan bo ~175 variants trong 51 blocks.** Moi variant phai: (1) render layout
khac biet ro rang so voi default, (2) dung CSS_VARS cho mau/font/spacing, (3) responsive tren
moi breakpoint, (4) co automated test map voi TC-ID.

**4 viec chinh:**
1. **Fix dead variants** — implement layout thuc su cho 10+ dead variants (hero/video,
   gallery/masonry, gallery/carousel, navigation/centered, navigation/mega-menu,
   testimonials/carousel, testimonials/simple, pricing/table, footer/expanded, footer/minimal)
2. **CSS_VARS compliance** — migrate 6+ blocks (about, faq, newsletter, stats, team, cta) sang
   dung CSS_VARS thay hardcode colors
3. **Hero refactor** — tach `src/blocks/hero/index.tsx` (856 LOC) ra `variants/` directory
4. **Verification script** — `pnpm verify:variants` chay local, check visual diff matrix

---

## 4. Scope

### In Scope
- Audit va fix toan bo 51 blocks, ~175 variants
- Implement 10+ dead variants voi layout thuc su
- CSS_VARS compliance cho tat ca 51 blocks
- Hero block refactor sang `variants/` directory structure
- Responsive check tren 375px, 768px, 1280px cho moi variant
- Local verification script (`scripts/verify-variants.mjs`)
- Unit tests cho variant routing (TC-ID traced)

### Out of Scope
- Them variants moi ngoai danh sach da dinh nghia trong `config.ts` (scope cua F30 Sprint 5+)
- Visual design overhaul / rebrand blocks (scope cua UI Polish feature rieng)
- Animation/motion upgrade (da duoc xu ly trong F30 Sprint 3 Wix standards PR)
- CI blocking cho variant check (validated decision: script local only)
- New block types (scope cua F04 extension)
- Template composer logic (scope cua F31 Template Blueprints)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Dead variants da fix | 100% (0 dead variants con lai) | `pnpm verify:variants` output |
| CSS_VARS compliance | 100% blocks dung CSS_VARS cho colors | Code review + script |
| Variant visual diff | Moi variant co >= 1 layout property khac default | Visual matrix script |
| Test coverage | >= 80% variant routing paths co unit test | Vitest coverage report |
| Hero file size | index.tsx < 200 LOC sau refactor | `wc -l` |
| Block render time | < 50ms per block (khong regression) | Lighthouse profiler |
| Responsive pass | 100% variants render khong overflow tren 375px | Playwright mobile |

---

## 6. User Stories

### Story 1: Editor variant selector hien thi dung

```
AS A website owner dang dung editor
I WANT TO chon variant "Table" cho pricing block va thay layout doi thanh table thuc su
SO THAT toi co the preview chinh xac website se trong nhu the nao truoc khi publish
```

### Story 2: AI engine chon variant phu hop voi nghanh

```
AS THE AI engine khi generate template cho restaurant
I WANT TO chon `hero/split-left` va `gallery/masonry` va biet chung se render khac nhau
SO THAT website AI generate co visual diversity va khong trong giong nhau
```

### Story 3: Brand color thay doi apply ngay lap tuc

```
AS A website owner vua doi brand color tu blue sang green
I WANT TO thay tat ca blocks cap nhat mau ngay lap tuc (ke ca about, faq, cta)
SO THAT website preview luon consistent voi brand color moi
```

---

## 7. Functional Requirements

> **Priority key:** P0 = must have (blocker) | P1 = important | P2 = nice to have

### 7A. Variant Rendering — Fix Dead Variants

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | `hero/video` phai render full-bleed video background voi overlay text, khac hoan toan voi `hero/centered` | US-F04-05 | P0 | Implement `<video>` element, controls hidden, autoplay muted loop |
| FR-02 | `gallery/masonry` phai render CSS masonry grid (column-count: 3), khac voi `gallery/grid` | US-F31-01 | P0 | Dung CSS columns hoac masonry JS lib |
| FR-03 | `gallery/carousel` phai render horizontal scroll carousel voi prev/next buttons | US-F31-01 | P0 | Dung Embla Carousel hoac CSS scroll-snap |
| FR-04 | `navigation/centered` phai render logo center, links chia deu hai ben | US-F04-05 | P0 | `grid-cols-3` voi logo o giua |
| FR-05 | `navigation/mega-menu` phai render dropdown voi multi-column menu khi hover | US-F04-05 | P1 | Dropdown panel co min 2 columns |
| FR-06 | `testimonials/carousel` phai render auto-rotating carousel, 1 testimonial at a time | US-F31-01 | P0 | Auto-rotate 5s, pause on hover |
| FR-07 | `testimonials/simple` phai render single large quote, no cards, centered text | US-F04-05 | P0 | Full-width quote block, large font |
| FR-08 | `pricing/table` phai render comparison table voi rows la features, columns la tiers | US-F31-01 | P0 | HTML `<table>` hoac CSS grid matrix |
| FR-09 | `footer/expanded` phai render 4-column layout voi newsletter form o bottom | US-F31-01 | P0 | Grid-cols-4, newsletter input row |
| FR-10 | `footer/minimal` phai render single-line footer: logo + nav links + copyright | US-F04-05 | P0 | Flexbox row, no multi-column |

### 7B. Design Token Compliance — CSS_VARS

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-11 | Tat ca 51 blocks phai import va dung `CSS_VARS` tu `src/lib/theme/resolve.ts` cho mau sac | US-F31-03 | P0 | Khong hardcode hex colors |
| FR-12 | Color values phai dung CSS custom properties (`var(--brand-primary)`) thay vi Tailwind static classes (`text-sky-500`) | US-F31-03 | P0 | Cho phep Tailwind classes ma bind vao CSS vars |
| FR-13 | Font family phai dung `CSS_VARS.fontHeading` va `CSS_VARS.fontBody` (khong hardcode font name) | US-F31-03 | P1 | `style={{ fontFamily: CSS_VARS.fontHeading }}` |
| FR-14 | Spacing phai dung `CSS_VARS.sectionPadding` cho section padding, khong hardcode `py-20` | US-F31-03 | P2 | Cho phep Tailwind responsive padding khi can |
| FR-15 | Border radius phai map tu `ThemeConfig.borderRadius` sang CSS_VARS tuong ung | US-F31-03 | P1 | `sharp` → `radius-sm`, `pill` → `radius-full` |

### 7C. Hero Block Refactor

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-16 | `src/blocks/hero/index.tsx` phai split ra `variants/` directory, moi variant = 1 file | US-F04-05 | P1 | `hero/variants/centered.tsx`, `hero/variants/split-left.tsx`, ... |
| FR-17 | `hero/index.tsx` sau refactor chi la router, < 200 LOC | US-F04-05 | P1 | `const variants = { centered: CenteredHero, ... }; return variants[variant]` |
| FR-18 | Moi hero variant file phai export named component va khong co side effects | US-F04-05 | P1 | `export function CenteredHero({ block, theme }: BlockProps<HeroConfig>)` |

### 7D. Responsive Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-19 | Moi variant phai render khong co horizontal overflow tren 375px | US-F31-01 | P0 | `max-w-full overflow-x-hidden` at block level |
| FR-20 | 2-column layouts phai stack thanh 1 column tren mobile (<768px) | US-F31-01 | P0 | `grid-cols-1 md:grid-cols-2` pattern |
| FR-21 | Carousel/slider variants phai enable touch swipe tren mobile | US-F31-01 | P1 | Embla default handle touch |

### 7E. Verification & Testing

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-22 | Script `scripts/verify-variants.mjs` phai check tat ca 51 blocks: variant list vs config.ts | US-F04-05 | P1 | Output: pass/fail per block |
| FR-23 | Unit tests phai cover variant routing cho toan bo 4 Tier-1 blocks (hero, features, testimonials, pricing) | US-F04-05 | P1 | Vitest + React Testing Library, TC-ID traced |
| FR-24 | Unknown variant phai fallback ve `defaultVariant` trong config, khong crash | US-F04-05 | P0 | `const v = variants[block.variant] ?? variants[meta.defaultVariant]` |

---

## 8. Business Rules

- **BR-01:** Variant fallback — Neu `block.variant` khong nam trong danh sach `meta.variants`, render `meta.defaultVariant`. Khong throw error, khong render empty.
- **BR-02:** CSS_VARS mandatory — Bat ky color value nao visible tren published site PHAI di qua CSS custom properties. Hardcoded hex chi cho phep o non-theming elements (e.g. gray borders decorative).
- **BR-03:** Dead variant elimination — Mot variant duoc coi la "live" neu no co >= 1 CSS property khac voi default variant (layout, background, flex-direction, hoac grid-template-columns).
- **BR-04:** Video variant — Video background phai co `autoplay muted loop playsInline`. Video pause khi tab hidden (`IntersectionObserver` hoac `visibilitychange`).
- **BR-05:** Performance — Moi block import CSS_VARS nhu module-level constant, khong goi `resolveTheme()` inside render loop.

---

## 9. Variant Specification Tables

> Day la section quan trong nhat cho implementer. Moi block co table chi ro layout expected.

---

### hero (12 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `centered` **(default)** | Text center-aligned, CTA below, optional full-width bg image | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.fontHeading` | Full width tat ca breakpoints |
| `split-left` | 2-col grid, text trai, image phai | Image phai thay bg | `primary`, `fontHeading`, `shadowLg` | Stack mobile: text tren, image duoi |
| `split-right` | 2-col grid, image trai, text phai | Image trai thay bg | `primary`, `fontHeading`, `shadowLg` | Stack mobile: image tren, text duoi |
| `fullscreen` | Viewport height (100vh), text center, dark overlay | 100vh height, overlay | `primary`, `background` | Full height tren moi breakpoint |
| `video` **(DEAD → FIX)** | Full-bleed `<video>` background, text overlay | Video thay vi static image | `primary`, `accent` (overlay), rgba | Video hidden tren mobile → fallback image |
| `magazine` | Asymmetric grid: 70% image left, 30% text right | Asymmetric layout | `primary`, `surface`, `muted` | Collapse to 1 col on mobile |
| `minimal` | Text only, no image, large typography, centered | No image at all | `primary`, `fontHeading`, `text` | Padding reduce tren mobile |
| `cards-overlay` | 3-card grid overlay on top of hero bg | Cards floating on bg | `surface`, `shadowMd`, `radiusMd` | Cards stack 1 col on mobile |
| `gradient` | Gradient background (primary → secondary), text center | Gradient bg thay vi solid | `primary`, `secondary`, `fontHeading` | Same as centered responsive |
| `parallax` | CSS parallax scroll effect, image moves slower than text | Parallax scroll | `primary`, `background`, `text` | Disable parallax on mobile (performance) |
| `slideshow` | Auto-rotating slides (3-5 images), dots navigation | Multiple slides | `primary`, `accent` (dots) | Touch swipe on mobile |
| `split-video` | 2-col: text trai, video phai (iframe embed) | Video phai thay image | `primary`, `shadowLg` | Stack mobile: text tren, video duoi |

---

### features (8 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid-2` | 2-column feature cards | 2 cols thay vi 3 | `primary`, `surface`, `radiusMd` | 1 col on mobile |
| `grid-3` **(default)** | 3-column feature cards | DEFAULT | `primary`, `surface`, `radiusMd` | 1→2→3 col breakpoints |
| `grid-4` | 4-column feature cards | 4 cols, smaller cards | `primary`, `surface`, `radiusSm` | 1→2→4 col breakpoints |
| `list` | Vertical list, icon left, text right | No grid, list layout | `primary`, `text`, `muted` | Same layout mobile |
| `icon-top` | Icon centered top, text below each card | Icon above text | `primary`, `surface`, `radiusMd` | 1→2→3 col |
| `icon-left` | Icon left of text content (inline) | Icon inline with text | `primary`, `text` | Stack on xs mobile |
| `zigzag` | Alternating image/text left-right sections | Zigzag layout | `primary`, `surface`, `shadowMd` | Stack all mobile |
| `carousel` | Horizontal scrolling carousel of feature cards | Carousel instead of grid | `primary`, `surface`, `radiusMd` | Touch swipe |

---

### testimonials (8 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `cards` **(default)** | 3-column grid of testimonial cards | DEFAULT | `surface`, `shadowMd`, `radiusMd` | 1→2→3 col |
| `carousel` **(DEAD → FIX)** | Auto-rotating carousel, 1 at a time, arrows + dots | Single card full width | `surface`, `primary` (dots), `shadowLg` | Touch swipe, full width |
| `simple` **(DEAD → FIX)** | Single large centered quote, no card border, large font | No card UI, just quote text | `primary`, `fontHeading`, `text` | Center-aligned all breakpoints |
| `masonry` | Masonry grid (varying card heights) | Varying heights | `surface`, `shadowMd`, `radiusMd` | 2-col mobile, 3-col desktop |
| `spotlight` | 1 large featured testimonial center + 2 small flanking | Asymmetric spotlight | `surface`, `primary`, `shadowLg` | Stack 1 col mobile |
| `minimal-quote` | Just quote text + author, no card, divider line | Minimal, no bg card | `muted`, `text`, `primary` | Full width all |
| `avatar-row` | Row of avatar images + star rating + summary quote | Avatar focus layout | `primary`, `surface` | Horizontal scroll mobile |
| `video-text` | Video thumbnail left, text testimonial right | Video thumbnail | `shadowMd`, `radiusMd` | Stack mobile |

---

### pricing (8 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `cards` **(default)** | 2-3 column pricing cards, featured card highlighted | DEFAULT | `primary`, `surface`, `shadowLg` | 1→2→3 col |
| `table` **(DEAD → FIX)** | HTML comparison table: features as rows, tiers as columns | Table layout, checkmarks/x | `primary`, `surface`, `muted` | Horizontal scroll on mobile |
| `horizontal` | All tiers in 1 row, equal width | Horizontal row | `primary`, `surface`, `shadowMd` | Stack vertical mobile |
| `toggle` | Monthly/Annual toggle switch, price updates | Toggle UI | `primary`, `accent`, `surface` | Same cards, add toggle |
| `tiered` | 3-tier with visual size difference (starter < pro < enterprise) | Size hierarchy | `primary`, `secondary`, `accent` | 1 col mobile |
| `comparison` | Side-by-side 2-plan deep comparison | 2-plan focus | `primary`, `surface`, `muted` | Stack mobile |
| `minimal` | Text-only pricing, no cards, just price + bullets | No card container | `text`, `primary`, `muted` | Same minimal mobile |
| `slider` | Price slider input → dynamically show matching plan | Interactive slider | `primary`, `accent` | Full width slider mobile |

---

### gallery (6 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Equal-size grid (3 cols) | DEFAULT | `shadowSm`, `radiusMd` | 2→3 col |
| `masonry` **(DEAD → FIX)** | CSS masonry column layout, varying heights | Column masonry | `shadowMd`, `radiusMd` | 2 col mobile, 3 col desktop |
| `carousel` **(DEAD → FIX)** | Full-width carousel, 1 image at a time, arrows | Carousel not grid | `shadowLg`, `radiusMd`, `primary` | Touch swipe |
| `lightbox` | Grid + lightbox modal on click | Click opens lightbox overlay | `background`, `shadowLg`, `primary` | Pinch zoom on mobile |
| `filmstrip` | Main large image + thumbnail strip below | 2-row layout | `shadowMd`, `radiusSm` | Thumbnails horizontal scroll |
| `justified` | Justified layout (all images same height, varying widths) | Justified rows | `shadowSm`, `radiusSm` | 2 col justified mobile |

---

### navigation (6 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `simple` **(default)** | Logo left, links right, CTA button far right | DEFAULT | `primary`, `background`, `text` | Hamburger on mobile |
| `centered` **(DEAD → FIX)** | Logo center, links split equally L/R | Logo center grid-col-3 | `primary`, `background`, `text` | Hamburger on mobile |
| `mega-menu` **(DEAD → FIX)** | Hover dropdown voi multi-column panel | Dropdown panel 2+ cols | `surface`, `shadowLg`, `primary` | Full-width drawer on mobile |
| `transparent` | Transparent bg, white text, becomes solid on scroll | Transparent until scroll | `primary`, text white initial | Hamburger on mobile |
| `sidebar` | Vertical sidebar navigation (fixed left) | Vertical layout | `surface`, `primary`, `shadowMd` | Drawer overlay on mobile |
| `pill` | Centered floating navbar voi rounded pill background | Floating pill shape | `primary`, `background`, `shadowMd`, `radiusFull` | Collapsed pill on mobile |

---

### contact (6 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `form` **(default)** | Full contact form (name, email, message) | DEFAULT | `primary`, `surface`, `radiusMd` | 1 col mobile |
| `info-only` | Contact info cards (phone, email, address), no form | No form | `surface`, `primary`, `shadowSm` | Stack cards mobile |
| `split` | Form left, map/info right | 2-col split | `surface`, `primary`, `shadowMd` | Stack mobile |
| `card-float` | Form in floating card, centered on gradient bg | Floating card effect | `primary`, `surface`, `shadowLg` | Card full width mobile |
| `map-split` | Google Maps full left half, info right | Map integration | `primary`, `surface` | Map on top mobile |
| `minimal-inline` | Inline single-line form (email + submit), horizontal | Compact inline | `primary`, `surface`, `radiusFull` | Stack on mobile |

---

### footer (6 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `simple` **(default)** | 3-col: logo+desc, links, contact. Copyright row below | DEFAULT | `background`, `text`, `muted` | 1 col stack mobile |
| `expanded` **(DEAD → FIX)** | 4-col links + newsletter form row at bottom | 4 cols + newsletter | `primary`, `surface`, `background` | 2 col tablet, 1 col mobile |
| `minimal` **(DEAD → FIX)** | Single horizontal line: logo + links + copyright | 1 row, no multicolumn | `text`, `muted`, `background` | Wrap on mobile |
| `centered-stack` | Everything centered, stacked vertically | Center-aligned | `text`, `muted`, `primary` | Same center mobile |
| `mega-footer` | 5+ column rich footer with sub-sections | 5+ cols | `surface`, `text`, `muted` | 2 col tablet, 1 col mobile |
| `dark-gradient` | Dark gradient background, light text | Dark themed | `primary`, `text` (light), gradient | Same layout dark |

---

### cta (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `banner` **(default)** | Full-width banner, text center, CTA button | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.text` | Full width |
| `inline` | Inline section: text left, button right | Text left, button right | `CSS_VARS.primary`, `CSS_VARS.surface` | Stack mobile |
| `floating` | Floating sticky bar at bottom of viewport | Fixed position bar | `CSS_VARS.primary`, `CSS_VARS.background` | Full width sticky |

---

### stats (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `row` **(default)** | Horizontal row of stat items | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.text` | 2 col mobile, row desktop |
| `grid` | 2x2 or 3x3 grid layout | Grid vs row | `CSS_VARS.primary`, `CSS_VARS.surface` | Same grid mobile |
| `highlight` | Large central featured stat + smaller surrounding | 1 big + N small | `CSS_VARS.primary`, `CSS_VARS.accent` | Stack mobile |

---

### newsletter (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `inline` **(default)** | Inline form trong page section | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | Stack mobile |
| `popup` | Modal popup triggered by scroll/exit intent | Popup overlay | `CSS_VARS.primary`, `CSS_VARS.background` | Center modal mobile |
| `banner` | Full-width top/bottom banner form | Banner layout | `CSS_VARS.primary`, `CSS_VARS.accent` | Full width |

---

### about (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `simple` **(default)** | Text + optional image, centered | DEFAULT | `CSS_VARS.text`, `CSS_VARS.muted` | Full width |
| `split` | Image left, text right (or reverse) | 2-col split | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Stack mobile |
| `story` | Timeline/story format with multiple sections | Timeline layout | `CSS_VARS.primary`, `CSS_VARS.muted` | Vertical timeline mobile |

---

### faq (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `accordion` **(default)** | Expandable accordion items | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | Full width |
| `grid` | 2-column grid of Q&A cards | Grid layout | `CSS_VARS.surface`, `CSS_VARS.shadowSm` | 1 col mobile |
| `simple` | Plain list of Q&A, no accordion, all expanded | No interactive | `CSS_VARS.text`, `CSS_VARS.muted` | Full width |

---

### accordion (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `bordered` **(default)** | Each item has border | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.text` | Full width |
| `separated` | Items have gap/margin between them, floating | Gap between items | `CSS_VARS.surface`, `CSS_VARS.shadowSm` | Full width |
| `flush` | No borders, flush with parent | No borders | `CSS_VARS.text`, `CSS_VARS.muted` | Full width |

---

### announcement-bar (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `gradient` **(default)** | Gradient background bar at top | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.secondary` | Full width, text wrap |
| `solid` | Solid color bar | Solid color | `CSS_VARS.primary`, `CSS_VARS.text` | Full width |
| `minimal` | Plain text bar, no background color | Minimal style | `CSS_VARS.muted`, `CSS_VARS.text` | Full width |

---

### booking-widget (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `inline` **(default)** | Full booking form inline trong page | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | 1 col mobile |
| `sidebar` | Compact sidebar booking form | Sidebar width | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Full width mobile |
| `modal-trigger` | CTA button → opens modal form | Modal overlay | `CSS_VARS.primary`, `CSS_VARS.background` | Full width modal mobile |

---

### carousel (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `images` **(default)** | Image carousel | DEFAULT | `CSS_VARS.shadowMd`, `CSS_VARS.radiusMd` | Touch swipe |
| `cards` | Content cards carousel | Cards layout | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Touch swipe |
| `testimonials` | Testimonials as carousel | Quote cards | `CSS_VARS.surface`, `CSS_VARS.primary` | Touch swipe |

---

### class-schedule (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Weekly grid schedule | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | Horizontal scroll mobile |
| `list` | List view by day | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Full width |
| `cards` | Individual class cards | Card layout | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 1 col mobile |

---

### client-logos (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `scroll` **(default)** | Infinite horizontal scroll/marquee | DEFAULT | `CSS_VARS.muted` | Same |
| `grid` | Static grid of logo images | Static grid | `CSS_VARS.surface` | 3 col mobile |
| `fade` | Fade in/out animation logos | Fade animation | `CSS_VARS.muted` | Same |

---

### countdown-timer (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `banner` **(default)** | Full-width banner with countdown | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.accent` | Full width |
| `card` | Countdown inside a card | Card container | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Center card mobile |
| `minimal` | Just numbers, no labels, compact | Minimal display | `CSS_VARS.text`, `CSS_VARS.primary` | Inline |

---

### doctor-profile (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `cards` **(default)** | Grid of doctor profile cards | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 1→2→3 col |
| `detailed` | Single doctor detailed profile view | Full detail layout | `CSS_VARS.surface`, `CSS_VARS.primary` | 1 col mobile |
| `list` | List view with smaller avatar | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Full width |

---

### download-cta (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `card` **(default)** | Download card with icon + button | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.primary` | Full width mobile |
| `banner` | Full-width download banner | Banner layout | `CSS_VARS.primary`, `CSS_VARS.accent` | Full width |
| `minimal` | Text link only, no card | Minimal text | `CSS_VARS.primary`, `CSS_VARS.text` | Inline |

---

### gallery-masonry (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `masonry` **(default)** | CSS masonry, varying heights | DEFAULT | `CSS_VARS.shadowSm`, `CSS_VARS.radiusMd` | 2 col mobile |
| `grid-3` | Uniform 3-column grid | Equal-size grid | `CSS_VARS.shadowSm`, `CSS_VARS.radiusSm` | 2→3 col |
| `grid-4` | Uniform 4-column grid | 4 cols, smaller | `CSS_VARS.shadowSm`, `CSS_VARS.radiusSm` | 2→4 col |

---

### menu-display (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `tabs` **(default)** | Category tabs + items below | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | Horizontal scroll tabs |
| `photo-grid` | Grid of menu items with photos | Photo grid | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 2 col mobile |
| `accordion` | Expandable category sections | Accordion | `CSS_VARS.surface`, `CSS_VARS.primary` | Full width |

---

### menu-food (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `classic` **(default)** | Traditional menu text layout | DEFAULT | `CSS_VARS.text`, `CSS_VARS.muted` | Full width |
| `cards` | Item cards with image + price | Card layout | `CSS_VARS.surface`, `CSS_VARS.shadowSm` | 1→2 col |
| `minimal` | Minimal text-only list | Plain list | `CSS_VARS.text`, `CSS_VARS.muted` | Full width |

---

### portfolio-grid (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Equal-size portfolio grid | DEFAULT | `CSS_VARS.shadowMd`, `CSS_VARS.radiusMd` | 2 col mobile |
| `masonry` | Masonry varying heights | Masonry | `CSS_VARS.shadowMd`, `CSS_VARS.radiusMd` | 2 col mobile |
| `showcase` | Hero image + thumbnails below | Showcase layout | `CSS_VARS.shadowLg`, `CSS_VARS.primary` | Stack mobile |

---

### product-quick-view (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Product card grid with quick view | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.primary` | 2 col mobile |
| `carousel` | Product carousel | Carousel | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Touch swipe |
| `minimal` | Minimal product list | List layout | `CSS_VARS.text`, `CSS_VARS.muted` | Full width |

---

### products-grid (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid-3` **(default)** | 3-column product grid | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 1→2→3 col |
| `grid-4` | 4-column product grid | 4 cols, smaller | `CSS_VARS.surface`, `CSS_VARS.shadowSm` | 2→4 col |
| `list` | Horizontal list, image left, info right | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Stack mobile |

---

### property-card (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Property card grid | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 1→2 col |
| `list` | Horizontal list cards | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Stack mobile |
| `featured` | 1 large featured + grid below | Featured + grid | `CSS_VARS.shadowLg`, `CSS_VARS.primary` | Stack mobile |

---

### review-cards (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | 3-col review cards | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowSm` | 1→2→3 col |
| `carousel` | Review carousel | Carousel | `CSS_VARS.surface`, `CSS_VARS.primary` | Touch swipe |
| `masonry` | Masonry varying heights | Masonry | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 2 col mobile |

---

### service-cards (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Service card grid | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.primary` | 1→2→3 col |
| `list` | Vertical list | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Full width |
| `featured` | 1 large featured service + grid | Featured layout | `CSS_VARS.primary`, `CSS_VARS.shadowLg` | Stack mobile |

---

### social-proof (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `cards` **(default)** | Social proof cards (logos + numbers) | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowSm` | 2 col mobile |
| `minimal` | Text numbers only, no cards | No card UI | `CSS_VARS.text`, `CSS_VARS.primary` | Row on mobile |
| `grid` | Grid layout | Grid | `CSS_VARS.surface`, `CSS_VARS.primary` | 2 col mobile |

---

### step-process (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `vertical` **(default)** | Vertical timeline steps | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | Full width |
| `horizontal` | Horizontal step indicator | Horizontal layout | `CSS_VARS.primary`, `CSS_VARS.muted` | Horizontal scroll mobile |
| `alternating` | Zigzag alternating steps L/R | Zigzag | `CSS_VARS.primary`, `CSS_VARS.surface` | Stack mobile |

---

### video-showcase (3 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Video thumbnail grid | DEFAULT | `CSS_VARS.shadowMd`, `CSS_VARS.radiusMd` | 1→2→3 col |
| `featured` | 1 large featured + thumbnails | Featured layout | `CSS_VARS.shadowLg`, `CSS_VARS.primary` | Stack mobile |
| `fullwidth` | Full-width video embed | Full width | `CSS_VARS.shadowLg` | Full width |

---

### team (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `grid` **(default)** | Team member cards grid | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 2 col mobile |
| `list` | Horizontal list, photo left | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Stack mobile |

---

### before-after (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `slider` **(default)** | Drag slider to reveal before/after | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.shadowMd` | Touch drag |
| `side-by-side` | 2 images side by side | Static 2-col | `CSS_VARS.shadowSm`, `CSS_VARS.radiusMd` | Stack mobile |

---

### blog-list (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `cards` **(default)** | Blog post cards grid | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 1→2→3 col |
| `list` | Horizontal list, image left | List layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Stack mobile |

---

### breadcrumb (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `simple` **(default)** | Text breadcrumb with separators | DEFAULT | `CSS_VARS.muted`, `CSS_VARS.primary` | Horizontal scroll |
| `with-icon` | Breadcrumb with home icon | Icon prefix | `CSS_VARS.primary`, `CSS_VARS.muted` | Horizontal scroll |

---

### cart-widget (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `floating` **(default)** | Floating cart icon fixed position | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.accent` | Bottom-right mobile |
| `inline` | Inline cart summary | Inline layout | `CSS_VARS.surface`, `CSS_VARS.primary` | Full width |

---

### feature-comparison (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `table` **(default)** | HTML comparison table | DEFAULT | `CSS_VARS.surface`, `CSS_VARS.primary` | Horizontal scroll |
| `cards` | Feature comparison cards | Card layout | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | 1 col mobile |

---

### google-maps (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `full-width` **(default)** | Full section width map | DEFAULT | none (iframe) | Full width |
| `card` | Map inside a card container | Card container | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Full width card |

---

### logo-cloud (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `row` **(default)** | Single row logo display | DEFAULT | `CSS_VARS.muted` | Horizontal scroll |
| `grid` | Multi-row grid | Grid layout | `CSS_VARS.surface`, `CSS_VARS.muted` | 3 col mobile |

---

### pricing-table (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `columns` **(default)** | Column-per-tier format | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | 1 col mobile |
| `horizontal` | Horizontal row comparison | Row layout | `CSS_VARS.surface`, `CSS_VARS.muted` | Vertical stack mobile |

---

### products-featured (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `hero-product` **(default)** | Large hero product display | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.surface` | Stack mobile |
| `carousel` | Product carousel | Carousel | `CSS_VARS.surface`, `CSS_VARS.shadowMd` | Touch swipe |

---

### social-widget (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `floating` **(default)** | Floating social icons | DEFAULT | `CSS_VARS.primary`, `CSS_VARS.background` | Fixed side mobile |
| `inline` | Inline social links | Inline layout | `CSS_VARS.primary`, `CSS_VARS.text` | Row |

---

### video (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `embed` **(default)** | YouTube/Vimeo iframe embed | DEFAULT | `CSS_VARS.shadowMd`, `CSS_VARS.radiusMd` | 16:9 ratio |
| `background` | Video as section background | BG video | `CSS_VARS.text` (overlay) | Pause on mobile |

---

### video-background (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `full` **(default)** | Full viewport video section | DEFAULT | `CSS_VARS.text`, `CSS_VARS.primary` | Image fallback mobile |
| `contained` | Video in container, not full-bleed | Contained box | `CSS_VARS.shadowLg`, `CSS_VARS.radiusMd` | Contained mobile |

---

### whatsapp-button (2 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `floating` **(default)** | Fixed floating WA button | DEFAULT | Green `#25D366` (brand exception) | Bottom-right |
| `inline` | Inline WA button in content | Inline | `CSS_VARS.surface` | Full width mobile |

---

### divider (4 variants)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `line` **(default)** | Horizontal line | DEFAULT | `CSS_VARS.muted` | Full width |
| `dots` | Row of dots | Dots pattern | `CSS_VARS.muted` | Center |
| `wave` | SVG wave shape | Wave SVG | `CSS_VARS.surface`, `CSS_VARS.background` | Full width |
| `spacer` | Empty vertical spacer, no visible element | Invisible spacer | none | Full width |

---

### custom-html (1 variant)

| Variant | Layout Description | Visual Diff vs Default | Design Tokens Required | Responsive Notes |
|---------|-------------------|----------------------|----------------------|-----------------|
| `default` **(default)** | Sanitized HTML render voi DOMPurify | DEFAULT | none (user HTML) | Responsive depends on user HTML |

---

## 10. Acceptance Criteria

### AC-01: Dead Variants Da Duoc Fix

```gherkin
GIVEN editor UI hien thi variant selector cho hero block
WHEN user chon variant "video"
THEN trang web preview hien thi full-bleed video background voi overlay text
  AND layout phai khac hoan toan voi variant "centered" (khong co video trong centered)
  AND video phai co autoplay muted loop playsInline attributes
```

### AC-02: Gallery Masonry Render Khac Grid

```gherkin
GIVEN editor UI hien thi variant selector cho gallery block
WHEN user chon variant "masonry"
THEN images render voi CSS column masonry layout (column-count: 2-3)
  AND moi image co height khac nhau (varying heights)
  AND layout phai visual khac biet so voi "grid" (equal-size grid)
```

### AC-03: Navigation Centered Router Hop Le

```gherkin
GIVEN block config { blockType: "navigation", variant: "centered" }
WHEN SiteRenderer render block
THEN logo render o vi tri center (grid-cols-3, logo o col 2)
  AND navigation links chia deu hai ben (col 1 va col 3)
  AND khong render giong nhu variant "simple" (logo left, links right)
```

### AC-04: Pricing Table Variant Render Comparison Table

```gherkin
GIVEN editor UI hien thi variant selector cho pricing block
WHEN user chon variant "table"
THEN render HTML comparison table hoac CSS grid matrix
  AND rows la danh sach features (vd: "Storage", "Users", "Support")
  AND columns la tier names (vd: "Starter", "Pro", "Enterprise")
  AND moi cell co checkmark hoac x icon
  AND layout hoan toan khac voi "cards" variant (no cards, just table)
```

### AC-05: CSS_VARS Compliance — About Block

```gherkin
GIVEN site theme { primaryColor: "#22c55e" } (green)
WHEN about block render voi bat ky variant nao
THEN headings va accents phai hien thi mau green (#22c55e)
  AND block KHONG dung hardcoded color (vi du "#0ea5e9" blue)
  AND khi user doi primary color sang "#ef4444" (red), about block tu dong update
```

### AC-06: CSS_VARS Compliance — CTA, FAQ, Newsletter, Stats, Team

```gherkin
GIVEN site theme { primaryColor: "#8b5cf6" } (purple)
WHEN cta, faq, newsletter, stats, team blocks render
THEN tat ca buttons, headings, accent elements phai dung CSS_VARS.primary (purple)
  AND khong co block nao con dung hardcoded hex colors cho theming elements
```

### AC-07: Hero Refactor — File Structure

```gherkin
GIVEN developer mo thu muc src/blocks/hero/
WHEN xem file structure
THEN phai co thu muc variants/ chua cac file: centered.tsx, split-left.tsx, split-right.tsx,
  fullscreen.tsx, video.tsx, magazine.tsx, minimal.tsx, cards-overlay.tsx, gradient.tsx,
  parallax.tsx, slideshow.tsx, split-video.tsx
  AND index.tsx chi chua router logic, LOC < 200
  AND moi variant file export named component
```

### AC-08: Hero Index.tsx La Pure Router

```gherkin
GIVEN hero/index.tsx
WHEN developer doc file
THEN file chi chua: import variants, map object { [variantName]: Component }, router function
  AND khong chua bat ky layout JSX nao (div, section, img, video, etc.)
  AND if variant unknown → fallback ve "centered"
```

### AC-09: Unknown Variant Fallback

```gherkin
GIVEN block config { blockType: "features", variant: "does-not-exist" }
WHEN SiteRenderer render block
THEN block render voi defaultVariant (grid-3)
  AND khong co console.error thrown
  AND khong co crash (ErrorBoundary khong bi trigger)
```

### AC-10: Responsive — No Overflow Tren Mobile

```gherkin
GIVEN bat ky block va bat ky variant
WHEN viewport width = 375px
THEN khong co horizontal overflow (document.documentElement.scrollWidth == 375)
  AND khong co element vuot qua viewport width
  AND text khong bi clip hoac hidden
```

### AC-11: 2-Column Variants Stack Mobile

```gherkin
GIVEN block variant co 2-column layout (vi du: hero/split-left, contact/split)
WHEN viewport width < 768px
THEN grid collapse thanh single column
  AND content phan theo thu tu logic (text truoc image tren hero)
```

### AC-12: Testimonials Carousel Auto-Rotate

```gherkin
GIVEN testimonials block voi variant "carousel"
WHEN block render va visible trong viewport
THEN carousel tu dong chuyen slide sau 5 giay
  AND co dots/arrows navigation
  AND pause rotation khi user hover
  AND resume khi hover out
```

### AC-13: Verification Script Pass

```gherkin
GIVEN developer chay "pnpm verify:variants"
WHEN script chay xong
THEN output bao gom pass/fail status cho tung block trong 51 blocks
  AND "PASS" neu tat ca variants trong meta.variants co branch trong switch/case
  AND "FAIL" voi ten variant bi thieu neu co dead variant
  AND exit code 0 khi pass, exit code 1 khi fail
```

### AC-14: Unit Test Coverage Cho Tier-1 Blocks

```gherkin
GIVEN test suite chay "pnpm test"
WHEN test runner finish
THEN phai co >= 1 test case cho moi variant cua 4 blocks: hero, features, testimonials, pricing
  AND moi test co TC-ID comment (vi du: // TC-BVA-001)
  AND tests verify correct component duoc render (not just "renders without crash")
```

### AC-15: Footer Minimal La Single-Line

```gherkin
GIVEN footer block voi variant "minimal"
WHEN render tren desktop (>= 1024px)
THEN tat ca content (logo, navigation links, copyright) nam tren 1 hang
  AND khong co multi-column layout
  AND khong co newsletter form
  AND visual phai khac biet so voi "simple" variant (3-column layout)
```

### AC-16: Footer Expanded Co Newsletter Form

```gherkin
GIVEN footer block voi variant "expanded"
WHEN render tren desktop
THEN co 4-column links section
  AND co newsletter form row o bottom (email input + subscribe button)
  AND links section va newsletter section tach biet bang horizontal divider
```

### AC-17: Design Token — Border Radius Map

```gherkin
GIVEN site theme { borderRadius: "pill" }
WHEN bat ky block render voi card hoac button
THEN elements phai dung CSS_VARS.radiusFull (var(--radius-full))
  AND khong dung hardcoded "rounded-md" hoac "rounded-lg" Tailwind class
  AND khi theme doi sang "sharp", borders tro thanh square
```

---

## 11. Non-Functional Requirements

| Category | Requirement | Target | Notes |
|----------|-------------|--------|-------|
| **Performance** | Block render time (single block, no data fetch) | < 50ms | Measured by React DevTools profiler |
| **Performance** | No layout shift (CLS) khi variant doi | CLS score < 0.1 | Google Lighthouse |
| **Performance** | CSS_VARS duoc resolve o module level, khong trong render loop | N/A (code pattern) | Enforce qua code review |
| **Bundle size** | Hero refactor khong tang bundle size (tree-shakeable variants) | +0 KB increase | `next build` output analysis |
| **Accessibility** | Tat ca interactive variants (carousel, accordion) co ARIA labels | WCAG 2.1 AA | axe-core audit |
| **Accessibility** | Keyboard navigation hoat dong cho accordion, carousel controls | Tab/Enter/Arrow keys | Manual QA |
| **Browser support** | Chrome 120+, Safari 17+, Firefox 122+, Edge 120+ | Latest -2 versions | Playwright cross-browser |
| **Device support** | Mobile 375px, Tablet 768px, Tablet landscape 1024px, Desktop 1280px, Wide 1440px | All pass | Playwright viewport tests |
| **TypeScript** | Zero `any` types trong variant files | 0 any | `tsc --noEmit` pass |
| **Backward compat** | Existing sites voi old block configs render identically | No visual regression | Visual diff compare |

---

## 12. Architecture

### 12.1. Variant Rendering Flow

```
SiteRenderer.tsx
  └── registry.getComponent(blockType)      → BlockComponent
        ↓
  BlockComponent ({ block, theme, site, page })
        ↓
  Resolve variant: block.variant ?? meta.defaultVariant
        ↓
  variants[resolvedVariant]
    ├── centered.tsx    (hero)
    ├── split-left.tsx  (hero)
    ├── video.tsx       (hero) [NEW]
    └── ...
        ↓
  Variant Component renders with CSS_VARS
```

### 12.2. CSS_VARS Usage Pattern

Moi block phai follow pattern nay (khong deviation):

```typescript
// src/blocks/cta/index.tsx (BEFORE — wrong)
export function CTABlock({ block, theme }: BlockProps<CTAConfig>) {
  return (
    <section style={{ background: theme.primaryColor }}> // ← WRONG: not CSS var
      <h2 style={{ color: '#ffffff' }}>  // ← WRONG: hardcoded
```

```typescript
// src/blocks/cta/index.tsx (AFTER — correct)
import { CSS_VARS } from '@/lib/theme/resolve'

export function CTABlock({ block, theme }: BlockProps<CTAConfig>) {
  return (
    <section style={{ background: CSS_VARS.primary }}> // ← CORRECT
      <h2 style={{ color: CSS_VARS.text }}>             // ← CORRECT
```

### 12.3. Variant Router Pattern

```typescript
// src/blocks/hero/index.tsx — pure router
import type { BlockProps } from '../types'
import type { HeroConfig } from './config'
import { heroMeta } from './config'
import { CenteredHero } from './variants/centered'
import { SplitLeftHero } from './variants/split-left'
import { VideoHero } from './variants/video'
// ... 9 more imports

const VARIANTS: Record<string, React.ComponentType<BlockProps<HeroConfig>>> = {
  'centered':     CenteredHero,
  'split-left':   SplitLeftHero,
  'split-right':  SplitRightHero,
  'fullscreen':   FullscreenHero,
  'video':        VideoHero,
  'magazine':     MagazineHero,
  'minimal':      MinimalHero,
  'cards-overlay': CardsOverlayHero,
  'gradient':     GradientHero,
  'parallax':     ParallaxHero,
  'slideshow':    SlideshowHero,
  'split-video':  SplitVideoHero,
}

export function HeroBlock(props: BlockProps<HeroConfig>) {
  const variant = props.block.variant ?? heroMeta.defaultVariant
  const Component = VARIANTS[variant] ?? VARIANTS[heroMeta.defaultVariant]
  return <Component {...props} />
}
```

### 12.4. Variant File Pattern

```typescript
// src/blocks/hero/variants/video.tsx
import { CSS_VARS } from '@/lib/theme/resolve'
import type { BlockProps } from '../../types'
import type { HeroConfig } from '../config'

export function VideoHero({ block, theme }: BlockProps<HeroConfig>) {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        src={block.videoUrl}
        poster={block.backgroundImage}
      />
      <div
        className="absolute inset-0"
        style={{ background: `rgba(0,0,0,0.5)` }}
      />
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="text-center px-4">
          <h1 style={{ fontFamily: CSS_VARS.fontHeading, color: '#ffffff' }}>
            {block.headline}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)' }}>
            {block.subheadline}
          </p>
          <a
            href={block.ctaUrl}
            style={{ background: CSS_VARS.primary }}
            className="inline-block px-8 py-4 rounded-lg text-white font-semibold mt-6"
          >
            {block.ctaText}
          </a>
        </div>
      </div>
    </section>
  )
}
```

### 12.5. Key Files

| File | Purpose | Action |
|------|---------|--------|
| `src/blocks/*/index.tsx` | 51 block router files | Refactor hero; fix dead variants in other blocks |
| `src/blocks/hero/variants/*.tsx` | Hero variant files (NEW) | Create 12 files |
| `src/lib/theme/resolve.ts` | CSS_VARS definition | Read-only (source of truth) |
| `src/blocks/registry.ts` | Block registry | No changes needed |
| `src/components/editor/SettingsPanel.tsx:646-660` | Variant selector UI | No changes needed |
| `scripts/verify-variants.mjs` | Verification script (NEW) | Create |

---

## 13. Phase Breakdown

> Tham khao: `plans/260407-1021-block-variant-audit/plan.md`

| Phase | Ten | Effort | Output |
|-------|-----|--------|--------|
| Phase 1 | Code Audit — 51 blocks | ~2h | Dead variant list, CSS_VARS gap list |
| Phase 2 | Fix Dead/Stub Variants | ~8h | 10+ variants implemented |
| Phase 3 | Design Token Compliance | ~4h | 51 blocks dung CSS_VARS |
| Phase 4 | Responsive QA | ~2h | 175 variants pass 375px test |
| Phase 5 | Verification Script + Tests | ~4h | `pnpm verify:variants` pass, unit tests |
| **Total** | | **~20h** | |

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F04 Block Renderer | Done | None — infrastructure da co |
| CSS_VARS (`src/lib/theme/resolve.ts`) | Done | None — da co CSS_VARS object |
| Block registry (`src/blocks/registry.ts`) | Done | None — 51 blocks da register |
| Embla Carousel (for carousel variants) | Check | Verify da install: `pnpm list embla-carousel` |
| DOMPurify (for custom-html) | Done | Da dung trong custom-html |

---

## 15. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Hero refactor break existing sites** — 856 LOC split ra 12 files, dễ quên export hoặc import sai | Medium | High (P0 regression) | Chay visual diff compare truoc/sau: screenshot tung variant, compare pixel. Add unit test cho moi variant truoc khi refactor. |
| **CSS_VARS migration lam mat pixel-perfect styling** — 6 blocks chuyen tu hardcode sang var() co the thay doi mau nhe neu CSS cascade bi override | Low | Medium (visual regression) | Audit CSS specificity truoc khi migrate. Test tren dark mode va light mode. Screenshot compare. |
| **Carousel/video variants lam tang bundle size** — Import Embla Carousel cho 5+ blocks co the tang JS bundle | Medium | Medium (performance) | Dung dynamic import (`next/dynamic`) cho heavy carousel components. Check bundle sau khi implement. |
| **Dead variant fix khong du "unique"** — Implement masonry cho gallery nhung layout khong du ro rang khac grid | Low | Low (UX) | Tham khao Wix/Squarespace reference screenshots cho tung variant truoc khi code. PM approve visual spec. |
| **Responsive overflow kho detect tay** — 51 blocks x 5 breakpoints = 255 combinations kho test tay | High | Medium (UX mobile) | Viet Playwright test loop qua tat ca blocks + breakpoints, check `scrollWidth`. |

---

## 16. Data Model Changes

**Khong co thay doi data model.** Tat ca block configs da co `variant` field trong Payload CMS
`Pages.layout` array. Feature nay chi sua rendering logic, khong sua schema.

---

## 17. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Carousel library: dung Embla Carousel (da install) hay CSS scroll-snap? | Dev | Open — check `pnpm list embla-carousel` |
| 2 | `navigation/mega-menu` co can real data (sub-items) hay chi demo layout? | PM | Open — neu demo, mock data ok |
| 3 | `hero/parallax` co enable tren mobile khong (performance concern)? | Dev | Suggested: disable tren mobile (matchMedia) |

---

## 18. 9-Point Done Checklist

- [ ] Loading State — Skeleton placeholder khi block data chua load (ErrorBoundary fallback)
- [ ] Empty State — Graceful render khi block.items = [] (show placeholder content)
- [ ] Error State — ErrorBoundary catch crash + hien thi "[Block] — Error loading"
- [ ] Form Validation — N/A (display blocks, no forms in scope)
- [ ] Button States — N/A (display blocks)
- [ ] Toast Feedback — N/A (display blocks)
- [ ] Auth Redirect — N/A
- [ ] Mobile 375px — Tat ca 51 blocks x variants pass no-overflow test
- [ ] TypeScript Clean — `tsc --noEmit` pass, zero `any` trong variant files

---

## 19. Definition of Ready

- [x] Plan validated (`plans/260407-1021-block-variant-audit/plan.md`)
- [x] Dead variants confirmed (code audit da xac nhan 10+ dead variants)
- [x] CSS_VARS gap list confirmed (6+ blocks khong dung CSS_VARS)
- [x] F04 Block Renderer infrastructure da complete
- [x] Variant spec tables da co trong PRD nay
- [ ] Embla Carousel install confirmed
- [ ] PM approve visual spec cho dead variants (tham khao Wix reference)

---

## 20. Definition of Done

- [ ] `pnpm verify:variants` exit code 0 (0 dead variants)
- [ ] `tsc --noEmit` pass (zero TypeScript errors)
- [ ] Hero refactor complete: `src/blocks/hero/index.tsx` < 200 LOC, `variants/` directory co 12 files
- [ ] CSS_VARS compliance: `grep -r "hardcoded-hex"` tren theming elements return 0 results
- [ ] Unit tests pass: `pnpm test` green, hero/features/testimonials/pricing co >= 1 test per variant
- [ ] Responsive pass: Playwright test 375px, 768px, 1280px cho tat ca 51 blocks
- [ ] QA report written: `docs/qa/F31-block-variant-audit.md`
- [ ] Visual regression compare: screenshot before/after cho 10 dead variants
- [ ] PR merged to staging, CI green
