/**
 * TC-AIREL-307 — the assistant's change waits for the merchant: by hand only for an open canvas edit,
 * Auto-approve also for unsaved work and a short quiet moment.
 * Real: components/editor/agent/editor-idle.
 */
import { describe, expect, it } from 'vitest'
import { type EditorActivity, waitForEditorIdle } from '@/components/editor/agent/editor-idle'

const IDLE: EditorActivity = { isInlineEditing: false, hasUnsavedChanges: false, isSaving: false, contentRevision: 1 }
const fast = { pollMs: 5 }

describe('waitForEditorIdle', () => {
    it('is idle at once when nothing is going on', async () => {
        await expect(waitForEditorIdle(() => IDLE, { requireSaved: true, quietMs: 0, timeoutMs: 100, ...fast })).resolves.toBe(true)
    })

    it('waits for an open canvas edit to close', async () => {
        let state: EditorActivity = { ...IDLE, isInlineEditing: true }
        setTimeout(() => (state = IDLE), 30)

        await expect(waitForEditorIdle(() => state, { requireSaved: false, quietMs: 0, timeoutMs: 500, ...fast })).resolves.toBe(true)
    })

    it('gives up (false) when the canvas edit never closes', async () => {
        await expect(waitForEditorIdle(() => ({ ...IDLE, isInlineEditing: true }), { requireSaved: false, quietMs: 0, timeoutMs: 40, ...fast })).resolves.toBe(false)
    })

    it('by hand, unsaved work is not waited for (the hold saves it)', async () => {
        await expect(waitForEditorIdle(() => ({ ...IDLE, hasUnsavedChanges: true }), { requireSaved: false, quietMs: 0, timeoutMs: 40, ...fast })).resolves.toBe(true)
    })

    it('Auto-approve waits for unsaved work and an in-flight save', async () => {
        await expect(waitForEditorIdle(() => ({ ...IDLE, hasUnsavedChanges: true }), { requireSaved: true, quietMs: 0, timeoutMs: 40, ...fast })).resolves.toBe(false)
        await expect(waitForEditorIdle(() => ({ ...IDLE, isSaving: true }), { requireSaved: true, quietMs: 0, timeoutMs: 40, ...fast })).resolves.toBe(false)
    })

    it('Auto-approve needs a quiet moment: edits keep pushing it back', async () => {
        let revision = 0
        const timer = setInterval(() => (revision += 1), 10)
        const result = await waitForEditorIdle(() => ({ ...IDLE, contentRevision: revision }), { requireSaved: true, quietMs: 60, timeoutMs: 120, ...fast })
        clearInterval(timer)

        expect(result).toBe(false)
    })

    it('Auto-approve goes ahead once the quiet moment passed', async () => {
        const started = Date.now()

        await expect(waitForEditorIdle(() => IDLE, { requireSaved: true, quietMs: 40, timeoutMs: 500, ...fast })).resolves.toBe(true)
        expect(Date.now() - started).toBeGreaterThanOrEqual(35)
    })
})
