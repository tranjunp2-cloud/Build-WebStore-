import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../../../store/editorStore'

const mockBlocks = [
    { blockType: 'hero', heading: 'Welcome', subheading: 'Hello' },
    { blockType: 'about', content: 'About us content' },
    { blockType: 'contact', email: 'hello@test.com' },
]
const mockTheme = { primaryColor: '#0d9488', fontFamily: 'Inter' }

describe('EditorStore — F11 Undo/Redo Enhancements', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
        useEditorStore.getState().init('site-1', mockBlocks, mockTheme, 'Test Site')
    })

    // ── Basic undo/redo (existing coverage) ──────────────────────────────

    it('canUndo = false initially, true after change', () => {
        expect(useEditorStore.getState().canUndo()).toBe(false)
        useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
        expect(useEditorStore.getState().canUndo()).toBe(true)
    })

    it('undo restores previous state', () => {
        const original = useEditorStore.getState().blocks[0].heading
        useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().blocks[0].heading).toBe(original)
    })

    it('redo re-applies undone change', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
        useEditorStore.getState().undo()
        useEditorStore.getState().redo()
        expect(useEditorStore.getState().blocks[0].heading).toBe('Changed')
    })

    // ── Action labels (metadata) ─────────────────────────────────────────

    it('updateBlock stores a label in the snapshot', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'New title' }, 'Changed hero heading')
        const { historyIndex, history } = useEditorStore.getState()
        expect(history[historyIndex].label).toBe('Changed hero heading')
    })

    it('undoLabel returns the current action label', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'A' }, 'Edit A')
        expect(useEditorStore.getState().undoLabel()).toBe('Edit A')
    })

    it('redoLabel returns the next action label after undo', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'A' }, 'Edit A')
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().redoLabel()).toBe('Edit A')
    })

    // ── TC-F11.12: Branch cut-off (redo cleared on new action) ───────────

    it('TC-F11.12 — new action after undo clears redo stack', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'A' })
        useEditorStore.getState().updateBlock(0, { heading: 'B' })
        useEditorStore.getState().updateBlock(0, { heading: 'C' })
        // Undo twice (back to A)
        useEditorStore.getState().undo()
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().canRedo()).toBe(true)
        // New action branches off — redo should be gone
        useEditorStore.getState().updateBlock(0, { heading: 'D' })
        expect(useEditorStore.getState().canRedo()).toBe(false)
    })

    // ── TC-F11.15: FIFO 50 max states ────────────────────────────────────

    it('TC-F11.15 — history capped at 50 states', () => {
        for (let i = 0; i < 55; i++) {
            useEditorStore.getState().updateBlock(0, { heading: `Change ${i}` })
        }
        const { history } = useEditorStore.getState()
        expect(history.length).toBeLessThanOrEqual(50)
    })

    it('TC-F11.15 — cannot undo more than 50 steps', () => {
        for (let i = 0; i < 55; i++) {
            useEditorStore.getState().updateBlock(0, { heading: `Change ${i}` })
        }
        // Undo as many times as possible
        let undoCount = 0
        while (useEditorStore.getState().canUndo()) {
            useEditorStore.getState().undo()
            undoCount++
            if (undoCount > 60) break // safety
        }
        expect(undoCount).toBeLessThanOrEqual(49) // at most 49 steps back (50 snapshots - 1 initial)
        expect(useEditorStore.getState().canUndo()).toBe(false)
    })

    // ── TC-F11.16: Clear on reset (session boundary) ─────────────────────

    it('TC-F11.16 — reset clears history', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'Changed' })
        useEditorStore.getState().reset()
        expect(useEditorStore.getState().canUndo()).toBe(false)
        expect(useEditorStore.getState().canRedo()).toBe(false)
        expect(useEditorStore.getState().history).toHaveLength(0)
    })

    // ── TC-F11.06: AI batch — 1 response = 1 undo action ─────────────────

    it('TC-F11.06 — pushBatch groups all AI changes into 1 undo', () => {
        const newBlocks = [
            { blockType: 'hero', heading: 'AI heading', subheading: 'AI sub' },
            { blockType: 'about', content: 'AI about' },
        ]
        const newTheme = { primaryColor: '#ff0000' }
        useEditorStore.getState().pushBatch(newBlocks, newTheme, 'AI: full redesign')

        // historyIndex should be 2 (init + pushBatch)
        expect(useEditorStore.getState().historyIndex).toBe(1)
        expect(useEditorStore.getState().blocks[0].heading).toBe('AI heading')
        expect(useEditorStore.getState().theme.primaryColor).toBe('#ff0000')

        // One Ctrl+Z should restore EVERYTHING
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().blocks[0].heading).toBe('Welcome')
        expect(useEditorStore.getState().theme.primaryColor).toBe('#0d9488')
    })

    it('TC-F07.039 — template batch restores layout, theme, globals and locale content in one undo', () => {
        // Arrange
        const oldHeader = { blockType: 'navigation', variant: 'default', logoText: 'Old brand' }
        const oldFooter = { blockType: 'footer', variant: 'simple', copyrightText: 'Old footer' }
        const oldGlobals = { cartWidget: null, whatsappButton: null, socialWidget: null }
        const oldLocaleOverrides = { hero1: { ms: { headline: 'Tajuk lama' } } }
        const newLocaleOverrides = { hero1: { ms: { headline: 'Tajuk baharu' } } }
        useEditorStore.getState().init(
            'site-1',
            mockBlocks,
            mockTheme,
            'Site',
            oldHeader,
            oldFooter,
            oldGlobals,
            oldLocaleOverrides,
        )

        // Act
        useEditorStore.getState().pushBatch(
            [{ blockType: 'hero', headline: 'New layout' }],
            { primaryColor: '#000000' },
            'Apply template',
            {
                headerBlock: { ...oldHeader, variant: 'transparent' },
                footerBlock: { ...oldFooter, variant: 'minimal' },
                globalBlocks: {
                    ...oldGlobals,
                    cartWidget: { blockType: 'cartWidget', variant: 'floating' },
                },
                localeOverrides: newLocaleOverrides,
            },
        )

        useEditorStore.getState().undo()

        // Assert
        const restored = useEditorStore.getState()
        expect(restored.blocks).toEqual(mockBlocks)
        expect(restored.theme).toEqual(mockTheme)
        expect(restored.headerBlock).toEqual(oldHeader)
        expect(restored.footerBlock).toEqual(oldFooter)
        expect(restored.globalBlocks).toEqual(oldGlobals)
        expect(restored.localeOverrides).toEqual(oldLocaleOverrides)

        useEditorStore.getState().redo()
        expect(useEditorStore.getState().localeOverrides).toEqual(newLocaleOverrides)
    })

    it('TC-F11.06 — pushBatch label is recorded', () => {
        const newBlocks = [{ blockType: 'hero', heading: 'AI' }]
        useEditorStore.getState().pushBatch(newBlocks, mockTheme, 'AI: generated homepage')
        expect(useEditorStore.getState().undoLabel()).toBe('AI: generated homepage')
    })

    // ── TC-F11.20: AI streaming guard ────────────────────────────────────

    it('TC-F11.20 — undo/redo blocked while AI is streaming', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'A' })
        useEditorStore.getState().setIsAIStreaming(true)

        expect(useEditorStore.getState().canUndo()).toBe(false)
        expect(useEditorStore.getState().canRedo()).toBe(false)

        const headingBefore = useEditorStore.getState().blocks[0].heading
        useEditorStore.getState().undo()
        // Should NOT have changed
        expect(useEditorStore.getState().blocks[0].heading).toBe(headingBefore)
    })

    it('TC-F11.20 — undo/redo restored after streaming ends', () => {
        useEditorStore.getState().updateBlock(0, { heading: 'A' })
        useEditorStore.getState().setIsAIStreaming(true)
        useEditorStore.getState().setIsAIStreaming(false)
        expect(useEditorStore.getState().canUndo()).toBe(true)
    })

    // ── TC-F11.04: Undo chèn Block mới (addBlock) ────────────────────────

    it('TC-F11.04 — undoing an added block completely removes it', () => {
        const initialLength = useEditorStore.getState().blocks.length
        const newBlock = { blockType: 'features', items: [] }
       
        useEditorStore.getState().addBlock(0, newBlock)
        expect(useEditorStore.getState().blocks.length).toBe(initialLength + 1)
        expect(useEditorStore.getState().blocks[1].blockType).toBe('features')

        useEditorStore.getState().undo()
        expect(useEditorStore.getState().blocks.length).toBe(initialLength)
        expect(useEditorStore.getState().blocks[1].blockType).not.toBe('features')

        useEditorStore.getState().redo()
        expect(useEditorStore.getState().blocks.length).toBe(initialLength + 1)
        expect(useEditorStore.getState().blocks[1].blockType).toBe('features')
    })

    // ── TC-F11.05: Undo/Redo Hoán đổi vị trí (reorderBlocks) ─────────────

    it('TC-F11.05 — undoing block reorder restores correct sequence', () => {
        const block0 = useEditorStore.getState().blocks[0]
        const block2 = useEditorStore.getState().blocks[2]

        useEditorStore.getState().reorderBlocks(0, 2)
        expect(useEditorStore.getState().blocks[2].blockType).toBe(block0.blockType)
        expect(useEditorStore.getState().blocks[0].blockType).toBe(mockBlocks[1].blockType)

        useEditorStore.getState().undo()
        expect(useEditorStore.getState().blocks[0].blockType).toBe(block0.blockType)
        expect(useEditorStore.getState().blocks[2].blockType).toBe(block2.blockType)
    })

    // ── TC-F11.09 & TC-F11.10: Deep un-mutation / Nested Data Undo ───────

    it('TC-F11.09 — undo deep nested data change restores deep clone completely without references', () => {
        const nestedData = { menu: [{ label: 'Home' }, { label: 'Shop', sub: [{ label: 'Shoes' }] }] }
        useEditorStore.getState().updateBlock(0, { nestedField: nestedData })
        
        // Note: Using "as any" since the store's BlockType definition natively doesn't know about dynamic tested fields like menu
        // Ensure state captured it
        expect((useEditorStore.getState().blocks[0] as any).nestedField.menu[1].sub[0].label).toBe('Shoes')
        
        // Change it again
        const mutatedData = { menu: [{ label: 'Home' }, { label: 'Shop', sub: [{ label: 'Hats' }] }] }
        useEditorStore.getState().updateBlock(0, { nestedField: mutatedData })
        expect((useEditorStore.getState().blocks[0] as any).nestedField.menu[1].sub[0].label).toBe('Hats')

        // Undo should restore 'Shoes' even if we mutate the object outside (proving deep clone)
        useEditorStore.getState().undo()
        expect((useEditorStore.getState().blocks[0] as any).nestedField.menu[1].sub[0].label).toBe('Shoes')
        
        // Mutate original arrays intentionally to see if store history is corrupted
        nestedData.menu[1].sub![0].label = 'Corrupted'
        
        // State must STILL be Shoes from history
        expect((useEditorStore.getState().blocks[0] as any).nestedField.menu[1].sub[0].label).toBe('Shoes')
    })

    // ── Additional coverage: Delete block ────────────────────────────────

    it('undoing a deleted block restores it completely', () => {
        const initialLength = useEditorStore.getState().blocks.length
        const blockToDelete = useEditorStore.getState().blocks[0]
        
        useEditorStore.getState().deleteBlock(0)
        expect(useEditorStore.getState().blocks.length).toBe(initialLength - 1)
        expect(useEditorStore.getState().blocks[0]).not.toEqual(blockToDelete)

        useEditorStore.getState().undo()
        expect(useEditorStore.getState().blocks.length).toBe(initialLength)
        expect(useEditorStore.getState().blocks[0]).toEqual(blockToDelete)
    })
})
