// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { validateContentFields, CONTENT_FIELD_LIMITS } from '@/app/(dashboard)/settings/email-templates/validate-content-fields'

// Fields can arrive as null at runtime (Payload stores unset group/text fields as null),
// even though the ContentFields type declares them as optional strings.
type LooseFields = Record<string, string | null | undefined>

describe('validateContentFields (F32)', () => {
    it('[TC-F32-V-01] returns null for all-null fields without throwing (regression: null.length)', () => {
        // Arrange — mirrors a re-saved config row with blank fields persisted as null
        const fields = { subject: null, greeting: null, ctaLabel: null, closing: null } as LooseFields

        // Act + Assert
        expect(() => validateContentFields(fields as never, 'contentEn')).not.toThrow()
        expect(validateContentFields(fields as never, 'contentEn')).toBeNull()
    })

    it('[TC-F32-V-01] returns null for undefined / empty-object fields', () => {
        expect(validateContentFields({} as never, 'contentMs')).toBeNull()
        expect(validateContentFields({ subject: '', greeting: '' } as never, 'contentEn')).toBeNull()
    })

    it('[TC-F32-V-02] returns an error when a field exceeds its character limit', () => {
        const overSubject = { subject: 'x'.repeat(CONTENT_FIELD_LIMITS.subject + 1) } as LooseFields
        expect(validateContentFields(overSubject as never, 'contentEn')).toBe(
            `contentEn subject exceeds ${CONTENT_FIELD_LIMITS.subject} characters`,
        )

        const overClosing = { closing: 'y'.repeat(CONTENT_FIELD_LIMITS.closing + 1) } as LooseFields
        expect(validateContentFields(overClosing as never, 'contentMs')).toBe(
            `contentMs closing exceeds ${CONTENT_FIELD_LIMITS.closing} characters`,
        )
    })

    it('[TC-F32-V-02] returns null when fields are exactly at the limit', () => {
        const atLimit = {
            subject: 'a'.repeat(CONTENT_FIELD_LIMITS.subject),
            closing: 'b'.repeat(CONTENT_FIELD_LIMITS.closing),
        } as LooseFields
        expect(validateContentFields(atLimit as never, 'contentEn')).toBeNull()
    })
})
