/**
 * Issues & Feedback — server component with initial data fetch.
 * Layout handled entirely by IssuesList (iss-page class).
 */
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { IssuesList } from './_components/issues-list'
import type { IssueRecord } from './_components/issue-types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Issues & Feedback' }

const LIMIT = 50

type IssuesPageProps = { searchParams: Promise<{ relatedType?: string; relatedId?: string }> }

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
    await requireSuperAdmin()

    const params = await searchParams
    const relatedType = params.relatedType === 'generation' ? params.relatedType : null
    const relatedId = typeof params.relatedId === 'string' && /^\d+$/.test(params.relatedId) ? params.relatedId : null
    const where: Where = relatedType && relatedId
        ? { and: [{ relatedType: { equals: relatedType } }, { relatedId: { equals: relatedId } }] }
        : {}

    const payload = await getPayload({ config })
    const result = await payload.find({
        collection: 'template-issues',
        where,
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
