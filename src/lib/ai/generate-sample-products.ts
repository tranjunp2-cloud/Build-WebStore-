/**
 * Sample product generation — runs in parallel with site generation.
 * Two-tier fallback: AI (GPT-4.1-nano) → curated library.
 * Image per product: Unsplash search → Payload Media upload (skipped on failure).
 *
 * Called from generate-site/route.ts via Promise.allSettled.
 */

import OpenAI from 'openai'
import type { BasePayload } from 'payload'
import { selectModel } from './config'
import type { BusinessInfoInput } from './system-prompt'
import { resolveComposerCategory } from './composer-category-resolver'
import { hashString, seededShuffle } from './seeded-random'
import { searchPhotos, PixabayError, PIXABAY_CATEGORY_BY_COMPOSER } from './pixabay-client'
import { uploadImageUrl } from './upload-media'
import { findOrCreateCartonMedia } from '@/lib/media/carton-placeholder'
import { SAMPLE_PRODUCTS_BY_CATEGORY } from './content/sample-products'
import { getProductImages } from '@/lib/images/industry-images'

export interface SampleProduct {
    name: string
    shortDescription: string
    description: string
    descriptionBM?: string
    price: number
    sku: string
    inventory: number
    imageId?: number // Payload Media ID — undefined if image fetch failed
    galleryUrl?: string // Tier-C CDN URL used; carried to route.ts for FK-violation re-upload
    status: 'active'
    // AI-estimated shipping fields (Tier-1 only — Tier-2 curated fallback never sets these).
    // Undefined here means "AI didn't provide it" — the constant fallback (weight:1, dims:0) is
    // applied downstream in generate-site/route.ts, mirroring BulkCreateModal.buildSavePayload().
    weight?: number
    length?: number
    width?: number
    height?: number
}

type ImageFailReason = 'rate_limited' | 'no_results' | 'gallery_failed' | 'upload_failed'

export interface ProductImageStats {
    rateLimited: number  // unsplash_rl in summary log
    uploadFailed: number // images_failed in summary log (Tier-A upload errors + gallery_failed)
    noImage: number      // products_no_image in summary log
}

export interface GeneratedProductsResult {
    products: SampleProduct[]
    stats: ProductImageStats
}

/** Product copy and image work are deliberately separate so a slow stock-image
 * provider cannot delay creating the generated catalog. */
export interface PreparedSampleProducts {
    products: SampleProduct[]
    imageKeywords: string[]
    category: string
}


function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

/** Returns true when the OpenAI error is a hard quota/credit limit (no point retrying). */
function isQuotaExhausted(err: unknown): boolean {
    // Structural check instead of instanceof so this works in test environments
    // where OpenAI.APIError may be undefined (mock doesn't expose the class).
    if (!(err instanceof Error)) return false
    const status = (err as { status?: unknown }).status
    if (status !== 429) return false
    const code = (err as { code?: string | null }).code
    if (!code) return false // unknown code — retry rather than abort on ambiguous 429
    return code === 'insufficient_quota'
}

/** Tier 1: ask GPT-4.1-nano for `count` products tailored to the business. */
async function generateSampleProductsAI(
    businessInfo: BusinessInfoInput,
    language: 'en' | 'ms' | 'auto',
    count = 6,
    excludeNames: readonly string[] = [],
): Promise<Array<SampleProduct & { _imageKeyword: string }>> {
    const openai = getOpenAI()
    if (!openai) throw new Error('OPENAI_API_KEY not set')

    const includeBM = language === 'ms' || language === 'auto'
    const systemPrompt = `You generate sample products for a small-business website.
Products MUST be specific, realistic items the business would actually sell — never generic placeholders.
Names should be 2-5 words, distinct from each other.
Image keywords MUST describe the physical product in 2-3 plain English words.
Output strictly JSON matching the requested schema. No markdown.`

    const exclusion = excludeNames.length
        ? `Do NOT repeat or rephrase these existing names: ${excludeNames.map(n => `"${n}"`).join(', ')}.`
        : ''
    const prompt = `Generate ${count} sample products for a ${businessInfo.industry} business called "${businessInfo.businessName}".
${businessInfo.products ? `Products hint: ${businessInfo.products}` : ''}
${exclusion}
Return JSON: {"products":[{"name":"...","shortDescription":"max 100 chars","description":"2-3 sentences","price":number${includeBM ? ',"descriptionBM":"Bahasa Melayu translation"' : ''},"imageKeyword":"2-3 word English-only Unsplash search query (e.g. pet shampoo bottle, cat carrier bag)","weight":number (estimated shipping weight in kg for this specific product, minimum 0.1),"length":number (estimated length in cm),"width":number (estimated width in cm),"height":number (estimated height in cm)}]}
Use MYR pricing. Estimate weight/dimensions realistically per product (e.g. a chair is heavier than earrings). No markdown. JSON only.`

    const completion = await openai.chat.completions.create({
        model: selectModel('product-description'),
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: Math.min(1500, (includeBM ? 450 : 300) * count),
        response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { products?: unknown[] }
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
        throw new Error('AI returned empty products array')
    }

    // AI-estimated shipping fields — left undefined when the model omits/malforms/hallucinates an
    // out-of-range value, so generate-site/route.ts's `|| 1`/`|| 0` fallback (mirroring
    // BulkCreateModal) applies downstream. NOT defaulted here — this function only reports what the
    // AI actually said, and only when it's within the same bounds the product-form Zod schema
    // enforces (schema.ts: weight 0.01-1000, dimensions 0-10000) — the AI's JSON response is
    // untrusted input feeding directly into a `status:'active'` payload.create(), with no other
    // validation layer downstream (unlike form saves, which go through Zod).
    // Strict type check (not parseFloat(String(v))) — GPT's json_object mode returns real JSON
    // numbers for numeric fields; parseFloat(String(v)) would lenient-parse garbage like "5kg" -> 5
    // or an array [5,10] -> "5,10" -> 5, silently accepting malformed AI output as if it were valid.
    const toBoundedNumber = (v: unknown, min: number, max: number): number | undefined =>
        typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined

    return (parsed.products as Array<Record<string, unknown>>).slice(0, count).map((p) => ({
        name: String(p.name ?? ''),
        shortDescription: String(p.shortDescription ?? '').slice(0, 100),
        description: String(p.description ?? ''),
        ...(includeBM && p.descriptionBM ? { descriptionBM: String(p.descriptionBM) } : {}),
        price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0,
        weight: toBoundedNumber(p.weight, 0.01, 1000),
        length: toBoundedNumber(p.length, 0, 10000),
        width: toBoundedNumber(p.width, 0, 10000),
        height: toBoundedNumber(p.height, 0, 10000),
        imageId: undefined,
        status: 'active' as const,
        sku: '',       // overridden in withImages.push
        inventory: 0,  // overridden in withImages.push
        _imageKeyword: String(p.imageKeyword ?? ''),
    }))
}

/** Tier 2: deterministic curated products from library, keyed by category. */
function getFallbackProducts(businessInfo: BusinessInfoInput): Array<SampleProduct & { _imageKeyword: string }> {
    const category = resolveComposerCategory(
        `${businessInfo.industry} ${businessInfo.businessName} ${businessInfo.products}`,
    )
    const pool = SAMPLE_PRODUCTS_BY_CATEGORY[category] ?? SAMPLE_PRODUCTS_BY_CATEGORY['business'] ?? []
    // businessName-only seed is intentional: curated fallback products are generic
    // (not user-specific), so same-name collisions are acceptable here.
    const seed = hashString(businessInfo.businessName)
    const shuffled = seededShuffle(pool, seed)
    return shuffled.slice(0, 6).map((t) => ({
        name: t.name,
        shortDescription: t.shortDescription,
        description: t.description,
        price: t.price,
        imageId: undefined,
        status: 'active' as const,
        sku: '',       // overridden in withImages.push
        inventory: 0,  // overridden in withImages.push
        _imageKeyword: t.imageKeyword,
    }))
}

// Categories too generic to improve an Unsplash image search
const GENERIC_CATEGORIES = new Set(['ecommerce', 'business', 'retail', 'store', 'shop'])

/**
 * Derive a product-specific Unsplash search keyword from product name + category.
 * Uses last 2 words of the product name — English product names put the noun last
 * (e.g. "Colorful Rainbow Teddy" → "rainbow teddy", not "colorful rainbow").
 */
function deriveFallbackKeyword(productName: string, category: string): string {
    const cleaned = productName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()
    const words = cleaned.split(/\s+/).filter(w => w.length >= 3)
    if (!words.length) return `${category} product`
    const tail = words.slice(-2) // noun (product type) is last in English names
    const suffix = GENERIC_CATEGORIES.has(category.toLowerCase()) ? '' : ` ${category}`
    return `${tail.join(' ')}${suffix}`.trim()
}

/**
 * Fetch one Unsplash photo and upload to Payload Media.
 * Search flow:
 *   Tier A  — exact AI keyword
 *   Tier B  — progressively drop leading words (adjectives first, noun stays last)
 *             e.g. "rainbow teddy bear" → "teddy bear" → "bear"
 *   Tier B2 — name-derived keyword as final text-search attempt
 *   Tier C  — direct gallery URL (bypasses search API entirely)
 * Never throws — returns imageId (may be undefined) and optional failure reason.
 * skipSearch=true jumps directly to Tier C (used when quota is exhausted or PIXABAY_FALLBACK_ONLY=1).
 */
async function fetchProductImage(
    keyword: string,
    index: number,
    siteKey: string,
    productName: string,
    category: string,
    payload: BasePayload,
    tenantId: string,
    galleryFallbackUrl?: string,
    skipSearch = false,
): Promise<{ imageId: number | undefined; reason?: ImageFailReason }> {
    const filename = `sample-product-${siteKey}-${index}.jpg`
    let wasRateLimited = false
    let tierAUploadFailed = false

    if (!skipSearch) {
        try {
            // GH-1185: `category` here is already a resolved composer key —
            // Pixabay domain filter keeps loose matches on-topic.
            const pixCategory = PIXABAY_CATEGORY_BY_COMPOSER[category]
            // Tier A: exact AI keyword
            let photos = await searchPhotos(keyword, 1, { orientation: 'squarish', width: 800, category: pixCategory })

            // Tier B: drop leading adjectives one by one until we get results
            if (!photos.length) {
                const words = keyword.trim().split(/\s+/)
                for (let drop = 1; drop < words.length && !photos.length; drop++) {
                    const simplified = words.slice(drop).join(' ')
                    console.warn(`[sample-products] "${keyword}" → 0, trying simplified "${simplified}"`)
                    photos = await searchPhotos(simplified, 1, { orientation: 'squarish', width: 800, category: pixCategory })
                }
            }

            // Tier B2: keyword variants exhausted — derive fresh keyword from product name
            if (!photos.length) {
                const nameKeyword = deriveFallbackKeyword(productName, category)
                console.warn(`[sample-products] all "${keyword}" variants → 0, trying name-derived "${nameKeyword}"`)
                photos = await searchPhotos(nameKeyword, 1, { orientation: 'squarish', width: 800, category: pixCategory })
            }

            if (photos.length) {
                const photo = photos[0]!
                // photo.url is already sized by the client (Pixabay fixed sizes).
                try {
                    const id = await uploadImageUrl(photo.url, filename, productName, tenantId, payload)
                    if (id != null) {
                        // Verify row still exists — orphan stripper may delete unreferenced media.
                        const exists = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
                        if (exists) return { imageId: id }
                        console.warn(`[sample-products] imageId=${id} deleted by orphan stripper, retrying with gallery URL`)
                        // Fall through to Tier C
                    }
                } catch {
                    tierAUploadFailed = true
                    // Upload failed — fall through to Tier C
                }
            }
        } catch (err) {
            if (err instanceof PixabayError && err.code === 'RATE_LIMITED') {
                wasRateLimited = true
                // fall through to Tier C; outer loop will skip search for subsequent products
            } else {
                console.warn(`[sample-products] Pixabay search failed for "${keyword}":`, (err as Error).message)
            }
        }
    }

    // Tier C: direct gallery URL (bypasses search API — works even when key is invalid/rate-limited)
    if (galleryFallbackUrl) {
        try {
            const id = await uploadImageUrl(galleryFallbackUrl, filename, productName, tenantId, payload)
            if (id != null) {
                const exists = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
                if (exists) return { imageId: id, ...(wasRateLimited ? { reason: 'rate_limited' as ImageFailReason } : {}) }
                console.warn(`[sample-products] gallery imageId=${id} also deleted, falling through to Tier D`)
            }
        } catch {
            // non-fatal — fall through to Tier D
        }
    }

    // Tier D: static carton-box placeholder — last resort when all CDN-dependent tiers fail
    const cartonResult = await findOrCreateCartonMedia(payload, tenantId).catch(() => null)
    if (cartonResult) {
        console.warn(`[sample-products] Tier D carton fallback used for "${productName}"`)
        return { imageId: cartonResult.id, reason: wasRateLimited ? 'rate_limited' : tierAUploadFailed ? 'upload_failed' : 'no_results' }
    }

    return {
        imageId: undefined,
        reason: wasRateLimited
            ? 'rate_limited'
            : tierAUploadFailed
                ? 'upload_failed'
                : galleryFallbackUrl
                    ? 'gallery_failed'
                    : 'no_results',
    }
}

/**
 * Generate 6 sample products for a newly created site.
 * Tier 1: AI. Tier 2: curated library. Images: Unsplash fetched sequentially to avoid rate limits.
 * Never throws — returns whatever was successfully generated (may be []).
 * Set PIXABAY_FALLBACK_ONLY=1 to skip search entirely and use gallery URLs only.
 */
export async function prepareSampleProducts(
    businessInfo: BusinessInfoInput,
    language: 'en' | 'ms' | 'auto',
    siteId?: string | number,
): Promise<PreparedSampleProducts> {
    const MAX_RETRIES = 3
    let rawProducts: Array<SampleProduct & { _imageKeyword: string }> = []
    let aiSucceeded = false

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await generateSampleProductsAI(businessInfo, language, 6)
            if (result.length > 0) {
                rawProducts = result
                aiSucceeded = true
                break
            }
            console.warn(`[sample-products] AI attempt ${attempt}/${MAX_RETRIES} returned 0 products`)
        } catch (err) {
            if (isQuotaExhausted(err)) {
                console.warn('[sample-products] OpenAI quota exhausted, skipping retries')
                break
            }
            console.warn(`[sample-products] AI attempt ${attempt}/${MAX_RETRIES} failed:`, (err as Error).message)
        }
    }

    if (!aiSucceeded) {
        rawProducts = getFallbackProducts(businessInfo)
    } else if (rawProducts.length < 6) {
        const needed = 6 - rawProducts.length
        try {
            const topup = await generateSampleProductsAI(
                businessInfo, language, needed,
                rawProducts.map(p => p.name),
            )
            rawProducts = [...rawProducts, ...topup].slice(0, 6)
        } catch (err) {
            if (isQuotaExhausted(err)) {
                console.warn('[sample-products] OpenAI quota exhausted on top-up, filling from curated')
            } else {
                console.warn('[sample-products] AI top-up failed, filling from curated:', (err as Error).message)
            }
            const fallback = getFallbackProducts(businessInfo)
            const existingNames = new Set(rawProducts.map(p => p.name.toLowerCase()))
            const fills = fallback.filter(p => !existingNames.has(p.name.toLowerCase())).slice(0, needed)
            rawProducts = [...rawProducts, ...fills]
        }
    }

    // Prepare stable product data before any external image provider work. The
    // route can safely persist this result even if enrichment later times out.
    const siteKey = siteId ? String(siteId) : Date.now().toString(36)
    const category = resolveComposerCategory(
        `${businessInfo.industry} ${businessInfo.businessName} ${businessInfo.products ?? ''}`
    )
    // Pre-fetch product URLs as Tier-C fallback (direct download, no search API needed)
    // Seed-shuffle the fixed industry pool (6 items) so each product gets a distinct URL
    const productImagePool = getProductImages(category)
    const productUrls = seededShuffle(productImagePool, hashString(siteKey))

    // Derive SKU prefix from composer category (first 3 chars, uppercase)
    const skuPrefix = category.substring(0, 3).toUpperCase()

    const products: SampleProduct[] = rawProducts.map((p, i) => {
        const { _imageKeyword: _, ...product } = p
        return {
            ...product,
            imageId: undefined,
            galleryUrl: productUrls[i % productUrls.length],
            sku: `${skuPrefix}-${String(i + 1).padStart(3, '0')}`,
            inventory: 0,
        }
    })

    return {
        products,
        imageKeywords: rawProducts.map((product) => product._imageKeyword),
        category,
    }
}

/**
 * Enrich prepared products with Payload media IDs. Kept separate from copy
 * generation so callers can bound this external-I/O phase independently.
 */
export async function enrichSampleProductImages(
    prepared: PreparedSampleProducts,
    tenantId: string,
    payload: BasePayload,
    siteId?: string | number,
): Promise<GeneratedProductsResult> {
    const siteKey = siteId ? String(siteId) : Date.now().toString(36)
    const { products, imageKeywords, category } = prepared
    const withImages: SampleProduct[] = []
    const stats: ProductImageStats = { rateLimited: 0, uploadFailed: 0, noImage: 0 }
    // Set to true after first 429 — no point searching for remaining products this gen
    let searchRateLimited = false
    const fallbackOnly = process.env.PIXABAY_FALLBACK_ONLY === '1'

    for (let i = 0; i < products.length; i++) {
        const product = products[i]!
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 500))
        const skipSearch = fallbackOnly || searchRateLimited
        const { imageId, reason } = await fetchProductImage(
            imageKeywords[i] ?? '', i, siteKey, product.name, category, payload, tenantId,
            product.galleryUrl,
            skipSearch,
        )
        if (reason === 'rate_limited') {
            stats.rateLimited++
            searchRateLimited = true
        }
        if (reason === 'upload_failed' || reason === 'gallery_failed') {
            stats.uploadFailed++
        }
        if (!imageId) stats.noImage++
        const reasonStr = reason ? ` reason=${reason}` : ''
        console.log(`[sample-products] product ${i + 1}/${products.length} "${product.name}" → imageId=${imageId ?? 'none'}${reasonStr}`)
        withImages.push({
            ...product,
            imageId,
        })
    }

    return { products: withImages, stats }
}

/** Backward-compatible convenience API for callers that require images inline. */
export async function generateSampleProducts(
    businessInfo: BusinessInfoInput,
    language: 'en' | 'ms' | 'auto',
    tenantId: string,
    payload: BasePayload,
    siteId?: string | number,
): Promise<GeneratedProductsResult> {
    const prepared = await prepareSampleProducts(businessInfo, language, siteId)
    return enrichSampleProductImages(prepared, tenantId, payload, siteId)
}
