import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'

const mockBlocks = [
    { blockType: 'hero', heading: 'Welcome', subheading: 'Hello' },
    { blockType: 'about', content: 'About us content' },
    { blockType: 'contact', email: 'hello@test.com' },
]
const mockTheme = { primaryColor: '#0d9488', fontFamily: 'Inter' }

describe('EditorStore', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    describe('init', () => {
        it('should initialize with data and create first snapshot', () => {
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
            const state = useEditorStore.getState()
            expect(state.siteId).toBe('site-1')
            expect(state.blocks).toHaveLength(3)
            expect(state.theme.primaryColor).toBe('#0d9488')
            expect(state.siteName).toBe('Test Site')
            expect(state.history).toHaveLength(1)
            expect(state.autoSaveIntervalMs).toBe(3000)
        })
    })

    describe('block operations', () => {
        beforeEach(() => {
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
        })

        it('updateBlock should modify block at index', () => {
            useEditorStore.getState().updateBlock(0, { heading: 'Updated' })
            expect(useEditorStore.getState().blocks[0].heading).toBe('Updated')
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
        })

        it('addBlock should insert after specified index', () => {
            useEditorStore.getState().addBlock(0, { blockType: 'features', items: [] })
            expect(useEditorStore.getState().blocks).toHaveLength(4)
            expect(useEditorStore.getState().blocks[1].blockType).toBe('features')
        })

        it('deleteBlock should remove block at index', () => {
            useEditorStore.getState().deleteBlock(1)
            expect(useEditorStore.getState().blocks).toHaveLength(2)
            expect(useEditorStore.getState().blocks[1].blockType).toBe('contact')
        })

        it('duplicateBlock should create copy after original', () => {
            useEditorStore.getState().duplicateBlock(0)
            const blocks = useEditorStore.getState().blocks
            expect(blocks).toHaveLength(4)
            expect(blocks[0].blockType).toBe('hero')
            expect(blocks[1].blockType).toBe('hero')
        })

        it('reorderBlocks should move block from one position to another', () => {
            useEditorStore.getState().reorderBlocks(0, 2)
            const blocks = useEditorStore.getState().blocks
            expect(blocks[0].blockType).toBe('about')
            expect(blocks[2].blockType).toBe('hero')
        })
    })

    describe('undo/redo (F-06)', () => {
        beforeEach(() => {
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
        })

        it('should track history after changes', () => {
            useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
            expect(useEditorStore.getState().history.length).toBeGreaterThan(1)
        })

        it('canUndo should be true after changes', () => {
            expect(useEditorStore.getState().canUndo()).toBe(false)
            useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
            expect(useEditorStore.getState().canUndo()).toBe(true)
        })

        it('undo should restore previous state', () => {
            const originalHeading = useEditorStore.getState().blocks[0].heading
            useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
            useEditorStore.getState().undo()
            expect(useEditorStore.getState().blocks[0].heading).toBe(originalHeading)
        })

        it('redo should reapply undone change', () => {
            useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
            useEditorStore.getState().undo()
            useEditorStore.getState().redo()
            expect(useEditorStore.getState().blocks[0].heading).toBe('Changed')
        })
    })

    describe('save state (F-07)', () => {
        it('markSaved should clear unsaved flag and update timestamp', () => {
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
            useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
            useEditorStore.getState().markSaved()
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
            expect(useEditorStore.getState().lastSavedAt).toBeDefined()
        })
    })

    describe('auto-save & draft (F12)', () => {
        beforeEach(() => {
            vi.useFakeTimers()
            global.fetch = vi.fn()
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
        })

        afterEach(() => {
            vi.restoreAllMocks()
            vi.useRealTimers()
        })

        it('TC-F12.01: should debounce auto-save for 3s after a change', async () => {
            useEditorStore.getState().updateBlock(0, { heading: 'Debounce test' })
            
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
            expect(useEditorStore.getState().saveStatus).toBe('idle')

            // Fast-forward 2.9 seconds - should still be idle
            vi.advanceTimersByTime(2900)
            expect(global.fetch).not.toHaveBeenCalled()

            // Mock fetch success
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })

            // Fast-forward to 3 seconds
            vi.advanceTimersByTime(100)
            
            // Wait for the async save to finish
            await Promise.resolve() 

            expect(global.fetch).toHaveBeenCalledTimes(1)
            expect(global.fetch).toHaveBeenCalledWith('/api/sites/site-1/save', expect.any(Object))
            
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
            expect(useEditorStore.getState().saveStatus).toBe('saved')
        })

        it('TC-F12.03: manual save should override debounce and trigger save immediately', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
            
            useEditorStore.getState().updateBlock(0, { heading: 'Manual override' })
            
            // Trigger manual save
            const savePromise = useEditorStore.getState().performSave(true)
            
            // Timer should be cleared and fetch called immediately
            expect(global.fetch).toHaveBeenCalledTimes(1)
            expect(useEditorStore.getState().saveStatus).toBe('saving')
            
            await savePromise
            expect(useEditorStore.getState().saveStatus).toBe('saved')
        })

        it('TC-F12.06: should include isDraft: true when saving', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
            
            useEditorStore.getState().updateBlock(0, { heading: 'Draft payload' })
            vi.advanceTimersByTime(3000)
            await Promise.resolve()
            
            if ((global.fetch as any).mock.calls.length === 0) {
                throw new Error("fetch was not called")
            }

            const fetchCallParams = (global.fetch as any).mock.calls[0][1]
            const requestBody = JSON.parse(fetchCallParams.body)
            
            expect(requestBody.isDraft).toBe(true)
            expect(requestBody.blocks[0].heading).toBe('Draft payload')
        })

        it('TC-F12.12: should handle token expiration (401) gracefully without retrying', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: false, status: 401 })
            
            useEditorStore.getState().updateBlock(0, { heading: 'Auth error' })
            vi.advanceTimersByTime(3000)
            await Promise.resolve()
            
            expect(useEditorStore.getState().saveStatus).toBe('error')
            expect(global.fetch).toHaveBeenCalledTimes(1)
        })

        it('TC-F12.10 & TC-F12.11: should retry on network error with backoff (5s, 10s, 20s)', async () => {
            ;(global.fetch as any)
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))

            useEditorStore.getState().updateBlock(0, { heading: 'Retry test' })
            
            // Trigger auto-save
            vi.advanceTimersByTime(3000)
            await Promise.resolve() // Let async tick
            
            expect(useEditorStore.getState().saveStatus).toBe('error')
            expect(global.fetch).toHaveBeenCalledTimes(1)

            // Advance 5s
            vi.advanceTimersByTime(5000)
            await Promise.resolve()
            expect(global.fetch).toHaveBeenCalledTimes(2)

            // Advance 10s
            vi.advanceTimersByTime(10000)
            await Promise.resolve()
            expect(global.fetch).toHaveBeenCalledTimes(3)

            // Advance 20s
            vi.advanceTimersByTime(20000)
            await Promise.resolve()
            expect(global.fetch).toHaveBeenCalledTimes(4)

            // No more retries
            vi.advanceTimersByTime(30000)
            await Promise.resolve()
            expect(global.fetch).toHaveBeenCalledTimes(4)
        })

        it('TC-F12.13: should allow saving empty payload', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
            
            const blocksCount = useEditorStore.getState().blocks.length
            for (let i = 0; i < blocksCount; i++) {
                useEditorStore.getState().deleteBlock(0)
            }
            
            expect(useEditorStore.getState().blocks).toHaveLength(0)
            
            vi.advanceTimersByTime(3000)
            await Promise.resolve()
            
            const fetchCallParams = (global.fetch as any).mock.calls[0][1]
            const requestBody = JSON.parse(fetchCallParams.body)
            
            expect(requestBody.blocks).toEqual([])
            expect(useEditorStore.getState().saveStatus).toBe('saved')
        })
    })
})
