import { NextRequest, NextResponse } from 'next/server'
import { isSiteDocTenantUnavailable } from '@/lib/storefront/store-availability'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkRateLimit } from '@/lib/rateLimit'
import { runAfterResponse } from '@/lib/runtime/run-after-response'
import { notifyContactLead } from '@/lib/contact/notify-contact-lead'

/**
 * Plan 260415 contact-bugfix — public POST endpoint cho contact form submissions.
 * Copy pattern từ /api/subscribe: zod validate → rate limit per-site+IP → lookup site
 * → honeypot check → create submission → notify owner (email F32 + chuông LEAD_NEW)
 * sau response qua runAfterResponse, không block response.
 *
 * Rate limit (GH-1464): per-site+IP 5/5phút là defense chính (tránh 1 site/IP làm cạn
 * quota của site khác — bug gốc GH-1464). Site hợp lệ luôn có siteId đúng (lấy từ config
 * block đã publish) nên KHÔNG có trần chung theo IP cho traffic hợp lệ — tránh false-429
 * khi nhiều người dùng chung IP (NAT/VPN văn phòng) submit vào nhiều site khác nhau cùng
 * lúc. Chỉ khi siteId KHÔNG tồn tại (dò/enumerate) mới áp thêm ceiling riêng theo IP
 * (10/5phút) — layer này chạy SAU findByID nên KHÔNG chặn được DB-read flood (mỗi probe
 * vẫn tốn 1 lookup); giá trị thật là giới hạn TỐC ĐỘ tín hiệu enumeration (10 probe phân
 * biệt "Invalid site" vs site hợp lệ mỗi 5phút/IP, sau đó luôn là 429 cho tới hết cửa sổ) —
 * không chặn tuyệt đối, chỉ bound rate so với unbounded.
 * Request không resolve được IP (thiếu x-real-ip/x-forwarded-for) sẽ SKIP rate-limit
 * (fail open) thay vì gộp vào bucket 'unknown'. IP lấy từ x-real-ip (Vercel-set, không
 * spoof được) hoặc rightmost x-forwarded-for entry — KHÔNG dùng leftmost (client-controlled).
 */

const contactSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    email: z.string().email('Invalid email address').max(254),
    phone: z.string().max(30).optional().or(z.literal('')),
    subject: z.string().max(300).optional().or(z.literal('')),
    message: z.string().min(5, 'Message too short').max(5000),
    siteId: z.string().regex(/^\d+$/, 'Invalid site ID').max(64, 'Invalid site ID'),
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

    const { name, email, phone, subject, message, siteId, website } = parsed.data

    // Canonicalize siteId to its numeric value — the regex above only constrains character
    // class, so '1', '01', '001' all pass but are DIFFERENT strings. Using the raw string in
    // the rate-limit key would let an attacker bypass the per-site+IP cap below by padding a
    // known siteId with leading zeros (each variant gets its own bucket) while Postgres still
    // resolves them all to the same row via implicit int cast ('001'::int = 1). Bound to
    // Postgres int4 range so out-of-range values 400 here instead of erroring inside findByID.
    const siteIdNum = Number(siteId)
    if (!Number.isSafeInteger(siteIdNum) || siteIdNum <= 0 || siteIdNum > 2147483647) {
        return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 })
    }

    // x-real-ip is set by Vercel infrastructure (not client-spoofable).
    // XFF rightmost entry is the Vercel-appended real IP; leftmost is client-controlled.
    const rawIp =
        req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()

    // Rate limit: per-site+IP — caps repeat submissions to a single site. Requests
    // without a resolvable IP skip BOTH this and the invalid-site-probe check below
    // (fail open) rather than sharing a bucket — deliberate, same trust boundary for
    // both layers (x-real-ip/x-forwarded-for are Vercel-infra-set, not client-omittable).
    if (rawIp) {
        // fail-closed: each accepted submission emails the shop owner (TC-PERF-159)
        const siteRateCheck = await checkRateLimit(`contact-submit:${siteIdNum}:${rawIp}`, 5, 5 * 60 * 1000, { failClosed: true })
        if (!siteRateCheck.allowed) {
            console.warn('[Contact Submit] rate-limited', {
                type: 'site',
                siteId: siteIdNum,
                ip: rawIp,
                remaining: siteRateCheck.remaining,
                resetAt: siteRateCheck.resetAt,
            })
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
            .findByID({ collection: 'sites', id: siteIdNum, depth: 1 })
            .catch(() => null)) as Record<string, unknown> | null

        if (!site) {
            // Invalid siteId can only come from probing/enumeration (a real site's block
            // config always has a valid siteId) — cap this narrowly per-IP instead of a
            // platform-wide ceiling, so legit multi-site traffic is never affected.
            if (rawIp) {
                const probeCheck = await checkRateLimit(`contact-submit-invalid-site-probe:${rawIp}`, 10, 5 * 60 * 1000)
                if (!probeCheck.allowed) {
                    console.warn('[Contact Submit] rate-limited', {
                        type: 'invalid-site-probe',
                        ip: rawIp,
                        remaining: probeCheck.remaining,
                        resetAt: probeCheck.resetAt,
                    })
                    return NextResponse.json(
                        { error: 'Too many submissions. Please try again in a few minutes.' },
                        { status: 429 },
                    )
                }
            }
            return NextResponse.json({ error: 'Invalid site' }, { status: 400 })
        }

        // #2179: banned or expired store answers like an unknown one (no reason given)
        if (await isSiteDocTenantUnavailable(payload, site)) {
            return NextResponse.json({ error: 'Invalid site' }, { status: 400 })
        }

        // Create submission
        const submission = await payload.create({
            collection: 'contact-submissions',
            data: {
                name,
                email,
                phone: phone || undefined,
                subject: subject || undefined,
                message,
                site: siteIdNum,
                status: 'new',
                source: 'contact-block',
                ipAddress: rawIp || 'unknown',
            },
        })

        // Owner email + bell run after the response (never block / fail the submit — BR-CS-06).
        // GH-2157: recipients are the tenant's active owners; `site.ownerEmail`/`tenant.email` never existed.
        const tenantRef = site.tenant as { id?: string | number } | string | number | null | undefined
        const tenantId = typeof tenantRef === 'object' && tenantRef !== null ? tenantRef.id : tenantRef
        if (tenantId == null) {
            console.warn('[Contact Submit] site has no tenant, owner not notified', { siteId: siteIdNum })
        } else {
            const siteName = (site.name as string) || 'Your site'
            const locale = site.locale === 'ms' ? 'ms' : 'en'
            runAfterResponse('Contact lead notify', () =>
                notifyContactLead(payload, {
                    tenantId,
                    submissionId: submission.id,
                    siteName,
                    locale,
                    name,
                    email,
                    phone: phone || undefined,
                    message,
                }),
            )
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
