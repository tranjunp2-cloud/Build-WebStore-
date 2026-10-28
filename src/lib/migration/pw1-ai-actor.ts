import type { Payload } from 'payload'
import { isAiTasksEnabled } from '@/lib/ai-platform/config'
import { actorForUserInTenant, type AgentActor } from '@/lib/ai-platform/context'
import type { PlatformUser } from '@/types/user'

/**
 * The destination store owner acting in the migrated site's workspace, so the
 * migration's AI steps run (and bill) there. Null when AI can't run as them.
 */
export async function pw1MigrationActor(payload: Payload, ownerEmail: string, tenantId: number | string): Promise<AgentActor | null> {
    if (!isAiTasksEnabled()) return null
    const users = await payload.find({ collection: 'users', where: { email: { equals: ownerEmail } }, depth: 1, limit: 2 })
    if (users.docs.length !== 1) return null
    try {
        return actorForUserInTenant(users.docs[0] as unknown as PlatformUser, String(tenantId))
    } catch {
        return null
    }
}
