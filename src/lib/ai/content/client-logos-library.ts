/**
 * Plan 260417-0837 phase-01 item 1.4 — shared pool of MY brand names for
 * client-logos / logo-cloud blocks. Each cat's `logos: [...]` field in
 * content/{cat}.ts picks 6-8 entries from this pool by `industryTag`.
 *
 * `url` is intentionally omitted. Logos need image assets + copyright
 * clearance which is out of scope here. Consumers render name-only badges
 * until the media pipeline ships. The `industryTag` lets cats filter by
 * context (e.g. tech shows banks + retailers; beauty shows beauty + retail).
 *
 * Source list is public brand names only — no credentials, no trademarks
 * used commercially. Safe to ship.
 */

import type { ClientLogo } from './types'

export const CLIENT_LOGOS_LIBRARY: ClientLogo[] = [
  // Banks & financial services
  { name: 'Maybank', industryTag: 'finance' },
  { name: 'CIMB Bank', industryTag: 'finance' },
  { name: 'Public Bank', industryTag: 'finance' },
  { name: 'RHB Bank', industryTag: 'finance' },
  { name: 'Hong Leong Bank', industryTag: 'finance' },
  { name: 'AmBank', industryTag: 'finance' },
  // Retail & e-commerce
  { name: 'Shopee Malaysia', industryTag: 'retail' },
  { name: 'Lazada Malaysia', industryTag: 'retail' },
  { name: 'Zalora', industryTag: 'retail' },
  { name: 'Parkson', industryTag: 'retail' },
  { name: 'Aeon', industryTag: 'retail' },
  { name: 'Mydin', industryTag: 'retail' },
  // Telecoms
  { name: 'Maxis', industryTag: 'telco' },
  { name: 'Celcom', industryTag: 'telco' },
  { name: 'Digi', industryTag: 'telco' },
  { name: 'U Mobile', industryTag: 'telco' },
  { name: 'Unifi', industryTag: 'telco' },
  // F&B groups
  { name: 'Berjaya Food', industryTag: 'fnb' },
  { name: 'QSR Brands', industryTag: 'fnb' },
  { name: 'Texchem', industryTag: 'fnb' },
  { name: 'Old Town White Coffee', industryTag: 'fnb' },
  // Government / agencies
  { name: 'MATRADE', industryTag: 'gov' },
  { name: 'MIDA', industryTag: 'gov' },
  { name: 'MDEC', industryTag: 'gov' },
  { name: 'SME Corp', industryTag: 'gov' },
  { name: 'Bank Negara Malaysia', industryTag: 'gov' },
  // Healthcare
  { name: 'KPJ Healthcare', industryTag: 'health' },
  { name: 'Sunway Medical Centre', industryTag: 'health' },
  { name: 'Pantai Hospital', industryTag: 'health' },
  { name: 'Gleneagles Kuala Lumpur', industryTag: 'health' },
  // Education
  { name: 'Taylor\'s University', industryTag: 'education' },
  { name: 'Sunway University', industryTag: 'education' },
  { name: 'Monash University Malaysia', industryTag: 'education' },
  { name: 'INTI International University', industryTag: 'education' },
  // Real estate / property
  { name: 'Sime Darby Property', industryTag: 'realestate' },
  { name: 'SP Setia', industryTag: 'realestate' },
  { name: 'Mah Sing', industryTag: 'realestate' },
  { name: 'IOI Properties', industryTag: 'realestate' },
  // Media / publications
  { name: 'The Star', industryTag: 'media' },
  { name: 'New Straits Times', industryTag: 'media' },
  { name: 'Astro', industryTag: 'media' },
  { name: 'Media Prima', industryTag: 'media' },
  // Logistics / travel
  { name: 'Pos Malaysia', industryTag: 'logistics' },
  { name: 'AirAsia', industryTag: 'travel' },
  { name: 'Malaysia Airlines', industryTag: 'travel' },
  { name: 'KTM Berhad', industryTag: 'logistics' },
  // Beauty / lifestyle
  { name: 'Watsons', industryTag: 'beauty' },
  { name: 'Guardian', industryTag: 'beauty' },
  { name: 'Sephora Malaysia', industryTag: 'beauty' },
  // Tech / startups
  { name: 'Grab', industryTag: 'tech' },
  { name: 'Foodpanda', industryTag: 'tech' },
  { name: 'Carsome', industryTag: 'tech' },
  { name: 'iPrice', industryTag: 'tech' },
  { name: 'StashAway', industryTag: 'tech' },
]

/** Pick `count` logos by `industryTag` match. Deterministic via seed. */
export function pickLogosByTags(
  tags: string[],
  count: number,
  seed = 0,
): ClientLogo[] {
  const matches = CLIENT_LOGOS_LIBRARY.filter((l) =>
    l.industryTag ? tags.includes(l.industryTag) : false,
  )
  if (matches.length === 0) return CLIENT_LOGOS_LIBRARY.slice(0, count)
  // Rotate start index by seed so same tags + different seeds produce
  // different logo slices for variety across businesses in the same cat.
  const start = Math.abs(seed) % matches.length
  const rotated = matches.slice(start).concat(matches.slice(0, start))
  return rotated.slice(0, count)
}

/**
 * Map canonical category slug → tag mix. Drives `pickLogosByCategory`.
 * Each cat surfaces logos from sectors its customers actually recognise.
 */
const CATEGORY_LOGO_TAGS: Readonly<Record<string, readonly string[]>> = {
  restaurant: ['fnb', 'retail', 'media'],
  fnb: ['fnb', 'retail', 'media'],
  beauty: ['beauty', 'retail', 'media'],
  tech: ['tech', 'finance', 'telco', 'gov'],
  health: ['health', 'finance', 'gov'],
  education: ['education', 'gov', 'finance', 'media'],
  realestate: ['realestate', 'finance', 'gov'],
  fitness: ['health', 'beauty', 'retail', 'media'],
  creative: ['media', 'retail', 'tech'],
  business: ['finance', 'gov', 'telco', 'logistics'],
  ecommerce: ['retail', 'finance', 'logistics', 'tech'],
  events: ['fnb', 'media', 'retail', 'gov'],
  blog: ['media', 'tech', 'retail', 'finance'],
  travel: ['travel', 'logistics', 'finance', 'media'],
}

/**
 * Category-aware wrapper. Always returns ≥1 logo — falls back to
 * `finance+retail` if category is unknown.
 */
export function pickLogosByCategory(
  category: string | undefined,
  count = 6,
  seed = 0,
): ClientLogo[] {
  const tags = (category && CATEGORY_LOGO_TAGS[category])
    ? [...CATEGORY_LOGO_TAGS[category]]
    : ['finance', 'retail']
  return pickLogosByTags(tags, count, seed)
}
