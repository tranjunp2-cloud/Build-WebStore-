import { describe, expect, it } from 'vitest'
import {
    sanitizeLiveError,
    sanitizeProviderUrl,
} from '@/lib/admin/live-errors/sanitize-evidence'

// ── TC-F39-AC11: Positive-allowlist evidence sanitization ───────────────────
describe('[TC-F39-AC11] live error sanitizer', () => {
    it('redacts sensitive canaries, strips query data, and caps frames/message', () => {
        // Arrange
        const raw = {
            source: 'sentry' as const,
            providerId: '12345',
            occurredAt: '2026-07-28T08:00:00.000Z',
            severity: 'error',
            message: [
                'authorization=secret-canary',
                'token=bare-token-canary',
                'client_secret=client-secret-canary',
                'private_key=private-key-canary',
                'Basic dXNlcjpwYXNzd29yZA==',
                'refresh_token=refresh-canary',
                'sessionId=session-canary',
                'Cookie: session=cookie-canary',
                'Set-Cookie: refresh_token=set-cookie-canary',
                'request body={"password":"body-canary"}',
                'prompt: prompt-canary',
                'https://api.example/orders?token=url-canary',
                '/checkout?session=path-canary',
                'user@example.test',
                '203.0.113.9',
                [
                    '-----BEGIN PRIVATE KEY-----',
                    'pem-private-key-canary',
                    '-----END PRIVATE KEY-----',
                ].join('\n'),
                'x'.repeat(1_100),
            ].join('\n'),
            host: 'HTTPS://Shop.PrimeWeb.App.:443/private?token=secret-canary',
            route: '/orders?id=secret-canary#private',
            method: 'post',
            statusCode: '500',
            release: 'release-1',
            requestId: 'request-1',
            traceId: 'trace-1',
            providerUrl: 'https://sentry.io/organizations/example/issues/12345/?secret=yes',
            frames: Array.from({ length: 8 }, (_, index) => ({
                function: `handler${index}`,
                module: 'app.route',
                filename: '/app/route.ts',
                lineNo: index + 1,
                inApp: true,
                vars: { secret: 'must-not-survive' },
            })),
        }

        // Act
        const result = sanitizeLiveError(raw)
        const serialized = JSON.stringify(result)

        // Assert
        expect(result).not.toBeNull()
        expect(result?.message.length).toBeLessThanOrEqual(1_000)
        expect(result?.message).toContain('[REDACTED]')
        expect(result?.message).toContain('[REDACTED_PRIVATE_KEY]')
        expect(result?.message).toContain('[REDACTED_EMAIL]')
        expect(result?.message).toContain('[REDACTED_IP]')
        expect(result?.host).toBe('shop.primeweb.app')
        expect(result?.route).toBe('/orders')
        expect(result?.method).toBe('POST')
        expect(result?.frames).toHaveLength(5)
        expect(result?.providerUrl).toBe('https://sentry.io/organizations/example/issues/12345/')
        expect(serialized).not.toContain('secret-canary')
        expect(serialized).not.toContain('bare-token-canary')
        expect(serialized).not.toContain('client-secret-canary')
        expect(serialized).not.toContain('private-key-canary')
        expect(serialized).not.toContain('pem-private-key-canary')
        expect(serialized).not.toContain('dXNlcjpwYXNzd29yZA')
        expect(serialized).not.toContain('refresh-canary')
        expect(serialized).not.toContain('session-canary')
        expect(serialized).not.toContain('cookie-canary')
        expect(serialized).not.toContain('set-cookie-canary')
        expect(serialized).not.toContain('body-canary')
        expect(serialized).not.toContain('prompt-canary')
        expect(serialized).not.toContain('url-canary')
        expect(serialized).not.toContain('path-canary')
        expect(result?.message).toContain('https://api.example/orders')
        expect(result?.message).toContain('/checkout')
        expect(serialized).not.toContain('must-not-survive')
        expect(Object.keys(result ?? {}).sort()).toEqual([
            'deploymentId',
            'frames',
            'guidance',
            'host',
            'message',
            'method',
            'occurredAt',
            'providerId',
            'providerUrl',
            'release',
            'requestId',
            'route',
            'severity',
            'source',
            'statusCode',
            'tenantMatch',
            'traceId',
        ])
    })

    it('rejects provider links outside the expected HTTPS host', () => {
        // Arrange
        const attackerUrl = 'https://attacker.example/steal'

        // Act
        const wrongHost = sanitizeProviderUrl(attackerUrl, 'sentry')
        const wrongProtocol = sanitizeProviderUrl('http://sentry.io/issues/1', 'sentry')

        // Assert
        expect(wrongHost).toBeNull()
        expect(wrongProtocol).toBeNull()
    })
})
