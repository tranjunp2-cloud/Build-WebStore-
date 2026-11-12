// @vitest-environment jsdom
/**
 * Unit Tests — EditorStore contact info Undo/Redo (GH-2245)
 * Coverage Map:
 *   TC-F11.10 → a saved contact info edit is an Undo step; Undo hands back `before`, Redo `after`
 *   TC-F11.12 → a new contact step cuts off the Redo branch
 *   TC-F11.15 → contact steps count against the 50-step limit
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { BlockData } from '@/store/editorStore'

const makeBlock = (type: string): BlockData => ({ blockType: type })

function initStore() {
    useEditorStore.getState().reset()
    useEditorStore.getState().init('site-1', [makeBlock('hero')], {})
}

describe('EditorStore — contact info Undo/Redo', () => {
    beforeEach(initStore)

    it('[TC-F11.10] pushContactInfoStep lights up Undo without marking the draft dirty', () => {
        // Arrange
        const store = useEditorStore.getState()
        expect(store.canUndo()).toBe(false)
        // Act
        store.pushContactInfoStep({ phone: '094446809284' }, { phone: '094446809299' })
        // Assert
        const after = useEditorStore.getState()
        expect(after.canUndo()).toBe(true)
        expect(after.undoLabel()).toBe('Changed contact info')
        expect(after.hasUnsavedChanges).toBe(false)
    })

    it('[TC-F11.10] undo returns the old value, redo the new one, neither dirties the draft', () => {
        // Arrange
        useEditorStore.getState().pushContactInfoStep({ phone: '091' }, { phone: '099' })
        // Act
        const undone = useEditorStore.getState().undo()
        // Assert
        expect(undone?.contactInfo).toEqual({ phone: '091' })
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
        expect(useEditorStore.getState().canRedo()).toBe(true)
        // Act
        const redone = useEditorStore.getState().redo()
        // Assert
        expect(redone?.contactInfo).toEqual({ phone: '099' })
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(false)
    })

    it('[TC-F11.10] peekContactInfoStep reads the next step without moving the pointer', () => {
        // Arrange
        useEditorStore.getState().pushContactInfoStep({ address: 'A' }, { address: 'B' })
        const index = useEditorStore.getState().historyIndex
        // Act / Assert
        expect(useEditorStore.getState().peekContactInfoStep('undo')).toEqual({ apply: { address: 'A' }, revert: { address: 'B' } })
        expect(useEditorStore.getState().peekContactInfoStep('redo')).toBeNull()
        expect(useEditorStore.getState().historyIndex).toBe(index)
    })

    it('[TC-F11.10] a block edit step is not a contact step', () => {
        // Arrange
        useEditorStore.getState().updateBlock(0, { title: 'Hi' } as Partial<BlockData>)
        // Act / Assert
        expect(useEditorStore.getState().peekContactInfoStep('undo')).toBeNull()
        const undone = useEditorStore.getState().undo()
        expect(undone?.contactInfo).toBeUndefined()
        expect(useEditorStore.getState().hasUnsavedChanges).toBe(true)
    })

    it('[TC-F11.10] the history moving after a peek is detectable (index changes, step no longer contact)', () => {
        // Arrange: Undo of the contact step was peeked and its save is "in flight"
        useEditorStore.getState().pushContactInfoStep({ phone: '091' }, { phone: '099' })
        const startIndex = useEditorStore.getState().historyIndex
        expect(useEditorStore.getState().peekContactInfoStep('undo')).not.toBeNull()
        // Act: a block edit lands before the save returns
        useEditorStore.getState().updateBlock(0, { title: 'Hi' } as Partial<BlockData>)
        // Assert: the caller's guard (index unchanged) fails, and Undo would now cross the block edit, not the contact step
        expect(useEditorStore.getState().historyIndex).not.toBe(startIndex)
        expect(useEditorStore.getState().peekContactInfoStep('undo')).toBeNull()
    })

    it('[TC-F11.12] a new contact step after Undo drops the Redo branch', () => {
        // Arrange
        const store = useEditorStore.getState()
        store.pushContactInfoStep({ phone: '1' }, { phone: '2' })
        store.pushContactInfoStep({ phone: '2' }, { phone: '3' })
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().canRedo()).toBe(true)
        // Act
        useEditorStore.getState().pushContactInfoStep({ phone: '2' }, { phone: '9' })
        // Assert
        expect(useEditorStore.getState().canRedo()).toBe(false)
    })

    it('[TC-F11.15] contact steps respect the history limit', () => {
        // Arrange
        const { maxHistory } = useEditorStore.getState()
        // Act
        for (let i = 0; i < maxHistory + 10; i++) {
            useEditorStore.getState().pushContactInfoStep({ phone: String(i) }, { phone: String(i + 1) })
        }
        // Assert
        expect(useEditorStore.getState().history.length).toBe(maxHistory)
    })
})
