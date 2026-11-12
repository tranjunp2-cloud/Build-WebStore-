// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DIRECT_UPLOAD_NETWORK_ERROR_MESSAGE, useDirectUpload } from '@/hooks/use-direct-upload'

type Listener = () => void

// Simulates the browser blocking the S3 POST at CORS preflight: XHR fires `error`, no response.
class BlockedXMLHttpRequest {
    readonly upload = { addEventListener: () => undefined }
    timeout = 0
    private listeners = new Map<string, Listener>()

    addEventListener(event: string, listener: Listener) {
        this.listeners.set(event, listener)
    }

    open() {}

    send() {
        this.listeners.get('error')?.()
    }
}

describe('useDirectUpload network failure', () => {
    beforeEach(() => {
        vi.stubGlobal('XMLHttpRequest', BlockedXMLHttpRequest)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('TC-F30-HMO-020: shows a clear message and logs only origin + storage host + bucket when the S3 POST is blocked', async () => {
        // Arrange
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
            url: 'https://sgp1.digitaloceanspaces.com/some-bucket/nested/u1-secret-key.mp4?sig=secret-query',
            fields: { key: 'u1-secret-key.mp4', Policy: 'secret-policy', 'X-Amz-Signature': 'secret-signature' },
            key: 'u1-secret-key.mp4',
        }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { result } = renderHook(() => useDirectUpload())

        // Act
        let error: unknown
        await act(async () => {
            try {
                await result.current.upload(new File(['v'], 'hero.mp4', { type: 'video/mp4' }), { alt: 'Hero' })
            } catch (e) {
                error = e
            }
        })

        // Assert
        expect((error as Error).message).toBe(DIRECT_UPLOAD_NETWORK_ERROR_MESSAGE)
        expect(DIRECT_UPLOAD_NETWORK_ERROR_MESSAGE).toBe('Could not reach storage (check CORS/network)')
        expect(fetchMock).toHaveBeenCalledTimes(1) // presign only, register never called
        expect(consoleError).toHaveBeenCalledTimes(1)
        const [, details] = consoleError.mock.calls[0]
        expect(details).toEqual({ origin: window.location.origin, storageHost: 'sgp1.digitaloceanspaces.com',
            bucket: 'some-bucket',
        })
        expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/secret|nested/)
    })
})
