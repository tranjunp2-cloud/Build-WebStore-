import { describe, expect, it } from 'vitest'

import { shouldRetryGenerationStream } from '@/lib/ai/sse-retry-policy'

describe('[TC-GENPERF-W3-03] generation SSE retry policy', () => {
    it('TC-GENPERF-W3-03: allows retry before a request is submitted', () => {
        // Arrange / Act / Assert
        expect(shouldRetryGenerationStream({ requestSubmitted: false })).toBe(true)
    })

    it('TC-GENPERF-W3-03: never re-POSTs once the request may have reached the server', () => {
        // Arrange / Act / Assert
        expect(shouldRetryGenerationStream({ requestSubmitted: true })).toBe(false)
    })
})
