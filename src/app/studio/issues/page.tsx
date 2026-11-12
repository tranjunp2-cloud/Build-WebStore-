/**
 * Issues & Feedback — server component with initial data fetch.
 * Layout handled entirely by IssuesList (iss-page class).
 */
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { IssuesList } from './_components/issues-list'
import type { IssueRecord } from './_components/issue-types'
import { SAFE_RELATION_POPULATE } from '@/lib/payload/safe-populate'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Issues & Feedback' }

const LIMIT = 50

type IssuesPageProps = { searchParams: Promise<{ relatedType?: string; relatedId?: string }> }

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
    await requireStudioAccess()

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
        // The list goes whole into the client props: people as name / email, not user rows with their OTP hash,
        // SSO key and sessions (TC-PERF-137).
        populate: SAFE_RELATION_POPULATE,
    })

    return (
        <IssuesList
            initialIssues={result.docs as unknown as IssueRecord[]}
            initialTotal={result.totalDocs}
            initialPages={result.totalPages}
        />
    )
}
