/**
 * Pixabay HTTP client — pure wrapper, no Payload, no AI.
 *
 * Replaces the former Unsplash search client. Pixabay free tier allows ~100
 * req/60s (≈6000/hr) vs Unsplash demo 50/hr, so rate-limit fallbacks are rare.
 *
 * Usage:
 *   const photos = await searchPhotos('spa wellness', 10, { orientation: 'landscape', width: 1600 })
 *   for (const p of photos) {
 *     const { buffer, mimetype } = await downloadPhotoBuffer(p.url)  // p.url is pre-sized
 *   }
 *
 * Server-only. Do NOT import from client components.
 *
 * Auth: `key` query param (NOT a header). License: Pixabay Content License
 * (commercial OK, no attribution required, no download-tracking endpoint).
 * Pixabay ships FIXED sizes — no Imgix/query-param resize. `webformatURL` ~640px,
 * `largeImageURL` ~1280px. `fullHDURL`/original need full-API-access approval.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import {
    getProcessPixabayKeyRing,
    parsePixabayKeys,
    resetProcessPixabayKeyRingForTests,
    type SelectedPixabayKey,
} from '@/lib/ai/image-sourcing/key-ring'
import { FetchGuardError, fetchAllowlisted, readBodyCapped } from '@/lib/ai/fetch-capped'

export type PixabayOrientation = 'landscape' | 'portrait' | 'squarish'

/** Normalized photo — `url` is already sized by the client (no Imgix on Pixabay). */
export interface PixabayPhoto {
    id: string
    /** Ready-to-download URL, already sized. Pass straight to downloadPhotoBuffer. */
    url: string
    /** Comma-separated tags — used as alt-text source (pre-sanitize). */
    alt: string | null
    /** Uploader display name. */
    photographer: string
    width: number
    height: number
}

export interface PixabaySearchOptions {
    orientation?: PixabayOrientation
    /** Target render width — client picks largeImageURL (≥900) or webformatURL. */
    width?: number
    /** Per-request deadline for latency-sensitive callers. */
    timeoutMs?: number
    page?: number
    /**
     * GH-1185: Pixabay category slug (uploader-assigned, fixed vocabulary:
     * food, health, sports, buildings, …). Acts as an AND filter — does not
     * improve exact-keyword matching, but keeps the loose/fallback tiers
     * on-domain: q="phở bò" without it returns dairy cows and street
     * merchants; with category=food the misses are at least food photos.
     * Map from composer category via PIXABAY_CATEGORY_BY_COMPOSER.
     */
    category?: string
    /**
     * Explicit `lang` override for curated queries whose language is KNOWN
     * but not script-detectable — e.g. VN_CATEGORY_QUERIES.fnb "quán cà phê"
     * carries only ambiguous diacritics (á/à/ê excluded from detection so
     * "café" doesn't misroute), so detectQueryLang returns undefined and the
     * search would go out with Pixabay's default lang=en (diacritic-strip
     * partial matching — the exact GH-1185 failure mode). Takes precedence
     * over detectQueryLang.
     */
    lang?: PixabayQueryLang
}

/**
 * Composer category → Pixabay category slug. Only unambiguous mappings —
 * events/creative/ecommerce/blog have no clean Pixabay equivalent and are
 * deliberately absent (no filter beats a wrong filter).
 * Pixabay's fixed list: backgrounds, fashion, nature, science, education,
 * feelings, health, people, religion, places, animals, industry, computer,
 * food, sports, transportation, travel, buildings, business, music.
 */
export const PIXABAY_CATEGORY_BY_COMPOSER: Readonly<Record<string, string>> = {
    restaurant: 'food',
    fnb: 'food',
    beauty: 'health',
    health: 'health',
    fitness: 'sports',
    education: 'education',
    tech: 'computer',
    business: 'business',
    realestate: 'buildings',
    travel: 'travel',
}

export interface DownloadResult {
    buffer: Buffer
    mimetype: string
    size: number
}

/** Raw Pixabay API hit (subset we read). */
interface PixabayHit {
    id: number
    webformatURL: string
    largeImageURL: string
    tags: string
    user: string
    imageWidth: number
    imageHeight: number
}

interface PixabaySearchResponse {
    total: number
    totalHits: number
    hits: PixabayHit[]
}

/**
 * Discriminated error class — SAME 9-member code union as the former
 * UnsplashError, so existing `err.code === 'RATE_LIMITED'` branches keep working.
 */
export class PixabayError extends Error {
    constructor(
        public readonly code:
            | 'NO_KEY'
            | 'UNAUTHORIZED'
            | 'RATE_LIMITED'
            | 'SERVER_ERROR'
            | 'DOWNLOAD_FAIL'
            | 'TOO_LARGE'
            | 'TIMEOUT'
            | 'SSRF_BLOCKED'
            | 'EMPTY_RESULTS',
        public readonly status: number,
        public readonly retryable: boolean,
        message?: string,
    ) {
        super(message ?? `[Pixabay] ${code} (status=${status})`)
        this.name = 'PixabayError'
    }
}

const BASE = 'https://pixabay.com/api/'
// SSRF allowlist: Pixabay hit/CDN hosts + the static curated Unsplash fallback
// hosts (hero / blog / product fallbacks still hotlink images.unsplash.com and
// download through this same guard). Dropping the Unsplash hosts breaks them.
const DOWNLOAD_HOST_ALLOWLIST = [
    'pixabay.com',
    'cdn.pixabay.com',
    'images.unsplash.com',
    'plus.unsplash.com',
]
const SEARCH_TIMEOUT_MS = 5_000
const DOWNLOAD_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BYTES = 10_000_000 // 10 MB
const RATE_LIMIT_WARN_THRESHOLD = 20
const LARGE_SIZE_MIN_WIDTH = 700 // ≥ this → largeImageURL (1280px), else webformatURL (640px)

export interface PixabaySearchBudget {
    readonly limit: number
    readonly requestId?: string
    used: number
    skipped: number
    exhaustedLogged: boolean
    searchResultPixabayUrls: Set<string>
    downloadedPixabayUrls: Set<string>
    uploadedPixabayUrls: Set<string>
    mediaSourceUrls: Map<number, string>
    usedPixabayUrls: Set<string>
    downloadedPixabayCount: number
    uploadedPixabayCount: number
    assignedPixabaySlots: number
    rateLimited: boolean
    providerErrorCodes: Set<PixabayError['code']>
}

const searchBudgetStorage = new AsyncLocalStorage<PixabaySearchBudget>()

/**
 * Creates a generation-scoped search budget. The mutable counter is retained
 * by deferred blog and image-library work from the same generation.
 */
export function createPixabaySearchBudget(
    limit: number,
    requestId?: string,
): PixabaySearchBudget {
    return {
        limit: Math.max(0, Math.floor(limit)),
        ...(requestId ? { requestId } : {}),
        used: 0,
        skipped: 0,
        exhaustedLogged: false,
        searchResultPixabayUrls: new Set(),
        downloadedPixabayUrls: new Set(),
        uploadedPixabayUrls: new Set(),
        mediaSourceUrls: new Map(),
        usedPixabayUrls: new Set(),
        downloadedPixabayCount: 0,
        uploadedPixabayCount: 0,
        assignedPixabaySlots: 0,
        rateLimited: false,
        providerErrorCodes: new Set(),
    }
}

/** Runs work inside an isolated budget, so concurrent users never share it. */
export function withPixabaySearchBudget<T>(
    budget: PixabaySearchBudget,
    work: () => T,
): T {
    return searchBudgetStorage.run(budget, work)
}

function claimSearchRequest(): boolean {
    const budget = searchBudgetStorage.getStore()
    if (!budget) return true
    if (budget.used < budget.limit) {
        budget.used += 1
        return true
    }
    budget.skipped += 1
    if (!budget.exhaustedLogged) {
        budget.exhaustedLogged = true
        console.info(
            `[Pixabay] generation search budget exhausted (${budget.used}/${budget.limit}); using existing fallbacks`,
        )
    }
    return false
}

function hasSearchBudget(): boolean {
    return searchBudgetStorage.getStore() !== undefined
}

function isPixabayUrl(url: string): boolean {
    try {
        const hostname = new URL(url).hostname
        return hostname === 'pixabay.com' || hostname === 'cdn.pixabay.com'
    } catch {
        return false
    }
}

/** Associates an uploaded Media row with its original Pixabay URL. */
export function registerPixabayMediaSource(mediaId: number, sourceUrl: string): void {
    if (!isPixabayUrl(sourceUrl)) return
    const budget = searchBudgetStorage.getStore()
    if (!budget) return
    budget.mediaSourceUrls.set(mediaId, sourceUrl)
    budget.uploadedPixabayCount += 1
    budget.uploadedPixabayUrls.add(sourceUrl)
}

/** Marks Media IDs that were actually assigned to generated content. */
export function markPixabayMediaUsed(mediaIds: readonly number[]): void {
    const budget = searchBudgetStorage.getStore()
    if (!budget) return
    for (const mediaId of mediaIds) {
        const sourceUrl = budget.mediaSourceUrls.get(mediaId)
        if (!sourceUrl) continue
        budget.assignedPixabaySlots += 1
        if (budget.usedPixabayUrls.has(sourceUrl)) continue
        budget.usedPixabayUrls.add(sourceUrl)
    }
}

/** Marks Pixabay URLs assigned directly to text/JSON image fields. */
export function markPixabayUrlsUsed(urls: readonly string[]): void {
    const budget = searchBudgetStorage.getStore()
    if (!budget) return
    for (const sourceUrl of urls) {
        if (!isPixabayUrl(sourceUrl)) continue
        budget.assignedPixabaySlots += 1
        if (budget.usedPixabayUrls.has(sourceUrl)) continue
        budget.usedPixabayUrls.add(sourceUrl)
    }
}

function recordProviderError(error: PixabayError): void {
    const budget = searchBudgetStorage.getStore()
    if (!budget) return
    budget.providerErrorCodes.add(error.code)
    if (error.code === 'RATE_LIMITED') budget.rateLimited = true
}

/** Test isolation for the process-wide key ring. */
export function __resetPixabayCircuitForTests(): void {
    resetProcessPixabayKeyRingForTests()
}

/** Recommended orientation per block type — used by media-pipeline callers. */
export const PIXABAY_ORIENTATION_BY_BLOCK: Record<string, PixabayOrientation> = {
    hero: 'landscape',
    gallery: 'landscape',
    about: 'landscape',
    'portfolio-grid': 'portrait',
    team: 'squarish',
    testimonials: 'squarish',
    'logo-cloud': 'squarish',
}

const ORIENTATION_MAP: Record<PixabayOrientation, string> = {
    landscape: 'horizontal',
    portrait: 'vertical',
    squarish: 'all',
}

function getConfiguredPixabayKeys(): string[] {
    return parsePixabayKeys(process.env.PIXABAY_API_KEYS, process.env.PIXABAY_API_KEY)
}

export function hasPixabayKey(): boolean {
    return getConfiguredPixabayKeys().length > 0
}

function selectPixabayKey(): SelectedPixabayKey {
    const keyRing = getProcessPixabayKeyRing()
    const selected = keyRing.select()
    if (selected) return selected

    const unavailableReason = keyRing.getUnavailableReason()
    let error: PixabayError
    if (unavailableReason === 'no_key') {
        error = new PixabayError(
            'NO_KEY',
            0,
            false,
            'PIXABAY_API_KEYS/PIXABAY_API_KEY not set or invalid',
        )
    } else if (unavailableReason === 'auth') {
        error = new PixabayError(
            'UNAUTHORIZED',
            401,
            false,
            '[Pixabay] all configured API keys are unauthorized',
        )
    } else if (unavailableReason === 'server') {
        error = new PixabayError(
            'SERVER_ERROR',
            503,
            false,
            '[Pixabay] all configured API keys are cooling down after provider errors',
        )
    } else {
        error = new PixabayError(
            'RATE_LIMITED',
            429,
            false,
            '[Pixabay] all configured API keys are cooling down after rate limits',
        )
    }
    recordProviderError(error)
    throw error
}

// Log the "no key" warning ONCE per process so we don't spam the dev console.
let pixabayKeyWarningLogged = false
function warnNoKeyOnce(): void {
    if (pixabayKeyWarningLogged) return
    pixabayKeyWarningLogged = true
    console.warn(
        '[Pixabay] PIXABAY_API_KEYS/PIXABAY_API_KEY not set — image pipeline will skip pool + per-block searches. ' +
            'Set the keys in .env.local to enable stock photography (copy from Vercel Dashboard staging env).',
    )
}

function logRateLimit(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining')
    if (remaining != null) {
        const n = Number(remaining)
        if (Number.isFinite(n) && n < RATE_LIMIT_WARN_THRESHOLD) {
            console.warn(`[Pixabay] rate limit low: ${n} requests remaining`)
        }
    }
}

async function fetchWithRetry(
    url: string,
    init?: RequestInit,
    maxRetries: number = 1,
    selectedKey?: SelectedPixabayKey,
): Promise<Response> {
    const keyRing = selectedKey ? getProcessPixabayKeyRing() : null
    let attempt = 0
    while (attempt <= maxRetries) {
        try {
            const res = await fetch(url, init)
            if (selectedKey) {
                keyRing?.recordResponse(
                    selectedKey.index,
                    res.status,
                    res.headers.get('x-ratelimit-reset'),
                )
            }
            if (res.ok) {
                return res
            }
            if (res.status === 401 || res.status === 403) {
                const error = new PixabayError('UNAUTHORIZED', res.status, false)
                recordProviderError(error)
                throw error
            }
            if (res.status === 429 || res.status >= 500) {
                const error = new PixabayError(
                    res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR',
                    res.status,
                    true,
                )
                recordProviderError(error)
                throw error
            }
            const error = new PixabayError('SERVER_ERROR', res.status, false)
            recordProviderError(error)
            throw error
        } catch (err) {
            if (err instanceof PixabayError) throw err
            // AbortSignal.timeout() throws DOMException named 'TimeoutError',
            // NOT 'AbortError' (that's manual controller.abort()). Matching
            // both keeps the fail-fast intent: a 15s hang throws TIMEOUT
            // immediately. (The generic-branch retry it previously fell into
            // was dead anyway — the caller's already-aborted signal is reused,
            // so the second fetch rejected instantly and surfaced as a
            // misclassified SERVER_ERROR.)
            if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
                const error = new PixabayError('TIMEOUT', 0, true, err.message)
                recordProviderError(error)
                throw error
            }
            if (attempt < maxRetries) {
                attempt++
                await new Promise((r) => setTimeout(r, 1500))
                continue
            }
            const error = new PixabayError('SERVER_ERROR', 0, true, (err as Error).message)
            if (selectedKey) keyRing?.recordResponse(selectedKey.index, 503)
            recordProviderError(error)
            throw error
        }
    }
    const error = new PixabayError('SERVER_ERROR', 0, true, 'retry exhausted')
    if (selectedKey) keyRing?.recordResponse(selectedKey.index, 503)
    recordProviderError(error)
    throw error
}

/** Pick the pre-sized URL for a hit given the caller's target width. */
function pickSizedUrl(hit: PixabayHit, targetWidth?: number): string {
    const wantsLarge = targetWidth == null || targetWidth >= LARGE_SIZE_MIN_WIDTH
    if (wantsLarge && hit.largeImageURL) return hit.largeImageURL
    return hit.webformatURL || hit.largeImageURL
}

/**
 * GH-1185: detect the query language so the search runs with a matching
 * `lang` param. Without it, Pixabay's default lang=en strips diacritics and
 * partial-matches per word across multilingual tags — "cơm bò" ("com" + "bò")
 * returned pug dogs (tag "myfirstpug.com") and Scottish cattle (tag
 * "bò ghàidhealach").
 *
 * Detection is script-based (Unicode ranges), covering the Pixabay-supported
 * languages that are unambiguously identifiable from their characters:
 *   - Vietnamese: only unambiguous chars (horn letters ơ/ư, breve ă, đ, and
 *     the hook-above/tilde/dot-below vowel series). Plain à/á/é/ô are
 *     excluded — French/Malay loanwords ("café") would misroute to lang=vi.
 *   - Thai / Japanese / Korean / Chinese / Cyrillic / Greek: script ranges.
 *     Japanese is checked before Han so kana routes to `ja`; kanji-only
 *     queries route to `zh` (both are Pixabay-supported).
 * Latin-script languages (de/fr/es/id/ms/…) cannot be told apart reliably →
 * undefined → Pixabay's default lang=en. Raw keywords are NEVER translated;
 * only the `lang` param changes.
 * Exported for testing only.
 */
const VIETNAMESE_CHAR_RE = /[ăâđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i
export type PixabayQueryLang = 'vi' | 'th' | 'ja' | 'ko' | 'zh' | 'ru' | 'el'
const SCRIPT_LANG_DETECTORS: ReadonlyArray<readonly [RegExp, PixabayQueryLang]> = [
    [VIETNAMESE_CHAR_RE, 'vi'],
    [/[฀-๿]/, 'th'], // Thai
    [/[぀-ヿ]/, 'ja'], // Hiragana + Katakana
    [/[가-힯]/, 'ko'], // Hangul syllables
    [/[一-鿿]/, 'zh'], // Han (after ja — kana wins for Japanese text)
    [/[Ѐ-ӿ]/, 'ru'], // Cyrillic (bg also supported; ru is the safer default)
    [/[Ͱ-Ͽ]/, 'el'], // Greek
]
export function detectQueryLang(query: string): PixabayQueryLang | undefined {
    // NFC-normalize first: decomposed input (e.g. "phở" as o + combining horn
    // + combining hook) would silently miss the precomposed char classes and
    // disable lang=vi + the relevance gate — the exact bug this fixes.
    const normalized = query.normalize('NFC')
    for (const [re, lang] of SCRIPT_LANG_DETECTORS) {
        if (re.test(normalized)) return lang
    }
    return undefined
}

/**
 * GH-1185: client-side relevance gate for Vietnamese queries.
 *
 * Even with lang=vi, Pixabay ranks by popularity and matches loosely — a
 * query "cơm cá kho tộ" returns "cá cơm" (anchovy) photos because their tags
 * contain the words "cá" and "cơm". This helper re-checks that EVERY word of
 * the query appears in the photo's tags, so callers can treat weak matches
 * as a miss and fall back to a broader query instead of filling the pool
 * with popular-but-wrong photos.
 *
 * @deprecated GH-1611 — AND-matches the whole JOINED query, which is only
 * correct for a single term. Callers gating a multi-term query must use
 * `photoMatchesTerms` instead. Kept for the single-term semantics it defines
 * (and the GH-1185 regression tests that pin it).
 */
export function photoMatchesQuery(photoTags: string | null | undefined, query: string): boolean {
    if (!photoTags) return false
    // NFC on both sides — a decomposed query word would never substring-match
    // Pixabay's (precomposed) tags, silently failing every gate check.
    const tags = photoTags.normalize('NFC').toLowerCase()
    const words = query.normalize('NFC').toLowerCase().split(/\s+/).filter((w) => w.length > 1)
    if (words.length === 0) return true
    return words.every((w) => tags.includes(w))
}

/**
 * GH-1611: term-aware relevance gate — what the pool and the per-block pipeline
 * actually gate on.
 *
 * The query is not one phrase, it is N product terms joined with spaces
 * ("chocolate birthday cake" + "crusty baguette bread"). AND-matching the joined
 * string (photoMatchesQuery) demands a single photo be simultaneously a cake AND
 * a baguette — no photo matches, so the gate rejected 100% of on-industry photos
 * and the pool fell through to off-industry fallback tiers. That is how clothing
 * flatlays ended up in a bakery's gallery.
 *
 * A photo passes if it matches AT LEAST ONE term. A term matches when:
 *   - 1-2 words → EVERY word is in the tags. This is the GH-1185 invariant:
 *     "phở bò" must reject a photo tagged only "bò ghàidhealach".
 *   - 3+ words → the HEAD NOUN (last word) plus at least one other word. The
 *     head noun is what the photo IS; the rest are modifiers.
 *
 * Both halves of the 3+ rule are load-bearing, and each one alone is a known bug:
 *   - "2 of N" without the head noun re-opens GH-1185 at longer arities:
 *     "cơm cá kho tộ" would match a dried-anchovy photo tagged "cá cơm" (2 hits,
 *     no dish). Demanding the head noun kills it — "tộ" is nowhere in the tags.
 *   - the head noun ALONE is too weak: "leather handbag store" would match the
 *     shirt-rack photo tagged "clothing store, retail" from the GH-1611 report.
 *
 * The cost is false negatives — "chocolate birthday cake" rejects a real cake
 * tagged only "cake, sweet, food". That is the intended trade: a missing photo is
 * backfilled by the ladder's curated on-category tier, whereas a wrong photo ends
 * up in the merchant's gallery. Reject when unsure.
 *
 * Language-agnostic on purpose: the pool query is English by default
 * (GEN_TRANSLATE_POOL_KEYWORDS), so a Vietnamese-only gate is a gate that never
 * runs in production. Callers must NOT wrap this in a language check.
 */
const WEAK_WORDS = new Set([
    // Colors & materials
    'red', 'blue', 'green', 'white', 'black', 'yellow', 'brown', 'grey', 'gray',
    'leather', 'wooden', 'wood', 'glass', 'metal', 'plastic', 'paper', 'gold', 'silver',
    // Adjectives & modifiers
    'fresh', 'best', 'good', 'clean', 'modern', 'minimalist', 'large', 'small', 'high', 'low',
    'hot', 'cold', 'soft', 'hard', 'quick', 'easy', 'safe', 'clear', 'organic', 'natural',
    // Generic nouns
    'team', 'group', 'people', 'man', 'woman', 'person', 'client', 'customer', 'worker', 'staff',
    'service', 'product', 'business', 'company', 'hand', 'face', 'background', 'design', 'style',
    'work', 'setup', 'detail', 'concept', 'idea', 'object', 'thing', 'soup', 'rice', 'food',
    'dish', 'sauce', 'drink', 'juice', 'store', 'shop', 'item'
])

// Vietnamese rice dishes commonly put the protein before a trailing cooking
// method: "com suon nuong", "com ga chien". In those phrases the cooking
// method describes the protein; it is not the subject shown in the photo.
const VI_TRAILING_PREPARATION_WORDS = new Set([
    'chien', 'hap', 'kho', 'luoc', 'nuong', 'quay', 'rang', 'rim', 'sot', 'xao',
    'chiên', 'hấp', 'luộc', 'nướng', 'sốt',
])

export function photoMatchesTerms(
    photoTags: string | null | undefined,
    terms: readonly string[],
): boolean {
    if (!photoTags) return false
    // Callers pass SUBJECT terms only (products/dishes). Never pass mood or style
    // adjectives: a 1-word term needs a single hit, so gating on "minimalist"
    // would admit a photo tagged "jeans, flatlay, minimalist" into a bakery pool.
    const termWords = terms
        .map((t) => ({ term: t, words: splitWords(t) }))
        .filter((item) => item.words.length > 0)
    if (termWords.length === 0) return true // nothing to gate on

    const tagTokens = splitWords(photoTags)
    if (tagTokens.length === 0) return false

    const wordHits = (word: string): boolean => {
        // Everything below compares STEMS, never raw words. Merchants type plurals
        // ("Cakes, Cupcakes") while Pixabay tags the singular ("cake") — matching raw
        // words rejects the photo of the very product the merchant sells.
        const wordStem = stemOf(word)
        return tagTokens.some((tok) => {
            if (tok === word) return true
            // Short words (<4) are exact-match only: stemming "tea"/"cá" is noise, and
            // a 3-char suffix collides with half the dictionary.
            if (word.length < 4) return false
            const tokStem = stemOf(tok)
            // Same subject, different inflection: "cakes"≈"cake", "pastries"≈"pastry",
            // "frosted"≈"frosting".
            if (tokStem === wordStem) return true
            // Compound whose HEAD is the word: "cupcake"/"cheesecake" are kinds of cake.
            // The word must be the SUFFIX (a compound that merely STARTS with it is a
            // different thing: "breadboard" is not bread, "tablet" is not a table), and
            // the prefix must be a real morpheme — >=3 chars. Without that length floor
            // the rule reads "price" as rice, "chair" as hair, "coats" as oats.
            return (
                wordStem.length >= 3 &&
                tokStem.length - wordStem.length >= 3 &&
                tokStem.endsWith(wordStem)
            )
        })
    }

    return termWords.some(({ term, words }) => {
        const hits = words.filter(wordHits).length
        // 1 word: must match.
        if (words.length === 1) return hits === 1

        const isVi = detectQueryLang(term) === 'vi'

        // 2 words: check weak/strong combination
        if (words.length === 2) {
            // Non-English terms (e.g. Vietnamese) must match both words to preserve invariants (e.g. phở bò vs bò)
            if (isVi) return hits === 2

            const w0Weak = WEAK_WORDS.has(words[0]!)
            const w1Weak = WEAK_WORDS.has(words[1]!)
            if (w0Weak && w1Weak) return hits === 2
            if (w0Weak) return wordHits(words[1]!) && hits >= 1
            if (w1Weak) return wordHits(words[0]!) && hits >= 1
            return hits >= 1 // both strong -> match either
        }

        // 3+ words: head noun + at least one modifier.
        let headWord = isVi
            ? words[0]!
            : words[words.length - 1]!

        if (isVi && words[0] === 'cơm' && words.length > 2) {
            const lastWord = words[words.length - 1]!
            headWord = VI_TRAILING_PREPARATION_WORDS.has(lastWord)
                ? words[words.length - 2]!
                : lastWord
        }

        // If the English head word is generic/weak, try using the modifier before it
        if (!isVi && WEAK_WORDS.has(headWord) && words.length > 2) {
            headWord = words[words.length - 2]!
        }

        return wordHits(headWord) && hits >= 2
    })
}

/**
 * Crude English inflection stripper — no stemmer dependency, just enough to equate
 * what a merchant types with what Pixabay tags: "cakes"≈"cake", "pastries"≈"pastry",
 * "frosted"≈"frosting".
 *
 * The one rule that matters: it must be applied to BOTH sides and reach the SAME
 * stem. A single-pass `/(ing|ed|es|s)$/` does not — it stems "cakes"→"cak" but
 * "cake"→"cake", so a bakery selling "Cakes" had every cake photo rejected. Hence
 * strip to a fixpoint, one suffix at a time, so plural and singular converge.
 *
 * Length floors keep it from eating real words: `ing`/`ed` only above 5 chars
 * ("bread" must not become "br"), trailing `s`/`e` only while >=3 chars remain.
 */
function stemOf(word: string): string {
    let stem = word
    let previous = ''
    while (stem !== previous) {
        previous = stem
        if (stem.length > 5) stem = stem.replace(/(ing|ed)$/u, '')
        // `[^s]` before the `s`: "dress"/"glass" keep their stem instead of being
        // ground down to "dre"/"gla" — short stems collide with unrelated words.
        if (stem.length > 3) stem = stem.replace(/(?<=[^s])s$|e$/u, '')
        if (stem.length > 3) stem = stem.replace(/y$/u, 'i') // pastry → pastri ← pastries
    }
    return stem
}

/** Lowercase NFC word tokens, dropping punctuation/commas and 1-char noise. */
function splitWords(text: string): string[] {
    return text
        .normalize('NFC')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 1)
}

/**
 * Search Pixabay photos. Returns up to `count` normalized photos.
 * Empty array if no results — not thrown.
 *
 * When Pixabay API keys are missing (common on fresh local dev), returns `[]`
 * gracefully instead of throwing. Downstream callers already handle empty
 * results via backoff + cleanup paths, so the gen pipeline stays healthy.
 */
export async function searchPhotos(
    query: string,
    count: number,
    opts: PixabaySearchOptions = {},
): Promise<PixabayPhoto[]> {
    // NFC once at entry — the `q` param, lang detection, and the 100-char cap
    // all operate on the same normalized string. Decomposed (NFD) input would
    // otherwise ship decomposed code points to Pixabay even when lang=vi is
    // correctly detected, and slice() could sever a base char from its
    // combining marks at the cap boundary.
    const normalizedQuery = query.normalize('NFC').trim()
    if (!normalizedQuery) return []
    if (!hasPixabayKey()) {
        warnNoKeyOnce()
        return []
    }
    // Count real Pixabay search calls, not CDN image downloads. Retrying a
    // bounded search is disabled because it would consume the allowance
    // without adding a new image query.
    if (!claimSearchRequest()) return []
    const selectedKey = selectPixabayKey()
    const configuredKeyCount = getConfiguredPixabayKeys().length
    // Pixabay has no 'squarish' orientation (mapped to 'all'). Over-fetch candidates
    // so we can prefer near-square hits for avatar/team buckets — see reordering below.
    const isSquarish = opts.orientation === 'squarish'
    // Pixabay per_page min is 3 — clamp low side, then slice to requested count.
    const perPage = Math.min(Math.max(isSquarish ? count * 3 : count, 3), 200)
    const params = new URLSearchParams({
        key: selectedKey.key,
        q: normalizedQuery.slice(0, 100),
        image_type: 'photo',
        orientation: ORIENTATION_MAP[opts.orientation ?? 'landscape'],
        per_page: String(perPage),
        safesearch: 'true',
        page: String(opts.page ?? 1),
    })
    // GH-1185: match `lang` to the detected query language (vi/th/ja/ko/zh/
    // ru/el) so Pixabay searches same-language tags instead of diacritic-
    // stripped partial matches. Undetected (Latin-script en/ms/de/…) → no
    // param → Pixabay default lang=en. Keywords stay raw either way.
    // opts.lang overrides for curated queries not script-detectable (see
    // PixabaySearchOptions.lang).
    const lang = opts.lang ?? detectQueryLang(normalizedQuery)
    if (lang) params.set('lang', lang)
    // GH-1185: domain filter — see PixabaySearchOptions.category.
    if (opts.category) params.set('category', opts.category)

    const url = `${BASE}?${params.toString()}`
    console.info(
        `[Pixabay API Request] key_slot=${selectedKey.index + 1}/${configuredKeyCount} query="${normalizedQuery}" orientation="${opts.orientation ?? 'landscape'}" limit=${perPage}`,
    )
    const res = await fetchWithRetry(
        url,
        { signal: AbortSignal.timeout(opts.timeoutMs ?? SEARCH_TIMEOUT_MS) },
        hasSearchBudget() ? 0 : 1,
        selectedKey,
    )
    logRateLimit(res.headers)
    const json = (await res.json()) as PixabaySearchResponse
    let hits = Array.isArray(json.hits) ? json.hits : []
    if (isSquarish) {
        // Stable-prefer near-square hits, fall back to the rest to still fill count.
        const isNearSquare = (h: PixabayHit): boolean => {
            const ar = h.imageWidth / Math.max(h.imageHeight, 1)
            return ar >= 0.8 && ar <= 1.25
        }
        hits = [...hits.filter(isNearSquare), ...hits.filter((h) => !isNearSquare(h))]
    }
    const photos = hits.slice(0, count).map((hit) => ({
        id: String(hit.id),
        url: pickSizedUrl(hit, opts.width),
        alt: hit.tags || null,
        photographer: hit.user,
        width: hit.imageWidth,
        height: hit.imageHeight,
    }))
    const budget = searchBudgetStorage.getStore()
    if (budget) {
        for (const photo of photos) {
            budget.searchResultPixabayUrls.add(photo.url)
        }
    }
    return photos
}

/** SSRF guard: https on the default port, host in the allowlist (Pixabay or static-fallback hosts). */
function isAllowedDownloadTarget(parsed: URL): boolean {
    return parsed.protocol === 'https:' && parsed.port === '' && !parsed.username && !parsed.password && DOWNLOAD_HOST_ALLOWLIST.includes(parsed.hostname)
}

function isAllowedDownloadUrl(url: string): boolean {
    try {
        return isAllowedDownloadTarget(new URL(url))
    } catch {
        return false
    }
}

/**
 * Download a photo URL to a Buffer. Caps at 10 MB by default, 15s timeout.
 * SSRF-guarded: URL must be an allowlisted host.
 */
export async function downloadPhotoBuffer(
    url: string,
    maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<DownloadResult> {
    if (!isAllowedDownloadUrl(url)) {
        throw new PixabayError('SSRF_BLOCKED', 0, false, `URL host not in allowlist: ${url}`)
    }
    const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    const failed = (err: unknown): PixabayError => {
        if (err instanceof PixabayError) return err
        if (err instanceof FetchGuardError) {
            return err.code === 'TOO_LARGE'
                ? new PixabayError('TOO_LARGE', 413, false, `over ${maxBytes} bytes`)
                : new PixabayError('SSRF_BLOCKED', 0, false, err.message)
        }
        // 'TimeoutError' is what AbortSignal.timeout() actually throws;
        // 'AbortError' covers manual aborts (same fix as fetchWithRetry).
        if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
            return new PixabayError('TIMEOUT', 0, true, err.message)
        }
        return new PixabayError('DOWNLOAD_FAIL', 0, true, (err as Error).message)
    }
    let res: Response
    let buffer: Buffer
    try {
        // redirects only to another allowlisted https host, at most 2 hops (the CDN may redirect once)
        res = await fetchAllowlisted(url, { signal, headers: { 'User-Agent': 'ech-prime-web-v2/1.0' } }, isAllowedDownloadTarget)
        if (!res.ok) {
            await res.body?.cancel().catch(() => undefined)
            throw new PixabayError('DOWNLOAD_FAIL', res.status, res.status >= 500)
        }
        // counted while it arrives: nothing over the cap is ever held in memory
        buffer = Buffer.from(await readBodyCapped(res, maxBytes))
    } catch (err) {
        throw failed(err)
    }
    if (isPixabayUrl(url)) {
        const budget = searchBudgetStorage.getStore()
        if (budget) {
            budget.downloadedPixabayCount += 1
            budget.downloadedPixabayUrls.add(url)
        }
    }
    return {
        buffer,
        mimetype: res.headers.get('content-type') ?? 'image/jpeg',
        size: buffer.length,
    }
}
