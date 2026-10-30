import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, tenantIdForQuery } from '@/lib/auth'
import { generationBlockReason } from '@/lib/ai/generation-in-progress'
import AIBuilderPageClient from './AIBuilderPageClient'

/**
 * Server Component wrapper — resolves the current user's ID server-side
 * and passes it to the client component.
 *
 * This allows AIBuilderPageClient to detect cross-user localStorage
 * contamination (e.g. user A's builder session visible to user B on same browser)
 * and clear the store before rendering.
 *
 * GH-2153: an account that already has a generated website (or one being generated) must not reach the
 * builder — generating again replaces every page of the live site. A failed site still can: this route is
 * its "try again with AI" path. The generate-site API enforces the same rule; this only saves the click.
 */
export default async function AIBuilderPage() {
    const user = await getCurrentUser()
    const userId = user?.id ? String(user.id) : null

    const tenantId = tenantIdForQuery(user)
    if (tenantId) {
        const payload = await getPayload({ config })
        const sites = await payload.find({
            collection: 'sites',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { generationStatus: { in: ['completed', 'generating'] } },
                ],
            },
            limit: 10,
            depth: 0,
            select: { generationStatus: true, updatedAt: true },
        })
        const reasons = sites.docs.map((site) => generationBlockReason(site))
        if (reasons.includes('in_progress')) redirect('/dashboard?ai_status=generating')
        if (reasons.includes('site_exists')) redirect('/dashboard')
    }

    return <AIBuilderPageClient userId={userId} />
}
