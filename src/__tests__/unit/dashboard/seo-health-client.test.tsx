import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
    SeoHealthCardLoadState,
    SeoHealthIssueAction,
} from '@/lib/dashboard/dashboard-types'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/components/dashboard/revamp/seo-health-card', () => ({
    SeoHealthCard: ({
        data,
        onIssueAction,
        onFixAllMetadata,
        onRetry,
    }: {
        data: SeoHealthCardLoadState
        onIssueAction: (action: SeoHealthIssueAction) => void
        onFixAllMetadata: () => void
        onRetry: () => void
    }) => (
        <div data-testid="score-card" data-state={data.state}>
            {data.state === 'ready' && <span>{data.score}</span>}
            <button onClick={onRetry}>Retry score</button>
            <button onClick={onFixAllMetadata}>Fix all metadata</button>
            <button onClick={() => onIssueAction({ kind: 'fix-meta-title' })}>
                Fix titles
            </button>
            <button
                onClick={() =>
                    onIssueAction({
                        kind: 'edit-business-address',
                        siteId: '42',
                    })
                }
            >
                Edit address
            </button>
        </div>
    ),
}))
vi.mock('@/components/dashboard/AIFixModal', () => ({
    AIFixModal: ({
        isOpen,
        missingSeoItems,
        onClose,
        onSettled,
        revisionToken,
    }: {
        isOpen: boolean
        missingSeoItems: unknown[]
        onClose: () => void
        onSettled?: () => void
        revisionToken?: string | null
    }) =>
        isOpen ? (
            <div
                data-testid="ai-fix-modal"
                data-revision-token={revisionToken ?? ''}
            >
                {missingSeoItems.length} items
                <button onClick={onSettled}>Settle AI fix</button>
                <button onClick={onClose}>Close AI fix</button>
            </div>
        ) : null,
}))

import {
    SeoHealthClient,
    mapLocalSeoResponse,
    seoHealthActionHref,
} from '@/components/dashboard/revamp/seo-health-client'
import type { LocalSeoScoreResponse } from '@/lib/seo/local-seo-score-contract'

const aggregate: LocalSeoScoreResponse = {
    success: true,
    score: 67,
    breakdown: {
        businessData: 12,
        schema: 20,
        aiDiscoverability: 10,
        technicalHealth: 25,
    },
    issues: [
        {
            id: 'meta-title',
            code: 'meta-title',
            count: 1,
            action: { kind: 'fix-meta-title' },
        },
    ],
    aiFixableItemCount: 1,
    evaluatedAt: '2026-08-04T00:00:00.000Z',
    revisionToken: 'a'.repeat(64),
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function deferredResponse() {
    let resolve!: (response: Response) => void
    const promise = new Promise<Response>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(aggregate))
})

// ── TC-F37-04-10: authoritative response mapping ────────────────────────────
describe('[TC-F37-04-10] authoritative score client', () => {
    it('maps exact bucket maxima to qualitative progress', () => {
        // Arrange
        const response: LocalSeoScoreResponse = {
            ...aggregate,
            score: 100,
            breakdown: {
                businessData: 20,
                schema: 35,
                aiDiscoverability: 15,
                technicalHealth: 30,
            },
        }

        // Act
        const result = mapLocalSeoResponse(response)

        // Assert
        expect(result.buckets).toEqual({
            business: { progress: 100, status: 'good' },
            schema: { progress: 100, status: 'good' },
            aiDiscoverability: { progress: 100, status: 'good' },
            technical: { progress: 100, status: 'good' },
        })
    })

    it('uses no-store and replaces loading with a validated score', async () => {
        // Arrange
        render(<SeoHealthClient siteId="42" />)

        // Act
        await waitFor(() =>
            expect(screen.getByTestId('score-card')).toHaveAttribute(
                'data-state',
                'ready',
            ),
        )

        // Assert
        expect(screen.getByText('67')).toBeInTheDocument()
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/sites/42/local-seo-score',
            expect.objectContaining({
                cache: 'no-store',
                signal: expect.any(AbortSignal),
            }),
        )
    })

    it('clears the number and shows error when runtime validation fails', async () => {
        // Arrange
        global.fetch = vi
            .fn()
            .mockResolvedValue(jsonResponse({ ...aggregate, score: 99 }))

        // Act
        render(<SeoHealthClient siteId="42" />)

        // Assert
        await waitFor(() =>
            expect(screen.getByTestId('score-card')).toHaveAttribute(
                'data-state',
                'error',
            ),
        )
        expect(screen.queryByText('67')).not.toBeInTheDocument()
    })

    it('ignores a late response from an aborted generation', async () => {
        // Arrange
        const first = deferredResponse()
        const second = deferredResponse()
        global.fetch = vi
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise)
        render(<SeoHealthClient siteId="42" />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Retry score' }))
        second.resolve(
            jsonResponse({
                ...aggregate,
                score: 68,
                breakdown: { ...aggregate.breakdown, technicalHealth: 26 },
            }),
        )
        await waitFor(() => expect(screen.getByText('68')).toBeInTheDocument())
        first.resolve(jsonResponse(aggregate))

        // Assert
        await waitFor(() =>
            expect(screen.queryByText('67')).not.toBeInTheDocument(),
        )
        expect(screen.getByText('68')).toBeInTheDocument()
    })
})

// ── TC-F37-04-12/16: allowlisted actions and metadata detail ────────────────
describe('[TC-F37-04-12 / TC-F37-04-16] issue actions', () => {
    it.each([
        [
            { kind: 'edit-store-name', siteId: '42' },
            '/editor/42?settingsTab=global&section=brand',
        ],
        [
            { kind: 'edit-business-address', siteId: '42' },
            '/editor/42?settingsTab=global&section=contact&focus=address',
        ],
        [
            { kind: 'edit-phone', siteId: '42' },
            '/editor/42?settingsTab=global&section=contact&focus=phone',
        ],
        [
            { kind: 'edit-schema-subtype', siteId: '42' },
            '/editor/42?settingsTab=global&section=localBusiness&focus=schemaSubtype',
        ],
        [
            { kind: 'edit-opening-hours', siteId: '42' },
            '/editor/42?settingsTab=global&section=localBusiness&focus=openingHours',
        ],
        [
            { kind: 'edit-map-location', siteId: '42' },
            '/editor/42?settingsTab=global&section=localBusiness&focus=map',
        ],
        [
            { kind: 'edit-price-range', siteId: '42' },
            '/editor/42?settingsTab=global&section=localBusiness&focus=priceRange',
        ],
        [{ kind: 'setup-primary-domain' }, '/settings/domains'],
        [{ kind: 'publish-store', siteId: '42' }, '/editor/42?publish=1'],
        [
            { kind: 'edit-content', siteId: '42', pageId: '101' },
            '/editor/42?pageId=101',
        ],
        [{ kind: 'edit-image-alt', productId: '201' }, '/products/201'],
        [
            { kind: 'setup-search-verification', siteId: '42' },
            '/editor/42?settingsTab=seo&section=searchVerification',
        ],
    ] as const)(
        'routes %j to its allowlisted destination',
        (action, expected) => {
            // Arrange — table supplies a contract action.

            // Act
            const href = seoHealthActionHref(action)

            // Assert
            expect(href).toBe(expected)
        },
    )

    it('loads revision-matched metadata details once before opening AI Fix', async () => {
        // Arrange
        const detail = deferredResponse()
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(aggregate))
            .mockReturnValueOnce(detail.promise)
        render(<SeoHealthClient siteId="42" />)
        await waitFor(() =>
            expect(screen.getByTestId('score-card')).toHaveAttribute(
                'data-state',
                'ready',
            ),
        )

        // Act
        fireEvent.click(
            screen.getByRole('button', { name: 'Fix all metadata' }),
        )
        fireEvent.click(
            screen.getByRole('button', { name: 'Fix all metadata' }),
        )
        detail.resolve(
            jsonResponse({
                success: true,
                detail: 'metadata',
                items: [
                    {
                        collection: 'pages',
                        id: '101',
                        title: 'Home',
                        missingFields: ['title'],
                    },
                ],
                page: 1,
                hasNextPage: true,
                revisionToken: aggregate.revisionToken,
            }),
        )

        // Assert
        await waitFor(() =>
            expect(screen.getByTestId('ai-fix-modal')).toHaveTextContent(
                '1 items',
            ),
        )
        expect(screen.getByTestId('ai-fix-modal')).toHaveAttribute(
            'data-revision-token',
            aggregate.revisionToken,
        )
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(global.fetch).toHaveBeenLastCalledWith(
            '/api/sites/42/local-seo-score?detail=metadata&page=1',
            expect.objectContaining({
                cache: 'no-store',
                signal: expect.any(AbortSignal),
            }),
        )

        vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(aggregate))
        fireEvent.click(screen.getByRole('button', { name: 'Settle AI fix' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3))
        expect(global.fetch).toHaveBeenLastCalledWith(
            '/api/sites/42/local-seo-score',
            expect.objectContaining({ cache: 'no-store' }),
        )

        fireEvent.click(screen.getByRole('button', { name: 'Close AI fix' }))
        expect(screen.queryByTestId('ai-fix-modal')).not.toBeInTheDocument()
        expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('closes a metadata proposal when the active site changes', async () => {
        // Arrange
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(aggregate))
            .mockResolvedValueOnce(
                jsonResponse({
                    success: true,
                    detail: 'metadata',
                    items: [
                        {
                            collection: 'pages',
                            id: '101',
                            title: 'Home',
                            missingFields: ['title'],
                        },
                    ],
                    page: 1,
                    hasNextPage: false,
                    revisionToken: aggregate.revisionToken,
                }),
            )
            .mockResolvedValueOnce(jsonResponse(aggregate))
        const { rerender } = render(<SeoHealthClient siteId="42" />)
        await waitFor(() =>
            expect(screen.getByTestId('score-card')).toHaveAttribute(
                'data-state',
                'ready',
            ),
        )
        fireEvent.click(
            screen.getByRole('button', { name: 'Fix all metadata' }),
        )
        await waitFor(() =>
            expect(screen.getByTestId('ai-fix-modal')).toBeInTheDocument(),
        )

        // Act
        rerender(<SeoHealthClient siteId="43" />)

        // Assert
        await waitFor(() =>
            expect(global.fetch).toHaveBeenLastCalledWith(
                '/api/sites/43/local-seo-score',
                expect.objectContaining({ cache: 'no-store' }),
            ),
        )
        expect(screen.queryByTestId('ai-fix-modal')).not.toBeInTheDocument()
    })

    it('requests a server-filtered title batch for a title issue action', async () => {
        // Arrange
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(aggregate))
            .mockResolvedValueOnce(
                jsonResponse({
                    success: true,
                    detail: 'metadata',
                    items: [
                        {
                            collection: 'pages',
                            id: 'title-101',
                            title: 'Title gap beyond the first batch',
                            missingFields: ['title'],
                        },
                    ],
                    page: 1,
                    hasNextPage: false,
                    revisionToken: aggregate.revisionToken,
                }),
            )
        render(<SeoHealthClient siteId="42" />)
        await waitFor(() =>
            expect(screen.getByTestId('score-card')).toHaveAttribute(
                'data-state',
                'ready',
            ),
        )

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Fix titles' }))

        // Assert
        await waitFor(() =>
            expect(screen.getByTestId('ai-fix-modal')).toHaveTextContent(
                '1 items',
            ),
        )
        expect(global.fetch).toHaveBeenLastCalledWith(
            '/api/sites/42/local-seo-score?detail=metadata&page=1&field=title',
            expect.objectContaining({
                cache: 'no-store',
                signal: expect.any(AbortSignal),
            }),
        )
    })

    it('routes seller actions without trusting an API-provided URL', async () => {
        // Arrange
        render(<SeoHealthClient siteId="42" />)
        await waitFor(() =>
            expect(screen.getByTestId('score-card')).toHaveAttribute(
                'data-state',
                'ready',
            ),
        )

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Edit address' }))

        // Assert
        expect(mocks.push).toHaveBeenCalledWith(
            '/editor/42?settingsTab=global&section=contact&focus=address',
        )
    })
})
