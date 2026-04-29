import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

const subscribeSchema = z.object({
    email: z.string().email('Invalid email address'),
    siteId: z.string().min(1, 'Site ID is required'),
})

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateCheck = await checkRateLimit(`subscribe:${ip}`, 5, 60000)
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 }
        )
    }

    // Validate body
    const body = await req.json().catch(() => null)
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.errors[0]?.message || 'Invalid input' },
            { status: 400 }
        )
    }

    const { email, siteId } = parsed.data

    try {
        const payload = await getPayload({ config })

        // Check site exists
        const site = await payload.findByID({ collection: 'sites', id: siteId }).catch(() => null)
        if (!site) {
            return NextResponse.json({ error: 'Invalid site' }, { status: 400 })
        }

        const siteIdInt = parseInt(siteId, 10)

        // Check duplicate (same email + same site)
        const existing = await payload.find({
            collection: 'subscribers',
            where: {
                and: [
                    { email: { equals: email } },
                    { site: { equals: siteIdInt } },
                ],
            },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
        }

        // Create subscriber
        await payload.create({
            collection: 'subscribers',
            data: { email, site: siteIdInt, source: 'newsletter' },
        })

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}
