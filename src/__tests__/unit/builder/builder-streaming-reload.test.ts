// @vitest-environment jsdom
/**
 * Unit tests for GH-1371: streaming state stuck on reload.
 * Verifies that partialize() and onRehydrateStorage() prevent
 * the builder from getting stuck in loading state after reload/back.
 *
 * TC-IDs: TC-F01.STUCK-01 → TC-F01.STUCK-08 (docs/qa/F01-ai-chat-builder.md §3.11)
 * Manual/E2E: TC-F01.STUCK-05 → TC-F01.STUCK-07, TC-F01.STUCK-09 → TC-F01.STUCK-10
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useBuilderStore } from '../../../store/builderStore'
import type { BusinessInfo } from '../../../store/builderStore'

// ── Helpers ──────────────────────────────────────────────────────────────

function getState() {
    return useBuilderStore.getState()
}

function act<K extends keyof ReturnType<typeof useBuilderStore.getState>>(
    actionName: K,
    ...args: ReturnType<typeof useBuilderStore.getState>[K] extends (...a: infer P) => unknown ? P : never
) {
    const action = useBuilderStore.getState()[actionName]
    if (typeof action === 'function') {
        ;(action as (...a: unknown[]) => void)(...args)
    }
}

function getPersistOptions() {
    return (useBuilderStore as any).persist?.getOptions?.() as {
        partialize: (state: ReturnType<typeof useBuilderStore.getState>) => Record<string, unknown>
        onRehydrateStorage: () => (state: any, error: unknown) => void
    } | undefined
}

const SAMPLE_BUSINESS_INFO: BusinessInfo = {
    businessName: 'My Coffee Shop',
    shortDescription: 'A cozy neighborhood coffee shop',
    industry: 'food',
    products: 'Premium coffee, pastries',
    language: 'en',
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('builderStore — streaming reload recovery (GH-1371)', () => {
    beforeEach(() => {
        useBuilderStore.getState().reset()
    })

    // ── partialize ────────────────────────────────────────────────────────

    describe('partialize: streaming state is NOT persisted to localStorage', () => {
        it('[TC-F01.STUCK-01] converts streaming status to idle', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('setStatus', 'streaming')
            act('setStep', 'chat')

            const options = getPersistOptions()
            const persisted = options?.partialize(getState())

            expect(persisted?.status).toBe('idle')
            expect(persisted?.step).toBe('info')
        })

        it('[TC-F01.STUCK-01] clears blocks, messages and progress when streaming', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('setStatus', 'streaming')
            act('addBlock', { blockType: 'hero' })
            act('addMessage', { role: 'assistant', content: 'Starting...' })
            act('setProgress', { step: 'generate', label: 'Generating...', progress: 40 })

            const options = getPersistOptions()
            const persisted = options?.partialize(getState())

            expect(persisted?.blocks).toEqual([])
            expect(persisted?.messages).toEqual([])
            expect(persisted?.progress).toEqual({ step: '', label: '', progress: 0 })
        })

        it('[TC-F01.STUCK-01] preserves businessInfo when streaming (user keeps draft prompt)', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('setStatus', 'streaming')

            const options = getPersistOptions()
            const persisted = options?.partialize(getState())

            expect(persisted?.businessInfo).toEqual(SAMPLE_BUSINESS_INFO)
        })

        it('[TC-F01.STUCK-02] preserves done status intact — no regression on happy path', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('setStatus', 'done')
            act('setSiteId', 'site-123')
            act('setSiteName', 'My Coffee Shop')

            const options = getPersistOptions()
            const persisted = options?.partialize(getState())

            expect(persisted?.status).toBe('done')
            expect(persisted?.siteId).toBe('site-123')
        })

        it('[TC-F01.STUCK-08] converts error status to idle — existing behavior preserved', () => {
            act('setError', { code: 'TIMEOUT', message: 'Timed out', retryable: true })

            const options = getPersistOptions()
            const persisted = options?.partialize(getState())

            expect(persisted?.status).toBe('idle')
            expect(persisted?.error).toBeNull()
        })

        it('preserves idle status unchanged', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            // status remains idle

            const options = getPersistOptions()
            const persisted = options?.partialize(getState())

            expect(persisted?.status).toBe('idle')
        })
    })

    // ── onRehydrateStorage ────────────────────────────────────────────────

    describe('onRehydrateStorage: stale streaming state in localStorage is reset', () => {
        it('[TC-F01.STUCK-03] resets stale streaming → idle on rehydrate', () => {
            const options = getPersistOptions()
            const callback = options?.onRehydrateStorage()

            const staleState: any = {
                status: 'streaming',
                step: 'chat',
                blocks: [{ blockType: 'hero', _id: 'hero-1' }],
                messages: [{ id: '1', role: 'assistant', content: 'Starting...', timestamp: new Date() }],
                businessInfo: SAMPLE_BUSINESS_INFO,
                progress: { step: 'generate', label: 'Generating...', progress: 50 },
                error: null,
            }

            callback?.(staleState, null)

            expect(staleState.status).toBe('idle')
            expect(staleState.step).toBe('info')
            expect(staleState.blocks).toEqual([])
            expect(staleState.messages).toEqual([])
            expect(staleState.progress).toEqual({ step: '', label: '', progress: 0 })
        })

        it('[TC-F01.STUCK-03] preserves businessInfo after rehydrate reset', () => {
            const options = getPersistOptions()
            const callback = options?.onRehydrateStorage()

            const staleState: any = {
                status: 'streaming',
                step: 'chat',
                blocks: [],
                messages: [],
                businessInfo: SAMPLE_BUSINESS_INFO,
                progress: { step: '', label: '', progress: 0 },
                error: null,
            }

            callback?.(staleState, null)

            expect(staleState.businessInfo).toEqual(SAMPLE_BUSINESS_INFO)
        })

        it('[TC-F01.STUCK-04] clears stale error object and sets idle on rehydrate', () => {
            const options = getPersistOptions()
            const callback = options?.onRehydrateStorage()

            const staleState: any = {
                status: 'error',
                step: 'info',
                blocks: [],
                messages: [],
                businessInfo: null,
                progress: { step: '', label: '', progress: 0 },
                error: { code: 'TIMEOUT', message: 'Timed out', retryable: true },
            }

            callback?.(staleState, null)

            expect(staleState.error).toBeNull()
            expect(staleState.status).toBe('idle')
        })

        it('does not modify state when status is idle', () => {
            const options = getPersistOptions()
            const callback = options?.onRehydrateStorage()

            const healthyState: any = {
                status: 'idle',
                step: 'info',
                blocks: [],
                messages: [],
                businessInfo: SAMPLE_BUSINESS_INFO,
                progress: { step: '', label: '', progress: 0 },
                error: null,
            }

            callback?.(healthyState, null)

            expect(healthyState.status).toBe('idle')
            expect(healthyState.businessInfo).toEqual(SAMPLE_BUSINESS_INFO)
        })

        it('does not modify state when status is done', () => {
            const options = getPersistOptions()
            const callback = options?.onRehydrateStorage()

            const doneState: any = {
                status: 'done',
                step: 'done',
                blocks: [{ blockType: 'hero' }],
                messages: [],
                businessInfo: SAMPLE_BUSINESS_INFO,
                siteId: 'site-123',
                progress: { step: 'complete', label: 'Done', progress: 100 },
                error: null,
            }

            callback?.(doneState, null)

            expect(doneState.status).toBe('done')
            expect(doneState.blocks).toHaveLength(1)
            expect(doneState.siteId).toBe('site-123')
        })
    })

    // ── Cross-user contamination ───────────────────────────────────────────

    describe('reset clears session owner (TC-F01.STUCK-10)', () => {
        it('reset clears userId and businessInfo preventing cross-user contamination', () => {
            act('setUserId', 'user-A')
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('setStatus', 'streaming')

            act('reset')

            expect(getState().userId).toBeNull()
            expect(getState().businessInfo).toBeNull()
            expect(getState().status).toBe('idle')
        })
    })
})
