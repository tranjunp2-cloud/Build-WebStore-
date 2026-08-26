import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { revalidatePath } from 'next/cache'
import { generateAutoSEOMeta } from './generate-meta'

export async function queueSEOAutoGeneration(
    collection: 'pages' | 'products',
    docId: string | number,
    siteId: string | number,
    name: string,
    context?: string
) {
    // We do NOT await this function in the hook so it acts as a background processor.
    backgroundSeoProcessor(collection, docId, siteId, name, context).catch((err) => {
        console.error('[SEO Queue] Unhandled background error:', err)
    })
}

async function backgroundSeoProcessor(
    collection: 'pages' | 'products',
    docId: string | number,
    siteId: string | number,
    name: string,
    context?: string
) {
    const payload = await getPayload({ config: configPromise })

    let jobId: string | number | null = null

    try {
        // 1. Fetch site name
        const site = await payload.findByID({
            collection: 'sites',
            id: siteId,
        })
        const siteName = site.businessName || site.name || 'Website'

        // Fetch tracked keywords (AC-15)
        const trackedKeywords = ((site as any)?.seo?.trackedKeywords as Array<{ keyword: string }> | undefined)
            ?.map(k => k.keyword).filter(Boolean) || []

        // 2. Create pending job
        const job = await payload.create({
            collection: 'seo-meta-jobs',
            data: {
                targetCollection: collection,
                targetId: String(docId),
                site: siteId,
                status: 'pending',
                retryCount: 0,
            },
        })
        jobId = job.id

        // 3. Generate Meta
        const { title, description } = await generateAutoSEOMeta(
            collection === 'products' ? 'product' : 'page',
            name,
            siteName,
            context,
            trackedKeywords,
        )

        // 4. Update the target collection
        await payload.update({
            collection,
            id: docId,
            data: {
                seo: {
                    title,
                    description,
                },
            },
        })

        // 5. Mark Job as Completed
        await payload.update({
            collection: 'seo-meta-jobs',
            id: jobId,
            data: {
                status: 'completed',
            },
        })

        // 6. Revalidate sitemap
        revalidatePath('/sitemap.xml')
        revalidatePath(`/(frontend)/sites/[slug]/sitemap.xml`, 'page')
    } catch (error: any) {
        // Log error to Job Collection
        if (jobId) {
            await payload.update({
                collection: 'seo-meta-jobs',
                id: jobId,
                data: {
                    status: 'failed',
                    errorLog: error.message || 'Unknown error occurred',
                },
            })
        }
    }
}
