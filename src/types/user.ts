/** Typed representation of our Users collection fields */
export type PlatformUser = {
    id: string
    email: string
    firstName?: string
    lastName?: string
    phone?: string
    roles?: ('super-admin' | 'tenant-owner' | 'editor' | 'viewer')[]
    tenants?: Array<{
        tenant: string | { id: string; name?: string; slug?: string }
        role: 'owner' | 'admin' | 'editor' | 'viewer'
    }>
    avatar?: string | { url: string }
    lastLoginAt?: string
    createdAt: string
    updatedAt: string
    has_seen_ai_wizard?: boolean
}
