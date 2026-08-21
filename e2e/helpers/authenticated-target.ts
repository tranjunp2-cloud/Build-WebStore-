export const LOCAL_E2E_ORIGIN = 'http://localhost:3000'
export const LIVE_STAGING_E2E_ORIGIN = 'https://web-v2.dev.ecommercehub.my'

const ALLOWED_AUTHENTICATED_E2E_ORIGINS = new Set([
    LOCAL_E2E_ORIGIN,
    LIVE_STAGING_E2E_ORIGIN,
])

export function isAllowedAuthenticatedE2ETarget(baseURL: unknown): boolean {
    if (typeof baseURL !== 'string') return false

    try {
        return ALLOWED_AUTHENTICATED_E2E_ORIGINS.has(new URL(baseURL).origin)
    } catch {
        return false
    }
}

export function assertAllowedAuthenticatedE2ETarget(baseURL: unknown): asserts baseURL is string {
    if (!isAllowedAuthenticatedE2ETarget(baseURL)) {
        throw new Error(
            `Refusing authenticated E2E against an unapproved target. `
            + `Use ${LOCAL_E2E_ORIGIN} or ${LIVE_STAGING_E2E_ORIGIN}.`,
        )
    }
}
