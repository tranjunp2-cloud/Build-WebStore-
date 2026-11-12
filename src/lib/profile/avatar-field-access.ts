import type { FieldAccess } from 'payload'
import { isOwner } from './role-utils'

type AccessUser = {
    roles?: string[] | null
    tenants?: Array<{ role?: string | null }> | null
}

/**
 * Field-level update access for `users.avatar` (PD-F23-02, GH-1723).
 * Owner avatar is owned by SSO and only written by the server-side sync
 * (Local API with overrideAccess), so Owners cannot change it themselves.
 * Staff keep the local upload flow; super-admin keeps full access.
 */
export const canUpdateAvatarField: FieldAccess = ({ req }) => {
    const user = req.user as AccessUser | null | undefined
    if (!user) return false
    if (user.roles?.includes('super-admin')) return true
    return !isOwner({ tenants: (user.tenants ?? []).map((t) => ({ role: t.role ?? undefined })) })
}
