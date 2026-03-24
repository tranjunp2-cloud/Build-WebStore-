import { describe, it, expect, beforeEach } from 'vitest'
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
})
