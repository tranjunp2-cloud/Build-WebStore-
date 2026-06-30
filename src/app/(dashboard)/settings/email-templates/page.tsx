import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { EMAIL_TEMPLATE_TYPES } from '@/lib/email/types'
import { getDefaultContentFields } from '@/lib/email/template-default-fields'
import type { ContentFields } from '@/lib/email/template-default-fields'
import type { EmailTemplateType } from '@/lib/email/types'
import { EmailTemplatesClient } from './_components/EmailTemplatesClient'

export default async function EmailTemplatesPage() {
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })

    let rows: any[] = []
    if (tenantId) {
        const result = await payload.find({
            collection: 'email-template-settings',
            where: { tenant: { equals: tenantId } },
            limit: 100,
            depth: 0,
            overrideAccess: true,
        })
        rows = result.docs
    }

    // Precompute defaults for every template type so the client form can prefill inputs
    // to match what the Live Preview already renders via mergeTemplateConfig defaults.
    const defaultsByType = Object.fromEntries(
        EMAIL_TEMPLATE_TYPES.map((type) => [
            type,
            {
                contentEn: getDefaultContentFields(type, 'en'),
                contentMs: getDefaultContentFields(type, 'ms'),
            },
        ])
    ) as Record<EmailTemplateType, { contentEn: ContentFields; contentMs: ContentFields }>

    return (
        <EmailTemplatesClient
            tenantId={tenantId ?? undefined}
            initialRows={rows}
            defaultsByType={defaultsByType}
        />
    )
}
