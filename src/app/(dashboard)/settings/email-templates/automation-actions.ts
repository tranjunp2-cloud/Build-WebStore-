'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { canManageAutomations } from '@/lib/automations/automation-access'
import { AutomationSettingsInputSchema, type AutomationSettings } from '@/lib/automations/automation-config'
import { type AutomationPreview, previewAutomations } from '@/lib/automations/automation-runner'
import { readAutomationSettings, saveAutomationSettings } from '@/lib/automations/automation-store'
import { getCurrentTenantId, getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

// NOTE: only async functions are exported from a 'use server' file; the result types live in the lib.
export type AutomationActionError = 'unauthorized' | 'forbidden' | 'invalid' | 'rate_limited' | 'failed'
export type AutomationActionResult<T> = { success: true; data: T } | { success: false; error: AutomationActionError }

/** The signed-in owner / admin of the current workspace, or the reason there is none. */
async function managerOf(): Promise<{ user: unknown; tenantId: string } | AutomationActionError> {
    const user = await getCurrentUser()
    const tenantId = await getCurrentTenantId()
    if (!user || !tenantId) return 'unauthorized'
    return canManageAutomations(user, tenantId) ? { user, tenantId } : 'forbidden'
}

export async function saveAutomationSettingsAction(raw: unknown): Promise<AutomationActionResult<AutomationSettings>> {
    try {
        const who = await managerOf()
        if (typeof who === 'string') return { success: false, error: who }
        const parsed = AutomationSettingsInputSchema.safeParse(raw)
        if (!parsed.success) return { success: false, error: 'invalid' }
        const payload = await getPayload({ config })
        return { success: true, data: await saveAutomationSettings(payload, who.tenantId, parsed.data) }
    } catch (error) {
        console.error('[saveAutomationSettingsAction] error:', error instanceof Error ? error.message : error)
        return { success: false, error: 'failed' }
    }
}

/** "Run now": what the switched-on automations would say right now. Sends nothing and stores nothing. */
export async function previewAutomationsAction(): Promise<AutomationActionResult<AutomationPreview>> {
    try {
        const who = await managerOf()
        if (typeof who === 'string') return { success: false, error: who }
        const limit = await checkRateLimit(`automations:preview:${who.tenantId}`, 20, 60 * 60 * 1000)
        if (!limit.allowed) return { success: false, error: 'rate_limited' }
        const payload = await getPayload({ config })
        const settings = await readAutomationSettings(payload, who.tenantId)
        const locale = (who.user as { prefer_lang?: string }).prefer_lang === 'ms' ? 'ms' : 'en'
        return { success: true, data: await previewAutomations(payload, { tenantId: who.tenantId, settings, locale, now: new Date() }) }
    } catch (error) {
        console.error('[previewAutomationsAction] error:', error instanceof Error ? error.message : error)
        return { success: false, error: 'failed' }
    }
}
