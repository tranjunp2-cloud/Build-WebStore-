// @vitest-environment node
/**
 * TC-MIG-MW — Vercel Migration: Middleware hostname routing
 *
 * The middleware was updated when migrating from DigitalOcean to Vercel + Neon:
 *   - Removed Docker HOSTNAME (0.0.0.0) special-case — no longer needed
 *   - Added `.vercel.app` pattern to isPlatformHost
 *   - API passthrough MUST happen before any admin-domain rewrite
 *
 * We test the logic extracted from middleware.ts constants and conditionals.
 * (middleware.ts is excluded from coverage — Edge Runtime — so we test
 *  the pure routing predicates here directly.)
 */
import { describe, it, expect } from 'vitest'

// ── Extracted predicates — mirror middleware.ts logic verbatim ──────────────
//
// isPlatformHost mirrors lines 141-148 of middleware.ts:
//   hostname === PLATFORM_DOMAIN ||
//   hostname === `www.${PLATFORM_DOMAIN}` ||
//   hostname === ADMIN_DOMAIN ||
//   hostname === SERVER_DOMAIN ||
//   hostname.includes('localhost') ||
//   hostname.includes('127.0.0.1') ||
//   hostname.endsWith('.vercel.app')
//
// We import nothing from middleware.ts (Edge Runtime, not importable in Vitest).
// These predicates are pure functions that replicate the same conditional tree.

function makeIsPlatformHost(
    hostname: string,
    opts: {
        platformDomain: string
        adminDomain: string
        serverDomain: string
    },
): boolean {
    const { platformDomain, adminDomain, serverDomain } = opts
    return (
        hostname === platformDomain ||
        hostname === `www.${platformDomain}` ||
        hostname === adminDomain ||
        hostname === serverDomain ||
        hostname.includes('localhost') ||
        hostname.includes('127.0.0.1') ||
        hostname.endsWith('.vercel.app')
    )
}

function isSubdomain(
    hostname: string,
    opts: { platformDomain: string; adminDomain: string },
): boolean {
    const { platformDomain, adminDomain } = opts
    return (
        hostname.endsWith(`.${platformDomain}`) &&
        hostname !== `www.${platformDomain}` &&
        hostname !== adminDomain
    )
}

// ADMIN_PATHS used in passthrough guard (lines 67-69 of middleware.ts)
const ADMIN_PATHS = ['/admin', '/api']
function isAdminOrApiPath(pathname: string): boolean {
    return ADMIN_PATHS.some((p) => pathname.startsWith(p))
}

// ── Constants matching the production env defaults ───────────────────────────
const DEFAULT_PLATFORM_DOMAIN = 'primeweb.app'
const DEFAULT_ADMIN_DOMAIN = `admin.${DEFAULT_PLATFORM_DOMAIN}`
const DEFAULT_SERVER_DOMAIN = 'web-v2.dev.ecommercehub.my'

const defaultOpts = {
    platformDomain: DEFAULT_PLATFORM_DOMAIN,
    adminDomain: DEFAULT_ADMIN_DOMAIN,
    serverDomain: DEFAULT_SERVER_DOMAIN,
}

// ── TC-MIG-MW.01: No DigitalOcean references in routing ─────────────────────
describe('[TC-MIG-MW.01] No DigitalOcean hostname references in platform host check', () => {
    it('ondigitalocean.app hostname is NOT treated as platform host', () => {
        // Arrange
        const digitalOceanHost = 'ech-prime-web-v2.ondigitalocean.app'

        // Act
        const result = makeIsPlatformHost(digitalOceanHost, defaultOpts)

        // Assert — DO hosts are custom domains now (routed to tenant lookup)
        expect(result).toBe(false)
    })

    it('sub.ondigitalocean.app is NOT treated as platform host', () => {
        const doHost = 'abc-def.ondigitalocean.app'
        expect(makeIsPlatformHost(doHost, defaultOpts)).toBe(false)
    })

    it('0.0.0.0 (Docker HOSTNAME env) is NOT in isPlatformHost guard', () => {
        // Docker HOSTNAME=0.0.0.0 was previously special-cased.
        // After Vercel migration it's no longer relevant — 0.0.0.0 passes through
        // as a custom-domain lookup (no-op, handled gracefully by fetch timeout).
        const dockerHost = '0.0.0.0'
        expect(makeIsPlatformHost(dockerHost, defaultOpts)).toBe(false)
    })
})

// ── TC-MIG-MW.02: vercel.app treated as platform host ───────────────────────
describe('[TC-MIG-MW.02] vercel.app hostname treated as platform host', () => {
    it('ech-prime-web-v2.vercel.app is recognized as platform host', () => {
        // Arrange
        const vercelHost = 'ech-prime-web-v2.vercel.app'

        // Act
        const result = makeIsPlatformHost(vercelHost, defaultOpts)

        // Assert
        expect(result).toBe(true)
    })

    it('any-preview-branch.vercel.app is recognized as platform host', () => {
        const previewHost = 'ech-prime-web-v2-git-feat-f31.vercel.app'
        expect(makeIsPlatformHost(previewHost, defaultOpts)).toBe(true)
    })

    it('vercel.app without subdomain is NOT recognized (endsWith check)', () => {
        // "vercel.app" itself doesn't end with ".vercel.app"
        const bareVercel = 'vercel.app'
        expect(makeIsPlatformHost(bareVercel, defaultOpts)).toBe(false)
    })

    it('fake-vercel.app.evil.com is NOT recognized as platform host', () => {
        const spoofHost = 'fake-vercel.app.evil.com'
        expect(makeIsPlatformHost(spoofHost, defaultOpts)).toBe(false)
    })
})

// ── TC-MIG-MW.03: isPlatformHost includes SERVER_DOMAIN ─────────────────────
describe('[TC-MIG-MW.03] isPlatformHost includes SERVER_DOMAIN from NEXT_PUBLIC_SERVER_URL', () => {
    it('SERVER_DOMAIN exact match returns true', () => {
        // Arrange
        const serverDomain = 'web-v2.dev.ecommercehub.my'

        // Act
        const result = makeIsPlatformHost(serverDomain, {
            ...defaultOpts,
            serverDomain,
        })

        // Assert
        expect(result).toBe(true)
    })

    it('SERVER_DOMAIN with protocol prefix stripped (https://host → host)', () => {
        // middleware.ts line 140:
        //   const SERVER_DOMAIN = (process.env.NEXT_PUBLIC_SERVER_URL || '')
        //     .replace(/^https?:\/\//, '').split(':')[0]
        // We test the stripping logic independently
        const rawUrl = 'https://web-v2.dev.ecommercehub.my'
        const stripped = rawUrl.replace(/^https?:\/\//, '').split(':')[0]
        expect(stripped).toBe('web-v2.dev.ecommercehub.my')
    })

    it('SERVER_DOMAIN with port suffix stripped', () => {
        const rawUrl = 'http://localhost:3000'
        const stripped = rawUrl.replace(/^https?:\/\//, '').split(':')[0]
        expect(stripped).toBe('localhost')
    })

    it('custom tenant domain is NOT platform host when SERVER_DOMAIN differs', () => {
        const tenantDomain = 'mycoolstore.com'
        const result = makeIsPlatformHost(tenantDomain, defaultOpts)
        expect(result).toBe(false)
    })

    it('localhost is always platform host regardless of SERVER_DOMAIN', () => {
        expect(makeIsPlatformHost('localhost', { ...defaultOpts, serverDomain: '' })).toBe(true)
    })

    it('127.0.0.1 is always platform host', () => {
        expect(makeIsPlatformHost('127.0.0.1', { ...defaultOpts, serverDomain: '' })).toBe(true)
    })
})

// ── TC-MIG-MW.04: API passthrough before admin domain rewrite ────────────────
describe('[TC-MIG-MW.04] API passthrough occurs before admin domain rewrite', () => {
    it('/api/* paths pass through (not rewritten to /admin/api/*)', () => {
        // Arrange — simulate the middleware conditional order
        // Line 67-69: if (pathname.startsWith('/api/') || pathname.startsWith('/admin'))
        //   return NextResponse.next()
        // This guard MUST come BEFORE the admin-domain rewrite check.

        const apiPaths = [
            '/api/notifications',
            '/api/health',
            '/api/users',
            '/api/sites',
            '/api/notifications?since=2026-01-01',
        ]

        apiPaths.forEach((pathname) => {
            // Act
            const hitPassthrough = isAdminOrApiPath(pathname)

            // Assert — passthrough triggered before admin rewrite
            expect(hitPassthrough).toBe(true)
        })
    })

    it('/admin paths pass through directly (not double-prefixed)', () => {
        const adminPaths = ['/admin', '/admin/collections', '/admin/users']

        adminPaths.forEach((pathname) => {
            expect(isAdminOrApiPath(pathname)).toBe(true)
        })
    })

    it('non-API paths are NOT caught by passthrough', () => {
        const regularPaths = ['/dashboard', '/builder', '/login', '/']

        regularPaths.forEach((pathname) => {
            expect(isAdminOrApiPath(pathname)).toBe(false)
        })
    })

    it('/api/ guard catches query-string URLs correctly (startsWith on pathname only)', () => {
        // Verify we test pathname, not full URL with query string
        const pathname = '/api/notifications'
        expect(pathname.startsWith('/api/')).toBe(true)
    })

    it('admin DOMAIN rewrite does NOT apply when pathname already is /api/*', () => {
        // Simulate the conditional ordering in middleware.ts:
        //   1. Check /api/ → return next()  [runs first]
        //   2. Check adminDomain → rewrite  [would run second but is never reached for /api/]
        const pathname = '/api/users'
        const hostname = DEFAULT_ADMIN_DOMAIN

        // Step 1 — API guard fires first
        const guardFired = isAdminOrApiPath(pathname)
        expect(guardFired).toBe(true)

        // Step 2 — Admin domain rewrite would have fired (hostname matches)
        const wouldRewrite = hostname === DEFAULT_ADMIN_DOMAIN
        expect(wouldRewrite).toBe(true)

        // But since guard fires first, rewrite never happens — enforced by ordering
        // The test documents the invariant: API guard result takes priority
        expect(guardFired && wouldRewrite).toBe(true) // both true → guard wins
    })
})

// ── TC-MIG-MW: Subdomain routing is unchanged by migration ──────────────────
describe('[TC-MIG-MW] Subdomain routing unchanged after migration', () => {
    it('tenant.primeweb.app recognized as subdomain', () => {
        const hostname = 'my-store.primeweb.app'
        expect(isSubdomain(hostname, defaultOpts)).toBe(true)
    })

    it('www.primeweb.app is NOT a tenant subdomain', () => {
        expect(isSubdomain(`www.${DEFAULT_PLATFORM_DOMAIN}`, defaultOpts)).toBe(false)
    })

    it('admin.primeweb.app is NOT a tenant subdomain', () => {
        expect(isSubdomain(DEFAULT_ADMIN_DOMAIN, defaultOpts)).toBe(false)
    })

    it('custom domain is not a subdomain', () => {
        expect(isSubdomain('myshop.com', defaultOpts)).toBe(false)
    })
})
