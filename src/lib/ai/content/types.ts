import type { GenerationFacts } from '../generation-facts'

export type BusinessSample = {
  name: string
  tagline: string
  description: string
  address: string
  phone: string
  email: string
  heroHeadline: string
  heroSubheadline: string
  // Ephemeral from BusinessInfoInput wire payload, NOT persisted to Payload.
  // Populated via bizOverride in composeFromBlueprint when user supplies products.
  products?: string[]
  /**
   * Ephemeral, like `products`: the merchant FACTS for this generation (#2103 A1).
   * When absent (template gallery, legacy callers) builders emit no invented claims.
   */
  facts?: GenerationFacts
}

export type TestimonialSample = {
  name: string
  title?: string
  company?: string
  rating: number
  quote: string
  /** Malay-language version of quote — used when blockLang === 'ms' */
  quote_ms?: string
  /** Vietnamese-language version of quote — used when blockLang === 'vi' */
  quote_vi?: string
}

export type FAQSample = {
  question: string
  answer: string
}

export type IndustryBlockSample = {
  blockType: string
  variant?: string
  [key: string]: unknown
}

/**
 * Plan 260414-2249 phase-05: seeded blog post for the Blog sub-page.
 * Rendered directly into blog-list block items — display-only, no CMS.
 * Images assigned later from Phase 03 image pool when available.
 */
export type BlogPost = {
  title: string
  excerpt: string
  slug: string
  category?: string
  readTime?: string
}

export type CategoryContent = {
  category: string
  locale: 'en-MY'
  businesses: BusinessSample[]
  testimonials: TestimonialSample[]
  faqItems: FAQSample[]
  industryBlocks: IndustryBlockSample[]
  /** Plan 260414-2249 phase-05: 3-5 hand-curated posts per category. */
  blogSeeds?: BlogPost[]
}
