import type { BasePayload } from 'payload'
import { getBlogSeeds } from './content/blog-seeds'
import { generateBlogSeedsAI, generateBlogPostContent, isQuotaExhausted, type BlogSeedAI } from './generate-blog-seeds'
import { uploadImageUrl } from './upload-media'
import { getGalleryImages } from '@/lib/images/industry-images'
import { searchPhotos, buildImgixUrl, trackDownload, type UnsplashPhoto } from './unsplash-client'
import type { BlogPost } from './content/types'

type AnyBlogSeed = BlogSeedAI | BlogPost
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
            const fill = getBlogSeeds(category, {
                name: businessName,
                ...(products?.length ? { products } : {}),
            })
                .filter((s) => !usedSlugs.has(s.slug.toLowerCase()))
                .slice(0, need)
            seeds = [...seeds, ...fill]
        }

        seeds = disambiguateSlugs(seeds)

        const galleryUrls = getGalleryImages(category, 3)

        // Run all 3 posts in parallel: cuts wall time from ~90s serial to ~30s (M3)
        const results = await Promise.allSettled(
            seeds.map(async (seed, i) => {
                let thumbnailId: number | undefined
                try {
                    let imageUrl: string | undefined
                    const keyword =
                        ('imageKeyword' in seed && seed.imageKeyword) ||
                        ('category' in seed && seed.category) ||
                        category
                    const photos: UnsplashPhoto[] = await searchPhotos(keyword, 1, { orientation: 'landscape' }).catch(() => [])
                    if (photos.length > 0) {
                        const photo = photos[0]!
                        imageUrl = buildImgixUrl(photo.urls.raw, { w: 1200, h: 630, fit: 'crop' })
                        trackDownload(photo.links.download_location)
                    } else {
                        imageUrl = galleryUrls.length > 0 ? galleryUrls[i % galleryUrls.length] : undefined
                    }
                    if (imageUrl) {
                        const filename = `blog-${tenantId}-${seed.slug}.jpg`
                        thumbnailId = await uploadImageUrl(imageUrl, filename, seed.title, tenantId, payload)
                    }
                } catch (err) {
                    console.warn(`[seed-blog-posts] thumbnail "${seed.slug}" failed (non-fatal):`, (err as Error).message)
                }

                let richContent: string | undefined
                try {
                    richContent = await generateBlogPostContent(seed.title, businessName, industry ?? category)
                } catch {
                    // non-fatal: falls back to excerpt below
                }

                // Guard against re-seed slug collision (tenant deleted all posts and regenerated)
                let finalSlug = `${tenantId}-${seed.slug}`
                try {
                    const slugCheck = await payload.find({
                        collection: 'blogs',
                        where: { slug: { equals: finalSlug } },
                        limit: 1,
                    })
                    if (slugCheck.totalDocs > 0) {
                        finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 5)}`
                    }
                } catch {
                    // proceed with original slug; create will surface the error
                }

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
                    return 1
                } catch (err) {
                    console.warn(`[seed-blog-posts] post "${seed.slug}" failed (non-fatal):`, (err as Error).message)
                    return 0
                }
            })
        )

        return results.reduce<number>((acc, r) => acc + (r.status === 'fulfilled' ? r.value : 0), 0)
    } catch (err) {
        console.warn('[seed-blog-posts] skipped (non-fatal):', (err as Error).message)
        return 0
    }
}
