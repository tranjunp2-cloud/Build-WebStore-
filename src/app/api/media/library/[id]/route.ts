import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { authUnavailableResponse, getCurrentUser, isAuthUnavailableError } from '@/lib/auth'
import { canWriteMedia } from '@/lib/media/media-access'

/**
 * DELETE /api/media/library/{id} — Delete on the dashboard Media page (GH-2187, TC-PERF-191..193).
 *
 * The page used to call Payload REST (`DELETE /api/media/{id}`), which only accepts tokens Payload signs itself; the
 * app's post-OTP session token is not one, so shop owners got 403 on their own files. This route reads the app
 * session instead (getCurrentUser: OTP gate, same-site Origin required for a cookie session) and deletes through
 * the Local API as that user, so Media delete access (`mediaWriteAccess`) still decides.
 * - Own-tenant files: deleted (the storage adapter removes the object as with any Payload delete).
 * - Legacy files without a tenant, another shop's files: 403 (the library shows the first with Delete locked,
 *   TC-PERF-187/188).
 * - Private rows (buyer payment receipts): 403. The library never lists them; the order keeps them as evidence.
 */
const NO_STORE = { 'Cache-Control': 'private, no-store' }

type LibraryMedia = { id: number | string; tenant?: unknown; private?: boolean | null }

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: NO_STORE })

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    let user: Awaited<ReturnType<typeof getCurrentUser>>
    try {
        user = await getCurrentUser(req)
    } catch (error) {
        if (isAuthUnavailableError(error)) return authUnavailableResponse()
        throw error
    }
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { id: rawId } = await params
    if (!/^\d{1,15}$/.test(rawId)) return json({ error: 'Not found' }, 404)
    const id = Number(rawId)

    const payload = await getPayload({ config })
    const media = (await payload.findByID({
        collection: 'media',
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        select: { tenant: true, private: true },
    } as Parameters<typeof payload.findByID>[0])) as LibraryMedia | null
    if (!media) return json({ error: 'Not found' }, 404)
    if (media.private === true || !canWriteMedia(user, media.tenant)) {
        return json({ error: 'You cannot delete this file.' }, 403)
    }

    try {
        // overrideAccess: false — Media delete access runs again for this user (own tenant only).
        await payload.delete({ collection: 'media', id, user, overrideAccess: false, depth: 0 })
    } catch (error) {
        const status = (error as { status?: unknown })?.status
        if (status === 403 || status === 404) return json({ error: 'You cannot delete this file.' }, 403)
        console.error('[/api/media/library] Failed to delete media:', error instanceof Error ? error.message : error)
        return json({ error: 'Delete failed' }, 500)
    }
    return json({ ok: true, id }, 200)
}
