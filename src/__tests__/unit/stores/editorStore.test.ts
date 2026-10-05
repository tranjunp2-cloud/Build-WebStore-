// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { runSerializedEditorSave, useEditorStore } from '@/store/editorStore'

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

    // F26: structural nav-link edits must sync into _localeContent slots, else getDisplayBlock merges
    // a stale slot and a deleted link reappears in the rendered header (QC bug).
    describe('updateHeaderBlock — _localeContent reconcile on link edit', () => {
        beforeEach(() => {
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
            useEditorStore.setState({
                activeLocale: 'ms',
                headerBlock: {
                    blockType: 'navigation',
                    links: [
                        { url: '/', label: 'Home' },
                        { url: '/about', label: 'About' },
                        { url: '/blog', label: 'Blog' },
                    ],
                    _localeContent: {
                        ms: {
                            links: [
                                { url: '/', label: 'Utama' },
                                { url: '/about', label: 'Tentang' },
                                { url: '/blog', label: 'Berita' },
                            ],
                        },
                    },
                } as never,
            })
        })

        it('deleting a nav link removes it from the ms _localeContent slot too', () => {
            // Act — user deletes the /blog link (panel sends the remaining top-level links)
            useEditorStore.getState().updateHeaderBlock({
                links: [{ url: '/', label: 'Home' }, { url: '/about', label: 'About' }],
            } as never)

            // Assert — slot no longer contains the deleted link, survivors keep their BM labels
            const h = useEditorStore.getState().headerBlock as Record<string, unknown>
            const msLinks = (h._localeContent as Record<string, Record<string, unknown>>).ms.links as Array<Record<string, unknown>>
            expect(msLinks).toHaveLength(2)
            expect(msLinks.map(l => l.url)).toEqual(['/', '/about'])
            expect(msLinks.find(l => l.url === '/')?.label).toBe('Utama') // translation preserved
            expect(msLinks.some(l => l.url === '/blog')).toBe(false)       // deleted link gone
        })

        it('adding a nav link appends it to the ms slot with the base label', () => {
            useEditorStore.getState().updateHeaderBlock({
                links: [
                    { url: '/', label: 'Home' },
                    { url: '/about', label: 'About' },
                    { url: '/blog', label: 'Blog' },
                    { url: '/contact', label: 'Contact' },
                ],
            } as never)

            const h = useEditorStore.getState().headerBlock as Record<string, unknown>
            const msLinks = (h._localeContent as Record<string, Record<string, unknown>>).ms.links as Array<Record<string, unknown>>
            expect(msLinks).toHaveLength(4)
            expect(msLinks.find(l => l.url === '/contact')?.label).toBe('Contact') // new link → base label
            expect(msLinks.find(l => l.url === '/about')?.label).toBe('Tentang')   // existing translation kept
        })
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

        it('duplicateBlock assigns a fresh id to the copy (no PK collision on save)', () => {
            // Arrange — original carries a persisted block id (now preserved verbatim on save)
            useEditorStore.getState().updateBlock(0, { id: '6a1d0bf37593a40039381abc' })

            // Act
            useEditorStore.getState().duplicateBlock(0)

            // Assert — copy has a distinct, non-empty id so the two rows don't collide on the PK
            const blocks = useEditorStore.getState().blocks
            expect(blocks[1].blockType).toBe(blocks[0].blockType)
            expect(blocks[1].id).toBeTruthy()
            expect(blocks[1].id).not.toBe(blocks[0].id)
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
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/sites/site-1/save'), expect.any(Object))
            
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

        it('serializes autosave behind another editor write for the same site', async () => {
            let releaseFirstWrite!: () => void
            const firstWriteGate = new Promise<void>((resolve) => {
                releaseFirstWrite = resolve
            })
            const firstWrite = runSerializedEditorSave('site-1', async () => {
                await firstWriteGate
                return true
            })
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })

            useEditorStore.getState().updateBlock(0, { heading: 'Queued latest state' })
            const savePromise = useEditorStore.getState().performSave()
            await Promise.resolve()

            expect(global.fetch).not.toHaveBeenCalled()

            releaseFirstWrite()
            await firstWrite
            await savePromise

            expect(global.fetch).toHaveBeenCalledTimes(1)
            const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body)
            expect(requestBody.blocks[0].heading).toBe('Queued latest state')
        })

        it('keeps newer edits dirty when an older save response succeeds', async () => {
            let resolveSave!: (response: { ok: boolean }) => void
            ;(global.fetch as any).mockImplementationOnce(() => new Promise((resolve) => {
                resolveSave = resolve
            }))

            useEditorStore.getState().updateBlock(0, { heading: 'First revision' })
            const savePromise = useEditorStore.getState().performSave()
            await Promise.resolve()

            useEditorStore.getState().updateBlock(0, { heading: 'Newer revision' })
            resolveSave({ ok: true })
            await savePromise

            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
            expect(useEditorStore.getState().saveStatus).toBe('idle')
            expect(useEditorStore.getState().blocks[0].heading).toBe('Newer revision')
        })

        it('[TC-GH1640-PERF-02] keeps a newer locale edit dirty when an older save succeeds', async () => {
            // Arrange
            let resolveSave!: (response: { ok: boolean }) => void
            ;(global.fetch as any).mockImplementationOnce(() => new Promise((resolve) => {
                resolveSave = resolve
            }))
            useEditorStore.getState().updateBlock(0, { heading: 'First revision' })
            const savePromise = useEditorStore.getState().performSave()
            await Promise.resolve()

            // Act
            useEditorStore.getState().setLocaleOverride('hero-1', 'ms', { heading: 'Tajuk baru' })
            resolveSave({ ok: true })
            await savePromise

            // Assert
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
            expect(useEditorStore.getState().saveStatus).toBe('idle')
            expect(useEditorStore.getState().localeOverrides['hero-1'].ms.heading).toBe('Tajuk baru')
        })

        it('[TC-GH1640-PERF-02] keeps a newer AI batch dirty when an older save succeeds', async () => {
            // Arrange
            let resolveSave!: (response: { ok: boolean }) => void
            ;(global.fetch as any).mockImplementationOnce(() => new Promise((resolve) => {
                resolveSave = resolve
            }))
            useEditorStore.getState().updateBlock(0, { heading: 'First revision' })
            const savePromise = useEditorStore.getState().performSave()
            await Promise.resolve()

            // Act
            useEditorStore.getState().pushBatch(
                [{ blockType: 'hero', heading: 'AI revision' }],
                mockTheme,
                'AI update',
            )
            resolveSave({ ok: true })
            await savePromise

            // Assert
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
            expect(useEditorStore.getState().saveStatus).toBe('idle')
            expect(useEditorStore.getState().blocks[0].heading).toBe('AI revision')
        })

        it('[TC-GH1640-PERF-02] drops a queued save after the editor context changes', async () => {
            // Arrange
            let releaseFirstWrite!: () => void
            const firstWriteGate = new Promise<void>((resolve) => {
                releaseFirstWrite = resolve
            })
            const firstWrite = runSerializedEditorSave('site-1', async () => {
                await firstWriteGate
                return true
            })
            useEditorStore.getState().setCurrentPageId('page-1')
            useEditorStore.getState().updateBlock(0, { heading: 'Site one edit' })
            const savePromise = useEditorStore.getState().performSave()
            await Promise.resolve()

            // Act
            useEditorStore.getState().init('site-2', [{ blockType: 'hero', heading: 'Site two' }], mockTheme, 'Site Two')
            useEditorStore.getState().setCurrentPageId('page-2')
            releaseFirstWrite()
            await firstWrite
            const saved = await savePromise

            // Assert
            expect(saved).toBe(false)
            expect(global.fetch).not.toHaveBeenCalled()
            expect(useEditorStore.getState().siteId).toBe('site-2')
            expect(useEditorStore.getState().currentPageId).toBe('page-2')
        })

        it('[TC-GH1640-PERF-02] does not mark a new page saved when an old response completes', async () => {
            // Arrange: page A and page B deliberately reach the same revision number.
            let resolveSave!: (response: { ok: boolean }) => void
            ;(global.fetch as any).mockImplementationOnce(() => new Promise((resolve) => {
                resolveSave = resolve
            }))
            useEditorStore.getState().setCurrentPageId('page-1')
            useEditorStore.getState().updateBlock(0, { heading: 'Page A revision' })
            const savePromise = useEditorStore.getState().performSave()
            await Promise.resolve()

            // Act: initialize page B while page A's request is still in flight.
            useEditorStore.getState().init(
                'site-1',
                [{ blockType: 'hero', heading: 'Page B initial' }],
                mockTheme,
                'Test Site',
            )
            useEditorStore.getState().setCurrentPageId('page-2')
            useEditorStore.getState().updateBlock(0, { heading: 'Page B revision' })
            resolveSave({ ok: true })
            const saved = await savePromise

            // Assert: page A's response cannot clear page B's dirty state.
            expect(saved).toBe(false)
            expect(useEditorStore.getState().currentPageId).toBe('page-2')
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
            expect(useEditorStore.getState().saveStatus).toBe('idle')
            expect(useEditorStore.getState().blocks[0].heading).toBe('Page B revision')
        })

        it('TC-F12.06: should include isDraft, headerBlock, and footerBlock when saving', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })

            const header = { blockType: 'navigation', links: [{ label: 'Home' }] }
            const footer = { blockType: 'footer', text: 'Footer' }
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site', header, footer)
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
            expect(requestBody.headerBlock).toEqual(expect.objectContaining({ blockType: 'navigation' }))
            expect(requestBody.footerBlock).toEqual(expect.objectContaining({ blockType: 'footer' }))
        })

        it('TC-F12.14: setAutoSaveEnabled(false) should prevent auto-save from firing', async () => {
            useEditorStore.getState().setAutoSaveEnabled(false)
            useEditorStore.getState().updateBlock(0, { heading: 'Should not auto-save' })
            vi.advanceTimersByTime(5000)
            await Promise.resolve()
            expect(global.fetch).not.toHaveBeenCalled()
            // hasUnsavedChanges still true — just not persisted
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
        })

        it('TC-F12.15: setAutoSaveEnabled(true) should re-enable auto-save', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
            useEditorStore.getState().setAutoSaveEnabled(false)
            useEditorStore.getState().updateBlock(0, { heading: 'Pending' })
            vi.advanceTimersByTime(3000)
            await Promise.resolve()
            expect(global.fetch).not.toHaveBeenCalled()

            // Re-enable and trigger a new change — should auto-save
            useEditorStore.getState().setAutoSaveEnabled(true)
            useEditorStore.getState().updateBlock(0, { heading: 'After re-enable' })
            vi.advanceTimersByTime(3000)
            await Promise.resolve()
            expect(global.fetch).toHaveBeenCalledTimes(1)
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
            await vi.advanceTimersByTimeAsync(5000)
            expect(global.fetch).toHaveBeenCalledTimes(2)

            // Advance 10s
            await vi.advanceTimersByTimeAsync(10000)
            expect(global.fetch).toHaveBeenCalledTimes(3)

            // Advance 20s
            await vi.advanceTimersByTimeAsync(20000)
            expect(global.fetch).toHaveBeenCalledTimes(4)

            // No more retries
            await vi.advanceTimersByTimeAsync(30000)
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

    describe('footer-last invariant (US-792)', () => {
        const blocksWithFooter = [
            { blockType: 'hero', heading: 'Hero' },
            { blockType: 'features', items: [] },
            { blockType: 'about', content: 'About' },
            { blockType: 'footer', variant: 'simple' },
        ]

        beforeEach(() => {
            useEditorStore.getState().init('site-1', blocksWithFooter, mockTheme, 'Test Site')
        })

        describe('addBlock', () => {
            it('should clamp insert position to before footer when afterIndex >= footerIdx', () => {
                // footer is at index 3; trying to insert after index 3 should land before it
                useEditorStore.getState().addBlock(3, { blockType: 'cta', text: 'CTA' })
                const blocks = useEditorStore.getState().blocks
                expect(blocks[blocks.length - 1].blockType).toBe('footer')
                const ctaIdx = blocks.findIndex(b => b.blockType === 'cta')
                const footerIdx = blocks.findIndex(b => b.blockType === 'footer')
                expect(ctaIdx).toBeLessThan(footerIdx)
            })

            it('should allow normal insert before footer position', () => {
                useEditorStore.getState().addBlock(0, { blockType: 'cta', text: 'CTA' })
                const blocks = useEditorStore.getState().blocks
                expect(blocks[1].blockType).toBe('cta')
                expect(blocks[blocks.length - 1].blockType).toBe('footer')
            })

            it('should place block before footer when no footer exists', () => {
                useEditorStore.getState().init('site-1', [{ blockType: 'hero', heading: 'H' }], mockTheme, 'Test')
                useEditorStore.getState().addBlock(0, { blockType: 'features', items: [] })
                const blocks = useEditorStore.getState().blocks
                expect(blocks[1].blockType).toBe('features')
            })
        })

        describe('duplicateBlock', () => {
            it('should be a no-op when duplicating footer', () => {
                const footerIdx = useEditorStore.getState().blocks.findIndex(b => b.blockType === 'footer')
                const countBefore = useEditorStore.getState().blocks.length
                useEditorStore.getState().duplicateBlock(footerIdx)
                expect(useEditorStore.getState().blocks).toHaveLength(countBefore)
                expect(useEditorStore.getState().blocks[footerIdx].blockType).toBe('footer')
            })

            it('should insert duplicate before footer when block is directly before footer', () => {
                // block at index 2 (about) is directly before footer (3)
                useEditorStore.getState().duplicateBlock(2)
                const blocks = useEditorStore.getState().blocks
                // duplicate lands at index 3, original footer bumped to 4
                expect(blocks[3].blockType).toBe('about')
                expect(blocks[4].blockType).toBe('footer')
            })

            it('should not create a second footer after duplicate', () => {
                const footerIdx = useEditorStore.getState().blocks.findIndex(b => b.blockType === 'footer')
                useEditorStore.getState().duplicateBlock(footerIdx)
                const footerCount = useEditorStore.getState().blocks.filter(b => b.blockType === 'footer').length
                expect(footerCount).toBe(1)
            })
        })

        describe('reorderBlocks', () => {
            it('should be a no-op when attempting to move footer', () => {
                const blocksBefore = [...useEditorStore.getState().blocks.map(b => b.blockType)]
                const footerIdx = blocksBefore.indexOf('footer')
                useEditorStore.getState().reorderBlocks(footerIdx, 0)
                const blocksAfter = useEditorStore.getState().blocks.map(b => b.blockType)
                expect(blocksAfter).toEqual(blocksBefore)
            })

            it('should be a no-op when moving a block to footer position', () => {
                const blocksBefore = [...useEditorStore.getState().blocks.map(b => b.blockType)]
                const footerIdx = blocksBefore.indexOf('footer')
                useEditorStore.getState().reorderBlocks(0, footerIdx)
                const blocksAfter = useEditorStore.getState().blocks.map(b => b.blockType)
                expect(blocksAfter).toEqual(blocksBefore)
            })

            it('should be a no-op when moving a block past footer position', () => {
                const blocksBefore = [...useEditorStore.getState().blocks.map(b => b.blockType)]
                const footerIdx = blocksBefore.indexOf('footer')
                useEditorStore.getState().reorderBlocks(0, footerIdx + 1)
                const blocksAfter = useEditorStore.getState().blocks.map(b => b.blockType)
                expect(blocksAfter).toEqual(blocksBefore)
            })

            it('should reorder blocks normally when footer is not involved', () => {
                // [hero(0), features(1), about(2), footer(3)] — move hero to index 2
                useEditorStore.getState().reorderBlocks(0, 2)
                const blocks = useEditorStore.getState().blocks
                expect(blocks[0].blockType).toBe('features')
                expect(blocks[2].blockType).toBe('hero')
                expect(blocks[3].blockType).toBe('footer')
            })
        })

        describe('pushBatch', () => {
            it('should deduplicate multiple footers and keep the first one last', () => {
                const incoming = [
                    { blockType: 'hero', heading: 'H' },
                    { blockType: 'footer', variant: 'minimal' },
                    { blockType: 'features', items: [] },
                    { blockType: 'footer', variant: 'simple' },
                ]
                useEditorStore.getState().pushBatch(incoming, mockTheme, 'AI batch')
                const blocks = useEditorStore.getState().blocks
                const footerBlocks = blocks.filter(b => b.blockType === 'footer')
                expect(footerBlocks).toHaveLength(1)
                // keeps the first footer encountered (minimal)
                expect(footerBlocks[0].variant).toBe('minimal')
                expect(blocks[blocks.length - 1].blockType).toBe('footer')
            })

            it('should place footer last when AI returns it mid-array', () => {
                const incoming = [
                    { blockType: 'hero', heading: 'H' },
                    { blockType: 'footer', variant: 'simple' },
                    { blockType: 'features', items: [] },
                ]
                useEditorStore.getState().pushBatch(incoming, mockTheme, 'AI batch')
                const blocks = useEditorStore.getState().blocks
                expect(blocks[blocks.length - 1].blockType).toBe('footer')
                expect(blocks.findIndex(b => b.blockType === 'features')).toBeLessThan(
                    blocks.findIndex(b => b.blockType === 'footer')
                )
            })

            it('should pass through blocks unchanged when no footer present', () => {
                const incoming = [
                    { blockType: 'hero', heading: 'H' },
                    { blockType: 'features', items: [] },
                ]
                useEditorStore.getState().pushBatch(incoming, mockTheme, 'AI batch')
                const blocks = useEditorStore.getState().blocks
                expect(blocks).toHaveLength(2)
                expect(blocks[0].blockType).toBe('hero')
                expect(blocks[1].blockType).toBe('features')
            })
        })
    })

    describe('cross-page save safety', () => {
        beforeEach(() => {
            vi.useFakeTimers()
            global.fetch = vi.fn()
            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
        })

        afterEach(() => {
            vi.restoreAllMocks()
            vi.useRealTimers()
        })

        it('TC-CROSS-01: performSave should include currentPageId in save URL', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })

            useEditorStore.setState({ currentPageId: 'page-about-123' })
            useEditorStore.getState().updateBlock(0, { heading: 'About edit' })

            vi.advanceTimersByTime(3000)
            await Promise.resolve()

            const url = (global.fetch as any).mock.calls[0][0]
            expect(url).toContain('pageId=page-about-123')
        })

        it('TC-CROSS-02: performSave without currentPageId should not include pageId param', async () => {
            ;(global.fetch as any).mockResolvedValueOnce({ ok: true })

            useEditorStore.setState({ currentPageId: null })
            useEditorStore.getState().updateBlock(0, { heading: 'Home edit' })

            vi.advanceTimersByTime(3000)
            await Promise.resolve()

            const url = (global.fetch as any).mock.calls[0][0]
            expect(url).not.toContain('pageId=')
        })

        it('TC-CROSS-03: init() should clear pending autoSaveTimer from previous page', () => {
            // Trigger auto-save timer
            useEditorStore.getState().updateBlock(0, { heading: 'Timer trigger' })
            expect(useEditorStore.getState().autoSaveTimer).not.toBeNull()

            // Init with new page data — timer should be cleared
            const newBlocks = [{ blockType: 'hero', heading: 'New Page' }]
            useEditorStore.getState().init('site-1', newBlocks, mockTheme, 'Test Site')

            expect(useEditorStore.getState().autoSaveTimer).toBeNull()
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)

            // Advance past debounce — should NOT trigger fetch (timer was cleared)
            vi.advanceTimersByTime(5000)
            expect(global.fetch).not.toHaveBeenCalled()
        })

        it('TC-CROSS-04: init() should reset isSaving, saveStatus, isAIStreaming', () => {
            useEditorStore.setState({
                isSaving: true,
                saveStatus: 'saving',
                isAIStreaming: true,
            })

            useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')

            const state = useEditorStore.getState()
            expect(state.isSaving).toBe(false)
            expect(state.saveStatus).toBe('idle')
            expect(state.isAIStreaming).toBe(false)
        })

        it('TC-CROSS-05: retry should stop when the editor page context changes', async () => {
            // Arrange
            useEditorStore.setState({ currentPageId: 'page-home' })
            ;(global.fetch as any)
                .mockRejectedValueOnce(new Error('Network error'))

            useEditorStore.getState().updateBlock(0, { heading: 'Will retry' })
            vi.advanceTimersByTime(3000)
            await Promise.resolve()

            // Assert
            expect((global.fetch as any).mock.calls[0][0]).toContain('pageId=page-home')

            // Act
            useEditorStore.setState({ currentPageId: 'page-about' })
            await vi.advanceTimersByTimeAsync(5000)

            // Assert
            expect(global.fetch).toHaveBeenCalledTimes(1)
            expect(useEditorStore.getState().currentPageId).toBe('page-about')
            expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
        })

        it('TC-CROSS-06: page switch should cancel debounce timer (no stale save)', () => {
            useEditorStore.getState().updateBlock(0, { heading: 'Edit before switch' })
            const timer = useEditorStore.getState().autoSaveTimer
            expect(timer).not.toBeNull()

            // Simulate handlePageSelected clearing the timer
            if (timer) clearTimeout(timer)
            useEditorStore.setState({ autoSaveTimer: null, hasUnsavedChanges: false })

            // Advance past debounce window
            vi.advanceTimersByTime(5000)
            expect(global.fetch).not.toHaveBeenCalled()
        })
    })
})
