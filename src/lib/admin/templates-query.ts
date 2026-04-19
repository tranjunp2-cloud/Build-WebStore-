/**
 * Template admin API helpers — plain fetch hooks (no TanStack Query provider needed).
 * Uses React useState/useEffect pattern per KISS principle.
 */

import { TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'
import { PERSONALITY_VALUES } from './api-utils'

// ── Shared types ──────────────────────────────────────────────────────────────

export type TemplateStatus = 'live' | 'draft' | 'review' | 'scheduled' | 'archived'
export type TemplatePersonality = (typeof PERSONALITY_VALUES)[number]

export type AdminTemplate = {
    id: string | number
    name: string
    description?: string | null
    category: string[]
    status: TemplateStatus
    personality?: TemplatePersonality | null
    scheduledFor?: string | null
    isPremium: boolean
    isFeatured: boolean
    previewUrl?: string | null
    thumbnail?: { url?: string | null } | null
    tags?: Array<{ tag: string }> | null
    usageCount: number
    sortOrder: number
    createdAt: string
    updatedAt: string
}

export type TemplatesListResponse = {
    data: AdminTemplate[]
    meta: {
        totalDocs: number
        totalPages: number
        page: number
        limit: number
        hasNextPage: boolean
        hasPrevPage: boolean
    }
}

export type TemplatesFilter = {
    status?: string
    category?: string
    personality?: string
    search?: string
    sort?: string
    page?: number
    limit?: number
    /** Preset status filter applied by sub-routes (drafts/scheduled/archived/review) */
    presetStatus?: TemplateStatus
}

// ── Category options (reuse from collection) ──────────────────────────────────

export const CATEGORY_OPTIONS = TEMPLATE_CATEGORY_OPTIONS

export const PERSONALITY_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'Warm Traditional', value: 'warm-traditional' },
    { label: 'Warm Homestyle', value: 'warm-homestyle' },
    { label: 'Bold Dark', value: 'bold-dark' },
    { label: 'Soft Feminine', value: 'soft-feminine' },
    { label: 'Calm Wellness', value: 'calm-wellness' },
    { label: 'Modern Vibrant', value: 'modern-vibrant' },
    { label: 'Editorial Clean', value: 'editorial-clean' },
    { label: 'Luxury Travel', value: 'luxury-travel' },
    { label: 'Playful Kids', value: 'playful-kids' },
]

// ── Fetch helpers ─────────────────────────────────────────────────────────────

export function buildTemplatesUrl(filter: TemplatesFilter): string {
    const sp = new URLSearchParams()

    const statusValue = filter.presetStatus ?? filter.status
    if (statusValue && statusValue !== 'all') sp.set('status', statusValue)
    if (filter.category && filter.category !== 'all') sp.set('category', filter.category)
    if (filter.personality && filter.personality !== 'all') sp.set('personality', filter.personality)
    if (filter.search) sp.set('search', filter.search)
    if (filter.sort) sp.set('sort', filter.sort)
    if (filter.page) sp.set('page', String(filter.page))
    if (filter.limit) sp.set('limit', String(filter.limit))

    return `/api/admin/templates?${sp.toString()}`
}

export async function fetchTemplates(filter: TemplatesFilter): Promise<TemplatesListResponse> {
    const res = await fetch(buildTemplatesUrl(filter), { cache: 'no-store' })
    if (!res.ok) throw new Error(`Templates fetch failed: ${res.status}`)
    return res.json()
}

export async function fetchTemplate(id: string | number): Promise<AdminTemplate> {
    const res = await fetch(`/api/admin/templates/${id}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Template fetch failed: ${res.status}`)
    const json = await res.json()
    return json.data
}

export async function patchTemplate(
    id: string | number,
    data: Partial<AdminTemplate>,
): Promise<AdminTemplate> {
    const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'Update failed')
    }
    const json = await res.json()
    return json.data
}

export async function cloneTemplate(
    id: string | number,
    name?: string,
): Promise<AdminTemplate> {
    const res = await fetch(`/api/admin/templates/${id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(name ? { name } : {}),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'Clone failed')
    }
    const json = await res.json()
    return json.data
}

export async function createTemplate(
    data: Record<string, unknown>,
): Promise<AdminTemplate> {
    const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'Create failed')
    }
    const json = await res.json()
    return json.data
}

export async function bulkAction(
    ids: Array<string | number>,
    action: 'publish' | 'archive' | 'schedule' | 'delete',
    scheduledFor?: string,
): Promise<{ succeeded: number; failed: number }> {
    const res = await fetch('/api/admin/templates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, scheduledFor }),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'Bulk action failed')
    }
    const json = await res.json()
    return json.data
}
