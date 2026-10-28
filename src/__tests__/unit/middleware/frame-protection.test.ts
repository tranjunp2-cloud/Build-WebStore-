// @vitest-environment node
/**
 * TC-AISEC-059 (clickjacking) — the dashboard and the site editor answer with `Content-Security-Policy:
 * frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` on the platform host, so only this origin can frame them.
 * Storefronts keep no such header even on the same paths (a shop's subdomain, a custom domain, `/sites/<slug>`), and
 * neither do the pages the app itself frames (`/preview/<siteId>`) or public pages.
 * Real: middleware.ts, frame-protection.ts. Faked: the slug / domain lookups the middleware makes (fetch).
 */
import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FRAME_PROTECTION_HEADERS, isFrameProtectedPath } from '@/lib/auth/frame-protection'
import { middleware } from '@/middleware'

const SECRET = 'frame-test-secret'
let token = ''
const signedIn = (host: string, path: string) =>
    middleware(new NextRequest(`https://${host}${path}`, { headers: { host, cookie: `payload-token=${token}` } }))
const framing = (res: Response) => ({ csp: res.headers.get('content-security-policy'), xfo: res.headers.get('x-frame-options') })

beforeEach(async () => {
    process.env.PAYLOAD_SECRET = SECRET
    token = await new SignJWT({ email: 'owner@shop.my', mfa_verified: true }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(SECRET))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })))
})
afterEach(() => {
    vi.unstubAllGlobals()
})

describe('dashboard and editor may only be framed by this origin [TC-AISEC-059]', () => {
    it.each(['/dashboard', '/orders', '/orders/123', '/products/new', '/contact-leads', '/settings/payments', '/media', '/blog', '/sites', '/editor/12', '/customers', '/discounts', '/help'])(
        '%s on the platform host gets frame-ancestors \'self\' and SAMEORIGIN',
        async (path) => {
            // Act
            const res = await signedIn('localhost', path)

            // Assert
            expect(res.status).toBe(200)
            expect(framing(res)).toEqual({ csp: FRAME_PROTECTION_HEADERS['Content-Security-Policy'], xfo: 'SAMEORIGIN' })
        },
    )

    it.each([
        ['the editor\'s preview frame', 'localhost', '/preview/12'],
        ['a public page', 'localhost', '/'],
        ['a local storefront path', 'localhost', '/sites/kedai/products'],
        ['a shop subdomain with a dashboard-like path', 'kedai.primeweb.app', '/products'],
        ['a custom domain with a dashboard-like path', 'shop.kedai.my', '/orders/ORD-1'],
    ])('%s keeps no framing header', async (_case, host, path) => {
        // Act
        const res = await signedIn(host, path)

        // Assert
        expect(framing(res)).toEqual({ csp: null, xfo: null })
    })

    it('matches whole path segments only', () => {
        // Act + Assert
        expect(isFrameProtectedPath('/orders/')).toBe(true)
        expect(isFrameProtectedPath('/ordersx')).toBe(false)
        expect(isFrameProtectedPath('/sites/kedai')).toBe(false)
        expect(isFrameProtectedPath('/preview/12')).toBe(false)
    })
})
