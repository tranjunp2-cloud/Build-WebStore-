'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateDashboardPreferences(preferences: string[]) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) throw new Error('Unauthorized')

  const payload = await getPayload({ config })
  
  try {
    // Fetch current tenant to merge settings
    const tenant: any = await payload.findByID({ collection: 'tenants', id: tenantId })
    
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        settings: {
          ...(tenant.settings || {}),
          dashboardPreferences: preferences
        }
      }
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to save preferences:', error)
    return { success: false, error: 'Failed to save preferences' }
  }
}
