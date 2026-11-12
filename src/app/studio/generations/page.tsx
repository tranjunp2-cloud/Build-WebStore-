/**
 * /studio/generations — User Generations live feed.
 * Server component: authorizes the Operations page and passes an empty shell to
 * the client. The client then uses the same bounded/keyset API as every later
 * page. Do not add a separate SSR query here: the former "latest 100" query
 * scanned and re-sorted documents in memory, which could hide older incidents.
 * Layout handled entirely by GenerationsLiveFeed (gen-page class).
 */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { GenerationsLiveFeed } from './_components/generations-live-feed'
import type { GenerationsListResponse } from './_components/generation-types'

export const metadata: Metadata = { title: 'User Generations' }

export default async function GenerationsPage() {
    await requireStudioAccess()

    const initialData: GenerationsListResponse = {
        items: [],
        meta: {
            totalDocs: 0,
            limit: 50,
            hasNextPage: false,
            hasPrevPage: false,
        },
        overview: {
            total: 0,
            needsAttention: 0,
            retryable: 0,
            retrying: 0,
            ticketRequired: 0,
            succeeded: 0,
            running: 0,
        },
    }

    return <GenerationsLiveFeed initialData={initialData} />
}
