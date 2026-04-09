/**
 * Unit Tests — Editor Store: F05 Core Scenarios
 *
 * Coverage Map (QA Doc Traceability):
 *   TC-F05-store-01  → init() keeps ALL blocks (nav+footer + separate headerBlock)
 *   TC-F05-store-02  → reset() clears autoSaveTimer and all state fields
 *   TC-F05-store-03  → pushBatch() with empty blocks array still updates store
 *   TC-F05-store-05  → init() with new siteId resets hasUnsavedChanges to false
 *   TC-F05-store-09  → deleteBlock adjusts block indices correctly
 *   TC-F05-store-10  → duplicateBlock creates deep clone, not a shared reference
 *
 * Note: TC-F05-store-04/06/07/08 are already covered in:
 *   - editorStore.undoRedo.test.ts (TC-F11.06, TC-F11.15, TC-F11.20)
 *   - editor-store.test.ts (TC-F05.31)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { BlockData } from '@/store/editorStore'

// ── Fixtures ──────────────────────────────────────────────────────────────

const makeBlock = (type: string, extra?: Record<string, unknown>): BlockData => ({
    blockType: type,
    ...extra,
})

const mockTheme = { primaryColor: '#0d9488', fontFamily: 'Inter' }

// ── TC-F05-store-01: init() with nav+footer in blocks + explicit headerBlock ──

describe('[TC-F05-store-01] init() preserves ALL blocks for index consistency', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    it('keeps nav block in blocks array when explicit headerBlock is also provided', () => {
        // Arrange
        const blocks: BlockData[] = [
            makeBlock('navigation', { links: [{ label: 'Home' }] }),
            makeBlock('hero', { heading: 'Welcome' }),
            makeBlock('footer', { text: 'Copyright 2026' }),
        ]
        const explicitHeader = makeBlock('navigation', { links: [{ label: 'Shop' }] })
        const explicitFooter = makeBlock('footer', { text: 'Explicit Footer' })

        // Act
        useEditorStore.getState().init('site-1', blocks, mockTheme, 'Test Site', explicitHeader, explicitFooter)

        // Assert — blocks array keeps ALL 3 entries for iframe index consistency
        const state = useEditorStore.getState()
        expect(state.blocks).toHaveLength(3)
        expect(state.blocks[0].blockType).toBe('navigation')
        expect(state.blocks[1].blockType).toBe('hero')
        expect(state.blocks[2].blockType).toBe('footer')
    })

    it('sets effectiveHeader from explicit param, not from blocks fallback', () => {
        // Arrange
        const blocks: BlockData[] = [
            makeBlock('navigation', { links: [{ label: 'Fallback Nav' }] }),
            makeBlock('hero', { heading: 'Hello' }),
        ]
        const explicitHeader = makeBlock('navigation', { links: [{ label: 'Explicit Nav' }] })

        // Act
        useEditorStore.getState().init('site-1', blocks, mockTheme, 'Test Site', explicitHeader, null)

        // Assert — headerBlock is the explicit one, not the in-blocks nav
        const { headerBlock } = useEditorStore.getState()
        expect((headerBlock as any).links[0].label).toBe('Explicit Nav')
    })

    it('falls back to nav block inside blocks array when no explicit headerBlock given', () => {
        // Arrange
        const blocks: BlockData[] = [
            makeBlock('navigation', { links: [{ label: 'Home' }] }),
            makeBlock('hero', { heading: 'Hello' }),
        ]

        // Act
        useEditorStore.getState().init('site-1', blocks, mockTheme, 'Test Site')

        // Assert — headerBlock is taken from blocks
        const { headerBlock, blocks: storeBlocks } = useEditorStore.getState()
        expect(headerBlock).not.toBeNull()
        expect((headerBlock as any).blockType).toBe('navigation')
        // blocks array still contains the navigation block unchanged
        expect(storeBlocks[0].blockType).toBe('navigation')
    })

    it('creates default navigation headerBlock when neither explicit nor blocks contain nav', () => {
        // Arrange
        const blocks: BlockData[] = [makeBlock('hero')]

        // Act
        useEditorStore.getState().init('site-1', blocks, mockTheme, 'Test Site')

        // Assert — default header injected
        const { headerBlock } = useEditorStore.getState()
        expect(headerBlock).not.toBeNull()
        expect((headerBlock as any).blockType).toBe('navigation')
        // blocks are untouched — no nav was added
        expect(useEditorStore.getState().blocks).toHaveLength(1)
    })
})

// ── TC-F05-store-02: reset() clears autoSaveTimer and all state ────────────

describe('[TC-F05-store-02] reset() clears autoSaveTimer and resets all state fields', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        global.fetch = vi.fn().mockResolvedValue({ ok: true })
        useEditorStore.getState().reset()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('clears a pending autoSaveTimer set by handleContentChange', () => {
        // Arrange
        useEditorStore.getState().init('site-1', [makeBlock('hero')], mockTheme, 'Site')
        useEditorStore.getState().updateBlock(0, { heading: 'Dirty' })
        expect(useEditorStore.getState().autoSaveTimer).not.toBeNull()

        // Act
        useEditorStore.getState().reset()

        // Assert — timer reference is cleared in state
        expect(useEditorStore.getState().autoSaveTimer).toBeNull()
    })

    it('resets siteId, blocks, theme, siteName to initial values', () => {
        // Arrange
        useEditorStore.getState().init('site-42', [makeBlock('hero')], { color: 'red' }, 'My Site')

        // Act
        useEditorStore.getState().reset()

        // Assert
        const state = useEditorStore.getState()
        expect(state.siteId).toBeNull()
        expect(state.blocks).toHaveLength(0)
        expect(state.theme).toEqual({})
        expect(state.siteName).toBe('')
    })

    it('resets headerBlock and footerBlock to null', () => {
        // Arrange
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero')],
            {},
            'Site',
            makeBlock('navigation'),
            makeBlock('footer'),
        )

        // Act
        useEditorStore.getState().reset()

        // Assert
        expect(useEditorStore.getState().headerBlock).toBeNull()
        expect(useEditorStore.getState().footerBlock).toBeNull()
    })

    it('resets history, historyIndex, and all save-related flags', () => {
        // Arrange
        useEditorStore.getState().init('site-1', [makeBlock('hero')], {}, 'Site')
        useEditorStore.getState().updateBlock(0, { heading: 'Changed' })

        // Act
        useEditorStore.getState().reset()

        // Assert
        const state = useEditorStore.getState()
        expect(state.history).toHaveLength(0)
        expect(state.historyIndex).toBe(-1)
        expect(state.hasUnsavedChanges).toBe(false)
        expect(state.lastSavedAt).toBeNull()
        expect(state.isSaving).toBe(false)
        expect(state.saveStatus).toBe('idle')
        expect(state.isAIStreaming).toBe(false)
    })

    it('resets pages and currentPageId', () => {
        // Arrange
        useEditorStore.getState().init('site-1', [], {}, 'Site')
        useEditorStore.getState().setPages([
            { id: 'p1', title: 'Home', slug: 'home', status: 'published', isVisible: true, updatedAt: '' },
        ])
        useEditorStore.getState().setCurrentPageId('p1')

        // Act
        useEditorStore.getState().reset()

        // Assert
        expect(useEditorStore.getState().pages).toHaveLength(0)
        expect(useEditorStore.getState().currentPageId).toBeNull()
    })
})

// ── TC-F05-store-03: pushBatch() with empty blocks array ──────────────────

describe('[TC-F05-store-03] pushBatch() with empty blocks array', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [makeBlock('hero'), makeBlock('about')], mockTheme, 'Site')
    })

    it('replaces store blocks with empty array and marks unsaved', () => {
        // Act
        useEditorStore.getState().pushBatch([], {}, 'AI: cleared page')

        // Assert
        expect(useEditorStore.getState().blocks).toHaveLength(0)
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
    })

    it('still pushes a snapshot into history (1 undo action)', () => {
        // Arrange
        const historyBefore = useEditorStore.getState().history.length

        // Act
        useEditorStore.getState().pushBatch([], {}, 'AI: cleared all')

        // Assert — exactly one new snapshot added
        expect(useEditorStore.getState().history.length).toBe(historyBefore + 1)
        expect(useEditorStore.getState().historyIndex).toBe(historyBefore)
    })

    it('allows undo to restore previous blocks after empty pushBatch', () => {
        // Act
        useEditorStore.getState().pushBatch([], {}, 'AI: cleared')
        useEditorStore.getState().undo()

        // Assert — original blocks restored
        expect(useEditorStore.getState().blocks).toHaveLength(2)
        expect(useEditorStore.getState().blocks[0].blockType).toBe('hero')
    })

    it('updates theme with empty object when passed empty theme', () => {
        // Arrange — store has a theme
        const newTheme = {}

        // Act
        useEditorStore.getState().pushBatch([], newTheme, 'AI: reset theme')

        // Assert
        expect(useEditorStore.getState().theme).toEqual({})
    })
})

// ── TC-F05-store-05: init() with siteId change resets hasUnsavedChanges ───

describe('[TC-F05-store-05] init() with a new siteId resets hasUnsavedChanges', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    it('sets hasUnsavedChanges to false when re-initializing with a different siteId', () => {
        // Arrange — first site with dirty state
        useEditorStore.getState().init('site-A', [makeBlock('hero')], mockTheme, 'Site A')
        // Simulate dirty state manually (as if user changed something before loading next site)
        useEditorStore.setState({ hasUnsavedChanges: true })
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)

        // Act — init with a different siteId
        useEditorStore.getState().init('site-B', [makeBlock('about')], { color: 'blue' }, 'Site B')

        // Assert — unsaved flag cleared by init
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
    })

    it('sets hasUnsavedChanges to false even when re-initializing the same siteId', () => {
        // Arrange
        useEditorStore.getState().init('site-A', [makeBlock('hero')], mockTheme, 'Site A')
        useEditorStore.setState({ hasUnsavedChanges: true })

        // Act
        useEditorStore.getState().init('site-A', [makeBlock('hero')], mockTheme, 'Site A')

        // Assert
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
    })

    it('resets lastSavedAt to null on init', () => {
        // Arrange
        useEditorStore.getState().init('site-A', [makeBlock('hero')], mockTheme, 'Site A')
        useEditorStore.setState({ lastSavedAt: Date.now() })

        // Act
        useEditorStore.getState().init('site-B', [makeBlock('hero')], {}, 'Site B')

        // Assert
        expect(useEditorStore.getState().lastSavedAt).toBeNull()
    })

    it('replaces siteId with the new value in state', () => {
        // Arrange
        useEditorStore.getState().init('site-A', [], {}, 'A')

        // Act
        useEditorStore.getState().init('site-B', [], {}, 'B')

        // Assert
        expect(useEditorStore.getState().siteId).toBe('site-B')
    })
})

// ── TC-F05-store-09: deleteBlock adjusts indices correctly ────────────────

describe('[TC-F05-store-09] deleteBlock adjusts block indices correctly', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init(
            'site-1',
            [
                makeBlock('hero', { id: 'b0' }),
                makeBlock('about', { id: 'b1' }),
                makeBlock('features', { id: 'b2' }),
                makeBlock('contact', { id: 'b3' }),
            ],
            mockTheme,
            'Site',
        )
    })

    it('removes the block at the specified index, shifting subsequent blocks down', () => {
        // Act — delete middle block (index 1)
        useEditorStore.getState().deleteBlock(1)

        // Assert
        const blocks = useEditorStore.getState().blocks
        expect(blocks).toHaveLength(3)
        expect((blocks[0] as any).id).toBe('b0')
        expect((blocks[1] as any).id).toBe('b2') // was index 2, now index 1
        expect((blocks[2] as any).id).toBe('b3') // was index 3, now index 2
    })

    it('removes the first block without affecting the rest', () => {
        // Act
        useEditorStore.getState().deleteBlock(0)

        // Assert
        const blocks = useEditorStore.getState().blocks
        expect(blocks).toHaveLength(3)
        expect((blocks[0] as any).id).toBe('b1')
        expect((blocks[1] as any).id).toBe('b2')
        expect((blocks[2] as any).id).toBe('b3')
    })

    it('removes the last block without affecting the rest', () => {
        // Act
        useEditorStore.getState().deleteBlock(3)

        // Assert
        const blocks = useEditorStore.getState().blocks
        expect(blocks).toHaveLength(3)
        expect((blocks[2] as any).id).toBe('b2')
    })

    it('deleting the only block results in empty blocks array', () => {
        // Arrange
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', [makeBlock('hero', { id: 'only' })], {}, 'Site')

        // Act
        useEditorStore.getState().deleteBlock(0)

        // Assert
        expect(useEditorStore.getState().blocks).toHaveLength(0)
    })

    it('delete pushes snapshot — undo restores the deleted block at the correct index', () => {
        // Act
        useEditorStore.getState().deleteBlock(1)
        useEditorStore.getState().undo()

        // Assert — block at index 1 is restored
        const blocks = useEditorStore.getState().blocks
        expect(blocks).toHaveLength(4)
        expect((blocks[1] as any).id).toBe('b1')
        expect((blocks[2] as any).id).toBe('b2')
    })
})

// ── TC-F05-store-10: duplicateBlock creates deep clone (not reference) ────

describe('[TC-F05-store-10] duplicateBlock creates a deep clone, not a shared reference', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    it('inserts a copy of the block at index+1', () => {
        // Arrange
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero', { heading: 'Original' }), makeBlock('about')],
            {},
            'Site',
        )

        // Act
        useEditorStore.getState().duplicateBlock(0)

        // Assert
        const blocks = useEditorStore.getState().blocks
        expect(blocks).toHaveLength(3)
        expect(blocks[0].blockType).toBe('hero')
        expect(blocks[1].blockType).toBe('hero') // duplicate at index 1
        expect(blocks[2].blockType).toBe('about') // shifted to index 2
    })

    it('mutating the duplicate does not affect the original', () => {
        // Arrange
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero', { heading: 'Original', nested: { value: 42 } })],
            {},
            'Site',
        )

        // Act — duplicate
        useEditorStore.getState().duplicateBlock(0)

        // Mutate the duplicate via updateBlock
        useEditorStore.getState().updateBlock(1, { heading: 'Modified Copy', nested: { value: 99 } })

        // Assert — original is untouched
        const blocks = useEditorStore.getState().blocks
        expect((blocks[0] as any).heading).toBe('Original')
        expect((blocks[0] as any).nested.value).toBe(42)
        expect((blocks[1] as any).heading).toBe('Modified Copy')
        expect((blocks[1] as any).nested.value).toBe(99)
    })

    it('mutating the original does not affect the duplicate', () => {
        // Arrange
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero', { heading: 'Original', data: { items: ['a', 'b'] } })],
            {},
            'Site',
        )

        // Act — duplicate then modify original
        useEditorStore.getState().duplicateBlock(0)
        useEditorStore.getState().updateBlock(0, { heading: 'Changed Original', data: { items: ['x'] } })

        // Assert — duplicate at index 1 is still the old values
        const blocks = useEditorStore.getState().blocks
        expect((blocks[1] as any).heading).toBe('Original')
        expect((blocks[1] as any).data.items).toEqual(['a', 'b'])
    })

    it('duplicate of the last block appends to end of array', () => {
        // Arrange
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('hero'), makeBlock('about'), makeBlock('contact', { email: 'a@b.com' })],
            {},
            'Site',
        )

        // Act
        useEditorStore.getState().duplicateBlock(2)

        // Assert
        const blocks = useEditorStore.getState().blocks
        expect(blocks).toHaveLength(4)
        expect(blocks[3].blockType).toBe('contact')
        expect((blocks[3] as any).email).toBe('a@b.com')
    })

    it('duplicate with deeply nested arrays produces independent copies', () => {
        // Arrange
        useEditorStore.getState().init(
            'site-1',
            [makeBlock('nav', { links: [{ label: 'Home' }, { label: 'Shop', sub: [{ label: 'Shoes' }] }] })],
            {},
            'Site',
        )

        // Act
        useEditorStore.getState().duplicateBlock(0)

        // Mutate nested array in original via store
        const originalLinks = JSON.parse(JSON.stringify((useEditorStore.getState().blocks[0] as any).links))
        originalLinks[1].sub[0].label = 'Hats'
        useEditorStore.getState().updateBlock(0, { links: originalLinks })

        // Assert — duplicate's nested sub is still 'Shoes'
        expect((useEditorStore.getState().blocks[1] as any).links[1].sub[0].label).toBe('Shoes')
    })
})
