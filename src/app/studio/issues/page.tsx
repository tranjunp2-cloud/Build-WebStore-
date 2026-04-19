/**
 * Issues & Feedback — server component with initial data fetch.
 * Renders IssuesList client component for interactivity.
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
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-lg font-semibold">Issues & Feedback</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Internal tracker for template, block, and generation quality issues.
                    </p>
                </div>
            </div>
            <IssuesList
                initialIssues={result.docs as unknown as IssueRecord[]}
                initialTotal={result.totalDocs}
                initialPages={result.totalPages}
            />
        </div>
    )
}
