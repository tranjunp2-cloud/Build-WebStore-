import { expect, type Browser, type BrowserContext } from '@playwright/test'

export interface SuperAdminCredentials {
    email: string
    password: string
}

/**
 * ADMIN_EMAIL / ADMIN_PASSWORD (CI: BOOTSTRAP_ADMIN_* secrets). CI fails closed when
 * they are missing; a local run gets null so the caller can skip.
 */
export function readSuperAdminCredentials(): SuperAdminCredentials | null {
    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD
    if (email && password) return { email, password }
    if (process.env.CI) {
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured for super-admin E2E checks')
    }
    return null
}

/**
 * Browser context signed in as the super-admin, with none of the project's
 * storageState: auth.setup.ts saves the TEST_EMAIL tenant-owner session, and that
 * cookie would otherwise ride along and turn every Studio call into a 403.
 *
 * Password login on purpose: the E2E OTP bypass never applies to super-admins, and
 * app routes still accept a super-admin's password-step token (TC-PERF-142).
 * The context keeps the config's baseURL and Origin header.
 */
export async function createSuperAdminContext(
    browser: Browser,
    credentials: SuperAdminCredentials,
): Promise<BrowserContext> {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const login = await context.request.post('/api/users/login', { data: credentials })
    expect(login.status(), 'ADMIN_EMAIL / ADMIN_PASSWORD were rejected by /api/users/login').toBe(200)
    const body = (await login.json()) as { user?: { roles?: string[] } }
    expect(body.user?.roles, 'ADMIN_EMAIL must be a super-admin').toContain('super-admin')
    return context
}
