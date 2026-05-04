import { describe, it, expect } from 'vitest'
import { derivePublishState } from '@/components/editor/EditorToolbar'

describe('derivePublishState', () => {
    const cases: Array<{
        name: string
        input: Parameters<typeof derivePublishState>[0]
        expected: ReturnType<typeof derivePublishState>
    }> = [
        {
            name: 'draft — not published, not publishing',
            input: { isPublished: false, isPublishing: false, hasUnsavedChanges: false, hasUnpublishedChanges: false },
            expected: 'draft',
        },
        {
            name: 'publishing — not yet published, publishing in progress',
            input: { isPublished: false, isPublishing: true, hasUnsavedChanges: false, hasUnpublishedChanges: false },
            expected: 'publishing',
        },
        {
            name: 'live — published, no changes',
            input: { isPublished: true, isPublishing: false, hasUnsavedChanges: false, hasUnpublishedChanges: false },
            expected: 'live',
        },
        {
            name: 'live-dirty — published with unsaved changes',
            input: { isPublished: true, isPublishing: false, hasUnsavedChanges: true, hasUnpublishedChanges: false },
            expected: 'live-dirty',
        },
        {
            name: 'live-dirty — published with unpublished changes',
            input: { isPublished: true, isPublishing: false, hasUnsavedChanges: false, hasUnpublishedChanges: true },
            expected: 'live-dirty',
        },
        {
            name: 'live-dirty — published with both unsaved and unpublished',
            input: { isPublished: true, isPublishing: false, hasUnsavedChanges: true, hasUnpublishedChanges: true },
            expected: 'live-dirty',
        },
        {
            name: 'updating — published and publishing (re-publish)',
            input: { isPublished: true, isPublishing: true, hasUnsavedChanges: false, hasUnpublishedChanges: false },
            expected: 'updating',
        },
        {
            name: 'updating — published and publishing with changes',
            input: { isPublished: true, isPublishing: true, hasUnsavedChanges: true, hasUnpublishedChanges: true },
            expected: 'updating',
        },
        {
            name: 'draft — not published even with unsaved changes',
            input: { isPublished: false, isPublishing: false, hasUnsavedChanges: true, hasUnpublishedChanges: false },
            expected: 'draft',
        },
    ]

    cases.forEach(({ name, input, expected }) => {
        it(name, () => {
            expect(derivePublishState(input)).toBe(expected)
        })
    })
})
