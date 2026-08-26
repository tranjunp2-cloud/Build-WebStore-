import { getCurrentUser } from '@/lib/auth'
import AIBuilderPageClient from './AIBuilderPageClient'

/**
 * Server Component wrapper — resolves the current user's ID server-side
 * and passes it to the client component.
 *
 * This allows AIBuilderPageClient to detect cross-user localStorage
 * contamination (e.g. user A's builder session visible to user B on same browser)
 * and clear the store before rendering.
 */
export default async function AIBuilderPage() {
    const user = await getCurrentUser()
    const userId = user?.id ? String(user.id) : null

    return <AIBuilderPageClient userId={userId} />
}
