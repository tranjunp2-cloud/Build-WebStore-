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
        expect(() => validateContentFields(fields as never, 'English')).not.toThrow()
        expect(validateContentFields(fields as never, 'English')).toBeNull()
    })

    it('[TC-F32-V-01] returns null for undefined / empty-object fields', () => {
        expect(validateContentFields({} as never, 'Malay')).toBeNull()
        expect(validateContentFields({ subject: '', greeting: '' } as never, 'English')).toBeNull()
    })

    it('[TC-F32-V-02] returns an error when a field exceeds its character limit', () => {
        const overSubject = { subject: 'x'.repeat(CONTENT_FIELD_LIMITS.subject + 1) } as LooseFields
        expect(validateContentFields(overSubject as never, 'English')).toBe(
            `Subject (English) can be at most ${CONTENT_FIELD_LIMITS.subject} characters`,
        )

        const overClosing = { closing: 'y'.repeat(CONTENT_FIELD_LIMITS.closing + 1) } as LooseFields
        expect(validateContentFields(overClosing as never, 'Malay')).toBe(
            `Closing (Malay) can be at most ${CONTENT_FIELD_LIMITS.closing} characters`,
        )
    })

    it('[TC-F32-V-02] never exposes raw schema keys (contentEn/contentMs/ctaLabel) in the message', () => {
        const over = { ctaLabel: 'z'.repeat(CONTENT_FIELD_LIMITS.ctaLabel + 1) } as LooseFields
        const msg = validateContentFields(over as never, 'English')
        expect(msg).toBe(`Button label (English) can be at most ${CONTENT_FIELD_LIMITS.ctaLabel} characters`)
        expect(msg).not.toMatch(/content(En|Ms)|ctaLabel/)
    })

    it('[TC-F32-V-02] returns null when fields are exactly at the limit', () => {
        const atLimit = {
            subject: 'a'.repeat(CONTENT_FIELD_LIMITS.subject),
            closing: 'b'.repeat(CONTENT_FIELD_LIMITS.closing),
        } as LooseFields
        expect(validateContentFields(atLimit as never, 'English')).toBeNull()
    })
})
