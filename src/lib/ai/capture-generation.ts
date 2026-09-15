/**
 * capture-generation.ts
 *
 * Start/finish helpers that write a row to `ai-generation-records` for each
 * user-triggered AI generation. Complements `log-usage.ts` (tokens/cost) with
 * full prompt + block + output snapshot visibility for the admin monitoring UI.
 *
 * Usage:
 *   const cap = await startCapture({ endpoint: 'site-generator', prompt: '...' })
 *   try {
 *     const result = await existingLogic()
 *     await finishCapture(cap, { status: 'success', selectedBlocks: [...], outputSnapshot: result })
 *     return result
 *   } catch (err) {
 *     await finishCapture(cap, { status: 'failed', error: String(err) })
 *     throw err
 *   }
 *
 * IMPORTANT: finishCapture should be called in a try/finally. If the capture
 * itself fails (DB down), the error is swallowed — monitoring must not block gen.
 *
 * Source: plans/260419-1637-GH-1-admin-design-build/phase-05-monitoring-user-generations.md
 */

import { createHash } from 'crypto'
import {
    finalizeGenerationOutcome,
    type FailedPage,
    type PersistedPage,
    type TerminalErrorPhase,
} from './generation-outcome'
// Phase 04 — snapshot field counting extracted to keep this file under 200 lines
export { countSnapshotFields } from './snapshot-field-counter'

// ── Types ───────────────────────────────────────────────────────────────────

export type CaptureMode = 'full' | 'truncated' | 'hashed'

export type StartCaptureInput = {
    endpoint: string
    prompt: string
    category?: string
    userId?: number | string | null
    siteId?: number | string | null
    /** Defaults to ADMIN_GEN_CAPTURE_MODE env var, then 'full' */
    mode?: CaptureMode
    /** Pre-resolved Payload instance (avoids cold-start overhead) */
    payload?: import('payload').Payload
    /** F41: immutable route-level context captured after validation and authorization. */
    traceId?: string
    inputSnapshot?: Record<string, unknown>
    inputSchemaVersion?: string
    /** Website generation requires a durable record; callers may opt out only for legacy monitoring. */
    required?: boolean
}

export type CaptureHandle = {
    recordId: number | null   // null if DB write failed (monitoring best-effort)
    startTime: number
    payload?: import('payload').Payload
    finalized?: boolean
}

export type FinishCaptureInput = {
    status: 'success' | 'failed'
    selectedBlocks?: string[]
    outputSnapshot?: Record<string, unknown>
    error?: string
    costUsd?: number
    /** Phase 04 — override-rate: total editable fields across all generated blocks */
    fieldsTotal?: number
    /** Phase 04 — override-rate: fields where AI wrote a non-empty value */
    fieldsFilled?: number
}

export type FinishWebsiteCaptureInput = {
    expectedPages: number
    persistedPages: PersistedPage[]
    failedPages: FailedPage[]
    terminalError?: unknown
    terminalErrorPhase?: TerminalErrorPhase
    siteId?: number | string | null
    selectedBlocks?: string[]
    outputSnapshot?: Record<string, unknown>
    fieldsTotal?: number
    fieldsFilled?: number
}

// ── SHA256 helper ────────────────────────────────────────────────────────────

function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex')
}

// ── Sanitize error — strip absolute file paths from stack traces ─────────────

function sanitizeErrorLog(raw: string): string {
    // Remove absolute paths like /home/runner/.../file.ts or /vercel/path0/...
    return raw
        .replace(/\/[^\s"',:()[\]]+\.(ts|js|tsx|jsx|mjs|cjs)/g, '<path>')
        .slice(0, 4000) // Hard cap to avoid bloating DB rows
}

// ── Snapshot size guard ──────────────────────────────────────────────────────

const MAX_KB = parseInt(process.env.ADMIN_GEN_SNAPSHOT_MAX_KB ?? '50', 10)
const MAX_INPUT_SNAPSHOT_KB = 20

function guardSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
    try {
        const json = JSON.stringify(snapshot)
        const kb = json.length / 1024
        if (kb > MAX_KB) {
            console.warn(`[capture-generation] outputSnapshot ${kb.toFixed(1)}KB > ${MAX_KB}KB limit — truncating`)
            return { _truncated: true, _sizeKb: Math.round(kb), warning: 'Snapshot exceeded size limit' }
        }
        return snapshot
    } catch {
        return { _truncated: true, warning: 'Snapshot not serializable' }
    }
}

function guardInputSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
    try {
        const sanitizeValue = (value: unknown, depth = 0): unknown => {
            if (depth > 4) return '<truncated-depth>'
            if (typeof value === 'string') return value
                .replace(/(api[_-]?key|authorization|token|password|cookie|client[_-]?secret|secret)\s*[:=]\s*(?:bearer\s+)?[^\r\n,;]+/gi, '$1=<redacted>')
                .replace(/(["'](?:api[_-]?key|authorization|token|password|cookie|client[_-]?secret|secret)["']\s*:\s*["'])(?:bearer\s+)?[^"']*(["'])/gi, '$1<redacted>$2')
                .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '<redacted-api-key>')
                .slice(0, 1000)
            if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1))
            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value as Record<string, unknown>)
                    .slice(0, 30)
                    .map(([key, item]) => [
                        key,
                        /password|token|authorization|cookie|api[_-]?key/i.test(key)
                            ? '<redacted>'
                            : sanitizeValue(item, depth + 1),
                    ]))
            }
            return value
        }
        const sanitized = sanitizeValue(snapshot) as Record<string, unknown>
        const json = JSON.stringify(sanitized)
        const kb = json.length / 1024
        if (kb > MAX_INPUT_SNAPSHOT_KB) {
            // Preserve the known form fields while replacing only the optional,
            // arbitrarily nested brief that caused the cap to be exceeded.
            const { contentBrief: _contentBrief, ...formFields } = sanitized
            return {
                ...formFields,
                contentBrief: { _truncated: true, _sizeKb: Math.round(kb) },
                warning: 'Input snapshot exceeded size limit',
            }
        }
        return sanitized
    } catch {
        return { _truncated: true, warning: 'Input snapshot not serializable' }
    }
}

// ── Prompt handling per mode ─────────────────────────────────────────────────

function buildPromptFields(
    prompt: string,
    mode: CaptureMode,
): { promptText: string | undefined; promptHash: string } {
    const hash = sha256(prompt)

    if (mode === 'hashed') {
        return { promptText: undefined, promptHash: hash }
    }
    if (mode === 'truncated') {
        return { promptText: prompt.slice(0, 500), promptHash: hash }
    }
    // full
    return { promptText: prompt.slice(0, 8000), promptHash: hash }
}

// ── Get or bootstrap Payload instance ────────────────────────────────────────

async function resolvePayload(provided?: import('payload').Payload): Promise<import('payload').Payload> {
    if (provided) return provided
    const { getPayload } = await import('payload')
    const configPromise = (await import('@/payload.config')).default
    return getPayload({ config: configPromise })
}

// ── startCapture ─────────────────────────────────────────────────────────────

/**
 * Creates a `ai-generation-records` row with status=running.
 * Returns a CaptureHandle — pass to finishCapture when gen completes.
 * Legacy monitoring calls never throw; required website tracking throws when
 * the record cannot be created, preventing an untracked success response.
 */
export async function startCapture(input: StartCaptureInput): Promise<CaptureHandle> {
    const startTime = Date.now()
    const mode: CaptureMode =
        input.mode ??
        (process.env.ADMIN_GEN_CAPTURE_MODE as CaptureMode | undefined) ??
        'full'

    try {
        const payload = await resolvePayload(input.payload)
        const { promptText, promptHash } = buildPromptFields(input.prompt, mode)
        const inputSnapshot = input.inputSnapshot ? guardInputSnapshot(input.inputSnapshot) : undefined
        const inputHash = inputSnapshot ? sha256(JSON.stringify(inputSnapshot)) : undefined

        const record = await payload.create({
            collection: 'ai-generation-records',
            data: {
                endpoint: input.endpoint,
                category: input.category ?? undefined,
                user: input.userId ?? undefined,
                site: input.siteId ?? undefined,
                promptMode: mode,
                promptText,
                promptHash,
                status: 'running',
                lifecycle: 'running',
                recoveryStatus: 'none',
                traceId: input.traceId,
                inputSnapshot,
                inputSchemaVersion: input.inputSchemaVersion,
                inputHash,
                startedAt: new Date(startTime).toISOString(),
                lastHeartbeatAt: new Date(startTime).toISOString(),
            },
        })

        return { recordId: record.id as number, startTime, payload, finalized: false }
    } catch (err) {
        // Monitoring must never block the AI gen path
        console.warn('[capture-generation] startCapture failed:', err instanceof Error ? err.message : String(err))
        if (input.required) throw new Error('Generation tracking is temporarily unavailable')
        return { recordId: null, startTime, finalized: false }
    }
}

// ── finishCapture ────────────────────────────────────────────────────────────

/**
 * Updates the record created by startCapture with final status, duration, etc.
 * Silently swallows errors — monitoring is best-effort, must not break the gen.
 */
export async function finishCapture(
    handle: CaptureHandle,
    input: FinishCaptureInput,
): Promise<void> {
    if (handle.recordId === null) return // startCapture already failed — skip

    const durationMs = Date.now() - handle.startTime

    try {
        const payload = await resolvePayload(handle.payload)

        const selectedBlocksData = input.selectedBlocks?.map((v) => ({ value: v }))
        const snapshotData = input.outputSnapshot ? guardSnapshot(input.outputSnapshot) : undefined
        const errorLogData = input.error ? sanitizeErrorLog(input.error) : undefined

        await payload.update({
            collection: 'ai-generation-records',
            id: handle.recordId,
            data: {
                status: input.status,
                durationMs,
                completedAt: new Date().toISOString(),
                ...(selectedBlocksData !== undefined ? { selectedBlocks: selectedBlocksData } : {}),
                ...(snapshotData !== undefined ? { outputSnapshot: snapshotData } : {}),
                ...(errorLogData !== undefined ? { errorLog: errorLogData } : {}),
                ...(input.costUsd !== undefined ? { costUsd: input.costUsd } : {}),
                // Phase 04 — override-rate fields (optional, only written when caller provides them)
                ...(input.fieldsTotal !== undefined ? { fieldsTotal: input.fieldsTotal } : {}),
                ...(input.fieldsFilled !== undefined ? { fieldsFilled: input.fieldsFilled } : {}),
            },
        })
    } catch (err) {
        console.warn('[capture-generation] finishCapture failed:', err instanceof Error ? err.message : String(err))
    }
}

/**
 * Finalizes a website capture only after site/page writes are known. This keeps
 * observability truthful when composition succeeds but persistence is partial.
 */
export async function finishWebsiteCapture(
    handle: CaptureHandle,
    input: FinishWebsiteCaptureInput,
): Promise<boolean> {
    if (handle.recordId === null) return false
    if (handle.finalized) return true
    const terminal = finalizeGenerationOutcome(input)
    const now = new Date().toISOString()
    const legacyStatus = terminal.outcome === 'succeeded' ? 'success' : 'failed'
    const recoveryStatus = terminal.outcome === 'succeeded' ? 'none' : 'eligible'

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const payload = await resolvePayload(handle.payload)
            const existing = await payload.findByID({ collection: 'ai-generation-records', id: handle.recordId })
            if (existing?.lifecycle === 'terminal') {
                handle.finalized = true
                return true
            }
            await payload.update({
            collection: 'ai-generation-records',
            id: handle.recordId,
            data: {
                status: legacyStatus,
                lifecycle: 'terminal',
                outcome: terminal.outcome,
                recoveryStatus,
                site: input.siteId ?? undefined,
                pageSummary: terminal.pageSummary,
                pageOutcomes: terminal.pageOutcomes,
                generationErrors: terminal.errors,
                userSafeMessage: terminal.userSafeMessage,
                errorLog: terminal.errors[0]?.sanitizedTechnicalMessage,
                durationMs: Date.now() - handle.startTime,
                completedAt: now,
                terminalAt: now,
                lastHeartbeatAt: now,
                ...(input.selectedBlocks ? { selectedBlocks: input.selectedBlocks.map((value) => ({ value })) } : {}),
                ...(input.outputSnapshot ? { outputSnapshot: guardSnapshot(input.outputSnapshot) } : {}),
                ...(input.fieldsTotal !== undefined ? { fieldsTotal: input.fieldsTotal } : {}),
                ...(input.fieldsFilled !== undefined ? { fieldsFilled: input.fieldsFilled } : {}),
            },
            })
            // The route has both stream and outer error boundaries. Only lock the
            // handle after persistence succeeds so a transient capture failure can retry.
            handle.finalized = true
            return true
        } catch (err) {
            lastError = err
        }
    }
    console.error('[capture-generation] terminal website capture failed after retry:', lastError instanceof Error ? lastError.message : String(lastError))
    return false
}

/** Best-effort heartbeat used while a long site/page persistence phase is active. */
export async function heartbeatWebsiteCapture(handle: CaptureHandle): Promise<void> {
    if (handle.recordId === null || handle.finalized) return
    try {
        const payload = await resolvePayload(handle.payload)
        await payload.update({
            collection: 'ai-generation-records',
            id: handle.recordId,
            data: { lastHeartbeatAt: new Date().toISOString() },
        })
    } catch (err) {
        console.warn('[capture-generation] heartbeatWebsiteCapture failed:', err instanceof Error ? err.message : String(err))
    }
}

/** Persists non-terminal page evidence so an interrupted run remains debuggable. */
export async function persistWebsiteCaptureProgress(
    handle: CaptureHandle,
    input: Pick<FinishWebsiteCaptureInput, 'expectedPages' | 'persistedPages' | 'failedPages'>,
): Promise<void> {
    if (handle.recordId === null || handle.finalized) return
    const progress = finalizeGenerationOutcome(input)
    try {
        const payload = await resolvePayload(handle.payload)
        await payload.update({
            collection: 'ai-generation-records',
            id: handle.recordId,
            data: {
                pageSummary: progress.pageSummary,
                pageOutcomes: progress.pageOutcomes,
                generationErrors: progress.errors,
                lastHeartbeatAt: new Date().toISOString(),
            },
        })
    } catch (err) {
        console.warn('[capture-generation] persistWebsiteCaptureProgress failed:', err instanceof Error ? err.message : String(err))
    }
}
