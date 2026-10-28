/**
 * TC-AICP-319 — the media library (client fetch of /api/media) refetches silently when the assistant brings pictures
 * in (a `media` change): no spinner, the grid, the search text and the open preview stay; a refetch that fails keeps
 * the list and shows no toast; two quick refetches show the later answer (stale guard); other kinds fetch nothing.
 * Real: media page, the change bus. Faked: fetch, next/image, the toast, i18n strings.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAgentChange } from '@/lib/agent-changes/bus'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span data-testid="img">{props.alt}</span> }))
vi.mock('@/i18n', async () => {
    const en = (await import('@/i18n/locales/en.json')).default
    return { useI18n: () => ({ t: en, ti: (s: string) => s }) }
})

import MediaLibraryPage from '@/app/(dashboard)/media/page'

const doc = (id: string, name: string) => ({ id, filename: name, alt: `alt ${name}`, mimeType: 'image/png', filesize: 10, url: `/m/${name}`, createdAt: '2026-10-22T00:00:00Z' })
const list = (...docs: ReturnType<typeof doc>[]) => ({ ok: true, json: async () => ({ docs }) })
const deferred = () => {
    let resolve!: (v: unknown) => void
    const promise = new Promise((r) => { resolve = r })
    return { promise, resolve }
}
const announce = (entityKind: string) => act(async () => {
    announceAgentChange({ action: 'applied', kind: 'shop_product.update', entities: [{ kind: entityKind, id: '*' }], changeSetId: `cs-${entityKind}`, at: Date.now() })
    await vi.advanceTimersByTimeAsync(200)
})

describe('media library refetches with the assistant [TC-AICP-319]', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        vi.useFakeTimers()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        toast.error.mockClear()
        fetchMock = vi.fn().mockResolvedValue(list(doc('1', 'one.png')))
        vi.stubGlobal('fetch', fetchMock)
        render(<MediaLibraryPage />)
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    })
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('TC-AICP-319 adds the new pictures and keeps the search text and the open preview', async () => {
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'png' } })
        fireEvent.click(screen.getAllByTestId('img')[0])
        expect(screen.getByText('Copy URL')).toBeInTheDocument()
        fetchMock.mockResolvedValueOnce(list(doc('2', 'two.png'), doc('1', 'one.png')))

        await announce('media')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('textbox')).toHaveValue('png')
        expect(screen.getAllByText('alt two.png').length).toBeGreaterThan(0)
        expect(screen.getByText('Copy URL')).toBeInTheDocument()
    })

    it('TC-AICP-319 keeps the grid on screen while it refetches (no loading state)', async () => {
        const pending = deferred()
        fetchMock.mockReturnValueOnce(pending.promise)

        await announce('media')

        expect(screen.getAllByText('alt one.png').length).toBeGreaterThan(0)
        expect(document.querySelector('.animate-spin')).toBeNull()
    })

    it('TC-AICP-319 keeps the list and shows no toast when the refetch fails', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

        await announce('media')

        expect(toast.error).not.toHaveBeenCalled()
        expect(screen.getAllByText('alt one.png').length).toBeGreaterThan(0)
    })

    it('TC-AICP-319 shows the later answer when two refetches overlap', async () => {
        const slow = deferred()
        fetchMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(list(doc('3', 'three.png')))

        await announce('media')
        await announce('media')
        await act(async () => { slow.resolve(list(doc('9', 'stale.png'))) })

        expect(screen.queryByText('alt stale.png')).not.toBeInTheDocument()
        expect(screen.getAllByText('alt three.png').length).toBeGreaterThan(0)
    })

    it('TC-AICP-319 does not fetch for changes to other records', async () => {
        await announce('product')

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
