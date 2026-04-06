import type { ComposerInput } from './template-composer'
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
} from './theme-presets'

// ── Template Definitions — ~50 templates across 11 categories ───────────────
// Distribution: starter (11) + professional (22) + premium (15) = 48 total
//
// Each category gets: 1 starter, 2 professional, 1-2 premium
// Business index selects which business sample to use from the content file

export const TEMPLATE_DEFINITIONS: ComposerInput[] = [
  // ── Restaurant (4) ────────────────────────────────────────────────────────
  { category: 'restaurant', businessIndex: 0, variant: 'starter', themePreset: RESTAURANT_PRESETS[0]! },
  { category: 'restaurant', businessIndex: 1, variant: 'professional', themePreset: RESTAURANT_PRESETS[1]! },
  { category: 'restaurant', businessIndex: 2, variant: 'professional', themePreset: RESTAURANT_PRESETS[2]! },
  { category: 'restaurant', businessIndex: 3, variant: 'premium', themePreset: RESTAURANT_PRESETS[4]! },

  // ── E-commerce (5) ────────────────────────────────────────────────────────
  { category: 'ecommerce', businessIndex: 0, variant: 'starter', themePreset: ECOMMERCE_PRESETS[0]! },
  { category: 'ecommerce', businessIndex: 1, variant: 'professional', themePreset: ECOMMERCE_PRESETS[1]! },
  { category: 'ecommerce', businessIndex: 2, variant: 'professional', themePreset: ECOMMERCE_PRESETS[2]! },
  { category: 'ecommerce', businessIndex: 3, variant: 'premium', themePreset: ECOMMERCE_PRESETS[3]! },
  { category: 'ecommerce', businessIndex: 4, variant: 'premium', themePreset: ECOMMERCE_PRESETS[4]! },

  // ── Beauty (4) ────────────────────────────────────────────────────────────
  { category: 'beauty', businessIndex: 0, variant: 'starter', themePreset: BEAUTY_PRESETS[0]! },
  { category: 'beauty', businessIndex: 1, variant: 'professional', themePreset: BEAUTY_PRESETS[1]! },
  { category: 'beauty', businessIndex: 2, variant: 'professional', themePreset: BEAUTY_PRESETS[2]! },
  { category: 'beauty', businessIndex: 3, variant: 'premium', themePreset: BEAUTY_PRESETS[3]! },

  // ── Tech (5) ──────────────────────────────────────────────────────────────
  { category: 'tech', businessIndex: 0, variant: 'starter', themePreset: TECH_PRESETS[0]! },
  { category: 'tech', businessIndex: 1, variant: 'professional', themePreset: TECH_PRESETS[1]! },
  { category: 'tech', businessIndex: 2, variant: 'professional', themePreset: TECH_PRESETS[2]! },
  { category: 'tech', businessIndex: 3, variant: 'premium', themePreset: TECH_PRESETS[3]! },
  { category: 'tech', businessIndex: 4, variant: 'premium', themePreset: TECH_PRESETS[4]! },

  // ── Health (4) ────────────────────────────────────────────────────────────
  { category: 'health', businessIndex: 0, variant: 'starter', themePreset: HEALTH_PRESETS[0]! },
  { category: 'health', businessIndex: 1, variant: 'professional', themePreset: HEALTH_PRESETS[1]! },
  { category: 'health', businessIndex: 2, variant: 'professional', themePreset: HEALTH_PRESETS[2]! },
  { category: 'health', businessIndex: 3, variant: 'premium', themePreset: HEALTH_PRESETS[3]! },

  // ── Education (4) ─────────────────────────────────────────────────────────
  { category: 'education', businessIndex: 0, variant: 'starter', themePreset: EDUCATION_PRESETS[0]! },
  { category: 'education', businessIndex: 1, variant: 'professional', themePreset: EDUCATION_PRESETS[1]! },
  { category: 'education', businessIndex: 2, variant: 'professional', themePreset: EDUCATION_PRESETS[2]! },
  { category: 'education', businessIndex: 3, variant: 'premium', themePreset: EDUCATION_PRESETS[3]! },

  // ── Real Estate (4) ───────────────────────────────────────────────────────
  { category: 'realestate', businessIndex: 0, variant: 'starter', themePreset: REALESTATE_PRESETS[0]! },
  { category: 'realestate', businessIndex: 1, variant: 'professional', themePreset: REALESTATE_PRESETS[1]! },
  { category: 'realestate', businessIndex: 2, variant: 'professional', themePreset: REALESTATE_PRESETS[2]! },
  { category: 'realestate', businessIndex: 3, variant: 'premium', themePreset: REALESTATE_PRESETS[3]! },

  // ── Fitness (4) ───────────────────────────────────────────────────────────
  { category: 'fitness', businessIndex: 0, variant: 'starter', themePreset: FITNESS_PRESETS[0]! },
  { category: 'fitness', businessIndex: 1, variant: 'professional', themePreset: FITNESS_PRESETS[1]! },
  { category: 'fitness', businessIndex: 2, variant: 'professional', themePreset: FITNESS_PRESETS[2]! },
  { category: 'fitness', businessIndex: 3, variant: 'premium', themePreset: FITNESS_PRESETS[4]! },

  // ── Creative (5) ──────────────────────────────────────────────────────────
  { category: 'creative', businessIndex: 0, variant: 'starter', themePreset: CREATIVE_PRESETS[0]! },
  { category: 'creative', businessIndex: 1, variant: 'professional', themePreset: CREATIVE_PRESETS[1]! },
  { category: 'creative', businessIndex: 2, variant: 'professional', themePreset: CREATIVE_PRESETS[2]! },
  { category: 'creative', businessIndex: 3, variant: 'premium', themePreset: CREATIVE_PRESETS[3]! },
  { category: 'creative', businessIndex: 4, variant: 'premium', themePreset: CREATIVE_PRESETS[4]! },

  // ── Business (5) ──────────────────────────────────────────────────────────
  { category: 'business', businessIndex: 0, variant: 'starter', themePreset: BUSINESS_PRESETS[0]! },
  { category: 'business', businessIndex: 1, variant: 'professional', themePreset: BUSINESS_PRESETS[1]! },
  { category: 'business', businessIndex: 2, variant: 'professional', themePreset: BUSINESS_PRESETS[2]! },
  { category: 'business', businessIndex: 3, variant: 'premium', themePreset: BUSINESS_PRESETS[3]! },
  { category: 'business', businessIndex: 4, variant: 'premium', themePreset: BUSINESS_PRESETS[4]! },

  // ── F&B (4) ───────────────────────────────────────────────────────────────
  { category: 'fnb', businessIndex: 0, variant: 'starter', themePreset: FNB_PRESETS[0]! },
  { category: 'fnb', businessIndex: 1, variant: 'professional', themePreset: FNB_PRESETS[1]! },
  { category: 'fnb', businessIndex: 2, variant: 'professional', themePreset: FNB_PRESETS[2]! },
  { category: 'fnb', businessIndex: 3, variant: 'premium', themePreset: FNB_PRESETS[4]! },
]
