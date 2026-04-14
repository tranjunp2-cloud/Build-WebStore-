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

export type { ThemePreset } from './theme-presets'

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
 * @returns        - a ThemePreset with primary/secondary/accent colors + fontPairingId + mode + spacing + radius + shadow
 */
export function pickCategoryTheme(category: string, seed: number): ThemePreset {
    const key = canonicalizeCategory(category)
    const presets = CATEGORY_PRESETS[key] ?? BUSINESS_PRESETS
    if (presets.length === 0) return BUSINESS_PRESETS[0]!
    const index = Math.abs(Math.floor(seed)) % presets.length
    return presets[index]!
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
