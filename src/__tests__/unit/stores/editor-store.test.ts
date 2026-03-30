import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'

// ── TC-F05.03 & TC-F05.15: Undo/Redo Engine ──────────────────────
describe('useEditorStore — History Stack', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        // Act: Initial setup snapshot
        useEditorStore.getState().init('site-123', [], {}, 'My Test Site')
    })

    it('TC-F05.03: Pushes snapshot onto stack on change and allows undo', () => {
        // Arrange
        const { updateTheme, undo } = useEditorStore.getState()
        
        // Act
        updateTheme({ primaryColor: '#FF0000' })
        
        // Assert state changed
        expect(useEditorStore.getState().theme.primaryColor).toBe('#FF0000')
        expect(useEditorStore.getState().canUndo()).toBe(true)
        
        // Act again
        useEditorStore.getState().undo()
        
        // Assert revert
        expect(useEditorStore.getState().theme.primaryColor).toBeUndefined()
        expect(useEditorStore.getState().canRedo()).toBe(true)
    })

    it('TC-F05.15: Undo restores previously swapped/sorted block positions', () => {
        // Arrange
        const { addBlock, reorderBlocks, undo } = useEditorStore.getState()
        addBlock(-1, { blockType: 'hero', id: '1' })
        addBlock(0, { blockType: 'features', id: '2' })
        
        expect(useEditorStore.getState().blocks[0].id).toBe('1')

        // Act - Swap
        reorderBlocks(0, 1)

        // Assert Swap
        expect(useEditorStore.getState().blocks[0].id).toBe('2')
        
        // Act - Revert Swap
        undo()

        // Assert Revert
        expect(useEditorStore.getState().blocks[0].id).toBe('1')
    })

    it('TC-F05.31: Memory Limit - Dropping oldest state after 50 modifications', () => {
        // Arrange
        const { updateTheme } = useEditorStore.getState()
        
        // Act: perform 52 operations
        for (let i = 1; i <= 52; i++) {
            updateTheme({ count: i })
        }
        
        const state = useEditorStore.getState()
        
        // Assert: It should cap at 50 maxHistory instances
        // maxHistory is 50. Therefore history.length <= 50.
        expect(state.history.length).toBeLessThanOrEqual(50)
        
        // The current state is count=52
        expect(state.theme.count).toBe(52)
        
        // The bottom-most history state should NOT be the first change count=1, because oldest is dropped.
        // It should be 52 - 50 + 1 or similar index
        expect(state.history[0].theme.count).not.toBe(1)
        expect(state.history[0].theme.count).not.toBeUndefined()
    })
})
