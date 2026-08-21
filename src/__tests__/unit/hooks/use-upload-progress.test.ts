import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadProgress } from '@/hooks/use-upload-progress'

type Listener = (event?: { lengthComputable: boolean; loaded: number; total: number }) => void

class FakeXMLHttpRequest {
    static requests: FakeXMLHttpRequest[] = []
    static nextDirectUploadResponse: { status: number; responseText?: string } | undefined

    readonly upload = {
        addEventListener: (event: string, listener: Listener) => {
            this.uploadListeners.set(event, listener)
        },
    }

    status = 0
    responseText = ''
    timeout = 0
    url = ''
    body: Document | XMLHttpRequestBodyInit | null = null

    private listeners = new Map<string, Listener>()
    private uploadListeners = new Map<string, Listener>()

    constructor() {
        FakeXMLHttpRequest.requests.push(this)
    }

    addEventListener(event: string, listener: Listener) {
        this.listeners.set(event, listener)
    }

    open(_method: string, url: string) {
        this.url = url
    }

    send(body: Document | XMLHttpRequestBodyInit | null) {
        this.body = body
        this.uploadListeners.get('progress')?.({ lengthComputable: true, loaded: 1, total: 1 })
        if (this.url === '/api/media/upload') {
            this.status = 200
            this.responseText = JSON.stringify({ id: 12, url: '/media/local.png' })
        } else {
            this.status = FakeXMLHttpRequest.nextDirectUploadResponse?.status ?? 204
            this.responseText = FakeXMLHttpRequest.nextDirectUploadResponse?.responseText ?? ''
        }
        this.listeners.get('load')?.()
    }
}

function imageFormData() {
    const data = new FormData()
    data.append('file', new File(['png'], 'logo.png', { type: 'image/png' }))
    data.append('alt', 'Site logo')
    return data
}

describe('useUploadProgress direct image upload', () => {
    beforeEach(() => {
        FakeXMLHttpRequest.requests = []
        FakeXMLHttpRequest.nextDirectUploadResponse = undefined
        vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('uploads the image directly to object storage and registers the media record', async () => {
        // Arrange
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                url: 'https://storage.example/upload',
                fields: { key: 'u1-logo.png' },
                key: 'u1-logo.png',
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: 11,
                url: 'https://cdn.example/u1-logo.png',
            }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { result } = renderHook(() => useUploadProgress())

        // Act
        let media: Awaited<ReturnType<typeof result.current.upload>> | undefined
        await act(async () => {
            media = await result.current.upload(imageFormData())
        })

        // Assert
        expect(media).toEqual({ id: 11, url: 'https://cdn.example/u1-logo.png' })
        expect(FakeXMLHttpRequest.requests.map(request => request.url)).toEqual([
            'https://storage.example/upload',
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('uses the buffered upload route only when direct upload is unavailable', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                error: 'Direct upload unavailable',
                code: 'DIRECT_UPLOAD_UNAVAILABLE',
            }), { status: 503 }),
        ))
        const { result } = renderHook(() => useUploadProgress())

        // Act
        let media: Awaited<ReturnType<typeof result.current.upload>> | undefined
        await act(async () => {
            media = await result.current.upload(imageFormData())
        })

        // Assert
        expect(media).toEqual({ id: 12, url: '/media/local.png' })
        expect(FakeXMLHttpRequest.requests.map(request => request.url)).toEqual([
            '/api/media/upload',
        ])
    })

    it('TC-GH1640-PERF-01: logs a redacted S3 error response when the direct upload fails', async () => {
        // Arrange
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        FakeXMLHttpRequest.nextDirectUploadResponse = {
            status: 403,
            responseText: [
                '<Error>',
                '<Code>SignatureDoesNotMatch</Code>',
                '<Message>The request signature we calculated does not match.</Message>',
                '<RequestId>request-123</RequestId>',
                '<HostId>host-456</HostId>',
                '<Policy>secret-policy</Policy>',
                '<X-Amz-Signature>secret-signature</X-Amz-Signature>',
                '</Error>',
            ].join(''),
        }
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
            url: 'https://storage.example/upload',
            fields: { key: 'u1-logo.png' },
            key: 'u1-logo.png',
        }), { status: 200 })))
        const { result } = renderHook(() => useUploadProgress())

        // Act
        await act(async () => {
            await expect(result.current.upload(imageFormData())).rejects.toThrow('Upload failed (403)')
        })

        // Assert
        expect(consoleError).toHaveBeenCalledWith(
            '[media:direct-upload] S3 POST failed',
            expect.objectContaining({
                status: 403,
                s3Code: 'SignatureDoesNotMatch',
                requestId: 'request-123',
                hostId: 'host-456',
                responseBody: expect.stringContaining('<Policy>[redacted]</Policy>'),
            }),
        )
        const logged = consoleError.mock.calls.find(([message]) =>
            message === '[media:direct-upload] S3 POST failed',
        )?.[1] as { responseBody: string }
        expect(logged.responseBody).not.toContain('secret-policy')
        expect(logged.responseBody).not.toContain('secret-signature')
    })
})
