import { describe, expect, it } from 'vitest'
import { deriveSaveStatus } from '@/components/editor/EditorToolbar'

describe('deriveSaveStatus', () => {
    const now = 1_000_000

    it('TC-F12-113-01: reports Saved just now for a successful save in the last minute', () => {
        expect(deriveSaveStatus({
            isSaving: false,
            hasUnsavedChanges: false,
            lastSavedAt: now - 59_999,
            now,
        })).toBe('savedJustNow')
    })

    it('reports Saving and Unsaved ahead of the saved timestamp', () => {
        expect(deriveSaveStatus({
            isSaving: true,
            hasUnsavedChanges: true,
            lastSavedAt: now,
            now,
        })).toBe('saving')
        expect(deriveSaveStatus({
            isSaving: false,
            hasUnsavedChanges: true,
            lastSavedAt: now,
            now,
        })).toBe('unsaved')
    })

    it('falls back to Saved once the successful-save timestamp is older than one minute', () => {
        expect(deriveSaveStatus({
            isSaving: false,
            hasUnsavedChanges: false,
            lastSavedAt: now - 60_000,
            now,
        })).toBe('saved')
    })
})
