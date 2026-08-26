import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/webhooks/vercel/route'

const WEBHOOK_SECRET = 'vercel-webhook-secret'
const fetchMock = vi.fn()

function sign(body: string) {
    return crypto.createHmac('sha1', WEBHOOK_SECRET).update(body).digest('hex')
}

function createRequest(body: string, signature?: string) {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (signature) headers.set('x-vercel-signature', signature)
    return new Request('http://localhost/api/webhooks/vercel', {
        method: 'POST',
        headers,
        body,
    })
}

describe('[TC-GH1622] POST /api/webhooks/vercel signature verification', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VERCEL_WEBHOOK_SECRET', '')
        vi.stubEnv('BOT_NOTIFY_URL', '')
        vi.stubEnv('BOT_SECRET', '')
        vi.stubEnv('LARK_WEBHOOK_CI', '')
        vi.stubEnv('LARK_WEBHOOK_URL', '')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.unstubAllGlobals()
    })

    it('[TC-GH1622-01] rejects a request without x-vercel-signature', async () => {
        // Arrange
        vi.stubEnv('VERCEL_WEBHOOK_SECRET', WEBHOOK_SECRET)

        // Act
        const response = await POST(createRequest('{"type":"deployment.error"}'))

        // Assert
        expect(response.status).toBe(401)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('[TC-GH1622-02] rejects a request when VERCEL_WEBHOOK_SECRET is unset', async () => {
        // Arrange
        const body = '{"type":"deployment.error"}'

        // Act
        const response = await POST(createRequest(body, sign(body)))

        // Assert
        expect(response.status).toBe(401)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('[TC-GH1622-03] rejects a valid HMAC with a malformed suffix without forwarding', async () => {
        // Arrange
        vi.stubEnv('VERCEL_WEBHOOK_SECRET', WEBHOOK_SECRET)
        const body = '{"type":"deployment.error"}'

        // Act
        const response = await POST(createRequest(body, `${sign(body)}-malformed`))

        // Assert
        expect(response.status).toBe(401)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('[TC-GH1622-04] accepts a valid deployment signature and forwards the notification', async () => {
        // Arrange
        const body = JSON.stringify({
            type: 'deployment.ready',
            payload: {
                project: { name: 'Prime Web' },
                deployment: {
                    url: 'primeweb.app',
                    inspectorUrl: 'https://vercel.com/inspection',
                    meta: {
                        githubCommitRef: 'staging',
                        githubCommitAuthorLogin: 'deploy-bot',
                        githubCommitSha: '0123456789abcdef',
                        githubCommitMessage: 'deploy staging',
                    },
                },
            },
        })
        vi.stubEnv('VERCEL_WEBHOOK_SECRET', WEBHOOK_SECRET)
        vi.stubEnv('BOT_NOTIFY_URL', 'https://bot.example')
        vi.stubEnv('BOT_SECRET', 'bot-secret')
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

        // Act
        const response = await POST(createRequest(body, sign(body)))

        // Assert
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ ok: true, event: 'deploy_success', botSent: true })
        expect(fetchMock).toHaveBeenCalledWith(
            'https://bot.example/api/ci/notify',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ Authorization: 'Bearer bot-secret' }),
            }),
        )
    })
})
