import { NextRequest, NextResponse } from 'next/server'
import { buildMaintenanceHtml, buildStoreUnavailableHtml, shouldReturnStoreUnavailable, STORE_UNAVAILABLE_HEADERS } from '@/lib/maintenance'
import { isShopTodoKind } from '@/lib/insights/shop-todo-text'
import { withFrameProtection } from '@/lib/auth/frame-protection'
import { isPreOtpTenantPayloadToken } from '@/lib/auth/admin-panel-guard'
import { canUseMerchantAccess, canViewStudio, isStudioTeamSeat, isSuperAdminOnlyStudioPath } from '@/lib/admin/studio-roles'

const ADMIN_PATHS = ['/admin', '/api']
// Studio internal admin — super-admin or a team seat (checked below)
const STUDIO_PATH = '/studio'
// Support area (merchant CMS access) — super-admin or the `support` role (checked below)
const SUPPORT_PATH = '/support'
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
    '/blog',
    '/products',
    '/orders',
    '/media',
]

const authPaths = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password']

// SEO paths with dots that need tenant rewriting (not static files)
const SEO_PATHS = ['/sitemap.xml', '/robots.txt', '/llms.txt']

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
    const { pathname } = req.nextUrl
    const url = req.nextUrl.clone()

    // Docker sets HOSTNAME=0.0.0.0 → req.nextUrl.hostname is "0.0.0.0" not the real host.
    // Read the Host header instead (set by DO load balancer / Cloudflare).
    const hostname = req.headers.get('host')?.split(':')[0] || req.nextUrl.hostname

    // Allow Sentry tunnel to bypass middleware (no subdomain/auth logic needed)
    if (pathname.startsWith('/sentry-tunnel')) {
        return NextResponse.next()
    }

    // Allow Next.js internals and static files
    if (!SEO_PATHS.includes(pathname)) {
        if (
            pathname.startsWith('/_next') ||
            pathname.startsWith('/favicon') ||
            pathname.startsWith('/public') ||
            pathname.includes('.')
        ) {
            return NextResponse.next()
        }
    }

    // ── Studio admin guard (/studio/*) ────────────────────────────────
    // Edge-runtime: cannot call Payload local API. Decode JWT directly via jose.
    // Defense-in-depth: layout.tsx also calls requireStudioAccess() on the server.
    if (pathname.startsWith(STUDIO_PATH)) {
        const tokenCookie = req.cookies.get('payload-token')?.value
        if (!tokenCookie) {
            url.pathname = '/admin'
            return NextResponse.redirect(url)
        }
        try {
            // Payload v3 signs JWT with a derived key (not raw PAYLOAD_SECRET),
            // so jose's jwtVerify fails in edge runtime. We decode unverified
            // and defer real verification to the Next.js server layer:
            // layout.tsx calls requireStudioAccess() which hits Payload local API.
            // Cookie is httpOnly and set by Payload server — middleware decoding
            // it here is only a routing hint, not the security boundary.
            const { decodeJwt } = await import('jose')
            const decoded = decodeJwt(tokenCookie)
            // A token minted without the roles claim (SSO, session refresh) is passed on: the layout and
            // the AI settings pages check the real roles.
            const roles = decoded.roles as string[] | undefined
            const exp = decoded.exp as number | undefined
            if (exp && exp * 1000 < Date.now()) {
                url.pathname = '/admin'
                return NextResponse.redirect(url)
            }
            if (roles === undefined) return NextResponse.next()
            if (!canViewStudio(roles)) {
                url.pathname = '/admin'
                return NextResponse.redirect(url)
            }
            // AI settings (provider keys, routing, spend caps) stay super-admin only.
            if (isStudioTeamSeat(roles) && isSuperAdminOnlyStudioPath(pathname)) {
                url.pathname = '/studio'
                return NextResponse.redirect(url)
            }
        } catch {
            url.pathname = '/admin'
            return NextResponse.redirect(url)
        }
        return NextResponse.next()
    }

    // ── Support area guard (/support/*) ───────────────────────────────
    // Routing hint only, like the Studio guard: src/app/support/layout.tsx checks the DB roles.
    if (pathname === SUPPORT_PATH || pathname.startsWith(`${SUPPORT_PATH}/`)) {
        const tokenCookie = req.cookies.get('payload-token')?.value
        try {
            const { decodeJwt } = await import('jose')
            const decoded = tokenCookie ? decodeJwt(tokenCookie) : null
            // Routing hint only: the support layout checks the real roles. A token minted without the roles
            // claim (session refresh) is passed on so the layout can decide.
            const roles = decoded?.roles as string[] | undefined
            const exp = decoded?.exp as number | undefined
            if (!decoded || (exp && exp * 1000 < Date.now()) || (roles !== undefined && !canUseMerchantAccess(roles))) {
                url.pathname = '/login'
                return NextResponse.redirect(url)
            }
        } catch {
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
        return NextResponse.next()
    }

    // ── API and admin routes: pass through ─────────────────────────────
    // IMPORTANT: This MUST be checked BEFORE admin domain rewrite.
    // When ADMIN_DOMAIN equals SERVER_DOMAIN (e.g. web-cms-v2.dev.ecommercehub.my),
    // the admin rewrite would catch /api/* requests and rewrite them to /admin/api/*
    // which returns HTML instead of JSON → "Fetching user failed" error.
    // ── Derived domains ──────────────────────────────────────────────
    const ADMIN_DOMAIN = process.env.NEXT_PUBLIC_ADMIN_DOMAIN || `admin.${PLATFORM_DOMAIN}`
    const SERVER_DOMAIN = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/^https?:\/\//, '').split(':')[0]

    // ── Payload admin panel: no tenant user's password-step token (TC-PERF-154) ──
    // Payload renders the signed-in user (memberships populated with whole tenant rows) into every admin page,
    // the "unauthorized" one included. Send such a token to the OTP login instead of rendering anything.
    const rendersAdmin = pathname.startsWith('/admin') || (hostname === ADMIN_DOMAIN && ADMIN_DOMAIN !== SERVER_DOMAIN && !pathname.startsWith('/api/'))
    if (rendersAdmin && isPreOtpTenantPayloadToken(req.cookies.get('payload-token')?.value)) {
        url.pathname = '/login'
        url.search = ''
        const res = NextResponse.redirect(url)
        res.cookies.delete('payload-token')
        return res
    }

    if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    // ── Admin domain: rewrite root → /admin for dedicated admin subdomain ──
    // Only apply when ADMIN_DOMAIN is a SEPARATE domain from SERVER_URL.
    // When they're the same (e.g. staging uses web-cms-v2.dev.ecommercehub.my for both),
    // skip rewrite — Payload CMS is already accessible at /admin path,
    // and rewriting would hijack frontend routes (/login, /dashboard, /builder).
    if (hostname === ADMIN_DOMAIN && ADMIN_DOMAIN !== SERVER_DOMAIN) {
        url.pathname = `/admin${pathname}`
        return NextResponse.rewrite(url)
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

        // F23: Check if this is an old slug that needs 301 redirect
        try {
            const internalOrigin = req.nextUrl.origin
            const checkUrl = `${internalOrigin}/api/slug/redirect?slug=${encodeURIComponent(tenantSlug)}`
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 2000)
            try {
                const checkRes = await fetch(checkUrl, { cache: 'no-store', signal: controller.signal })
                if (checkRes.ok) {
                    const data = await checkRes.json()
                    if (data.redirect && data.newSlug && data.newSlug !== tenantSlug) {
                        const redirectUrl = `https://${data.newSlug}.${PLATFORM_DOMAIN}${pathname}`
                        return NextResponse.redirect(redirectUrl, { status: 301 })
                    }
                    // #2179: banned or expired store → 503 "temporarily unavailable" (takes precedence over maintenance)
                    if (shouldReturnStoreUnavailable(data)) {
                        return new NextResponse(buildStoreUnavailableHtml(data.locale), { status: 503, headers: STORE_UNAVAILABLE_HEADERS })
                    }
                    // BUG-F05-006: Return 503 for maintenance mode (draft + was published)
                    if (data.maintenance && !pathname.startsWith('/api')) {
                        return new NextResponse(
                            buildMaintenanceHtml(data.siteName || ''),
                            {
                                status: 503,
                                headers: {
                                    'Content-Type': 'text/html; charset=utf-8',
                                    'Retry-After': '3600',
                                    'Cache-Control': 'no-store',
                                },
                            },
                        )
                    }
                }
            } finally {
                clearTimeout(timeout)
            }
        } catch {
            // Timeout or fetch fail → serve normally, don't block traffic
        }

        url.pathname = `/sites/${tenantSlug}${pathname}`
        const response = NextResponse.rewrite(url)
        response.headers.set('x-tenant-slug', tenantSlug)
        response.headers.set('x-tenant-type', 'subdomain')
        return response
    }

    // ── Custom domain: hostname không phải platform/admin/local ──
    const isPlatformHost =
        hostname === PLATFORM_DOMAIN ||
        hostname === `www.${PLATFORM_DOMAIN}` ||
        hostname === ADMIN_DOMAIN ||
        hostname === SERVER_DOMAIN ||
        hostname.includes('localhost') ||
        hostname.includes('127.0.0.1') ||
        hostname.endsWith('.vercel.app')

    if (!isPlatformHost) {
        // REQ-F19-06: 301 redirect non-primary custom domains → primary domain
        try {
            const internalOrigin = req.nextUrl.origin
            const checkUrl = `${internalOrigin}/api/domain-primary?host=${encodeURIComponent(hostname)}`
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 2000)
            try {
                const checkRes = await fetch(checkUrl, { cache: 'no-store', signal: controller.signal })
                if (checkRes.ok) {
                    const domainData = await checkRes.json()
                    const { primaryDomain, isPrimary } = domainData
                    // #2179: banned or expired store → 503 before any primary-domain redirect
                    if (shouldReturnStoreUnavailable(domainData)) {
                        return new NextResponse(buildStoreUnavailableHtml(domainData.locale), { status: 503, headers: STORE_UNAVAILABLE_HEADERS })
                    }
                    if (!isPrimary && primaryDomain && primaryDomain !== hostname) {
                        const redirectUrl = `https://${primaryDomain}${pathname}`
                        return NextResponse.redirect(redirectUrl, { status: 301 })
                    }
                }
            } finally {
                clearTimeout(timeout)
            }
        } catch {
            // Timeout or fetch fail → serve normally, don't block traffic
        }

        url.pathname = `/sites/custom${pathname}`
        const requestHeaders = new Headers(req.headers)
        requestHeaders.set('x-tenant-hostname', hostname)
        requestHeaders.set('x-tenant-type', 'custom-domain')
        return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    }

    // ── Auth Guard — Protected routes (US-F02-03, SPEC §11) ───────────────
    const isProtectedRoute = protectedPaths.some((p) => pathname.startsWith(p))
    const isAuthRoute = authPaths.some((p) => pathname.startsWith(p))
    const tokenCookie = req.cookies.get('payload-token')?.value
    const hasToken = !!tokenCookie && tokenCookie.trim() !== ''

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

        // A reminder link (`/orders?todo=<kind>`, from the automations digest email) keeps its task through sign-in.
        // Only a known kind survives: free text in a link (`?ask=`) is never carried across the login.
        const todo = req.nextUrl.searchParams.get('todo')
        const returnUrl = isShopTodoKind(todo) ? `${pathname}?todo=${todo}` : pathname
        if (!hasToken) {
            url.pathname = '/login'
            url.searchParams.set('returnUrl', returnUrl)
            return NextResponse.redirect(url)
        }
        if (hasToken && !mfaVerified) {
            url.pathname = '/verify-otp'
            if (tokenEmail) url.searchParams.set('email', tokenEmail)
            url.searchParams.set('returnUrl', returnUrl)
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
    // the dashboard and the editor may only be framed by this origin (storefront hosts returned above, untouched)
    return withFrameProtection(NextResponse.next(), pathname)
}

export const config = {
    matcher: [
        // Exclude static files AND /api/ routes from middleware.
        // Payload admin sends POST as multipart/form-data with _payload field.
        // Vercel edge middleware corrupts multipart body when forwarding to serverless → 500.
        // API routes don't need middleware (no subdomain/domain routing).
        '/((?!_next/static|_next/image|favicon.ico|api/|sentry-tunnel).*)',
    ],
}
