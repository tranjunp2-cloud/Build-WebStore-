import { NextResponse } from 'next/server'
import { tenantIdForQuery, withAuth } from '@/lib/auth'
import { feedbackTypesFor, isFeedbackWindowOpen, lookupTenantInfo } from '@/lib/feedback/feedback-availability'

export const dynamic = 'force-dynamic'

/** GET /api/v1/feedback/availability → `{ enabled, types[] }`; the header uses it to show the button and the mismatch type. */
export const GET = withAuth(async (user) => {
    const { isMigratedStore } = await lookupTenantInfo(tenantIdForQuery(user))
    return NextResponse.json({ enabled: isFeedbackWindowOpen(), types: feedbackTypesFor(isMigratedStore) })
})
