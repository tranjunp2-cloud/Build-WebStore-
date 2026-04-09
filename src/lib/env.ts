/**
 * Check if current environment is staging.
 * Works on both client (NEXT_PUBLIC_*) and server.
 * Default: false (production behavior when not set)
 */
export function isStaging(): boolean {
    return process.env.NEXT_PUBLIC_APP_ENV === 'staging'
}

/**
 * Server-only guard — throws if not staging.
 * Use in API routes for double protection.
 */
export function assertStaging(): void {
    if (!isStaging()) {
        throw new Error('This action is only available in staging environment')
    }
}
