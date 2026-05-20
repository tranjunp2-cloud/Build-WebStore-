'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenantId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

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

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('payload-token')
  return { success: true }
}

export async function addTrackedKeyword(keyword: string) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) throw new Error('Unauthorized')

  const payload = await getPayload({ config })
  
  try {
    const sitesRes = await payload.find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 1 })
    const site = sitesRes.docs[0]
    
    if (!site) return { success: false, error: 'No site found' }
    
    const currentKeywords = site.seo?.trackedKeywords || []
    if (currentKeywords.length >= 5) return { success: false, error: 'Max 5 keywords allowed' }
    
    // Add the keyword
    const updatedKeywords = [...currentKeywords, { keyword, currentRank: 999, previousRank: 999, lastCheckedAt: new Date().toISOString() }]
    
    await payload.update({
      collection: 'sites',
      id: site.id,
      data: {
        seo: {
          ...(site.seo || {}),
          trackedKeywords: updatedKeywords
        }
      }
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to add tracked keyword:', error)
    return { success: false, error: 'Failed to add keyword' }
  }
}

export async function deleteTrackedKeyword(indexToDelete: number) {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) throw new Error('Unauthorized')

  const payload = await getPayload({ config })
  
  try {
    const sitesRes = await payload.find({ collection: 'sites', where: { tenant: { equals: tenantId } }, limit: 1 })
    const site = sitesRes.docs[0]
    
    if (!site) return { success: false, error: 'No site found' }
    
    const currentKeywords = site.seo?.trackedKeywords || []
    // Remove the keyword by index
    const updatedKeywords = currentKeywords.filter((_: any, idx: number) => idx !== indexToDelete)
    
    await payload.update({
      collection: 'sites',
      id: site.id,
      data: {
        seo: {
          ...(site.seo || {}),
          trackedKeywords: updatedKeywords
        }
      }
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete tracked keyword:', error)
    return { success: false, error: 'Failed to delete keyword' }
  }
}
