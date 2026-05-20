// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useBuilderStore } from '../../../store/builderStore'
import type { BusinessInfo, BuilderStatus, ProgressStep } from '../../../store/builderStore'

// ── Helpers ──────────────────────────────────────────────────────────────

/** Get a plain snapshot of the store state (without actions). */
function getState() {
    return useBuilderStore.getState()
}

/** Execute an action on the store. */
function act<K extends keyof ReturnType<typeof useBuilderStore.getState>>(
    actionName: K,
    ...args: ReturnType<typeof useBuilderStore.getState>[K] extends (...a: infer P) => unknown ? P : never
) {
    const action = useBuilderStore.getState()[actionName]
    if (typeof action === 'function') {
        ;(action as (...a: unknown[]) => void)(...args)
    }
}

const SAMPLE_BUSINESS_INFO: BusinessInfo = {
    businessName: 'My Coffee Shop',
    shortDescription: 'A cozy neighborhood coffee shop',
    industry: 'food',
    products: 'Premium coffee, pastries, croissants',
    language: 'en',
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('builderStore (Zustand)', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        useBuilderStore.getState().reset()
    })

    // ── Initial state ────────────────────────────────────────────────────

    describe('Initial state', () => {
        it('has null businessInfo', () => {
            expect(getState().businessInfo).toBeNull()
        })

        it('starts at step "info"', () => {
            expect(getState().step).toBe('info')
        })

        it('has idle status', () => {
            expect(getState().status).toBe('idle')
        })

        it('has empty messages array', () => {
            expect(getState().messages).toEqual([])
        })

        it('has empty blocks array', () => {
            expect(getState().blocks).toEqual([])
        })

        it('has null theme', () => {
            expect(getState().theme).toBeNull()
        })

        it('has null siteId and siteName', () => {
            expect(getState().siteId).toBeNull()
            expect(getState().siteName).toBeNull()
        })

        it('has zeroed progress', () => {
            expect(getState().progress).toEqual({ step: '', label: '', progress: 0 })
        })

        it('has null error', () => {
            expect(getState().error).toBeNull()
        })

        it('[TC-builder-store-01] has null userId (no session owner by default)', () => {
            expect(getState().userId).toBeNull()
        })
    })

    // ── setUserId ────────────────────────────────────────────────────────

    describe('setUserId', () => {
        it('[TC-builder-store-02] stores session owner userId', () => {
            act('setUserId', 'user-abc-123')
            expect(getState().userId).toBe('user-abc-123')
        })

        it('[TC-builder-store-03] overwrites userId when called again', () => {
            act('setUserId', 'user-a')
            act('setUserId', 'user-b')
            expect(getState().userId).toBe('user-b')
        })
    })

    // ── setBusinessInfo ──────────────────────────────────────────────────

    describe('setBusinessInfo', () => {
        it('stores business info in state', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            expect(getState().businessInfo).toEqual(SAMPLE_BUSINESS_INFO)
        })

        it('transitions step to "chat"', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            expect(getState().step).toBe('chat')
        })

        it('resets messages to empty array', () => {
            // Add a message first
            act('addMessage', { role: 'user', content: 'hello' })
            expect(getState().messages).toHaveLength(1)

            // setBusinessInfo should clear messages
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            expect(getState().messages).toEqual([])
        })
    })

    // ── setStep ──────────────────────────────────────────────────────────

    describe('setStep', () => {
        it('navigates to "chat" step', () => {
            act('setStep', 'chat')
            expect(getState().step).toBe('chat')
        })

        it('navigates to "done" step', () => {
            act('setStep', 'done')
            expect(getState().step).toBe('done')
        })

        it('navigates back to "info" step', () => {
            act('setStep', 'chat')
            act('setStep', 'info')
            expect(getState().step).toBe('info')
        })
    })

    // ── Chat: addMessage & setStatus ─────────────────────────────────────

    describe('addMessage', () => {
        it('adds a user message with generated id and timestamp', () => {
            act('addMessage', { role: 'user', content: 'Hello AI' })

            const messages = getState().messages
            expect(messages).toHaveLength(1)
            expect(messages[0].role).toBe('user')
            expect(messages[0].content).toBe('Hello AI')
            expect(messages[0].id).toBeTruthy()
            expect(messages[0].timestamp).toBeInstanceOf(Date)
        })

        it('adds an assistant message', () => {
            act('addMessage', { role: 'assistant', content: 'Hi there!' })
            expect(getState().messages[0].role).toBe('assistant')
        })

        it('appends messages in order', () => {
            act('addMessage', { role: 'user', content: 'First' })
            act('addMessage', { role: 'assistant', content: 'Second' })
            act('addMessage', { role: 'user', content: 'Third' })

            const messages = getState().messages
            expect(messages).toHaveLength(3)
            expect(messages[0].content).toBe('First')
            expect(messages[1].content).toBe('Second')
            expect(messages[2].content).toBe('Third')
        })

        it('generates unique IDs for each message', () => {
            act('addMessage', { role: 'user', content: 'A' })
            act('addMessage', { role: 'user', content: 'B' })

            const [msg1, msg2] = getState().messages
            expect(msg1.id).not.toBe(msg2.id)
        })
    })

    describe('setStatus', () => {
        const statuses: BuilderStatus[] = ['idle', 'streaming', 'done', 'error']

        statuses.forEach((status) => {
            it(`sets status to "${status}"`, () => {
                act('setStatus', status)
                expect(getState().status).toBe(status)
            })
        })
    })

    // ── Generation: blocks, theme, progress, site ────────────────────────

    describe('Generation actions', () => {
        it('addBlock appends a block with auto-generated _id', () => {
            act('addBlock', { blockType: 'hero', content: 'Welcome' })

            const blocks = getState().blocks
            expect(blocks).toHaveLength(1)
            expect(blocks[0].blockType).toBe('hero')
            expect(blocks[0]._id).toBeTruthy()
        })

        it('addBlock preserves existing _id if provided', () => {
            act('addBlock', { blockType: 'hero', _id: 'custom-id-123' })
            expect(getState().blocks[0]._id).toBe('custom-id-123')
        })

        it('addBlock accumulates multiple blocks', () => {
            act('addBlock', { blockType: 'hero' })
            act('addBlock', { blockType: 'features' })
            act('addBlock', { blockType: 'footer' })

            expect(getState().blocks).toHaveLength(3)
        })

        it('setBlocks replaces entire blocks array', () => {
            act('addBlock', { blockType: 'hero' })
            act('addBlock', { blockType: 'features' })

            const newBlocks = [{ blockType: 'cta', _id: 'cta-1' }]
            act('setBlocks', newBlocks)

            expect(getState().blocks).toHaveLength(1)
            expect(getState().blocks[0].blockType).toBe('cta')
        })

        it('setTheme stores theme config', () => {
            const theme = { primaryColor: '#3b82f6', fontFamily: 'Inter' } as any
            act('setTheme', theme)
            expect(getState().theme).toEqual(theme)
        })

        it('setProgress updates progress step', () => {
            const progress: ProgressStep = { step: 'generating', label: 'Creating hero section...', progress: 45 }
            act('setProgress', progress)
            expect(getState().progress).toEqual(progress)
        })

        it('setSiteId stores generated site ID', () => {
            act('setSiteId', 'site-abc-123')
            expect(getState().siteId).toBe('site-abc-123')
        })

        it('setSiteName stores generated site name', () => {
            act('setSiteName', 'My Awesome Site')
            expect(getState().siteName).toBe('My Awesome Site')
        })
    })

    // ── Error handling ───────────────────────────────────────────────────

    describe('setError', () => {
        it('stores error and sets status to "error"', () => {
            const error = { code: 'GENERATION_FAILED', message: 'AI service unavailable', retryable: true }
            act('setError', error)

            expect(getState().error).toEqual(error)
            expect(getState().status).toBe('error')
        })

        it('stores non-retryable error', () => {
            const error = { code: 'QUOTA_EXCEEDED', message: 'Monthly limit reached', retryable: false }
            act('setError', error)

            expect(getState().error?.retryable).toBe(false)
        })

        it('clears error when set to null', () => {
            act('setError', { code: 'ERR', message: 'fail', retryable: false })
            act('setError', null)

            expect(getState().error).toBeNull()
        })
    })

    // ── Reset ────────────────────────────────────────────────────────────

    describe('reset', () => {
        it('clears all state back to initial values', () => {
            // Populate store with data
            // Note: setBusinessInfo clears messages, so add message AFTER setBusinessInfo
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('addMessage', { role: 'user', content: 'test' })
            act('addBlock', { blockType: 'hero' })
            act('setTheme', { primaryColor: '#000' } as any)
            act('setSiteId', 'site-1')
            act('setSiteName', 'Test Site')
            act('setProgress', { step: 'done', label: 'Complete', progress: 100 })
            act('setStatus', 'done')

            // Verify state is populated
            expect(getState().businessInfo).not.toBeNull()
            expect(getState().messages).toHaveLength(1)
            expect(getState().blocks).toHaveLength(1)

            // Reset
            act('reset')

            // Verify all state is initial
            expect(getState().businessInfo).toBeNull()
            expect(getState().step).toBe('info')
            expect(getState().status).toBe('idle')
            expect(getState().messages).toEqual([])
            expect(getState().blocks).toEqual([])
            expect(getState().theme).toBeNull()
            expect(getState().siteId).toBeNull()
            expect(getState().siteName).toBeNull()
            expect(getState().progress).toEqual({ step: '', label: '', progress: 0 })
            expect(getState().error).toBeNull()
            expect(getState().userId).toBeNull()
        })

        it('allows re-use after reset', () => {
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            act('reset')

            // Use the store again
            const newInfo: BusinessInfo = {
                businessName: 'New Biz',
                shortDescription: 'New desc',
                industry: 'tech',
                products: 'SaaS tools',
            }
            act('setBusinessInfo', newInfo)

            expect(getState().businessInfo).toEqual(newInfo)
            expect(getState().step).toBe('chat')
        })
    })

    // ── Generated site data stored correctly ─────────────────────────────

    describe('Full generation flow', () => {
        it('stores complete site data through the full flow', () => {
            // Step 1: Business info
            act('setBusinessInfo', SAMPLE_BUSINESS_INFO)
            expect(getState().step).toBe('chat')

            // Step 2: Generation starts
            act('setStatus', 'streaming')
            act('setProgress', { step: 'analyzing', label: 'Analyzing business...', progress: 10 })

            // Step 3: Blocks arrive
            act('addBlock', { blockType: 'hero', content: 'Welcome to My Coffee Shop' })
            act('addBlock', { blockType: 'features', content: 'Our specialties' })
            act('addBlock', { blockType: 'footer', content: 'Contact us' })
            act('setProgress', { step: 'blocks', label: 'Generating layout...', progress: 60 })

            // Step 4: Theme and site metadata
            act('setTheme', { primaryColor: '#8B4513', fontFamily: 'Playfair Display' } as any)
            act('setSiteId', 'site-coffee-123')
            act('setSiteName', 'My Coffee Shop')
            act('setProgress', { step: 'finalizing', label: 'Finalizing...', progress: 95 })

            // Step 5: Done
            act('setStatus', 'done')
            act('setStep', 'done')
            act('setProgress', { step: 'complete', label: 'Complete!', progress: 100 })

            // Verify complete state
            const state = getState()
            expect(state.businessInfo).toEqual(SAMPLE_BUSINESS_INFO)
            expect(state.step).toBe('done')
            expect(state.status).toBe('done')
            expect(state.blocks).toHaveLength(3)
            expect(state.theme).toEqual({ primaryColor: '#8B4513', fontFamily: 'Playfair Display' })
            expect(state.siteId).toBe('site-coffee-123')
            expect(state.siteName).toBe('My Coffee Shop')
            expect(state.progress.progress).toBe(100)
            expect(state.error).toBeNull()
        })
    })
})
