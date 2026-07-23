import type { BasePayload } from 'payload'
import { getBlogSeeds } from './content/blog-seeds'
import { generateBlogSeedsAI, generateBlogPostContent, isQuotaExhausted, type BlogSeedAI } from './generate-blog-seeds'
import { uploadImageUrl } from './upload-media'
import { getBlogThumbnails } from '@/lib/images/blog-thumbnail-images'
import { searchPhotos, PixabayError, PIXABAY_CATEGORY_BY_COMPOSER } from './pixabay-client'
import { normalizeComposerCategory } from './composer-category-resolver'
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
    const upload = (url: string) => uploadImageUrl(url, filename, seed.title, tenantId, payload)
    const keyword =
        ('imageKeyword' in seed && seed.imageKeyword) ||
        ('category' in seed && seed.category) ||
        category
    let wasRateLimited = false

    // Tier A: Pixabay search
    if (!searchRateLimited) {
        try {
            // GH-1185: site-domain filter — blog topics follow the site's
            // industry, so a loose keyword match still lands on-domain.
            const pixCategory = PIXABAY_CATEGORY_BY_COMPOSER[normalizeComposerCategory(category)]
            const photos = await searchPhotos(keyword, 1, {
                orientation: 'landscape',
                width: 1200,
                category: pixCategory,
                timeoutMs: 6_000,
            })
            if (photos.length > 0) {
                const photo = photos[0]!
                // photo.url is already sized by the client (Pixabay fixed sizes).
                const id = await upload(photo.url)
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
        const id = await upload(fallbackUrl)
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

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

export function buildFallbackBlogContent(seed: Pick<AnyBlogSeed, 'title' | 'excerpt'>, businessName: string): string {
    const title = escapeHtml(seed.title)
    const excerpt = escapeHtml(seed.excerpt)
    const name = escapeHtml(businessName)
    return `<h2>${title}</h2><p>${excerpt}</p><h3>Why it matters</h3><p>${name} focuses on practical choices, clear expectations, and dependable results. Use this guide as a starting point, then choose the option that best matches your needs.</p><h3>What to consider</h3><ul><li>Define the outcome you need before comparing options.</li><li>Ask questions about quality, timing, and ongoing support.</li><li>Choose a solution that remains useful as your needs change.</li></ul><h3>Next steps</h3><p>Contact ${name} for advice tailored to your situation and a clear path forward.</p>`
}

export type PreparedBlogPost = {
    title: string
    slug: string
    content: string
    thumbnailId?: number
}

/**
 * Phase 1 — no site dependency: AI seed topics + full article bodies (3
 * parallel GPT calls, 12s-bounded each) + thumbnails. gen-perf blog-inline:
 * the route kicks this DURING the site GPT window so `persistBlogPosts` can
 * insert all 3 posts BEFORE the `done` event; also reused by the fallback
 * `seedBlogPosts` path.
 * Returns [] when the current site already has three complete posts, null
 * when preparation failed entirely. Never throws.
 */
export async function prepareBlogPosts(opts: {
    payload: BasePayload
    tenantId: number | string
    category: string
    businessName: string
    products?: string[]
    industry?: string
    seed?: number
    /** Existing site being regenerated. Only complete posts for this site
     *  count toward the three-post target. */
    siteId?: number | string
    /** Settles when the request's other Pixabay consumers (image pool,
     *  sample products) finished searching — the thumbnail phase waits for
     *  it so blog searches never compete for the rate limit (GH-1190). */
    pixabayGate?: Promise<unknown>
}): Promise<PreparedBlogPost[] | null> {
    const { payload, tenantId, category, businessName, products, industry, seed, siteId } = opts
    try {
        let targetCount = 3
        if (siteId !== undefined) {
            const existing = await payload.count({
                collection: 'blogs',
                where: {
                    and: [
                        { tenant: { equals: tenantId } },
                        { site: { equals: siteId } },
                        { content: { exists: true } },
                        { thumbnail: { exists: true } },
                    ],
                },
            })
            targetCount = Math.max(0, 3 - existing.totalDocs)
            if (targetCount === 0) return []
        }

        let seeds: AnyBlogSeed[] = []
        try {
            const aiSeeds = await generateBlogSeedsAI({
                businessName,
                industry: industry ?? category,
                products,
            })
            seeds = aiSeeds.slice(0, targetCount)
        } catch (err) {
            if (isQuotaExhausted(err)) {
                console.warn('[seed-blog-posts] OpenAI quota exhausted, using static seeds')
            } else {
                console.warn('[seed-blog-posts] AI gen failed, using static seeds:', (err as Error).message)
            }
        }

        if (seeds.length < targetCount) {
            const need = targetCount - seeds.length
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

        // Article bodies are independent of Pixabay — start all 3 GPT calls
        // now so they overlap the thumbnail phase below.
        const contentPromises = seeds.map((s) =>
            generateBlogPostContent(s.title, businessName, industry ?? category).catch(() => undefined),
        )

        // Thumbnails keep the legacy sequencing (one at a time, 500ms apart,
        // rate-limit short-circuit) — gentle on Pixabay, and gated behind the
        // request's other Pixabay consumers (GH-1190).
        if (opts.pixabayGate) await opts.pixabayGate.catch(() => undefined)

        // Per-category landscape fallbacks (1200×630) — one distinct image per seed index.
        const blogThumbnails = getBlogThumbnails(category)
        const firstThumbnail = await fetchBlogThumbnail(
            seeds[0]!, 0, blogThumbnails, tenantId, category, false, payload,
        )
        console.log(`[seed-blog-posts] blog 1/${seeds.length} "${seeds[0]!.slug}" → thumbnailId=${firstThumbnail.thumbnailId ?? 'none'}`)
        const remainingThumbnails = await Promise.all(seeds.slice(1).map(async (seed, offset) => {
            const i = offset + 1
            const { thumbnailId } = await fetchBlogThumbnail(
                seed, i, blogThumbnails, tenantId, category, firstThumbnail.wasRateLimited, payload,
            )
            console.log(`[seed-blog-posts] blog ${i + 1}/${seeds.length} "${seed.slug}" → thumbnailId=${thumbnailId ?? 'none'}`)
            return thumbnailId
        }))
        const thumbnailIds = [firstThumbnail.thumbnailId, ...remainingThumbnails]

        const contents = await Promise.all(contentPromises)
        return seeds.map((s, i) => ({
            title: s.title,
            slug: s.slug,
            content: contents[i] ?? buildFallbackBlogContent(s, businessName),
            ...(thumbnailIds[i] !== undefined ? { thumbnailId: thumbnailIds[i] } : {}),
        }))
    } catch (err) {
        console.warn('[seed-blog-posts] prepare failed (non-fatal):', (err as Error).message)
        return null
    }
}

/**
 * Phase 2 — needs the created site: insert the prepared posts. Split from
 * prepare so the route can run it inline before `done`. Never throws;
 * per-post failures are logged and skipped.
 */
export async function persistBlogPosts(
    payload: BasePayload,
    prepared: PreparedBlogPost[],
    tenantId: number | string,
    siteId: number | string,
    userId: number | string,
): Promise<number> {
    let count = 0
    for (const post of prepared) {
        // Guard against re-seed slug collision (tenant deleted all posts and regenerated)
        let finalSlug = `${tenantId}-${post.slug}`
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
                    title: post.title,
                    slug: finalSlug,
                    content: post.content,
                    status: 'published',
                    publishedAt: new Date().toISOString(),
                    author: userId,
                    ...(post.thumbnailId !== undefined ? { thumbnail: post.thumbnailId } : {}),
                },
                context: { skipPublishNotify: true },
            })
            count++
        } catch (err) {
            console.warn(`[seed-blog-posts] post "${post.slug}" failed (non-fatal):`, (err as Error).message)
        }
    }
    return count
}

/** Legacy single-shot fallback: prepare + persist. */
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
    const prepared = await prepareBlogPosts({
        payload, tenantId, siteId, category, businessName, products, industry, seed,
    })
    if (!prepared || prepared.length === 0) return 0
    return persistBlogPosts(payload, prepared, tenantId, siteId, userId)
}
