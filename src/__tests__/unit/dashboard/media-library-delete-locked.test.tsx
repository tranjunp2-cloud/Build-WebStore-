/**
 * TC-PERF-188 — Media page: a legacy file the shop's site uses but the shop does not own (`canDelete: false` from
 * /api/media/library) shows a disabled Delete with the reason (tooltip + visible line) and never sends DELETE;
 * own files keep a working Delete.
 * TC-PERF-190/191 — upload and delete go to the app session routes (`/api/media/upload`, `/api/media/library/{id}`),
 * never Payload REST (`/api/media`), which refused the post-OTP session with 403 (GH-2187).
 * Real: media page, en.json (`mediaLibrary.deleteLocked`). Faked: fetch, next/image, the toast.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/image', () => ({ default: (props: { alt: string }) => <span data-testid="img">{props.alt}</span> }))
vi.mock('@/i18n', async () => {
    const en = (await import('@/i18n/locales/en.json')).default
    return { useI18n: () => ({ t: en, ti: (s: string) => s, locale: 'en' }) }
})

import MediaLibraryPage from '@/app/(dashboard)/media/page'

const doc = (id: string, canDelete: boolean) => ({
    id, filename: `f${id}.png`, alt: `alt ${id}`, mimeType: 'image/png', filesize: 10, url: `/m/${id}`,
    createdAt: '2026-10-22T00:00:00Z', canDelete,
})

describe('media library Delete on files the shop does not own [TC-PERF-188]', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        toast.error.mockClear()
        fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
            init?.method === 'DELETE'
                ? { ok: true, json: async () => ({}) }
                : { ok: true, json: async () => ({ docs: [doc('1', true), doc('2', false)] }) })
        vi.stubGlobal('fetch', fetchMock)
        render(<MediaLibraryPage />)
        await act(async () => {})
    })
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    it('TC-PERF-188: legacy row → Delete is disabled with the reason, clicking sends nothing', async () => {
        // Act
        fireEvent.click(screen.getByText('alt 2'))
        const del = screen.getByRole('button', { name: /delete/i })
        await act(async () => { fireEvent.click(del) })

        // Assert
        expect(del).toHaveAttribute('aria-disabled', 'true')
        expect(del.getAttribute('title')).toBe(en.mediaLibrary.deleteLocked)
        expect(screen.getByText(en.mediaLibrary.deleteLocked)).toBeInTheDocument()
        expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(false)
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('TC-PERF-188: own row → Delete works', async () => {
        // Act
        fireEvent.click(screen.getByText('alt 1'))
        const del = screen.getByRole('button', { name: /delete/i })
        await act(async () => { fireEvent.click(del) })

        // Assert
        expect(del).not.toHaveAttribute('aria-disabled')
        expect(fetchMock).toHaveBeenCalledWith('/api/media/library/1', expect.objectContaining({ method: 'DELETE' }))
        expect(toast.success).toHaveBeenCalled()
    })
})

describe('media library upload and delete use the app session routes, not Payload REST [TC-PERF-190, TC-PERF-191]', () => {
    let fetchMock: ReturnType<typeof vi.fn>
    beforeEach(async () => {
        toast.error.mockClear()
        toast.success.mockClear()
        fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
            init?.method === 'POST' || init?.method === 'DELETE'
                ? { ok: true, json: async () => ({ id: '3' }) }
                : { ok: true, json: async () => ({ docs: [doc('1', true)] }) })
        vi.stubGlobal('fetch', fetchMock)
        render(<MediaLibraryPage />)
        await act(async () => {})
    })
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    it('TC-PERF-190: upload posts the file + alt to /api/media/upload, then reloads the library', async () => {
        // Arrange
        const input = document.querySelector('input[type="file"]') as HTMLInputElement
        const file = new File(['x'], 'summer-sale_banner.png', { type: 'image/png' })

        // Act
        await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })

        // Assert
        const posts = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
        expect(posts).toHaveLength(1)
        expect(posts[0][0]).toBe('/api/media/upload')
        const body = (posts[0][1] as RequestInit).body as FormData
        expect(body.get('file')).toBeInstanceOf(File)
        expect(body.get('alt')).toBe('summer sale banner')
        expect(fetchMock.mock.calls.some(([url]) => url === '/api/media')).toBe(false)
        expect(fetchMock.mock.calls.filter(([url]) => url === '/api/media/library')).toHaveLength(2)
        expect(toast.success).toHaveBeenCalled()
        expect(toast.error).not.toHaveBeenCalled()
    })

    it('TC-PERF-191: a refused delete keeps the file and shows "Delete failed"', async () => {
        // Arrange
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
            init?.method === 'DELETE' ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ docs: [doc('1', true)] }) })
        fireEvent.click(screen.getByText('alt 1'))

        // Act
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /delete/i })) })

        // Assert
        expect(fetchMock).toHaveBeenCalledWith('/api/media/library/1', expect.objectContaining({ method: 'DELETE' }))
        expect(toast.error).toHaveBeenCalledWith(en.mediaLibrary.deleteFailed)
        expect(screen.getAllByText('alt 1').length).toBeGreaterThan(0)
    })
})
