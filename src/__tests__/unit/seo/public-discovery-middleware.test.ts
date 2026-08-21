import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { middleware } from '@/middleware'

describe('[TC-F37-03] public discovery middleware routing', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('domain lookup unavailable')))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('TC-F37-03-37: rewrites llms.txt on a custom domain instead of treating it as a static file', async () => {
        // Arrange
        const request = new NextRequest('https://mycafe.example/llms.txt', {
            headers: { host: 'mycafe.example' },
        })

        // Act
        const response = await middleware(request)

        // Assert
        expect(response.headers.get('x-middleware-rewrite')).toBe(
            'https://mycafe.example/sites/custom/llms.txt',
        )
        expect(response.headers.get('x-middleware-request-x-tenant-hostname')).toBe('mycafe.example')
        expect(response.headers.get('x-middleware-request-x-tenant-type')).toBe('custom-domain')
        expect(response.headers.get('x-middleware-override-headers')).toContain(
            'x-tenant-hostname',
        )
    })

    it('TC-F37-03-43: rewrites llms.txt on a platform tenant subdomain', async () => {
        // Arrange
        const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        const request = new NextRequest(`https://mycafe.${platformDomain}/llms.txt`, {
            headers: { host: `mycafe.${platformDomain}` },
        })

        // Act
        const response = await middleware(request)

        // Assert
        expect(response.headers.get('x-middleware-rewrite')).toBe(
            `https://mycafe.${platformDomain}/sites/mycafe/llms.txt`,
        )
        expect(response.headers.get('x-tenant-slug')).toBe('mycafe')
    })
})
