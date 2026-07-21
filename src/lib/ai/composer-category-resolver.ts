/**
 * Composer category resolver for fallback path.
 * Maps a free-text prompt to one of 14 composer categories.
 *
 * Separate from `parseIntent()` in generate-blocks.ts — that one only covers 5 buckets
 * and is still used by the legacy path. This resolver covers all 14 composer categories.
 */

export type ComposerCategory =
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
    | 'travel'
    | 'blog'

// Keyword-to-category scoring table. Word-boundary match, case-insensitive.
// VN tokens included where locally relevant.
const COMPOSER_TYPE_KEYWORDS: Record<ComposerCategory, string[]> = {
    restaurant: ['restaurant', 'dining', 'menu', 'chef', 'bistro', 'eatery', 'nhà hàng', 'quán ăn', 'cơm', 'bún', 'phở', 'hải sản', 'quán cơm', 'quán bún', 'quán phở', 'noodle', 'rice'],
    ecommerce:  ['ecommerce', 'shop', 'store', 'product', 'cart', 'checkout', 'retail', 'boutique', 'mua sắm', 'cửa hàng'],
    beauty:     ['beauty', 'spa', 'salon', 'skincare', 'cosmetic', 'nail', 'hair', 'makeup', 'lash', 'thẩm mỹ', 'làm đẹp'],
    tech:       ['saas', 'software', 'app', 'platform', 'startup', 'ai', 'dev', 'cloud', 'api', 'tech', 'công nghệ'],
    health:     ['clinic', 'dental', 'doctor', 'medical', 'hospital', 'pharmacy', 'wellness', 'health', 'phòng khám', 'nha khoa', 'bệnh viện'],
    education:  ['school', 'academy', 'tuition', 'course', 'training', 'kindergarten', 'bootcamp', 'education', 'trung tâm', 'giáo dục'],
    realestate: ['real estate', 'property', 'agent', 'condo', 'apartment', 'listing', 'realty', 'bất động sản', 'nhà đất'],
    fitness:    ['gym', 'fitness', 'yoga', 'pilates', 'crossfit', 'personal trainer', 'workout', 'phòng tập'],
    fnb:        ['cafe', 'café', 'coffee', 'bakery', 'bubble tea', 'kopitiam', 'dessert', 'juice bar', 'tea', 'quán cafe', 'tiệm bánh', 'trà sữa', 'trà', 'boba', 'nước ép', 'nước giải khát', 'giải khát', 'sinh tố', 'trà trái cây', 'milk tea', 'smoothie', 'juice'],
    events:     ['wedding', 'event', 'events', 'party', 'photography', 'venue', 'ceremony', 'planner', 'cưới hỏi', 'sự kiện'],
    travel:     ['travel', 'tour', 'hotel', 'resort', 'homestay', 'agency', 'trip', 'vacation', 'du lịch', 'khách sạn'],
    creative:   ['portfolio', 'photographer', 'designer', 'artist', 'freelance', 'studio', 'illustrator', 'creative'],
    blog:       ['blog', 'article', 'newsletter', 'writer', 'journal', 'publication', 'tạp chí'],
    business:   ['business', 'corporate', 'agency', 'consulting', 'services', 'company', 'doanh nghiệp', 'dịch vụ'],
}

// Deterministic tie-break priority — more specific categories win over generic ones.
const TIE_BREAK_ORDER: ComposerCategory[] = [
    'health', 'realestate', 'fitness', 'beauty', 'education', 'events', 'travel',
    'fnb', 'restaurant', 'tech', 'ecommerce', 'creative', 'blog', 'business',
]

/**
 * Resolve a user prompt to exactly one composer category.
 * Scoring: +1 per keyword hit (word boundary, case-insensitive).
 * Zero matches → `business` (safe sink). Ties → fixed priority order.
 */
/**
 * GH-1185: accept either an already-resolved composer key OR free text.
 * `resolveComposerCategory` is NOT idempotent — e.g. 'fnb' / 'realestate' /
 * 'ecommerce' are not in their own keyword lists and would re-resolve to
 * 'business'. Callers that may receive a resolved key (route passes the
 * resolved pool category through MediaPipelineContext) must use this.
 */
export function normalizeComposerCategory(input: string | undefined): ComposerCategory {
    if (!input) return 'business'
    if (isComposerCategory(input)) return input
    return resolveComposerCategory(input)
}

/**
 * `Object.hasOwn`, not `in` — `in` walks the prototype chain, so an API client
 * posting industry="constructor" (or "toString", "__proto__") would be accepted
 * as a valid category and leak Object.prototype members into downstream lookups.
 */
function isComposerCategory(input: string): input is ComposerCategory {
    return Object.hasOwn(COMPOSER_TYPE_KEYWORDS, input)
}

/**
 * GH-1611: resolve the category of a business whose `industry` comes from the
 * builder form (an authoritative composer key) but may also be free text (URL
 * extraction, API clients).
 *
 * The form's key WINS — it is the user's explicit answer. Only fall back to
 * scoring the surrounding text (business name, products) when `industry` is not
 * a key. Scoring the concatenated text unconditionally is what let a bakery
 * called "Maison Dubois" selling "gateau, macaron" score zero and land on
 * 'business' — the site was fnb everywhere else, so its product grid pulled
 * corporate stock photos while the rest of the page showed cakes.
 */
export function resolveBusinessCategory(
    industry: string | undefined,
    freeText: string,
): ComposerCategory {
    if (industry && isComposerCategory(industry)) return industry
    return resolveComposerCategory(`${industry ?? ''} ${freeText}`.trim())
}

export function resolveComposerCategory(prompt: string): ComposerCategory {
    if (!prompt || typeof prompt !== 'string') return 'business'
    const normalized = prompt.toLowerCase()
    const scores = {} as Record<ComposerCategory, number>

    for (const cat of TIE_BREAK_ORDER) {
        scores[cat] = 0
        for (const kw of COMPOSER_TYPE_KEYWORDS[cat]) {
            // Word boundary match, case-insensitive. Escape keyword for regex.
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i')
            if (re.test(normalized)) scores[cat] += 1
        }
    }

    let best: ComposerCategory = 'business'
    let bestScore = 0
    for (const cat of TIE_BREAK_ORDER) {
        if (scores[cat] > bestScore) {
            best = cat
            bestScore = scores[cat]
        }
    }
    return best
}
