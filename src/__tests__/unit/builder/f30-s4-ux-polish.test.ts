import { describe, it, expect } from 'vitest'

import {
    getGenerationError,
    formatErrorMessage,
    type GenerationError,
    type GenerationErrorCode,
} from '@/lib/generation-errors'

// ── TC-S4-005: Error mapping for 402 PAYMENT_REQUIRED ─────────────────────────

describe('[TC-S4-005] Error 402 — PAYMENT_REQUIRED', () => {
    it('maps HTTP 402 to PAYMENT_REQUIRED error code', () => {
        // Act
        const error = getGenerationError(402)

        // Assert
        expect(error.code).toBe('PAYMENT_REQUIRED')
    })

    it('402 error is NOT retryable (must upgrade)', () => {
        // Act
        const error = getGenerationError(402)

        // Assert
        expect(error.retryable).toBe(false)
    })

    it('402 action type is "upgrade"', () => {
        // Act
        const error = getGenerationError(402)

        // Assert
        expect(error.action.type).toBe('upgrade')
    })

    it('402 EN message mentions free AI generation and Pro upgrade', () => {
        // Act
        const error = getGenerationError(402)

        // Assert — matches PRD Error Code Mapping table
        expect(error.messageEN.toLowerCase()).toContain('free')
        expect(error.messageEN.toLowerCase()).toContain('pro')
    })
})

// ── TC-S4-006: Error mapping for 429 RATE_LIMIT ────────────────────────────────

describe('[TC-S4-006] Error 429 — RATE_LIMIT', () => {
    it('maps HTTP 429 to RATE_LIMIT error code', () => {
        // Act
        const error = getGenerationError(429)

        // Assert
        expect(error.code).toBe('RATE_LIMIT')
    })

    it('429 error IS retryable', () => {
        // Act
        const error = getGenerationError(429)

        // Assert
        expect(error.retryable).toBe(true)
    })

    it('429 action type is "retry"', () => {
        // Act
        const error = getGenerationError(429)

        // Assert
        expect(error.action.type).toBe('retry')
    })

    it('429 has retryAfterSeconds set (default fallback)', () => {
        // Act
        const error = getGenerationError(429)

        // Assert
        expect(error.retryAfterSeconds).toBeDefined()
        expect(typeof error.retryAfterSeconds).toBe('number')
        expect(error.retryAfterSeconds!).toBeGreaterThan(0)
    })

    it('429 EN message contains {seconds} placeholder for countdown', () => {
        // Act
        const error = getGenerationError(429)

        // Assert — placeholder must be present for formatErrorMessage to interpolate
        expect(error.messageEN).toContain('{seconds}')
    })

    it('formatErrorMessage replaces {seconds} in 429 message', () => {
        // Arrange
        const error = getGenerationError(429)

        // Act
        const formatted = formatErrorMessage(error, 'en', { seconds: '45' })

        // Assert
        expect(formatted).toContain('45')
        expect(formatted).not.toContain('{seconds}')
    })
})

// ── TC-S4-007: Error mapping for 400 CONTENT_UNSAFE ───────────────────────────

describe('[TC-S4-007] Error 400 — CONTENT_UNSAFE', () => {
    it('maps 400 + CONTENT_UNSAFE body code to CONTENT_UNSAFE error', () => {
        // Arrange
        const errorBody = { code: 'CONTENT_UNSAFE' }

        // Act
        const error = getGenerationError(400, errorBody)

        // Assert
        expect(error.code).toBe('CONTENT_UNSAFE')
    })

    it('maps 400 + content_unsafe (lowercase) to CONTENT_UNSAFE', () => {
        // Arrange — test case-insensitive body code
        const errorBody = { code: 'content_unsafe' }

        // Act
        const error = getGenerationError(400, errorBody)

        // Assert
        expect(error.code).toBe('CONTENT_UNSAFE')
    })

    it('400 CONTENT_UNSAFE action type is "edit"', () => {
        // Act
        const error = getGenerationError(400, { code: 'CONTENT_UNSAFE' })

        // Assert
        expect(error.action.type).toBe('edit')
    })

    it('400 CONTENT_UNSAFE is NOT retryable without editing', () => {
        // Act
        const error = getGenerationError(400, { code: 'CONTENT_UNSAFE' })

        // Assert
        expect(error.retryable).toBe(false)
    })

    it('generic 400 without body maps to VALIDATION_ERROR', () => {
        // Act
        const error = getGenerationError(400)

        // Assert
        expect(error.code).toBe('VALIDATION_ERROR')
    })

    it('400 with unknown code body falls back to VALIDATION_ERROR', () => {
        // Arrange
        const errorBody = { code: 'SOME_OTHER_ERROR' }

        // Act
        const error = getGenerationError(400, errorBody)

        // Assert
        expect(error.code).toBe('VALIDATION_ERROR')
    })
})

// ── TC-S4-009: i18n — error messages exist in EN and MS ───────────────────────

describe('[TC-S4-009] i18n — all error messages have EN and MS translations', () => {
    const ALL_HTTP_STATUSES = [402, 429, 400, 401, 408, 500, 503] as const

    for (const status of ALL_HTTP_STATUSES) {
        describe(`HTTP ${status}`, () => {
            it(`has non-empty messageEN`, () => {
                // Act
                const error = getGenerationError(status)

                // Assert
                expect(error.messageEN).toBeTruthy()
                expect(error.messageEN.length).toBeGreaterThan(10)
            })

            it(`has non-empty messageMS (Bahasa Malaysia)`, () => {
                // Act
                const error = getGenerationError(status)

                // Assert
                expect(error.messageMS).toBeTruthy()
                expect(error.messageMS.length).toBeGreaterThan(10)
            })

            it(`messageEN and messageMS are different strings (not duplicated)`, () => {
                // Act
                const error = getGenerationError(status)

                // Assert — if translations are the same, it's likely a copy-paste bug
                expect(error.messageEN).not.toBe(error.messageMS)
            })
        })
    }

    it('SSE_DISCONNECT (status 0) has EN and MS messages', () => {
        // Act
        const error = getGenerationError(0)

        // Assert
        expect(error.code).toBe('SSE_DISCONNECT')
        expect(error.messageEN).toBeTruthy()
        expect(error.messageMS).toBeTruthy()
        expect(error.messageEN).not.toBe(error.messageMS)
    })

    it('formatErrorMessage returns MS message when locale is "ms"', () => {
        // Arrange
        const error = getGenerationError(402)

        // Act
        const msgEN = formatErrorMessage(error, 'en')
        const msgMS = formatErrorMessage(error, 'ms')

        // Assert
        expect(msgEN).toBe(error.messageEN)
        expect(msgMS).toBe(error.messageMS)
        expect(msgEN).not.toBe(msgMS)
    })

    it('MS message for 402 mentions "percuma" or "Pro" (not just English)', () => {
        // Arrange — validate actual MS content quality
        const error = getGenerationError(402)

        // Assert — MS message should have Malay words
        const msMsg = error.messageMS.toLowerCase()
        const hasMalayContent = msMsg.includes('percuma') || msMsg.includes('naik taraf') || msMsg.includes('penjanaan')
        expect(hasMalayContent).toBe(true)
    })

    it('MS message for 429 contains {seconds} placeholder', () => {
        // Act
        const error = getGenerationError(429)

        // Assert
        expect(error.messageMS).toContain('{seconds}')
    })

    it('MS message for 429 is formatted correctly with params', () => {
        // Arrange
        const error = getGenerationError(429)

        // Act
        const formatted = formatErrorMessage(error, 'ms', { seconds: '30' })

        // Assert
        expect(formatted).toContain('30')
        expect(formatted).not.toContain('{seconds}')
    })
})

// ── Additional edge case coverage ──────────────────────────────────────────────

describe('[TC-S4-005..009] getGenerationError edge cases', () => {
    it('unknown status code returns a SERVER_ERROR fallback', () => {
        // Act
        const error = getGenerationError(999)

        // Assert
        expect(error).toBeDefined()
        expect(error.messageEN).toBeTruthy()
        expect(error.messageMS).toBeTruthy()
        // Should fall through to default (SERVER_ERROR)
        expect(error.retryable).toBeDefined()
    })

    it('status 401 maps to UNAUTHORIZED with signin action', () => {
        // Act
        const error = getGenerationError(401)

        // Assert
        expect(error.code).toBe('UNAUTHORIZED')
        expect(error.action.type).toBe('signin')
        expect(error.retryable).toBe(false)
    })

    it('status 408 maps to TIMEOUT with retry action', () => {
        // Act
        const error = getGenerationError(408)

        // Assert
        expect(error.code).toBe('TIMEOUT')
        expect(error.action.type).toBe('retry')
        expect(error.retryable).toBe(true)
    })

    it('status 503 maps to SERVICE_UNAVAILABLE with retryAfterSeconds', () => {
        // Act
        const error = getGenerationError(503)

        // Assert
        expect(error.code).toBe('SERVICE_UNAVAILABLE')
        expect(error.retryable).toBe(true)
        expect(error.retryAfterSeconds).toBeDefined()
        expect(error.retryAfterSeconds!).toBeGreaterThan(0)
    })

    it('status 500 maps to SERVER_ERROR with retry action', () => {
        // Act
        const error = getGenerationError(500)

        // Assert
        expect(error.code).toBe('SERVER_ERROR')
        expect(error.action.type).toBe('retry')
        expect(error.retryable).toBe(true)
    })

    it('formatErrorMessage with no params leaves non-placeholder messages unchanged', () => {
        // Arrange
        const error = getGenerationError(402)

        // Act
        const formatted = formatErrorMessage(error, 'en')

        // Assert
        expect(formatted).toBe(error.messageEN)
    })

    it('formatErrorMessage handles multiple placeholder replacements', () => {
        // Arrange — simulate a hypothetical multi-placeholder message
        const fakeError: GenerationError = {
            code: 'RATE_LIMIT' as GenerationErrorCode,
            messageEN: 'Wait {seconds}s ({reason})',
            messageMS: 'Tunggu {seconds}s ({reason})',
            action: { label: 'Retry', type: 'retry' },
            retryable: true,
        }

        // Act
        const formatted = formatErrorMessage(fakeError, 'en', {
            seconds: '30',
            reason: 'quota',
        })

        // Assert
        expect(formatted).toBe('Wait 30s (quota)')
        expect(formatted).not.toContain('{seconds}')
        expect(formatted).not.toContain('{reason}')
    })
})
