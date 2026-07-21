/**
 * Image keyword derivation — turns (category, blockType, ctx) into Pixabay search keywords.
 *
 * Pure data + functions module. No I/O, no async. Testable in isolation.
 *
 * GH-1185: when raw user keywords exist (ctx.englishKeywords — historical
 * name), they are returned VERBATIM in the user's language. The vi/ms→en
 * dictionaries below only apply on the scaffolding (no-keyword) path.
 */

import { translateProductTerm } from './product-translator'
import type { ThemeMood } from './theme-moods'

export type KeywordLanguage = 'en' | 'ms' | 'vi' | 'auto'

export interface KeywordContext {
    businessName?: string
    industry?: string
    language?: KeywordLanguage
    // Plan 260414-2249 phase-01: top product term drives the primary Unsplash
    // query when present (translated via product-translator for vi/ms input).
    products?: string[]
    // Plan 260414-2249 phase-02: mood appends 1-2 imagery adjectives to the
    // query for coherent visual style (warm/candlelit/minimalist/...).
    mood?: ThemeMood
    // Plan 260424: LLM-translated English keywords to override hardcoded dictionaries
    englishKeywords?: string[]
}

/** Category → 3-5 specific English base terms. Covers all 14 CATEGORY_SIGNATURE_BLOCKS keys. */
export const CATEGORY_BASE_KEYWORDS: Record<string, string[]> = {
    restaurant: ['restaurant interior', 'food plating', 'fine dining', 'asian cuisine'],
    beauty: ['spa treatment', 'wellness retreat', 'skincare clinic', 'beauty salon'],
    tech: ['modern office', 'software team', 'laptop workspace', 'startup'],
    health: ['medical clinic', 'doctor consultation', 'modern hospital', 'healthcare'],
    education: ['classroom modern', 'students learning', 'library study', 'online course'],
    fitness: ['gym workout', 'yoga studio', 'fitness class', 'crossfit'],
    creative: ['design studio', 'creative workspace', 'photography', 'art gallery'],
    business: ['corporate meeting', 'modern office', 'handshake deal', 'professional'],
    fnb: ['coffee shop', 'cafe interior', 'barista art', 'pastry bakery'],
    realestate: ['luxury home interior', 'modern architecture', 'living room', 'apartment view'],
    events: ['event venue', 'wedding ceremony', 'conference stage', 'celebration'],
    blog: ['writing desk', 'journalism', 'magazine layout', 'notebook coffee'],
    travel: ['travel destination', 'landscape scenic', 'tourist explore', 'adventure'],
    ecommerce: ['product photography', 'retail shop', 'shopping bags', 'flatlay'],
}

/** Block type → modifier keywords that refine the query for specific contexts. */
export const BLOCK_MODIFIER_KEYWORDS: Record<string, string[]> = {
    hero: [],
    gallery: ['detail closeup'],
    'portfolio-grid': ['portfolio work sample'],
    about: ['team at work'],
    team: ['professional portrait headshot'],
    testimonials: ['smiling customer portrait'],
    'service-cards': ['service detail'],
    'product-card': ['product flatlay'],
    'before-after': ['transformation result'],
    'property-card': ['luxury home interior', 'real estate modern'],
    'doctor-profile': ['professional portrait headshot'],
    'case-study': ['business project presentation'],
    'event-card': ['event venue celebration'],
    'blog-posts': ['writing desk journalism'],
    stats: ['data chart'],
    features: [],
}

/**
 * Vietnamese → English keyword mapping. Used only for team QA context
 * (prod traffic is EN/MS per validation 2026-04-14 Q2).
 */
export const VN_TO_EN_FALLBACKS: Record<string, string> = {
    'nhà hàng': 'restaurant vietnamese',
    'cà phê': 'cafe coffee',
    'quán ăn': 'eatery vietnamese',
    'spa': 'spa wellness',
    'làm đẹp': 'beauty salon',
    'thẩm mỹ viện': 'beauty clinic',
    'phòng khám': 'medical clinic',
    'bệnh viện': 'hospital modern',
    'nha khoa': 'dental clinic',
    'khóa học': 'online course',
    'trường học': 'school classroom',
    'thiết kế': 'design studio',
    'nhiếp ảnh': 'photography studio',
    'du lịch': 'travel destination',
    'khách sạn': 'hotel interior',
    'bánh': 'pastry bakery',
    'bánh mì': 'banh mi sandwich',
    'phở': 'pho noodle soup',
    'trà sữa': 'bubble tea',
    'bất động sản': 'real estate modern',
    'gym': 'gym fitness',
    'yoga': 'yoga studio',
    'công nghệ': 'modern office tech',
    'phần mềm': 'software team',
    'dịch vụ': 'professional service',
    'cửa hàng': 'retail shop',
    'thời trang': 'fashion retail',
    'sức khỏe': 'wellness health',
    'giáo dục': 'education classroom',
    'sự kiện': 'event venue',
}

/**
 * Malay → English keyword mapping. Primary fallback for Malaysia market.
 */
export const MS_TO_EN_FALLBACKS: Record<string, string> = {
    restoran: 'restaurant asian',
    kedai: 'shop retail',
    'kedai kopi': 'coffee shop cafe',
    kafe: 'cafe interior',
    spa: 'spa wellness',
    salon: 'beauty salon',
    kecantikan: 'beauty clinic',
    klinik: 'medical clinic',
    hospital: 'hospital modern',
    pergigian: 'dental clinic',
    kursus: 'online course',
    sekolah: 'school classroom',
    'reka bentuk': 'design studio',
    fotografi: 'photography studio',
    pelancongan: 'travel destination',
    hotel: 'hotel interior',
    kek: 'pastry bakery',
    roti: 'bakery bread',
    'nasi lemak': 'malaysian food',
    'teh tarik': 'malaysian tea',
    'hartanah': 'real estate modern',
    gim: 'gym fitness',
    yoga: 'yoga studio',
    teknologi: 'modern office tech',
    'perisian': 'software team',
    perkhidmatan: 'professional service',
    'runcit': 'retail shop',
    fesyen: 'fashion retail',
    kesihatan: 'wellness health',
    pendidikan: 'education classroom',
    acara: 'event venue',
}

/** Strip non-ASCII diacritics, lowercase, normalize whitespace. */
function normalizeQuery(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
        .replace(/\s+/g, ' ')
        .trim()
}

/** Word-boundary substring match to avoid `spa` matching `space`. */
function wordMatches(haystack: string, needle: string): boolean {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    return re.test(haystack)
}

/**
 * Translate a non-English industry string to English Unsplash keywords.
 * Checks MS_TO_EN_FALLBACKS first (primary market) then VN_TO_EN_FALLBACKS.
 * If no match and input is pure ASCII, returns input unchanged.
 * Otherwise returns empty string.
 */
export function translateIndustryToEn(raw: string | undefined, language?: KeywordLanguage): string {
    if (!raw) return ''
    const normalized = normalizeQuery(raw)
    const tables: Array<Record<string, string>> =
        language === 'vi'
            ? [VN_TO_EN_FALLBACKS, MS_TO_EN_FALLBACKS]
            : [MS_TO_EN_FALLBACKS, VN_TO_EN_FALLBACKS]
    for (const table of tables) {
        // Iterate longest key first so multi-word entries ("kedai kopi") match
        // before shorter prefixes ("kedai").
        const entries = Object.entries(table).sort((a, b) => b[0].length - a[0].length)
        for (const [foreign, en] of entries) {
            if (wordMatches(normalized, normalizeQuery(foreign))) return en
        }
    }
    // Fallback: if input is plain ASCII, assume English-adjacent
    if (/^[a-zA-Z0-9\s&-]+$/.test(raw)) return raw.trim()
    return ''
}

/** Pick a random element from an array. Deterministic helpers inject Math.random via closure. */
function pickRandom<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined
    return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Derive search keywords for a given (category, blockType, ctx).
 * Returns 1-3 non-empty strings ready for `.join(' ')` into a Pixabay query.
 *
 * GH-1185: Pixabay `q` is AND-matched on tags. When `ctx.englishKeywords` is
 * present (despite the historical name, it now carries RAW user-language
 * keywords), the query is those raw terms ONLY — no block modifier, no mood,
 * no category base. Mixing English scaffolding with raw (possibly Vietnamese)
 * terms guarantees zero results.
 * Scaffolding (category base + modifier + mood) only applies on the
 * no-keyword path, where all terms are English anyway.
 */
export function deriveKeywords(
    category: string,
    blockType: string,
    ctx: KeywordContext = {},
): string[] {
    const baseList = CATEGORY_BASE_KEYWORDS[category] ?? ['modern business']
    const base = pickRandom(baseList) ?? 'modern business'
    const modifiers = BLOCK_MODIFIER_KEYWORDS[blockType] ?? []
    const modifier = pickRandom(modifiers)
    // GH-1611: `industry` may now be a resolved composer KEY, not free text — the
    // route threads the normalized category through MediaPipelineContext. A key is
    // not a searchable word: translateIndustryToEn passes 'fnb'/'realestate'
    // through its ASCII escape hatch, and Pixabay AND-matches `q`, so one junk
    // token zeroed the whole search. The category's own base keywords already
    // carry the industry signal, so drop the boost when it IS the category.
    const industryIsComposerKey = Boolean(ctx.industry && Object.hasOwn(CATEGORY_BASE_KEYWORDS, ctx.industry))
    const industryBoost = industryIsComposerKey
        ? ''
        : translateIndustryToEn(ctx.industry, ctx.language)

    // Raw keyword path — return verbatim, undiluted (GH-1185 AND-match rule).
    if (ctx.englishKeywords && ctx.englishKeywords.length > 0) {
        return ctx.englishKeywords.filter((k) => k && k.trim().length > 0)
    }

    const keywords: string[] = []

    // Product-primary path: user's top product → translated term → primary
    // keyword. Fall back to category base for downstream variety.
    const topProduct = ctx.products && ctx.products.length > 0 ? ctx.products[0] : undefined

    if (topProduct) {
        const productTerm = translateProductTerm(topProduct)
        keywords.push(productTerm)
        if (modifier) keywords.push(modifier)
        if (industryBoost && industryBoost !== productTerm) keywords.push(industryBoost)
        else if (base && base !== productTerm) keywords.push(base)
    } else {
        keywords.push(base)
        if (modifier) keywords.push(modifier)
        if (industryBoost && industryBoost !== base) keywords.push(industryBoost)
    }

    // Plan 260414-2249 phase-02: append top 1-2 mood imagery adjectives.
    // Capped at 5 total terms to keep Pixabay queries specific, not soup.
    // Only reached on the scaffolding (no raw keyword) path — all terms EN.
    if (ctx.mood && ctx.mood.imageryKeywords.length > 0) {
        const MAX_TERMS = 5
        const existing = new Set(keywords.map((k) => k.toLowerCase()))
        for (const adj of ctx.mood.imageryKeywords) {
            if (keywords.length >= MAX_TERMS) break
            if (!existing.has(adj.toLowerCase())) {
                keywords.push(adj)
                existing.add(adj.toLowerCase())
            }
        }
        // Hard cap (defensive)
        if (keywords.length > MAX_TERMS) keywords.length = MAX_TERMS
    }

    return keywords.filter((k) => k && k.length > 0)
}

/**
 * Broaden keywords when initial search returns empty — drops the most specific term.
 */
export function fallbackBroaden(keywords: string[]): string[] {
    if (keywords.length <= 1) return keywords
    return keywords.slice(0, Math.max(1, keywords.length - 1))
}
