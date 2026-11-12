import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { authUnavailableResponse, getCurrentUser, isAuthUnavailableError, tenantIdForQuery } from '@/lib/auth'
import { listWorkspaceMediaLibrary } from '@/lib/media/workspace-media-library'
import { canWriteMedia } from '@/lib/media/media-access'

/**
 * GET /api/media/library — the dashboard Media page: the current workspace's files (plus legacy files its sites,
 * pages, products and blogs use), newest first, never private receipts and never another shop's files
 * (TC-PERF-168). Signed-in only. Each row carries `canDelete`: false for legacy files without a tenant, which the
 * shop sees but may not delete (media write access is own-tenant rows only) — TC-PERF-187.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: Request) {
    let user: Awaited<ReturnType<typeof getCurrentUser>>
    try {
        user = await getCurrentUser(req)
    } catch (error) {
        if (isAuthUnavailableError(error)) return authUnavailableResponse()
        throw error
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })

    const tenantId = tenantIdForQuery(user)
    if (tenantId == null) return NextResponse.json({ docs: [] }, { headers: NO_STORE })

    const payload = await getPayload({ config })
    const rows = await listWorkspaceMediaLibrary(payload, tenantId)
    const docs = rows.map((row) => ({ ...row, canDelete: canWriteMedia(user, row.tenant) }))
    return NextResponse.json({ docs }, { headers: NO_STORE })
}
