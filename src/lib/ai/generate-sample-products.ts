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
import { computeGenSeed } from './gen-seed'
import { searchPhotos, buildImgixUrl, trackDownload } from './unsplash-client'
import { uploadImageUrl } from './upload-media'
import { SAMPLE_PRODUCTS_BY_CATEGORY } from './content/sample-products'
import { getGalleryImages } from '@/lib/images/industry-images'

export interface SampleProduct {
    name: string
    shortDescription: string
    description: string
    descriptionBM?: string
    price: number
    imageId?: number // Payload Media ID — undefined if image fetch failed
    status: 'active'
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
Return JSON: {"products":[{"name":"...","shortDescription":"max 100 chars","description":"2-3 sentences","price":number${includeBM ? ',"descriptionBM":"Bahasa Melayu translation"' : ''},"imageKeyword":"2-3 word English-only Unsplash search query (e.g. pet shampoo bottle, cat carrier bag)"}]}
Use MYR pricing. No markdown. JSON only.`

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

    return (parsed.products as Array<Record<string, unknown>>).slice(0, count).map((p) => ({
        name: String(p.name ?? ''),
        shortDescription: String(p.shortDescription ?? '').slice(0, 100),
        description: String(p.description ?? ''),
        ...(includeBM && p.descriptionBM ? { descriptionBM: String(p.descriptionBM) } : {}),
        price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0,
        imageId: undefined,
        status: 'active' as const,
        _imageKeyword: String(p.imageKeyword ?? ''),
    }))
}

/** Tier 2: deterministic curated products from library, keyed by category. */
function getFallbackProducts(businessInfo: BusinessInfoInput): Array<SampleProduct & { _imageKeyword: string }> {
    const category = resolveComposerCategory(
        `${businessInfo.industry} ${businessInfo.businessName} ${businessInfo.products}`,
    )
    const pool = SAMPLE_PRODUCTS_BY_CATEGORY[category] ?? SAMPLE_PRODUCTS_BY_CATEGORY['business'] ?? []
    const seed = computeGenSeed(businessInfo)
    const shuffled = seededShuffle(pool, seed)
    return shuffled.slice(0, 6).map((t) => ({
        name: t.name,
        shortDescription: t.shortDescription,
        description: t.description,
        price: t.price,
        imageId: undefined,
        status: 'active' as const,
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
 * Returns Media ID or undefined — never throws.
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
): Promise<number | undefined> {
    const filename = `sample-product-${siteKey}-${index}.jpg`
    try {
        // Tier A: exact AI keyword
        let photos = await searchPhotos(keyword, 1, { orientation: 'squarish' })

        // Tier B: drop leading adjectives one by one until we get results
        // "rainbow teddy bear" → "teddy bear" → "bear"
        if (!photos.length) {
            const words = keyword.trim().split(/\s+/)
            for (let drop = 1; drop < words.length && !photos.length; drop++) {
                const simplified = words.slice(drop).join(' ')
                console.warn(`[sample-products] "${keyword}" → 0, trying simplified "${simplified}"`)
                photos = await searchPhotos(simplified, 1, { orientation: 'squarish' })
            }
        }

        // Tier B2: keyword variants exhausted — derive fresh keyword from product name
        if (!photos.length) {
            const nameKeyword = deriveFallbackKeyword(productName, category)
            console.warn(`[sample-products] all "${keyword}" variants → 0, trying name-derived "${nameKeyword}"`)
            photos = await searchPhotos(nameKeyword, 1, { orientation: 'squarish' })
        }

        if (photos.length) {
            const photo = photos[0]!
            const url = buildImgixUrl(photo.urls.raw, { w: 800, h: 800, fit: 'crop' })
            trackDownload(photo.links.download_location)
            const id = await uploadImageUrl(url, filename, productName, tenantId, payload)
            if (id != null) {
                // Verify row still exists — orphan stripper (running in parallel with site gen)
                // may delete media that isn't yet referenced by any Products record.
                const exists = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
                if (exists) return id
                console.warn(`[sample-products] imageId=${id} deleted by orphan stripper, retrying with gallery URL`)
                // Fall through to Tier C to re-upload from gallery
            }
        }
    } catch (err) {
        console.warn(`[sample-products] Unsplash search failed for "${keyword}":`, (err as Error).message)
    }

    // Tier C: direct gallery URL (bypasses search API — works even when key is invalid/rate-limited)
    if (galleryFallbackUrl) {
        try {
            const id = await uploadImageUrl(galleryFallbackUrl, filename, productName, tenantId, payload)
            if (id != null) {
                const exists = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
                if (exists) return id
                console.warn(`[sample-products] gallery imageId=${id} also deleted, product will have no image`)
            }
        } catch {
            // non-fatal
        }
    }

    return undefined
}

/**
 * Generate 6 sample products for a newly created site.
 * Tier 1: AI. Tier 2: curated library. Images: Unsplash fetched sequentially to avoid rate limits.
 * Never throws — returns whatever was successfully generated (may be []).
 */
export async function generateSampleProducts(
    businessInfo: BusinessInfoInput,
    language: 'en' | 'ms' | 'auto',
    tenantId: string,
    payload: BasePayload,
    siteId?: string | number,
): Promise<SampleProduct[]> {
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

    // Fetch images sequentially with delay to stay within Unsplash rate limits (demo: 50/hr)
    const siteKey = siteId ? String(siteId) : Date.now().toString(36)
    const category = resolveComposerCategory(
        `${businessInfo.industry} ${businessInfo.businessName} ${businessInfo.products ?? ''}`
    )
    // Pre-fetch gallery URLs as Tier-C fallback (direct download, no search API needed)
    // Seed-shuffle the fixed industry pool (6 items) so each product gets a distinct URL
    const galleryPool = getGalleryImages(category)
    if (galleryPool.length === 0) console.warn(`[sample-products] no gallery images for category="${category}", Tier C disabled`)
    const galleryUrls = seededShuffle(galleryPool, hashString(siteKey))
    const withImages: SampleProduct[] = []

    for (let i = 0; i < rawProducts.length; i++) {
        const p = rawProducts[i]!
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 500))
        const imageId = await fetchProductImage(
            p._imageKeyword, i, siteKey, p.name, category, payload, tenantId,
            galleryUrls[i % galleryUrls.length],
        )
        console.log(`[sample-products] product ${i + 1}/${rawProducts.length} "${p.name}" → imageId=${imageId ?? 'none'}`)
        const { _imageKeyword: _, ...product } = p
        withImages.push({ ...product, imageId })
    }

    return withImages
}
