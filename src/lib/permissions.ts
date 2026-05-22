// Canonical list of custom-role permission IDs.
// Used by Users.ts (server-side write sanitization) and StaffDrawer.tsx (UI).
// Update here when adding new permissions — both consumers import from this module.
export type PermissionId = 'products' | 'orders' | 'blog' | 'builder' | 'settings'

// Set<string> so .has(unknownString) compiles without casting at call sites.
export const ALLOWED_PERMISSIONS: Set<string> = new Set<PermissionId>([
    'products',
    'orders',
    'blog',
    'builder',
    'settings',
])
