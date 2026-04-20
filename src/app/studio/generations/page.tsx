/**
 * /studio/generations — User Generations live feed.
 * Server component: fetches first 50 records, passes to client feed.
 * Client feed polls every 10s for updates.
 * Layout handled entirely by GenerationsLiveFeed (gen-page class).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { GenerationsLiveFeed } from './_components/generations-live-feed'
import type { GenerationsListResponse } from './_components/generation-types'

export const metadata: Metadata = { title: 'User Generations' }

export default async function GenerationsPage() {
    await requireSuperAdmin()

    const payload = await getPayload({ config })

    const result = await payload.find({
        collection: 'ai-generation-records',
        sort: '-createdAt',
        limit: 50,
        depth: 1,
    })

    const initialData: GenerationsListResponse = {
        data: result.docs as GenerationsListResponse['data'],
        meta: {
            totalDocs: result.totalDocs,
            totalPages: result.totalPages,
            page: result.page ?? 1,
            limit: result.limit,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
        },
    }

    return <GenerationsLiveFeed initialData={initialData} />
}
