import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function EditorIndexPage() {
    const tenantId = await getCurrentTenantId()
    
    if (tenantId) {
        const payload = await getPayload({ config: configPromise })
        const sitesResult = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            sort: '-updatedAt',
            limit: 1
        })
        
        if (sitesResult.docs.length > 0) {
            redirect(`/editor/${sitesResult.docs[0].id}`)
        }
    }

    redirect('/dashboard')
}
