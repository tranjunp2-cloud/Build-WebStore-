import { NextRequest, NextResponse } from 'next/server'

const ADMIN_PATHS = ['/admin', '/api']
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

/**
 * Multi-tenant middleware
 *
 * Routing logic:
 * - admin.primeweb.app → Payload CMS admin panel
 * - *.primeweb.app    → Tenant public site (subdomain routing)
 * - www.custom-domain.com → Tenant public site (custom domain routing)
 * - primeweb.app      → Marketing / dashboard pages
 */
export function middleware(req: NextRequest) {
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

    // ── API routes: pass through ─────────────────────────────────────────────
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    // ── Tenant subdomain: {slug}.primeweb.app ───────────────────────────────
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

    // ── Custom domain: anything that's not the platform domain ───────────────
    if (
        hostname !== PLATFORM_DOMAIN &&
        hostname !== `www.${PLATFORM_DOMAIN}` &&
        !hostname.includes('localhost') &&
        !hostname.includes('vercel.app')
    ) {
        url.pathname = `/sites/custom${pathname}`
        const response = NextResponse.rewrite(url)
        response.headers.set('x-tenant-hostname', hostname)
        response.headers.set('x-tenant-type', 'custom-domain')
        return response
    }

    // ── Auth Guard — Protected routes ─────────────────────────────────────────
    const protectedPaths = ['/dashboard', '/builder', '/editor', '/onboarding']
    const authPaths = ['/login', '/register']
    const isProtectedRoute = protectedPaths.some((p) => pathname.startsWith(p))
    const isAuthRoute = authPaths.some((p) => pathname.startsWith(p))
    const hasToken = req.cookies.has('payload-token')

    // Not logged in → trying to access protected route → redirect to login
    if (isProtectedRoute && !hasToken) {
        url.pathname = '/login'
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
    }

    // Already logged in → trying to access auth page → redirect to dashboard
    if (isAuthRoute && hasToken) {
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    // ── Main platform (primeweb.app) — Dashboard & marketing ─────────────────
    return NextResponse.next()
}

export const config = {
    matcher: [
        // Match all paths except static files
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
