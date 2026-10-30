/**
 * Unit Tests — AI Fix modal: partial results, failed-item retry, real error reason
 * Coverage Map (docs/qa/F37-local-seo.md):
 *   TC-F37-04-37 → partial results go to review with a failed-items note
 *   TC-F37-04-38 → "Retry failed items" re-sends only the failed items and merges results
 *   TC-F37-04-39 → nothing generated shows the real reason (not always "took too long")
 *   TC-F37-04-53 → provider rate limit ("busy") has its own message, distinct from the usage limit
 */

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/i18n', async () => {
    const en = (await import('@/i18n/locales/en.json')).default
    return {
        useI18n: () => ({
            t: en,
            ti: (template: string, vars: Record<string, string | number>) =>
                template.replace(/\{(\w+)\}/g, (_, key: string) =>
                    String(vars[key] ?? `{${key}}`),
                ),
        }),
    }
})

import en from '@/i18n/locales/en.json'
import { AIFixModal } from '@/components/dashboard/AIFixModal'

const REVISION = 'a'.repeat(64)
const aifix = en.dashboard.seo.aifix

const items = ['1', '2', '3', '4'].map((id) => ({
    collection: 'pages' as const,
    id,
    title: `Page ${id}`,
    missingFields: ['title'],
}))

const sse = (...events: Array<Record<string, unknown>>) =>
    ': ping\n\n' + events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')

const fix = (id: string) => ({
    id,
    targetId: id,
    collection: 'pages',
    name: `Page ${id}`,
    proposedTitle: `Title ${id}`,
})
const failed = (id: string, reason: string) => ({
    error: 'item_failed',
    targetId: id,
    collection: 'pages',
    name: `Page ${id}`,
    reason,
})

function streamResponse(body: string) {
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

function fixAllBodies(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls
        .filter(([url]) => url === '/api/seo/fix-all')
        .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

function renderModal() {
    return render(
        <AIFixModal
            isOpen
            onClose={vi.fn()}
            siteId="site-1"
            revisionToken={REVISION}
            missingSeoItems={items}
        />,
    )
}

describe('AIFixModal partial results and failures [TC-F37-04-37..39]', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })

    it('[TC-F37-04-37] shows partial fixes in review with a note naming the failed items', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(
            streamResponse(
                sse(
                    fix('1'),
                    fix('2'),
                    failed('3', 'timeout'),
                    failed('4', 'timeout'),
                    { done: true, succeeded: 2, failed: 2 },
                ),
            ),
        )

        // Act
        renderModal()

        // Assert — failures are not listed as fixes
        const note = await screen.findByTestId('aifix-failed-note')
        expect(note.textContent).toContain(
            '2 items couldn\'t be generated: Page 3, Page 4 (the AI took too long)',
        )
        expect(screen.getByText('Page 1')).toBeTruthy()
        expect(screen.getByText('Page 2')).toBeTruthy()
        expect(screen.queryByText('Page 3', { exact: true })).toBeNull()
        expect(screen.getByText('2 fixes proposed')).toBeTruthy()
        expect(screen.getByText(aifix.retryFailed)).toBeTruthy()
    })

    it('[TC-F37-04-38] retry sends only the failed items and keeps the earlier fixes', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(
                streamResponse(
                    sse(fix('1'), fix('2'), failed('3', 'unavailable'), failed('4', 'unavailable')),
                ),
            )
            .mockResolvedValueOnce(
                streamResponse(sse(fix('3'), failed('4', 'quota'), { done: true, succeeded: 1, failed: 1 })),
            )
        renderModal()
        fireEvent.click(await screen.findByText(aifix.retryFailed))

        // Assert — second call carries only items 3 and 4, same revision
        await waitFor(() => expect(fixAllBodies(fetchMock)).toHaveLength(2))
        const [first, retry] = fixAllBodies(fetchMock)
        expect(first.missingSeo.map((item: { id: string }) => item.id)).toEqual(['1', '2', '3', '4'])
        expect(retry.missingSeo.map((item: { id: string }) => item.id)).toEqual(['3', '4'])
        expect(retry.revisionToken).toBe(REVISION)

        // Review now has fixes 1-3 and the note only names the remaining failure
        await waitFor(() => expect(screen.getByText('3 fixes proposed')).toBeTruthy())
        const note = screen.getByTestId('aifix-failed-note')
        expect(note.textContent).toContain('1 items couldn\'t be generated: Page 4 (AI usage limit reached)')
    })

    it.each([
        ['timeout', aifix.errorTimeout],
        ['quota', aifix.errorQuota],
        ['busy', aifix.errorBusy],
        ['unavailable', aifix.errorUnavailable],
        ['failed', aifix.errorFailed],
    ])('[TC-F37-04-39] when every item fails with %s the modal shows that reason', async (reason, message) => {
        // Arrange
        fetchMock.mockResolvedValueOnce(
            streamResponse(
                sse(...items.map((item) => failed(item.id, reason)), { done: true, succeeded: 0, failed: 4 }),
            ),
        )

        // Act
        renderModal()

        // Assert — header subtitle and the last task line carry the real reason
        await waitFor(() => expect(screen.getAllByText(message).length).toBeGreaterThan(0))
        if (reason !== 'timeout') {
            expect(screen.queryByText(aifix.errorTimeout)).toBeNull()
        }
        expect(screen.queryByTestId('aifix-failed-note')).toBeNull()
    })

    it('[TC-F37-04-39] overall timeout with nothing generated shows the timeout reason', async () => {
        fetchMock.mockResolvedValueOnce(
            streamResponse(
                sse({
                    error: 'timeout',
                    message: 'AI Fix timed out after 50s',
                    pending: items.map((item) => ({
                        targetId: item.id,
                        collection: item.collection,
                        name: item.title,
                    })),
                }),
            ),
        )

        renderModal()

        await waitFor(() => expect(screen.getAllByText(aifix.errorTimeout).length).toBeGreaterThan(0))
    })

    it('[TC-F37-04-53] a busy provider shows the busy message, not the usage-limit one, and keeps "Retry failed items"', async () => {
        // Arrange — two fixes arrive, two items hit the provider rate limit
        fetchMock.mockResolvedValueOnce(
            streamResponse(sse(fix('1'), fix('2'), failed('3', 'busy'), failed('4', 'busy'), { done: true, succeeded: 2, failed: 2 })),
        )

        // Act
        renderModal()

        // Assert
        const note = await screen.findByTestId('aifix-failed-note')
        expect(note.textContent).toContain("2 items couldn't be generated: Page 3, Page 4 (the AI is busy)")
        expect(note.textContent).not.toContain(aifix.reasonQuota)
        expect(screen.getByText(aifix.retryFailed)).toBeTruthy()
        expect(aifix.errorBusy).toBe('The AI is busy right now. Please try again in a minute.')
    })

    it('[TC-F37-04-53] a mixed batch leads with the reason the seller can act on first (quota, then busy)', async () => {
        fetchMock.mockResolvedValueOnce(
            streamResponse(
                sse(failed('1', 'busy'), failed('2', 'failed'), failed('3', 'busy'), failed('4', 'timeout'), { done: true, succeeded: 0, failed: 4 }),
            ),
        )

        renderModal()

        await waitFor(() => expect(screen.getAllByText(aifix.errorBusy).length).toBeGreaterThan(0))
        expect(screen.queryByText(aifix.errorQuota)).toBeNull()
    })
})
