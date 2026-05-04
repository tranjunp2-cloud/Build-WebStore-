/**
 * Shared TypeScript types for the Generations monitoring UI.
 * Mirrors the ai-generation-records Payload collection shape.
 */

export type GenerationStatus = 'running' | 'success' | 'failed'

export type GenerationRecord = {
    id: number
    endpoint: string
    category?: string | null
    promptMode: 'full' | 'truncated' | 'hashed'
    promptText?: string | null
    promptHash?: string | null
    selectedBlocks?: Array<{ id: string; value?: string | null }> | null
    outputSnapshot?: Record<string, unknown> | null
    status: GenerationStatus
    errorLog?: string | null
    durationMs?: number | null
    costUsd?: number | null
    completedAt?: string | null
    createdAt: string
    updatedAt: string
    // depth=1 hydrated
    user?: { id: number; email: string; firstName?: string; lastName?: string } | number | null
    site?: { id: number; name?: string } | number | null
}

export type GenerationsListMeta = {
    totalDocs: number
    totalPages: number
    page: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
}

export type GenerationsListResponse = {
    data: GenerationRecord[]
    meta: GenerationsListMeta
}

export type GenerationsFilters = {
    status: string
    endpoint: string
    category: string
    dateFrom: string
    dateTo: string
    search: string
    page: number
    limit: number
}
