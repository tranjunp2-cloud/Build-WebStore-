import type { CategoryContent } from './types'

const RM_PRICE_REGEX = /RM\s?\d/
const MY_PHONE_REGEX = /^\+60\s?\d[\d\s-]{7,}/
const MY_ADDRESS_KEYWORDS = [
  'Jalan',
  'Lorong',
  'Taman',
  'Persiaran',
  'Lebuh',
  'Kampung',
  'Bukit',
  'Bandar',
  'Desa',
  'Seri',
  'Sri',
  'Plaza',
  'Menara',
  'Wisma',
  'Kompleks',
]
const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /\bTODO\b/,
  /\bXXX\b/,
  /\bTBD\b/,
  /placeholder/i,
]

export function validateCategoryContent(content: CategoryContent): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check minimum counts
  if (content.businesses.length < 4) {
    errors.push(
      `Need at least 4 businesses, got ${content.businesses.length}`
    )
  }
  if (content.testimonials.length < 3) {
    errors.push(
      `Need at least 3 testimonials, got ${content.testimonials.length}`
    )
  }
  if (content.faqItems.length < 3) {
    errors.push(`Need at least 3 FAQ items, got ${content.faqItems.length}`)
  }

  // Check locale
  if (content.locale !== 'en-MY') {
    errors.push(`Locale must be 'en-MY', got '${content.locale}'`)
  }

  // Check businesses
  for (const biz of content.businesses) {
    // Phone format
    if (!MY_PHONE_REGEX.test(biz.phone)) {
      errors.push(
        `Business "${biz.name}" phone must be +60 format, got "${biz.phone}"`
      )
    }

    // Address must contain Malaysian keywords
    const hasMyAddress = MY_ADDRESS_KEYWORDS.some((kw) =>
      biz.address.includes(kw)
    )
    if (!hasMyAddress) {
      errors.push(
        `Business "${biz.name}" address missing Malaysian keywords: "${biz.address}"`
      )
    }

    // Check for placeholder text in all string fields
    const allText = [
      biz.name,
      biz.tagline,
      biz.description,
      biz.heroHeadline,
      biz.heroSubheadline,
    ].join(' ')
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(allText)) {
        errors.push(
          `Business "${biz.name}" contains placeholder text matching ${pattern}`
        )
      }
    }
  }

  // Check testimonials for placeholder text
  for (const t of content.testimonials) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(t.quote)) {
        errors.push(
          `Testimonial by "${t.name}" contains placeholder text matching ${pattern}`
        )
      }
    }
    if (t.rating < 1 || t.rating > 5) {
      errors.push(
        `Testimonial by "${t.name}" rating must be 1-5, got ${t.rating}`
      )
    }
  }

  // Check FAQ for placeholder text
  for (const faq of content.faqItems) {
    const faqText = `${faq.question} ${faq.answer}`
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(faqText)) {
        errors.push(`FAQ "${faq.question}" contains placeholder text`)
      }
    }
  }

  // Spot-check RM pricing in descriptions/headlines
  const allDescriptions = content.businesses
    .map((b) => b.description)
    .join(' ')
  if (allDescriptions.includes('$') && !allDescriptions.includes('RM')) {
    errors.push(
      'Descriptions use $ currency instead of RM — must use Malaysian Ringgit'
    )
  }

  return { valid: errors.length === 0, errors }
}

// Utility: quick check that content has RM prices somewhere
export function hasRMPricing(text: string): boolean {
  return RM_PRICE_REGEX.test(text)
}
