import { describe, it, expect } from 'vitest'
import {
    getGenerationError,
    getStreamGenerationError,
    formatErrorMessage,
    type GenerationError,
} from '@/lib/generation-errors'

// ── TC-S4-001: getGenerationError — HTTP status → GenerationError mapping ──
describe('[TC-S4-001] getGenerationError', () => {
    it('402 returns PAYMENT_REQUIRED with correct EN + MS messages', () => {
        // Arrange & Act
        const error = getGenerationError(402)

        // Assert
        expect(error.code).toBe('PAYMENT_REQUIRED')
        expect(error.messageEN).toContain('Upgrade to Pro')
        expect(error.messageMS).toContain('Naik taraf ke Pro')
        expect(error.retryable).toBe(false)
    })

    it('429 returns RATE_LIMIT, retryable=true, retryAfterSeconds', () => {
        // Act
        const error = getGenerationError(429)

        // Assert
        expect(error.code).toBe('RATE_LIMIT')
        expect(error.retryable).toBe(true)
        expect(error.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('400 with CONTENT_UNSAFE body returns CONTENT_UNSAFE', () => {
        // Arrange
        const body = { error: { code: 'CONTENT_UNSAFE' } }

        // Act
        const error = getGenerationError(400, body)

        // Assert
        expect(error.code).toBe('CONTENT_UNSAFE')
        expect(error.retryable).toBe(false)
        expect(error.action.type).toBe('edit')
    })

    it('400 with VALIDATION_ERROR body returns VALIDATION_ERROR', () => {
        // Arrange
        const body = { error: { code: 'VALIDATION_ERROR' } }

        // Act — VALIDATION_ERROR is not a special 400 sub-code, so it falls through to generic 400
        const error = getGenerationError(400, body)

        // Assert
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.retryable).toBe(false)
    })

    it('400 without special body returns VALIDATION_ERROR (generic 400)', () => {
        // Act
        const error = getGenerationError(400)

        // Assert
        expect(error.code).toBe('VALIDATION_ERROR')
    })

    it('401 returns UNAUTHORIZED', () => {
        // Act
        const error = getGenerationError(401)

        // Assert
        expect(error.code).toBe('UNAUTHORIZED')
        expect(error.retryable).toBe(false)
        expect(error.action.type).toBe('signin')
    })

    it('500 returns SERVER_ERROR, retryable=true', () => {
        // Act
        const error = getGenerationError(500)

        // Assert
        expect(error.code).toBe('SERVER_ERROR')
        expect(error.retryable).toBe(true)
        expect(error.action.type).toBe('retry')
    })

    it('503 returns SERVICE_UNAVAILABLE, retryable=true', () => {
        // Act
        const error = getGenerationError(503)

        // Assert
        expect(error.code).toBe('SERVICE_UNAVAILABLE')
        expect(error.retryable).toBe(true)
        expect(error.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('999 (unknown status) falls back to SERVER_ERROR', () => {
        // Act
        const error = getGenerationError(999)

        // Assert
        expect(error.code).toBe('SERVER_ERROR')
        expect(error.retryable).toBe(true)
    })
})

// ── TC-S4-002: formatErrorMessage — placeholder replacement + locale ──
describe('[TC-S4-002] formatErrorMessage', () => {
    it('replaces {seconds} placeholder', () => {
        // Arrange
        const error = getGenerationError(429)

        // Act
        const msg = formatErrorMessage(error, 'en', { seconds: '30' })

        // Assert
        expect(msg).toContain('30')
        expect(msg).not.toContain('{seconds}')
    })

    it('returns EN message for locale "en"', () => {
        // Arrange
        const error = getGenerationError(402)

        // Act
        const msg = formatErrorMessage(error, 'en')

        // Assert
        expect(msg).toBe(error.messageEN)
    })

    it('returns MS message for locale "ms"', () => {
        // Arrange
        const error = getGenerationError(402)

        // Act
        const msg = formatErrorMessage(error, 'ms')

        // Assert
        expect(msg).toBe(error.messageMS)
    })
})

// ── TC-S4-003: GenerationError invariants — all errors well-formed ──
describe('[TC-S4-003] GenerationError invariants', () => {
    const ALL_STATUSES = [402, 429, 400, 401, 408, 500, 503, 999]

    it('all errors have non-empty messageEN and messageMS', () => {
        for (const status of ALL_STATUSES) {
            // Act
            const error = getGenerationError(status)

            // Assert
            expect(error.messageEN.length).toBeGreaterThan(0)
            expect(error.messageMS.length).toBeGreaterThan(0)
        }
    })

    it('all errors have valid action.type', () => {
        // Arrange
        const validTypes = ['upgrade', 'retry', 'edit', 'signin', 'dashboard']

        for (const status of ALL_STATUSES) {
            // Act
            const error = getGenerationError(status)

            // Assert
            expect(validTypes).toContain(error.action.type)
        }
    })

    it('retryable errors have retryAfterSeconds > 0 when defined', () => {
        for (const status of ALL_STATUSES) {
            // Act
            const error = getGenerationError(status)

            // Assert — if retryAfterSeconds is defined, it must be > 0
            if (error.retryAfterSeconds !== undefined) {
                expect(error.retryAfterSeconds).toBeGreaterThan(0)
                expect(error.retryable).toBe(true)
            }
        }
    })
})

// ── TC-AIAUD-173: stream `error` event → message in the merchant's UI language (#2103) ──
describe('[TC-AIAUD-173] getStreamGenerationError', () => {
    it('maps GENERATION_FAILED to EN and MS copy, never the server text', () => {
        // Act
        const error = getStreamGenerationError('GENERATION_FAILED')

        // Assert
        expect(error.code).toBe('GENERATION_FAILED')
        expect(formatErrorMessage(error, 'en')).toBe("We couldn't finish your website. Your details are saved — please try again.")
        expect(formatErrorMessage(error, 'ms')).toContain('Maklumat anda telah disimpan')
        expect(error.retryable).toBe(true)
    })

    it('reuses known codes and falls back to GENERATION_FAILED for unknown or missing codes', () => {
        // Act + Assert
        expect(getStreamGenerationError('TIMEOUT').code).toBe('TIMEOUT')
        expect(getStreamGenerationError('SOMETHING_NEW').code).toBe('GENERATION_FAILED')
        expect(getStreamGenerationError(undefined).code).toBe('GENERATION_FAILED')
    })

    it('has no Vietnamese text in any merchant-facing generation error', () => {
        // Arrange
        const codes = ['GENERATION_FAILED', 'TIMEOUT', 'SERVER_ERROR', 'RATE_LIMIT']

        // Act + Assert
        for (const code of codes) {
            const error = getStreamGenerationError(code)
            expect(`${error.messageEN} ${error.messageMS}`).not.toMatch(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i)
        }
    })
})
