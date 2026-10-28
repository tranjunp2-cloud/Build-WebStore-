/**
 * TC-AICP-317 — the dashboard SEO card fetches its own score on the client, so it refetches (not router.refresh) when
 * the assistant changes what the score reads (a page, a product): the card stays on screen while it loads, the new
 * score replaces the old one, a failed refetch keeps the old score, and a discount
 * change fetches nothing.
 * Real: SeoHealthClient, the change bus, the score contract. Faked: fetch, the card, the fix modal, next/navigation.
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAgentChange } from '@/lib/agent-changes/bus'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/dashboard/revamp/seo-health-card', () => ({
    SeoHealthCard: ({ data }: { data: { state: string; score?: number } }) => (
        <div data-testid="score-card" data-state={data.state}>{data.state === 'ready' ? data.score : ''}</div>
    ),
}))
vi.mock('@/components/dashboard/AIFixModal', () => ({ AIFixModal: () => null }))

import { SeoHealthClient } from '@/components/dashboard/revamp/seo-health-client'

const score = (value: number) => new Response(JSON.stringify({
    success: true,
    score: value,
    breakdown: { businessData: 0, schema: value, aiDiscoverability: 0, technicalHealth: 0 },
    issues: [],
    aiFixableItemCount: 0,
    evaluatedAt: '2026-08-04T00:00:00.000Z',
    revisionToken: 'a'.repeat(64),
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

const announce = (kind: string, entityKind: string) => act(async () => {
    announceAgentChange({ action: 'applied', kind, entities: [{ kind: entityKind, id: '*' }], changeSetId: `cs-${kind}`, at: Date.now() })
    await vi.advanceTimersByTimeAsync(200)
})

describe('SEO health card refetches with the assistant [TC-AICP-317]', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        vi.useFakeTimers()
        fetchMock = vi.fn().mockImplementation(async () => score(20))
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => {})
        render(<SeoHealthClient siteId="9" />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('TC-AICP-317 swaps the score in place on a page change, without a loading state', async () => {
        expect(screen.getByTestId('score-card')).toHaveAttribute('data-state', 'ready')
        fetchMock.mockImplementationOnce(() => new Promise(() => {}))

        await announce('site.seo_patch', 'site_page')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(screen.getByTestId('score-card')).toHaveAttribute('data-state', 'ready')
    })

    it('TC-AICP-317 shows the new score when the refetch lands', async () => {
        fetchMock.mockImplementationOnce(async () => score(30))

        await announce('shop_product.update', 'product')

        expect(screen.getByTestId('score-card')).toHaveTextContent('30')
    })

    it('TC-AICP-317 keeps the old score (no error state) when the refetch fails', async () => {
        fetchMock.mockImplementationOnce(async () => new Response('x', { status: 500 }))

        await announce('site.seo_patch', 'site_page')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        const card = screen.getByTestId('score-card')
        expect(card).toHaveAttribute('data-state', 'ready')
        expect(card).toHaveTextContent('20')
    })

    it('TC-AICP-317 does not fetch for a record the score does not read', async () => {
        await announce('store.discounts_patch', 'store_discount')

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
