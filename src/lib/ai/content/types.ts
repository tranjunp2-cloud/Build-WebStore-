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
}

export type TestimonialSample = {
  name: string
  title?: string
  company?: string
  rating: number
  quote: string
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

export type CategoryContent = {
  category: string
  locale: 'en-MY'
  businesses: BusinessSample[]
  testimonials: TestimonialSample[]
  faqItems: FAQSample[]
  industryBlocks: IndustryBlockSample[]
}
