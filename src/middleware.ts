import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PATHS = ['/admin', '/api']
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

/**
 * Protected routes that require authentication (SPEC §11, US-F02-03).
 *
 * Using startsWith matching, these 6 prefixes cover all 12+ protected routes:
 *   1. /dashboard          — Dashboard overview
 *   2. /dashboard/media    — Media Library
 *   3. /dashboard/sites/*  — Site Settings
 *   4. /dashboard/products — Products CRUD
 *   5. /dashboard/seo      — SEO Dashboard
 *   6. /dashboard/analytics— Analytics
 *   7. /dashboard/billing  — Billing
 *   8. /dashboard/blog     — Blog Management
 *   9. /builder            — AI Chat Builder
 *  10. /editor             — AI Editor
 *  11. /onboarding         — Onboarding flow
 *  12. /settings           — Account Settings
 */
const protectedPaths = [
    '/dashboard',
    '/builder',
    '/editor',
    '/onboarding',
    '/settings',
    '/account',
    '/help',
]

const authPaths = ['/login', '/register']

/**
 * Multi-tenant middleware
 *
 * Routing logic:
 * - admin.primeweb.app → Payload CMS admin panel
 * - *.primeweb.app    → Tenant public site (subdomain routing)
 * - www.custom-domain.com → Tenant public site (custom domain routing)
 * - primeweb.app      → Marketing / dashboard pages
 */
export async function middleware(req: NextRequest) {
    const { pathname, hostname } = req.nextUrl
    const url = req.nextUrl.clone()

    // Allow Next.js internals and static files
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.startsWith('/public') ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    // ── Admin subdomain: admin.primeweb.app ─────────────────────────────────
    if (hostname === `admin.${PLATFORM_DOMAIN}`) {
        url.pathname = `/admin${pathname}`
        return NextResponse.rewrite(url)
    }

    // ── API and admin routes: pass through ─────────────────────────────
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    // ── Tenant subdomain: {slug}.primeweb.app ───────────────────────────
    const isSubdomain =
        hostname.endsWith(`.${PLATFORM_DOMAIN}`) &&
        hostname !== `www.${PLATFORM_DOMAIN}` &&
        hostname !== `admin.${PLATFORM_DOMAIN}`

    if (isSubdomain) {
        const tenantSlug = hostname.replace(`.${PLATFORM_DOMAIN}`, '')
        url.pathname = `/sites/${tenantSlug}${pathname}`
        const response = NextResponse.rewrite(url)
        response.headers.set('x-tenant-slug', tenantSlug)
        response.headers.set('x-tenant-type', 'subdomain')
        return response
    }

    // ── Custom domain: anything that's not the platform domain ─────────────
    // Note: Docker sets HOSTNAME=0.0.0.0, so standalone server may resolve
    // req.nextUrl.hostname as '0.0.0.0' — treat as platform domain.
    if (
        hostname !== PLATFORM_DOMAIN &&
        hostname !== `www.${PLATFORM_DOMAIN}` &&
        hostname !== '0.0.0.0' &&
        !hostname.includes('localhost') &&
        !hostname.includes('127.0.0.1') &&
        !hostname.includes('vercel.app') &&
        !hostname.includes('ondigitalocean.app')
    ) {
        // REQ-F19-06: 301 redirect non-primary custom domains → primary domain
        // Check via internal API to avoid DB access in edge middleware
        try {
            const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || `https://${PLATFORM_DOMAIN}`
            const checkUrl = `${serverUrl}/api/domain-primary?host=${encodeURIComponent(hostname)}`
            const checkRes = await fetch(checkUrl, { cache: 'no-store' })
            if (checkRes.ok) {
                const { primaryDomain, isPrimary } = await checkRes.json()
                // If this domain is NOT the primary, 301 redirect to primary
                if (!isPrimary && primaryDomain && primaryDomain !== hostname) {
                    const redirectUrl = `https://${primaryDomain}${pathname}`
                    return NextResponse.redirect(redirectUrl, { status: 301 })
                }
            }
        } catch {
            // If check fails, serve normally — don't block traffic
        }

        url.pathname = `/sites/custom${pathname}`
        const response = NextResponse.rewrite(url)
        response.headers.set('x-tenant-hostname', hostname)
        response.headers.set('x-tenant-type', 'custom-domain')
        return response
    }

    // ── Auth Guard — Protected routes (US-F02-03, SPEC §11) ───────────────
    const isProtectedRoute = protectedPaths.some((p) => pathname.startsWith(p))
    const isAuthRoute = authPaths.some((p) => pathname.startsWith(p))
    const hasToken = req.cookies.has('payload-token')

    // Not logged in → trying to access protected route → redirect to login
    if (isProtectedRoute && !hasToken) {
        url.pathname = '/login'
        url.searchParams.set('returnUrl', pathname)
        return NextResponse.redirect(url)
    }

    // Already logged in → trying to access auth page → redirect to dashboard
    if (isAuthRoute && hasToken) {
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // ── Main platform (primeweb.app) — Dashboard & marketing ───────────────
    return NextResponse.next()
}

export const config = {
    matcher: [
        // Match all paths except static files
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
