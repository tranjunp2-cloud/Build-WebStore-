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

import type { BlogPost } from './types'

export const BLOG_SEEDS_BY_CATEGORY: Record<string, BlogPost[]> = {
  restaurant: [
    { title: '5 Tips for First-Time Diners', excerpt: 'Navigate our menu like a regular — what to order, when to come, how to ask for the chef\'s pick.', slug: 'first-time-diners', category: 'Dining Tips', readTime: '3 min' },
    { title: 'Behind the Kitchen: A Day in the Life', excerpt: 'Sourcing, prep, service — follow our team through a full service day from 6am market run to midnight clean-down.', slug: 'behind-the-kitchen', category: 'Story', readTime: '5 min' },
    { title: 'Our Ingredient Sources', excerpt: 'Meet the Penang fishermen, Cameron highland farmers, and spice traders who make our menu possible.', slug: 'ingredient-sources', category: 'Sourcing', readTime: '4 min' },
    { title: 'Seasonal Menu: What\'s New This Month', excerpt: 'Fresh catches and seasonal produce driving our new dishes — limited time only.', slug: 'seasonal-menu', category: 'Menu', readTime: '2 min' },
  ],
  ecommerce: [
    { title: 'How to Style Our Signature Collection', excerpt: 'Three looks for three occasions — minimal, statement, weekend.', slug: 'styling-collection', category: 'Style', readTime: '4 min' },
    { title: 'Our Sourcing Story', excerpt: 'Fair-trade suppliers, artisan partners, and why we never compromise on craftsmanship.', slug: 'sourcing-story', category: 'About', readTime: '5 min' },
    { title: 'Customer Favorites This Month', excerpt: 'The 10 items flying off our virtual shelves — plus restock dates for sold-out picks.', slug: 'customer-favorites', category: 'Trending', readTime: '3 min' },
    { title: 'Size Guide: Getting the Perfect Fit', excerpt: 'Honest measurements, real body types, zero guesswork.', slug: 'size-guide', category: 'Guide', readTime: '6 min' },
  ],
  beauty: [
    { title: 'Skincare Routines for Tropical Weather', excerpt: 'Humidity-proof your glow — morning and evening routines built for Malaysian climate.', slug: 'tropical-skincare', category: 'Skincare', readTime: '4 min' },
    { title: 'Our Top 5 Treatments Explained', excerpt: 'What each signature treatment does, who it\'s for, and what to expect before/after.', slug: 'top-treatments', category: 'Treatments', readTime: '5 min' },
    { title: 'Meet Our Master Estheticians', excerpt: 'Behind the hands — 20+ years combined experience across our senior team.', slug: 'meet-estheticians', category: 'Team', readTime: '3 min' },
    { title: 'Self-Care Rituals You Can Do at Home', excerpt: 'Five 10-minute routines that extend your in-studio results between visits.', slug: 'home-rituals', category: 'Wellness', readTime: '4 min' },
  ],
  tech: [
    { title: 'Why We Chose TypeScript', excerpt: 'Type safety, DX, and maintainability — the 3 reasons behind our stack decision.', slug: 'why-typescript', category: 'Engineering', readTime: '6 min' },
    { title: 'Scaling to 10,000 Users — Lessons Learned', excerpt: 'What broke, what held, and the 3 decisions we\'d make differently.', slug: 'scaling-lessons', category: 'Engineering', readTime: '8 min' },
    { title: 'Product Roadmap: Q2 Preview', excerpt: 'What\'s shipping, what\'s exploratory, and how we prioritize.', slug: 'q2-roadmap', category: 'Product', readTime: '4 min' },
    { title: 'Customer Spotlight: How TeamX Uses Our API', excerpt: 'A 40-engineer team migrated in 2 weeks. Here\'s their story and the template they used.', slug: 'customer-teamx', category: 'Case Study', readTime: '7 min' },
  ],
  health: [
    { title: 'Preventive Care Checklist for Adults', excerpt: 'The annual screenings everyone over 30 should book, sorted by age range.', slug: 'preventive-checklist', category: 'Prevention', readTime: '5 min' },
    { title: 'Understanding Your Lab Results', excerpt: 'A plain-English guide to common blood panel values and what they mean.', slug: 'lab-results-guide', category: 'Education', readTime: '6 min' },
    { title: 'Meet the Specialists: Our Cardiology Team', excerpt: 'Credentials, training, and what to expect in your first consultation.', slug: 'cardiology-team', category: 'Team', readTime: '4 min' },
    { title: 'Nutrition Basics for Busy Professionals', excerpt: 'Five meal-prep principles from our dietitians — no gimmicks, no supplements.', slug: 'nutrition-basics', category: 'Nutrition', readTime: '5 min' },
  ],
  education: [
    { title: 'Study Techniques That Actually Work', excerpt: 'Spaced repetition, active recall, and the Pomodoro technique — with research citations.', slug: 'study-techniques', category: 'Learning', readTime: '6 min' },
    { title: 'Our Approach to Personalized Learning', excerpt: 'How we adapt to each student\'s pace and strengths — with examples from real classes.', slug: 'personalized-approach', category: 'Method', readTime: '5 min' },
    { title: 'Student Success Stories: SPM Toppers 2026', excerpt: 'Three students, three journeys — from struggling to straight As.', slug: 'spm-toppers', category: 'Success', readTime: '7 min' },
    { title: 'Parent Guide: Supporting Your Child\'s Studies', excerpt: 'Five evidence-based ways parents can help without nagging.', slug: 'parent-guide', category: 'Parents', readTime: '4 min' },
  ],
  realestate: [
    { title: 'Klang Valley Market Update — April 2026', excerpt: 'Current trends, hot neighborhoods, and where prices are heading in Q2.', slug: 'market-update-q2', category: 'Market', readTime: '5 min' },
    { title: 'First-Time Buyer\'s Complete Guide', excerpt: 'From loan approval to keys in hand — every step broken down with real numbers.', slug: 'first-time-buyer', category: 'Guide', readTime: '8 min' },
    { title: 'Investment Properties: What to Look For', excerpt: 'The 7 criteria we use to evaluate rental yield potential.', slug: 'investment-criteria', category: 'Investment', readTime: '6 min' },
    { title: 'Neighborhood Spotlight: Mont Kiara', excerpt: 'Schools, transit, cafes, and the real cost of living in this expat favorite.', slug: 'neighborhood-mont-kiara', category: 'Neighborhoods', readTime: '5 min' },
  ],
  fitness: [
    { title: 'Beginner\'s Guide to Strength Training', excerpt: 'Six foundational movements, progressive overload, and recovery basics.', slug: 'beginner-strength', category: 'Training', readTime: '6 min' },
    { title: 'Nutrition for Active People', excerpt: 'Pre-workout, post-workout, and rest day — what to eat and when.', slug: 'active-nutrition', category: 'Nutrition', readTime: '5 min' },
    { title: 'Member Transformation: Daniel\'s 6-Month Journey', excerpt: 'Down 18kg, up 40% on his big lifts — with weekly check-ins and programming details.', slug: 'daniel-transformation', category: 'Success', readTime: '7 min' },
    { title: 'Injury Prevention 101', excerpt: 'Warm-up, mobility, and the red flags to watch during every workout.', slug: 'injury-prevention', category: 'Health', readTime: '5 min' },
  ],
  creative: [
    { title: 'Inside the Design Process', excerpt: 'From discovery call to final delivery — a transparent look at our 4-week workflow.', slug: 'design-process', category: 'Process', readTime: '6 min' },
    { title: 'Case Study: Rebranding a Heritage Café', excerpt: 'How we honored 40 years of history while making the brand feel fresh for a new generation.', slug: 'cafe-rebrand-case', category: 'Case Study', readTime: '8 min' },
    { title: 'Typography Trends We\'re Watching', excerpt: 'Variable fonts, brutalist serifs, and the return of handwritten scripts.', slug: 'typography-trends', category: 'Trends', readTime: '4 min' },
    { title: 'Studio Tools: Our Current Tech Stack', excerpt: 'The software and hardware powering our design and production workflow.', slug: 'studio-tools', category: 'Tools', readTime: '5 min' },
  ],
  business: [
    { title: 'Market Entry Strategy for Southeast Asia', excerpt: 'Five proven playbooks and the 3 failure modes to avoid — drawn from 50+ engagements.', slug: 'sea-market-entry', category: 'Strategy', readTime: '8 min' },
    { title: 'When to Hire a Fractional CFO', excerpt: 'The growth-stage signals that say "time to get finance help" without the full-time cost.', slug: 'fractional-cfo', category: 'Finance', readTime: '5 min' },
    { title: 'Case Study: Operations Turnaround in 90 Days', excerpt: 'A manufacturing client went from -8% margin to +12% without layoffs. Here\'s how.', slug: 'ops-turnaround', category: 'Case Study', readTime: '7 min' },
    { title: 'The Consulting Toolkit We Use Daily', excerpt: 'Frameworks, templates, and software that shape our engagements.', slug: 'consulting-toolkit', category: 'Tools', readTime: '5 min' },
  ],
  fnb: [
    { title: 'The Art of Pulling Teh Tarik', excerpt: 'Why we train every barista to pull the perfect stretch — and why it matters.', slug: 'pulling-teh-tarik', category: 'Craft', readTime: '3 min' },
    { title: 'Our Coffee Sourcing Story', excerpt: 'Direct trade with farmers in Cameron Highlands and Sumatra — the relationships behind every cup.', slug: 'coffee-sourcing', category: 'Sourcing', readTime: '5 min' },
    { title: 'Weekend Menu: Brunch Specials', excerpt: 'Three new dishes + classic favorites. Served Saturday and Sunday only.', slug: 'brunch-specials', category: 'Menu', readTime: '2 min' },
    { title: 'How to Brew Great Coffee at Home', excerpt: 'Beans, grind, water, technique — our barista\'s pocket guide.', slug: 'home-brewing', category: 'Tips', readTime: '4 min' },
  ],
  events: [
    { title: '2026 Wedding Trends We\'re Loving', excerpt: 'Minimal color palettes, forage florals, and intimate guest counts — the shift we\'re seeing.', slug: 'wedding-trends-2026', category: 'Trends', readTime: '5 min' },
    { title: 'Planning Your Corporate Offsite: A Checklist', excerpt: 'Venue, catering, activities, logistics — everything we handle so you don\'t have to.', slug: 'offsite-checklist', category: 'Corporate', readTime: '6 min' },
    { title: 'Real Wedding: Siti & Aiman at The Garden', excerpt: 'A 200-guest garden wedding in Bangsar — full timeline, vendors, and photos.', slug: 'real-wedding-siti-aiman', category: 'Real Events', readTime: '7 min' },
    { title: 'Choosing the Right Venue', excerpt: 'Five questions to ask before booking — plus our current venue partners.', slug: 'choosing-venue', category: 'Planning', readTime: '5 min' },
  ],
  blog: [
    { title: 'This Week in Malaysia', excerpt: 'Our editors\' picks from the last 7 days — stories you might have missed.', slug: 'this-week', category: 'Weekly', readTime: '4 min' },
    { title: 'Long Read: The Future of KL Transit', excerpt: 'Interviews with urban planners, commuters, and elected officials on the MRT3 project.', slug: 'kl-transit-future', category: 'Long Read', readTime: '12 min' },
    { title: 'Opinion: What Makes a Good Neighborhood?', excerpt: 'Our editor reflects on 20 years of living in the same PJ neighborhood.', slug: 'good-neighborhood', category: 'Opinion', readTime: '5 min' },
    { title: 'Reader Poll Results: Best Roti Canai in KL', excerpt: 'Over 3,000 votes, 50+ places — the final rankings (and the controversy).', slug: 'best-roti-canai', category: 'Poll', readTime: '6 min' },
  ],
  travel: [
    { title: 'Hidden Gems of East Malaysia', excerpt: 'Five places we send first-time Borneo travelers — skip the guidebook circuit.', slug: 'east-msia-gems', category: 'Destinations', readTime: '6 min' },
    { title: 'Planning a Multi-Stop Southeast Asia Trip', excerpt: 'Flights, visas, budget, and the itinerary we use for 2-week Southeast Asia circuits.', slug: 'sea-multi-stop', category: 'Planning', readTime: '8 min' },
    { title: 'Solo Travel Guide: Penang in 3 Days', excerpt: 'Where to stay, eat, and wander — a detailed itinerary for solo travelers.', slug: 'penang-solo-3-days', category: 'Solo Travel', readTime: '7 min' },
    { title: 'Why We Love Slow Travel', excerpt: 'Four reasons to stay longer in fewer places — and how we design trips around it.', slug: 'slow-travel', category: 'Philosophy', readTime: '5 min' },
  ],
}

/**
 * Get blog seeds for a category, with fallback for unknown categories.
 * Always returns an array (possibly empty) — never undefined.
 */
export function getBlogSeeds(category: string): BlogPost[] {
  const key = category.toLowerCase().replace(/[\s_-]+/g, '')
  return BLOG_SEEDS_BY_CATEGORY[key] ?? BLOG_SEEDS_BY_CATEGORY['business'] ?? []
}

/** Total blog seed count — used by coverage test. */
export function totalBlogSeedCount(): number {
  return Object.values(BLOG_SEEDS_BY_CATEGORY).reduce((sum, arr) => sum + arr.length, 0)
}
