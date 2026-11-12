/**
 * TC-AISEC-022 — BFF → ai-platform calls never hang a prime-web function: a JSON call without a signal gives up after
 * 10 s (504 "took too long"), a connection failure stays 502, a stream start keeps no timeout, and a caller's own
 * signal only gets a timeout when `timeoutMs` is given.
 * Real: callAiPlatform, aiPlatformJson. Faked: fetch, the platform URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-platform/config', () => ({ getAiPlatformUrl: vi.fn(() => 'https://ai.example.test') }))

import { AI_PLATFORM_TIMEOUT_MS, AiPlatformError, aiPlatformJson, callAiPlatform } from '@/lib/ai-platform/upstream'

const fetchMock = vi.fn()
/** a platform that never answers: the fetch ends only when its signal aborts */
const hang = (_url: string, init: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)))
const sentSignal = () => (fetchMock.mock.calls[0]?.[1] as { signal?: AbortSignal }).signal

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('ai-platform call timeouts [TC-AISEC-022]', () => {
    it('gives a JSON call without a signal the 10 s default', async () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout')
        fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }))

        const body = await aiPlatformJson({ method: 'GET', path: '/agent/change-sets/cs_1', token: 't' })

        expect(body).toEqual({ ok: true })
        expect(AI_PLATFORM_TIMEOUT_MS).toBe(10_000)
        expect(timeout).toHaveBeenCalledWith(10_000)
        expect(sentSignal()).toBeInstanceOf(AbortSignal)
    })

    it('answers a platform that does not answer in time with 504 "took too long"', async () => {
        fetchMock.mockImplementation(hang)

        const error = await callAiPlatform({ method: 'GET', path: '/agent/work', token: 't', timeoutMs: 20 }).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(AiPlatformError)
        expect(error).toMatchObject({ status: 504, message: 'The AI platform took too long to answer.' })
    })

    it('keeps a connection failure a 502 "unreachable"', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'))

        const error = await callAiPlatform({ method: 'GET', path: '/agent/work', token: 't' }).catch((e: unknown) => e)

        expect(error).toMatchObject({ status: 502, message: 'The AI platform is unreachable.' })
    })

    it('starts a stream without any timeout of its own', async () => {
        fetchMock.mockResolvedValue(new Response('data: {}\n\n', { status: 200 }))

        await callAiPlatform({ method: 'POST', path: '/agent/runs', token: 't', body: '{}', accept: 'text/event-stream, application/json' })

        expect(sentSignal()).toBeUndefined()
    })

    it('passes the caller\'s signal through untouched when no timeoutMs is given', async () => {
        const caller = new AbortController()
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))

        await callAiPlatform({ method: 'GET', path: '/agent/threads', token: 't', signal: caller.signal })

        expect(sentSignal()).toBe(caller.signal)
    })

    it('combines the caller\'s signal with timeoutMs: either one ends the call, the timeout as a 504', async () => {
        const caller = new AbortController()
        fetchMock.mockImplementation(hang)

        const timedOut = await callAiPlatform({ method: 'GET', path: '/agent/work', token: 't', signal: caller.signal, timeoutMs: 20 }).catch((e: unknown) => e)
        const left = callAiPlatform({ method: 'GET', path: '/agent/work', token: 't', signal: caller.signal, timeoutMs: 60_000 }).catch((e: unknown) => e)
        caller.abort()

        expect(timedOut).toMatchObject({ status: 504 })
        expect(await left).toMatchObject({ status: 502 })
    })
})
