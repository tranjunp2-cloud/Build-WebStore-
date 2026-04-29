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
import { searchPhotos, buildImgixUrl, downloadPhotoBuffer, trackDownload } from './unsplash-client'
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

/** Tier 1: ask GPT-4.1-nano for 6 products tailored to the business. */
async function generateSampleProductsAI(
    businessInfo: BusinessInfoInput,
    language: 'en' | 'ms' | 'auto',
): Promise<SampleProduct[]> {
    const openai = getOpenAI()
    if (!openai) throw new Error('OPENAI_API_KEY not set')

    const includeBM = language === 'ms' || language === 'auto'
    const prompt = `Generate 6 sample products for a ${businessInfo.industry} business called "${businessInfo.businessName}".
${businessInfo.products ? `Products hint: ${businessInfo.products}` : ''}
Return JSON: {"products":[{"name":"...","shortDescription":"max 100 chars","description":"2-3 sentences","price":number${includeBM ? ',"descriptionBM":"Bahasa Melayu translation"' : ''},"imageKeyword":"2-3 word English-only Unsplash search query (e.g. pet shampoo bottle, cat carrier bag)"}]}
Use MYR pricing. No markdown. JSON only.`

    const completion = await openai.chat.completions.create({
        model: selectModel('product-description'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { products?: unknown[] }
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
        throw new Error('AI returned empty products array')
    }

    return (parsed.products as Array<Record<string, unknown>>).slice(0, 6).map((p) => ({
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
    const seed = hashString(businessInfo.businessName)
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

// High-yield Unsplash keywords — each term returns thousands of photos
const FALLBACK_PRODUCT_KEYWORDS = [
    'coffee cup drink',
    'food plate restaurant',
    'fresh fruit market',
    'shopping bag store',
    'product bottle skincare',
    'book shelf library',
    'clothing fashion apparel',
    'electronics gadget tech',
]

/** Download an image URL and upload to Payload Media. Returns Media ID or undefined on failure. */
async function uploadImageUrl(
    imageUrl: string,
    filename: string,
    productName: string,
    tenantId: string,
    payload: BasePayload,
): Promise<number | undefined> {
    const { buffer, mimetype } = await downloadPhotoBuffer(imageUrl)
    const doc = await payload.create({
        collection: 'media',
        data: { alt: productName, tenant: tenantId, aiGenerated: true },
        file: { data: buffer, mimetype, name: filename, size: buffer.length },
    })
    return typeof doc.id === 'number' ? doc.id : parseInt(String(doc.id), 10)
}

/**
 * Fetch one Unsplash photo and upload to Payload Media.
 * Search flow: specific keyword → generic fallback keyword → direct gallery URL fallback.
 * Returns Media ID or undefined — never throws.
 */
async function fetchProductImage(
    keyword: string,
    index: number,
    siteKey: string,
    productName: string,
    payload: BasePayload,
    tenantId: string,
    galleryFallbackUrl?: string,
): Promise<number | undefined> {
    const filename = `sample-product-${siteKey}-${index}.jpg`
    try {
        // Tier A: search by specific keyword
        let photos = await searchPhotos(keyword, 1, { orientation: 'squarish' })

        // Tier B: generic fallback keyword if specific returned nothing
        if (!photos.length) {
            const fallbackKeyword = FALLBACK_PRODUCT_KEYWORDS[index % FALLBACK_PRODUCT_KEYWORDS.length]!
            console.warn(`[sample-products] keyword "${keyword}" → 0 results, trying "${fallbackKeyword}"`)
            photos = await searchPhotos(fallbackKeyword, 1, { orientation: 'squarish' })
        }

        if (photos.length) {
            const photo = photos[0]!
            const url = buildImgixUrl(photo.urls.raw, { w: 800, h: 800, fit: 'crop' })
            trackDownload(photo.links.download_location)
            return await uploadImageUrl(url, filename, productName, tenantId, payload)
        }
    } catch (err) {
        console.warn(`[sample-products] Unsplash search failed for "${keyword}":`, (err as Error).message)
    }

    // Tier C: direct gallery URL (bypasses search API — works even when key is invalid/rate-limited)
    if (galleryFallbackUrl) {
        try {
            return await uploadImageUrl(galleryFallbackUrl, filename, productName, tenantId, payload)
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
    let rawProducts: Array<SampleProduct & { _imageKeyword: string }>

    try {
        rawProducts = (await generateSampleProductsAI(businessInfo, language)) as typeof rawProducts
    } catch (err) {
        console.warn('[sample-products] AI generation failed, using curated fallback:', (err as Error).message)
        rawProducts = getFallbackProducts(businessInfo)
    }

    // Fill up to 6 if AI returned fewer — top up from curated library
    if (rawProducts.length < 6) {
        const fallback = getFallbackProducts(businessInfo)
        const needed = 6 - rawProducts.length
        const existingNames = new Set(rawProducts.map(p => p.name.toLowerCase()))
        const topups = fallback.filter(p => !existingNames.has(p.name.toLowerCase())).slice(0, needed)
        rawProducts = [...rawProducts, ...topups]
    }

    // Fetch images sequentially with delay to stay within Unsplash rate limits (demo: 50/hr)
    const siteKey = siteId ? String(siteId) : Date.now().toString(36)
    const category = resolveComposerCategory(
        `${businessInfo.industry} ${businessInfo.businessName} ${businessInfo.products ?? ''}`
    )
    // Pre-fetch gallery URLs as Tier-C fallback (direct download, no search API needed)
    const galleryUrls = getGalleryImages(category, rawProducts.length)
    const withImages: SampleProduct[] = []

    for (let i = 0; i < rawProducts.length; i++) {
        const p = rawProducts[i]!
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 500))
        const imageId = await fetchProductImage(
            p._imageKeyword, i, siteKey, p.name, payload, tenantId,
            galleryUrls[i] ?? galleryUrls[0],
        )
        console.log(`[sample-products] product ${i + 1}/${rawProducts.length} "${p.name}" → imageId=${imageId ?? 'none'}`)
        const { _imageKeyword: _, ...product } = p
        withImages.push({ ...product, imageId })
    }

    return withImages
}
