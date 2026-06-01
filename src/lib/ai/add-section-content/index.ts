/**
 * Locale-aware content resolver for block defaults.
 * Resolves localizable strings for a given block type + locale.
 * Falls back to EN when BM content is absent (AC-3).
 */
import type { AddSectionLocale } from '../add-section'
import { BLOCK_CONTENT_EN } from './en'
import { BLOCK_CONTENT_MS } from './ms'

export type { AddSectionLocale }

/** Opaque bag of localizable string fields for a block. */
export type BlockContent = Record<string, unknown>

type ContentMap = Record<string, BlockContent>

const MAPS: Record<AddSectionLocale, ContentMap> = {
    en: BLOCK_CONTENT_EN as unknown as ContentMap,
    ms: BLOCK_CONTENT_MS as unknown as ContentMap,
}

export interface ResolvedContent {
    content: BlockContent
    localeUsed: AddSectionLocale
    /** true when `ms` was requested but only `en` content is available */
    needsTranslation: boolean
}

/**
 * Apply brand interpolation to translated content returned from the translate API.
 * The API caches content with `{brand}` tokens intact — callers apply this after retrieval.
 */
export function interpolateBrand(obj: BlockContent, brand: string): BlockContent {
    return deepReplace(obj, brand) as BlockContent
}

/**
 * Resolve default content strings for `blockType` in `locale`.
 * Always returns a valid object — never throws.
 */
export function resolveBlockContent(
    blockType: string,
    locale: AddSectionLocale,
    brand: string,
): ResolvedContent {
    const localeMap = MAPS[locale]
    const localeContent = localeMap?.[blockType]

    if (localeContent) {
        return {
            content: interpolate(localeContent, brand),
            localeUsed: locale,
            needsTranslation: false,
        }
    }

    // Fallback to EN
    const enContent = BLOCK_CONTENT_EN[blockType as keyof typeof BLOCK_CONTENT_EN]
    return {
        content: interpolate((enContent ?? {}) as BlockContent, brand),
        localeUsed: 'en',
        needsTranslation: locale !== 'en',
    }
}

/** Whether a specific locale has authored content for a block type. */
export function hasLocaleContent(blockType: string, locale: AddSectionLocale): boolean {
    return Boolean(MAPS[locale]?.[blockType])
}

/**
 * Coverage map for US-F26-06 audit: which blocks have en/ms content authored.
 */
export function getLocaleCoverage(): Record<string, { en: boolean; ms: boolean }> {
    const allKeys = new Set([
        ...Object.keys(BLOCK_CONTENT_EN),
        ...Object.keys(BLOCK_CONTENT_MS),
    ])
    const result: Record<string, { en: boolean; ms: boolean }> = {}
    for (const key of allKeys) {
        result[key] = {
            en: hasLocaleContent(key, 'en'),
            ms: hasLocaleContent(key, 'ms'),
        }
    }
    return result
}

// ── Internals ──────────────────────────────────────────────────────────────

/**
 * Deep-walk `obj` and replace every `{brand}` token in string leaves.
 * Arrays and plain objects are walked recursively. Other types passed through.
 */
function interpolate(obj: BlockContent, brand: string): BlockContent {
    return deepReplace(obj, brand) as BlockContent
}

function deepReplace(value: unknown, brand: string): unknown {
    if (typeof value === 'string') {
        return value.replace(/\{brand\}/g, () => brand)
    }
    if (Array.isArray(value)) {
        return value.map(item => deepReplace(item, brand))
    }
    if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            result[k] = deepReplace(v, brand)
        }
        return result
    }
    return value
}
