import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

async function loadPortalUrl(): Promise<string> {
    vi.resetModules()
    return (await import('@/config/app-switcher')).SSO_PORTAL_URL
}

describe('SSO_PORTAL_URL', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_SSO_BASE_URL', '')
    })
    afterEach(() => vi.unstubAllEnvs())

    it('production default is the unifi.com.my portal', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')
        expect(await loadPortalUrl()).toBe('https://sso.ecommercehub.unifi.com.my/')
    })

    it('staging default is the dev portal', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging')
        expect(await loadPortalUrl()).toBe('https://sso.dev.ecommercehub.my/')
    })

    it('unknown env falls back to production portal', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
        expect(await loadPortalUrl()).toBe('https://sso.ecommercehub.unifi.com.my/')
    })

    it('NEXT_PUBLIC_SSO_BASE_URL overrides the per-env default and gets a trailing slash', async () => {
        vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')
        vi.stubEnv('NEXT_PUBLIC_SSO_BASE_URL', 'https://sso.custom.test')
        expect(await loadPortalUrl()).toBe('https://sso.custom.test/')
    })
})
