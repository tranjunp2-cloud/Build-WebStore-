/**
 * POST /api/storefront/discounts/apply
 *
 * Advisory discount preview. Always returns 200 — ok:false means silent reject.
 * The authoritative re-check happens server-side at order creation (Phase 4).
 * Never trust the discountSen returned here as an authoritative amount.
 */
import { NextResponse } from 'next/server'
import { isTenantUnavailable } from '@/lib/storefront/store-availability'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'
import { applyDiscount } from '@/lib/discounts/apply-discount'

const applyDiscountBodySchema = z.object({
    siteSlug: z.string().min(1).max(63),
    // Optional resolved site id — lets the preview honour site-scoped discounts like the checkout routes.
    siteId: z.union([z.string(), z.number()]).optional(),
    code: z.string().min(1).max(32),
    subtotalSen: z.number().int().min(0),
})

export async function POST(req: Request) {
    // Rate limit: 20 requests / 60s per IP — light guard against code brute-force
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')?.trim()
        || 'unknown'
    const rateCheck = await checkRateLimit(`storefront-discount:${ip}`, 20, 60_000)
    if (!rateCheck.allowed) {
        return NextResponse.json({ ok: false }, {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
        })
    }

    let body: z.infer<typeof applyDiscountBodySchema>
    try {
        const raw = await req.json()
        body = applyDiscountBodySchema.parse(raw)
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 })
    }

    const { siteSlug, siteId, code, subtotalSen } = body
    const siteIdNum = siteId != null && siteId !== '' && !Number.isNaN(Number(siteId)) ? Number(siteId) : null

    try {
        const payload = await getPayload({ config })

        // Resolve site slug → tenantId
        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: siteSlug } },
            limit: 1,
            depth: 0,
            select: { id: true, status: true },
            overrideAccess: true,
        })
        const tenant = tenantResult.docs[0]
        // #2179: banned or expired store answers like an unknown one (no reason given)
        if (!tenant || await isTenantUnavailable(payload, tenant)) {
            // Silent reject — don't reveal whether tenant exists
            return NextResponse.json({ ok: false })
        }
        const tenantId = tenant.id

        // Look up discount by code (case-insensitive via uppercase) + tenant.
        // Site scoping (PRD §9): when the client passes the resolved siteId, a site-scoped discount
        // resolves only on its own site — matches the authoritative COD/Stripe checkout filter.
        const discountResult = await payload.find({
            collection: 'discounts',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { code: { equals: code.trim().toUpperCase() } },
                    ...(siteIdNum != null
                        ? [{ or: [{ site: { exists: false } }, { site: { equals: siteIdNum } }] }]
                        : []),
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        const row = (discountResult.docs[0] ?? null) as any

        const result = applyDiscount(row, { subtotalSen, tenantId, now: new Date() })

        if (!result.ok) {
            console.info(`[discount-apply] reject siteSlug=${siteSlug} code=${code} reason=${result.reason}`)
            // Expose only a COARSE reason to the client:
            //   - 'at-limit'    → exhausted voucher (its own message)
            //   - 'unavailable' → everything else (inactive/expired/not-found/wrong-tenant/not-started)
            // Collapsing the rest keeps real-vs-fake codes indistinguishable (no enumeration).
            const reason = result.reason === 'at-limit' ? 'at-limit' : 'unavailable'
            return NextResponse.json({ ok: false, reason })
        }

        return NextResponse.json({
            ok: true,
            discountSen: result.discountSen,
            discount: result.discount,
        })
    } catch (error) {
        console.error('[POST /api/storefront/discounts/apply]', error)
        // Never 500 to storefront — degrade to silent reject
        return NextResponse.json({ ok: false })
    }
}
