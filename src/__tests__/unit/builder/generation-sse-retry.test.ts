import { describe, expect, it } from 'vitest'

import { shouldRetryGenerationStream } from '@/lib/ai/sse-retry-policy'

describe('[TC-GENPERF-W3-03] generation SSE retry policy', () => {
    it('TC-GENPERF-W3-03: retries a transport failure before server acceptance', () => {
        // Arrange / Act / Assert
        expect(shouldRetryGenerationStream({ receivedAnyEvent: false, retryCount: 0, maxRetries: 3 })).toBe(true)
    })

    it('TC-GENPERF-W3-03: never re-POSTs after any SSE event was accepted', () => {
        // Arrange / Act / Assert
        expect(shouldRetryGenerationStream({ receivedAnyEvent: true, retryCount: 0, maxRetries: 3 })).toBe(false)
    })

    it('TC-GENPERF-W3-03: stops retrying at the configured limit', () => {
        // Arrange / Act / Assert
        expect(shouldRetryGenerationStream({ receivedAnyEvent: false, retryCount: 3, maxRetries: 3 })).toBe(false)
    })
})
