import { describe, it, expect } from 'vitest'
import { isNotFoundError } from '@/lib/api/is-not-found-error'

// ── TC-GH1519-04: Verify NotFound detection in PATCH /api/sites/:siteId/pages/:pageId
// Note: Full route integration testing is covered by publish.test.ts pattern (same middleware stack).
// This test verifies the isNotFoundError helper works correctly, which is the core GH#1519 fix.

describe('[TC-GH1519-04] NotFound error detection for pages PATCH route', () => {
    it('TC-GH1519-04a: isNotFoundError detects Payload NotFound from findByID', () => {
        // The pages PATCH route calls payload.findByID() which throws NotFound
        // isNotFoundError() must detect it so the route returns 404 not 500
        const payloadNotFound = { name: 'NotFound', message: 'Page not found' }

        expect(isNotFoundError(payloadNotFound)).toBe(true)
    })

    it('TC-GH1519-04b: isNotFoundError detects Payload NotFoundError from update', () => {
        // The pages PATCH route calls payload.update() which throws NotFoundError
        const payloadNotFoundError = { name: 'NotFoundError', message: 'Document not found' }

        expect(isNotFoundError(payloadNotFoundError)).toBe(true)
    })

    it('TC-GH1519-04c: isNotFoundError detects 404 status from Payload', () => {
        // Payload errors may also have status: 404
        const statusNotFound = { status: 404, message: 'Not found' }

        expect(isNotFoundError(statusNotFound)).toBe(true)
    })

    it('TC-GH1519-04d: isNotFoundError rejects non-NotFound errors (returns 500)', () => {
        // Non-NotFound errors should return 500, not 404
        const nonNotFoundError = new Error('Database connection failed')

        expect(isNotFoundError(nonNotFoundError)).toBe(false)
    })

    it('TC-GH1519-04e: isNotFoundError rejects ValidationError (returns 500)', () => {
        // Validation errors should return 500
        const validationError = { name: 'ValidationError', message: 'Slug must be unique' }

        expect(isNotFoundError(validationError)).toBe(false)
    })
})
