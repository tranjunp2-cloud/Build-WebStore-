/**
 * Blog seeds — 3-5 hand-curated posts per category (14 × ~4 = 56 total).
 *
 * Rendered into the Blog sub-page's `blog-list` block items. Display-only:
 * no CMS editing, no backing posts collection. Purpose is to kill the
 * empty "Latest Articles" scaffold users see today.
 *
 * Images come from the Phase 03 image pool at composer time, not stored here.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-05-multipage-completeness.md
 */

import type { BlogPost, BusinessSample } from './types'
import { seededShuffle } from '../seeded-random'

export const BLOG_SEEDS_BY_CATEGORY: Record<string, BlogPost[]> = {
  restaurant: [
    { title: '5 Tips for First-Time Diners at {business}', excerpt: 'Navigate our menu like a regular: what to order, when to come, and how to ask for a recommendation at {business}.', slug: 'first-time-diners', category: 'Dining Tips', readTime: '3 min' },
    { title: 'Behind the Kitchen: A Day at {business}', excerpt: 'Sourcing, prep, service: a look at how a service day comes together at {business}.', slug: 'behind-the-kitchen', category: 'Story', readTime: '5 min' },
    { title: 'What Goes Into Our {product}', excerpt: 'A look at the ingredients and preparation behind our {product}.', slug: 'ingredient-sources', category: 'Sourcing', readTime: '4 min' },
    { title: 'Seasonal Menu: {product} Specials', excerpt: 'A look at {product} dishes and specials you can try on our menu.', slug: 'seasonal-menu', category: 'Menu', readTime: '2 min' },
  ],
  ecommerce: [
    { title: 'How to Style {business} {product}', excerpt: 'Three looks for three occasions — minimal, statement, weekend — with our {product}.', slug: 'styling-collection', category: 'Style', readTime: '4 min' },
    { title: 'How {business} Chooses Products', excerpt: 'How {business} chooses products, and what we look for in quality and craftsmanship.', slug: 'sourcing-story', category: 'About', readTime: '5 min' },
    { title: 'Picks to Browse at {business} This Month', excerpt: 'A look at {product} picks to browse at {business} this month.', slug: 'customer-favorites', category: 'Trending', readTime: '3 min' },
    { title: 'Size Guide: Getting the Perfect Fit', excerpt: 'How to read size charts and choose the right fit.', slug: 'size-guide', category: 'Guide', readTime: '6 min' },
  ],
  beauty: [
    { title: 'Skincare Routines for Tropical Weather', excerpt: 'Humidity-proof your glow — morning and evening routines built for Malaysian climate.', slug: 'tropical-skincare', category: 'Skincare', readTime: '4 min' },
    { title: 'Our Top 5 Treatments Explained', excerpt: 'What each signature treatment does, who it\'s for, and what to expect before/after.', slug: 'top-treatments', category: 'Treatments', readTime: '5 min' },
    { title: 'Meet Our Beauty Team', excerpt: 'Get to know the team behind your treatments and what to expect at your visit.', slug: 'meet-estheticians', category: 'Team', readTime: '3 min' },
    { title: 'Self-Care Rituals You Can Do at Home', excerpt: 'Five 10-minute routines that extend your in-studio results between visits.', slug: 'home-rituals', category: 'Wellness', readTime: '4 min' },
  ],
  tech: [
    { title: 'Why Type Safety Matters', excerpt: 'Type safety, developer experience, and maintainability: three reasons teams choose typed languages.', slug: 'why-typescript', category: 'Engineering', readTime: '6 min' },
    { title: 'Lessons on Scaling a Product', excerpt: 'Common things that break as usage grows, and decisions worth making early.', slug: 'scaling-lessons', category: 'Engineering', readTime: '8 min' },
    { title: 'Product Roadmap Updates', excerpt: 'How we share product updates: what is shipping, what is exploratory, and how priorities are set.', slug: 'q2-roadmap', category: 'Product', readTime: '4 min' },
    { title: 'How Teams Adopt New Tools', excerpt: 'A practical checklist for moving to a new platform: planning, testing, and rollout.', slug: 'customer-teamx', category: 'Case Study', readTime: '7 min' },
  ],
  health: [
    { title: 'Preventive Care Checklist for Adults', excerpt: 'A general checklist of preventive care topics to discuss with your doctor.', slug: 'preventive-checklist', category: 'Prevention', readTime: '5 min' },
    { title: 'Understanding Your Lab Results', excerpt: 'A plain-English guide to reading common lab results. Always confirm with your doctor.', slug: 'lab-results-guide', category: 'Education', readTime: '6 min' },
    { title: 'Meet Our Medical Team', excerpt: 'Learn about the team and what to expect in your first consultation.', slug: 'cardiology-team', category: 'Team', readTime: '4 min' },
    { title: 'Nutrition Basics for Busy Professionals', excerpt: 'Simple meal-prep principles for busy schedules.', slug: 'nutrition-basics', category: 'Nutrition', readTime: '5 min' },
  ],
  education: [
    { title: 'Study Techniques Worth Trying', excerpt: 'Spaced repetition, active recall, and the Pomodoro technique explained.', slug: 'study-techniques', category: 'Learning', readTime: '6 min' },
    { title: 'Our Approach to Personalized Learning', excerpt: 'How personalised learning adapts to each student\'s pace and strengths.', slug: 'personalized-approach', category: 'Method', readTime: '5 min' },
    { title: 'Setting Goals for Exam Success', excerpt: 'How students can plan, practise, and stay motivated in the months before exams.', slug: 'spm-toppers', category: 'Success', readTime: '7 min' },
    { title: 'Parent Guide: Supporting Your Child\'s Studies', excerpt: 'Practical ways parents can support their child\'s studies without nagging.', slug: 'parent-guide', category: 'Parents', readTime: '4 min' },
  ],
  realestate: [
    { title: 'How to Read Property Market Updates', excerpt: 'What to look at in market trends, neighbourhood activity, and price movements.', slug: 'market-update-q2', category: 'Market', readTime: '5 min' },
    { title: 'First-Time Buyer\'s Complete Guide', excerpt: 'From loan approval to collecting the keys: each step explained.', slug: 'first-time-buyer', category: 'Guide', readTime: '8 min' },
    { title: 'Investment Properties: What to Look For', excerpt: 'Key criteria for evaluating rental yield potential.', slug: 'investment-criteria', category: 'Investment', readTime: '6 min' },
    { title: 'Neighbourhood Guide: What to Check Before You Buy', excerpt: 'Schools, transit, amenities, and cost of living: what to check when choosing a neighbourhood.', slug: 'neighborhood-mont-kiara', category: 'Neighborhoods', readTime: '5 min' },
  ],
  fitness: [
    { title: 'Beginner\'s Guide to Strength Training', excerpt: 'Six foundational movements, progressive overload, and recovery basics.', slug: 'beginner-strength', category: 'Training', readTime: '6 min' },
    { title: 'Nutrition for Active People', excerpt: 'Pre-workout, post-workout, and rest day — what to eat and when.', slug: 'active-nutrition', category: 'Nutrition', readTime: '5 min' },
    { title: 'Setting Realistic Transformation Goals', excerpt: 'How to plan progress over months: tracking, check-ins, and programming.', slug: 'daniel-transformation', category: 'Success', readTime: '7 min' },
    { title: 'Injury Prevention 101', excerpt: 'Warm-up, mobility, and the red flags to watch during every workout.', slug: 'injury-prevention', category: 'Health', readTime: '5 min' },
  ],
  creative: [
    { title: 'Inside the Design Process', excerpt: 'From discovery call to final delivery: a look at a typical creative workflow.', slug: 'design-process', category: 'Process', readTime: '6 min' },
    { title: 'How a Rebrand Honours Heritage', excerpt: 'Ways to respect a brand\'s history while making it feel fresh for a new generation.', slug: 'cafe-rebrand-case', category: 'Case Study', readTime: '8 min' },
    { title: 'Typography Trends We\'re Watching', excerpt: 'Variable fonts, brutalist serifs, and the return of handwritten scripts.', slug: 'typography-trends', category: 'Trends', readTime: '4 min' },
    { title: 'Studio Tools for Design Workflows', excerpt: 'The software and hardware that commonly power design and production workflows.', slug: 'studio-tools', category: 'Tools', readTime: '5 min' },
  ],
  business: [
    { title: 'Market Entry Strategy for Southeast Asia', excerpt: 'Common playbooks for entering Southeast Asia and the failure modes to avoid.', slug: 'sea-market-entry', category: 'Strategy', readTime: '8 min' },
    { title: 'When to Hire a Fractional CFO', excerpt: 'The growth-stage signals that say "time to get finance help" without the full-time cost.', slug: 'fractional-cfo', category: 'Finance', readTime: '5 min' },
    { title: 'Operations Turnaround: Where to Start', excerpt: 'How to approach improving margins and operations: diagnose, prioritise, and act.', slug: 'ops-turnaround', category: 'Case Study', readTime: '7 min' },
    { title: 'Consulting Toolkit: Frameworks and Templates', excerpt: 'Frameworks, templates, and software that shape consulting engagements.', slug: 'consulting-toolkit', category: 'Tools', readTime: '5 min' },
  ],
  fnb: [
    { title: 'The Art of the Pour at {business}', excerpt: 'What goes into pulling a good teh tarik, and why technique matters.', slug: 'pulling-teh-tarik', category: 'Craft', readTime: '3 min' },
    { title: '{business}: The Story Behind Our {product}', excerpt: 'A look at the ingredients and preparation behind every {product}.', slug: 'coffee-sourcing', category: 'Sourcing', readTime: '5 min' },
    { title: 'Menu Highlights at {business}: {product} Specials', excerpt: 'Dishes and favourites to try at {business}, including {product}.', slug: 'brunch-specials', category: 'Menu', readTime: '2 min' },
    { title: 'How to Brew Great {product} at Home', excerpt: 'Beans, grind, water, technique: a pocket guide.', slug: 'home-brewing', category: 'Tips', readTime: '4 min' },
  ],
  events: [
    { title: 'Wedding Trends We\'re Loving', excerpt: 'Minimal color palettes, forage florals, and intimate guest counts — the shift we\'re seeing.', slug: 'wedding-trends-2026', category: 'Trends', readTime: '5 min' },
    { title: 'Planning Your Corporate Offsite: A Checklist', excerpt: 'Venue, catering, activities, and logistics: what to plan for.', slug: 'offsite-checklist', category: 'Corporate', readTime: '6 min' },
    { title: 'Planning a Garden Wedding', excerpt: 'Timeline, vendors, and decor considerations for an outdoor celebration.', slug: 'real-wedding-siti-aiman', category: 'Real Events', readTime: '7 min' },
    { title: 'Choosing the Right Venue', excerpt: 'Questions to ask before booking a venue.', slug: 'choosing-venue', category: 'Planning', readTime: '5 min' },
  ],
  blog: [
    { title: 'This Week in Malaysia', excerpt: 'Our editors\' picks from the last 7 days — stories you might have missed.', slug: 'this-week', category: 'Weekly', readTime: '4 min' },
    { title: 'Long Read: The Future of City Transit', excerpt: 'A long read on how cities plan and shape public transit.', slug: 'kl-transit-future', category: 'Long Read', readTime: '12 min' },
    { title: 'Opinion: What Makes a Good Neighborhood?', excerpt: 'An editor reflects on what makes a neighbourhood a good place to live.', slug: 'good-neighborhood', category: 'Opinion', readTime: '5 min' },
    { title: 'Reader Poll: Your Favourite Roti Canai', excerpt: 'Readers share their favourite spots, and the debate that follows.', slug: 'best-roti-canai', category: 'Poll', readTime: '6 min' },
  ],
  travel: [
    { title: 'Hidden Gems of East Malaysia', excerpt: 'Lesser-known places to consider for a first Borneo trip.', slug: 'east-msia-gems', category: 'Destinations', readTime: '6 min' },
    { title: 'Planning a Multi-Stop Southeast Asia Trip', excerpt: 'Flights, visas, budget, and a sample itinerary for a multi-stop trip.', slug: 'sea-multi-stop', category: 'Planning', readTime: '8 min' },
    { title: 'Solo Travel Guide: Penang in 3 Days', excerpt: 'Where to stay, eat, and wander — a detailed itinerary for solo travelers.', slug: 'penang-solo-3-days', category: 'Solo Travel', readTime: '7 min' },
    { title: 'Why We Love Slow Travel', excerpt: 'Reasons to stay longer in fewer places.', slug: 'slow-travel', category: 'Philosophy', readTime: '5 min' },
  ],
}

/**
 * Substitute `{business}` / `{product}` placeholders inside a blog seed
 * string using user-supplied business data. Missing fields fall back to
 * a neutral word ("our") so the string never ships with visible braces.
 */
function substitutePlaceholders(str: string, biz: Partial<BusinessSample> | undefined): string {
  if (!biz) return str
  const name = biz.name?.trim() || 'our'
  const product = biz.products?.[0]?.trim() || 'menu'
  return str
    .replace(/\{business\}/g, name)
    .replace(/\{product\}/g, product)
}

/**
 * Get blog seeds for a category, with fallback for unknown categories.
 * Always returns an array (possibly empty) — never undefined.
 *
 * Plan 07 — optional `biz` arg substitutes `{business}` / `{product}`
 * placeholders inside seed titles/excerpts so the Blog sub-page weaves
 * the user's business name + top product into every post. Backward-compat:
 * omitting `biz` returns the raw templated strings (useful for unit tests
 * that count entries).
 */
export function getBlogSeeds(
  category: string,
  biz?: Partial<BusinessSample>,
  seed?: number,
): BlogPost[] {
  const key = category.toLowerCase().replace(/[\s_-]+/g, '')
  const baseSeeds = BLOG_SEEDS_BY_CATEGORY[key] ?? BLOG_SEEDS_BY_CATEGORY['business'] ?? []
  // GH-912: when seed provided, rotate ordering so two same-category users
  // with different contact info get different "which 3 posts" + ordering.
  const seeds = seed !== undefined ? seededShuffle(baseSeeds, seed) : baseSeeds
  if (!biz) return seeds
  return seeds.map((s) => ({
    ...s,
    title: substitutePlaceholders(s.title, biz),
    excerpt: substitutePlaceholders(s.excerpt, biz),
  }))
}

/** Total blog seed count — used by coverage test. */
export function totalBlogSeedCount(): number {
  return Object.values(BLOG_SEEDS_BY_CATEGORY).reduce((sum, arr) => sum + arr.length, 0)
}
