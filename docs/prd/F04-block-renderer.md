# PRD: Block Renderer Engine (F04)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 3 — Sprint 1 | **Size:** L
> **Depends on:** Payload CMS collections ✅ | **Blocks:** F01, F05, F09 (Storefront)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

> [!NOTE]
> **F04 là technical infrastructure PRD.** Target user là AI engine, không phải end user.
> Không có Story file riêng — scope được gated bởi usage từ F01 (AI Builder), F05 (Editor), F09 (Storefront).
> Không cần tạo story file cho F04.


---

## 0. Story Traceability

| Story ID | Title | File | Notes |
|----------|-------|------|-------|
| US-F01-01 | Generate Site from Prompt | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | F04 enables this |
| US-F05-01 | AI Editor — Split Screen | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | F04 enables this |
| US-F09-01 | Browse Storefront Products | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | F04 enables this |

> F04 is a **prerequisite** for F01, F05, F09 — it has no direct user story of its own.

---

## 1. Problem Statement

Currently, all 8 block renderers live inside a single monolithic file `SiteRenderer.tsx` (370 lines). Every block uses `any` types, has no TypeScript interfaces, no validation, and no variant support beyond inline conditionals. When AI generates a new site with 10-14 blocks, there is no standardized config shape, no validation to catch AI hallucinations, and no way to extend blocks without editing the monolith.

**AI_BUILDER_SPEC.md §7** defines 20 block types with 2-4 variants each. We need a modular, typed, validated block system before any AI feature can ship.

## 2. Target User

- **AI agent** (primary consumer) — generates JSON block configs that must render correctly
- **Editor iframe** — renders blocks in real-time as AI makes changes
- **Storefront** — renders published site blocks with SSR for performance

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| All AI-generated blocks render without errors | > 99% |
| Invalid block configs caught by validation | 100% |
| Lighthouse Performance score (storefront) | > 90 |
| Block render time (single block) | < 50ms |

## 4. User Story

```
AS THE AI engine and site-renderer
I WANT a typed, validated block rendering system with 20+ block types
SO THAT AI-generated JSON always produces correct, beautiful websites
```

## 5. Current State Analysis

### What exists (✅):
- `src/components/site-renderer/SiteRenderer.tsx` — 8 block renderers:
  - `NavigationSection`, `HeroSection`, `AboutSection`, `FeaturesSection`
  - `TestimonialsSection`, `ContactSection`, `GallerySection`, `FooterSection`
- `BLOCK_MAP` — maps blockType string → component
- Theme system — `primaryColor`, `secondaryColor`, `fontHeading`, `fontBody`, `colorMode`
- Payload CMS `Pages` collection — stores `layout` array (blocks)

### What's missing (❌):
- TypeScript interfaces for each block config (all `any` types)
- Zod validation schemas
- Modular file structure (`src/blocks/{blockType}/`)
- 12 additional block types (pricing, cta, stats, team, FAQ, newsletter, etc.)
- Multiple variant renders per block type
- Block-level error boundary (crash 1 block → don't crash whole site)
- AI-friendly metadata (what fields are editable, what quick actions available)

## 6. Acceptance Criteria

### AC-1: Modular Block Directory Structure
```gherkin
GIVEN the project has block renderers
WHEN developer looks at src/blocks/
THEN each block type has its own directory:
  src/blocks/{blockType}/
    ├── index.tsx           ← Main component (renders by variant)
    ├── config.ts           ← TypeScript type + Zod schema + default config
    └── variants/           ← Variant-specific renders (if complex enough)
AND a central registry exists at src/blocks/registry.ts
AND SiteRenderer.tsx uses the registry instead of hardcoded BLOCK_MAP
```

### AC-2: TypeScript Types for All Blocks
```gherkin
GIVEN any block type (e.g., "hero")
WHEN its config is defined
THEN it has a TypeScript interface:
  - All fields explicitly typed (no `any`)
  - Optional fields marked with `?`
  - Union types for variant names
AND a Zod schema that validates the config at runtime
AND a default config factory: `createDefaultHeroConfig(): HeroConfig`
```

### AC-3: Block Registry
```gherkin
GIVEN the block registry
WHEN a blockType string is received (from AI or CMS)
THEN registry.getComponent(blockType) returns the React component
AND registry.getSchema(blockType) returns the Zod schema for validation
AND registry.getBlockTypes() returns list of all supported block types
AND registry.getBlockMeta(blockType) returns:
  { name, description, icon, variants[], editableFields[], quickActions[] }
```

### AC-4: All 20 Block Types Renderable
```gherkin
GIVEN the block renderer system
THEN these 20 block types render correctly:
  ✅ navigation, hero, about, features, testimonials, contact, gallery, footer (existing — refactored)
  🆕 faq, pricing, cta, stats, team, blog-list, video, logo-cloud,
     newsletter, products-grid, products-featured, custom-html
AND each block supports at least 1 variant
AND each block is responsive (375px → 1440px)
AND each block receives { block, theme } props
```

### AC-5: Block Variants
```gherkin
GIVEN a block type with variants (e.g., hero)
WHEN config.variant = "centered"
THEN centered layout renders
WHEN config.variant = "split"
THEN split layout with image renders
WHEN config.variant = "minimal"
THEN minimal text-only layout renders
AND unknown variants fallback to default variant (first in list)
```

### AC-6: Validation & Error Boundary
```gherkin
GIVEN AI generates a block config
WHEN config is passed to the renderer
THEN Zod schema validates the config BEFORE rendering
AND if validation fails:
  → Log warning to console (dev) or Sentry (prod)
  → Render a graceful error placeholder: "[Block type] — Error loading"
  → Other blocks continue rendering normally (don't crash page)
AND if blockType is unknown:
  → Skip silently (don't render, don't crash)
```

### AC-7: Backward Compatible
```gherkin
GIVEN existing sites with old block configs (no variant field, etc.)
WHEN rendered through new system
THEN defaults apply for missing fields
AND existing pages look identical to before the refactor
```

## 7. Technical Requirements

### 7.1 New File Structure
```
src/blocks/
├── registry.ts                 ← Central registry: type→component, type→schema, metadata
├── types.ts                    ← Shared types: BlockConfig, ThemeConfig, BlockMeta
├── ErrorBoundary.tsx           ← Block-level error boundary
├── navigation/
│   ├── index.tsx               ← NavigationBlock component
│   └── config.ts               ← NavigationConfig type + Zod schema
├── hero/
│   ├── index.tsx               ← HeroBlock component (handles variants internally)
│   └── config.ts               ← HeroConfig type + Zod schema
├── features/
│   ├── index.tsx
│   └── config.ts
├── about/
│   ├── index.tsx
│   └── config.ts
├── testimonials/
│   ├── index.tsx
│   └── config.ts
├── faq/                        ← NEW
│   ├── index.tsx
│   └── config.ts
├── contact/
│   ├── index.tsx
│   └── config.ts
├── gallery/
│   ├── index.tsx
│   └── config.ts
├── footer/
│   ├── index.tsx
│   └── config.ts
├── pricing/                    ← NEW
│   ├── index.tsx
│   └── config.ts
├── cta/                        ← NEW
│   ├── index.tsx
│   └── config.ts
├── stats/                      ← NEW
│   ├── index.tsx
│   └── config.ts
├── team/                       ← NEW
│   ├── index.tsx
│   └── config.ts
├── newsletter/                 ← NEW
│   ├── index.tsx
│   └── config.ts
├── products-grid/              ← NEW
│   ├── index.tsx
│   └── config.ts
├── products-featured/          ← NEW
│   ├── index.tsx
│   └── config.ts
├── video/                      ← NEW
│   ├── index.tsx
│   └── config.ts
├── logo-cloud/                 ← NEW
│   ├── index.tsx
│   └── config.ts
├── blog-list/                  ← NEW
│   ├── index.tsx
│   └── config.ts
└── custom-html/                ← NEW (sanitized)
    ├── index.tsx
    └── config.ts
```

### 7.2 Shared Type Definitions
```typescript
// src/blocks/types.ts
import { z } from 'zod'

export type ThemeConfig = {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  fontHeading: string
  fontBody: string
  colorMode: 'light' | 'dark'
}

export type BlockProps<T = Record<string, unknown>> = {
  block: T & { blockType: string; variant?: string }
  theme: ThemeConfig
}

export type BlockMeta = {
  name: string
  description: string
  icon: string
  variants: string[]
  editableFields: string[]
  quickActions: string[]
}
```

### 7.3 Variants per Block Type

| Block Type | Variants | Default |
|-----------|----------|---------|
| navigation | `simple`, `centered`, `mega-menu` | `simple` |
| hero | `centered`, `split`, `video`, `minimal` | `centered` |
| features | `grid-2`, `grid-3`, `grid-4`, `list` | `grid-3` |
| about | `simple`, `split`, `story` | `simple` |
| testimonials | `cards`, `carousel`, `simple` | `cards` |
| faq | `accordion`, `grid`, `simple` | `accordion` |
| contact | `form`, `info-only`, `split` | `form` |
| gallery | `grid`, `masonry`, `carousel` | `grid` |
| footer | `simple`, `expanded`, `minimal` | `simple` |
| pricing | `cards`, `table` | `cards` |
| cta | `banner`, `inline`, `floating` | `banner` |
| stats | `row`, `grid`, `highlight` | `row` |
| team | `grid`, `list` | `grid` |
| newsletter | `inline`, `popup`, `banner` | `inline` |
| products-grid | `grid-3`, `grid-4`, `list` | `grid-3` |
| products-featured | `carousel`, `hero-product` | `carousel` |
| video | `embed`, `background` | `embed` |
| logo-cloud | `row`, `grid` | `row` |
| blog-list | `cards`, `list` | `cards` |
| custom-html | — | — |

### 7.4 Migration Path
1. Create `src/blocks/` directory with new structure
2. Extract existing 8 blocks from `SiteRenderer.tsx` → individual files  
3. Add TypeScript types + Zod schemas
4. Build `registry.ts`
5. Update `SiteRenderer.tsx` to use registry
6. Add 12 new block types
7. Test backward compatibility with existing pages

## 10. Screen Layout

> **N/A - Technical Architecture PRD**
> Tính năng này là infrastructure rendering blocks, không có màn hình UI riêng. 
> Block rendering sẽ phụ thuộc vào layout của F01 (Builder), F05 (Editor) và F09 (Storefront).

## 11. 9-Point Done Checklist

- [ ] Loading State — Block skeleton while rendering (n/a for SSR)
- [ ] Empty State — Graceful error placeholder for invalid blocks
- [ ] Error State — Block-level ErrorBoundary catches crashes
- [ ] Form Validation — Zod schema validates all configs
- [ ] Button States — n/a (blocks are display-only)
- [ ] Toast Feedback — n/a (blocks are display-only)
- [ ] Auth Redirect — n/a
- [ ] Mobile 375px — All 20 blocks responsive (must test)
- [ ] TypeScript Clean — Zero `any` types, tsc --noEmit pass

## 12. Definition of Ready

- [x] This PRD reviewed and approved
- [x] AI_BUILDER_SPEC.md §7 (Block Output Schema) exists
- [x] Payload collections (Sites, Pages) ready
- [x] Existing 8 blocks in SiteRenderer.tsx to refactor from
- [ ] Docker environment working (check at sprint start)

## 13. Definition of Done

- [ ] 20 block types render correctly
- [ ] Zero `any` types across all block files
- [ ] Zod validation catches invalid configs
- [ ] Block-level ErrorBoundary works
- [ ] All blocks responsive (375px tested)
- [ ] Existing pages backward compatible (visual diff compare)
- [ ] Registry exports metadata for AI Editor
