import 'server-only'

import { cache } from 'react'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { callSettings, type SettingsResult } from './upstream-client'
import type { HistoryEntry, SettingsView } from './types'

/** Settings of the AI platform for a Studio page; one request per render (layout and page share it). */
export const loadSettingsView = cache(async (): Promise<SettingsResult<SettingsView>> => {
  const { user } = await requireSuperAdmin()
  return callSettings<SettingsView>({ actor: { id: user.id, email: user.email }, method: 'GET', path: '/internal/settings' })
})

export async function loadHistory(limit: number): Promise<SettingsResult<{ entries: HistoryEntry[] }>> {
  const { user } = await requireSuperAdmin()
  return callSettings<{ entries: HistoryEntry[] }>({
    actor: { id: user.id, email: user.email },
    method: 'GET',
    path: `/internal/settings/history?limit=${Math.max(1, Math.min(200, Math.floor(limit)))}`,
  })
}
