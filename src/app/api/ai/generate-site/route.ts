export const dynamic = 'force-dynamic'
// Preserve the existing generation timeout while extracting the shared pipeline.
export const maxDuration = 300
import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/lib/auth'
import { generateSiteSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { captureRejectedWebsiteGeneration } from '@/lib/ai/capture-generation'
import { normalizeGenerationRequestId } from '@/lib/ai/generation-timings'
import { generateSiteService } from '@/lib/ai/generate-site-service'
import { validateCsrf } from '@/lib/ai-platform/csrf'

export { buildGeneratedPages, canonicalizePageSlug } from '@/lib/ai/generate-site-service'

export async function POST(req: NextRequest) {
    // Same-origin only (no Origin and no Referer = non-browser client, still needs a session).
    if (!validateCsrf(req)) return NextResponse.json({ error: 'CSRF verification failed.' }, { status: 403 })
    const generationRequestId = normalizeGenerationRequestId(req.headers.get('x-generation-request-id'))
    try {
        // Parsing a clone preserves the request for auth and lets an authenticated
        // rejected form be tracked without ever persisting its raw payload.
        const { data, errorResponse, validationIssues } = await parseRequest(req.clone(), generateSiteSchema)
        if (errorResponse) {
            // Best-effort tracking only: a session check that cannot run must not turn the 400 into an error.
            const rejectedUser = await getCurrentUser(req, { requireMfa: true }).catch(() => null)
            if (rejectedUser && validationIssues?.length) {
                // Invalid forms used to be side-effect free. Keep this new
                // observability path bounded per user so it cannot become a DB
                // write amplification vector; it never changes the 400 reply.
                try {
                    const trackingRate = await checkTwoTierRateLimit(`generation-invalid:${String(rejectedUser.id)}`, 5, 20)
                    if (trackingRate.allowed) {
                        const rejectedTenant = (rejectedUser as { tenants?: Array<{ tenant?: unknown }> }).tenants?.[0]?.tenant
                        const tenantId = typeof rejectedTenant === 'object' && rejectedTenant
                            ? (rejectedTenant as { id?: number | string }).id
                            : typeof rejectedTenant === 'number' || typeof rejectedTenant === 'string' ? rejectedTenant : undefined
                        await captureRejectedWebsiteGeneration({
                            userId: rejectedUser.id,
                            tenantId,
                            traceId: generationRequestId,
                            issues: validationIssues,
                        })
                    }
                } catch {
                    // The validation response remains authoritative when the
                    // best-effort tracking dependency is unavailable.
                    console.warn('[generate-site] rejected generation tracking unavailable')
                }
            }
            return errorResponse
        }

        // Only a session that passed the OTP step (a password-only login token can not spend AI quota)
        const user = await getCurrentUser(req, { requireMfa: true })
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const payload = await getPayload({ config })
        return generateSiteService({
            payload,
            user,
            input: data!,
            requestId: generationRequestId,
            streaming: req.nextUrl.searchParams.get('stream') === 'true',
            scheduleBackground: task => after(async () => { await task() }),
        })
    } catch (error: unknown) {
        const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        console.error('[AI Generate Site Preflight Error]', debugId, error)
        return NextResponse.json({
            error: 'Failed to generate website. Please try again in a moment.',
            debugId,
        }, { status: 500 })
    }
}
