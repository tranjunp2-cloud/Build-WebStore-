# Template Quality Audit — Block Components

**Date:** 2026-04-05 | **Scope:** 5 core blocks + SiteRenderer

---

## Overall Assessment: 7.5/10 — Professional dark-mode, weak light-mode

The block system is well-architected with shared animation/decorative primitives, theme-aware styling via `primaryColor`, and graceful fallbacks. The main gaps are light-mode support, missing mobile navigation, and some hardcoded dark-mode values.

---

## 1. Hero (`src/blocks/hero/index.tsx`)

**Strengths:**
- 3 variants (centered, split-left/right, fullscreen) — good coverage
- Gradient overlay on images, decorative blobs, dot grid — polished look
- CTA buttons use `primaryColor` with gradient + box-shadow — premium feel
- Fallback image via `getHeroImage(category)` for split variant
- Badge/section label support

**Issues:**
| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| H1 | P1 | **No `backgroundImage` field used** — hero has no full-bleed background image option. `image` only renders as inline `<img>` below content in centered variant | Add `backgroundImage` variant with CSS `background-image` + gradient overlay |
| H2 | P1 | **Light mode broken** — all text is white-on-dark assumption. No `colorMode` check | Add `theme.colorMode === 'light'` conditional for text colors |
| H3 | P2 | Centered variant only shows image if `image?.url` exists, split uses fallback — inconsistent | Use fallback in centered too, or make it opt-in for both |
| H4 | P3 | `min-h-[92vh]` is unusual — should be `min-h-screen` or configurable | Use `min-h-[90vh]` or `min-h-screen` |
| H5 | P3 | No `<img>` lazy loading attribute | Add `loading="lazy"` |

---

## 2. Features (`src/blocks/features/index.tsx`)

**Strengths:**
- 4 grid variants (2/3/4-col, list) — flexible
- HoverCard with lift animation, accent line on hover — polished micro-interaction
- Icon container with gradient bg + border — looks professional
- Section label, headline, subheadline all optional

**Issues:**
| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| F1 | P1 | **Light mode**: card bg `${pc}06` on white is nearly invisible. Border `${pc}12` too subtle | Increase opacity for light mode: `${pc}10` bg, `${pc}20` border |
| F2 | P2 | `feature.icon` renders raw text (emoji/string) — no actual SVG icon library | Document that AI should generate emoji icons, or integrate lucide-react |
| F3 | P2 | No empty state — if `features=[]`, renders empty grid with header only | Add "No features" placeholder or hide section |
| F4 | P3 | `opacity-50` for description is too faint on dark bg | Use `opacity-60` minimum |

---

## 3. Navigation (`src/blocks/navigation/index.tsx`)

**Strengths:**
- Sticky with glassmorphism (`backdrop-blur + saturate`) — modern look
- Logo gradient text fallback when no logo image — smart
- CTA button with gradient + shadow — consistent with hero
- Centered variant option for links

**Issues:**
| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| N1 | **P0** | **No mobile hamburger menu** — links use `hidden md:flex`, mobile users see NO navigation links at all | Add hamburger toggle + slide-out/dropdown menu |
| N2 | P1 | **Hardcoded dark bg**: `rgba(9,9,11,0.85)` — broken on light mode | Use `theme.colorMode` conditional: `rgba(255,255,255,0.85)` for light |
| N3 | P2 | No active link indicator — all links look the same | Add active state based on current page |
| N4 | P3 | Logo image `h-8` is small — could be configurable | Allow `h-10` or `h-12` options |

---

## 4. Footer (`src/blocks/footer/index.tsx`)

**Strengths:**
- Dynamic column grid based on data — adapts to content
- Logo with gradient text fallback — consistent with nav
- Social icons with initial letter + hover scale — functional
- Copyright auto-updates year — nice touch
- Merges site-level social links via `mergeFooterSocialsWithSite`

**Issues:**
| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| FT1 | P1 | **Dynamic Tailwind class** `md:grid-cols-${N}` will NOT work — Tailwind purges these | Use conditional class map: `{ 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }` |
| FT2 | P2 | Social icons show only first letter of platform — not recognizable | Use SVG icons for common platforms (Facebook, Instagram, X, LinkedIn) |
| FT3 | P2 | No light mode support — border/bg colors assume dark | Add `colorMode` conditionals |
| FT4 | P3 | `opacity-40` for tagline and links is very faint | Use `opacity-50` minimum |

---

## 5. Testimonials (`src/blocks/testimonials/index.tsx`)

**Strengths:**
- Decorative quote mark — adds visual depth
- Star rating with `primaryColor` — themed
- AvatarRing with initials fallback + gradient — handles missing photos well
- Fallback avatars via `getTeamAvatar(category, i)` — always shows something
- Title + company with dot separator — clean metadata

**Issues:**
| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| T1 | P2 | Hardcoded subtitle "Genuine reviews from our customers" — not customizable | Make it a block field `subheadline` |
| T2 | P2 | No light mode support — card bg/border colors assume dark | Add `colorMode` checks |
| T3 | P3 | Rating always renders (defaults to 5 if missing) — should be opt-in | Only show stars if `t.rating > 0` |
| T4 | P3 | No "no testimonials" empty state | Hide section or show placeholder |

---

## 6. SiteRenderer (`src/components/site-renderer/SiteRenderer.tsx`)

**Strengths:**
- CSS custom properties (`--brand-primary`, `--font-heading`) — good foundation
- ErrorBoundary per block — one broken block won't crash the page
- Google Fonts loader — dynamic font support
- Navigation link filtering by page visibility — smart

**Issues:**
| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| SR1 | P1 | **`secondaryColor` is defined but NEVER used** by any block — wasted theme token | Blocks should use it for accents, hover states, or secondary CTAs |
| SR2 | P2 | Global `* { margin: 0; padding: 0 }` is aggressive — can break third-party embeds | Scope reset to `.site-renderer *` wrapper |
| SR3 | P2 | No `<meta viewport>` in rendered output — may affect mobile scaling | Add viewport meta if rendering standalone |
| SR4 | P3 | `max-width: 1200px` for `.container` — could be wider for modern screens | Consider `1280px` or `1440px` |

---

## Cross-cutting Issues Summary

### P0 — Must Fix
1. **Navigation has no mobile menu** — links completely hidden on mobile

### P1 — High Priority
2. **Light mode is broken everywhere** — nav bg hardcoded dark, text assumes white, card borders invisible
3. **Footer dynamic Tailwind class** `grid-cols-${N}` won't work in production (purged by Tailwind)
4. **Hero has no background image variant** — `backgroundImage` field not implemented
5. **`secondaryColor` is unused** across all blocks

### P2 — Medium Priority
6. Social icons show only letters, not recognizable platform icons
7. No active nav link indicator
8. Feature icons are raw text, not SVG
9. Several hardcoded subtitle strings should be configurable
10. No empty states for sections with no data

### P3 — Low Priority
11. Various opacity values too faint (40-50% on dark backgrounds)
12. Missing `loading="lazy"` on images
13. Container max-width could be wider

---

## Recommended Fix Order

1. **Add mobile hamburger to Navigation** (P0 — users can't navigate on phone)
2. **Add light mode support** to all 5 blocks (P1 — affects all light-themed sites)
3. **Fix footer grid class** to use static Tailwind classes (P1 — layout broken in prod)
4. **Wire up `secondaryColor`** for outline buttons, hover states, secondary accents (P1)
5. **Add background image hero variant** with gradient overlay (P1)
6. **Replace social letter icons** with SVG platform icons (P2)
