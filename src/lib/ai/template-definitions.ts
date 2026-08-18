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

// ── Category DNA — DELETED (Plan 2253 audit-unused-code) ───────────────────
// Removed: `CategoryDna` interface + `CATEGORY_DNA` record. 0 code consumers
// found in repo scan; only stale comment references in test-harness and PRD
// docs. Superseded by:
//   - plan 2249 phase-02 `ThemeMood` (imagery/voice mood archetypes)
//   - plan 2249 phase-04 `CategoryRecipe` (block sequences + required blocks)
//   - `category-requirements.ts` (minBlocks + mandatory/recommended)

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

// buildGallery currently materializes six image slots for every gallery block.
// Pool planning uses this same value instead of assuming every page has one.
export const TEMPLATE_GALLERY_IMAGE_COUNT = 6

export function selectTemplatePreset(
  category: string,
  seed: number,
): TemplatePreset | undefined {
  const candidates = TEMPLATE_PRESETS.filter((preset) => preset.category === category)
  if (candidates.length === 0) return undefined
  return candidates[Math.abs(Math.floor(seed)) % candidates.length]
}

export interface TemplateGalleryDemand {
  presetId: string
  blockCount: number
  imageCount: number
}

export function getTemplateGalleryDemand(
  category: string,
  seed: number,
): TemplateGalleryDemand | null {
  const preset = selectTemplatePreset(category, seed)
  if (!preset) return null

  const blockCount = preset.pages.reduce(
    (total, page) =>
      total + page.blocks.filter((block) => block.blockType === 'gallery').length,
    0,
  )

  return {
    presetId: preset.id,
    blockCount,
    imageCount: blockCount * TEMPLATE_GALLERY_IMAGE_COUNT,
  }
}
