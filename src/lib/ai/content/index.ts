export type {
  BusinessSample,
  TestimonialSample,
  FAQSample,
  IndustryBlockSample,
  CategoryContent,
} from './types'

export { validateCategoryContent, hasRMPricing } from './validator'

export { restaurantContent } from './restaurant'
export { ecommerceContent } from './ecommerce'
export { beautyContent } from './beauty'
export { techContent } from './tech'
export { healthContent } from './health'
export { educationContent } from './education'
export { realestateContent } from './realestate'
export { fitnessContent } from './fitness'
export { creativeContent } from './creative'
export { businessContent } from './business'
export { fnbContent } from './fnb'

import type { CategoryContent } from './types'
import { restaurantContent } from './restaurant'
import { ecommerceContent } from './ecommerce'
import { beautyContent } from './beauty'
import { techContent } from './tech'
import { healthContent } from './health'
import { educationContent } from './education'
import { realestateContent } from './realestate'
import { fitnessContent } from './fitness'
import { creativeContent } from './creative'
import { businessContent } from './business'
import { fnbContent } from './fnb'

export const categoryMap: Record<string, CategoryContent> = {
  restaurant: restaurantContent,
  ecommerce: ecommerceContent,
  beauty: beautyContent,
  tech: techContent,
  health: healthContent,
  education: educationContent,
  realestate: realestateContent,
  fitness: fitnessContent,
  creative: creativeContent,
  business: businessContent,
  fnb: fnbContent,
}

export function getCategoryContent(
  category: string
): CategoryContent | undefined {
  return categoryMap[category]
}

export function getAllCategories(): string[] {
  return Object.keys(categoryMap)
}
