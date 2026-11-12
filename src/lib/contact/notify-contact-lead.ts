import type { Payload } from 'payload'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'
import { getTemplateConfig } from '@/lib/email/get-template-config'
import { contactFromSellerEmail } from '@/lib/email/templates'
import { notifyTenantOwners } from '@/lib/notifications/notify-tenant-owners'

export interface ContactLeadNotifyInput {
    tenantId: string | number
    submissionId: string | number
    siteName: string
    locale: 'en' | 'ms'
    name: string
    email: string
    phone?: string
    message: string
}

/**
 * GH-2157 — tell the shop owner(s) about a new contact lead: F32 `contact-from-seller` email
 * (skipped when the tenant disabled it) + in-app bell (`LEAD_NEW`). Runs after the response
 * (runAfterResponse in the route); each channel is isolated so one failing never blocks the other.
 */
export async function notifyContactLead(payload: Payload, input: ContactLeadNotifyInput): Promise<void> {
    const { tenantId, submissionId, locale, email, phone, message } = input
    // CR/LF in the visitor name / site name would flow into the Subject header and notification title: flatten it.
    const flatten = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()
    const name = flatten(input.name)
    const siteName = flatten(input.siteName)

    const sendMail = async () => {
        const cfg = await getTemplateConfig(tenantId, 'contact-from-seller', 'seller', locale)
        if (cfg?.enabled === false) {
            console.warn('[Contact Lead] email suppressed (template disabled): contact-from-seller', { tenantId })
            return
        }
        const owners = await getTenantOwnerEmails(payload, tenantId, ['owner'])
        if (owners.length === 0) {
            console.warn('[Contact Lead] no active owner to email', { tenantId })
            return
        }
        const baseUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')
        // Without a base URL the mail button becomes a relative link and cannot open: still send, but say so.
        if (!baseUrl) console.warn('[Contact Lead] NEXT_PUBLIC_SERVER_URL missing, mail link is relative', { tenantId })
        const { subject, html } = contactFromSellerEmail(
            {
                shopName: siteName,
                sellerName: siteName,
                visitorName: name,
                visitorEmail: email,
                visitorPhone: phone,
                message,
                dashboardUrl: `${baseUrl}/contact-leads`,
                locale,
            },
            cfg ?? undefined,
        )
        await Promise.allSettled(
            owners.map((to) =>
                payload.sendEmail({ to, subject, html }).catch((err: unknown) =>
                    console.error('[Contact Lead] email failed:', err instanceof Error ? err.message : String(err)),
                ),
            ),
        )
    }

    const sendBell = () =>
        notifyTenantOwners(payload, tenantId, {
            type: 'LEAD_NEW',
            title: `New contact lead from ${name}`,
            message: `${name} sent a message via ${siteName}`,
            actionUrl: '/contact-leads',
            // No email/phone/message here: notification rows must not carry visitor PII.
            metadata: { name, siteName },
            dedupeKey: `LEAD_NEW:${submissionId}`,
        })

    const results = await Promise.allSettled([sendMail(), sendBell()])
    results.forEach((r) => {
        if (r.status === 'rejected') console.error('[Contact Lead] notify failed:', r.reason instanceof Error ? r.reason.message : String(r.reason))
    })
}
