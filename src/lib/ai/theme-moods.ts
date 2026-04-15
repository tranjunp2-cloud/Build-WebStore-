/**
 * Theme Moods System — bundles imagery mood, copy voice, photography filter,
 * and category-tuned CTAs into 6 archetypes. Each `ThemePreset` in
 * `theme-presets.ts` maps to exactly one mood via `moodId`.
 *
 * The 6 moods are **orthogonal archetypes** — pick by personality, not industry.
 * Every category can express every mood. E.g. a restaurant can be `playful`
 * (Hawker Neon), `elegant` (Heritage Gold), or `serene` (Garden Dining) —
 * mood picks the VOICE and CTA wording, not the service type.
 *
 * Data shape deliberately SYNCHRONIZED: whenever you add a field here, update:
 *   1. buildUserPrompt (voice injection)
 *   2. deriveKeywords (imagery append)
 *   3. getCategoryCTA (template-composer)
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-02-theme-moods-system.md
 * Coverage test: src/__tests__/unit/ai/mood-cta-coverage.test.ts
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type MoodId =
  | 'playful'
  | 'elegant'
  | 'bold'
  | 'serene'
  | 'editorial'
  | 'tech-minimal'

/** 14 canonical category slugs — must match CATEGORY_PRESETS keys. */
export type MoodCategory =
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

export type PhotographyFilter =
  | 'warm'
  | 'cool'
  | 'duotone'
  | 'editorial'
  | 'pastel'
  | 'high-contrast'

export type CopyTone =
  | 'friendly'
  | 'formal'
  | 'punchy'
  | 'authoritative'
  | 'aspirational'
  | 'technical'

export type CTARole = 'primary' | 'secondary'

export interface CategoryCTA {
  /** Main conversion action — hero + mid-page CTA. Max 25 chars. */
  primary: string
  /** Exploration / low-commit action — nav + secondary cards. Max 25 chars. */
  secondary: string
}

export interface ThemeMood {
  id: MoodId
  /** Human-readable label for UI / admin. */
  label: string
  /** One-line description — used in GPT prompt when voice block is injected. */
  description: string
  /** 3-5 mood adjectives appended to Unsplash search query. */
  imageryKeywords: string[]
  /** Target photography filter — downstream image pipeline may apply CSS filter. */
  photographyFilter: PhotographyFilter
  /** 4-5 voice rules injected into GPT system prompt as bullet list. */
  voiceStyle: string[]
  /** High-level copy tone enum. */
  copyTone: CopyTone
  /** Category-tuned CTAs — 14 categories × 2 roles = 28 cells per mood. */
  ctaByCategory: Record<MoodCategory, CategoryCTA>
}

// ── Mood records ────────────────────────────────────────────────────────────

/**
 * PLAYFUL — fun, energetic, casual.
 * Use when the brand wants to feel approachable and a little cheeky.
 * Example presets: "Hawker Neon", "Bright Classroom", "Soft Blush".
 */
const PLAYFUL: ThemeMood = {
  id: 'playful',
  label: 'Playful',
  description: 'Fun, energetic, casual — like chatting with a favorite friend.',
  imageryKeywords: ['bright', 'colorful', 'candid smiles', 'vibrant', 'energetic'],
  photographyFilter: 'high-contrast',
  voiceStyle: [
    'Write like you are texting a close friend — warm, casual, second-person.',
    "Lean on contractions (you're, we've) and everyday verbs.",
    'Use one exclamation per section max — surprise, never shout.',
    'Skip corporate buzzwords ("synergy", "leverage", "solutions").',
    'Short sentences, quick rhythm, a little humor where it fits.',
  ],
  copyTone: 'friendly',
  ctaByCategory: {
    restaurant: { primary: 'Grab a Table', secondary: 'Peek the Menu' },
    ecommerce: { primary: 'Shop the Drop', secondary: 'Browse Picks' },
    beauty: { primary: 'Book a Glow-Up', secondary: 'See Services' },
    tech: { primary: 'Try It Free', secondary: 'See It Work' },
    health: { primary: 'Book a Checkup', secondary: 'Meet the Team' },
    education: { primary: 'Join a Class', secondary: 'Peek Courses' },
    realestate: { primary: 'Find Your Spot', secondary: 'Peek Listings' },
    fitness: { primary: 'Join the Fun', secondary: 'Peek Schedule' },
    creative: { primary: "Let's Make Stuff", secondary: 'See the Work' },
    business: { primary: "Let's Chat", secondary: 'Peek Our Work' },
    fnb: { primary: 'Swing By', secondary: 'Peek the Menu' },
    events: { primary: 'Start the Party', secondary: 'See Past Events' },
    blog: { primary: 'Join the Crew', secondary: 'Read Latest' },
    travel: { primary: "Let's Go", secondary: 'See Itineraries' },
  },
}

/**
 * ELEGANT — refined, upscale, timeless.
 * Use for brands that trade on craftsmanship, heritage, or premium pricing.
 * Example presets: "Heritage Gold", "Luxury Boutique", "Rose Petal".
 */
const ELEGANT: ThemeMood = {
  id: 'elegant',
  label: 'Elegant',
  description: 'Refined, upscale, timeless — quiet confidence without shouting.',
  imageryKeywords: ['refined', 'candlelit', 'marble', 'soft natural light', 'timeless'],
  photographyFilter: 'warm',
  voiceStyle: [
    'Write with quiet confidence — measured, never showy.',
    'Favor sophisticated vocabulary but never opaque.',
    'Each sentence earns its place; trim extra adjectives.',
    'Address readers as "you" formally, never slangy.',
    'Evoke sensory detail — texture, warmth, aroma.',
  ],
  copyTone: 'aspirational',
  ctaByCategory: {
    restaurant: { primary: 'Reserve a Table', secondary: 'View Our Menu' },
    ecommerce: { primary: 'Shop the Collection', secondary: 'Explore Pieces' },
    beauty: { primary: 'Book Appointment', secondary: 'View Treatments' },
    tech: { primary: 'Request a Demo', secondary: 'View Features' },
    health: { primary: 'Schedule a Visit', secondary: 'Meet Specialists' },
    education: { primary: 'Apply Now', secondary: 'View Programs' },
    realestate: { primary: 'View Listings', secondary: 'Schedule a Tour' },
    fitness: { primary: 'Join Today', secondary: 'View Classes' },
    creative: { primary: 'Start a Project', secondary: 'View Portfolio' },
    business: { primary: 'Schedule a Call', secondary: 'Learn More' },
    fnb: { primary: 'Visit Us', secondary: 'View Menu' },
    events: { primary: 'Plan Your Event', secondary: 'View Packages' },
    blog: { primary: 'Subscribe', secondary: 'Read Latest' },
    travel: { primary: 'Plan Your Trip', secondary: 'View Journeys' },
  },
}

/**
 * BOLD — punchy, direct, action-first.
 * Use for brands that convert on urgency, deals, or strong performance claims.
 * Example presets: "Iron Red" (future), "Neon Teal", "Cyber Blue".
 */
const BOLD: ThemeMood = {
  id: 'bold',
  label: 'Bold',
  description: 'Punchy, direct, action-first — leads with the verb.',
  imageryKeywords: ['high contrast', 'dramatic shadows', 'urban', 'kinetic', 'saturated color'],
  photographyFilter: 'high-contrast',
  voiceStyle: [
    'Lead with the verb. Command action, do not request it.',
    'Short punchy sentences. Sub-10 words where possible.',
    'Specific over vague — numbers, benefits, outcomes.',
    'Active voice only; no "we believe" or "we strive".',
    'Confident claims backed by proof (stats, guarantees).',
  ],
  copyTone: 'punchy',
  ctaByCategory: {
    restaurant: { primary: 'Book Now', secondary: 'See the Menu' },
    ecommerce: { primary: 'Shop Now', secondary: 'See Deals' },
    beauty: { primary: 'Book Now', secondary: 'See All Services' },
    tech: { primary: 'Start Free Trial', secondary: 'See Pricing' },
    health: { primary: 'Book Appointment', secondary: 'See Services' },
    education: { primary: 'Enroll Now', secondary: 'See Programs' },
    realestate: { primary: 'See Listings', secondary: 'Book a Viewing' },
    fitness: { primary: 'Start Today', secondary: 'See Classes' },
    creative: { primary: 'Get a Quote', secondary: 'See Work' },
    business: { primary: 'Get a Quote', secondary: 'See Services' },
    fnb: { primary: 'Order Now', secondary: 'See Menu' },
    events: { primary: 'Book Now', secondary: 'See Packages' },
    blog: { primary: 'Subscribe Now', secondary: 'Read Posts' },
    travel: { primary: 'Book Now', secondary: 'See Destinations' },
  },
}

/**
 * SERENE — calm, reassuring, gentle.
 * Use for wellness, spa, meditation, and any brand that wants to slow readers down.
 * Example presets: "Mint Breeze" (future), "Healing Green", "Garden Dining".
 */
const SERENE: ThemeMood = {
  id: 'serene',
  label: 'Serene',
  description: 'Calm, reassuring, gentle — invites the reader to slow down.',
  imageryKeywords: ['minimalist', 'natural light', 'soft neutral', 'calm', 'spacious'],
  photographyFilter: 'pastel',
  voiceStyle: [
    'Write gently — slow the reader down.',
    'Use reassuring verbs (rest, unwind, breathe, renew).',
    'Long, rhythmic sentences with natural pauses.',
    'Avoid urgency cues (limited, now, hurry).',
    'Invite, never push.',
  ],
  copyTone: 'friendly',
  ctaByCategory: {
    restaurant: { primary: 'Book a Table', secondary: 'Explore the Menu' },
    ecommerce: { primary: 'Shop Mindfully', secondary: 'Browse Collection' },
    beauty: { primary: 'Schedule Session', secondary: 'Explore Services' },
    tech: { primary: 'Get Started', secondary: 'Learn More' },
    health: { primary: 'Book a Visit', secondary: 'Meet Our Doctors' },
    education: { primary: 'Begin Learning', secondary: 'Explore Courses' },
    realestate: { primary: 'Find Your Home', secondary: 'View Properties' },
    fitness: { primary: 'Begin Practice', secondary: 'View Schedule' },
    creative: { primary: 'Begin a Project', secondary: 'View Portfolio' },
    business: { primary: 'Start a Conversation', secondary: 'Explore Services' },
    fnb: { primary: 'Come Sit Awhile', secondary: 'Browse Menu' },
    events: { primary: 'Begin Planning', secondary: 'Explore Packages' },
    blog: { primary: 'Join the Letter', secondary: 'Read the Archive' },
    travel: { primary: 'Begin the Journey', secondary: 'Explore Trips' },
  },
}

/**
 * EDITORIAL — magazine, storytelling, curious.
 * Use for content-heavy brands — publishers, studios, curated retail, case-study-led.
 * Example presets: "Editorial" (future), "Midnight Glam", "Penthouse Dark".
 */
const EDITORIAL: ThemeMood = {
  id: 'editorial',
  label: 'Editorial',
  description: 'Magazine, storytelling, curious — leads with narrative, not pitch.',
  imageryKeywords: ['cinematic', 'documentary', 'muted palette', 'shallow depth', 'storytelling'],
  photographyFilter: 'editorial',
  voiceStyle: [
    'Lead with a story or observation, not a pitch.',
    'Magazine cadence — setup, turn, payoff.',
    'Use specific details (names, places, textures).',
    'Third-person possible when it frames a narrative.',
    'Let the reader discover the benefit; avoid hard sell.',
  ],
  copyTone: 'aspirational',
  ctaByCategory: {
    restaurant: { primary: 'Discover the Menu', secondary: 'Read Our Story' },
    ecommerce: { primary: 'Discover the Story', secondary: 'Browse Edits' },
    beauty: { primary: 'Reserve a Ritual', secondary: 'Read the Rituals' },
    tech: { primary: 'Read the Story', secondary: 'See the Build' },
    health: { primary: 'Meet the Care Team', secondary: 'Read Patient Stories' },
    education: { primary: 'Meet the Students', secondary: 'Read Curriculum' },
    realestate: { primary: 'Meet the Homes', secondary: 'Read Neighborhoods' },
    fitness: { primary: 'Read Our Method', secondary: 'Meet the Coaches' },
    creative: { primary: 'Read Case Studies', secondary: 'See the Process' },
    business: { primary: 'Read Case Studies', secondary: 'Meet the Team' },
    fnb: { primary: 'Read the Story', secondary: 'View Menu' },
    events: { primary: 'Read Event Stories', secondary: 'Meet the Planners' },
    blog: { primary: 'Read the Latest', secondary: 'Explore Archive' },
    travel: { primary: 'Read Field Notes', secondary: 'See the Route' },
  },
}

/**
 * TECH-MINIMAL — functional, sharp, no-fluff.
 * Use for SaaS, dev tools, B2B productivity, and any brand where efficiency wins.
 * Example presets: "Minimal Code", "Clean SaaS", "City Modern".
 */
const TECH_MINIMAL: ThemeMood = {
  id: 'tech-minimal',
  label: 'Tech-Minimal',
  description: 'Functional, sharp, no-fluff — efficiency over flavor.',
  imageryKeywords: ['clean workspace', 'modern interface', 'grid layout', 'product flatlay', 'monochrome'],
  photographyFilter: 'cool',
  voiceStyle: [
    'Function over flavor — every sentence states a fact or action.',
    'Short, declarative, zero fluff.',
    'Benchmarks and specifications over adjectives.',
    'Second-person direct ("You get...", "Ship in minutes").',
    'No metaphors; be literal.',
  ],
  copyTone: 'technical',
  ctaByCategory: {
    restaurant: { primary: 'Reserve', secondary: 'View Menu' },
    ecommerce: { primary: 'Shop All', secondary: 'View Catalog' },
    beauty: { primary: 'Book', secondary: 'View Services' },
    tech: { primary: 'Start Building', secondary: 'Read Docs' },
    health: { primary: 'Book Visit', secondary: 'View Services' },
    education: { primary: 'Enroll', secondary: 'View Curriculum' },
    realestate: { primary: 'Browse Listings', secondary: 'Filter Homes' },
    fitness: { primary: 'Join', secondary: 'View Schedule' },
    creative: { primary: 'Start Brief', secondary: 'View Work' },
    business: { primary: 'Contact', secondary: 'View Services' },
    fnb: { primary: 'Order', secondary: 'View Menu' },
    events: { primary: 'Request Quote', secondary: 'View Packages' },
    blog: { primary: 'Subscribe', secondary: 'View Archive' },
    travel: { primary: 'Book Trip', secondary: 'View Itineraries' },
  },
}

/** All 6 moods keyed by id. Single source of truth for downstream consumers. */
export const THEME_MOODS: Record<MoodId, ThemeMood> = {
  playful: PLAYFUL,
  elegant: ELEGANT,
  bold: BOLD,
  serene: SERENE,
  editorial: EDITORIAL,
  'tech-minimal': TECH_MINIMAL,
}

/** Ordered list of all mood ids — used for iteration in tests + admin UI. */
export const ALL_MOOD_IDS: readonly MoodId[] = [
  'playful',
  'elegant',
  'bold',
  'serene',
  'editorial',
  'tech-minimal',
] as const

/** Ordered list of all 14 categories — used for coverage tests. */
export const ALL_MOOD_CATEGORIES: readonly MoodCategory[] = [
  'restaurant',
  'ecommerce',
  'beauty',
  'tech',
  'health',
  'education',
  'realestate',
  'fitness',
  'creative',
  'business',
  'fnb',
  'events',
  'blog',
  'travel',
] as const

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Max length allowed per CTA string — enforced by coverage test. */
export const CTA_MAX_LENGTH = 25

/**
 * Lookup a category-tuned CTA. Falls back to `business` category when the
 * raw category is unknown, then `serene` mood if both lookups miss (defensive).
 */
export function getCategoryCTA(
  mood: ThemeMood,
  category: string,
  role: CTARole,
): string {
  const canonical = (ALL_MOOD_CATEGORIES as readonly string[]).includes(category)
    ? (category as MoodCategory)
    : 'business'
  const cell = mood.ctaByCategory[canonical]
  return cell[role]
}

/**
 * Resolve a mood record by id. Throws on unknown id — callers must pass a valid
 * MoodId from `ALL_MOOD_IDS`.
 */
export function getMood(id: MoodId): ThemeMood {
  const mood = THEME_MOODS[id]
  if (!mood) throw new Error(`[theme-moods] Unknown moodId: ${id}`)
  return mood
}
