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
}

export type CaptureHandle = {
    recordId: number | null   // null if DB write failed (monitoring best-effort)
    startTime: number
    payload?: import('payload').Payload
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
 * Never throws; recordId=null means the DB write failed (safe to ignore).
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
            },
        })

        return { recordId: record.id as number, startTime, payload }
    } catch (err) {
        // Monitoring must never block the AI gen path
        console.warn('[capture-generation] startCapture failed:', err instanceof Error ? err.message : String(err))
        return { recordId: null, startTime }
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
