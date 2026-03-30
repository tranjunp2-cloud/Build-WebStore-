import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'
import { WelcomeScreenClient } from './_components/WelcomeScreenClient'

export const dynamic = 'force-dynamic'

export default async function WelcomeScreen() {
    const user = await getCurrentUser()
    if (!user) {
        redirect('/login')
    }

    const tenantId = await getCurrentTenantId()
    
    // Check if user already has a site (BR-01: Redirect đã có site → /dashboard)
    if (tenantId) {
        const payload = await getPayload({ config })
        const sitesResult = await payload.find({ 
            collection: 'sites', 
            where: { tenant: { equals: tenantId } }, 
            limit: 1 
        })
        
        if (sitesResult.totalDocs > 0) {
            redirect('/dashboard')
        }
    }

    return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#0B1120] m-0 p-0 relative">
            <WelcomeScreenClient />
        </div>
    )
}
