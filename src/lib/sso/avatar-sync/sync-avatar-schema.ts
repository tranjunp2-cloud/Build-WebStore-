import { z } from 'zod'

/**
 * Request body for POST /api/v1/sso/sync-avatar (GH-1723).
 * Contract: plans/261020-1358-gh-1723-sso-owner-avatar-sync/contract-sso-pw2-avatar-sync.md
 */
const baseFields = {
    sso_user_id: z.number().int().positive(),
    // Format is not re-validated here (SSO rules differ); only exact lookup on the one-time bind path
    email: z.string().trim().min(3).max(254),
    changed_at: z.string().datetime({ offset: true }),
    trigger: z.enum(['update', 'login', 'backfill']),
}

export const syncAvatarSchema = z.discriminatedUnion('state', [
    z.object({
        ...baseFields,
        state: z.literal('PRESENT'),
        avatar_url: z.string().url().max(2048),
        avatar_key: z.string().min(1).max(255),
    }),
    z.object({
        ...baseFields,
        state: z.literal('ABSENT'),
        avatar_url: z.null().optional(),
        avatar_key: z.null().optional(),
    }),
])

export type SyncAvatarInput = z.infer<typeof syncAvatarSchema>
