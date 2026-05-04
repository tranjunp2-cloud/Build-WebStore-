import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * Plan 260415 contact-bugfix — public POST endpoint cho contact form submissions.
 * Copy pattern từ /api/subscribe: rate limit per-IP → zod validate → lookup site
 * → honeypot check → create submission → optional email notify qua AWS SES
 * (fire-and-forget giống OTP pattern, không block response).
 *
 * Rate limit: 5 submissions / 5 phút per IP (strict hơn subscribe vì spam risk cao).
 */

const contactSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    email: z.string().email('Invalid email address').max(254),
    phone: z.string().max(30).optional().or(z.literal('')),
    message: z.string().min(5, 'Message too short').max(5000),
    siteId: z.string().min(1, 'Site ID is required'),
    // Honeypot field — bot thường fill mọi field ẩn. Reject nếu có value.
    website: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // Rate limit: 5 submissions per 5 minutes per IP
    const rateCheck = await checkRateLimit(`contact-submit:${ip}`, 5, 5 * 60 * 1000)
    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Too many submissions. Please try again in a few minutes.' },
            { status: 429 },
        )
    }

    // Validate body
    const body = await req.json().catch(() => null)
    const parsed = contactSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.errors[0]?.message || 'Invalid input' },
            { status: 400 },
        )
    }

    const { name, email, phone, message, siteId, website } = parsed.data

    // Honeypot check — silent success cho bot để không biết reject.
    if (website && website.length > 0) {
        return NextResponse.json({ success: true })
    }

    try {
        const payload = await getPayload({ config })

        // Check site exists + get owner info for email notify
        const site = (await payload
            .findByID({ collection: 'sites', id: siteId, depth: 1 })
            .catch(() => null)) as Record<string, unknown> | null

        if (!site) {
            return NextResponse.json({ error: 'Invalid site' }, { status: 400 })
        }

        // Create submission
        const submission = await payload.create({
            collection: 'contact-submissions',
            data: {
                name,
                email,
                phone: phone || undefined,
                message,
                site: parseInt(siteId, 10),
                status: 'new',
                source: 'contact-block',
                ipAddress: ip,
            },
        })

        // Fire-and-forget email notify tới admin email site (nếu có).
        // Không await — không block response kể cả email fail.
        const siteName = (site.name as string) || 'Your site'
        const ownerEmail =
            (site.ownerEmail as string) ||
            (typeof site.tenant === 'object' && site.tenant !== null
                ? ((site.tenant as Record<string, unknown>).email as string)
                : undefined)

        if (ownerEmail) {
            payload
                .sendEmail({
                    to: ownerEmail,
                    subject: `New contact form submission on ${siteName}`,
                    text: `You received a new message from ${name} <${email}>${phone ? ` (${phone})` : ''}:\n\n${message}\n\n--\nView in admin: /admin/collections/contact-submissions/${submission.id}`,
                })
                .catch(() => {
                    // Silent — log but don't break response
                })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 },
        )
    }
}
