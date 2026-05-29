import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
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

    return <EmailTemplatesClient tenantId={tenantId ?? undefined} initialRows={rows} />
}
