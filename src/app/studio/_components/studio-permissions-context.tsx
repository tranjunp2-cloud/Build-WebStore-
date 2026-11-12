'use client'

/**
 * Tells Studio client components who is looking, so they can hide controls the user cannot use.
 * Only cosmetic: every API route enforces the same table in src/lib/admin/studio-permissions.ts.
 */
import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { hasStudioPermission, type StudioPermission } from '@/lib/admin/studio-permissions'

// Without a provider (isolated component tests) nothing is hidden; the API still refuses.
const StudioRolesContext = createContext<readonly string[]>(['super-admin'])

export function StudioPermissionsProvider({ roles, children }: { roles: readonly string[]; children: ReactNode }) {
    return <StudioRolesContext.Provider value={roles}>{children}</StudioRolesContext.Provider>
}

export function useStudioRoles(): readonly string[] {
    return useContext(StudioRolesContext)
}

export function useStudioCan(): (permission: StudioPermission) => boolean {
    const roles = useStudioRoles()
    return useCallback((permission) => hasStudioPermission(roles, permission), [roles])
}

/** Renders children only when the user holds the permission. */
export function StudioCan({ permission, children }: { permission: StudioPermission; children: ReactNode }) {
    return useStudioCan()(permission) ? <>{children}</> : null
}
