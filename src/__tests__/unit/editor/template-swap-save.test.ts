import { describe, expect, it } from 'vitest'
import {
    isTemplateSwapDraftStable,
    shouldSaveBeforeTemplateSwap,
} from '@/lib/editor/template-swap-save'

describe('shouldSaveBeforeTemplateSwap', () => {
    it('skips the redundant pre-save when the authoritative draft is clean', () => {
        expect(shouldSaveBeforeTemplateSwap({
            hasUnsavedChanges: false,
            saveInFlight: false,
            saveQueued: false,
        })).toBe(false)
    })

    it.each([
        { hasUnsavedChanges: true, saveInFlight: false, saveQueued: false },
        { hasUnsavedChanges: false, saveInFlight: true, saveQueued: false },
        { hasUnsavedChanges: false, saveInFlight: false, saveQueued: true },
    ])('requires a pre-save when local work may still be pending: %o', (state) => {
        expect(shouldSaveBeforeTemplateSwap(state)).toBe(true)
    })
})

describe('isTemplateSwapDraftStable', () => {
    it('accepts the save barrier only when the exact revision is clean', () => {
        expect(isTemplateSwapDraftStable(7, {
            contentRevision: 7,
            hasUnsavedChanges: false,
            saveInFlight: false,
            saveQueued: false,
        })).toBe(true)
    })

    it('rejects a completed save when a newer revision arrived in flight', () => {
        expect(isTemplateSwapDraftStable(7, {
            contentRevision: 8,
            hasUnsavedChanges: true,
            saveInFlight: false,
            saveQueued: true,
        })).toBe(false)
    })
})
