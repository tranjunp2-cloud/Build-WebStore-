import type { ContactInfoValue } from '@/store/editorStore'

type Direction = 'undo' | 'redo'

type HistoryView = {
    historyIndex: number
    canUndo: () => boolean
    canRedo: () => boolean
}

/**
 * Save the contact info a history step stands for BEFORE the pointer moves (GH-2245).
 * - 'saved': written, and the history is still where it was: the caller may move the pointer.
 * - 'failed': the save failed, nothing changed.
 * - 'interrupted': the history moved while saving (a block edit, AI streaming): the site was put back.
 */
export async function saveContactHistoryStep(args: {
    direction: Direction
    step: { apply: ContactInfoValue; revert: ContactInfoValue }
    startIndex: number
    persist: (contactInfo: ContactInfoValue) => Promise<boolean | undefined>
    getHistory: () => HistoryView
}): Promise<'saved' | 'failed' | 'interrupted'> {
    const { direction, step, startIndex, persist, getHistory } = args
    if ((await persist(step.apply)) !== true) return 'failed'
    const now = getHistory()
    const stillThere = now.historyIndex === startIndex && (direction === 'undo' ? now.canUndo() : now.canRedo())
    if (stillThere) return 'saved'
    await persist(step.revert)
    return 'interrupted'
}
