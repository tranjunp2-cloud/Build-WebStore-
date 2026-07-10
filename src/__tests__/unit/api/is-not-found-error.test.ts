import { describe, it, expect } from 'vitest'
import { isNotFoundError } from '@/lib/api/is-not-found-error'

// ── TC-GH1519-01: isNotFoundError detection (pure function) ───────────────
describe('[TC-GH1519-01] isNotFoundError (NotFound error detection)', () => {
    it('returns true when error.name is "NotFound"', () => {
        // Arrange
        const err = { name: 'NotFound', message: 'Document not found' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })

    it('returns true when error.name is "NotFoundError"', () => {
        // Arrange
        const err = { name: 'NotFoundError', message: 'Not found' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })

    it('returns true when error.status is 404', () => {
        // Arrange
        const err = { status: 404, message: 'Not found' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })

    it('returns true only when message is exactly "Not Found" (case-insensitive, trimmed)', () => {
        // Arrange — Payload's canonical NotFound message, various casings/whitespace
        const cases = [
            { message: 'not found' },
            { message: 'Not Found' },
            { message: 'NOT FOUND' },
            { message: '  Not Found  ' },
            { message: 'NotFound' },
        ]

        // Act + Assert
        for (const err of cases) {
            expect(isNotFoundError(err)).toBe(true)
        }
    })

    it('returns false for descriptive messages that merely contain "not found"', () => {
        // Anchored match on purpose (GH #1519): a genuine 500-worthy error whose
        // message mentions the phrase must NOT be downgraded to 404.
        const cases = [
            { message: 'Document not found' },
            { message: 'not found (404)' },
            { message: 'Resource: not found in database' },
            { message: 'product X not found in catalog' },
            { message: 'Something went wrong' },
        ]

        // Act + Assert
        for (const err of cases) {
            expect(isNotFoundError(err)).toBe(false)
        }
    })

    it('returns false when error is null', () => {
        // Arrange
        const err = null

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(false)
    })

    it('returns false when error is undefined', () => {
        // Arrange
        const err = undefined

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(false)
    })

    it('returns false when error is not an object (string, number, etc)', () => {
        // Arrange
        const cases = ['error', 123, true]

        // Act + Assert
        for (const err of cases) {
            expect(isNotFoundError(err as unknown)).toBe(false)
        }
    })

    it('returns false when error is a plain object with no matching fields', () => {
        // Arrange
        const err = { foo: 'bar', code: 'SOME_ERROR' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(false)
    })

    it('returns false when error.status is 404 but as a string', () => {
        // Arrange — status is a string, not a number
        const err = { status: '404' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(false)
    })

    it('returns true prioritizing error.name over other fields', () => {
        // Arrange — name is NotFound, message is unrelated
        const err = { name: 'NotFound', message: 'Something else' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })

    it('returns true prioritizing error.status over message', () => {
        // Arrange — status is 404, message is unrelated
        const err = { status: 404, message: 'Something else entirely' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })

    it('returns false when message field is not a string', () => {
        // Arrange
        const err = { message: 123, name: 'CustomError' }

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(false)
    })

    it('handles Error instances with NotFound name', () => {
        // Arrange
        const err = new Error('Not found')
        err.name = 'NotFound'

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })

    it('handles Error instances with 404 status property', () => {
        // Arrange
        const err = new Error('Document not found') as unknown as { message: string; status?: number }
        (err as { status?: number }).status = 404

        // Act
        const result = isNotFoundError(err)

        // Assert
        expect(result).toBe(true)
    })
})
