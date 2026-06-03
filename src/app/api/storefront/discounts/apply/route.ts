/**
 * POST /api/storefront/discounts/apply
 *
 * Advisory discount preview. Always returns 200 — ok:false means silent reject.
 * The authoritative re-check happens server-side at order creation (Phase 4).
 * Never trust the discountSen returned here as an authoritative amount.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'
import { applyDiscount } from '@/lib/discounts/apply-discount'

const applyDiscountBodySchema = z.object({
    siteSlug: z.string().min(1).max(63),
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

    const { siteSlug, code, subtotalSen } = body

    try {
        const payload = await getPayload({ config })

        // Resolve site slug → tenantId
        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { slug: { equals: siteSlug } },
            limit: 1,
            depth: 0,
            select: { id: true },
            overrideAccess: true,
        })
        const tenant = tenantResult.docs[0]
        if (!tenant) {
            // Silent reject — don't reveal whether tenant exists
            return NextResponse.json({ ok: false })
        }
        const tenantId = tenant.id

        // Look up discount by code (case-insensitive via uppercase) + tenant
        const discountResult = await payload.find({
            collection: 'discounts',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { code: { equals: code.trim().toUpperCase() } },
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        const row = (discountResult.docs[0] ?? null) as any

        const result = applyDiscount(row, { subtotalSen, tenantId, now: new Date() })

        if (!result.ok) {
            // Log reason server-side only — never expose to client
            console.info(`[discount-apply] silent-reject siteSlug=${siteSlug} code=${code} reason=${result.reason}`)
            return NextResponse.json({ ok: false })
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
