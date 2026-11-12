/**
 * TC-AIREL-265 — Approve refused because the change set moved on (the page changed after the draft, so the server closed
 * it; or another tab decided it): the gateway reads the set again and announces it as it now stands, so the card stops
 * offering Approve — a second press used to answer "This change was already rejected." The first refusal is still thrown
 * (its reason is what the merchant reads).
 */
import { describe, expect, it, vi } from 'vitest'
import { FIXTURE_CHANGE_SETS, HttpGateway } from '@ech/agent-transport'

const STALE = 'This page changed after the assistant drafted the edit. Ask again so it starts from the latest version.'
const pending = { ...FIXTURE_CHANGE_SETS[0]!, id: 'cs_stale', status: 'pending' as const }
const rejected = { ...pending, status: 'rejected' as const, decidedBy: 'self', decidedAt: '2026-10-28T03:39:08Z' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function gatewayWith(decision: Response, current: Response | (() => Promise<Response>)) {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST' && url.endsWith('/agent/change-sets/cs_stale/decision')) return decision
        if (url.endsWith('/agent/change-sets/cs_stale')) return typeof current === 'function' ? current() : current
        throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`)
    })
    const gw = new HttpGateway({ baseUrl: '/api', fetcher: fetcher as unknown as typeof fetch })
    const events: unknown[] = []
    gw.subscribe((event) => events.push(event))
    return { gw, fetcher, events }
}

describe('Approve refused by the server [TC-AIREL-265]', () => {
    it('re-reads the set and announces it closed, then still throws the reason', async () => {
        // Arrange
        const { gw, events } = gatewayWith(json({ title: 'Request failed', status: 409, detail: STALE }, 409), json(rejected))

        // Act
        const attempt = gw.decideChangeSet('cs_stale', 'approve', 'self')

        // Assert
        await expect(attempt).rejects.toThrow(STALE)
        expect(events).toContainEqual({ type: 'changeset.decided', changeSet: expect.objectContaining({ id: 'cs_stale', status: 'rejected' }) })
        gw.close()
    })

    it('announces nothing while the set is still pending (a refusal that changed nothing)', async () => {
        // Arrange
        const { gw, events } = gatewayWith(json({ title: 'Request failed', status: 409, detail: 'This change is already being applied.' }, 409), json(pending))

        // Act
        const attempt = gw.decideChangeSet('cs_stale', 'approve', 'self')

        // Assert
        await expect(attempt).rejects.toThrow('already being applied')
        expect(events).toEqual([])
        gw.close()
    })

    it('keeps the original error when the re-read fails, and does not re-read on other errors', async () => {
        // Arrange
        const broken = gatewayWith(json({ title: 'Request failed', status: 409, detail: STALE }, 409), async () => json({ title: 'down' }, 503))
        const server = gatewayWith(json({ title: 'Request failed', status: 500, detail: 'boom' }, 500), json(rejected))

        // Act + Assert
        await expect(broken.gw.decideChangeSet('cs_stale', 'approve', 'self')).rejects.toThrow(STALE)
        expect(broken.events).toEqual([])
        await expect(server.gw.decideChangeSet('cs_stale', 'approve', 'self')).rejects.toThrow()
        expect(server.fetcher).toHaveBeenCalledTimes(1)
        broken.gw.close()
        server.gw.close()
    })
})
