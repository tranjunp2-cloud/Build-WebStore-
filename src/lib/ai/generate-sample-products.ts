/**
 * Sample product generation — runs in parallel with site generation.
 * Two-tier fallback: AI (GPT-4.1-nano) → curated library.
 * Image per product: Pixabay search → Payload Media upload with curated fallback.
 *
 * Called from generate-site/route.ts via Promise.allSettled.
 */

import { getLocaleLabel } from '@/lib/locale-labels'
import { AiUnavailableError, completeComposed } from '@/lib/ai-platform/actor-scope'
import type { BasePayload } from 'payload'
import type { BusinessInfoInput } from './system-prompt'
import { resolveBusinessCategory } from './composer-category-resolver'
import { hashString, seededShuffle } from './seeded-random'
import {
    searchPhotos,
    photoMatchesTerms,
    PixabayError,
    PIXABAY_CATEGORY_BY_COMPOSER,
} from './pixabay-client'
import { parseProducts, type ParsedProduct } from './business-info-mapper'
import { photoMatchesProductType } from './product-type-match'
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

export interface PreparedSampleProduct extends SampleProduct {
    /** English stock-image subject generated with the product copy. */
    imageKeyword: string
}

export interface PreparedSampleProductsResult {
    products: PreparedSampleProduct[]
    category: string
}


async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length)
    let nextIndex = 0
    const run = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++
            results[index] = await worker(items[index]!, index)
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run))
    return results
}

/**
 * True when no model can answer this run (no AI actor, or the workspace's AI
 * quota is used up) — no point retrying; the curated products take over.
 */
function isQuotaExhausted(err: unknown): boolean {
    if (err instanceof AiUnavailableError) return true
    // Structural check: the platform client's error carries the HTTP status.
    return err instanceof Error && (err as { status?: unknown }).status === 429
}

/**
 * Tier 1: ask the AI platform (`sitegen.sample-products`) for `count` products tailored to the business.
 *
 * #2103 A3: when the merchant listed products (`listed`), the model only writes copy for EXACTLY
 * those — the names (and any price the merchant typed) are never taken from the model.
 */
async function generateSampleProductsAI(
    businessInfo: BusinessInfoInput,
    language: string,
    count = 6,
    excludeNames: readonly string[] = [],
    listed: readonly ParsedProduct[] = [],
): Promise<Array<SampleProduct & { _imageKeyword: string }>> {
    const includeBM = language === 'ms' || language === 'auto'
    const targetLanguage = language !== 'auto' && language !== 'en' && language !== 'ms'
        ? getLocaleLabel(language).full
        : null
    const systemPrompt = `You generate sample products for a small-business website.
Products MUST be specific, realistic items the business would actually sell — never generic placeholders.
Names should be 2-5 words, distinct from each other.
Image keywords MUST describe the physical product in 2-3 plain English words.
Never invent certifications (halal, ISO), awards, discounts, origin claims or customer counts in descriptions.
Output strictly JSON matching the requested schema. No markdown.`

    const exclusion = excludeNames.length
        ? `Do NOT repeat or rephrase these existing names: ${excludeNames.map(n => `"${n}"`).join(', ')}.`
        : ''
    const listedBlock = listed.length > 0
        ? `The merchant listed EXACTLY these ${listed.length} products. Return exactly ${listed.length} entries, in this order, one per product. Keep each "name" exactly as written (do not rename, merge, add or drop any):
${listed.map((p, i) => `${i + 1}. "${p.name}"${p.price !== undefined ? ` (merchant price RM${p.price} — keep it)` : ''}`).join('\n')}`
        : (businessInfo.products ? `Products hint: ${businessInfo.products}` : '')
    const prompt = `Generate ${count} sample products for a ${businessInfo.industry} business called "${businessInfo.businessName}".
${listedBlock}
${exclusion}
${targetLanguage ? `Write product names and customer-facing descriptions in ${targetLanguage}.` : ''}
Return JSON: {"products":[{"name":"...","shortDescription":"max 100 chars","description":"2-3 sentences","price":number${includeBM ? ',"descriptionBM":"Bahasa Melayu translation"' : ''},"imageKeyword":"2-3 word English-only Unsplash search query (e.g. pet shampoo bottle, cat carrier bag)","weight":number (estimated shipping weight in kg for this specific product, minimum 0.1),"length":number (estimated length in cm),"width":number (estimated width in cm),"height":number (estimated height in cm)}]}
Use MYR pricing. Estimate weight/dimensions realistically per product (e.g. a chair is heavier than earrings). No markdown. JSON only.`

    const completion = await completeComposed('sitegen.sample-products', {
        system: systemPrompt,
        user: prompt,
        temperature: 0.4,
        maxOutputTokens: Math.min(6000, (includeBM ? 450 : 300) * count),
    })

    const content = completion.content
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

    const rows = (parsed.products as unknown as Array<Record<string, unknown>>).slice(0, count)
    const toProduct = (p: Record<string, unknown>) => ({
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
    })

    if (listed.length === 0) return rows.map(toProduct)
    // Merchant list is authoritative: one product per listed entry, the model only fills the copy.
    return listed.map((entry, i) => mergeListedProduct(entry, rows[i] ? toProduct(rows[i]!) : undefined))
}

/** A product exactly as the merchant listed it, with AI copy when we have it. */
function mergeListedProduct(
    entry: ParsedProduct,
    ai: (SampleProduct & { _imageKeyword: string }) | undefined,
): SampleProduct & { _imageKeyword: string } {
    return {
        name: entry.name,
        shortDescription: ai?.shortDescription ?? '',
        description: ai?.description ?? '',
        ...(ai?.descriptionBM ? { descriptionBM: ai.descriptionBM } : {}),
        // Merchant price wins; otherwise the AI estimate (0 when AI gave none).
        price: entry.price ?? ai?.price ?? 0,
        weight: ai?.weight,
        length: ai?.length,
        width: ai?.width,
        height: ai?.height,
        imageId: undefined,
        status: 'active' as const,
        sku: '',
        inventory: 0,
        _imageKeyword: ai?._imageKeyword ?? '',
    }
}

/** Tier 2: deterministic curated products from library, keyed by category. */
function getFallbackProducts(businessInfo: BusinessInfoInput): Array<SampleProduct & { _imageKeyword: string }> {
    // GH-1611: form key wins — otherwise a bakery whose name/products carry no
    // 'fnb' keyword fell to 'business' and its product grid pulled corporate stock
    // while the rest of the site showed cakes.
    const category = resolveBusinessCategory(
        businessInfo.industry,
        `${businessInfo.businessName} ${businessInfo.products}`,
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

// Categories too generic to improve a stock-image search
const GENERIC_CATEGORIES = new Set(['ecommerce', 'business', 'retail', 'store', 'shop'])

/**
 * Derive a product-specific stock-image keyword from product name + category.
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
 * Fetch one Pixabay photo and upload to Payload Media.
 * Search flow:
 *   Tier A  — exact AI keyword
 *   Tier B  — one name-derived keyword as the final text-search attempt
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
    const upload = (url: string) => uploadImageUrl(url, filename, productName, tenantId, payload)
    let wasRateLimited = false
    let tierAUploadFailed = false

    if (!skipSearch) {
        try {
            // GH-1185: `category` here is already a resolved composer key —
            // Pixabay domain filter keeps loose matches on-topic.
            const pixCategory = PIXABAY_CATEGORY_BY_COMPOSER[category]
            const searchOptions = { orientation: 'squarish' as const, width: 800, category: pixCategory, timeoutMs: 6_000 }
            // Tier A: exact AI keyword
            let photos = await searchPhotos(keyword, 1, searchOptions)

            // Tier B: one fresh keyword keeps the critical path bounded. The
            // curated gallery is already a complete, on-topic fallback.
            if (!photos.length) {
                const nameKeyword = deriveFallbackKeyword(productName, category)
                if (nameKeyword.toLowerCase() !== keyword.trim().toLowerCase()) {
                    console.warn(`[sample-products] "${keyword}" → 0, trying name-derived "${nameKeyword}"`)
                    photos = await searchPhotos(nameKeyword, 1, searchOptions)
                }
            }

            if (photos.length) {
                const photo = photos[0]!
                // photo.url is already sized by the client (Pixabay fixed sizes).
                try {
                    const id = await upload(photo.url)
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
            const id = await upload(galleryFallbackUrl)
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
 * Generate product copy without performing image-provider work. F38 uses this
 * phase so product demands can join the generation-scoped image resolver.
 *
 * #2103 A3: when the merchant listed products, the result has exactly those (≤20,
 * names + typed prices untouched) — no library top-up. With nothing listed we keep
 * the previous behaviour: 6 AI/curated sample products.
 */
export async function prepareSampleProducts(
    businessInfo: BusinessInfoInput,
    language: string,
): Promise<PreparedSampleProductsResult> {
    const listed = parseProducts(businessInfo.products)
    const target = listed.length > 0 ? listed.length : 6
    // The platform task allows a single attempt. Curated products are a complete,
    // deterministic fallback, so a second/third model attempt only extends p95.
    const MAX_RETRIES = 1
    let rawProducts: Array<SampleProduct & { _imageKeyword: string }> = []
    let aiSucceeded = false

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await generateSampleProductsAI(businessInfo, language, target, [], listed)
            if (result.length > 0) {
                rawProducts = result
                aiSucceeded = true
                break
            }
            console.warn(`[sample-products] AI attempt ${attempt}/${MAX_RETRIES} returned 0 products`)
        } catch (err) {
            if (isQuotaExhausted(err)) {
                console.warn('[sample-products] AI unavailable or quota used up, skipping retries')
                break
            }
            console.warn(`[sample-products] AI attempt ${attempt}/${MAX_RETRIES} failed:`, (err as Error).message)
        }
    }

    if (listed.length > 0) {
        // The merchant's list is the catalogue. If the model failed, the products still exist
        // (name + typed price) so the storefront matches what they asked for.
        if (!aiSucceeded) rawProducts = listed.map((entry) => mergeListedProduct(entry, undefined))
    } else {
        const canUseEnglishCuratedFallback = language === 'en' || language === 'ms' || language === 'auto'
        if (!aiSucceeded) {
            rawProducts = canUseEnglishCuratedFallback ? getFallbackProducts(businessInfo) : []
        } else if (rawProducts.length < target) {
            const needed = target - rawProducts.length
            if (canUseEnglishCuratedFallback) {
                const fallback = getFallbackProducts(businessInfo)
                const existingNames = new Set(rawProducts.map(p => p.name.toLowerCase()))
                const fills = fallback.filter(p => !existingNames.has(p.name.toLowerCase())).slice(0, needed)
                rawProducts = [...rawProducts, ...fills]
            } else {
                try {
                    const topup = await generateSampleProductsAI(
                        businessInfo, language, needed,
                        rawProducts.map(p => p.name),
                    )
                    rawProducts = [...rawProducts, ...topup].slice(0, target)
                } catch (err) {
                    const message = isQuotaExhausted(err) ? 'quota exhausted' : (err as Error).message
                    console.warn(`[sample-products] localized AI top-up failed: ${message}`)
                }
            }
        }
    }

    const category = resolveBusinessCategory(
        businessInfo.industry,
        `${businessInfo.businessName} ${businessInfo.products ?? ''}`,
    )
    return {
        category,
        products: rawProducts.map(({ _imageKeyword, ...product }) => ({
            ...product,
            imageKeyword: _imageKeyword,
        })),
    }
}

/**
 * #2103 A3: pick a pool photo for each product by relevance, never by position.
 * A photo is used when its tags match the product's own terms (AI keyword or the merchant's
 * name) AND name the product's type (serum, cake, shirt … — see product-type-match), each photo
 * at most once. A product with no matching photo gets none — a wrong
 * picture on a product is worse than the storefront placeholder.
 */
export function matchPoolPhotosToProducts(
    products: ReadonlyArray<{ name: string; imageKeyword?: string }>,
    photos: ReadonlyArray<{ id: string; alt: string }>,
    uploadedIds: ReadonlyMap<string, number>,
): Array<number | undefined> {
    const used = new Set<string>()
    return products.map((product) => {
        const terms = [product.imageKeyword, product.name]
            .map((t) => (t ?? '').trim())
            .filter((t) => t.length > 0)
        if (terms.length === 0) return undefined
        const hit = photos.find(
            (photo) =>
                !used.has(photo.id) &&
                uploadedIds.has(photo.id) &&
                photoMatchesTerms(photo.alt, terms) &&
                // the photo must show this KIND of product: an ingredient match ("orange" for a Vitamin C Serum) is not enough
                photoMatchesProductType(photo.alt, product),
        )
        if (!hit) return undefined
        used.add(hit.id)
        return uploadedIds.get(hit.id)
    })
}

/**
 * Legacy image assignment kept isolated so flag-off generation remains on the
 * pre-F38 Pixabay → curated → carton path.
 */
export async function assignSampleProductImages(
    prepared: PreparedSampleProductsResult,
    tenantId: string,
    payload: BasePayload,
    siteId?: string | number,
): Promise<GeneratedProductsResult> {
    const { products: preparedProducts, category } = prepared
    const siteKey = siteId ? String(siteId) : Date.now().toString(36)
    // Pre-fetch product URLs as Tier-C fallback (direct download, no search API needed)
    // Seed-shuffle the fixed industry pool (6 items) so each product gets a distinct URL
    const productImagePool = getProductImages(category)
    const productUrls = seededShuffle(productImagePool, hashString(siteKey))

    // Derive SKU prefix from composer category (first 3 chars, uppercase)
    const skuPrefix = category.substring(0, 3).toUpperCase()

    const stats: ProductImageStats = { rateLimited: 0, uploadFailed: 0, noImage: 0 }
    // Set to true after first 429 — no point searching for remaining products this gen
    let searchRateLimited = false
    const fallbackOnly = process.env.PIXABAY_FALLBACK_ONLY === '1'

    // Pixabay allows substantially more request concurrency than the retired
    // Unsplash demo API. Network work is bounded at 3; uploadImageUrl still
    // serializes Payload media creates through the global media-create lock.
    const withImages = await mapWithConcurrency(preparedProducts, 3, async (p, i): Promise<SampleProduct> => {
        const skipSearch = fallbackOnly || searchRateLimited
        const { imageId, reason } = await fetchProductImage(
            p.imageKeyword, i, siteKey, p.name, category, payload, tenantId,
            productUrls[i % productUrls.length],
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
        console.log(`[sample-products] product ${i + 1}/${preparedProducts.length} "${p.name}" → imageId=${imageId ?? 'none'}${reasonStr}`)
        const { imageKeyword: _, ...product } = p
        return {
            ...product,
            imageId,
            galleryUrl: productUrls[i % productUrls.length],
            sku: `${skuPrefix}-${String(i + 1).padStart(3, '0')}`,
            inventory: 0,
        }
    })

    return { products: withImages, stats }
}

export function assignResolvedSampleProductImages(
    prepared: PreparedSampleProductsResult,
    imageIds: readonly (number | undefined)[],
): GeneratedProductsResult {
    const skuPrefix = prepared.category.substring(0, 3).toUpperCase()
    const products = prepared.products.map((preparedProduct, index): SampleProduct => {
        const { imageKeyword: _, ...product } = preparedProduct
        return {
            ...product,
            ...(imageIds[index] !== undefined ? { imageId: imageIds[index] } : {}),
            sku: `${skuPrefix}-${String(index + 1).padStart(3, '0')}`,
            inventory: 0,
        }
    })
    return {
        products,
        stats: {
            rateLimited: 0,
            uploadFailed: 0,
            noImage: products.filter((product) => product.imageId === undefined).length,
        },
    }
}

/**
 * Generate the sample products for a newly created site (the merchant's own list, else 6).
 * Tier 1: AI. Tier 2: curated library (only when nothing was listed). Image network work uses bounded concurrency.
 * Never throws — returns whatever was successfully generated (may be []).
 * Set PIXABAY_FALLBACK_ONLY=1 to skip search entirely and use gallery URLs only.
 */
export async function generateSampleProducts(
    businessInfo: BusinessInfoInput,
    language: string,
    tenantId: string,
    payload: BasePayload,
    siteId?: string | number,
    resolved?: {
        prepared: PreparedSampleProductsResult
        imageIds: readonly (number | undefined)[]
    },
): Promise<GeneratedProductsResult> {
    const prepared = resolved?.prepared ?? await prepareSampleProducts(businessInfo, language)
    if (resolved) {
        return assignResolvedSampleProductImages(prepared, resolved.imageIds)
    }
    return assignSampleProductImages(prepared, tenantId, payload, siteId)
}
