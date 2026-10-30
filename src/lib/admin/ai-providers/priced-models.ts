import 'server-only'

import { loadAiSettings } from '@/lib/admin/ai-settings/settings-store'

/**
 * "provider:model" refs that have a price in Limits & prices (text prices and picture prices), or null when the prices
 * cannot be read. A model without a price counts $0 of AI battery, so Routing and Providers flag it.
 */
export async function loadPricedRefs(): Promise<string[] | null> {
  try {
    const { config } = await loadAiSettings()
    return [...Object.keys(config.prices), ...Object.keys(config.images)]
  } catch (error) {
    console.error('[ai-providers] prices unavailable', error instanceof Error ? error.name : 'error')
    return null
  }
}
