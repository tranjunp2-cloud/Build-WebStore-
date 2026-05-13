/**
 * Category Recipes A/B/C — 3 ordered block sequences per category.
 *
 * Problem solved: today every category has ONE block sequence
 * (via CATEGORY_SIGNATURE_BLOCKS) — every restaurant gets
 * hero → features → menu → gallery → contact in the same order.
 * Middle-block shuffle only permutes 2-3 slots, so every site rhymes.
 *
 * Solution: 3 hand-curated recipes per category (14 × 3 = 42 total),
 * each with a distinct rhythm (story-first / menu-first / gallery-first
 * etc.). Composer picks via `seed % 3` — deterministic but distinct.
 * AI happy path receives the chosen recipe in its user prompt as a
 * hard block-sequence constraint.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-04-layout-recipes.md
 * Depends on: Phase 02 (mood can influence recipe selection — deferred)
 */

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Ordered rhythm archetype. Drives the "first impression" of the home page:
 * which content the user encounters right after the hero.
 */
export type RecipeRhythm =
  | 'story-first'
  | 'menu-first'
  | 'gallery-first'
  | 'services-first'
  | 'portfolio-first'
  | 'team-first'
  | 'features-first'
  | 'social-proof-first'
  | 'demo-first'

/** 14 canonical category slugs — matches CATEGORY_PRESETS keys in theme-presets.ts. */
export type RecipeCategory =
  | 'restaurant'
  | 'ecommerce'
  | 'beauty'
  | 'tech'
  | 'health'
  | 'education'
  | 'realestate'
  | 'fitness'
  | 'creative'
  | 'business'
  | 'fnb'
  | 'events'
  | 'blog'
  | 'travel'

export interface CategoryRecipe {
  /** Stable unique id, e.g. "rest-story" — used for SSE drift warnings + tests. */
  id: string
  /** Human-readable label for admin UI. */
  label: string
  /** Archetype driving first impression. */
  rhythm: RecipeRhythm
  /**
   * Ordered block type sequence. Composer iterates in order; AI prompt
   * injects this sequence as a hard ordering constraint.
   */
  blocks: string[]
  /**
   * Subset of `blocks` that MUST be present in the final page. Enforced
   * by `enforceBlockOrdering` — warn-only on violation for AI path,
   * strict for composer path.
   */
  required: string[]
  /**
   * Inclusive [start, end] index range where middle-block shuffle is
   * allowed. Blocks outside this range are locked in order. Hero (0) and
   * footer (last) are always locked.
   */
  middleShuffleRange: [number, number]
  /** One-line description for docs + admin. */
  description: string
}

// ── Supported block IDs ─────────────────────────────────────────────────────
// Whitelist of block types the composer's `buildBlockFromSpec` knows how to
// emit. Used by the CI coverage test to assert every `blocks[]` entry is
// buildable. Keep in sync with the switch statement in template-composer.ts.
export const SUPPORTED_BLOCK_IDS = new Set([
  // Structural
  'navigation',
  'hero',
  'footer',
  // Content
  'about',
  'features',
  'service-cards',
  'testimonials',
  'faq',
  'cta',
  'contact',
  'gallery',
  'newsletter',
  'stats',
  'pricing',
  // Industry-specific
  'class-schedule',
  // 'video-showcase', // temporarily hidden from AI generation (aiVisible: false, archived)
  'doctor-profile',
  'property-card',
  // GH-960: re-add when #961 (cart/checkout) ships
  // 'menu-display',
  // 'pricing-table',
  // 'product-quick-view',
  'products-grid',
  'products-featured',
  'portfolio-grid',
  'client-logos',
  'social-proof',
  'feature-comparison',
  // 'step-process', // feat/fix-broken-block-variants: temporarily hidden
  'countdown-timer',
  'blog-list',
  'google-maps',
  'team',
  'logo-cloud',
])

// ── Recipes ─────────────────────────────────────────────────────────────────
// 14 categories × 3 recipes = 42 total. Every recipe:
//   - Starts with 'hero' (locked at index 0)
//   - Ends with 'footer' (locked at last index)
//   - Has a middleShuffleRange that excludes hero and footer
//   - Lists at least 'hero' + 1 signature block in `required`

const RESTAURANT_RECIPES: CategoryRecipe[] = [
  {
    id: 'rest-story',
    label: 'Story-first',
    rhythm: 'story-first',
    // GH-960: menu-display removed — restore when #961 ships
    blocks: ['hero', 'about', 'features', 'gallery', 'testimonials', 'faq', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'features', 'contact'],
    middleShuffleRange: [3, 5],
    description: 'Lead with the founder story — about → menu → gallery. Best for heritage brands.',
  },
  {
    id: 'rest-menu',
    label: 'Menu-first',
    rhythm: 'menu-first',
    // GH-960: menu-display removed — restore when #961 ships
    blocks: ['hero', 'features', 'features', 'testimonials', 'gallery', 'cta', 'cta', 'contact', 'footer'],
    required: ['hero', 'features', 'cta', 'contact'],
    middleShuffleRange: [2, 5],
    description: 'Show the menu first — menu → features → social proof. Best for casual dining + QSR.',
  },
  {
    id: 'rest-gallery',
    label: 'Gallery-first',
    rhythm: 'gallery-first',
    // GH-960: menu-display removed — restore when #961 ships
    blocks: ['hero', 'gallery', 'features', 'about', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'gallery', 'features', 'contact'],
    middleShuffleRange: [2, 4],
    description: 'Visual-led — gallery first to show the food. Best for fine dining + plated presentations.',
  },
]

const ECOMMERCE_RECIPES: CategoryRecipe[] = [
  {
    id: 'ec-products',
    label: 'Products-first',
    rhythm: 'features-first',
    blocks: ['hero', 'products-grid', 'features', 'social-proof', 'testimonials', 'cta', 'newsletter', 'footer'],
    required: ['hero', 'products-grid', 'cta'],
    middleShuffleRange: [2, 5],
    description: 'Hit the catalog immediately — products first, then benefits + proof.',
  },
  {
    id: 'ec-story',
    label: 'Brand-story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'features', 'products-grid', 'testimonials', 'cta', 'footer'],
    required: ['hero', 'about', 'products-grid'],
    middleShuffleRange: [2, 4],
    description: 'Establish brand narrative before showing products. Best for artisan + premium.',
  },
  {
    id: 'ec-proof',
    label: 'Social-proof-first',
    rhythm: 'social-proof-first',
    blocks: ['hero', 'social-proof', 'testimonials', 'products-grid', 'features', 'cta', 'footer'],
    required: ['hero', 'social-proof', 'products-grid'],
    middleShuffleRange: [2, 4],
    description: 'Lead with social proof — reviews, client logos, stats. Best for commodity markets.',
  },
]

const BEAUTY_RECIPES: CategoryRecipe[] = [
  {
    id: 'beauty-services',
    label: 'Services-first',
    rhythm: 'services-first',
    blocks: ['hero', 'service-cards', 'gallery', 'gallery', 'testimonials', 'cta', 'cta', 'contact', 'footer'],
    required: ['hero', 'service-cards', 'cta', 'contact'],
    middleShuffleRange: [2, 5],
    description: 'Services menu upfront — before/after visual proof. Best for spas + salons.',
  },
  {
    id: 'beauty-portfolio',
    label: 'Portfolio-first',
    rhythm: 'portfolio-first',
    blocks: ['hero', 'gallery', 'gallery', 'service-cards', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'gallery', 'service-cards'],
    middleShuffleRange: [2, 4],
    description: 'Visual proof first — gallery + transformations. Best for nail studios + makeup artists.',
  },
  {
    id: 'beauty-team',
    label: 'Team-first',
    rhythm: 'team-first',
    blocks: ['hero', 'about', 'service-cards', 'gallery', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'service-cards'],
    middleShuffleRange: [2, 4],
    description: 'Lead with the expertise story — about → services → gallery. Best for dermatology + clinics.',
  },
]

const TECH_RECIPES: CategoryRecipe[] = [
  {
    id: 'tech-features',
    label: 'Features-first',
    rhythm: 'features-first',
    blocks: ['hero', 'features', 'feature-comparison', 'pricing', 'testimonials', 'faq', 'cta', 'footer'],
    required: ['hero', 'features', 'pricing', 'cta'],
    middleShuffleRange: [2, 5],
    description: 'Benefits + capability matrix before pricing. Best for SaaS + B2B tools.',
  },
  {
    id: 'tech-proof',
    label: 'Social-proof-first',
    rhythm: 'social-proof-first',
    blocks: ['hero', 'client-logos', 'social-proof', 'features', 'testimonials', 'pricing', 'cta', 'footer'],
    required: ['hero', 'client-logos', 'pricing'],
    middleShuffleRange: [2, 5],
    description: 'Enterprise sale — client logos + proof drive trust before features. Best for mature B2B.',
  },
  {
    id: 'tech-demo',
    label: 'Demo-first',
    rhythm: 'demo-first',
    blocks: ['hero', /* 'video-showcase', */ 'features', 'pricing', 'testimonials', 'cta', 'footer'],
    required: ['hero', /* 'video-showcase', */ 'features'],
    middleShuffleRange: [2, 4],
    description: 'Video demo upfront for complex products. Best for dev tools + AI platforms.',
  },
]

const HEALTH_RECIPES: CategoryRecipe[] = [
  {
    id: 'health-team',
    label: 'Team-first',
    rhythm: 'team-first',
    blocks: ['hero', 'doctor-profile', 'service-cards', 'testimonials', 'cta', 'faq', 'cta', 'contact', 'footer'],
    required: ['hero', 'doctor-profile', 'cta', 'contact'],
    middleShuffleRange: [2, 5],
    description: 'Meet the specialists first — credentials build trust. Best for clinics + specialty practices.',
  },
  {
    id: 'health-services',
    label: 'Services-first',
    rhythm: 'services-first',
    blocks: ['hero', 'service-cards', 'stats', 'doctor-profile', 'testimonials', 'faq', 'cta', 'contact', 'footer'],
    required: ['hero', 'service-cards', 'contact'],
    middleShuffleRange: [2, 5],
    description: 'Service menu upfront — stats + team as proof. Best for general health clinics.',
  },
  {
    id: 'health-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'stats', 'doctor-profile', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'contact'],
    middleShuffleRange: [2, 4],
    description: 'Lead with mission — for wellness + preventive practices.',
  },
]

const EDUCATION_RECIPES: CategoryRecipe[] = [
  {
    id: 'edu-programs',
    label: 'Programs-first',
    rhythm: 'features-first',
    blocks: ['hero', 'features', 'class-schedule', 'testimonials', 'stats', 'faq', 'cta', 'footer'],
    required: ['hero', 'features', 'class-schedule'],
    middleShuffleRange: [2, 5],
    description: 'Curriculum + schedule upfront. Best for language schools + tutoring.',
  },
  {
    id: 'edu-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'features', 'testimonials', 'stats', 'faq', 'cta', 'footer'],
    required: ['hero', 'about', 'features'],
    middleShuffleRange: [2, 5],
    description: 'Mission + methodology first. Best for universities + nonprofit schools.',
  },
  {
    id: 'edu-demo',
    label: 'Demo-first',
    rhythm: 'demo-first',
    blocks: ['hero', /* 'video-showcase', */ 'features', /* 'step-process', */ 'testimonials', 'cta', 'footer'],
    required: ['hero', /* 'video-showcase' */], // 'step-process' temporarily hidden
    middleShuffleRange: [2, 3], // reduced from [2,4]: step-process hidden, 5 active blocks → max end = blocks.length-2 = 3
    description: 'Show the classroom experience. Best for online courses + bootcamps.',
  },
]

const REALESTATE_RECIPES: CategoryRecipe[] = [
  {
    id: 'rs-listings',
    label: 'Listings-first',
    rhythm: 'features-first',
    blocks: ['hero', 'property-card', 'stats', 'gallery', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'property-card', 'contact'],
    middleShuffleRange: [2, 4],
    description: 'Hit the catalog immediately — properties → stats → gallery. Best for agencies.',
  },
  {
    id: 'rs-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'property-card', 'stats', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'property-card'],
    middleShuffleRange: [2, 4],
    description: 'Lead with agent story — best for boutique + individual realtors.',
  },
  {
    id: 'rs-proof',
    label: 'Track-record-first',
    rhythm: 'social-proof-first',
    blocks: ['hero', 'stats', 'property-card', 'testimonials', 'about', 'cta', 'contact', 'footer'],
    required: ['hero', 'stats', 'property-card'],
    middleShuffleRange: [2, 4],
    description: 'Stats + deal count drive trust. Best for luxury + high-volume sales.',
  },
]

const FITNESS_RECIPES: CategoryRecipe[] = [
  {
    id: 'fit-classes',
    label: 'Classes-first',
    rhythm: 'features-first',
    blocks: ['hero', 'class-schedule', 'features', 'gallery', 'testimonials', 'cta', 'cta', 'footer'],
    required: ['hero', 'class-schedule', 'cta'],
    middleShuffleRange: [2, 5],
    description: 'Schedule upfront — drop in and see class times. Best for group-class studios.',
  },
  {
    id: 'fit-results',
    label: 'Results-first',
    rhythm: 'social-proof-first',
    blocks: ['hero', 'stats', 'testimonials', 'class-schedule', 'features', 'cta', 'footer'],
    required: ['hero', 'stats', 'class-schedule'],
    middleShuffleRange: [2, 4],
    description: 'Transformation stats + testimonials. Best for body-transformation gyms + coaches.',
  },
  {
    id: 'fit-community',
    label: 'Community-first',
    rhythm: 'gallery-first',
    blocks: ['hero', 'gallery', 'class-schedule', 'testimonials', 'features', 'cta', 'footer'],
    required: ['hero', 'gallery', 'class-schedule'],
    middleShuffleRange: [2, 4],
    description: 'Photos of members + vibes. Best for CrossFit boxes + community gyms.',
  },
]

const CREATIVE_RECIPES: CategoryRecipe[] = [
  {
    id: 'cr-portfolio',
    label: 'Portfolio-first',
    rhythm: 'portfolio-first',
    blocks: ['hero', 'portfolio-grid', 'gallery', 'about', 'testimonials', 'cta', 'footer'],
    required: ['hero', 'portfolio-grid'],
    middleShuffleRange: [2, 4],
    description: 'Work speaks for itself — portfolio grid upfront. Best for photographers + designers.',
  },
  {
    id: 'cr-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'portfolio-grid', 'gallery', 'testimonials', 'cta', 'footer'],
    required: ['hero', 'about', 'portfolio-grid'],
    middleShuffleRange: [2, 4],
    description: 'Brand narrative before work. Best for studios with strong POV.',
  },
  {
    id: 'cr-demo',
    label: 'Demo-first',
    rhythm: 'demo-first',
    blocks: ['hero', /* 'video-showcase', */ 'portfolio-grid', 'testimonials', 'cta', 'footer'],
    required: ['hero', /* 'video-showcase', */ 'portfolio-grid'],
    middleShuffleRange: [2, 3],
    description: 'Reel first — for videographers + motion designers.',
  },
]

const BUSINESS_RECIPES: CategoryRecipe[] = [
  {
    id: 'biz-services',
    label: 'Services-first',
    rhythm: 'services-first',
    blocks: ['hero', 'service-cards', 'client-logos', 'stats', 'testimonials', 'faq', 'cta', 'contact', 'footer'],
    required: ['hero', 'service-cards', 'contact'],
    middleShuffleRange: [2, 5],
    description: 'Service menu + proof. Best for consulting + agencies.',
  },
  {
    id: 'biz-proof',
    label: 'Proof-first',
    rhythm: 'social-proof-first',
    blocks: ['hero', 'client-logos', 'stats', 'service-cards', 'testimonials', 'faq', 'cta', 'contact', 'footer'],
    required: ['hero', 'client-logos', 'service-cards'],
    middleShuffleRange: [2, 5],
    description: 'Logo wall + stats build authority. Best for enterprise B2B.',
  },
  {
    id: 'biz-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'service-cards', 'stats', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'service-cards'],
    middleShuffleRange: [2, 4],
    description: 'Founder + methodology story. Best for boutique consulting.',
  },
]

const FNB_RECIPES: CategoryRecipe[] = [
  {
    id: 'fnb-menu',
    label: 'Menu-first',
    rhythm: 'menu-first',
    blocks: ['hero', 'features', 'features', 'gallery', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'features', 'contact'],
    middleShuffleRange: [2, 5],
    description: 'Menu upfront — for cafes + dessert shops + bakeries.',
  },
  {
    id: 'fnb-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'features', 'gallery', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'features'],
    middleShuffleRange: [2, 5],
    description: 'Craft story first — for specialty coffee + artisan bakeries.',
  },
  {
    id: 'fnb-gallery',
    label: 'Gallery-first',
    rhythm: 'gallery-first',
    blocks: ['hero', 'gallery', 'features', 'features', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'gallery', 'features'],
    middleShuffleRange: [2, 4],
    description: 'Photos of drinks + ambience. Best for bubble tea shops + cocktail bars.',
  },
]

const EVENTS_RECIPES: CategoryRecipe[] = [
  {
    id: 'ev-packages',
    label: 'Packages-first',
    rhythm: 'services-first',
    blocks: ['hero', 'service-cards', 'gallery', 'countdown-timer', 'cta', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'service-cards', 'cta'],
    middleShuffleRange: [2, 5],
    description: 'Package tiers upfront. Best for wedding planners + corporate events.',
  },
  {
    id: 'ev-gallery',
    label: 'Gallery-first',
    rhythm: 'gallery-first',
    blocks: ['hero', 'gallery', 'service-cards', /* 'step-process', */ 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'gallery', 'service-cards'],
    middleShuffleRange: [2, 4],
    description: 'Past event photos drive trust. Best for venue-led brands.',
  },
  {
    id: 'ev-process',
    label: 'Process-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', /* 'step-process', */ 'service-cards', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', /* 'step-process', */ 'service-cards'], // 'step-process' temporarily hidden
    middleShuffleRange: [2, 4],
    description: 'How we work — 5-step process. Best for planners selling a framework.',
  },
]

const BLOG_RECIPES: CategoryRecipe[] = [
  {
    id: 'blog-latest',
    label: 'Latest-first',
    rhythm: 'features-first',
    blocks: ['hero', 'blog-list', 'newsletter', 'social-proof', 'cta', 'footer'],
    required: ['hero', 'blog-list', 'newsletter'],
    middleShuffleRange: [2, 3],
    description: 'Latest posts immediately — best for active publications.',
  },
  {
    id: 'blog-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'blog-list', 'newsletter', 'social-proof', 'cta', 'footer'],
    required: ['hero', 'about', 'blog-list'],
    middleShuffleRange: [2, 4],
    description: 'Editor story + brand voice first. Best for personal blogs + niche zines.',
  },
  {
    id: 'blog-proof',
    label: 'Audience-first',
    rhythm: 'social-proof-first',
    blocks: ['hero', 'social-proof', 'blog-list', 'newsletter', 'cta', 'footer'],
    required: ['hero', 'social-proof', 'blog-list'],
    middleShuffleRange: [2, 3],
    description: 'Subscriber count + social proof upfront. Best for monetized newsletters.',
  },
]

const TRAVEL_RECIPES: CategoryRecipe[] = [
  {
    id: 'tr-destinations',
    label: 'Destinations-first',
    rhythm: 'gallery-first',
    blocks: ['hero', 'gallery', 'service-cards', 'testimonials', 'cta', 'cta', 'contact', 'footer'],
    required: ['hero', 'gallery', 'cta'],
    middleShuffleRange: [2, 4],
    description: 'Place photos drive wanderlust. Best for tour operators + destination marketers.',
  },
  {
    id: 'tr-story',
    label: 'Story-first',
    rhythm: 'story-first',
    blocks: ['hero', 'about', 'gallery', 'service-cards', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', 'about', 'service-cards'],
    middleShuffleRange: [2, 4],
    description: 'Founder + philosophy story. Best for boutique adventure + wellness travel.',
  },
  {
    id: 'tr-demo',
    label: 'Reel-first',
    rhythm: 'demo-first',
    blocks: ['hero', /* 'video-showcase', */ 'gallery', 'service-cards', 'testimonials', 'cta', 'contact', 'footer'],
    required: ['hero', /* 'video-showcase', */ 'service-cards'],
    middleShuffleRange: [2, 4],
    description: 'Video reel + gallery. Best for experiential + luxury travel.',
  },
]

/** All 42 recipes keyed by category. Order preserved → seed % 3 is stable. */
export const CATEGORY_RECIPES: Record<RecipeCategory, CategoryRecipe[]> = {
  restaurant: RESTAURANT_RECIPES,
  ecommerce: ECOMMERCE_RECIPES,
  beauty: BEAUTY_RECIPES,
  tech: TECH_RECIPES,
  health: HEALTH_RECIPES,
  education: EDUCATION_RECIPES,
  realestate: REALESTATE_RECIPES,
  fitness: FITNESS_RECIPES,
  creative: CREATIVE_RECIPES,
  business: BUSINESS_RECIPES,
  fnb: FNB_RECIPES,
  events: EVENTS_RECIPES,
  blog: BLOG_RECIPES,
  travel: TRAVEL_RECIPES,
}

/** Ordered list of all categories — for iteration in tests + admin. */
export const ALL_RECIPE_CATEGORIES: readonly RecipeCategory[] = [
  'restaurant', 'ecommerce', 'beauty', 'tech', 'health', 'education',
  'realestate', 'fitness', 'creative', 'business', 'fnb', 'events',
  'blog', 'travel',
] as const

/** Total recipe count — enforced by coverage test. */
export const EXPECTED_RECIPE_COUNT = 42

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * djb2 string hash — non-cryptographic, deterministic. Used to derive a
 * stable per-business seed offset so same-category businesses land on
 * different recipes at the same caller-supplied seed.
 */
function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Deterministic recipe selection. Same `(category, seed)` always returns
 * the same recipe so regenerating a site is stable, but different seeds
 * rotate across the 3 recipes.
 *
 * Plan 07 — accepts an optional third `biz` argument. When `biz.name` is
 * provided, the effective selection seed becomes `djb2(biz.name) ^ seed`
 * so two businesses in the same category at the same base seed still land
 * on different recipes. Backward-compat: omitting `biz` preserves legacy
 * `seed % 3` semantics.
 *
 * @param category - category slug (unknown → business fallback)
 * @param seed     - any integer; typically `hashBusinessName(name)`
 * @param biz      - optional `{ name?: string }` — enables per-business variety
 */
export function pickRecipe(
  category: string,
  seed: number,
  biz?: { name?: string },
): CategoryRecipe {
  const key = (ALL_RECIPE_CATEGORIES as readonly string[]).includes(category)
    ? (category as RecipeCategory)
    : 'business'
  const recipes = CATEGORY_RECIPES[key]
  if (recipes.length === 0) {
    // Should never happen — coverage test asserts 3 per cat.
    return BUSINESS_RECIPES[0]!
  }
  const nameHash = biz?.name ? djb2(biz.name) : 0
  const effectiveSeed = Math.abs(Math.floor(seed)) ^ nameHash
  const index = effectiveSeed % recipes.length
  return recipes[index]!
}

/** Lookup all recipes for a category (for admin UI + tests). */
export function getRecipesForCategory(category: string): CategoryRecipe[] {
  if (!(ALL_RECIPE_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_RECIPES.business
  }
  return CATEGORY_RECIPES[category as RecipeCategory]
}

/**
 * Assert a block ID is buildable by the composer. Used by CI test + runtime
 * drift checks — every recipe.blocks[] entry must pass this.
 */
export function isSupportedBlockId(blockId: string): boolean {
  return SUPPORTED_BLOCK_IDS.has(blockId)
}
