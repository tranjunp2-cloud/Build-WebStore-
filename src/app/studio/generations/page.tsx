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
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { GenerationsLiveFeed } from './_components/generations-live-feed'
import type { GenerationsListResponse } from './_components/generation-types'

export const metadata: Metadata = { title: 'User Generations' }

export default async function GenerationsPage() {
    await requireSuperAdmin()

    const initialData: GenerationsListResponse = {
        items: [],
        meta: {
            totalDocs: 0,
            limit: 50,
            hasNextPage: false,
            hasPrevPage: false,
        },
    }

    return <GenerationsLiveFeed initialData={initialData} />
}
