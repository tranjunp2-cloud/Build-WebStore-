import { describe, expect, it, vi } from 'vitest'

// TC-AICP-131 — a stock photo download that stalls or drops (timeout, network, 5xx) is tried again
// before a change gives up; a refusal that won't pass (blocked host, too large) is not retried.

vi.mock('server-only', () => ({}))

import { PixabayError } from '@/lib/ai/pixabay-client'
import { withStockRetry } from '@/lib/ai-platform/agent-tools/media-tools'

describe('[TC-AICP-131] stock download retry', () => {
    it('tries again after a passing failure and returns the picture', async () => {
        const download = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new PixabayError('TIMEOUT', 0, true))
            .mockRejectedValueOnce(new PixabayError('DOWNLOAD_FAIL', 503, true))
            .mockResolvedValueOnce('bytes')

        await expect(withStockRetry(download, [0, 0])).resolves.toBe('bytes')
        expect(download).toHaveBeenCalledTimes(3)
    })

    it('gives up after the last pause with the last error', async () => {
        const download = vi.fn<() => Promise<string>>().mockRejectedValue(new PixabayError('TIMEOUT', 0, true))

        await expect(withStockRetry(download, [0, 0])).rejects.toMatchObject({ code: 'TIMEOUT' })
        expect(download).toHaveBeenCalledTimes(3)
    })

    it('does not retry what will not pass', async () => {
        const download = vi.fn<() => Promise<string>>().mockRejectedValue(new PixabayError('SSRF_BLOCKED', 0, false))

        await expect(withStockRetry(download, [0, 0])).rejects.toMatchObject({ code: 'SSRF_BLOCKED' })
        expect(download).toHaveBeenCalledTimes(1)
    })
})
