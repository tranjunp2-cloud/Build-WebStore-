export type TemplateSearchCandidate = {
    name?: string | null
    description?: string | null
    category?: string[] | string | null
    tags?: Array<{ tag?: string | null }> | null
    isFeatured?: boolean | null
    sortOrder?: number | null
}

type TemplateCategory =
    | 'restaurant'
    | 'ecommerce'
    | 'beauty'
    | 'tech'
    | 'health'
    | 'education'
    | 'realestate'
    | 'fitness'
    | 'creative'
    | 'business'
    | 'fnb'
    | 'events'
    | 'blog'
    | 'travel'

export type TemplateSearchLocale = 'en' | 'vi' | 'ms'

const CLOTHING_INTENTS = ['baju', 'pakaian', 'clothing', 'fashion', 'butik', 'boutique', 'quan ao', 'thoi trang']
const CLOTHING_SIGNALS = [...CLOTHING_INTENTS, 'apparel', 'activewear', 'streetwear']

const CATEGORY_INTENTS: Record<TemplateCategory, readonly string[]> = {
    restaurant: ['restaurant', 'restoran', 'nha hang', 'quan an', 'dining', 'makanan'],
    ecommerce: ['shop', 'store', 'kedai', 'kedai baju', 'baju', 'pakaian', 'clothing', 'fashion', 'butik', 'boutique', 'ecommerce', 'e commerce', 'online shop', 'cua hang'],
    beauty: ['beauty', 'spa', 'wellness', 'skincare', 'skin care', 'salon', 'kecantikan', 'lam dep', 'cham soc da'],
    tech: ['tech', 'technology', 'saas', 'software', 'digital', 'teknologi', 'cong nghe'],
    health: ['health', 'clinic', 'dental', 'medical', 'hospital', 'kesihatan', 'nha khoa', 'phong kham', 'suc khoe'],
    education: ['education', 'training', 'course', 'school', 'tuition', 'pendidikan', 'dao tao', 'giao duc'],
    realestate: ['real estate', 'property', 'hartanah', 'bat dong san', 'nha dat'],
    fitness: ['sport', 'sports', 'the thao', 'sukan', 'gym', 'fitness', 'fitnes', 'yoga', 'workout'],
    creative: ['portfolio', 'creative', 'agency', 'freelancer', 'designer', 'kreatif', 'sang tao'],
    business: ['business', 'corporate', 'consulting', 'company', 'cong ty', 'doanh nghiep', 'perniagaan'],
    fnb: ['cafe', 'coffee', 'bakery', 'bakeri', 'pastry', 'roti', 'banh', 'kafe'],
    events: ['event', 'events', 'wedding', 'kahwin', 'su kien', 'dam cuoi'],
    blog: ['blog', 'media', 'magazine', 'news', 'tin tuc'],
    travel: ['travel', 'tourism', 'hotel', 'resort', 'holiday', 'pelancongan', 'du lich'],
}

export function normalizeTemplateSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

const MALAY_LANGUAGE_MARKERS = [
    'kedai', 'baju', 'pakaian', 'restoran', 'sukan', 'kecergasan',
    'hartanah', 'perniagaan', 'pelancongan', 'kecantikan', 'kesihatan',
]

const ENGLISH_LANGUAGE_MARKERS = [
    'shop', 'store', 'sports', 'restaurant', 'fitness', 'business',
    'travel', 'beauty', 'health', 'education', 'property',
]

/**
 * Detect the language of the submitted search rather than assuming that it
 * matches the editor chrome. This keeps Vietnamese AC copy and API metadata
 * correct even when the editor itself is currently displayed in English.
 */
export function detectTemplateSearchLocale(
    rawQuery: string,
    fallback: TemplateSearchLocale,
): TemplateSearchLocale {
    const normalized = normalizeTemplateSearchText(rawQuery)
    const hasMarker = (markers: readonly string[]) => markers.some((marker) => (
        containsPhrase(normalized, marker)
    ))

    // Vietnamese diacritics are the strongest signal and avoid ambiguous
    // short words such as "ban" or "da".
    const decomposed = rawQuery.normalize('NFD')
    if (decomposed.includes('đ') || decomposed.includes('Đ') || /[\u0300-\u036f]/u.test(decomposed)) {
        return 'vi'
    }
    if (hasMarker(MALAY_LANGUAGE_MARKERS)) return 'ms'
    if (hasMarker(ENGLISH_LANGUAGE_MARKERS)) return 'en'
    return fallback
}

function categoriesFor(template: TemplateSearchCandidate): string[] {
    if (Array.isArray(template.category)) return template.category
    return template.category ? [template.category] : []
}

function matchesIntent(query: string, intent: string): boolean {
    const normalizedIntent = normalizeTemplateSearchText(intent)
    return containsPhrase(query, normalizedIntent) || containsPhrase(query, pluralizeEnglish(normalizedIntent))
}

function pluralizeEnglish(value: string): string {
    if (!/^[a-z]+$/.test(value)) return value
    if (/[^aeiou]y$/.test(value)) return `${value.slice(0, -1)}ies`
    if (/(s|x|z|ch|sh)$/.test(value)) return `${value}es`
    return `${value}s`
}

function extractIntents(query: string): TemplateCategory[] {
    return (Object.keys(CATEGORY_INTENTS) as TemplateCategory[]).filter((category) => (
        (category === 'ecommerce' && CLOTHING_INTENTS.some((intent) => matchesIntent(query, intent))) ||
        CATEGORY_INTENTS[category].some((intent) => matchesIntent(query, intent))
    ))
}

/**
 * Returns the category constraint used to narrow the database candidate set.
 * Composite queries keep both the site type and industry so the ranker can
 * distinguish a sports storefront from a fitness-service website.
 */
export function templateSearchCategories(rawQuery: string): TemplateCategory[] {
    return extractIntents(normalizeTemplateSearchText(rawQuery))
}

function tokens(value: string): string[] {
    return value.split(' ').filter((token) => token.length >= 3)
}

function containsPhrase(value: string, phrase: string): boolean {
    return ` ${value} `.includes(` ${phrase} `)
}

function countTokenMatches(query: string, searchable: string): number {
    const searchableTokens = new Set(tokens(searchable))
    return tokens(query).filter((token) => searchableTokens.has(token)).length
}

function hasStrongTextMatch(query: string, searchable: string): boolean {
    const queryTokens = tokens(query)
    return containsPhrase(searchable, query) || (
        queryTokens.length > 0 && queryTokens.every((token) => tokens(searchable).includes(token))
    )
}

/**
 * Scores templates against multilingual business-intent terms. This is deterministic
 * so a chat search remains fast and available without an LLM request per keystroke.
 */
export function searchTemplates<T extends TemplateSearchCandidate>(
    templates: T[],
    rawQuery: string,
    options: { allowSingle?: boolean } = {},
): T[] {
    const query = normalizeTemplateSearchText(rawQuery)
    if (!query) return []

    const intents = extractIntents(query)
    const includesCommerceIntent = intents.includes('ecommerce')
    const requiresClothing = CLOTHING_INTENTS.some((intent) => matchesIntent(query, intent))
    const specificIntents = new Set<TemplateCategory>(
        intents.filter((intent) => intent !== 'ecommerce'),
    )
    const signalsFor = (template: TemplateSearchCandidate) => {
        const categories = categoriesFor(template).map(normalizeTemplateSearchText)
        const searchable = normalizeTemplateSearchText([
            template.name ?? '',
            template.description ?? '',
            categories.join(' '),
            (template.tags ?? []).map((entry) => entry.tag ?? '').join(' '),
        ].join(' '))
        const matchingIntents = intents.filter((intent) => (
            categories.includes(intent) || CATEGORY_INTENTS[intent].some((signal) => (
                matchesIntent(searchable, signal)
            ))
        ))

        return { categories, searchable, matchingIntents }
    }
    const matchesRequiredIntent = ({
        categories,
        matchingIntents,
        searchable,
    }: ReturnType<typeof signalsFor>): boolean => {
        if (intents.length === 0) return true
        if (requiresClothing && (!categories.includes('ecommerce') ||
            !CLOTHING_SIGNALS.some((signal) => matchesIntent(searchable, signal)))) return false

        // A query shaped as "shop + industry" describes a storefront selling
        // that industry's products. Require both the storefront category and
        // a specific category/text/tag signal: generic shops and gym-only sites
        // are not relevant answers to a sports-retail query.
        if (includesCommerceIntent && specificIntents.size > 0) {
            return categories.includes('ecommerce') && matchingIntents.some((intent) => (
                specificIntents.has(intent)
            ))
        }

        return intents.some((intent) => categories.includes(intent))
    }

    const ranked = templates
        .map((template, index) => {
            const signals = signalsFor(template)
            const { matchingIntents, searchable } = signals
            const strongTextMatch = hasStrongTextMatch(query, searchable)

            // Composite commerce queries require both the requested site type and
            // industry. This excludes generic shops and gym/yoga service sites.
            if (!matchesRequiredIntent(signals)) {
                return { template, index, score: 0 }
            }

            // With no recognised intent, only an exact phrase or all meaningful words may
            // match. Substring matches (for example "gia" in "digital") are not enough.
            if (intents.length === 0 && !strongTextMatch) {
                return { template, index, score: 0 }
            }

            let score = matchingIntents.length * 100
            if (includesCommerceIntent && matchingIntents.some((intent) => specificIntents.has(intent))) {
                // Templates tagged with both the storefront type and product
                // industry stay ahead of generic ecommerce fallbacks.
                score += 50
            }
            if (strongTextMatch) score += 80
            score += countTokenMatches(query, searchable) * 8

            return { template, index, score }
        })
        .filter(({ score }) => score > 0)
        .sort((left, right) => (
            right.score - left.score ||
            Number(Boolean(right.template.isFeatured)) - Number(Boolean(left.template.isFeatured)) ||
            (left.template.sortOrder ?? 0) - (right.template.sortOrder ?? 0) ||
            left.index - right.index
        ))

    if (ranked.length !== 1 || options.allowSingle) {
        return ranked.map(({ template }) => template)
    }

    if (templates.length < 2) return []

    // An exact-name query can produce a single strong match even when the
    // inventory contains another useful design in the same industry. Preserve
    // the exact result first, then add one deterministic category peer so a
    // successful search satisfies the gallery's minimum-two result contract.
    const primary = ranked[0]
    const primaryCategories = new Set(categoriesFor(primary.template).map(normalizeTemplateSearchText))
    const fallback = templates
        .map((template, index) => ({ template, index }))
        .filter(({ index, template }) => (
            index !== primary.index &&
            (
                intents.length > 0
                    ? matchesRequiredIntent(signalsFor(template))
                    : categoriesFor(template).some((category) => primaryCategories.has(normalizeTemplateSearchText(category)))
            )
        ))
        .sort((left, right) => (
            Number(Boolean(right.template.isFeatured)) - Number(Boolean(left.template.isFeatured)) ||
            (left.template.sortOrder ?? 0) - (right.template.sortOrder ?? 0) ||
            left.index - right.index
        ))[0]

    // The story contract requires every non-empty result set to contain at
    // least two relevant templates. If inventory has no relevant peer, report
    // no match instead of fabricating an unrelated suggestion or returning a
    // contract-breaking singleton.
    return fallback ? [primary.template, fallback.template] : []
}
