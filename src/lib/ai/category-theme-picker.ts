/**
 * Category theme picker — deterministic preset selection from the 14×5
 * curated library in `theme-presets.ts`.
 *
 * Same `(category, seed)` always returns the same preset so regenerating
 * for the same business yields a stable theme, while different businesses
 * within the same category rotate through the 5 variants.
 *
 * Consumed by:
 *   - openai-generator.ts (happy path) to override AI theme output
 *   - system-prompt.ts     to inject exact hex values as soft guidance
 *   - fallback-adapter.ts  (optional) for composer consistency
 */

import {
    CATEGORY_PRESETS,
    BUSINESS_PRESETS,
    type ThemePreset,
} from './theme-presets'
import { THEME_MOODS, type ThemeMood } from './theme-moods'

export type { ThemePreset } from './theme-presets'
export type { ThemeMood } from './theme-moods'

/**
 * Composite theme — preset + resolved mood record. Single object passed
 * downstream to system-prompt, media pipeline, and composer CTAs.
 *
 * Plan 260414-2249 phase-02: mood bundles imagery/voice/CTA properties that
 * must stay synchronized across all three consumers (GPT prompt, Unsplash
 * keywords, composer block builders).
 */
export interface CategoryTheme {
    preset: ThemePreset
    mood: ThemeMood
}

/**
 * Canonicalize a raw category string to the key used by CATEGORY_PRESETS.
 * Handles common drift: `real-estate`, `Real Estate`, `REAL_ESTATE` → `realestate`.
 */
export function canonicalizeCategory(raw: string | undefined | null): string {
    if (!raw) return 'business'
    return raw
        .toLowerCase()
        .replace(/[\s_-]+/g, '')
        .trim()
}

/**
 * Pick a deterministic preset from the category's 5 variants.
 *
 * @param category - category key (e.g. "restaurant", "tech"); unknown → business fallback
 * @param seed     - any number; typically `hashBusinessName(name)` for per-business stability
 * @returns        - a ThemePreset with primary/secondary/accent colors + fontPairingId + mode + spacing + radius + shadow + moodId
 *
 * Legacy signature — returns preset only. New code should call `pickCategoryThemeWithMood`.
 */
export function pickCategoryTheme(category: string, seed: number): ThemePreset {
    const key = canonicalizeCategory(category)
    const presets = CATEGORY_PRESETS[key] ?? BUSINESS_PRESETS
    if (presets.length === 0) return BUSINESS_PRESETS[0]!
    const index = Math.abs(Math.floor(seed)) % presets.length
    return presets[index]!
}

/**
 * Pick a deterministic preset AND resolve its associated ThemeMood.
 *
 * Plan 260414-2249 phase-02: preferred entry point for downstream consumers
 * that need voice/imagery/CTA data. Same determinism as `pickCategoryTheme`
 * — same `(category, seed)` returns the same composite.
 */
export function pickCategoryThemeWithMood(category: string, seed: number): CategoryTheme {
    const preset = pickCategoryTheme(category, seed)
    const mood = THEME_MOODS[preset.moodId]
    if (!mood) {
        throw new Error(`[category-theme-picker] Preset "${preset.name}" has unknown moodId "${preset.moodId}"`)
    }
    return { preset, mood }
}

/**
 * Get all preset variants for a category (for system prompt hints or editor UI).
 * Falls back to business presets if category unknown.
 */
export function getCategoryThemeOptions(category: string): ThemePreset[] {
    const key = canonicalizeCategory(category)
    return CATEGORY_PRESETS[key] ?? BUSINESS_PRESETS
}

/**
 * Deterministic 32-bit hash of a business name.
 * djb2 variant — simple, stable across runtimes, no crypto dependency.
 * Used as seed for pickCategoryTheme so same business always picks same preset.
 */
export function hashBusinessName(name: string): number {
    let hash = 5381
    const str = (name || '').trim().toLowerCase()
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}
