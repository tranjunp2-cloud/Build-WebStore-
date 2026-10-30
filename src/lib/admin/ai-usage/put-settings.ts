/** Browser call to PUT /api/admin/ai-settings for the quick edits (caps, plan on/off). Resolves to ok or one sentence; never throws. */
import type { AiCaps } from '@/lib/ai-platform/ai-config-schema'
import type { EnabledChange } from './plan-switch'

export interface QuickSaveBody {
    limits?: EnabledChange[]
    caps?: AiCaps | null
}

export async function putSettings(body: QuickSaveBody, fetcher: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        const res = await fetcher('/api/admin/ai-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) return { ok: true }
        const payload = (await res.json().catch(() => ({}))) as { errors?: Array<{ message?: string }>; error?: string }
        return { ok: false, message: payload.errors?.[0]?.message ?? payload.error ?? `Save failed (${res.status})` }
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Save failed' }
    }
}
