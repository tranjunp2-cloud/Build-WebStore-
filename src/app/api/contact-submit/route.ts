import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * Plan 260415 contact-bugfix — public POST endpoint cho contact form submissions.
 * Copy pattern từ /api/subscribe: zod validate → rate limit per-site+IP → lookup site
 * → honeypot check → create submission → optional email notify qua AWS SES
 * (fire-and-forget giống OTP pattern, không block response).
 *
 * Rate limit (GH-1464): per-site+IP 5/5phút là defense chính (tránh 1 site/IP làm cạn
 * quota của site khác — bug gốc GH-1464). Site hợp lệ luôn có siteId đúng (lấy từ config
 * block đã publish) nên KHÔNG có trần chung theo IP cho traffic hợp lệ — tránh false-429
 * khi nhiều người dùng chung IP (NAT/VPN văn phòng) submit vào nhiều site khác nhau cùng
 * lúc. Chỉ khi siteId KHÔNG tồn tại (dò/enumerate) mới áp thêm ceiling riêng theo IP
 * (10/5phút) — mỗi lần dò vẫn tốn 1 DB lookup (checkRateLimit không hỗ trợ pre-check),
 * nhưng bound được tốc độ tăng thay vì để unbounded, mà không ảnh hưởng traffic thật.
 * Request không resolve được IP (thiếu x-real-ip/x-forwarded-for) sẽ SKIP rate-limit
 * (fail open) thay vì gộp vào bucket 'unknown'. IP lấy từ x-real-ip (Vercel-set, không
 * spoof được) hoặc rightmost x-forwarded-for entry — KHÔNG dùng leftmost (client-controlled).
 */

const contactSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    email: z.string().email('Invalid email address').max(254),
    phone: z.string().max(30).optional().or(z.literal('')),
    message: z.string().min(5, 'Message too short').max(5000),
    siteId: z.string().min(1, 'Site ID is required').max(64, 'Invalid site ID'),
    // Honeypot field — bot thường fill mọi field ẩn. Reject nếu có value.
    website: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
})

export async function POST(req: NextRequest) {
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

    // x-real-ip is set by Vercel infrastructure (not client-spoofable).
    // XFF rightmost entry is the Vercel-appended real IP; leftmost is client-controlled.
    const rawIp =
        req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()

    // Rate limit: per-site+IP — caps repeat submissions to a single site. Requests
    // without a resolvable IP skip BOTH this and the invalid-site-probe check below
    // (fail open) rather than sharing a bucket — deliberate, same trust boundary for
    // both layers (x-real-ip/x-forwarded-for are Vercel-infra-set, not client-omittable).
    if (rawIp) {
        const siteRateCheck = await checkRateLimit(`contact-submit:${siteId}:${rawIp}`, 5, 5 * 60 * 1000)
        if (!siteRateCheck.allowed) {
            console.warn('[Contact Submit] rate-limited', { type: 'site', siteId, ip: rawIp })
            return NextResponse.json(
                { error: 'Too many submissions. Please try again in a few minutes.' },
                { status: 429 },
            )
        }
    }

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
            // Invalid siteId can only come from probing/enumeration (a real site's block
            // config always has a valid siteId) — cap this narrowly per-IP instead of a
            // platform-wide ceiling, so legit multi-site traffic is never affected.
            if (rawIp) {
                const probeCheck = await checkRateLimit(`contact-submit-invalid-site-probe:${rawIp}`, 10, 5 * 60 * 1000)
                if (!probeCheck.allowed) {
                    console.warn('[Contact Submit] rate-limited', { type: 'invalid-site-probe', ip: rawIp })
                    return NextResponse.json(
                        { error: 'Too many submissions. Please try again in a few minutes.' },
                        { status: 429 },
                    )
                }
            }
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
                ipAddress: rawIp || 'unknown',
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
                .catch((err) => {
                    console.error('[Contact Submit] email notify failed:', err instanceof Error ? err.message : String(err))
                })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Contact Submit] Error:', err instanceof Error ? err.message : String(err))
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 },
        )
    }
}
