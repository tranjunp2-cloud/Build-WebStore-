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

    // ── Admin domain: web-cms-v2.dev.ecommercehub.my (explicit or fallback to admin.PLATFORM_DOMAIN) ──
    const ADMIN_DOMAIN = process.env.NEXT_PUBLIC_ADMIN_DOMAIN || `admin.${PLATFORM_DOMAIN}`
    if (hostname === ADMIN_DOMAIN) {
        url.pathname = `/admin${pathname}`
        return NextResponse.rewrite(url)
    }

    // ── API and admin routes: pass through ─────────────────────────────
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    // ── Local Direct Access (e.g. /sites/{slug}/...) ──────────────────
    // This ensures local testing bypasses subdomain logic but still sets the header
    // so that dynamic routes like not-found.tsx can extract the correct tenant.
    if (pathname.startsWith('/sites/')) {
        const parts = pathname.split('/')
        if (parts.length >= 3) {
            const tenantSlug = parts[2]
            const response = NextResponse.next()
            response.headers.set('x-tenant-slug', tenantSlug)
            response.headers.set('x-tenant-type', 'local')
            // Auth Guard paths do not overlap with /sites/, so early return is safe.
            return response
        }
    }

    // ── Tenant subdomain: {slug}.web-v2.dev.ecommercehub.my ─────────────
    const isSubdomain =
        hostname.endsWith(`.${PLATFORM_DOMAIN}`) &&
        hostname !== `www.${PLATFORM_DOMAIN}` &&
        hostname !== ADMIN_DOMAIN

    if (isSubdomain) {
        const tenantSlug = hostname.replace(`.${PLATFORM_DOMAIN}`, '')
        url.pathname = `/sites/${tenantSlug}${pathname}`
        const response = NextResponse.rewrite(url)
        response.headers.set('x-tenant-slug', tenantSlug)
        response.headers.set('x-tenant-type', 'subdomain')
        return response
    }

    // ── Custom domain: hostname không phải platform, không phải admin, không phải DO app URL ──
    const isDoInternalHost =
        hostname === PLATFORM_DOMAIN ||
        hostname === `www.${PLATFORM_DOMAIN}` ||
        hostname === ADMIN_DOMAIN ||
        hostname === '0.0.0.0' ||
        hostname.includes('localhost') ||
        hostname.includes('127.0.0.1') ||
        hostname.includes('ondigitalocean.app') // DO internal app URL – không phải custom domain

    if (!isDoInternalHost) {
        // REQ-F19-06: 301 redirect non-primary custom domains → primary domain
        try {
            const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || `https://${PLATFORM_DOMAIN}`
            const checkUrl = `${serverUrl}/api/domain-primary?host=${encodeURIComponent(hostname)}`
            const checkRes = await fetch(checkUrl, { cache: 'no-store' })
            if (checkRes.ok) {
                const { primaryDomain, isPrimary } = await checkRes.json()
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
    const tokenCookie = req.cookies.get('payload-token')?.value
    const hasToken = !!tokenCookie

    let mfaVerified = false
    let tokenEmail = ''

    if (hasToken) {
        try {
            // Verify JWT signature to check for mfa_verified flag (added in verify-otp)
            // Using jose jwtVerify since it works on Edge Runtime and prevents forged tokens
            const { jwtVerify } = await import('jose')
            const secret = new TextEncoder().encode(process.env.PAYLOAD_SECRET || '')
            const { payload: decoded } = await jwtVerify(tokenCookie, secret)
            if (decoded.mfa_verified === true) {
                mfaVerified = true
            }
            if (decoded.email) {
                tokenEmail = decoded.email as string
            }
        } catch {
            // Ignore invalid token format
        }
    }

    // Protected route access requirements:
    // 1. Must have token
    // 2. Token MUST have mfa_verified === true (stops curl/API bypass where users get payload default token)
    if (isProtectedRoute) {
        // Prevent M2M service accounts from accessing the Frontend UI
        if (hasToken && tokenEmail === 'sso-service@primeweb.app') {
            url.pathname = '/login'
            url.searchParams.set('error', 'serviceAccountUI')
            const res = NextResponse.redirect(url)
            res.cookies.delete('payload-token')
            return res
        }

        if (!hasToken) {
            url.pathname = '/login'
            url.searchParams.set('returnUrl', pathname)
            return NextResponse.redirect(url)
        }
        if (hasToken && !mfaVerified) {
            url.pathname = '/verify-otp'
            if (tokenEmail) url.searchParams.set('email', tokenEmail)
            url.searchParams.set('returnUrl', pathname)
            return NextResponse.redirect(url)
        }
    }

    // Trying to access auth pages (login)
    if (isAuthRoute && hasToken) {
        if (mfaVerified) {
            // Fully logged in → skip to dashboard
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
        }
        // If they have a token but haven't verified MFA, we DO NOT redirect them to /verify-otp unconditionally here.
        // We let them render /login or /forgot-password in case they want to switch accounts.
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
