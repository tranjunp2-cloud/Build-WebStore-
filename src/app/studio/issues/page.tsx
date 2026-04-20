/**
 * Issues & Feedback — server component with initial data fetch.
 * Layout handled entirely by IssuesList (iss-page class).
 */
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { getPayload } from 'payload'
import config from '@payload-config'
import { IssuesList } from './_components/issues-list'
import type { IssueRecord } from './_components/issue-types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Issues & Feedback' }

const LIMIT = 50

export default async function IssuesPage() {
    await requireSuperAdmin()

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'template-issues',
        limit: LIMIT,
        sort: '-createdAt',
        depth: 1,
    })

    return (
        <IssuesList
            initialIssues={result.docs as unknown as IssueRecord[]}
            initialTotal={result.totalDocs}
            initialPages={result.totalPages}
        />
    )
}
