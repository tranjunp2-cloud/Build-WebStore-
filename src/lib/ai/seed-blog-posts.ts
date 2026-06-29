import type { BasePayload } from 'payload'
import { getBlogSeeds } from './content/blog-seeds'
import { generateBlogSeedsAI, generateBlogPostContent, isQuotaExhausted, type BlogSeedAI } from './generate-blog-seeds'
import { uploadImageUrl } from './upload-media'
import { getBlogThumbnails } from '@/lib/images/blog-thumbnail-images'
import { searchPhotos, PixabayError } from './pixabay-client'
import { findOrCreateCartonMedia } from '@/lib/media/carton-placeholder'
import type { BlogPost } from './content/types'

type AnyBlogSeed = BlogSeedAI | BlogPost

async function isValidMedia(id: number, payload: BasePayload): Promise<boolean> {
    const m = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
    return (
        m != null &&
        typeof m.filename === 'string' && m.filename.length > 0 &&
        typeof m.mimeType === 'string' && m.mimeType.length > 0 &&
        typeof m.filesize === 'number' && m.filesize > 0
    )
}

async function fetchBlogThumbnail(
    seed: AnyBlogSeed,
    i: number,
    blogThumbnails: string[],
    tenantId: number | string,
    category: string,
    searchRateLimited: boolean,
    payload: BasePayload,
): Promise<{ thumbnailId: number | undefined; wasRateLimited: boolean }> {
    const filename = `blog-${tenantId}-${seed.slug}.jpg`
    const keyword =
        ('imageKeyword' in seed && seed.imageKeyword) ||
        ('category' in seed && seed.category) ||
        category
    let wasRateLimited = false

    // Tier A: Pixabay search
    if (!searchRateLimited) {
        try {
            const photos = await searchPhotos(keyword, 1, { orientation: 'landscape', width: 1200 })
            if (photos.length > 0) {
                const photo = photos[0]!
                // photo.url is already sized by the client (Pixabay fixed sizes).
                const id = await uploadImageUrl(photo.url, filename, seed.title, tenantId, payload)
                if (id !== undefined && await isValidMedia(id, payload)) return { thumbnailId: id, wasRateLimited }
                console.warn(`[seed-blog-posts] Tier A orphan for "${seed.slug}", falling to Tier B`)
            }
        } catch (err) {
            if (err instanceof PixabayError && err.code === 'RATE_LIMITED') {
                wasRateLimited = true
                console.warn(`[seed-blog-posts] Pixabay rate-limited for "${seed.slug}", using curated URL`)
            } else {
                console.warn(`[seed-blog-posts] Tier A failed for "${seed.slug}":`, (err as Error).message)
            }
        }
    }

    // Tier B: curated CDN URL (stable, bypasses search API)
    try {
        const fallbackUrl = blogThumbnails[i % blogThumbnails.length]!
        const id = await uploadImageUrl(fallbackUrl, filename, seed.title, tenantId, payload)
        if (id !== undefined && await isValidMedia(id, payload)) return { thumbnailId: id, wasRateLimited }
        console.warn(`[seed-blog-posts] Tier B orphan for "${seed.slug}", falling to Tier C`)
    } catch (err) {
        console.warn(`[seed-blog-posts] Tier B failed for "${seed.slug}":`, (err as Error).message)
    }

    // Tier C: carton placeholder — local file, zero external dependency
    const carton = await findOrCreateCartonMedia(payload, tenantId).catch(() => null)
    if (carton) {
        console.warn(`[seed-blog-posts] Tier C carton used for "${seed.slug}"`)
        return { thumbnailId: carton.id, wasRateLimited }
    }

    console.warn(`[seed-blog-posts] all tiers failed for "${seed.slug}"`)
    return { thumbnailId: undefined, wasRateLimited }
}

function disambiguateSlugs(seeds: AnyBlogSeed[]): AnyBlogSeed[] {
    const counts = new Map<string, number>()
    return seeds.map((seed) => {
        const base = seed.slug.toLowerCase()
        const n = counts.get(base) ?? 0
        counts.set(base, n + 1)
        return n === 0 ? seed : { ...seed, slug: `${seed.slug}-${n}` }
    })
}

export async function seedBlogPosts(
    payload: BasePayload,
    tenantId: number | string,
    siteId: number | string,
    category: string,
    businessName: string,
    userId: number | string,
    products?: string[],
    industry?: string,
    seed?: number,
): Promise<number> {
    try {
        const existing = await payload.count({
            collection: 'blogs',
            where: { tenant: { equals: tenantId } },
        })
        if (existing.totalDocs > 0) return 0

        let seeds: AnyBlogSeed[] = []
        try {
            const aiSeeds = await generateBlogSeedsAI({
                businessName,
                industry: industry ?? category,
                products,
            })
            seeds = aiSeeds.slice(0, 3)
        } catch (err) {
            if (isQuotaExhausted(err)) {
                console.warn('[seed-blog-posts] OpenAI quota exhausted, using static seeds')
            } else {
                console.warn('[seed-blog-posts] AI gen failed, using static seeds:', (err as Error).message)
            }
        }

        if (seeds.length < 3) {
            const need = 3 - seeds.length
            const usedSlugs = new Set(seeds.map((s) => s.slug.toLowerCase()))
            const fill = getBlogSeeds(
                category,
                {
                    name: businessName,
                    ...(products?.length ? { products } : {}),
                },
                seed,
            )
                .filter((s) => !usedSlugs.has(s.slug.toLowerCase()))
                .slice(0, need)
            seeds = [...seeds, ...fill]
        }

        seeds = disambiguateSlugs(seeds)

        // Per-category landscape fallbacks (1200×630) — one distinct image per seed index.
        const blogThumbnails = getBlogThumbnails(category)

        let count = 0
        let searchRateLimited = false

        for (let i = 0; i < seeds.length; i++) {
            const seed = seeds[i]!
            if (i > 0) await new Promise(r => setTimeout(r, 500))

            const { thumbnailId, wasRateLimited } = await fetchBlogThumbnail(
                seed, i, blogThumbnails, tenantId, category, searchRateLimited, payload,
            )
            if (wasRateLimited) searchRateLimited = true

            console.log(`[seed-blog-posts] blog ${i + 1}/${seeds.length} "${seed.slug}" → thumbnailId=${thumbnailId ?? 'none'}`)

            let richContent: string | undefined
            try {
                richContent = await generateBlogPostContent(seed.title, businessName, industry ?? category)
            } catch {
                // non-fatal
            }

            // Guard against re-seed slug collision (tenant deleted all posts and regenerated)
            let finalSlug = `${tenantId}-${seed.slug}`
            try {
                const slugCheck = await payload.find({
                    collection: 'blogs',
                    where: { slug: { equals: finalSlug } },
                    limit: 1,
                })
                if (slugCheck.totalDocs > 0) finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 8)}`
            } catch { /* proceed with original slug */ }

            try {
                await payload.create({
                    collection: 'blogs',
                    data: {
                        tenant: tenantId,
                        site: siteId,
                        title: seed.title,
                        slug: finalSlug,
                        content: richContent ?? `<p>${seed.excerpt}</p>`,
                        status: 'published',
                        publishedAt: new Date().toISOString(),
                        author: userId,
                        ...(thumbnailId !== undefined ? { thumbnail: thumbnailId } : {}),
                    },
                    context: { skipPublishNotify: true },
                })
                count++
            } catch (err) {
                console.warn(`[seed-blog-posts] post "${seed.slug}" failed (non-fatal):`, (err as Error).message)
            }
        }

        return count
    } catch (err) {
        console.warn('[seed-blog-posts] skipped (non-fatal):', (err as Error).message)
        return 0
    }
}
