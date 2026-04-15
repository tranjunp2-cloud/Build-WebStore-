/**
 * JSON-LD structured data templates.
 *
 * Generates schema.org LocalBusiness + industry-specific variants
 * (Restaurant, HealthClinic, EducationalOrganization) + FAQPage helper.
 * Populated with user-supplied contact + product fields from Phase 01's
 * business-info-mapper.
 *
 * Output is embedded into `<script type="application/ld+json">` tags
 * during page render for Google rich results eligibility.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-06-seo-consistency-guard.md
 */

import type { BusinessSample } from './content/types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface LocalBusinessSchema {
  '@context': 'https://schema.org'
  '@type':
    | 'LocalBusiness'
    | 'Restaurant'
    | 'MedicalClinic'
    | 'EducationalOrganization'
    | 'Store'
    | 'BeautySalon'
    | 'HealthAndBeautyBusiness'
  name: string
  description?: string
  telephone?: string
  email?: string
  url?: string
  image?: string | string[]
  address?: {
    '@type': 'PostalAddress'
    streetAddress?: string
    addressLocality?: string
    addressCountry?: string
  }
  priceRange?: string
  servesCuisine?: string[]
  medicalSpecialty?: string
}

export interface FaqPageSchema {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: Array<{
    '@type': 'Question'
    name: string
    acceptedAnswer: {
      '@type': 'Answer'
      text: string
    }
  }>
}

export type JsonLdSchema = LocalBusinessSchema | FaqPageSchema

// ── Category → @type mapping ────────────────────────────────────────────────

/**
 * Map composer category to schema.org @type. Defaults to LocalBusiness
 * for unknown categories — Google accepts this as a generic fallback.
 */
function schemaTypeFor(category: string): LocalBusinessSchema['@type'] {
  switch (category.toLowerCase()) {
    case 'restaurant':
    case 'fnb':
      return 'Restaurant'
    case 'health':
      return 'MedicalClinic'
    case 'education':
      return 'EducationalOrganization'
    case 'ecommerce':
      return 'Store'
    case 'beauty':
      return 'BeautySalon'
    default:
      return 'LocalBusiness'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse an address string into postal-address components. Very lightweight —
 * handles common "street, city, country" shapes. Fallback: everything in
 * streetAddress when structure unclear.
 */
function parseAddress(raw: string | undefined): LocalBusinessSchema['address'] {
  if (!raw || !raw.trim()) return undefined
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  if (parts.length === 0) return undefined
  const result: NonNullable<LocalBusinessSchema['address']> = {
    '@type': 'PostalAddress',
  }
  if (parts.length >= 1) result.streetAddress = parts[0]
  if (parts.length >= 2) result.addressLocality = parts[1]
  result.addressCountry = parts.length >= 3 ? parts[parts.length - 1] : 'MY'
  return result
}

/**
 * Derive a priceRange hint from the category. Purely heuristic — real
 * pricing data isn't available at gen time.
 */
function defaultPriceRange(category: string): string | undefined {
  switch (category.toLowerCase()) {
    case 'restaurant':
    case 'fnb':
      return '$$'
    case 'health':
    case 'realestate':
      return '$$$'
    case 'beauty':
    case 'fitness':
      return '$$'
    case 'tech':
      return '$$$'
    default:
      return undefined
  }
}

// ── Public builders ─────────────────────────────────────────────────────────

/**
 * Build a LocalBusiness (or industry variant) schema.org JSON-LD object.
 * Includes all user-supplied contact data — this is INTENTIONAL SEO
 * disclosure (LocalBusiness exists to publish contact info).
 */
export function buildLocalBusinessJsonLd(args: {
  biz: BusinessSample
  category: string
  siteUrl?: string
  heroImageUrl?: string
}): LocalBusinessSchema {
  const { biz, category, siteUrl, heroImageUrl } = args
  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': schemaTypeFor(category),
    name: biz.name,
  }

  if (biz.description) schema.description = biz.description
  if (biz.phone) schema.telephone = biz.phone
  if (biz.email) schema.email = biz.email
  if (siteUrl) schema.url = siteUrl
  if (heroImageUrl) schema.image = heroImageUrl

  const address = parseAddress(biz.address)
  if (address) schema.address = address

  const priceRange = defaultPriceRange(category)
  if (priceRange) schema.priceRange = priceRange

  // Restaurant-specific: derive cuisines from user products (Phase 01 mapper
  // already parsed + translated these for Unsplash)
  if (schema['@type'] === 'Restaurant' && biz.products && biz.products.length > 0) {
    schema.servesCuisine = biz.products.slice(0, 6)
  }

  // Health-specific: generic specialty hint
  if (schema['@type'] === 'MedicalClinic') {
    schema.medicalSpecialty = 'General Practice'
  }

  return schema
}

/**
 * Build a FAQPage schema from a list of Q&A pairs (typically from a
 * composer FAQ block's `items` field). Attached only to pages that
 * actually have an FAQ block.
 */
export function buildFaqJsonLd(items: Array<{ question: string; answer: string }>): FaqPageSchema | null {
  if (!items || items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
