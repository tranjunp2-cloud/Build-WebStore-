import type { ThemePreset } from './theme-presets'
import {
  RESTAURANT_PRESETS,
  ECOMMERCE_PRESETS,
  BEAUTY_PRESETS,
  TECH_PRESETS,
  HEALTH_PRESETS,
  EDUCATION_PRESETS,
  REALESTATE_PRESETS,
  FITNESS_PRESETS,
  CREATIVE_PRESETS,
  BUSINESS_PRESETS,
  FNB_PRESETS,
  EVENTS_PRESETS,
  BLOG_PRESETS,
  TRAVEL_PRESETS,
} from './theme-presets'

// ── New Blueprint Types ────────────────────────────────────────────────────
// Replaces old ComposerInput tier system. All templates are premium.

export interface BlockSpec {
  blockType: string
  variant?: string
  count?: number
  overrides?: Record<string, unknown>
}

export interface PageBlueprint {
  name: string
  slug: string
  isHomepage?: boolean
  blocks: BlockSpec[]
}

export interface TemplatePreset {
  id: string
  name: string
  category: string
  businessIndex: number
  personality: string
  themePreset: ThemePreset
  pages: PageBlueprint[]
  tags: string[]
  description: string
}

// ── Category DNA ───────────────────────────────────────────────────────────
// Each category has unique: signature blocks, visual mood, mandatory blocks

export interface CategoryDna {
  signatureBlocks: string[]
  mandatoryHomepageOrder: string[]
  subPageSet: string[]
  visualMood: string
}

export const CATEGORY_DNA: Record<string, CategoryDna> = {
  restaurant: {
    signatureBlocks: ['menu-display', 'booking-widget', 'gallery'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'menu-display', 'gallery', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Menu', 'Gallery', 'About', 'Contact'],
    visualMood: 'warm',
  },
  ecommerce: {
    signatureBlocks: ['products-grid', 'product-quick-view', 'pricing'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'products-grid', 'features', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Products', 'About', 'Blog', 'Contact'],
    visualMood: 'clean',
  },
  beauty: {
    signatureBlocks: ['gallery-masonry', 'booking-widget', 'before-after'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'gallery-masonry', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Services', 'Gallery', 'About', 'Contact'],
    visualMood: 'pastel',
  },
  tech: {
    signatureBlocks: ['feature-comparison', 'pricing', 'video-showcase', 'stats'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'stats', 'cta', 'pricing', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Features', 'Pricing', 'About', 'Contact'],
    visualMood: 'dark-tech',
  },
  health: {
    signatureBlocks: ['doctor-profile', 'booking-widget', 'stats'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'doctor-profile', 'stats', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Services', 'Team', 'About', 'Contact'],
    visualMood: 'trust',
  },
  education: {
    signatureBlocks: ['class-schedule', 'pricing', 'stats'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'class-schedule', 'stats', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Programs', 'Schedule', 'About', 'Contact'],
    visualMood: 'academic',
  },
  realestate: {
    signatureBlocks: ['property-card', 'gallery-masonry', 'stats'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'property-card', 'stats', 'gallery-masonry', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Properties', 'Gallery', 'About', 'Contact'],
    visualMood: 'luxury',
  },
  fitness: {
    signatureBlocks: ['class-schedule', 'pricing', 'before-after'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'class-schedule', 'before-after', 'cta', 'pricing', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Classes', 'Pricing', 'About', 'Contact'],
    visualMood: 'bold',
  },
  creative: {
    signatureBlocks: ['portfolio-grid', 'gallery-masonry', 'video-showcase'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'portfolio-grid', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Portfolio', 'About', 'Services', 'Contact'],
    visualMood: 'minimal-or-vibrant',
  },
  business: {
    signatureBlocks: ['stats', 'team', 'feature-comparison'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'stats', 'team', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Services', 'About', 'Team', 'Contact'],
    visualMood: 'corporate',
  },
  fnb: {
    signatureBlocks: ['menu-display', 'gallery', 'review-cards'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'menu-display', 'gallery', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Menu', 'About', 'Gallery', 'Contact'],
    visualMood: 'warm-playful',
  },
  events: {
    signatureBlocks: ['countdown-timer', 'booking-widget', 'gallery'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'features', 'gallery', 'countdown-timer', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Services', 'Gallery', 'About', 'Contact'],
    visualMood: 'elegant',
  },
  blog: {
    signatureBlocks: ['blog-list', 'newsletter', 'social-proof'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'blog-list', 'features', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Articles', 'About', 'Categories', 'Contact'],
    visualMood: 'editorial',
  },
  travel: {
    signatureBlocks: ['gallery', 'booking-widget', 'stats'],
    mandatoryHomepageOrder: ['navigation', 'hero', 'logo-cloud', 'gallery', 'features', 'stats', 'cta', 'testimonials', 'faq', 'newsletter', 'footer'],
    subPageSet: ['Destinations', 'Tours', 'About', 'Contact'],
    visualMood: 'tropical',
  },
}

// ── Deprecated: Old ComposerInput (backward compat) ────────────────────────
/** @deprecated Use TemplatePreset + composeFromBlueprint() instead */
export type ComposerInputLegacy = {
  category: string
  businessIndex: number
  variant: 'starter' | 'professional' | 'premium'
  themePreset: ThemePreset
}

// Keep old export name for backward compat until all callers migrated
export const TEMPLATE_DEFINITIONS: ComposerInputLegacy[] = [
  { category: 'restaurant', businessIndex: 0, variant: 'starter', themePreset: RESTAURANT_PRESETS[0]! },
  { category: 'restaurant', businessIndex: 1, variant: 'professional', themePreset: RESTAURANT_PRESETS[1]! },
  { category: 'restaurant', businessIndex: 2, variant: 'professional', themePreset: RESTAURANT_PRESETS[2]! },
  { category: 'restaurant', businessIndex: 3, variant: 'premium', themePreset: RESTAURANT_PRESETS[4]! },
  { category: 'ecommerce', businessIndex: 0, variant: 'starter', themePreset: ECOMMERCE_PRESETS[0]! },
  { category: 'ecommerce', businessIndex: 1, variant: 'professional', themePreset: ECOMMERCE_PRESETS[1]! },
  { category: 'ecommerce', businessIndex: 2, variant: 'professional', themePreset: ECOMMERCE_PRESETS[2]! },
  { category: 'ecommerce', businessIndex: 3, variant: 'premium', themePreset: ECOMMERCE_PRESETS[3]! },
  { category: 'ecommerce', businessIndex: 4, variant: 'premium', themePreset: ECOMMERCE_PRESETS[4]! },
  { category: 'beauty', businessIndex: 0, variant: 'starter', themePreset: BEAUTY_PRESETS[0]! },
  { category: 'beauty', businessIndex: 1, variant: 'professional', themePreset: BEAUTY_PRESETS[1]! },
  { category: 'beauty', businessIndex: 2, variant: 'professional', themePreset: BEAUTY_PRESETS[2]! },
  { category: 'beauty', businessIndex: 3, variant: 'premium', themePreset: BEAUTY_PRESETS[3]! },
  { category: 'tech', businessIndex: 0, variant: 'starter', themePreset: TECH_PRESETS[0]! },
  { category: 'tech', businessIndex: 1, variant: 'professional', themePreset: TECH_PRESETS[1]! },
  { category: 'tech', businessIndex: 2, variant: 'professional', themePreset: TECH_PRESETS[2]! },
  { category: 'tech', businessIndex: 3, variant: 'premium', themePreset: TECH_PRESETS[3]! },
  { category: 'tech', businessIndex: 4, variant: 'premium', themePreset: TECH_PRESETS[4]! },
  { category: 'health', businessIndex: 0, variant: 'starter', themePreset: HEALTH_PRESETS[0]! },
  { category: 'health', businessIndex: 1, variant: 'professional', themePreset: HEALTH_PRESETS[1]! },
  { category: 'health', businessIndex: 2, variant: 'professional', themePreset: HEALTH_PRESETS[2]! },
  { category: 'health', businessIndex: 3, variant: 'premium', themePreset: HEALTH_PRESETS[3]! },
  { category: 'education', businessIndex: 0, variant: 'starter', themePreset: EDUCATION_PRESETS[0]! },
  { category: 'education', businessIndex: 1, variant: 'professional', themePreset: EDUCATION_PRESETS[1]! },
  { category: 'education', businessIndex: 2, variant: 'professional', themePreset: EDUCATION_PRESETS[2]! },
  { category: 'education', businessIndex: 3, variant: 'premium', themePreset: EDUCATION_PRESETS[3]! },
  { category: 'realestate', businessIndex: 0, variant: 'starter', themePreset: REALESTATE_PRESETS[0]! },
  { category: 'realestate', businessIndex: 1, variant: 'professional', themePreset: REALESTATE_PRESETS[1]! },
  { category: 'realestate', businessIndex: 2, variant: 'professional', themePreset: REALESTATE_PRESETS[2]! },
  { category: 'realestate', businessIndex: 3, variant: 'premium', themePreset: REALESTATE_PRESETS[3]! },
  { category: 'fitness', businessIndex: 0, variant: 'starter', themePreset: FITNESS_PRESETS[0]! },
  { category: 'fitness', businessIndex: 1, variant: 'professional', themePreset: FITNESS_PRESETS[1]! },
  { category: 'fitness', businessIndex: 2, variant: 'professional', themePreset: FITNESS_PRESETS[2]! },
  { category: 'fitness', businessIndex: 3, variant: 'premium', themePreset: FITNESS_PRESETS[4]! },
  { category: 'creative', businessIndex: 0, variant: 'starter', themePreset: CREATIVE_PRESETS[0]! },
  { category: 'creative', businessIndex: 1, variant: 'professional', themePreset: CREATIVE_PRESETS[1]! },
  { category: 'creative', businessIndex: 2, variant: 'professional', themePreset: CREATIVE_PRESETS[2]! },
  { category: 'creative', businessIndex: 3, variant: 'premium', themePreset: CREATIVE_PRESETS[3]! },
  { category: 'creative', businessIndex: 4, variant: 'premium', themePreset: CREATIVE_PRESETS[4]! },
  { category: 'business', businessIndex: 0, variant: 'starter', themePreset: BUSINESS_PRESETS[0]! },
  { category: 'business', businessIndex: 1, variant: 'professional', themePreset: BUSINESS_PRESETS[1]! },
  { category: 'business', businessIndex: 2, variant: 'professional', themePreset: BUSINESS_PRESETS[2]! },
  { category: 'business', businessIndex: 3, variant: 'premium', themePreset: BUSINESS_PRESETS[3]! },
  { category: 'business', businessIndex: 4, variant: 'premium', themePreset: BUSINESS_PRESETS[4]! },
  { category: 'fnb', businessIndex: 0, variant: 'starter', themePreset: FNB_PRESETS[0]! },
  { category: 'fnb', businessIndex: 1, variant: 'professional', themePreset: FNB_PRESETS[1]! },
  { category: 'fnb', businessIndex: 2, variant: 'professional', themePreset: FNB_PRESETS[2]! },
  { category: 'fnb', businessIndex: 3, variant: 'premium', themePreset: FNB_PRESETS[4]! },
]

// ── Template Presets (56 blueprints) ───────────────────────────────────────
// 4 per category × 14 categories = 56 templates — ALL premium
import { BATCH1_PRESETS } from './template-presets-batch1'
import { BATCH2_PRESETS } from './template-presets-batch2'
import { BATCH3_PRESETS } from './template-presets-batch3'

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  ...BATCH1_PRESETS,
  ...BATCH2_PRESETS,
  ...BATCH3_PRESETS,
]
