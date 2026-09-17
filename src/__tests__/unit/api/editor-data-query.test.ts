import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    EditorDataRequestError,
    editorDataQueryKey,
    editorDataQueryOptions,
} from '@/lib/api/editor-data'

describe('editorDataQueryOptions', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('TC-F07.039 — scopes fresh editor data by site and page', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ site: { id: 'site-1' }, page: { id: 'page-2' } }),
        })
        vi.stubGlobal('fetch', fetchMock)
        const options = editorDataQueryOptions<{ site: { id: string }; page: { id: string } }>({
            siteId: 'site-1',
            pageId: 'page-2',
        })

        const result = await options.queryFn?.({ signal: new AbortController().signal } as never)

        expect(options.queryKey).toEqual(editorDataQueryKey({ siteId: 'site-1', pageId: 'page-2' }))
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/api\/sites\/site-1\/editor-data\?pageId=page-2$/),
            expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
        )
        expect(result).toEqual({ site: { id: 'site-1' }, page: { id: 'page-2' } })
    })

    it('TC-F07.039 — exposes HTTP status for the editor 401 redirect', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
        const options = editorDataQueryOptions<unknown>({ siteId: 'site-1' })

        await expect(options.queryFn?.({ signal: new AbortController().signal } as never))
            .rejects.toEqual(expect.objectContaining<Partial<EditorDataRequestError>>({ status: 401 }))
    })
})
