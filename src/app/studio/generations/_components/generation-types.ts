/** Admin-safe list contract from GET /api/admin/generations. */
export type RecoveryAction = 'view_detail' | 'monitor' | 'retry_website' | 'create_ticket' | 'open_ticket'
export type GenerationRecord = {
    id: string
    submittedAt: string
    user: { id: string | null; label: string; missing: boolean; email?: string | null }
    site: { id: string | null; label: string; missing: boolean }
    lifecycle: 'queued' | 'running' | 'terminal'
    outcome: 'succeeded' | 'partial_failed' | 'failed' | 'cancelled' | null
    recoveryStatus: string
    ticketRelatedGenerationId: string
    priority: string
    recoveryPolicy: { action: RecoveryAction; retryable: boolean; reasonCode: string }
    pageSummary: { expected: number | null; persisted: number; failed: number }
    incidentSummary: { kind: 'quota' | 'system' | 'persistence' | 'page' | 'component' | 'input' | 'unknown'; label: string; scope: string; totalErrors: number } | null
    affectedError: { code: string; phase: string; locationType: string; locationKey: string | null; summary: string } | null
    // Legacy detail components are replaced in F41-04. These optional fields
    // keep their compile contract without being returned by the F41-02 list API.
    status?: 'running' | 'success' | 'failed'; endpoint?: string; category?: string | null; durationMs?: number | null; costUsd?: number | null; createdAt?: string; completedAt?: string | null; promptMode?: string; promptHash?: string | null; errorLog?: string | null; outputSnapshot?: Record<string, unknown> | null; selectedBlocks?: Array<{ id: string; value?: string | null }> | null
}
export type GenerationsListMeta = { totalDocs: number; totalPages?: number; page?: number; limit: number; hasNextPage: boolean; hasPrevPage: boolean }
export type GenerationsListResponse = { items: GenerationRecord[]; nextCursor?: string | null; meta: GenerationsListMeta }
export type GenerationsFilters = { view: 'needs_attention' | 'all'; status: string; recoveryStatus: string; search: string; userId: string; siteId: string; dateFrom: string; dateTo: string; cursor: string; limit: number }
